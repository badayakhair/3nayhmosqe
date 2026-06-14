/**
 * api.js
 * ----------------------------------------------------------------------------
 * غلاف موحّد لاستدعاء Google Apps Script API.
 *
 * يرسل POST بـ Content-Type: text/plain لتفادي طلب CORS preflight
 * (لأن Apps Script لا يعالج طلبات OPTIONS). جسم الطلب JSON.
 * ----------------------------------------------------------------------------
 */
window.API = (function () {

  function getToken() {
    return localStorage.getItem(APP_CONFIG.STORAGE.TOKEN) || '';
  }

  /**
   * استدعاء عملية على الـ API.
   * @param {string} action  اسم العملية (مثل 'mosques.list')
   * @param {object} payload الحمولة
   * @returns {Promise<object>} data عند النجاح، أو يرمي خطأ.
   */
  async function call(action, payload) {
    if (!APP_CONFIG.API_URL || APP_CONFIG.API_URL.indexOf('REPLACE_WITH') > -1) {
      throw new Error('لم يتم ضبط رابط الـ API بعد. حرّر js/config.js وأضف رابط النشر.');
    }

    const body = JSON.stringify({
      action: action,
      token: getToken(),
      payload: payload || {}
    });

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
    try {
      json = await res.json();
    } catch (e) {
      throw new Error('استجابة غير صالحة من الخادم.');
    }

    if (!json.ok) {
      const err = json.error || {};
      // الجلسة منتهية -> أعد التوجيه لتسجيل الدخول
      if (err.code === 'UNAUTHORIZED') {
        Auth.clearSession();
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

  return { call: call };
})();
