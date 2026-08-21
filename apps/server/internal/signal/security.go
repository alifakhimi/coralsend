package signal

import (
	"errors"
	"net"
	"net/url"
	"os"
	"strings"
)

func loadAllowedOrigins() map[string]struct{} {
	raw := os.Getenv("ALLOWED_ORIGINS")
	items := strings.Split(raw, ",")
	set := make(map[string]struct{}, len(items))
	for _, item := range items {
		origin := strings.TrimSpace(item)
		if origin == "" {
			continue
		}
		set[origin] = struct{}{}
	}
	return set
}

func isProduction() bool {
	appEnv := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
	goEnv := strings.ToLower(strings.TrimSpace(os.Getenv("GO_ENV")))
	return appEnv == "production" || appEnv == "prod" || goEnv == "production"
}

// IsOriginAllowed checks whether request Origin is acceptable for signaling endpoints.
func IsOriginAllowed(origin string) bool {
	o := strings.TrimSpace(origin)
	allowedOrigins := loadAllowedOrigins()

	// In production, explicit allowlist is required for browser origins.
	if isProduction() {
		if o == "" {
			return false
		}
		_, ok := allowedOrigins[o]
		return ok
	}

	// In non-production, allow all origins unless an allowlist is explicitly set.
	if len(allowedOrigins) == 0 {
		return true
	}
	_, ok := allowedOrigins[o]
	return ok
}

// ValidateRuntimeConfig prevents known development fallbacks in production.
func ValidateRuntimeConfig() error {
	if !isProduction() {
		return nil
	}
	secret := os.Getenv("HOST_SECRET")
	if len(secret) < 32 {
		return errors.New("HOST_SECRET must be at least 32 bytes in production")
	}
	origins := loadAllowedOrigins()
	if len(origins) == 0 {
		return errors.New("ALLOWED_ORIGINS is required in production")
	}
	for origin := range origins {
		parsed, err := url.Parse(origin)
		if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" || parsed.Path != "" {
			return errors.New("ALLOWED_ORIGINS contains an invalid origin")
		}
	}
	for _, raw := range strings.Split(os.Getenv("TRUSTED_PROXY_CIDRS"), ",") {
		cidr := strings.TrimSpace(raw)
		if cidr == "" {
			continue
		}
		if _, _, err := net.ParseCIDR(cidr); err != nil {
			return errors.New("TRUSTED_PROXY_CIDRS contains an invalid CIDR")
		}
	}
	return nil
}
