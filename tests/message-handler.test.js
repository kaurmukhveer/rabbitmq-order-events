const { serializeOrder } = require("../schema");
const { handleMessage } = require("../message-handler");

function mockChannel() {
  return { ack: jest.fn(), nack: jest.fn() };
}

function validOrder(overrides = {}) {
  return {
    schemaVersion: 1,
    orderId: 101,
    customer: "customer_3",
    amount: "42.00",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("handleMessage", () => {
  test("acks a valid message and saves it", async () => {
    const channel = mockChannel();
    const order = validOrder();
    const msg = { content: serializeOrder(order) };
    const saveOrder = jest.fn();
    const simulateProcessing = jest.fn().mockResolvedValue(undefined);

    await handleMessage(channel, msg, { saveOrder, simulateProcessing });

    expect(simulateProcessing).toHaveBeenCalledWith(order);
    expect(saveOrder).toHaveBeenCalledWith(order);
    expect(channel.ack).toHaveBeenCalledWith(msg);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  test("nacks WITHOUT requeue when the message fails schema validation", async () => {
    const channel = mockChannel();
    const msg = { content: Buffer.from(JSON.stringify({ not: "a valid order" })) };
    const saveOrder = jest.fn();

    await handleMessage(channel, msg, { saveOrder });

    expect(saveOrder).not.toHaveBeenCalled();
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
  });

  test("nacks WITH requeue when processing throws (transient failure)", async () => {
    const channel = mockChannel();
    const order = validOrder();
    const msg = { content: serializeOrder(order) };
    const saveOrder = jest.fn();
    const simulateProcessing = jest.fn().mockRejectedValue(new Error("db unavailable"));

    await handleMessage(channel, msg, { saveOrder, simulateProcessing });

    expect(saveOrder).not.toHaveBeenCalled();
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(msg, false, true);
  });

  test("ignores a null message (amqplib sends null if the channel is cancelled)", async () => {
    const channel = mockChannel();
    await handleMessage(channel, null);
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).not.toHaveBeenCalled();
  });
});

