document.addEventListener("DOMContentLoaded", async () => {
  const ACTIVE_CHILD_KEY = "carenest_active_child_id";
  const LOCAL_DB_KEY = "carenest_prototype_v1";

  const childSwitcher = document.getElementById("childSwitcher");
  const childSummary = document.getElementById("childSummary");
  const saveCarePlanBtn = document.getElementById("saveCarePlanBtn");

  const allergies = document.getElementById("allergies");
  const baselineO2 = document.getElementById("baselineO2");
  const baselineTemp = document.getElementById("baselineTemp");
  const baselineHr = document.getElementById("baselineHr");
  const baselineRr = document.getElementById("baselineRr");
  const baselineBp = document.getElementById("baselineBp");
  const seizureProtocol = document.getElementById("seizureProtocol");
  const rescueMedName = document.getElementById("rescueMedName");
  const rescueMedDose = document.getElementById("rescueMedDose");
  const rescueMedRoute = document.getElementById("rescueMedRoute");
  const emsWhen = document.getElementById("emsWhen");
  const oxygenGuidance = document.getElementById("oxygenGuidance");
  const feedingNotes = document.getElementById("feedingNotes");
  const mobilityNotes = document.getElementById("mobilityNotes");
  const communicationNotes = document.getElementById("communicationNotes");
  const calmingNotes = document.getElementById("calmingNotes");
  const emergencyContacts = document.getElementById("emergencyContacts");
  const doctorContacts = document.getElementById("doctorContacts");
  const preferredHospital = document.getElementById("preferredHospital");
  const insuranceNotes = document.getElementById("insuranceNotes");
  const additionalNotes = document.getElementById("additionalNotes");

  let currentUser = null;
  let children = [];
  let activeChild = null;
  let carePlanId = null;

  function getSupabaseClient() {
    return window.supabaseClient || null;
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
    } catch {
      return {};
    }
  }

  function saveLocalDB(db) {
    localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
  }

  function clearForm() {
    allergies.value = "";
    baselineO2.value = "";
    baselineTemp.value = "";
    baselineHr.value = "";
    baselineRr.value = "";
    baselineBp.value = "";
    seizureProtocol.value = "";
    rescueMedName.value = "";
    rescueMedDose.value = "";
    rescueMedRoute.value = "";
    emsWhen.value = "";
    oxygenGuidance.value = "";
    feedingNotes.value = "";
    mobilityNotes.value = "";
    communicationNotes.value = "";
    calmingNotes.value = "";
    emergencyContacts.value = "";
    doctorContacts.value = "";
    preferredHospital.value = "";
    insuranceNotes.value = "";
    additionalNotes.value = "";
    carePlanId = null;
  }

  function fillForm(plan) {
    clearForm();
    if (!plan) return;

    carePlanId = plan.id || null;
    allergies.value = plan.allergies || "";
    baselineO2.value = plan.baseline_o2 || "";
    baselineTemp.value = plan.baseline_temp || "";
    baselineHr.value = plan.baseline_hr || "";
    baselineRr.value = plan.baseline_rr || "";
    baselineBp.value = plan.baseline_bp || "";
    seizureProtocol.value = plan.seizure_protocol || "";
    rescueMedName.value = plan.rescue_med_name || "";
    rescueMedDose.value = plan.rescue_med_dose || "";
    rescueMedRoute.value = plan.rescue_med_route || "";
    emsWhen.value = plan.ems_when || "";
    oxygenGuidance.value = plan.oxygen_guidance || "";
    feedingNotes.value = plan.feeding_notes || "";
    mobilityNotes.value = plan.mobility_notes || "";
    communicationNotes.value = plan.communication_notes || "";
    calmingNotes.value = plan.calming_notes || "";
    emergencyContacts.value = plan.emergency_contacts || "";
    doctorContacts.value = plan.doctor_contacts || "";
    preferredHospital.value = plan.preferred_hospital || "";
    insuranceNotes.value = plan.insurance_notes || "";
    additionalNotes.value = plan.additional_notes || "";
  }

  function renderChildSwitcher() {
    childSwitcher.innerHTML = "";

    if (!children.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No children yet";
      childSwitcher.appendChild(option);
      return;
    }

    children.forEach((child) => {
      const option = document.createElement("option");
      option.value = child.id;
      option.textContent = child.name || "Unnamed Child";
      if (activeChild && String(activeChild.id) === String(child.id)) {
        option.selected = true;
      }
      childSwitcher.appendChild(option);
    });
  }

  function renderChildSummary() {
    if (!activeChild) {
      childSummary.textContent = "No child selected";
      return;
    }

    const ageText =
      activeChild.age !== null && activeChild.age !== undefined && activeChild.age !== ""
        ? `Age ${activeChild.age}`
        : "Age —";

    childSummary.textContent = `${activeChild.name || "Child"} • ${ageText}`;
  }

  async function fetchUser() {
    const supabase = getSupabaseClient();
    if (!supabase?.auth) return null;

    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data?.user || null;
  }

  async function fetchChildren(userId) {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("children")
      .select("*")
      .eq("parent_user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Could not load children:", error.message);
      return [];
    }

    return data || [];
  }

  async function fetchCarePlan(childId) {
    const supabase = getSupabaseClient();
    if (!supabase || !childId) return null;

    const { data, error } = await supabase
      .from("care_plans")
      .select("*")
      .eq("child_id", childId)
      .maybeSingle();

    if (error) {
      console.warn("Could not load care plan:", error.message);
      return null;
    }

    return data || null;
  }

  function getLocalChildrenFallback() {
    const db = getLocalDB();
    const child = db.child || null;
    if (!child) return [];

    return [
      {
        id: "local-child-1",
        name: child.name || "Test Child",
        age: child.age ?? "",
        diagnoses: Array.isArray(child.diagnoses) ? child.diagnoses : []
      }
    ];
  }

  function getLocalCarePlan(childId) {
    const db = getLocalDB();
    const plans = db.carePlans || {};
    return plans[childId] || null;
  }

  function saveLocalCarePlan(childId, payload) {
    const db = getLocalDB();
    if (!db.carePlans) db.carePlans = {};
    db.carePlans[childId] = payload;
    saveLocalDB(db);
  }

  function buildPayload() {
    return {
      child_id: activeChild.id,
      parent_user_id: currentUser?.id || null,
      allergies: allergies.value.trim(),
      baseline_o2: baselineO2.value.trim(),
      baseline_temp: baselineTemp.value.trim(),
      baseline_hr: baselineHr.value.trim(),
      baseline_rr: baselineRr.value.trim(),
      baseline_bp: baselineBp.value.trim(),
      seizure_protocol: seizureProtocol.value.trim(),
      rescue_med_name: rescueMedName.value.trim(),
      rescue_med_dose: rescueMedDose.value.trim(),
      rescue_med_route: rescueMedRoute.value.trim(),
      ems_when: emsWhen.value.trim(),
      oxygen_guidance: oxygenGuidance.value.trim(),
      feeding_notes: feedingNotes.value.trim(),
      mobility_notes: mobilityNotes.value.trim(),
      communication_notes: communicationNotes.value.trim(),
      calming_notes: calmingNotes.value.trim(),
      emergency_contacts: emergencyContacts.value.trim(),
      doctor_contacts: doctorContacts.value.trim(),
      preferred_hospital: preferredHospital.value.trim(),
      insurance_notes: insuranceNotes.value.trim(),
      additional_notes: additionalNotes.value.trim(),
      updated_at: new Date().toISOString()
    };
  }

  async function loadCarePlan() {
    renderChildSummary();

    if (!activeChild) {
      clearForm();
      return;
    }

    const supabasePlan = await fetchCarePlan(activeChild.id);
    const localPlan = getLocalCarePlan(activeChild.id);
    fillForm(supabasePlan || localPlan || null);
  }

  async function saveCarePlan() {
    if (!activeChild) {
      alert("No child selected.");
      return;
    }

    const supabase = getSupabaseClient();
    const payload = buildPayload();

    let saved = false;

    if (supabase && currentUser?.id) {
      const { data, error } = await supabase
        .from("care_plans")
        .upsert(payload, { onConflict: "child_id" })
        .select()
        .single();

      if (error) {
        console.warn("Could not save care plan:", error.message);
      } else {
        carePlanId = data?.id || null;
        saved = true;
      }
    }

    if (!saved) {
      saveLocalCarePlan(activeChild.id, { ...payload, id: carePlanId || "local-care-plan" });
    }

    alert("Care plan saved.");
    await loadCarePlan();
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
    await loadCarePlan();

    childSwitcher?.addEventListener("change", async (e) => {
      const selectedId = e.target.value;
      activeChild = children.find((child) => String(child.id) === String(selectedId)) || null;

      if (activeChild) {
        setActiveChildId(activeChild.id);
      }

      await loadCarePlan();
    });

    saveCarePlanBtn?.addEventListener("click", saveCarePlan);
  }

  await init();
});
