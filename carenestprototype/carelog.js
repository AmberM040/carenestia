document.addEventListener("DOMContentLoaded", () => {
  let db = ensureDB(loadDB());
  saveDB(db);

  const childSummary = document.getElementById("childSummary");
  const childSwitcher = document.getElementById("childSwitcher");

  const searchInput = document.getElementById("searchInput");
  const specialtyFilter = document.getElementById("specialtyFilter");
  const daysFilter = document.getElementById("daysFilter");

  const category = document.getElementById("category");
  const logDate = document.getElementById("logDate");
  const logTime = document.getElementById("logTime");
  const note = document.getElementById("note");
  const author = document.getElementById("author");
  const carelogSpecialtyChecks = document.getElementById("carelogSpecialtyChecks");

  const saveBtn = document.getElementById("saveBtn");
  const saveStatus = document.getElementById("saveStatus");

  const timeline = document.getElementById("timeline");
  const emptyState = document.getElementById("emptyState");

  const btnAddLog = document.getElementById("btnAddLog");
  const btnCloseModal = document.getElementById("btnCloseModal");
  const modal = document.getElementById("modal");

  const btnClearFilters = document.getElementById("btnClearFilters");

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
      console.error("Error loading children:", childrenError);
      alert("Could not load child profiles.");
      return false;
    }

    if (!children || children.length === 0) {
      window.location.href = "onboarding.html";
      return false;
    }

    const childIds = children.map((child) => child.id);

    const { data: careProfiles } = await supabaseClient
      .from("child_care_profiles")
      .select("*")
      .in("child_id", childIds);

    const { data: equipmentProfiles } = await supabaseClient
      .from("child_equipment_profiles")
      .select("*")
      .in("child_id", childIds);

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
        equipmentProfile
      };
    });

    if (!db.activeChildId || !db.children.find((c) => c.id === db.activeChildId)) {
      db.activeChildId = db.children[0].id;
      db.currentChildId = db.children[0].id;
    }

    saveDB(db);
    return true;
  }

  function activeChild() {
    const children = Array.isArray(db.children) ? db.children : [];
    if (!children.length) return null;
    return children.find((c) => c.id === db.activeChildId) || children[0];
  }

  function getAvailableSpecialties() {
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
      return [...new Set([...derived, ...db.specialties])];
    }

    return [...new Set(derived)];
  }

  function renderSpecialties() {
    const specialties = getAvailableSpecialties();

    carelogSpecialtyChecks.innerHTML = "";

    specialties.forEach((s) => {
      const label = document.createElement("label");
      label.className = "chip";
      label.innerHTML = `
        <input type="checkbox" value="${s}">
        <span>${s}</span>
      `;
      carelogSpecialtyChecks.appendChild(label);
    });

    specialtyFilter.innerHTML = `<option value="all">All Specialties</option>`;

    specialties.forEach((s) => {
      const o = document.createElement("option");
      o.value = s;
      o.textContent = s;
      specialtyFilter.appendChild(o);
    });
  }

  function setDefaultTime() {
    const now = new Date();
    logDate.value = now.toISOString().slice(0, 10);
    logTime.value = now.toTimeString().slice(0, 5);
  }

  function openModal() {
    modal.classList.remove("hidden");
  }

  function closeModal() {
    modal.classList.add("hidden");
  }

  btnAddLog.addEventListener("click", () => {
    setDefaultTime();
    note.value = "";
    saveStatus.textContent = "Ready";
    openModal();
  });

  btnCloseModal.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  function getSelectedSpecialties() {
    const selected = [...carelogSpecialtyChecks.querySelectorAll("input:checked")].map((x) => x.value);
    return selected.length ? selected : ["General"];
  }

  async function buildEntryPayload() {
    const child = activeChild();

    const {
      data: { user },
      error: userError
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error("You must be logged in.");
    }

    return {
      child_id: child.id,
      parent_id: user.id,
      category: category.value,
      note: note.value.trim(),
      author: author.value.trim() || "Caregiver",
      specialties: getSelectedSpecialties(),
      created_at: new Date(`${logDate.value}T${logTime.value}`).toISOString()
    };
  }

  async function saveEntry() {
    if (!note.value.trim()) {
      saveStatus.textContent = "Enter a note";
      return;
    }

    const child = activeChild();
    if (!child) {
      saveStatus.textContent = "No child selected";
      return;
    }

    saveStatus.textContent = "Saving...";

    try {
      const payload = await buildEntryPayload();

      const { error } = await supabaseClient
        .from("care_logs")
        .insert([payload]);

      if (error) {
        console.error("Save care log error:", error);
        saveStatus.textContent = error.message;
        return;
      }

      saveStatus.textContent = "Saved";
      closeModal();
      await renderTimeline();
    } catch (err) {
      console.error(err);
      saveStatus.textContent = err.message || "Save failed";
    }
  }

  saveBtn.addEventListener("click", saveEntry);

  function matchesFilters(entry) {
    const q = searchInput.value.toLowerCase().trim();

    if (q && !String(entry.note || "").toLowerCase().includes(q)) return false;

    if (
      specialtyFilter.value !== "all" &&
      !Array.isArray(entry.specialties || []) &&
      specialtyFilter.value
    ) {
      return false;
    }

    if (
      specialtyFilter.value !== "all" &&
      Array.isArray(entry.specialties || []) &&
      !entry.specialties.includes(specialtyFilter.value)
    ) {
      return false;
    }

    if (daysFilter.value !== "all") {
      const days = Number(daysFilter.value);
      const cutoff = Date.now() - days * 86400000;
      if (new Date(entry.created_at || entry.createdAt).getTime() < cutoff) return false;
    }

    return true;
  }

  function iconForCategory(cat) {
    if (cat === "symptom") return "🩺";
    if (cat === "question") return "❓";
    if (cat === "med") return "💊";
    return "📝";
  }

  function labelForCategory(cat) {
    if (cat === "symptom") return "Symptom";
    if (cat === "question") return "Question";
    if (cat === "med") return "Medication";
    return "Care Note";
  }

  async function renderTimeline() {
    const child = activeChild();

    if (!child) {
      timeline.innerHTML = "";
      emptyState?.classList.remove("hidden");
      return;
    }

    const {
      data: logs,
      error
    } = await supabaseClient
      .from("care_logs")
      .select("*")
      .eq("child_id", child.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Load care logs error:", error);
      timeline.innerHTML = "";
      emptyState?.classList.remove("hidden");
      return;
    }

    const filteredLogs = (logs || []).filter(matchesFilters);

    timeline.innerHTML = "";

    if (!filteredLogs.length) {
      emptyState?.classList.remove("hidden");
      return;
    }

    emptyState?.classList.add("hidden");

    filteredLogs.forEach((entry) => {
      const card = document.createElement("div");
      card.className = "log-card";

      const entryDate = new Date(entry.created_at || entry.createdAt);

      card.innerHTML = `
        <div class="log-icon general">${iconForCategory(entry.category)}</div>
        <div class="log-main">
          <h3>${entry.note}</h3>
          <p class="muted">${entry.author || "Caregiver"} • ${entryDate.toLocaleString()}</p>
          <p class="muted">${labelForCategory(entry.category)} • Specialties: ${(entry.specialties || []).join(", ") || "General"}</p>
        </div>
      `;

      timeline.appendChild(card);
    });
  }

  searchInput.addEventListener("input", () => {
    renderTimeline();
  });

  specialtyFilter.addEventListener("change", () => {
    renderTimeline();
  });

  daysFilter.addEventListener("change", () => {
    renderTimeline();
  });

  btnClearFilters.addEventListener("click", () => {
    searchInput.value = "";
    specialtyFilter.value = "all";
    daysFilter.value = "all";
    renderTimeline();
  });

  function fillChildSwitcher() {
    childSwitcher.innerHTML = "";

    (db.children || []).forEach((child) => {
      const o = document.createElement("option");
      o.value = child.id;
      o.textContent = child.name;
      childSwitcher.appendChild(o);
    });

    childSwitcher.value = db.activeChildId || "";
  }

  childSwitcher.addEventListener("change", async () => {
    db.activeChildId = childSwitcher.value;
    db.currentChildId = childSwitcher.value;
    saveDB(db);

    updateChildSummary();
    renderSpecialties();
    await renderTimeline();
  });

  function updateChildSummary() {
    const child = activeChild();
    if (!child) {
      childSummary.textContent = "No child selected";
      return;
    }

    childSummary.textContent = `${child.name} • Age ${child.age}`;
  }

  async function init() {
    const ok = await syncChildrenFromSupabase();
    if (!ok) return;

    fillChildSwitcher();
    updateChildSummary();
    renderSpecialties();
    setDefaultTime();
    await renderTimeline();
  }

  init();
});
