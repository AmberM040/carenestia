document.addEventListener("DOMContentLoaded", () => {
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

  async function getPostLoginDestination() {
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return "login.html";
    }

    const { data: children, error: childrenError } = await supabaseClient
      .from("children")
      .select("id")
      .eq("parent_id", user.id)
      .limit(1);

    if (childrenError) {
      console.error("Children lookup error:", childrenError);
      return "onboarding.html";
    }

    if (!children || children.length === 0) {
      return "onboarding.html";
    }

    return "index.html";
  }

  async function redirectIfLoggedIn() {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error || !data.session) return;

    const currentPage = window.location.pathname.split("/").pop();

    const publicPages = [
      "",
      "login.html",
      "signup.html",
      "forgot-password.html",
      "reset-password.html",
    ];

    if (publicPages.includes(currentPage)) {
      const destination = await getPostLoginDestination();
      window.location.href = destination;
    }
  }

  redirectIfLoggedIn();

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearMessages();

      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;

      if (!email || !password) {
        showError("Please enter your email and password.");
        return;
      }

      const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        showError(error.message);
        return;
      }

      showSuccess("Login successful. Redirecting...");

      const destination = await getPostLoginDestination();

      setTimeout(() => {
        window.location.href = destination;
      }, 700);
    });
  }

  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearMessages();

      const email = document.getElementById("signupEmail").value.trim();
      const password = document.getElementById("signupPassword").value;
      const confirmPassword = document.getElementById("signupConfirmPassword").value;

      if (!email || !password || !confirmPassword) {
        showError("Please fill out all fields.");
        return;
      }

      if (password.length < 6) {
        showError("Password must be at least 6 characters.");
        return;
      }

      if (password !== confirmPassword) {
        showError("Passwords do not match.");
        return;
      }

      const { error } = await supabaseClient.auth.signUp({
        email,
        password,
      });

      if (error) {
        showError(error.message);
        return;
      }

      showSuccess("Account created. Check your email to confirm your account.");
      signupForm.reset();
    });
  }

  const forgotPasswordForm = document.getElementById("forgotPasswordForm");
  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearMessages();

      const email = document.getElementById("resetEmail").value.trim();

      if (!email) {
        showError("Please enter your email.");
        return;
      }

      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password.html`,
      });

      if (error) {
        showError(error.message);
        return;
      }

      showSuccess("Password reset email sent.");
    });
  }

  const resetPasswordForm = document.getElementById("resetPasswordForm");
  if (resetPasswordForm) {
    resetPasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearMessages();

      const newPassword = document.getElementById("newPassword").value;
      const confirmNewPassword = document.getElementById("confirmNewPassword").value;

      if (!newPassword || !confirmNewPassword) {
        showError("Please fill out both password fields.");
        return;
      }

      if (newPassword.length < 6) {
        showError("Password must be at least 6 characters.");
        return;
      }

      if (newPassword !== confirmNewPassword) {
        showError("Passwords do not match.");
        return;
      }

      const { error } = await supabaseClient.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        showError(error.message);
        return;
      }

      showSuccess("Password updated successfully. Redirecting to login...");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1200);
    });
  }
});

document.addEventListener("click", async (e) => {
  const logoutBtn = e.target.closest("#logoutBtn");
  if (!logoutBtn) return;

  e.preventDefault();

  try {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      console.error("Logout error:", error);
      alert(error.message);
      return;
    }

    window.location.replace("login.html");
  } catch (err) {
    console.error("Unexpected logout error:", err);
    alert("Logout failed. Check console for details.");
  }
});

async function requireAuth() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session) {
    window.location.href = "login.html";
  }
}

async function getCurrentUser() {
  const { data, error } = await supabaseClient.auth.getUser();
  if (error) return null;
  return data.user;
}
