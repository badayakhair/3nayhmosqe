/**
 * Shared.gs
 * ----------------------------------------------------------------------------
 * دوال مساعدة مشتركة بين معالجات الوحدات (تنقية الصفوف، انتقاء الحقول،
 * إثراء البيانات باسم المسجد ... إلخ).
 * ------------------------------------------------------------------------- */

/**
 * إزالة الحقل الداخلي __row قبل إرسال الصف للواجهة.
 */
function stripRow_(row) {
  var clone = {};
  for (var k in row) {
    if (k !== '__row') clone[k] = row[k];
  }
  return clone;
}

/**
 * انتقاء مجموعة حقول محددة من كائن (لتطبيق التحديثات الجزئية بأمان).
 */
function pick_(obj, keys) {
  var out = {};
  keys.forEach(function (k) {
    if (obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
}

/**
 * بناء خريطة معرّف المسجد -> اسمه (لإثراء القوائم باسم المسجد).
 */
function mosqueNameMap_() {
  var map = {};
  readRows_('Mosques').forEach(function (m) { map[m.ID] = m.Name; });
  return map;
}

/**
 * إثراء قائمة عناصر بإضافة MosqueName بناءً على MosqueID.
 */
function enrichMosqueName_(items) {
  var map = mosqueNameMap_();
  items.forEach(function (it) { it.MosqueName = map[it.MosqueID] || ''; });
  return items;
}

/**
 * فلترة عامة حسب MosqueID إن وُجد في payload.
 */
function filterByMosque_(rows, payload) {
  if (payload && payload.mosqueId) {
    return rows.filter(function (r) { return String(r.MosqueID) === String(payload.mosqueId); });
  }
  return rows;
}

/**
 * فلترة عناصر ضمن فترة زمنية (dateField بين from و to إن وُجدا).
 */
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
