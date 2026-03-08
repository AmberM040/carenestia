document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("onboardingForm");
  const errorMsg = document.getElementById("errorMsg");
  const successMsg = document.getElementById("successMsg");

  function showError(message) {
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

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessages();

    const childName = document.getElementById("childName").value.trim();
    const childBirthdate = document.getElementById("childBirthdate").value || null;
    const childDiagnoses = document.getElementById("childDiagnoses").value.trim();
    const childAllergies = document.getElementById("childAllergies").value.trim();
    const childNotes = document.getElementById("childNotes").value.trim();

    if (!childName) {
      showError("Please enter your child’s name.");
      return;
    }

    const { data: userData, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !userData.user) {
      showError("You must be logged in to continue.");
      return;
    }

    const user = userData.user;

    const { error } = await supabaseClient
      .from("children")
      .insert([
        {
          parent_id: user.id,
          name: childName,
          birthdate: childBirthdate,
          diagnoses: childDiagnoses,
          allergies: childAllergies,
          notes: childNotes
        }
      ]);

    if (error) {
      showError(error.message);
      return;
    }

    showSuccess("Child profile created. Redirecting...");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 900);
  });
});
