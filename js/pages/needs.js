/**
 * pages/needs.js — الاحتياجات (تحليل الفجوة)
 */
(function () {
  Layout.render('needs');
  const page = UI.$('#page');
  let mosques = [];
  let allItems = [];
  let filters = {};
  let searchQ = '';
  let listWrap = null;

  function fields() {
    return [
      { name: 'MosqueID',   label: 'المسجد',           type: 'select',   required: true, options: mosques },
      { name: 'Category',   label: 'الفئة',            type: 'select',   required: true, options: ENUMS.needsCategories },
      { name: 'Item',       label: 'الصنف / البند',    type: 'text',     required: true, full: true },
      { name: 'Needed',     label: 'الكمية المطلوبة',  type: 'number',   min: 0, value: 0 },
      { name: 'Available',  label: 'الكمية المتاحة',   type: 'number',   min: 0, value: 0 },
      { name: 'Unit',       label: 'الوحدة',           type: 'text',     value: 'وحدة' },
      { name: 'Status',     label: 'الحالة',           type: 'select',   options: ENUMS.needsStatus, value: 'لم يُسدّ' },
      { name: 'Notes',      label: 'ملاحظات',          type: 'textarea', full: true }
    ];
  }

  function gapBadge(row) {
    const gap = Number(row.Gap) || 0;
    if (gap <= 0) return '<span class="badge badge-success">✓ مكتمل</span>';
    return '<span class="badge badge-danger">' + UI.escapeHtml(String(gap)) + ' ناقص</span>';
  }

  function needsStatusBadge(status) {
    const map = { 'لم يُسدّ': 'danger', 'قيد التدارك': 'warn', 'مُسدّ': 'success' };
    return '<span class="badge badge-' + (map[status] || '') + '">' + UI.escapeHtml(status || '—') + '</span>';
  }

  const columns = [
    { key: 'MosqueName', label: 'المسجد' },
    { key: 'Category', label: 'الفئة', render: function (r) { return '<span class="badge badge-info">' + UI.escapeHtml(r.Category) + '</span>'; } },
    { key: 'Item', label: 'البند' },
    { key: 'Needed', label: 'مطلوب', render: function (r) { return UI.fmtNum(r.Needed) + ' ' + (r.Unit || ''); } },
    { key: 'Available', label: 'متاح', render: function (r) { return UI.fmtNum(r.Available) + ' ' + (r.Unit || ''); } },
    { key: 'Gap', label: 'الفجوة', render: function (r) { return gapBadge(r); } },
    { key: 'Status', label: 'الحالة', render: function (r) { return needsStatusBadge(r.Status); } }
  ];

  function renderList() {
    if (!listWrap) return;
    const q = searchQ.trim().toLowerCase();
    const items = q ? allItems.filter(function (r) {
      return (r.MosqueName || '').toLowerCase().indexOf(q) > -1 ||
             (r.Item || '').toLowerCase().indexOf(q) > -1 ||
             (r.Category || '').toLowerCase().indexOf(q) > -1 ||
             (r.Notes || '').toLowerCase().indexOf(q) > -1;
    }) : allItems;

    listWrap.innerHTML = '';
    if (!items.length) {
      UI.emptyState(listWrap, q ? 'لا توجد نتائج مطابقة.' : 'لا توجد احتياجات مسجّلة بعد.');
      return;
    }

    const unsatisfied = items.filter(function (r) { return r.Status !== 'مُسدّ'; }).length;
    if (unsatisfied > 0) {
      listWrap.appendChild(UI.el('div', { class: 'alert alert-warn', style: 'margin-bottom:14px',
        text: '⚠️ يوجد ' + unsatisfied + ' احتياج غير مُسدّ' }));
    }

    listWrap.appendChild(Components.table(columns, items, {
      onView: viewDetail,
      onEdit: Auth.cap('needs.edit') ? function (r) { openForm(r); } : null,
      onDelete: Auth.cap('needs.delete') ? confirmDelete : null
    }));
    listWrap.appendChild(UI.el('div', { class: 'text-muted', style: 'font-size:12px;margin-top:8px;text-align:start',
      text: 'إجمالي البنود: ' + items.length + ' | غير مُسدّ: ' + unsatisfied }));
  }

  function filterSelect(key, allLabel, options) {
    const sel = UI.el('select', { class: 'select', onchange: function () {
      if (this.value) filters[key] = this.value; else delete filters[key];
      allItems = []; load();
    } });
    sel.appendChild(UI.el('option', { value: '', text: allLabel }));
    options.forEach(function (o) {
      const opt = UI.el('option', { value: o, text: o });
      if (filters[key] === o) opt.setAttribute('selected', 'true');
      sel.appendChild(opt);
    });
    return sel;
  }

  async function load() {
    page.innerHTML = '';
    const h = UI.el('div', { class: 'page-header' }, [
      UI.el('div', {}, [UI.el('h2', { text: 'الاحتياجات' }), UI.el('div', { class: 'page-subtitle', text: 'تحليل فجوة احتياجات المساجد' })])
    ]);
    if (Auth.cap('needs.create')) {
      h.appendChild(UI.el('button', { class: 'btn btn-primary', text: '+ تسجيل احتياج', onclick: function () { openForm(); } }));
    }
    page.appendChild(h);

    const toolbar = UI.el('div', { class: 'toolbar' });
    const searchInp = UI.el('input', { class: 'input', type: 'search',
      placeholder: 'بحث بالبند أو المسجد أو الفئة…', value: searchQ });
    searchInp.addEventListener('input', function () { searchQ = this.value; renderList(); });
    toolbar.appendChild(searchInp);
    toolbar.appendChild(filterSelect('category', 'كل الفئات', ENUMS.needsCategories));
    toolbar.appendChild(filterSelect('status', 'كل الحالات', ENUMS.needsStatus));
    page.appendChild(toolbar);

    listWrap = UI.el('div');
    page.appendChild(listWrap);
    UI.showLoading(listWrap);

    try {
      const results = await Promise.all([
        mosques.length ? Promise.resolve(mosques) : Components.mosqueOptions(),
        API.call('needs.list', filters)
      ]);
      if (!mosques.length) mosques = results[0];
      allItems = results[1].items;
      renderList();
    } catch (err) { UI.emptyState(listWrap, err.message); }
  }

  function openForm(row) {
    const isEdit = !!row;
    Components.formModal(isEdit ? 'تعديل احتياج' : 'تسجيل احتياج', fields(), row || {}, async function (vals, m) {
      const payload = Object.assign({}, vals);
      if (isEdit) { payload.id = row.ID; await API.call('needs.update', payload); }
      else { await API.call('needs.create', payload); }
      m.close();
      UI.toast(isEdit ? 'تم تحديث الاحتياج' : 'تمت إضافة الاحتياج', 'success');
      allItems = []; load();
    });
  }

  function confirmDelete(row) {
    UI.confirm('حذف هذا الاحتياج؟', async function () {
      try { await API.call('needs.delete', { id: row.ID }); UI.toast('تم الحذف', 'success'); allItems = []; load(); }
      catch (err) { UI.toast(err.message, 'error'); }
    });
  }

  function viewDetail(row) {
    const body = UI.el('div', { class: 'detail-list' });
    const gap = Math.max(0, (Number(row.Needed) || 0) - (Number(row.Available) || 0));
    const detailRows = [
      ['المسجد', row.MosqueName], ['الفئة', row.Category], ['البند', row.Item],
      ['الكمية المطلوبة', UI.fmtNum(row.Needed) + ' ' + (row.Unit || '')],
      ['الكمية المتاحة', UI.fmtNum(row.Available) + ' ' + (row.Unit || '')],
      ['الفجوة', gap > 0 ? gap + ' ' + (row.Unit || '') + ' (ناقص)' : 'مكتمل ✓'],
      ['الحالة', row.Status || '—'],
      ['ملاحظات', row.Notes || '—'],
      ['أُضيف بواسطة', row.CreatedBy || '—'],
      ['تاريخ الإضافة', UI.fmtDateTime(row.CreatedAt)]
    ];
    detailRows.forEach(function (r) {
      body.appendChild(UI.el('div', { class: 'detail-row' }, [
        UI.el('div', { class: 'k', text: r[0] }),
        UI.el('div', { class: 'v', text: String(r[1] == null ? '—' : r[1]) })
      ]));
    });
    UI.modal('تفاصيل الاحتياج', body);
  }

  load();
})();
