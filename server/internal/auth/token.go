package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"net/url"
	"strings"
)

// NewToken returns a random URL-safe token with 256 bits of entropy.
func NewToken() string {
	b := make([]byte, 32)
	rand.Read(b) // never returns an error; panics if the OS source fails
	return base64.RawURLEncoding.EncodeToString(b)
}

// HashToken returns the SHA-256 of a token, which is what gets stored so a
// leaked database doesn't leak live sessions.
func HashToken(token string) []byte {
	h := sha256.Sum256([]byte(token))
	return h[:]
}

// SanitizeReturn returns p if it is a safe same-origin relative path, or "/"
// otherwise. It rejects scheme-relative ("//host") and backslash forms that
// browsers treat as absolute, as well as control characters.
func SanitizeReturn(p string) string {
	if len(p) == 0 || len(p) > 1024 || p[0] != '/' {
		return "/"
	}
	if len(p) > 1 && (p[1] == '/' || p[1] == '\\') {
		return "/"
	}
	if strings.ContainsFunc(p, func(r rune) bool { return r < 0x20 || r == 0x7f || r == '\\' }) {
		return "/"
	}
	u, err := url.Parse(p)
	if err != nil || u.Scheme != "" || u.Host != "" || u.User != nil {
		return "/"
	}
	return p
}
