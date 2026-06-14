/**
 * pages/dashboard.js — لوحة التحكم (بطاقات كبيرة + مخططات Chart.js)
 *
 * تستخدم Chart.js إن توفّر (CDN)، وإلا تسقط تلقائياً إلى مخططات SVG البسيطة.
 */
(async function () {
  Layout.render('dashboard');
  const page = UI.$('#page');
  const hasChart = typeof window.Chart !== 'undefined';

  // لوحة ألوان موحّدة للمخططات
  const COLORS = {
    primary: '#1f6f54', accent: '#c9a24b', info: '#2563eb',
    warn: '#d97706', danger: '#dc2626', muted: '#9ca3af', green: '#16a34a'
  };
  const PALETTE = ['#1f6f54', '#c9a24b', '#2563eb', '#d97706', '#dc2626', '#16a34a', '#7c3aed'];

  UI.showLoading(page);

  let data;
  try {
    data = await API.call('dashboard.stats', {});
  } catch (err) {
    UI.emptyState(page, 'تعذّر تحميل الإحصائيات: ' + err.message);
    return;
  }

  const c = data.cards;
  page.innerHTML = '';

  page.appendChild(UI.el('div', { class: 'page-header' }, [
    UI.el('div', {}, [
      UI.el('h2', { text: 'مرحباً، ' + Auth.getUser().name }),
      UI.el('div', { class: 'page-subtitle', text: 'نظرة عامة على أعمال العناية بالمساجد' })
    ])
  ]));

  // ===== بطاقات الإحصائيات (أكبر وأوضح) =====
  const cards = [
    { icon: '🕌', label: 'عدد المساجد', value: c.mosques, cls: '' },
    { icon: '🚩', label: 'بلاغات مفتوحة', value: c.openReports, cls: 'warn' },
    { icon: '⚠️', label: 'بلاغات حرجة', value: c.criticalReports, cls: 'danger' },
    { icon: '📋', label: 'زيارات هذا الشهر', value: c.visitsThisMonth, cls: 'info' },
    { icon: '🔧', label: 'أعمال الصيانة', value: c.maintenanceCount, cls: '' },
    { icon: '📦', label: 'إجمالي الأصول', value: c.assets, cls: 'info' }
  ];
  const grid = UI.el('div', { class: 'stats-grid' });
  cards.forEach(function (card) {
    grid.appendChild(UI.el('div', { class: 'stat-card' }, [
      UI.el('div', { class: 'stat-icon ' + card.cls, text: card.icon }),
      UI.el('div', { class: 'stat-body' }, [
        UI.el('div', { class: 'stat-value', text: UI.fmtNum(card.value) }),
        UI.el('div', { class: 'stat-label', text: card.label })
      ])
    ]));
  });
  page.appendChild(grid);

  // ===== المخططات =====
  const charts = UI.el('div', { class: 'charts-grid' });
  page.appendChild(charts);

  // بطاقة تحوي عنواناً + لوحة رسم (canvas) أو بديل SVG
  function chartCard(title, builder, fallback) {
    const box = UI.el('div', { class: 'card chart-card' }, [UI.el('div', { class: 'card-title', text: title })]);
    const holder = UI.el('div', { class: 'chart-holder' });
    box.appendChild(holder);
    charts.appendChild(box);
    if (hasChart) {
      const canvas = UI.el('canvas');
      holder.appendChild(canvas);
      try { builder(canvas.getContext('2d')); }
      catch (e) { holder.innerHTML = ''; holder.appendChild(fallback()); }
    } else {
      holder.appendChild(fallback());
    }
  }

  const hasReports = Object.values(data.charts.reportsByStatus).some(function (v) { return v > 0; });
  const hasTypes = Object.keys(data.charts.reportsByType).length > 0;
  const hasAssets = Object.keys(data.charts.assetsByStatus).length > 0;

  // 1) البلاغات حسب الحالة — دائري (doughnut)
  chartCard('البلاغات حسب الحالة', function (ctx) {
    if (!hasReports) throw new Error('empty');
    new Chart(ctx, {
      type: 'doughnut',
      data: pieData(data.charts.reportsByStatus, ['#2563eb', '#d97706', '#16a34a', '#9ca3af']),
      options: pieOpts()
    });
  }, function () { return hasReports ? Components.barChart(data.charts.reportsByStatus, '') : emptyNote(); });

  // 2) البلاغات حسب النوع — أعمدة
  chartCard('البلاغات حسب النوع', function (ctx) {
    if (!hasTypes) throw new Error('empty');
    new Chart(ctx, {
      type: 'bar',
      data: { labels: Object.keys(data.charts.reportsByType),
        datasets: [{ data: Object.values(data.charts.reportsByType), backgroundColor: COLORS.accent, borderRadius: 6 }] },
      options: barOpts()
    });
  }, function () { return hasTypes ? Components.barChart(data.charts.reportsByType, 'accent') : emptyNote(); });

  // 3) الزيارات (آخر 6 أشهر) — خطي
  chartCard('الزيارات (آخر 6 أشهر)', function (ctx) {
    new Chart(ctx, {
      type: 'line',
      data: { labels: data.charts.visitsTrend.map(monthLabel),
        datasets: [{ data: data.charts.visitsTrend.map(function (s) { return s.value; }),
          borderColor: COLORS.primary, backgroundColor: 'rgba(31,111,84,.12)', fill: true, tension: .35, pointRadius: 4 }] },
      options: lineOpts()
    });
  }, function () { return Components.lineChart(data.charts.visitsTrend); });

  // 4) تكلفة الصيانة (آخر 6 أشهر) — خطي
  chartCard('تكلفة الصيانة (آخر 6 أشهر) — ريال', function (ctx) {
    new Chart(ctx, {
      type: 'line',
      data: { labels: data.charts.maintCostTrend.map(monthLabel),
        datasets: [{ data: data.charts.maintCostTrend.map(function (s) { return s.value; }),
          borderColor: COLORS.info, backgroundColor: 'rgba(37,99,235,.12)', fill: true, tension: .35, pointRadius: 4 }] },
      options: lineOpts()
    });
  }, function () { return Components.lineChart(data.charts.maintCostTrend); });

  // 5) الأصول حسب الحالة — دائري
  chartCard('الأصول حسب الحالة', function (ctx) {
    if (!hasAssets) throw new Error('empty');
    new Chart(ctx, {
      type: 'doughnut',
      data: pieData(data.charts.assetsByStatus, ['#16a34a', '#d97706', '#dc2626', '#9ca3af']),
      options: pieOpts()
    });
  }, function () { return hasAssets ? Components.barChart(data.charts.assetsByStatus, 'info') : emptyNote(); });

  /* ---------- مساعدات Chart.js ---------- */
  function pieData(obj, colors) {
    return { labels: Object.keys(obj), datasets: [{ data: Object.values(obj),
      backgroundColor: colors || PALETTE, borderWidth: 2, borderColor: '#fff' }] };
  }
  function baseFont() { return { family: "'Tajawal', sans-serif", size: 13 }; }
  function pieOpts() {
    return { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: baseFont(), padding: 14, usePointStyle: true } } } };
  }
  function barOpts() {
    return { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { font: baseFont() }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0, font: baseFont() } } } };
  }
  function lineOpts() {
    return { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { font: baseFont() }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { font: baseFont() } } } };
  }
  function monthLabel(s) { return s.label.slice(2); } // YYYY-MM -> MM (مختصر)
  function emptyNote() { return UI.el('div', { class: 'text-muted', style: 'padding:20px', text: 'لا توجد بيانات بعد' }); }
})();
