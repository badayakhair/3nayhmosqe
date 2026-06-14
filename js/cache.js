/**
 * cache.js
 * ----------------------------------------------------------------------------
 * طبقة تخزين مؤقت خفيفة لتسريع النظام.
 *
 * تُخزَّن نتائج عمليات القراءة (list/get/stats) في sessionStorage مع طابع زمني،
 * فتبقى متاحة عند التنقل بين الصفحات (لأن sessionStorage يصمد عبر تحميل الصفحات
 * في نفس التبويب). النتيجة: التنقل بين الأقسام يصبح فورياً بدل انتظار الخادم.
 *
 * الاستراتيجية (stale-while-revalidate):
 *   - إن وُجدت نسخة حديثة (< TTL) تُعاد فوراً بلا اتصال بالخادم.
 *   - إن وُجدت نسخة قديمة تُعاد فوراً، ويُحدَّث المخزون في الخلفية للزيارة القادمة.
 *   - أي عملية كتابة تمسح المخزون كله ليُعاد جلب البيانات الطازجة.
 * ----------------------------------------------------------------------------
 */
window.Cache = (function () {
  var PREFIX = 'mc_cache:';
  var TTL = 60 * 1000; // مدة اعتبار البيانات «طازجة» (60 ثانية)

  function key(action, payload) {
    return PREFIX + action + ':' + JSON.stringify(payload || {});
  }

  function get(action, payload) {
    try {
      var raw = sessionStorage.getItem(key(action, payload));
      if (!raw) return null;
      return JSON.parse(raw); // { t: timestamp, data }
    } catch (e) { return null; }
  }

  function set(action, payload, data) {
    try {
      sessionStorage.setItem(key(action, payload), JSON.stringify({ t: Date.now(), data: data }));
    } catch (e) { /* تجاوز حدود التخزين بصمت */ }
  }

  function isFresh(entry) {
    return entry && (Date.now() - entry.t) < TTL;
  }

  function clear() {
    try {
      Object.keys(sessionStorage).forEach(function (k) {
        if (k.indexOf(PREFIX) === 0) sessionStorage.removeItem(k);
      });
    } catch (e) {}
  }

  return { get: get, set: set, isFresh: isFresh, clear: clear, TTL: TTL };
})();
