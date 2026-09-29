# syntax=docker/dockerfile:1
# vimchi — Vite SPA built in a node stage, Go server built in a Go stage,
# shipped together in a small runtime image. Start it with docker/up.sh.

FROM node:22-alpine AS web
WORKDIR /src
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM golang:1.26-alpine AS server
WORKDIR /src
COPY server/go.mod server/go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY server ./
# modernc.org/sqlite is pure Go: CGO_ENABLED=0 keeps the binary static.
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o /vimchi ./cmd/vimchi

FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata wget \
 && adduser -D -u 1000 -h /data vimchi
COPY --from=server /vimchi /usr/local/bin/vimchi
COPY --from=web /src/dist /srv/dist
ENV VIMCHI_ADDR=:8080 VIMCHI_DB=/data/vimchi.db VIMCHI_STATIC=/srv/dist
USER vimchi
WORKDIR /data
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
ENTRYPOINT ["vimchi"]
