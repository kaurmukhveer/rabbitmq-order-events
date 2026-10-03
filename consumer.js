const amqp = require("amqplib");

const { handleMessage } = require("./message-handler");
const { createApp } = require("./api");

const EXCHANGE = "orders_exchange";
const QUEUE = "order_processing_queue";
const ROUTING_KEY = "order.created";
const API_PORT = process.env.API_PORT || 3000;
const AMQP_URL = process.env.AMQP_URL || "amqp://guest:guest@localhost:5672";

async function main() {
  const connection = await amqp.connect(AMQP_URL);
  const channel = await connection.createChannel();

  await channel.assertExchange(EXCHANGE, "direct", { durable: true });
  await channel.assertQueue(QUEUE, { durable: true });
  await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);

  channel.prefetch(1);

  console.log(`Consumer listening on "${QUEUE}" (routing key: "${ROUTING_KEY}")...`);

  channel.consume(QUEUE, (msg) => handleMessage(channel, msg));

  const app = createApp(channel.publish.bind(channel));
  app.listen(API_PORT, () => {
    console.log(`Orders API listening on http://localhost:${API_PORT}`);
    console.log(`  POST /login {"username":"admin","password":"admin123"}`);
    console.log(`  POST /login {"username":"customer1","password":"customer123"}`);
  });
}

main().catch((err) => {
  console.error("Consumer error:", err);
  process.exit(1);
});
