document.addEventListener("DOMContentLoaded", async () => {
  let db = loadDB();
  const supabase = window.supabaseClient || null;

  const childSwitcher = document.getElementById("childSwitcher");
  const logoutBtn = document.getElementById("logoutBtn");

  const childAvatar = document.getElementById("childAvatar");
  const childSummary = document.getElementById("childSummary");
  const diagnosisPills = document.getElementById("diagnosisPills");

  const todayList = document.getElementById("todayList");
  const careLogList = document.getElementById("careLogList");

  const lastVitalsCard = document.getElementById("lastVitalsCard");
  const lastVitalsContent = document.getElementById("lastVitalsContent");

  const lowSupplyCard = document.getElementById("lowSupplyCard");
  const lowSupplySummary = document.getElementById("lowSupplySummary");
  const lowSupplyDashboardList = document.getElementById("lowSupplyDashboardList");

  const lastSymptomCard = document.getElementById("lastSymptomCard");
  const lastSymptomContent = document.getElementById("lastSymptomContent");

  const btnEmergency = document.getElementById("btnEmergency");
  const emergencyModal = document.getElementById("emergencyModal");
  const btnCloseEmergency = document.getElementById("btnCloseEmergency");
  const emergencyBody = document.getElementById("emergencyBody");

  const modal = document.getElementById("modal");
  const btnCloseModal = document.getElementById("btnCloseModal");
  const btnSave = document.getElementById("btnSave");
  const categorySelect = document.getElementById("categorySelect");
  const authorInput = document.getElementById("authorInput");
  const specialtyChecks = document.getElementById("specialtyChecks");
  const noteInput = document.getElementById("noteInput");

  const vitalsModal = document.getElementById("vitalsModal");
  const btnCloseVitalsModal = document.getElementById("btnCloseVitalsModal");
  const btnSaveQuickVitals = document.getElementById("btnSaveQuickVitals");
  const quickVitalButtons = document.querySelectorAll("[data-quick-vital]");

  const wrapO2 = document.getElementById("wrapO2");
  const wrapTemp = document.getElementById("wrapTemp");
  const wrapBpSys = document.getElementById("wrapBpSys");
  const wrapBpDia = document.getElementById("wrapBpDia");
  const wrapHr = document.getElementById("wrapHr");
  const wrapRr = document.getElementById("wrapRr");

  const quickO2 = document.getElementById("quickO2");
  const quickTemp = document.getElementById("quickTemp");
  const quickBpSys = document.getElementById("quickBpSys");
  const quickBpDia = document.getElementById("quickBpDia");
  const quickHr = document.getElementById("quickHr");
  const quickRr = document.getElementById("quickRr");
  const quickVitalNotes = document.getElementById("quickVitalNotes");

  const quickCategoryButtons = document.querySelectorAll("[data-category]");

  let currentUser = null;
  let children = [];
  let activeChild = null;
  let currentQuickVitalMode = "full";

  function show(el) {
    el?.classList.remove("hidden");
  }

  function hide(el) {
    el?.classList.add("hidden");
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function escapeHtml(str = "") {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeDiagnoses(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === "string" && value.trim()) {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  }

  function getAgeFromBirthdate(birthdate) {
    if (!birthdate) return "";
    const dob = new Date(birthdate);
    if (Number.isNaN(dob.getTime())) return "";

    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
      age--;
    }

    return age;
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function formatTimeOnly(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function isToday(dateValue) {
    if (!dateValue) return false;
    const d = new Date(dateValue);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }

  function capitalize(text = "") {
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function getChildrenSafe() {
    return Array.isArray(db.children) ? db.children : [];
  }

  function setActiveChildId(id) {
    db.activeChildId = id || null;
    db.currentChildId = db.activeChildId;
    db = ensureDB(db);
    saveDB(db);
  }

  function getActiveChildFromDB() {
    const childrenList = getChildrenSafe();
    if (!childrenList.length) return null;

    const preferredId = db.activeChildId || db.currentChildId || null;
    if (preferredId) {
      const match = childrenList.find((c) => String(c.id) === String(preferredId));
      if (match) return match;
    }

    return childrenList[0] || null;
  }

  function getSelectedSpecialties() {
    if (!specialtyChecks) return [];
    return [...specialtyChecks.querySelectorAll('input[type="checkbox"]:checked')].map(
      (input) => input.value
    );
  }

  function fillSpecialties(specialties = []) {
    if (!specialtyChecks) return;

    specialtyChecks.innerHTML = "";
    const list =
      specialties.length > 0
        ? specialties
        : ["General", "Neurology", "Pulmonology", "GI", "Cardiology", "PT/OT", "Primary Care"];

    list.forEach((item) => {
      const id = `spec_${item.replace(/\W+/g, "_").toLowerCase()}`;
      const label = document.createElement("label");
      label.className = "chip";
      label.innerHTML = `
        <input type="checkbox" id="${id}" value="${escapeHtml(item)}" />
        <span>${escapeHtml(item)}</span>
      `;
      specialtyChecks.appendChild(label);
    });
  }

  function openQuickLog(category = "note") {
    if (!modal) return;
    if (categorySelect) categorySelect.value = category;
    if (noteInput) noteInput.value = "";
    show(modal);
  }

  function closeQuickLog() {
    hide(modal);
  }

  function openVitalsModal(mode = "full") {
    if (!vitalsModal) return;
    currentQuickVitalMode = mode;
    clearVitalsInputs();
    updateVitalFieldVisibility(mode);
    show(vitalsModal);
  }

  function closeVitalsModal() {
    hide(vitalsModal);
  }

  function clearVitalsInputs() {
    if (quickO2) quickO2.value = "";
    if (quickTemp) quickTemp.value = "";
    if (quickBpSys) quickBpSys.value = "";
    if (quickBpDia) quickBpDia.value = "";
    if (quickHr) quickHr.value = "";
    if (quickRr) quickRr.value = "";
    if (quickVitalNotes) quickVitalNotes.value = "";
  }

  function updateVitalFieldVisibility(mode) {
    const showMap = {
      o2: ["wrapO2"],
      temp: ["wrapTemp"],
      bp: ["wrapBpSys", "wrapBpDia"],
      hr: ["wrapHr"],
      rr: ["wrapRr"],
      full: ["wrapO2", "wrapTemp", "wrapBpSys", "wrapBpDia", "wrapHr", "wrapRr"]
    };

    const visible = new Set(showMap[mode] || showMap.full);
    [wrapO2, wrapTemp, wrapBpSys, wrapBpDia, wrapHr, wrapRr].forEach((el) => {
      if (!el) return;
      if (visible.has(el.id)) show(el);
      else hide(el);
    });
  }

  function getSupabaseClient() {
    if (window.supabaseClient) return window.supabaseClient;
    if (window.supabase?.from) return window.supabase;
    return null;
  }

  async function fetchUser() {
    const client = getSupabaseClient();
    if (!client?.auth) return null;

    const { data, error } = await client.auth.getUser();
    if (error) {
      console.error("Error getting user:", error);
      return null;
    }

    return data?.user || null;
  }

  async function fetchChildren(userId) {
    const client = getSupabaseClient();
    if (!client || !userId) return [];

    const { data, error } = await client
      .from("children")
      .select("*")
      .eq("parent_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Could not load children from Supabase:", error.message);
      return [];
    }

    return (data || []).map((child) => ({
      ...child,
      diagnoses: normalizeDiagnoses(child.diagnoses),
      age: child.age ?? getAgeFromBirthdate(child.birthdate)
    }));
  }

  async function fetchMedications(childId) {
    const client = getSupabaseClient();
    if (!client) return [];

    const { data, error } = await client
      .from("medications")
      .select("*")
      .eq("child_id", childId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Could not load medications:", error.message);
      return [];
    }

    return data || [];
  }

  async function fetchCareLogs(childId) {
    const client = getSupabaseClient();
    if (!client) return [];

    const { data, error } = await client
      .from("care_logs")
      .select("*")
      .eq("child_id", childId)
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) {
      console.warn("Could not load care logs:", error.message);
      return [];
    }

    return data || [];
  }

  async function fetchAllCareLogsForSymptom(childId) {
    const client = getSupabaseClient();
    if (!client) return [];

    const { data, error } = await client
      .from("care_logs")
      .select("*")
      .eq("child_id", childId)
      .eq("category", "symptom")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.warn("Could not load symptoms:", error.message);
      return [];
    }

    return data || [];
  }

  async function fetchVitals(childId) {
    const client = getSupabaseClient();
    if (!client) return [];

    const { data, error } = await client
      .from("vitals")
      .select("*")
      .eq("child_id", childId)
      .order("taken_at", { ascending: false })
      .limit(1);

    if (error) {
      console.warn("Could not load vitals:", error.message);
      return [];
    }

    return data || [];
  }

  async function fetchInventory(childId) {
    const client = getSupabaseClient();
    if (!client) return [];

    const { data, error } = await client
      .from("inventory")
      .select("*")
      .eq("child_id", childId)
      .order("name", { ascending: true });

    if (error) {
      console.warn("Could not load inventory:", error.message);
      return [];
    }

    return data || [];
  }

  async function fetchSchedule(childId) {
    const client = getSupabaseClient();
    if (!client) return [];

    let result = await client
      .from("schedule_items")
      .select("*")
      .eq("child_id", childId)
      .order("start_at", { ascending: true });

    if (!result.error) return result.data || [];

    result = await client
      .from("appointments")
      .select("*")
      .eq("child_id", childId)
      .order("start_at", { ascending: true });

    if (!result.error) return result.data || [];

    console.warn("Could not load schedule:", result.error?.message || "Unknown error");
    return [];
  }

  async function fetchCarePlan(childId) {
    const client = getSupabaseClient();
    if (!client) return null;

    const { data, error } = await client
      .from("care_plans")
      .select("*")
      .eq("child_id", childId)
      .maybeSingle();

    if (error) {
      console.warn("Could not load care plan:", error.message);
      return null;
    }

    return data || null;
  }

  function renderChildSwitcher() {
    if (!childSwitcher) return;

    childSwitcher.innerHTML = "";

    if (!children.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No children yet";
      childSwitcher.appendChild(option);
      return;
    }

    children.forEach((child) => {
      const option = document.createElement("option");
      option.value = child.id;
      option.textContent = child.name || "Unnamed Child";
      if (activeChild && String(activeChild.id) === String(child.id)) {
        option.selected = true;
      }
      childSwitcher.appendChild(option);
    });
  }

  function renderChildSummaryCard(child) {
    if (!child) {
      if (childSummary) childSummary.textContent = "Age —";
      if (diagnosisPills) diagnosisPills.innerHTML = "";
      if (childAvatar) childAvatar.innerHTML = "";
      return;
    }

    const childAge = child.age ?? getAgeFromBirthdate(child.birthdate);
    const diagnoses = normalizeDiagnoses(child.diagnoses);

    let summaryText =
      childAge !== null && childAge !== undefined && childAge !== ""
        ? `Age ${childAge}`
        : "Age —";

    if (diagnoses.length) {
      summaryText += ` • ${diagnoses.slice(0, 2).join(" • ")}`;
    }

    if (childSummary) childSummary.textContent = summaryText;

    if (childAvatar) {
      if (child.photo_url) {
        childAvatar.innerHTML = `<img src="${escapeHtml(child.photo_url)}" alt="${escapeHtml(
          child.name || "Child"
        )}">`;
      } else {
        childAvatar.innerHTML = "";
      }
    }

    if (diagnosisPills) {
      diagnosisPills.innerHTML = "";

      diagnoses.forEach((diagnosis) => {
        const span = document.createElement("span");
        span.className = "pill";
        span.textContent = diagnosis;
        diagnosisPills.appendChild(span);
      });
    }
  }

  function getScheduleIcon(item) {
    const text = `${item.title || ""} ${item.type || ""}`.toLowerCase();
    if (text.includes("therapy")) return "🧩";
    if (text.includes("feed")) return "🍼";
    if (text.includes("nurse")) return "👩‍⚕️";
    if (text.includes("med")) return "💊";
    if (text.includes("appointment")) return "📅";
    return "•";
  }

  function renderTodayList(items = []) {
    if (!todayList) return;

    todayList.innerHTML = "";

    if (!items.length) {
      todayList.innerHTML = `<li class="list-item muted">Nothing scheduled for today.</li>`;
      return;
    }

    items.forEach((item) => {
      const li = document.createElement("li");
      li.className = "timeline-row";
      li.innerHTML = `
        <div class="timeline-time">${escapeHtml(
          item.start_at ? formatTimeOnly(item.start_at) : item.timeLabel || "—"
        )}</div>
        <div class="timeline-card">
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
            <div style="display:flex; gap:12px; align-items:flex-start; min-width:0;">
              <div class="log-icon" style="width:44px;height:44px;border-radius:14px;font-size:1rem;">${escapeHtml(
                getScheduleIcon(item)
              )}</div>
              <div style="min-width:0;">
                <h3 style="margin:0 0 4px;">${escapeHtml(item.title || item.name || "Untitled")}</h3>
                <div class="muted">${escapeHtml(item.location || item.type || "")}</div>
              </div>
            </div>
            <div class="muted" style="font-weight:700;">${escapeHtml(item.timeLabel || "—")}</div>
          </div>
        </div>
      `;
      todayList.appendChild(li);
    });
  }

  function renderCareLogs(logs = []) {
    if (!careLogList) return;

    careLogList.innerHTML = "";

    if (!logs.length) {
      careLogList.innerHTML = `<li class="list-item muted">No recent care log entries.</li>`;
      return;
    }

    logs.forEach((log) => {
      const li = document.createElement("li");
      li.className = "log-card";
      li.innerHTML = `
        <div class="log-icon">
          ${escapeHtml((log.categoryLabel || "N").charAt(0))}
        </div>
        <div class="log-main">
          <h3>${escapeHtml(log.categoryLabel || capitalize(log.category || "note"))}</h3>
          <p>${escapeHtml(log.note || "")}</p>
          <div class="muted mt-12">${escapeHtml(log.author || "Unknown")} • ${escapeHtml(
            log.timeLabel || "—"
          )}</div>
        </div>
      `;
      careLogList.appendChild(li);
    });
  }

  function renderLastVitals(vitals) {
    if (!lastVitalsCard || !lastVitalsContent) return;

    if (!vitals) {
      hide(lastVitalsCard);
      return;
    }

    const bp =
      vitals.bp_systolic && vitals.bp_diastolic
        ? `${vitals.bp_systolic}/${vitals.bp_diastolic}`
        : "—";

    lastVitalsContent.innerHTML = `
      <div class="vitals-grid">
        <div class="vital-box"><h4>O₂</h4><div class="vital-value">${escapeHtml(vitals.o2_sat ?? "—")}</div></div>
        <div class="vital-box"><h4>Temp</h4><div class="vital-value">${escapeHtml(vitals.temperature ?? "—")}</div></div>
        <div class="vital-box"><h4>BP</h4><div class="vital-value">${escapeHtml(bp)}</div></div>
        <div class="vital-box"><h4>HR</h4><div class="vital-value">${escapeHtml(vitals.heart_rate ?? "—")}</div></div>
        <div class="vital-box"><h4>RR</h4><div class="vital-value">${escapeHtml(vitals.respiratory_rate ?? "—")}</div></div>
        <div class="vital-box"><h4>Taken</h4><div class="vital-value" style="font-size:0.95rem;">${escapeHtml(
          formatDateTime(vitals.taken_at || vitals.created_at)
        )}</div></div>
      </div>
      ${
        vitals.notes
          ? `<div class="mt-12 muted"><strong>Notes:</strong> ${escapeHtml(vitals.notes)}</div>`
          : ""
      }
    `;

    show(lastVitalsCard);
  }

  function renderInventory(items = []) {
    if (!lowSupplyCard || !lowSupplySummary || !lowSupplyDashboardList) return;

    const lowItems = items.filter((item) => {
      const qty = Number(item.quantity ?? item.qty ?? 0);
      const threshold = Number(item.low_threshold ?? item.threshold ?? item.low ?? 0);
      return threshold > 0 && qty <= threshold;
    });

    if (!lowItems.length) {
      hide(lowSupplyCard);
      return;
    }

    lowSupplySummary.textContent =
      lowItems.length === 1
        ? "1 item is running low."
        : `${lowItems.length} items are running low.`;

    lowSupplyDashboardList.innerHTML = "";
    lowItems.slice(0, 5).forEach((item) => {
      const div = document.createElement("div");
      div.className = "list-item";
      div.innerHTML = `
        <div>
          <strong>${escapeHtml(item.name || "Supply")}</strong>
          <div class="muted">Qty: ${escapeHtml(item.quantity ?? item.qty ?? "—")}</div>
        </div>
        <div class="muted">Low at ${escapeHtml(item.low_threshold ?? item.threshold ?? item.low ?? "—")}</div>
      `;
      lowSupplyDashboardList.appendChild(div);
    });

    show(lowSupplyCard);
  }

  function renderLastSymptom(symptomLog) {
    if (!lastSymptomCard || !lastSymptomContent) return;

    if (!symptomLog) {
      hide(lastSymptomCard);
      return;
    }

    lastSymptomContent.innerHTML = `
      <div class="list-item">
        <div>
          <strong>${escapeHtml(symptomLog.note || "Symptom logged")}</strong>
          <div class="muted">${escapeHtml(symptomLog.author || "Unknown")} • ${escapeHtml(
            symptomLog.timeLabel || "—"
          )}</div>
        </div>
      </div>
    `;

    show(lastSymptomCard);
  }

  function normalizeScheduleItems(items = []) {
    return items.map((item) => {
      const start = item.start_at || item.date || item.datetime || item.time;
      return {
        ...item,
        timeLabel: start ? formatDateTime(start) : item.time || "—"
      };
    });
  }

  function normalizeCareLogs(items = []) {
    return items.map((item) => ({
      ...item,
      categoryLabel: capitalize(item.category || "note"),
      timeLabel: formatDateTime(item.created_at || item.logged_at || item.time)
    }));
  }

  function buildEmergencySection(title, content) {
    return `
      <div class="card" style="padding:12px;">
        <strong>${escapeHtml(title)}</strong>
        <div class="muted" style="margin-top:6px;">${content}</div>
      </div>
    `;
  }

  function renderEmergencySheet(child, carePlan, meds = []) {
    if (!emergencyBody) return;

    if (!child) {
      emergencyBody.innerHTML = `<div class="muted">No child selected.</div>`;
      return;
    }

    const diagnoses = normalizeDiagnoses(child.diagnoses).length
      ? normalizeDiagnoses(child.diagnoses).join(", ")
      : "None listed";

    const childAge = child.age ?? getAgeFromBirthdate(child.birthdate);

    const medList = meds.length
      ? meds
          .map((med) => {
            const parts = [med.name, med.dose, med.schedule_time || med.instructions]
              .filter(Boolean)
              .join(" • ");
            return `<div>${escapeHtml(parts)}</div>`;
          })
          .join("")
      : "No medications listed";

    const baselineVitals = `
      <div><strong>O₂:</strong> ${escapeHtml(carePlan?.baseline_o2 || "—")}</div>
      <div><strong>Temp:</strong> ${escapeHtml(carePlan?.baseline_temp || "—")}</div>
      <div><strong>HR:</strong> ${escapeHtml(carePlan?.baseline_hr || "—")}</div>
      <div><strong>RR:</strong> ${escapeHtml(carePlan?.baseline_rr || "—")}</div>
      <div><strong>BP:</strong> ${escapeHtml(carePlan?.baseline_bp || "—")}</div>
    `;

    const rescueMed = `
      <div><strong>Name:</strong> ${escapeHtml(carePlan?.rescue_med_name || "—")}</div>
      <div><strong>Dose:</strong> ${escapeHtml(carePlan?.rescue_med_dose || "—")}</div>
      <div><strong>Route:</strong> ${escapeHtml(carePlan?.rescue_med_route || "—")}</div>
    `;

    emergencyBody.innerHTML = `
      ${buildEmergencySection("Child", `
        <div><strong>Name:</strong> ${escapeHtml(child.name || "—")}</div>
        <div><strong>Age:</strong> ${escapeHtml(childAge || "—")}</div>
        <div><strong>Diagnoses:</strong> ${escapeHtml(diagnoses)}</div>
      `)}
      ${buildEmergencySection("Allergies", escapeHtml(carePlan?.allergies || child.allergies || "None listed"))}
      ${buildEmergencySection("Baseline Vitals", baselineVitals)}
      ${buildEmergencySection(
        "Emergency Protocol",
        escapeHtml(carePlan?.seizure_protocol || "No emergency protocol added yet.")
      )}
      ${buildEmergencySection("Rescue Medication", rescueMed)}
      ${buildEmergencySection(
        "When to Call EMS",
        escapeHtml(carePlan?.ems_when || "No EMS guidance added yet.")
      )}
      ${buildEmergencySection(
        "Oxygen Guidance",
        escapeHtml(carePlan?.oxygen_guidance || "No oxygen guidance added yet.")
      )}
      ${buildEmergencySection("Medications", medList)}
      ${buildEmergencySection(
        "Daily Care Notes",
        `
          <div><strong>Feeding:</strong> ${escapeHtml(carePlan?.feeding_notes || "—")}</div>
          <div><strong>Mobility:</strong> ${escapeHtml(carePlan?.mobility_notes || "—")}</div>
          <div><strong>Communication:</strong> ${escapeHtml(carePlan?.communication_notes || "—")}</div>
          <div><strong>Calming:</strong> ${escapeHtml(carePlan?.calming_notes || "—")}</div>
        `
      )}
      ${buildEmergencySection(
        "Contacts",
        `
          <div><strong>Emergency Contacts:</strong> ${escapeHtml(carePlan?.emergency_contacts || "—")}</div>
          <div><strong>Doctor Contacts:</strong> ${escapeHtml(carePlan?.doctor_contacts || "—")}</div>
          <div><strong>Hospital:</strong> ${escapeHtml(carePlan?.preferred_hospital || "—")}</div>
        `
      )}
      ${buildEmergencySection(
        "Additional Notes",
        escapeHtml(carePlan?.additional_notes || "No additional notes.")
      )}
    `;
  }

  function getLocalScheduleFallback(childId) {
    return safeArray(generateMedicationScheduleItems?.(db, childId, new Date().toISOString().slice(0, 10)) || [])
      .map((item) => ({
        ...item,
        start_at: item.date ? `${item.date}T${item.time || "00:00"}` : null
      }));
  }

  function getLocalCareLogsFallback(childId) {
    const logsByChild = safeArray(db.logs?.[childId]);
    const careLogs = safeArray(db.careLogs);
    const merged = [
      ...careLogs.filter((x) => String(x.child_id || x.childId) === String(childId)),
      ...logsByChild
    ];

    return merged.map((item, index) => ({
      id: item.id || `local-log-${index}`,
      category: item.category || "note",
      note: item.note || "",
      author: item.author || "Parent",
      created_at: item.created_at || item.time || new Date().toISOString()
    }));
  }

  function getLocalVitalsFallback(childId) {
    const rows = safeArray(db.vitals?.[childId]);
    if (!rows.length) return [];

    const last = rows[rows.length - 1];
    return [last];
  }

  function getLocalInventoryFallback(childId) {
    return safeArray(db.inventory).filter((item) => String(item.childId) === String(childId));
  }

  function getLocalCarePlanFallback(childId) {
    const plans = db.carePlans || {};
    return plans[childId] || null;
  }

  async function saveCareLog() {
    if (!activeChild) {
      alert("No child selected.");
      return;
    }

    const client = getSupabaseClient();
    const payload = {
      child_id: activeChild.id,
      parent_id: currentUser?.id || null,
      category: categorySelect?.value || "note",
      note: noteInput?.value.trim() || "",
      author: authorInput?.value.trim() || "Parent",
      specialties: getSelectedSpecialties(),
      created_at: new Date().toISOString()
    };

    if (!payload.note) {
      alert("Please enter a note.");
      return;
    }

    let saved = false;

    if (client) {
      const { error } = await client.from("care_logs").insert(payload);
      if (!error) {
        saved = true;
      } else {
        console.warn("Failed to save care log to Supabase:", error.message);
      }
    }

    if (!saved) {
      if (!Array.isArray(db.careLogs)) db.careLogs = [];
      db.careLogs.unshift(payload);
      db = ensureDB(db);
      saveDB(db);
    }

    closeQuickLog();
    await loadDashboard();
  }

  async function saveQuickVitals() {
    if (!activeChild) {
      alert("No child selected.");
      return;
    }

    const client = getSupabaseClient();

    const payload = {
      child_id: activeChild.id,
      o2_sat: quickO2?.value ? Number(quickO2.value) : null,
      temperature: quickTemp?.value ? Number(quickTemp.value) : null,
      bp_systolic: quickBpSys?.value ? Number(quickBpSys.value) : null,
      bp_diastolic: quickBpDia?.value ? Number(quickBpDia.value) : null,
      heart_rate: quickHr?.value ? Number(quickHr.value) : null,
      respiratory_rate: quickRr?.value ? Number(quickRr.value) : null,
      notes: quickVitalNotes?.value.trim() || "",
      taken_at: new Date().toISOString()
    };

    const hasAnyValue =
      payload.o2_sat !== null ||
      payload.temperature !== null ||
      payload.bp_systolic !== null ||
      payload.bp_diastolic !== null ||
      payload.heart_rate !== null ||
      payload.respiratory_rate !== null ||
      payload.notes;

    if (!hasAnyValue) {
      alert("Please enter at least one vital.");
      return;
    }

    let saved = false;

    if (client) {
      const { error } = await client.from("vitals").insert(payload);
      if (!error) {
        saved = true;
      } else {
        console.warn("Failed to save vitals to Supabase:", error.message);
      }
    }

    if (!saved) {
      if (!db.vitals || typeof db.vitals !== "object") db.vitals = {};
      if (!Array.isArray(db.vitals[activeChild.id])) db.vitals[activeChild.id] = [];
      db.vitals[activeChild.id].push(payload);
      db = ensureDB(db);
      saveDB(db);
    }

    closeVitalsModal();
    await loadDashboard();
  }

  async function loadDashboard() {
    activeChild = getActiveChildFromDB();

    if (!activeChild) {
      renderChildSummaryCard(null);
      renderTodayList([]);
      renderCareLogs([]);
      hide(lastVitalsCard);
      hide(lowSupplyCard);
      hide(lastSymptomCard);
      renderEmergencySheet(null, null, []);
      return;
    }

    renderChildSummaryCard(activeChild);

    const [
      scheduleItemsRaw,
      careLogsRaw,
      symptomRaw,
      vitalsRaw,
      inventoryRaw,
      medicationsRaw,
      carePlan
    ] = await Promise.all([
      fetchSchedule(activeChild.id),
      fetchCareLogs(activeChild.id),
      fetchAllCareLogsForSymptom(activeChild.id),
      fetchVitals(activeChild.id),
      fetchInventory(activeChild.id),
      fetchMedications(activeChild.id),
      fetchCarePlan(activeChild.id)
    ]);

    const localSchedule = getLocalScheduleFallback(activeChild.id);
    const localLogs = getLocalCareLogsFallback(activeChild.id);
    const localVitals = getLocalVitalsFallback(activeChild.id);
    const localInventory = getLocalInventoryFallback(activeChild.id);
    const localCarePlan = getLocalCarePlanFallback(activeChild.id);

    const scheduleItems = normalizeScheduleItems(
      scheduleItemsRaw.length ? scheduleItemsRaw : localSchedule
    );

    const careLogs = normalizeCareLogs(careLogsRaw.length ? careLogsRaw : localLogs);

    const symptomLog = normalizeCareLogs(
      symptomRaw.length ? symptomRaw : careLogs.filter((x) => x.category === "symptom").slice(0, 1)
    )[0];

    const vitals = (vitalsRaw.length ? vitalsRaw : localVitals)[0] || null;
    const inventory = inventoryRaw.length ? inventoryRaw : localInventory;

    const todayItems = scheduleItems.filter((item) => {
      if (item.start_at) return isToday(item.start_at);
      return false;
    });

    renderTodayList(todayItems.length ? todayItems : scheduleItems.slice(0, 5));
    renderCareLogs(careLogs.slice(0, 5));
    renderLastVitals(vitals);
    renderInventory(inventory);
    renderLastSymptom(symptomLog);
    renderEmergencySheet(activeChild, carePlan || localCarePlan, medicationsRaw);
  }

  async function syncChildrenFromSupabase() {
    currentUser = await fetchUser();

    if (currentUser?.id) {
      const fetchedChildren = await fetchChildren(currentUser.id);
      if (fetchedChildren.length) {
        db.children = fetchedChildren;
      } else {
        db.children = [];
      }
    } else {
      db.children = [];
    }

    const validActive =
      db.children.find((c) => String(c.id) === String(db.activeChildId || db.currentChildId)) ||
      db.children[0] ||
      null;

    db.activeChildId = validActive ? validActive.id : null;
    db.currentChildId = db.activeChildId;

    db = ensureDB(db);
    saveDB(db);

    children = getChildrenSafe();
    activeChild = getActiveChildFromDB();
  }

  async function init() {
    db = loadDB();
    fillSpecialties(safeArray(db.specialties));

    await syncChildrenFromSupabase();
    renderChildSwitcher();
    await loadDashboard();

    childSwitcher?.addEventListener("change", async (e) => {
      setActiveChildId(e.target.value);
      activeChild = getActiveChildFromDB();
      renderChildSwitcher();
      await loadDashboard();
    });

    logoutBtn?.addEventListener("click", async () => {
      if (supabase?.auth) {
        await supabase.auth.signOut();
      }
      window.location.href = "login.html";
    });

    quickCategoryButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        openQuickLog(btn.dataset.category || "note");
      });
    });

    btnCloseModal?.addEventListener("click", closeQuickLog);
    btnSave?.addEventListener("click", saveCareLog);

    quickVitalButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        openVitalsModal(btn.dataset.quickVital || "full");
      });
    });

    btnCloseVitalsModal?.addEventListener("click", closeVitalsModal);
    btnSaveQuickVitals?.addEventListener("click", saveQuickVitals);

    btnEmergency?.addEventListener("click", () => show(emergencyModal));
    btnCloseEmergency?.addEventListener("click", () => hide(emergencyModal));

    modal?.addEventListener("click", (e) => {
      if (e.target === modal) closeQuickLog();
    });

    vitalsModal?.addEventListener("click", (e) => {
      if (e.target === vitalsModal) closeVitalsModal();
    });

    emergencyModal?.addEventListener("click", (e) => {
      if (e.target === emergencyModal) hide(emergencyModal);
    });
  }

  await init();
});
