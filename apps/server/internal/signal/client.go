package signal

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
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
	CheckOrigin: func(r *http.Request) bool {
		return IsOriginAllowed(r.Header.Get("Origin"))
	},
}

// JoinPayload represents the data sent with a join message
type JoinPayload struct {
	DeviceID string        `json:"deviceId"`
	Settings *RoomSettings `json:"settings,omitempty"`
}

// Client is a middleman between the websocket connection and the hub.
type Client struct {
	Hub *Hub

	// The websocket connection.
	conn    *websocket.Conn
	writeMu sync.Mutex

	// Buffered channel of outbound messages.
	send chan *Message

	RoomID   string
	DeviceID string
	JoinedAt int64
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
			c.closePolicy("invalid_json")
			return
		}
		if err := validateInboundMessage(&msg, c.RoomID != ""); err != nil {
			c.closePolicy(err.Error())
			return
		}
		if c.RoomID != "" && msg.RoomID != c.RoomID {
			c.closePolicy("room_mismatch")
			return
		}
		if isEncryptedRelayType(msg.Type) && msg.TargetID != "" && !c.Hub.hasMember(c.RoomID, msg.TargetID) {
			c.closePolicy("invalid_target")
			return
		}

		switch msg.Type {
		case "join":
			// Parse join payload
			var joinPayload JoinPayload
			if msg.Payload == nil || json.Unmarshal(msg.Payload, &joinPayload) != nil {
				c.closePolicy("invalid_join_payload")
				return
			}

			c.RoomID = msg.RoomID
			c.DeviceID = joinPayload.DeviceID
			c.JoinedAt = time.Now().UnixMilli()

			if !validDeviceID(c.DeviceID) {
				c.closePolicy("invalid_device_id")
				return
			}
			if joinPayload.Settings != nil && !validRoomSettings(*joinPayload.Settings) {
				c.closePolicy("invalid_room_settings")
				return
			}

			log.Printf("Join request: room=%s, device=%s", c.RoomID, c.DeviceID)
			c.Hub.HandleJoin(c, joinPayload.Settings)

		case "room-settings":
			if c.RoomID == msg.RoomID {
				var payload struct {
					RoomSettings
					HostToken string `json:"hostToken,omitempty"`
				}
				if msg.Payload == nil || json.Unmarshal(msg.Payload, &payload) != nil || !validRoomSettings(payload.RoomSettings) {
					c.closePolicy("invalid_room_settings")
					return
				}
				c.Hub.UpdateRoomSettings(c.RoomID, payload.RoomSettings, c.DeviceID, payload.HostToken)
				msg.DeviceID = c.DeviceID
				c.Hub.broadcast <- &MessageWrapper{Client: c, Message: &msg}
			}

		case "join-approved":
			if c.RoomID == msg.RoomID && msg.TargetID != "" {
				var payload struct {
					RequesterID string `json:"requesterId"`
					HostToken   string `json:"hostToken,omitempty"`
				}
				if msg.Payload != nil {
					_ = json.Unmarshal(msg.Payload, &payload)
				}
				requesterID := payload.RequesterID
				if requesterID == "" {
					requesterID = msg.TargetID
				}
				c.Hub.HandleJoinDecision(c.RoomID, requesterID, true, c.DeviceID, payload.HostToken)
			}

		case "join-rejected":
			if c.RoomID == msg.RoomID && msg.TargetID != "" {
				var payload struct {
					RequesterID string `json:"requesterId"`
					HostToken   string `json:"hostToken,omitempty"`
				}
				if msg.Payload != nil {
					_ = json.Unmarshal(msg.Payload, &payload)
				}
				requesterID := payload.RequesterID
				if requesterID == "" {
					requesterID = msg.TargetID
				}
				c.Hub.HandleJoinDecision(c.RoomID, requesterID, false, c.DeviceID, payload.HostToken)
			}

		case "peer-profile", "offer", "answer", "candidate":
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

		case "leave":
			if c.RoomID != "" {
				// Client explicitly leaving; close connection to trigger unregister via readPump defer
				c.conn.Close()
				return
			}

		case "member-remove":
			// Remove a member from room (targeted kick)
			if c.RoomID == msg.RoomID && msg.TargetID != "" {
				var payload struct {
					HostToken string `json:"hostToken,omitempty"`
				}
				if msg.Payload != nil {
					_ = json.Unmarshal(msg.Payload, &payload)
				}
				c.Hub.RemoveClient(c.RoomID, msg.TargetID, c.DeviceID, payload.HostToken)
			}

		case "file-meta-sync-request", "chat":
			msg.DeviceID = c.DeviceID
			c.Hub.broadcast <- &MessageWrapper{Client: c, Message: &msg}
		}
	}
}

func (c *Client) closePolicy(code string) {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	data, _ := json.Marshal(map[string]string{"code": code})
	_ = c.conn.WriteJSON(&Message{Version: ProtocolVersion, Type: "error", RoomID: c.RoomID, Payload: data})
	_ = c.conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.ClosePolicyViolation, code), time.Now().Add(writeWait))
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
			c.writeMu.Lock()
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel.
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				c.writeMu.Unlock()
				return
			}

			if message.Version == 0 {
				message.Version = ProtocolVersion
			}
			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				c.writeMu.Unlock()
				return
			}
			json.NewEncoder(w).Encode(message)

			if err := w.Close(); err != nil {
				c.writeMu.Unlock()
				return
			}
			c.writeMu.Unlock()
		case <-ticker.C:
			c.writeMu.Lock()
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				c.writeMu.Unlock()
				return
			}
			c.writeMu.Unlock()
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
