document.addEventListener("DOMContentLoaded", () => {
  let db = loadDB();
  const supabase = window.supabaseClient || null;

  const childSwitcher = document.getElementById("childSwitcher");
  const childAvatar = document.getElementById("childAvatar");
  const childSummary = document.getElementById("childSummary");
  const logoutBtn = document.getElementById("logoutBtn");

  const binderPhoto = document.getElementById("binderPhoto");
  const binderName = document.getElementById("binderName");
  const binderSub = document.getElementById("binderSub");
  const binderNav = document.getElementById("binderNav");
  const sectionTitle = document.getElementById("sectionTitle");
  const sectionDesc = document.getElementById("sectionDesc");
  const binderSectionContent = document.getElementById("binderSectionContent");
  const manageSectionsBtn = document.getElementById("manageSectionsBtn");
  const sectionsModal = document.getElementById("sectionsModal");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const cancelModalBtn = document.getElementById("cancelModalBtn");
  const saveSectionsBtn = document.getElementById("saveSectionsBtn");
  const restoreLayoutBtn = document.getElementById("restoreLayoutBtn");
  const sectionsToggleList = document.getElementById("sectionsToggleList");
  const conditionalOptionsList = document.getElementById("conditionalOptionsList");
  const conditionalOptionsWrap = document.getElementById("conditionalOptionsWrap");
  const editSectionBtn = document.getElementById("editSectionBtn");

  const SECTION_CONFIG = {
    overview: {
      label: "Overview",
      desc: "Quick snapshot of the child and baseline details.",
      defaultOn: true
    },
    medicalHistory: {
      label: "Medical History",
      desc: "Diagnoses, surgeries, hospitalizations, allergies, and birth history.",
      defaultOn: true
    },
    seizureProfile: {
      label: "Seizure Profile",
      desc: "Seizure information, rescue protocol, keto option, and VNS tracking.",
      defaultOn: false
    },
    medications: {
      label: "Medications",
      desc: "Active medication information and rescue medications.",
      defaultOn: true
    },
    feedingNutrition: {
      label: "Feeding & Nutrition",
      desc: "Feeding schedule, formula, tube details, and hydration notes.",
      defaultOn: true
    },
    carePlans: {
      label: "Care Plans",
      desc: "Daily plan, sick day plan, seizure plan, and more.",
      defaultOn: true
    },
    emergencyPlans: {
      label: "Emergency Plans",
      desc: "Medical and non-medical emergency planning and evacuation notes.",
      defaultOn: true
    },
    careTeam: {
      label: "Care Team",
      desc: "Doctors, therapists, pharmacy, DME, and emergency contacts.",
      defaultOn: true
    },
    nursingMedicaid: {
      label: "Nursing & Medicaid",
      desc: "Agency, waiver, nursing hours, and Medicaid information.",
      defaultOn: false
    },
    schoolInfo: {
      label: "School Info",
      desc: "School care details, accommodations, nurse contacts, and instructions.",
      defaultOn: true
    },
    schoolPaperwork: {
      label: "School Paperwork",
      desc: "IEP, 504, medication forms, physician orders, and school documents.",
      defaultOn: false
    },
    labs: {
      label: "Labs & Tests",
      desc: "Recent labs, test results, imaging, and follow-up notes.",
      defaultOn: false
    },
    goBag: {
      label: "Go Bag",
      desc: "Emergency checklists and go bag preparedness.",
      defaultOn: false
    },
    documents: {
      label: "Documents & Notes",
      desc: "Uploaded summaries, letters, visit notes, and general notes.",
      defaultOn: false
    }
  };

  let currentSectionKey = "overview";
  let draftEnabledSections = {};
  let draftSectionOptions = {};

  init();

  async function init() {
    db = loadDB();
    await syncChildrenFromSupabase();

    db = ensureDB(db);
    seedCareBinderIfMissing(db);
    saveDB(db);

    currentSectionKey = getInitialSectionKey();
    draftEnabledSections = JSON.parse(JSON.stringify(db.careBinder.enabledSections));
    draftSectionOptions = JSON.parse(JSON.stringify(db.careBinder.sectionOptions || {}));

    renderChildSwitcher();
    renderHeaderChildSummary();
    renderSidebarProfile();
    renderBinderNav();
    renderSection();
    renderSectionsModal();
    wireEvents();
  }

  function wireEvents() {
    childSwitcher?.addEventListener("change", () => {
      setActiveChildId(childSwitcher.value);
      renderChildSwitcher();
      renderHeaderChildSummary();
      renderSidebarProfile();
      renderBinderNav();

      if (!isSectionEnabled(currentSectionKey)) {
        currentSectionKey = getInitialSectionKey();
      }

      renderSection();
    });

    manageSectionsBtn?.addEventListener("click", () => {
      draftEnabledSections = JSON.parse(JSON.stringify(db.careBinder.enabledSections));
      draftSectionOptions = JSON.parse(JSON.stringify(db.careBinder.sectionOptions || {}));
      renderSectionsModal();
      sectionsModal.classList.add("open");
      sectionsModal.setAttribute("aria-hidden", "false");
    });

    closeModalBtn?.addEventListener("click", closeModal);
    cancelModalBtn?.addEventListener("click", closeModal);

    sectionsModal?.addEventListener("click", (e) => {
      if (e.target === sectionsModal) closeModal();
    });

    saveSectionsBtn?.addEventListener("click", () => {
      db.careBinder.enabledSections = JSON.parse(JSON.stringify(draftEnabledSections));
      db.careBinder.sectionOptions = JSON.parse(JSON.stringify(draftSectionOptions));
      saveDB(db);

      if (!isSectionEnabled(currentSectionKey)) {
        currentSectionKey = getInitialSectionKey();
      }

      renderBinderNav();
      renderSection();
      closeModal();
    });

    restoreLayoutBtn?.addEventListener("click", () => {
      db.careBinder.enabledSections = getRecommendedEnabledSections();
      db.careBinder.sectionOptions = getDefaultSectionOptions();
      draftEnabledSections = JSON.parse(JSON.stringify(db.careBinder.enabledSections));
      draftSectionOptions = JSON.parse(JSON.stringify(db.careBinder.sectionOptions));
      saveDB(db);
      renderSectionsModal();
      renderBinderNav();
      if (!isSectionEnabled(currentSectionKey)) {
        currentSectionKey = getInitialSectionKey();
      }
      renderSection();
    });

    editSectionBtn?.addEventListener("click", () => {
      alert(
        `Next step: open an edit form for "${SECTION_CONFIG[currentSectionKey]?.label || "this section"}".\n\nFor now this binder is fully viewable and section-managed.`
      );
    });

    logoutBtn?.addEventListener("click", async () => {
      if (window.supabaseClient?.auth) {
        try {
          await window.supabaseClient.auth.signOut();
        } catch (err) {
          console.warn("Supabase sign out failed:", err);
        }
      }
      window.location.href = "login.html";
    });
  }

  async function fetchCurrentUser() {
    if (!supabase?.auth) return null;

    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    if (error) {
      console.warn("Could not get user:", error.message);
      return null;
    }

    return user || null;
  }

  async function syncChildrenFromSupabase() {
    const user = await fetchCurrentUser();

    if (!user) return;

    const { data: children, error } = await supabase
      .from("children")
      .select("*")
      .eq("parent_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Could not load children:", error.message);
      return;
    }

    if (!children || !children.length) {
      db.children = [];
      db.activeChildId = null;
      db.currentChildId = null;
      return;
    }

    db.children = children.map((child) => ({
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
  }

  function closeModal() {
    sectionsModal.classList.remove("open");
    sectionsModal.setAttribute("aria-hidden", "true");
  }

  function getChildren() {
    return Array.isArray(db.children) ? db.children : [];
  }

  function getActiveChild() {
    const children = getChildren();
    if (!children.length) return null;

    const preferredId = db.activeChildId || db.currentChildId || null;
    if (preferredId) {
      const match = children.find((c) => String(c.id) === String(preferredId));
      if (match) return match;
    }

    return children[0] || null;
  }

  function setActiveChildId(id) {
    const child = getChildren().find((c) => String(c.id) === String(id));
    db.activeChildId = child ? child.id : null;
    db.currentChildId = db.activeChildId;
    saveDB(db);
  }

  function renderChildSwitcher() {
    const children = getChildren();
    childSwitcher.innerHTML = "";

    if (!children.length) {
      childSwitcher.innerHTML = `<option value="">No children yet</option>`;
      return;
    }

    childSwitcher.innerHTML = children
      .map((child) => {
        const selected = String(child.id) === String(getActiveChild()?.id) ? "selected" : "";
        return `<option value="${escapeHtml(child.id)}" ${selected}>${escapeHtml(child.name || "Child")}</option>`;
      })
      .join("");
  }

  function renderHeaderChildSummary() {
    const child = getActiveChild();

    if (!child) {
      if (childSummary) childSummary.textContent = "No child selected";
      if (childAvatar) childAvatar.innerHTML = "";
      return;
    }

    const diagnoses = normalizeDiagnoses(child.diagnoses);
    const childAge = child.age ?? getAgeFromBirthdate(child.birthdate);

    let summaryText =
      childAge !== null && childAge !== undefined && childAge !== ""
        ? `Age ${childAge}`
        : "Age —";

    if (diagnoses.length) {
      summaryText += ` • ${diagnoses.slice(0, 2).join(" • ")}`;
    }

    if (childSummary) childSummary.textContent = summaryText;

    if (childAvatar) {
      if (child.photo_url) {
        childAvatar.innerHTML = `<img src="${escapeHtml(child.photo_url)}" alt="${escapeHtml(child.name || "Child")}">`;
      } else {
        childAvatar.innerHTML = "";
      }
    }
  }

  function renderSidebarProfile() {
    const child = getActiveChild();

    if (!child) {
      binderPhoto.src = "";
      binderName.textContent = "No child selected";
      binderSub.textContent = "Add a child profile to continue";
      return;
    }

    binderPhoto.src = child.photo_url || child.photo || "https://via.placeholder.com/600x400?text=Child+Photo";
    binderPhoto.alt = child.name ? `${child.name} photo` : "Child photo";
    binderName.textContent = child.name || "Child";
    binderSub.textContent = getChildSummaryText(child);
  }

  function renderBinderNav() {
    const enabledKeys = getEnabledSectionKeys();
    binderNav.innerHTML = enabledKeys
      .map((key) => {
        const cfg = SECTION_CONFIG[key];
        const activeClass = key === currentSectionKey ? "active" : "";
        return `<a href="#" data-section="${key}" class="${activeClass}">${escapeHtml(cfg.label)}</a>`;
      })
      .join("");

    binderNav.querySelectorAll("a[data-section]").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        currentSectionKey = link.dataset.section;
        renderBinderNav();
        renderSection();
      });
    });
  }

  function renderSection() {
    const cfg = SECTION_CONFIG[currentSectionKey];
    sectionTitle.textContent = cfg?.label || "Care Binder";
    sectionDesc.textContent = cfg?.desc || "";

    switch (currentSectionKey) {
      case "overview":
        binderSectionContent.innerHTML = renderOverviewSection();
        break;
      case "medicalHistory":
        binderSectionContent.innerHTML = renderMedicalHistorySection();
        break;
      case "seizureProfile":
        binderSectionContent.innerHTML = renderSeizureProfileSection();
        break;
      case "medications":
        binderSectionContent.innerHTML = renderMedicationsSection();
        break;
      case "feedingNutrition":
        binderSectionContent.innerHTML = renderFeedingNutritionSection();
        break;
      case "carePlans":
        binderSectionContent.innerHTML = renderCarePlansSection();
        break;
      case "emergencyPlans":
        binderSectionContent.innerHTML = renderEmergencyPlansSection();
        break;
      case "careTeam":
        binderSectionContent.innerHTML = renderCareTeamSection();
        break;
      case "nursingMedicaid":
        binderSectionContent.innerHTML = renderNursingMedicaidSection();
        break;
      case "schoolInfo":
        binderSectionContent.innerHTML = renderSchoolInfoSection();
        break;
      case "schoolPaperwork":
        binderSectionContent.innerHTML = renderSchoolPaperworkSection();
        break;
      case "labs":
        binderSectionContent.innerHTML = renderLabsSection();
        break;
      case "goBag":
        binderSectionContent.innerHTML = renderGoBagSection();
        break;
      case "documents":
        binderSectionContent.innerHTML = renderDocumentsSection();
        break;
      default:
        binderSectionContent.innerHTML = `<section class="card"><p class="empty-state">Section not found.</p></section>`;
    }
  }

  function renderSectionsModal() {
    sectionsToggleList.innerHTML = Object.entries(SECTION_CONFIG)
      .map(([key, cfg]) => {
        const checked = draftEnabledSections[key] ? "checked" : "";
        return `
          <div class="toggle-item">
            <div class="toggle-left">
              <strong>${escapeHtml(cfg.label)}</strong>
              <small>${escapeHtml(cfg.desc)}</small>
            </div>
            <label class="switch">
              <input type="checkbox" data-section-toggle="${key}" ${checked}>
              <span class="slider"></span>
            </label>
          </div>
        `;
      })
      .join("");

    sectionsToggleList.querySelectorAll("[data-section-toggle]").forEach((input) => {
      input.addEventListener("change", () => {
        draftEnabledSections[input.dataset.sectionToggle] = input.checked;
        renderSectionsModal();
      });
    });

    const seizureEnabled = !!draftEnabledSections.seizureProfile;
    conditionalOptionsWrap.style.display = seizureEnabled ? "" : "none";

    conditionalOptionsList.innerHTML = seizureEnabled
      ? `
        <div class="toggle-item">
          <div class="toggle-left">
            <strong>Seizure Profile Options</strong>
            <small>Enable extra subsections for this child's seizure profile.</small>
            <div class="option-box">
              <label class="checkbox-row">
                <input type="checkbox" data-option="allowKetoDiet" ${
                  draftSectionOptions.seizureProfile?.allowKetoDiet ? "checked" : ""
                }>
                <span>Allow Keto Diet Option</span>
              </label>
              <label class="checkbox-row">
                <input type="checkbox" data-option="allowVNS" ${
                  draftSectionOptions.seizureProfile?.allowVNS ? "checked" : ""
                }>
                <span>Allow VNS Implant Tracking</span>
              </label>
            </div>
          </div>
        </div>
      `
      : "";

    conditionalOptionsList.querySelectorAll("[data-option]").forEach((input) => {
      input.addEventListener("change", () => {
        if (!draftSectionOptions.seizureProfile) {
          draftSectionOptions.seizureProfile = {};
        }
        draftSectionOptions.seizureProfile[input.dataset.option] = input.checked;
      });
    });
  }

  function renderOverviewSection() {
    const child = getActiveChild() || {};
    const overview = db.careBinder.sections.overview || {};

    return `
      ${renderKVCard("Basic Information", [
        ["Preferred Name", child.name || "—"],
        ["Legal Name", overview.legalName || child.name || "—"],
        ["DOB", overview.dob || child.dob || child.birthdate || "—"],
        ["Age", overview.age || child.age || "—"],
        ["Sex", overview.sex || "—"]
      ])}

      ${renderKVCard("Baseline Snapshot", [
        ["Diagnoses Summary", normalizeDiagnoses(child.diagnoses).join(", ") || "—"],
        ["Allergies", getAllergySummary() || child.allergies || "—"],
        ["Communication", overview.communication || "—"],
        ["Mobility", overview.mobility || "—"],
        ["Feeding Method", overview.feedingMethod || "—"],
        ["Preferred Hospital", overview.preferredHospital || "—"]
      ])}

      ${renderKVCard("Emergency Quick Facts", [
        ["Baseline Status", overview.baselineStatus || "—"],
        ["Special Equipment", overview.specialEquipment || "—"],
        ["Emergency Notes", overview.emergencyNotes || "—"]
      ])}
    `;
  }

  function renderMedicalHistorySection() {
    const s = db.careBinder.sections.medicalHistory || {};
    return `
      ${renderEntryCard("Diagnoses", s.diagnoses)}
      ${renderEntryCard("Past Surgeries & Procedures", s.surgeries)}
      ${renderEntryCard("Hospitalizations", s.hospitalizations)}
      ${renderEntryCard("Allergies & Reactions", s.allergies)}
      ${renderEntryCard("Birth & NICU History", s.birthHistory)}
    `;
  }

  function renderSeizureProfileSection() {
    const s = db.careBinder.sections.seizureProfile || {};
    const options = db.careBinder.sectionOptions?.seizureProfile || {};

    let html = `
      ${renderKVCard("Seizure Overview", [
        ["Seizure Types", s.overview?.types || "—"],
        ["Baseline Frequency", s.overview?.frequency || "—"],
        ["Typical Duration", s.overview?.duration || "—"],
        ["Triggers", s.overview?.triggers || "—"],
        ["Warning Signs", s.overview?.warningSigns || "—"],
        ["Postictal Pattern", s.overview?.postictal || "—"]
      ])}

      ${renderKVCard("Rescue Protocol", [
        ["Rescue Medication", s.rescue?.medication || "—"],
        ["Dose", s.rescue?.dose || "—"],
        ["When to Give", s.rescue?.whenToGive || "—"],
        ["Repeat Instructions", s.rescue?.repeat || "—"],
        ["Call EMS If", s.rescue?.callEms || "—"]
      ])}
    `;

    if (options.allowKetoDiet) {
      html += renderKVCard("Keto Diet", [
        ["On Keto Diet", s.keto?.enabled ? "Yes" : "No"],
        ["Diet Type", s.keto?.type || "—"],
        ["Ratio", s.keto?.ratio || "—"],
        ["Managed By", s.keto?.managedBy || "—"],
        ["Emergency Notes", s.keto?.notes || "—"]
      ]);
    }

    if (options.allowVNS) {
      html += renderKVCard("VNS Implant", [
        ["Has VNS", s.vns?.enabled ? "Yes" : "No"],
        ["Implant Date", s.vns?.implantDate || "—"],
        ["Model", s.vns?.model || "—"],
        ["Magnet Instructions", s.vns?.magnetInstructions || "—"],
        ["Managing Provider", s.vns?.provider || "—"],
        ["Battery / Replacement Notes", s.vns?.batteryNotes || "—"]
      ]);
    }

    return html;
  }

  function renderMedicationsSection() {
    const s = db.careBinder.sections.medications || {};
    return `
      ${renderEntryCard("Daily Medications", s.daily)}
      ${renderEntryCard("PRN Medications", s.prn)}
      ${renderEntryCard("Rescue Medications", s.rescue)}
      ${renderEntryCard("Medication Change History", s.history)}
    `;
  }

  function renderFeedingNutritionSection() {
    const s = db.careBinder.sections.feedingNutrition || {};
    return `
      ${renderKVCard("Feeding Routine", [
        ["Feeding Method", s.routine?.method || "—"],
        ["Formula / Diet", s.routine?.formula || "—"],
        ["Schedule", s.routine?.schedule || "—"],
        ["Volume / Rate", s.routine?.volumeRate || "—"],
        ["Flush Schedule", s.routine?.flushes || "—"],
        ["Positioning", s.routine?.positioning || "—"]
      ])}

      ${renderKVCard("Tube Details", [
        ["Tube Type", s.tube?.type || "—"],
        ["Tube Size", s.tube?.size || "—"],
        ["Change Schedule", s.tube?.changeSchedule || "—"],
        ["Troubleshooting Notes", s.tube?.notes || "—"]
      ])}

      ${renderKVCard("Hydration & Precautions", [
        ["Hydration Goal", s.hydration?.goal || "—"],
        ["Aspiration Precautions", s.hydration?.aspiration || "—"],
        ["Emergency Feeding Notes", s.hydration?.emergencyNotes || "—"]
      ])}
    `;
  }

  function renderCarePlansSection() {
    const s = db.careBinder.sections.carePlans || {};
    return `
      ${renderPlanCard("Daily Care Plan", s.daily)}
      ${renderPlanCard("Sick Day Plan", s.sickDay)}
      ${renderPlanCard("Seizure Care Plan", s.seizure)}
      ${renderPlanCard("Respiratory Care Plan", s.respiratory)}
      ${renderPlanCard("School Care Plan", s.school)}
    `;
  }

  function renderEmergencyPlansSection() {
    const s = db.careBinder.sections.emergencyPlans || {};
    return `
      ${renderPlanCard("Medical Emergency Plan", s.medical)}
      ${renderPlanCard("Fire Emergency Plan", s.fire)}
      ${renderPlanCard("Tornado / Severe Weather Plan", s.tornado)}
      ${renderPlanCard("Power Outage Plan", s.powerOutage)}
      ${renderPlanCard("Emergency Evacuation Plan", s.evacuation)}
    `;
  }

  function renderCareTeamSection() {
    const s = db.careBinder.sections.careTeam || {};
    return `
      ${renderEntryCard("Doctors & Specialists", s.providers)}
      ${renderEntryCard("Therapists", s.therapists)}
      ${renderEntryCard("Pharmacy / DME / Agency", s.support)}
      ${renderEntryCard("Emergency Contacts", s.emergencyContacts)}
    `;
  }

  function renderNursingMedicaidSection() {
    const s = db.careBinder.sections.nursingMedicaid || {};
    return `
      ${renderKVCard("Nursing Agency", [
        ["Agency Name", s.nursing?.agencyName || "—"],
        ["Contact", s.nursing?.contact || "—"],
        ["Phone", s.nursing?.phone || "—"],
        ["Approved Hours", s.nursing?.hours || "—"],
        ["Notes", s.nursing?.notes || "—"]
      ])}

      ${renderKVCard("Waiver Information", [
        ["Waiver Type", s.waiver?.type || "—"],
        ["Caseworker", s.waiver?.caseworker || "—"],
        ["Renewal Date", s.waiver?.renewal || "—"],
        ["Service Notes", s.waiver?.notes || "—"]
      ])}

      ${renderKVCard("Medicaid Information", [
        ["Plan Name", s.medicaid?.plan || "—"],
        ["Member ID", s.medicaid?.memberId || "—"],
        ["Renewal Date", s.medicaid?.renewal || "—"],
        ["Contact Number", s.medicaid?.phone || "—"]
      ])}
    `;
  }

  function renderSchoolInfoSection() {
    const s = db.careBinder.sections.schoolInfo || {};
    return `
      ${renderKVCard("School Details", [
        ["School Name", s.school?.name || "—"],
        ["District", s.school?.district || "—"],
        ["Teacher", s.school?.teacher || "—"],
        ["School Nurse", s.school?.nurse || "—"],
        ["Transportation", s.school?.transport || "—"]
      ])}

      ${renderKVCard("School Care Notes", [
        ["Accommodations", s.care?.accommodations || "—"],
        ["Medication at School", s.care?.meds || "—"],
        ["Feeding at School", s.care?.feeding || "—"],
        ["Emergency Instructions", s.care?.emergency || "—"]
      ])}
    `;
  }

  function renderSchoolPaperworkSection() {
    const s = db.careBinder.sections.schoolPaperwork || {};
    return `${renderEntryCard("School Documents", s.docs)}`;
  }

  function renderLabsSection() {
    const s = db.careBinder.sections.labs || {};
    return `${renderEntryCard("Labs & Test Results", s.results)}`;
  }

  function renderGoBagSection() {
    const s = db.careBinder.sections.goBag || {};
    return `
      ${renderChecklistCard("Hospital Go Bag Checklist", s.hospital)}
      ${renderChecklistCard("Evacuation Checklist", s.evacuation)}
      ${renderChecklistCard("Daily Outing Checklist", s.daily)}
    `;
  }

  function renderDocumentsSection() {
    const s = db.careBinder.sections.documents || {};
    return `
      ${renderEntryCard("Documents", s.docs)}
      ${renderEntryCard("Notes & Updates", s.notes)}
    `;
  }

  function renderKVCard(title, rows) {
    return `
      <section class="card subcard">
        <div class="subcard-head">
          <h3>${escapeHtml(title)}</h3>
          <div class="subcard-actions">
            <button class="btn btn-ghost" type="button">Edit</button>
          </div>
        </div>
        <div class="subcard-body">
          <div class="kv-list">
            ${rows
              .map(
                ([key, value]) => `
                  <div class="kv-row">
                    <div class="kv-key">${escapeHtml(key)}</div>
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

  function renderEntryCard(title, items) {
    return `
      <section class="card subcard">
        <div class="subcard-head">
          <h3>${escapeHtml(title)}</h3>
          <div class="subcard-actions">
            <button class="btn btn-ghost" type="button">Edit</button>
            <button class="btn btn-ghost" type="button">Add</button>
          </div>
        </div>
        <div class="subcard-body">
          ${
            Array.isArray(items) && items.length
              ? `<div class="entry-list">
                  ${items
                    .map(
                      (item) => `
                        <div class="entry-item">
                          <strong>${escapeHtml(item.title || "Entry")}</strong>
                          <div>${escapeHtml(item.summary || "—")}</div>
                        </div>
                      `
                    )
                    .join("")}
                </div>`
              : `<div class="empty-state">No entries added yet.</div>`
          }
        </div>
      </section>
    `;
  }

  function renderPlanCard(title, plan) {
    const p = plan || {};
    return `
      <section class="card subcard">
        <div class="subcard-head">
          <h3>${escapeHtml(title)}</h3>
          <div class="subcard-actions">
            <button class="btn btn-ghost" type="button">Edit</button>
          </div>
        </div>
        <div class="subcard-body">
          <div class="kv-list">
            <div class="kv-row">
              <div class="kv-key">Baseline</div>
              <div>${escapeHtml(p.baseline || "—")}</div>
            </div>
            <div class="kv-row">
              <div class="kv-key">Warning Signs</div>
              <div>${escapeHtml(p.warningSigns || "—")}</div>
            </div>
            <div class="kv-row">
              <div class="kv-key">Actions</div>
              <div>${escapeHtml(p.actions || "—")}</div>
            </div>
            <div class="kv-row">
              <div class="kv-key">Call Provider</div>
              <div>${escapeHtml(p.callProvider || "—")}</div>
            </div>
            <div class="kv-row">
              <div class="kv-key">Call 911</div>
              <div>${escapeHtml(p.call911 || "—")}</div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function renderChecklistCard(title, items) {
    return `
      <section class="card subcard">
        <div class="subcard-head">
          <h3>${escapeHtml(title)}</h3>
          <div class="subcard-actions">
            <button class="btn btn-ghost" type="button">Edit</button>
          </div>
        </div>
        <div class="subcard-body">
          ${
            Array.isArray(items) && items.length
              ? `<div class="entry-list">
                  ${items
                    .map(
                      (item) => `
                        <label class="entry-item checkbox-row">
                          <input type="checkbox" ${item.done ? "checked" : ""} disabled>
                          <span>${escapeHtml(item.label || "Checklist item")}</span>
                        </label>
                      `
                    )
                    .join("")}
                </div>`
              : `<div class="empty-state">No checklist items added yet.</div>`
          }
        </div>
      </section>
    `;
  }

  function getInitialSectionKey() {
    const enabled = getEnabledSectionKeys();
    return enabled[0] || "overview";
  }

  function getEnabledSectionKeys() {
    return Object.keys(SECTION_CONFIG).filter((key) => isSectionEnabled(key));
  }

  function isSectionEnabled(key) {
    return !!db.careBinder.enabledSections[key];
  }

  function getChildSummaryText(child) {
    const age = child?.age ? `Age ${child.age}` : "Age —";
    const dx = Array.isArray(child?.diagnoses) && child.diagnoses.length
      ? child.diagnoses.join(" • ")
      : "No diagnoses listed";
    return `${age} • ${dx}`;
  }

  function getAllergySummary() {
    const allergies = db.careBinder.sections.medicalHistory?.allergies || [];
    return allergies.map((a) => a.title).join(", ");
  }

  function getRecommendedEnabledSections() {
    return {
      overview: true,
      medicalHistory: true,
      seizureProfile: false,
      medications: true,
      feedingNutrition: true,
      carePlans: true,
      emergencyPlans: true,
      careTeam: true,
      nursingMedicaid: false,
      schoolInfo: true,
      schoolPaperwork: false,
      labs: false,
      goBag: false,
      documents: false
    };
  }

  function getDefaultSectionOptions() {
    return {
      seizureProfile: {
        allowKetoDiet: false,
        allowVNS: false
      }
    };
  }

  function seedCareBinderIfMissing(dbRef) {
    if (!dbRef.careBinder) dbRef.careBinder = {};

    if (!dbRef.careBinder.enabledSections) {
      dbRef.careBinder.enabledSections = getRecommendedEnabledSections();
    }

    if (!dbRef.careBinder.sectionOptions) {
      dbRef.careBinder.sectionOptions = getDefaultSectionOptions();
    }

    if (!dbRef.careBinder.sections) {
      dbRef.careBinder.sections = {
        overview: {
          legalName: "Lily Johnson",
          dob: "May 10, 2015",
          age: "8",
          sex: "Female",
          communication: "Nonverbal, uses cues and facial expressions",
          mobility: "Non-ambulatory",
          feedingMethod: "G-tube",
          preferredHospital: "Children's Hospital ER",
          baselineStatus: "Nonverbal, non-ambulatory, G-tube fed",
          specialEquipment: "Wheelchair, G-tube, pulse ox",
          emergencyNotes: "Parent prefers EMS transport to Children's Hospital ER"
        },
        medicalHistory: {
          diagnoses: [
            { title: "Epilepsy", summary: "Diagnosed 2017" },
            { title: "Cerebral Palsy", summary: "Spastic quadriplegia" },
            { title: "GERD", summary: "Ongoing GI management" }
          ],
          surgeries: [
            { title: "G-Tube Placement", summary: "2016 • Children's Hospital" },
            { title: "Hip Surgery", summary: "2018 • Orthopedic correction" }
          ],
          hospitalizations: [
            { title: "Respiratory Distress", summary: "03/2021 • 3 day stay" },
            { title: "Seizure Cluster", summary: "11/2019 • 2 day stay" }
          ],
          allergies: [
            { title: "Penicillin", summary: "Rash" },
            { title: "Peanuts", summary: "Hives" },
            { title: "Latex", summary: "Swelling" }
          ],
          birthHistory: [
            { title: "Premature Birth", summary: "32 weeks gestation" },
            { title: "NICU Stay", summary: "21 days in NICU" }
          ]
        },
        seizureProfile: {
          overview: {
            types: "Tonic-clonic, focal",
            frequency: "Varies, more likely with illness",
            duration: "Usually under 3 minutes",
            triggers: "Illness, missed sleep",
            warningSigns: "Staring, decreased responsiveness",
            postictal: "Very sleepy after longer events"
          },
          rescue: {
            medication: "Diazepam",
            dose: "10 mg",
            whenToGive: "If seizure lasts over 5 minutes",
            repeat: "Do not repeat unless directed",
            callEms: "Breathing changes, prolonged seizure, no recovery"
          },
          keto: {
            enabled: false,
            type: "",
            ratio: "",
            managedBy: "",
            notes: ""
          },
          vns: {
            enabled: false,
            implantDate: "",
            model: "",
            magnetInstructions: "",
            provider: "",
            batteryNotes: ""
          }
        },
        medications: {
          daily: [
            { title: "Baclofen", summary: "2.5 mg oral • 3x daily" },
            { title: "Omeprazole", summary: "10 mg oral • daily" }
          ],
          prn: [
            { title: "Acetaminophen", summary: "PRN for pain or fever" }
          ],
          rescue: [
            { title: "Diazepam", summary: "10 mg via G-tube for seizure rescue" }
          ],
          history: [
            { title: "Keppra", summary: "Discontinued 2023 due to side effects" }
          ]
        },
        feedingNutrition: {
          routine: {
            method: "G-tube",
            formula: "Pediatric formula",
            schedule: "8 AM, 12 PM, 4 PM, 8 PM",
            volumeRate: "250 mL over 45 minutes",
            flushes: "30 mL before and after feeds",
            positioning: "Keep elevated during and after feeds"
          },
          tube: {
            type: "Mic-Key Button",
            size: "14 FR",
            changeSchedule: "Routine changes per GI",
            notes: "Keep backup tube in go bag"
          },
          hydration: {
            goal: "Scheduled flushes plus extra during illness",
            aspiration: "Monitor for cough, gagging, vomiting",
            emergencyNotes: "If tube dislodges, call GI/ER per care plan"
          }
        },
        carePlans: {
          daily: {
            baseline: "Usual daily care at home and school",
            warningSigns: "Unusual fussiness, pain, lethargy",
            actions: "Continue scheduled meds/feeds and monitor closely",
            callProvider: "If symptoms continue or worsen",
            call911: "For major distress or unresponsiveness"
          },
          sickDay: {
            baseline: "Typically tolerates mild illness with extra rest",
            warningSigns: "Vomiting, fever, decreased tolerance of feeds",
            actions: "Decrease rate if needed, increase monitoring, follow hydration plan",
            callProvider: "Persistent vomiting, fever not improving, reduced output",
            call911: "Breathing issues, severe dehydration, difficult to arouse"
          },
          seizure: {
            baseline: "Brief seizures possible with good recovery",
            warningSigns: "Cluster activity, long seizure, color change",
            actions: "Time seizure, protect airway, administer rescue med if criteria met",
            callProvider: "Increased seizure frequency",
            call911: "Seizure longer than 5 minutes or no recovery"
          },
          respiratory: {
            baseline: "May need suction support with illness",
            warningSigns: "Retractions, wheezing, low oxygen saturation",
            actions: "Position upright, suction as needed, follow respiratory care plan",
            callProvider: "Persistent increased work of breathing",
            call911: "Severe breathing difficulty or cyanosis"
          },
          school: {
            baseline: "Needs accommodations and feeding/med support",
            warningSigns: "Behavior change, color change, reduced responsiveness",
            actions: "Notify nurse/parent and follow school plan",
            callProvider: "Per parent/provider guidance",
            call911: "Per emergency instructions or major event"
          }
        },
        emergencyPlans: {
          medical: {
            baseline: "Complex child with seizure and feeding needs",
            warningSigns: "Prolonged seizure, difficulty breathing, severe lethargy",
            actions: "Follow child-specific protocol and emergency sheet",
            callProvider: "After urgent event if stable",
            call911: "Immediately for life-threatening symptoms"
          },
          fire: {
            baseline: "Requires assisted evacuation",
            warningSigns: "Smoke, active fire, unsafe environment",
            actions: "Grab child, go bag, meds, emergency binder if possible",
            callProvider: "Not applicable",
            call911: "Immediately if fire emergency"
          },
          tornado: {
            baseline: "Requires sheltered evacuation with supplies",
            warningSigns: "Weather alert / warning",
            actions: "Move to safe interior area with essentials and equipment",
            callProvider: "Not applicable",
            call911: "If injury or rescue is needed"
          },
          powerOutage: {
            baseline: "Some equipment/feeds affected by outage",
            warningSigns: "Power loss or generator failure",
            actions: "Use backup supplies, battery devices, follow outage plan",
            callProvider: "If outage affects safe care delivery",
            call911: "If power loss causes medical emergency"
          },
          evacuation: {
            baseline: "Emergency evacuation plan required by nursing agency",
            warningSigns: "Home unsafe, disaster, mandatory evacuation",
            actions: "Take meds, go bag, formula, equipment, emergency documents",
            callProvider: "Notify after safe relocation",
            call911: "If emergency transport needed"
          }
        },
        careTeam: {
          providers: [
            { title: "Pediatrician", summary: "Dr. Lopez • 555-111-2222" },
            { title: "Neurology", summary: "Dr. Shah • 555-222-3333" },
            { title: "GI", summary: "Children's GI Team • 555-333-4444" }
          ],
          therapists: [
            { title: "PT", summary: "Weekly outpatient PT" },
            { title: "OT", summary: "Weekly outpatient OT" }
          ],
          support: [
            { title: "Pharmacy", summary: "Main Street Pharmacy • 555-444-5555" },
            { title: "DME", summary: "Bright Medical Supply • 555-666-7777" },
            { title: "Nursing Agency", summary: "Hope Nursing • 555-888-9999" }
          ],
          emergencyContacts: [
            { title: "Amanda Johnson (Mom)", summary: "555-123-4567" },
            { title: "David Johnson (Dad)", summary: "555-987-6543" }
          ]
        },
        nursingMedicaid: {
          nursing: {
            agencyName: "Hope Nursing",
            contact: "Staffing Coordinator",
            phone: "555-888-9999",
            hours: "40 approved hours/week",
            notes: "Agency requires evacuation plan on file"
          },
          waiver: {
            type: "Katie Beckett / Waiver Example",
            caseworker: "Sarah M.",
            renewal: "July 2026",
            notes: "Update yearly paperwork"
          },
          medicaid: {
            plan: "State Medicaid Plan",
            memberId: "123456789",
            renewal: "August 2026",
            phone: "1-800-000-0000"
          }
        },
        schoolInfo: {
          school: {
            name: "Bright Horizons Elementary",
            district: "Example District",
            teacher: "Mrs. Taylor",
            nurse: "Nurse Green",
            transport: "Special bus with aide"
          },
          care: {
            accommodations: "1:1 nursing support, feeding support, mobility help",
            meds: "Rescue med at school per orders",
            feeding: "Midday tube feed at school",
            emergency: "Follow seizure action plan and notify parent"
          }
        },
        schoolPaperwork: {
          docs: [
            { title: "IEP", summary: "Current school year" },
            { title: "Medication Authorization", summary: "Signed and on file" },
            { title: "Seizure Action Plan", summary: "Submitted to school nurse" }
          ]
        },
        labs: {
          results: [
            { title: "CBC", summary: "01/2026 • Stable per provider" },
            { title: "CMP", summary: "01/2026 • Mild abnormalities noted" }
          ]
        },
        goBag: {
          hospital: [
            { label: "Rescue medication", done: true },
            { label: "Formula / feeding supplies", done: true },
            { label: "Chargers", done: false },
            { label: "Spare clothes", done: true }
          ],
          evacuation: [
            { label: "Emergency binder printout", done: true },
            { label: "Medication list", done: true },
            { label: "Backup tube supplies", done: false }
          ],
          daily: [
            { label: "Diapers / wipes", done: true },
            { label: "Suction supplies", done: true },
            { label: "Snacks / water", done: false }
          ]
        },
        documents: {
          docs: [
            { title: "Recent Neurology Visit Summary", summary: "Uploaded PDF" },
            { title: "Hospital Discharge Note", summary: "December 2025" }
          ],
          notes: [
            { title: "Parent Note", summary: "Watch increased seizures during illness" },
            { title: "Reminder", summary: "Renew school med forms before August" }
          ]
        }
      };
    }
  }

  function getRecommendedEnabledSections() {
    return {
      overview: true,
      medicalHistory: true,
      seizureProfile: false,
      medications: true,
      feedingNutrition: true,
      carePlans: true,
      emergencyPlans: true,
      careTeam: true,
      nursingMedicaid: false,
      schoolInfo: true,
      schoolPaperwork: false,
      labs: false,
      goBag: false,
      documents: false
    };
  }

  function getDefaultSectionOptions() {
    return {
      seizureProfile: {
        allowKetoDiet: false,
        allowVNS: false
      }
    };
  }

  function getInitialSectionKey() {
    const enabled = getEnabledSectionKeys();
    return enabled[0] || "overview";
  }

  function getEnabledSectionKeys() {
    return Object.keys(SECTION_CONFIG).filter((key) => isSectionEnabled(key));
  }

  function isSectionEnabled(key) {
    return !!db.careBinder.enabledSections[key];
  }

  function getChildSummaryText(child) {
    const age = child?.age ? `Age ${child.age}` : "Age —";
    const dx = Array.isArray(child?.diagnoses) && child.diagnoses.length
      ? child.diagnoses.join(" • ")
      : "No diagnoses listed";
    return `${age} • ${dx}`;
  }

  function getAllergySummary() {
    const allergies = db.careBinder.sections.medicalHistory?.allergies || [];
    return allergies.map((a) => a.title).join(", ");
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
});
