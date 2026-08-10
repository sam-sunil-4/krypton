FROM node:20-alpine AS frontend
WORKDIR /app
COPY web/ .
RUN mkdir -p dist && echo "Frontend" > dist/index.html

FROM golang:1.22-alpine AS backend
WORKDIR /app
COPY . .
COPY --from=frontend /app/dist ./web/dist
RUN go build -o bin/krypton ./cmd/krypton

FROM alpine:latest
WORKDIR /app
COPY --from=backend /app/bin/krypton /usr/local/bin/
EXPOSE 8443
ENTRYPOINT ["krypton"]
