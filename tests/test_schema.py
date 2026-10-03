import json
from datetime import datetime, timezone

import pytest

from schema import (
    validate_order,
    serialize_order,
    deserialize_order,
    SchemaValidationError,
)


def valid_order(**overrides):
    order = {
        "schemaVersion": 1,
        "orderId": 42,
        "customer": "customer_7",
        "amount": "19.99",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    order.update(overrides)
    return order


def test_validate_order_accepts_well_formed_order():
    order = valid_order()
    assert validate_order(order) == order


def test_validate_order_rejects_missing_required_field():
    order = valid_order()
    del order["customer"]
    with pytest.raises(SchemaValidationError):
        validate_order(order)


def test_validate_order_rejects_wrong_schema_version():
    with pytest.raises(SchemaValidationError):
        validate_order(valid_order(schemaVersion=2))


def test_validate_order_rejects_malformed_amount():
    with pytest.raises(SchemaValidationError):
        validate_order(valid_order(amount="not-a-number"))


def test_validate_order_rejects_unknown_fields():
    with pytest.raises(SchemaValidationError):
        validate_order(valid_order(extraField="nope"))


def test_serialize_deserialize_round_trip():
    order = valid_order()
    payload = serialize_order(order)
    assert isinstance(payload, bytes)
    assert deserialize_order(payload) == order


def test_serialize_order_rejects_invalid_order_before_the_wire():
    with pytest.raises(SchemaValidationError):
        serialize_order(valid_order(orderId=-1))


def test_deserialize_order_rejects_non_json():
    with pytest.raises(json.JSONDecodeError):
        deserialize_order(b"not json")
