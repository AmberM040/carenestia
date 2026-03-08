document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("onboardingForm");
  const errorMsg = document.getElementById("errorMsg");
  const successMsg = document.getElementById("successMsg");

  const careRespiratory = document.getElementById("careRespiratory");
  const careFeeds = document.getElementById("careFeeds");
  const careCardiology = document.getElementById("careCardiology");

  const respiratorySection = document.getElementById("respiratorySection");
  const feedsSection = document.getElementById("feedsSection");
  const cardiologySection = document.getElementById("cardiologySection");

  function showError(message) {
    console.error("Onboarding error:", message);
    if (!errorMsg) return;
    errorMsg.textContent = message;
    errorMsg.style.display = "block";
    if (successMsg) successMsg.style.display = "none";
  }

  function showSuccess(message) {
    if (!successMsg) return;
    successMsg.textContent = message;
    successMsg.style.display = "block";
    if (errorMsg) errorMsg.style.display = "none";
  }

  function clearMessages() {
    if (errorMsg) {
      errorMsg.textContent = "";
      errorMsg.style.display = "none";
    }
    if (successMsg) {
      successMsg.textContent = "";
      successMsg.style.display = "none";
    }
  }

  function toggleSections() {
    if (respiratorySection) {
      respiratorySection.classList.toggle("show", !!careRespiratory?.checked);
    }
    if (feedsSection) {
      feedsSection.classList.toggle("show", !!careFeeds?.checked);
    }
    if (cardiologySection) {
      cardiologySection.classList.toggle("show", !!careCardiology?.checked);
    }
  }

  [careRespiratory, careFeeds, careCardiology].forEach((checkbox) => {
    if (checkbox) {
      checkbox.addEventListener("change", toggleSections);
    }
  });

  toggleSections();

  if (!form) {
    console.error("onboardingForm not found");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessages();

    const childName = document.getElementById("childName")?.value.trim() || "";
    const childBirthdate = document.getElementById("childBirthdate")?.value || null;
    const childDiagnoses = document.getElementById("childDiagnoses")?.value.trim() || "";
    const childAllergies = document.getElementById("childAllergies")?.value.trim() || "";
    const childNotes = document.getElementById("childNotes")?.value.trim() || "";
    const complexityLevel = document.getElementById("complexityLevel")?.value || "moderate";

    if (!childName) {
      showError("Please enter your child’s name.");
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError) {
      showError(userError.message);
      return;
    }

    if (!user) {
      showError("You must be logged in to continue.");
      return;
    }

    const childPayload = {
      parent_id: user.id,
      name: childName,
      birthdate: childBirthdate,
      diagnoses: childDiagnoses,
      allergies: childAllergies,
      notes: childNotes,
      complexity_level: complexityLevel,
    };

    const { data: childRows, error: childError } = await supabaseClient
      .from("children")
      .insert([childPayload])
      .select();

    if (childError) {
      showError(childError.message);
      return;
    }

    const child = childRows?.[0];
    if (!child?.id) {
      showError("Child profile was created, but no child ID was returned.");
      return;
    }

    const careProfilePayload = {
      child_id: child.id,
      has_medications: !!document.getElementById("careMedications")?.checked,
      has_feeds: !!document.getElementById("careFeeds")?.checked,
      has_respiratory: !!document.getElementById("careRespiratory")?.checked,
      has_cardiology: !!document.getElementById("careCardiology")?.checked,
      has_symptoms: !!document.getElementById("careSymptoms")?.checked,
      has_therapies: !!document.getElementById("careTherapies")?.checked,
      has_appointments: !!document.getElementById("careAppointments")?.checked,
      has_inventory: !!document.getElementById("careInventory")?.checked,
      has_school_support: !!document.getElementById("careSchoolSupport")?.checked,
    };

    const { error: careProfileError } = await supabaseClient
      .from("child_care_profiles")
      .insert([careProfilePayload]);

    if (careProfileError) {
      showError(careProfileError.message);
      return;
    }

    const equipmentProfilePayload = {
      child_id: child.id,

      oxygen:
        !!document.getElementById("eqOxygen")?.checked,
      pulse_ox:
        !!document.getElementById("eqPulseOxResp")?.checked ||
        !!document.getElementById("eqPulseOxCardio")?.checked,
      nebulizer:
        !!document.getElementById("eqNebulizer")?.checked,
      suction:
        !!document.getElementById("eqSuction")?.checked,
      trach:
        !!document.getElementById("eqTrach")?.checked,
      ventilator:
        !!document.getElementById("eqVentilator")?.checked,
      cpap_bipap:
        !!document.getElementById("eqCpapBipap")?.checked,
      airway_clearance:
        !!document.getElementById("eqAirwayClearance")?.checked,

      g_tube:
        !!document.getElementById("eqGTube")?.checked,
      j_tube:
        !!document.getElementById("eqJTube")?.checked,
      feeding_pump:
        !!document.getElementById("eqFeedingPump")?.checked,
      continuous_feeds:
        !!document.getElementById("eqContinuousFeeds")?.checked,
      bolus_feeds:
        !!document.getElementById("eqBolusFeeds")?.checked,

      heart_rate_monitoring:
        !!document.getElementById("eqHeartRateMonitoring")?.checked,
      blood_pressure_monitoring:
        !!document.getElementById("eqBloodPressureMonitoring")?.checked,
      cardiac_monitor:
        !!document.getElementById("eqCardiacMonitor")?.checked,
      pacemaker:
        !!document.getElementById("eqPacemaker")?.checked,
      central_line:
        !!document.getElementById("eqCentralLine")?.checked,
    };

    const { error: equipmentProfileError } = await supabaseClient
      .from("child_equipment_profiles")
      .insert([equipmentProfilePayload]);

    if (equipmentProfileError) {
      showError(equipmentProfileError.message);
      return;
    }

    showSuccess("Child profile created. Redirecting...");

    setTimeout(() => {
      window.location.href = "index.html";
    }, 900);
  });
});
