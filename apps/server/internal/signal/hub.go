package signal

import (
	"encoding/json"
	"log"
	"sync"
)

// Message represents the signaling data exchanged between peers
type Message struct {
	Type    string          `json:"type"` // join, offer, answer, candidate
	RoomID  string          `json:"roomId"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// Hub maintains the set of active clients and broadcasts messages to the rooms
type Hub struct {
	// Registered clients mapped by RoomID
	rooms map[string]map[*Client]bool

	// Inbound messages from the clients
	broadcast chan *MessageWrapper

	// Register requests from the clients
	register chan *Client

	// Unregister requests from clients
	unregister chan *Client

	mu sync.RWMutex
}

type MessageWrapper struct {
	Client  *Client
	Message *Message
}

func NewHub() *Hub {
	return &Hub{
		broadcast:  make(chan *MessageWrapper),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		rooms:      make(map[string]map[*Client]bool),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			if _, ok := h.rooms[client.RoomID]; !ok {
				h.rooms[client.RoomID] = make(map[*Client]bool)
			}
			h.rooms[client.RoomID][client] = true
			roomSize := len(h.rooms[client.RoomID])
			log.Printf("Client joined room %s. Total in room: %d", client.RoomID, roomSize)
			
			// If there is at least one other client in the room, notify both sides
			if roomSize > 1 {
				peerJoinedMsg := &Message{
					Type:   "peer-joined",
					RoomID: client.RoomID,
				}
				for otherClient := range h.rooms[client.RoomID] {
					if otherClient == client {
						// Inform the newly joined client that a peer exists
						select {
						case client.send <- peerJoinedMsg:
							log.Printf("Sent peer-joined to new client in room %s", client.RoomID)
						default:
							close(client.send)
							delete(h.rooms[client.RoomID], client)
						}
						continue
					}

					// Inform existing clients about the new peer
					select {
					case otherClient.send <- peerJoinedMsg:
						log.Printf("Sent peer-joined to existing client in room %s", client.RoomID)
					default:
						close(otherClient.send)
						delete(h.rooms[client.RoomID], otherClient)
					}
				}
			}
			h.mu.Unlock()
			
		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.rooms[client.RoomID]; ok {
				if _, ok := h.rooms[client.RoomID][client]; ok {
					delete(h.rooms[client.RoomID], client)
					close(client.send)
					log.Printf("Client left room %s", client.RoomID)
					if len(h.rooms[client.RoomID]) == 0 {
						delete(h.rooms, client.RoomID)
					}
				}
			}
			h.mu.Unlock()

		case wrapper := <-h.broadcast:
			roomID := wrapper.Message.RoomID
			sender := wrapper.Client
			
			h.mu.RLock()
			clients := h.rooms[roomID]
			for client := range clients {
				// Don't send back to sender
				if client != sender {
					select {
					case client.send <- wrapper.Message:
					default:
						close(client.send)
						delete(h.rooms[roomID], client)
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

