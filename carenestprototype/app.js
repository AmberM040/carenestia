document.addEventListener("DOMContentLoaded", () => {
  const state = {
    user: null,
    children: [],
    activeChildId: null,
    activeChild: null,
    careProfile: null,
    equipmentProfile: null,
    careLogs: []
  };

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

  function categoryLabel(value) {
    const map = {
      symptom: "Symptom",
      question: "Question",
      note: "Care Note",
      med: "Medication"
    };
    return map[value] || "Entry";
  }

  async function loadUser() {
    const {
      data: { user },
      error
    } = await supabaseClient.auth.getUser();

    if (error || !user) {
      window.location.href = "login.html";
      return false;
    }

    state.user = user;
    return true;
  }

  async function loadChildren() {
    const { data, error } = await supabaseClient
      .from("children")
      .select("*")
      .eq("parent_id", state.user.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading children:", error);
      alert("Could not load children.");
      return false;
    }

    if (!data || !data.length) {
      window.location.href = "onboarding.html";
      return false;
    }

    state.children = data;
    return true;
  }

  function setInitialActiveChild() {
    if (!state.children.length) {
      state.activeChildId = null;
      state.activeChild = null;
      return;
    }

    const firstChild = state.children[0];
    state.activeChildId = firstChild.id;
    state.activeChild = firstChild;

    console.log("Active child set:", firstChild);
  }

  async function loadActiveChildProfiles() {
    if (!state.activeChildId) return;

    const { data: careProfile, error: careError } = await supabaseClient
      .from("child_care_profiles")
      .select("*")
      .eq("child_id", state.activeChildId)
      .maybeSingle();

    if (careError) {
      console.error("Error loading care profile:", careError);
    }

    const { data: equipmentProfile, error: equipmentError } = await supabaseClient
      .from("child_equipment_profiles")
      .select("*")
      .eq("child_id", state.activeChildId)
      .maybeSingle();

    if (equipmentError) {
      console.error("Error loading equipment profile:", equipmentError);
    }

    state.careProfile = careProfile || {};
    state.equipmentProfile = equipmentProfile || {};
  }

  async function loadActiveChildCareLogs() {
    if (!state.activeChildId) return;

    const { data, error } = await supabaseClient
      .from("care_logs")
      .select("*")
      .eq("child_id", state.activeChildId)
      .order("created_at", { ascending: false })
      .limit(3);

    if (error) {
      console.error("Error loading care logs:", error);
      state.careLogs = [];
      return;
    }

    state.careLogs = data || [];
  }

  async function selectChild(childId) {
    const child = state.children.find((c) => c.id === childId);
    if (!child) return;

    state.activeChildId = child.id;
    state.activeChild = child;

    console.log("Switched child:", child);

    await loadActiveChildProfiles();
    await loadActiveChildCareLogs();

    render();
  }

  function fillChildSwitcher() {
    childSwitcher.innerHTML = "";

    state.children.forEach((child) => {
      const opt = document.createElement("option");
      opt.value = child.id;
      opt.textContent = child.name;
      childSwitcher.appendChild(opt);
    });

    childSwitcher.value = state.activeChildId || "";
  }

  function getAllowedSpecialties() {
    const care = state.careProfile || {};
    const equipment = state.equipmentProfile || {};
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

  function renderHeader() {
    const child = state.activeChild;
    const care = state.careProfile || {};

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
      const diagnoses = child.diagnoses
        ? child.diagnoses.split(",").map((d) => d.trim()).filter(Boolean)
        : [];
      childSummary.textContent = `Age ${child.birthdate ? calculateAge(child.birthdate) : "—"}${diagnoses.length ? ` • ${diagnoses.join(" • ")}` : ""}`;
    }

    if (diagnosisPills) {
      diagnosisPills.innerHTML = "";
      const diagnoses = child.diagnoses
        ? child.diagnoses.split(",").map((d) => d.trim()).filter(Boolean)
        : [];

      diagnoses.forEach((dx) => {
        const pill = document.createElement("span");
        pill.className = "pill";
        pill.textContent = dx;
        diagnosisPills.appendChild(pill);
      });
    }
  }

  function applyAdaptiveUI() {
    const care = state.careProfile || {};
    const equipment = state.equipmentProfile || {};

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

    if (lastVitalsCard) {
      lastVitalsCard.classList.toggle("hidden", !showVitals);
    }

    if (lowSupplyCard) {
      lowSupplyCard.classList.toggle("hidden", !showInventory);
    }

    if (lastSymptomCard) {
      lastSymptomCard.classList.toggle("hidden", !showSymptoms);
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

  function renderToday() {
    todayList.innerHTML = `<li class="muted tiny">Schedule sync comes next.</li>`;
  }

  function renderHomeSchedule() {
    homeScheduleList.innerHTML = `<div class="empty-state">Schedule sync comes next.</div>`;
  }

  function renderLowSupplies() {
    if (!lowSupplyCard || !lowSupplySummary || !lowSupplyDashboardList) return;

    if (state.careProfile?.has_inventory) {
      lowSupplySummary.textContent = "Inventory sync comes next.";
      lowSupplyDashboardList.innerHTML = `<div class="muted tiny">No inventory alerts yet.</div>`;
    } else {
      lowSupplySummary.textContent = "";
      lowSupplyDashboardList.innerHTML = "";
    }
  }

  function renderLastVitals() {
    if (!lastVitalsCard || !lastVitalsContent) return;
    lastVitalsContent.innerHTML = `<div class="muted tiny">Vitals sync comes next.</div>`;
  }

  function renderLastSymptom() {
    if (!lastSymptomCard || !lastSymptomContent) return;
    lastSymptomContent.innerHTML = `<div class="muted tiny">Symptom sync comes next.</div>`;
  }

  function renderCareLogs() {
    careLogList.innerHTML = "";

    if (!state.careLogs.length) {
      careLogList.innerHTML = `<li class="muted tiny">No entries yet. Try Quick Log.</li>`;
      return;
    }

    state.careLogs.forEach((entry) => {
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
            <div class="muted tiny">${entry.author || "Caregiver"} • ${fmtDateTime(entry.created_at)} • ${specs}</div>
          </div>
        </div>
      `;
      careLogList.appendChild(li);
    });
  }

  function render() {
    renderHeader();
    applyAdaptiveUI();
    renderToday();
    renderHomeSchedule();
    renderLowSupplies();
    renderLastVitals();
    renderLastSymptom();
    renderCareLogs();
  }

  function openModal(categoryValue) {
    categorySelect.value = categoryValue;
    noteInput.value = "";
    authorInput.value = "Mom";
    renderSpecialtyChecks([]);
    modal.classList.remove("hidden");
    noteInput.focus();
  }

  function closeModal() {
    modal.classList.add("hidden");
  }

  async function saveQuickLog() {
    const note = noteInput.value.trim();
    const author = authorInput.value.trim() || "Caregiver";
    const category = categorySelect.value;
    const specialties = getSelectedSpecialties();

    if (!note) {
      alert("Please type a note.");
      return;
    }

    if (!state.activeChildId || !state.user) {
      alert("No active child selected.");
      return;
    }

    const { error } = await supabaseClient
      .from("care_logs")
      .insert([
        {
          child_id: state.activeChildId,
          parent_id: state.user.id,
          category,
          note,
          author,
          specialties,
          created_at: new Date().toISOString()
        }
      ]);

    if (error) {
      console.error("Quick log save error:", error);
      alert(error.message);
      return;
    }

    closeModal();
    await loadActiveChildCareLogs();
    render();
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

  function openEmergency() {
    if (!state.activeChild) return;

    const child = state.activeChild;
    const equipment = state.equipmentProfile || {};

    const diagnoses = child.diagnoses
      ? child.diagnoses.split(",").map((d) => d.trim()).filter(Boolean)
      : [];

    emergencyBody.innerHTML = `
      <div class="card" style="margin:0;border-radius:12px;">
        <div class="strong" style="font-size:18px;">${child.name}</div>
        <div class="muted">Age ${child.birthdate ? calculateAge(child.birthdate) : "—"}</div>
      </div>

      <div>
        <div class="strong">Diagnoses</div>
        <div class="muted">${diagnoses.join(", ") || "None listed"}</div>
      </div>

      <div>
        <div class="strong">Allergies</div>
        <div class="muted">${child.allergies || "(Add later)"}</div>
      </div>

      <div>
        <div class="strong">Trach</div>
        <div class="muted">${equipment.trach ? "Yes" : "No / Not listed"}</div>
      </div>

      <div>
        <div class="strong">Vent</div>
        <div class="muted">${equipment.ventilator ? "Yes" : "No / Not listed"}</div>
      </div>

      <div>
        <div class="strong">G-Tube</div>
        <div class="muted">${equipment.g_tube ? "Yes" : "No / Not listed"}</div>
      </div>

      <div>
        <div class="strong">Oxygen</div>
        <div class="muted">${equipment.oxygen ? "Yes" : "No / Not listed"}</div>
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

  btnSave.addEventListener("click", saveQuickLog);

  if (btnSaveQuickVitals) {
    btnSaveQuickVitals.addEventListener("click", () => {
      alert("Vitals save is the next Supabase step.");
      closeVitalsModal();
    });
  }

  if (btnEmergency) btnEmergency.addEventListener("click", openEmergency);
  if (bottomEmergencyBtn) bottomEmergencyBtn.addEventListener("click", openEmergency);

  btnCloseEmergency.addEventListener("click", closeEmergency);

  emergencyModal.addEventListener("click", (e) => {
    if (e.target === emergencyModal) closeEmergency();
  });

  childSwitcher.addEventListener("change", async () => {
    await selectChild(childSwitcher.value);
  });

  async function initDashboard() {
    const okUser = await loadUser();
    if (!okUser) return;

    const okChildren = await loadChildren();
    if (!okChildren) return;

    setInitialActiveChild();
    await loadActiveChildProfiles();
    await loadActiveChildCareLogs();

    fillChildSwitcher();
    render();
  }

  initDashboard();
});
