package signal

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 1024 * 1024 // 1MB for file metadata
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// Allow CORS for local dev
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// JoinPayload represents the data sent with a join message
type JoinPayload struct {
	DeviceID    string `json:"deviceId"`
	DisplayName string `json:"displayName"`
}

// Client is a middleman between the websocket connection and the hub.
type Client struct {
	Hub *Hub

	// The websocket connection.
	conn *websocket.Conn

	// Buffered channel of outbound messages.
	send chan *Message

	RoomID      string
	DeviceID    string
	DisplayName string
	JoinedAt    int64
}

// readPump pumps messages from the websocket connection to the hub.
func (c *Client) readPump() {
	defer func() {
		c.Hub.unregister <- c
		c.conn.Close()
	}()
	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error { c.conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}

		var msg Message
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Invalid JSON: %v", err)
			continue
		}

		switch msg.Type {
		case "join":
			// Parse join payload
			var joinPayload JoinPayload
			if msg.Payload != nil {
				json.Unmarshal(msg.Payload, &joinPayload)
			}
			
			c.RoomID = msg.RoomID
			c.DeviceID = joinPayload.DeviceID
			c.DisplayName = joinPayload.DisplayName
			c.JoinedAt = time.Now().UnixMilli()
			
			if c.DeviceID == "" {
				c.DeviceID = msg.DeviceID
			}
			if c.DisplayName == "" {
				c.DisplayName = c.DeviceID
			}
			
			log.Printf("Join request: room=%s, device=%s, name=%s", c.RoomID, c.DeviceID, c.DisplayName)
			c.Hub.register <- c
			
		case "offer", "answer", "candidate":
			// WebRTC signaling - relay to specific target or broadcast
			if c.RoomID == msg.RoomID {
				msg.DeviceID = c.DeviceID // Always set sender's device ID
				c.Hub.broadcast <- &MessageWrapper{Client: c, Message: &msg}
			}
			
		case "file-meta":
			// File metadata broadcast - send to all room members
			if c.RoomID == msg.RoomID {
				msg.DeviceID = c.DeviceID
				c.Hub.broadcast <- &MessageWrapper{Client: c, Message: &msg}
			}
			
		case "file-request":
			// Request to download a file - directed to file owner
			if c.RoomID == msg.RoomID {
				msg.DeviceID = c.DeviceID
				c.Hub.broadcast <- &MessageWrapper{Client: c, Message: &msg}
			}
			
		default:
			// Relay other messages
			if c.RoomID == msg.RoomID {
				msg.DeviceID = c.DeviceID
				c.Hub.broadcast <- &MessageWrapper{Client: c, Message: &msg}
			}
		}
	}
}

// writePump pumps messages from the hub to the websocket connection.
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel.
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			json.NewEncoder(w).Encode(message)

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ServeWs handles websocket requests from the peer.
func ServeWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}
	client := &Client{
		Hub:  hub,
		conn: conn,
		send: make(chan *Message, 256),
	}

	go client.writePump()
	go client.readPump()
}
