/**
 * Config.gs
 * ----------------------------------------------------------------------------
 * الثوابت العامة وتعريف بنية قاعدة البيانات (الشيتات وأعمدتها).
 * هذا الملف هو "مخطط قاعدة البيانات" — أي تعديل على الأعمدة يبدأ من هنا.
 * ----------------------------------------------------------------------------
 */

var APP_VERSION = '1.0.0';

/**
 * مدة صلاحية جلسة الدخول بالساعات.
 */
var SESSION_TTL_HOURS = 12;

/**
 * تعريف كل شيت: الاسم + ترتيب الأعمدة.
 * ترتيب الأعمدة هنا = ترتيب الأعمدة الفعلي في Google Sheet.
 * أي عمود جديد يُضاف في النهاية حفاظاً على التوافق.
 */
var SHEETS = {
  Users: {
    name: 'Users',
    columns: ['ID', 'Name', 'Email', 'Role', 'PasswordHash', 'Active', 'CreatedAt']
  },
  Sessions: {
    name: 'Sessions',
    columns: ['Token', 'UserID', 'ExpiresAt', 'CreatedAt']
  },
  Mosques: {
    name: 'Mosques',
    columns: ['ID', 'Name', 'District', 'City', 'Lat', 'Lng', 'Capacity',
              'Toilets', 'ACs', 'Courts', 'Notes', 'Images', 'CreatedAt', 'UpdatedAt']
  },
  Visits: {
    name: 'Visits',
    columns: ['ID', 'MosqueID', 'Date', 'Inspector', 'CleanRating', 'MaintRating',
              'ACRating', 'ToiletRating', 'Notes', 'Images', 'CreatedBy', 'CreatedAt']
  },
  Reports: {
    name: 'Reports',
    columns: ['ID', 'MosqueID', 'Type', 'Priority', 'Description', 'Status',
              'Images', 'CreatedBy', 'CreatedAt', 'UpdatedAt', 'ResolvedAt']
  },
  Maintenance: {
    name: 'Maintenance',
    columns: ['ID', 'MosqueID', 'Contractor', 'Cost', 'Date', 'Description',
              'Documents', 'CreatedBy', 'CreatedAt']
  },
  Cleaning: {
    name: 'Cleaning',
    columns: ['ID', 'MosqueID', 'ScheduleType', 'LastVisit', 'NextVisit',
              'Rating', 'Notes', 'CreatedBy', 'CreatedAt']
  },
  Assets: {
    name: 'Assets',
    columns: ['ID', 'MosqueID', 'Type', 'AssetNumber', 'Status',
              'LastMaintDate', 'Notes', 'CreatedAt', 'UpdatedAt']
  },
  Notifications: {
    name: 'Notifications',
    columns: ['ID', 'UserID', 'Title', 'Body', 'Type', 'IsRead', 'RefModule', 'RefID', 'CreatedAt']
  },
  AuditLog: {
    name: 'AuditLog',
    columns: ['ID', 'UserID', 'UserName', 'Action', 'Module', 'RecordID', 'Timestamp']
  }
};

/**
 * القيم المرجعية (Enums) المستخدمة في الواجهة والتحقق.
 */
var ENUMS = {
  roles: ['admin', 'supervisor', 'inspector', 'viewer'],
  reportStatus: ['جديد', 'تحت التنفيذ', 'مكتمل', 'مؤجل'],
  reportPriority: ['منخفضة', 'متوسطة', 'عالية', 'حرجة'],
  reportTypes: ['نظافة', 'صيانة', 'تكييف', 'دورات مياه', 'كهرباء', 'سباكة', 'أخرى'],
  assetTypes: ['مكيف', 'سماعة', 'شاشة', 'فرش', 'خزان مياه', 'إضاءة', 'أخرى'],
  assetStatus: ['يعمل', 'يحتاج صيانة', 'معطل', 'خارج الخدمة'],
  cleaningSchedule: ['يومي', 'أسبوعي', 'نصف شهري', 'شهري']
};
