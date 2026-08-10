.PHONY: build-frontend build-backend build dev clean test

build-frontend:
	mkdir -p web/dist
	echo "Frontend placeholder" > web/dist/index.html

build-backend:
	go build -o bin/krypton ./cmd/krypton

build: build-frontend build-backend

dev:
	go run ./cmd/krypton

clean:
	rm -rf bin/ web/dist/

test:
	go test ./...
