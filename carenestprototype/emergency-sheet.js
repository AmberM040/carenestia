document.addEventListener("DOMContentLoaded", () => {
  let db = ensureDB(loadDB());
  saveDB(db);

  const childSwitcher = document.getElementById("childSwitcher");
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

  init();

  function init() {
    renderChildSwitcher();
    renderEmergencySheet();
    wireEvents();
  }

  function wireEvents() {
    childSwitcher.addEventListener("change", () => {
      db.activeChildId = childSwitcher.value;
      saveDB(db);
      renderEmergencySheet();
    });

    printBtn.addEventListener("click", () => window.print());

    shareBtn.addEventListener("click", async () => {
      const child = getActiveChild();
      const text = `Emergency sheet for ${child.name || "child"} from CareNestia.`;

      if (navigator.share) {
        try {
          await navigator.share({
            title: "CareNestia Emergency Sheet",
            text
          });
        } catch (err) {
          // user canceled or share failed
        }
      } else {
        alert("Sharing is not available on this device yet.");
      }
    });
  }

  function renderChildSwitcher() {
    const children = getChildren();
    childSwitcher.innerHTML = children
      .map(
        (child) =>
          `<option value="${escapeHtml(child.id)}" ${
            child.id === getActiveChild().id ? "selected" : ""
          }>${escapeHtml(child.name || "Child")}</option>`
      )
      .join("");
  }

  function renderEmergencySheet() {
    const child = getActiveChild();
    const binder = db.careBinder?.sections || {};
    const overview = binder.overview || {};
    const medHistory = binder.medicalHistory || {};
    const seizure = binder.seizureProfile || {};
    const meds = binder.medications || {};
    const emergency = binder.emergencyPlans || {};
    const careTeam = binder.careTeam || {};
    const feeding = binder.feedingNutrition || {};

    emergencySub.textContent = `Critical care details for ${child.name || "this child"}${child.age ? `, age ${child.age}` : ""}.`;

    childDetailsCard.innerHTML = `
      <div class="child-hero">
        <img src="${escapeAttr(child.photo || "https://via.placeholder.com/600x400?text=Child+Photo")}" alt="${escapeAttr(child.name || "Child")} photo">
        <div>
          <h2 class="hero-name">${escapeHtml(child.name || "Child")}</h2>
          <p><strong>Age:</strong> ${escapeHtml(child.age || "—")}</p>
          <p><strong>DOB:</strong> ${escapeHtml(overview.dob || child.dob || "—")}</p>
          <p><strong>Preferred Hospital:</strong> ${escapeHtml(overview.preferredHospital || "—")}</p>
        </div>
      </div>

      <div style="margin-top:16px;">
        <h3>Diagnoses</h3>
        ${
          Array.isArray(medHistory.diagnoses) && medHistory.diagnoses.length
            ? `<ul class="diagnosis-list">${medHistory.diagnoses
                .map((d) => `<li>${escapeHtml(d.title)}${d.summary ? ` — ${escapeHtml(d.summary)}` : ""}</li>`)
                .join("")}</ul>`
            : `<p>—</p>`
        }
      </div>

      <div style="margin-top:16px;">
        <h3>Allergies</h3>
        ${
          Array.isArray(medHistory.allergies) && medHistory.allergies.length
            ? `<ul class="diagnosis-list">${medHistory.allergies
                .map((a) => `<li>${escapeHtml(a.title)}${a.summary ? ` — ${escapeHtml(a.summary)}` : ""}</li>`)
                .join("")}</ul>`
            : `<p>None listed</p>`
        }
      </div>
    `;

    protocolCard.innerHTML = `
      <div class="protocol-box">
        <div class="protocol-line">
          <strong>Rescue Medication</strong><br>
          ${escapeHtml(seizure.rescue?.medication || "—")} ${escapeHtml(seizure.rescue?.dose || "")}
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

    medicationsCard.innerHTML = `
      ${
        getMedicationEntries().length
          ? `<div class="med-list">
              ${getMedicationEntries()
                .map(
                  (m) => `
                    <div class="med-item">
                      <strong>${escapeHtml(m.title || "Medication")}</strong>
                      <div>${escapeHtml(m.summary || "—")}</div>
                    </div>
                  `
                )
                .join("")}
            </div>`
          : `<p>No active medications listed.</p>`
      }
    `;

    iceCard.innerHTML = `
      ${
        Array.isArray(careTeam.emergencyContacts) && careTeam.emergencyContacts.length
          ? `<div class="ice-list">
              ${careTeam.emergencyContacts
                .map((c) => {
                  const phone = c.summary || "";
                  return `
                    <div class="ice-item">
                      <strong>${escapeHtml(c.title || "Contact")}</strong>
                      <div>${escapeHtml(phone || "—")}</div>
                      ${
                        phone
                          ? `<div style="margin-top:8px;"><a class="btn btn-ghost" href="tel:${escapeAttr(extractPhone(phone))}">Call</a></div>`
                          : ""
                      }
                    </div>
                  `;
                })
                .join("")}
            </div>`
          : `<p>No emergency contacts listed.</p>`
      }
    `;

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
          <div>
            ${escapeHtml(feeding.tube?.type || "—")}
            ${feeding.tube?.size ? ` • ${escapeHtml(feeding.tube.size)}` : ""}
          </div>
        </div>

        <div class="equip-item">
          <strong>Transport / Emergency Notes</strong>
          <div>${escapeHtml(emergency.evacuation?.actions || emergency.medical?.actions || "—")}</div>
        </div>
      </div>
    `;

    lastUpdatedText.textContent =
      `Updates last synced from Care Binder: ${new Date().toLocaleString()}`;
  }

  function getMedicationEntries() {
    const meds = db.careBinder?.sections?.medications || {};
    return [
      ...(Array.isArray(meds.daily) ? meds.daily : []),
      ...(Array.isArray(meds.prn) ? meds.prn : []),
      ...(Array.isArray(meds.rescue) ? meds.rescue : [])
    ];
  }

  function getChildren() {
    if (Array.isArray(db.children) && db.children.length) return db.children;
    if (db.child) return [{ id: "default-child", ...db.child }];
    return [{ id: "default-child", name: "Test Child", age: 6, diagnoses: [] }];
  }

  function getActiveChild() {
    const children = getChildren();
    return children.find((c) => c.id === db.activeChildId) || children[0];
  }

  function extractPhone(text) {
    return String(text || "").replace(/[^\d+]/g, "");
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
