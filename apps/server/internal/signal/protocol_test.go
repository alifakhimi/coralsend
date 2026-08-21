package signal

import (
	"encoding/json"
	"errors"
	"os"
	"testing"
)

type protocolFixture struct {
	Name        string          `json:"name"`
	Valid       bool            `json:"valid"`
	Joined      bool            `json:"joined"`
	CurrentRoom string          `json:"currentRoom"`
	Members     []string        `json:"members"`
	Message     json.RawMessage `json:"message"`
}

func TestSharedProtocolFixtures(t *testing.T) {
	data, err := os.ReadFile("../../../../testdata/protocol/v1.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixtures []protocolFixture
	if err := json.Unmarshal(data, &fixtures); err != nil {
		t.Fatal(err)
	}
	for _, fixture := range fixtures {
		t.Run(fixture.Name, func(t *testing.T) {
			var message Message
			err := json.Unmarshal(fixture.Message, &message)
			if err == nil {
				err = validateInboundMessage(&message, fixture.Joined)
			}
			if err == nil && fixture.CurrentRoom != "" && message.RoomID != fixture.CurrentRoom {
				err = errors.New("room_mismatch")
			}
			if err == nil && isEncryptedRelayType(message.Type) && message.TargetID != "" {
				found := false
				for _, member := range fixture.Members {
					found = found || member == message.TargetID
				}
				if !found {
					err = errors.New("invalid_target")
				}
			}
			if fixture.Valid && err != nil {
				t.Fatalf("valid fixture rejected: %v", err)
			}
			if !fixture.Valid && err == nil {
				t.Fatal("invalid fixture accepted")
			}
		})
	}
}

func TestProtocolRejectsLegacyAndPlaintextRelay(t *testing.T) {
	join := Message{Type: "join", RoomID: "ABC234"}
	if err := validateInboundMessage(&join, false); err == nil || err.Error() != "unsupported_version" {
		t.Fatalf("legacy message error = %v", err)
	}

	plaintext := Message{Version: ProtocolVersion, Type: "offer", RoomID: "ABC234", Payload: json.RawMessage(`{"sdp":"visible"}`)}
	if err := validateInboundMessage(&plaintext, true); err == nil {
		t.Fatal("plaintext relay was accepted")
	}
}

func TestValidateRuntimeConfig(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("HOST_SECRET", "short")
	t.Setenv("ALLOWED_ORIGINS", "https://example.com")
	if err := ValidateRuntimeConfig(); err == nil {
		t.Fatal("short production secret was accepted")
	}
	t.Setenv("HOST_SECRET", "0123456789abcdef0123456789abcdef")
	t.Setenv("TRUSTED_PROXY_CIDRS", "10.0.0.0/8,2001:db8::/32")
	if err := ValidateRuntimeConfig(); err != nil {
		t.Fatalf("valid production config rejected: %v", err)
	}
	t.Setenv("TRUSTED_PROXY_CIDRS", "not-a-cidr")
	if err := ValidateRuntimeConfig(); err == nil {
		t.Fatal("invalid trusted proxy CIDR was accepted")
	}
}

func TestProductionOriginPolicy(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("ALLOWED_ORIGINS", "https://app.example.test")
	if !IsOriginAllowed("https://app.example.test") {
		t.Fatal("configured production origin rejected")
	}
	if IsOriginAllowed("https://evil.example.test") || IsOriginAllowed("") {
		t.Fatal("unconfigured production origin accepted")
	}
}
