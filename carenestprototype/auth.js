document.addEventListener("DOMContentLoaded", () => {
  // Make sure DB exists and demo user is present
  let db = loadDB();
  seedDemoUser();
  db = loadDB();

  const loginForm = document.getElementById("loginForm");
  const errorMsg = document.getElementById("errorMsg");
  const demoLoginBtn = document.getElementById("demoLoginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  const currentPage = getCurrentPage();
  const isLoginPage = currentPage === "login.html";

  function showError(message) {
    if (!errorMsg) return;
    errorMsg.textContent = message;
    errorMsg.style.display = "block";
  }

  function clearError() {
    if (!errorMsg) return;
    errorMsg.textContent = "";
    errorMsg.style.display = "none";
  }

  if (demoLoginBtn) {
    demoLoginBtn.addEventListener("click", () => {
      clearError();

      const user = findUserByEmail("parent@example.com");
      if (!user) {
        showError("Demo account not found.");
        return;
      }

      setSession(user.id);
      goToAppForRole(user.role);
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      clearError();

      const emailInput = document.getElementById("loginEmail");
      const passwordInput = document.getElementById("loginPassword");

      const email = (emailInput?.value || "").trim().toLowerCase();
      const password = passwordInput?.value || "";

      if (!email || !password) {
        showError("Please enter both email and password.");
        return;
      }

      if (!validateEmail(email)) {
        showError("Please enter a valid email address.");
        return;
      }

      const user = findUserByEmail(email);
      if (!user || user.password !== password) {
        showError("Invalid email or password.");
        return;
      }

      setSession(user.id);
      goToAppForRole(user.role);
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      logout();
    });
  }

  const currentUser = requireAuth();

  if (!currentUser && !isLoginPage) {
    window.location.href = "login.html";
    return;
  }

  if (currentUser && isLoginPage) {
    goToAppForRole(currentUser.role);
  }
});

function getCurrentPage() {
  const path = window.location.pathname;
  const page = path.split("/").pop();
  return page || "index.html";
}

function validateEmail(email) {
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;
  return emailPattern.test(email);
}

function findUserByEmail(email) {
  const db = loadDB();
  return (db.users || []).find(
    (u) => (u.email || "").toLowerCase() === email.toLowerCase()
  ) || null;
}

function setSession(userId) {
  const db = loadDB();
  db.session.userId = userId;
  saveDB(db);
}

function clearSession() {
  const db = loadDB();
  db.session.userId = null;
  saveDB(db);
}

function logout() {
  clearSession();
  window.location.href = "login.html";
}

function requireAuth() {
  const db = loadDB();
  const userId = db?.session?.userId;
  if (!userId) return null;

  return (db.users || []).find((u) => u.id === userId) || null;
}

function goToAppForRole(role) {
  if (role === "nurse") {
    window.location.href = "schoolnurse.html";
  } else {
    window.location.href = "index.html";
  }
}

function seedDemoUser() {
  const db = loadDB();

  const existing = (db.users || []).find(
    (u) => (u.email || "").toLowerCase() === "parent@example.com"
  );
  if (existing) return;

  const childId = db.children?.[0]?.id || "child1";

  db.users.push({
    id: "u1",
    role: "parent",
    name: "Demo Parent",
    email: "parent@example.com",
    password: "demo123",
    childIds: [childId]
  });

  saveDB(db);
}