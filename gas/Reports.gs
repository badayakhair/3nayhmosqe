/**
 * Reports.gs — البلاغات والملاحظات (CRUD + إدارة الحالة)
 */

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
    ID: genId_('RPT'),
    MosqueID: payload.MosqueID,
    Type: payload.Type,
    Priority: payload.Priority,
    Description: payload.Description,
    Status: payload.Status || 'جديد',
    Images: payload.Images || '',
    CreatedBy: user.Name,
    CreatedAt: nowIso_(),
    UpdatedAt: nowIso_(),
    ResolvedAt: ''
  };
  insertRow_('Reports', obj);
  audit_(user, 'create', 'Reports', obj.ID);
  // إشعار للمشرفين عند البلاغات الحرجة
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
  if (ENUMS.reportStatus.indexOf(payload.status) === -1) {
    throw new Error('حالة غير صالحة.');
  }
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
