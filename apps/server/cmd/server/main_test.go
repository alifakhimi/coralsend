package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestFixedWindowLimiterAndCleanup(t *testing.T) {
	limiter := newFixedWindowLimiter(time.Minute, 2)
	now := time.Unix(100, 0)
	if !limiter.allow("one", now) || !limiter.allow("one", now) || limiter.allow("one", now) {
		t.Fatal("fixed window limit was not enforced")
	}
	if !limiter.allow("two", now) {
		t.Fatal("separate client was unexpectedly limited")
	}
	if !limiter.allow("one", now.Add(2*time.Minute)) {
		t.Fatal("expired client window did not reset")
	}
	if _, exists := limiter.clients["two"]; exists {
		t.Fatal("expired limiter key was not evicted")
	}
}

func TestClientIPOnlyTrustsConfiguredProxy(t *testing.T) {
	t.Setenv("TRUSTED_PROXY_CIDRS", "10.0.0.0/8")
	untrusted := httptest.NewRequest("GET", "http://example.test/ws", nil)
	untrusted.RemoteAddr = "203.0.113.10:4321"
	untrusted.Header.Set("X-Forwarded-For", "198.51.100.7")
	if got := getClientIP(untrusted); got != "203.0.113.10" {
		t.Fatalf("untrusted proxy IP = %q", got)
	}

	trusted := httptest.NewRequest("GET", "http://example.test/ws", nil)
	trusted.RemoteAddr = "10.1.2.3:4321"
	trusted.Header.Set("X-Forwarded-For", "198.51.100.7, 10.1.2.3")
	if got := getClientIP(trusted); got != "198.51.100.7" {
		t.Fatalf("trusted proxy IP = %q", got)
	}
}

func TestCORSMiddlewareEchoesAllowedWildcardOrigin(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("ALLOWED_ORIGINS", "*")
	handler := http.HandlerFunc(corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	request := httptest.NewRequest(http.MethodOptions, "http://server.test/health", nil)
	request.Header.Set("Origin", "https://one.example.test")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != http.StatusNoContent {
		t.Fatalf("CORS response status = %d", response.Code)
	}
	if got := response.Header().Get("Access-Control-Allow-Origin"); got != "https://one.example.test" {
		t.Fatalf("Access-Control-Allow-Origin = %q", got)
	}
	if got := response.Header().Get("Vary"); got != "Origin" {
		t.Fatalf("Vary = %q", got)
	}
}

func TestCORSMiddlewareRejectsUnmatchedWildcardOrigin(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("ALLOWED_ORIGINS", "https://*.example.test")
	handler := http.HandlerFunc(corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	request := httptest.NewRequest(http.MethodGet, "http://server.test/health", nil)
	request.Header.Set("Origin", "https://one.two.example.test")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("unmatched origin response status = %d", response.Code)
	}
}
