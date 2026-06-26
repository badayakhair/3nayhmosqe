/**
 * config.js
 * ----------------------------------------------------------------------------
 * إعدادات الواجهة الأمامية.
 *
 * ⚠️ بعد نشر Google Apps Script كـ Web App، الصق رابط الـ /exec هنا.
 *
 * فصل البيئتين (تجريبي/إنتاجي):
 *   • الإنتاجي  → API_URL      (ينتهي بـ /exec) — نسخة منشورة ثابتة، لا تتغيّر
 *                 إلا عند "Deploy → Manage deployments → Edit → New version".
 *   • التجريبي → API_URL_DEV   (ينتهي بـ /dev)  — يشغّل آخر كود محفوظ تلقائياً.
 *
 * التبديل بين البيئتين في لوحة النظام الداخلية:
 *   • أضِف ‎?env=dev‎  إلى الرابط لتشغيل البيئة التجريبية (يُحفظ التفضيل محلياً).
 *   • أضِف ‎?env=prod‎ للعودة إلى الإنتاجي.
 *   • عند تشغيل التجريبي يظهر شريط تنبيه برتقالي أعلى الصفحة.
 *
 * ملاحظة مهمة: رابط /dev لا يعمل إلا لمن يملك صلاحية تحرير مشروع Apps Script
 * (المطوّر). لذلك يبقى النموذج العام submit.html على الإنتاجي (API_URL) دائماً.
 * ----------------------------------------------------------------------------
 */
window.APP_CONFIG = {
  // الإنتاجي — الصق هنا رابط النشر من Apps Script (ينتهي بـ /exec)
  API_URL: 'https://script.google.com/macros/s/AKfycbyYpDFsUYborwsoE-Y7Yr_GX_GGlH1aGyvTaYAaYXMH6iz3SWYaFycdes5SnbAaUQm5/exec',

  // التجريبي — الصق هنا رابط /dev من Apps Script (اتركه فارغاً إن لم تستخدمه)
  API_URL_DEV: 'https://script.google.com/macros/s/AKfycbwG_f6V9NeqemCfOsRnHXpDcxnKphaSfCNc0RM4NPU/dev',

  APP_NAME: 'نظام العناية بالمساجد',
  ORG_NAME: 'جمعية العناية بالمساجد',
  VERSION: '1.0.0',

  // مفاتيح التخزين المحلي
  STORAGE: {
    TOKEN: 'mc_token',
    USER: 'mc_user',
    PERMS: 'mc_perms',
    ENV: 'mc_env'
  }
};

/* ---- اختيار البيئة (تجريبي/إنتاجي) ---- */
(function () {
  function resolveEnv() {
    try {
      var q = new URLSearchParams(location.search).get('env');
      if (q === 'dev' || q === 'prod') {
        localStorage.setItem(APP_CONFIG.STORAGE.ENV, q);
        return q;
      }
      return localStorage.getItem(APP_CONFIG.STORAGE.ENV) || 'prod';
    } catch (e) { return 'prod'; }
  }

  /** البيئة الفعّالة حالياً: 'dev' أو 'prod'. */
  APP_CONFIG.env = function () { return resolveEnv(); };

  /** الرابط الفعّال وفق البيئة المختارة (يعود للإنتاجي إن لم يُضبط التجريبي). */
  APP_CONFIG.activeApiUrl = function () {
    if (resolveEnv() === 'dev' && APP_CONFIG.API_URL_DEV) return APP_CONFIG.API_URL_DEV;
    return APP_CONFIG.API_URL;
  };

  // شريط تنبيه يظهر فقط في البيئة التجريبية
  if (resolveEnv() === 'dev') {
    var show = function () {
      if (document.getElementById('env-banner')) return;
      var b = document.createElement('div');
      b.id = 'env-banner';
      b.textContent = APP_CONFIG.API_URL_DEV
        ? '⚙️ بيئة تجريبية — يعمل على آخر كود محفوظ (/dev)'
        : '⚠️ بيئة تجريبية: لم تُضِف رابط /dev في config.js بعد — يعمل حالياً على الإنتاجي';
      b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#b45309;' +
        'color:#fff;text-align:center;font-size:13px;line-height:1.4;padding:5px 10px;' +
        'font-family:system-ui,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.2)';
      document.body.appendChild(b);
      document.body.style.paddingTop = '28px';
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
    else show();
  }
})();

/**
 * القيم المرجعية (يجب أن تطابق ENUMS في Config.gs).
 */
window.ENUMS = {
  roles: [
    { value: 'admin', label: 'مدير النظام' },
    { value: 'supervisor', label: 'مشرف ميداني' },
    { value: 'inspector', label: 'مراقب' },
    { value: 'viewer', label: 'قارئ فقط' }
  ],
  reportStatus: ['جديد', 'تحت التنفيذ', 'مكتمل', 'مؤجل'],
  reportPriority: ['منخفضة', 'متوسطة', 'عالية', 'حرجة'],
  reportTypes: ['نظافة', 'صيانة', 'تكييف', 'دورات مياه', 'كهرباء', 'سباكة', 'أخرى'],
  assetTypes: ['مكيف', 'سماعة', 'شاشة', 'فرش', 'خزان مياه', 'إضاءة', 'أخرى'],
  assetStatus: ['يعمل', 'يحتاج صيانة', 'معطل', 'خارج الخدمة'],
  cleaningSchedule: ['يومي', 'أسبوعي', 'نصف شهري', 'شهري'],
  mosqueCategories: ['جامع', 'مسجد حي', 'مسجد طريق-مسافرين', 'مؤقت', 'نموذجي'],
  projectTypes: ['ترميم', 'توسعة', 'تجهيز تقني', 'تأهيل', 'أخرى'],
  projectStatus: ['دراسة', 'تمويل', 'تنفيذ', 'اكتمل', 'متوقف'],
  projectPhases: ['تقييم الاحتياج', 'إعداد المخططات', 'تقديم العطاءات', 'توقيع العقد', 'بدء التنفيذ', 'تنفيذ', 'مراجعة وتسليم'],
  projectPriority: ['منخفضة', 'متوسطة', 'عالية', 'عاجلة'],
  needsCategories: ['فرش', 'تكييف', 'تقنية', 'أمن وسلامة', 'كهرباء وإضاءة', 'سباكة', 'أخرى'],
  needsStatus: ['لم يُسدّ', 'قيد التدارك', 'مُسدّ']
};
