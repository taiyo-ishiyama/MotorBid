# MotorBid

A microservices-based car auction platform where users can list vehicles, place real-time bids, and receive instant notifications. Built with .NET 10, Next.js 14, and event-driven architecture.

## Tech Stack

**Backend**
- .NET 10.0 (ASP.NET Core)
- Entity Framework Core / MongoDB.Entities
- MassTransit + RabbitMQ (messaging)
- gRPC (inter-service communication)
- Duende IdentityServer (OAuth2/OIDC)
- YARP (API Gateway)
- SignalR (real-time notifications)

**Frontend**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS + Flowbite React
- NextAuth v5 (authentication)
- Zustand (state management)
- SignalR client (real-time updates)

**Infrastructure**
- PostgreSQL 16
- MongoDB
- RabbitMQ 3
- Docker / Docker Compose

## Services

| Service | Port | Description |
|---------|------|-------------|
| AuctionService | 7001 | Auction CRUD, gRPC server (7777) |
| SearchService | 7002 | Full-text search with MongoDB |
| BiddingService | 7003 | Bid placement and validation |
| NotificationService | 7004 | Real-time events via SignalR |
| IdentityService | 5001 | OAuth2/OIDC identity provider |
| GatewayService | 6001 | YARP reverse proxy |
| Web App | 3000 | Next.js frontend |

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 18+](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop)

## Getting Started

### 1. Start infrastructure services

```bash
docker compose up -d postgres mongodb RabbitMQ
```

### 2. Run backend services

Open separate terminals for each service:

```bash
cd src/AuctionService && dotnet watch
cd src/SearchService && dotnet watch
cd src/IdentityService && dotnet watch
cd src/GatewayService && dotnet watch
cd src/BiddingService && dotnet watch
cd src/NotificationService && dotnet watch
```

### 3. Run the frontend

```bash
cd frontend/web-app
npm install
```

Create a `.env.local` file:

```
AUTH_SECRET=<generate with: openssl rand -base64 32>
API_URL=http://localhost:6001/
ID_URL=http://localhost:5001
ID_URL_INTERNAL=http://localhost:5001
NOTIFY_URL=http://localhost:6001/notifications
```

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

### 4. Run with Docker (all services)

Alternatively, you can run the entire stack in Docker. This is useful for production-like environments or when you don't need hot reload:

```bash
docker compose up -d --build
```

## Seed Users

The IdentityService seeds two test users on startup:

| Username | Password |
|----------|----------|
| alice | Pass123$ |
| bob | Pass123$ |

## Running Tests

```bash
# All tests
dotnet test

# Unit tests only
dotnet test tests/AuctionService.Unit.Tests

# Integration tests (requires Docker for Testcontainers)
dotnet test tests/AuctionService.IntegrationTests
dotnet test tests/SearchService.IntegrationTests
```

## API Access via Postman

Get a token from IdentityService:

```
POST http://localhost:5001/connect/token
Content-Type: application/x-www-form-urlencoded

grant_type=password
client_id=postman
client_secret=NotASecret
username=bob
password=Pass123$
scope=auctionApp openid profile
```

Use the access token as a Bearer token for authenticated endpoints through the Gateway (`http://localhost:6001`).

## Project Structure

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture documentation.

```
MotorBid/
├── src/
│   ├── AuctionService/       # Auction CRUD + gRPC server
│   ├── SearchService/        # Full-text search (MongoDB)
│   ├── BiddingService/       # Bid management + gRPC client
│   ├── NotificationService/  # Real-time notifications (SignalR)
│   ├── IdentityService/      # OAuth2/OIDC provider
│   ├── GatewayService/       # API Gateway (YARP)
│   └── Contracts/            # Shared message contracts
├── tests/
│   ├── AuctionService.Unit.Tests/
│   ├── AuctionService.IntegrationTests/
│   └── SearchService.IntegrationTests/
├── frontend/
│   └── web-app/              # Next.js frontend
├── docker-compose.yml
└── MotorBid.sln
```
