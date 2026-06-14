/**
 * auth.js
 * ----------------------------------------------------------------------------
 * إدارة جلسة الدخول على جانب الواجهة + حراسة الصفحات + الصلاحيات.
 * ----------------------------------------------------------------------------
 */
window.Auth = (function () {

  function saveSession(token, user) {
    localStorage.setItem(APP_CONFIG.STORAGE.TOKEN, token);
    localStorage.setItem(APP_CONFIG.STORAGE.USER, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(APP_CONFIG.STORAGE.TOKEN);
    localStorage.removeItem(APP_CONFIG.STORAGE.USER);
    // مسح البيانات المخزّنة مؤقتاً حتى لا تتسرب بين المستخدمين/الجلسات
    if (window.Cache) Cache.clear();
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(APP_CONFIG.STORAGE.USER) || 'null');
    } catch (e) { return null; }
  }

  function isLoggedIn() {
    return !!localStorage.getItem(APP_CONFIG.STORAGE.TOKEN) && !!getUser();
  }

  async function login(email, password) {
    const data = await API.call('auth.login', { email: email, password: password });
    saveSession(data.token, data.user);
    return data.user;
  }

  async function logout() {
    try { await API.call('auth.logout', { token: localStorage.getItem(APP_CONFIG.STORAGE.TOKEN) }); }
    catch (e) { /* تجاهل */ }
    clearSession();
    location.href = 'index.html';
  }

  /**
   * حراسة الصفحة: استدعها في بداية كل صفحة محمية.
   * تعيد التوجيه لتسجيل الدخول إن لم تكن هناك جلسة.
   */
  function requireAuth() {
    if (!isLoggedIn()) {
      location.href = 'index.html';
      return false;
    }
    return true;
  }

  /**
   * هل دور المستخدم الحالي ضمن القائمة المسموحة؟
   */
  function can(roles) {
    const u = getUser();
    if (!u) return false;
    if (!roles || roles.indexOf('*') > -1) return true;
    return roles.indexOf(u.role) > -1;
  }

  /**
   * هل المستخدم قارئ فقط؟ (لإخفاء أزرار التعديل)
   */
  function isReadOnly() {
    const u = getUser();
    return !u || u.role === 'viewer';
  }

  function roleLabel(role) {
    const found = (ENUMS.roles || []).find(function (r) { return r.value === role; });
    return found ? found.label : role;
  }

  return {
    saveSession: saveSession,
    clearSession: clearSession,
    getUser: getUser,
    isLoggedIn: isLoggedIn,
    login: login,
    logout: logout,
    requireAuth: requireAuth,
    can: can,
    isReadOnly: isReadOnly,
    roleLabel: roleLabel
  };
})();
