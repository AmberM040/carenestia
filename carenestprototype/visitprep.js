document.addEventListener("DOMContentLoaded", () => {
  let db = ensureDB(loadDB());
  saveDB(db);

  const childSummary = document.getElementById("childSummary");
  const vpSpecialty = document.getElementById("vpSpecialty");
  const vpDays = document.getElementById("vpDays");
  const vpIncludePRN = document.getElementById("vpIncludePRN");
  const rangeLabel = document.getElementById("rangeLabel");
  const statsLabel = document.getElementById("statsLabel");

  const medChangeList = document.getElementById("medChangeList");
  const medAdminList = document.getElementById("medAdminList");
  const symptomList = document.getElementById("symptomList");
  const questionInput = document.getElementById("questionInput");
  const btnAddQuestion = document.getElementById("btnAddQuestion");
  const questionList = document.getElementById("questionList");
  const noteList = document.getElementById("noteList");
  const btnPrint = document.getElementById("btnPrint");

  const required = {
    childSummary,
    vpSpecialty,
    vpDays,
    vpIncludePRN,
    rangeLabel,
    statsLabel,
    medChangeList,
    medAdminList,
    symptomList,
    questionInput,
    btnAddQuestion,
    questionList,
    noteList,
    btnPrint
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    alert("Missing elements in visitprep.html: " + missing.join(", "));
    return;
  }

  init();
  bindEvents();
  render();

  function init() {
    ensureVisitPrepDefaults();
    fillSpecialtyOptions();
    vpSpecialty.value = db.visitPrepSelectedSpecialty || "General";
    vpDays.value = db.visitPrepDays || "7";
    vpIncludePRN.value = db.visitPrepIncludePRN ? "yes" : "no";
    saveDB(db);
  }

  function bindEvents() {
    vpSpecialty.addEventListener("change", () => {
      db.visitPrepSelectedSpecialty = vpSpecialty.value;
      saveDB(db);
      render();
    });

    vpDays.addEventListener("change", () => {
      db.visitPrepDays = vpDays.value;
      saveDB(db);
      render();
    });

    vpIncludePRN.addEventListener("change", () => {
      db.visitPrepIncludePRN = vpIncludePRN.value === "yes";
      saveDB(db);
      render();
    });

    btnAddQuestion.addEventListener("click", addQuestion);

    questionInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addQuestion();
      }
    });

    btnPrint.addEventListener("click", () => {
      window.print();
    });
  }

  function ensureVisitPrepDefaults() {
    if (!Array.isArray(db.visitQuestions)) db.visitQuestions = [];
    if (typeof db.visitPrepSelectedSpecialty !== "string") db.visitPrepSelectedSpecialty = "General";
    if (typeof db.visitPrepDays !== "string") db.visitPrepDays = "7";
    if (typeof db.visitPrepIncludePRN !== "boolean") db.visitPrepIncludePRN = true;
  }

  function activeChild() {
    return getActiveChild(db);
  }

  function fillSpecialtyOptions() {
    const child = activeChild();
    const childSpecs = Array.isArray(child?.selectedSpecialties)
      ? child.selectedSpecialties
      : [];

    const merged = Array.from(
      new Set(["General", ...(db.specialties || []), ...childSpecs])
    );

    vpSpecialty.innerHTML = "";
    merged.forEach((spec) => {
      const opt = document.createElement("option");
      opt.value = spec;
      opt.textContent = spec;
      vpSpecialty.appendChild(opt);
    });
  }

  function render() {
    db = ensureDB(loadDB());
    ensureVisitPrepDefaults();

    const child = activeChild();
    if (!child) {
      childSummary.textContent = "No child selected";
      renderEmptyAll();
      return;
    }

    const diagnoses = Array.isArray(child.diagnoses) ? child.diagnoses : [];
    childSummary.textContent = `${child.name} • Age ${child.age ?? "—"}${diagnoses.length ? ` • ${diagnoses.join(" • ")}` : ""}`;

    const specialty = vpSpecialty.value || db.visitPrepSelectedSpecialty || "General";
    const includePRN = vpIncludePRN.value === "yes";
    const daysValue = vpDays.value || db.visitPrepDays || "7";

    const medChanges = getFilteredMedicationChanges(child.id, specialty, daysValue);
    const medAdmins = getFilteredMedicationAdministrations(child.id, specialty, daysValue, includePRN);
    const symptoms = getFilteredSymptoms(child.id, specialty, daysValue);
    const notes = getFilteredNotes(child.id, specialty, daysValue);
    const questions = getFilteredQuestions(specialty);

    renderAtAGlance(daysValue, medChanges, medAdmins, symptoms, notes, questions);
    renderMedicationChanges(medChanges);
    renderMedicationAdministrations(medAdmins);
    renderSymptoms(symptoms);
    renderQuestions(questions);
    renderNotes(notes);
  }

  function renderEmptyAll() {
    rangeLabel.textContent = "";
    statsLabel.textContent = "";
    medChangeList.innerHTML = `<li class="muted tiny">No data available.</li>`;
    medAdminList.innerHTML = `<li class="muted tiny">No data available.</li>`;
    symptomList.innerHTML = `<li class="muted tiny">No symptoms yet.</li>`;
    questionList.innerHTML = `<li class="muted tiny">No questions yet.</li>`;
    noteList.innerHTML = `<li class="muted tiny">No data available.</li>`;
  }

  function renderAtAGlance(daysValue, medChanges, medAdmins, symptoms, notes, questions) {
    rangeLabel.textContent = getRangeLabel(daysValue);

    const parts = [
      `${medChanges.length} med change${medChanges.length === 1 ? "" : "s"}`,
      `${medAdmins.length} administration${medAdmins.length === 1 ? "" : "s"}`,
      `${symptoms.length} symptom${symptoms.length === 1 ? "" : "s"}`,
      `${notes.length} note${notes.length === 1 ? "" : "s"}`,
      `${questions.length} question${questions.length === 1 ? "" : "s"}`
    ];

    statsLabel.textContent = parts.join(" • ");
  }

  function renderMedicationChanges(items) {
    medChangeList.innerHTML = "";
    if (!items.length) {
      medChangeList.innerHTML = `<li class="muted tiny">No recent medication changes.</li>`;
      return;
    }

    items.forEach((item) => {
      const li = document.createElement("li");
      li.className = "item";
      li.innerHTML = `
        <div class="left">
          <span class="badge">${escapeHtml(capitalize(item.action || "updated"))}</span>
          <div>
            <div class="strong">${escapeHtml(getMedName(item.medId) || "Medication")}</div>
            <div class="muted tiny">${escapeHtml(item.detail || "No details")} • ${formatDateTime(item.changedAt)}</div>
          </div>
        </div>
      `;
      medChangeList.appendChild(li);
    });
  }

  function renderMedicationAdministrations(items) {
    medAdminList.innerHTML = "";
    if (!items.length) {
      medAdminList.innerHTML = `<li class="muted tiny">No recent medication administrations.</li>`;
      return;
    }

    items.forEach((item) => {
      const medName = getMedName(item.medId) || "Medication";
      const typeLabel = item.type === "prn" ? "PRN" : item.type === "missed" ? "Missed" : "Scheduled";

      const li = document.createElement("li");
      li.className = "item";
      li.innerHTML = `
        <div class="left">
          <span class="badge">${escapeHtml(typeLabel)}</span>
          <div>
            <div class="strong">${escapeHtml(medName)}</div>
            <div class="muted tiny">${formatDateTime(item.time)}${item.note ? ` • ${escapeHtml(item.note)}` : ""}</div>
          </div>
        </div>
      `;
      medAdminList.appendChild(li);
    });
  }

  function renderSymptoms(items) {
    symptomList.innerHTML = "";
    if (!items.length) {
      symptomList.innerHTML = `<li class="muted tiny">No recent symptoms.</li>`;
      return;
    }

    items.forEach((item) => {
      const symptomLabel = item.symptom || item.note || "Symptom";
      const severity = item.severity || "Mild";

      const li = document.createElement("li");
      li.className = "item";
      li.innerHTML = `
        <div class="left">
          <span class="badge">${escapeHtml(severity)}</span>
          <div>
            <div class="strong">${escapeHtml(symptomLabel)}</div>
            <div class="muted tiny">
              ${formatDateTime(item.createdAt || item.time || item.loggedAt)} • ${escapeHtml(item.specialty || "General")}
              ${item.note && item.note !== item.symptom ? ` • ${escapeHtml(item.note)}` : ""}
            </div>
          </div>
        </div>
      `;
      symptomList.appendChild(li);
    });
  }

  function renderQuestions(items) {
    questionList.innerHTML = "";
    if (!items.length) {
      questionList.innerHTML = `<li class="muted tiny">No questions yet.</li>`;
      return;
    }

    items.forEach((item, index) => {
      const li = document.createElement("li");
      li.className = "item";
      li.innerHTML = `
        <div class="left" style="justify-content:space-between;width:100%;gap:12px;">
          <div>
            <div class="strong">${escapeHtml(item.text)}</div>
            <div class="muted tiny">${escapeHtml(item.specialty || "General")}</div>
          </div>
          <button class="btn btn-ghost btn-small" data-remove-question="${index}">Remove</button>
        </div>
      `;
      questionList.appendChild(li);
    });

    questionList.querySelectorAll("[data-remove-question]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = Number(btn.getAttribute("data-remove-question"));
        removeQuestion(index);
      });
    });
  }

  function renderNotes(items) {
    noteList.innerHTML = "";
    if (!items.length) {
      noteList.innerHTML = `<li class="muted tiny">No recent notes.</li>`;
      return;
    }

    items.forEach((item) => {
      const specs = Array.isArray(item.specialties) && item.specialties.length
        ? item.specialties.join(", ")
        : "General";

      const li = document.createElement("li");
      li.className = "item";
      li.innerHTML = `
        <div class="left">
          <span class="badge">${escapeHtml(categoryLabel(item.category))}</span>
          <div>
            <div class="strong">${escapeHtml(item.note || "")}</div>
            <div class="muted tiny">${escapeHtml(item.author || "Caregiver")} • ${formatDateTime(item.createdAt)} • ${escapeHtml(specs)}</div>
          </div>
        </div>
      `;
      noteList.appendChild(li);
    });
  }

  function addQuestion() {
    const text = questionInput.value.trim();
    if (!text) return;

    const specialty = vpSpecialty.value || "General";

    if (!Array.isArray(db.visitQuestions)) {
      db.visitQuestions = [];
    }

    db.visitQuestions.unshift({
      id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
      childId: activeChild()?.id || null,
      text,
      specialty,
      createdAt: Date.now()
    });

    saveDB(db);
    questionInput.value = "";
    render();
  }

  function removeQuestion(filteredIndex) {
    const specialty = vpSpecialty.value || "General";
    const filtered = getFilteredQuestions(specialty);
    const target = filtered[filteredIndex];
    if (!target) return;

    db.visitQuestions = (db.visitQuestions || []).filter((q) => q.id !== target.id);
    saveDB(db);
    render();
  }

  function getFilteredMedicationChanges(childId, specialty, daysValue) {
    const cutoff = getCutoffTimestamp(daysValue);

    return (db.medicationChangeHistory || [])
      .filter((item) => item.childId === childId)
      .filter((item) => !cutoff || new Date(item.changedAt).getTime() >= cutoff)
      .filter((item) => matchesSpecialty(item, specialty))
      .sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt))
      .slice(0, 20);
  }

  function getFilteredMedicationAdministrations(childId, specialty, daysValue, includePRN) {
    const cutoff = getCutoffTimestamp(daysValue);

    return (db.doseEvents || [])
      .filter((item) => item.childId === childId)
      .filter((item) => !cutoff || new Date(item.time || item.loggedAt).getTime() >= cutoff)
      .filter((item) => {
        if (item.type === "missed") return true;
        if (item.type === "prn") return includePRN;
        return true;
      })
      .filter((item) => matchesSpecialty(item, specialty, item.medId))
      .sort((a, b) => new Date(b.time || b.loggedAt) - new Date(a.time || a.loggedAt))
      .slice(0, 20);
  }

  function getFilteredSymptoms(childId, specialty, daysValue) {
    const cutoff = getCutoffTimestamp(daysValue);

    return (db.symptoms?.[childId] || [])
      .filter((item) => !cutoff || new Date(item.createdAt || item.time || item.loggedAt).getTime() >= cutoff)
      .filter((item) => matchesSpecialty(item, specialty))
      .sort((a, b) => {
        const aTime = new Date(a.createdAt || a.time || a.loggedAt || 0).getTime();
        const bTime = new Date(b.createdAt || b.time || b.loggedAt || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 20);
  }

  function getFilteredNotes(childId, specialty, daysValue) {
    const cutoff = getCutoffTimestamp(daysValue);

    return (db.logs?.[childId] || [])
      .filter((item) => !cutoff || new Date(item.createdAt).getTime() >= cutoff)
      .filter((item) => matchesSpecialty(item, specialty))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20);
  }

  function getFilteredQuestions(specialty) {
    const childId = activeChild()?.id || null;

    return (db.visitQuestions || [])
      .map(normalizeQuestion)
      .filter((q) => !q.childId || q.childId === childId)
      .filter((q) => specialty === "General" || q.specialty === "General" || q.specialty === specialty);
  }

  function normalizeQuestion(q) {
    if (typeof q === "string") {
      return {
        id: `q_${q}`,
        childId: null,
        text: q,
        specialty: "General",
        createdAt: Date.now()
      };
    }

    return {
      id: q.id || `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      childId: q.childId || null,
      text: q.text || "",
      specialty: q.specialty || "General",
      createdAt: q.createdAt || Date.now()
    };
  }

  function matchesSpecialty(item, selectedSpecialty, medId = null) {
    if (selectedSpecialty === "General") return true;

    const itemSpecialties = extractSpecialties(item, medId);
    if (!itemSpecialties.length) return true;

    return itemSpecialties.includes("General") || itemSpecialties.includes(selectedSpecialty);
  }

  function extractSpecialties(item, medId = null) {
    if (Array.isArray(item.specialties) && item.specialties.length) return item.specialties;
    if (item.specialty) return [item.specialty];

    if (medId) {
      const med = (db.meds || []).find((m) => m.id === medId);
      if (Array.isArray(med?.specialties) && med.specialties.length) return med.specialties;
      if (med?.specialty) return [med.specialty];
    }

    return ["General"];
  }

  function getMedName(medId) {
    const med = (db.meds || []).find((m) => m.id === medId);
    return med?.name || "";
  }

  function getCutoffTimestamp(daysValue) {
    if (daysValue === "all") return null;
    const days = Number(daysValue);
    if (!days) return null;
    return Date.now() - days * 24 * 60 * 60 * 1000;
  }

  function getRangeLabel(daysValue) {
    if (daysValue === "all") return "Showing all available history";
    return `Showing the last ${daysValue} day${daysValue === "1" ? "" : "s"}`;
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown time";

    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function capitalize(value) {
    const text = String(value || "");
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
});