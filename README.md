# English Learning - Infrastructure & Orchestration

DevOps repository containing Docker Compose definitions, API Gateway configurations, k6 performance scripts, and development orchestration tooling for the English Learning polyrepo ecosystem.

## Topology
- **API Gateway**: Nginx reverse proxy routing `/api/v1/auth` (5001), `/api/v1/profile` (5002), `/api/v1/vocabulary` (5003), `/api/v1/ai` (5004), `/api/v1/tests` (5005), and `/` (3000 SPA).
- **Core Stores**:
  - Microsoft SQL Server 2022 (Port 1433)
  - Redis 7 In-Memory Cache (Port 6379)
  - Apache Kafka in KRaft mode (Port 9092 / 29092)
  - Kafka UI (Port 8085)
  - Mailpit SMTP Testing (Web: 8025, SMTP: 1025)

## Developer Workflows

### 1. Launch Infrastructure
```bash
./infra.sh start
./infra.sh status
```

### 2. Launch Entire Polyrepo System (Dev Mode)
```bash
./run-dev.sh
```
This automatically boots all 5 backend microservices and the Vite React frontend, connected to the local API Gateway on `http://localhost:8080`.

### 3. Smoke & Performance Testing
```bash
k6 run k6/smoke-test.js
k6 run k6/load-test.js
```
