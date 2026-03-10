document.addEventListener("DOMContentLoaded", () => {
  let db = loadDB();
  const supabase = window.supabaseClient || null;

  const childSummary = document.getElementById("childSummary");
  const childSwitcher = document.getElementById("childSwitcher");
  const childAvatar = document.getElementById("childAvatar");
  const logoutBtn = document.getElementById("logoutBtn");

  const statsGrid = document.getElementById("statsGrid");
  const lowSupplyBox = document.getElementById("lowSupplyBox");
  const lowSupplyList = document.getElementById("lowSupplyList");

  const inventoryList = document.getElementById("inventoryList");

  const btnToggleForm = document.getElementById("btnToggleForm");
  const btnToggleFormSidebar = document.getElementById("btnToggleFormSidebar");
  const btnToggleFormQuick = document.getElementById("btnToggleFormQuick");

  const btnCancelEdit = document.getElementById("btnCancelEdit");
  const btnResetForm = document.getElementById("btnResetForm");

  const btnSeedTrach = document.getElementById("btnSeedTrach");
  const btnSeedTrachSidebar = document.getElementById("btnSeedTrachSidebar");
  const btnSeedTrachQuick = document.getElementById("btnSeedTrachQuick");

  const formCard = document.getElementById("formCard");
  const formTitle = document.getElementById("formTitle");
  const inventoryForm = document.getElementById("inventoryForm");

  const itemName = document.getElementById("itemName");
  const itemCategory = document.getElementById("itemCategory");
  const itemQuantity = document.getElementById("itemQuantity");
  const itemLow = document.getElementById("itemLow");
  const itemUnit = document.getElementById("itemUnit");
  const itemNotes = document.getElementById("itemNotes");

  const searchInput = document.getElementById("searchInput");
  const categoryFilter = document.getElementById("categoryFilter");
  const statusFilter = document.getElementById("statusFilter");

  let editingId = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function calculateAge(birthdate) {
    if (!birthdate) return "";
    const birth = new Date(birthdate);
    if (Number.isNaN(birth.getTime())) return "";

    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();

    const hadBirthdayThisYear =
      today.getMonth() > birth.getMonth() ||
      (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());

    if (!hadBirthdayThisYear) age -= 1;
    return age;
  }

  function normalizeDiagnoses(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === "string" && value.trim()) {
      return value
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);
    }
    return [];
  }

  function makeId(prefix = "id") {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function getChildrenSafe() {
    return Array.isArray(db.children) ? db.children : [];
  }

  function activeChild() {
    const children = getChildrenSafe();
    if (!children.length) return null;

    const preferredId = db.activeChildId || db.currentChildId || null;
    if (preferredId) {
      const match = children.find((child) => String(child.id) === String(preferredId));
      if (match) return match;
    }

    return children[0] || null;
  }

  function setActiveChildId(id) {
    const child = getChildrenSafe().find((entry) => String(entry.id) === String(id));
    db.activeChildId = child ? child.id : null;
    db.currentChildId = db.activeChildId;
    db = ensureDB(db);
    saveDB(db);
  }

  function ensureInventoryDB(target) {
    const next = target || {};

    if (!Array.isArray(next.children)) next.children = [];
    if (!Array.isArray(next.inventory)) next.inventory = [];
    if (!next.dashboard || typeof next.dashboard !== "object") next.dashboard = {};

    next.inventory = next.inventory.map((item, idx) => ({
      id: item.id || makeId(`inv_${idx}`),
      childId: item.childId || next.activeChildId || next.currentChildId || next.children?.[0]?.id || null,
      name: item.name || "Untitled Item",
      category: item.category || "Other",
      quantity: Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 0,
      low: Number.isFinite(Number(item.low)) ? Number(item.low) : 0,
      unit: item.unit || "count",
      notes: item.notes || "",
      updated: item.updated || Date.now()
    }));

    syncDashboardLowSupplies(next);
    return next;
  }

  function getInventoryForActiveChild() {
    const child = activeChild();
    if (!child) return [];
    return (db.inventory || []).filter((item) => String(item.childId) === String(child.id));
  }

  function getDefaultInventory(childId) {
    return [
      {
        id: makeId("inv"),
        childId,
        name: "Trach Ties",
        category: "Tracheostomy",
        quantity: 8,
        low: 3,
        unit: "sets",
        notes: "Change per care plan",
        updated: Date.now()
      },
      {
        id: makeId("inv"),
        childId,
        name: "Suction Catheters",
        category: "Tracheostomy",
        quantity: 24,
        low: 10,
        unit: "count",
        notes: "Check size before reorder",
        updated: Date.now()
      },
      {
        id: makeId("inv"),
        childId,
        name: "Saline Bullets",
        category: "Tracheostomy",
        quantity: 18,
        low: 6,
        unit: "count",
        notes: "",
        updated: Date.now()
      },
      {
        id: makeId("inv"),
        childId,
        name: "HME Filters",
        category: "Tracheostomy",
        quantity: 10,
        low: 4,
        unit: "count",
        notes: "Heat moisture exchangers",
        updated: Date.now()
      },
      {
        id: makeId("inv"),
        childId,
        name: "Feeding Syringes",
        category: "Medical",
        quantity: 12,
        low: 4,
        unit: "count",
        notes: "",
        updated: Date.now()
      },
      {
        id: makeId("inv"),
        childId,
        name: "Formula",
        category: "Nutrition",
        quantity: 6,
        low: 2,
        unit: "boxes",
        notes: "",
        updated: Date.now()
      },
      {
        id: makeId("inv"),
        childId,
        name: "Rescue Medication",
        category: "Emergency",
        quantity: 2,
        low: 1,
        unit: "doses",
        notes: "Check expiration date",
        updated: Date.now()
      },
      {
        id: makeId("inv"),
        childId,
        name: "Wipes",
        category: "Daily Care",
        quantity: 5,
        low: 2,
        unit: "packs",
        notes: "",
        updated: Date.now()
      }
    ];
  }

  function getTrachStarterSet(childId) {
    return [
      { childId, name: "Trach Ties", category: "Tracheostomy", quantity: 6, low: 2, unit: "sets", notes: "" },
      { childId, name: "Suction Catheters", category: "Tracheostomy", quantity: 20, low: 8, unit: "count", notes: "" },
      { childId, name: "Saline Bullets", category: "Tracheostomy", quantity: 15, low: 5, unit: "count", notes: "" },
      { childId, name: "HME Filters", category: "Tracheostomy", quantity: 8, low: 3, unit: "count", notes: "" },
      { childId, name: "Trach Dressing Sponges", category: "Tracheostomy", quantity: 20, low: 6, unit: "count", notes: "" },
      { childId, name: "Disposable Gloves", category: "Tracheostomy", quantity: 2, low: 1, unit: "boxes", notes: "" },
      { childId, name: "Backup Tracheostomy Tube", category: "Emergency", quantity: 1, low: 1, unit: "count", notes: "Keep emergency backup ready" },
      { childId, name: "Smaller Backup Tracheostomy Tube", category: "Emergency", quantity: 1, low: 1, unit: "count", notes: "Keep emergency backup ready" }
    ];
  }

  function seedTrachStarterSet() {
    const child = activeChild();
    if (!child) return;

    const starter = getTrachStarterSet(child.id);

    starter.forEach((seedItem) => {
      const exists = db.inventory.some(
        (x) =>
          String(x.childId) === String(child.id) &&
          x.name.trim().toLowerCase() === seedItem.name.trim().toLowerCase()
      );

      if (!exists) {
        db.inventory.unshift({
          id: makeId("inv"),
          ...seedItem,
          updated: Date.now()
        });
      }
    });

    syncDashboardLowSupplies();
    db = ensureInventoryDB(db);
    saveDB(db);
  }

  function isOut(item) {
    return Number(item.quantity) <= 0;
  }

  function isLow(item) {
    return Number(item.quantity) <= Number(item.low);
  }

  function getLowSupplyItems() {
    return getInventoryForActiveChild()
      .filter((item) => isLow(item) || isOut(item))
      .sort((a, b) => {
        if (isOut(a) && !isOut(b)) return -1;
        if (!isOut(a) && isOut(b)) return 1;
        return a.quantity - b.quantity;
      });
  }

  function syncDashboardLowSupplies(target = db) {
    const childId = target.activeChildId || target.currentChildId || target.children?.[0]?.id || null;

    const lowSupplies = (target.inventory || [])
      .filter((item) => String(item.childId) === String(childId))
      .filter((item) => isLow(item) || isOut(item))
      .map((item) => ({
        id: item.id,
        childId: item.childId,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        low: item.low,
        unit: item.unit,
        status: isOut(item) ? "out" : "low"
      }));

    if (!target.dashboard) target.dashboard = {};
    target.dashboard.lowSupplies = lowSupplies;
    target.dashboard.lowSupplyCount = lowSupplies.length;
    target.dashboard.lastInventorySync = Date.now();
  }

  function formatRelative(ts) {
    const diff = Date.now() - Number(ts || 0);
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    if (hours < 24) return `${hours} hr ago`;
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  function clearForm() {
    inventoryForm.reset();
    itemCategory.value = "Tracheostomy";
    itemQuantity.value = 0;
    itemLow.value = 0;
    itemUnit.value = "count";
    itemNotes.value = "";
  }

  function fillForm(item) {
    itemName.value = item.name || "";
    itemCategory.value = item.category || "Other";
    itemQuantity.value = Number(item.quantity) || 0;
    itemLow.value = Number(item.low) || 0;
    itemUnit.value = item.unit || "count";
    itemNotes.value = item.notes || "";
  }

  function setFormMode(mode) {
    formTitle.textContent = mode === "edit" ? "Edit Inventory Item" : "Add Inventory Item";
  }

  function renderChildSummary() {
    const child = activeChild();

    if (!child) {
      childSummary.textContent = "No child selected";
      if (childAvatar) childAvatar.innerHTML = "";
      return;
    }

    const childAge = child.age ?? calculateAge(child.birthdate);
    const diagnoses = normalizeDiagnoses(child.diagnoses);

    let summary = childAge !== "" && childAge !== null && childAge !== undefined
      ? `Age ${childAge}`
      : "Age —";

    if (diagnoses.length) {
      summary += ` • ${diagnoses.slice(0, 2).join(" • ")}`;
    }

    childSummary.textContent = summary;

    if (childAvatar) {
      if (child.photo_url) {
        childAvatar.innerHTML = `<img src="${escapeHtml(child.photo_url)}" alt="${escapeHtml(child.name || "Child")}">`;
      } else {
        childAvatar.innerHTML = "";
      }
    }
  }

  function renderChildSwitcher() {
    if (!childSwitcher) return;

    childSwitcher.innerHTML = "";
    const children = getChildrenSafe();

    if (!children.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No children yet";
      childSwitcher.appendChild(opt);
      return;
    }

    children.forEach((child) => {
      const opt = document.createElement("option");
      opt.value = child.id;
      opt.textContent = child.name || "Child";
      if (String(child.id) === String(db.activeChildId)) opt.selected = true;
      childSwitcher.appendChild(opt);
    });
  }

  function renderStats() {
    const childInventory = getInventoryForActiveChild();
    const totalItems = childInventory.length;
    const totalUnits = childInventory.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const lowCount = childInventory.filter(isLow).length;
    const outCount = childInventory.filter(isOut).length;

    statsGrid.innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Tracked Items</div>
        <div class="stat-value">${totalItems}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Units</div>
        <div class="stat-value">${totalUnits}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Low Supply Alerts</div>
        <div class="stat-value">${lowCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Out of Stock</div>
        <div class="stat-value">${outCount}</div>
      </div>
    `;
  }

  function renderLowSupplyBox() {
    const lowSupplies = getLowSupplyItems();

    if (!lowSupplies.length) {
      lowSupplyBox.classList.add("hidden");
      lowSupplyList.innerHTML = "";
      return;
    }

    lowSupplyBox.classList.remove("hidden");
    lowSupplyList.innerHTML = lowSupplies
      .map((item) => {
        const statusText = isOut(item)
          ? `Out of stock`
          : `${item.quantity} ${item.unit} left`;
        return `<li><strong>${escapeHtml(item.name)}</strong> — ${statusText} (low alert at ${item.low})</li>`;
      })
      .join("");
  }

  function renderInventory() {
    const search = searchInput.value.trim().toLowerCase();
    const category = categoryFilter.value;
    const status = statusFilter.value;

    const filtered = getInventoryForActiveChild().filter((item) => {
      const matchesSearch =
        !search ||
        item.name.toLowerCase().includes(search) ||
        item.category.toLowerCase().includes(search) ||
        (item.notes || "").toLowerCase().includes(search);

      const matchesCategory = category === "all" || item.category === category;

      let matchesStatus = true;
      if (status === "ok") matchesStatus = !isLow(item) && !isOut(item);
      if (status === "low") matchesStatus = isLow(item) && !isOut(item);
      if (status === "out") matchesStatus = isOut(item);

      return matchesSearch && matchesCategory && matchesStatus;
    });

    if (!filtered.length) {
      inventoryList.innerHTML = `
        <div class="empty-state">
          <h3 style="margin-top:0;">No inventory items found</h3>
          <p class="muted" style="margin-bottom:0;">Try changing your search or add a new supply item.</p>
        </div>
      `;
      return;
    }

    inventoryList.innerHTML = filtered
      .map((item) => {
        const out = isOut(item);
        const low = isLow(item);

        const cardClass = out ? "inventory-card out" : low ? "inventory-card low" : "inventory-card";
        const statusPill = out
          ? `<span class="pill out">Out of Stock</span>`
          : low
            ? `<span class="pill low">Low Stock</span>`
            : `<span class="pill">In Stock</span>`;

        return `
          <article class="${cardClass}">
            <div class="inventory-title">${escapeHtml(item.name)}</div>
            <div class="muted">${escapeHtml(item.category)}</div>

            <div class="pill-row">
              ${statusPill}
              <span class="pill">Qty: ${item.quantity} ${escapeHtml(item.unit)}</span>
              <span class="pill">Low at: ${item.low}</span>
            </div>

            <div style="margin-bottom:8px;">
              ${
                out
                  ? `<span class="danger-text">Needs restock now</span>`
                  : low
                    ? `<span class="warn-text">Restock soon</span>`
                    : `<span class="muted">Stock level looks good</span>`
              }
            </div>

            ${
              item.notes
                ? `<div class="muted" style="margin-bottom:10px;">${escapeHtml(item.notes)}</div>`
                : ``
            }

            <div class="muted" style="font-size:12px;margin-bottom:12px;">
              Updated ${formatRelative(item.updated)}
            </div>

            <div class="button-row" style="margin-bottom:10px;">
              <button class="btn btn-small" type="button" data-action="inc" data-id="${item.id}">+ Add</button>
              <button class="btn btn-small" type="button" data-action="dec" data-id="${item.id}">- Use</button>
              <button class="btn btn-small btn-ghost" type="button" data-action="edit" data-id="${item.id}">Edit</button>
              <button class="btn btn-small btn-danger" type="button" data-action="delete" data-id="${item.id}">Delete</button>
            </div>
          </article>
        `;
      })
      .join("");

    bindCardActions();
  }

  function bindCardActions() {
    inventoryList.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-action");
        const id = btn.getAttribute("data-id");
        const item = db.inventory.find((x) => String(x.id) === String(id));
        if (!item) return;

        if (action === "inc") {
          item.quantity += 1;
          item.updated = Date.now();
        }

        if (action === "dec") {
          item.quantity = Math.max(0, item.quantity - 1);
          item.updated = Date.now();
        }

        if (action === "edit") {
          editingId = id;
          setFormMode("edit");
          fillForm(item);
          formCard.classList.remove("hidden");
          itemName.focus();
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }

        if (action === "delete") {
          const ok = confirm(`Delete "${item.name}" from inventory?`);
          if (!ok) return;
          db.inventory = db.inventory.filter((x) => String(x.id) !== String(id));
        }

        syncDashboardLowSupplies();
        db = ensureInventoryDB(db);
        saveDB(db);
        renderAll();
      });
    });
  }

  function renderAll() {
    renderChildSummary();
    renderChildSwitcher();
    renderStats();
    renderLowSupplyBox();
    renderInventory();
  }

  async function fetchCurrentUser() {
    if (!supabase?.auth) return null;

    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    if (error) {
      console.warn("Could not get user:", error.message);
      return null;
    }

    return user || null;
  }

  async function syncChildrenFromSupabase() {
    const user = await fetchCurrentUser();

    if (!user) {
      window.location.href = "login.html";
      return false;
    }

    const { data: children, error: childrenError } = await supabase
      .from("children")
      .select("*")
      .eq("parent_id", user.id)
      .order("created_at", { ascending: true });

    if (childrenError) {
      console.error("Error loading children:", childrenError);
      alert("Could not load child profiles.");
      return false;
    }

    if (!children || children.length === 0) {
      db.children = [];
      db.activeChildId = null;
      db.currentChildId = null;
      db = ensureInventoryDB(db);
      saveDB(db);
      return true;
    }

    db.children = children.map((child) => ({
      id: child.id,
      name: child.name || "Child",
      age: child.age ?? calculateAge(child.birthdate),
      birthdate: child.birthdate || "",
      diagnoses: normalizeDiagnoses(child.diagnoses),
      allergies: child.allergies || "",
      notes: child.notes || "",
      photo_url: child.photo_url || ""
    }));

    const validActive =
      db.children.find((c) => String(c.id) === String(db.activeChildId || db.currentChildId)) ||
      db.children[0] ||
      null;

    db.activeChildId = validActive ? validActive.id : null;
    db.currentChildId = db.activeChildId;

    db = ensureInventoryDB(db);
    saveDB(db);
    return true;
  }

  btnToggleForm?.addEventListener("click", () => {
    editingId = null;
    setFormMode("add");
    clearForm();
    formCard.classList.toggle("hidden");
    if (!formCard.classList.contains("hidden")) itemName.focus();
  });

  btnToggleFormSidebar?.addEventListener("click", () => {
    btnToggleForm?.click();
  });

  btnToggleFormQuick?.addEventListener("click", () => {
    btnToggleForm?.click();
  });

  btnCancelEdit?.addEventListener("click", () => {
    editingId = null;
    clearForm();
    formCard.classList.add("hidden");
    setFormMode("add");
  });

  btnResetForm?.addEventListener("click", () => {
    if (editingId) {
      const item = db.inventory.find((x) => String(x.id) === String(editingId));
      if (item) fillForm(item);
      return;
    }
    clearForm();
  });

  btnSeedTrach?.addEventListener("click", () => {
    seedTrachStarterSet();
    renderAll();
  });

  btnSeedTrachSidebar?.addEventListener("click", () => {
    btnSeedTrach?.click();
  });

  btnSeedTrachQuick?.addEventListener("click", () => {
    btnSeedTrach?.click();
  });

  inventoryForm?.addEventListener("submit", (e) => {
    e.preventDefault();

    const child = activeChild();
    if (!child) {
      alert("No child selected.");
      return;
    }

    const payload = {
      childId: child.id,
      name: itemName.value.trim(),
      category: itemCategory.value,
      quantity: Math.max(0, Number(itemQuantity.value) || 0),
      low: Math.max(0, Number(itemLow.value) || 0),
      unit: itemUnit.value.trim() || "count",
      notes: itemNotes.value.trim()
    };

    if (!payload.name) {
      alert("Please enter an item name.");
      return;
    }

    if (editingId) {
      const idx = db.inventory.findIndex((x) => String(x.id) === String(editingId));
      if (idx >= 0) {
        db.inventory[idx] = {
          ...db.inventory[idx],
          ...payload,
          updated: Date.now()
        };
      }
    } else {
      db.inventory.unshift({
        id: makeId("inv"),
        ...payload,
        updated: Date.now()
      });
    }

    syncDashboardLowSupplies();
    db = ensureInventoryDB(db);
    saveDB(db);
    clearForm();
    editingId = null;
    setFormMode("add");
    formCard.classList.add("hidden");
    renderAll();
  });

  searchInput?.addEventListener("input", renderInventory);
  categoryFilter?.addEventListener("change", renderInventory);
  statusFilter?.addEventListener("change", renderInventory);

  childSwitcher?.addEventListener("change", () => {
    setActiveChildId(childSwitcher.value);
    renderAll();
  });

  logoutBtn?.addEventListener("click", async () => {
    if (window.supabaseClient?.auth) {
      try {
        await window.supabaseClient.auth.signOut();
      } catch (err) {
        console.warn("Supabase sign out failed:", err);
      }
    }
    window.location.href = "login.html";
  });

  async function init() {
    db = loadDB();

    const ok = await syncChildrenFromSupabase();
    if (!ok) return;

    db = ensureInventoryDB(db);

    const child = activeChild();
    if (child && getInventoryForActiveChild().length === 0) {
      db.inventory.push(...getDefaultInventory(child.id));
      db = ensureInventoryDB(db);
      saveDB(db);
    }

    renderAll();
  }

  init();
});
