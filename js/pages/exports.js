/**
 * pages/exports.js — مركز التقارير (تصدير PDF)
 *
 * يبني تقريراً منسّقاً في الحاوية #report-output ثم يفتح نافذة الطباعة،
 * حيث يمكن للمستخدم اختيار «حفظ كـ PDF». هذه الطريقة تعرض العربية (RTL والتشكيل)
 * بشكل صحيح تماماً لأن المتصفح هو من يتولى الطباعة.
 */
(function () {
  Layout.render('exports');
  const page = UI.$('#page');
  const out = document.getElementById('report-output');
  let mosques = [];

  const TYPES = [
    { value: 'summary',     label: 'ملخص تنفيذي عام' },
    { value: 'reports',     label: 'تقرير البلاغات' },
    { value: 'maintenance', label: 'تقرير الصيانة والتكاليف' },
    { value: 'visits',      label: 'تقرير الزيارات الميدانية' },
    { value: 'assets',      label: 'تقرير الأصول والموجودات' },
    { value: 'mosque',      label: 'تقرير مسجد شامل' }
  ];

  async function init() {
    page.innerHTML = '';
    page.appendChild(UI.el('div', { class: 'page-header' }, [
      UI.el('div', {}, [
        UI.el('h2', { text: 'مركز التقارير' }),
        UI.el('div', { class: 'page-subtitle', text: 'اختر نوع التقرير ونطاقه ثم اطبعه أو احفظه كملف PDF' })
      ])
    ]));

    try { mosques = await Components.mosqueOptions(); }
    catch (e) { UI.toast(e.message, 'error'); }

    const typeSel = selectEl('type', TYPES);
    const mosqueSel = selectEl('mosqueId', [{ value: '', label: '— كل المساجد —' }].concat(mosques));
    const fromInp = UI.el('input', { class: 'input', type: 'date', name: 'from' });
    const toInp = UI.el('input', { class: 'input', type: 'date', name: 'to' });

    const card = UI.el('div', { class: 'card' }, [
      UI.el('div', { class: 'form-grid' }, [
        formRow('نوع التقرير', typeSel),
        formRow('المسجد', mosqueSel),
        formRow('من تاريخ', fromInp),
        formRow('إلى تاريخ', toInp)
      ]),
      UI.el('div', { class: 'mt-16', style: 'display:flex;gap:10px;flex-wrap:wrap' }, [
        UI.el('button', { class: 'btn btn-primary', text: '🖨️ توليد التقرير وحفظ PDF', onclick: function () {
          generate(typeSel.value, mosqueSel.value, fromInp.value, toInp.value);
        } })
      ]),
      UI.el('div', { class: 'text-muted mt-16', style: 'font-size:12px',
        text: 'ملاحظة: في نافذة الطباعة اختر «الوجهة: حفظ كـ PDF» للحصول على ملف PDF.' })
    ]);
    page.appendChild(card);

    // انقل حاوية التقرير داخل منطقة المحتوى لعرض أنيق على الشاشة
    page.appendChild(out);
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

  async function generate(type, mosqueId, from, to) {
    UI.toast('جارٍ تجهيز التقرير…', 'info');
    const filters = {};
    if (mosqueId) filters.mosqueId = mosqueId;
    if (from) filters.from = from;
    if (to) filters.to = to;

    let bodyHtml = '';
    let title = (TYPES.find(function (t) { return t.value === type; }) || {}).label || 'تقرير';

    try {
      if (type === 'summary') {
        bodyHtml = await buildSummary();
      } else if (type === 'reports') {
        bodyHtml = await buildReports(filters);
      } else if (type === 'maintenance') {
        bodyHtml = await buildMaintenance(filters);
      } else if (type === 'visits') {
        bodyHtml = await buildVisits(filters);
      } else if (type === 'assets') {
        bodyHtml = await buildAssets(filters);
      } else if (type === 'mosque') {
        if (!mosqueId) { UI.toast('اختر مسجداً لتقرير المسجد الشامل.', 'error'); return; }
        bodyHtml = await buildMosque(mosqueId, from, to);
      }
    } catch (err) {
      UI.toast('تعذّر توليد التقرير: ' + err.message, 'error');
      return;
    }

    renderReport(title, mosqueId, from, to, bodyHtml);
  }

  /* ---------------- بناة التقارير ---------------- */

  async function buildSummary() {
    const d = await API.call('dashboard.stats', {});
    const c = d.cards;
    const cards = [
      ['عدد المساجد', c.mosques], ['بلاغات مفتوحة', c.openReports], ['بلاغات حرجة', c.criticalReports],
      ['زيارات هذا الشهر', c.visitsThisMonth], ['إجمالي أعمال الصيانة', c.maintenanceCount], ['إجمالي الأصول', c.assets]
    ];
    let html = '<div class="rep-cards">';
    cards.forEach(function (k) { html += '<div class="rep-card"><div class="rep-card-v">' + UI.fmtNum(k[1]) + '</div><div class="rep-card-l">' + k[0] + '</div></div>'; });
    html += '</div>';
    html += section('البلاغات حسب الحالة', kvTable(d.charts.reportsByStatus));
    if (Object.keys(d.charts.reportsByType).length) html += section('البلاغات حسب النوع', kvTable(d.charts.reportsByType));
    if (Object.keys(d.charts.assetsByStatus).length) html += section('الأصول حسب الحالة', kvTable(d.charts.assetsByStatus));
    return html;
  }

  async function buildReports(filters) {
    const d = await API.call('reports.list', filters);
    const cols = [['التاريخ', 'CreatedAt', 'date'], ['المسجد', 'MosqueName'], ['النوع', 'Type'],
      ['الأولوية', 'Priority'], ['الوصف', 'Description'], ['الحالة', 'Status'], ['أنشأه', 'CreatedBy']];
    return countLine(d.total, 'بلاغ') + table(cols, d.items);
  }

  async function buildMaintenance(filters) {
    const d = await API.call('maintenance.list', filters);
    const total = d.items.reduce(function (s, r) { return s + (Number(r.Cost) || 0); }, 0);
    const cols = [['التاريخ', 'Date', 'date'], ['المسجد', 'MosqueName'], ['المقاول', 'Contractor'],
      ['التكلفة (ريال)', 'Cost', 'num'], ['الوصف', 'Description']];
    return countLine(d.total, 'عمل صيانة') +
      '<p class="rep-total">إجمالي التكاليف: <strong>' + UI.fmtNum(total) + ' ريال</strong></p>' +
      table(cols, d.items);
  }

  async function buildVisits(filters) {
    const d = await API.call('visits.list', filters);
    const cols = [['التاريخ', 'Date', 'date'], ['المسجد', 'MosqueName'], ['المراقب', 'Inspector'],
      ['النظافة', 'CleanRating'], ['الصيانة', 'MaintRating'], ['التكييف', 'ACRating'], ['دورات المياه', 'ToiletRating']];
    return countLine(d.total, 'زيارة') + table(cols, d.items);
  }

  async function buildAssets(filters) {
    const d = await API.call('assets.list', filters);
    const cols = [['رقم الأصل', 'AssetNumber'], ['النوع', 'Type'], ['المسجد', 'MosqueName'],
      ['الحالة', 'Status'], ['آخر صيانة', 'LastMaintDate', 'date']];
    return countLine(d.total, 'أصل') + table(cols, d.items);
  }

  async function buildMosque(mosqueId, from, to) {
    const f = { mosqueId: mosqueId };
    if (from) f.from = from;
    if (to) f.to = to;
    const m = (await API.call('mosques.get', { id: mosqueId })).item;
    const reports = (await API.call('reports.list', f)).items;
    const maint = (await API.call('maintenance.list', f)).items;
    const visits = (await API.call('visits.list', f)).items;
    const assets = (await API.call('assets.list', { mosqueId: mosqueId })).items;

    let html = section('بيانات المسجد', detailTable([
      ['الاسم', m.Name], ['الحي', m.District], ['المدينة', m.City],
      ['عدد المصلين', UI.fmtNum(m.Capacity)], ['دورات المياه', m.Toilets],
      ['المكيفات', m.ACs], ['الساحات', m.Courts], ['ملاحظات', m.Notes || '—']
    ]));

    html += section('البلاغات (' + reports.length + ')',
      table([['التاريخ', 'CreatedAt', 'date'], ['النوع', 'Type'], ['الأولوية', 'Priority'], ['الوصف', 'Description'], ['الحالة', 'Status']], reports));
    html += section('أعمال الصيانة (' + maint.length + ')',
      table([['التاريخ', 'Date', 'date'], ['المقاول', 'Contractor'], ['التكلفة', 'Cost', 'num'], ['الوصف', 'Description']], maint));
    html += section('الزيارات (' + visits.length + ')',
      table([['التاريخ', 'Date', 'date'], ['المراقب', 'Inspector'], ['النظافة', 'CleanRating'], ['الصيانة', 'MaintRating']], visits));
    html += section('الأصول (' + assets.length + ')',
      table([['رقم الأصل', 'AssetNumber'], ['النوع', 'Type'], ['الحالة', 'Status'], ['آخر صيانة', 'LastMaintDate', 'date']], assets));
    return html;
  }

  /* ---------------- مساعدات بناء HTML ---------------- */

  function section(title, inner) {
    return '<h3 class="rep-section">' + UI.escapeHtml(title) + '</h3>' + inner;
  }

  function countLine(n, unit) {
    return '<p class="rep-count">عدد النتائج: <strong>' + UI.fmtNum(n) + '</strong> ' + unit + '</p>';
  }

  function cell(row, def) {
    const v = row[def[1]];
    const fmt = def[2];
    if (v === '' || v === null || v === undefined) return '—';
    if (fmt === 'date') return UI.fmtDate(v);
    if (fmt === 'num') return UI.fmtNum(v);
    return UI.escapeHtml(String(v));
  }

  function table(cols, rows) {
    if (!rows || !rows.length) return '<p class="rep-empty">لا توجد بيانات ضمن النطاق المحدد.</p>';
    let h = '<table class="rep-table"><thead><tr>';
    cols.forEach(function (c) { h += '<th>' + UI.escapeHtml(c[0]) + '</th>'; });
    h += '</tr></thead><tbody>';
    rows.forEach(function (r) {
      h += '<tr>';
      cols.forEach(function (c) { h += '<td>' + cell(r, c) + '</td>'; });
      h += '</tr>';
    });
    h += '</tbody></table>';
    return h;
  }

  function kvTable(obj) {
    let h = '<table class="rep-table"><tbody>';
    Object.keys(obj).forEach(function (k) {
      h += '<tr><td>' + UI.escapeHtml(k) + '</td><td><strong>' + UI.fmtNum(obj[k]) + '</strong></td></tr>';
    });
    h += '</tbody></table>';
    return h;
  }

  function detailTable(pairs) {
    let h = '<table class="rep-table"><tbody>';
    pairs.forEach(function (p) {
      h += '<tr><td style="width:160px">' + UI.escapeHtml(p[0]) + '</td><td>' + UI.escapeHtml(String(p[1] == null ? '—' : p[1])) + '</td></tr>';
    });
    h += '</tbody></table>';
    return h;
  }

  /* ---------------- العرض والطباعة ---------------- */

  function renderReport(title, mosqueId, from, to, bodyHtml) {
    const user = Auth.getUser();
    const mosqueName = mosqueId ? (mosques.find(function (m) { return String(m.value) === String(mosqueId); }) || {}).label : '';

    let period = '';
    if (from || to) period = 'الفترة: ' + (from ? UI.fmtDate(from) : '…') + ' — ' + (to ? UI.fmtDate(to) : '…');

    const header =
      '<div class="rep-header">' +
        '<div class="rep-org">🕌 ' + UI.escapeHtml(APP_CONFIG.ORG_NAME) + '</div>' +
        '<h1 class="rep-title">' + UI.escapeHtml(title) + '</h1>' +
        '<div class="rep-meta">' +
          (mosqueName ? '<span>المسجد: ' + UI.escapeHtml(mosqueName) + '</span>' : '') +
          (period ? '<span>' + UI.escapeHtml(period) + '</span>' : '') +
          '<span>تاريخ التوليد: ' + UI.fmtDateTime(new Date().toISOString()) + '</span>' +
          '<span>أعدّه: ' + UI.escapeHtml(user.name) + '</span>' +
        '</div>' +
      '</div>';

    const footer = '<div class="rep-footer">نظام العناية بالمساجد — ' + UI.escapeHtml(APP_CONFIG.ORG_NAME) + '</div>';

    out.innerHTML = header + '<div class="rep-body">' + bodyHtml + '</div>' + footer;
    out.classList.add('visible');

    // زر طباعة عائم في المعاينة على الشاشة
    let bar = document.getElementById('print-bar');
    if (!bar) {
      bar = UI.el('div', { id: 'print-bar', class: 'no-print', style: 'position:sticky;bottom:0;text-align:center;padding:12px;background:var(--surface);border-top:1px solid var(--border);margin-top:16px' }, [
        UI.el('button', { class: 'btn btn-primary', text: '🖨️ طباعة / حفظ PDF', onclick: function () { window.print(); } })
      ]);
      page.appendChild(bar);
    }
    out.scrollIntoView({ behavior: 'smooth' });
    UI.toast('تم توليد التقرير. اضغط «طباعة / حفظ PDF».', 'success');
  }

  init();
})();
