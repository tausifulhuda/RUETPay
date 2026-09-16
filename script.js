/*
 * RUETPay frontend demo.
 *
 * The localStorage data layer below is only a temporary frontend substitute.
 * When the backend/database is ready, your partners can replace these
 * functions with API requests.
 *
 * Rules implemented:
 * - Only registered users can log in.
 * - Every registered account has its own balance.
 * - New accounts start with exactly Tk 10.
 * - Send Money works only for an existing registered recipient.
 * - Successful Send Money deducts the sender and credits the recipient.
 * - Cash In adds money only to the currently logged-in account.
 * - Other services show "Service Not Available Yet".
 */

const state = {
  mode: "login",
  balanceVisible: true,
  user: null
};

/* ===================== DATA LAYER ===================== */

const API = "http://localhost:5000/api";

function setCurrentUser(phone) {
  if (phone) {
    localStorage.setItem("ruetpayCurrentUser", phone);
  } else {
    localStorage.removeItem("ruetpayCurrentUser");
  }
}

function getCurrentUserPhone() {
  return localStorage.getItem("ruetpayCurrentUser") || null;
}

async function apiFetch(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  return res;
}

/* ===================== UI ===================== */

const authPage = document.getElementById("authPage");
const dashboardPage = document.getElementById("dashboardPage");
const servicePage = document.getElementById("servicePage");
const authForm = document.getElementById("authForm");
const switchAuth = document.getElementById("switchAuth");
const authMessage = document.getElementById("authMessage");
const serviceContent = document.getElementById("serviceContent");

function money(value) {
  return Number(value).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function showPage(page) {
  if (page === authPage) {
    setAuthMode("login");
  }

  [authPage, dashboardPage, servicePage].forEach(item => {
    item.classList.add("hidden");
  });

  page.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateBalance() {
  if (!state.user) return;

  document.getElementById("balanceValue").textContent =
    state.balanceVisible ? money(state.user.balance) : "••••••";

  document.getElementById("toggleBalance").textContent =
    state.balanceVisible ? "◉" : "○";
}

function openDashboard() {
  if (!state.user) {
    showPage(authPage);
    return;
  }

  document.getElementById("userName").textContent =
    state.user.name.split(" ")[0];

  document.getElementById("walletNumber").textContent =
    state.user.phone;

  updateBalance();
  showPage(dashboardPage);
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

/* ===================== LOGIN / REGISTER ===================== */

function setAuthMode(mode) {
  state.mode = mode;
  const registering = state.mode === "register";

  document.getElementById("authTitle").textContent =
    registering ? "Create your wallet" : "Welcome back";

  document.getElementById("authSubtitle").textContent = registering
    ? "Register a new RUETPay account to get started."
    : "Login to manage your RUETPay account.";

  document.getElementById("authButtonText").textContent =
    registering ? "Register" : "Login";

  document.getElementById("switchText").textContent = registering
    ? "Already have an account?"
    : "Don't have an account?";

  switchAuth.textContent = registering ? "Login" : "Register";

  const nameGroup = document.getElementById("nameGroup");
  const confirmPinGroup = document.getElementById("confirmPinGroup");

  if (registering) {
    nameGroup.classList.remove("hidden");
    confirmPinGroup.classList.remove("hidden");
  } else {
    nameGroup.classList.add("hidden");
    confirmPinGroup.classList.add("hidden");
  }

  authMessage.textContent = "";
  authForm.reset();
}

switchAuth.addEventListener("click", () => {
  setAuthMode(state.mode === "login" ? "register" : "login");
});

authForm.addEventListener("submit", async event => {
  event.preventDefault();

  const phone = document.getElementById("phone").value.trim();
  const pin = document.getElementById("pin").value.trim();

  authMessage.textContent = "";

  if (!phone) {
    authMessage.textContent = "Please enter your mobile number.";
    return;
  }

  if (!/^\d{4}$/.test(pin)) {
    authMessage.textContent = "PIN must contain 4 digits.";
    return;
  }

  /* ---------- REGISTER ---------- */
  if (state.mode === "register") {
    const name = document.getElementById("name").value.trim();
    const confirmPin = document.getElementById("confirmPin").value.trim();

    if (!name) {
      authMessage.textContent = "Please enter your full name.";
      return;
    }

    if (pin !== confirmPin) {
      authMessage.textContent = "PINs do not match.";
      return;
    }

    try {
      const res = await apiFetch("/accounts", {
        method: "POST",
        body: JSON.stringify({ name, phone, pin })
      });
      const data = await res.json();

      if (!res.ok) {
        authMessage.textContent = data.error || "Registration failed.";
        return;
      }

      state.user = data.account;
      setCurrentUser(phone);
      setAuthMode("login");
      showToast("Account created with ৳10.00");
      openDashboard();
    } catch (err) {
      authMessage.textContent = "Failed to connect to server.";
    }
    return;
  }

  /* ---------- LOGIN ---------- */
  try {
    const res = await apiFetch("/login", {
      method: "POST",
      body: JSON.stringify({ phone, pin })
    });
    const data = await res.json();

    if (!res.ok) {
      authMessage.textContent = data.error || "Login failed.";
      return;
    }

    state.user = data.account;
    setCurrentUser(phone);
    showToast("Login successful!");
    openDashboard();
  } catch (err) {
    authMessage.textContent = "Failed to connect to server.";
  }
});

/* ===================== DASHBOARD ===================== */

document.getElementById("toggleBalance").addEventListener("click", () => {
  state.balanceVisible = !state.balanceVisible;
  updateBalance();
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  state.user = null;
  setCurrentUser(null);
  setAuthMode("login");
  showPage(authPage);
  showToast("Logged out successfully.");
});

document.querySelectorAll(".service-card").forEach(card => {
  card.addEventListener("click", () => openService(card.dataset.service));
});

document.getElementById("backBtn").addEventListener("click", openDashboard);

/* ===================== SERVICES ===================== */

const activeServices = ["send", "cashin", "cashout", "merchantPay", "transferMoney", "payFees", "account"];

function openService(key) {
  if (!state.user) {
    showPage(authPage);
    return;
  }

  if (!activeServices.includes(key)) {
    serviceContent.innerHTML = `
      <div class="unavailable glass-card">
        <div class="big-service-icon">✦</div>
        <span class="eyebrow">COMING SOON</span>
        <h2>Service Not Available Yet</h2>
        <p>
          This RUETPay service is currently under development.
          Please check back later.
        </p>
        <button class="primary-btn" onclick="openDashboard()">
          ← Back to Dashboard
        </button>
      </div>
    `;

    showPage(servicePage);
    return;
  }

  if (key === "send") renderSendMoney();
  if (key === "cashin") renderCashIn();
  if (key === "cashout") renderCashOut();
  if (key === "merchantPay") renderMerchantPay();
  if (key === "transferMoney") renderTransferMoney();
  if (key === "payFees") renderPayFees();
  if (key === "account") renderAccount();

  showPage(servicePage);
}

/* ===================== SEND MONEY ===================== */

function renderSendMoney() {
  serviceContent.innerHTML = `
    <div class="service-heading">
      <div class="big-service-icon">↗</div>
      <span class="eyebrow">RUETPay SERVICE</span>
      <h2>Send Money</h2>
      <p>
        Send money to another RUETPay account.
      </p>
    </div>

    <div class="form-card glass-card">
      <div class="mini-balance">
        <span>Available Balance</span>
        <strong>৳ ${money(state.user.balance)}</strong>
      </div>

      <form id="sendMoneyForm">
        <div class="field">
          <label for="recipient">Recipient Mobile Number</label>
          <input id="recipient" type="tel" inputmode="numeric"
                 placeholder="01XXXXXXXXX" required>
        </div>

        <div class="field">
          <label for="sendAmount">Amount (৳)</label>
          <input id="sendAmount" type="number" min="1" step="0.01"
                 placeholder="Enter amount" required>
        </div>

        <div class="field">
          <label for="sendNote">Note (Optional)</label>
          <input id="sendNote" type="text" placeholder="What is this for?">
        </div>

        <button class="primary-btn full" type="submit">
          Send Money <span>→</span>
        </button>
      </form>

      <p id="transactionMessage" class="form-message"></p>
    </div>
  `;

  document.getElementById("sendMoneyForm")
    .addEventListener("submit", handleSendMoney);
}

async function handleSendMoney(event) {
  event.preventDefault();

  const recipientPhone = document.getElementById("recipient").value.trim();
  const amount = Number(document.getElementById("sendAmount").value);
  const message = document.getElementById("transactionMessage");

  message.textContent = "";

  if (!recipientPhone) {
    message.textContent = "Enter the recipient's mobile number.";
    return;
  }

  if (!amount || amount <= 0) {
    message.textContent = "Enter a valid amount.";
    return;
  }

  if (recipientPhone === state.user.phone) {
    message.textContent = "You cannot send money to your own account.";
    return;
  }

  if (amount > Number(state.user.balance)) {
    message.textContent = "Insufficient balance.";
    return;
  }

  if (amount > 25_000){
    message.textContent = "Can't send more than ৳25,000 at a time.";
    return;
  }

  try {
    const res = await apiFetch("/send", {
      method: "POST",
      body: JSON.stringify({
        senderPhone: state.user.phone,
        recipientPhone,
        amount
      })
    });
    const data = await res.json();

    if (!res.ok) {
      message.textContent = data.error || "Send money failed.";
      return;
    }

    state.user.balance = data.balance;
    updateBalance();
    showToast(`৳${money(amount)} sent successfully to ${recipientPhone}`);
    setTimeout(openDashboard, 650);
  } catch (err) {
    message.textContent = "Failed to connect to server.";
  }
}

/* ===================== TRANSFER MONEY ====================*/

function renderTransferMoney() {
  serviceContent.innerHTML = `
    <div class="service-heading">
      <div class="big-service-icon">⇄</div>
      <span class="eyebrow">RUETPay SERVICE</span>
      <h2>Transfer Money</h2>
      <p>
        Transfer money to a bank account.
      </p>
    </div>

    <div class="form-card glass-card">
      <div class="mini-balance">
        <span>Available Balance</span>
        <strong>৳ ${money(state.user.balance)}</strong>
      </div>

      <form id="transferMoneyForm">
        <div class="field">
          <label for="recipient">Bank Account Number (Minimum 10 digit)</label>
          <input id="recipient" type="tel" inputmode="numeric" minlength="10" pattern="[0-9]+"
                 placeholder="XXXXXXXXXX" required>
        </div>

        <div class="field">
          <label for="sendAmount">Amount (৳)</label>
          <input id="sendAmount" type="text" min="1" step="0.01"
                 placeholder="Enter amount" required>
        </div>

        <div class="field">
          <label for="sendNote">Note (Optional)</label>
          <input id="sendNote" type="text" placeholder="What is this for?">
        </div>

        <button class="primary-btn full" type="submit">
          Transfer Money <span>→</span>
        </button>
      </form>

      <p id="transactionMessage" class="form-message"></p>
    </div>
  `;

  document.getElementById("transferMoneyForm")
    .addEventListener("submit", handleTransferMoney);
}

async function handleTransferMoney(event) {
  event.preventDefault();

  const acNumber = document.getElementById("recipient").value.trim();
  const amount = Number(document.getElementById("sendAmount").value);
  const message = document.getElementById("transactionMessage");

  message.textContent = "";

  if (!acNumber) {
    message.textContent = "Enter the bank account number.";
    return;
  }

  if (!amount || amount <= 0) {
    message.textContent = "Enter a valid amount.";
    return;
  }

  if (amount > Number(state.user.balance)) {
    message.textContent = "Insufficient balance.";
    return;
  }

  if (amount > 50_000){
    message.textContent = "Can't transfer more than ৳50,000 at a time.";
    return;
  }

  try {
    const res = await apiFetch("/transfer", {
      method: "POST",
      body: JSON.stringify({
        phone: state.user.phone,
        accountNumber: acNumber,
        amount,
        type: "TRANSFER"
      })
    });
    const data = await res.json();

    if (!res.ok) {
      message.textContent = data.error || "Transfer failed.";
      return;
    }

    state.user.balance = data.balance;
    updateBalance();
    showToast(`৳${money(amount)} transferred successfully to ${acNumber}`);
    setTimeout(openDashboard, 650);
  } catch (err) {
    message.textContent = "Failed to connect to server.";
  }
}

/* ===================== PAY FEES ====================*/

function renderPayFees() {
  serviceContent.innerHTML = `
    <div class="service-heading">
      <div class="big-service-icon">◫</div>
      <span class="eyebrow">RUETPay SERVICE</span>
      <h2>Pay Fees</h2>
      <p>
        Pay educational fees to institution bank account.
      </p>
    </div>

    <div class="form-card glass-card">
      <div class="mini-balance">
        <span>Available Balance</span>
        <strong>৳ ${money(state.user.balance)}</strong>
      </div>

      <form id="payFeesForm">
        <div class="field">
          <label for="recipient">Bank Account Number (Minimum 10 digit)</label>
          <input id="recipient" type="tel" inputmode="numeric" minlength="10" pattern="[0-9]+"
                 placeholder="XXXXXXXXXX" required>
        </div>

        <div class="field">
          <label for="sendAmount">Amount (৳)</label>
          <input id="sendAmount" type="text" min="1" step="0.01"
                 placeholder="Enter amount" required>
        </div>

        <div class="field">
          <label for="sendNote">Note (Optional)</label>
          <input id="sendNote" type="text" placeholder="What is this for?">
        </div>

        <button class="primary-btn full" type="submit">
          Pay Money <span>→</span>
        </button>
      </form>

      <p id="transactionMessage" class="form-message"></p>
    </div>
  `;

  document.getElementById("payFeesForm")
    .addEventListener("submit", handlePayFees);
}

async function handlePayFees(event) {
  event.preventDefault();

  const acNumber = document.getElementById("recipient").value.trim();
  const amount = Number(document.getElementById("sendAmount").value);
  const message = document.getElementById("transactionMessage");

  message.textContent = "";

  if (!acNumber) {
    message.textContent = "Enter the bank account number.";
    return;
  }

  if (!amount || amount <= 0) {
    message.textContent = "Enter a valid amount.";
    return;
  }

  if (amount > Number(state.user.balance)) {
    message.textContent = "Insufficient balance.";
    return;
  }

  if (amount > 25_000){
    message.textContent = "Can't pay more than ৳25,000 at a time.";
    return;
  }

  try {
    const res = await apiFetch("/transfer", {
      method: "POST",
      body: JSON.stringify({
        phone: state.user.phone,
        accountNumber: acNumber,
        amount,
        type: "PAY_FEES"
      })
    });
    const data = await res.json();

    if (!res.ok) {
      message.textContent = data.error || "Payment failed.";
      return;
    }

    state.user.balance = data.balance;
    updateBalance();
    showToast(`৳${money(amount)} paid successfully to ${acNumber}`);
    setTimeout(openDashboard, 650);
  } catch (err) {
    message.textContent = "Failed to connect to server.";
  }
}

/* ===================== MERCHANT PAY ==================== */

function renderMerchantPay() {
  serviceContent.innerHTML = `
    <div class="service-heading">
      <div class="big-service-icon">▣</div>
      <span class="eyebrow">RUETPay SERVICE</span>
      <h2>Merchant Pay</h2>
      <p>
        Pay to a registered RUETPay merchant account.
      </p>
    </div>

    <div class="form-card glass-card">
      <div class="mini-balance">
        <span>Available Balance</span>
        <strong>৳ ${money(state.user.balance)}</strong>
      </div>

      <form id="merchantPayForm">
        <div class="field">
          <label for="recipient">Merchant Account Number</label>
          <input id="recipient" type="tel" inputmode="numeric"
                 placeholder="01XXXXXXXXX" required>
        </div>

        <div class="field">
          <label for="sendAmount">Amount (৳)</label>
          <input id="sendAmount" type="number" min="1" step="0.01"
                 placeholder="Enter amount" required>
        </div>

        <div class="field">
          <label for="sendNote">Note (Optional)</label>
          <input id="sendNote" type="text" placeholder="What is this for?">
        </div>

        <button class="primary-btn full" type="submit">
          Pay Money <span>→</span>
        </button>
      </form>

      <p id="transactionMessage" class="form-message"></p>
    </div>
  `;

  document.getElementById("merchantPayForm")
    .addEventListener("submit", handleMerchantPay);
}

async function handleMerchantPay(event) {
  event.preventDefault();

  const recipientPhone = document.getElementById("recipient").value.trim();
  const amount = Number(document.getElementById("sendAmount").value);
  const message = document.getElementById("transactionMessage");

  message.textContent = "";

  if (!recipientPhone) {
    message.textContent = "Enter the merchant's mobile number.";
    return;
  }

  if (!amount || amount <= 0) {
    message.textContent = "Enter a valid amount.";
    return;
  }

  if (recipientPhone === state.user.phone) {
    message.textContent = "You cannot pay to your own account.";
    return;
  }

  if (amount > Number(state.user.balance)) {
    message.textContent = "Insufficient balance.";
    return;
  }

  if (amount > 25_000){
    message.textContent = "Can't pay more than ৳25,000 at a time.";
    return;
  }

  try {
    const res = await apiFetch("/merchant-pay", {
      method: "POST",
      body: JSON.stringify({
        senderPhone: state.user.phone,
        merchantPhone: recipientPhone,
        amount
      })
    });
    const data = await res.json();

    if (!res.ok) {
      message.textContent = data.error || "Merchant pay failed.";
      return;
    }

    state.user.balance = data.balance;
    updateBalance();
    showToast(`৳${money(amount)} paid successfully to ${recipientPhone}`);
    setTimeout(openDashboard, 650);
  } catch (err) {
    message.textContent = "Failed to connect to server.";
  }
}

/* ===================== CASH IN ===================== */

function renderCashIn() {
  serviceContent.innerHTML = `
    <div class="service-heading">
      <div class="big-service-icon">↓</div>
      <span class="eyebrow">RUETPay SERVICE</span>
      <h2>Cash In</h2>
      <p>
        Add money to your RUETPay account.
      </p>
    </div>

    <div class="form-card glass-card">
      <div class="mini-balance">
        <span>Your Current Balance</span>
        <strong>৳ ${money(state.user.balance)}</strong>
      </div>

      <form id="cashInForm">
        <div class="field">
          <label for="cashInAmount">Amount (৳)</label>
          <input id="cashInAmount" type="number" min="1" step="0.01"
                 placeholder="Enter amount" required>
        </div>

        <button class="primary-btn full" type="submit">
          Cash In <span>→</span>
        </button>
      </form>

      <p id="transactionMessage" class="form-message"></p>
    </div>
  `;

  document.getElementById("cashInForm")
    .addEventListener("submit", handleCashIn);
}

async function handleCashIn(event) {
  event.preventDefault();

  const amount = Number(document.getElementById("cashInAmount").value);
  const message = document.getElementById("transactionMessage");

  message.textContent = "";

  if (!amount || amount <= 0) {
    message.textContent = "Enter a valid amount.";
    return;
  }

  if (amount > 25_000){
    message.textContent = "Can't cash in more than ৳25,000 at a time.";
    return;
  }

  if (Number(state.user.balance) + amount > 1_000_000){
    message.textContent = "Maximum balance reached. Can't cash in.";
    return;
  }

  try {
    const res = await apiFetch("/cashin", {
      method: "POST",
      body: JSON.stringify({ phone: state.user.phone, amount })
    });
    const data = await res.json();

    if (!res.ok) {
      message.textContent = data.error || "Cash In failed.";
      return;
    }

    state.user.balance = data.balance;
    updateBalance();
    showToast(`৳${money(amount)} added to your wallet.`);
    setTimeout(openDashboard, 650);
  } catch (err) {
    message.textContent = "Failed to connect to server.";
  }
}

/* ===================== CASH OUT ===================== */

function renderCashOut() {
  serviceContent.innerHTML = `
    <div class="service-heading">
      <div class="big-service-icon">↑</div>
      <span class="eyebrow">RUETPay SERVICE</span>
      <h2>Cash Out</h2>
      <p>
        Withdraw money from your RUETPay account.
      </p>
    </div>

    <div class="form-card glass-card">
      <div class="mini-balance">
        <span>Your Current Balance</span>
        <strong>৳ ${money(state.user.balance)}</strong>
      </div>

      <form id="cashOutForm">
        <div class="field">
          <label for="cashOutAmount">Amount (৳)</label>
          <input id="cashOutAmount" type="number" min="1" step="0.01"
                 placeholder="Enter amount" required>
        </div>

        <button class="primary-btn full" type="submit">
          Cash Out <span>→</span>
        </button>
      </form>

      <p id="transactionMessage" class="form-message"></p>
    </div>
  `;

  document.getElementById("cashOutForm")
    .addEventListener("submit", handleCashOut);
}

async function handleCashOut(event) {
  event.preventDefault();

  const amount = Number(document.getElementById("cashOutAmount").value);
  const message = document.getElementById("transactionMessage");

  message.textContent = "";

  if (!amount || amount <= 0) {
    message.textContent = "Enter a valid amount.";
    return;
  }

  if (amount > Number(state.user.balance)) {
    message.textContent = "Insufficient balance.";
    return;
  }

  if (amount > 25_000){
    message.textContent = "Can't cash out more than ৳25,000 at a time.";
    return;
  }

  try {
    const res = await apiFetch("/cashout", {
      method: "POST",
      body: JSON.stringify({ phone: state.user.phone, amount })
    });
    const data = await res.json();

    if (!res.ok) {
      message.textContent = data.error || "Cash Out failed.";
      return;
    }

    state.user.balance = data.balance;
    updateBalance();
    showToast(`৳${money(amount)} cashed out successfully.`);
    setTimeout(openDashboard, 650);
  } catch (err) {
    message.textContent = "Failed to connect to server.";
  }
}

/* ===================== ACCOUNT ===================== */

function renderAccount() {
  serviceContent.innerHTML = `
    <div class="service-heading">
      <div class="big-service-icon">🖊</div>
      <span class="eyebrow">RUETPay SERVICE</span>
      <h2>Account</h2>
      <p>
        View and manage your account details and security.
      </p>
    </div>

    <div class="form-card glass-card">
      <div class="mini-balance" style="margin-bottom: 8px;">
        <span>Account Number</span>
        <strong>${state.user.account_number || ""}</strong>
      </div>
      <div class="mini-balance" style="margin-bottom: 8px;">
        <span>Full Name</span>
        <strong id="displayName">${state.user.name}</strong>
      </div>
      <div class="mini-balance" style="margin-bottom: 8px;">
        <span>Mobile Number</span>
        <strong>${state.user.phone}</strong>
      </div>
      <div class="mini-balance" style="margin-bottom: 24px;">
        <span>Available Balance</span>
        <strong>৳ ${money(state.user.balance)}</strong>
      </div>

      <form id="editNameForm">
        <span class="eyebrow">EDIT NAME</span>
        <div class="field" style="margin-top: 10px;">
          <label for="accountName">Full Name</label>
          <input id="accountName" type="text" value="${state.user.name}" placeholder="Enter full name" required>
        </div>

        <div class="field">
          <label for="editNamePin">Current PIN</label>
          <input id="editNamePin" type="password" inputmode="numeric" maxlength="4" placeholder="Enter 4-digit PIN" required>
        </div>

        <button class="primary-btn full" type="submit">
          Save Name <span>→</span>
        </button>
        <p id="editNameMessage" class="form-message"></p>
      </form>

      <form id="changePinForm" style="margin-top: 20px;">
        <span class="eyebrow">SECURITY</span>
        <div class="field" style="margin-top: 10px;">
          <label for="currentPin">Current PIN</label>
          <input id="currentPin" type="password" inputmode="numeric" maxlength="4" placeholder="Enter current 4-digit PIN" required>
        </div>

        <div class="field">
          <label for="newPin">New PIN</label>
          <input id="newPin" type="password" inputmode="numeric" maxlength="4" placeholder="Enter new 4-digit PIN" required>
        </div>

        <div class="field">
          <label for="confirmNewPin">Confirm New PIN</label>
          <input id="confirmNewPin" type="password" inputmode="numeric" maxlength="4" placeholder="Re-enter new 4-digit PIN" required>
        </div>

        <button class="primary-btn full" type="submit">
          Change PIN <span>→</span>
        </button>
        <p id="changePinMessage" class="form-message"></p>
      </form>

      <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid rgba(0,0,0,0.08);">
        <span class="eyebrow" style="color: #d84b56;">DANGER ZONE</span>
        <p style="font-size: 12px; color: var(--muted); margin: 6px 0 14px;">
          Once deleted, your account and all associated data cannot be recovered.
        </p>
        <button id="deleteAccountBtn" class="primary-btn full" type="button" style="background: linear-gradient(135deg, #d84b56, #b92b36); box-shadow: 0 10px 22px rgba(216,75,86,.25);">
          Delete Account <span>✕</span>
        </button>
        <p id="deleteAccountMessage" class="form-message"></p>
      </div>
    </div>
  `;

  document.getElementById("editNameForm").addEventListener("submit", async event => {
    event.preventDefault();
    const name = document.getElementById("accountName").value.trim();
    const currentPin = document.getElementById("editNamePin").value.trim();
    const message = document.getElementById("editNameMessage");
    message.textContent = "";

    if (!name) {
      message.textContent = "Please enter your full name.";
      return;
    }

    if (!/^\d{4}$/.test(currentPin)) {
      message.textContent = "PIN must contain 4 digits.";
      return;
    }

    try {
      const res = await apiFetch(`/accounts/${state.user.phone}`, {
        method: "PUT",
        body: JSON.stringify({ name, currentPin })
      });
      const data = await res.json();

      if (!res.ok) {
        message.textContent = data.error || "Failed to update name.";
        return;
      }

      state.user = data.account;
      document.getElementById("displayName").textContent = state.user.name;
      document.getElementById("userName").textContent = state.user.name.split(" ")[0];
      document.getElementById("editNamePin").value = "";
      showToast("Name updated successfully!");
    } catch (err) {
      message.textContent = "Failed to connect to server.";
    }
  });

  document.getElementById("changePinForm").addEventListener("submit", async event => {
    event.preventDefault();
    const currentPin = document.getElementById("currentPin").value.trim();
    const newPin = document.getElementById("newPin").value.trim();
    const confirmNewPin = document.getElementById("confirmNewPin").value.trim();
    const message = document.getElementById("changePinMessage");
    message.textContent = "";

    if (!/^\d{4}$/.test(currentPin)) {
      message.textContent = "Current PIN must be 4 digits.";
      return;
    }

    if (!/^\d{4}$/.test(newPin)) {
      message.textContent = "New PIN must be exactly 4 digits.";
      return;
    }

    if (newPin !== confirmNewPin) {
      message.textContent = "New PIN and Confirm PIN do not match.";
      return;
    }

    try {
      const res = await apiFetch(`/accounts/${state.user.phone}/pin`, {
        method: "PUT",
        body: JSON.stringify({ currentPin, newPin })
      });
      const data = await res.json();

      if (!res.ok) {
        message.textContent = data.error || "Failed to update PIN.";
        return;
      }

      state.user.pin = newPin;
      document.getElementById("changePinForm").reset();
      showToast(data.message || "PIN updated successfully.");
    } catch (err) {
      message.textContent = "Failed to connect to server.";
    }
  });

  document.getElementById("deleteAccountBtn").addEventListener("click", handleDeleteAccount);
}

async function handleDeleteAccount() {
  const confirmed = confirm("Are you sure you want to delete your account? This cannot be undone.");
  if (!confirmed) return;

  const pin = prompt("Enter your 4-digit PIN to confirm deletion:");
  if (pin === null) return;
  const trimmedPin = pin.trim();
  if (!trimmedPin) {
    alert("PIN is required to delete your account.");
    return;
  }

  try {
    const res = await apiFetch(`/accounts/${state.user.phone}`, {
      method: "DELETE",
      body: JSON.stringify({ pin: trimmedPin })
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Failed to delete account.");
      return;
    }

    state.user = null;
    setCurrentUser(null);
    setAuthMode("login");
    showPage(authPage);
    showToast("Account deleted successfully.");
  } catch (err) {
    alert("Failed to connect to server.");
  }
}

/* ===================== SESSION RESTORE ===================== */

async function restoreSession() {
  const phone = getCurrentUserPhone();
  if (!phone) return;

  try {
    const res = await apiFetch(`/accounts/${phone}`);
    if (!res.ok) {
      setCurrentUser(null);
      return;
    }

    const account = await res.json();
    state.user = account;
    openDashboard();
  } catch (err) {
    setCurrentUser(null);
  }
}

restoreSession();
