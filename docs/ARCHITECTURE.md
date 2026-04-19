# Architecture

## Overview

MotorBid follows a microservices architecture with event-driven communication. Each service owns its data store, communicates asynchronously via RabbitMQ, and is accessible through a single API Gateway.

```
                          ┌──────────────┐
                          │   Next.js    │
                          │   Web App    │
                          │   :3000      │
                          └──────┬───────┘
                                 │
                          ┌──────┴───────┐
                          │   Gateway    │
                          │   (YARP)     │
                          │   :6001      │
                          └──────┬───────┘
                                 │
          ┌──────────┬───────────┼───────────┬──────────┐
          │          │           │           │          │
   ┌──────┴──┐ ┌────┴────┐ ┌───┴───┐ ┌────┴────┐ ┌───┴────┐
   │Auction  │ │ Search  │ │Bidding│ │Identity │ │Notify  │
   │Service  │ │ Service │ │Service│ │Service  │ │Service │
   │:7001    │ │:7002    │ │:7003  │ │:5001    │ │:7004   │
   └────┬────┘ └────┬────┘ └───┬───┘ └─────────┘ └───┬────┘
        │           │          │                      │
        │      ┌────┴────┐     │                      │
        │      │ MongoDB │◄────┘                      │
        │      └─────────┘                            │
   ┌────┴─────┐                              ┌───────┴──────┐
   │PostgreSQL│                              │   RabbitMQ   │
   └──────────┘                              │  (all svc)   │
                                             └──────────────┘
```

## Services

### AuctionService

The core service managing auction lifecycle (create, update, delete, finish).

- **Database**: PostgreSQL via Entity Framework Core
- **Pattern**: Repository pattern (`IAuctionRepository` / `AuctionRepository`)
- **Outbox**: MassTransit transactional outbox ensures messages are published reliably alongside database writes
- **gRPC Server**: Exposes auction data to BiddingService on port 7777 for synchronous lookups
- **Endpoints**: `GET/POST/PUT/DELETE /api/auctions`

### SearchService

Read-optimized service for querying auctions with full-text search, filtering, sorting, and pagination.

- **Database**: MongoDB with text indexes on Make, Model, and Color
- **Sync**: Consumes `AuctionCreated`, `AuctionUpdated`, `AuctionDeleted` events to keep its data in sync
- **Resilience**: Uses Polly retry policies when fetching initial data from AuctionService on startup
- **Endpoints**: `GET /api/search`

### BiddingService

Handles bid placement, validation, and auction completion detection.

- **Database**: MongoDB for bids and a local auction cache
- **gRPC Client**: Fetches auction details from AuctionService when not found locally
- **Background Service**: `CheckAuctionFinished` runs every 5 seconds to detect ended auctions and publishes `AuctionFinished` events
- **Validation**: Checks bid amount against current high bid, auction status, reserve price, and seller identity
- **Endpoints**: `POST /api/bids`, `GET /api/bids/{auctionId}`

### IdentityService

OAuth2/OpenID Connect identity provider built on Duende IdentityServer and ASP.NET Identity.

- **Database**: PostgreSQL for user storage
- **Clients**: `postman` (Resource Owner Password grant) and `nextApp` (Authorization Code + Client Credentials)
- **Custom Profile Service**: Adds `username` claim to tokens
- **Seed Data**: Pre-configured users `alice` and `bob`
- **Configuration**: `IssuerUri` and `ClientApp` redirect URIs are environment-configurable

### GatewayService

Single entry point for all client requests using YARP reverse proxy.

- **Routing**: Method-based routing (GET requests are public, write operations require authentication)
- **Authentication**: Validates JWT tokens from IdentityService
- **CORS**: Configured for the frontend origin with credentials support (required for SignalR)
- **Routes**:

| Route | Methods | Target | Auth |
|-------|---------|--------|------|
| `/auctions/*` | GET | AuctionService | No |
| `/auctions/*` | POST, PUT, DELETE | AuctionService | Yes |
| `/search/*` | GET | SearchService | No |
| `/bids` | POST | BiddingService | Yes |
| `/bids/*` | GET | BiddingService | No |
| `/notifications/*` | WebSocket | NotificationService | No (CORS) |

### NotificationService

Broadcasts real-time events to connected browser clients via SignalR.

- **No database**: Purely event-driven
- **Hub**: `NotificationHub` at `/notifications`
- **Events consumed**: `AuctionCreated`, `AuctionFinished`, `BidPlaced`
- **Events broadcast**: Same events forwarded to all connected SignalR clients

## Communication Patterns

### Asynchronous (RabbitMQ + MassTransit)

All services communicate asynchronously through RabbitMQ. MassTransit provides:

- **Consumer abstraction**: Each service implements `IConsumer<TMessage>` for events it cares about
- **Endpoint naming**: KebabCase formatter with service-specific prefixes (e.g., `auction-auction-created`, `search-auction-created`)
- **Transactional outbox**: AuctionService uses EF Core outbox to ensure database writes and message publishes are atomic
- **Retry policies**: SearchService retries failed message processing

**Event flow example (placing a bid):**

```
1. User places bid via frontend
2. BiddingService validates and saves bid to MongoDB
3. BiddingService publishes BidPlaced to RabbitMQ
4. AuctionService consumes BidPlaced, updates CurrentHighBid in PostgreSQL
5. SearchService consumes BidPlaced, updates CurrentHighBid in MongoDB
6. NotificationService consumes BidPlaced, broadcasts to SignalR clients
7. Frontend receives SignalR event, updates UI in real-time
```

### Synchronous (gRPC)

BiddingService uses gRPC to fetch auction data from AuctionService when a bid arrives for an auction not yet in its local MongoDB cache. This is a fallback -- normally the `AuctionCreated` event populates the local cache.

```
BiddingService --gRPC (port 7777)--> AuctionService
```

The proto definition (`protos/auctions.proto`) defines a single RPC: `GetAuction(id) -> AuctionResponse`.

### HTTP (Service-to-Service)

SearchService calls AuctionService over HTTP on startup to sync its MongoDB data if behind. Polly provides retry-forever with 3-second intervals.

## Data Storage

### PostgreSQL

Used by services that need ACID transactions and relational integrity:

- **auction** database: Auctions, Items, outbox tables (AuctionService)
- **identity** database: ASP.NET Identity tables (IdentityService)

### MongoDB

Used by services that need flexible schemas and high read throughput:

- **search** database: Denormalized auction items with text indexes (SearchService)
- **BidDb** database: Bids and auction cache (BiddingService)

## Shared Contracts

The `Contracts` project defines message schemas used across services:

| Contract | Published By | Consumed By |
|----------|-------------|-------------|
| `AuctionCreated` | AuctionService | SearchService, BiddingService, NotificationService |
| `AuctionUpdated` | AuctionService | SearchService |
| `AuctionDeleted` | AuctionService | SearchService |
| `AuctionFinished` | BiddingService | AuctionService, SearchService, NotificationService |
| `BidPlaced` | BiddingService | AuctionService, SearchService, NotificationService |

## Frontend Architecture

### Server Components vs Client Components

- **Server Components** (default): Fetch data via server actions (`'use server'`), no client-side JavaScript
- **Client Components** (`'use client'`): Used for interactivity (forms, real-time updates, state)

### Data Flow

```
Server Actions (SSR):
  Browser --> Next.js Server --> fetchWrapper --> GatewayService --> Backend

SignalR (Real-time):
  Browser --> WebSocket --> GatewayService --> NotificationService
```

`fetchWrapper.ts` handles all API calls from server actions, automatically attaching the user's access token from the NextAuth session.

### State Management (Zustand)

Three stores manage client-side state:

- **useParamsStore**: Search/filter parameters (page, sort, filters, seller, winner)
- **useAuctionStore**: Auction list data with real-time price updates
- **useBidStore**: Bid list for the current auction detail page

### Authentication Flow

1. User clicks Login, redirected to IdentityService OAuth login page
2. User authenticates, redirected back to `/api/auth/callback/id-server`
3. NextAuth exchanges authorization code for access token + ID token
4. JWT session stores `accessToken` and `username`
5. Server actions use `accessToken` for API calls via `fetchWrapper`

## Testing

### Unit Tests (AuctionService.Unit.Tests)

- **Framework**: xUnit + Moq + AutoFixture
- **Scope**: Controller logic in isolation
- **Approach**: Mock `IAuctionRepository` and `IPublishEndpoint`, test controller decisions (status codes, auth checks)

### Integration Tests (AuctionService.IntegrationTests)

- **Framework**: xUnit + WebApplicationFactory + Testcontainers
- **Database**: Disposable PostgreSQL container per test run
- **Auth**: Fake JWT Bearer tokens
- **Bus**: MassTransit test harness verifies message publishing
- **Scope**: Full HTTP request pipeline including database

### Integration Tests (SearchService.IntegrationTests)

- **Framework**: xUnit + WebApplicationFactory + Mongo2Go
- **Database**: In-memory MongoDB instance
- **Scope**: Consumer tests verifying events create correct documents

## Docker

Each .NET service has a multi-stage Dockerfile:

1. **Build stage**: SDK image restores all solution projects, publishes the target service
2. **Runtime stage**: ASP.NET runtime image runs the published DLL

The frontend uses a 3-stage build:

1. **deps**: Install npm dependencies
2. **builder**: Build Next.js with `output: 'standalone'`
3. **runner**: Minimal Node.js Alpine image

All services are orchestrated via `docker-compose.yml` with dependency ordering.
