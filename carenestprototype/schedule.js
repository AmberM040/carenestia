document.addEventListener("DOMContentLoaded", () => {
  let db = ensureDB(loadDB());
  saveDB(db);

  const childSwitcher = document.getElementById("childSwitcher");
  const childSummary = document.getElementById("childSummary");
  const childAvatar = document.getElementById("childAvatar");
  const logoutBtn = document.getElementById("logoutBtn");

  const scheduleViewTabs = document.getElementById("scheduleViewTabs");
  const scheduleCategoryFilter = document.getElementById("scheduleCategoryFilter");
  const btnClearScheduleFilters = document.getElementById("btnClearScheduleFilters");
  const btnAddTask = document.getElementById("btnAddTask");
  const btnAddTaskSidebar = document.getElementById("btnAddTaskSidebar");
  const btnAddTaskQuick = document.getElementById("btnAddTaskQuick");

  const btnEmergency = document.getElementById("btnEmergency");
  const emergencyModal = document.getElementById("emergencyModal");
  const btnCloseEmergency = document.getElementById("btnCloseEmergency");
  const emergencyBody = document.getElementById("emergencyBody");

  const todayView = document.getElementById("todayView");
  const weekView = document.getElementById("weekView");
  const monthView = document.getElementById("monthView");

  const dueNowList = document.getElementById("dueNowList");
  const upNextList = document.getElementById("upNextList");
  const completedList = document.getElementById("completedList");
  const weekList = document.getElementById("weekList");
  const monthList = document.getElementById("monthList");
  const scheduleEmptyState = document.getElementById("scheduleEmptyState");

  const taskModal = document.getElementById("taskModal");
  const btnCloseTaskModal = document.getElementById("btnCloseTaskModal");
  const btnSaveTask = document.getElementById("btnSaveTask");
  const taskSaveStatus = document.getElementById("taskSaveStatus");

  const taskTitle = document.getElementById("taskTitle");
  const taskCategory = document.getElementById("taskCategory");
  const taskDate = document.getElementById("taskDate");
  const taskTime = document.getElementById("taskTime");
  const taskFrequency = document.getElementById("taskFrequency");
  const taskAssignedTo = document.getElementById("taskAssignedTo");
  const taskDaysOfWeek = document.getElementById("taskDaysOfWeek");
  const taskDuration = document.getElementById("taskDuration");
  const taskReminder = document.getElementById("taskReminder");
  const taskInstructions = document.getElementById("taskInstructions");
  const taskShareable = document.getElementById("taskShareable");

  let currentView = "today";
  let statusTimer = null;

  const required = {
    childSwitcher,
    childSummary,
    scheduleViewTabs,
    scheduleCategoryFilter,
    btnClearScheduleFilters,
    btnAddTask,
    todayView,
    weekView,
    monthView,
    dueNowList,
    upNextList,
    completedList,
    weekList,
    monthList,
    scheduleEmptyState,
    taskModal,
    btnCloseTaskModal,
    btnSaveTask,
    taskSaveStatus,
    taskTitle,
    taskCategory,
    taskDate,
    taskTime,
    taskFrequency,
    taskAssignedTo,
    taskDaysOfWeek,
    taskDuration,
    taskReminder,
    taskInstructions,
    taskShareable
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    alert("Missing elements in schedule.html: " + missing.join(", "));
    return;
  }

  function getSupabaseClient() {
    if (window.supabaseClient) return window.supabaseClient;
    if (window.supabase?.from) return window.supabase;
    return null;
  }

  async function fetchUser() {
    const supabase = getSupabaseClient();
    if (!supabase?.auth) return null;

    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.warn("Could not get user:", error.message);
      return null;
    }

    return data?.user || null;
  }

  async function fetchChildrenForUser(userId) {
    const supabase = getSupabaseClient();
    if (!supabase || !userId) return [];

    const { data, error } = await supabase
      .from("children")
      .select("*")
      .eq("parent_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Could not load children:", error.message);
      return [];
    }

    return (data || []).map((child) => ({
      ...child,
      diagnoses: normalizeDiagnoses(child.diagnoses),
      age: child.age ?? getAgeFromBirthdate(child.birthdate)
    }));
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
    saveDB(db);
  }

  function ensureSchedulesForChild(childId) {
    if (!db.schedules) db.schedules = {};
    if (!Array.isArray(db.schedules[childId])) db.schedules[childId] = [];
  }

  function getTasksForActiveChild() {
    const child = activeChild();
    if (!child) return [];
    ensureSchedulesForChild(child.id);
    return db.schedules[child.id];
  }

  function getMedicationScheduleForDate(date) {
    const child = activeChild();
    if (!child) return [];

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const dateKey = `${yyyy}-${mm}-${dd}`;

    const medItems = generateMedicationScheduleItems(db, child.id, dateKey);

    return medItems.map((item) => ({
      ...item,
      source: "medication",
      active: true,
      frequency: "daily",
      assignedTo: "",
      durationMinutes: 0,
      reminderMinutes: 0,
      shareable: true,
      completions: [],
      createdAt: item.date || new Date().toISOString()
    }));
  }

  function showStatus(message, isError = false) {
    taskSaveStatus.textContent = message;
    taskSaveStatus.style.color = isError ? "#b63724" : "";

    if (statusTimer) clearTimeout(statusTimer);

    statusTimer = setTimeout(() => {
      taskSaveStatus.textContent = "Ready to save.";
      taskSaveStatus.style.color = "";
    }, 2200);
  }

  function fillChildSwitcher() {
    childSwitcher.innerHTML = "";
    const children = getChildrenSafe();

    if (!children.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No children yet";
      childSwitcher.appendChild(option);
      return;
    }

    const selectedId = activeChild()?.id || "";

    children.forEach((child) => {
      const option = document.createElement("option");
      option.value = child.id;
      option.textContent = child.name || "Unnamed Child";
      if (String(child.id) === String(selectedId)) option.selected = true;
      childSwitcher.appendChild(option);
    });
  }

  function updateChildSummary() {
    const child = activeChild();

    if (!child) {
      childSummary.textContent = "Age —";
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

    childSummary.textContent = summaryText;

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

  function renderEmergencySheet() {
    if (!emergencyBody) return;

    const child = activeChild();
    if (!child) {
      emergencyBody.innerHTML = `<div class="muted">No child selected.</div>`;
      return;
    }

    const plan = (db.carePlans && db.carePlans[child.id]) || null;
    const diagnoses = normalizeDiagnoses(child.diagnoses).length
      ? normalizeDiagnoses(child.diagnoses).join(", ")
      : "None listed";

    emergencyBody.innerHTML = `
      <div class="card" style="padding:12px;">
        <strong>Child</strong>
        <div class="muted" style="margin-top:6px;">
          <div><strong>Name:</strong> ${escapeHtml(child.name || "—")}</div>
          <div><strong>Age:</strong> ${escapeHtml((child.age ?? getAgeFromBirthdate(child.birthdate)) || "—"}</div>
          <div><strong>Diagnoses:</strong> ${escapeHtml(diagnoses)}</div>
        </div>
      </div>

      <div class="card" style="padding:12px;">
        <strong>Allergies</strong>
        <div class="muted" style="margin-top:6px;">
          ${escapeHtml(plan?.allergies || child.allergies || "None listed")}
        </div>
      </div>

      <div class="card" style="padding:12px;">
        <strong>Emergency Protocol</strong>
        <div class="muted" style="margin-top:6px;">
          ${escapeHtml(plan?.seizure_protocol || "No emergency protocol added yet.")}
        </div>
      </div>

      <div class="card" style="padding:12px;">
        <strong>When to Call EMS</strong>
        <div class="muted" style="margin-top:6px;">
          ${escapeHtml(plan?.ems_when || "No EMS guidance added yet.")}
        </div>
      </div>

      <div class="card" style="padding:12px;">
        <strong>Contacts</strong>
        <div class="muted" style="margin-top:6px;">
          <div><strong>Emergency Contacts:</strong> ${escapeHtml(plan?.emergency_contacts || "—")}</div>
          <div><strong>Doctor Contacts:</strong> ${escapeHtml(plan?.doctor_contacts || "—")}</div>
          <div><strong>Hospital:</strong> ${escapeHtml(plan?.preferred_hospital || "—")}</div>
        </div>
      </div>
    `;
  }

  function setDefaultTaskDateTime() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");

    taskDate.value = `${yyyy}-${mm}-${dd}`;
    taskTime.value = `${hh}:${min}`;
  }

  function resetTaskForm() {
    taskTitle.value = "";
    taskCategory.value = "Medication";
    taskAssignedTo.value = "";
    taskFrequency.value = "daily";
    taskDuration.value = "";
    taskReminder.value = "0";
    taskInstructions.value = "";
    taskShareable.value = "yes";

    taskDaysOfWeek.querySelectorAll('input[type="checkbox"]').forEach((box) => {
      box.checked = false;
    });

    setDefaultTaskDateTime();
    taskSaveStatus.textContent = "Ready to save.";
    taskSaveStatus.style.color = "";
  }

  function openTaskModal() {
    taskModal.classList.remove("hidden");
  }

  function closeTaskModal() {
    taskModal.classList.add("hidden");
  }

  function getCheckedWeekdays() {
    return [...taskDaysOfWeek.querySelectorAll('input[type="checkbox"]:checked')]
      .map((box) => Number(box.value))
      .sort((a, b) => a - b);
  }

  function buildTaskObject() {
    const startDateTime = new Date(`${taskDate.value}T${taskTime.value}`);
    const startAt = Number.isNaN(startDateTime.getTime())
      ? new Date().toISOString()
      : startDateTime.toISOString();

    return {
      id: crypto?.randomUUID ? crypto.randomUUID() : `task_${Date.now()}`,
      title: taskTitle.value.trim(),
      category: taskCategory.value,
      startDate: taskDate.value,
      time: taskTime.value,
      startAt,
      frequency: taskFrequency.value,
      weekdays: getCheckedWeekdays(),
      durationMinutes: Number(taskDuration.value) || 0,
      assignedTo: taskAssignedTo.value.trim(),
      reminderMinutes: Number(taskReminder.value) || 0,
      instructions: taskInstructions.value.trim(),
      shareable: taskShareable.value === "yes",
      active: true,
      createdAt: new Date().toISOString(),
      completions: []
    };
  }

  function saveTask() {
    if (!taskTitle.value.trim()) {
      showStatus("Please enter a task name.", true);
      return;
    }

    if (!taskDate.value) {
      showStatus("Please choose a start date.", true);
      return;
    }

    if (!taskTime.value) {
      showStatus("Please choose a time.", true);
      return;
    }

    if (taskFrequency.value === "weekly" && getCheckedWeekdays().length === 0) {
      showStatus("Choose at least one weekday for weekly tasks.", true);
      return;
    }

    const child = activeChild();
    if (!child) {
      showStatus("No active child selected.", true);
      return;
    }

    ensureSchedulesForChild(child.id);
    db.schedules[child.id].push(buildTaskObject());
    saveDB(db);

    resetTaskForm();
    closeTaskModal();
    renderAll();
    showStatus("Task saved.");
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

  function isTaskScheduledOnDate(task, date) {
    if (task.active === false) return false;

    const startDate = task.startDate ? parseISODateLocal(task.startDate) : new Date(task.startAt);
    const targetDate = startOfDay(date);
    const taskStartDay = startOfDay(startDate);

    if (targetDate < taskStartDay) return false;

    if (task.frequency === "once") {
      return isSameDay(taskStartDay, targetDate);
    }

    if (task.frequency === "daily") {
      return true;
    }

    if (task.frequency === "weekly") {
      const weekdays = Array.isArray(task.weekdays) ? task.weekdays : [];
      return weekdays.includes(targetDate.getDay());
    }

    if (task.frequency === "monthly") {
      return taskStartDay.getDate() === targetDate.getDate();
    }

    return false;
  }

  function getCompletionKey(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function isCompletedOnDate(task, date) {
    const key = getCompletionKey(date);
    return Array.isArray(task.completions) && task.completions.includes(key);
  }

  function getMedicationLogForDateAndTime(medId, date, scheduledTime) {
    const targetKey = getCompletionKey(date);

    return (db.doseEvents || []).find((log) => {
      if (String(log.medId) !== String(medId)) return false;
      if (log.type !== "scheduled" && log.type !== "skip") return false;
      if (log.scheduledTime !== scheduledTime) return false;

      const logDate = new Date(log.time || log.loggedAt);
      return getCompletionKey(logDate) === targetKey;
    });
  }

  function isMedicationCompletedOnDate(medTask, date) {
    if (medTask.source !== "medication") return false;
    const log = getMedicationLogForDateAndTime(medTask.medId, date, medTask.time);
    return !!log && log.type === "scheduled";
  }

  function isMedicationSkippedOnDate(medTask, date) {
    if (medTask.source !== "medication") return false;
    const log = getMedicationLogForDateAndTime(medTask.medId, date, medTask.time);
    return !!log && log.type === "skip";
  }

  function logMedicationDose(medTask, occurrenceDate) {
    const child = activeChild();
    if (!child) return;

    if (!Array.isArray(db.doseEvents)) db.doseEvents = [];

    const existing = getMedicationLogForDateAndTime(medTask.medId, occurrenceDate, medTask.time);
    if (existing && existing.type === "scheduled") {
      showStatus("Dose already logged.");
      return;
    }

    if (existing && existing.type === "skip") {
      db.doseEvents = db.doseEvents.filter((evt) => evt.id !== existing.id);
    }

    db.doseEvents.unshift({
      id: crypto?.randomUUID ? crypto.randomUUID() : `dose_${Date.now()}`,
      childId: child.id,
      medId: medTask.medId,
      type: "scheduled",
      scheduledTime: medTask.time,
      time: new Date().toISOString(),
      note: medTask.instructions || "",
      medicationName: medTask.title || "",
      scheduledFor: occurrenceDate.toISOString()
    });

    saveDB(db);
    renderAll();
    showStatus("Dose logged.");
  }

  function skipMedicationDose(medTask, occurrenceDate) {
    const child = activeChild();
    if (!child) return;

    if (!Array.isArray(db.doseEvents)) db.doseEvents = [];

    const existing = getMedicationLogForDateAndTime(medTask.medId, occurrenceDate, medTask.time);
    if (existing && existing.type === "skip") {
      showStatus("Dose already marked skipped.");
      return;
    }

    if (existing && existing.type === "scheduled") {
      db.doseEvents = db.doseEvents.filter((evt) => evt.id !== existing.id);
    }

    db.doseEvents.unshift({
      id: crypto?.randomUUID ? crypto.randomUUID() : `dose_${Date.now()}`,
      childId: child.id,
      medId: medTask.medId,
      type: "skip",
      scheduledTime: medTask.time,
      time: new Date().toISOString(),
      note: `Skipped from schedule${medTask.instructions ? ` • ${medTask.instructions}` : ""}`,
      medicationName: medTask.title || "",
      scheduledFor: occurrenceDate.toISOString()
    });

    saveDB(db);
    renderAll();
    showStatus("Dose marked skipped.");
  }

  function undoMedicationLog(medTask, occurrenceDate) {
    const existing = getMedicationLogForDateAndTime(medTask.medId, occurrenceDate, medTask.time);
    if (!existing) return;

    db.doseEvents = (db.doseEvents || []).filter((evt) => evt.id !== existing.id);
    saveDB(db);
    renderAll();
    showStatus("Medication log removed.");
  }

  function markTaskComplete(taskId, date) {
    const child = activeChild();
    if (!child) return;

    ensureSchedulesForChild(child.id);
    const task = db.schedules[child.id].find((item) => item.id === taskId);
    if (!task) return;

    if (!Array.isArray(task.completions)) task.completions = [];

    const key = getCompletionKey(date);
    if (!task.completions.includes(key)) {
      task.completions.push(key);
      saveDB(db);
      renderAll();
    }
  }

  function undoTaskComplete(taskId, date) {
    const child = activeChild();
    if (!child) return;

    ensureSchedulesForChild(child.id);
    const task = db.schedules[child.id].find((item) => item.id === taskId);
    if (!task || !Array.isArray(task.completions)) return;

    const key = getCompletionKey(date);
    task.completions = task.completions.filter((entry) => entry !== key);
    saveDB(db);
    renderAll();
  }

  function deleteTask(taskId) {
    const child = activeChild();
    if (!child) return;

    ensureSchedulesForChild(child.id);
    db.schedules[child.id] = db.schedules[child.id].filter((task) => task.id !== taskId);
    saveDB(db);
    renderAll();
  }

  function formatTime(timeValue) {
    if (!timeValue) return "No time";
    const [h, m] = timeValue.split(":").map(Number);
    const date = new Date();
    date.setHours(h || 0, m || 0, 0, 0);

    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function formatFullDate(date) {
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  function getCategoryMeta(category) {
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

  function makeTaskCard(task, occurrenceDate, completed = false, isDueNow = false) {
    const meta = getCategoryMeta(task.category);
    const card = document.createElement("div");
    card.className = "log-card";

    const subtitleParts = [];
    subtitleParts.push(formatFullDate(occurrenceDate));
    subtitleParts.push(formatTime(task.time));

    if (task.source === "medication") {
      if (task.instructions) subtitleParts.push(task.instructions);
      if (task.stepLabel) subtitleParts.push(task.stepLabel);
      subtitleParts.push("From Medications");
    } else {
      if (task.assignedTo) subtitleParts.push(`Assigned to ${task.assignedTo}`);
      if (task.durationMinutes) subtitleParts.push(`${task.durationMinutes} min`);
    }

    const medLog =
      task.source === "medication"
        ? getMedicationLogForDateAndTime(task.medId, occurrenceDate, task.time)
        : null;

    const statusLabel =
      task.source === "medication"
        ? medLog?.type === "scheduled"
          ? "Dose Logged"
          : medLog?.type === "skip"
            ? "Skipped"
            : isDueNow
              ? "Due Now"
              : task.category
        : completed
          ? "Completed"
          : isDueNow
            ? "Due Now"
            : task.category;

    card.innerHTML = `
      <div class="log-icon ${meta.cls}">${meta.icon}</div>
      <div class="log-main">
        <h3>
          ${escapeHtml(task.title)}
          <span class="time">${formatTime(task.time)}</span>
        </h3>
        <p>${escapeHtml(task.instructions || task.note || "No extra instructions.")}</p>
        <p class="muted mt-8">${escapeHtml(subtitleParts.join(" • "))}</p>
        <p class="muted mt-8">
          ${escapeHtml(task.category)}
          ${
            task.source === "medication"
              ? ` • ${
                  task.scheduleMode === "temporary"
                    ? "Temporary Med"
                    : task.scheduleMode === "wean"
                      ? "Wean / Taper"
                      : "Medication"
                }`
              : ` • ${task.frequency.charAt(0).toUpperCase() + task.frequency.slice(1)}${task.shareable ? " • Shared" : ""}`
          }
        </p>
      </div>
      <div class="log-side">
        <span class="log-tag ${meta.cls}">${escapeHtml(statusLabel)}</span>
      </div>
    `;

    const buttonRow = document.createElement("div");
    buttonRow.className = "row";
    buttonRow.style.marginTop = "12px";
    buttonRow.style.flexWrap = "wrap";
    buttonRow.style.gap = "8px";

    if (task.source === "medication") {
      if (medLog?.type === "scheduled") {
        const undoBtn = document.createElement("button");
        undoBtn.className = "btn btn-ghost";
        undoBtn.type = "button";
        undoBtn.textContent = "Undo Log";
        undoBtn.addEventListener("click", () => undoMedicationLog(task, occurrenceDate));
        buttonRow.appendChild(undoBtn);
      } else if (medLog?.type === "skip") {
        const undoBtn = document.createElement("button");
        undoBtn.className = "btn btn-ghost";
        undoBtn.type = "button";
        undoBtn.textContent = "Undo Skip";
        undoBtn.addEventListener("click", () => undoMedicationLog(task, occurrenceDate));
        buttonRow.appendChild(undoBtn);
      } else {
        const logDoseBtn = document.createElement("button");
        logDoseBtn.className = "btn btn-primary";
        logDoseBtn.type = "button";
        logDoseBtn.textContent = "Log Dose";
        logDoseBtn.addEventListener("click", () => logMedicationDose(task, occurrenceDate));
        buttonRow.appendChild(logDoseBtn);

        const skipBtn = document.createElement("button");
        skipBtn.className = "btn btn-ghost";
        skipBtn.type = "button";
        skipBtn.textContent = "Mark Skipped";
        skipBtn.addEventListener("click", () => skipMedicationDose(task, occurrenceDate));
        buttonRow.appendChild(skipBtn);
      }

      const medBtn = document.createElement("a");
      medBtn.className = "btn btn-ghost";
      medBtn.href = "meds.html";
      medBtn.textContent = "Open Meds";
      buttonRow.appendChild(medBtn);
    } else {
      if (completed) {
        const undoBtn = document.createElement("button");
        undoBtn.className = "btn btn-ghost";
        undoBtn.type = "button";
        undoBtn.textContent = "Undo";
        undoBtn.addEventListener("click", () => undoTaskComplete(task.id, occurrenceDate));
        buttonRow.appendChild(undoBtn);
      } else {
        const completeBtn = document.createElement("button");
        completeBtn.className = "btn btn-primary";
        completeBtn.type = "button";
        completeBtn.textContent = "Complete";
        completeBtn.addEventListener("click", () => markTaskComplete(task.id, occurrenceDate));
        buttonRow.appendChild(completeBtn);
      }

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn btn-danger";
      deleteBtn.type = "button";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => deleteTask(task.id));
      buttonRow.appendChild(deleteBtn);
    }

    card.querySelector(".log-main").appendChild(buttonRow);
    return card;
  }

  function taskMatchesCategory(task) {
    const selected = scheduleCategoryFilter.value;
    return selected === "all" || task.category === selected;
  }

  function getTodayBuckets() {
    const now = new Date();
    const tasks = getTasksForActiveChild().filter(taskMatchesCategory);
    const medTasks = getMedicationScheduleForDate(now).filter(taskMatchesCategory);

    const dueNow = [];
    const upNext = [];
    const completed = [];

    tasks.forEach((task) => {
      if (!isTaskScheduledOnDate(task, now)) return;

      const occurrenceDate = getOccurrenceDate(task, now);

      if (isCompletedOnDate(task, now)) {
        completed.push({ task, occurrenceDate });
        return;
      }

      const diffMs = occurrenceDate.getTime() - now.getTime();

      if (diffMs <= 30 * 60 * 1000) {
        dueNow.push({ task, occurrenceDate });
      } else {
        upNext.push({ task, occurrenceDate });
      }
    });

    medTasks.forEach((task) => {
      const occurrenceDate = getOccurrenceDate(task, now);

      if (isMedicationCompletedOnDate(task, now) || isMedicationSkippedOnDate(task, now)) {
        completed.push({ task, occurrenceDate });
        return;
      }

      const diffMs = occurrenceDate.getTime() - now.getTime();

      if (diffMs <= 30 * 60 * 1000) {
        dueNow.push({ task, occurrenceDate });
      } else {
        upNext.push({ task, occurrenceDate });
      }
    });

    dueNow.sort((a, b) => a.occurrenceDate - b.occurrenceDate);
    upNext.sort((a, b) => a.occurrenceDate - b.occurrenceDate);
    completed.sort((a, b) => a.occurrenceDate - b.occurrenceDate);

    return { dueNow, upNext, completed };
  }

  function renderEmptyInto(container, message) {
    container.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  }

  function renderTodayView() {
    const buckets = getTodayBuckets();

    dueNowList.innerHTML = "";
    upNextList.innerHTML = "";
    completedList.innerHTML = "";

    if (!buckets.dueNow.length) {
      renderEmptyInto(dueNowList, "Nothing due right now.");
    } else {
      buckets.dueNow.forEach(({ task, occurrenceDate }) => {
        dueNowList.appendChild(makeTaskCard(task, occurrenceDate, false, true));
      });
    }

    if (!buckets.upNext.length) {
      renderEmptyInto(upNextList, "No upcoming tasks.");
    } else {
      buckets.upNext.forEach(({ task, occurrenceDate }) => {
        upNextList.appendChild(makeTaskCard(task, occurrenceDate, false, false));
      });
    }

    if (!buckets.completed.length) {
      renderEmptyInto(completedList, "Nothing completed yet.");
    } else {
      buckets.completed.forEach(({ task, occurrenceDate }) => {
        completedList.appendChild(makeTaskCard(task, occurrenceDate, true, false));
      });
    }

    const hasAnything =
      buckets.dueNow.length || buckets.upNext.length || buckets.completed.length;

    scheduleEmptyState.classList.toggle("hidden", !!hasAnything);
  }

  function getDatesForRange(days) {
    const today = new Date();
    const out = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      out.push(date);
    }

    return out;
  }

  function renderGroupedRange(listEl, dates, emptyMessage) {
    listEl.innerHTML = "";
    const tasks = getTasksForActiveChild().filter(taskMatchesCategory);
    let hasAnything = false;

    dates.forEach((date) => {
      const dayTasks = [];

      tasks.forEach((task) => {
        if (!isTaskScheduledOnDate(task, date)) return;

        dayTasks.push({
          task,
          occurrenceDate: getOccurrenceDate(task, date),
          completed: isCompletedOnDate(task, date)
        });
      });

      getMedicationScheduleForDate(date)
        .filter(taskMatchesCategory)
        .forEach((task) => {
          dayTasks.push({
            task,
            occurrenceDate: getOccurrenceDate(task, date),
            completed:
              isMedicationCompletedOnDate(task, date) || isMedicationSkippedOnDate(task, date)
          });
        });

      if (!dayTasks.length) return;
      hasAnything = true;

      dayTasks.sort((a, b) => a.occurrenceDate - b.occurrenceDate);

      const group = document.createElement("div");
      group.className = "stack-list";
      group.style.marginBottom = "20px";

      const heading = document.createElement("div");
      heading.className = "section-head";
      heading.innerHTML = `<h3>${escapeHtml(
        date.toLocaleDateString([], {
          weekday: "long",
          month: "short",
          day: "numeric"
        })
      )}</h3>`;
      group.appendChild(heading);

      dayTasks.forEach(({ task, occurrenceDate, completed }) => {
        group.appendChild(makeTaskCard(task, occurrenceDate, completed, false));
      });

      listEl.appendChild(group);
    });

    if (!hasAnything) {
      listEl.innerHTML = `<div class="empty-state">${escapeHtml(emptyMessage)}</div>`;
    }

    scheduleEmptyState.classList.toggle("hidden", hasAnything);
  }

  function renderWeekView() {
    renderGroupedRange(weekList, getDatesForRange(7), "No tasks scheduled this week.");
  }

  function renderMonthView() {
    renderGroupedRange(monthList, getDatesForRange(31), "No tasks scheduled this month.");
  }

  function setActiveView(view) {
    currentView = view;

    scheduleViewTabs.querySelectorAll("button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });

    todayView.classList.toggle("hidden", view !== "today");
    weekView.classList.toggle("hidden", view !== "week");
    monthView.classList.toggle("hidden", view !== "month");

    renderCurrentView();
  }

  function renderCurrentView() {
    if (currentView === "today") renderTodayView();
    if (currentView === "week") renderWeekView();
    if (currentView === "month") renderMonthView();
  }

  function renderAll() {
    fillChildSwitcher();
    updateChildSummary();
    renderEmergencySheet();
    renderCurrentView();
  }

  function clearFilters() {
    scheduleCategoryFilter.value = "all";
    renderCurrentView();
  }

  btnAddTask.addEventListener("click", () => {
    resetTaskForm();
    openTaskModal();
  });

  btnAddTaskSidebar?.addEventListener("click", () => {
    btnAddTask.click();
  });

  btnAddTaskQuick?.addEventListener("click", () => {
    btnAddTask.click();
  });

  btnCloseTaskModal.addEventListener("click", closeTaskModal);

  taskModal.addEventListener("click", (e) => {
    if (e.target === taskModal) closeTaskModal();
  });

  btnSaveTask.addEventListener("click", saveTask);

  childSwitcher.addEventListener("change", () => {
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

  scheduleCategoryFilter.addEventListener("change", renderCurrentView);
  btnClearScheduleFilters.addEventListener("click", clearFilters);

  scheduleViewTabs.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      setActiveView(btn.dataset.view);
    });
  });

  btnEmergency?.addEventListener("click", () => {
    emergencyModal?.classList.remove("hidden");
  });

  btnCloseEmergency?.addEventListener("click", () => {
    emergencyModal?.classList.add("hidden");
  });

  emergencyModal?.addEventListener("click", (e) => {
    if (e.target === emergencyModal) {
      emergencyModal.classList.add("hidden");
    }
  });

  async function init() {
    db = ensureDB(loadDB());

    const currentUser = await fetchUser();

    if (currentUser?.id) {
      const fetchedChildren = await fetchChildrenForUser(currentUser.id);

      if (fetchedChildren.length) {
        db.children = fetchedChildren;
      }
    }

    const validActiveChild =
      db.children.find((child) => String(child.id) === String(db.activeChildId || db.currentChildId)) ||
      db.children[0] ||
      null;

    db.activeChildId = validActiveChild ? validActiveChild.id : null;
    db.currentChildId = db.activeChildId;

    saveDB(db);

    setDefaultTaskDateTime();
    renderAll();
    setActiveView("today");
  }

  init();
});
