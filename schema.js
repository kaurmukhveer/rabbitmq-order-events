const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");

const schemaPath = path.join(__dirname, "schema", "order-schema.json");
const orderSchema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(orderSchema);

class SchemaValidationError extends Error {
  constructor(errors) {
    super(`Order message failed schema validation: ${JSON.stringify(errors)}`);
    this.name = "SchemaValidationError";
    this.errors = errors;
  }
}

function validateOrder(order) {
  const valid = validate(order);
  if (!valid) {
    throw new SchemaValidationError(validate.errors);
  }
  return order;
}

function serializeOrder(order) {
  validateOrder(order);
  return Buffer.from(JSON.stringify(order));
}

function deserializeOrder(raw) {
  const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : raw;
  const parsed = JSON.parse(text);
  return validateOrder(parsed);
}

module.exports = { validateOrder, serializeOrder, deserializeOrder, SchemaValidationError, orderSchema };
