/* ------------------------------------------------
   CareNest Auth System (Supabase)
------------------------------------------------ */

document.addEventListener("DOMContentLoaded", () => {

  const errorMsg = document.getElementById("errorMsg");
  const successMsg = document.getElementById("successMsg");

  function showError(msg) {
    if (!errorMsg) return;
    errorMsg.textContent = msg;
    errorMsg.style.display = "block";
    if (successMsg) successMsg.style.display = "none";
  }

  function showSuccess(msg) {
    if (!successMsg) return;
    successMsg.textContent = msg;
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

  /* ------------------------------------------------
     LOGIN
  ------------------------------------------------ */

  const loginForm = document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearMessages();

      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;

      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        showError(error.message);
        return;
      }

      showSuccess("Login successful!");

      setTimeout(() => {
        window.location.href = "index.html";
      }, 800);
    });
  }

  /* ------------------------------------------------
     SIGNUP
  ------------------------------------------------ */

  const signupForm = document.getElementById("signupForm");

  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearMessages();

      const email = document.getElementById("signupEmail").value.trim();
      const password = document.getElementById("signupPassword").value;

      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password
      });

      if (error) {
        showError(error.message);
        return;
      }

      showSuccess("Account created! Check your email for confirmation.");
    });
  }

  /* ------------------------------------------------
     FORGOT PASSWORD
  ------------------------------------------------ */

  const forgotForm = document.getElementById("forgotPasswordForm");

  if (forgotForm) {
    forgotForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearMessages();

      const email = document.getElementById("resetEmail").value.trim();

      const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/reset-password.html"
      });

      if (error) {
        showError(error.message);
        return;
      }

      showSuccess("Password reset email sent.");
    });
  }

  /* ------------------------------------------------
     RESET PASSWORD PAGE
  ------------------------------------------------ */

  const resetForm = document.getElementById("resetPasswordForm");

  if (resetForm) {
    resetForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearMessages();

      const newPassword = document.getElementById("newPassword").value;

      const { data, error } = await supabaseClient.auth.updateUser({
        password: newPassword
      });

      if (error) {
        showError(error.message);
        return;
      }

      showSuccess("Password updated successfully!");

      setTimeout(() => {
        window.location.href = "login.html";
      }, 1500);
    });
  }

  /* ------------------------------------------------
     LOGOUT BUTTON
  ------------------------------------------------ */

  const logoutBtn = document.getElementById("logoutBtn");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      window.location.href = "login.html";
    });
  }

});


/* ------------------------------------------------
   SESSION CHECK (Protect pages)
------------------------------------------------ */

async function requireAuth() {

  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
  }

}


/* ------------------------------------------------
   GET CURRENT USER
------------------------------------------------ */

async function getCurrentUser() {

  const { data: { user } } = await supabaseClient.auth.getUser();

  return user;

}
