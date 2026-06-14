/**
 * Users.gs — إدارة المستخدمين والصلاحيات (admin فقط)
 */

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

  // منع تكرار البريد
  var exists = readRows_('Users').some(function (u) {
    return String(u.Email).trim().toLowerCase() === email;
  });
  if (exists) throw new Error('البريد الإلكتروني مستخدم مسبقاً.');
  if (String(payload.Password).length < 6) throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');

  var obj = {
    ID: genId_('USR'),
    Name: payload.Name,
    Email: email,
    Role: payload.Role,
    PasswordHash: hashPassword_(payload.Password),
    Active: payload.Active === false ? false : true,
    CreatedAt: nowIso_()
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
  // منع المدير من إيقاف نفسه (لتفادي إغلاق النظام)
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
