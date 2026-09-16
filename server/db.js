// server/db.js
const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "ruetpay.db"));

// Enable foreign keys and WAL mode for better performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Create accounts table
db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    account_number TEXT    NOT NULL UNIQUE,
    name           TEXT    NOT NULL,
    phone          TEXT    NOT NULL UNIQUE,
    pin            TEXT    NOT NULL,
    balance        REAL    NOT NULL DEFAULT 10.0,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

/* ── helpers ── */

function generateAccountNumber(id) {
  return "RUET" + String(id).padStart(6, "0"); // e.g. RUET000001
}

/* ── account queries ── */

function findByPhone(phone) {
  return (
    db.prepare("SELECT * FROM accounts WHERE phone = ?").get(phone) || null
  );
}

function findById(id) {
  return db.prepare("SELECT * FROM accounts WHERE id = ?").get(id) || null;
}

function createAccount({ name, phone, pin }) {
  // Insert with temporary account number first to get the auto-incremented id
  const insert = db.prepare(`
    INSERT INTO accounts (account_number, name, phone, pin, balance)
    VALUES (?, ?, ?, ?, 10.0)
  `);

  const result = insert.run("TEMP", name, phone, pin);
  const newId = result.lastInsertRowid;

  const accountNumber = generateAccountNumber(newId);

  db.prepare("UPDATE accounts SET account_number = ? WHERE id = ?").run(
    accountNumber,
    newId,
  );

  return findById(newId);
}

function updatePin(phone, newPin) {
  db.prepare("UPDATE accounts SET pin = ? WHERE phone = ?").run(newPin, phone);
}

function updateName(phone, newName) {
  db.prepare("UPDATE accounts SET name = ? WHERE phone = ?").run(
    newName,
    phone,
  );
}

function deleteAccount(phone) {
  db.prepare("DELETE FROM accounts WHERE phone = ?").run(phone);
}

function updateBalance(phone, newBalance) {
  db.prepare("UPDATE accounts SET balance = ? WHERE phone = ?").run(
    newBalance,
    phone,
  );
}

// Atomic transfer using a SQLite transaction
// Both balance updates happen together or not at all
function transferBetween(senderPhone, recipientPhone, amount) {
  const transfer = db.transaction(() => {
    const sender = findByPhone(senderPhone);
    const recipient = findByPhone(recipientPhone);

    if (!sender) throw new Error("Sender account not found.");
    if (!recipient) throw new Error("Recipient account not found.");
    if (amount > sender.balance) throw new Error("Insufficient balance.");

    db.prepare("UPDATE accounts SET balance = balance - ? WHERE phone = ?").run(
      amount,
      senderPhone,
    );
    db.prepare("UPDATE accounts SET balance = balance + ? WHERE phone = ?").run(
      amount,
      recipientPhone,
    );

    return findByPhone(senderPhone);
  });

  return transfer(); // throws automatically on failure, rolls back both updates
}

module.exports = {
  findByPhone,
  createAccount,
  updatePin,
  updateName,
  deleteAccount,
  updateBalance,
  transferBetween,
};
