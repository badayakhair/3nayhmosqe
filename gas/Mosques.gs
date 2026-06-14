/**
 * Mosques.gs — إدارة المساجد (CRUD)
 */

function handleMosques_list(payload) {
  var rows = readRows_('Mosques').map(stripRow_);
  // فلترة اختيارية بالمدينة/الحي/البحث
  if (payload.city)   rows = rows.filter(function (r) { return String(r.City) === String(payload.city); });
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
  var obj = {
    ID: genId_('MSQ'),
    Name: payload.Name,
    District: payload.District,
    City: payload.City,
    Lat: payload.Lat || '',
    Lng: payload.Lng || '',
    Capacity: toNum_(payload.Capacity),
    Toilets: toNum_(payload.Toilets),
    ACs: toNum_(payload.ACs),
    Courts: toNum_(payload.Courts),
    Notes: payload.Notes || '',
    Images: payload.Images || '',
    CreatedAt: nowIso_(),
    UpdatedAt: nowIso_()
  };
  insertRow_('Mosques', obj);
  audit_(user, 'create', 'Mosques', obj.ID);
  return { item: obj };
}

function handleMosques_update(payload, user) {
  requireFields_(payload, ['id']);
  var row = findById_('Mosques', payload.id);
  if (!row) throw new Error('المسجد غير موجود.');
  var patch = pick_(payload, ['Name','District','City','Lat','Lng','Capacity','Toilets','ACs','Courts','Notes','Images']);
  patch.UpdatedAt = nowIso_();
  var updated = updateRow_('Mosques', row.__row, patch);
  audit_(user, 'update', 'Mosques', payload.id);
  return { item: updated };
}

function handleMosques_delete(payload, user) {
  requireFields_(payload, ['id']);
  var ok = deleteById_('Mosques', payload.id);
  if (!ok) throw new Error('المسجد غير موجود.');
  audit_(user, 'delete', 'Mosques', payload.id);
  return { done: true };
}
