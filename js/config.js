/**
 * config.js
 * ----------------------------------------------------------------------------
 * إعدادات الواجهة الأمامية.
 *
 * ⚠️ بعد نشر Google Apps Script كـ Web App، الصق رابط الـ /exec هنا.
 * ----------------------------------------------------------------------------
 */
window.APP_CONFIG = {
  // الصق هنا رابط النشر من Apps Script (ينتهي بـ /exec)
  API_URL: 'https://script.google.com/macros/s/REPLACE_WITH_YOUR_DEPLOYMENT_ID/exec',

  APP_NAME: 'نظام العناية بالمساجد',
  ORG_NAME: 'جمعية العناية بالمساجد',
  VERSION: '1.0.0',

  // مفاتيح التخزين المحلي
  STORAGE: {
    TOKEN: 'mc_token',
    USER: 'mc_user'
  }
};

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
  cleaningSchedule: ['يومي', 'أسبوعي', 'نصف شهري', 'شهري']
};
