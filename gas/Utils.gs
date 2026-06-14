/**
 * Utils.gs
 * ----------------------------------------------------------------------------
 * دوال مساعدة مشتركة: الوصول للشيتات، التحويل بين الصفوف والكائنات،
 * توليد المعرّفات، التجزئة (hashing)، وتسجيل العمليات (Audit).
 * ----------------------------------------------------------------------------
 */

/**
 * إرجاع الـ Spreadsheet النشط (الملف الذي يحتوي السكربت).
 */
function getSS_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * إرجاع شيت بالاسم، مع إنشائه ووضع رؤوس الأعمدة إن لم يكن موجوداً.
 */
function getSheet_(key) {
  var def = SHEETS[key];
  if (!def) throw new Error('شيت غير معرّف: ' + key);
  var ss = getSS_();
  var sh = ss.getSheetByName(def.name);
  if (!sh) {
    sh = ss.insertSheet(def.name);
    sh.appendRow(def.columns);
    sh.setFrozenRows(1);
  }
  return sh;
}

/**
 * قراءة كل صفوف شيت ككائنات JS مفهرسة بأسماء الأعمدة.
 */
function readRows_(key) {
  var sh = getSheet_(key);
  var range = sh.getDataRange().getValues();
  if (range.length < 2) return [];
  var headers = range[0];
  var out = [];
  for (var i = 1; i < range.length; i++) {
    var row = range[i];
    if (isEmptyRow_(row)) continue;
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c]] = row[c];
    }
    obj.__row = i + 1; // رقم الصف الفعلي في الشيت (1-based)
    out.push(obj);
  }
  return out;
}

/**
 * إيجاد صف واحد بقيمة معرّف ID.
 */
function findById_(key, id) {
  var rows = readRows_(key);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].ID) === String(id)) return rows[i];
  }
  return null;
}

/**
 * إضافة صف جديد من كائن payload، وفق ترتيب الأعمدة المعرّف.
 * يعيد الكائن المُضاف (مع المعرّف).
 */
function insertRow_(key, obj) {
  var def = SHEETS[key];
  var sh = getSheet_(key);
  var row = def.columns.map(function (col) {
    return obj[col] !== undefined && obj[col] !== null ? obj[col] : '';
  });
  sh.appendRow(row);
  return obj;
}

/**
 * تحديث صف موجود حسب __row. obj يحتوي القيم الجديدة فقط.
 */
function updateRow_(key, rowNumber, obj) {
  var def = SHEETS[key];
  var sh = getSheet_(key);
  var headers = def.columns;
  var current = sh.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  for (var c = 0; c < headers.length; c++) {
    if (obj[headers[c]] !== undefined) {
      current[c] = obj[headers[c]];
    }
  }
  sh.getRange(rowNumber, 1, 1, headers.length).setValues([current]);
  return rowToObject_(headers, current);
}

/**
 * حذف صف حسب المعرّف. يعيد true إذا تم الحذف.
 */
function deleteById_(key, id) {
  var rows = readRows_(key);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].ID) === String(id)) {
      getSheet_(key).deleteRow(rows[i].__row);
      return true;
    }
  }
  return false;
}

function rowToObject_(headers, row) {
  var obj = {};
  for (var c = 0; c < headers.length; c++) obj[headers[c]] = row[c];
  return obj;
}

function isEmptyRow_(row) {
  for (var i = 0; i < row.length; i++) {
    if (row[i] !== '' && row[i] !== null && row[i] !== undefined) return false;
  }
  return true;
}

/**
 * توليد معرّف فريد مع بادئة (مثل: MSQ-1718374923-482).
 */
function genId_(prefix) {
  return (prefix || 'ID') + '-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
}

/**
 * الوقت الحالي بصيغة ISO.
 */
function nowIso_() {
  return new Date().toISOString();
}

/**
 * تجزئة كلمة المرور باستخدام SHA-256 مع ملح (salt) ثابت من خصائص السكربت.
 */
function hashPassword_(password) {
  var salt = PropertiesService.getScriptProperties().getProperty('PWD_SALT') || 'masajid-care-salt';
  var raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + '::' + password,
    Utilities.Charset.UTF_8
  );
  return raw.map(function (b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

/**
 * تسجيل عملية في سجل التدقيق (AuditLog).
 */
function audit_(user, action, module, recordId) {
  try {
    insertRow_('AuditLog', {
      ID: genId_('LOG'),
      UserID: user ? user.ID : '',
      UserName: user ? user.Name : '',
      Action: action,
      Module: module,
      RecordID: recordId || '',
      Timestamp: nowIso_()
    });
  } catch (e) { /* السجل لا يجب أن يكسر العملية الأصلية */ }
}

/**
 * التحقق من الحقول المطلوبة في payload.
 */
function requireFields_(payload, fields) {
  var missing = [];
  fields.forEach(function (f) {
    if (payload[f] === undefined || payload[f] === null || payload[f] === '') missing.push(f);
  });
  if (missing.length) {
    throw new Error('حقول مطلوبة ناقصة: ' + missing.join('، '));
  }
}

/**
 * تحويل قيمة لرقم آمن.
 */
function toNum_(v) {
  var n = Number(v);
  return isNaN(n) ? 0 : n;
}
