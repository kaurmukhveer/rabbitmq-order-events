const { deserializeOrder, SchemaValidationError } = require("./schema");
const { saveOrder } = require("./db");

async function simulateProcessing(order) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  console.log(`[processed] order ${order.orderId} for ${order.customer} ($${order.amount})`);
}

async function handleMessage(channel, msg, deps = {}) {
  const process_ = deps.simulateProcessing || simulateProcessing;
  const save = deps.saveOrder || saveOrder;

  if (msg === null) return;

  let order;
  try {
    order = deserializeOrder(msg.content);
  } catch (err) {
    if (err instanceof SchemaValidationError) {
      console.error(`[rejected] message failed schema validation: ${err.message}`);
      channel.nack(msg, false, false);
      return;
    }
    throw err;
  }

  try {
    await process_(order);
    save(order);
    channel.ack(msg);
  } catch (err) {
    console.error("Processing failed, requeueing message:", err);
    channel.nack(msg, false, true);
  }
}

module.exports = { handleMessage, simulateProcessing };
