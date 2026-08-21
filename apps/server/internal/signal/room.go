package signal

import "time"

type RoomSettings struct {
	MaxMembers      int    `json:"maxMembers"`
	AutoExpire      string `json:"autoExpire"`
	RequireApproval bool   `json:"requireApproval"`
	HostManagement  bool   `json:"hostManagement"`
}

func defaultRoomSettings() RoomSettings {
	return RoomSettings{MaxMembers: 8, AutoExpire: "never"}
}

func validRoomSettings(settings RoomSettings) bool {
	if settings.MaxMembers < 2 || settings.MaxMembers > 32 {
		return false
	}
	switch settings.AutoExpire {
	case "never", "1h", "24h", "7d":
		return true
	default:
		return false
	}
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
