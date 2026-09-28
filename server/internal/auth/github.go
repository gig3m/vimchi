// Package auth holds the GitHub OAuth client and session-token helpers.
package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// GitHub is a minimal OAuth web-flow client. The URL fields default to
// github.com and exist so tests can point them at a fake.
type GitHub struct {
	ClientID     string
	ClientSecret string
	AuthorizeURL string // https://github.com/login/oauth/authorize
	TokenURL     string // https://github.com/login/oauth/access_token
	APIURL       string // https://api.github.com
	HTTP         *http.Client
}

// NewGitHub returns a client for github.com.
func NewGitHub(clientID, clientSecret string) *GitHub {
	return &GitHub{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		AuthorizeURL: "https://github.com/login/oauth/authorize",
		TokenURL:     "https://github.com/login/oauth/access_token",
		APIURL:       "https://api.github.com",
		HTTP:         &http.Client{Timeout: 10 * time.Second},
	}
}

// Configured reports whether OAuth credentials are present.
func (g *GitHub) Configured() bool {
	return g != nil && g.ClientID != "" && g.ClientSecret != ""
}

// AuthCodeURL returns the authorize URL the browser should be sent to.
func (g *GitHub) AuthCodeURL(state, redirectURI string) string {
	q := url.Values{
		"client_id":    {g.ClientID},
		"redirect_uri": {redirectURI},
		"scope":        {"read:user"},
		"state":        {state},
		"allow_signup": {"true"},
	}
	return g.AuthorizeURL + "?" + q.Encode()
}

// Exchange trades an authorization code for an access token.
func (g *GitHub) Exchange(ctx context.Context, code, redirectURI string) (string, error) {
	form := url.Values{
		"client_id":     {g.ClientID},
		"client_secret": {g.ClientSecret},
		"code":          {code},
		"redirect_uri":  {redirectURI},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, g.TokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	var body struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
		Description string `json:"error_description"`
	}
	if err := g.do(req, &body); err != nil {
		return "", fmt.Errorf("github token exchange: %w", err)
	}
	if body.Error != "" {
		return "", fmt.Errorf("github token exchange: %s: %s", body.Error, body.Description)
	}
	if body.AccessToken == "" {
		return "", errors.New("github token exchange: empty access token")
	}
	return body.AccessToken, nil
}

// GitHubUser is the subset of GET /user we keep.
type GitHubUser struct {
	ID        int64  `json:"id"`
	Login     string `json:"login"`
	Name      string `json:"name"` // null on GitHub decodes to ""
	AvatarURL string `json:"avatar_url"`
}

// User fetches the authenticated user's profile.
func (g *GitHub) User(ctx context.Context, token string) (GitHubUser, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(g.APIURL, "/")+"/user", nil)
	if err != nil {
		return GitHubUser{}, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	var u GitHubUser
	if err := g.do(req, &u); err != nil {
		return GitHubUser{}, fmt.Errorf("github user: %w", err)
	}
	if u.ID == 0 || u.Login == "" {
		return GitHubUser{}, errors.New("github user: missing id or login")
	}
	return u, nil
}

func (g *GitHub) do(req *http.Request, v any) error {
	client := g.HTTP
	if client == nil {
		client = http.DefaultClient
	}
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	body := io.LimitReader(res.Body, 1<<20)
	if res.StatusCode != http.StatusOK {
		msg, _ := io.ReadAll(io.LimitReader(body, 512))
		return fmt.Errorf("status %d: %s", res.StatusCode, strings.TrimSpace(string(msg)))
	}
	return json.NewDecoder(body).Decode(v)
}
