document.addEventListener("DOMContentLoaded", async () => {
  const ACTIVE_CHILD_KEY = "carenest_active_child_id";
  const LOCAL_DB_KEY = "carenest_prototype_v1";

  const childSummary = document.getElementById("childSummary");
  const childSwitcher = document.getElementById("childSwitcher");
  const logoutBtn = document.getElementById("logoutBtn");

  let currentUser = null;
  let children = [];
  let activeChild = null;

  function getSupabaseClient() {
    if (window.supabaseClient) return window.supabaseClient;
    if (window.supabase?.from) return window.supabase;
    return null;
  }

  function getActiveChildId() {
    return localStorage.getItem(ACTIVE_CHILD_KEY);
  }

  function setActiveChildId(id) {
    localStorage.setItem(ACTIVE_CHILD_KEY, id);
  }

  function getLocalDB() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_DB_KEY) || "{}");
    } catch (err) {
      console.error("Failed to parse local DB:", err);
      return {};
    }
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

  function getLocalChildrenFallback() {
    const db = getLocalDB();

    if (Array.isArray(db.children) && db.children.length) {
      return db.children.map((child) => ({
        ...child,
        diagnoses: normalizeDiagnoses(child.diagnoses),
      }));
    }

    if (db.child) {
      return [
        {
          id: db.activeChildId || "local-child-1",
          name: db.child.name || "Test Child",
          age: db.child.age ?? "",
          birthdate: db.child.birthdate || null,
          diagnoses: normalizeDiagnoses(db.child.diagnoses),
        },
      ];
    }

    return [];
  }

  async function fetchUser() {
    const supabase = getSupabaseClient();
    if (!supabase?.auth) return null;

    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.warn("Could not get user:", error.message);
      return null;
    }

    return data?.user || null;
  }

  async function fetchChildren(userId) {
    const supabase = getSupabaseClient();
    if (!supabase || !userId) return [];

    const { data, error } = await supabase
      .from("children")
      .select("*")
      .eq("parent_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Could not load children:", error.message);
      return [];
    }

    return (data || []).map((child) => ({
      ...child,
      diagnoses: normalizeDiagnoses(child.diagnoses),
      age: child.age ?? getAgeFromBirthdate(child.birthdate),
    }));
  }

  function renderChildSwitcher() {
    if (!childSwitcher) return;

    childSwitcher.innerHTML = "";

    if (!children.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No children yet";
      childSwitcher.appendChild(opt);
      return;
    }

    children.forEach((child) => {
      const opt = document.createElement("option");
      opt.value = child.id;
      opt.textContent = child.name || "Unnamed Child";
      if (activeChild && String(activeChild.id) === String(child.id)) {
        opt.selected = true;
      }
      childSwitcher.appendChild(opt);
    });
  }

  function renderSummary() {
    if (!childSummary) return;

    if (!activeChild) {
      childSummary.textContent = "No child selected";
      return;
    }

    const diagnoses = normalizeDiagnoses(activeChild.diagnoses);
    const childAge = activeChild.age ?? getAgeFromBirthdate(activeChild.birthdate);
    const ageText =
      childAge !== null && childAge !== undefined && childAge !== ""
        ? `Age ${childAge}`
        : "Age —";

    childSummary.textContent =
      `${activeChild.name || "Child"} • ${ageText}` +
      (diagnoses.length ? ` • ${diagnoses.join(" • ")}` : "");
  }

  async function init() {
    currentUser = await fetchUser();

    let loadedChildren = [];
    if (currentUser?.id) {
      loadedChildren = await fetchChildren(currentUser.id);
    }

    if (!loadedChildren.length) {
      loadedChildren = getLocalChildrenFallback();
    }

    children = loadedChildren;

    const savedId = getActiveChildId();
    activeChild =
      children.find((child) => String(child.id) === String(savedId)) ||
      children[0] ||
      null;

    if (activeChild) {
      setActiveChildId(activeChild.id);
    }

    renderChildSwitcher();
    renderSummary();

    childSwitcher?.addEventListener("change", () => {
      const selectedId = childSwitcher.value;
      activeChild =
        children.find((child) => String(child.id) === String(selectedId)) || null;

      if (activeChild) {
        setActiveChildId(activeChild.id);
      }

      renderSummary();
    });

    logoutBtn?.addEventListener("click", async () => {
      const supabase = getSupabaseClient();

      if (supabase?.auth) {
        await supabase.auth.signOut();
      }

      window.location.href = "login.html";
    });
  }

  await init();
});
