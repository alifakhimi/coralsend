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

func TestOriginPolicyPatterns(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	tests := []struct {
		name      string
		allowlist string
		origin    string
		want      bool
	}{
		{name: "exact", allowlist: "https://app.example.test", origin: "https://app.example.test", want: true},
		{name: "exact mismatch", allowlist: "https://app.example.test", origin: "https://other.example.test", want: false},
		{name: "global wildcard", allowlist: "*", origin: "http://anywhere.test:8080", want: true},
		{name: "global wildcard rejects null", allowlist: "*", origin: "null", want: false},
		{name: "global wildcard rejects non-http", allowlist: "*", origin: "ftp://files.example.test", want: false},
		{name: "subdomain wildcard", allowlist: "https://*.example.test", origin: "https://one.example.test", want: true},
		{name: "subdomain wildcard rejects base", allowlist: "https://*.example.test", origin: "https://example.test", want: false},
		{name: "subdomain wildcard rejects multiple levels", allowlist: "https://*.example.test", origin: "https://one.two.example.test", want: false},
		{name: "subdomain wildcard scheme mismatch", allowlist: "https://*.example.test", origin: "http://one.example.test", want: false},
		{name: "subdomain wildcard port match", allowlist: "https://*.example.test:8443", origin: "https://one.example.test:8443", want: true},
		{name: "subdomain wildcard port mismatch", allowlist: "https://*.example.test:8443", origin: "https://one.example.test", want: false},
		{name: "path rejected", allowlist: "https://*.example.test/path", origin: "https://one.example.test", want: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Setenv("ALLOWED_ORIGINS", test.allowlist)
			if got := IsOriginAllowed(test.origin); got != test.want {
				t.Fatalf("IsOriginAllowed(%q) with %q = %v, want %v", test.origin, test.allowlist, got, test.want)
			}
		})
	}
}

func TestOriginPolicyPreservesDevelopmentFallback(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("ALLOWED_ORIGINS", "")
	if !IsOriginAllowed("not-an-origin") {
		t.Fatal("empty development allowlist no longer permits the existing fallback")
	}
}

func TestOriginPolicyValidation(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("HOST_SECRET", "0123456789abcdef0123456789abcdef")
	for _, allowlist := range []string{
		"*",
		"https://*.example.test",
		"https://app.example.test,https://*.example.test:8443",
	} {
		t.Run(allowlist, func(t *testing.T) {
			t.Setenv("ALLOWED_ORIGINS", allowlist)
			if err := ValidateRuntimeConfig(); err != nil {
				t.Fatalf("valid origin policy rejected: %v", err)
			}
		})
	}

	for _, allowlist := range []string{
		"https://*example.test",
		"https://*.example.test/path",
		"https://*.example.test:bad",
		"https://foo.*.example.test",
		"null",
	} {
		t.Run("invalid-"+allowlist, func(t *testing.T) {
			t.Setenv("ALLOWED_ORIGINS", allowlist)
			if err := ValidateRuntimeConfig(); err == nil {
				t.Fatalf("invalid origin policy %q was accepted", allowlist)
			}
		})
	}
}

func TestGlobalOriginWildcardDetection(t *testing.T) {
	t.Setenv("ALLOWED_ORIGINS", "https://app.example.test, *")
	if !UsesGlobalOriginWildcard() {
		t.Fatal("global wildcard was not detected")
	}
	t.Setenv("ALLOWED_ORIGINS", "https://*.example.test")
	if UsesGlobalOriginWildcard() {
		t.Fatal("restricted wildcard was reported as global")
	}
}
