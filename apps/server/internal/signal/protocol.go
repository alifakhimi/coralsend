package signal

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"regexp"
)

const ProtocolVersion = 1

var (
	roomIDPattern   = regexp.MustCompile(`^(?:[A-Z0-9]{6}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`)
	deviceIDPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$`)
)

var clientMessageTypes = map[string]struct{}{
	"join": {}, "leave": {}, "room-settings": {}, "join-approved": {},
	"join-rejected": {}, "member-remove": {}, "peer-profile": {},
	"offer": {}, "answer": {}, "candidate": {}, "file-meta": {},
	"file-meta-sync-request": {}, "file-request": {}, "chat": {},
}

var encryptedRelayTypes = map[string]struct{}{
	"peer-profile": {}, "offer": {}, "answer": {}, "candidate": {},
	"file-meta": {}, "file-meta-sync-request": {}, "file-request": {}, "chat": {},
}

var targetedRelayTypes = map[string]struct{}{
	"peer-profile": {}, "offer": {}, "answer": {}, "candidate": {}, "file-request": {},
}

// EncryptedPayloadV1 is opaque to the signaling server. Routing fields are
// authenticated by clients as AES-GCM additional data.
type EncryptedPayloadV1 struct {
	Alg        string `json:"alg"`
	IV         string `json:"iv"`
	Ciphertext string `json:"ciphertext"`
}

func isEncryptedRelayType(messageType string) bool {
	_, ok := encryptedRelayTypes[messageType]
	return ok
}

func validateEncryptedPayload(raw json.RawMessage) error {
	var payload EncryptedPayloadV1
	if len(raw) == 0 || json.Unmarshal(raw, &payload) != nil {
		return errors.New("encrypted payload required")
	}
	iv, ivErr := base64.RawURLEncoding.DecodeString(payload.IV)
	ciphertext, ciphertextErr := base64.RawURLEncoding.DecodeString(payload.Ciphertext)
	if payload.Alg != "A256GCM" || ivErr != nil || len(iv) != 12 || ciphertextErr != nil || len(ciphertext) < 16 {
		return errors.New("invalid encrypted payload")
	}
	return nil
}

func validateInboundMessage(msg *Message, joined bool) error {
	if msg.Version != ProtocolVersion {
		return errors.New("unsupported_version")
	}
	if _, ok := clientMessageTypes[msg.Type]; !ok {
		return errors.New("unknown_message_type")
	}
	if !roomIDPattern.MatchString(msg.RoomID) {
		return errors.New("invalid_room_id")
	}
	if msg.TargetID != "" && !validDeviceID(msg.TargetID) {
		return errors.New("invalid_target")
	}
	if _, targeted := targetedRelayTypes[msg.Type]; targeted && msg.TargetID == "" {
		return errors.New("target_required")
	}
	if !joined && msg.Type != "join" {
		return errors.New("join_required")
	}
	if joined && msg.Type == "join" {
		return errors.New("already_joined")
	}
	if isEncryptedRelayType(msg.Type) {
		return validateEncryptedPayload(msg.Payload)
	}
	return nil
}

func validDeviceID(value string) bool { return deviceIDPattern.MatchString(value) }
