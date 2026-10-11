#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
ROOT_DIR="$(cd "$DIR/.." >/dev/null 2>&1 && pwd)"
COMPOSE_FILE="$DIR/compose.dev.yml"

# Load .env if present
if [ -f "$ROOT_DIR/.env" ]; then
    echo "Loading environment variables from $ROOT_DIR/.env..."
    set -a
    source "$ROOT_DIR/.env"
    set +a
elif [ -f "$DIR/.env" ]; then
    echo "Loading environment variables from $DIR/.env..."
    set -a
    source "$DIR/.env"
    set +a
fi

echo "============================================================"
echo " Starting English Learning Microservices System"
echo "============================================================"

# 1. Start Docker Infrastructure & Gateway
echo "1. Checking Docker infrastructure & API Gateway..."
docker compose -p deploy -f "$COMPOSE_FILE" up -d

echo "2. Waiting for SQL Server & Redis to become healthy..."
docker compose -p deploy -f "$COMPOSE_FILE" exec -T redis redis-cli ping >/dev/null 2>&1 || sleep 3

# Array to store child process PIDs
PIDS=()

cleanup() {
    echo ""
    echo "Shutting down all running services..."
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" >/dev/null 2>&1; then
            kill "$pid" 2>/dev/null || true
        fi
    done
    wait 2>/dev/null || true
    echo "All microservices stopped cleanly."
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Determine repository paths (Polyrepo vs Monorepo)
REPOS_DIR="$(cd "$DIR/.." >/dev/null 2>&1 && pwd)"
if [ -d "$REPOS_DIR/english-learning-auth" ]; then
    AUTH_PROJECT="$REPOS_DIR/english-learning-auth/src/Auth.Api"
    PROFILE_PROJECT="$REPOS_DIR/english-learning-profile/src/Profile.Api"
    LEARNING_PROJECT="$REPOS_DIR/english-learning-learning/src/Learning.Api"
    AI_PROJECT="$REPOS_DIR/english-learning-ai/src/Ai.Api"
    TEST_PROJECT="$REPOS_DIR/english-learning-test/src/Test.Api"
    FRONTEND_DIR="$REPOS_DIR/english-learning-frontend"
else
    AUTH_PROJECT="$ROOT_DIR/src/Auth/Auth.Api"
    PROFILE_PROJECT="$ROOT_DIR/src/Profile/Profile.Api"
    LEARNING_PROJECT="$ROOT_DIR/src/Learning/Learning.Api"
    AI_PROJECT="$ROOT_DIR/src/Ai/Ai.Api"
    TEST_PROJECT="$ROOT_DIR/src/Test/Test.Api"
    FRONTEND_DIR="$ROOT_DIR/frontend"
fi

# 3. Start Backend Services
echo "3. Starting backend microservices..."
LOGS_DIR="$DIR/logs"
mkdir -p "$LOGS_DIR"

echo "   -> Starting Auth Service (HTTP 5001)..."
dotnet run --project "$AUTH_PROJECT" --urls "http://0.0.0.0:5001" > "$LOGS_DIR/auth.log" 2>&1 &
PIDS+=($!)

echo "   -> Starting Profile Service (HTTP 5002)..."
dotnet run --project "$PROFILE_PROJECT" --urls "http://0.0.0.0:5002" > "$LOGS_DIR/profile.log" 2>&1 &
PIDS+=($!)

echo "   -> Starting Learning Service (HTTP 5003)..."
dotnet run --project "$LEARNING_PROJECT" --urls "http://0.0.0.0:5003" > "$LOGS_DIR/learning.log" 2>&1 &
PIDS+=($!)

echo "   -> Starting AI Service (HTTP 5004)..."
dotnet run --project "$AI_PROJECT" --urls "http://0.0.0.0:5004" > "$LOGS_DIR/ai.log" 2>&1 &
PIDS+=($!)

echo "   -> Starting Test Service (HTTP 5005)..."
dotnet run --project "$TEST_PROJECT" --urls "http://0.0.0.0:5005" > "$LOGS_DIR/test.log" 2>&1 &
PIDS+=($!)

# 4. Start Frontend
echo "4. Starting React Frontend (HTTP 3000)..."
(cd "$FRONTEND_DIR" && npm run dev -- --port 3000 --host 0.0.0.0) > "$LOGS_DIR/frontend.log" 2>&1 &
PIDS+=($!)

echo ""
echo "============================================================"
echo " System Online & Ready!"
echo "============================================================"
echo " - API Gateway / Web Application: http://localhost:8080"
echo " - Direct React UI:               http://localhost:3000"
echo " - Gateway Health Probe:          http://localhost:8080/healthz"
echo " - Kafka UI (Topic Inspector):    http://localhost:8085"
echo " - Mailpit (Email Inspector):     http://localhost:8025"
echo ""
echo "Press Ctrl+C to stop all services."
echo "============================================================"

# Wait indefinitely for all children
wait
