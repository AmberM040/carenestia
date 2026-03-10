document.addEventListener("DOMContentLoaded", async () => {
  let db = ensureDB(loadDB());
  saveDB(db);

  const supabase = window.supabaseClient || null;

  const childSwitcher = document.getElementById("childSwitcher");
  const childAvatar = document.getElementById("childAvatar");
  const childSummary = document.getElementById("childSummary");

  const emergencySub = document.getElementById("emergencySub");
  const childDetailsCard = document.getElementById("childDetailsCard");
  const protocolCard = document.getElementById("protocolCard");
  const medicationsCard = document.getElementById("medicationsCard");
  const iceCard = document.getElementById("iceCard");
  const criticalCard = document.getElementById("criticalCard");
  const equipmentCard = document.getElementById("equipmentCard");
  const lastUpdatedText = document.getElementById("lastUpdatedText");

  const printBtn = document.getElementById("printBtn");
  const shareBtn = document.getElementById("shareBtn");

  await init();

  async function init() {
    await loadChildrenFromSupabase();
    renderChildSwitcher();
    renderHeader();
    renderEmergencySheet();
    wireEvents();
  }

  function wireEvents() {
    childSwitcher?.addEventListener("change", () => {
      db.activeChildId = childSwitcher.value || null;
      db.currentChildId = db.activeChildId;
      saveDB(db);
      renderChildSwitcher();
      renderHeader();
      renderEmergencySheet();
    });

    printBtn?.addEventListener("click", () => window.print());

    shareBtn?.addEventListener("click", async () => {
      const child = getActiveChild();
      const text = `Emergency sheet for ${child?.name || "child"} from CareNestia.`;

      if (!navigator.share) {
        alert("Sharing is not available on this device yet.");
        return;
      }

      try {
        await navigator.share({
          title: "CareNestia Emergency Sheet",
          text
        });
      } catch (err) {
        // user cancelled
      }
    });
  }

  async function loadChildrenFromSupabase() {
    if (!supabase?.auth) return;

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) return;

    const { data, error } = await supabase
      .from("children")
      .select("*")
      .eq("parent_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Could not load children:", error.message);
      return;
    }

    if (!Array.isArray(data) || !data.length) return;

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
  }

  function renderChildSwitcher() {
    const children = getChildren();
    if (!childSwitcher) return;

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

  function renderHeader() {
    const child = getActiveChild();

    if (!child) {
      if (childSummary) childSummary.textContent = "No child selected";
      if (childAvatar) childAvatar.innerHTML = "";
      return;
    }

    const ageText = child.age ? `Age ${child.age}` : "Age —";
    const dx = Array.isArray(child.diagnoses) && child.diagnoses.length
      ? child.diagnoses.slice(0, 2).join(" • ")
      : "No diagnoses listed";

    if (childSummary) childSummary.textContent = `${ageText} • ${dx}`;

    if (childAvatar) {
      childAvatar.innerHTML = child.photo_url
        ? `<img src="${escapeAttr(child.photo_url)}" alt="${escapeAttr(child.name || "Child")}">`
        : "";
    }
  }

  function renderEmergencySheet() {
    const child = getActiveChild();

    if (!child) {
      emergencySub.textContent = "No child selected.";
      childDetailsCard.innerHTML = `<p>No child profile found.</p>`;
      protocolCard.innerHTML = `<p>No emergency protocol available.</p>`;
      medicationsCard.innerHTML = `<p>No medications listed.</p>`;
      iceCard.innerHTML = `<p>No emergency contacts listed.</p>`;
      criticalCard.innerHTML = `<p>No critical information available.</p>`;
      equipmentCard.innerHTML = `<p>No equipment information available.</p>`;
      lastUpdatedText.textContent = "";
      return;
    }

    const binder = db.careBinder?.sections || {};
    const overview = binder.overview || {};
    const medHistory = binder.medicalHistory || {};
    const seizure = binder.seizureProfile || {};
    const binderMeds = binder.medications || {};
    const emergency = binder.emergencyPlans || {};
    const careTeam = binder.careTeam || {};
    const feeding = binder.feedingNutrition || {};

    const diagnoses = getDiagnoses(child, medHistory);
    const allergies = getAllergies(child, medHistory);
    const medicationEntries = getMedicationEntries(child, binderMeds);
    const emergencyContacts = getEmergencyContacts(careTeam);

    emergencySub.textContent = `Critical care details for ${child.name || "this child"}${child.age ? `, age ${child.age}` : ""}.`;

    childDetailsCard.innerHTML = `
      <div class="child-hero">
        <img src="${escapeAttr(getChildPhoto(child))}" alt="${escapeAttr(child.name || "Child")} photo">
        <div>
          <h2 class="hero-name">${escapeHtml(child.name || "Child")}</h2>
          <p><strong>Age:</strong> ${escapeHtml(child.age || "—")}</p>
          <p><strong>DOB:</strong> ${escapeHtml(child.birthdate || overview.dob || child.dob || "—")}</p>
          <p><strong>Preferred Hospital:</strong> ${escapeHtml(overview.preferredHospital || "—")}</p>
        </div>
      </div>

      <div style="margin-top:16px;">
        <h3>Diagnoses</h3>
        ${
          diagnoses.length
            ? `<ul class="diagnosis-list">${diagnoses
                .map((d) => `<li>${escapeHtml(d)}</li>`)
                .join("")}</ul>`
            : `<p>None listed</p>`
        }
      </div>

      <div style="margin-top:16px;">
        <h3>Allergies</h3>
        ${
          allergies.length
            ? `<ul class="diagnosis-list">${allergies
                .map((a) => `<li>${escapeHtml(a)}</li>`)
                .join("")}</ul>`
            : `<p>None listed</p>`
        }
      </div>
    `;

    protocolCard.innerHTML = `
      <div class="protocol-box">
        <div class="protocol-line">
          <strong>Rescue Medication</strong><br>
          ${escapeHtml(joinParts([seizure.rescue?.medication, seizure.rescue?.dose]) || "—")}
        </div>
        <div class="protocol-line">
          <strong>Give If</strong><br>
          ${escapeHtml(seizure.rescue?.whenToGive || emergency.medical?.warningSigns || "—")}
        </div>
        <div class="protocol-line">
          <strong>Call 911 If</strong><br>
          ${escapeHtml(seizure.rescue?.callEms || emergency.medical?.call911 || "—")}
        </div>
        <div class="protocol-line">
          <strong>Emergency Action Notes</strong><br>
          ${escapeHtml(emergency.medical?.actions || "—")}
        </div>
      </div>
    `;

    medicationsCard.innerHTML = medicationEntries.length
      ? `
        <div class="med-list">
          ${medicationEntries
            .map(
              (m) => `
                <div class="med-item">
                  <strong>${escapeHtml(m.name || "Medication")}</strong>
                  <div>${escapeHtml(m.summary || "—")}</div>
                </div>
              `
            )
            .join("")}
        </div>
      `
      : `<p>No active medications listed.</p>`;

    iceCard.innerHTML = emergencyContacts.length
      ? `
        <div class="ice-list">
          ${emergencyContacts
            .map((c) => {
              const phone = extractPhone(c.summary || "");
              return `
                <div class="ice-item">
                  <strong>${escapeHtml(c.title || "Contact")}</strong>
                  <div>${escapeHtml(c.summary || "—")}</div>
                  ${
                    phone
                      ? `<div style="margin-top:8px;"><a class="btn btn-ghost" href="tel:${escapeAttr(phone)}">Call</a></div>`
                      : ""
                  }
                </div>
              `;
            })
            .join("")}
        </div>
      `
      : `<p>No emergency contacts listed.</p>`;

    criticalCard.innerHTML = `
      <div class="critical-list">
        <div class="critical-item">
          <strong>Baseline Status</strong>
          <div>${escapeHtml(overview.baselineStatus || "—")}</div>
        </div>

        <div class="critical-item">
          <strong>Communication</strong>
          <div>${escapeHtml(overview.communication || "—")}</div>
        </div>

        <div class="critical-item">
          <strong>Mobility</strong>
          <div>${escapeHtml(overview.mobility || "—")}</div>
        </div>

        <div class="critical-item">
          <strong>Feeding</strong>
          <div>${escapeHtml(overview.feedingMethod || feeding.routine?.method || "—")}</div>
        </div>
      </div>
    `;

    equipmentCard.innerHTML = `
      <div class="equip-list">
        <div class="equip-item">
          <strong>Special Equipment</strong>
          <div>${escapeHtml(overview.specialEquipment || "—")}</div>
        </div>

        <div class="equip-item">
          <strong>Tube Details</strong>
          <div>${escapeHtml(joinParts([feeding.tube?.type, feeding.tube?.size], " • ") || "—")}</div>
        </div>

        <div class="equip-item">
          <strong>Transport / Emergency Notes</strong>
          <div>${escapeHtml(emergency.evacuation?.actions || emergency.medical?.actions || "—")}</div>
        </div>
      </div>
    `;

    lastUpdatedText.textContent = `Updated ${new Date().toLocaleString()}`;
  }

  function getChildren() {
    return Array.isArray(db.children) ? db.children : [];
  }

  function getActiveChild() {
    const children = getChildren();
    if (!children.length) return null;
    return children.find((c) => String(c.id) === String(db.activeChildId || db.currentChildId)) || children[0] || null;
  }

  function getChildPhoto(child) {
    return child?.photo_url || child?.photo || "https://via.placeholder.com/600x400?text=Child+Photo";
  }

  function getDiagnoses(child, medHistory) {
    const fromChild = normalizeDiagnoses(child?.diagnoses);
    if (fromChild.length) return fromChild;

    if (Array.isArray(medHistory?.diagnoses)) {
      return medHistory.diagnoses.map((d) => joinParts([d?.title, d?.summary], " — ")).filter(Boolean);
    }

    return [];
  }

  function getAllergies(child, medHistory) {
    const fromChild = normalizeDiagnoses(child?.allergies);
    if (fromChild.length) return fromChild;

    if (Array.isArray(medHistory?.allergies)) {
      return medHistory.allergies.map((a) => joinParts([a?.title, a?.summary], " — ")).filter(Boolean);
    }

    return [];
  }

  function getMedicationEntries(child, binderMeds) {
    const childId = child?.id;

    const appMeds = Array.isArray(db.meds)
      ? db.meds
          .filter((m) => String(m.childId) === String(childId) && !m.archived)
          .map((m) => ({
            name: m.name || "Medication",
            summary: joinParts(
              [
                m.dose,
                m.route,
                m.type === "prn" ? "PRN" : m.freq,
                m.times
              ],
              " • "
            ) || "—"
          }))
      : [];

    if (appMeds.length) return appMeds;

    const binderList = [
      ...(Array.isArray(binderMeds?.daily) ? binderMeds.daily : []),
      ...(Array.isArray(binderMeds?.prn) ? binderMeds.prn : []),
      ...(Array.isArray(binderMeds?.rescue) ? binderMeds.rescue : [])
    ].map((m) => ({
      name: m.title || "Medication",
      summary: m.summary || "—"
    }));

    return binderList;
  }

  function getEmergencyContacts(careTeam) {
    if (Array.isArray(careTeam?.emergencyContacts) && careTeam.emergencyContacts.length) {
      return careTeam.emergencyContacts;
    }
    return [];
  }

  function joinParts(parts, separator = " ") {
    return (parts || []).filter(Boolean).join(separator).trim();
  }

  function extractPhone(text) {
    return String(text || "").replace(/[^\d+]/g, "");
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