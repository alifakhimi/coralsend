package signal

import (
	"encoding/json"
	"log"
	"sync"
)

// Message represents the signaling data exchanged between peers
type Message struct {
	Type     string          `json:"type"`              // join, offer, answer, candidate, file-meta, member-list, etc.
	RoomID   string          `json:"roomId"`
	DeviceID string          `json:"deviceId,omitempty"`
	TargetID string          `json:"targetId,omitempty"` // Target device for directed messages
	Payload  json.RawMessage `json:"payload,omitempty"`
}

// MemberInfo represents a room member
type MemberInfo struct {
	DeviceID    string `json:"deviceId"`
	DisplayName string `json:"displayName"`
	JoinedAt    int64  `json:"joinedAt"`
	Status      string `json:"status"`
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

// getMemberList returns list of members in a room
func (h *Hub) getMemberList(roomID string) []MemberInfo {
	members := []MemberInfo{}
	if clients, ok := h.rooms[roomID]; ok {
		for client := range clients {
			members = append(members, MemberInfo{
				DeviceID:    client.DeviceID,
				DisplayName: client.DisplayName,
				JoinedAt:    client.JoinedAt,
				Status:      "online",
			})
		}
	}
	return members
}

// broadcastMemberList sends updated member list to all clients in room
func (h *Hub) broadcastMemberList(roomID string) {
	members := h.getMemberList(roomID)
	payload, _ := json.Marshal(members)
	
	msg := &Message{
		Type:    "member-list",
		RoomID:  roomID,
		Payload: payload,
	}
	
	if clients, ok := h.rooms[roomID]; ok {
		for client := range clients {
			select {
			case client.send <- msg:
			default:
				close(client.send)
				delete(h.rooms[roomID], client)
			}
		}
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
			log.Printf("Client %s joined room %s. Total in room: %d", client.DeviceID, client.RoomID, roomSize)
			
			// Notify existing clients about new member
			if roomSize > 1 {
				memberPayload, _ := json.Marshal(MemberInfo{
					DeviceID:    client.DeviceID,
					DisplayName: client.DisplayName,
					JoinedAt:    client.JoinedAt,
					Status:      "online",
				})
				
				memberJoinedMsg := &Message{
					Type:     "member-joined",
					RoomID:   client.RoomID,
					DeviceID: client.DeviceID,
					Payload:  memberPayload,
				}
				
				for otherClient := range h.rooms[client.RoomID] {
					if otherClient != client {
						select {
						case otherClient.send <- memberJoinedMsg:
							log.Printf("Sent member-joined to %s in room %s", otherClient.DeviceID, client.RoomID)
						default:
							close(otherClient.send)
							delete(h.rooms[client.RoomID], otherClient)
						}
					}
				}
			}
			
			// Send current member list to new client
			h.broadcastMemberList(client.RoomID)
			h.mu.Unlock()
			
		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.rooms[client.RoomID]; ok {
				if _, ok := h.rooms[client.RoomID][client]; ok {
					delete(h.rooms[client.RoomID], client)
					close(client.send)
					log.Printf("Client %s left room %s", client.DeviceID, client.RoomID)
					
					// Notify remaining clients about member leaving
					if len(h.rooms[client.RoomID]) > 0 {
						memberPayload, _ := json.Marshal(MemberInfo{
							DeviceID:    client.DeviceID,
							DisplayName: client.DisplayName,
							JoinedAt:    client.JoinedAt,
							Status:      "offline",
						})
						
						memberLeftMsg := &Message{
							Type:     "member-left",
							RoomID:   client.RoomID,
							DeviceID: client.DeviceID,
							Payload:  memberPayload,
						}
						
						for otherClient := range h.rooms[client.RoomID] {
							select {
							case otherClient.send <- memberLeftMsg:
							default:
								close(otherClient.send)
								delete(h.rooms[client.RoomID], otherClient)
							}
						}
					}
					
					if len(h.rooms[client.RoomID]) == 0 {
						delete(h.rooms, client.RoomID)
					}
				}
			}
			h.mu.Unlock()

		case wrapper := <-h.broadcast:
			roomID := wrapper.Message.RoomID
			sender := wrapper.Client
			targetID := wrapper.Message.TargetID
			
			h.mu.RLock()
			clients := h.rooms[roomID]
			
			for client := range clients {
				// Don't send back to sender
				if client == sender {
					continue
				}
				
				// If targetID is set, only send to that specific client
				if targetID != "" && client.DeviceID != targetID {
					continue
				}
				
				select {
				case client.send <- wrapper.Message:
				default:
					close(client.send)
					delete(h.rooms[roomID], client)
				}
			}
			h.mu.RUnlock()
		}
	}
}
