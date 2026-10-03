/**
 * producer.js
 *
 * Publishes simulated "order" events to a RabbitMQ DIRECT EXCHANGE.
 *
 * Concepts demonstrated:
 *  - Exchange: a routing agent. The producer never sends directly to a queue —
 *    it sends to an exchange, and the exchange decides which queue(s) get the message.
 *  - Direct exchange: routes a message to whichever queue is BOUND with a matching
 *    "routing key" (here: "order.created" or "order.shipped"). This is why only
 *    order.created events end up in our consumer's queue below.
 *  - Message durability: marking messages persistent so they survive a RabbitMQ
 *    restart (only meaningful if the queue itself is also declared durable).
 */
const amqp = require("amqplib");
const { serializeOrder } = require("./schema");
const EXCHANGE = "orders_exchange";
const ROUTING_KEYS = ["order.created", "order.shipped"];
const AMQP_URL = process.env.AMQP_URL || "amqp://guest:guest@localhost:5672";

function randomOrder() {
  return {
    schemaVersion: 1
    orderId: Math.floor(Math.random() * 100000),
    customer: `customer_${Math.floor(Math.random() * 50)}`,
    amount: (Math.random() * 200).toFixed(2),
    createdAt: new Date().toISOString(),
  };
}

async function main() {
  const connection = await amqp.connect(AMQP_URL);
  const channel = await connection.createChannel();

  // A "direct" exchange routes messages to queues based on an exact routing-key match.
  await channel.assertExchange(EXCHANGE, "direct", { durable: true });

  console.log("Producer connected. Publishing order events every 2s... (Ctrl+C to stop)");

  setInterval(async () => {
    const routingKey = ROUTING_KEYS[Math.floor(Math.random() * ROUTING_KEYS.length)];
    const order = randomOrder();
    const payload = serializeOrder(order);/*validates agaginst order-schema.json*/


    channel.publish(EXCHANGE, routingKey, payload, { persistent: true });
    console.log(`[sent] routingKey="${routingKey}" ->`, order);
  }, 2000);
}

main().catch((err) => {
  console.error("Producer error:", err);
  process.exit(1);
});
