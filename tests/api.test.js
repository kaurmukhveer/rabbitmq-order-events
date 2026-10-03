process.env.DB_PATH = ":memory:";
process.env.JWT_SECRET = "test-secret";

const request = require("supertest");
const { createApp } = require("../api");
const { saveOrder, resetForTests, _db } = require("../db");

function seedOrder(overrides = {}) {
  const order = {
    orderId: 1,
    customer: "customer_1",
    amount: "10.00",
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
    ...overrides,
  };
  saveOrder(order);
  return order;
}

async function loginAs(app, username, password) {
  const res = await request(app).post("/login").send({ username, password });
  return res.body.token;
}

describe("Orders API", () => {
  let app;
  let publishFn;

  beforeEach(() => {
    resetForTests();
    publishFn = jest.fn();
    app = createApp(publishFn);
  });

  afterAll(() => {
    _db.close();
  });

  describe("POST /login", () => {
    test("returns a token for correct admin credentials", async () => {
      const res = await request(app)
        .post("/login")
        .send({ username: "admin", password: "admin123" });
      expect(res.status).toBe(200);
      expect(res.body.token).toEqual(expect.any(String));
    });

    test("rejects a wrong password with 401", async () => {
      const res = await request(app)
        .post("/login")
        .send({ username: "admin", password: "wrong-password" });
      expect(res.status).toBe(401);
    });

    test("rejects an unknown username with 401", async () => {
      const res = await request(app)
        .post("/login")
        .send({ username: "nobody", password: "whatever" });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /orders (RBAC)", () => {
    test("401s with no token", async () => {
      const res = await request(app).get("/orders");
      expect(res.status).toBe(401);
    });

    test("admin sees every order, across customers", async () => {
      seedOrder({ orderId: 1, customer: "customer_1" });
      seedOrder({ orderId: 2, customer: "customer_2" });

      const token = await loginAs(app, "admin", "admin123");
      const res = await request(app).get("/orders").set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.orders).toHaveLength(2);
    });

    test("customer sees only their own orders", async () => {
      seedOrder({ orderId: 1, customer: "customer_1" });
      seedOrder({ orderId: 2, customer: "customer_2" });

      const token = await loginAs(app, "customer1", "customer123");
      const res = await request(app).get("/orders").set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.orders).toHaveLength(1);
      expect(res.body.orders[0].customer).toBe("customer_1");
    });
  });

  describe("POST /orders/:orderId/requeue (admin-only)", () => {
    test("a customer gets 403", async () => {
      seedOrder({ orderId: 1, customer: "customer_1" });
      const token = await loginAs(app, "customer1", "customer123");

      const res = await request(app)
        .post("/orders/1/requeue")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(publishFn).not.toHaveBeenCalled();
    });

    test("an admin can requeue an existing order, and it is re-validated before publishing", async () => {
      seedOrder({ orderId: 1, customer: "customer_1" });
      const token = await loginAs(app, "admin", "admin123");

      const res = await request(app)
        .post("/orders/1/requeue")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(publishFn).toHaveBeenCalledTimes(1);
      const [exchange, routingKey, payload] = publishFn.mock.calls[0];
      expect(exchange).toBe("orders_exchange");
      expect(routingKey).toBe("order.created");
      expect(JSON.parse(payload.toString()).orderId).toBe(1);
    });

    test("404s for an order that doesn't exist", async () => {
      const token = await loginAs(app, "admin", "admin123");
      const res = await request(app)
        .post("/orders/999/requeue")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });
});
