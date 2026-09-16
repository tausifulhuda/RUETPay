// server/server.js
const express = require("express");
const cors    = require("cors");
const path    = require("path");
const db      = require("./db");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  next();
});

// Serve index.html, style.css, script.js from the project root
app.use(express.static(path.join(__dirname, "..")));

/* ════════════════════════════════════════
   REGISTER
   POST /api/accounts
════════════════════════════════════════ */
app.post("/api/accounts", (req, res) => {
  const { name, phone, pin } = req.body;

  if (!name || !phone || !pin) {
    return res.status(400).json({ error: "Name, phone and PIN are required." });
  }

  if (!/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: "PIN must be exactly 4 digits." });
  }

  if (db.findByPhone(phone)) {
    return res.status(409).json({ error: "An account with this number already exists." });
  }

  try {
    const account = db.createAccount({ name, phone, pin });
    res.json({ success: true, account });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed." });
  }
});

/* ════════════════════════════════════════
   LOGIN
   POST /api/login
════════════════════════════════════════ */
app.post("/api/login", (req, res) => {
  const { phone, pin } = req.body;

  if (!phone || !pin) {
    return res.status(400).json({ error: "Phone and PIN are required." });
  }

  const account = db.findByPhone(phone);

  if (!account) {
    return res.status(404).json({ error: "No account found. Please register first." });
  }

  if (account.pin !== pin) {
    return res.status(401).json({ error: "Incorrect PIN. Please try again." });
  }

  res.json({ success: true, account });
});

/* ════════════════════════════════════════
   GET ACCOUNT
   GET /api/accounts/:phone
════════════════════════════════════════ */
app.get("/api/accounts/:phone", (req, res) => {
  const account = db.findByPhone(req.params.phone);

  if (!account) {
    return res.status(404).json({ error: "Account not found." });
  }

  res.json(account);
});

/* ════════════════════════════════════════
   CHANGE PIN
   PUT /api/accounts/:phone/pin
════════════════════════════════════════ */
app.put("/api/accounts/:phone/pin", (req, res) => {
  const { currentPin, newPin } = req.body;

  if (!/^\d{4}$/.test(newPin)) {
    return res.status(400).json({ error: "New PIN must be exactly 4 digits." });
  }

  const account = db.findByPhone(req.params.phone);

  if (!account) {
    return res.status(404).json({ error: "Account not found." });
  }

  if (account.pin !== currentPin) {
    return res.status(401).json({ error: "Current PIN is incorrect." });
  }

  try {
    db.updatePin(req.params.phone, newPin);
    res.json({ success: true, message: "PIN updated successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update PIN." });
  }
});

/* ════════════════════════════════════════
   EDIT NAME
   PUT /api/accounts/:phone
════════════════════════════════════════ */
app.put("/api/accounts/:phone", (req, res) => {
  const { name, currentPin } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Name is required." });
  }

  const account = db.findByPhone(req.params.phone);

  if (!account) {
    return res.status(404).json({ error: "Account not found." });
  }

  if (account.pin !== currentPin) {
    return res.status(401).json({ error: "Incorrect PIN." });
  }

  try {
    db.updateName(req.params.phone, name);
    const updated = db.findByPhone(req.params.phone);
    res.json({ success: true, account: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update name." });
  }
});

/* ════════════════════════════════════════
   DELETE ACCOUNT
   DELETE /api/accounts/:phone
════════════════════════════════════════ */
app.delete("/api/accounts/:phone", (req, res) => {
  const { pin } = req.body;

  const account = db.findByPhone(req.params.phone);

  if (!account) {
    return res.status(404).json({ error: "Account not found." });
  }

  if (account.pin !== pin) {
    return res.status(401).json({ error: "Incorrect PIN." });
  }

  try {
    db.deleteAccount(req.params.phone);
    res.json({ success: true, message: "Account deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete account." });
  }
});

/* ════════════════════════════════════════
   CASH IN
   POST /api/cashin
════════════════════════════════════════ */
app.post("/api/cashin", (req, res) => {
  const { phone, amount } = req.body;
  const amt = Number(amount);

  if (!amt || amt <= 0 || amt > 25000) {
    return res.status(400).json({ error: "Invalid amount. Max ৳25,000 per transaction." });
  }

  const account = db.findByPhone(phone);
  if (!account) return res.status(404).json({ error: "Account not found." });

  const newBalance = Number(account.balance) + amt;

  if (newBalance > 1_000_000) {
    return res.status(400).json({ error: "Maximum balance limit of ৳10,00,000 reached." });
  }

  try {
    db.updateBalance(phone, newBalance);
    res.json({ success: true, balance: newBalance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Cash In failed." });
  }
});

/* ════════════════════════════════════════
   CASH OUT
   POST /api/cashout
════════════════════════════════════════ */
app.post("/api/cashout", (req, res) => {
  const { phone, amount } = req.body;
  const amt = Number(amount);

  const account = db.findByPhone(phone);
  if (!account) return res.status(404).json({ error: "Account not found." });

  if (!amt || amt <= 0 || amt > 25000) {
    return res.status(400).json({ error: "Invalid amount. Max ৳25,000 per transaction." });
  }

  if (amt > Number(account.balance)) {
    return res.status(400).json({ error: "Insufficient balance." });
  }

  try {
    const newBalance = Number(account.balance) - amt;
    db.updateBalance(phone, newBalance);
    res.json({ success: true, balance: newBalance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Cash Out failed." });
  }
});

/* ════════════════════════════════════════
   SEND MONEY
   POST /api/send
════════════════════════════════════════ */
app.post("/api/send", (req, res) => {
  const { senderPhone, recipientPhone, amount } = req.body;
  const amt = Number(amount);

  if (senderPhone === recipientPhone) {
    return res.status(400).json({ error: "Cannot send money to your own account." });
  }

  if (!amt || amt <= 0 || amt > 25000) {
    return res.status(400).json({ error: "Invalid amount. Max ৳25,000 per transaction." });
  }

  try {
    const updatedSender = db.transferBetween(senderPhone, recipientPhone, amt);
    res.json({ success: true, balance: updatedSender.balance });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ════════════════════════════════════════
   MERCHANT PAY
   POST /api/merchant-pay
════════════════════════════════════════ */
app.post("/api/merchant-pay", (req, res) => {
  const { senderPhone, merchantPhone, amount } = req.body;
  const amt = Number(amount);

  if (senderPhone === merchantPhone) {
    return res.status(400).json({ error: "Cannot pay your own account." });
  }

  if (!amt || amt <= 0 || amt > 25000) {
    return res.status(400).json({ error: "Invalid amount. Max ৳25,000 per transaction." });
  }

  try {
    const updatedSender = db.transferBetween(senderPhone, merchantPhone, amt);
    res.json({ success: true, balance: updatedSender.balance });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ════════════════════════════════════════
   TRANSFER / PAY FEES (bank account)
   POST /api/transfer
════════════════════════════════════════ */
app.post("/api/transfer", (req, res) => {
  const { phone, amount, type } = req.body;
  const amt    = Number(amount);
  const limit  = type === "TRANSFER" ? 50000 : 25000;

  if (!amt || amt <= 0 || amt > limit) {
    return res.status(400).json({ error: `Invalid amount. Max ৳${limit.toLocaleString()}.` });
  }

  const account = db.findByPhone(phone);
  if (!account) return res.status(404).json({ error: "Account not found." });

  if (amt > Number(account.balance)) {
    return res.status(400).json({ error: "Insufficient balance." });
  }

  try {
    const newBalance = Number(account.balance) - amt;
    db.updateBalance(phone, newBalance);
    res.json({ success: true, balance: newBalance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Transfer failed." });
  }
});

/* ════════════════════════════════════════
   START
════════════════════════════════════════ */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`RUETPay server running at http://localhost:${PORT}`);
});