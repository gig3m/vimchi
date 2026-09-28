package auth

import "testing"

func TestSanitizeReturn(t *testing.T) {
	tests := []struct {
		in, want string
	}{
		{"", "/"},
		{"/", "/"},
		{"/lesson/hjkl", "/lesson/hjkl"},
		{"/stats?tab=runs#top", "/stats?tab=runs#top"},
		{"//evil.example", "/"},
		{"///evil.example", "/"},
		{"/\\evil.example", "/"},
		{"/foo\\bar", "/"},
		{"https://evil.example/", "/"},
		{"javascript:alert(1)", "/"},
		{"lesson", "/"},
		{"/foo\nSet-Cookie: x=y", "/"},
		{"/foo\tbar", "/"},
		{"/%2F%2Fevil.example", "/%2F%2Fevil.example"}, // stays a path on this origin
	}
	for _, tt := range tests {
		if got := SanitizeReturn(tt.in); got != tt.want {
			t.Errorf("SanitizeReturn(%q) = %q, want %q", tt.in, got, tt.want)
		}
	}
}

func TestTokenHash(t *testing.T) {
	a, b := NewToken(), NewToken()
	if a == b {
		t.Fatal("tokens should differ")
	}
	if len(a) != 43 {
		t.Fatalf("token length = %d, want 43", len(a))
	}
	if string(HashToken(a)) != string(HashToken(a)) || string(HashToken(a)) == string(HashToken(b)) {
		t.Fatal("HashToken not deterministic/unique")
	}
}
