.PHONY: dev server web install docker-up docker-down docker-restart docker-logs docker-build

COMPOSE := docker compose
COMPOSE_FILE := deploy/docker-compose.yml
ENV_FILE := $(shell [ -f .env ] && echo --env-file .env)

dev:
	@echo "Starting development environment..."
	@make -j 2 server web

server:
	@echo "Starting Signaling Server..."
	@cd apps/server && [ -f .env ] && set -a && . ./.env && set +a; go run cmd/server/main.go -addr=:$${SERVER_PORT:-8080}

web:
	@echo "Starting Web PWA..."
	@cd apps/web && npm run dev

install:
	@echo "Installing dependencies..."
	@cd apps/server && go mod tidy
	@cd apps/web && npm install

docker-up:
	@echo "Starting Docker Compose stack..."
	@$(COMPOSE) $(ENV_FILE) -f $(COMPOSE_FILE) up -d

docker-build:
	@echo "Building Docker images..."
	@DOCKER_BUILDKIT=0 $(COMPOSE) $(ENV_FILE) -f $(COMPOSE_FILE) build

docker-down:
	@echo "Stopping Docker Compose stack..."
	@$(COMPOSE) -f $(COMPOSE_FILE) down

docker-restart:
	@echo "Restarting Docker Compose stack..."
	@$(COMPOSE) -f $(COMPOSE_FILE) down
	@$(COMPOSE) $(ENV_FILE) -f $(COMPOSE_FILE) up -d

docker-logs:
	@$(COMPOSE) -f $(COMPOSE_FILE) logs -f --tail=200

