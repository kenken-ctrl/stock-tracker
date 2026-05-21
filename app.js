console.log("APP JS OK");

const authBox =
  document.getElementById("authBox");

const app =
  document.getElementById("app");

const statusEl =
  document.getElementById("status");

const logoutBtn =
  document.getElementById("logoutBtn");

const tableBody =
  document.getElementById("tableBody");

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
    console.error(error);
    statusEl.textContent = error.message;
    return;
  }

  statusEl.textContent =
    "Compte créé avec succès";
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
    console.error(error);
    statusEl.textContent = error.message;
    return;
  }

  currentUser = data.user;

  showApp();

  loadHoldings();
}

async function logout() {

  await supabaseClient.auth.signOut();

  currentUser = null;

  authBox.classList.remove("hidden");
  app.classList.add("hidden");
  logoutBtn.classList.add("hidden");
}

function showApp() {

  authBox.classList.add("hidden");
  app.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");
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
}

function render() {

  tableBody.innerHTML = "";

  holdings.forEach(stock => {

    const value =
      stock.quantity * stock.current_price;

    const cost =
      stock.quantity * stock.buy_price;

    const gain =
      value - cost;

    const tr =
      document.createElement("tr");

    tr.innerHTML = `
      <tr>
        <td>${stock.symbol}</td>
        <td>${stock.name}</td>
        <td>${stock.quantity}</td>
        <td>${euro(value)}</td>
        <td>${euro(gain)}</td>
      </tr>
    `;

    tableBody.appendChild(tr);
  });
}

async function addStock() {

  const symbol =
    document.getElementById("symbol")
      .value
      .toUpperCase();

  const name =
    document.getElementById("name").value;

  const quantity =
    Number(
      document.getElementById("quantity").value
    );

  const buyPrice =
    Number(
      document.getElementById("buyPrice").value
    );

  const currentPrice =
    Number(
      document.getElementById("currentPrice").value
    );

  const { error } =
    await supabaseClient
      .from("holdings")
      .insert({
        user_id: currentUser.id,
        symbol,
        name,
        quantity,
        buy_price: buyPrice,
        current_price: currentPrice
      });

  if (error) {
    console.error(error);
    alert(error.message);
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
