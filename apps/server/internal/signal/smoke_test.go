package signal

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func dialTestPeer(t *testing.T, serverURL string) *websocket.Conn {
	t.Helper()
	wsURL := "ws" + strings.TrimPrefix(serverURL, "http")
	conn, response, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		if response != nil {
			t.Fatalf("dial signaling server: %v (status %s)", err, response.Status)
		}
		t.Fatalf("dial signaling server: %v", err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	return conn
}

func writeJoin(t *testing.T, conn *websocket.Conn, roomID, deviceID string) {
	t.Helper()
	payload, err := json.Marshal(JoinPayload{DeviceID: deviceID})
	if err != nil {
		t.Fatal(err)
	}
	if err := conn.WriteJSON(Message{Version: ProtocolVersion, Type: "join", RoomID: roomID, Payload: payload}); err != nil {
		t.Fatalf("join room: %v", err)
	}
}

func readUntilType(t *testing.T, conn *websocket.Conn, wanted string) Message {
	t.Helper()
	if err := conn.SetReadDeadline(time.Now().Add(2 * time.Second)); err != nil {
		t.Fatal(err)
	}
	for {
		var message Message
		if err := conn.ReadJSON(&message); err != nil {
			t.Fatalf("waiting for %q: %v", wanted, err)
		}
		if message.Type == wanted {
			return message
		}
	}
}

// TestSignalingSmoke covers the minimum core signaling flow with synthetic peers:
// connect, join the same room, observe presence, and relay a directed offer.
func TestSignalingSmoke(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { ServeWs(hub, w, r) }))
	t.Cleanup(server.Close)

	alice := dialTestPeer(t, server.URL)
	bob := dialTestPeer(t, server.URL)
	const aliceID = "00000000-0000-4000-8000-000000000001"
	const bobID = "00000000-0000-4000-8000-000000000002"
	writeJoin(t, alice, "ABC234", aliceID)
	readUntilType(t, alice, "member-list")
	writeJoin(t, bob, "ABC234", bobID)
	joined := readUntilType(t, alice, "member-joined")
	if joined.DeviceID != bobID {
		t.Fatalf("member-joined device = %q, want %s", joined.DeviceID, bobID)
	}
	readUntilType(t, bob, "member-list")

	offerPayload := json.RawMessage(`{"alg":"A256GCM","iv":"AAAAAAAAAAAAAAAA","ciphertext":"AAAAAAAAAAAAAAAAAAAAAA"}`)
	if err := alice.WriteJSON(Message{Version: ProtocolVersion, Type: "offer", RoomID: "ABC234", TargetID: bobID, Payload: offerPayload}); err != nil {
		t.Fatalf("send offer: %v", err)
	}
	offer := readUntilType(t, bob, "offer")
	if offer.DeviceID != aliceID || offer.TargetID != bobID {
		t.Fatalf("relayed offer sender/target = %q/%q", offer.DeviceID, offer.TargetID)
	}
	if string(offer.Payload) != string(offerPayload) {
		t.Fatalf("relayed payload = %s, want %s", offer.Payload, offerPayload)
	}
}

func TestHostDepartureDeliversRoomExpiredBeforeClosingPeers(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { ServeWs(hub, w, r) }))
	t.Cleanup(server.Close)

	host := dialTestPeer(t, server.URL)
	peer := dialTestPeer(t, server.URL)
	const hostID = "00000000-0000-4000-8000-000000000001"
	const peerID = "00000000-0000-4000-8000-000000000002"
	writeJoin(t, host, "ABC234", hostID)
	readUntilType(t, host, "member-list")
	writeJoin(t, peer, "ABC234", peerID)
	readUntilType(t, host, "member-joined")
	readUntilType(t, peer, "member-list")

	if err := host.Close(); err != nil {
		t.Fatalf("close host connection: %v", err)
	}
	expired := readUntilType(t, peer, "room-expired")
	var payload struct {
		Reason string `json:"reason"`
	}
	if err := json.Unmarshal(expired.Payload, &payload); err != nil {
		t.Fatalf("decode room-expired payload: %v", err)
	}
	if payload.Reason != "host_left" {
		t.Fatalf("room-expired reason = %q, want host_left", payload.Reason)
	}
}
