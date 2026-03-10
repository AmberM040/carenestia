document.addEventListener("DOMContentLoaded", async () => {
  let db = ensureDB(loadDB());
  saveDB(db);

  const supabase = window.supabaseClient || null;

  const childSwitcher = document.getElementById("childSwitcher");
  const childAvatar = document.getElementById("childAvatar");
  const childSummary = document.getElementById("childSummary");
  const logoutBtn = document.getElementById("logoutBtn");

  const schoolHeroPhoto = document.getElementById("schoolHeroPhoto");
  const schoolHeroName = document.getElementById("schoolHeroName");
  const schoolHeroSub = document.getElementById("schoolHeroSub");
  const schoolDiagnosisPills = document.getElementById("schoolDiagnosisPills");
  const schoolAllergyStat = document.getElementById("schoolAllergyStat");
  const schoolRescueStat = document.getElementById("schoolRescueStat");

  const schoolScheduleList = document.getElementById("schoolScheduleList");
  const schoolActivityList = document.getElementById("schoolActivityList");
  const emergencySnapshot = document.getElementById("emergencySnapshot");
  const handoffSummary = document.getElementById("handoffSummary");

  const btnGenerateHandoff = document.getElementById("btnGenerateHandoff");
  const btnSaveHandoff = document.getElementById("btnSaveHandoff");
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
  let lastGeneratedHandoff = "";

  await init();

  async function init() {
    await loadChildrenFromSupabase();
    ensureSchoolData();

    console.log("school nurse children:", db.children);
    console.log("school nurse activeChildId:", db.activeChildId);
    console.log("school nurse active child:", getActiveChild());

    renderChildSwitcher();
    renderHeader();
    renderHero();
    renderSchedule();
    renderActivity();
    renderEmergencySnapshot();
    renderEmergencyModal();
    wireEvents();
  }

  function wireEvents() {
    childSwitcher?.addEventListener("change", () => {
      db.activeChildId = childSwitcher.value || null;
      db.currentChildId = db.activeChildId;
      saveDB(db);

      renderChildSwitcher();
      renderHeader();
      renderHero();
      renderSchedule();
      renderActivity();
      renderEmergencySnapshot();
      renderEmergencyModal();
      clearHandoff();
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

    btnGenerateHandoff?.addEventListener("click", generateHandoffSummary);
    btnSaveHandoff?.addEventListener("click", saveHandoffToCareLog);

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

  async function loadChildrenFromSupabase() {
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
      return;
    }

    if (Array.isArray(data) && data.length) {
      db.children = data.map((child) => ({
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
      return;
    }

    if (!Array.isArray(db.children)) db.children = [];
  }

  function ensureSchoolData() {
    if (!Array.isArray(db.schoolLogs)) db.schoolLogs = [];
    if (!Array.isArray(db.careLogs)) db.careLogs = [];
    if (!db.carePlans || typeof db.carePlans !== "object") db.carePlans = {};
    if (!db.schedules || typeof db.schedules !== "object") db.schedules = {};
    saveDB(db);
  }

  function getChildren() {
    return Array.isArray(db.children) ? db.children : [];
  }

  function getActiveChild() {
    const children = getChildren();
    if (!children.length) return null;

    return (
      children.find((c) => String(c.id) === String(db.activeChildId || db.currentChildId)) ||
      children[0] ||
      null
    );
  }

  function getSchoolLogsForActiveChild() {
    const child = getActiveChild();
    if (!child) return [];

    return (db.schoolLogs || [])
      .filter((entry) => String(entry.childId) === String(child.id))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function renderChildSwitcher() {
    const children = getChildren();
    if (!childSwitcher) return;

    if (!children.length) {
      childSwitcher.innerHTML = `<option value="">No children yet</option>`;
      return;
    }

    childSwitcher.innerHTML = children
      .map((c) => {
        const selected = String(c.id) === String(getActiveChild()?.id) ? "selected" : "";
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
    const dx =
      Array.isArray(child.diagnoses) && child.diagnoses.length
        ? child.diagnoses.slice(0, 2).join(" • ")
        : "No diagnoses listed";

    if (childSummary) {
      childSummary.textContent = `${ageText} • ${dx}`;
    }

    if (childAvatar) {
      childAvatar.innerHTML = child.photo_url
        ? `<img src="${escapeAttr(child.photo_url)}" alt="${escapeAttr(child.name || "Child")}">`
        : "";
    }
  }

  function renderHero() {
    const child = getActiveChild();

    if (!child) {
      if (schoolHeroPhoto) {
        schoolHeroPhoto.src = "https://via.placeholder.com/600x400?text=Child+Photo";
        schoolHeroPhoto.alt = "Child photo";
      }
      if (schoolHeroName) schoolHeroName.textContent = "No child selected";
      if (schoolHeroSub) schoolHeroSub.textContent = "School-day care dashboard";
      if (schoolDiagnosisPills) schoolDiagnosisPills.innerHTML = "";
      if (schoolAllergyStat) schoolAllergyStat.textContent = "None listed";
      if (schoolRescueStat) schoolRescueStat.textContent = "—";
      return;
    }

    const carePlan = db.carePlans?.[child.id] || {};

    if (schoolHeroPhoto) {
      schoolHeroPhoto.src =
        child.photo_url || child.photo || "https://via.placeholder.com/600x400?text=Child+Photo";
      schoolHeroPhoto.alt = child.name ? `${child.name} photo` : "Child photo";
    }

    if (schoolHeroName) {
      schoolHeroName.textContent = child.name || "Child";
    }

    const ageText = child.age ? `Age ${child.age}` : "Age —";
    const diagnosesText =
      Array.isArray(child.diagnoses) && child.diagnoses.length
        ? child.diagnoses.join(" • ")
        : "No diagnoses listed";

    if (schoolHeroSub) {
      schoolHeroSub.textContent = `${ageText} • ${diagnosesText}`;
    }

    if (schoolDiagnosisPills) {
      schoolDiagnosisPills.innerHTML = "";
      (child.diagnoses || []).slice(0, 6).forEach((dx) => {
        const pill = document.createElement("span");
        pill.className = "school-pill";
        pill.textContent = dx;
        schoolDiagnosisPills.appendChild(pill);
      });
    }

    if (schoolAllergyStat) {
      schoolAllergyStat.textContent = child.allergies || "None listed";
    }

    if (schoolRescueStat) {
      schoolRescueStat.textContent =
        joinParts([carePlan.rescue_med_name, carePlan.rescue_med_dose], " • ") || "—";
    }
  }

  function renderSchedule() {
    const child = getActiveChild();
    if (!schoolScheduleList) return;

    if (!child) {
      schoolScheduleList.innerHTML = `<div class="empty-box">No child selected.</div>`;
      return;
    }

    const todayKey = todayYYYYMMDD();

    const medItems =
      typeof generateMedicationScheduleItems === "function"
        ? generateMedicationScheduleItems(db, child.id, todayKey)
        : [];

    const customItems = Array.isArray(db.schedules?.[child.id])
      ? db.schedules[child.id].filter((item) => isSchoolRelevant(item))
      : [];

    const rows = [
      ...medItems.map((item) => ({
        title: item.title || "Medication",
        time: item.time || "",
        category: "Medication",
        details: item.instructions || ""
      })),
      ...customItems.map((item) => ({
        title: item.title || "Task",
        time: formatTimeFromStart(item.startAt, item.time),
        category: item.category || "School Task",
        details: item.instructions || ""
      }))
    ].sort((a, b) => String(a.time).localeCompare(String(b.time)));

    if (!rows.length) {
      schoolScheduleList.innerHTML = `<div class="empty-box">No school-day items scheduled.</div>`;
      return;
    }

    schoolScheduleList.innerHTML = rows
      .map(
        (row) => `
          <div class="schedule-item">
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
    if (!schoolActivityList) return;

    const entries = getSchoolLogsForActiveChild().slice(0, 25);

    if (!entries.length) {
      schoolActivityList.innerHTML = `<div class="empty-box">No school activity logged yet.</div>`;
      return;
    }

    schoolActivityList.innerHTML = entries
      .map(
        (entry) => `
          <div class="timeline-entry">
            <div class="timeline-time">${escapeHtml(formatTimeOnly(entry.createdAt))}</div>
            <div class="timeline-body">
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
      emergencySnapshot.innerHTML = `<div class="empty-box">No child selected.</div>`;
      return;
    }

    const carePlan = db.carePlans?.[child.id] || {};
    const diagnoses =
      Array.isArray(child.diagnoses) && child.diagnoses.length
        ? child.diagnoses.join(", ")
        : "None listed";

    emergencySnapshot.innerHTML = `
      <div class="snapshot-item">
        <div>
          <strong>Diagnoses</strong>
          <div class="muted">${escapeHtml(diagnoses)}</div>
        </div>
      </div>

      <div class="snapshot-item">
        <div>
          <strong>Allergies</strong>
          <div class="muted">${escapeHtml(child.allergies || "None listed")}</div>
        </div>
      </div>

      <div class="snapshot-item">
        <div>
          <strong>Rescue Medication</strong>
          <div class="muted">${escapeHtml(joinParts([carePlan.rescue_med_name, carePlan.rescue_med_dose], " • ") || "—")}</div>
        </div>
      </div>

      <div class="snapshot-item">
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
      schoolEmergencyBody.innerHTML = `<div class="empty-box">No child selected.</div>`;
      return;
    }

    const carePlan = db.carePlans?.[child.id] || {};
    const diagnoses =
      Array.isArray(child.diagnoses) && child.diagnoses.length
        ? child.diagnoses.join(", ")
        : "None listed";

    schoolEmergencyBody.innerHTML = `
      <div class="snapshot-item"><div><strong>Name</strong><div class="muted">${escapeHtml(child.name || "—")}</div></div></div>
      <div class="snapshot-item"><div><strong>Diagnoses</strong><div class="muted">${escapeHtml(diagnoses)}</div></div></div>
      <div class="snapshot-item"><div><strong>Allergies</strong><div class="muted">${escapeHtml(child.allergies || "None listed")}</div></div></div>
      <div class="snapshot-item"><div><strong>Rescue Medication</strong><div class="muted">${escapeHtml(joinParts([carePlan.rescue_med_name, carePlan.rescue_med_dose], " • ") || "—")}</div></div></div>
      <div class="snapshot-item"><div><strong>Emergency Protocol</strong><div class="muted">${escapeHtml(carePlan.seizure_protocol || "No emergency protocol added yet.")}</div></div></div>
      <div class="snapshot-item"><div><strong>When to Call EMS</strong><div class="muted">${escapeHtml(carePlan.ems_when || "No EMS instructions added yet.")}</div></div></div>
    `;
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

    const category = schoolLogCategory?.value || "note";
    const title = schoolLogTitle?.value.trim() || labelForCategory(category);
    const note = schoolLogNote?.value.trim() || "";
    const author = schoolLogAuthor?.value.trim() || "School Nurse";
    const date = schoolLogDate?.value || todayYYYYMMDD();
    const time = schoolLogTime?.value || "12:00";

    if (!note) {
      alert("Please enter details for this school log.");
      return;
    }

    db.schoolLogs.unshift({
      id: uid("schoollog"),
      childId: child.id,
      source: "school_nurse",
      visibility: "parent_and_nurse",
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
    clearHandoff();
  }

  function generateHandoffSummary() {
    const child = getActiveChild();
    if (!child) return;

    const todayKey = todayYYYYMMDD();
    const entries = getSchoolLogsForActiveChild().filter((entry) => {
      const d = new Date(entry.createdAt);
      return !Number.isNaN(d.getTime()) && getDateKeyFromDate(d) === todayKey;
    });

    const grouped = {
      med: [],
      feed: [],
      therapy: [],
      symptom: [],
      seizure: [],
      bathroom: [],
      missed: [],
      note: []
    };

    entries.forEach((entry) => {
      if (!grouped[entry.category]) grouped.note.push(entry);
      else grouped[entry.category].push(entry);
    });

    let text = "";
    text += `School Day Summary\n`;
    text += `${child.name || "Child"} — ${new Date().toLocaleDateString()}\n\n`;
    text += buildSummarySection("Medications", grouped.med);
    text += buildSummarySection("Feeds", grouped.feed);
    text += buildSummarySection("Therapies", grouped.therapy);
    text += buildSummarySection("Symptoms", grouped.symptom);
    text += buildSummarySection("Seizure Activity", grouped.seizure);
    text += buildSummarySection("Bathroom / Output", grouped.bathroom);
    text += buildSummarySection("Missed Tasks", grouped.missed);
    text += buildSummarySection("Additional Notes", grouped.note);

    if (!entries.length) {
      text += `No school entries were logged today.\n`;
    }

    lastGeneratedHandoff = text;
    if (handoffSummary) handoffSummary.textContent = text;
  }

  function buildSummarySection(title, entries) {
    let text = `${title}:\n`;

    if (!entries.length) {
      text += `• None logged\n\n`;
      return text;
    }

    entries
      .slice()
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .forEach((entry) => {
        const time = formatTimeOnly(entry.createdAt);
        const line = `${entry.title || labelForCategory(entry.category)}${entry.note ? ` — ${entry.note}` : ""}`;
        text += `• ${time}: ${line}\n`;
      });

    text += `\n`;
    return text;
  }

  function saveHandoffToCareLog() {
    const child = getActiveChild();
    if (!child) return;

    if (!lastGeneratedHandoff.trim()) {
      generateHandoffSummary();
    }

    if (!lastGeneratedHandoff.trim()) {
      alert("No handoff summary available.");
      return;
    }

    if (!Array.isArray(db.careLogs)) db.careLogs = [];

    db.careLogs.unshift({
      id: uid("carelog"),
      childId: child.id,
      category: "note",
      source: "school_handoff",
      author: "School Nurse",
      title: "School Day Handoff",
      note: lastGeneratedHandoff,
      createdAt: new Date().toISOString()
    });

    saveDB(db);
    alert("Handoff summary saved to Care Log.");
  }

  function clearHandoff() {
    lastGeneratedHandoff = "";
    if (handoffSummary) {
      handoffSummary.textContent = "No handoff summary generated yet.";
    }
  }

  function isSchoolRelevant(item) {
    const category = String(item?.category || "").toLowerCase();
    return ["medication", "feeding", "therapy", "symptom check", "appointment", "other"].includes(category);
  }

  function labelForCategory(cat) {
    if (cat === "symptom") return "Symptom";
    if (cat === "med") return "Medication";
    if (cat === "feed") return "Feed";
    if (cat === "therapy") return "Therapy";
    if (cat === "bathroom") return "Bathroom / Output";
    if (cat === "missed") return "Missed Task";
    if (cat === "seizure") return "Seizure";
    return "School Note";
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
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function todayYYYYMMDD() {
    return getDateKeyFromDate(new Date());
  }

  function getDateKeyFromDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function uid(prefix = "id") {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function joinParts(parts, separator = " ") {
    return (parts || []).filter(Boolean).join(separator).trim();
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