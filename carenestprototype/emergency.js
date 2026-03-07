document.addEventListener("DOMContentLoaded", () => {
  let db = ensureDB(loadDB());
  saveDB(db);

  const childSwitcher = document.getElementById("childSwitcher");
  const childSummary = document.getElementById("childSummary");
  const emergencyPageBody = document.getElementById("emergencyPageBody");
  const emergencyBtn = document.querySelector(".emergency-btn");

  function activeChild() {
    const children = Array.isArray(db.children) ? db.children : [];
    if (!children.length) return null;
    return children.find((c) => c.id === db.activeChildId) || children[0];
  }

  function fillChildSwitcher() {
    childSwitcher.innerHTML = "";
    const children = Array.isArray(db.children) ? db.children : [];

    children.forEach((child) => {
      const option = document.createElement("option");
      option.value = child.id;
      option.textContent = child.name;
      childSwitcher.appendChild(option);
    });

    childSwitcher.value = db.activeChildId || "";
  }

  function renderPage() {
    const child = activeChild();

    if (!child) {
      childSummary.textContent = "No child selected";
      emergencyPageBody.innerHTML = `<div class="simple-item">No emergency information available.</div>`;
      return;
    }

    const diagnoses = Array.isArray(child.diagnoses) && child.diagnoses.length
      ? child.diagnoses.join(" • ")
      : "No diagnoses listed";

    childSummary.textContent = `${child.name} • Age ${child.age ?? "—"} • ${diagnoses}`;

    const em = child.emergency || {};
    const tr = em.trach || {};
    const ve = em.vent || {};
    const gt = em.gTube || {};
    const ox = em.oxygen || {};

    emergencyPageBody.innerHTML = `
      <div class="simple-item"><strong>Name:</strong> ${child.name}</div>
      <div class="simple-item"><strong>Age:</strong> ${child.age ?? "—"}</div>
      <div class="simple-item"><strong>Diagnoses:</strong> ${(child.diagnoses || []).join(", ") || "None listed"}</div>
      <div class="simple-item"><strong>Allergies:</strong> ${em.allergies || "Not listed"}</div>
      <div class="simple-item"><strong>Trach:</strong> ${tr.hasTrach ? "Yes" : "No / Not listed"}</div>
      <div class="simple-item"><strong>Vent:</strong> ${ve.onVent ? "Yes" : "No / Not listed"}</div>
      <div class="simple-item"><strong>G-Tube:</strong> ${gt.hasGTube ? "Yes" : "No / Not listed"}</div>
      <div class="simple-item"><strong>Oxygen:</strong> ${ox.hasOxygen ? "Yes" : "No / Not listed"}</div>
    `;
  }

  childSwitcher.addEventListener("change", () => {
    db.activeChildId = childSwitcher.value;
    saveDB(db);
    renderPage();
  });

  if (emergencyBtn) {
    emergencyBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  fillChildSwitcher();
  renderPage();
});