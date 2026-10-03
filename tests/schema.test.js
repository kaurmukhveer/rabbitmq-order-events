const {
  validateOrder,
  serializeOrder,
  deserializeOrder,
  SchemaValidationError,
} = require("../schema");

function validOrder(overrides = {}) {
  return {
    schemaVersion: 1,
    orderId: 42,
    customer: "customer_7",
    amount: "19.99",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("validateOrder", () => {
  test("accepts a well-formed order", () => {
    const order = validOrder();
    expect(validateOrder(order)).toEqual(order);
  });

  test("rejects a missing required field", () => {
    const { customer, ...missingCustomer } = validOrder();
    expect(() => validateOrder(missingCustomer)).toThrow(SchemaValidationError);
  });

  test("rejects the wrong schemaVersion", () => {
    expect(() => validateOrder(validOrder({ schemaVersion: 2 }))).toThrow(
      SchemaValidationError
    );
  });

  test("rejects malformed data (amount not matching the money pattern)", () => {
    expect(() => validateOrder(validOrder({ amount: "not-a-number" }))).toThrow(
      SchemaValidationError
    );
  });

  test("rejects unknown fields (additionalProperties: false)", () => {
    expect(() => validateOrder(validOrder({ extraField: "nope" }))).toThrow(
      SchemaValidationError
    );
  });
});

describe("serializeOrder / deserializeOrder round trip", () => {
  test("a valid order survives serialize -> deserialize unchanged", () => {
    const order = validOrder();
    const buffer = serializeOrder(order);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(deserializeOrder(buffer)).toEqual(order);
  });

  test("serializeOrder rejects an invalid order before it ever reaches the wire", () => {
    expect(() => serializeOrder(validOrder({ orderId: -1 }))).toThrow(
      SchemaValidationError
    );
  });

  test("deserializeOrder rejects a message that isn't valid JSON", () => {
    expect(() => deserializeOrder(Buffer.from("not json"))).toThrow();
  });
});
