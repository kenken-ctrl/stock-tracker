const authBox =
  document.getElementById("authBox");

const app =
  document.getElementById("app");

const statusEl =
  document.getElementById("status");

const logoutBtn =
  document.getElementById("logoutBtn");

const refreshBtn =
  document.getElementById("refreshBtn");

const tableBody =
  document.getElementById("tableBody");

const stockSelect =
  document.getElementById("stockSelect");

const symbolInput =
  document.getElementById("symbol");

const nameInput =
  document.getElementById("name");

const quantityInput =
  document.getElementById("quantity");

const API_KEY =
  "TA_CLE_FINNHUB";

let currentUser = null;
let holdings = [];

function euro(v) {
  return new Intl.NumberFormat(
    "fr-FR",
    {
      style: "currency",
      currency: "EUR"
    }
  ).format(v);
}

function setStatus(text) {
  statusEl.textContent = text;
}

function showApp() {

  authBox.classList.add("hidden");
  app.classList.remove("hidden");

  logoutBtn.classList.remove("hidden");
  refreshBtn.classList.remove("hidden");
}

function showAuth() {

  authBox.classList.remove("hidden");
  app.classList.add("hidden");

  logoutBtn.classList.add("hidden");
  refreshBtn.classList.add("hidden");
}

async function signup() {

  const email =
    document.getElementById("email").value;

  const password =
    document.getElementById("password").value;

  const { error } =
    await supabaseClient.auth.signUp({
      email,
      password
    });

  if (error) {
    setStatus(error.message);
    return;
  }

  setStatus("Compte créé");
}

async function login() {

  const email =
    document.getElementById("email").value;

  const password =
    document.getElementById("password").value;

  const { data, error } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    setStatus(error.message);
    return;
  }

  currentUser = data.user;

  showApp();

  loadHoldings();
}

async function logout() {

  await supabaseClient.auth.signOut();

  currentUser = null;

  showAuth();
}

async function loadHoldings() {

  const { data, error } =
    await supabaseClient
      .from("holdings")
      .select("*")
      .order("created_at", {
        ascending: false
      });

  if (error) {
    console.error(error);
    return;
  }

  holdings = data || [];

  render();
  renderDropdown();
}

function renderDropdown() {

  const unique = [];

  holdings.forEach(stock => {

    if (
      !unique.find(
        s => s.symbol === stock.symbol
      )
    ) {
      unique.push(stock);
    }
  });

  stockSelect.innerHTML =
    `<option value="">Actions déjà suivies</option>`;

  unique.forEach(stock => {

    stockSelect.innerHTML += `
      <option value="${stock.symbol}">
        ${stock.symbol} - ${stock.name}
      </option>
    `;
  });
}

stockSelect.addEventListener(
  "change",
  () => {

    const symbol =
      stockSelect.value;

    const stock =
      holdings.find(
        s => s.symbol === symbol
      );

    if (!stock) return;

    symbolInput.value = stock.symbol;
    nameInput.value = stock.name;
  }
);

function render() {

  tableBody.innerHTML = "";

  let totalValue = 0;
  let invested = 0;

  holdings.forEach(stock => {

    const value =
      stock.quantity * stock.current_price;

    const cost =
      stock.quantity * stock.buy_price;

    const gain =
      value - cost;

    totalValue += value;
    invested += cost;

    const tr =
      document.createElement("tr");

    tr.innerHTML = `
      <td>${stock.symbol}</td>
      <td>${stock.name}</td>
      <td>${stock.quantity}</td>
      <td>${euro(stock.buy_price)}</td>
      <td>${euro(stock.current_price)}</td>
      <td>${euro(value)}</td>
      <td class="${
        gain >= 0
        ? "positive"
        : "negative"
      }">
        ${euro(gain)}
      </td>
      <td>
        <button
          class="btn btn-danger"
          onclick="deleteStock('${stock.id}')"
        >
          Supprimer
        </button>
      </td>
    `;

    tableBody.appendChild(tr);
  });

  const totalGain =
    totalValue - invested;

  const perf =
    invested > 0
    ? (totalGain / invested) * 100
    : 0;

  document.getElementById("totalValue")
    .textContent = euro(totalValue);

  document.getElementById("totalGain")
    .textContent = euro(totalGain);

  document.getElementById("totalPerf")
    .textContent = perf.toFixed(2) + "%";

  document.getElementById("stockCount")
    .textContent = holdings.length;
}

async function getLivePrice(symbol) {

  if (API_KEY === "TA_CLE_FINNHUB") {
    return 0;
  }

  const response =
    await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_KEY}`
    );

  const data =
    await response.json();

  return data.c || 0;
}

async function addStock() {

  const symbol =
    symbolInput.value.toUpperCase();

  const name =
    nameInput.value;

  const quantity =
    Number(quantityInput.value);

  if (
    !symbol ||
    !name ||
    !quantity
  ) {
    setStatus("Remplis tous les champs");
    return;
  }

  const livePrice =
    await getLivePrice(symbol);

  const { error } =
    await supabaseClient
      .from("holdings")
      .insert({
        user_id: currentUser.id,
        symbol,
        name,
        quantity,
        buy_price: livePrice,
        current_price: livePrice
      });

  if (error) {
    console.error(error);
    setStatus(error.message);
    return;
  }

  loadHoldings();
}

async function refreshPrices() {

  for (const stock of holdings) {

    const livePrice =
      await getLivePrice(stock.symbol);

    if (!livePrice) continue;

    await supabaseClient
      .from("holdings")
      .update({
        current_price: livePrice
      })
      .eq("id", stock.id);
  }

  loadHoldings();
}

async function deleteStock(id) {

  const { error } =
    await supabaseClient
      .from("holdings")
      .delete()
      .eq("id", id);

  if (error) {
    console.error(error);
    return;
  }

  loadHoldings();
}

document
  .getElementById("signupBtn")
  .addEventListener("click", signup);

document
  .getElementById("loginBtn")
  .addEventListener("click", login);

document
  .getElementById("logoutBtn")
  .addEventListener("click", logout);

document
  .getElementById("addBtn")
  .addEventListener("click", addStock);

refreshBtn.addEventListener(
  "click",
  refreshPrices
);
