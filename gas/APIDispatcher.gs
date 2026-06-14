/**
 * APIDispatcher.gs
 * ----------------------------------------------------------------------------
 * نقطة الدخول الوحيدة لكل طلبات الواجهة الأمامية (GitHub Pages).
 * يعمل كـ API Router: يستقبل الطلب، يتحقق من الصلاحية، ثم يوجّهه للمعالج.
 *
 * نمط الاتصال:
 *   - الواجهة ترسل POST مع Content-Type: text/plain لتفادي طلب CORS preflight.
 *   - جسم الطلب JSON يحتوي: { action, token, payload }
 *   - الاستجابة JSON موحّدة: { ok, data, error, meta }
 *
 * إضافة وحدة جديدة:
 *   1. أنشئ ملف Handler جديد (مثل Foo.gs) يصدّر دوال handleFoo_xxx(payload, user).
 *   2. سجّل المسارات في ROUTES أدناه.
 * ----------------------------------------------------------------------------
 */

/**
 * جدول التوجيه (Route Table).
 * المفتاح = اسم الـ action القادم من الواجهة.
 * القيمة = { fn: دالة المعالجة, roles: الأدوار المسموح لها, auth: هل يتطلب تسجيل دخول }
 *
 * الأدوار: 'admin' (مدير النظام), 'supervisor' (مشرف ميداني),
 *          'inspector' (مراقب), 'viewer' (قارئ فقط)
 */
function getRoutes_() {
  return {
    // ---- المصادقة ----
    'auth.login':            { fn: handleAuth_login,            auth: false },
    'auth.me':               { fn: handleAuth_me,               auth: true,  roles: ['*'] },
    'auth.logout':           { fn: handleAuth_logout,           auth: true,  roles: ['*'] },
    'auth.changePassword':   { fn: handleAuth_changePassword,   auth: true,  roles: ['*'] },

    // ---- لوحة التحكم ----
    'dashboard.stats':       { fn: handleDashboard_stats,       auth: true,  roles: ['*'] },

    // ---- المساجد ----
    'mosques.list':          { fn: handleMosques_list,          auth: true,  roles: ['*'] },
    'mosques.get':           { fn: handleMosques_get,           auth: true,  roles: ['*'] },
    'mosques.create':        { fn: handleMosques_create,        auth: true,  roles: ['admin','supervisor'] },
    'mosques.update':        { fn: handleMosques_update,        auth: true,  roles: ['admin','supervisor'] },
    'mosques.delete':        { fn: handleMosques_delete,        auth: true,  roles: ['admin'] },

    // ---- الزيارات الميدانية ----
    'visits.list':           { fn: handleVisits_list,           auth: true,  roles: ['*'] },
    'visits.get':            { fn: handleVisits_get,            auth: true,  roles: ['*'] },
    'visits.create':         { fn: handleVisits_create,         auth: true,  roles: ['admin','supervisor','inspector'] },
    'visits.update':         { fn: handleVisits_update,         auth: true,  roles: ['admin','supervisor','inspector'] },
    'visits.delete':         { fn: handleVisits_delete,         auth: true,  roles: ['admin','supervisor'] },

    // ---- البلاغات ----
    'reports.list':          { fn: handleReports_list,          auth: true,  roles: ['*'] },
    'reports.get':           { fn: handleReports_get,           auth: true,  roles: ['*'] },
    'reports.create':        { fn: handleReports_create,        auth: true,  roles: ['admin','supervisor','inspector'] },
    'reports.update':        { fn: handleReports_update,        auth: true,  roles: ['admin','supervisor'] },
    'reports.updateStatus':  { fn: handleReports_updateStatus,  auth: true,  roles: ['admin','supervisor'] },
    'reports.delete':        { fn: handleReports_delete,        auth: true,  roles: ['admin'] },

    // ---- الصيانة ----
    'maintenance.list':      { fn: handleMaintenance_list,      auth: true,  roles: ['*'] },
    'maintenance.get':       { fn: handleMaintenance_get,       auth: true,  roles: ['*'] },
    'maintenance.create':    { fn: handleMaintenance_create,    auth: true,  roles: ['admin','supervisor'] },
    'maintenance.update':    { fn: handleMaintenance_update,    auth: true,  roles: ['admin','supervisor'] },
    'maintenance.delete':    { fn: handleMaintenance_delete,    auth: true,  roles: ['admin'] },

    // ---- النظافة ----
    'cleaning.list':         { fn: handleCleaning_list,         auth: true,  roles: ['*'] },
    'cleaning.get':          { fn: handleCleaning_get,          auth: true,  roles: ['*'] },
    'cleaning.create':       { fn: handleCleaning_create,       auth: true,  roles: ['admin','supervisor','inspector'] },
    'cleaning.update':       { fn: handleCleaning_update,       auth: true,  roles: ['admin','supervisor','inspector'] },
    'cleaning.delete':       { fn: handleCleaning_delete,       auth: true,  roles: ['admin','supervisor'] },

    // ---- الأصول ----
    'assets.list':           { fn: handleAssets_list,           auth: true,  roles: ['*'] },
    'assets.get':            { fn: handleAssets_get,            auth: true,  roles: ['*'] },
    'assets.create':         { fn: handleAssets_create,         auth: true,  roles: ['admin','supervisor'] },
    'assets.update':         { fn: handleAssets_update,         auth: true,  roles: ['admin','supervisor'] },
    'assets.delete':         { fn: handleAssets_delete,         auth: true,  roles: ['admin'] },

    // ---- الإشعارات ----
    'notifications.list':    { fn: handleNotifications_list,    auth: true,  roles: ['*'] },
    'notifications.markRead':{ fn: handleNotifications_markRead, auth: true, roles: ['*'] },
    'notifications.generate':{ fn: handleNotifications_generate, auth: true, roles: ['admin','supervisor'] },

    // ---- المستخدمون / الصلاحيات ----
    'users.list':            { fn: handleUsers_list,            auth: true,  roles: ['admin'] },
    'users.create':          { fn: handleUsers_create,          auth: true,  roles: ['admin'] },
    'users.update':          { fn: handleUsers_update,          auth: true,  roles: ['admin'] },
    'users.delete':          { fn: handleUsers_delete,          auth: true,  roles: ['admin'] }
  };
}

/**
 * معالج طلبات POST (الطريقة الأساسية لكل العمليات).
 */
function doPost(e) {
  return dispatch_(e);
}

/**
 * معالج طلبات GET (يُستخدم لفحص الحالة فقط — health check).
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.action) {
    return dispatch_(e, true);
  }
  return jsonOutput_({ ok: true, data: { service: 'Masajid Care API', version: APP_VERSION, time: new Date().toISOString() } });
}

/**
 * المحرّك الرئيسي للتوجيه.
 */
function dispatch_(e, isGet) {
  var lock = LockService.getScriptLock();
  try {
    var body = parseRequest_(e, isGet);
    var action = body.action;
    if (!action) {
      return jsonOutput_({ ok: false, error: { code: 'NO_ACTION', message: 'لم يتم تحديد العملية (action).' } });
    }

    var routes = getRoutes_();
    var route = routes[action];
    if (!route) {
      return jsonOutput_({ ok: false, error: { code: 'UNKNOWN_ACTION', message: 'عملية غير معروفة: ' + action } });
    }

    var user = null;
    if (route.auth) {
      var session = validateToken_(body.token);
      if (!session.ok) {
        return jsonOutput_({ ok: false, error: { code: 'UNAUTHORIZED', message: 'الجلسة غير صالحة أو منتهية. يرجى تسجيل الدخول.' } });
      }
      user = session.user;

      // التحقق من الصلاحية حسب الدور
      if (route.roles && route.roles.indexOf('*') === -1 && route.roles.indexOf(user.role) === -1) {
        return jsonOutput_({ ok: false, error: { code: 'FORBIDDEN', message: 'لا تملك صلاحية تنفيذ هذه العملية.' } });
      }
    }

    // الكتابة تتطلب قفلاً لتفادي تعارض الصفوف
    var isWrite = /\.(create|update|delete|updateStatus|markRead|generate|changePassword)$/.test(action);
    if (isWrite) lock.waitLock(20000);

    var payload = body.payload || {};
    var data = route.fn(payload, user);

    return jsonOutput_({ ok: true, data: data });

  } catch (err) {
    return jsonOutput_({ ok: false, error: { code: 'SERVER_ERROR', message: String(err && err.message || err) } });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

/**
 * قراءة جسم الطلب وتحويله إلى كائن JS.
 */
function parseRequest_(e, isGet) {
  if (isGet) {
    return {
      action: e.parameter.action,
      token: e.parameter.token || '',
      payload: e.parameter.payload ? JSON.parse(e.parameter.payload) : {}
    };
  }
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }
  return JSON.parse(e.postData.contents);
}

/**
 * بناء استجابة JSON موحّدة.
 */
function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
