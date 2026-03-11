document.addEventListener("DOMContentLoaded", async () => {
  let db = ensureDB(loadDB());
  const supabase = window.supabaseClient || null;

  const childSwitcher = document.getElementById("childSwitcher");
  const childAvatar = document.getElementById("childAvatar");
  const childSummary = document.getElementById("childSummary");
  const logoutBtn = document.getElementById("logoutBtn");

  const binderPhoto = document.getElementById("binderPhoto");
  const binderName = document.getElementById("binderName");
  const binderSub = document.getElementById("binderSub");

  const binderGroupNav = document.getElementById("binderGroupNav");
  const binderSubnav = document.getElementById("binderSubnav");
  const binderSectionContent = document.getElementById("binderSectionContent");
  const binderStatusList = document.getElementById("binderStatusList");

  const binderStatDiagnoses = document.getElementById("binderStatDiagnoses");
  const binderStatAllergies = document.getElementById("binderStatAllergies");
  const binderStatMeds = document.getElementById("binderStatMeds");
  const binderStatComplete = document.getElementById("binderStatComplete");

  const sectionTitle = document.getElementById("sectionTitle");
  const sectionDesc = document.getElementById("sectionDesc");

  const editSectionBtn = document.getElementById("editSectionBtn");
  const manageSectionsBtn = document.getElementById("manageSectionsBtn");

  const editModal = document.getElementById("editModal");
  const editTitle = document.getElementById("editTitle");
  const saveEditBtn = document.getElementById("saveEditBtn");
  const cancelEditBtn = document.getElementById("cancelEditBtn");

  let editingSection = null;
  let currentGroup = "overview";
  let currentSectionKey = "aboutMe";

  const GROUPS = {
    overview: {
      label: "About Me",
      sections: ["aboutMe"]
    },
    medical: {
      label: "Medical",
      sections: ["medicalHistory", "medications", "baseline", "labs"]
    },
    dailyCare: {
      label: "Daily Care",
      sections: ["feedingNutrition", "carePlans", "nursingMedicaid"]
    },
    emergency: {
      label: "Emergency",
      sections: ["emergencyPlans", "goBag", "seizureProfile"]
    },
    school: {
      label: "School",
      sections: ["schoolInfo", "schoolPaperwork"]
    },
    contacts: {
      label: "Contacts",
      sections: ["careTeam"]
    },
    documents: {
      label: "Documents",
      sections: ["documents"]
    }
  };

  const SECTION_CONFIG = {
    aboutMe: {
      label: "About Me",
      desc: "A quick, human-centered snapshot of the child for caregivers, school staff, and emergency teams."
    },
    medicalHistory: {
      label: "Medical History",
      desc: "Diagnoses, surgeries, hospitalizations, allergies, and major medical background."
    },
    medications: {
      label: "Medications",
      desc: "Daily, PRN, and rescue medications."
    },
    baseline: {
      label: "Baseline",
      desc: "What is normal for this child: presentation, vital ranges, and typical neurology."
    },
    labs: {
      label: "Labs & Tests",
      desc: "Recent labs, test results, imaging, and follow-up notes."
    },
    feedingNutrition: {
      label: "Feeding & Nutrition",
      desc: "Feeding schedule, formula, tube details, and hydration notes."
    },
    carePlans: {
      label: "Care Plans",
      desc: "Daily plan, sick day plan, seizure plan, and more."
    },
    nursingMedicaid: {
      label: "Nursing & Medicaid",
      desc: "Agency, waiver, nursing hours, and Medicaid information."
    },
    emergencyPlans: {
      label: "Emergency Plans",
      desc: "Medical and non-medical emergency planning and evacuation notes."
    },
    seizureProfile: {
      label: "Seizure Profile",
      desc: "Seizure information, rescue protocol, and tracking notes."
    },
    goBag: {
      label: "Go Bag",
      desc: "Emergency checklists and go bag preparedness."
    },
    schoolInfo: {
      label: "School Info",
      desc: "School care details, accommodations, nurse contacts, and instructions."
    },
    schoolPaperwork: {
      label: "School Paperwork",
      desc: "IEP, 504, medication forms, physician orders, and school documents."
    },
    careTeam: {
      label: "Care Team",
      desc: "Doctors, therapists, pharmacy, DME, and emergency contacts."
    },
    documents: {
      label: "Documents & Notes",
      desc: "Uploaded summaries, letters, visit notes, and general notes."
    }
  };

  await init();

  async function init() {
    await loadChildren();
    ensureBinderStructure();
    ensureValidCurrentSection();
    renderChildSwitcher();
    renderHeader();
    renderSidebarProfile();
    renderGroupNav();
    renderSubnav();
    renderStats();
    renderStatusPanel();
    renderSection(currentSectionKey);
    wireEvents();
  }

  function wireEvents() {
    childSwitcher?.addEventListener("change", () => {
      db.activeChildId = childSwitcher.value;
      db.currentChildId = childSwitcher.value;
      saveDB(db);

      ensureValidCurrentSection();
      renderChildSwitcher();
      renderHeader();
      renderSidebarProfile();
      renderGroupNav();
      renderSubnav();
      renderStats();
      renderStatusPanel();
      renderSection(currentSectionKey);
    });

    binderGroupNav?.querySelectorAll("[data-group]").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentGroup = btn.dataset.group;
        ensureValidCurrentSection();
        renderGroupNav();
        renderSubnav();
        renderSection(currentSectionKey);
      });
    });

    manageSectionsBtn?.addEventListener("click", () => {
      alert("We can build section management next. Right now About Me and Baseline are structured and editable.");
    });

    editSectionBtn?.addEventListener("click", () => {
      openEdit(currentSectionKey);
    });

    cancelEditBtn?.addEventListener("click", closeEdit);
    saveEditBtn?.addEventListener("click", saveEdit);

    editModal?.addEventListener("click", (e) => {
      if (e.target === editModal) closeEdit();
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

  function ensureBinderStructure() {
    if (!db.careBinder) db.careBinder = {};
    if (!db.careBinder.sections) db.careBinder.sections = {};

    if (!db.careBinder.sections.aboutMe || typeof db.careBinder.sections.aboutMe !== "object") {
      db.careBinder.sections.aboutMe = {};
    }

    const aboutMe = db.careBinder.sections.aboutMe;
    if (typeof aboutMe.preferredName !== "string") aboutMe.preferredName = "";
    if (typeof aboutMe.legalName !== "string") aboutMe.legalName = "";
    if (typeof aboutMe.dob !== "string") aboutMe.dob = "";
    if (typeof aboutMe.age !== "string") aboutMe.age = "";
    if (typeof aboutMe.communication !== "string") aboutMe.communication = "";
    if (typeof aboutMe.likes !== "string") aboutMe.likes = "";
    if (typeof aboutMe.calming !== "string") aboutMe.calming = "";
    if (typeof aboutMe.dislikes !== "string") aboutMe.dislikes = "";
    if (typeof aboutMe.mobility !== "string") aboutMe.mobility = "";
    if (typeof aboutMe.feedingMethod !== "string") aboutMe.feedingMethod = "";
    if (typeof aboutMe.baselineStatus !== "string") aboutMe.baselineStatus = "";
    if (typeof aboutMe.specialEquipment !== "string") aboutMe.specialEquipment = "";
    if (typeof aboutMe.criticalNotes !== "string") aboutMe.criticalNotes = "";

    if (!db.careBinder.sections.baseline || typeof db.careBinder.sections.baseline !== "object") {
      db.careBinder.sections.baseline = {};
    }

    const baseline = db.careBinder.sections.baseline;

    if (!baseline.presentation || typeof baseline.presentation !== "object") baseline.presentation = {};
    if (!baseline.vitals || typeof baseline.vitals !== "object") baseline.vitals = {};
    if (!baseline.neurology || typeof baseline.neurology !== "object") baseline.neurology = {};

    if (typeof baseline.presentation.communication !== "string") baseline.presentation.communication = "";
    if (typeof baseline.presentation.mobility !== "string") baseline.presentation.mobility = "";
    if (typeof baseline.presentation.alertness !== "string") baseline.presentation.alertness = "";
    if (typeof baseline.presentation.painSigns !== "string") baseline.presentation.painSigns = "";
    if (typeof baseline.presentation.behavior !== "string") baseline.presentation.behavior = "";
    if (typeof baseline.presentation.notes !== "string") baseline.presentation.notes = "";

    if (!baseline.vitals.temp || typeof baseline.vitals.temp !== "object") baseline.vitals.temp = {};
    if (!baseline.vitals.o2 || typeof baseline.vitals.o2 !== "object") baseline.vitals.o2 = {};
    if (!baseline.vitals.hr || typeof baseline.vitals.hr !== "object") baseline.vitals.hr = {};
    if (!baseline.vitals.rr || typeof baseline.vitals.rr !== "object") baseline.vitals.rr = {};
    if (!baseline.vitals.bpSys || typeof baseline.vitals.bpSys !== "object") baseline.vitals.bpSys = {};
    if (!baseline.vitals.bpDia || typeof baseline.vitals.bpDia !== "object") baseline.vitals.bpDia = {};

    if (typeof baseline.vitals.temp.min !== "string") baseline.vitals.temp.min = "";
    if (typeof baseline.vitals.temp.max !== "string") baseline.vitals.temp.max = "";
    if (typeof baseline.vitals.o2.min !== "string") baseline.vitals.o2.min = "";
    if (typeof baseline.vitals.o2.max !== "string") baseline.vitals.o2.max = "";
    if (typeof baseline.vitals.hr.min !== "string") baseline.vitals.hr.min = "";
    if (typeof baseline.vitals.hr.max !== "string") baseline.vitals.hr.max = "";
    if (typeof baseline.vitals.rr.min !== "string") baseline.vitals.rr.min = "";
    if (typeof baseline.vitals.rr.max !== "string") baseline.vitals.rr.max = "";
    if (typeof baseline.vitals.bpSys.min !== "string") baseline.vitals.bpSys.min = "";
    if (typeof baseline.vitals.bpSys.max !== "string") baseline.vitals.bpSys.max = "";
    if (typeof baseline.vitals.bpDia.min !== "string") baseline.vitals.bpDia.min = "";
    if (typeof baseline.vitals.bpDia.max !== "string") baseline.vitals.bpDia.max = "";
    if (typeof baseline.vitals.notes !== "string") baseline.vitals.notes = "";

    if (typeof baseline.neurology.seizureType !== "string") baseline.neurology.seizureType = "";
    if (typeof baseline.neurology.seizureDuration !== "string") baseline.neurology.seizureDuration = "";
    if (typeof baseline.neurology.postictal !== "string") baseline.neurology.postictal = "";
    if (typeof baseline.neurology.triggers !== "string") baseline.neurology.triggers = "";
    if (typeof baseline.neurology.recovery !== "string") baseline.neurology.recovery = "";
    if (typeof baseline.neurology.notes !== "string") baseline.neurology.notes = "";

    Object.keys(SECTION_CONFIG).forEach((key) => {
      if (key === "aboutMe" || key === "baseline") return;
      if (!db.careBinder.sections[key] || typeof db.careBinder.sections[key] !== "object") {
        db.careBinder.sections[key] = { notes: "" };
      }
      if (typeof db.careBinder.sections[key].notes !== "string") {
        db.careBinder.sections[key].notes = "";
      }
    });

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

  function renderSidebarProfile() {
    const child = getActiveChild();
    const aboutMe = db.careBinder?.sections?.aboutMe || {};

    if (!child) {
      if (binderPhoto) binderPhoto.removeAttribute("src");
      if (binderName) binderName.textContent = "No child selected";
      if (binderSub) binderSub.textContent = "Add a child profile to continue";
      return;
    }

    if (binderPhoto) {
      binderPhoto.src = child.photo_url || "https://via.placeholder.com/600x400?text=Child+Photo";
      binderPhoto.alt = child.name ? `${child.name} photo` : "Child photo";
    }

    if (binderName) {
      binderName.textContent = aboutMe.preferredName || child.name || "Child";
    }

    const ageText = aboutMe.age || child.age ? `Age ${aboutMe.age || child.age}` : "Age —";
    const dx =
      Array.isArray(child.diagnoses) && child.diagnoses.length
        ? child.diagnoses.join(" • ")
        : "No diagnoses listed";

    if (binderSub) {
      binderSub.textContent = `${ageText} • ${dx}`;
    }
  }

  function renderGroupNav() {
    binderGroupNav?.querySelectorAll("[data-group]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.group === currentGroup);
    });
  }

  function ensureValidCurrentSection() {
    const available = getSectionsForGroup(currentGroup);
    if (!available.includes(currentSectionKey)) {
      currentSectionKey = available[0] || "aboutMe";
    }
  }

  function getSectionsForGroup(groupKey) {
    return GROUPS[groupKey]?.sections || [];
  }

  function renderSubnav() {
    const sectionKeys = getSectionsForGroup(currentGroup);

    if (!binderSubnav) return;

    binderSubnav.innerHTML = sectionKeys
      .map((key) => {
        const cfg = SECTION_CONFIG[key];
        const activeClass = key === currentSectionKey ? "active" : "";
        return `<button class="binder-subtab ${activeClass}" data-subtab="${key}" type="button">${escapeHtml(cfg.label)}</button>`;
      })
      .join("");

    binderSubnav.querySelectorAll("[data-subtab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentSectionKey = btn.dataset.subtab;
        renderSubnav();
        renderSection(currentSectionKey);
      });
    });
  }

  function renderStats() {
    const child = getActiveChild();
    const diagnosesCount = Array.isArray(child?.diagnoses) ? child.diagnoses.length : 0;
    const allergyCount = countMeaningfulNotes("medicalHistory");
    const medCount = countMeaningfulNotes("medications");
    const completeCount = getCompleteSectionCount();

    if (binderStatDiagnoses) binderStatDiagnoses.textContent = diagnosesCount;
    if (binderStatAllergies) binderStatAllergies.textContent = allergyCount;
    if (binderStatMeds) binderStatMeds.textContent = medCount;
    if (binderStatComplete) binderStatComplete.textContent = completeCount;
  }

  function renderStatusPanel() {
    if (!binderStatusList) return;

    const allSections = Object.keys(SECTION_CONFIG);

    binderStatusList.innerHTML = allSections
      .map((key) => {
        const status = getSectionStatus(key);
        const label = SECTION_CONFIG[key].label;

        return `
          <div class="binder-status-row">
            <div>${escapeHtml(label)}</div>
            <span class="status-badge ${status.className}">${escapeHtml(status.label)}</span>
          </div>
        `;
      })
      .join("");
  }

  function getSectionStatus(key) {
    if (key === "aboutMe") {
      const section = db.careBinder?.sections?.aboutMe || {};
      const fields = [
        section.preferredName,
        section.legalName,
        section.dob,
        section.age,
        section.communication,
        section.likes,
        section.calming,
        section.dislikes,
        section.mobility,
        section.feedingMethod,
        section.baselineStatus,
        section.specialEquipment,
        section.criticalNotes
      ].filter((v) => String(v || "").trim());

      if (!fields.length) return { label: "Empty", className: "status-empty" };
      if (fields.length < 6) return { label: "Partial", className: "status-partial" };
      return { label: "Complete", className: "status-complete" };
    }

    if (key === "baseline") {
      const section = db.careBinder?.sections?.baseline || {};
      const values = [
        section.presentation?.communication,
        section.presentation?.mobility,
        section.presentation?.alertness,
        section.presentation?.painSigns,
        section.presentation?.behavior,
        section.presentation?.notes,
        section.vitals?.temp?.min,
        section.vitals?.temp?.max,
        section.vitals?.o2?.min,
        section.vitals?.o2?.max,
        section.vitals?.hr?.min,
        section.vitals?.hr?.max,
        section.vitals?.rr?.min,
        section.vitals?.rr?.max,
        section.vitals?.bpSys?.min,
        section.vitals?.bpSys?.max,
        section.vitals?.bpDia?.min,
        section.vitals?.bpDia?.max,
        section.vitals?.notes,
        section.neurology?.seizureType,
        section.neurology?.seizureDuration,
        section.neurology?.postictal,
        section.neurology?.triggers,
        section.neurology?.recovery,
        section.neurology?.notes
      ].filter((v) => String(v || "").trim());

      if (!values.length) return { label: "Empty", className: "status-empty" };
      if (values.length < 8) return { label: "Partial", className: "status-partial" };
      return { label: "Complete", className: "status-complete" };
    }

    const notes = db.careBinder?.sections?.[key]?.notes || "";
    if (!notes.trim()) return { label: "Empty", className: "status-empty" };
    if (notes.trim().length < 40) return { label: "Partial", className: "status-partial" };
    return { label: "Complete", className: "status-complete" };
  }

  function getCompleteSectionCount() {
    return Object.keys(SECTION_CONFIG).filter((key) => getSectionStatus(key).label !== "Empty").length;
  }

  function countMeaningfulNotes(key) {
    const notes = db.careBinder?.sections?.[key]?.notes || "";
    return notes.trim() ? 1 : 0;
  }

  function renderSection(key) {
    const cfg = SECTION_CONFIG[key];
    if (!cfg) return;

    if (sectionTitle) sectionTitle.textContent = cfg.label;
    if (sectionDesc) sectionDesc.textContent = cfg.desc;

    if (key === "aboutMe") {
      binderSectionContent.innerHTML = renderAboutMeSection();
      document.getElementById("inlineEditBtn")?.addEventListener("click", () => {
        openEdit("aboutMe");
      });
    } else if (key === "baseline") {
      binderSectionContent.innerHTML = renderBaselineSection();
      document.getElementById("inlineEditBtn")?.addEventListener("click", () => {
        openEdit("baseline");
      });
    } else {
      const notes = db.careBinder?.sections?.[key]?.notes || "";

      binderSectionContent.innerHTML = `
        <section class="chart-card">
          <div class="chart-card-head">
            <h3>${escapeHtml(cfg.label)}</h3>
            <div class="button-row">
              <button class="btn btn-ghost" type="button" id="inlineEditBtn">Edit</button>
            </div>
          </div>

          <div class="chart-card-body">
            <div class="kv-list">
              <div class="kv-row">
                <div class="kv-key">Notes</div>
                <div>${notes ? escapeHtml(notes) : `<span class="empty-state">No notes yet.</span>`}</div>
              </div>
            </div>
          </div>
        </section>
      `;

      document.getElementById("inlineEditBtn")?.addEventListener("click", () => {
        openEdit(key);
      });
    }

    if (editSectionBtn) {
      editSectionBtn.onclick = () => openEdit(key);
    }

    renderStats();
    renderStatusPanel();
  }

  function renderAboutMeSection() {
    const child = getActiveChild();
    const aboutMe = db.careBinder?.sections?.aboutMe || {};

    const rows = [
      ["Preferred Name", aboutMe.preferredName || child?.name || "—"],
      ["Legal Name", aboutMe.legalName || "—"],
      ["DOB", aboutMe.dob || child?.birthdate || "—"],
      ["Age", aboutMe.age || (child?.age ? String(child.age) : "—")],
      ["Communication", aboutMe.communication || "—"],
      ["Likes", aboutMe.likes || "—"],
      ["Things That Calm Me", aboutMe.calming || "—"],
      ["Dislikes / Triggers", aboutMe.dislikes || "—"],
      ["Mobility", aboutMe.mobility || "—"],
      ["Feeding Method", aboutMe.feedingMethod || "—"],
      ["Baseline Status", aboutMe.baselineStatus || "—"],
      ["Special Equipment", aboutMe.specialEquipment || "—"],
      ["Critical Notes", aboutMe.criticalNotes || "—"]
    ];

    return `
      <section class="chart-card">
        <div class="chart-card-head">
          <h3>About Me</h3>
          <div class="button-row">
            <button class="btn btn-ghost" type="button" id="inlineEditBtn">Edit</button>
          </div>
        </div>

        <div class="chart-card-body">
          <div class="kv-list">
            ${rows.map(renderKVRow).join("")}
          </div>
        </div>
      </section>
    `;
  }

  function renderBaselineSection() {
    const baseline = db.careBinder?.sections?.baseline || {};

    return `
      <section class="chart-card">
        <div class="chart-card-head">
          <h3>Baseline</h3>
          <div class="button-row">
            <button class="btn btn-ghost" type="button" id="inlineEditBtn">Edit</button>
          </div>
        </div>

        <div class="chart-card-body">
          <div class="kv-list">

            <div class="kv-row">
              <div class="kv-key"><strong>Presentation</strong></div>
              <div></div>
            </div>

            ${renderKVRow(["Communication", baseline.presentation?.communication || "—"])}
            ${renderKVRow(["Mobility", baseline.presentation?.mobility || "—"])}
            ${renderKVRow(["Alertness", baseline.presentation?.alertness || "—"])}
            ${renderKVRow(["Pain Signs", baseline.presentation?.painSigns || "—"])}
            ${renderKVRow(["Typical Behavior", baseline.presentation?.behavior || "—"])}
            ${renderKVRow(["Presentation Notes", baseline.presentation?.notes || "—"])}

            <div class="kv-row">
              <div class="kv-key"><strong>Vitals</strong></div>
              <div></div>
            </div>

            ${renderKVRow(["Temperature", formatRange(baseline.vitals?.temp?.min, baseline.vitals?.temp?.max)])}
            ${renderKVRow(["Oxygen Saturation", formatRange(baseline.vitals?.o2?.min, baseline.vitals?.o2?.max)])}
            ${renderKVRow(["Heart Rate", formatRange(baseline.vitals?.hr?.min, baseline.vitals?.hr?.max)])}
            ${renderKVRow(["Respiratory Rate", formatRange(baseline.vitals?.rr?.min, baseline.vitals?.rr?.max)])}
            ${renderKVRow(["BP Systolic", formatRange(baseline.vitals?.bpSys?.min, baseline.vitals?.bpSys?.max)])}
            ${renderKVRow(["BP Diastolic", formatRange(baseline.vitals?.bpDia?.min, baseline.vitals?.bpDia?.max)])}
            ${renderKVRow(["Vitals Notes", baseline.vitals?.notes || "—"])}

            <div class="kv-row">
              <div class="kv-key"><strong>Neurology</strong></div>
              <div></div>
            </div>

            ${renderKVRow(["Typical Seizure Type", baseline.neurology?.seizureType || "—"])}
            ${renderKVRow(["Typical Seizure Duration", baseline.neurology?.seizureDuration || "—"])}
            ${renderKVRow(["Postictal State", baseline.neurology?.postictal || "—"])}
            ${renderKVRow(["Known Triggers", baseline.neurology?.triggers || "—"])}
            ${renderKVRow(["Typical Recovery", baseline.neurology?.recovery || "—"])}
            ${renderKVRow(["Neurology Notes", baseline.neurology?.notes || "—"])}

          </div>
        </div>
      </section>
    `;
  }

  function renderKVRow([label, value]) {
    return `
      <div class="kv-row">
        <div class="kv-key">${escapeHtml(label)}</div>
        <div>${escapeHtml(value || "—")}</div>
      </div>
    `;
  }

  function openEdit(key) {
    editingSection = key;

    if (key === "aboutMe") {
      openAboutMeEditor();
      return;
    }

    if (key === "baseline") {
      openBaselineEditor();
      return;
    }

    editTitle.textContent = `Edit ${SECTION_CONFIG[key].label}`;
    ensureDefaultEditTextarea();
    const notesField = document.getElementById("editNotes");
    if (notesField) notesField.value = db.careBinder?.sections?.[key]?.notes || "";
    editModal.classList.add("open");
    notesField?.focus();
  }

  function openAboutMeEditor() {
    const child = getActiveChild();
    const aboutMe = db.careBinder?.sections?.aboutMe || {};

    editTitle.textContent = "Edit About Me";
    replaceEditBody(`
      <div id="aboutMeEditForm" class="form-grid" style="margin-top:12px;">
        <div class="field">
          <label for="amPreferredName">Preferred Name</label>
          <input id="amPreferredName" class="input" value="${escapeAttr(aboutMe.preferredName || child?.name || "")}">
        </div>

        <div class="field">
          <label for="amLegalName">Legal Name</label>
          <input id="amLegalName" class="input" value="${escapeAttr(aboutMe.legalName || "")}">
        </div>

        <div class="field">
          <label for="amDob">DOB</label>
          <input id="amDob" class="input" value="${escapeAttr(aboutMe.dob || child?.birthdate || "")}">
        </div>

        <div class="field">
          <label for="amAge">Age</label>
          <input id="amAge" class="input" value="${escapeAttr(aboutMe.age || (child?.age ? String(child.age) : ""))}">
        </div>

        <div class="field">
          <label for="amCommunication">Communication</label>
          <textarea id="amCommunication" class="input" rows="3">${escapeHtml(aboutMe.communication || "")}</textarea>
        </div>

        <div class="field">
          <label for="amLikes">Likes</label>
          <textarea id="amLikes" class="input" rows="3">${escapeHtml(aboutMe.likes || "")}</textarea>
        </div>

        <div class="field">
          <label for="amCalming">Things That Calm Me</label>
          <textarea id="amCalming" class="input" rows="3">${escapeHtml(aboutMe.calming || "")}</textarea>
        </div>

        <div class="field">
          <label for="amDislikes">Dislikes / Triggers</label>
          <textarea id="amDislikes" class="input" rows="3">${escapeHtml(aboutMe.dislikes || "")}</textarea>
        </div>

        <div class="field">
          <label for="amMobility">Mobility</label>
          <textarea id="amMobility" class="input" rows="3">${escapeHtml(aboutMe.mobility || "")}</textarea>
        </div>

        <div class="field">
          <label for="amFeedingMethod">Feeding Method</label>
          <textarea id="amFeedingMethod" class="input" rows="3">${escapeHtml(aboutMe.feedingMethod || "")}</textarea>
        </div>

        <div class="field">
          <label for="amBaselineStatus">Baseline Status</label>
          <textarea id="amBaselineStatus" class="input" rows="4">${escapeHtml(aboutMe.baselineStatus || "")}</textarea>
        </div>

        <div class="field">
          <label for="amSpecialEquipment">Special Equipment</label>
          <textarea id="amSpecialEquipment" class="input" rows="4">${escapeHtml(aboutMe.specialEquipment || "")}</textarea>
        </div>

        <div class="field full">
          <label for="amCriticalNotes">Critical Notes</label>
          <textarea id="amCriticalNotes" class="input" rows="5">${escapeHtml(aboutMe.criticalNotes || "")}</textarea>
        </div>
      </div>
    `);

    editModal.classList.add("open");
    document.getElementById("amPreferredName")?.focus();
  }

  function openBaselineEditor() {
    const baseline = db.careBinder?.sections?.baseline || {};

    editTitle.textContent = "Edit Baseline";
    replaceEditBody(`
      <div id="baselineEditForm" class="form-grid" style="margin-top:12px;">

        <div class="field full">
          <label><strong>Presentation</strong></label>
        </div>

        <div class="field">
          <label for="blCommunication">Communication</label>
          <textarea id="blCommunication" class="input" rows="3">${escapeHtml(baseline.presentation?.communication || "")}</textarea>
        </div>

        <div class="field">
          <label for="blMobility">Mobility</label>
          <textarea id="blMobility" class="input" rows="3">${escapeHtml(baseline.presentation?.mobility || "")}</textarea>
        </div>

        <div class="field">
          <label for="blAlertness">Alertness</label>
          <textarea id="blAlertness" class="input" rows="3">${escapeHtml(baseline.presentation?.alertness || "")}</textarea>
        </div>

        <div class="field">
          <label for="blPainSigns">Pain Signs</label>
          <textarea id="blPainSigns" class="input" rows="3">${escapeHtml(baseline.presentation?.painSigns || "")}</textarea>
        </div>

        <div class="field">
          <label for="blBehavior">Typical Behavior</label>
          <textarea id="blBehavior" class="input" rows="3">${escapeHtml(baseline.presentation?.behavior || "")}</textarea>
        </div>

        <div class="field">
          <label for="blPresentationNotes">Presentation Notes</label>
          <textarea id="blPresentationNotes" class="input" rows="3">${escapeHtml(baseline.presentation?.notes || "")}</textarea>
        </div>

        <div class="field full">
          <label><strong>Vitals</strong></label>
        </div>

        <div class="field">
          <label for="blTempMin">Temperature Min</label>
          <input id="blTempMin" class="input" value="${escapeAttr(baseline.vitals?.temp?.min || "")}">
        </div>

        <div class="field">
          <label for="blTempMax">Temperature Max</label>
          <input id="blTempMax" class="input" value="${escapeAttr(baseline.vitals?.temp?.max || "")}">
        </div>

        <div class="field">
          <label for="blO2Min">O₂ Min</label>
          <input id="blO2Min" class="input" value="${escapeAttr(baseline.vitals?.o2?.min || "")}">
        </div>

        <div class="field">
          <label for="blO2Max">O₂ Max</label>
          <input id="blO2Max" class="input" value="${escapeAttr(baseline.vitals?.o2?.max || "")}">
        </div>

        <div class="field">
          <label for="blHrMin">Heart Rate Min</label>
          <input id="blHrMin" class="input" value="${escapeAttr(baseline.vitals?.hr?.min || "")}">
        </div>

        <div class="field">
          <label for="blHrMax">Heart Rate Max</label>
          <input id="blHrMax" class="input" value="${escapeAttr(baseline.vitals?.hr?.max || "")}">
        </div>

        <div class="field">
          <label for="blRrMin">Respiratory Rate Min</label>
          <input id="blRrMin" class="input" value="${escapeAttr(baseline.vitals?.rr?.min || "")}">
        </div>

        <div class="field">
          <label for="blRrMax">Respiratory Rate Max</label>
          <input id="blRrMax" class="input" value="${escapeAttr(baseline.vitals?.rr?.max || "")}">
        </div>

        <div class="field">
          <label for="blBpSysMin">BP Systolic Min</label>
          <input id="blBpSysMin" class="input" value="${escapeAttr(baseline.vitals?.bpSys?.min || "")}">
        </div>

        <div class="field">
          <label for="blBpSysMax">BP Systolic Max</label>
          <input id="blBpSysMax" class="input" value="${escapeAttr(baseline.vitals?.bpSys?.max || "")}">
        </div>

        <div class="field">
          <label for="blBpDiaMin">BP Diastolic Min</label>
          <input id="blBpDiaMin" class="input" value="${escapeAttr(baseline.vitals?.bpDia?.min || "")}">
        </div>

        <div class="field">
          <label for="blBpDiaMax">BP Diastolic Max</label>
          <input id="blBpDiaMax" class="input" value="${escapeAttr(baseline.vitals?.bpDia?.max || "")}">
        </div>

        <div class="field full">
          <label for="blVitalsNotes">Vitals Notes</label>
          <textarea id="blVitalsNotes" class="input" rows="3">${escapeHtml(baseline.vitals?.notes || "")}</textarea>
        </div>

        <div class="field full">
          <label><strong>Neurology</strong></label>
        </div>

        <div class="field">
          <label for="blSeizureType">Typical Seizure Type</label>
          <textarea id="blSeizureType" class="input" rows="3">${escapeHtml(baseline.neurology?.seizureType || "")}</textarea>
        </div>

        <div class="field">
          <label for="blSeizureDuration">Typical Seizure Duration</label>
          <textarea id="blSeizureDuration" class="input" rows="3">${escapeHtml(baseline.neurology?.seizureDuration || "")}</textarea>
        </div>

        <div class="field">
          <label for="blPostictal">Postictal State</label>
          <textarea id="blPostictal" class="input" rows="3">${escapeHtml(baseline.neurology?.postictal || "")}</textarea>
        </div>

        <div class="field">
          <label for="blTriggers">Known Triggers</label>
          <textarea id="blTriggers" class="input" rows="3">${escapeHtml(baseline.neurology?.triggers || "")}</textarea>
        </div>

        <div class="field">
          <label for="blRecovery">Typical Recovery</label>
          <textarea id="blRecovery" class="input" rows="3">${escapeHtml(baseline.neurology?.recovery || "")}</textarea>
        </div>

        <div class="field">
          <label for="blNeurologyNotes">Neurology Notes</label>
          <textarea id="blNeurologyNotes" class="input" rows="3">${escapeHtml(baseline.neurology?.notes || "")}</textarea>
        </div>

      </div>
    `);

    editModal.classList.add("open");
    document.getElementById("blCommunication")?.focus();
  }

  function saveEdit() {
    if (!editingSection) return;

    if (editingSection === "aboutMe") {
      saveAboutMeEdit();
      return;
    }

    if (editingSection === "baseline") {
      saveBaselineEdit();
      return;
    }

    if (!db.careBinder) db.careBinder = {};
    if (!db.careBinder.sections) db.careBinder.sections = {};
    if (!db.careBinder.sections[editingSection]) db.careBinder.sections[editingSection] = {};

    ensureDefaultEditTextarea();
    const notesEl = document.getElementById("editNotes");
    db.careBinder.sections[editingSection].notes = notesEl?.value.trim() || "";
    saveDB(db);

    renderSection(editingSection);
    closeEdit();
  }

  function saveAboutMeEdit() {
    if (!db.careBinder) db.careBinder = {};
    if (!db.careBinder.sections) db.careBinder.sections = {};
    if (!db.careBinder.sections.aboutMe) db.careBinder.sections.aboutMe = {};

    const aboutMe = db.careBinder.sections.aboutMe;

    aboutMe.preferredName = getValue("amPreferredName");
    aboutMe.legalName = getValue("amLegalName");
    aboutMe.dob = getValue("amDob");
    aboutMe.age = getValue("amAge");
    aboutMe.communication = getValue("amCommunication");
    aboutMe.likes = getValue("amLikes");
    aboutMe.calming = getValue("amCalming");
    aboutMe.dislikes = getValue("amDislikes");
    aboutMe.mobility = getValue("amMobility");
    aboutMe.feedingMethod = getValue("amFeedingMethod");
    aboutMe.baselineStatus = getValue("amBaselineStatus");
    aboutMe.specialEquipment = getValue("amSpecialEquipment");
    aboutMe.criticalNotes = getValue("amCriticalNotes");

    saveDB(db);
    renderSidebarProfile();
    renderSection("aboutMe");
    closeEdit();
  }

  function saveBaselineEdit() {
    if (!db.careBinder) db.careBinder = {};
    if (!db.careBinder.sections) db.careBinder.sections = {};
    if (!db.careBinder.sections.baseline) db.careBinder.sections.baseline = {};

    const baseline = db.careBinder.sections.baseline;

    baseline.presentation = {
      communication: getValue("blCommunication"),
      mobility: getValue("blMobility"),
      alertness: getValue("blAlertness"),
      painSigns: getValue("blPainSigns"),
      behavior: getValue("blBehavior"),
      notes: getValue("blPresentationNotes")
    };

    baseline.vitals = {
      temp: {
        min: getValue("blTempMin"),
        max: getValue("blTempMax")
      },
      o2: {
        min: getValue("blO2Min"),
        max: getValue("blO2Max")
      },
      hr: {
        min: getValue("blHrMin"),
        max: getValue("blHrMax")
      },
      rr: {
        min: getValue("blRrMin"),
        max: getValue("blRrMax")
      },
      bpSys: {
        min: getValue("blBpSysMin"),
        max: getValue("blBpSysMax")
      },
      bpDia: {
        min: getValue("blBpDiaMin"),
        max: getValue("blBpDiaMax")
      },
      notes: getValue("blVitalsNotes")
    };

    baseline.neurology = {
      seizureType: getValue("blSeizureType"),
      seizureDuration: getValue("blSeizureDuration"),
      postictal: getValue("blPostictal"),
      triggers: getValue("blTriggers"),
      recovery: getValue("blRecovery"),
      notes: getValue("blNeurologyNotes")
    };

    saveDB(db);
    renderSection("baseline");
    closeEdit();
  }

  function closeEdit() {
    editModal?.classList.remove("open");
    restoreDefaultEditBody();
  }

  function ensureDefaultEditTextarea() {
    let notesField = document.getElementById("editNotes");
    if (!notesField) {
      replaceEditBody(`<textarea id="editNotes" class="input" rows="6"></textarea>`);
      notesField = document.getElementById("editNotes");
    }
    return notesField;
  }

  function replaceEditBody(html) {
    const aboutMeForm = document.getElementById("aboutMeEditForm");
    if (aboutMeForm) {
      aboutMeForm.outerHTML = html;
      return;
    }

    const baselineForm = document.getElementById("baselineEditForm");
    if (baselineForm) {
      baselineForm.outerHTML = html;
      return;
    }

    const notesField = document.getElementById("editNotes");
    if (notesField) {
      notesField.outerHTML = html;
    }
  }

  function restoreDefaultEditBody() {
    const aboutMeForm = document.getElementById("aboutMeEditForm");
    if (aboutMeForm) {
      aboutMeForm.outerHTML = `<textarea id="editNotes" class="input" rows="6"></textarea>`;
      return;
    }

    const baselineForm = document.getElementById("baselineEditForm");
    if (baselineForm) {
      baselineForm.outerHTML = `<textarea id="editNotes" class="input" rows="6"></textarea>`;
    }
  }

  function getValue(id) {
    return document.getElementById(id)?.value.trim() || "";
  }

  function formatRange(min, max) {
    if (min && max) return `${min} – ${max}`;
    if (min) return `Min ${min}`;
    if (max) return `Max ${max}`;
    return "—";
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