.PHONY: dev server app install test test-server test-app lint typecheck build check e2e verify generate-assets docker-up docker-coturn-up docker-down docker-restart docker-logs docker-build

COMPOSE := docker compose
COMPOSE_FILE := deploy/docker-compose.yml
COMPOSE_COTURN_FILE := deploy/docker-compose.coturn.yml
ROOT_DIR := $(shell git rev-parse --show-toplevel 2>/dev/null || pwd)
PROJECT_NAME ?= $(notdir $(ROOT_DIR))
COMPOSE_PROJECT := --project-name $(PROJECT_NAME)
ENV_FILE := $(if $(wildcard .env.local),--env-file .env.local,)

dev:
	@echo "Starting development environment..."
	@make -j 2 server app

server:
	@echo "Starting Signaling Server..."
	@cd apps/server && [ -f .env.local ] && set -a && . ./.env.local && set +a; go run cmd/server/main.go -addr=:$${SERVER_PORT:-8080}

app:
	@echo "Starting Web PWA..."
	@cd apps/app && npm run dev

install:
	@echo "Installing dependencies..."
	@cd apps/server && go mod download
	@cd apps/app && npm ci

test: test-server test-app

test-server:
	@echo "Running server tests..."
	@cd apps/server && go test ./...

test-app:
	@echo "Running app tests..."
	@cd apps/app && npm test

lint:
	@echo "Running Go static analysis..."
	@cd apps/server && go vet ./...
	@echo "Linting web app..."
	@cd apps/app && npm run lint

typecheck:
	@echo "Type-checking web app..."
	@cd apps/app && npm run typecheck

build:
	@echo "Building web app..."
	@cd apps/app && npm run build

check: test lint typecheck build

e2e:
	@echo "Running browser end-to-end tests..."
	@cd apps/app && npm run test:e2e

verify: check e2e

generate-assets:
	@echo "Generate app assets..."
	@cd apps/app && npm run generate-assets

coturn-up:
	@echo "Starting coTURN stack..."
	@$(COMPOSE) $(COMPOSE_PROJECT) $(ENV_FILE) -f $(COMPOSE_COTURN_FILE) up -d

coturn-down:
	@echo "Stopping coTURN stack..."
	@$(COMPOSE) $(COMPOSE_PROJECT) $(ENV_FILE) -f $(COMPOSE_COTURN_FILE) down

docker-up-coturn:
	@echo "Starting Docker Compose stack with coTURN..."
	@$(COMPOSE) $(COMPOSE_PROJECT) $(ENV_FILE) -f $(COMPOSE_FILE) -f $(COMPOSE_COTURN_FILE) up -d

docker-down-coturn:
	@echo "Stopping Docker Compose stack with coTURN..."
	@$(COMPOSE) $(COMPOSE_PROJECT) $(ENV_FILE) -f $(COMPOSE_FILE) -f $(COMPOSE_COTURN_FILE) down

docker-restart-coturn:
	@echo "Restarting Docker Compose stack with coTURN..."
	@$(COMPOSE) $(COMPOSE_PROJECT) $(ENV_FILE) -f $(COMPOSE_FILE) -f $(COMPOSE_COTURN_FILE) down
	@$(COMPOSE) $(COMPOSE_PROJECT) $(ENV_FILE) -f $(COMPOSE_FILE) -f $(COMPOSE_COTURN_FILE) up -d

docker-up:
	@echo "Starting Docker Compose stack..."
	@echo $(COMPOSE_PROJECT)
	@$(COMPOSE) $(COMPOSE_PROJECT) $(ENV_FILE) -f $(COMPOSE_FILE) up -d

docker-build:
	@echo "Building Docker images..."
	@DOCKER_BUILDKIT=0 $(COMPOSE) $(COMPOSE_PROJECT) $(ENV_FILE) -f $(COMPOSE_FILE) build

docker-down:
	@echo "Stopping Docker Compose stack..."
	@$(COMPOSE) $(COMPOSE_PROJECT) $(ENV_FILE) -f $(COMPOSE_FILE) down

docker-restart:
	@echo "Restarting Docker Compose stack..."
	@$(COMPOSE) $(COMPOSE_PROJECT) $(ENV_FILE) -f $(COMPOSE_FILE) down
	@$(COMPOSE) $(COMPOSE_PROJECT) $(ENV_FILE) -f $(COMPOSE_FILE) up -d

docker-logs:
	@$(COMPOSE) $(COMPOSE_PROJECT) $(ENV_FILE) -f $(COMPOSE_FILE) logs -f --tail=200
