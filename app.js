const authBox = document.getElementById("authBox");
const app = document.getElementById("app");
const statusEl = document.getElementById("status");
const logoutBtn = document.getElementById("logoutBtn");
const refreshBtn = document.getElementById("refreshBtn");
const tableBody = document.getElementById("tableBody");
const stockSelect = document.getElementById("stockSelect");

const symbolInput = document.getElementById("symbol");
const nameInput = document.getElementById("name");
const quantityInput = document.getElementById("quantity");

const MARKET_DATA_API_KEY = "TA_CLE_API_MARCHE";
const MARKET_DATA_ENDPOINT = "https://finnhub.io/api/v1/quote";

let currentUser = null;
let holdings = [];
let autoRefreshHandle = null;
let refreshInProgress = false;

function euro(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2
  }).format(value);
}

function signedEuro(value) {
  const absValue = Math.abs(Number(value) || 0);
  return `${value >= 0 ? "+" : "-"}${euro(absValue)}`;
}

function setStatus(message) {
  statusEl.textContent = message || "";
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

function clearForm() {
  stockSelect.value = "";
  symbolInput.value = "";
  nameInput.value = "";
  quantityInput.value = "";
}

function startAutoRefresh() {
  stopAutoRefresh();
  autoRefreshHandle = window.setInterval(() => {
    refreshLivePrices({ silent: true }).catch(console.error);
  }, 5 * 60 * 1000);
}

function stopAutoRefresh() {
  if (autoRefreshHandle) {
    clearInterval(autoRefreshHandle);
    autoRefreshHandle = null;
  }
}

function renderStockSelect() {
  const uniqueStocks = [];
  const seen = new Set();

  for (const stock of holdings) {
    if (seen.has(stock.symbol)) continue;
    seen.add(stock.symbol);
    uniqueStocks.push(stock);
  }

  if (!uniqueStocks.length) {
    stockSelect.innerHTML = '<option value="">Aucune action suivie</option>';
    stockSelect.disabled = true;
    return;
  }

  stockSelect.disabled = false;
  stockSelect.innerHTML = `
    <option value="">Choisir une action déjà suivie</option>
    ${uniqueStocks
      .map(
        (stock) => `
          <option value="${stock.symbol}">${stock.symbol} - ${stock.name}</option>
        `
      )
      .join("")}
  `;
}

stockSelect.addEventListener("change", () => {
  const symbol = stockSelect.value;
  if (!symbol) return;

  const selectedStock = holdings.find((stock) => stock.symbol === symbol);
  if (!selectedStock) return;

  symbolInput.value = selectedStock.symbol;
  nameInput.value = selectedStock.name;
  setStatus(`Action ${selectedStock.symbol} chargée.`);
});

async function signup() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    setStatus("Remplis l'email et le mot de passe.");
    return;
  }

  const { error } = await supabaseClient.auth.signUp({
    email,
    password
  });

  if (error) {
    console.error(error);
    setStatus(error.message);
    return;
  }

  setStatus("Compte créé avec succès. Vérifie ta boîte mail si la confirmation est activée.");
}

async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    setStatus("Remplis l'email et le mot de passe.");
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error(error);
    setStatus(error.message);
    return;
  }

  currentUser = data.user;
  showApp();
  await loadHoldings();
  await refreshLivePrices({ silent: true });
  startAutoRefresh();
  setStatus("Connecté.");
}

async function logout() {
  await supabaseClient.auth.signOut();
  currentUser = null;
  holdings = [];
  stopAutoRefresh();
  showAuth();
  render();
  setStatus("Déconnecté.");
}

async function loadHoldings() {
  if (!currentUser) return;

  const { data, error } = await supabaseClient
    .from("holdings")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    setStatus(error.message);
    return;
  }

  holdings = data || [];
  render();
  renderStockSelect();
}

async function fetchLivePrice(symbol) {
  const apiKey = MARKET_DATA_API_KEY.trim();

  if (!apiKey || apiKey === "TA_CLE_API_MARCHE") {
    return null;
  }

  const url = `${MARKET_DATA_ENDPOINT}?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Erreur API prix: ${response.status}`);
  }

  const data = await response.json();
  const price = Number(data.c);

  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }

  return price;
}

async function refreshLivePrices({ silent = false } = {}) {
  if (!currentUser || refreshInProgress || holdings.length === 0) return;

  refreshInProgress = true;

  try {
    let updatedCount = 0;

    for (let i = 0; i < holdings.length; i++) {
      const stock = holdings[i];

      let livePrice = null;
      try {
        livePrice = await fetchLivePrice(stock.symbol);
      } catch (error) {
        console.error(error);
      }

      if (!Number.isFinite(livePrice) || livePrice <= 0) continue;

      if (Number(stock.current_price) !== livePrice) {
        const { error } = await supabaseClient
          .from("holdings")
          .update({ current_price: livePrice })
          .eq("id", stock.id);

        if (!error) {
          holdings[i] = { ...stock, current_price: livePrice };
          updatedCount++;
        } else {
          console.error(error);
        }
      }
    }

    if (updatedCount > 0) {
      render();
      renderStockSelect();
    }

    if (!silent) {
      setStatus(updatedCount > 0 ? "Cours actualisés." : "Aucune mise à jour nécessaire.");
    }
  } finally {
    refreshInProgress = false;
  }
}

function render() {
  tableBody.innerHTML = "";

  let totalValue = 0;
  let invested = 0;

  if (!holdings.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="muted">Aucune action pour le moment.</td>
      </tr>
    `;
  }

  holdings.forEach((stock) => {
    const quantity = Number(stock.quantity) || 0;
    const buyPrice = Number(stock.buy_price) || 0;
    const currentPrice = Number(stock.current_price) || 0;
    const value = quantity * currentPrice;
    const cost = quantity * buyPrice;
    const gain = value - cost;

    totalValue += value;
    invested += cost;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${stock.symbol}</td>
      <td>${stock.name}</td>
      <td>${quantity}</td>
      <td>${euro(buyPrice)}</td>
      <td>${euro(currentPrice)}</td>
      <td>${euro(value)}</td>
      <td class="${gain >= 0 ? "positive" : "negative"}">${signedEuro(gain)}</td>
      <td>
        <button class="btn btn-danger" onclick="deleteStock('${stock.id}')">Supprimer</button>
      </td>
    `;

    tableBody.appendChild(tr);
  });

  const totalGain = totalValue - invested;
  const perf = invested > 0 ? (totalGain / invested) * 100 : 0;

  document.getElementById("totalValue").textContent = euro(totalValue);
  document.getElementById("totalGain").textContent = signedEuro(totalGain);
  document.getElementById("totalGain").className = totalGain >= 0 ? "positive" : "negative";
  document.getElementById("totalPerf").textContent = `${perf.toFixed(2)}%`;
  document.getElementById("totalPerf").className = perf >= 0 ? "positive" : "negative";
  document.getElementById("stockCount").textContent = holdings.length;
}

async function addStock() {
  if (!currentUser) {
    setStatus("Connecte-toi d'abord.");
    return;
  }

  const symbol = symbolInput.value.trim().toUpperCase();
  const name = nameInput.value.trim();
  const quantity = Number(quantityInput.value);

  if (!symbol || !name || !quantity) {
    setStatus("Remplis le symbole, le nom et la quantité.");
    return;
  }

  let currentPrice = null;

  try {
    currentPrice = await fetchLivePrice(symbol);
  } catch (error) {
    console.error(error);
  }

  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    const existing = holdings.find((stock) => stock.symbol === symbol);
    currentPrice = existing ? Number(existing.current_price) : null;
  }

  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    currentPrice = 0;
  }

  const buyPrice = currentPrice;

  const { error } = await supabaseClient.from("holdings").insert({
    user_id: currentUser.id,
    symbol,
    name,
    quantity,
    buy_price: buyPrice,
    current_price: currentPrice
  });

  if (error) {
    console.error(error);
    setStatus(error.message);
    return;
  }

  clearForm();
  await loadHoldings();
  await refreshLivePrices({ silent: true });
  setStatus(`Action ${symbol} ajoutée.`);
}

async function deleteStock(id) {
  const { error } = await supabaseClient
    .from("holdings")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
    setStatus(error.message);
    return;
  }

  await loadHoldings();
  await refreshLivePrices({ silent: true });
  setStatus("Action supprimée.");
}

document.getElementById("signupBtn").addEventListener("click", signup);
document.getElementById("loginBtn").addEventListener("click", login);
document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("addBtn").addEventListener("click", addStock);
refreshBtn.addEventListener("click", () => refreshLivePrices());

supabaseClient.auth.onAuthStateChange(async (_event, session) => {
  const user = session?.user ?? null;

  if (user) {
    currentUser = user;
    showApp();
    await loadHoldings();
    await refreshLivePrices({ silent: true });
    startAutoRefresh();
  } else {
    currentUser = null;
    holdings = [];
    stopAutoRefresh();
    showAuth();
    render();
  }
});

(async function init() {
  const { data } = await supabaseClient.auth.getSession();
  const user = data.session?.user ?? null;

  if (user) {
    currentUser = user;
    showApp();
    await loadHoldings();
    await refreshLivePrices({ silent: true });
    startAutoRefresh();
  } else {
    showAuth();
    render();
  }
})();
