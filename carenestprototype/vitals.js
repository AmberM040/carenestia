document.addEventListener("DOMContentLoaded", () => {
  let db = ensureDB(loadDB());
  saveDB(db);

  const childSwitcher = document.getElementById("childSwitcher");
  const childAvatar = document.getElementById("childAvatar");
  const childSummary = document.getElementById("childSummary");

  const vitalsList = document.getElementById("vitalsList");

  const btnAddVital = document.getElementById("btnAddVital");
  const vitalModal = document.getElementById("vitalModal");
  const btnCloseVitalModal = document.getElementById("btnCloseVitalModal");
  const btnSaveVital = document.getElementById("btnSaveVital");

  const vitalTemp = document.getElementById("vitalTemp");
  const vitalO2 = document.getElementById("vitalO2");
  const vitalHR = document.getElementById("vitalHR");
  const vitalRR = document.getElementById("vitalRR");
  const vitalBP = document.getElementById("vitalBP");
  const vitalNotes = document.getElementById("vitalNotes");

  init();

  function init() {
    if (!Array.isArray(db.vitals)) db.vitals = [];
    ensureBaselineStructure();

    renderChildSwitcher();
    renderHeader();
    renderVitals();
    wireEvents();
  }

  function wireEvents() {
    childSwitcher?.addEventListener("change", () => {
      db.activeChildId = childSwitcher.value;
      db.currentChildId = childSwitcher.value;
      saveDB(db);

      renderHeader();
      renderVitals();
    });

    btnAddVital?.addEventListener("click", () => {
      vitalModal.classList.remove("hidden");
    });

    btnCloseVitalModal?.addEventListener("click", () => {
      vitalModal.classList.add("hidden");
    });

    vitalModal?.addEventListener("click", (e) => {
      if (e.target === vitalModal) {
        vitalModal.classList.add("hidden");
      }
    });

    btnSaveVital?.addEventListener("click", saveVitals);
  }

  function ensureBaselineStructure() {
    if (!db.careBinder) db.careBinder = {};
    if (!db.careBinder.sections) db.careBinder.sections = {};
    if (!db.careBinder.sections.baseline) db.careBinder.sections.baseline = {};

    const baseline = db.careBinder.sections.baseline;
    if (!baseline.vitals || typeof baseline.vitals !== "object") baseline.vitals = {};

    if (!baseline.vitals.temp || typeof baseline.vitals.temp !== "object") baseline.vitals.temp = {};
    if (!baseline.vitals.o2 || typeof baseline.vitals.o2 !== "object") baseline.vitals.o2 = {};
    if (!baseline.vitals.hr || typeof baseline.vitals.hr !== "object") baseline.vitals.hr = {};
    if (!baseline.vitals.rr || typeof baseline.vitals.rr !== "object") baseline.vitals.rr = {};
    if (!baseline.vitals.bpSys || typeof baseline.vitals.bpSys !== "object") baseline.vitals.bpSys = {};
    if (!baseline.vitals.bpDia || typeof baseline.vitals.bpDia !== "object") baseline.vitals.bpDia = {};

    if (typeof baseline.vitals.temp.min !== "string") baseline.vitals.temp.min = "";
    if (typeof baseline.vitals.temp.max !== "string") baseline.vitals.temp.max = "";

    if (typeof baseline.vitals.o2.min !== "string") baseline.vitals.o2.min = "";
    if (typeof baseline.vitals.o2.max !== "string") baseline.vitals.o2.max = "";

    if (typeof baseline.vitals.hr.min !== "string") baseline.vitals.hr.min = "";
    if (typeof baseline.vitals.hr.max !== "string") baseline.vitals.hr.max = "";

    if (typeof baseline.vitals.rr.min !== "string") baseline.vitals.rr.min = "";
    if (typeof baseline.vitals.rr.max !== "string") baseline.vitals.rr.max = "";

    if (typeof baseline.vitals.bpSys.min !== "string") baseline.vitals.bpSys.min = "";
    if (typeof baseline.vitals.bpSys.max !== "string") baseline.vitals.bpSys.max = "";

    if (typeof baseline.vitals.bpDia.min !== "string") baseline.vitals.bpDia.min = "";
    if (typeof baseline.vitals.bpDia.max !== "string") baseline.vitals.bpDia.max = "";

    if (typeof baseline.vitals.notes !== "string") baseline.vitals.notes = "";

    saveDB(db);
  }

  function getChildren() {
    return Array.isArray(db.children) ? db.children : [];
  }

  function getActiveChild() {
    const children = getChildren();
    return children.find((c) => String(c.id) === String(db.activeChildId)) || children[0] || null;
  }

  function getBaselineVitals() {
    return db.careBinder?.sections?.baseline?.vitals || {};
  }

  function renderChildSwitcher() {
    const children = getChildren();

    if (!childSwitcher) return;

    childSwitcher.innerHTML = children
      .map(
        (c) =>
          `<option value="${escapeHtml(c.id)}" ${
            String(c.id) === String(db.activeChildId) ? "selected" : ""
          }>${escapeHtml(c.name || "Child")}</option>`
      )
      .join("");
  }

  function renderHeader() {
    const child = getActiveChild();
    if (!child) return;

    childSummary.textContent = `Age ${child.age || "—"}`;
    childAvatar.innerHTML = child.photo_url
      ? `<img src="${escapeAttr(child.photo_url)}" alt="${escapeAttr(child.name || "Child")}">`
      : "";
  }

  function renderVitals() {
    const child = getActiveChild();

    if (!child) {
      vitalsList.innerHTML = `<div class="empty-box">No child selected.</div>`;
      return;
    }

    const list = db.vitals
      .filter((v) => String(v.childId) === String(child.id))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 30);

    if (!list.length) {
      vitalsList.innerHTML = `<div class="empty-box">No vitals logged yet.</div>`;
      return;
    }

    vitalsList.innerHTML = list
      .map((v) => {
        const alertBadges = buildAlertBadges(v.flags);

        return `
          <div class="list-item">
            <div style="width:100%;">
              <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
                <strong>${escapeHtml(formatDateTime(v.date))}</strong>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                  ${alertBadges || `<span class="pill">Normal</span>`}
                </div>
              </div>

              <div class="muted" style="margin-top:6px;">
                ${v.temp ? `Temp ${escapeHtml(v.temp)}°` : ""}
                ${v.temp && (v.o2 || v.hr || v.rr || v.bp) ? ` • ` : ""}
                ${v.o2 ? `O2 ${escapeHtml(v.o2)}%` : ""}
                ${v.o2 && (v.hr || v.rr || v.bp) ? ` • ` : ""}
                ${v.hr ? `HR ${escapeHtml(v.hr)}` : ""}
                ${v.hr && (v.rr || v.bp) ? ` • ` : ""}
                ${v.rr ? `RR ${escapeHtml(v.rr)}` : ""}
                ${v.rr && v.bp ? ` • ` : ""}
                ${v.bp ? `BP ${escapeHtml(v.bp)}` : ""}
              </div>

              ${
                v.notes
                  ? `<div class="muted" style="margin-top:6px;">${escapeHtml(v.notes)}</div>`
                  : ""
              }
            </div>
          </div>
        `;
      })
      .join("");
  }

  function saveVitals() {
    const child = getActiveChild();
    if (!child) return;

    const temp = vitalTemp.value.trim();
    const o2 = vitalO2.value.trim();
    const hr = vitalHR.value.trim();
    const rr = vitalRR.value.trim();
    const bp = vitalBP.value.trim();
    const notes = vitalNotes.value.trim();

    if (!temp && !o2 && !hr && !rr && !bp && !notes) {
      alert("Please enter at least one vital or note.");
      return;
    }

    const flags = buildVitalFlags({ temp, o2, hr, rr, bp });
    const hasAlert = Object.values(flags).some((value) => value === "low" || value === "high");

    db.vitals.unshift({
      id: uid("vital"),
      childId: child.id,
      temp,
      o2,
      hr,
      rr,
      bp,
      notes,
      date: new Date().toISOString(),
      flags,
      hasAlert
    });

    syncDashboardVitalAlerts();

    saveDB(db);
    vitalModal.classList.add("hidden");
    clearForm();
    renderVitals();
  }

  function buildVitalFlags(values) {
    const baseline = getBaselineVitals();

    const bpParts = parseBP(values.bp);

    return {
      temp: compareToRange(values.temp, baseline.temp),
      o2: compareToRange(values.o2, baseline.o2),
      hr: compareToRange(values.hr, baseline.hr),
      rr: compareToRange(values.rr, baseline.rr),
      bpSys: compareToRange(bpParts.sys, baseline.bpSys),
      bpDia: compareToRange(bpParts.dia, baseline.bpDia)
    };
  }

  function compareToRange(value, range) {
    const numericValue = toNumber(value);
    const min = toNumber(range?.min);
    const max = toNumber(range?.max);

    if (numericValue === null) return "normal";
    if (min !== null && numericValue < min) return "low";
    if (max !== null && numericValue > max) return "high";
    return "normal";
  }

  function buildAlertBadges(flags = {}) {
    const items = [];

    if (flags.temp === "low") items.push(`<span class="pill" style="background:#eef2ff;color:#4f46e5;">Temp Low</span>`);
    if (flags.temp === "high") items.push(`<span class="pill" style="background:#fee2e2;color:#b91c1c;">Temp High</span>`);

    if (flags.o2 === "low") items.push(`<span class="pill" style="background:#e0f2fe;color:#0369a1;">O2 Low</span>`);
    if (flags.o2 === "high") items.push(`<span class="pill" style="background:#dcfce7;color:#166534;">O2 High</span>`);

    if (flags.hr === "low") items.push(`<span class="pill" style="background:#eef2ff;color:#4f46e5;">HR Low</span>`);
    if (flags.hr === "high") items.push(`<span class="pill" style="background:#fee2e2;color:#b91c1c;">HR High</span>`);

    if (flags.rr === "low") items.push(`<span class="pill" style="background:#eef2ff;color:#4f46e5;">RR Low</span>`);
    if (flags.rr === "high") items.push(`<span class="pill" style="background:#fee2e2;color:#b91c1c;">RR High</span>`);

    if (flags.bpSys === "low") items.push(`<span class="pill" style="background:#eef2ff;color:#4f46e5;">BP Sys Low</span>`);
    if (flags.bpSys === "high") items.push(`<span class="pill" style="background:#fee2e2;color:#b91c1c;">BP Sys High</span>`);

    if (flags.bpDia === "low") items.push(`<span class="pill" style="background:#eef2ff;color:#4f46e5;">BP Dia Low</span>`);
    if (flags.bpDia === "high") items.push(`<span class="pill" style="background:#fee2e2;color:#b91c1c;">BP Dia High</span>`);

    return items.join("");
  }

  function syncDashboardVitalAlerts() {
    const child = getActiveChild();
    if (!child) return;

    const alerts = db.vitals
      .filter((entry) => String(entry.childId) === String(child.id))
      .filter((entry) => entry.hasAlert)
      .slice(0, 10)
      .map((entry) => ({
        id: entry.id,
        date: entry.date,
        flags: entry.flags,
        temp: entry.temp || "",
        o2: entry.o2 || "",
        hr: entry.hr || "",
        rr: entry.rr || "",
        bp: entry.bp || "",
        notes: entry.notes || ""
      }));

    if (!db.dashboard || typeof db.dashboard !== "object") db.dashboard = {};
    if (!db.dashboard.vitalAlerts || typeof db.dashboard.vitalAlerts !== "object") {
      db.dashboard.vitalAlerts = {};
    }

    db.dashboard.vitalAlerts[child.id] = alerts;
  }

  function parseBP(bpValue) {
    const raw = String(bpValue || "").trim();
    if (!raw.includes("/")) {
      return { sys: "", dia: "" };
    }

    const [sys, dia] = raw.split("/");
    return {
      sys: String(sys || "").trim(),
      dia: String(dia || "").trim()
    };
  }

  function toNumber(value) {
    if (value === null || value === undefined) return null;
    const cleaned = String(value).replace(/[^\d.-]/g, "").trim();
    if (!cleaned) return null;

    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  }

  function clearForm() {
    vitalTemp.value = "";
    vitalO2.value = "";
    vitalHR.value = "";
    vitalRR.value = "";
    vitalBP.value = "";
    vitalNotes.value = "";
  }

  function uid(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  }

  function formatDateTime(date) {
    const d = new Date(date);

    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }
});