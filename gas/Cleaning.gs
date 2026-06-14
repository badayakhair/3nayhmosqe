/**
 * Cleaning.gs — أعمال النظافة وجداولها (CRUD)
 */

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
    ID: genId_('CLN'),
    MosqueID: payload.MosqueID,
    ScheduleType: payload.ScheduleType,
    LastVisit: payload.LastVisit || '',
    NextVisit: payload.NextVisit || '',
    Rating: toNum_(payload.Rating),
    Notes: payload.Notes || '',
    CreatedBy: user.Name,
    CreatedAt: nowIso_()
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
