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
  const editNotes = document.getElementById("editNotes");
  const saveEditBtn = document.getElementById("saveEditBtn");
  const cancelEditBtn = document.getElementById("cancelEditBtn");

  let editingSection = null;
  let currentGroup = "overview";
  let currentSectionKey = "aboutMe";

  const GROUPS = {
    overview: {
      label: "Overview",
      sections: ["aboutMe"]
    },
    medical: {
      label: "Medical",
      sections: ["medicalHistory", "medications", "labs"]
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
      desc: "Diagnoses, surgeries, hospitalizations, allergies, and birth history."
    },
    seizureProfile: {
      label: "Seizure Profile",
      desc: "Seizure information, rescue protocol, keto option, and VNS tracking."
    },
    medications: {
      label: "Medications",
      desc: "Active medication information and rescue medications."
    },
    feedingNutrition: {
      label: "Feeding & Nutrition",
      desc: "Feeding schedule, formula, tube details, and hydration notes."
    },
    carePlans: {
      label: "Care Plans",
      desc: "Daily plan, sick day plan, seizure plan, and more."
    },
    emergencyPlans: {
      label: "Emergency Plans",
      desc: "Medical and non-medical emergency planning and evacuation notes."
    },
    careTeam: {
      label: "Care Team",
      desc: "Doctors, therapists, pharmacy, DME, and emergency contacts."
    },
    nursingMedicaid: {
      label: "Nursing & Medicaid",
      desc: "Agency, waiver, nursing hours, and Medicaid information."
    },
    schoolInfo: {
      label: "School Info",
      desc: "School care details, accommodations, nurse contacts, and instructions."
    },
    schoolPaperwork: {
      label: "School Paperwork",
      desc: "IEP, 504, medication forms, physician orders, and school documents."
    },
    labs: {
      label: "Labs & Tests",
      desc: "Recent labs, test results, imaging, and follow-up notes."
    },
    goBag: {
      label: "Go Bag",
      desc: "Emergency checklists and go bag preparedness."
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
      alert("We can build the section manager next. For now, About Me is fully editable.");
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

    Object.keys(SECTION_CONFIG).forEach((key) => {
      if (key === "aboutMe") return;
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
      childSummary.textContent = "No child selected";
      childAvatar.innerHTML = "";
      return;
    }

    const ageText = child.age ? `Age ${child.age}` : "Age —";
    const dx =
      Array.isArray(child.diagnoses) && child.diagnoses.length
        ? child.diagnoses.slice(0, 2).join(" • ")
        : "No diagnoses listed";

    childSummary.textContent = `${ageText} • ${dx}`;

    childAvatar.innerHTML = child.photo_url
      ? `<img src="${escapeAttr(child.photo_url)}" alt="${escapeAttr(child.name || "Child")}">`
      : "";
  }

  function renderSidebarProfile() {
    const child = getActiveChild();
    const aboutMe = db.careBinder?.sections?.aboutMe || {};

    if (!child) {
      binderPhoto.removeAttribute("src");
      binderName.textContent = "No child selected";
      binderSub.textContent = "Add a child profile to continue";
      return;
    }

    binderPhoto.src = child.photo_url || "https://via.placeholder.com/600x400?text=Child+Photo";
    binderPhoto.alt = child.name ? `${child.name} photo` : "Child photo";
    binderName.textContent = aboutMe.preferredName || child.name || "Child";

    const ageText = aboutMe.age || child.age ? `Age ${aboutMe.age || child.age}` : "Age —";
    const dx =
      Array.isArray(child.diagnoses) && child.diagnoses.length
        ? child.diagnoses.join(" • ")
        : "No diagnoses listed";

    binderSub.textContent = `${ageText} • ${dx}`;
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
    sectionTitle.textContent = cfg.label;
    sectionDesc.textContent = cfg.desc;

    if (key === "aboutMe") {
      binderSectionContent.innerHTML = renderAboutMeSection();
      document.getElementById("inlineEditBtn")?.addEventListener("click", () => {
        openEdit("aboutMe");
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

    editSectionBtn.onclick = () => openEdit(key);
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
      ["Calming", aboutMe.calming || "—"],
      ["Dislikes", aboutMe.dislikes || "—"],
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
            ${rows
              .map(
                ([label, value]) => `
                  <div class="kv-row">
                    <div class="kv-key">${escapeHtml(label)}</div>
                    <div>${escapeHtml(value || "—")}</div>
                  </div>
                `
              )
              .join("")}
          </div>
        </div>
      </section>
    `;
  }

  function openEdit(key) {
    editingSection = key;

    if (key === "aboutMe") {
      openAboutMeEditor();
      return;
    }

    editTitle.textContent = `Edit ${SECTION_CONFIG[key].label}`;
    const notesField = document.getElementById("editNotes");
    if (notesField) notesField.value = db.careBinder?.sections?.[key]?.notes || "";
    editModal.classList.add("open");
    notesField?.focus();
  }

  function openAboutMeEditor() {
    const child = getActiveChild();
    const aboutMe = db.careBinder?.sections?.aboutMe || {};

    editTitle.textContent = "Edit About Me";

    const currentNotesField = document.getElementById("editNotes");
    if (currentNotesField) {
      currentNotesField.outerHTML = `
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

          <div class="field" style="grid-column:1 / -1;">
            <label for="amCriticalNotes">Critical Notes</label>
            <textarea id="amCriticalNotes" class="input" rows="5">${escapeHtml(aboutMe.criticalNotes || "")}</textarea>
          </div>
        </div>
      `;
    }

    editModal.classList.add("open");
    document.getElementById("amPreferredName")?.focus();
  }

  function closeEdit() {
    editModal.classList.remove("open");
    restoreDefaultEditBody();
  }

  function restoreDefaultEditBody() {
    const aboutMeForm = document.getElementById("aboutMeEditForm");
    if (aboutMeForm) {
      aboutMeForm.outerHTML = `<textarea id="editNotes" class="input" rows="6"></textarea>`;
    }
  }

  function saveEdit() {
    if (!editingSection) return;

    if (editingSection === "aboutMe") {
      saveAboutMeEdit();
      return;
    }

    if (!db.careBinder) db.careBinder = {};
    if (!db.careBinder.sections) db.careBinder.sections = {};
    if (!db.careBinder.sections[editingSection]) db.careBinder.sections[editingSection] = {};

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

  function getValue(id) {
    return document.getElementById(id)?.value.trim() || "";
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