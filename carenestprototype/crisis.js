document.addEventListener("DOMContentLoaded", async () => {
  const ACTIVE_CHILD_KEY = "carenest_active_child_id";
  const LOCAL_DB_KEY = "carenest_prototype_v1";

  const childSwitcher = document.getElementById("childSwitcher");
  const childAvatar = document.getElementById("childAvatar");
  const childSummary = document.getElementById("childSummary");
  const logoutBtn = document.getElementById("logoutBtn");

  const protocolBox = document.getElementById("protocolBox");
  const rescueMedBox = document.getElementById("rescueMedBox");
  const emsBox = document.getElementById("emsBox");
  const oxygenBox = document.getElementById("oxygenBox");
  const contactsBox = document.getElementById("contactsBox");

  const timelineList = document.getElementById("timelineList");

  const btnStartCrisis = document.getElementById("btnStartCrisis");
  const btnEndCrisis = document.getElementById("btnEndCrisis");

  const btnLogSeizureStart = document.getElementById("btnLogSeizureStart");
  const btnLogSeizureEnd = document.getElementById("btnLogSeizureEnd");
  const btnLogRescueMed = document.getElementById("btnLogRescueMed");
  const btnLogOxygen = document.getElementById("btnLogOxygen");
  const btnLogCallEms = document.getElementById("btnLogCallEms");
  const btnAddNote = document.getElementById("btnAddNote");
  const btnClearTimeline = document.getElementById("btnClearTimeline");

  const btnCloseNoteModal = document.getElementById("btnCloseNoteModal");
  const btnSaveNote = document.getElementById("btnSaveNote");
  const noteModal = document.getElementById("noteModal");
  const crisisNoteInput = document.getElementById("crisisNoteInput");

  const crisisStatus = document.getElementById("crisisStatus");
  const activeCrisisType = document.getElementById("activeCrisisType");
  const activeCrisisStart = document.getElementById("activeCrisisStart");
  const crisisTimer = document.getElementById("crisisTimer");

  let currentUser = null;
  let children = [];
  let activeChild = null;
  let carePlan = null;
  let timerInterval = null;

  function getSupabaseClient() {
    return window.supabaseClient || null;
  }

  function getActiveChildId() {
    return localStorage.getItem(ACTIVE_CHILD_KEY);
  }

  function setActiveChildId(id) {
    localStorage.setItem(ACTIVE_CHILD_KEY, id);
  }

  function getLocalDB() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_DB_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveLocalDB(db) {
    localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
  }

  function ensureLocalStructure() {
    const db = getLocalDB();

    if (!Array.isArray(db.crisisEvents)) db.crisisEvents = [];
    if (!Array.isArray(db.careLogs)) db.careLogs = [];

    saveLocalDB(db);
  }

  function getCrisisEvents() {
    const db = getLocalDB();
    return Array.isArray(db.crisisEvents) ? db.crisisEvents : [];
  }

  function saveCrisisEvents(events) {
    const db = getLocalDB();
    db.crisisEvents = events;
    saveLocalDB(db);
  }

  function getEventsForActiveChild() {
    if (!activeChild) return [];
    return getCrisisEvents()
      .filter((event) => String(event.childId) === String(activeChild.id))
      .sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0));
  }

  function getActiveCrisisEvent() {
    if (!activeChild) return null;
    return getCrisisEvents().find(
      (event) =>
        String(event.childId) === String(activeChild.id) &&
        event.status === "active"
    ) || null;
  }

  function updateCrisisEvent(updatedEvent) {
    const events = getCrisisEvents();
    const next = events.map((event) =>
      event.id === updatedEvent.id ? updatedEvent : event
    );
    saveCrisisEvents(next);
  }

  function createCrisisEvent(type = "General Crisis") {
    const child = activeChild;
    if (!child) return null;

    const now = new Date().toISOString();

    const event = {
      id: uid("crisis"),
      childId: child.id,
      childName: child.name || "Child",
      type,
      status: "active",
      startedAt: now,
      endedAt: null,
      durationSeconds: 0,
      timeline: [
        {
          id: uid("timeline"),
          label: "Crisis Started",
          time: now
        }
      ]
    };

    const events = getCrisisEvents();
    events.unshift(event);
    saveCrisisEvents(events);
    return event;
  }

  function addTimelineEntry(label) {
    const activeEvent = getActiveCrisisEvent();
    if (!activeEvent) {
      alert("Start a crisis event first.");
      return;
    }

    activeEvent.timeline.unshift({
      id: uid("timeline"),
      label,
      time: new Date().toISOString()
    });

    updateCrisisEvent(activeEvent);
    renderTimeline();
    renderCrisisState();
  }

  function endActiveCrisis() {
    const activeEvent = getActiveCrisisEvent();
    if (!activeEvent) {
      alert("No active crisis event.");
      return;
    }

    const endedAt = new Date().toISOString();
    activeEvent.endedAt = endedAt;
    activeEvent.status = "ended";
    activeEvent.durationSeconds = Math.max(
      0,
      Math.floor((new Date(endedAt) - new Date(activeEvent.startedAt)) / 1000)
    );

    activeEvent.timeline.unshift({
      id: uid("timeline"),
      label: "Crisis Ended",
      time: endedAt
    });

    updateCrisisEvent(activeEvent);
    saveCrisisToCareLog(activeEvent);

    stopTimer();
    renderTimeline();
    renderCrisisState();
  }

  function saveCrisisToCareLog(event) {
    const db = getLocalDB();
    if (!Array.isArray(db.careLogs)) db.careLogs = [];

    const timelineText = (event.timeline || [])
      .slice()
      .sort((a, b) => new Date(a.time) - new Date(b.time))
      .map((item) => `• ${formatDateTime(item.time)} — ${item.label}`)
      .join("\n");

    const summary = [
      `${event.type || "Crisis"} event`,
      `Start: ${formatDateTime(event.startedAt)}`,
      event.endedAt ? `End: ${formatDateTime(event.endedAt)}` : "",
      `Duration: ${formatDuration(event.durationSeconds || 0)}`,
      "",
      "Timeline:",
      timelineText || "• No timeline entries"
    ]
      .filter(Boolean)
      .join("\n");

    db.careLogs.unshift({
      id: uid("carelog"),
      childId: event.childId,
      category: "symptom",
      source: "crisis_mode",
      title: `${event.type || "Crisis"} Event`,
      note: summary,
      author: "CareNestia Crisis Mode",
      createdAt: new Date().toISOString()
    });

    saveLocalDB(db);
  }

  function renderTimeline() {
    const activeEvent = getActiveCrisisEvent();
    const latestEndedEvent = getEventsForActiveChild().find((e) => e.status === "ended");
    const displayEvent = activeEvent || latestEndedEvent || null;

    timelineList.innerHTML = "";

    if (!displayEvent || !Array.isArray(displayEvent.timeline) || !displayEvent.timeline.length) {
      timelineList.innerHTML = `<div class="muted">No events yet</div>`;
      return;
    }

    const sortedTimeline = displayEvent.timeline
      .slice()
      .sort((a, b) => new Date(b.time) - new Date(a.time));

    sortedTimeline.forEach((event) => {
      const div = document.createElement("div");
      div.className = "list-item";
      div.innerHTML = `
        <div style="width:100%;">
          <strong>${escapeHtml(event.label)}</strong>
          <div class="muted">${escapeHtml(formatDateTime(event.time))}</div>
        </div>
      `;
      timelineList.appendChild(div);
    });
  }

  function renderCrisisState() {
    const activeEvent = getActiveCrisisEvent();
    const latestEndedEvent = getEventsForActiveChild().find((e) => e.status === "ended");

    if (activeEvent) {
      crisisStatus.textContent = `Active crisis in progress`;
      activeCrisisType.textContent = activeEvent.type || "General Crisis";
      activeCrisisStart.textContent = formatTimeOnly(activeEvent.startedAt);
      startTimer(activeEvent.startedAt);
      return;
    }

    stopTimer();

    if (latestEndedEvent) {
      crisisStatus.textContent = `Last crisis ended`;
      activeCrisisType.textContent = latestEndedEvent.type || "General Crisis";
      activeCrisisStart.textContent = formatTimeOnly(latestEndedEvent.startedAt);
      crisisTimer.textContent = formatDuration(latestEndedEvent.durationSeconds || 0);
      return;
    }

    crisisStatus.textContent = "Crisis inactive";
    activeCrisisType.textContent = "Not started";
    activeCrisisStart.textContent = "—";
    crisisTimer.textContent = "00:00";
  }

  function startTimer(startedAt) {
    stopTimer();

    function tick() {
      const seconds = Math.max(
        0,
        Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
      );
      crisisTimer.textContent = formatDuration(seconds);
    }

    tick();
    timerInterval = setInterval(tick, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  async function fetchUser() {
    const supabase = getSupabaseClient();
    if (!supabase?.auth) return null;

    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data?.user || null;
  }

  async function fetchChildren(userId) {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("children")
      .select("*")
      .eq("parent_id", userId)
      .order("created_at", { ascending: true });

    if (error) return [];
    return (data || []).map((child) => ({
      ...child,
      diagnoses: normalizeDiagnoses(child.diagnoses),
      age: child.age ?? getAgeFromBirthdate(child.birthdate)
    }));
  }

  async function fetchCarePlan(childId) {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("care_plans")
      .select("*")
      .eq("child_id", childId)
      .maybeSingle();

    if (error) return null;
    return data || null;
  }

  function renderChildSwitcher() {
    childSwitcher.innerHTML = "";

    if (!children.length) {
      childSwitcher.innerHTML = `<option value="">No children yet</option>`;
      return;
    }

    children.forEach((child) => {
      const option = document.createElement("option");
      option.value = child.id;
      option.textContent = child.name || "Child";

      if (activeChild && String(child.id) === String(activeChild.id)) {
        option.selected = true;
      }

      childSwitcher.appendChild(option);
    });
  }

  function renderChildSummary() {
    if (!activeChild) {
      childSummary.textContent = "No child selected";
      childAvatar.innerHTML = "";
      return;
    }

    const ageText = activeChild.age ? `Age ${activeChild.age}` : "Age —";
    const dx =
      Array.isArray(activeChild.diagnoses) && activeChild.diagnoses.length
        ? activeChild.diagnoses.slice(0, 2).join(" • ")
        : "No diagnoses listed";

    childSummary.textContent = `${ageText} • ${dx}`;
    childAvatar.innerHTML = activeChild.photo_url
      ? `<img src="${escapeAttr(activeChild.photo_url)}" alt="${escapeAttr(activeChild.name || "Child")}">`
      : "";
  }

  function renderCarePlan() {
    if (!carePlan) {
      protocolBox.textContent = "No protocol saved";
      rescueMedBox.textContent = "No rescue medication loaded.";
      emsBox.textContent = "No EMS guidance loaded.";
      oxygenBox.textContent = "No oxygen guidance loaded.";
      contactsBox.textContent = "No contacts loaded.";
      return;
    }

    protocolBox.textContent = carePlan.seizure_protocol || "No protocol";

    rescueMedBox.innerHTML = `
      <div><strong>${escapeHtml(carePlan.rescue_med_name || "None")}</strong></div>
      <div>${escapeHtml(carePlan.rescue_med_dose || "")}</div>
      <div>${escapeHtml(carePlan.rescue_med_route || "")}</div>
    `;

    emsBox.textContent = carePlan.ems_when || "No EMS guidance";
    oxygenBox.textContent = carePlan.oxygen_guidance || "No oxygen guidance";

    contactsBox.innerHTML = `
      <div>${escapeHtml(carePlan.emergency_contacts || "")}</div>
      <div>${escapeHtml(carePlan.doctor_contacts || "")}</div>
      <div>${escapeHtml(carePlan.preferred_hospital || "")}</div>
    `;
  }

  function openNoteModal() {
    crisisNoteInput.value = "";
    noteModal.classList.remove("hidden");
    crisisNoteInput.focus();
  }

  function closeNoteModal() {
    noteModal.classList.add("hidden");
  }

  async function init() {
    ensureLocalStructure();

    currentUser = await fetchUser();

    if (currentUser?.id) {
      children = await fetchChildren(currentUser.id);
    }

    const savedId = getActiveChildId();

    activeChild =
      children.find((c) => String(c.id) === String(savedId)) ||
      children[0] ||
      null;

    if (activeChild) {
      setActiveChildId(activeChild.id);
      carePlan = await fetchCarePlan(activeChild.id);
    }

    renderChildSwitcher();
    renderChildSummary();
    renderCarePlan();
    renderTimeline();
    renderCrisisState();
  }

  childSwitcher?.addEventListener("change", async (e) => {
    const id = e.target.value;
    activeChild = children.find((c) => String(c.id) === String(id)) || null;
    setActiveChildId(id);

    carePlan = activeChild ? await fetchCarePlan(activeChild.id) : null;

    renderChildSummary();
    renderCarePlan();
    renderTimeline();
    renderCrisisState();
  });

  btnStartCrisis?.addEventListener("click", () => {
    if (getActiveCrisisEvent()) {
      alert("A crisis event is already active.");
      return;
    }

    createCrisisEvent("Crisis Event");
    renderTimeline();
    renderCrisisState();
  });

  btnEndCrisis?.addEventListener("click", () => {
    endActiveCrisis();
  });

  btnLogSeizureStart?.addEventListener("click", () => {
    if (!getActiveCrisisEvent()) {
      createCrisisEvent("Seizure");
    }
    addTimelineEntry("Seizure Started");
  });

  btnLogSeizureEnd?.addEventListener("click", () => {
    addTimelineEntry("Seizure Ended");
  });

  btnLogRescueMed?.addEventListener("click", () => {
    const medName = carePlan?.rescue_med_name || "Rescue Medication";
    addTimelineEntry(`${medName} Given`);
  });

  btnLogOxygen?.addEventListener("click", () => {
    addTimelineEntry("Oxygen Started");
  });

  btnLogCallEms?.addEventListener("click", () => {
    addTimelineEntry("EMS Called");
  });

  btnAddNote?.addEventListener("click", () => {
    openNoteModal();
  });

  btnSaveNote?.addEventListener("click", () => {
    const note = crisisNoteInput.value.trim();
    if (!note) {
      alert("Enter a note first.");
      return;
    }
    addTimelineEntry(note);
    closeNoteModal();
  });

  btnCloseNoteModal?.addEventListener("click", closeNoteModal);

  noteModal?.addEventListener("click", (e) => {
    if (e.target === noteModal) {
      closeNoteModal();
    }
  });

  btnClearTimeline?.addEventListener("click", () => {
    if (!activeChild) return;

    const events = getCrisisEvents().filter(
      (event) => String(event.childId) !== String(activeChild.id)
    );
    saveCrisisEvents(events);

    stopTimer();
    renderTimeline();
    renderCrisisState();
  });

  logoutBtn?.addEventListener("click", async () => {
    const supabase = getSupabaseClient();
    if (supabase?.auth) {
      await supabase.auth.signOut();
    }
    window.location.href = "login.html";
  });

  await init();

  function uid(prefix = "id") {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function formatDateTime(value) {
    const d = new Date(value);
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function formatTimeOnly(value) {
    const d = new Date(value);
    return d.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function formatDuration(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${String(hrs).padStart(2, "0")}:${String(remMins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
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