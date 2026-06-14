/**
 * Notifications.gs — الإشعارات الداخلية والتنبيهات الدورية
 */

function handleNotifications_list(payload, user) {
  var rows = readRows_('Notifications').map(stripRow_);
  // المستخدم يرى إشعاراته الموجّهة له أو الإشعارات العامة (UserID فارغ)
  rows = rows.filter(function (r) {
    return String(r.UserID) === String(user.ID) || r.UserID === '' || r.UserID === null;
  });
  if (payload && payload.unreadOnly) {
    rows = rows.filter(function (r) { return !isTrue_(r.IsRead); });
  }
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

/**
 * توليد التنبيهات الدورية يدوياً (أو عبر Trigger مجدول).
 * - بلاغات متأخرة: مفتوحة منذ أكثر من 7 أيام.
 * - صيانة دورية: أصول لم تُصَن منذ أكثر من 180 يوماً.
 */
function handleNotifications_generate(payload, user) {
  var created = runScheduledChecks_();
  audit_(user, 'generateNotifications', 'Notifications', '');
  return { created: created };
}

/* ---------------------------------------------------------------------------
 * دوال مساعدة للإشعارات (تُستدعى أيضاً من وحدات أخرى)
 * ------------------------------------------------------------------------- */

/**
 * إنشاء إشعار لمستخدم محدد (userId='' يعني إشعار عام لكل المستخدمين).
 */
function createNotification_(userId, title, body, type, refModule, refId) {
  insertRow_('Notifications', {
    ID: genId_('NTF'),
    UserID: userId || '',
    Title: title,
    Body: body || '',
    Type: type || 'info',
    IsRead: false,
    RefModule: refModule || '',
    RefID: refId || '',
    CreatedAt: nowIso_()
  });
}

/**
 * إشعار كل المستخدمين الذين يملكون أحد الأدوار المحددة.
 */
function notifyRole_(roles, title, body, refModule, refId) {
  var users = readRows_('Users');
  users.forEach(function (u) {
    if (roles.indexOf(u.Role) > -1 && isTrue_(u.Active)) {
      createNotification_(u.ID, title, body, 'alert', refModule, refId);
    }
  });
}

/**
 * الفحوصات المجدولة — تُستدعى من Trigger زمني أو يدوياً.
 * يعيد عدد الإشعارات المنشأة.
 */
function runScheduledChecks_() {
  var count = 0;
  var now = Date.now();
  var DAY = 24 * 3600 * 1000;

  // 1) بلاغات متأخرة (مفتوحة > 7 أيام وليست مكتملة)
  var reports = readRows_('Reports');
  reports.forEach(function (r) {
    var open = (r.Status !== 'مكتمل');
    var age = now - new Date(r.CreatedAt).getTime();
    if (open && age > 7 * DAY) {
      notifyRole_(['admin', 'supervisor'], 'بلاغ متأخر',
        'البلاغ "' + (r.Description || r.ID) + '" مفتوح منذ أكثر من 7 أيام.', 'report', r.ID);
      count++;
    }
  });

  // 2) صيانة دورية للأصول (آخر صيانة > 180 يوماً)
  var assets = readRows_('Assets');
  assets.forEach(function (a) {
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

function isTrue_(v) {
  return v === true || String(v).toLowerCase() === 'true';
}
