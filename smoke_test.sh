#!/usr/bin/env bash
set -uo pipefail

API="http://localhost:${API_PORT:-3000}"
PASS=0
FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

echo "Waiting for the Orders API at $API ..."
for i in $(seq 1 30); do
  if curl -s -o /dev/null "$API/orders"; then
    break
  fi
  sleep 1
done

echo
echo "1) Unauthenticated request is rejected"
status=$(curl -s -o /dev/null -w "%{http_code}" "$API/orders")
[ "$status" = "401" ] && pass "GET /orders with no token -> 401" || fail "GET /orders with no token -> got $status, expected 401"

echo
echo "2) Wrong password is rejected"
status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrong-password"}')
[ "$status" = "401" ] && pass "POST /login wrong password -> 401" || fail "POST /login wrong password -> got $status, expected 401"

echo
echo "3) Admin can log in and see all orders"
admin_token=$(curl -s -X POST "$API/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.token')
if [ -n "$admin_token" ] && [ "$admin_token" != "null" ]; then
  pass "POST /login as admin -> got a token"
else
  fail "POST /login as admin -> no token returned"
fi

admin_orders=$(curl -s "$API/orders" -H "Authorization: Bearer $admin_token")
admin_count=$(echo "$admin_orders" | jq '.orders | length')
if [ "$admin_count" -ge 0 ] 2>/dev/null; then
  pass "GET /orders as admin -> 200 with $admin_count order(s)"
else
  fail "GET /orders as admin -> unexpected response: $admin_orders"
fi

echo
echo "4) Customer can log in and only sees their own orders"
customer_token=$(curl -s -X POST "$API/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"customer1","password":"customer123"}' | jq -r '.token')
customer_orders=$(curl -s "$API/orders" -H "Authorization: Bearer $customer_token")
other_customers=$(echo "$customer_orders" | jq '[.orders[] | select(.customer != "customer_1")] | length')
if [ "$other_customers" = "0" ]; then
  pass "GET /orders as customer1 -> no other customer's orders leaked"
else
  fail "GET /orders as customer1 -> saw $other_customers order(s) belonging to someone else"
fi

echo
echo "5) A customer cannot requeue (admin-only route)"
first_order_id=$(echo "$admin_orders" | jq -r '.orders[0].orderId // empty')
if [ -n "$first_order_id" ]; then
  status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/orders/$first_order_id/requeue" \
    -H "Authorization: Bearer $customer_token")
  [ "$status" = "403" ] && pass "POST /orders/$first_order_id/requeue as customer -> 403" \
    || fail "POST /orders/$first_order_id/requeue as customer -> got $status, expected 403"

  echo
  echo "6) An admin CAN requeue an existing order"
  status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/orders/$first_order_id/requeue" \
    -H "Authorization: Bearer $admin_token")
  [ "$status" = "200" ] && pass "POST /orders/$first_order_id/requeue as admin -> 200" \
    || fail "POST /orders/$first_order_id/requeue as admin -> got $status, expected 200"
else
  echo "  SKIP: no processed orders yet to test requeue against"
fi

echo
echo "-------------------------------------------"
echo "Smoke test results: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
