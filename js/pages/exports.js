/**
 * pages/exports.js — مركز التقارير (تصدير PDF / CSV) مع تخصيص واسع
 *
 * يبني التقرير ببنية بيانات منظمة (أعمدة + صفوف) ثم يعرضها، مما يتيح:
 *  - اختيار الأعمدة المعروضة.
 *  - فلاتر تتكيّف مع نوع التقرير (الحالة/الأولوية/النوع).
 *  - تصدير PDF عبر طباعة المتصفح (دعم عربي كامل) أو CSV (يفتح في Excel).
 *  - اتجاه الصفحة (طولي/عرضي) وإحصائيات تجميعية.
 */
(function () {
  Layout.render('exports');
  const page = UI.$('#page');
  const out = document.getElementById('report-output');
  let mosques = [];
  let current = null; // آخر تقرير مُولّد (للأعمدة وCSV)

  const TYPES = [
    { value: 'summary',     label: 'ملخص تنفيذي عام' },
    { value: 'reports',     label: 'تقرير البلاغات' },
    { value: 'maintenance', label: 'تقرير الصيانة والتكاليف' },
    { value: 'visits',      label: 'تقرير الزيارات الميدانية' },
    { value: 'assets',      label: 'تقرير الأصول والموجودات' },
    { value: 'projects',    label: 'تقرير المشاريع والترميم' },
    { value: 'needs',       label: 'تقرير الاحتياجات' },
    { value: 'mosque',      label: 'تقرير مسجد شامل' }
  ];

  let typeSel, mosqueSel, fromInp, toInp, orientSel, dynWrap, colWrap, titleInp, introInp;

  async function init() {
    page.innerHTML = '';
    page.appendChild(UI.el('div', { class: 'page-header' }, [
      UI.el('div', {}, [
        UI.el('h2', { text: 'مركز التقارير' }),
        UI.el('div', { class: 'page-subtitle', text: 'اختر نوع التقرير ونطاقه وأعمدته ثم صدّره PDF أو CSV' })
      ])
    ]));

    try { mosques = await Components.mosqueOptions(); }
    catch (e) { UI.toast(e.message, 'error'); }

    typeSel = selectEl('type', TYPES);
    mosqueSel = selectEl('mosqueId', [{ value: '', label: '— كل المساجد —' }].concat(mosques));
    fromInp = UI.el('input', { class: 'input', type: 'date', name: 'from' });
    toInp = UI.el('input', { class: 'input', type: 'date', name: 'to' });
    orientSel = selectEl('orient', [{ value: 'portrait', label: 'طولي' }, { value: 'landscape', label: 'عرضي' }]);
    titleInp = UI.el('input', { class: 'input', type: 'text', placeholder: 'اتركه فارغاً لاستخدام العنوان الافتراضي' });
    introInp = UI.el('textarea', { class: 'textarea', placeholder: 'نص تمهيدي اختياري يظهر أسفل ترويسة التقرير (مثل: الغرض من التقرير، الجهة الموجَّه لها…)' });
    dynWrap = UI.el('div', { class: 'form-grid', style: 'grid-column:1/-1' });

    typeSel.addEventListener('change', renderDynamicFilters);

    const card = UI.el('div', { class: 'card' }, [
      UI.el('div', { class: 'form-grid' }, [
        formRow('نوع التقرير', typeSel),
        formRow('المسجد', mosqueSel),
        formRow('من تاريخ', fromInp),
        formRow('إلى تاريخ', toInp),
        formRow('اتجاه الطباعة', orientSel),
        formRow('عنوان مخصّص للتقرير', titleInp)
      ]),
      UI.el('div', { class: 'form-row full', style: 'margin-top:4px' }, [
        UI.el('label', { class: 'form-label', text: 'مقدمة / ملاحظات (اختياري)' }), introInp
      ]),
      dynWrap,
      UI.el('div', { class: 'mt-16', style: 'display:flex;gap:10px;flex-wrap:wrap' }, [
        UI.el('button', { class: 'btn btn-primary', text: '📊 توليد التقرير', onclick: function () { generate(); } })
      ])
    ]);
    page.appendChild(card);

    colWrap = UI.el('div', { class: 'card', style: 'display:none;margin-top:16px' });
    page.appendChild(colWrap);

    page.appendChild(out);
    renderDynamicFilters();
  }

  /** فلاتر إضافية حسب نوع التقرير. */
  function renderDynamicFilters() {
    dynWrap.innerHTML = '';
    const t = typeSel.value;
    if (t === 'reports') {
      dynWrap.appendChild(formRow('الحالة', selectEl('status', optList('— كل الحالات —', ENUMS.reportStatus))));
      dynWrap.appendChild(formRow('الأولوية', selectEl('priority', optList('— كل الأولويات —', ENUMS.reportPriority))));
      dynWrap.appendChild(formRow('النوع', selectEl('rtype', optList('— كل الأنواع —', ENUMS.reportTypes))));
    } else if (t === 'assets') {
      dynWrap.appendChild(formRow('النوع', selectEl('atype', optList('— كل الأنواع —', ENUMS.assetTypes))));
      dynWrap.appendChild(formRow('الحالة', selectEl('astatus', optList('— كل الحالات —', ENUMS.assetStatus))));
    } else if (t === 'projects') {
      dynWrap.appendChild(formRow('الحالة', selectEl('pstatus', optList('— كل الحالات —', ENUMS.projectStatus))));
      dynWrap.appendChild(formRow('النوع', selectEl('ptype', optList('— كل الأنواع —', ENUMS.projectTypes))));
    } else if (t === 'needs') {
      dynWrap.appendChild(formRow('الفئة', selectEl('ncat', optList('— كل الفئات —', ENUMS.needsCategories))));
      dynWrap.appendChild(formRow('الحالة', selectEl('nstatus', optList('— كل الحالات —', ENUMS.needsStatus))));
    }
  }

  function optList(allLabel, arr) {
    return [{ value: '', label: allLabel }].concat(arr.map(function (x) { return { value: x, label: x }; }));
  }

  function selectEl(name, options) {
    const sel = UI.el('select', { class: 'select', name: name });
    options.forEach(function (o) {
      const obj = typeof o === 'object' ? o : { value: o, label: o };
      sel.appendChild(UI.el('option', { value: obj.value, text: obj.label }));
    });
    return sel;
  }

  function formRow(label, input) {
    return UI.el('div', { class: 'form-row' }, [UI.el('label', { class: 'form-label', text: label }), input]);
  }

  function dynVal(name) {
    const el = dynWrap.querySelector('[name="' + name + '"]');
    return el ? el.value : '';
  }

  async function generate() {
    const type = typeSel.value, mosqueId = mosqueSel.value, from = fromInp.value, to = toInp.value;
    UI.toast('جارٍ تجهيز التقرير…', 'info');

    const filters = {};
    if (mosqueId) filters.mosqueId = mosqueId;
    if (from) filters.from = from;
    if (to) filters.to = to;
    if (type === 'reports') {
      if (dynVal('status')) filters.status = dynVal('status');
      if (dynVal('priority')) filters.priority = dynVal('priority');
      if (dynVal('rtype')) filters.type = dynVal('rtype');
    } else if (type === 'assets') {
      if (dynVal('atype')) filters.type = dynVal('atype');
      if (dynVal('astatus')) filters.status = dynVal('astatus');
    } else if (type === 'projects') {
      if (dynVal('pstatus')) filters.status = dynVal('pstatus');
      if (dynVal('ptype')) filters.type = dynVal('ptype');
    } else if (type === 'needs') {
      if (dynVal('ncat')) filters.category = dynVal('ncat');
      if (dynVal('nstatus')) filters.status = dynVal('nstatus');
    }

    const defaultTitle = (TYPES.find(function (t) { return t.value === type; }) || {}).label || 'تقرير';
    const title = (titleInp.value || '').trim() || defaultTitle;
    const intro = (introInp.value || '').trim();

    let data;
    try {
      if (type === 'summary')           data = await buildSummary();
      else if (type === 'reports')      data = await buildTable('reports.list', filters, REPORT_COLS, 'بلاغ');
      else if (type === 'maintenance')  data = await buildMaintenance(filters);
      else if (type === 'visits')       data = await buildVisits(filters);
      else if (type === 'assets')       data = await buildTable('assets.list', filters, ASSET_COLS, 'أصل');
      else if (type === 'projects')     data = await buildProjects(filters);
      else if (type === 'needs')        data = await buildNeeds(filters);
      else if (type === 'mosque') {
        if (!mosqueId) { UI.toast('اختر مسجداً لتقرير المسجد الشامل.', 'error'); return; }
        data = await buildMosque(mosqueId, from, to);
      }
    } catch (err) { UI.toast('تعذّر توليد التقرير: ' + err.message, 'error'); return; }

    current = { type: type, title: title, intro: intro, mosqueId: mosqueId, from: from, to: to, data: data };
    renderColumnToggles();
    renderReport();
  }

  /* ---------------- تعريف الأعمدة ---------------- */
  // [label, key, fmt?]  fmt: date | num | stars-skip(تُعرض كرقم)
  const REPORT_COLS = [['التاريخ', 'CreatedAt', 'date'], ['المسجد', 'MosqueName'], ['النوع', 'Type'],
    ['الأولوية', 'Priority'], ['الوصف', 'Description'], ['الحالة', 'Status'], ['أنشأه', 'CreatedBy']];
  const ASSET_COLS = [['رقم الأصل', 'AssetNumber'], ['النوع', 'Type'], ['المسجد', 'MosqueName'],
    ['الحالة', 'Status'], ['آخر صيانة', 'LastMaintDate', 'date']];
  const MAINT_COLS = [['التاريخ', 'Date', 'date'], ['المسجد', 'MosqueName'], ['المقاول', 'Contractor'],
    ['التكلفة (ريال)', 'Cost', 'num'], ['الوصف', 'Description']];
  const VISIT_COLS = [['التاريخ', 'Date', 'date'], ['المسجد', 'MosqueName'], ['المراقب', 'Inspector'],
    ['النظافة', 'CleanRating'], ['الصيانة', 'MaintRating'], ['التكييف', 'ACRating'], ['دورات المياه', 'ToiletRating']];
  const PROJECT_COLS = [['المسجد', 'MosqueName'], ['النوع', 'Type'], ['العنوان', 'Title'],
    ['الحالة', 'Status'], ['المرحلة', 'Phase'], ['الإنجاز %', 'CompletionPct', 'num'],
    ['الميزانية', 'Budget', 'num'], ['التكلفة الفعلية', 'ActualCost', 'num'], ['المقاول', 'Contractor']];
  const NEEDS_COLS = [['المسجد', 'MosqueName'], ['الفئة', 'Category'], ['البند', 'Item'],
    ['مطلوب', 'Needed', 'num'], ['متاح', 'Available', 'num'], ['الفجوة', 'Gap', 'num'],
    ['الوحدة', 'Unit'], ['الحالة', 'Status']];

  /* ---------------- بناة التقارير (ببنية منظمة) ---------------- */

  async function buildTable(action, filters, cols, unit) {
    const d = await API.call(action, filters);
    return { kind: 'table', cols: cols, rows: d.items, unit: unit, total: d.total };
  }

  async function buildMaintenance(filters) {
    const d = await API.call('maintenance.list', filters);
    const sum = d.items.reduce(function (s, r) { return s + (Number(r.Cost) || 0); }, 0);
    return { kind: 'table', cols: MAINT_COLS, rows: d.items, unit: 'عمل صيانة', total: d.total,
      aggregates: [['إجمالي التكاليف', UI.fmtNum(sum) + ' ريال']] };
  }

  async function buildVisits(filters) {
    const d = await API.call('visits.list', filters);
    const avg = function (k) {
      if (!d.items.length) return '—';
      const s = d.items.reduce(function (a, r) { return a + (Number(r[k]) || 0); }, 0);
      return (s / d.items.length).toFixed(1) + ' / 5';
    };
    return { kind: 'table', cols: VISIT_COLS, rows: d.items, unit: 'زيارة', total: d.total,
      aggregates: [['متوسط النظافة', avg('CleanRating')], ['متوسط الصيانة', avg('MaintRating')],
        ['متوسط التكييف', avg('ACRating')], ['متوسط دورات المياه', avg('ToiletRating')]] };
  }

  async function buildProjects(filters) {
    const d = await API.call('projects.list', filters);
    const budget = d.items.reduce(function (s, r) { return s + (Number(r.Budget) || 0); }, 0);
    const actual = d.items.reduce(function (s, r) { return s + (Number(r.ActualCost) || 0); }, 0);
    const avg = d.items.length
      ? Math.round(d.items.reduce(function (s, r) { return s + (Number(r.CompletionPct) || 0); }, 0) / d.items.length)
      : 0;
    return { kind: 'table', cols: PROJECT_COLS, rows: d.items, unit: 'مشروع', total: d.total,
      aggregates: [['إجمالي الميزانيات', UI.fmtNum(budget) + ' ريال'],
        ['إجمالي التكاليف الفعلية', UI.fmtNum(actual) + ' ريال'],
        ['متوسط نسبة الإنجاز', avg + '%']] };
  }

  async function buildNeeds(filters) {
    const d = await API.call('needs.list', filters);
    const gap = d.items.reduce(function (s, r) { return s + (Number(r.Gap) || 0); }, 0);
    const unsatisfied = d.items.filter(function (r) { return r.Status !== 'مُسدّ'; }).length;
    return { kind: 'table', cols: NEEDS_COLS, rows: d.items, unit: 'بند احتياج', total: d.total,
      aggregates: [['إجمالي الفجوة (وحدات)', UI.fmtNum(gap)],
        ['بنود غير مُسدَّة', UI.fmtNum(unsatisfied)]] };
  }

  async function buildSummary() {
    const d = await API.call('dashboard.stats', {});
    return { kind: 'summary', stats: d };
  }

  async function buildMosque(mosqueId, from, to) {
    const f = { mosqueId: mosqueId };
    if (from) f.from = from;
    if (to) f.to = to;
    const empty = Promise.resolve({ items: [] });
    const results = await Promise.all([
      API.call('mosques.get', { id: mosqueId }),
      API.call('reports.list', f),
      API.call('maintenance.list', f),
      API.call('visits.list', f),
      API.call('assets.list', { mosqueId: mosqueId }),
      Auth.cap('projects.view') ? API.call('projects.list', { mosqueId: mosqueId }) : empty,
      Auth.cap('needs.view') ? API.call('needs.list', { mosqueId: mosqueId }) : empty
    ]);
    return {
      kind: 'mosque',
      m: results[0].item,
      reports: results[1].items,
      maint: results[2].items,
      visits: results[3].items,
      assets: results[4].items,
      projects: results[5].items,
      needs: results[6].items
    };
  }

  /* ---------------- اختيار الأعمدة ---------------- */

  function renderColumnToggles() {
    colWrap.innerHTML = '';
    if (!current || current.data.kind !== 'table') { colWrap.style.display = 'none'; return; }
    colWrap.style.display = '';
    colWrap.appendChild(UI.el('div', { class: 'card-title', text: '🧩 الأعمدة المعروضة' }));
    const grid = UI.el('div', { style: 'display:flex;flex-wrap:wrap;gap:14px' });
    current.data.cols.forEach(function (c, i) {
      const cb = UI.el('input', { type: 'checkbox' });
      cb.checked = c._hidden !== true;
      cb.addEventListener('change', function () { c._hidden = !cb.checked; renderReport(); });
      const lbl = UI.el('label', { style: 'display:flex;align-items:center;gap:6px;font-size:13px' }, [cb, document.createTextNode(c[0])]);
      grid.appendChild(lbl);
    });
    colWrap.appendChild(grid);
  }

  function visibleCols() {
    return current.data.cols.filter(function (c) { return c._hidden !== true; });
  }

  /* ---------------- مساعدات HTML ---------------- */

  function section(title, inner) { return '<h3 class="rep-section">' + UI.escapeHtml(title) + '</h3>' + inner; }
  function countLine(n, unit) { return '<p class="rep-count">عدد النتائج: <strong>' + UI.fmtNum(n) + '</strong> ' + unit + '</p>'; }

  function cellVal(row, def) {
    const v = row[def[1]]; const fmt = def[2];
    if (v === '' || v === null || v === undefined) return '—';
    if (fmt === 'date') return UI.fmtDate(v);
    if (fmt === 'num') return UI.fmtNum(v);
    return String(v);
  }

  function tableHtml(cols, rows) {
    if (!rows || !rows.length) return '<p class="rep-empty">لا توجد بيانات ضمن النطاق المحدد.</p>';
    let h = '<table class="rep-table"><thead><tr>';
    cols.forEach(function (c) { h += '<th>' + UI.escapeHtml(c[0]) + '</th>'; });
    h += '</tr></thead><tbody>';
    rows.forEach(function (r) {
      h += '<tr>';
      cols.forEach(function (c) { h += '<td>' + UI.escapeHtml(cellVal(r, c)) + '</td>'; });
      h += '</tr>';
    });
    return h + '</tbody></table>';
  }

  function kvTable(obj) {
    let h = '<table class="rep-table"><tbody>';
    Object.keys(obj).forEach(function (k) {
      h += '<tr><td>' + UI.escapeHtml(k) + '</td><td><strong>' + UI.fmtNum(obj[k]) + '</strong></td></tr>';
    });
    return h + '</tbody></table>';
  }

  function detailTable(pairs) {
    let h = '<table class="rep-table"><tbody>';
    pairs.forEach(function (p) {
      h += '<tr><td style="width:160px">' + UI.escapeHtml(p[0]) + '</td><td>' + UI.escapeHtml(String(p[1] == null ? '—' : p[1])) + '</td></tr>';
    });
    return h + '</tbody></table>';
  }

  function aggregatesHtml(pairs) {
    let h = '<div class="rep-cards">';
    pairs.forEach(function (p) { h += '<div class="rep-card"><div class="rep-card-v">' + UI.escapeHtml(String(p[1])) + '</div><div class="rep-card-l">' + UI.escapeHtml(p[0]) + '</div></div>'; });
    return h + '</div>';
  }

  /** يبني جسم HTML للتقرير الحالي وفق الأعمدة المرئية. */
  function buildBodyHtml() {
    const data = current.data;
    if (data.kind === 'summary') {
      const c = data.stats.cards;
      const cards = [['عدد المساجد', c.mosques], ['بلاغات مفتوحة', c.openReports], ['بلاغات حرجة', c.criticalReports],
        ['زيارات هذا الشهر', c.visitsThisMonth], ['إجمالي الصيانة', c.maintenanceCount], ['إجمالي الأصول', c.assets],
        ['مشاريع نشطة', c.activeProjects || 0], ['مشاريع مكتملة', c.completedProjects || 0], ['احتياجات غير مُسدَّة', c.unsatisfiedNeeds || 0]];
      let html = '<div class="rep-cards">';
      cards.forEach(function (k) { html += '<div class="rep-card"><div class="rep-card-v">' + UI.fmtNum(k[1]) + '</div><div class="rep-card-l">' + k[0] + '</div></div>'; });
      html += '</div>';
      html += section('البلاغات حسب الحالة', kvTable(data.stats.charts.reportsByStatus));
      if (Object.keys(data.stats.charts.reportsByType).length) html += section('البلاغات حسب النوع', kvTable(data.stats.charts.reportsByType));
      if (Object.keys(data.stats.charts.assetsByStatus).length) html += section('الأصول حسب الحالة', kvTable(data.stats.charts.assetsByStatus));
      return html;
    }
    if (data.kind === 'mosque') {
      const m = data.m;
      let html = section('بيانات المسجد', detailTable([
        ['الاسم', m.Name], ['الحي', m.District], ['المدينة', m.City],
        ['عدد المصلين', UI.fmtNum(m.Capacity)], ['دورات المياه', m.Toilets],
        ['المكيفات', m.ACs], ['الساحات', m.Courts], ['ملاحظات', m.Notes || '—']
      ]));
      html += section('البلاغات (' + data.reports.length + ')', tableHtml(REPORT_COLS.slice(0, 6).filter(function (c) { return c[1] !== 'MosqueName'; }), data.reports));
      html += section('أعمال الصيانة (' + data.maint.length + ')', tableHtml(MAINT_COLS.filter(function (c) { return c[1] !== 'MosqueName'; }), data.maint));
      html += section('الزيارات (' + data.visits.length + ')', tableHtml(VISIT_COLS.filter(function (c) { return c[1] !== 'MosqueName'; }), data.visits));
      html += section('الأصول (' + data.assets.length + ')', tableHtml(ASSET_COLS.filter(function (c) { return c[1] !== 'MosqueName'; }), data.assets));
      if (data.projects && data.projects.length)
        html += section('المشاريع والترميم (' + data.projects.length + ')', tableHtml(PROJECT_COLS.filter(function (c) { return c[1] !== 'MosqueName'; }), data.projects));
      if (data.needs && data.needs.length)
        html += section('الاحتياجات (' + data.needs.length + ')', tableHtml(NEEDS_COLS.filter(function (c) { return c[1] !== 'MosqueName'; }), data.needs));
      return html;
    }
    // table
    let html = countLine(data.total, data.unit);
    if (data.aggregates && data.aggregates.length) html += aggregatesHtml(data.aggregates);
    html += tableHtml(visibleCols(), data.rows);
    return html;
  }

  /* ---------------- العرض والطباعة والتصدير ---------------- */

  function renderReport() {
    const user = Auth.getUser();
    const mosqueName = current.mosqueId ? (mosques.find(function (m) { return String(m.value) === String(current.mosqueId); }) || {}).label : '';
    let period = '';
    if (current.from || current.to) period = 'الفترة: ' + (current.from ? UI.fmtDate(current.from) : '…') + ' — ' + (current.to ? UI.fmtDate(current.to) : '…');

    const header =
      '<div class="rep-header">' +
        '<div class="rep-org">🕌 ' + UI.escapeHtml(APP_CONFIG.ORG_NAME) + '</div>' +
        '<h1 class="rep-title">' + UI.escapeHtml(current.title) + '</h1>' +
        '<div class="rep-meta">' +
          (mosqueName ? '<span>المسجد: ' + UI.escapeHtml(mosqueName) + '</span>' : '') +
          (period ? '<span>' + UI.escapeHtml(period) + '</span>' : '') +
          '<span>تاريخ التوليد: ' + UI.fmtDateTime(new Date().toISOString()) + '</span>' +
          '<span>أعدّه: ' + UI.escapeHtml(user.name) + '</span>' +
        '</div>' +
      '</div>';
    const footer = '<div class="rep-footer">نظام العناية بالمساجد — ' + UI.escapeHtml(APP_CONFIG.ORG_NAME) + '</div>';
    const intro = current.intro
      ? '<div class="rep-intro">' + UI.escapeHtml(current.intro).replace(/\n/g, '<br>') + '</div>'
      : '';

    out.innerHTML = header + intro + '<div class="rep-body">' + buildBodyHtml() + '</div>' + footer;
    out.classList.add('visible');
    applyOrientation();

    let bar = document.getElementById('print-bar');
    if (bar) bar.remove();
    bar = UI.el('div', { id: 'print-bar', class: 'no-print', style: 'position:sticky;bottom:0;text-align:center;padding:12px;background:var(--surface);border-top:1px solid var(--border);margin-top:16px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap' }, [
      UI.el('button', { class: 'btn btn-primary', text: '🖨️ طباعة / حفظ PDF', onclick: function () { window.print(); } })
    ]);
    if (current.data.kind === 'table') {
      bar.appendChild(UI.el('button', { class: 'btn btn-ghost', text: '⬇️ تصدير CSV', onclick: exportCsv }));
    }
    page.appendChild(bar);
    out.scrollIntoView({ behavior: 'smooth' });
    UI.toast('تم توليد التقرير.', 'success');
  }

  function applyOrientation() {
    let st = document.getElementById('print-orient');
    if (!st) { st = document.createElement('style'); st.id = 'print-orient'; document.head.appendChild(st); }
    st.textContent = '@page { size: A4 ' + (orientSel.value === 'landscape' ? 'landscape' : 'portrait') + '; margin: 12mm; }';
  }

  function exportCsv() {
    if (!current || current.data.kind !== 'table') return;
    const cols = visibleCols();
    const lines = [];
    lines.push(cols.map(function (c) { return csvCell(c[0]); }).join(','));
    current.data.rows.forEach(function (r) {
      lines.push(cols.map(function (c) { return csvCell(cellVal(r, c)); }).join(','));
    });
    // BOM ليفتح Excel الترميز UTF-8 بشكل صحيح مع العربية
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = UI.el('a', { href: url, download: (current.title || 'تقرير') + '.csv' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    UI.toast('تم تصدير ملف CSV.', 'success');
  }

  function csvCell(v) {
    let s = String(v == null ? '' : v);
    // إبطال حقن الصيغ: سبق أي قيمة تبدأ بـ = + - @ أو جدولة بفاصلة عُليا
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  init();
})();
