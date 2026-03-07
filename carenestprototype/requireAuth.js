function requireAuth() {
  const db = ensureDB(loadDB());
  const userId = db?.session?.userId;
  if (!userId) {
    window.location.href = "login.html";
    return null;
  }

  const user = (db.users || []).find(u => u.id === userId);
  if (!user) {
    window.location.href = "login.html";
    return null;
  }

  return user;
}