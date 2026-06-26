/**
 * auth.js
 * ----------------------------------------------------------------------------
 * إدارة جلسة الدخول على جانب الواجهة + حراسة الصفحات + الصلاحيات.
 * ----------------------------------------------------------------------------
 */
window.Auth = (function () {

  function saveSession(token, user, permissions) {
    localStorage.setItem(APP_CONFIG.STORAGE.TOKEN, token);
    localStorage.setItem(APP_CONFIG.STORAGE.USER, JSON.stringify(user));
    if (permissions) localStorage.setItem(APP_CONFIG.STORAGE.PERMS, JSON.stringify(permissions));
  }

  function clearSession() {
    localStorage.removeItem(APP_CONFIG.STORAGE.TOKEN);
    localStorage.removeItem(APP_CONFIG.STORAGE.USER);
    localStorage.removeItem(APP_CONFIG.STORAGE.PERMS);
    // مسح البيانات المخزّنة مؤقتاً حتى لا تتسرب بين المستخدمين/الجلسات
    if (window.Cache) Cache.clear();
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(APP_CONFIG.STORAGE.USER) || 'null');
    } catch (e) { return null; }
  }

  function getPerms() {
    try {
      return JSON.parse(localStorage.getItem(APP_CONFIG.STORAGE.PERMS) || 'null');
    } catch (e) { return null; }
  }

  function isLoggedIn() {
    return !!localStorage.getItem(APP_CONFIG.STORAGE.TOKEN) && !!getUser();
  }

  async function login(email, password) {
    const data = await API.call('auth.login', { email: email, password: password });
    saveSession(data.token, data.user, data.permissions);
    return data.user;
  }

  /**
   * تسجيل الخروج — فوري الاستجابة:
   * نمسح الجلسة محلياً ونعيد التوجيه مباشرةً، ونُرسل طلب إبطال الجلسة للخادم في
   * الخلفية عبر sendBeacon (يصمد عبر الانتقال) فلا ينتظر المستخدم الخادم إطلاقاً.
   */
  function logout() {
    const token = localStorage.getItem(APP_CONFIG.STORAGE.TOKEN);
    try {
      const body = JSON.stringify({ action: 'auth.logout', token: token, payload: { token: token } });
      const apiUrl = APP_CONFIG.activeApiUrl ? APP_CONFIG.activeApiUrl() : APP_CONFIG.API_URL;
      if (token && apiUrl && navigator.sendBeacon) {
        // sendBeacon يرسل نوع المحتوى text/plain فلا يستدعي preflight
        navigator.sendBeacon(apiUrl, new Blob([body], { type: 'text/plain;charset=UTF-8' }));
      } else if (token && apiUrl) {
        // بديل: fetch مع keepalive دون انتظار
        fetch(apiUrl, {
          method: 'POST', keepalive: true,
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body
        }).catch(function () {});
      }
    } catch (e) { /* تجاهل */ }
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
   * هل دور المستخدم الحالي ضمن القائمة المسموحة؟ (فحص عام بالدور)
   */
  function can(roles) {
    const u = getUser();
    if (!u) return false;
    if (!roles || roles.indexOf('*') > -1) return true;
    return roles.indexOf(u.role) > -1;
  }

  /**
   * هل يملك المستخدم الحالي صلاحية دقيقة؟ (وفق مصفوفة الصلاحيات القابلة للتخصيص)
   * المدير يملك كل شيء. عند غياب المصفوفة (جلسة قديمة) يُسمح للمدير فقط احتياطاً.
   */
  function cap(capability) {
    const u = getUser();
    if (!u) return false;
    if (u.role === 'admin') return true;
    const perms = getPerms();
    if (perms && perms[u.role]) return !!perms[u.role][capability];
    return false;
  }

  /**
   * هل المستخدم قارئ فقط؟ (يبقى للتوافق مع نداءات سابقة)
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
    getPerms: getPerms,
    isLoggedIn: isLoggedIn,
    login: login,
    logout: logout,
    requireAuth: requireAuth,
    can: can,
    cap: cap,
    isReadOnly: isReadOnly,
    roleLabel: roleLabel
  };
})();
