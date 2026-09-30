package httpapi

import (
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Per-IP token buckets for the routes a stranger can hammer. Reads are never
// limited; the SPA and healthz are static.
const (
	authBurst      = 20  // OAuth login/callback/logout starts per IP …
	authPerMinute  = 10  // … refilling at this rate
	runWriteBurst  = 120 // run writes per IP …
	runWritePerMin = 60  // … refilling at this rate
)

type bucket struct {
	tokens float64
	seen   time.Time
}

// limiter is a token bucket per key with lazy refill and periodic sweeping.
type limiter struct {
	burst, perMinute float64
	now              func() time.Time
	mu               sync.Mutex
	buckets          map[string]*bucket
	lastSweep        time.Time
}

func newLimiter(burst, perMinute int, now func() time.Time) *limiter {
	return &limiter{burst: float64(burst), perMinute: float64(perMinute), now: now, buckets: map[string]*bucket{}}
}

// allow takes one token for key; the second value is the seconds to wait when refused.
func (l *limiter) allow(key string) (bool, int) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	b, ok := l.buckets[key]
	if !ok {
		b = &bucket{tokens: l.burst, seen: now}
		l.buckets[key] = b
	}
	b.tokens = min(l.burst, b.tokens+now.Sub(b.seen).Minutes()*l.perMinute)
	b.seen = now
	if now.Sub(l.lastSweep) > 10*time.Minute {
		l.lastSweep = now
		for k, o := range l.buckets {
			if now.Sub(o.seen) > 10*time.Minute {
				delete(l.buckets, k)
			}
		}
	}
	if b.tokens >= 1 {
		b.tokens--
		return true, 0
	}
	wait := (1 - b.tokens) / l.perMinute * 60
	return false, int(wait) + 1
}

// clientIP is the peer address, or the LAST X-Forwarded-For hop when a
// trusted proxy (Caddy, NPM) sits directly in front: that hop is the peer the
// proxy itself saw, while earlier hops came from the client and can be forged.
func (s *Server) clientIP(r *http.Request) string {
	if s.TrustProxy {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			hops := strings.Split(xff, ",")
			return strings.TrimSpace(hops[len(hops)-1])
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// limited wraps h so each client IP gets at most the limiter's rate.
func (s *Server) limited(l *limiter, h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if ok, wait := l.allow(s.clientIP(r)); !ok {
			w.Header().Set("Retry-After", strconv.Itoa(wait))
			writeError(w, http.StatusTooManyRequests, "too many requests")
			return
		}
		h(w, r)
	}
}
