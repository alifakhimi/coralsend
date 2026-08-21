package signal

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"os"
)

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

// CanPerformHostAction requires host management, the bound host device, and a valid capability.
func (h *Hub) CanPerformHostAction(roomID, requesterDeviceID, hostToken string) bool {
	settings, ok := h.roomSettings[roomID]
	if !ok || !settings.HostManagement {
		return false
	}
	return h.verifyHostToken(roomID, hostToken) && h.isHost(roomID, requesterDeviceID)
}
