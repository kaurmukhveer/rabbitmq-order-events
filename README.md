# Order Events — RabbitMQ Producer/Consumer with a Secured REST API

A hands-on project demonstrating asynchronous message processing with
RabbitMQ: a **producer** publishes simulated order events; a **consumer**
picks them up, validates and processes them, persists them to a relational
database, and exposes them through a small, secured REST API.

## What this demonstrates

- **Direct exchange routing**: messages are published with a routing key
  (`order.created` or `order.shipped`); only `order.created` is bound to the
  consumer's queue, so `order.shipped` messages are published but never
  consumed — a concrete illustration of how exchange routing decides which
  queue(s) receive a message.
- **Decoupled producer/consumer**: the producer has no idea who (if anyone)
  is consuming its messages. Restarting the consumer independently of the
  producer recovers backlogged messages purely from the durable queue.
- **Manual acknowledgement**: the consumer only acks a message after it
  finishes processing and persisting it. If it fails mid-task, RabbitMQ
  redelivers the message instead of losing it (see `message-handler.js`).
- **Cross-language message contract**: `schema/order-schema.json` is a JSON
  Schema, with a `schemaVersion` field, validated by `schema.js`. A message
  that doesn't match the contract is rejected outright before it's published
  or after it's received, instead of silently corrupting downstream
  processing.
- **Relational persistence**: processed orders are written to SQLite
  (`db.js`, via `better-sqlite3`) instead of held in memory — they survive a
  consumer restart, and the API reads them back with real SQL queries.
- **Secured REST API (JWT + RBAC)**: `api.js` exposes the orders the
  consumer has processed through a small Express API. `POST /login` issues a
  signed, expiring JWT; every other route requires it. Two roles are
  enforced for real: `admin` can see every order and requeue any of them,
  `customer` can only see orders that belong to them (`auth-middleware.js`,
  `users.js`).
- **Testable by design**: the per-message logic (`message-handler.js`) and
  the API (`api.js`) are both separated from the RabbitMQ connection code in
  `consumer.js` specifically so they can be unit/integration tested with a
  mocked channel and an in-memory database — no live broker required for
  most of the test suite.
- **Docker**: RabbitMQ, the consumer/API, and the producer all run as
  containers via `docker-compose`, with a named volume so the SQLite file
  survives a container restart.
- **CI (GitHub Actions)**: `.github/workflows/ci.yml` runs the Jest suite and
  the Python schema tests on Linux, Windows, and macOS on every push. A
  second job brings up RabbitMQ as a Docker service container and runs the
  full producer → consumer → Orders API → `smoke_test.sh` pipeline —
  intentionally Linux-only, since GitHub Actions service containers aren't
  available on Windows/macOS runners.

## Architecture

```
producer.js --publish--> [orders_exchange] --route by key--> [order_processing_queue]
                                                                      |
                                                                      v
                                                    consumer.js: message-handler.js
                                                    validate -> process -> save (db.js) -> ack
                                                                      |
                                                                      v
                                                    api.js (Express + JWT + RBAC)
                                                    GET /orders, POST /orders/:id/requeue
```

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- Node.js (v18+)
- Python 3.10+ (for the schema tests)

## Setup — Docker Compose (recommended)

```bash
docker-compose up --build
```

This starts RabbitMQ, the consumer/API, and the producer together. Once it's
up:

```bash
# The producer starts publishing every 2s; give it a few seconds, then:
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
# copy the returned token, then:
curl http://localhost:3000/orders -H "Authorization: Bearer <token>"

# Or run the full automated check:
./smoke_test.sh
```

RabbitMQ's management UI is at http://localhost:15672 (guest/guest) — watch
messages move through the **Queues** tab in real time.

## Setup — running directly on your machine

```bash
# 1. Start RabbitMQ only
docker-compose up -d rabbitmq

# 2. Install dependencies
npm install

# 3. In one terminal, start the consumer (also runs the Orders API)
npm run consumer

# 4. In a second terminal, start the producer
npm run producer

# 5. Run the automated check
./smoke_test.sh

# 6. Run the unit/integration tests directly (no RabbitMQ needed for these)
npx jest
npm run test:python
```

## Notes on scope

This is a personal learning project, not a production messaging system. It
demonstrates real, hands-on understanding of RabbitMQ's core concepts
(exchanges, queues, bindings, acknowledgements), REST API design with
authentication and role-based access control, relational persistence, and
containerized deployment via Docker Compose — not distributed-systems-scale
message broker operation, clustering, or high availability.
