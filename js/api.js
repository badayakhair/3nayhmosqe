/**
 * api.js
 * ----------------------------------------------------------------------------
 * غلاف موحّد لاستدعاء Google Apps Script API + طبقة تخزين مؤقت للتسريع.
 *
 * يرسل POST بـ Content-Type: text/plain لتفادي طلب CORS preflight
 * (لأن Apps Script لا يعالج طلبات OPTIONS). جسم الطلب JSON.
 *
 * عمليات القراءة (list/get/stats) تُخدَّم من المخزون المؤقت فوراً عند توفّره
 * (راجع cache.js)، وعمليات الكتابة تمسح المخزون لتحديث البيانات.
 * ----------------------------------------------------------------------------
 */
window.API = (function () {

  function getToken() {
    return localStorage.getItem(APP_CONFIG.STORAGE.TOKEN) || '';
  }

  function isReadAction(action) {
    return /\.(list|get|stats)$/.test(action);
  }

  function isWriteAction(action) {
    return /\.(create|update|delete|updateStatus|markRead|generate|changePassword|login|logout)$/.test(action);
  }

  /** تنفيذ طلب الشبكة الفعلي إلى الخادم. */
  async function fetchFromServer(action, payload) {
    if (!APP_CONFIG.API_URL || APP_CONFIG.API_URL.indexOf('REPLACE_WITH') > -1) {
      throw new Error('لم يتم ضبط رابط الـ API بعد. حرّر js/config.js وأضف رابط النشر.');
    }

    const body = JSON.stringify({ action: action, token: getToken(), payload: payload || {} });

    let res;
    try {
      res = await fetch(APP_CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: body,
        redirect: 'follow'
      });
    } catch (netErr) {
      throw new Error('تعذّر الاتصال بالخادم. تحقق من الإنترنت ومن رابط الـ API.');
    }

    let json;
    try { json = await res.json(); }
    catch (e) { throw new Error('استجابة غير صالحة من الخادم.'); }

    if (!json.ok) {
      const err = json.error || {};
      if (err.code === 'UNAUTHORIZED') {
        Auth.clearSession();
        if (window.Cache) Cache.clear();
        if (!location.pathname.endsWith('index.html') && location.pathname !== '/') {
          location.href = 'index.html';
        }
      }
      const e = new Error(err.message || 'حدث خطأ غير متوقع.');
      e.code = err.code;
      throw e;
    }
    return json.data;
  }

  /**
   * استدعاء عملية على الـ API.
   * @param {string} action  اسم العملية (مثل 'mosques.list')
   * @param {object} payload الحمولة
   * @param {object} [opts]  { noCache: true } لتجاوز المخزون المؤقت.
   * @returns {Promise<object>} data عند النجاح، أو يرمي خطأ.
   */
  async function call(action, payload, opts) {
    opts = opts || {};
    const cacheEnabled = window.Cache && isReadAction(action) && !opts.noCache;

    // قراءة: حاول من المخزون المؤقت أولاً (stale-while-revalidate)
    if (cacheEnabled) {
      const entry = Cache.get(action, payload);
      if (entry) {
        if (Cache.isFresh(entry)) {
          return entry.data; // حديث: أعده فوراً بلا اتصال
        }
        // قديم: أعده فوراً وحدّث المخزون في الخلفية للزيارة القادمة
        fetchFromServer(action, payload)
          .then(function (fresh) { Cache.set(action, payload, fresh); })
          .catch(function () {});
        return entry.data;
      }
    }

    const data = await fetchFromServer(action, payload);

    if (cacheEnabled) Cache.set(action, payload, data);

    // كتابة: امسح المخزون كله ليُعاد جلب كل القوائم محدّثة
    if (window.Cache && isWriteAction(action)) Cache.clear();

    return data;
  }

  return { call: call };
})();
