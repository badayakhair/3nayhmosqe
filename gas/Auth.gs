/**
 * Auth.gs
 * ----------------------------------------------------------------------------
 * المصادقة وإدارة الجلسات: تسجيل الدخول، التحقق من التوكن، تسجيل الخروج،
 * وتغيير كلمة المرور. الجلسات تُخزّن في شيت Sessions.
 * ----------------------------------------------------------------------------
 */

/**
 * تسجيل الدخول.
 * payload: { email, password }
 * يعيد: { token, user }
 */
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
  if (String(user.Active).toLowerCase() === 'false' || user.Active === false) {
    throw new Error('هذا الحساب موقوف. راجع مدير النظام.');
  }
  if (String(user.PasswordHash) !== hash) {
    throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
  }

  var token = createSession_(user.ID);
  audit_(user, 'login', 'Auth', user.ID);

  return {
    token: token,
    user: publicUser_(user)
  };
}

/**
 * إرجاع بيانات المستخدم الحالي من التوكن.
 */
function handleAuth_me(payload, user) {
  return { user: publicUser_(user) };
}

/**
 * تسجيل الخروج: حذف الجلسة.
 */
function handleAuth_logout(payload, user) {
  if (payload && payload.token) {
    deleteSessionByToken_(payload.token);
  }
  return { done: true };
}

/**
 * تغيير كلمة المرور للمستخدم الحالي.
 * payload: { oldPassword, newPassword }
 */
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

/* ---------------------------------------------------------------------------
 * دوال الجلسات الداخلية
 * ------------------------------------------------------------------------- */

function createSession_(userId) {
  var token = Utilities.getUuid() + '-' + Date.now();
  var expires = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000).toISOString();
  insertRow_('Sessions', {
    Token: token,
    UserID: userId,
    ExpiresAt: expires,
    CreatedAt: nowIso_()
  });
  cleanupSessions_();
  return token;
}

/**
 * التحقق من توكن. يعيد { ok, user } أو { ok:false }.
 */
function validateToken_(token) {
  if (!token) return { ok: false };
  var sessions = readRows_('Sessions');
  var session = null;
  for (var i = 0; i < sessions.length; i++) {
    if (String(sessions[i].Token) === String(token)) { session = sessions[i]; break; }
  }
  if (!session) return { ok: false };
  if (new Date(session.ExpiresAt).getTime() < Date.now()) {
    deleteSessionByToken_(session.Token); // إزالة الجلسة المنتهية
    return { ok: false };
  }
  var user = findById_('Users', session.UserID);
  if (!user) return { ok: false };
  if (String(user.Active).toLowerCase() === 'false' || user.Active === false) return { ok: false };
  return { ok: true, user: user };
}

function deleteSessionByToken_(token) {
  var sh = getSheet_('Sessions');
  var rows = readRows_('Sessions');
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].Token) === String(token)) {
      sh.deleteRow(rows[i].__row);
      return;
    }
  }
}

/**
 * إزالة الجلسات المنتهية للحفاظ على نظافة الشيت.
 */
function cleanupSessions_() {
  var sh = getSheet_('Sessions');
  var rows = readRows_('Sessions');
  // الحذف من الأسفل للأعلى لتفادي إزاحة الصفوف
  for (var i = rows.length - 1; i >= 0; i--) {
    if (new Date(rows[i].ExpiresAt).getTime() < Date.now()) {
      sh.deleteRow(rows[i].__row);
    }
  }
}

/**
 * تجريد الحقول الحساسة قبل إرسال بيانات المستخدم للواجهة.
 */
function publicUser_(user) {
  return {
    id: user.ID,
    name: user.Name,
    email: user.Email,
    role: user.Role
  };
}
