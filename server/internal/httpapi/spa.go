package httpapi

import (
	"errors"
	"io/fs"
	"net/http"
	"os"
	"path"
	"strings"
)

// spa serves files from StaticDir, falling back to index.html for paths
// without a file extension so client-side routes work on reload. Missing
// assets (paths with an extension) get a real 404.
func (s *Server) spa() http.Handler {
	fsys := os.DirFS(s.StaticDir)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		name := strings.TrimPrefix(path.Clean("/"+r.URL.Path), "/")
		if name != "" && name != "index.html" {
			fi, err := fs.Stat(fsys, name)
			switch {
			case err == nil && !fi.IsDir():
				if strings.HasPrefix(name, "assets/") { // Vite's content-hashed output
					w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
				}
				http.ServeFileFS(w, r, fsys, name)
				return
			case err != nil && !errors.Is(err, fs.ErrNotExist):
				s.serverError(w, r, err)
				return
			case path.Ext(name) != "":
				http.NotFound(w, r)
				return
			}
		}

		index, err := fs.ReadFile(fsys, "index.html")
		if err != nil {
			http.Error(w, "Frontend not built: run `npm run build` (or use the Vite dev server) and set VIMCHI_STATIC.", http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		w.Write(index)
	})
}
