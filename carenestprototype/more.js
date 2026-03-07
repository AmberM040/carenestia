document.addEventListener("DOMContentLoaded", () => {
  let db = ensureDB(loadDB());
  saveDB(db);

  const childSummary = document.getElementById("childSummary");
  const childSwitcher = document.getElementById("childSwitcher");

  function activeChild() {
    const children = Array.isArray(db.children) ? db.children : [];
    if (!children.length) return null;
    return children.find((c) => c.id === db.activeChildId) || children[0];
  }

  function fillChildSwitcher() {
    if (!childSwitcher) return;

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

  function render() {
    db = ensureDB(loadDB());

    const child = activeChild();
    if (!child) {
      if (childSummary) childSummary.textContent = "No child selected";
      return;
    }

    const diagnoses = Array.isArray(child.diagnoses) ? child.diagnoses : [];
    childSummary.textContent = `${child.name} • Age ${child.age ?? "—"}${diagnoses.length ? ` • ${diagnoses.join(" • ")}` : ""}`;
  }

  if (childSwitcher) {
    childSwitcher.addEventListener("change", () => {
      db.activeChildId = childSwitcher.value;
      saveDB(db);
      render();
    });
  }

  fillChildSwitcher();
  render();
});