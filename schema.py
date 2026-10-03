import json
import pathlib

import jsonschema

_SCHEMA_PATH = pathlib.Path(__file__).parent / "schema" / "order-schema.json"
with open(_SCHEMA_PATH, "r", encoding="utf-8") as f:
    ORDER_SCHEMA = json.load(f)

_validator = jsonschema.Draft7Validator(ORDER_SCHEMA)


class SchemaValidationError(Exception):
    def __init__(self, errors):
        self.errors = errors
        message = "; ".join(str(e.message) for e in errors)
        super().__init__(f"Order message failed schema validation: {message}")


def validate_order(order: dict) -> dict:
    errors = sorted(_validator.iter_errors(order), key=lambda e: e.path)
    if errors:
        raise SchemaValidationError(errors)
    return order


def serialize_order(order: dict) -> bytes:
    validate_order(order)
    return json.dumps(order).encode("utf-8")


def deserialize_order(raw) -> dict:
    text = raw.decode("utf-8") if isinstance(raw, (bytes, bytearray)) else raw
    parsed = json.loads(text)
    return validate_order(parsed)
