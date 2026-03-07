document.addEventListener("DOMContentLoaded", () => {
  let db = ensureInventoryDB(loadSafeDB());
  saveSafeDB(db);

  const childSummary = document.getElementById("childSummary");
  const childSwitcher = document.getElementById("childSwitcher");

  const statsGrid = document.getElementById("statsGrid");
  const lowSupplyBox = document.getElementById("lowSupplyBox");
  const lowSupplyList = document.getElementById("lowSupplyList");

  const inventoryList = document.getElementById("inventoryList");

  const btnToggleForm = document.getElementById("btnToggleForm");
  const btnCancelEdit = document.getElementById("btnCancelEdit");
  const btnResetForm = document.getElementById("btnResetForm");
  const btnSeedTrach = document.getElementById("btnSeedTrach");

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

  renderChildSummary();
  renderChildSwitcher();
  renderAll();

  btnToggleForm.addEventListener("click", () => {
    editingId = null;
    setFormMode("add");
    clearForm();
    formCard.classList.toggle("hidden");
    if (!formCard.classList.contains("hidden")) itemName.focus();
  });

  btnCancelEdit.addEventListener("click", () => {
    editingId = null;
    clearForm();
    formCard.classList.add("hidden");
    setFormMode("add");
  });

  btnResetForm.addEventListener("click", () => {
    if (editingId) {
      const item = db.inventory.find(x => x.id === editingId);
      if (item) fillForm(item);
      return;
    }
    clearForm();
  });

  btnSeedTrach.addEventListener("click", () => {
    seedTrachStarterSet();
    renderAll();
  });

  inventoryForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const payload = {
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
      const idx = db.inventory.findIndex(x => x.id === editingId);
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
    saveSafeDB(db);
    clearForm();
    editingId = null;
    setFormMode("add");
    formCard.classList.add("hidden");
    renderAll();
  });

  searchInput.addEventListener("input", renderInventory);
  categoryFilter.addEventListener("change", renderInventory);
  statusFilter.addEventListener("change", renderInventory);

  function loadSafeDB() {
    try {
      if (typeof loadDB === "function") {
        return loadDB();
      }
      const raw = localStorage.getItem("carenest_prototype_v1");
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      console.error("Failed to load DB:", err);
      return {};
    }
  }

  function saveSafeDB(nextDB) {
    try {
      if (typeof saveDB === "function") {
        saveDB(nextDB);
        return;
      }
      localStorage.setItem("carenest_prototype_v1", JSON.stringify(nextDB));
    } catch (err) {
      console.error("Failed to save DB:", err);
    }
  }

  function ensureInventoryDB(source) {
    const next = source || {};

    if (!next.child) {
      next.child = {
        name: "Test Child",
        age: 6,
        diagnoses: ["Epilepsy", "Cerebral Palsy", "G-tube"]
      };
    }

    if (!Array.isArray(next.children)) {
      next.children = [next.child];
    }

    if (
      typeof next.activeChildIndex !== "number" ||
      next.activeChildIndex < 0 ||
      next.activeChildIndex >= next.children.length
    ) {
      next.activeChildIndex = 0;
    }

    if (!Array.isArray(next.inventory)) {
      next.inventory = [];
    }

    if (!next.dashboard || typeof next.dashboard !== "object") {
      next.dashboard = {};
    }

    normalizeInventory(next);

    if (next.inventory.length === 0) {
      next.inventory = getDefaultInventory();
    }

    syncDashboardLowSupplies(next);
    next.child = next.children[next.activeChildIndex] || next.child;

    return next;
  }

  function normalizeInventory(targetDB) {
    targetDB.inventory = targetDB.inventory.map((item, idx) => ({
      id: item.id || makeId(`inv_${idx}`),
      name: item.name || "Untitled Item",
      category: item.category || "Other",
      quantity: Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 0,
      low: Number.isFinite(Number(item.low)) ? Number(item.low) : 0,
      unit: item.unit || "count",
      notes: item.notes || "",
      updated: item.updated || Date.now()
    }));
  }

  function getDefaultInventory() {
    return [
      {
        id: makeId("inv"),
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

  function getTrachStarterSet() {
    return [
      { name: "Trach Ties", category: "Tracheostomy", quantity: 6, low: 2, unit: "sets", notes: "" },
      { name: "Suction Catheters", category: "Tracheostomy", quantity: 20, low: 8, unit: "count", notes: "" },
      { name: "Saline Bullets", category: "Tracheostomy", quantity: 15, low: 5, unit: "count", notes: "" },
      { name: "HME Filters", category: "Tracheostomy", quantity: 8, low: 3, unit: "count", notes: "" },
      { name: "Trach Dressing Sponges", category: "Tracheostomy", quantity: 20, low: 6, unit: "count", notes: "" },
      { name: "Disposable Gloves", category: "Tracheostomy", quantity: 2, low: 1, unit: "boxes", notes: "" },
      { name: "Backup Tracheostomy Tube", category: "Emergency", quantity: 1, low: 1, unit: "count", notes: "Keep emergency backup ready" },
      { name: "Smaller Backup Tracheostomy Tube", category: "Emergency", quantity: 1, low: 1, unit: "count", notes: "Keep emergency backup ready" }
    ];
  }

  function seedTrachStarterSet() {
    const starter = getTrachStarterSet();

    starter.forEach(seedItem => {
      const exists = db.inventory.some(
        x => x.name.trim().toLowerCase() === seedItem.name.trim().toLowerCase()
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
    saveSafeDB(db);
  }

  function renderAll() {
    renderStats();
    renderLowSupplyBox();
    renderInventory();
  }

  function renderChildSummary() {
    const child = db.children[db.activeChildIndex] || db.child || {};
    childSummary.textContent = `${child.name || "Child"} • Age ${child.age ?? "—"}`;
  }

  function renderChildSwitcher() {
    if (!childSwitcher) return;

    childSwitcher.innerHTML = "";
    db.children.forEach((child, idx) => {
      const opt = document.createElement("option");
      opt.value = String(idx);
      opt.textContent = child.name || `Child ${idx + 1}`;
      if (idx === db.activeChildIndex) opt.selected = true;
      childSwitcher.appendChild(opt);
    });

    childSwitcher.onchange = () => {
      db.activeChildIndex = Number(childSwitcher.value) || 0;
      db.child = db.children[db.activeChildIndex] || db.child;
      saveSafeDB(db);
      renderChildSummary();
      renderAll();
    };
  }

  function renderStats() {
    const totalItems = db.inventory.length;
    const totalUnits = db.inventory.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const lowCount = db.inventory.filter(isLow).length;
    const outCount = db.inventory.filter(isOut).length;

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
      .map(item => {
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

    const filtered = db.inventory.filter(item => {
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
      .map(item => {
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

            <div class="quick-actions" style="margin-bottom:10px;">
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
    inventoryList.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-action");
        const id = btn.getAttribute("data-id");
        const item = db.inventory.find(x => x.id === id);
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
          db.inventory = db.inventory.filter(x => x.id !== id);
        }

        syncDashboardLowSupplies();
        saveSafeDB(db);
        renderAll();
      });
    });
  }

  function fillForm(item) {
    itemName.value = item.name || "";
    itemCategory.value = item.category || "Other";
    itemQuantity.value = Number(item.quantity) || 0;
    itemLow.value = Number(item.low) || 0;
    itemUnit.value = item.unit || "count";
    itemNotes.value = item.notes || "";
  }

  function clearForm() {
    inventoryForm.reset();
    itemCategory.value = "Tracheostomy";
    itemQuantity.value = 0;
    itemLow.value = 0;
    itemUnit.value = "count";
    itemNotes.value = "";
  }

  function setFormMode(mode) {
    if (mode === "edit") {
      formTitle.textContent = "Edit Inventory Item";
      return;
    }
    formTitle.textContent = "Add Inventory Item";
  }

  function getLowSupplyItems() {
    return db.inventory
      .filter(item => isLow(item) || isOut(item))
      .sort((a, b) => {
        if (isOut(a) && !isOut(b)) return -1;
        if (!isOut(a) && isOut(b)) return 1;
        return a.quantity - b.quantity;
      });
  }

  function syncDashboardLowSupplies(target = db) {
    const lowSupplies = target.inventory
      .filter(item => isLow(item) || isOut(item))
      .map(item => ({
        id: item.id,
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

  function isOut(item) {
    return Number(item.quantity) <= 0;
  }

  function isLow(item) {
    return Number(item.quantity) <= Number(item.low);
  }

  function makeId(prefix = "id") {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
});