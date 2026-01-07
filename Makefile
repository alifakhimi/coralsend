.PHONY: dev server web install

dev:
	@echo "Starting development environment..."
	@make -j 2 server web

server:
	@echo "Starting Signaling Server..."
	@cd apps/server && go run cmd/server/main.go

web:
	@echo "Starting Web PWA..."
	@cd apps/web && npm run dev

install:
	@echo "Installing dependencies..."
	@cd apps/server && go mod download
	@cd apps/web && npm install

