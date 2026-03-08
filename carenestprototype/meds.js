const GRACE_MINUTES = 15;
const DEFAULT_MIN_GAP_HOURS = 4;

const db = loadDB();

/* -----------------------------
   DB bootstrap
----------------------------- */
ensureDB(db);

if (!Array.isArray(db.meds)) db.meds = [];
if (!Array.isArray(db.doseEvents)) db.doseEvents = [];
if (!Array.isArray(db.medicationChangeHistory)) db.medicationChangeHistory = [];

saveDB(db);

/* -----------------------------
   DOM refs
----------------------------- */
const childSwitcher = document.getElementById("childSwitcher");
const logoutBtn = document.getElementById("logoutBtn");
const childAvatar = document.getElementById("childAvatar");
const childSummary = document.getElementById("childSummary");

const todayMeds = document.getElementById("todayMeds");
const medList = document.getElementById("medList");
const timeline = document.getElementById("timeline");
const changeHistory = document.getElementById("changeHistory");
const reportCard = document.getElementById("reportCard");
const reportOutput = document.getElementById("reportOutput");

const medFormCard = document.getElementById("medFormCard");
const formTitle = document.getElementById("formTitle");

const addMedBtn = document.getElementById("addMedBtn");
const saveMedBtn = document.getElementById("saveMedBtn");
const cancelMedBtn = document.getElementById("cancelMedBtn");
const refreshBtn = document.getElementById("refreshBtn");
const showArchivedBtn = document.getElementById("showArchivedBtn");
const exportReportBtn = document.getElementById("exportReportBtn");
const copyReportBtn = document.getElementById("copyReportBtn");

const addMedBtnSidebar = document.getElementById("addMedBtnSidebar");
const refreshBtnSidebar = document.getElementById("refreshBtnSidebar");
const showArchivedBtnSidebar = document.getElementById("showArchivedBtnSidebar");
const exportReportBtnSidebar = document.getElementById("exportReportBtnSidebar");
const addMedBtnQuick = document.getElementById("addMedBtnQuick");
const exportReportBtnQuick = document.getElementById("exportReportBtnQuick");

const medName = document.getElementById("medName");
const medDose = document.getElementById("medDose");
const medRoute = document.getElementById("medRoute");
const medType = document.getElementById("medType");
const medScheduleMode = document.getElementById("medScheduleMode");
const medFreq = document.getElementById("medFreq");
const medTimes = document.getElementById("medTimes");
const medMinGap = document.getElementById("medMinGap");
const medStartDate = document.getElementById("medStartDate");
const medEndDate = document.getElementById("medEndDate");
const medNotes = document.getElementById("medNotes");

const timesRow = document.querySelector(".js-times-row");
const endDateRow = document.querySelector(".js-end-date-row");
const weanBuilder = document.getElementById("weanBuilder");
const addWeanStepBtn = document.getElementById("addWeanStepBtn");
const weanStepsList = document.getElementById("weanStepsList");

let editingMedicationId = null;
let showArchived = false;
let weanStepsDraft = [];

/* -----------------------------
   Helpers
----------------------------- */
function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getActiveChildSafe() {
  return getActiveChild(db);
}

function getActiveChildIdSafe() {
  const child = getActiveChildSafe();
  return child ? child.id : null;
}

function setActiveChildIdSafe(id) {
  db.activeChildId = id;
  saveDB(db);
}

function escapeHtml(str) {
  return String(str || "")
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

function formatDateTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatTimeFromDate(d) {
  return d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayYYYYMMDD() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseTimeToTodayDate(timeText) {
  if (!timeText) return null;

  const raw = timeText.trim().toLowerCase();

  let hour, minute;
  const ampmMatch = raw.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  const h24Match = raw.match(/^(\d{1,2}):(\d{2})$/);

  if (ampmMatch) {
    hour = Number(ampmMatch[1]);
    minute = Number(ampmMatch[2]);
    const ampm = ampmMatch[3].toLowerCase();

    if (ampm === "pm" && hour !== 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
  } else if (h24Match) {
    hour = Number(h24Match[1]);
    minute = Number(h24Match[2]);
  } else {
    return null;
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

function parseTimesList(text) {
  return String(text || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function minutesDiff(a, b) {
  return Math.round((a.getTime() - b.getTime()) / 60000);
}

function hoursBetween(isoA, isoB) {
  return Math.abs(new Date(isoA).getTime() - new Date(isoB).getTime()) / 36e5;
}

function isSameDay(isoA, dateObj) {
  const a = new Date(isoA);
  return (
    a.getFullYear() === dateObj.getFullYear() &&
    a.getMonth() === dateObj.getMonth() &&
    a.getDate() === dateObj.getDate()
  );
}

function getMedicationsForActiveChild() {
  const childId = getActiveChildIdSafe();
  return db.meds.filter((m) => m.childId === childId);
}

function getMedicationById(id) {
  return db.meds.find((m) => m.id === id);
}

function getDoseEventsForMedication(id) {
  return db.doseEvents
    .filter((log) => log.medId === id)
    .sort((a, b) => new Date(b.time || b.loggedAt) - new Date(a.time || a.loggedAt));
}

function getTodayLogsForMedication(id) {
  const now = new Date();
  return getDoseEventsForMedication(id).filter((log) => isSameDay(log.time || log.loggedAt, now));
}

function addChangeHistory(medId, action, detail) {
  db.medicationChangeHistory.unshift({
    id: uid("change"),
    childId: getActiveChildIdSafe(),
    medId,
    action,
    detail,
    changedAt: new Date().toISOString()
  });
  saveDB(db);
}

function getChangeHistoryForActiveChild() {
  const childId = getActiveChildIdSafe();
  return db.medicationChangeHistory.filter((item) => item.childId === childId);
}

function getDoseEventsForActiveChild() {
  const childId = getActiveChildIdSafe();
  return db.doseEvents.filter((item) => item.childId === childId);
}

function describeMedication(med) {
  return `${med.name}${med.dose ? ` ${med.dose}` : ""}${med.route ? ` via ${med.route}` : ""}`;
}

function normalizeMedication(med) {
  med.scheduleMode = med.scheduleMode || "standard";
  if (!Array.isArray(med.taperSteps)) med.taperSteps = [];
  if (typeof med.endDate !== "string") med.endDate = "";
  return med;
}

function getMedicationDisplayDoseForToday(med) {
  const today = todayYYYYMMDD();
  const mode = med.scheduleMode || "standard";

  if (mode === "wean") {
    const info = getMedDoseForDate(med, today);
    return info?.dose || med.dose || "";
  }

  return med.dose || "";
}

function getMedicationDisplayTimesForToday(med) {
  const today = todayYYYYMMDD();
  const mode = med.scheduleMode || "standard";

  if (mode === "wean") {
    const info = getMedDoseForDate(med, today);
    return Array.isArray(info?.times) ? info.times.join(", ") : "";
  }

  return med.times || "";
}

function getMedicationScheduleSummary(med) {
  const mode = med.scheduleMode || "standard";

  if (mode === "temporary") {
    return `Temporary course • ${formatDate(med.startDate)} to ${formatDate(med.endDate)}`;
  }

  if (mode === "wean") {
    const steps = Array.isArray(med.taperSteps) ? med.taperSteps : [];
    return `Weaning schedule • ${steps.length} step${steps.length === 1 ? "" : "s"}`;
  }

  return `Ongoing • Started ${formatDate(med.startDate)}`;
}

function renderChildSwitcher() {
  if (!childSwitcher) return;

  childSwitcher.innerHTML = "";
  const children = Array.isArray(db.children) ? db.children : [];

  if (!children.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No children yet";
    childSwitcher.appendChild(option);
    return;
  }

  const activeChild = getActiveChildSafe();

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

function renderHeaderChildSummary() {
  const child = getActiveChildSafe();

  if (!child) {
    if (childSummary) childSummary.textContent = "Age —";
    if (childAvatar) childAvatar.innerHTML = "";
    return;
  }

  const diagnoses = normalizeDiagnoses(child.diagnoses);
  const childAge = child.age ?? getAgeFromBirthdate(child.birthdate);

  let summaryText =
    childAge !== null && childAge !== undefined && childAge !== ""
      ? `Age ${childAge}`
      : "Age —";

  if (diagnoses.length) {
    summaryText += ` • ${diagnoses.slice(0, 2).join(" • ")}`;
  }

  if (childSummary) {
    childSummary.textContent = summaryText;
  }

  if (childAvatar) {
    if (child.photo_url) {
      childAvatar.innerHTML = `<img src="${escapeHtml(child.photo_url)}" alt="${escapeHtml(
        child.name || "Child"
      )}">`;
    } else {
      childAvatar.innerHTML = "";
    }
  }
}

/* -----------------------------
   Wean builder helpers
----------------------------- */
function resetWeanDraft() {
  weanStepsDraft = [];
}

function createEmptyWeanStep() {
  return {
    id: uid("step"),
    label: "",
    startDate: "",
    endDate: "",
    dose: "",
    times: ""
  };
}

function renderWeanSteps() {
  if (!weanStepsList) return;

  if (!weanStepsDraft.length) {
    weanStepsList.innerHTML = `<div class="muted small">No taper steps added yet.</div>`;
    return;
  }

  weanStepsList.innerHTML = weanStepsDraft
    .map(
      (step, index) => `
    <div class="wean-step" data-step-id="${step.id}">
      <div class="wean-step-head">
        <div class="wean-step-title">Step ${index + 1}</div>
        <button type="button" class="btn btn-danger js-remove-wean-step" data-step-id="${step.id}">Remove</button>
      </div>

      <div class="form-grid">
        <div class="field">
          <label>Step Label (optional)</label>
          <input class="input js-wean-label" data-step-id="${step.id}" value="${escapeHtml(
            step.label
          )}" placeholder="Week 1 / Step 1" />
        </div>

        <div class="field">
          <label>Dose</label>
          <input class="input js-wean-dose" data-step-id="${step.id}" value="${escapeHtml(
            step.dose
          )}" placeholder="7.5 mL" />
        </div>

        <div class="field">
          <label>Start Date</label>
          <input class="input js-wean-start" data-step-id="${step.id}" type="date" value="${escapeHtml(
            step.startDate
          )}" />
        </div>

        <div class="field">
          <label>End Date</label>
          <input class="input js-wean-end" data-step-id="${step.id}" type="date" value="${escapeHtml(
            step.endDate
          )}" />
        </div>
      </div>

      <div class="field mt-12">
        <label>Times</label>
        <input class="input js-wean-times" data-step-id="${step.id}" value="${escapeHtml(
          step.times
        )}" placeholder="08:00, 20:00" />
        <div class="muted small">Use 24-hour times separated by commas.</div>
      </div>
    </div>
  `
    )
    .join("");
}

function addWeanStep(step = null) {
  weanStepsDraft.push(step ? { ...step, id: step.id || uid("step") } : createEmptyWeanStep());
  renderWeanSteps();
}

function updateWeanStep(stepId, key, value) {
  const step = weanStepsDraft.find((s) => s.id === stepId);
  if (!step) return;
  step[key] = value;
}

function removeWeanStep(stepId) {
  weanStepsDraft = weanStepsDraft.filter((s) => s.id !== stepId);
  renderWeanSteps();
}

function collectWeanSteps() {
  return weanStepsDraft.map((step) => ({
    label: String(step.label || "").trim(),
    startDate: String(step.startDate || "").trim(),
    endDate: String(step.endDate || "").trim(),
    dose: String(step.dose || "").trim(),
    times: String(step.times || "").trim()
  }));
}

function validateWeanSteps(steps) {
  if (!steps.length) {
    return "Please add at least one taper step.";
  }

  for (const step of steps) {
    if (!step.startDate || !step.endDate) {
      return "Each taper step needs a start date and end date.";
    }

    if (step.endDate < step.startDate) {
      return "A taper step end date cannot be before its start date.";
    }

    if (!step.dose) {
      return "Each taper step needs a dose.";
    }

    const invalidTime = parseTimesList(step.times).find((t) => !parseTimeToTodayDate(t));
    if (!step.times || invalidTime) {
      return `Each taper step needs valid scheduled times. Problem: ${invalidTime || "missing times"}`;
    }
  }

  return "";
}

/* -----------------------------
   Form mode behavior
----------------------------- */
function updateMedicationFormMode() {
  const type = medType?.value || "scheduled";
  const mode = medScheduleMode?.value || "standard";

  if (timesRow) {
    timesRow.classList.toggle("hidden", type === "prn" || mode === "wean");
  }

  if (endDateRow) {
    endDateRow.classList.toggle("hidden", mode !== "temporary");
  }

  if (weanBuilder) {
    weanBuilder.classList.toggle("hidden", mode !== "wean" || type === "prn");
  }
}

/* -----------------------------
   Dose status logic
----------------------------- */
function getDoseStatus(scheduledDate, medication, scheduledTime) {
  const now = new Date();
  const diff = minutesDiff(now, scheduledDate);
  const todayLogs = getTodayLogsForMedication(medication.id);

  const takenMatch = todayLogs.find((log) => {
    if (log.type !== "scheduled") return false;
    if (log.scheduledTime) {
      const scheduledForLog = parseTimeToTodayDate(log.scheduledTime);
      if (!scheduledForLog) return false;
      return Math.abs(minutesDiff(scheduledForLog, scheduledDate)) <= 1;
    }
    return false;
  });

  const skippedMatch = todayLogs.find((log) => {
    if (log.type !== "skip") return false;
    return log.scheduledTime === scheduledTime;
  });

  if (takenMatch) {
    return {
      label: `Taken at ${formatTimeFromDate(new Date(takenMatch.time || takenMatch.loggedAt))}`,
      className: "success",
      canLog: false
    };
  }

  if (skippedMatch) {
    return {
      label: "Skipped",
      className: "danger",
      canLog: true
    };
  }

  if (diff < -GRACE_MINUTES) {
    return { label: "Upcoming", className: "info", canLog: true };
  }

  if (diff >= -GRACE_MINUTES && diff < 0) {
    return { label: "Due Soon", className: "warn", canLog: true };
  }

  if (diff >= 0 && diff <= GRACE_MINUTES) {
    return { label: "Grace Window", className: "warn", canLog: true };
  }

  return { label: "Overdue", className: "danger", canLog: true };
}

function getRecentDoseSafetyWarning(medication) {
  const logs = getDoseEventsForMedication(medication.id).filter((log) => log.type !== "skip");
  if (!logs.length) return null;

  const mostRecent = logs[0];
  const minGapHours = Number(medication.minGapHours || DEFAULT_MIN_GAP_HOURS);
  const elapsed = hoursBetween(new Date().toISOString(), mostRecent.time || mostRecent.loggedAt);

  if (elapsed < minGapHours) {
    const remaining = (minGapHours - elapsed).toFixed(1);
    return `Last dose was logged ${elapsed.toFixed(1)} hour(s) ago. Recommended gap is ${minGapHours} hour(s). About ${remaining} hour(s) remain.`;
  }

  return null;
}

/* -----------------------------
   Render
----------------------------- */
function renderTodayMeds() {
  const childId = getActiveChildIdSafe();
  if (!childId) {
    todayMeds.innerHTML = `<div class="muted">No active child selected.</div>`;
    return;
  }

  const meds = getMedicationsForActiveChild()
    .filter((m) => (showArchived ? true : !m.archived))
    .map(normalizeMedication)
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  if (!meds.length) {
    todayMeds.innerHTML = `<div class="muted">No medications added yet.</div>`;
    return;
  }

  const today = todayYYYYMMDD();
  const generatedScheduleItems = generateMedicationScheduleItems(db, childId, today);
  const scheduleByMed = {};

  generatedScheduleItems.forEach((item) => {
    if (!scheduleByMed[item.medId]) scheduleByMed[item.medId] = [];
    scheduleByMed[item.medId].push(item);
  });

  let html = "";

  meds.forEach((med) => {
    const todayLogs = getTodayLogsForMedication(med.id);

    if (med.type === "prn") {
      const safetyWarning = getRecentDoseSafetyWarning(med);

      html += `
        <div class="med-card">
          <div class="med-top">
            <div>
              <h3 style="margin:0;">${escapeHtml(med.name)}</h3>
              <div class="muted small">
                ${escapeHtml(med.dose || "")}
                ${med.route ? ` • ${escapeHtml(med.route)}` : ""}
                ${med.freq ? ` • ${escapeHtml(med.freq)}` : ""}
                • PRN
              </div>
              ${med.notes ? `<div class="small" style="margin-top:8px;">${escapeHtml(med.notes)}</div>` : ""}
              <div class="badge-row">
                <span class="badge info">PRN Medication</span>
                <span class="badge">${todayLogs.filter((l) => l.type === "prn").length} dose(s) today</span>
              </div>
              ${safetyWarning ? `<div class="badge-row"><span class="badge danger">${escapeHtml(safetyWarning)}</span></div>` : ""}
            </div>
            <div class="inline-actions">
              <button class="btn btn-primary js-log-prn" data-id="${med.id}">Log PRN Dose</button>
            </div>
          </div>
        </div>
      `;
      return;
    }

    const medScheduleRows = scheduleByMed[med.id] || [];

    if (!medScheduleRows.length) {
      html += `
        <div class="med-card">
          <div class="med-top">
            <div>
              <h3 style="margin:0;">${escapeHtml(med.name)}</h3>
              <div class="muted small">
                ${escapeHtml(getMedicationDisplayDoseForToday(med))}
                ${med.route ? ` • ${escapeHtml(med.route)}` : ""}
                ${med.freq ? ` • ${escapeHtml(med.freq)}` : ""}
              </div>
              <div class="badge-row">
                <span class="badge warn">${escapeHtml(getMedicationScheduleSummary(med))}</span>
                <span class="badge danger">Not scheduled for today</span>
              </div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    const doseRows = medScheduleRows
      .map((item) => {
        const scheduledDate = parseTimeToTodayDate(item.time);

        if (!scheduledDate) {
          return `
            <div class="summary-card">
              <strong>${escapeHtml(item.time)}</strong>
              <div class="badge-row">
                <span class="badge danger">Invalid time format</span>
              </div>
            </div>
          `;
        }

        const status = getDoseStatus(scheduledDate, med, item.time);

        return `
          <div class="summary-card">
            <div class="med-top">
              <div>
                <strong>${escapeHtml(item.time)}</strong>
                <div class="muted small" style="margin-top:4px;">
                  ${escapeHtml(item.instructions || "")}
                  ${item.stepLabel ? ` • ${escapeHtml(item.stepLabel)}` : ""}
                </div>
                <div class="badge-row">
                  <span class="badge ${status.className}">${escapeHtml(status.label)}</span>
                </div>
              </div>
              <div class="inline-actions">
                <button class="btn btn-primary js-log-scheduled" data-id="${med.id}" data-time="${escapeHtml(item.time)}">Log Dose</button>
                <button class="btn btn-ghost js-skip-dose" data-id="${med.id}" data-time="${escapeHtml(item.time)}">Skip</button>
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    html += `
      <div class="med-card">
        <div class="med-top">
          <div>
            <h3 style="margin:0;">${escapeHtml(med.name)}</h3>
            <div class="muted small">
              ${escapeHtml(getMedicationDisplayDoseForToday(med))}
              ${med.route ? ` • ${escapeHtml(med.route)}` : ""}
              ${med.freq ? ` • ${escapeHtml(med.freq)}` : ""}
            </div>
            ${med.notes ? `<div class="small" style="margin-top:8px;">${escapeHtml(med.notes)}</div>` : ""}
            <div class="pill-line">
              <span class="badge">${medScheduleRows.length} scheduled dose(s) today</span>
              <span class="badge info">${GRACE_MINUTES}-min grace before/after</span>
              <span class="badge warn">${escapeHtml(getMedicationScheduleSummary(med))}</span>
            </div>
          </div>
        </div>
        <div style="margin-top:12px;">${doseRows}</div>
      </div>
    `;
  });

  todayMeds.innerHTML = html;
}

function renderMedList() {
  const meds = getMedicationsForActiveChild()
    .filter((m) => (showArchived ? true : !m.archived))
    .map(normalizeMedication)
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  if (!meds.length) {
    medList.innerHTML = `<div class="muted">No medications available.</div>`;
    return;
  }

  medList.innerHTML = meds
    .map((med) => {
      const logCount = getDoseEventsForMedication(med.id).length;
      const archivedBadge = med.archived ? `<span class="badge danger">Archived</span>` : "";
      const typeBadge =
        med.type === "prn"
          ? `<span class="badge info">PRN</span>`
          : `<span class="badge">${escapeHtml(getMedicationDisplayTimesForToday(med) || "Scheduled")}</span>`;

      const modeBadge =
        med.scheduleMode === "temporary"
          ? `<span class="badge warn">Temporary</span>`
          : med.scheduleMode === "wean"
            ? `<span class="badge info">Wean / Taper</span>`
            : `<span class="badge success">Ongoing</span>`;

      const courseLine =
        med.scheduleMode === "temporary"
          ? `<div class="small muted" style="margin-top:6px;">${formatDate(med.startDate)} → ${formatDate(med.endDate)}</div>`
          : med.scheduleMode === "wean"
            ? `<div class="small muted" style="margin-top:6px;">${(med.taperSteps || []).length} taper step(s)</div>`
            : `<div class="small muted" style="margin-top:6px;">Started ${formatDate(med.startDate)}</div>`;

      return `
      <div class="med-card">
        <div class="med-top">
          <div>
            <h3 style="margin:0;">${escapeHtml(med.name)}</h3>
            <div class="muted small">
              ${escapeHtml(getMedicationDisplayDoseForToday(med) || med.dose || "")}
              ${med.route ? ` • ${escapeHtml(med.route)}` : ""}
              ${med.freq ? ` • ${escapeHtml(med.freq)}` : ""}
            </div>
            ${courseLine}
            <div class="badge-row">
              ${typeBadge}
              ${modeBadge}
              ${archivedBadge}
              <span class="badge">${logCount} total log(s)</span>
              <span class="badge">Min gap: ${escapeHtml(String(med.minGapHours || DEFAULT_MIN_GAP_HOURS))} hr</span>
            </div>
            ${med.notes ? `<div class="small" style="margin-top:8px;">${escapeHtml(med.notes)}</div>` : ""}
          </div>
          <div class="inline-actions">
            <button class="btn btn-secondary js-edit-med" data-id="${med.id}">Edit</button>
            <button class="btn btn-ghost js-toggle-archive" data-id="${med.id}">
              ${med.archived ? "Unarchive" : "Archive"}
            </button>
            <button class="btn btn-danger js-delete-med" data-id="${med.id}">Delete</button>
          </div>
        </div>
      </div>
    `;
    })
    .join("");
}

function renderTimeline() {
  const logs = [...getDoseEventsForActiveChild()].sort(
    (a, b) => new Date(b.time || b.loggedAt) - new Date(a.time || a.loggedAt)
  );

  if (!logs.length) {
    timeline.innerHTML = `<div class="muted">No doses logged yet.</div>`;
    return;
  }

  timeline.innerHTML = logs
    .slice(0, 100)
    .map((log) => {
      const med = getMedicationById(log.medId);
      const medName = med ? med.name : "Unknown medication";
      const details = [];

      if (log.type === "scheduled" && log.scheduledTime) details.push(`Scheduled: ${log.scheduledTime}`);
      if (log.type === "prn") details.push("PRN");
      if (log.type === "skip") details.push("Skipped");
      if (log.note) details.push(log.note);

      return `
      <div class="timeline-item">
        <strong>${escapeHtml(medName)}</strong>
        <div class="muted small">${formatDateTime(log.time || log.loggedAt)}</div>
        <div class="small">${escapeHtml(details.join(" • "))}</div>
      </div>
    `;
    })
    .join("");
}

function renderChangeHistory() {
  const items = [...getChangeHistoryForActiveChild()].sort(
    (a, b) => new Date(b.changedAt) - new Date(a.changedAt)
  );

  if (!items.length) {
    changeHistory.innerHTML = `<div class="muted">No medication changes yet.</div>`;
    return;
  }

  changeHistory.innerHTML = items
    .slice(0, 100)
    .map((item) => {
      const med = getMedicationById(item.medId);
      const medName = med ? med.name : "Medication";

      return `
      <div class="history-item">
        <strong>${escapeHtml(medName)}</strong>
        <div class="muted small">${formatDateTime(item.changedAt)}</div>
        <div class="small">${escapeHtml(item.action)} • ${escapeHtml(item.detail)}</div>
      </div>
    `;
    })
    .join("");
}

function renderAll() {
  renderChildSwitcher();
  renderHeaderChildSummary();
  renderTodayMeds();
  renderMedList();
  renderTimeline();
  renderChangeHistory();
  updateMedicationFormMode();
  if (showArchivedBtn) showArchivedBtn.textContent = showArchived ? "Hide Archived" : "Show Archived";
}

/* -----------------------------
   Form helpers
----------------------------- */
function resetForm() {
  editingMedicationId = null;
  formTitle.textContent = "Add Medication";
  medName.value = "";
  medDose.value = "";
  medRoute.value = "";
  medType.value = "scheduled";
  medScheduleMode.value = "standard";
  medFreq.value = "";
  medTimes.value = "";
  medMinGap.value = String(DEFAULT_MIN_GAP_HOURS);
  medStartDate.value = todayYYYYMMDD();
  medEndDate.value = "";
  medNotes.value = "";
  resetWeanDraft();
  renderWeanSteps();
  updateMedicationFormMode();
}

function openForm(editMedication = null) {
  medFormCard.classList.remove("hidden");

  if (!editMedication) {
    resetForm();
    return;
  }

  const med = normalizeMedication(editMedication);

  editingMedicationId = med.id;
  formTitle.textContent = "Edit Medication";
  medName.value = med.name || "";
  medDose.value = med.dose || "";
  medRoute.value = med.route || "";
  medType.value = med.type || "scheduled";
  medScheduleMode.value = med.scheduleMode || "standard";
  medFreq.value = med.freq || "";
  medTimes.value = med.times || "";
  medMinGap.value = String(med.minGapHours || DEFAULT_MIN_GAP_HOURS);
  medStartDate.value = med.startDate || todayYYYYMMDD();
  medEndDate.value = med.endDate || "";
  medNotes.value = med.notes || "";

  weanStepsDraft = Array.isArray(med.taperSteps)
    ? med.taperSteps.map((step) => ({ ...step, id: uid("step") }))
    : [];

  renderWeanSteps();
  updateMedicationFormMode();
}

function closeForm() {
  medFormCard.classList.add("hidden");
}

function getFormPayload() {
  const scheduleMode = medScheduleMode.value || "standard";
  const taperSteps = scheduleMode === "wean" ? collectWeanSteps() : [];

  return {
    childId: getActiveChildIdSafe(),
    name: medName.value.trim(),
    dose: medDose.value.trim(),
    route: medRoute.value.trim(),
    type: medType.value,
    scheduleMode,
    freq: medFreq.value.trim(),
    times: medTimes.value.trim(),
    minGapHours: Number(medMinGap.value || DEFAULT_MIN_GAP_HOURS),
    graceMinutes: GRACE_MINUTES,
    startDate: medStartDate.value || todayYYYYMMDD(),
    endDate: medEndDate.value || "",
    taperSteps,
    notes: medNotes.value.trim()
  };
}

/* -----------------------------
   CRUD
----------------------------- */
function saveMedication() {
  const payload = getFormPayload();

  if (!payload.childId) {
    alert("No active child selected.");
    return;
  }

  if (!payload.name) {
    alert("Please enter a medication name.");
    return;
  }

  if (payload.type === "scheduled") {
    if (payload.scheduleMode === "standard") {
      if (!payload.times) {
        alert("Please enter at least one scheduled time.");
        return;
      }

      const invalidTime = parseTimesList(payload.times).find((t) => !parseTimeToTodayDate(t));
      if (invalidTime) {
        alert(`Invalid time format: ${invalidTime}. Use 08:00 or 8:00 AM.`);
        return;
      }
    }

    if (payload.scheduleMode === "temporary") {
      if (!payload.times) {
        alert("Please enter at least one scheduled time for the temporary medication.");
        return;
      }

      if (!payload.endDate) {
        alert("Please enter an end date for the temporary medication.");
        return;
      }

      if (payload.endDate < payload.startDate) {
        alert("End date cannot be before the start date.");
        return;
      }

      const invalidTime = parseTimesList(payload.times).find((t) => !parseTimeToTodayDate(t));
      if (invalidTime) {
        alert(`Invalid time format: ${invalidTime}. Use 08:00 or 8:00 AM.`);
        return;
      }
    }

    if (payload.scheduleMode === "wean") {
      const validationError = validateWeanSteps(payload.taperSteps);
      if (validationError) {
        alert(validationError);
        return;
      }
    }
  }

  if (editingMedicationId) {
    const existing = getMedicationById(editingMedicationId);
    if (!existing) return;

    const before = JSON.stringify({
      name: existing.name,
      dose: existing.dose,
      route: existing.route,
      type: existing.type,
      scheduleMode: existing.scheduleMode,
      freq: existing.freq,
      times: existing.times,
      minGapHours: existing.minGapHours,
      startDate: existing.startDate,
      endDate: existing.endDate,
      taperSteps: existing.taperSteps,
      notes: existing.notes
    });

    Object.assign(existing, payload);

    const after = JSON.stringify({
      name: existing.name,
      dose: existing.dose,
      route: existing.route,
      type: existing.type,
      scheduleMode: existing.scheduleMode,
      freq: existing.freq,
      times: existing.times,
      minGapHours: existing.minGapHours,
      startDate: existing.startDate,
      endDate: existing.endDate,
      taperSteps: existing.taperSteps,
      notes: existing.notes
    });

    saveDB(db);

    if (before !== after) {
      addChangeHistory(existing.id, "Updated", `${existing.name} details were updated.`);
    }

    closeForm();
    resetForm();
    renderAll();
    return;
  }

  const newMed = {
    id: uid("med"),
    archived: false,
    createdAt: new Date().toISOString(),
    ...payload
  };

  db.meds.push(newMed);
  saveDB(db);
  addChangeHistory(newMed.id, "Added", `${describeMedication(newMed)} was added.`);
  closeForm();
  resetForm();
  renderAll();
}

function toggleArchiveMedication(id) {
  const med = getMedicationById(id);
  if (!med) return;

  med.archived = !med.archived;
  saveDB(db);

  addChangeHistory(
    med.id,
    med.archived ? "Archived" : "Unarchived",
    `${med.name} was ${med.archived ? "archived" : "restored"}.`
  );

  renderAll();
}

function deleteMedication(id) {
  const med = getMedicationById(id);
  if (!med) return;

  const ok = confirm(`Delete ${med.name}?\n\nThis will also remove its dose history for this child.`);
  if (!ok) return;

  db.meds = db.meds.filter((m) => m.id !== id);
  db.doseEvents = db.doseEvents.filter((e) => e.medId !== id);
  db.medicationChangeHistory.unshift({
    id: uid("change"),
    childId: med.childId,
    medId: id,
    action: "Deleted",
    detail: `${med.name} was deleted.`,
    changedAt: new Date().toISOString()
  });

  saveDB(db);
  renderAll();
}

/* -----------------------------
   Logging
----------------------------- */
function confirmSafetyOverrideIfNeeded(med) {
  const warning = getRecentDoseSafetyWarning(med);
  if (!warning) return true;
  return confirm(`${warning}\n\nLog this dose anyway?`);
}

function logScheduledDose(medicationId, scheduledTime) {
  const med = getMedicationById(medicationId);
  if (!med) return;

  const todayLogs = getTodayLogsForMedication(med.id);
  const existingForTime = todayLogs.find(
    (log) => log.scheduledTime === scheduledTime && log.type === "scheduled"
  );

  if (existingForTime) {
    alert(
      `This ${scheduledTime} dose was already logged at ${formatTimeFromDate(
        new Date(existingForTime.time || existingForTime.loggedAt)
      )}.`
    );
    return;
  }

  if (!confirmSafetyOverrideIfNeeded(med)) return;

  db.doseEvents.unshift({
    id: uid("log"),
    childId: med.childId,
    medId: med.id,
    type: "scheduled",
    scheduledTime,
    time: new Date().toISOString(),
    note: ""
  });

  saveDB(db);
  renderAll();
  alert(`${med.name} logged for ${scheduledTime}.`);
}

function logPRNDose(medicationId) {
  const med = getMedicationById(medicationId);
  if (!med) return;

  if (!confirmSafetyOverrideIfNeeded(med)) return;

  const note = prompt("Optional note for this PRN dose:", "") || "";

  db.doseEvents.unshift({
    id: uid("log"),
    childId: med.childId,
    medId: med.id,
    type: "prn",
    scheduledTime: "",
    time: new Date().toISOString(),
    note
  });

  saveDB(db);
  renderAll();
  alert(`${med.name} PRN dose logged.`);
}

function skipScheduledDose(medicationId, scheduledTime) {
  const med = getMedicationById(medicationId);
  if (!med) return;

  const reason = prompt("Optional reason for skipping this dose:", "") || "";

  db.doseEvents.unshift({
    id: uid("log"),
    childId: med.childId,
    medId: med.id,
    type: "skip",
    scheduledTime,
    time: new Date().toISOString(),
    note: reason
  });

  saveDB(db);
  renderAll();
  alert(`${med.name} marked skipped for ${scheduledTime}.`);
}

/* -----------------------------
   Report export
----------------------------- */
function buildDoctorReport() {
  const child = getActiveChildSafe() || {};
  const activeMeds = getMedicationsForActiveChild().filter((m) => !m.archived);
  const recentLogs = [...getDoseEventsForActiveChild()]
    .sort((a, b) => new Date(b.time || b.loggedAt) - new Date(a.time || a.loggedAt))
    .slice(0, 30);

  let text = "";
  text += `CareNest Medication Report\n`;
  text += `Generated: ${new Date().toLocaleString()}\n\n`;

  text += `Child: ${child.name || "N/A"}\n`;
  text += `Age: ${child.age || getAgeFromBirthdate(child.birthdate) || "N/A"}\n`;
  text += `Diagnoses: ${
    normalizeDiagnoses(child.diagnoses).length ? normalizeDiagnoses(child.diagnoses).join(", ") : "N/A"
  }\n\n`;

  text += `ACTIVE MEDICATIONS\n`;
  text += `------------------\n`;

  if (!activeMeds.length) {
    text += `No active medications listed.\n`;
  } else {
    activeMeds.forEach((med) => {
      const safeMed = normalizeMedication(med);

      text += `• ${safeMed.name}\n`;
      text += `  Dose: ${getMedicationDisplayDoseForToday(safeMed) || safeMed.dose || "N/A"}\n`;
      text += `  Route: ${safeMed.route || "N/A"}\n`;
      text += `  Type: ${safeMed.type === "prn" ? "PRN" : "Scheduled"}\n`;
      text += `  Schedule Mode: ${safeMed.scheduleMode || "standard"}\n`;
      text += `  Frequency: ${safeMed.freq || "N/A"}\n`;
      text += `  Times: ${getMedicationDisplayTimesForToday(safeMed) || "N/A"}\n`;
      if (safeMed.endDate) {
        text += `  End Date: ${safeMed.endDate}\n`;
      }
      if (safeMed.scheduleMode === "wean" && Array.isArray(safeMed.taperSteps)) {
        text += `  Taper Steps:\n`;
        safeMed.taperSteps.forEach((step, idx) => {
          text += `    ${idx + 1}. ${step.startDate} to ${step.endDate} — ${step.dose} — ${step.times}\n`;
        });
      }
      text += `  Notes: ${safeMed.notes || "N/A"}\n\n`;
    });
  }

  text += `RECENT DOSE LOG\n`;
  text += `---------------\n`;

  if (!recentLogs.length) {
    text += `No medication logs yet.\n`;
  } else {
    recentLogs.forEach((log) => {
      const med = getMedicationById(log.medId);
      const medName = med ? med.name : "Unknown";

      text += `• ${formatDateTime(log.time || log.loggedAt)} — ${medName}`;

      if (log.type === "scheduled" && log.scheduledTime) {
        text += ` — Scheduled dose (${log.scheduledTime})`;
      } else if (log.type === "prn") {
        text += ` — PRN dose`;
      } else if (log.type === "skip") {
        text += ` — Skipped dose (${log.scheduledTime || "time not listed"})`;
      }

      if (log.note) {
        text += ` — Note: ${log.note}`;
      }

      text += `\n`;
    });
  }

  text += `\nMEDICATION CHANGE HISTORY\n`;
  text += `-------------------------\n`;

  const history = getChangeHistoryForActiveChild();

  if (!history.length) {
    text += `No medication changes recorded.\n`;
  } else {
    history.slice(0, 30).forEach((item) => {
      text += `• ${formatDateTime(item.changedAt)} — ${item.action} — ${item.detail}\n`;
    });
  }

  return text;
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportReport() {
  const child = getActiveChildSafe() || {};
  const report = buildDoctorReport();

  if (reportOutput) {
    reportOutput.textContent = report;
  }

  if (reportCard) {
    reportCard.classList.remove("hidden");
  }

  const safeName = (child.name || "child")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "");

  const filename = `CareNest_Med_Report_${safeName || "child"}_${todayYYYYMMDD()}.txt`;
  downloadTextFile(filename, report);
}

/* -----------------------------
   Events
----------------------------- */
addMedBtn?.addEventListener("click", () => openForm());

addMedBtnSidebar?.addEventListener("click", () => openForm());
addMedBtnQuick?.addEventListener("click", () => openForm());

cancelMedBtn?.addEventListener("click", () => {
  closeForm();
  resetForm();
});

saveMedBtn?.addEventListener("click", saveMedication);
refreshBtn?.addEventListener("click", renderAll);
refreshBtnSidebar?.addEventListener("click", renderAll);

showArchivedBtn?.addEventListener("click", () => {
  showArchived = !showArchived;
  renderAll();
});

showArchivedBtnSidebar?.addEventListener("click", () => {
  showArchived = !showArchived;
  renderAll();
});

exportReportBtn?.addEventListener("click", exportReport);
exportReportBtnSidebar?.addEventListener("click", exportReport);
exportReportBtnQuick?.addEventListener("click", exportReport);

copyReportBtn?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(reportOutput.textContent || "");
    alert("Report copied.");
  } catch (err) {
    alert("Could not copy report.");
  }
});

if (medType) medType.addEventListener("change", updateMedicationFormMode);
if (medScheduleMode) medScheduleMode.addEventListener("change", updateMedicationFormMode);

if (addWeanStepBtn) {
  addWeanStepBtn.addEventListener("click", () => addWeanStep());
}

if (weanStepsList) {
  weanStepsList.addEventListener("input", (e) => {
    const stepId = e.target.dataset.stepId;
    if (!stepId) return;

    if (e.target.classList.contains("js-wean-label")) updateWeanStep(stepId, "label", e.target.value);
    if (e.target.classList.contains("js-wean-dose")) updateWeanStep(stepId, "dose", e.target.value);
    if (e.target.classList.contains("js-wean-start")) updateWeanStep(stepId, "startDate", e.target.value);
    if (e.target.classList.contains("js-wean-end")) updateWeanStep(stepId, "endDate", e.target.value);
    if (e.target.classList.contains("js-wean-times")) updateWeanStep(stepId, "times", e.target.value);
  });

  weanStepsList.addEventListener("click", (e) => {
    const btn = e.target.closest(".js-remove-wean-step");
    if (!btn) return;
    removeWeanStep(btn.dataset.stepId);
  });
}

document.addEventListener("click", (e) => {
  const scheduledBtn = e.target.closest(".js-log-scheduled");
  if (scheduledBtn) {
    logScheduledDose(scheduledBtn.dataset.id, scheduledBtn.dataset.time);
    return;
  }

  const prnBtn = e.target.closest(".js-log-prn");
  if (prnBtn) {
    logPRNDose(prnBtn.dataset.id);
    return;
  }

  const skipBtn = e.target.closest(".js-skip-dose");
  if (skipBtn) {
    skipScheduledDose(skipBtn.dataset.id, skipBtn.dataset.time);
    return;
  }

  const editBtn = e.target.closest(".js-edit-med");
  if (editBtn) {
    const med = getMedicationById(editBtn.dataset.id);
    if (med) openForm(med);
    return;
  }

  const archiveBtn = e.target.closest(".js-toggle-archive");
  if (archiveBtn) {
    toggleArchiveMedication(archiveBtn.dataset.id);
    return;
  }

  const deleteBtn = e.target.closest(".js-delete-med");
  if (deleteBtn) {
    deleteMedication(deleteBtn.dataset.id);
  }
});

childSwitcher?.addEventListener("change", () => {
  setActiveChildIdSafe(childSwitcher.value);
  closeForm();
  resetForm();
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

/* -----------------------------
   Init
----------------------------- */
db.meds = db.meds.map(normalizeMedication);
saveDB(db);

resetForm();
renderAll();