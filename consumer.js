/**
 * consumer.js
 *
 * Consumes "order.created" events from RabbitMQ and simulates processing them.
 *
 * Concepts demonstrated:
 *  - Queue: where messages actually sit until a consumer picks them up.
 *  - Binding: the link between an exchange and a queue, with a routing key —
 *    this queue is bound to "order.created" only, so it never sees "order.shipped".
 *  - Manual acknowledgement (ack): the consumer tells RabbitMQ "I finished this
 *    message successfully" only AFTER processing completes. If the consumer
 *    crashes before ack-ing, RabbitMQ redelivers the message — this is what makes
 *    the system resilient to a consumer dying mid-task.
 *  - prefetch(1): tells RabbitMQ "don't send me a new message until I've ack'd
 *    the current one" — a basic form of backpressure / fair dispatch.
 */
const amqp = require("amqplib");

const EXCHANGE = "orders_exchange";
const QUEUE = "order_processing_queue";
const ROUTING_KEY = "order.created";

async function simulateProcessing(order) {
  // Stand-in for real work: e.g., writing to a database, calling another service.
  await new Promise((resolve) => setTimeout(resolve, 500));
  console.log(`[processed] order ${order.orderId} for ${order.customer} ($${order.amount})`);
}

async function main() {
  const connection = await amqp.connect("amqp://guest:guest@localhost:5672");
  const channel = await connection.createChannel();

  await channel.assertExchange(EXCHANGE, "direct", { durable: true });
  await channel.assertQueue(QUEUE, { durable: true });
  await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);

  channel.prefetch(1);

  console.log(`Consumer listening on "${QUEUE}" (routing key: "${ROUTING_KEY}")...`);

  channel.consume(QUEUE, async (msg) => {
    if (msg === null) return;

    const order = JSON.parse(msg.content.toString());
    try {
      await simulateProcessing(order);
      channel.ack(msg); // tell RabbitMQ this message was handled successfully
    } catch (err) {
      console.error("Processing failed, requeueing message:", err);
      channel.nack(msg, false, true); // put it back on the queue to retry
    }
  });
}

main().catch((err) => {
  console.error("Consumer error:", err);
  process.exit(1);
});
