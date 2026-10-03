const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const { findUser } = require("./users");
const { requireAuth, requireRole, JWT_SECRET } = require("./auth-middleware");
const { serializeOrder } = require("./schema");
const { getAllOrders, getOrdersByCustomer, getOrderById } = require("./db");

const EXCHANGE = "orders_exchange";
const ROUTING_KEY = "order.created";

function createApp(publishFn) {
  const app = express();
  app.use(express.json());

  app.post("/login", async (req, res) => {
    const { username, password } = req.body || {};
    const user = findUser(username);

    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const passwordMatches = await bcrypt.compare(password || "", user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = jwt.sign(
      { username: user.username, role: user.role, customerId: user.customerId || null },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ token });
  });

  app.get("/orders", requireAuth, (req, res) => {
    if (req.user.role === "admin") {
      return res.json({ orders: getAllOrders() });
    }
    res.json({ orders: getOrdersByCustomer(req.user.customerId) });
  });

  app.post("/orders/:orderId/requeue", requireAuth, requireRole("admin"), (req, res) => {
    const orderId = Number(req.params.orderId);
    const order = getOrderById(orderId);

    if (!order) {
      return res.status(404).json({ error: `Order ${orderId} not found` });
    }

    const { orderId: id, customer, amount, createdAt, schemaVersion } = order;
    const payload = serializeOrder({ orderId: id, customer, amount, createdAt, schemaVersion });
    publishFn(EXCHANGE, ROUTING_KEY, payload, { persistent: true });

    console.log(`[requeued by ${req.user.username}] order ${orderId}`);
    res.json({ status: "requeued", orderId });
  });

  return app;
}

module.exports = { createApp, EXCHANGE, ROUTING_KEY };
