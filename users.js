const bcrypt = require("bcryptjs");

const USERS = [
  {
    username: "admin",
    passwordHash: bcrypt.hashSync("admin123", 10),
    role: "admin",
  },
  {
    username: "customer1",
    passwordHash: bcrypt.hashSync("customer123", 10),
    role: "customer",
    customerId: "customer_1",
  },
];

function findUser(username) {
  return USERS.find((u) => u.username === username);
}

module.exports = { findUser };
