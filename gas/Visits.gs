/**
 * Visits.gs — الزيارات الميدانية (CRUD)
 */

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
    ID: genId_('VST'),
    MosqueID: payload.MosqueID,
    Date: payload.Date,
    Inspector: payload.Inspector || user.Name,
    CleanRating: toNum_(payload.CleanRating),
    MaintRating: toNum_(payload.MaintRating),
    ACRating: toNum_(payload.ACRating),
    ToiletRating: toNum_(payload.ToiletRating),
    Notes: payload.Notes || '',
    Images: payload.Images || '',
    CreatedBy: user.Name,
    CreatedAt: nowIso_()
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
