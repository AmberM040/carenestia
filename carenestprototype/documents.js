document.addEventListener("DOMContentLoaded", () => {
  let db = ensureDB(loadDB());
  saveDB(db);

  const childSwitcher = document.getElementById("childSwitcher");
  const childSummary = document.getElementById("childSummary");
  const emergencyBtn = document.querySelector(".emergency-btn");

  function activeChild() {
    const children = Array.isArray(db.children) ? db.children : [];
    if (!children.length) return null;
    return children.find((c) => c.id === db.activeChildId) || children[0];
  }

  function fillChildSwitcher() {
    if (!childSwitcher) return;

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

  function updateChildSummary() {
    if (!childSummary) return;

    const child = activeChild();
    if (!child) {
      childSummary.textContent = "No child selected";
      return;
    }

    const diagnoses = Array.isArray(child.diagnoses) && child.diagnoses.length
      ? child.diagnoses.join(" • ")
      : "No diagnoses listed";

    childSummary.textContent = `${child.name} • Age ${child.age ?? "—"} • ${diagnoses}`;
  }

  if (childSwitcher) {
    childSwitcher.addEventListener("change", () => {
      db.activeChildId = childSwitcher.value;
      saveDB(db);
      updateChildSummary();
      window.location.reload();
    });
  }

  if (emergencyBtn) {
    emergencyBtn.addEventListener("click", () => {
      window.location.href = "emergency.html";
    });
  }

  fillChildSwitcher();
  updateChildSummary();
});