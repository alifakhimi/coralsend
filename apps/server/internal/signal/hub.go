package signal

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"log"
	"os"
	"sync"
	"time"
)

// Message represents the signaling data exchanged between peers
type Message struct {
	Type     string          `json:"type"` // join, offer, answer, candidate, file-meta, member-list, etc.
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

type RoomSettings struct {
	MaxMembers      int    `json:"maxMembers"`
	AutoExpire      string `json:"autoExpire"`
	RequireApproval bool   `json:"requireApproval"`
	HostManagement  bool   `json:"hostManagement"`
}

func defaultRoomSettings() RoomSettings {
	return RoomSettings{
		MaxMembers:      8,
		AutoExpire:      "never",
		RequireApproval: false,
		HostManagement:  false,
	}
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

	roomSettings map[string]RoomSettings
	pendingJoins map[string]map[string]*Client
	lastActivity map[string]int64
	roomHosts    map[string]string // roomID -> hostDeviceID

	mu sync.RWMutex
}

type MessageWrapper struct {
	Client  *Client
	Message *Message
}

func NewHub() *Hub {
	return &Hub{
		broadcast:    make(chan *MessageWrapper),
		register:     make(chan *Client),
		unregister:   make(chan *Client),
		rooms:        make(map[string]map[*Client]bool),
		roomSettings: make(map[string]RoomSettings),
		pendingJoins: make(map[string]map[string]*Client),
		lastActivity: make(map[string]int64),
		roomHosts:    make(map[string]string),
	}
}

func getHostSecret() []byte {
	secret := os.Getenv("HOST_SECRET")
	if secret == "" {
		return []byte("dev-host-secret-change-in-production")
	}
	return []byte(secret)
}

func (h *Hub) generateHostToken(roomID string) string {
	mac := hmac.New(sha256.New, getHostSecret())
	mac.Write([]byte(roomID))
	return hex.EncodeToString(mac.Sum(nil))
}

func (h *Hub) verifyHostToken(roomID, token string) bool {
	expected := h.generateHostToken(roomID)
	return hmac.Equal([]byte(expected), []byte(token))
}

func (h *Hub) isHost(roomID, deviceID string) bool {
	hostID, ok := h.roomHosts[roomID]
	return ok && hostID == deviceID
}

// CanPerformHostAction returns true only when hostManagement is ON AND token is valid AND requester is host.
// When hostManagement is OFF, no one can perform host actions (approve/remove).
func (h *Hub) CanPerformHostAction(roomID, requesterDeviceID, hostToken string) bool {
	settings, ok := h.roomSettings[roomID]
	if !ok || !settings.HostManagement {
		return false
	}
	return h.verifyHostToken(roomID, hostToken) && h.isHost(roomID, requesterDeviceID)
}

func parseAutoExpireDuration(value string) time.Duration {
	switch value {
	case "1h":
		return time.Hour
	case "24h":
		return 24 * time.Hour
	case "7d":
		return 7 * 24 * time.Hour
	default:
		return 0
	}
}

func (h *Hub) sendToClient(client *Client, msgType string, payload interface{}) {
	data, _ := json.Marshal(payload)
	msg := &Message{
		Type:    msgType,
		RoomID:  client.RoomID,
		Payload: data,
	}
	select {
	case client.send <- msg:
	default:
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

func (h *Hub) roomExpiredLocked(roomID string) bool {
	settings, ok := h.roomSettings[roomID]
	if !ok {
		return false
	}
	ttl := parseAutoExpireDuration(settings.AutoExpire)
	if ttl <= 0 {
		return false
	}
	last := h.lastActivity[roomID]
	if last == 0 {
		return false
	}
	return time.Now().UnixMilli()-last >= ttl.Milliseconds()
}

func (h *Hub) touchRoomLocked(roomID string) {
	h.lastActivity[roomID] = time.Now().UnixMilli()
}

func (h *Hub) closeRoomLocked(roomID string, reason string) {
	if clients, ok := h.rooms[roomID]; ok {
		data, _ := json.Marshal(map[string]string{"reason": reason})
		msg := &Message{
			Type:    "room-expired",
			RoomID:  roomID,
			Payload: data,
		}
		for client := range clients {
			select {
			case client.send <- msg:
			default:
			}
			close(client.send)
			_ = client.conn.Close()
		}
	}
	if pending, ok := h.pendingJoins[roomID]; ok {
		data, _ := json.Marshal(map[string]string{"reason": reason})
		msg := &Message{
			Type:    "room-expired",
			RoomID:  roomID,
			Payload: data,
		}
		for _, pendingClient := range pending {
			select {
			case pendingClient.send <- msg:
			default:
			}
			close(pendingClient.send)
			_ = pendingClient.conn.Close()
		}
	}
	delete(h.rooms, roomID)
	delete(h.pendingJoins, roomID)
	delete(h.roomSettings, roomID)
	delete(h.lastActivity, roomID)
	delete(h.roomHosts, roomID)
}

// removeClientLocked removes a client from the room, notifies others, and closes their connection.
// reason is for logging (e.g. "replaced", "left").
func (h *Hub) removeClientLocked(roomID string, targetClient *Client, reason string) {
	clients, ok := h.rooms[roomID]
	if !ok {
		return
	}
	if _, ok := clients[targetClient]; !ok {
		return
	}
	delete(h.rooms[roomID], targetClient)
	h.touchRoomLocked(roomID)
	log.Printf("Client %s left room %s (%s)", targetClient.DeviceID, roomID, reason)

	leftPayload, _ := json.Marshal(MemberInfo{
		DeviceID:    targetClient.DeviceID,
		DisplayName: targetClient.DisplayName,
		JoinedAt:    targetClient.JoinedAt,
		Status:      "offline",
	})
	memberLeftMsg := &Message{
		Type:     "member-left",
		RoomID:   roomID,
		DeviceID: targetClient.DeviceID,
		Payload:  leftPayload,
	}
	for c := range h.rooms[roomID] {
		select {
		case c.send <- memberLeftMsg:
		default:
			close(c.send)
			delete(h.rooms[roomID], c)
		}
	}
	h.broadcastMemberList(roomID)

	go func(c *Client) {
		time.Sleep(100 * time.Millisecond)
		close(c.send)
		_ = c.conn.Close()
	}(targetClient)
}

func (h *Hub) registerClientLocked(client *Client) {
	if _, ok := h.rooms[client.RoomID]; !ok {
		h.rooms[client.RoomID] = make(map[*Client]bool)
	}
	h.rooms[client.RoomID][client] = true
	h.touchRoomLocked(client.RoomID)
	roomSize := len(h.rooms[client.RoomID])
	log.Printf("Client %s joined room %s. Total in room: %d", client.DeviceID, client.RoomID, roomSize)

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

	h.broadcastMemberList(client.RoomID)
}

func (h *Hub) HandleJoin(client *Client, settings *RoomSettings) {
	h.mu.Lock()
	defer h.mu.Unlock()

	roomID := client.RoomID
	if h.roomExpiredLocked(roomID) {
		h.closeRoomLocked(roomID, "expired")
		h.sendToClient(client, "room-expired", map[string]string{"reason": "expired"})
		return
	}

	roomSettings, exists := h.roomSettings[roomID]
	if !exists {
		roomSettings = defaultRoomSettings()
		if settings != nil {
			if settings.MaxMembers > 0 {
				roomSettings.MaxMembers = settings.MaxMembers
			}
			if settings.AutoExpire != "" {
				roomSettings.AutoExpire = settings.AutoExpire
			}
			roomSettings.RequireApproval = settings.RequireApproval
			roomSettings.HostManagement = settings.HostManagement
		}
		h.roomSettings[roomID] = roomSettings
	}

	// If same deviceId already in room (stale reconnect), remove old connection first
	// so rejoining user doesn't hit "room full" from their own stale slot
	if clients, ok := h.rooms[roomID]; ok {
		for c := range clients {
			if c.DeviceID == client.DeviceID && c != client {
				h.removeClientLocked(roomID, c, "replaced")
				break
			}
		}
	}

	currentMembers := len(h.rooms[roomID])
	if roomSettings.MaxMembers > 0 && currentMembers >= roomSettings.MaxMembers {
		h.sendToClient(client, "room-full", map[string]string{"reason": "room_full"})
		return
	}

	// First member = host: assign and send host-assigned
	isFirstMember := currentMembers == 0
	if isFirstMember {
		h.roomHosts[roomID] = client.DeviceID
		token := h.generateHostToken(roomID)
		h.sendToClient(client, "host-assigned", map[string]string{
			"token":    token,
			"deviceId": client.DeviceID,
		})
	} else if hostID, ok := h.roomHosts[roomID]; ok && hostID == client.DeviceID {
		// Host rejoining: send host-assigned again
		token := h.generateHostToken(roomID)
		h.sendToClient(client, "host-assigned", map[string]string{
			"token":    token,
			"deviceId": client.DeviceID,
		})
	}

	if roomSettings.RequireApproval && roomSettings.HostManagement && currentMembers > 0 {
		if _, ok := h.pendingJoins[roomID]; !ok {
			h.pendingJoins[roomID] = make(map[string]*Client)
		}
		h.pendingJoins[roomID][client.DeviceID] = client

		requestPayload, _ := json.Marshal(MemberInfo{
			DeviceID:    client.DeviceID,
			DisplayName: client.DisplayName,
			JoinedAt:    client.JoinedAt,
			Status:      "connecting",
		})
		requestMsg := &Message{
			Type:     "join-request",
			RoomID:   roomID,
			DeviceID: client.DeviceID,
			Payload:  requestPayload,
		}
		for existingClient := range h.rooms[roomID] {
			select {
			case existingClient.send <- requestMsg:
			default:
				close(existingClient.send)
				delete(h.rooms[roomID], existingClient)
			}
		}
		h.sendToClient(client, "join-pending", map[string]string{"reason": "awaiting_approval"})
		return
	}

	h.registerClientLocked(client)
}

func (h *Hub) RemoveClient(roomID string, targetDeviceID string, removedBy string, hostToken string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	// When hostManagement is OFF, no one can remove. When ON, only host with valid token can.
	if !h.CanPerformHostAction(roomID, removedBy, hostToken) {
		return
	}

	clients, ok := h.rooms[roomID]
	if !ok {
		return
	}

	var targetClient *Client
	for client := range clients {
		if client.DeviceID == targetDeviceID {
			targetClient = client
			break
		}
	}
	if targetClient == nil {
		return
	}

	removedPayload, _ := json.Marshal(map[string]string{
		"removedBy": removedBy,
	})
	select {
	case targetClient.send <- &Message{
		Type:    "member-removed",
		RoomID:  roomID,
		Payload: removedPayload,
	}:
	default:
	}

	// Remove from room but do NOT close connection yet — client must receive
	// member-removed and navigate away. Closing here can drop the message.
	delete(h.rooms[roomID], targetClient)
	h.touchRoomLocked(roomID)

	// Close connection after a short delay so writePump can send member-removed.
	// Client will typically navigate away before this; this prevents resource leaks.
	go func(c *Client) {
		time.Sleep(500 * time.Millisecond)
		close(c.send)
		_ = c.conn.Close()
	}(targetClient)

	leftPayload, _ := json.Marshal(MemberInfo{
		DeviceID:    targetClient.DeviceID,
		DisplayName: targetClient.DisplayName,
		JoinedAt:    targetClient.JoinedAt,
		Status:      "offline",
	})
	memberLeftMsg := &Message{
		Type:     "member-left",
		RoomID:   roomID,
		DeviceID: targetClient.DeviceID,
		Payload:  leftPayload,
	}
	for client := range h.rooms[roomID] {
		select {
		case client.send <- memberLeftMsg:
		default:
			close(client.send)
			delete(h.rooms[roomID], client)
		}
	}
	h.broadcastMemberList(roomID)
}

func (h *Hub) HandleJoinDecision(roomID string, requesterID string, approved bool, approverDeviceID string, hostToken string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	// When hostManagement is OFF, no one can approve/reject. When ON, only host with valid token can.
	if !h.CanPerformHostAction(roomID, approverDeviceID, hostToken) {
		return
	}

	pendingRoom, ok := h.pendingJoins[roomID]
	if !ok {
		return
	}
	pendingClient, ok := pendingRoom[requesterID]
	if !ok {
		return
	}
	delete(pendingRoom, requesterID)
	if len(pendingRoom) == 0 {
		delete(h.pendingJoins, roomID)
	}

	if !approved {
		h.sendToClient(pendingClient, "join-rejected", map[string]string{"reason": "rejected"})
		resolutionPayload, _ := json.Marshal(map[string]string{
			"requesterId": requesterID,
			"status":      "rejected",
		})
		resolutionMsg := &Message{
			Type:    "join-request-resolved",
			RoomID:  roomID,
			Payload: resolutionPayload,
		}
		for existingClient := range h.rooms[roomID] {
			select {
			case existingClient.send <- resolutionMsg:
			default:
				close(existingClient.send)
				delete(h.rooms[roomID], existingClient)
			}
		}
		return
	}

	settings := h.roomSettings[roomID]
	if settings.MaxMembers > 0 && len(h.rooms[roomID]) >= settings.MaxMembers {
		h.sendToClient(pendingClient, "room-full", map[string]string{"reason": "room_full"})
		return
	}

	h.sendToClient(pendingClient, "join-approved", map[string]string{"reason": "approved"})
	resolutionPayload, _ := json.Marshal(map[string]string{
		"requesterId": requesterID,
		"status":      "approved",
	})
	resolutionMsg := &Message{
		Type:    "join-request-resolved",
		RoomID:  roomID,
		Payload: resolutionPayload,
	}
	for existingClient := range h.rooms[roomID] {
		select {
		case existingClient.send <- resolutionMsg:
		default:
			close(existingClient.send)
			delete(h.rooms[roomID], existingClient)
		}
	}
	h.registerClientLocked(pendingClient)
}

func (h *Hub) UpdateRoomSettings(roomID string, settings RoomSettings, requesterDeviceID string, hostToken string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	// When hostManagement is ON, only host with valid token can update settings.
	if currentSettings, ok := h.roomSettings[roomID]; ok && currentSettings.HostManagement {
		if !h.CanPerformHostAction(roomID, requesterDeviceID, hostToken) {
			return
		}
	}

	current := h.roomSettings[roomID]
	if current.MaxMembers == 0 {
		current = defaultRoomSettings()
	}
	if settings.MaxMembers > 0 {
		current.MaxMembers = settings.MaxMembers
	}
	if settings.AutoExpire != "" {
		current.AutoExpire = settings.AutoExpire
	}
	current.RequireApproval = settings.RequireApproval
	current.HostManagement = settings.HostManagement
	h.roomSettings[roomID] = current
	h.touchRoomLocked(roomID)
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
	expiryTicker := time.NewTicker(15 * time.Second)
	defer expiryTicker.Stop()

	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.registerClientLocked(client)
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if pendingRoom, ok := h.pendingJoins[client.RoomID]; ok {
				if _, exists := pendingRoom[client.DeviceID]; exists {
					delete(pendingRoom, client.DeviceID)
					if len(pendingRoom) == 0 {
						delete(h.pendingJoins, client.RoomID)
					}
				}
			}
			if _, ok := h.rooms[client.RoomID]; ok {
				if _, ok := h.rooms[client.RoomID][client]; ok {
					roomID := client.RoomID
					isHost := h.roomHosts[roomID] == client.DeviceID

					if isHost && len(h.rooms[roomID]) > 1 {
						// Host left: close room for everyone
						log.Printf("Host %s left room %s - closing room for all", client.DeviceID, roomID)
						h.closeRoomLocked(roomID, "host_left")
					} else {
						// Member left or last person: normal removal
						delete(h.rooms[roomID], client)
						close(client.send)
						log.Printf("Client %s left room %s", client.DeviceID, roomID)
						h.touchRoomLocked(roomID)

						// Notify remaining clients about member leaving
						if len(h.rooms[roomID]) > 0 {
							memberPayload, _ := json.Marshal(MemberInfo{
								DeviceID:    client.DeviceID,
								DisplayName: client.DisplayName,
								JoinedAt:    client.JoinedAt,
								Status:      "offline",
							})
							memberLeftMsg := &Message{
								Type:     "member-left",
								RoomID:   roomID,
								DeviceID: client.DeviceID,
								Payload:  memberPayload,
							}
							for otherClient := range h.rooms[roomID] {
								select {
								case otherClient.send <- memberLeftMsg:
								default:
									close(otherClient.send)
									delete(h.rooms[roomID], otherClient)
								}
							}
							h.broadcastMemberList(roomID)
						}

						if len(h.rooms[roomID]) == 0 {
							delete(h.rooms, roomID)
							delete(h.pendingJoins, roomID)
							delete(h.roomSettings, roomID)
							delete(h.lastActivity, roomID)
							delete(h.roomHosts, roomID)
						}
					}
				}
			}
			h.mu.Unlock()

		case wrapper := <-h.broadcast:
			roomID := wrapper.Message.RoomID
			sender := wrapper.Client
			targetID := wrapper.Message.TargetID

			h.mu.Lock()
			clients := h.rooms[roomID]
			h.touchRoomLocked(roomID)

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
			h.mu.Unlock()
		case <-expiryTicker.C:
			h.mu.Lock()
			for roomID := range h.rooms {
				if h.roomExpiredLocked(roomID) {
					log.Printf("Room %s expired due to inactivity", roomID)
					h.closeRoomLocked(roomID, "expired")
				}
			}
			h.mu.Unlock()
		}
	}
}
