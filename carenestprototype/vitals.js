document.addEventListener("DOMContentLoaded", () => {
  const db = ensureDB(loadDB());
  const currentUser = typeof requireAuth === "function" ? requireAuth() : getCurrentUser();
  if (!currentUser) return;

  renderHeader();
  renderSnapshot();
  renderHistory();
  bindForm();
  bindFilters();
  bindLogout();

  const takenAtInput = document.getElementById("takenAt");
  if (takenAtInput && !takenAtInput.value) {
    takenAtInput.value = toDatetimeLocal(new Date());
  }
});

function renderHeader() {
  const child = getCurrentChild();
  const label = document.getElementById("vitalsChildLabel");
  if (label && child) {
    label.textContent = child.name;
  }
}

function renderSnapshot() {
  const db = ensureDB(loadDB());
  const child = getCurrentChild();
  const grid = document.getElementById("snapshotGrid");
  if (!grid || !child) return;

  grid.innerHTML = "";

  const snapshot = db.lastKnownVitals?.[child.id] || createEmptyVitalSnapshot();
  const defs = [
    { key: "temperature", label: "Temperature" },
    { key: "heartRate", label: "Heart Rate" },
    { key: "respiratoryRate", label: "Respiratory Rate" },
    { key: "oxygenSaturation", label: "O₂ Saturation" },
    { key: "bloodPressure", label: "Blood Pressure" },
    { key: "weight", label: "Weight" }
  ];

  defs.forEach(def => {
    const item = snapshot[def.key];
    const value = item ? `${item.value} ${item.unit}`.trim() : "—";
    const time = item ? formatDateTime(item.takenAt) : "No reading yet";

    const box = document.createElement("div");
    box.className = "snapshot-box";
    box.innerHTML = `
      <h4>${def.label}</h4>
      <div class="snapshot-value">${escapeHtml(value)}</div>
      <div class="muted">${escapeHtml(time)}</div>
    `;
    grid.appendChild(box);
  });
}

function renderHistory() {
  const db = ensureDB(loadDB());
  const child = getCurrentChild();
  const list = document.getElementById("historyList");
  const filterType = document.getElementById("filterType")?.value || "all";
  const filterDate = document.getElementById("filterDate")?.value || "";

  if (!list || !child) return;

  let items = (db.vitalsHistory || [])
    .filter(entry => entry.childId === child.id)
    .sort((a, b) => new Date(b.takenAt) - new Date(a.takenAt));

  if (filterType !== "all") {
    items = items.filter(entry => entry.type === filterType);
  }

  if (filterDate) {
    items = items.filter(entry => {
      const d = new Date(entry.takenAt);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}` === filterDate;
    });
  }

  list.innerHTML = "";

  if (!items.length) {
    list.innerHTML = `<div class="muted">No vitals found for this filter.</div>`;
    return;
  }

  items.forEach(entry => {
    const row = document.createElement("div");
    row.className = "history-item";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(vitalLabel(entry.type))}</strong>
        <div>${escapeHtml(`${entry.value} ${entry.unit}`.trim())}</div>
        <div class="muted">${escapeHtml(formatDateTime(entry.takenAt))}</div>
        ${entry.note ? `<div class="muted">Note: ${escapeHtml(entry.note)}</div>` : ""}
      </div>
      <div class="muted">${escapeHtml(capitalize(entry.source || "parent"))}</div>
    `;
    list.appendChild(row);
  });
}

function bindForm() {
  const form = document.getElementById("vitalsForm");
  const clearBtn = document.getElementById("clearVitalsBtn");

  if (form) {
    form.addEventListener("submit", e => {
      e.preventDefault();
      clearMessages();

      const child = getCurrentChild();
      if (!child) {
        showError("No child selected.");
        return;
      }

      const takenAtRaw = document.getElementById("takenAt").value;
      const source = document.getElementById("source").value || "parent";
      const note = document.getElementById("vitalNote").value.trim();

      const readings = [
        { type: "temperature", value: document.getElementById("temperature").value.trim(), unit: "°F" },
        { type: "heartRate", value: document.getElementById("heartRate").value.trim(), unit: "bpm" },
        { type: "respiratoryRate", value: document.getElementById("respiratoryRate").value.trim(), unit: "/min" },
        { type: "oxygenSaturation", value: document.getElementById("oxygenSaturation").value.trim(), unit: "%" },
        { type: "bloodPressure", value: document.getElementById("bloodPressure").value.trim(), unit: "mmHg" },
        { type: "weight", value: document.getElementById("weight").value.trim(), unit: "lb" }
      ].filter(item => item.value !== "");

      if (!readings.length) {
        showError("Enter at least one vital before saving.");
        return;
      }

      const takenAtIso = takenAtRaw ? new Date(takenAtRaw).toISOString() : new Date().toISOString();

      readings.forEach(item => {
        addVitalEntry({
          childId: child.id,
          type: item.type,
          value: item.value,
          unit: item.unit,
          takenAt: takenAtIso,
          source,
          note
        });
      });

      showSuccess("Vitals saved successfully.");
      form.reset();

      const takenAtInput = document.getElementById("takenAt");
      if (takenAtInput) {
        takenAtInput.value = toDatetimeLocal(new Date());
      }

      renderSnapshot();
      renderHistory();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      form.reset();
      clearMessages();

      const takenAtInput = document.getElementById("takenAt");
      if (takenAtInput) {
        takenAtInput.value = toDatetimeLocal(new Date());
      }
    });
  }
}

function bindFilters() {
  const filterType = document.getElementById("filterType");
  const filterDate = document.getElementById("filterDate");

  if (filterType) {
    filterType.addEventListener("change", renderHistory);
  }

  if (filterDate) {
    filterDate.addEventListener("change", renderHistory);
  }
}

function bindLogout() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", () => {
    const db = ensureDB(loadDB());
    db.session = { userId: null };
    saveDB(db);
    window.location.href = "login.html";
  });
}

function showError(message) {
  const box = document.getElementById("vitalError");
  if (!box) return;
  box.textContent = message;
  box.style.display = "block";
}

function showSuccess(message) {
  const box = document.getElementById("vitalSuccess");
  if (!box) return;
  box.textContent = message;
  box.style.display = "block";
}

function clearMessages() {
  const error = document.getElementById("vitalError");
  const success = document.getElementById("vitalSuccess");
  if (error) {
    error.textContent = "";
    error.style.display = "none";
  }
  if (success) {
    success.textContent = "";
    success.style.display = "none";
  }
}

function vitalLabel(type) {
  const map = {
    temperature: "Temperature",
    heartRate: "Heart Rate",
    respiratoryRate: "Respiratory Rate",
    oxygenSaturation: "O₂ Saturation",
    bloodPressure: "Blood Pressure",
    weight: "Weight"
  };
  return map[type] || type;
}

function capitalize(value) {
  const s = String(value || "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function toDatetimeLocal(date) {
  const pad = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}