/**
 * Assets.gs — الأصول والموجودات (CRUD)
 */

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
    ID: genId_('AST'),
    MosqueID: payload.MosqueID,
    Type: payload.Type,
    AssetNumber: payload.AssetNumber || '',
    Status: payload.Status || 'يعمل',
    LastMaintDate: payload.LastMaintDate || '',
    Notes: payload.Notes || '',
    CreatedAt: nowIso_(),
    UpdatedAt: nowIso_()
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
