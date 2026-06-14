/**
 * Dashboard.gs — إحصائيات لوحة التحكم
 */

function handleDashboard_stats(payload, user) {
  var mosques = readRows_('Mosques');
  var reports = readRows_('Reports');
  var visits = readRows_('Visits');
  var maintenance = readRows_('Maintenance');
  var assets = readRows_('Assets');

  var now = new Date();
  var monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  var openReports = reports.filter(function (r) { return r.Status !== 'مكتمل'; });
  var criticalReports = reports.filter(function (r) { return r.Priority === 'حرجة' && r.Status !== 'مكتمل'; });
  var visitsThisMonth = visits.filter(function (v) { return new Date(v.Date).getTime() >= monthStart; });
  var maintThisMonth = maintenance.filter(function (m) { return new Date(m.Date).getTime() >= monthStart; });

  // توزيع البلاغات حسب الحالة
  var byStatus = {};
  ENUMS.reportStatus.forEach(function (s) { byStatus[s] = 0; });
  reports.forEach(function (r) { if (byStatus[r.Status] !== undefined) byStatus[r.Status]++; });

  // توزيع البلاغات حسب النوع
  var byType = {};
  reports.forEach(function (r) { byType[r.Type] = (byType[r.Type] || 0) + 1; });

  // توزيع الأصول حسب الحالة
  var assetsByStatus = {};
  assets.forEach(function (a) { assetsByStatus[a.Status] = (assetsByStatus[a.Status] || 0) + 1; });

  // الزيارات آخر 6 أشهر (سلسلة زمنية)
  var visitsTrend = monthlyTrend_(visits, 'Date', 6);

  // تكلفة الصيانة آخر 6 أشهر
  var maintCostTrend = monthlyTrend_(maintenance, 'Date', 6, 'Cost');

  return {
    cards: {
      mosques: mosques.length,
      openReports: openReports.length,
      criticalReports: criticalReports.length,
      visitsThisMonth: visitsThisMonth.length,
      maintenanceCount: maintenance.length,
      maintenanceThisMonth: maintThisMonth.length,
      assets: assets.length
    },
    charts: {
      reportsByStatus: byStatus,
      reportsByType: byType,
      assetsByStatus: assetsByStatus,
      visitsTrend: visitsTrend,
      maintCostTrend: maintCostTrend
    }
  };
}

/**
 * بناء سلسلة شهرية لآخر n أشهر. إن مُرّر sumField تجمع القيم، وإلا تَعُدّ العناصر.
 * يعيد: [{ label:'YYYY-MM', value: n }, ...]
 */
function monthlyTrend_(rows, dateField, months, sumField) {
  var buckets = {};
  var labels = [];
  var now = new Date();
  for (var i = months - 1; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    var key = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
    buckets[key] = 0;
    labels.push(key);
  }
  rows.forEach(function (r) {
    if (!r[dateField]) return;
    var d = new Date(r[dateField]);
    var key = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
    if (buckets[key] !== undefined) {
      buckets[key] += sumField ? toNum_(r[sumField]) : 1;
    }
  });
  return labels.map(function (k) { return { label: k, value: buckets[k] }; });
}
