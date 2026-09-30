// Command vimchi serves the vimchi Vim tutor: GitHub sign-in, run sync, and the
// built SPA.
package main

import (
	"context"
	"errors"
	"flag"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"vimchi/server/internal/auth"
	"vimchi/server/internal/httpapi"
	"vimchi/server/internal/store"
)

func main() {
	log := slog.New(slog.NewTextHandler(os.Stderr, nil))
	if err := run(log); err != nil {
		log.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	addr := flag.String("addr", env("VIMCHI_ADDR", ":8080"), "listen address (VIMCHI_ADDR)")
	dbPath := flag.String("db", env("VIMCHI_DB", "vimchi.db"), "SQLite database path (VIMCHI_DB)")
	static := flag.String("static", env("VIMCHI_STATIC", "../dist"), "built SPA directory (VIMCHI_STATIC)")
	baseURL := flag.String("base-url", env("VIMCHI_BASE_URL", "http://localhost:5317"), "public origin used for the OAuth redirect_uri (VIMCHI_BASE_URL)")
	flag.Parse()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	st, err := store.Open(ctx, *dbPath)
	if err != nil {
		return err
	}
	defer st.Close()

	gh := auth.NewGitHub(os.Getenv("GITHUB_CLIENT_ID"), os.Getenv("GITHUB_CLIENT_SECRET"))
	if !gh.Configured() {
		log.Warn("GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET not set; sign-in disabled")
	}

	srv := &httpapi.Server{
		Store:         st,
		GitHub:        gh,
		BaseURL:       *baseURL,
		StaticDir:     *static,
		SecureCookies: os.Getenv("VIMCHI_SECURE_COOKIES") == "1",
		TrustProxy:    os.Getenv("VIMCHI_TRUST_PROXY") == "1",
		Log:           log,
	}
	hs := &http.Server{
		Addr:              *addr,
		Handler:           logRequests(log, srv.Handler()),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       2 * time.Minute,
	}

	errc := make(chan error, 1)
	go func() {
		log.Info("listening", "addr", *addr, "db", *dbPath, "static", *static, "base_url", *baseURL)
		errc <- hs.ListenAndServe()
	}()

	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}
	log.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := hs.Shutdown(shutdownCtx); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

func env(key, def string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return def
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

func (w *statusWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

func logRequests(log *slog.Logger, h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		h.ServeHTTP(sw, r)
		log.Info("request", "method", r.Method, "path", r.URL.Path, "status", sw.status, "dur", time.Since(start).Round(time.Microsecond))
	})
}
