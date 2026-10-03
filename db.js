const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "orders.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    orderId       INTEGER PRIMARY KEY,
    customer      TEXT NOT NULL,
    amount        TEXT NOT NULL,
    createdAt     TEXT NOT NULL,
    schemaVersion INTEGER NOT NULL,
    processedAt   TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const insertStmt = db.prepare(`
  INSERT INTO orders (orderId, customer, amount, createdAt, schemaVersion)
  VALUES (@orderId, @customer, @amount, @createdAt, @schemaVersion)
  ON CONFLICT(orderId) DO UPDATE SET
    customer = excluded.customer,
    amount = excluded.amount,
    createdAt = excluded.createdAt,
    schemaVersion = excluded.schemaVersion,
    processedAt = datetime('now')
`);

const allStmt = db.prepare(`SELECT * FROM orders ORDER BY processedAt DESC`);
const byCustomerStmt = db.prepare(
  `SELECT * FROM orders WHERE customer = ? ORDER BY processedAt DESC`
);
const byIdStmt = db.prepare(`SELECT * FROM orders WHERE orderId = ?`);

function saveOrder(order) {
  insertStmt.run(order);
  return order;
}

function getAllOrders() {
  return allStmt.all();
}

function getOrdersByCustomer(customerId) {
  return byCustomerStmt.all(customerId);
}

function getOrderById(orderId) {
  return byIdStmt.get(orderId);
}

function resetForTests() {
  db.exec("DELETE FROM orders");
}

module.exports = {
  saveOrder,
  getAllOrders,
  getOrdersByCustomer,
  getOrderById,
  resetForTests,
  _db: db,
};
