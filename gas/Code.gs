/**
 * ============================================================================
 *  نظام العناية بالمساجد — كود Google Apps Script الكامل (ملف واحد)
 * ============================================================================
 *  انسخ هذا الملف بالكامل والصقه في ملف Code.gs داخل محرر Apps Script.
 *
 *  محتويات الملف (مقسّم لأقسام — استخدم بحث Ctrl+F للتنقل):
 *    [1] الإعدادات والمخطط (Config)
 *    [2] أدوات مساعدة (Utils)
 *    [3] دوال مشتركة بين الوحدات (Shared)
 *    [4] الموجّه الرئيسي / API Router (APIDispatcher)
 *    [5] المصادقة والجلسات (Auth)
 *    [6] لوحة التحكم (Dashboard)
 *    [7] المساجد (Mosques)
 *    [8] الزيارات الميدانية (Visits)
 *    [9] البلاغات (Reports)
 *    [10] الصيانة (Maintenance)
 *    [11] النظافة (Cleaning)
 *    [12] الأصول (Assets)
 *    [13] الإشعارات (Notifications)
 *    [14] المستخدمون (Users)
 *    [15] التهيئة والمشغّلات (Setup)
 *
 *  لإضافة عملية جديدة: أنشئ دالة handleX_y(payload, user) في القسم المناسب،
 *  ثم سجّلها في جدول getRoutes_() ضمن القسم [4].
 * ============================================================================
 */


/* ============================================================================
 * [1] الإعدادات والمخطط (Config)
 * ========================================================================== */

var APP_VERSION = '1.0.0';

/** مدة صلاحية جلسة الدخول بالساعات. */
var SESSION_TTL_HOURS = 12;

/**
 * تعريف كل شيت: الاسم + ترتيب الأعمدة (= ترتيبها الفعلي في Google Sheet).
 * أي عمود جديد يُضاف في النهاية حفاظاً على التوافق.
 */
var SHEETS = {
  Users: {
    name: 'Users',
    columns: ['ID', 'Name', 'Email', 'Role', 'PasswordHash', 'Active', 'CreatedAt']
  },
  Sessions: {
    name: 'Sessions',
    columns: ['Token', 'UserID', 'ExpiresAt', 'CreatedAt']
  },
  Mosques: {
    name: 'Mosques',
    columns: ['ID', 'Name', 'District', 'City', 'Lat', 'Lng', 'Capacity',
              'Toilets', 'ACs', 'Courts', 'Notes', 'Images', 'CreatedAt', 'UpdatedAt', 'MapURL']
  },
  Visits: {
    name: 'Visits',
    columns: ['ID', 'MosqueID', 'Date', 'Inspector', 'CleanRating', 'MaintRating',
              'ACRating', 'ToiletRating', 'Notes', 'Images', 'CreatedBy', 'CreatedAt']
  },
  Reports: {
    name: 'Reports',
    columns: ['ID', 'MosqueID', 'Type', 'Priority', 'Description', 'Status',
              'Images', 'CreatedBy', 'CreatedAt', 'UpdatedAt', 'ResolvedAt']
  },
  Maintenance: {
    name: 'Maintenance',
    columns: ['ID', 'MosqueID', 'Contractor', 'Cost', 'Date', 'Description',
              'Documents', 'CreatedBy', 'CreatedAt']
  },
  Cleaning: {
    name: 'Cleaning',
    columns: ['ID', 'MosqueID', 'ScheduleType', 'LastVisit', 'NextVisit',
              'Rating', 'Notes', 'CreatedBy', 'CreatedAt']
  },
  Assets: {
    name: 'Assets',
    columns: ['ID', 'MosqueID', 'Type', 'AssetNumber', 'Status',
              'LastMaintDate', 'Notes', 'CreatedAt', 'UpdatedAt']
  },
  Notifications: {
    name: 'Notifications',
    columns: ['ID', 'UserID', 'Title', 'Body', 'Type', 'IsRead', 'RefModule', 'RefID', 'CreatedAt']
  },
  AuditLog: {
    name: 'AuditLog',
    columns: ['ID', 'UserID', 'UserName', 'Action', 'Module', 'RecordID', 'Timestamp']
  }
};

/** القيم المرجعية (Enums) المستخدمة في الواجهة والتحقق. */
var ENUMS = {
  roles: ['admin', 'supervisor', 'inspector', 'viewer'],
  reportStatus: ['جديد', 'تحت التنفيذ', 'مكتمل', 'مؤجل'],
  reportPriority: ['منخفضة', 'متوسطة', 'عالية', 'حرجة'],
  reportTypes: ['نظافة', 'صيانة', 'تكييف', 'دورات مياه', 'كهرباء', 'سباكة', 'أخرى'],
  assetTypes: ['مكيف', 'سماعة', 'شاشة', 'فرش', 'خزان مياه', 'إضاءة', 'أخرى'],
  assetStatus: ['يعمل', 'يحتاج صيانة', 'معطل', 'خارج الخدمة'],
  cleaningSchedule: ['يومي', 'أسبوعي', 'نصف شهري', 'شهري']
};


/* ============================================================================
 * [2] أدوات مساعدة (Utils)
 * ========================================================================== */

/** إرجاع الـ Spreadsheet النشط (الملف الذي يحتوي السكربت). */
function getSS_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/** إرجاع شيت بالاسم، مع إنشائه ووضع رؤوس الأعمدة إن لم يكن موجوداً. */
function getSheet_(key) {
  var def = SHEETS[key];
  if (!def) throw new Error('شيت غير معرّف: ' + key);
  var ss = getSS_();
  var sh = ss.getSheetByName(def.name);
  if (!sh) {
    sh = ss.insertSheet(def.name);
    sh.appendRow(def.columns);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** قراءة كل صفوف شيت ككائنات JS مفهرسة بأسماء الأعمدة. */
function readRows_(key) {
  var sh = getSheet_(key);
  var range = sh.getDataRange().getValues();
  if (range.length < 2) return [];
  var headers = range[0];
  var out = [];
  for (var i = 1; i < range.length; i++) {
    var row = range[i];
    if (isEmptyRow_(row)) continue;
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c]] = row[c];
    }
    obj.__row = i + 1; // رقم الصف الفعلي في الشيت (1-based)
    out.push(obj);
  }
  return out;
}

/** إيجاد صف واحد بقيمة معرّف ID. */
function findById_(key, id) {
  var rows = readRows_(key);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].ID) === String(id)) return rows[i];
  }
  return null;
}

/** إضافة صف جديد من كائن obj وفق ترتيب الأعمدة المعرّف. يعيد الكائن المُضاف. */
function insertRow_(key, obj) {
  var def = SHEETS[key];
  var sh = getSheet_(key);
  var row = def.columns.map(function (col) {
    return obj[col] !== undefined && obj[col] !== null ? obj[col] : '';
  });
  sh.appendRow(row);
  return obj;
}

/** تحديث صف موجود حسب رقمه. obj يحتوي القيم الجديدة فقط. */
function updateRow_(key, rowNumber, obj) {
  var def = SHEETS[key];
  var sh = getSheet_(key);
  var headers = def.columns;
  var current = sh.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  for (var c = 0; c < headers.length; c++) {
    if (obj[headers[c]] !== undefined) {
      current[c] = obj[headers[c]];
    }
  }
  sh.getRange(rowNumber, 1, 1, headers.length).setValues([current]);
  return rowToObject_(headers, current);
}

/** حذف صف حسب المعرّف. يعيد true إذا تم الحذف. */
function deleteById_(key, id) {
  var rows = readRows_(key);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].ID) === String(id)) {
      getSheet_(key).deleteRow(rows[i].__row);
      return true;
    }
  }
  return false;
}

function rowToObject_(headers, row) {
  var obj = {};
  for (var c = 0; c < headers.length; c++) obj[headers[c]] = row[c];
  return obj;
}

function isEmptyRow_(row) {
  for (var i = 0; i < row.length; i++) {
    if (row[i] !== '' && row[i] !== null && row[i] !== undefined) return false;
  }
  return true;
}

/** توليد معرّف فريد مع بادئة (مثل: MSQ-1718374923-482). */
function genId_(prefix) {
  return (prefix || 'ID') + '-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
}

/** الوقت الحالي بصيغة ISO. */
function nowIso_() {
  return new Date().toISOString();
}

/** تجزئة كلمة المرور باستخدام SHA-256 مع ملح (salt) من خصائص السكربت. */
function hashPassword_(password) {
  var salt = PropertiesService.getScriptProperties().getProperty('PWD_SALT') || 'masajid-care-salt';
  var raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + '::' + password,
    Utilities.Charset.UTF_8
  );
  return raw.map(function (b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

/** تسجيل عملية في سجل التدقيق (AuditLog). */
function audit_(user, action, module, recordId) {
  try {
    insertRow_('AuditLog', {
      ID: genId_('LOG'),
      UserID: user ? user.ID : '',
      UserName: user ? user.Name : '',
      Action: action,
      Module: module,
      RecordID: recordId || '',
      Timestamp: nowIso_()
    });
  } catch (e) { /* السجل لا يجب أن يكسر العملية الأصلية */ }
}

/** التحقق من الحقول المطلوبة في payload. */
function requireFields_(payload, fields) {
  var missing = [];
  fields.forEach(function (f) {
    if (payload[f] === undefined || payload[f] === null || payload[f] === '') missing.push(f);
  });
  if (missing.length) {
    throw new Error('حقول مطلوبة ناقصة: ' + missing.join('، '));
  }
}

/** تحويل قيمة لرقم آمن. */
function toNum_(v) {
  var n = Number(v);
  return isNaN(n) ? 0 : n;
}

function isTrue_(v) {
  return v === true || String(v).toLowerCase() === 'true';
}


/* ============================================================================
 * [3] دوال مشتركة بين الوحدات (Shared)
 * ========================================================================== */

/** إزالة الحقل الداخلي __row قبل إرسال الصف للواجهة. */
function stripRow_(row) {
  var clone = {};
  for (var k in row) {
    if (k !== '__row') clone[k] = row[k];
  }
  return clone;
}

/** انتقاء مجموعة حقول محددة من كائن (لتطبيق التحديثات الجزئية بأمان). */
function pick_(obj, keys) {
  var out = {};
  keys.forEach(function (k) {
    if (obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
}

/** بناء خريطة معرّف المسجد -> اسمه. */
function mosqueNameMap_() {
  var map = {};
  readRows_('Mosques').forEach(function (m) { map[m.ID] = m.Name; });
  return map;
}

/** إثراء قائمة عناصر بإضافة MosqueName بناءً على MosqueID. */
function enrichMosqueName_(items) {
  var map = mosqueNameMap_();
  items.forEach(function (it) { it.MosqueName = map[it.MosqueID] || ''; });
  return items;
}

/** فلترة عامة حسب MosqueID إن وُجد في payload. */
function filterByMosque_(rows, payload) {
  if (payload && payload.mosqueId) {
    return rows.filter(function (r) { return String(r.MosqueID) === String(payload.mosqueId); });
  }
  return rows;
}

/** فلترة عناصر ضمن فترة زمنية (dateField بين from و to إن وُجدا). */
function filterByPeriod_(rows, payload, dateField) {
  var from = payload && payload.from ? new Date(payload.from).getTime() : null;
  var to   = payload && payload.to   ? new Date(payload.to).getTime()   : null;
  return rows.filter(function (r) {
    if (!r[dateField]) return true;
    var t = new Date(r[dateField]).getTime();
    if (from !== null && t < from) return false;
    if (to !== null && t > to) return false;
    return true;
  });
}


/* ============================================================================
 * [4] الموجّه الرئيسي / API Router (APIDispatcher)
 * ========================================================================== */

/**
 * جدول التوجيه (Route Table).
 * المفتاح = اسم الـ action. القيمة = { fn, auth, roles }.
 * الأدوار: admin / supervisor / inspector / viewer  ('*' = الجميع).
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

/** معالج طلبات POST (الطريقة الأساسية لكل العمليات). */
function doPost(e) {
  return dispatch_(e);
}

/** معالج طلبات GET (فحص الحالة فقط — health check). */
function doGet(e) {
  if (e && e.parameter && e.parameter.action) {
    return dispatch_(e, true);
  }
  return jsonOutput_({ ok: true, data: { service: 'Masajid Care API', version: APP_VERSION, time: new Date().toISOString() } });
}

/** المحرّك الرئيسي للتوجيه. */
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

      if (route.roles && route.roles.indexOf('*') === -1 && route.roles.indexOf(user.role) === -1 &&
          route.roles.indexOf(user.Role) === -1) {
        return jsonOutput_({ ok: false, error: { code: 'FORBIDDEN', message: 'لا تملك صلاحية تنفيذ هذه العملية.' } });
      }
    }

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

/** قراءة جسم الطلب وتحويله إلى كائن JS. */
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

/** بناء استجابة JSON موحّدة. */
function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


/* ============================================================================
 * [5] المصادقة والجلسات (Auth)
 * ========================================================================== */

/** تسجيل الدخول. payload: { email, password } -> { token, user } */
function handleAuth_login(payload) {
  requireFields_(payload, ['email', 'password']);
  var email = String(payload.email).trim().toLowerCase();
  var hash = hashPassword_(payload.password);

  var users = readRows_('Users');
  var user = null;
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].Email).trim().toLowerCase() === email) { user = users[i]; break; }
  }

  if (!user) throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
  if (!isTrue_(user.Active)) throw new Error('هذا الحساب موقوف. راجع مدير النظام.');
  if (String(user.PasswordHash) !== hash) throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة.');

  var token = createSession_(user.ID);
  audit_(user, 'login', 'Auth', user.ID);
  return { token: token, user: publicUser_(user) };
}

/** إرجاع بيانات المستخدم الحالي من التوكن. */
function handleAuth_me(payload, user) {
  return { user: publicUser_(user) };
}

/** تسجيل الخروج: حذف الجلسة. */
function handleAuth_logout(payload, user) {
  if (payload && payload.token) deleteSessionByToken_(payload.token);
  return { done: true };
}

/** تغيير كلمة المرور للمستخدم الحالي. payload: { oldPassword, newPassword } */
function handleAuth_changePassword(payload, user) {
  requireFields_(payload, ['oldPassword', 'newPassword']);
  var full = findById_('Users', user.ID);
  if (!full) throw new Error('المستخدم غير موجود.');
  if (String(full.PasswordHash) !== hashPassword_(payload.oldPassword)) {
    throw new Error('كلمة المرور الحالية غير صحيحة.');
  }
  if (String(payload.newPassword).length < 6) {
    throw new Error('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل.');
  }
  updateRow_('Users', full.__row, { PasswordHash: hashPassword_(payload.newPassword) });
  audit_(user, 'changePassword', 'Auth', user.ID);
  return { done: true };
}

function createSession_(userId) {
  var token = Utilities.getUuid() + '-' + Date.now();
  var expires = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000).toISOString();
  insertRow_('Sessions', { Token: token, UserID: userId, ExpiresAt: expires, CreatedAt: nowIso_() });
  cleanupSessions_();
  return token;
}

/** التحقق من توكن. يعيد { ok, user } أو { ok:false }. */
function validateToken_(token) {
  if (!token) return { ok: false };
  var sessions = readRows_('Sessions');
  var session = null;
  for (var i = 0; i < sessions.length; i++) {
    if (String(sessions[i].Token) === String(token)) { session = sessions[i]; break; }
  }
  if (!session) return { ok: false };
  if (new Date(session.ExpiresAt).getTime() < Date.now()) {
    deleteSessionByToken_(session.Token);
    return { ok: false };
  }
  var user = findById_('Users', session.UserID);
  if (!user) return { ok: false };
  if (!isTrue_(user.Active)) return { ok: false };
  return { ok: true, user: user };
}

function deleteSessionByToken_(token) {
  var sh = getSheet_('Sessions');
  var rows = readRows_('Sessions');
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].Token) === String(token)) { sh.deleteRow(rows[i].__row); return; }
  }
}

/** إزالة الجلسات المنتهية للحفاظ على نظافة الشيت. */
function cleanupSessions_() {
  var sh = getSheet_('Sessions');
  var rows = readRows_('Sessions');
  for (var i = rows.length - 1; i >= 0; i--) {
    if (new Date(rows[i].ExpiresAt).getTime() < Date.now()) sh.deleteRow(rows[i].__row);
  }
}

/** تجريد الحقول الحساسة قبل إرسال بيانات المستخدم للواجهة. */
function publicUser_(user) {
  return { id: user.ID, name: user.Name, email: user.Email, role: user.Role };
}


/* ============================================================================
 * [6] لوحة التحكم (Dashboard)
 * ========================================================================== */

function handleDashboard_stats(payload, user) {
  var mosques = readRows_('Mosques');
  var reports = readRows_('Reports');
  var visits = readRows_('Visits');
  var maintenance = readRows_('Maintenance');
  var assets = readRows_('Assets');

  var now = new Date();
  var monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  var openReports = reports.filter(function (r) { return r.Status !== 'مكتمل'; });
  var criticalReports = reports.filter(function (r) { return r.Priority === 'حرجة' && r.Status !== 'مكتمل'; });
  var visitsThisMonth = visits.filter(function (v) { return new Date(v.Date).getTime() >= monthStart; });
  var maintThisMonth = maintenance.filter(function (m) { return new Date(m.Date).getTime() >= monthStart; });

  var byStatus = {};
  ENUMS.reportStatus.forEach(function (s) { byStatus[s] = 0; });
  reports.forEach(function (r) { if (byStatus[r.Status] !== undefined) byStatus[r.Status]++; });

  var byType = {};
  reports.forEach(function (r) { byType[r.Type] = (byType[r.Type] || 0) + 1; });

  var assetsByStatus = {};
  assets.forEach(function (a) { assetsByStatus[a.Status] = (assetsByStatus[a.Status] || 0) + 1; });

  var visitsTrend = monthlyTrend_(visits, 'Date', 6);
  var maintCostTrend = monthlyTrend_(maintenance, 'Date', 6, 'Cost');

  return {
    cards: {
      mosques: mosques.length,
      openReports: openReports.length,
      criticalReports: criticalReports.length,
      visitsThisMonth: visitsThisMonth.length,
      maintenanceCount: maintenance.length,
      maintenanceThisMonth: maintThisMonth.length,
      assets: assets.length
    },
    charts: {
      reportsByStatus: byStatus,
      reportsByType: byType,
      assetsByStatus: assetsByStatus,
      visitsTrend: visitsTrend,
      maintCostTrend: maintCostTrend
    }
  };
}

/** سلسلة شهرية لآخر n أشهر. مع sumField تجمع القيم، وإلا تَعُدّ العناصر. */
function monthlyTrend_(rows, dateField, months, sumField) {
  var buckets = {};
  var labels = [];
  var now = new Date();
  for (var i = months - 1; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    var key = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
    buckets[key] = 0;
    labels.push(key);
  }
  rows.forEach(function (r) {
    if (!r[dateField]) return;
    var d = new Date(r[dateField]);
    var key = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
    if (buckets[key] !== undefined) buckets[key] += sumField ? toNum_(r[sumField]) : 1;
  });
  return labels.map(function (k) { return { label: k, value: buckets[k] }; });
}


/* ============================================================================
 * [7] المساجد (Mosques)
 * ========================================================================== */

function handleMosques_list(payload) {
  var rows = readRows_('Mosques').map(stripRow_);
  if (payload.city)     rows = rows.filter(function (r) { return String(r.City) === String(payload.city); });
  if (payload.district) rows = rows.filter(function (r) { return String(r.District) === String(payload.district); });
  if (payload.q) {
    var q = String(payload.q).toLowerCase();
    rows = rows.filter(function (r) { return String(r.Name).toLowerCase().indexOf(q) > -1; });
  }
  return { items: rows, total: rows.length };
}

function handleMosques_get(payload) {
  requireFields_(payload, ['id']);
  var row = findById_('Mosques', payload.id);
  if (!row) throw new Error('المسجد غير موجود.');
  return { item: stripRow_(row) };
}

function handleMosques_create(payload, user) {
  requireFields_(payload, ['Name', 'District', 'City']);
  var lat = payload.Lat || '', lng = payload.Lng || '';
  var mapUrl = payload.MapURL || '';
  if (mapUrl) {
    var c = resolveMapUrl_(mapUrl);
    if (c) { lat = c.lat; lng = c.lng; }
  }
  var obj = {
    ID: genId_('MSQ'), Name: payload.Name, District: payload.District, City: payload.City,
    Lat: lat, Lng: lng, Capacity: toNum_(payload.Capacity),
    Toilets: toNum_(payload.Toilets), ACs: toNum_(payload.ACs), Courts: toNum_(payload.Courts),
    Notes: payload.Notes || '', Images: payload.Images || '', CreatedAt: nowIso_(), UpdatedAt: nowIso_(),
    MapURL: mapUrl
  };
  insertRow_('Mosques', obj);
  audit_(user, 'create', 'Mosques', obj.ID);
  return { item: obj };
}

function handleMosques_update(payload, user) {
  requireFields_(payload, ['id']);
  var row = findById_('Mosques', payload.id);
  if (!row) throw new Error('المسجد غير موجود.');
  var patch = pick_(payload, ['Name','District','City','Capacity','Toilets','ACs','Courts','Notes','Images']);
  // إن أُرسل رابط خرائط، خزّنه واستخرج منه الإحداثيات تلقائياً
  if (payload.MapURL !== undefined) {
    patch.MapURL = payload.MapURL;
    if (payload.MapURL) {
      var c = resolveMapUrl_(payload.MapURL);
      if (c) { patch.Lat = c.lat; patch.Lng = c.lng; }
    } else {
      patch.Lat = ''; patch.Lng = '';
    }
  }
  // السماح بإدخال إحداثيات يدوية صريحة عند الحاجة
  if (payload.Lat !== undefined) patch.Lat = payload.Lat;
  if (payload.Lng !== undefined) patch.Lng = payload.Lng;
  patch.UpdatedAt = nowIso_();
  var updated = updateRow_('Mosques', row.__row, patch);
  audit_(user, 'update', 'Mosques', payload.id);
  return { item: updated };
}

/**
 * استخراج الإحداثيات من رابط Google Maps.
 * يدعم الروابط الكاملة (تحتوي الإحداثيات) والروابط المختصرة (maps.app.goo.gl /
 * goo.gl) عبر تتبّع التحويل (redirect) وقراءة الرابط النهائي.
 * يعيد { lat, lng } كنصوص، أو null إن تعذّر.
 */
function resolveMapUrl_(url) {
  if (!url) return null;
  var coords = extractCoords_(url);
  if (coords) return coords;

  // رابط مختصر: اتبع سلسلة التحويلات واستخرج الإحداثيات من كل وجهة
  try {
    var current = url;
    for (var i = 0; i < 4; i++) {
      var resp = UrlFetchApp.fetch(current, { followRedirects: false, muteHttpExceptions: true });
      var code = resp.getResponseCode();
      if (code >= 300 && code < 400) {
        var headers = resp.getHeaders();
        var loc = headers['Location'] || headers['location'];
        if (!loc) break;
        coords = extractCoords_(loc);
        if (coords) return coords;
        current = loc;
      } else {
        // وصلنا للوجهة النهائية: جرّب استخراج الإحداثيات من جسم الصفحة
        coords = extractCoords_(resp.getContentText());
        if (coords) return coords;
        break;
      }
    }
  } catch (e) { /* تجاهل أخطاء الشبكة */ }
  return null;
}

/** البحث عن أول زوج إحداثيات (lat,lng) ضمن نص/رابط بصيغ Google Maps الشائعة. */
function extractCoords_(text) {
  if (!text) return null;
  var patterns = [
    /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,        // .../@24.71,46.67,17z
    /[?&]q=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,    // ?q=24.71,46.67
    /[?&]ll=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,   // ?ll=24.71,46.67
    /[?&]daddr=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,// ?daddr=24.71,46.67
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,     // !3d24.71!4d46.67
    /\/(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/         // /24.71,46.67
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = String(text).match(patterns[i]);
    if (m) return { lat: m[1], lng: m[2] };
  }
  return null;
}

function handleMosques_delete(payload, user) {
  requireFields_(payload, ['id']);
  if (!deleteById_('Mosques', payload.id)) throw new Error('المسجد غير موجود.');
  audit_(user, 'delete', 'Mosques', payload.id);
  return { done: true };
}


/* ============================================================================
 * [8] الزيارات الميدانية (Visits)
 * ========================================================================== */

function handleVisits_list(payload) {
  var rows = readRows_('Visits').map(stripRow_);
  rows = filterByMosque_(rows, payload);
  rows = filterByPeriod_(rows, payload, 'Date');
  rows = enrichMosqueName_(rows);
  rows.sort(function (a, b) { return new Date(b.Date) - new Date(a.Date); });
  return { items: rows, total: rows.length };
}

function handleVisits_get(payload) {
  requireFields_(payload, ['id']);
  var row = findById_('Visits', payload.id);
  if (!row) throw new Error('الزيارة غير موجودة.');
  return { item: enrichMosqueName_([stripRow_(row)])[0] };
}

function handleVisits_create(payload, user) {
  requireFields_(payload, ['MosqueID', 'Date']);
  var obj = {
    ID: genId_('VST'), MosqueID: payload.MosqueID, Date: payload.Date,
    Inspector: payload.Inspector || user.Name,
    CleanRating: toNum_(payload.CleanRating), MaintRating: toNum_(payload.MaintRating),
    ACRating: toNum_(payload.ACRating), ToiletRating: toNum_(payload.ToiletRating),
    Notes: payload.Notes || '', Images: payload.Images || '', CreatedBy: user.Name, CreatedAt: nowIso_()
  };
  insertRow_('Visits', obj);
  audit_(user, 'create', 'Visits', obj.ID);
  return { item: obj };
}

function handleVisits_update(payload, user) {
  requireFields_(payload, ['id']);
  var row = findById_('Visits', payload.id);
  if (!row) throw new Error('الزيارة غير موجودة.');
  var patch = pick_(payload, ['MosqueID','Date','Inspector','CleanRating','MaintRating','ACRating','ToiletRating','Notes','Images']);
  var updated = updateRow_('Visits', row.__row, patch);
  audit_(user, 'update', 'Visits', payload.id);
  return { item: updated };
}

function handleVisits_delete(payload, user) {
  requireFields_(payload, ['id']);
  if (!deleteById_('Visits', payload.id)) throw new Error('الزيارة غير موجودة.');
  audit_(user, 'delete', 'Visits', payload.id);
  return { done: true };
}


/* ============================================================================
 * [9] البلاغات (Reports)
 * ========================================================================== */

function handleReports_list(payload) {
  var rows = readRows_('Reports').map(stripRow_);
  rows = filterByMosque_(rows, payload);
  if (payload.status)   rows = rows.filter(function (r) { return String(r.Status) === String(payload.status); });
  if (payload.priority) rows = rows.filter(function (r) { return String(r.Priority) === String(payload.priority); });
  if (payload.type)     rows = rows.filter(function (r) { return String(r.Type) === String(payload.type); });
  rows = filterByPeriod_(rows, payload, 'CreatedAt');
  rows = enrichMosqueName_(rows);
  rows.sort(function (a, b) { return new Date(b.CreatedAt) - new Date(a.CreatedAt); });
  return { items: rows, total: rows.length };
}

function handleReports_get(payload) {
  requireFields_(payload, ['id']);
  var row = findById_('Reports', payload.id);
  if (!row) throw new Error('البلاغ غير موجود.');
  return { item: enrichMosqueName_([stripRow_(row)])[0] };
}

function handleReports_create(payload, user) {
  requireFields_(payload, ['MosqueID', 'Type', 'Priority', 'Description']);
  var obj = {
    ID: genId_('RPT'), MosqueID: payload.MosqueID, Type: payload.Type, Priority: payload.Priority,
    Description: payload.Description, Status: payload.Status || 'جديد', Images: payload.Images || '',
    CreatedBy: user.Name, CreatedAt: nowIso_(), UpdatedAt: nowIso_(), ResolvedAt: ''
  };
  insertRow_('Reports', obj);
  audit_(user, 'create', 'Reports', obj.ID);
  if (obj.Priority === 'حرجة') {
    notifyRole_(['admin', 'supervisor'], 'بلاغ حرج جديد', obj.Description, 'report', obj.ID);
  }
  return { item: obj };
}

function handleReports_update(payload, user) {
  requireFields_(payload, ['id']);
  var row = findById_('Reports', payload.id);
  if (!row) throw new Error('البلاغ غير موجود.');
  var patch = pick_(payload, ['MosqueID','Type','Priority','Description','Images']);
  patch.UpdatedAt = nowIso_();
  var updated = updateRow_('Reports', row.__row, patch);
  audit_(user, 'update', 'Reports', payload.id);
  return { item: updated };
}

function handleReports_updateStatus(payload, user) {
  requireFields_(payload, ['id', 'status']);
  if (ENUMS.reportStatus.indexOf(payload.status) === -1) throw new Error('حالة غير صالحة.');
  var row = findById_('Reports', payload.id);
  if (!row) throw new Error('البلاغ غير موجود.');
  var patch = { Status: payload.status, UpdatedAt: nowIso_() };
  if (payload.status === 'مكتمل') patch.ResolvedAt = nowIso_();
  var updated = updateRow_('Reports', row.__row, patch);
  audit_(user, 'updateStatus:' + payload.status, 'Reports', payload.id);
  return { item: updated };
}

function handleReports_delete(payload, user) {
  requireFields_(payload, ['id']);
  if (!deleteById_('Reports', payload.id)) throw new Error('البلاغ غير موجود.');
  audit_(user, 'delete', 'Reports', payload.id);
  return { done: true };
}


/* ============================================================================
 * [10] الصيانة (Maintenance)
 * ========================================================================== */

function handleMaintenance_list(payload) {
  var rows = readRows_('Maintenance').map(stripRow_);
  rows = filterByMosque_(rows, payload);
  rows = filterByPeriod_(rows, payload, 'Date');
  rows = enrichMosqueName_(rows);
  rows.sort(function (a, b) { return new Date(b.Date) - new Date(a.Date); });
  return { items: rows, total: rows.length };
}

function handleMaintenance_get(payload) {
  requireFields_(payload, ['id']);
  var row = findById_('Maintenance', payload.id);
  if (!row) throw new Error('عمل الصيانة غير موجود.');
  return { item: enrichMosqueName_([stripRow_(row)])[0] };
}

function handleMaintenance_create(payload, user) {
  requireFields_(payload, ['MosqueID', 'Date']);
  var obj = {
    ID: genId_('MNT'), MosqueID: payload.MosqueID, Contractor: payload.Contractor || '',
    Cost: toNum_(payload.Cost), Date: payload.Date, Description: payload.Description || '',
    Documents: payload.Documents || '', CreatedBy: user.Name, CreatedAt: nowIso_()
  };
  insertRow_('Maintenance', obj);
  audit_(user, 'create', 'Maintenance', obj.ID);
  return { item: obj };
}

function handleMaintenance_update(payload, user) {
  requireFields_(payload, ['id']);
  var row = findById_('Maintenance', payload.id);
  if (!row) throw new Error('عمل الصيانة غير موجود.');
  var patch = pick_(payload, ['MosqueID','Contractor','Cost','Date','Description','Documents']);
  var updated = updateRow_('Maintenance', row.__row, patch);
  audit_(user, 'update', 'Maintenance', payload.id);
  return { item: updated };
}

function handleMaintenance_delete(payload, user) {
  requireFields_(payload, ['id']);
  if (!deleteById_('Maintenance', payload.id)) throw new Error('عمل الصيانة غير موجود.');
  audit_(user, 'delete', 'Maintenance', payload.id);
  return { done: true };
}


/* ============================================================================
 * [11] النظافة (Cleaning)
 * ========================================================================== */

function handleCleaning_list(payload) {
  var rows = readRows_('Cleaning').map(stripRow_);
  rows = filterByMosque_(rows, payload);
  rows = enrichMosqueName_(rows);
  rows.sort(function (a, b) { return new Date(b.LastVisit || 0) - new Date(a.LastVisit || 0); });
  return { items: rows, total: rows.length };
}

function handleCleaning_get(payload) {
  requireFields_(payload, ['id']);
  var row = findById_('Cleaning', payload.id);
  if (!row) throw new Error('سجل النظافة غير موجود.');
  return { item: enrichMosqueName_([stripRow_(row)])[0] };
}

function handleCleaning_create(payload, user) {
  requireFields_(payload, ['MosqueID', 'ScheduleType']);
  var obj = {
    ID: genId_('CLN'), MosqueID: payload.MosqueID, ScheduleType: payload.ScheduleType,
    LastVisit: payload.LastVisit || '', NextVisit: payload.NextVisit || '',
    Rating: toNum_(payload.Rating), Notes: payload.Notes || '', CreatedBy: user.Name, CreatedAt: nowIso_()
  };
  insertRow_('Cleaning', obj);
  audit_(user, 'create', 'Cleaning', obj.ID);
  return { item: obj };
}

function handleCleaning_update(payload, user) {
  requireFields_(payload, ['id']);
  var row = findById_('Cleaning', payload.id);
  if (!row) throw new Error('سجل النظافة غير موجود.');
  var patch = pick_(payload, ['MosqueID','ScheduleType','LastVisit','NextVisit','Rating','Notes']);
  var updated = updateRow_('Cleaning', row.__row, patch);
  audit_(user, 'update', 'Cleaning', payload.id);
  return { item: updated };
}

function handleCleaning_delete(payload, user) {
  requireFields_(payload, ['id']);
  if (!deleteById_('Cleaning', payload.id)) throw new Error('سجل النظافة غير موجود.');
  audit_(user, 'delete', 'Cleaning', payload.id);
  return { done: true };
}


/* ============================================================================
 * [12] الأصول (Assets)
 * ========================================================================== */

function handleAssets_list(payload) {
  var rows = readRows_('Assets').map(stripRow_);
  rows = filterByMosque_(rows, payload);
  if (payload.type)   rows = rows.filter(function (r) { return String(r.Type) === String(payload.type); });
  if (payload.status) rows = rows.filter(function (r) { return String(r.Status) === String(payload.status); });
  rows = enrichMosqueName_(rows);
  return { items: rows, total: rows.length };
}

function handleAssets_get(payload) {
  requireFields_(payload, ['id']);
  var row = findById_('Assets', payload.id);
  if (!row) throw new Error('الأصل غير موجود.');
  return { item: enrichMosqueName_([stripRow_(row)])[0] };
}

function handleAssets_create(payload, user) {
  requireFields_(payload, ['MosqueID', 'Type']);
  var obj = {
    ID: genId_('AST'), MosqueID: payload.MosqueID, Type: payload.Type,
    AssetNumber: payload.AssetNumber || '', Status: payload.Status || 'يعمل',
    LastMaintDate: payload.LastMaintDate || '', Notes: payload.Notes || '',
    CreatedAt: nowIso_(), UpdatedAt: nowIso_()
  };
  insertRow_('Assets', obj);
  audit_(user, 'create', 'Assets', obj.ID);
  return { item: obj };
}

function handleAssets_update(payload, user) {
  requireFields_(payload, ['id']);
  var row = findById_('Assets', payload.id);
  if (!row) throw new Error('الأصل غير موجود.');
  var patch = pick_(payload, ['MosqueID','Type','AssetNumber','Status','LastMaintDate','Notes']);
  patch.UpdatedAt = nowIso_();
  var updated = updateRow_('Assets', row.__row, patch);
  audit_(user, 'update', 'Assets', payload.id);
  return { item: updated };
}

function handleAssets_delete(payload, user) {
  requireFields_(payload, ['id']);
  if (!deleteById_('Assets', payload.id)) throw new Error('الأصل غير موجود.');
  audit_(user, 'delete', 'Assets', payload.id);
  return { done: true };
}


/* ============================================================================
 * [13] الإشعارات (Notifications)
 * ========================================================================== */

function handleNotifications_list(payload, user) {
  var rows = readRows_('Notifications').map(stripRow_);
  rows = rows.filter(function (r) {
    return String(r.UserID) === String(user.ID) || r.UserID === '' || r.UserID === null;
  });
  if (payload && payload.unreadOnly) rows = rows.filter(function (r) { return !isTrue_(r.IsRead); });
  rows.sort(function (a, b) { return new Date(b.CreatedAt) - new Date(a.CreatedAt); });
  var unread = rows.filter(function (r) { return !isTrue_(r.IsRead); }).length;
  return { items: rows, total: rows.length, unread: unread };
}

function handleNotifications_markRead(payload, user) {
  requireFields_(payload, ['id']);
  if (payload.id === 'ALL') {
    var rows = readRows_('Notifications');
    rows.forEach(function (r) {
      if ((String(r.UserID) === String(user.ID) || r.UserID === '') && !isTrue_(r.IsRead)) {
        updateRow_('Notifications', r.__row, { IsRead: true });
      }
    });
    return { done: true };
  }
  var row = findById_('Notifications', payload.id);
  if (!row) throw new Error('الإشعار غير موجود.');
  updateRow_('Notifications', row.__row, { IsRead: true });
  return { done: true };
}

/** توليد التنبيهات الدورية يدوياً (أو عبر Trigger مجدول). */
function handleNotifications_generate(payload, user) {
  var created = runScheduledChecks_();
  audit_(user, 'generateNotifications', 'Notifications', '');
  return { created: created };
}

/** إنشاء إشعار لمستخدم محدد (userId='' = إشعار عام). */
function createNotification_(userId, title, body, type, refModule, refId) {
  insertRow_('Notifications', {
    ID: genId_('NTF'), UserID: userId || '', Title: title, Body: body || '',
    Type: type || 'info', IsRead: false, RefModule: refModule || '', RefID: refId || '', CreatedAt: nowIso_()
  });
}

/** إشعار كل المستخدمين الذين يملكون أحد الأدوار المحددة. */
function notifyRole_(roles, title, body, refModule, refId) {
  readRows_('Users').forEach(function (u) {
    if (roles.indexOf(u.Role) > -1 && isTrue_(u.Active)) {
      createNotification_(u.ID, title, body, 'alert', refModule, refId);
    }
  });
}

/** الفحوصات المجدولة — يدوياً أو عبر Trigger. يعيد عدد الإشعارات المنشأة. */
function runScheduledChecks_() {
  var count = 0;
  var now = Date.now();
  var DAY = 24 * 3600 * 1000;

  readRows_('Reports').forEach(function (r) {
    var open = (r.Status !== 'مكتمل');
    var age = now - new Date(r.CreatedAt).getTime();
    if (open && age > 7 * DAY) {
      notifyRole_(['admin', 'supervisor'], 'بلاغ متأخر',
        'البلاغ "' + (r.Description || r.ID) + '" مفتوح منذ أكثر من 7 أيام.', 'report', r.ID);
      count++;
    }
  });

  readRows_('Assets').forEach(function (a) {
    if (!a.LastMaintDate) return;
    var age = now - new Date(a.LastMaintDate).getTime();
    if (age > 180 * DAY) {
      notifyRole_(['admin', 'supervisor'], 'صيانة دورية مستحقة',
        'الأصل "' + (a.Type + ' ' + (a.AssetNumber || '')).trim() + '" يحتاج صيانة دورية.', 'asset', a.ID);
      count++;
    }
  });

  return count;
}


/* ============================================================================
 * [14] المستخدمون (Users) — admin فقط
 * ========================================================================== */

function handleUsers_list(payload, user) {
  var rows = readRows_('Users').map(function (u) {
    return { ID: u.ID, Name: u.Name, Email: u.Email, Role: u.Role, Active: isTrue_(u.Active), CreatedAt: u.CreatedAt };
  });
  return { items: rows, total: rows.length };
}

function handleUsers_create(payload, user) {
  requireFields_(payload, ['Name', 'Email', 'Role', 'Password']);
  if (ENUMS.roles.indexOf(payload.Role) === -1) throw new Error('دور غير صالح.');
  var email = String(payload.Email).trim().toLowerCase();
  var exists = readRows_('Users').some(function (u) { return String(u.Email).trim().toLowerCase() === email; });
  if (exists) throw new Error('البريد الإلكتروني مستخدم مسبقاً.');
  if (String(payload.Password).length < 6) throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');

  var obj = {
    ID: genId_('USR'), Name: payload.Name, Email: email, Role: payload.Role,
    PasswordHash: hashPassword_(payload.Password), Active: payload.Active === false ? false : true, CreatedAt: nowIso_()
  };
  insertRow_('Users', obj);
  audit_(user, 'create', 'Users', obj.ID);
  return { item: { ID: obj.ID, Name: obj.Name, Email: obj.Email, Role: obj.Role, Active: obj.Active } };
}

function handleUsers_update(payload, user) {
  requireFields_(payload, ['id']);
  var row = findById_('Users', payload.id);
  if (!row) throw new Error('المستخدم غير موجود.');
  var patch = pick_(payload, ['Name', 'Role', 'Active']);
  if (payload.Role && ENUMS.roles.indexOf(payload.Role) === -1) throw new Error('دور غير صالح.');
  if (payload.Password) {
    if (String(payload.Password).length < 6) throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
    patch.PasswordHash = hashPassword_(payload.Password);
  }
  if (String(payload.id) === String(user.ID) && payload.Active === false) {
    throw new Error('لا يمكنك إيقاف حسابك الخاص.');
  }
  var updated = updateRow_('Users', row.__row, patch);
  audit_(user, 'update', 'Users', payload.id);
  return { item: { ID: updated.ID, Name: updated.Name, Email: updated.Email, Role: updated.Role, Active: isTrue_(updated.Active) } };
}

function handleUsers_delete(payload, user) {
  requireFields_(payload, ['id']);
  if (String(payload.id) === String(user.ID)) throw new Error('لا يمكنك حذف حسابك الخاص.');
  if (!deleteById_('Users', payload.id)) throw new Error('المستخدم غير موجود.');
  audit_(user, 'delete', 'Users', payload.id);
  return { done: true };
}


/* ============================================================================
 * [15] التهيئة والمشغّلات (Setup)
 *  شغّل الدوال التالية يدوياً من محرر Apps Script (مرة واحدة).
 * ========================================================================== */

/** إنشاء كل الشيتات + حساب المدير الافتراضي. شغّلها أولاً. */
function setup() {
  Object.keys(SHEETS).forEach(function (key) { getSheet_(key); });

  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('PWD_SALT')) props.setProperty('PWD_SALT', Utilities.getUuid());

  var users = readRows_('Users');
  if (users.length === 0) {
    insertRow_('Users', {
      ID: genId_('USR'), Name: 'مدير النظام', Email: 'admin@masajid.local',
      Role: 'admin', PasswordHash: hashPassword_('admin123'), Active: true, CreatedAt: nowIso_()
    });
    Logger.log('تم إنشاء حساب المدير: admin@masajid.local / admin123 (غيّر كلمة المرور فوراً)');
  }
  Logger.log('اكتملت التهيئة بنجاح ✓');
  return 'Setup complete';
}

/** إضافة بيانات تجريبية للتجربة (اختياري). */
function seedDemoData() {
  var m1 = handleMosques_create({ Name: 'جامع الملك فهد', District: 'حي العزيزية', City: 'الرياض', Capacity: 1200, Toilets: 12, ACs: 24, Courts: 2, Notes: 'جامع رئيسي' }, demoUser_());
  var m2 = handleMosques_create({ Name: 'مسجد النور', District: 'حي الروضة', City: 'الرياض', Capacity: 400, Toilets: 4, ACs: 8, Courts: 1 }, demoUser_());

  handleReports_create({ MosqueID: m1.item.ID, Type: 'تكييف', Priority: 'حرجة', Description: 'تعطل مكيفين في المصلى الرئيسي' }, demoUser_());
  handleReports_create({ MosqueID: m2.item.ID, Type: 'نظافة', Priority: 'متوسطة', Description: 'دورات المياه تحتاج تنظيف عميق' }, demoUser_());

  handleVisits_create({ MosqueID: m1.item.ID, Date: nowIso_(), CleanRating: 4, MaintRating: 3, ACRating: 2, ToiletRating: 4, Notes: 'زيارة دورية' }, demoUser_());
  handleAssets_create({ MosqueID: m1.item.ID, Type: 'مكيف', AssetNumber: 'AC-001', Status: 'يحتاج صيانة', LastMaintDate: '2025-01-10' }, demoUser_());
  handleMaintenance_create({ MosqueID: m1.item.ID, Contractor: 'شركة التبريد', Cost: 3500, Date: nowIso_(), Description: 'صيانة مكيفات' }, demoUser_());
  handleCleaning_create({ MosqueID: m2.item.ID, ScheduleType: 'أسبوعي', LastVisit: nowIso_(), Rating: 4, Notes: '' }, demoUser_());

  Logger.log('تمت إضافة البيانات التجريبية ✓');
}

function demoUser_() {
  return { ID: 'SYSTEM', Name: 'النظام', Role: 'admin' };
}

/** إعداد Trigger زمني يومي لتوليد التنبيهات الدورية تلقائياً. شغّلها مرة واحدة. */
function installDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dailyNotificationsJob') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyNotificationsJob').timeBased().everyDays(1).atHour(6).create();
  Logger.log('تم تثبيت المشغّل اليومي ✓');
}

/** الدالة التي يستدعيها المشغّل الزمني يومياً. */
function dailyNotificationsJob() {
  var n = runScheduledChecks_();
  Logger.log('تم توليد ' + n + ' إشعار/تنبيه.');
}
