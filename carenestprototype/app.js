document.addEventListener("DOMContentLoaded", () => {
  let db = ensureDB(loadDB());
  saveDB(db);

  // Elements
  const welcomeText = document.getElementById("welcomeText");
  const childName = document.getElementById("childName");
  const childSummary = document.getElementById("childSummary");
  const diagnosisPills = document.getElementById("diagnosisPills");
  const childSwitcher = document.getElementById("childSwitcher");

  const todayList = document.getElementById("todayList");
  const careLogList = document.getElementById("careLogList");
  const homeScheduleList = document.getElementById("homeScheduleList");

  const lowSupplyCard = document.getElementById("lowSupplyCard");
  const lowSupplySummary = document.getElementById("lowSupplySummary");
  const lowSupplyDashboardList = document.getElementById("lowSupplyDashboardList");

  const lastVitalsCard = document.getElementById("lastVitalsCard");
  const lastVitalsContent = document.getElementById("lastVitalsContent");

  const lastSymptomCard = document.getElementById("lastSymptomCard");
  const lastSymptomContent = document.getElementById("lastSymptomContent");

  const modal = document.getElementById("modal");
  const categorySelect = document.getElementById("categorySelect");
  const noteInput = document.getElementById("noteInput");
  const authorInput = document.getElementById("authorInput");
  const specialtyChecks = document.getElementById("specialtyChecks");
  const btnCloseModal = document.getElementById("btnCloseModal");
  const btnSave = document.getElementById("btnSave");

  const vitalsModal = document.getElementById("vitalsModal");
  const btnCloseVitalsModal = document.getElementById("btnCloseVitalsModal");
  const btnSaveQuickVitals = document.getElementById("btnSaveQuickVitals");
  const quickO2 = document.getElementById("quickO2");
  const quickTemp = document.getElementById("quickTemp");
  const quickBpSys = document.getElementById("quickBpSys");
  const quickBpDia = document.getElementById("quickBpDia");
  const quickHr = document.getElementById("quickHr");
  const quickRr = document.getElementById("quickRr");
  const quickVitalNotes = document.getElementById("quickVitalNotes");
  const wrapO2 = document.getElementById("wrapO2");
  const wrapTemp = document.getElementById("wrapTemp");
  const wrapBpSys = document.getElementById("wrapBpSys");
  const wrapBpDia = document.getElementById("wrapBpDia");
  const wrapHr = document.getElementById("wrapHr");
  const wrapRr = document.getElementById("wrapRr");

  const emergencyModal = document.getElementById("emergencyModal");
  const emergencyBody = document.getElementById("emergencyBody");
  const btnEmergency = document.getElementById("btnEmergency");
  const btnCloseEmergency = document.getElementById("btnCloseEmergency");
  const bottomEmergencyBtn = document.querySelector(".emergency-btn");

  const required = {
    childSummary,
    childSwitcher,
    todayList,
    careLogList,
    modal,
    categorySelect,
    noteInput,
    authorInput,
    specialtyChecks,
    btnCloseModal,
    btnSave,
    emergencyModal,
    emergencyBody,
    btnCloseEmergency
  };

  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    alert("Missing elements in index.html: " + missing.join(", "));
    return;
  }

  function calculateAge(birthdate) {
    const birth = new Date(birthdate);
    if (Number.isNaN(birth.getTime())) return "—";

    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();

    const hadBirthdayThisYear =
      today.getMonth() > birth.getMonth() ||
      (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());

    if (!hadBirthdayThisYear) age -= 1;
    return age;
  }

  async function syncChildrenFromSupabase() {
    const {
      data: { user },
      error: userError
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      window.location.href = "login.html";
      return false;
    }

    const { data: children, error: childrenError } = await supabaseClient
      .from("children")
      .select("*")
      .eq("parent_id", user.id)
      .order("created_at", { ascending: true });

    if (childrenError) {
      console.error("Error loading children from Supabase:", childrenError);
      alert("Could not load child profile from Supabase.");
      return false;
    }

    if (!children || children.length === 0) {
      window.location.href = "onboarding.html";
      return false;
    }

    const childIds = children.map((child) => child.id);

    const { data: careProfiles, error: careError } = await supabaseClient
      .from("child_care_profiles")
      .select("*")
      .in("child_id", childIds);

    if (careError) {
      console.error("Error loading care profiles:", careError);
    }

    const { data: equipmentProfiles, error: equipmentError } = await supabaseClient
      .from("child_equipment_profiles")
      .select("*")
      .in("child_id", childIds);

    if (equipmentError) {
      console.error("Error loading equipment profiles:", equipmentError);
    }

    db.children = children.map((child) => {
      const careProfile =
        (careProfiles || []).find((row) => row.child_id === child.id) || {};

      const equipmentProfile =
        (equipmentProfiles || []).find((row) => row.child_id === child.id) || {};

      return {
        id: child.id,
        name: child.name || "Child",
        age: child.birthdate ? calculateAge(child.birthdate) : "—",
        diagnoses: child.diagnoses
          ? child.diagnoses.split(",").map((d) => d.trim()).filter(Boolean)
          : [],
        allergies: child.allergies || "",
        notes: child.notes || "",
        complexityLevel: child.complexity_level || "moderate",
        careProfile,
        equipmentProfile,
        emergency: {
          allergies: child.allergies || "",
          trach: {
            hasTrach: !!equipmentProfile.trach
          },
          vent: {
            onVent: !!equipmentProfile.ventilator
          },
          gTube: {
            hasGTube: !!equipmentProfile.g_tube
          },
          oxygen: {
            hasOxygen: !!equipmentProfile.oxygen
          }
        }
      };
    });

    const validActiveChild = db.children.find((c) => c.id === db.activeChildId);

    if (!validActiveChild) {
      db.activeChildId = db.children[0].id;
    }

    db.currentChildId = db.activeChildId;

    saveDB(db);
    return true;
  }

  function activeChild() {
    const children = Array.isArray(db.children) ? db.children : [];
    if (!children.length) return null;
    return children.find((c) => c.id === db.activeChildId) || children[0];
  }

  function activeLogs() {
    if (!db.logs || typeof db.logs !== "object") db.logs = {};
    if (!db.activeChildId) return [];
    if (!Array.isArray(db.logs[db.activeChildId])) db.logs[db.activeChildId] = [];
    return db.logs[db.activeChildId];
  }

  function activeSchedules() {
    if (!db.schedules || typeof db.schedules !== "object") db.schedules = {};
    if (!db.activeChildId) return [];
    if (!Array.isArray(db.schedules[db.activeChildId])) db.schedules[db.activeChildId] = [];
    return db.schedules[db.activeChildId];
  }

  function activeLowSupplies() {
    if (!db.dashboard || typeof db.dashboard !== "object") db.dashboard = {};
    if (!Array.isArray(db.dashboard.lowSupplies)) db.dashboard.lowSupplies = [];
    return db.dashboard.lowSupplies;
  }

  function activeVitals() {
    if (!db.vitals || typeof db.vitals !== "object") db.vitals = {};
    if (!db.activeChildId) return [];
    if (!Array.isArray(db.vitals[db.activeChildId])) db.vitals[db.activeChildId] = [];
    return db.vitals[db.activeChildId];
  }

  function activeLastKnownVitals() {
    if (!db.lastKnownVitals || typeof db.lastKnownVitals !== "object") {
      db.lastKnownVitals = {};
    }

    if (!db.activeChildId) return createEmptyLastKnownVitals();

    if (!db.lastKnownVitals[db.activeChildId]) {
      db.lastKnownVitals[db.activeChildId] = createEmptyLastKnownVitals();
    }

    return db.lastKnownVitals[db.activeChildId];
  }

  function createEmptyLastKnownVitals() {
    return {
      o2: null,
      temp: null,
      bpSys: null,
      bpDia: null,
      hr: null,
      rr: null
    };
  }

  function activeSymptoms() {
    if (!db.symptoms || typeof db.symptoms !== "object") db.symptoms = {};
    if (!db.activeChildId) return [];
    if (!Array.isArray(db.symptoms[db.activeChildId])) db.symptoms[db.activeChildId] = [];
    return db.symptoms[db.activeChildId];
  }

  function activeVitalThresholds() {
    if (!db.vitalThresholds || typeof db.vitalThresholds !== "object") db.vitalThresholds = {};
    if (!db.activeChildId) return {};

    if (!db.vitalThresholds[db.activeChildId]) {
      db.vitalThresholds[db.activeChildId] = {
        o2Min: 92,
        tempMin: 97.0,
        tempMax: 100.4,
        bpSysMin: 90,
        bpSysMax: 120,
        bpDiaMin: 60,
        bpDiaMax: 80,
        hrMin: 60,
        hrMax: 100,
        rrMin: 12,
        rrMax: 20
      };
    }

    return db.vitalThresholds[db.activeChildId];
  }

  function fillChildSwitcher() {
    childSwitcher.innerHTML = "";
    const children = Array.isArray(db.children) ? db.children : [];

    children.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      childSwitcher.appendChild(opt);
    });

    childSwitcher.value = db.activeChildId || "";
  }

  function getAllowedSpecialties() {
    const child = activeChild();
    const care = child?.careProfile || {};
    const equipment = child?.equipmentProfile || {};

    if (Array.isArray(child?.selectedSpecialties) && child.selectedSpecialties.length) {
      return child.selectedSpecialties;
    }

    const derived = ["General"];

    if (care.has_respiratory || equipment.oxygen || equipment.trach || equipment.ventilator) {
      derived.push("Pulmonology");
    }

    if (care.has_cardiology || equipment.heart_rate_monitoring || equipment.blood_pressure_monitoring) {
      derived.push("Cardiology");
    }

    if (care.has_feeds || equipment.g_tube || equipment.j_tube || equipment.feeding_pump) {
      derived.push("GI");
    }

    if (care.has_therapies) {
      derived.push("PT/OT");
    }

    if (care.has_symptoms) {
      derived.push("Neurology");
    }

    if (Array.isArray(db.specialties) && db.specialties.length) {
      const merged = [...new Set([...derived, ...db.specialties])];
      return merged;
    }

    return [...new Set(derived)];
  }

  function renderSpecialtyChecks(defaultSelected = []) {
    specialtyChecks.innerHTML = "";

    const allowed = getAllowedSpecialties();
    const list = allowed.filter((s) => s !== "General");

    if (!list.length) {
      specialtyChecks.innerHTML = `<div class="muted tiny">General only.</div>`;
      return;
    }

    list.forEach((s) => {
      const id = "spec_" + s.replace(/\W+/g, "_");
      const label = document.createElement("label");
      label.className = "chip";
      label.style.cursor = "pointer";
      label.style.display = "inline-flex";
      label.style.alignItems = "center";
      label.style.gap = "8px";

      label.innerHTML = `
        <input type="checkbox" id="${id}" value="${s}" />
        <span>${s}</span>
      `;

      specialtyChecks.appendChild(label);

      const box = label.querySelector("input");
      if (defaultSelected.includes(s)) box.checked = true;
    });
  }

  function getSelectedSpecialties() {
    const checked = [...specialtyChecks.querySelectorAll('input[type="checkbox"]:checked')].map((x) => x.value);
    return checked.length ? checked : ["General"];
  }

  function categoryLabel(value) {
    const map = {
      symptom: "Symptom",
      question: "Question",
      note: "Care Note",
      med: "Medication"
    };

    return map[value] || "Entry";
  }

  function fmtDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown time";

    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function parseISODateLocal(dateStr) {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function isSameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function isTaskScheduledOnDate(task, date) {
    if (task.active === false) return false;

    const startDate = task.startDate
      ? parseISODateLocal(task.startDate)
      : new Date(task.startAt);

    const targetDate = startOfDay(date);
    const taskStartDay = startOfDay(startDate);

    if (targetDate < taskStartDay) return false;

    if (task.frequency === "once") return isSameDay(taskStartDay, targetDate);
    if (task.frequency === "daily") return true;

    if (task.frequency === "weekly") {
      const weekdays = Array.isArray(task.weekdays) ? task.weekdays : [];
      return weekdays.includes(targetDate.getDay());
    }

    if (task.frequency === "monthly") {
      return taskStartDay.getDate() === targetDate.getDate();
    }

    return false;
  }

  function getOccurrenceDate(task, baseDate) {
    return new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate(),
      Number(task.time?.split(":")[0] || 0),
      Number(task.time?.split(":")[1] || 0),
      0,
      0
    );
  }

  function formatTaskTime(timeValue) {
    if (!timeValue) return "No time";

    const [h, m] = timeValue.split(":").map(Number);
    const date = new Date();
    date.setHours(h || 0, m || 0, 0, 0);

    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function getTaskMeta(category) {
    const map = {
      Medication: { cls: "med", icon: "💊" },
      Feeding: { cls: "gi", icon: "🍼" },
      Therapy: { cls: "general", icon: "🤸" },
      "Symptom Check": { cls: "neuro", icon: "🩺" },
      "Respiratory Care": { cls: "pulm", icon: "🫁" },
      Equipment: { cls: "card", icon: "🧰" },
      Hygiene: { cls: "general", icon: "🧼" },
      Appointment: { cls: "card", icon: "📅" },
      Other: { cls: "general", icon: "📝" }
    };

    return map[category] || { cls: "general", icon: "📝" };
  }

  function toDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function getManualScheduleOccurrences(fromDate = new Date(), daysAhead = 7) {
    const tasks = activeSchedules();
    const occurrences = [];

    for (let offset = 0; offset < daysAhead; offset++) {
      const date = new Date(fromDate);
      date.setDate(fromDate.getDate() + offset);

      tasks.forEach((task) => {
        if (!isTaskScheduledOnDate(task, date)) return;

        const occurrenceDate = getOccurrenceDate(task, date);
        if (occurrenceDate.getTime() < fromDate.getTime()) return;

        occurrences.push({
          id: `manual_${task.id}_${toDateKey(date)}_${task.time || ""}`,
          source: "manual",
          title: task.title || "Task",
          category: task.category || "Other",
          instructions: task.instructions || "",
          assignedTo: task.assignedTo || "",
          time: task.time || "",
          occurrenceDate,
          dateKey: toDateKey(date),
          rawTask: task
        });
      });
    }

    return occurrences;
  }

  function getMedicationScheduleOccurrences(fromDate = new Date(), daysAhead = 7) {
    const child = activeChild();
    if (!child) return [];

    if (typeof generateMedicationScheduleItems !== "function") {
      return [];
    }

    const occurrences = [];

    for (let offset = 0; offset < daysAhead; offset++) {
      const date = new Date(fromDate);
      date.setDate(fromDate.getDate() + offset);

      const dateKey = toDateKey(date);
      const medItems = generateMedicationScheduleItems(db, child.id, dateKey);

      medItems.forEach((item) => {
        const [h, m] = String(item.time || "00:00").split(":").map(Number);

        const occurrenceDate = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          Number.isFinite(h) ? h : 0,
          Number.isFinite(m) ? m : 0,
          0,
          0
        );

        if (occurrenceDate.getTime() < fromDate.getTime()) return;

        occurrences.push({
          id: item.id,
          source: "medication",
          medId: item.medId,
          title: item.title || "Medication",
          category: item.category || "Medication",
          instructions: item.instructions || item.note || "",
          assignedTo: "",
          time: item.time || "",
          occurrenceDate,
          dateKey,
          rawTask: item
        });
      });
    }

    return occurrences;
  }

  function getMergedUpcomingSchedule(fromDate = new Date(), daysAhead = 7) {
    const manual = getManualScheduleOccurrences(fromDate, daysAhead);
    const meds = getMedicationScheduleOccurrences(fromDate, daysAhead);
    return [...manual, ...meds].sort((a, b) => a.occurrenceDate - b.occurrenceDate);
  }

  function getDoseEventForMedicationAndTime(medId, dateKey, scheduledTime) {
    return (db.doseEvents || []).find((log) => {
      if (log.medId !== medId) return false;
      if (log.scheduledTime !== scheduledTime) return false;
      if (log.type !== "scheduled" && log.type !== "skip") return false;

      const stamp = log.time || log.loggedAt || log.scheduledFor;
      if (!stamp) return false;

      const logDate = new Date(stamp);
      if (Number.isNaN(logDate.getTime())) return false;

      return toDateKey(logDate) === dateKey;
    }) || null;
  }

  function logMedicationDoseFromDashboard(item) {
    const child = activeChild();
    if (!child) return;

    if (!Array.isArray(db.doseEvents)) db.doseEvents = [];

    const existing = getDoseEventForMedicationAndTime(item.medId, item.dateKey, item.time);
    if (existing?.type === "scheduled") {
      alert("This dose is already logged.");
      return;
    }

    if (existing?.type === "skip") {
      db.doseEvents = db.doseEvents.filter((evt) => evt.id !== existing.id);
    }

    db.doseEvents.unshift({
      id: crypto?.randomUUID ? crypto.randomUUID() : `dose_${Date.now()}`,
      childId: child.id,
      medId: item.medId,
      type: "scheduled",
      scheduledTime: item.time,
      time: new Date().toISOString(),
      loggedAt: new Date().toISOString(),
      note: item.instructions || "",
      medicationName: item.title || "",
      scheduledFor: item.occurrenceDate.toISOString()
    });

    saveDB(db);
    render();
  }

  function skipMedicationDoseFromDashboard(item) {
    const child = activeChild();
    if (!child) return;

    if (!Array.isArray(db.doseEvents)) db.doseEvents = [];

    const existing = getDoseEventForMedicationAndTime(item.medId, item.dateKey, item.time);
    if (existing?.type === "skip") {
      alert("This dose is already marked skipped.");
      return;
    }

    if (existing?.type === "scheduled") {
      db.doseEvents = db.doseEvents.filter((evt) => evt.id !== existing.id);
    }

    db.doseEvents.unshift({
      id: crypto?.randomUUID ? crypto.randomUUID() : `dose_${Date.now()}`,
      childId: child.id,
      medId: item.medId,
      type: "skip",
      scheduledTime: item.time,
      time: new Date().toISOString(),
      loggedAt: new Date().toISOString(),
      note: item.instructions ? `Skipped • ${item.instructions}` : "Skipped from dashboard",
      medicationName: item.title || "",
      scheduledFor: item.occurrenceDate.toISOString()
    });

    saveDB(db);
    render();
  }

  function undoMedicationDoseFromDashboard(item) {
    const existing = getDoseEventForMedicationAndTime(item.medId, item.dateKey, item.time);
    if (!existing) return;

    db.doseEvents = (db.doseEvents || []).filter((evt) => evt.id !== existing.id);
    saveDB(db);
    render();
  }

  function updateLastKnownVitalField(field, value, createdAt, notes = "") {
    const snapshot = activeLastKnownVitals();

    snapshot[field] = {
      value,
      createdAt,
      notes
    };
  }

  function buildVitalHistoryEntries(payload) {
    const createdAt = Date.now();
    const notes = payload.notes || "";
    const entries = [];

    if (payload.o2 != null) {
      entries.push({
        id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
        createdAt,
        type: "o2",
        label: "Oxygen Saturation",
        value: Number(payload.o2),
        unit: "%",
        notes
      });
      updateLastKnownVitalField("o2", Number(payload.o2), createdAt, notes);
    }

    if (payload.temp != null) {
      entries.push({
        id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
        createdAt,
        type: "temp",
        label: "Temperature",
        value: Number(payload.temp),
        unit: "°F",
        notes
      });
      updateLastKnownVitalField("temp", Number(payload.temp), createdAt, notes);
    }

    if (payload.bpSys != null || payload.bpDia != null) {
      const sys = payload.bpSys != null ? Number(payload.bpSys) : null;
      const dia = payload.bpDia != null ? Number(payload.bpDia) : null;

      entries.push({
        id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
        createdAt,
        type: "bp",
        label: "Blood Pressure",
        value: `${sys ?? "—"}/${dia ?? "—"}`,
        unit: "",
        bpSys: sys,
        bpDia: dia,
        notes
      });

      if (sys != null) updateLastKnownVitalField("bpSys", sys, createdAt, notes);
      if (dia != null) updateLastKnownVitalField("bpDia", dia, createdAt, notes);
    }

    if (payload.hr != null) {
      entries.push({
        id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
        createdAt,
        type: "hr",
        label: "Heart Rate",
        value: Number(payload.hr),
        unit: "bpm",
        notes
      });
      updateLastKnownVitalField("hr", Number(payload.hr), createdAt, notes);
    }

    if (payload.rr != null) {
      entries.push({
        id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
        createdAt,
        type: "rr",
        label: "Respiratory Rate",
        value: Number(payload.rr),
        unit: "/min",
        notes
      });
      updateLastKnownVitalField("rr", Number(payload.rr), createdAt, notes);
    }

    return entries;
  }

  function renderHeader() {
    const child = activeChild();
    const care = child?.careProfile || {};

    if (welcomeText) {
      const activeAreas = [
        care.has_medications ? "meds" : null,
        care.has_feeds ? "feeds" : null,
        care.has_respiratory ? "respiratory" : null,
        care.has_cardiology ? "cardiology" : null
      ].filter(Boolean);

      welcomeText.textContent = activeAreas.length
        ? `Managing ${activeAreas.join(", ")}`
        : "Welcome back";
    }

    if (!child) return;

    if (childName) {
      childName.textContent = child.name || "Child";
    }

    if (childSummary) {
      const diagnoses = Array.isArray(child.diagnoses) ? child.diagnoses : [];
      childSummary.textContent = `Age ${child.age ?? "—"}${diagnoses.length ? ` • ${diagnoses.join(" • ")}` : ""}`;
    }

    if (diagnosisPills) {
      diagnosisPills.innerHTML = "";
      const diagnoses = Array.isArray(child.diagnoses) ? child.diagnoses : [];
      diagnoses.forEach((dx) => {
        const pill = document.createElement("span");
        pill.className = "pill";
        pill.textContent = dx;
        diagnosisPills.appendChild(pill);
      });
    }
  }

  function applyAdaptiveUI() {
    const child = activeChild();
    if (!child) return;

    const care = child.careProfile || {};
    const equipment = child.equipmentProfile || {};

    const showVitals =
      !!care.has_respiratory ||
      !!care.has_cardiology ||
      !!equipment.oxygen ||
      !!equipment.pulse_ox ||
      !!equipment.heart_rate_monitoring ||
      !!equipment.blood_pressure_monitoring ||
      !!equipment.cardiac_monitor;

    const showInventory = !!care.has_inventory;
    const showSymptoms = !!care.has_symptoms;

    if (lastVitalsCard && !showVitals) {
      lastVitalsCard.classList.add("hidden");
    }

    if (lowSupplyCard && !showInventory) {
      lowSupplyCard.classList.add("hidden");
    }

    if (lastSymptomCard && !showSymptoms) {
      lastSymptomCard.classList.add("hidden");
    }

    const emergencyButtonShouldShow =
      !!care.has_respiratory ||
      !!care.has_cardiology ||
      !!care.has_feeds ||
      !!care.has_medications ||
      !!equipment.trach ||
      !!equipment.ventilator ||
      !!equipment.g_tube ||
      !!equipment.oxygen;

    if (bottomEmergencyBtn) {
      bottomEmergencyBtn.classList.toggle("hidden", !emergencyButtonShouldShow);
    }
  }

  function renderHomeSchedule() {
    if (!homeScheduleList) return;

    const now = new Date();
    const upcoming = getMergedUpcomingSchedule(now, 7);

    homeScheduleList.innerHTML = "";

    if (!upcoming.length) {
      homeScheduleList.innerHTML = `<div class="empty-state">No upcoming schedule items.</div>`;
      return;
    }

    upcoming.slice(0, 3).forEach((item) => {
      const meta = getTaskMeta(item.category);
      const card = document.createElement("div");
      card.className = "log-card";

      const dateLabel = item.occurrenceDate.toLocaleDateString([], {
        month: "short",
        day: "numeric"
      });

      const medSourceText = item.source === "medication" ? " • Medication" : "";
      const existingLog =
        item.source === "medication"
          ? getDoseEventForMedicationAndTime(item.medId, item.dateKey, item.time)
          : null;

      let statusLabel = item.category;
      if (item.source === "medication") {
        if (existingLog?.type === "scheduled") statusLabel = "Dose Logged";
        else if (existingLog?.type === "skip") statusLabel = "Skipped";
      }

      card.innerHTML = `
        <div class="log-icon ${meta.cls}">${meta.icon}</div>
        <div class="log-main">
          <h3>
            ${item.title}
            <span class="time">${formatTaskTime(item.time)}</span>
          </h3>
          <p>${item.instructions || "Scheduled care task."}</p>
          <p class="muted mt-8">
            ${dateLabel} • ${item.category}${item.assignedTo ? ` • ${item.assignedTo}` : ""}${medSourceText}
          </p>
        </div>
        <div class="log-side">
          <span class="log-tag ${meta.cls}">${statusLabel}</span>
        </div>
      `;

      const actions = document.createElement("div");
      actions.className = "row";
      actions.style.marginTop = "12px";

      if (item.source === "medication") {
        if (existingLog?.type === "scheduled") {
          const undoBtn = document.createElement("button");
          undoBtn.className = "btn btn-ghost";
          undoBtn.type = "button";
          undoBtn.textContent = "Undo Log";
          undoBtn.addEventListener("click", () => undoMedicationDoseFromDashboard(item));
          actions.appendChild(undoBtn);
        } else if (existingLog?.type === "skip") {
          const undoBtn = document.createElement("button");
          undoBtn.className = "btn btn-ghost";
          undoBtn.type = "button";
          undoBtn.textContent = "Undo Skip";
          undoBtn.addEventListener("click", () => undoMedicationDoseFromDashboard(item));
          actions.appendChild(undoBtn);
        } else {
          const logBtn = document.createElement("button");
          logBtn.className = "btn";
          logBtn.type = "button";
          logBtn.textContent = "Log Dose";
          logBtn.addEventListener("click", () => logMedicationDoseFromDashboard(item));
          actions.appendChild(logBtn);

          const skipBtn = document.createElement("button");
          skipBtn.className = "btn btn-ghost";
          skipBtn.type = "button";
          skipBtn.textContent = "Skip";
          skipBtn.addEventListener("click", () => skipMedicationDoseFromDashboard(item));
          actions.appendChild(skipBtn);
        }

        const openMedsBtn = document.createElement("a");
        openMedsBtn.className = "btn btn-ghost";
        openMedsBtn.href = "meds.html";
        openMedsBtn.textContent = "Open Meds";
        actions.appendChild(openMedsBtn);
      }

      card.querySelector(".log-main").appendChild(actions);
      homeScheduleList.appendChild(card);
    });
  }

  function renderLowSupplies() {
    if (!lowSupplyCard || !lowSupplySummary || !lowSupplyDashboardList) return;

    const lowSupplies = activeLowSupplies();

    if (!lowSupplies.length) {
      lowSupplyCard.classList.add("hidden");
      lowSupplySummary.textContent = "";
      lowSupplyDashboardList.innerHTML = "";
      return;
    }

    lowSupplyCard.classList.remove("hidden");

    lowSupplySummary.textContent =
      lowSupplies.length === 1
        ? "1 item needs attention."
        : `${lowSupplies.length} items need attention.`;

    lowSupplyDashboardList.innerHTML = lowSupplies
      .map((item) => {
        const isOut = item.status === "out" || Number(item.quantity) <= 0;
        const statusText = isOut
          ? "Out of stock"
          : `${item.quantity} ${item.unit || "count"} left`;

        return `
          <div class="log-card">
            <div class="log-icon ${isOut ? "med" : "general"}">${isOut ? "⚠️" : "📦"}</div>
            <div class="log-main">
              <h3>${item.name}</h3>
              <p>${item.category || "Supply"}</p>
              <p class="muted mt-8">Low alert at ${item.low}</p>
            </div>
            <div class="log-side">
              <span class="log-tag ${isOut ? "med" : "general"}">${statusText}</span>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderLastVitals() {
    if (!lastVitalsCard || !lastVitalsContent) return;

    const snapshot = activeLastKnownVitals();
    const t = activeVitalThresholds();

    const hasAny =
      snapshot.o2 || snapshot.temp || snapshot.bpSys ||
      snapshot.bpDia || snapshot.hr || snapshot.rr;

    if (!hasAny) {
      lastVitalsCard.classList.add("hidden");
      lastVitalsContent.innerHTML = "";
      return;
    }

    const o2 = snapshot.o2?.value ?? "—";
    const temp = snapshot.temp?.value ?? "—";
    const bpSys = snapshot.bpSys?.value ?? "—";
    const bpDia = snapshot.bpDia?.value ?? "—";
    const hr = snapshot.hr?.value ?? "—";
    const rr = snapshot.rr?.value ?? "—";

    const latestTimes = [
      snapshot.o2?.createdAt,
      snapshot.temp?.createdAt,
      snapshot.bpSys?.createdAt,
      snapshot.bpDia?.createdAt,
      snapshot.hr?.createdAt,
      snapshot.rr?.createdAt
    ].filter(Boolean);

    const newestTime = latestTimes.length ? Math.max(...latestTimes) : null;
    const flags = [];

    if (snapshot.o2?.value != null && snapshot.o2.value < t.o2Min) flags.push("Low O2");
    if (snapshot.temp?.value != null && (snapshot.temp.value < t.tempMin || snapshot.temp.value > t.tempMax)) flags.push("Temp");
    if (snapshot.bpSys?.value != null && (snapshot.bpSys.value < t.bpSysMin || snapshot.bpSys.value > t.bpSysMax)) flags.push("Sys BP");
    if (snapshot.bpDia?.value != null && (snapshot.bpDia.value < t.bpDiaMin || snapshot.bpDia.value > t.bpDiaMax)) flags.push("Dia BP");
    if (snapshot.hr?.value != null && (snapshot.hr.value < t.hrMin || snapshot.hr.value > t.hrMax)) flags.push("HR");
    if (snapshot.rr?.value != null && (snapshot.rr.value < t.rrMin || snapshot.rr.value > t.rrMax)) flags.push("RR");

    lastVitalsCard.classList.remove("hidden");
    lastVitalsContent.innerHTML = `
      <div class="strong" style="margin-bottom:8px;">
        O2 ${o2}% • Temp ${temp}°F • BP ${bpSys}/${bpDia} • HR ${hr} • RR ${rr}
      </div>
      <div class="muted tiny" style="margin-bottom:8px;">
        ${newestTime ? `Last updated ${fmtDateTime(newestTime)}` : "No time available"}
      </div>
      ${
        flags.length
          ? `<div class="badge" style="background:#fee2e2;color:#991b1b;">Alert: ${flags.join(", ")}</div>`
          : `<div class="badge">Within thresholds</div>`
      }
    `;
  }

  function renderLastSymptom() {
    if (!lastSymptomCard || !lastSymptomContent) return;

    const rows = activeSymptoms().slice().sort((a, b) => {
      const aTime = new Date(a.createdAt || a.time || 0).getTime();
      const bTime = new Date(b.createdAt || b.time || 0).getTime();
      return bTime - aTime;
    });

    const latest = rows[0];

    if (!latest) {
      lastSymptomCard.classList.add("hidden");
      lastSymptomContent.innerHTML = "";
      return;
    }

    const severity = latest.severity || "Mild";
    const tagClass =
      severity === "Severe"
        ? "med"
        : severity === "Moderate"
        ? "gi"
        : "general";

    lastSymptomCard.classList.remove("hidden");
    lastSymptomContent.innerHTML = `
      <div class="strong" style="margin-bottom:8px;">
        ${latest.symptom || latest.note || "Symptom"}
      </div>
      <div class="muted tiny" style="margin-bottom:8px;">
        ${fmtDateTime(latest.createdAt || latest.time)} • ${latest.specialty || "General"}
      </div>
      <div style="margin-bottom:8px;">
        <span class="log-tag ${tagClass}">${severity}</span>
      </div>
      ${
        latest.note
          ? `<div class="muted">${latest.note}</div>`
          : ``
      }
    `;
  }

  function resetQuickVitalsForm() {
    if (quickO2) quickO2.value = "";
    if (quickTemp) quickTemp.value = "";
    if (quickBpSys) quickBpSys.value = "";
    if (quickBpDia) quickBpDia.value = "";
    if (quickHr) quickHr.value = "";
    if (quickRr) quickRr.value = "";
    if (quickVitalNotes) quickVitalNotes.value = "";
  }

  function showVitalFields(mode) {
    [wrapO2, wrapTemp, wrapBpSys, wrapBpDia, wrapHr, wrapRr].forEach((el) => {
      if (el) el.style.display = "";
    });

    if (!wrapO2 || !wrapTemp || !wrapBpSys || !wrapBpDia || !wrapHr || !wrapRr) return;

    if (mode === "o2") {
      wrapTemp.style.display = "none";
      wrapBpSys.style.display = "none";
      wrapBpDia.style.display = "none";
      wrapHr.style.display = "none";
      wrapRr.style.display = "none";
    }

    if (mode === "temp") {
      wrapO2.style.display = "none";
      wrapBpSys.style.display = "none";
      wrapBpDia.style.display = "none";
      wrapHr.style.display = "none";
      wrapRr.style.display = "none";
    }

    if (mode === "bp") {
      wrapO2.style.display = "none";
      wrapTemp.style.display = "none";
      wrapHr.style.display = "none";
      wrapRr.style.display = "none";
    }

    if (mode === "hr") {
      wrapO2.style.display = "none";
      wrapTemp.style.display = "none";
      wrapBpSys.style.display = "none";
      wrapBpDia.style.display = "none";
      wrapRr.style.display = "none";
    }

    if (mode === "rr") {
      wrapO2.style.display = "none";
      wrapTemp.style.display = "none";
      wrapBpSys.style.display = "none";
      wrapBpDia.style.display = "none";
      wrapHr.style.display = "none";
    }
  }

  function openVitalsModal(mode = "full") {
    if (!vitalsModal) return;
    resetQuickVitalsForm();
    showVitalFields(mode);
    vitalsModal.classList.remove("hidden");
  }

  function closeVitalsModal() {
    if (!vitalsModal) return;
    vitalsModal.classList.add("hidden");
  }

  function render() {
    const child = activeChild();
    renderHeader();
    applyAdaptiveUI();

    if (!child) {
      childSummary.textContent = "No child selected";
      todayList.innerHTML = `<li class="muted tiny">No child available.</li>`;
      careLogList.innerHTML = `<li class="muted tiny">No care log entries yet.</li>`;
      if (homeScheduleList) homeScheduleList.innerHTML = `<div class="empty-state">No upcoming schedule items.</div>`;
      if (lowSupplyCard) lowSupplyCard.classList.add("hidden");
      if (lastVitalsCard) lastVitalsCard.classList.add("hidden");
      if (lastSymptomCard) lastSymptomCard.classList.add("hidden");
      return;
    }

    todayList.innerHTML = "";

    const now = new Date();
    const todayKey = toDateKey(now);

    const todayItems = getMergedUpcomingSchedule(now, 1).filter(
      (item) => item.dateKey === todayKey
    );

    if (!todayItems.length) {
      todayList.innerHTML = `<li class="muted tiny">Nothing scheduled today.</li>`;
    } else {
      todayItems.slice(0, 5).forEach((item) => {
        const li = document.createElement("li");
        li.className = "item";

        const existingLog =
          item.source === "medication"
            ? getDoseEventForMedicationAndTime(item.medId, item.dateKey, item.time)
            : null;

        const content = document.createElement("div");
        content.style.width = "100%";

        content.innerHTML = `
          <div class="left" style="justify-content:space-between; width:100%;">
            <div class="left">
              <span class="badge">${formatTaskTime(item.time)}</span>
              <div>
                <div class="strong">${item.title}</div>
                <div class="muted tiny">
                  ${item.category}${item.source === "medication" ? " • Medication" : ""}
                  ${item.instructions ? ` • ${item.instructions}` : ""}
                </div>
              </div>
            </div>
          </div>
        `;

        if (item.source === "medication") {
          const actions = document.createElement("div");
          actions.className = "row";
          actions.style.marginTop = "10px";

          if (existingLog?.type === "scheduled") {
            const undoBtn = document.createElement("button");
            undoBtn.className = "btn btn-ghost";
            undoBtn.type = "button";
            undoBtn.textContent = "Undo Log";
            undoBtn.addEventListener("click", () => undoMedicationDoseFromDashboard(item));
            actions.appendChild(undoBtn);
          } else if (existingLog?.type === "skip") {
            const undoBtn = document.createElement("button");
            undoBtn.className = "btn btn-ghost";
            undoBtn.type = "button";
            undoBtn.textContent = "Undo Skip";
            undoBtn.addEventListener("click", () => undoMedicationDoseFromDashboard(item));
            actions.appendChild(undoBtn);
          } else {
            const logBtn = document.createElement("button");
            logBtn.className = "btn";
            logBtn.type = "button";
            logBtn.textContent = "Log Dose";
            logBtn.addEventListener("click", () => logMedicationDoseFromDashboard(item));
            actions.appendChild(logBtn);

            const skipBtn = document.createElement("button");
            skipBtn.className = "btn btn-ghost";
            skipBtn.type = "button";
            skipBtn.textContent = "Skip";
            skipBtn.addEventListener("click", () => skipMedicationDoseFromDashboard(item));
            actions.appendChild(skipBtn);
          }

          content.appendChild(actions);
        }

        li.appendChild(content);
        todayList.appendChild(li);
      });
    }

    renderHomeSchedule();
    renderLowSupplies();
    renderLastVitals();
    renderLastSymptom();

    careLogList.innerHTML = "";
    const logs = activeLogs();

    if (!logs.length) {
      careLogList.innerHTML = `<li class="muted tiny">No entries yet. Try Quick Add.</li>`;
    } else {
      logs.slice(0, 3).forEach((entry) => {
        const specs = Array.isArray(entry.specialties) && entry.specialties.length
          ? entry.specialties.join(", ")
          : "General";

        const li = document.createElement("li");
        li.className = "item";
        li.innerHTML = `
          <div class="left">
            <span class="badge">${categoryLabel(entry.category)}</span>
            <div>
              <div class="strong">${entry.note}</div>
              <div class="muted tiny">${entry.author || "Caregiver"} • ${fmtDateTime(entry.createdAt)} • ${specs}</div>
            </div>
          </div>
        `;
        careLogList.appendChild(li);
      });
    }
  }

  function openModal(category) {
    categorySelect.value = category;
    noteInput.value = "";
    authorInput.value = "Mom";
    renderSpecialtyChecks([]);
    modal.classList.remove("hidden");
    noteInput.focus();
  }

  function closeModal() {
    modal.classList.add("hidden");
  }

  function openEmergency() {
    const child = activeChild();
    if (!child) return;

    const em = child.emergency || {};
    const tr = em.trach || {};
    const ve = em.vent || {};
    const gt = em.gTube || {};
    const ox = em.oxygen || {};

    emergencyBody.innerHTML = `
      <div class="card" style="margin:0;border-radius:12px;">
        <div class="strong" style="font-size:18px;">${child.name}</div>
        <div class="muted">Age ${child.age ?? "—"}</div>
      </div>

      <div>
        <div class="strong">Diagnoses</div>
        <div class="muted">${(child.diagnoses || []).join(", ") || "None listed"}</div>
      </div>

      <div>
        <div class="strong">Allergies</div>
        <div class="muted">${em.allergies || "(Add later)"}</div>
      </div>

      <div>
        <div class="strong">Trach</div>
        <div class="muted">${tr.hasTrach ? "Yes" : "No / Not listed"}</div>
      </div>

      <div>
        <div class="strong">Vent</div>
        <div class="muted">${ve.onVent ? "Yes" : "No / Not listed"}</div>
      </div>

      <div>
        <div class="strong">G-Tube</div>
        <div class="muted">${gt.hasGTube ? "Yes" : "No / Not listed"}</div>
      </div>

      <div>
        <div class="strong">Oxygen</div>
        <div class="muted">${ox.hasOxygen ? "Yes" : "No / Not listed"}</div>
      </div>
    `;

    emergencyModal.classList.remove("hidden");
  }

  function closeEmergency() {
    emergencyModal.classList.add("hidden");
  }

  document.querySelectorAll("[data-category]").forEach((btn) => {
    btn.addEventListener("click", () => openModal(btn.dataset.category));
  });

  document.querySelectorAll("[data-quick-vital]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openVitalsModal(btn.dataset.quickVital || "full");
    });
  });

  btnCloseModal.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  if (btnCloseVitalsModal) {
    btnCloseVitalsModal.addEventListener("click", closeVitalsModal);
  }

  if (vitalsModal) {
    vitalsModal.addEventListener("click", (e) => {
      if (e.target === vitalsModal) closeVitalsModal();
    });
  }

  btnSave.addEventListener("click", () => {
    const note = noteInput.value.trim();
    const author = authorInput.value.trim() || "Caregiver";
    const category = categorySelect.value;
    const specialties = getSelectedSpecialties();

    if (!note) {
      alert("Please type a note.");
      return;
    }

    if (!db.logs || typeof db.logs !== "object") db.logs = {};
    if (!Array.isArray(db.logs[db.activeChildId])) db.logs[db.activeChildId] = [];

    db.logs[db.activeChildId].unshift({
      id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
      createdAt: Date.now(),
      author,
      category,
      note,
      specialties
    });

    saveDB(db);
    closeModal();
    render();
  });

  if (btnSaveQuickVitals) {
    btnSaveQuickVitals.addEventListener("click", () => {
      if (
        !quickO2?.value && !quickTemp?.value && !quickBpSys?.value &&
        !quickBpDia?.value && !quickHr?.value && !quickRr?.value
      ) {
        alert("Enter at least one vital.");
        return;
      }

      const payload = {
        o2: quickO2?.value ? Number(quickO2.value) : null,
        temp: quickTemp?.value ? Number(quickTemp.value) : null,
        bpSys: quickBpSys?.value ? Number(quickBpSys.value) : null,
        bpDia: quickBpDia?.value ? Number(quickBpDia.value) : null,
        hr: quickHr?.value ? Number(quickHr.value) : null,
        rr: quickRr?.value ? Number(quickRr.value) : null,
        notes: quickVitalNotes?.value.trim() || ""
      };

      const newEntries = buildVitalHistoryEntries(payload);

      if (!newEntries.length) {
        alert("Enter at least one vital.");
        return;
      }

      activeVitals().unshift(...newEntries);

      saveDB(db);
      closeVitalsModal();
      render();
    });
  }

  if (btnEmergency) btnEmergency.addEventListener("click", openEmergency);
  if (bottomEmergencyBtn) bottomEmergencyBtn.addEventListener("click", openEmergency);

  btnCloseEmergency.addEventListener("click", closeEmergency);

  emergencyModal.addEventListener("click", (e) => {
    if (e.target === emergencyModal) closeEmergency();
  });

  childSwitcher.addEventListener("change", () => {
    db.activeChildId = childSwitcher.value;
    db.currentChildId = childSwitcher.value;
    saveDB(db);
    render();
  });

  (async function initDashboard() {
    const ok = await syncChildrenFromSupabase();
    if (!ok) return;

    console.log("Loaded children:", db.children);
    console.log("Active child ID:", db.activeChildId);
    console.log("Active child object:", activeChild());

    fillChildSwitcher();
    render();
  })();
});
