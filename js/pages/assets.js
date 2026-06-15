/**
 * pages/assets.js — الأصول والموجودات
 */
(function () {
  Layout.render('assets');
  const page = UI.$('#page');
  let mosques = [];
  let allItems = [];
  let filters = {};
  let searchQ = '';
  let listWrap = null;

  function fields() {
    return [
      { name: 'MosqueID', label: 'المسجد', type: 'select', required: true, options: mosques },
      { name: 'Type', label: 'نوع الأصل', type: 'select', required: true, options: ENUMS.assetTypes },
      { name: 'AssetNumber', label: 'رقم الأصل', type: 'text' },
      { name: 'Status', label: 'الحالة', type: 'select', options: ENUMS.assetStatus, value: 'يعمل' },
      { name: 'LastMaintDate', label: 'تاريخ آخر صيانة', type: 'date' },
      { name: 'Notes', label: 'ملاحظات', type: 'textarea', full: true }
    ];
  }

  const columns = [
    { key: 'AssetNumber', label: 'رقم الأصل' },
    { key: 'Type', label: 'النوع' },
    { key: 'MosqueName', label: 'المسجد' },
    { key: 'Status', label: 'الحالة', render: function (r) { return UI.assetStatusBadge(r.Status); } },
    { key: 'LastMaintDate', label: 'آخر صيانة', render: function (r) { return UI.fmtDate(r.LastMaintDate); } }
  ];

  function renderList() {
    if (!listWrap) return;
    const q = searchQ.trim().toLowerCase();
    const items = q ? allItems.filter(function (r) {
      return (r.MosqueName || '').toLowerCase().indexOf(q) > -1 ||
             (r.Type || '').toLowerCase().indexOf(q) > -1 ||
             (r.AssetNumber || '').toLowerCase().indexOf(q) > -1 ||
             (r.Notes || '').toLowerCase().indexOf(q) > -1;
    }) : allItems;

    if (!items.length) {
      UI.emptyState(listWrap, q ? 'لا توجد نتائج مطابقة للبحث.' : 'لا توجد أصول مطابقة.');
      return;
    }
    listWrap.innerHTML = '';
    listWrap.appendChild(Components.table(columns, items, {
      onView: viewDetail,
      onEdit: Auth.cap('assets.edit') ? function (r) { openForm(r); } : null,
      onDelete: Auth.cap('assets.delete') ? confirmDelete : null
    }));
    listWrap.appendChild(UI.el('div', { class: 'text-muted', style: 'font-size:12px;margin-top:8px;text-align:start',
      text: 'إجمالي النتائج: ' + items.length }));
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
      UI.el('div', {}, [UI.el('h2', { text: 'الأصول والموجودات' }), UI.el('div', { class: 'page-subtitle', text: 'جرد أصول المساجد وحالتها' })])
    ]);
    if (Auth.cap('assets.create')) {
      h.appendChild(UI.el('button', { class: 'btn btn-primary', text: '+ إضافة أصل', onclick: function () { openForm(); } }));
    }
    page.appendChild(h);

    const toolbar = UI.el('div', { class: 'toolbar' });
    const searchInp = UI.el('input', { class: 'input', type: 'search',
      placeholder: 'بحث بالمسجد أو النوع أو رقم الأصل…', value: searchQ });
    searchInp.addEventListener('input', function () { searchQ = this.value; renderList(); });
    toolbar.appendChild(searchInp);
    toolbar.appendChild(filterSelect('type', 'كل الأنواع', ENUMS.assetTypes));
    toolbar.appendChild(filterSelect('status', 'كل الحالات', ENUMS.assetStatus));
    page.appendChild(toolbar);

    listWrap = UI.el('div');
    page.appendChild(listWrap);
    UI.showLoading(listWrap);

    try {
      const results = await Promise.all([
        mosques.length ? Promise.resolve(mosques) : Components.mosqueOptions(),
        API.call('assets.list', filters)
      ]);
      if (!mosques.length) mosques = results[0];
      allItems = results[1].items;
      renderList();
    } catch (err) { UI.emptyState(listWrap, err.message); }
  }

  function openForm(row) {
    const isEdit = !!row;
    Components.formModal(isEdit ? 'تعديل أصل' : 'إضافة أصل', fields(), row || {}, async function (vals, m) {
      const payload = Object.assign({}, vals);
      if (isEdit) { payload.id = row.ID; await API.call('assets.update', payload); }
      else { await API.call('assets.create', payload); }
      m.close();
      UI.toast(isEdit ? 'تم التحديث' : 'تمت الإضافة', 'success');
      allItems = []; load();
    });
  }

  function confirmDelete(row) {
    UI.confirm('حذف هذا الأصل؟', async function () {
      try { await API.call('assets.delete', { id: row.ID }); UI.toast('تم الحذف', 'success'); allItems = []; load(); }
      catch (err) { UI.toast(err.message, 'error'); }
    });
  }

  function viewDetail(row) {
    const body = UI.el('div', { class: 'detail-list' });
    [['رقم الأصل', row.AssetNumber || '—'], ['النوع', row.Type], ['المسجد', row.MosqueName]].forEach(function (r) {
      body.appendChild(UI.el('div', { class: 'detail-row' }, [UI.el('div', { class: 'k', text: r[0] }), UI.el('div', { class: 'v', text: r[1] })]));
    });
    body.appendChild(UI.el('div', { class: 'detail-row' }, [UI.el('div', { class: 'k', text: 'الحالة' }), UI.el('div', { class: 'v', html: UI.assetStatusBadge(row.Status) })]));
    [['آخر صيانة', UI.fmtDate(row.LastMaintDate)], ['ملاحظات', row.Notes || '—']].forEach(function (r) {
      body.appendChild(UI.el('div', { class: 'detail-row' }, [UI.el('div', { class: 'k', text: r[0] }), UI.el('div', { class: 'v', text: r[1] })]));
    });
    UI.modal('تفاصيل الأصل', body);
  }

  load();
})();
