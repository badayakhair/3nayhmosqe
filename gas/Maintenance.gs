/**
 * Maintenance.gs — أعمال الصيانة (CRUD)
 */

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
    ID: genId_('MNT'),
    MosqueID: payload.MosqueID,
    Contractor: payload.Contractor || '',
    Cost: toNum_(payload.Cost),
    Date: payload.Date,
    Description: payload.Description || '',
    Documents: payload.Documents || '',
    CreatedBy: user.Name,
    CreatedAt: nowIso_()
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
