// storage.js — shared localStorage database helpers
const KEY = "carenest_prototype_v1";

function loadDB() {
  const raw = localStorage.getItem(KEY);

  if (!raw) {
    return ensureDB(getDefaultDB());
  }

  try {
    return ensureDB(JSON.parse(raw));
  } catch (err) {
    console.error("Failed to parse DB, resetting:", err);
    return ensureDB(getDefaultDB());
  }
}

function saveDB(db) {
  const safeDB = ensureDB(db);
  localStorage.setItem(KEY, JSON.stringify(safeDB));
}

function getDefaultDB() {
  return {
    // auth
    users: [],
    session: { userId: null },

    // app preferences
    visitPrepSelectedSpecialty: "General",
    visitPrepDays: "7",
    visitPrepIncludePRN: true,

    specialties: [
      "General",
      "Neurology",
      "Pulmonology",
      "GI",
      "Cardiology",
      "PT/OT",
      "Primary Care"
    ],

    children: [
      {
        id: "child1",
        name: "Test Child",
        age: 6,
        diagnoses: ["Epilepsy", "Cerebral Palsy"],
        selectedSpecialties: ["General"],
        emergency: {}
      }
    ],

    // keep both for compatibility
    activeChildId: "child1",
    currentChildId: "child1",

    today: [],
    meds: [],
    logs: {},
    symptoms: {},
    schedules: {},
    visitQuestions: [],
    doseEvents: [],
    medicationChangeHistory: [],

    inventory: [
      {
        id: "inv_trach_ties",
        childId: "child1",
        name: "Trach Ties",
        category: "Tracheostomy",
        quantity: 8,
        low: 3,
        unit: "sets",
        notes: "Change per care plan",
        updated: Date.now()
      },
      {
        id: "inv_suction_catheters",
        childId: "child1",
        name: "Suction Catheters",
        category: "Tracheostomy",
        quantity: 24,
        low: 10,
        unit: "count",
        notes: "Check size before reorder",
        updated: Date.now()
      },
      {
        id: "inv_saline_bullets",
        childId: "child1",
        name: "Saline Bullets",
        category: "Tracheostomy",
        quantity: 18,
        low: 6,
        unit: "count",
        notes: "",
        updated: Date.now()
      },
      {
        id: "inv_hme_filters",
        childId: "child1",
        name: "HME Filters",
        category: "Tracheostomy",
        quantity: 10,
        low: 4,
        unit: "count",
        notes: "",
        updated: Date.now()
      },
      {
        id: "inv_formula",
        childId: "child1",
        name: "Formula",
        category: "Nutrition",
        quantity: 6,
        low: 2,
        unit: "boxes",
        notes: "",
        updated: Date.now()
      },
      {
        id: "inv_feeding_syringes",
        childId: "child1",
        name: "Feeding Syringes",
        category: "Medical",
        quantity: 12,
        low: 4,
        unit: "count",
        notes: "",
        updated: Date.now()
      }
    ],

    dashboard: {
      lowSupplies: [],
      lowSupplyCount: 0,
      lastInventorySync: null
    },

    // legacy / current vitals history used by app.js
    vitals: {},

    // new snapshot used by dashboard "last known vitals"
    lastKnownVitals: {},

    vitalThresholds: {}
  };
}

function ensureDB(db) {
  if (!db || typeof db !== "object") db = {};

  // auth
  if (!Array.isArray(db.users)) db.users = [];
  if (!db.session || typeof db.session !== "object") {
    db.session = { userId: null };
  }

  // specialties
  if (!Array.isArray(db.specialties) || db.specialties.length === 0) {
    db.specialties = [
      "General",
      "Neurology",
      "Pulmonology",
      "GI",
      "Cardiology",
      "PT/OT",
      "Primary Care"
    ];
  }

  // children
  if (!Array.isArray(db.children)) {
    db.children = [];
  }

  if (db.children.length === 0) {
    db.children = [
      {
        id: "child1",
        name: "Test Child",
        age: 6,
        diagnoses: ["Epilepsy", "Cerebral Palsy"],
        selectedSpecialties: ["General"],
        emergency: {}
      }
    ];
  }

  // active/current child sync
  if (!db.activeChildId) {
    db.activeChildId = db.currentChildId || db.children[0]?.id || "child1";
  }

  if (!db.currentChildId) {
    db.currentChildId = db.activeChildId || db.children[0]?.id || "child1";
  }

  // prefer keeping them aligned
  if (db.activeChildId !== db.currentChildId) {
    db.currentChildId = db.activeChildId;
  }

  // root collections
  if (!db.logs || typeof db.logs !== "object") db.logs = {};
  if (!db.symptoms || typeof db.symptoms !== "object") db.symptoms = {};
  if (!db.schedules || typeof db.schedules !== "object") db.schedules = {};
  if (!db.vitals || typeof db.vitals !== "object") db.vitals = {};
  if (!db.lastKnownVitals || typeof db.lastKnownVitals !== "object") db.lastKnownVitals = {};
  if (!db.vitalThresholds || typeof db.vitalThresholds !== "object") db.vitalThresholds = {};

  if (!Array.isArray(db.doseEvents)) db.doseEvents = [];
  if (!Array.isArray(db.meds)) db.meds = [];
  if (!Array.isArray(db.visitQuestions)) db.visitQuestions = [];
  if (!Array.isArray(db.today)) db.today = [];
  if (!Array.isArray(db.medicationChangeHistory)) db.medicationChangeHistory = [];
  if (!Array.isArray(db.inventory)) db.inventory = [];

  if (!db.dashboard || typeof db.dashboard !== "object") {
    db.dashboard = {};
  }

  if (!Array.isArray(db.dashboard.lowSupplies)) {
    db.dashboard.lowSupplies = [];
  }

  if (typeof db.dashboard.lowSupplyCount !== "number") {
    db.dashboard.lowSupplyCount = 0;
  }

  if (!db.dashboard.lastInventorySync) {
    db.dashboard.lastInventorySync = null;
  }

  // backward compatibility
  if (Array.isArray(db.medications) && !db.meds.length) {
    db.meds = db.medications;
  }

  if (Array.isArray(db.medicationLogs) && !db.doseEvents.length) {
    db.doseEvents = db.medicationLogs;
  }

  // normalize children + child-specific collections
  db.children.forEach((c, index) => {
    if (!c.id) c.id = `child${index + 1}`;
    if (!c.name) c.name = `Child ${index + 1}`;
    if (typeof c.age === "undefined") c.age = "";
    if (!Array.isArray(c.diagnoses)) c.diagnoses = [];

    if (!Array.isArray(c.selectedSpecialties) || !c.selectedSpecialties.length) {
      c.selectedSpecialties = ["General"];
    }

    if (!c.emergency || typeof c.emergency !== "object") {
      c.emergency = {};
    }

    if (!c.emergency.trach) {
      c.emergency.trach = {
        hasTrach: false,
        type: "",
        size: "",
        lastChange: ""
      };
    }

    if (!c.emergency.vent) {
      c.emergency.vent = {
        onVent: false,
        mode: "",
        settings: ""
      };
    }

    if (!c.emergency.gTube) {
      c.emergency.gTube = {
        hasGTube: false
      };
    }

    if (!c.emergency.oxygen) {
      c.emergency.oxygen = {
        hasOxygen: false
      };
    }

    if (!Array.isArray(db.logs[c.id])) db.logs[c.id] = [];
    if (!Array.isArray(db.symptoms[c.id])) db.symptoms[c.id] = [];
    if (!Array.isArray(db.schedules[c.id])) db.schedules[c.id] = [];
    if (!Array.isArray(db.vitals[c.id])) db.vitals[c.id] = [];

    if (!db.lastKnownVitals[c.id] || typeof db.lastKnownVitals[c.id] !== "object") {
      db.lastKnownVitals[c.id] = createEmptyLastKnownVitals();
    } else {
      db.lastKnownVitals[c.id] = normalizeLastKnownVitals(db.lastKnownVitals[c.id]);
    }

    if (!db.vitalThresholds[c.id] || typeof db.vitalThresholds[c.id] !== "object") {
      db.vitalThresholds[c.id] = {
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
  });

  // meds
  db.meds = db.meds.map((med, index) => {
  const safeMed = { ...med };

  if (!safeMed.id) safeMed.id = `med_${Date.now()}_${index}`;
  if (!safeMed.childId) safeMed.childId = db.activeChildId || db.children[0]?.id || "child1";
  if (!safeMed.name) safeMed.name = "";
  if (!safeMed.dose) safeMed.dose = "";
  if (!safeMed.route) safeMed.route = "";
  if (!safeMed.freq) safeMed.freq = "";
  if (!safeMed.notes) safeMed.notes = "";

  if (!safeMed.type) {
    safeMed.type = safeMed.prn ? "prn" : "scheduled";
  }

  if (!safeMed.scheduleMode) {
    safeMed.scheduleMode = "standard";
  }

  if (typeof safeMed.endDate !== "string") {
    safeMed.endDate = "";
  }

  if (!Array.isArray(safeMed.taperSteps)) {
    safeMed.taperSteps = [];
  }

  safeMed.taperSteps = safeMed.taperSteps.map((step) => ({
    label: step?.label || "",
    startDate: step?.startDate || "",
    endDate: step?.endDate || "",
    dose: step?.dose || "",
    times: Array.isArray(step?.times) ? step.times.join(", ") : (step?.times || "")
  }));

  if (typeof safeMed.archived !== "boolean") {
    safeMed.archived = false;
  }

  if (!safeMed.startDate) {
    safeMed.startDate = new Date().toISOString().slice(0, 10);
  }

  if (!safeMed.createdAt) {
    safeMed.createdAt = new Date().toISOString();
  }

  if (typeof safeMed.minGapHours !== "number" || Number.isNaN(safeMed.minGapHours)) {
    safeMed.minGapHours = 4;
  }

  if (typeof safeMed.graceMinutes !== "number" || Number.isNaN(safeMed.graceMinutes)) {
    safeMed.graceMinutes = 15;
  }

  if (Array.isArray(safeMed.times)) {
    safeMed.times = safeMed.times.join(", ");
  }

  if (!safeMed.times) {
    safeMed.times = "";
  }

  return safeMed;
});

  // dose events
  db.doseEvents = db.doseEvents.map((evt, index) => {
    const safeEvt = { ...evt };

    if (!safeEvt.id) safeEvt.id = `dose_${Date.now()}_${index}`;
    if (!safeEvt.childId) safeEvt.childId = db.activeChildId || db.children[0]?.id || "child1";
    if (!safeEvt.medId && safeEvt.medicationId) safeEvt.medId = safeEvt.medicationId;
    if (!safeEvt.type) safeEvt.type = safeEvt.logType || "scheduled";
    if (!safeEvt.time && safeEvt.loggedAt) safeEvt.time = safeEvt.loggedAt;
    if (!safeEvt.note) safeEvt.note = "";
    if (!safeEvt.scheduledTime) safeEvt.scheduledTime = "";

    return safeEvt;
  });

  // med history
  db.medicationChangeHistory = db.medicationChangeHistory.map((item, index) => {
    const safeItem = { ...item };

    if (!safeItem.id) safeItem.id = `medhx_${Date.now()}_${index}`;
    if (!safeItem.childId) safeItem.childId = db.activeChildId || db.children[0]?.id || "child1";
    if (!safeItem.medId && safeItem.medicationId) safeItem.medId = safeItem.medicationId;
    if (!safeItem.action) safeItem.action = "updated";
    if (!safeItem.detail) safeItem.detail = "";
    if (!safeItem.changedAt) safeItem.changedAt = new Date().toISOString();

    return safeItem;
  });

  // inventory
  db.inventory = db.inventory.map((item, index) => {
    const safeItem = { ...item };

    if (!safeItem.id) safeItem.id = `inv_${Date.now()}_${index}`;
    if (!safeItem.childId) safeItem.childId = db.activeChildId || db.children[0]?.id || "child1";
    if (!safeItem.name) safeItem.name = "Untitled Item";
    if (!safeItem.category) safeItem.category = "Other";
    if (!Number.isFinite(Number(safeItem.quantity))) safeItem.quantity = 0;
    else safeItem.quantity = Number(safeItem.quantity);
    if (!Number.isFinite(Number(safeItem.low))) safeItem.low = 0;
    else safeItem.low = Number(safeItem.low);
    if (!safeItem.unit) safeItem.unit = "count";
    if (!safeItem.notes) safeItem.notes = "";
    if (!safeItem.updated) safeItem.updated = Date.now();

    return safeItem;
  });

  // vitals history used by your current app.js
  db.vitals = Object.fromEntries(
    Object.entries(db.vitals).map(([childId, rows]) => [
      childId,
      Array.isArray(rows)
        ? rows.map((row, index) => normalizeVitalRow(row, index))
        : []
    ])
  );

  // migrate lastKnownVitals snapshot from vitals history
  rebuildLastKnownVitalsFromVitalsHistory(db);

  // inventory dashboard sync
  syncDashboardFromInventory(db);

  return db;
}

function normalizeVitalRow(row, index) {
  const safeRow = {
    id: row?.id || `vital_${Date.now()}_${index}`,
    createdAt: row?.createdAt || Date.now(),
    notes: row?.notes || ""
  };

  // support both old combined rows and new individual rows
  if (row?.type) {
    safeRow.type = row.type;
    safeRow.label = row.label || "";
    safeRow.value = row.value ?? null;
    safeRow.unit = row.unit || "";
    safeRow.bpSys = row.bpSys ?? null;
    safeRow.bpDia = row.bpDia ?? null;
  } else {
    safeRow.o2 = row?.o2 ?? null;
    safeRow.temp = row?.temp ?? null;
    safeRow.bpSys = row?.bpSys ?? null;
    safeRow.bpDia = row?.bpDia ?? null;
    safeRow.hr = row?.hr ?? null;
    safeRow.rr = row?.rr ?? null;
  }

  return safeRow;
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

function normalizeLastKnownVitals(snapshot) {
  const safe = createEmptyLastKnownVitals();

  ["o2", "temp", "bpSys", "bpDia", "hr", "rr"].forEach((key) => {
    const value = snapshot?.[key];
    safe[key] = value && typeof value === "object"
      ? {
          value: value.value ?? null,
          createdAt: value.createdAt || Date.now(),
          notes: value.notes || ""
        }
      : null;
  });

  return safe;
}

function rebuildLastKnownVitalsFromVitalsHistory(db) {
  db.children.forEach((child) => {
    if (!db.lastKnownVitals[child.id]) {
      db.lastKnownVitals[child.id] = createEmptyLastKnownVitals();
    }

    const snapshot = db.lastKnownVitals[child.id];
    const rows = Array.isArray(db.vitals[child.id]) ? [...db.vitals[child.id]] : [];

    rows.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));

    rows.forEach((row) => {
      // new style individual entries
      if (row.type) {
        if (row.type === "o2") {
          snapshot.o2 = {
            value: row.value,
            createdAt: row.createdAt,
            notes: row.notes || ""
          };
        }

        if (row.type === "temp") {
          snapshot.temp = {
            value: row.value,
            createdAt: row.createdAt,
            notes: row.notes || ""
          };
        }

        if (row.type === "bp") {
          if (row.bpSys != null) {
            snapshot.bpSys = {
              value: row.bpSys,
              createdAt: row.createdAt,
              notes: row.notes || ""
            };
          }

          if (row.bpDia != null) {
            snapshot.bpDia = {
              value: row.bpDia,
              createdAt: row.createdAt,
              notes: row.notes || ""
            };
          }
        }

        if (row.type === "hr") {
          snapshot.hr = {
            value: row.value,
            createdAt: row.createdAt,
            notes: row.notes || ""
          };
        }

        if (row.type === "rr") {
          snapshot.rr = {
            value: row.value,
            createdAt: row.createdAt,
            notes: row.notes || ""
          };
        }

        return;
      }

      // old style combined entries
      if (row.o2 != null) {
        snapshot.o2 = {
          value: row.o2,
          createdAt: row.createdAt,
          notes: row.notes || ""
        };
      }

      if (row.temp != null) {
        snapshot.temp = {
          value: row.temp,
          createdAt: row.createdAt,
          notes: row.notes || ""
        };
      }

      if (row.bpSys != null) {
        snapshot.bpSys = {
          value: row.bpSys,
          createdAt: row.createdAt,
          notes: row.notes || ""
        };
      }

      if (row.bpDia != null) {
        snapshot.bpDia = {
          value: row.bpDia,
          createdAt: row.createdAt,
          notes: row.notes || ""
        };
      }

      if (row.hr != null) {
        snapshot.hr = {
          value: row.hr,
          createdAt: row.createdAt,
          notes: row.notes || ""
        };
      }

      if (row.rr != null) {
        snapshot.rr = {
          value: row.rr,
          createdAt: row.createdAt,
          notes: row.notes || ""
        };
      }
    });
  });
}

function syncDashboardFromInventory(db) {
  const activeChildId = db.activeChildId || db.children[0]?.id || null;
  const inventory = Array.isArray(db.inventory) ? db.inventory : [];

  const lowSupplies = inventory
    .filter((item) => {
      const matchesChild = !item.childId || item.childId === activeChildId;
      return matchesChild && Number(item.quantity) <= Number(item.low);
    })
    .map((item) => ({
      id: item.id,
      childId: item.childId || activeChildId,
      name: item.name,
      category: item.category,
      quantity: Number(item.quantity) || 0,
      low: Number(item.low) || 0,
      unit: item.unit || "count",
      status: Number(item.quantity) <= 0 ? "out" : "low"
    }))
    .sort((a, b) => {
      if (a.status === "out" && b.status !== "out") return -1;
      if (a.status !== "out" && b.status === "out") return 1;
      return a.quantity - b.quantity;
    });

  db.dashboard.lowSupplies = lowSupplies;
  db.dashboard.lowSupplyCount = lowSupplies.length;
  db.dashboard.lastInventorySync = Date.now();
}

/* ---------- auth helpers ---------- */

function seedDemoUser() {
  const db = loadDB();

  const existing = db.users.find(
    (u) => (u.email || "").toLowerCase() === "parent@example.com"
  );
  if (existing) return;

  const childId = db.children[0]?.id || "child1";

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

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/* ---------- app helpers ---------- */

function getActiveChild(db) {
  if (!db || !Array.isArray(db.children)) return null;
  return db.children.find((c) => c.id === db.activeChildId) || db.children[0] || null;
}

function getChildById(db, childId) {
  if (!db || !Array.isArray(db.children)) return null;
  return db.children.find((c) => c.id === childId) || null;
}

function getActiveChildId() {
  const db = loadDB();
  const child = getActiveChild(db);
  return child ? child.id : null;
}

function getChildMeds(db, childId) {
  if (!db) return [];
  return (db.meds || []).filter((m) => m.childId === childId);
}

function getActiveChildMeds(db) {
  const child = getActiveChild(db);
  if (!child) return [];
  return getChildMeds(db, child.id);
}

function getChildDoseEvents(db, childId) {
  if (!db) return [];
  return (db.doseEvents || []).filter((e) => e.childId === childId);
}

function getActiveChildDoseEvents(db) {
  const child = getActiveChild(db);
  if (!child) return [];
  return getChildDoseEvents(db, child.id);
}

function getChildMedicationHistory(db, childId) {
  if (!db) return [];
  return (db.medicationChangeHistory || []).filter((h) => h.childId === childId);
}

function getActiveChildMedicationHistory(db) {
  const child = getActiveChild(db);
  if (!child) return [];
  return getChildMedicationHistory(db, child.id);
}

function getChildInventory(db, childId) {
  if (!db) return [];
  return (db.inventory || []).filter((i) => i.childId === childId);
}

function getActiveChildInventory(db) {
  const child = getActiveChild(db);
  if (!child) return [];
  return getChildInventory(db, child.id);
}

function getChildVitals(db, childId) {
  if (!db) return [];
  return db.vitals?.[childId] || [];
}

function getActiveChildVitals(db) {
  const child = getActiveChild(db);
  if (!child) return [];
  return getChildVitals(db, child.id);
}

function fmtTime(ms) {
  const d = new Date(ms);
  const h = d.getHours() % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, "0");
  const ap = d.getHours() >= 12 ? "PM" : "AM";
  return `${h}:${m} ${ap}`;
}

function categoryLabel(cat) {
  return {
    med: "Medication",
    symptom: "Symptom",
    question: "Question",
    note: "Care Note"
  }[cat] || "Note";
}

function childHasSpecialty(name) {
  const db = loadDB();
  const child = getActiveChild(db);

  if (!child || !child.selectedSpecialties) return false;
  return child.selectedSpecialties.includes(name);
}

function childHasDevice(device) {
  const db = loadDB();
  const child = getActiveChild(db);

  if (!child || !child.emergency) return false;

  return (
    child.emergency[device]?.hasTrach ||
    child.emergency[device]?.onVent ||
    child.emergency[device]?.hasGTube ||
    child.emergency[device]?.hasOxygen
  );
}

function parseMedTimes(timesValue) {
  if (!timesValue) return [];
  if (Array.isArray(timesValue)) return timesValue.filter(Boolean);

  return String(timesValue)
    .split(",")
    .map(t => t.trim())
    .filter(Boolean);
}

function isDateInRange(targetDateStr, startDateStr, endDateStr) {
  if (!targetDateStr || !startDateStr) return false;

  const target = new Date(`${targetDateStr}T00:00:00`);
  const start = new Date(`${startDateStr}T00:00:00`);
  const end = endDateStr ? new Date(`${endDateStr}T23:59:59`) : null;

  if (Number.isNaN(target.getTime()) || Number.isNaN(start.getTime())) return false;
  if (target < start) return false;
  if (end && target > end) return false;

  return true;
}

function getMedDoseForDate(med, targetDateStr) {
  if (!med) return null;

  const mode = med.scheduleMode || "standard";

  if (mode === "wean") {
    const steps = Array.isArray(med.taperSteps) ? med.taperSteps : [];
    const step = steps.find(s => isDateInRange(targetDateStr, s.startDate, s.endDate));
    if (!step) return null;

    return {
      dose: step.dose || med.dose || "",
      times: parseMedTimes(step.times),
      stepLabel: step.label || ""
    };
  }

  return {
    dose: med.dose || "",
    times: parseMedTimes(med.times),
    stepLabel: ""
  };
}

function isMedicationActiveOnDate(med, targetDateStr) {
  if (!med || med.archived) return false;
  if (med.type === "prn") return false;

  const mode = med.scheduleMode || "standard";

  if (mode === "temporary") {
    return isDateInRange(targetDateStr, med.startDate, med.endDate);
  }

  if (mode === "wean") {
    const steps = Array.isArray(med.taperSteps) ? med.taperSteps : [];
    return steps.some(step => isDateInRange(targetDateStr, step.startDate, step.endDate));
  }

  return isDateInRange(targetDateStr, med.startDate, null);
}

function generateMedicationScheduleItems(db, childId, targetDateStr) {
  const meds = (db.meds || []).filter(m => m.childId === childId);
  const items = [];

  meds.forEach(med => {
    if (!isMedicationActiveOnDate(med, targetDateStr)) return;

    const doseInfo = getMedDoseForDate(med, targetDateStr);
    if (!doseInfo) return;

    const times = Array.isArray(doseInfo.times) ? doseInfo.times : [];
    if (!times.length) return;

    times.forEach(time => {
      items.push({
        id: `medsched_${med.id}_${targetDateStr}_${time}`,
        medId: med.id,
        childId,
        source: "medication",
        category: "Medication",
        title: med.name || "Medication",
        time,
        date: targetDateStr,
        instructions: `${doseInfo.dose || ""}${med.route ? ` • ${med.route}` : ""}`.trim(),
        note: med.notes || "",
        scheduleMode: med.scheduleMode || "standard",
        stepLabel: doseInfo.stepLabel || ""
      });
    });
  });

  items.sort((a, b) => String(a.time).localeCompare(String(b.time)));
  return items;
}