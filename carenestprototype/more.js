document.addEventListener("DOMContentLoaded", () => {
  let db = ensureDB(loadDB());
  saveDB(db);

  const childSwitcher = document.getElementById("childSwitcher");
  const childAvatar = document.getElementById("childAvatar");
  const childSummary = document.getElementById("childSummary");
  const diagnosisPills = document.getElementById("diagnosisPills");
  const logoutBtn = document.getElementById("logoutBtn");

  const btnOpenEmergency = document.getElementById("btnOpenEmergency");
  const btnEmergencyCard = document.getElementById("btnEmergencyCard");
  const btnOpenEmergencySide = document.getElementById("btnOpenEmergencySide");

  init();

  function init() {
    ensureChildrenShape();
    renderChildSwitcher();
    renderChildHeader();
    wireNavigationButtons();
    wireEvents();
  }

  function wireEvents() {
    if (childSwitcher) {
      childSwitcher.addEventListener("change", () => {
        db.activeChildId = childSwitcher.value;
        saveDB(db);
        renderChildHeader();
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", handleLogout);
    }

    if (btnOpenEmergency) {
      btnOpenEmergency.addEventListener("click", openEmergencySheet);
    }

    if (btnEmergencyCard) {
      btnEmergencyCard.addEventListener("click", openEmergencySheet);
    }

    if (btnOpenEmergencySide) {
      btnOpenEmergencySide.addEventListener("click", openEmergencySheet);
    }
  }

  function wireNavigationButtons() {
    document.querySelectorAll("[data-link]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const href = btn.getAttribute("data-link");
        if (href) window.location.href = href;
      });
    });
  }

  function renderChildSwitcher() {
    if (!childSwitcher) return;

    const children = getChildren();
    const active = getActiveChild();

    childSwitcher.innerHTML = children
      .map((child) => {
        const selected = child.id === active.id ? "selected" : "";
        return `
          <option value="${escapeHtml(child.id)}" ${selected}>
            ${escapeHtml(child.name || "Child")}
          </option>
        `;
      })
      .join("");
  }

  function renderChildHeader() {
    const child = getActiveChild();

    renderAvatar(child);
    renderSummary(child);
    renderDiagnosisPills(child);
  }

  function renderAvatar(child) {
    if (!childAvatar) return;

    const name = (child.name || "C").trim();
    const initial = name.charAt(0).toUpperCase() || "C";

    childAvatar.textContent = initial;
  }

  function renderSummary(child) {
    if (!childSummary) return;

    const ageText = child.age ? `Age ${child.age}` : "Age —";
    const dxCount = Array.isArray(child.diagnoses) ? child.diagnoses.length : 0;

    if (dxCount > 0) {
      childSummary.textContent = `${ageText} • ${dxCount} diagnosis${dxCount === 1 ? "" : "es"}`;
    } else {
      childSummary.textContent = ageText;
    }
  }

  function renderDiagnosisPills(child) {
    if (!diagnosisPills) return;

    const diagnoses = Array.isArray(child.diagnoses) ? child.diagnoses : [];

    diagnosisPills.innerHTML = diagnoses.length
      ? diagnoses
          .slice(0, 4)
          .map((dx) => `<span class="pill">${escapeHtml(dx)}</span>`)
          .join("")
      : `<span class="pill">No diagnoses listed</span>`;
  }

  function openEmergencySheet() {
    window.location.href = "emergency-sheet.html";
  }

  async function handleLogout() {
    try {
      if (
        window.supabaseClient &&
        window.supabaseClient.auth &&
        typeof window.supabaseClient.auth.signOut === "function"
      ) {
        await window.supabaseClient.auth.signOut();
      }
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      window.location.href = "login.html";
    }
  }

  function ensureChildrenShape() {
    if (Array.isArray(db.children) && db.children.length) {
      db.children = db.children.map((child, index) => ({
        id: child.id || `child-${index + 1}`,
        name: child.name || `Child ${index + 1}`,
        age: child.age || "",
        diagnoses: Array.isArray(child.diagnoses) ? child.diagnoses : [],
        ...child
      }));

      if (!db.activeChildId) {
        db.activeChildId = db.children[0].id;
      }

      saveDB(db);
      return;
    }

    if (db.child) {
      const childId = db.child.id || "default-child";

      db.children = [
        {
          id: childId,
          name: db.child.name || "Test Child",
          age: db.child.age || "",
          diagnoses: Array.isArray(db.child.diagnoses) ? db.child.diagnoses : [],
          ...db.child
        }
      ];

      db.activeChildId = db.activeChildId || childId;
      saveDB(db);
      return;
    }

    db.children = [
      {
        id: "default-child",
        name: "Test Child",
        age: 6,
        diagnoses: ["Epilepsy", "Cerebral Palsy", "G-tube"]
      }
    ];
    db.activeChildId = "default-child";
    saveDB(db);
  }

  function getChildren() {
    return Array.isArray(db.children) ? db.children : [];
  }

  function getActiveChild() {
    const children = getChildren();
    return (
      children.find((child) => child.id === db.activeChildId) ||
      children[0] || {
        id: "default-child",
        name: "Test Child",
        age: "",
        diagnoses: []
      }
    );
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
});
