document.addEventListener("DOMContentLoaded", () => {
  let db = ensureDB(loadDB());
  saveDB(db);

  const childSummary = document.getElementById("childSummary");
  const childSwitcher = document.getElementById("childSwitcher");

  const symptomName = document.getElementById("symptomName");
  const symptomSeverity = document.getElementById("symptomSeverity");
  const symptomSpecialty = document.getElementById("symptomSpecialty");
  const symptomWhen = document.getElementById("symptomWhen");
  const symptomNote = document.getElementById("symptomNote");
  const btnSaveSymptom = document.getElementById("btnSaveSymptom");

  const symptomCountToday = document.getElementById("symptomCountToday");
  const symptomMostRecent = document.getElementById("symptomMostRecent");
  const symptomSeveritySummary = document.getElementById("symptomSeveritySummary");

  const symptomsEmpty = document.getElementById("symptomsEmpty");
  const symptomsHistory = document.getElementById("symptomsHistory");

  function activeChild() {
    const children = Array.isArray(db.children) ? db.children : [];
    if (!children.length) return null;
    return children.find((c) => c.id === db.activeChildId) || children[0];
  }

  function activeSymptoms() {
    if (!db.symptoms || typeof db.symptoms !== "object") db.symptoms = {};
    if (!db.activeChildId) return [];
    if (!Array.isArray(db.symptoms[db.activeChildId])) db.symptoms[db.activeChildId] = [];
    return db.symptoms[db.activeChildId];
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

    if (Array.isArray(child?.selectedSpecialties) && child.selectedSpecialties.length) {
      return child.selectedSpecialties;
    }

    if (Array.isArray(db.specialties) && db.specialties.length) {
      return db.specialties;
    }

    return ["General"];
  }

  function fillSpecialtyOptions() {
    symptomSpecialty.innerHTML = "";

    getAllowedSpecialties().forEach((spec) => {
      const opt = document.createElement("option");
      opt.value = spec;
      opt.textContent = spec;
      symptomSpecialty.appendChild(opt);
    });

    symptomSpecialty.value = "General";
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

  function toInputDateTimeLocal(ts) {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function resetForm() {
    symptomName.value = "";
    symptomSeverity.value = "Mild";
    symptomSpecialty.value = "General";
    symptomWhen.value = toInputDateTimeLocal(Date.now());
    symptomNote.value = "";
  }

  function isToday(ts) {
    const d = new Date(ts);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }

  function renderSummary(rows) {
    const todayCount = rows.filter((r) => isToday(r.createdAt || r.time || Date.now())).length;
    symptomCountToday.textContent = `${todayCount} today`;

    const latest = rows[0];
    symptomMostRecent.textContent = latest
      ? `${latest.symptom || latest.note || "Symptom"} • ${latest.severity || "Mild"}`
      : "No recent symptom";

    const counts = { Mild: 0, Moderate: 0, Severe: 0 };
    rows.slice(0, 10).forEach((r) => {
      const s = r.severity || "Mild";
      if (counts[s] != null) counts[s] += 1;
    });

    const parts = [];
    if (counts.Mild) parts.push(`${counts.Mild} mild`);
    if (counts.Moderate) parts.push(`${counts.Moderate} moderate`);
    if (counts.Severe) parts.push(`${counts.Severe} severe`);

    symptomSeveritySummary.textContent = parts.length ? parts.join(" • ") : "No severity data";
  }

  function renderHistory() {
    symptomsHistory.innerHTML = "";

    const rows = activeSymptoms()
      .slice()
      .sort((a, b) => new Date(b.createdAt || b.time || 0) - new Date(a.createdAt || a.time || 0));

    renderSummary(rows);

    if (!rows.length) {
      symptomsEmpty.classList.remove("hidden");
      return;
    }

    symptomsEmpty.classList.add("hidden");

    rows.slice(0, 20).forEach((entry) => {
      const severity = entry.severity || "Mild";
      const tagClass =
        severity === "Severe"
          ? "card"
          : severity === "Moderate"
          ? "gi"
          : "general";

      const card = document.createElement("div");
      card.className = "log-card";

      card.innerHTML = `
        <div class="log-icon ${tagClass}">🩺</div>

        <div class="log-main">
          <h3>${entry.symptom || "Symptom"}</h3>
          <p>${entry.note || "No extra notes."}</p>
          <p class="muted mt-8">
            ${fmtDateTime(entry.createdAt || entry.time)} • ${entry.specialty || "General"}
          </p>
        </div>

        <div class="log-side">
          <span class="log-tag ${tagClass}">${severity}</span>
        </div>
      `;

      symptomsHistory.appendChild(card);
    });
  }

  function render() {
    db = ensureDB(loadDB());
    saveDB(db);

    const child = activeChild();
    if (!child) {
      childSummary.textContent = "No child selected";
      symptomsHistory.innerHTML = "";
      symptomsEmpty.classList.remove("hidden");
      return;
    }

    const diagnoses = Array.isArray(child.diagnoses) ? child.diagnoses : [];
    childSummary.textContent = `${child.name} • Age ${child.age ?? "—"}${diagnoses.length ? ` • ${diagnoses.join(" • ")}` : ""}`;

    fillSpecialtyOptions();

    if (!symptomWhen.value) {
      symptomWhen.value = toInputDateTimeLocal(Date.now());
    }

    renderHistory();
  }

  btnSaveSymptom.addEventListener("click", () => {
    const symptom = symptomName.value.trim();
    const severity = symptomSeverity.value;
    const specialty = symptomSpecialty.value || "General";
    const note = symptomNote.value.trim();
    const whenValue = symptomWhen.value ? new Date(symptomWhen.value).getTime() : Date.now();

    if (!symptom) {
      alert("Enter a symptom.");
      return;
    }

    activeSymptoms().unshift({
      id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
      symptom,
      severity,
      specialty,
      note,
      createdAt: Number.isNaN(whenValue) ? Date.now() : whenValue
    });

    saveDB(db);
    resetForm();
    render();
  });

  childSwitcher.addEventListener("change", () => {
    db.activeChildId = childSwitcher.value;
    saveDB(db);
    render();
  });

  fillChildSwitcher();
  resetForm();
  render();
});