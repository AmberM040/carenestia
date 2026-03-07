document.addEventListener("DOMContentLoaded", () => {
  let db = ensureDB(loadDB());
  saveDB(db);

  const COMMON_DIAGNOSES = [
    "Epilepsy",
    "Cerebral Palsy",
    "Chronic Lung Disease",
    "Asthma",
    "GERD",
    "Dysphagia",
    "Developmental Delay",
    "Autism",
    "Seizure Disorder",
    "Feeding Difficulty",
    "Aspiration Risk",
    "Neuromuscular Disorder"
  ];

  // ---- Elements
  const childSummary = document.getElementById("childSummary");
  const childSwitcher = document.getElementById("childSwitcher");
  const childList = document.getElementById("childList");
  const btnAddChild = document.getElementById("btnAddChild");

  const childName = document.getElementById("childName");
  const childAge = document.getElementById("childAge");
  const childAllergies = document.getElementById("childAllergies");

  const diagnosisChecks = document.getElementById("diagnosisChecks");
  const customDiagnosisInput = document.getElementById("customDiagnosisInput");
  const btnAddDiagnosis = document.getElementById("btnAddDiagnosis");
  const diagnosisChips = document.getElementById("diagnosisChips");

  const specialtyChecks = document.getElementById("specialtyChecks");

  const hasTrach = document.getElementById("hasTrach");
  const onVent = document.getElementById("onVent");
  const hasGTube = document.getElementById("hasGTube");
  const hasOxygen = document.getElementById("hasOxygen");

  const btnSaveChild = document.getElementById("btnSaveChild");

  // Add child modal
  const addChildModal = document.getElementById("addChildModal");
  const btnCloseAddChildModal = document.getElementById("btnCloseAddChildModal");

  const newChildName = document.getElementById("newChildName");
  const newChildAge = document.getElementById("newChildAge");
  const newChildAllergies = document.getElementById("newChildAllergies");

  const newDiagnosisChecks = document.getElementById("newDiagnosisChecks");
  const newCustomDiagnosisInput = document.getElementById("newCustomDiagnosisInput");
  const btnAddNewDiagnosis = document.getElementById("btnAddNewDiagnosis");
  const newDiagnosisChips = document.getElementById("newDiagnosisChips");

  const newChildSpecialtyChecks = document.getElementById("newChildSpecialtyChecks");

  const newHasTrach = document.getElementById("newHasTrach");
  const newOnVent = document.getElementById("newOnVent");
  const newHasGTube = document.getElementById("newHasGTube");
  const newHasOxygen = document.getElementById("newHasOxygen");

  const btnCreateChild = document.getElementById("btnCreateChild");

  const required = {
    childSummary,
    childSwitcher,
    childList,
    btnAddChild,
    childName,
    childAge,
    childAllergies,
    diagnosisChecks,
    customDiagnosisInput,
    btnAddDiagnosis,
    diagnosisChips,
    specialtyChecks,
    hasTrach,
    onVent,
    hasGTube,
    hasOxygen,
    btnSaveChild,
    addChildModal,
    btnCloseAddChildModal,
    newChildName,
    newChildAge,
    newChildAllergies,
    newDiagnosisChecks,
    newCustomDiagnosisInput,
    btnAddNewDiagnosis,
    newDiagnosisChips,
    newChildSpecialtyChecks,
    newHasTrach,
    newOnVent,
    newHasGTube,
    newHasOxygen,
    btnCreateChild
  };

  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    alert("Missing elements in settings.html: " + missing.join(", "));
    return;
  }

  // ---- State for custom diagnoses
  let currentCustomDiagnoses = [];
  let newChildCustomDiagnoses = [];

  function activeChild() {
    return getActiveChild(db);
  }

  function includesIgnoreCase(list, value) {
    return list.some(item => item.trim().toLowerCase() === value.trim().toLowerCase());
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

  function renderCheckboxGroup(container, options, selected = []) {
    container.innerHTML = "";

    options.forEach((value) => {
      const id = `${container.id}_${value.replace(/\W+/g, "_")}`;
      const label = document.createElement("label");
      label.className = "item";
      label.style.cursor = "pointer";
      label.innerHTML = `
        <div class="left">
          <input type="checkbox" id="${id}" value="${value}" />
          <div class="strong" style="margin-left:8px;">${value}</div>
        </div>
      `;
      container.appendChild(label);

      const box = label.querySelector("input");
      if (selected.includes(value)) box.checked = true;
    });
  }

  function getCheckedValues(container) {
    return [...container.querySelectorAll('input[type="checkbox"]:checked')].map((x) => x.value);
  }

  function renderDiagnosisChips(container, diagnoses, removeHandlerName) {
    container.innerHTML = "";

    if (!diagnoses.length) {
      container.innerHTML = `<div class="muted tiny">No diagnoses selected yet.</div>`;
      return;
    }

    diagnoses.forEach((d, idx) => {
      const li = document.createElement("div");
      li.className = "item";
      li.innerHTML = `
        <div class="left">
          <span class="badge">Dx</span>
          <div class="strong">${d}</div>
        </div>
        <div class="row-actions">
          <button class="btn btn-danger" data-remove-dx="${idx}" data-remove-group="${removeHandlerName}">Remove</button>
        </div>
      `;
      container.appendChild(li);
    });

    container.querySelectorAll("[data-remove-dx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.removeDx);
        const group = btn.dataset.removeGroup;

        if (group === "current") {
          currentCustomDiagnoses.splice(idx, 1);
          renderCurrentDiagnosisSection();
        } else {
          newChildCustomDiagnoses.splice(idx, 1);
          renderNewDiagnosisSection();
        }
      });
    });
  }

  function combinedDiagnoses(commonContainer, customList) {
    const checked = getCheckedValues(commonContainer);
    const merged = [...checked, ...customList];

    const seen = new Set();

    return merged.filter((dx) => {
      const key = dx.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function renderCurrentDiagnosisSection() {
    const child = activeChild();
    const childDiagnoses = Array.isArray(child?.diagnoses) ? child.diagnoses : [];

    const commonSelected = childDiagnoses.filter((d) => COMMON_DIAGNOSES.includes(d));
    const customSelected = childDiagnoses.filter((d) => !COMMON_DIAGNOSES.includes(d));

    currentCustomDiagnoses = [...customSelected];

    renderCheckboxGroup(diagnosisChecks, COMMON_DIAGNOSES, commonSelected);
    renderDiagnosisChips(diagnosisChips, currentCustomDiagnoses, "current");
  }

  function renderNewDiagnosisSection() {
    renderCheckboxGroup(newDiagnosisChecks, COMMON_DIAGNOSES, []);
    renderDiagnosisChips(newDiagnosisChips, newChildCustomDiagnoses, "new");
  }

  function renderSpecialtyChecks(container, selected = []) {
    const list = Array.isArray(db.specialties) && db.specialties.length ? db.specialties : ["General"];
    renderCheckboxGroup(container, list, selected);
  }

  function getSelectedSpecialties(container) {
    const checked = getCheckedValues(container);
    return checked.length ? checked : ["General"];
  }

  function loadActiveChildIntoForm() {
    const child = activeChild();

    if (!child) {
      childSummary.textContent = "No child selected";
      childName.value = "";
      childAge.value = "";
      childAllergies.value = "";
      currentCustomDiagnoses = [];
      renderCheckboxGroup(diagnosisChecks, COMMON_DIAGNOSES, []);
      renderDiagnosisChips(diagnosisChips, [], "current");
      renderSpecialtyChecks(specialtyChecks, ["General"]);
      hasTrach.checked = false;
      onVent.checked = false;
      hasGTube.checked = false;
      hasOxygen.checked = false;
      return;
    }

    const diagnosisText =
      child.diagnoses && child.diagnoses.length
        ? child.diagnoses.join(" • ")
        : "No diagnoses listed";

    childSummary.textContent = `${child.name} • Age ${child.age ?? "—"} • ${diagnosisText}`;

    childName.value = child.name || "";
    childAge.value = child.age ?? "";
    childAllergies.value = child.emergency?.allergies || "";

    renderCurrentDiagnosisSection();
    renderSpecialtyChecks(specialtyChecks, child.selectedSpecialties || ["General"]);

    hasTrach.checked = !!child.emergency?.trach?.hasTrach;
    onVent.checked = !!child.emergency?.vent?.onVent;
    hasGTube.checked = !!child.emergency?.gTube?.hasGTube;
    hasOxygen.checked = !!child.emergency?.oxygen?.hasOxygen;
  }

  function renderChildList() {
    childList.innerHTML = "";

    const children = Array.isArray(db.children) ? db.children : [];
    if (!children.length) {
      childList.innerHTML = `<li class="muted tiny">No children yet.</li>`;
      return;
    }

    children.forEach((c) => {
      const li = document.createElement("li");
      li.className = "item";

      const isActive = c.id === db.activeChildId;
      const devices = [];
      if (c.emergency?.trach?.hasTrach) devices.push("Trach");
      if (c.emergency?.vent?.onVent) devices.push("Vent");
      if (c.emergency?.gTube?.hasGTube) devices.push("G-tube");
      if (c.emergency?.oxygen?.hasOxygen) devices.push("Oxygen");

      li.innerHTML = `
        <div class="left">
          <span class="badge">${isActive ? "Active" : "Child"}</span>
          <div>
            <div class="strong">${c.name} • Age ${c.age ?? "—"}</div>
            <div class="muted tiny">${(c.diagnoses || []).join(", ") || "No diagnoses yet"}</div>
            <div class="muted tiny">Specialties: ${(c.selectedSpecialties || ["General"]).join(", ")}</div>
            <div class="muted tiny">Devices: ${devices.length ? devices.join(", ") : "None selected"}</div>
          </div>
        </div>
        <div class="row-actions">
          ${!isActive ? `<button class="btn btn-primary" data-switch-child="${c.id}">Switch To</button>` : ""}
        </div>
      `;

      childList.appendChild(li);
    });

    childList.querySelectorAll("[data-switch-child]").forEach((btn) => {
      btn.addEventListener("click", () => {
        db.activeChildId = btn.dataset.switchChild;
        saveDB(db);
        fillChildSwitcher();
        loadActiveChildIntoForm();
        renderChildList();
      });
    });
  }

  // ---- Current child custom diagnoses
  btnAddDiagnosis.addEventListener("click", (e) => {
    e.preventDefault();
    const value = customDiagnosisInput.value.trim();
    if (!value) return;

    if (!includesIgnoreCase(currentCustomDiagnoses, value)) {
      currentCustomDiagnoses.push(value);
    }

    customDiagnosisInput.value = "";
    renderDiagnosisChips(diagnosisChips, currentCustomDiagnoses, "current");
  });

  // ---- New child custom diagnoses
  btnAddNewDiagnosis.addEventListener("click", (e) => {
    e.preventDefault();
    const value = newCustomDiagnosisInput.value.trim();
    if (!value) return;

    if (!includesIgnoreCase(newChildCustomDiagnoses, value)) {
      newChildCustomDiagnoses.push(value);
    }

    newCustomDiagnosisInput.value = "";
    renderDiagnosisChips(newDiagnosisChips, newChildCustomDiagnoses, "new");
  });

  // ---- Enter key support for diagnosis inputs
  customDiagnosisInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      btnAddDiagnosis.click();
    }
  });

  newCustomDiagnosisInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      btnAddNewDiagnosis.click();
    }
  });

  // ---- Save active child
  btnSaveChild.addEventListener("click", () => {
    const child = activeChild();
    if (!child) {
      alert("No active child selected.");
      return;
    }

    const name = childName.value.trim();
    const ageValue = childAge.value.trim();
    const age = ageValue === "" ? null : Number(ageValue);
    const diagnoses = combinedDiagnoses(diagnosisChecks, currentCustomDiagnoses);
    const allergies = childAllergies.value.trim();
    const selectedSpecialties = getSelectedSpecialties(specialtyChecks);

    if (!name) {
      alert("Please enter a child name.");
      return;
    }

    if (age !== null && Number.isNaN(age)) {
      alert("Please enter a valid age.");
      return;
    }

    child.name = name;
    child.age = age;
    child.diagnoses = diagnoses;

    if (!child.emergency) child.emergency = {};
    if (!child.emergency.trach) child.emergency.trach = {};
    if (!child.emergency.vent) child.emergency.vent = {};
    if (!child.emergency.gTube) child.emergency.gTube = {};
    if (!child.emergency.oxygen) child.emergency.oxygen = {};

    child.selectedSpecialties = selectedSpecialties;
    child.emergency.allergies = allergies;
    child.emergency.trach.hasTrach = !!hasTrach.checked;
    child.emergency.vent.onVent = !!onVent.checked;
    child.emergency.gTube.hasGTube = !!hasGTube.checked;
    child.emergency.oxygen.hasOxygen = !!hasOxygen.checked;

    saveDB(db);
    fillChildSwitcher();
    loadActiveChildIntoForm();
    renderChildList();
    alert("Child profile saved.");
  });

  // ---- Add child modal
  
  function openAddChildModal() {
  newChildName.value = "";
  newChildAge.value = "";
  newChildAllergies.value = "";
  newCustomDiagnosisInput.value = "";
  newChildCustomDiagnoses = [];

  newHasTrach.checked = false;
  newOnVent.checked = false;
  newHasGTube.checked = false;
  newHasOxygen.checked = false;

  renderNewDiagnosisSection();
  renderSpecialtyChecks(newChildSpecialtyChecks, ["General"]);
  addChildModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
  newChildName.focus();
}

function closeAddChildModal() {
  addChildModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

  btnAddChild.addEventListener("click", openAddChildModal);
  btnCloseAddChildModal.addEventListener("click", closeAddChildModal);

  addChildModal.addEventListener("click", (e) => {
    if (e.target === addChildModal) closeAddChildModal();
  });

  btnCreateChild.addEventListener("click", () => {
    const name = newChildName.value.trim();
    const ageValue = newChildAge.value.trim();
    const age = ageValue === "" ? null : Number(ageValue);
    const diagnoses = combinedDiagnoses(newDiagnosisChecks, newChildCustomDiagnoses);
    const allergies = newChildAllergies.value.trim();
    const selectedSpecialties = getSelectedSpecialties(newChildSpecialtyChecks);

    if (!name) {
      alert("Please enter a child name.");
      return;
    }

    if (age !== null && Number.isNaN(age)) {
      alert("Please enter a valid age.");
      return;
    }

    const id = crypto?.randomUUID ? crypto.randomUUID() : `child_${Date.now()}`;

    const child = {
      id,
      name,
      age,
      diagnoses,
      selectedSpecialties,
      emergency: {
        allergies,
        trach: { hasTrach: !!newHasTrach.checked, type: "", size: "", lastChange: "" },
        vent: { onVent: !!newOnVent.checked, mode: "", settings: "" },
        gTube: { hasGTube: !!newHasGTube.checked },
        oxygen: { hasOxygen: !!newHasOxygen.checked }
      }
    };

    if (!Array.isArray(db.children)) db.children = [];
    db.children.push(child);

    if (!db.logs) db.logs = {};
    if (!db.meds) db.meds = {};
    if (!db.symptoms) db.symptoms = {};

    if (!db.logs[id]) db.logs[id] = [];
    if (!db.meds[id]) db.meds[id] = [];
    if (!db.symptoms[id]) db.symptoms[id] = [];

    db.activeChildId = id;

    saveDB(db);
    closeAddChildModal();
    fillChildSwitcher();
    loadActiveChildIntoForm();
    renderChildList();
    alert("Child created.");
  });

  childSwitcher.addEventListener("change", () => {
    db.activeChildId = childSwitcher.value;
    saveDB(db);
    loadActiveChildIntoForm();
    renderChildList();
  });

  // ---- Init
  fillChildSwitcher();
  loadActiveChildIntoForm();
  renderChildList();
});