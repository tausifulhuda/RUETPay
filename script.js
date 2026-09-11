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

function getAccounts() {
  const raw = localStorage.getItem("ruetpayAccounts");
  return raw ? JSON.parse(raw) : [];
}

function saveAccounts(accounts) {
  localStorage.setItem("ruetpayAccounts", JSON.stringify(accounts));
}

function findAccount(phone) {
  return getAccounts().find(account => account.phone === phone) || null;
}

function saveAccount(account) {
  const accounts = getAccounts();
  const index = accounts.findIndex(item => item.phone === account.phone);

  if (index === -1) {
    accounts.push(account);
  } else {
    accounts[index] = account;
  }

  saveAccounts(accounts);
}

function setCurrentUser(phone) {
  if (phone) {
    localStorage.setItem("ruetpayCurrentUser", phone);
  } else {
    localStorage.removeItem("ruetpayCurrentUser");
  }
}

function getCurrentUser() {
  const phone = localStorage.getItem("ruetpayCurrentUser");
  return phone ? findAccount(phone) : null;
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

switchAuth.addEventListener("click", () => {
  state.mode = state.mode === "login" ? "register" : "login";
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

  document.getElementById("nameGroup").classList.toggle(
    "hidden", !registering
  );

  document.getElementById("confirmPinGroup").classList.toggle(
    "hidden", !registering
  );

  authMessage.textContent = "";
  authForm.reset();
});

authForm.addEventListener("submit", event => {
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

    // A mobile number can belong to only one account.
    if (findAccount(phone)) {
      authMessage.textContent =
        "An account with this mobile number already exists. Please login.";
      return;
    }

    // Every newly registered account receives Tk 10.
    const newAccount = {
      name: name,
      phone: phone,
      pin: pin,
      balance: 10
    };

    saveAccount(newAccount);

    state.user = newAccount;
    setCurrentUser(phone);

    showToast("Account created with ৳10.00");

    setTimeout(openDashboard, 350);
    return;
  }

  /* ---------- LOGIN ---------- */
  // IMPORTANT: do not create an account during login.
  const account = findAccount(phone);

  if (!account) {
    authMessage.textContent =
      "No account found. Please register before logging in.";
    return;
  }

  if (account.pin !== pin) {
    authMessage.textContent = "Incorrect PIN. Please try again.";
    return;
  }

  state.user = account;
  setCurrentUser(account.phone);

  showToast("Login successful!");
  setTimeout(openDashboard, 350);
});

/* ===================== DASHBOARD ===================== */

document.getElementById("toggleBalance").addEventListener("click", () => {
  state.balanceVisible = !state.balanceVisible;
  updateBalance();
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  state.user = null;
  setCurrentUser(null);
  showPage(authPage);
  showToast("Logged out successfully.");
});

document.querySelectorAll(".service-card").forEach(card => {
  card.addEventListener("click", () => openService(card.dataset.service));
});

document.getElementById("backBtn").addEventListener("click", openDashboard);

/* ===================== SERVICES ===================== */

const activeServices = ["send", "cashin", "cashout", "merchantPay", "transferMoney", "payFees"];

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

function handleSendMoney(event) {
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

  // Recipient must already be registered.
  const recipient = findAccount(recipientPhone);

  if (!recipient) {
    message.textContent =
      "Recipient account not found. Money can only be sent to a registered account.";
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

  // Atomic-looking frontend simulation: update both account balances.
  state.user.balance = Number(state.user.balance) - amount;
  recipient.balance = Number(recipient.balance) + amount;

  saveAccount(state.user);
  saveAccount(recipient);

  // Refresh sender from storage so the current account is synchronized.
  state.user = findAccount(state.user.phone);

  updateBalance();

  showToast(`৳${money(amount)} sent successfully to ${recipient.phone}`);
  setTimeout(openDashboard, 650);
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

function handleTransferMoney(event) {
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

  // Atomic-looking frontend simulation: update both account balances.
  state.user.balance = Number(state.user.balance) - amount;

  saveAccount(state.user);

  // Refresh sender from storage so the current account is synchronized.
  state.user = findAccount(state.user.phone);

  updateBalance();

  showToast(`৳${money(amount)} transferred successfully to ${acNumber}`);
  setTimeout(openDashboard, 650);
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

function handlePayFees(event) {
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

  // Atomic-looking frontend simulation: update both account balances.
  state.user.balance = Number(state.user.balance) - amount;

  saveAccount(state.user);

  // Refresh sender from storage so the current account is synchronized.
  state.user = findAccount(state.user.phone);

  updateBalance();

  showToast(`৳${money(amount)} paid successfully to ${acNumber}`);
  setTimeout(openDashboard, 650);
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

function handleMerchantPay(event) {
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

  // Recipient must already be registered.
  const recipient = findAccount(recipientPhone);

  if (!recipient) {
    message.textContent =
      "Merchant account not found. Money can only be sent to a registered account.";
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

  // Atomic-looking frontend simulation: update both account balances.
  state.user.balance = Number(state.user.balance) - amount;
  recipient.balance = Number(recipient.balance) + amount;

  saveAccount(state.user);
  saveAccount(recipient);

  // Refresh sender from storage so the current account is synchronized.
  state.user = findAccount(state.user.phone);

  updateBalance();

  showToast(`৳${money(amount)} paid successfully to ${recipient.phone}`);
  setTimeout(openDashboard, 650);
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

function handleCashIn(event) {
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

  // Cash In changes only the currently logged-in account.
  state.user.balance = Number(state.user.balance) + amount;

  if (Number(state.user.balance) > 1_000_000){
    message.textContent = "Maximum balance reached. Can't cash in.";
    state.user.balance = Number(state.user.balance) - amount;
    return;
  }

  saveAccount(state.user);

  state.user = findAccount(state.user.phone);
  updateBalance();

  showToast(`৳${money(amount)} added to your wallet.`);
  setTimeout(openDashboard, 650);
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

function handleCashOut(event) {
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

  state.user.balance = Number(state.user.balance) - amount;
  saveAccount(state.user);

  state.user = findAccount(state.user.phone);
  updateBalance();

  showToast(`৳${money(amount)} cashed out successfully.`);
  setTimeout(openDashboard, 650);
}

/* ===================== SESSION RESTORE ===================== */

function restoreSession() {
  const account = getCurrentUser();

  if (!account) return;

  state.user = account;
  openDashboard();
}

restoreSession();
