/**
 * pages/dashboard.js — لوحة التحكم (بطاقات + مخططات)
 */
(async function () {
  Layout.render('dashboard');
  const page = UI.$('#page');
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

  // بطاقات الإحصائيات
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
      UI.el('div', {}, [
        UI.el('div', { class: 'stat-value', text: UI.fmtNum(card.value) }),
        UI.el('div', { class: 'stat-label', text: card.label })
      ])
    ]));
  });
  page.appendChild(grid);

  // المخططات
  const charts = UI.el('div', { class: 'charts-grid' });

  charts.appendChild(card_('البلاغات حسب الحالة',
    Components.barChart(data.charts.reportsByStatus, '')));

  charts.appendChild(card_('البلاغات حسب النوع',
    Object.keys(data.charts.reportsByType).length ? Components.barChart(data.charts.reportsByType, 'accent') : empty_()));

  charts.appendChild(card_('الزيارات (آخر 6 أشهر)',
    Components.lineChart(data.charts.visitsTrend)));

  charts.appendChild(card_('تكلفة الصيانة (آخر 6 أشهر)',
    Components.lineChart(data.charts.maintCostTrend)));

  charts.appendChild(card_('الأصول حسب الحالة',
    Object.keys(data.charts.assetsByStatus).length ? Components.barChart(data.charts.assetsByStatus, 'info') : empty_()));

  page.appendChild(charts);

  function card_(title, contentNode) {
    return UI.el('div', { class: 'card' }, [
      UI.el('div', { class: 'card-title', text: title }),
      contentNode
    ]);
  }
  function empty_() { return UI.el('div', { class: 'text-muted', text: 'لا توجد بيانات بعد' }); }
})();
