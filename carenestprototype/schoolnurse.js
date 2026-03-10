document.addEventListener("DOMContentLoaded", async () => {
  let db = ensureDB(loadDB());
  const supabase = window.supabaseClient || null;

  const childSwitcher = document.getElementById("childSwitcher");
  const childAvatar = document.getElementById("childAvatar");
  const childSummary = document.getElementById("childSummary");
  const logoutBtn = document.getElementById("logoutBtn");

  const schoolScheduleList = document.getElementById("schoolScheduleList");
  const schoolActivityList = document.getElementById("schoolActivityList");
  const emergencySnapshot = document.getElementById("emergencySnapshot");
  const schoolNotesPanel = document.getElementById("schoolNotesPanel");

  const btnOpenEmergency = document.getElementById("btnOpenEmergency");
  const schoolEmergencyModal = document.getElementById("schoolEmergencyModal");
  const btnCloseEmergencyModal = document.getElementById("btnCloseEmergencyModal");
  const schoolEmergencyBody = document.getElementById("schoolEmergencyBody");

  const schoolLogModal = document.getElementById("schoolLogModal");
  const schoolLogModalTitle = document.getElementById("schoolLogModalTitle");
  const btnCloseSchoolLogModal = document.getElementById("btnCloseSchoolLogModal");
  const btnSaveSchoolLog = document.getElementById("btnSaveSchoolLog");

  const schoolLogCategory = document.getElementById("schoolLogCategory");
  const schoolLogAuthor = document.getElementById("schoolLogAuthor");
  const schoolLogDate = document.getElementById("schoolLogDate");
  const schoolLogTime = document.getElementById("schoolLogTime");
  const schoolLogTitle = document.getElementById("schoolLogTitle");
  const schoolLogNote = document.getElementById("schoolLogNote");

  let currentUser = null;

  await init();

  async function init() {
    await loadChildren();
    ensureSchoolLogStructure();
    renderChildSwitcher();
    renderHeader();
    renderSchedule();
    renderActivity();
    renderEmergencySnapshot();
    renderSchoolNotes();
    wireEvents();
  }

  function wireEvents() {
    childSwitcher?.addEventListener("change", () => {
      db.activeChildId = childSwitcher.value;
      db.currentChildId = childSwitcher.value;
      saveDB(db);
      renderChildSwitcher();
      renderHeader();
      renderSchedule();
      renderActivity();
      renderEmergencySnapshot();
      renderSchoolNotes();
    });

    document.querySelectorAll("[data-log-type]").forEach((btn) => {
      btn.addEventListener("click", () => {
        openSchoolLogModal(btn.dataset.logType || "note");
      });
    });

    btnCloseSchoolLogModal?.addEventListener("click", closeSchoolLogModal);
    btnSaveSchoolLog?.addEventListener("click", saveSchoolLog);

    schoolLogModal?.addEventListener("click", (e) => {
      if (e.target === schoolLogModal) closeSchoolLogModal();
    });

    btnOpenEmergency?.addEventListener("click", () => {
      schoolEmergencyModal?.classList.remove("hidden");
      renderEmergencyModal();
    });

    btnCloseEmergencyModal?.addEventListener("click", () => {
      schoolEmergencyModal?.classList.add("hidden");
    });

    schoolEmergencyModal?.addEventListener("click", (e) => {
      if (e.target === schoolEmergencyModal) {
        schoolEmergencyModal.classList.add("hidden");
      }
    });

    logoutBtn?.addEventListener("click", async () => {
      if (supabase?.auth) {
        try {
          await supabase.auth.signOut();
        } catch (err) {
          console.warn("Supabase sign out failed:", err);
        }
      }
      window.location.href = "login.html";
    });
  }

  async function loadChildren() {
    if (!supabase?.auth) {
      if (!Array.isArray(db.children)) db.children = [];
      return;
    }

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      if (!Array.isArray(db.children)) db.children = [];
      return;
    }

    currentUser = user;

    const { data, error } = await supabase
      .from("children")
      .select("*")
      .eq("parent_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Could not load children:", error.message);
      if (!Array.isArray(db.children)) db.children = [];
      return;
    }

    db.children = (data || []).map((child) => ({
      ...child,
      diagnoses: normalizeDiagnoses(child.diagnoses),
      age: child.age ?? getAgeFromBirthdate(child.birthdate)
    }));

    const validActive =
      db.children.find((c) => String(c.id) === String(db.activeChildId || db.currentChildId)) ||
      db.children[0] ||
      null;

    db.activeChildId = validActive ? validActive.id : null;
    db.currentChildId = db.activeChildId;
    saveDB(db);
  }

  function ensureSchoolLogStructure() {
    if (!Array.isArray(db.schoolLogs)) db.schoolLogs = [];
    saveDB(db);
  }

  function getChildren() {
    return Array.isArray(db.children) ? db.children : [];
  }

  function getActiveChild() {
    const children = getChildren();
    if (!children.length) return null;
    return children.find((c) => String(c.id) === String(db.activeChildId)) || children[0] || null;
  }

  function renderChildSwitcher() {
    const children = getChildren();
    if (!childSwitcher) return;

    childSwitcher.innerHTML = "";

    if (!children.length) {
      childSwitcher.innerHTML = `<option value="">No children yet</option>`;
      return;
    }

    childSwitcher.innerHTML = children
      .map((c) => {
        const selected = String(c.id) === String(db.activeChildId) ? "selected" : "";
        return `<option value="${escapeHtml(c.id)}" ${selected}>${escapeHtml(c.name || "Child")}</option>`;
      })
      .join("");
  }

  function renderHeader() {
    const child = getActiveChild();

    if (!child) {
      if (childSummary) childSummary.textContent = "No child selected";
      if (childAvatar) childAvatar.innerHTML = "";
      return;
    }

    const ageText = child.age ? `Age ${child.age}` : "Age —";
    const dx = Array.isArray(child.diagnoses) && child.diagnoses.length
      ? child.diagnoses.slice(0, 2).join(" • ")
      : "No diagnoses listed";

    if (childSummary) childSummary.textContent = `${ageText} • ${dx}`;

    if (childAvatar) {
      childAvatar.innerHTML = child.photo_url
        ? `<img src="${escapeHtml(child.photo_url)}" alt="${escapeHtml(child.name || "Child")}">`
        : "";
    }
  }

  function renderSchedule() {
    const child = getActiveChild();
    if (!schoolScheduleList) return;

    if (!child) {
      schoolScheduleList.innerHTML = `<div class="empty-state">No child selected.</div>`;
      return;
    }

    const today = todayYYYYMMDD();
    const medItems =
      typeof generateMedicationScheduleItems === "function"
        ? generateMedicationScheduleItems(db, child.id, today)
        : [];

    const customItems = Array.isArray(db.schedules?.[child.id])
      ? db.schedules[child.id].filter((item) => isSchoolRelevant(item))
      : [];

    const rows = [
      ...medItems.map((item) => ({
        title: item.title || "Medication",
        time: item.time || "",
        category: "Medication",
        details: item.instructions || "",
        source: "medication"
      })),
      ...customItems.map((item) => ({
        title: item.title || "Task",
        time: formatTimeFromStart(item.startAt, item.time),
        category: item.category || "School Task",
        details: item.instructions || "",
        source: "schedule"
      }))
    ].sort((a, b) => String(a.time).localeCompare(String(b.time)));

    if (!rows.length) {
      schoolScheduleList.innerHTML = `<div class="empty-state">No school-day items scheduled.</div>`;
      return;
    }

    schoolScheduleList.innerHTML = rows
      .map(
        (row) => `
          <div class="list-item">
            <div>
              <strong>${escapeHtml(row.title)}</strong>
              <div class="muted">${escapeHtml(row.category)}${row.details ? ` • ${escapeHtml(row.details)}` : ""}</div>
            </div>
            <div class="muted">${escapeHtml(row.time || "—")}</div>
          </div>
        `
      )
      .join("");
  }

  function renderActivity() {
    const child = getActiveChild();
    if (!schoolActivityList) return;

    if (!child) {
      schoolActivityList.innerHTML = `<div class="empty-state">No child selected.</div>`;
      return;
    }

    const entries = (db.schoolLogs || [])
      .filter((entry) => String(entry.childId) === String(child.id))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20);

    if (!entries.length) {
      schoolActivityList.innerHTML = `<div class="empty-state">No school activity logged yet.</div>`;
      return;
    }

    schoolActivityList.innerHTML = entries
      .map(
        (entry) => `
          <div class="log-card">
            <div class="log-icon">${escapeHtml(iconForCategory(entry.category))}</div>
            <div class="log-main">
              <h3>${escapeHtml(entry.title || labelForCategory(entry.category))}</h3>
              <p>${escapeHtml(entry.note || "")}</p>
              <p class="muted mt-12">${escapeHtml(entry.author || "School Nurse")} • ${escapeHtml(formatDateTime(entry.createdAt))} • Logged by Nurse</p>
            </div>
          </div>
        `
      )
      .join("");
  }

  function renderEmergencySnapshot() {
    const child = getActiveChild();
    if (!emergencySnapshot) return;

    if (!child) {
      emergencySnapshot.innerHTML = `<div class="empty-state">No child selected.</div>`;
      return;
    }

    const carePlan = db.carePlans?.[child.id] || {};
    const allergies = child.allergies || "None listed";

    emergencySnapshot.innerHTML = `
      <div class="list-item">
        <div>
          <strong>Allergies</strong>
          <div class="muted">${escapeHtml(allergies)}</div>
        </div>
      </div>
      <div class="list-item">
        <div>
          <strong>Rescue / Emergency Notes</strong>
          <div class="muted">${escapeHtml(carePlan.seizure_protocol || "No emergency protocol added yet.")}</div>
        </div>
      </div>
      <div class="list-item">
        <div>
          <strong>When to Call EMS</strong>
          <div class="muted">${escapeHtml(carePlan.ems_when || "No EMS instructions added yet.")}</div>
        </div>
      </div>
    `;
  }

  function renderEmergencyModal() {
    const child = getActiveChild();
    if (!schoolEmergencyBody) return;

    if (!child) {
      schoolEmergencyBody.innerHTML = `<div class="empty-state">No child selected.</div>`;
      return;
    }

    const carePlan = db.carePlans?.[child.id] || {};
    const diagnoses = Array.isArray(child.diagnoses) && child.diagnoses.length
      ? child.diagnoses.join(", ")
      : "None listed";

    schoolEmergencyBody.innerHTML = `
      <div class="list-item">
        <div>
          <strong>Name</strong>
          <div class="muted">${escapeHtml(child.name || "—")}</div>
        </div>
      </div>
      <div class="list-item">
        <div>
          <strong>Diagnoses</strong>
          <div class="muted">${escapeHtml(diagnoses)}</div>
        </div>
      </div>
      <div class="list-item">
        <div>
          <strong>Allergies</strong>
          <div class="muted">${escapeHtml(child.allergies || "None listed")}</div>
        </div>
      </div>
      <div class="list-item">
        <div>
          <strong>Emergency Protocol</strong>
          <div class="muted">${escapeHtml(carePlan.seizure_protocol || "No emergency protocol added yet.")}</div>
        </div>
      </div>
      <div class="list-item">
        <div>
          <strong>When to Call EMS</strong>
          <div class="muted">${escapeHtml(carePlan.ems_when || "No EMS instructions added yet.")}</div>
        </div>
      </div>
    `;
  }

  function renderSchoolNotes() {
    const child = getActiveChild();
    if (!schoolNotesPanel) return;

    if (!child) {
      schoolNotesPanel.innerHTML = `<div class="empty-state">No child selected.</div>`;
      return;
    }

    const noteRows = (db.schoolLogs || [])
      .filter((entry) => String(entry.childId) === String(child.id))
      .filter((entry) => entry.category === "note" || entry.category === "symptom")
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    if (!noteRows.length) {
      schoolNotesPanel.innerHTML = `<div class="empty-state">No school notes yet.</div>`;
      return;
    }

    schoolNotesPanel.innerHTML = noteRows
      .map(
        (entry) => `
          <div class="list-item">
            <div>
              <strong>${escapeHtml(entry.title || labelForCategory(entry.category))}</strong>
              <div class="muted">${escapeHtml(entry.note || "")}</div>
            </div>
          </div>
        `
      )
      .join("");
  }

  function openSchoolLogModal(type = "note") {
    if (schoolLogCategory) schoolLogCategory.value = type;
    if (schoolLogModalTitle) schoolLogModalTitle.textContent = `Add ${labelForCategory(type)}`;
    if (schoolLogAuthor) schoolLogAuthor.value = "School Nurse";
    if (schoolLogTitle) schoolLogTitle.value = "";
    if (schoolLogNote) schoolLogNote.value = "";

    const now = new Date();
    if (schoolLogDate) schoolLogDate.value = now.toISOString().slice(0, 10);
    if (schoolLogTime) schoolLogTime.value = now.toTimeString().slice(0, 5);

    schoolLogModal?.classList.remove("hidden");
  }

  function closeSchoolLogModal() {
    schoolLogModal?.classList.add("hidden");
  }

  function saveSchoolLog() {
    const child = getActiveChild();
    if (!child) return;

    const title = schoolLogTitle?.value.trim() || labelForCategory(schoolLogCategory?.value || "note");
    const note = schoolLogNote?.value.trim() || "";
    const author = schoolLogAuthor?.value.trim() || "School Nurse";
    const category = schoolLogCategory?.value || "note";
    const date = schoolLogDate?.value || todayYYYYMMDD();
    const time = schoolLogTime?.value || "12:00";

    if (!note) {
      alert("Please enter details for this school log.");
      return;
    }

    if (!Array.isArray(db.schoolLogs)) db.schoolLogs = [];

    db.schoolLogs.unshift({
      id: uid("schoollog"),
      childId: child.id,
      source: "school_nurse",
      location: "school",
      category,
      title,
      note,
      author,
      createdAt: new Date(`${date}T${time}`).toISOString()
    });

    saveDB(db);
    closeSchoolLogModal();
    renderActivity();
    renderSchoolNotes();
  }

  function uid(prefix = "id") {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizeDiagnoses(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === "string" && value.trim()) {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
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

  function todayYYYYMMDD() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

  function formatTimeFromStart(startAt, fallback) {
    if (startAt) {
      const d = new Date(startAt);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      }
    }
    return fallback || "—";
  }

  function isSchoolRelevant(item) {
    const category = String(item?.category || "").toLowerCase();
    return [
      "medication",
      "feeding",
      "therapy",
      "symptom check",
      "appointment",
      "other"
    ].includes(category);
  }

  function labelForCategory(cat) {
    if (cat === "symptom") return "Symptom";
    if (cat === "med") return "Medication";
    if (cat === "feed") return "Feed / Therapy";
    if (cat === "bathroom") return "Bathroom / Output";
    if (cat === "missed") return "Missed Task";
    if (cat === "seizure") return "Seizure";
    return "School Note";
  }

  function iconForCategory(cat) {
    if (cat === "symptom") return "🩺";
    if (cat === "med") return "💊";
    if (cat === "feed") return "🍼";
    if (cat === "bathroom") return "🚻";
    if (cat === "missed") return "⚠️";
    if (cat === "seizure") return "🚨";
    return "📝";
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