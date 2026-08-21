package signal

import (
	"errors"
	"net"
	"net/url"
	"os"
	"strconv"
	"strings"
)

type originValue struct {
	scheme string
	host   string
	port   string
}

type originRule struct {
	originValue
	allowAll     bool
	wildcardHost bool
}

func parseOrigin(raw string, allowWildcardHost bool) (originValue, bool) {
	value := strings.TrimSpace(raw)
	if value == "" || strings.EqualFold(value, "null") {
		return originValue{}, false
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.Opaque != "" || parsed.User != nil || parsed.Host == "" ||
		parsed.Path != "" || parsed.RawQuery != "" || parsed.Fragment != "" || parsed.ForceQuery {
		return originValue{}, false
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return originValue{}, false
	}

	host := strings.ToLower(parsed.Hostname())
	if host == "" || strings.Contains(host, "%") {
		return originValue{}, false
	}
	if strings.Contains(host, "*") {
		if !allowWildcardHost || !strings.HasPrefix(host, "*.") || strings.Count(host, "*") != 1 {
			return originValue{}, false
		}
		suffix := strings.TrimPrefix(host, "*.")
		if net.ParseIP(suffix) != nil || !validHostname(suffix) {
			return originValue{}, false
		}
	} else if !validHostname(host) {
		return originValue{}, false
	}

	port := parsed.Port()
	if strings.Contains(parsed.Host, ":") && net.ParseIP(host) == nil && port == "" {
		return originValue{}, false
	}
	if port != "" {
		portNumber, err := strconv.Atoi(port)
		if err != nil || portNumber < 1 || portNumber > 65535 {
			return originValue{}, false
		}
	}

	return originValue{scheme: parsed.Scheme, host: host, port: port}, true
}

func validHostname(host string) bool {
	if len(host) > 253 || host == "" {
		return false
	}
	for _, label := range strings.Split(host, ".") {
		if len(label) == 0 || len(label) > 63 || label[0] == '-' || label[len(label)-1] == '-' {
			return false
		}
		for _, char := range label {
			if (char < 'a' || char > 'z') && (char < '0' || char > '9') && char != '-' {
				return false
			}
		}
	}
	return true
}

func parseAllowedOriginRule(raw string) (originRule, bool) {
	value := strings.TrimSpace(raw)
	if value == "*" {
		return originRule{allowAll: true}, true
	}
	parsed, ok := parseOrigin(value, true)
	if !ok {
		return originRule{}, false
	}
	return originRule{
		originValue:  parsed,
		wildcardHost: strings.HasPrefix(parsed.host, "*."),
	}, true
}

func loadAllowedOrigins() ([]originRule, bool) {
	raw := strings.TrimSpace(os.Getenv("ALLOWED_ORIGINS"))
	if raw == "" {
		return nil, true
	}

	rules := make([]originRule, 0)
	for _, item := range strings.Split(raw, ",") {
		value := strings.TrimSpace(item)
		if value == "" {
			continue
		}
		rule, ok := parseAllowedOriginRule(value)
		if !ok {
			return nil, false
		}
		rules = append(rules, rule)
	}
	return rules, true
}

func isProduction() bool {
	appEnv := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
	goEnv := strings.ToLower(strings.TrimSpace(os.Getenv("GO_ENV")))
	return appEnv == "production" || appEnv == "prod" || goEnv == "production"
}

// IsOriginAllowed checks whether request Origin is acceptable for signaling endpoints.
func IsOriginAllowed(origin string) bool {
	o := strings.TrimSpace(origin)
	allowedOrigins, valid := loadAllowedOrigins()
	if !valid {
		return false
	}

	// In production, explicit allowlist is required for browser origins.
	if isProduction() {
		if o == "" {
			return false
		}
	} else if len(allowedOrigins) == 0 {
		// Preserve the development behavior when no allowlist is configured.
		return true
	}

	requestOrigin, ok := parseOrigin(o, false)
	if !ok {
		return false
	}
	for _, rule := range allowedOrigins {
		if rule.allowAll {
			return true
		}
		if rule.scheme != requestOrigin.scheme || rule.port != requestOrigin.port {
			continue
		}
		if rule.wildcardHost {
			suffix := strings.TrimPrefix(rule.host, "*.")
			if !strings.HasSuffix(requestOrigin.host, "."+suffix) {
				continue
			}
			prefix := strings.TrimSuffix(requestOrigin.host, "."+suffix)
			if prefix != "" && !strings.Contains(prefix, ".") {
				return true
			}
			continue
		}
		if rule.host == requestOrigin.host {
			return true
		}
	}
	return false
}

// UsesGlobalOriginWildcard reports whether ALLOWED_ORIGINS contains the
// intentionally broad `*` rule, so startup can emit a security warning.
func UsesGlobalOriginWildcard() bool {
	rules, valid := loadAllowedOrigins()
	if !valid {
		return false
	}
	for _, rule := range rules {
		if rule.allowAll {
			return true
		}
	}
	return false
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
	origins, valid := loadAllowedOrigins()
	if !valid {
		return errors.New("ALLOWED_ORIGINS contains an invalid origin or wildcard pattern")
	}
	if len(origins) == 0 {
		return errors.New("ALLOWED_ORIGINS is required in production")
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
