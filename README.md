# Order Events — RabbitMQ Producer/Consumer Demo

A small hands-on project demonstrating asynchronous message processing with
RabbitMQ, run locally via Docker. A **producer** publishes simulated order
events; a **consumer** picks them up from a queue and processes them
independently and asynchronously.

## What this demonstrates

- **Direct exchange routing**: messages are published with a routing key
  (`order.created` or `order.shipped`); only `order.created` is bound to the
  consumer's queue, so `order.shipped` messages are published but never
  consumed here — a concrete illustration of how exchange routing decides
  which queue(s) receive a message.
- **Decoupled producer/consumer**: the producer has no idea who (if anyone)
  is consuming its messages. It just publishes to the exchange.
- **Manual acknowledgement**: the consumer only confirms ("acks") a message
  after it finishes processing. If it crashes mid-task, RabbitMQ redelivers
  the message instead of losing it.
- **Docker**: RabbitMQ (with its management UI) runs as a container via
  `docker-compose`, with no local RabbitMQ install needed.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- Node.js (v18+)

## Setup

```bash
# 1. Start RabbitMQ in Docker
docker-compose up -d

# 2. Check it's running — open the management UI in a browser:
#    http://localhost:15672  (login: guest / guest)

# 3. Install dependencies
npm install

# 4. In one terminal, start the consumer (it waits for messages)
npm run consumer

# 5. In a second terminal, start the producer (it starts publishing every 2s)
npm run producer
```

Watch the consumer terminal print `[processed] order ...` for every
`order.created` event, while `order.shipped` events appear in the producer's
log but are never picked up — because no queue is bound to that routing key.

You can also watch messages move through the **Queues** tab of the RabbitMQ
management UI (http://localhost:15672) in real time.

## Suggested experiments (do these to actually understand it, not just run it)

- Add a second queue bound to `order.shipped` and write a second consumer for it.
- Kill the consumer mid-processing (Ctrl+C right after a message is picked up,
  before it logs `[processed]`) and restart it — watch RabbitMQ redeliver the
  unacknowledged message.
- Change the exchange type to `fanout` and see how routing keys stop mattering
  (every bound queue gets every message).
- Add a dead-letter queue for messages that fail repeatedly.

## Notes on scope

This is a personal learning project, not a production messaging system. It
demonstrates real, hands-on understanding of RabbitMQ's core concepts
(exchanges, queues, bindings, acknowledgements) and basic Docker usage
(running a service via `docker-compose`), not distributed-systems-scale
message broker operation, clustering, or high availability.
