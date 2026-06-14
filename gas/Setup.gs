/**
 * Setup.gs
 * ----------------------------------------------------------------------------
 * تشغيل لمرة واحدة لتهيئة قاعدة البيانات.
 * شغّل setup() يدوياً من محرر Apps Script بعد ربط السكربت بالـ Spreadsheet.
 * ----------------------------------------------------------------------------
 */

/**
 * إنشاء كل الشيتات + حساب المدير الافتراضي + بيانات تجريبية.
 */
function setup() {
  // 1) إنشاء كل الشيتات برؤوسها
  Object.keys(SHEETS).forEach(function (key) { getSheet_(key); });

  // 2) تعيين ملح كلمات المرور إن لم يكن موجوداً
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('PWD_SALT')) {
    props.setProperty('PWD_SALT', Utilities.getUuid());
  }

  // 3) إنشاء حساب المدير الافتراضي إن لم يوجد أي مستخدم
  var users = readRows_('Users');
  if (users.length === 0) {
    insertRow_('Users', {
      ID: genId_('USR'),
      Name: 'مدير النظام',
      Email: 'admin@masajid.local',
      Role: 'admin',
      PasswordHash: hashPassword_('admin123'),
      Active: true,
      CreatedAt: nowIso_()
    });
    Logger.log('تم إنشاء حساب المدير: admin@masajid.local / admin123 (غيّر كلمة المرور فوراً)');
  }

  Logger.log('اكتملت التهيئة بنجاح ✓');
  return 'Setup complete';
}

/**
 * إضافة بيانات تجريبية للتجربة (اختياري).
 */
function seedDemoData() {
  var m1 = handleMosques_create({ Name: 'جامع الملك فهد', District: 'حي العزيزية', City: 'الرياض', Capacity: 1200, Toilets: 12, ACs: 24, Courts: 2, Notes: 'جامع رئيسي' }, demoUser_());
  var m2 = handleMosques_create({ Name: 'مسجد النور', District: 'حي الروضة', City: 'الرياض', Capacity: 400, Toilets: 4, ACs: 8, Courts: 1 }, demoUser_());

  handleReports_create({ MosqueID: m1.item.ID, Type: 'تكييف', Priority: 'حرجة', Description: 'تعطل مكيفين في المصلى الرئيسي' }, demoUser_());
  handleReports_create({ MosqueID: m2.item.ID, Type: 'نظافة', Priority: 'متوسطة', Description: 'دورات المياه تحتاج تنظيف عميق' }, demoUser_());

  handleVisits_create({ MosqueID: m1.item.ID, Date: nowIso_(), CleanRating: 4, MaintRating: 3, ACRating: 2, ToiletRating: 4, Notes: 'زيارة دورية' }, demoUser_());
  handleAssets_create({ MosqueID: m1.item.ID, Type: 'مكيف', AssetNumber: 'AC-001', Status: 'يحتاج صيانة', LastMaintDate: '2025-01-10' }, demoUser_());
  handleMaintenance_create({ MosqueID: m1.item.ID, Contractor: 'شركة التبريد', Cost: 3500, Date: nowIso_(), Description: 'صيانة مكيفات' }, demoUser_());
  handleCleaning_create({ MosqueID: m2.item.ID, ScheduleType: 'أسبوعي', LastVisit: nowIso_(), Rating: 4, Notes: '' }, demoUser_());

  Logger.log('تمت إضافة البيانات التجريبية ✓');
}

function demoUser_() {
  return { ID: 'SYSTEM', Name: 'النظام', Role: 'admin' };
}

/**
 * إعداد Trigger زمني يومي لتوليد التنبيهات الدورية تلقائياً.
 * شغّله مرة واحدة يدوياً.
 */
function installDailyTrigger() {
  // إزالة المشغّلات القديمة لنفس الدالة
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dailyNotificationsJob') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyNotificationsJob')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();
  Logger.log('تم تثبيت المشغّل اليومي ✓');
}

/**
 * الدالة التي يستدعيها المشغّل الزمني يومياً.
 */
function dailyNotificationsJob() {
  var n = runScheduledChecks_();
  Logger.log('تم توليد ' + n + ' إشعار/تنبيه.');
}
