/**
 * pages/assets.js — الأصول والموجودات
 */
(function () {
  Layout.render('assets');
  const page = UI.$('#page');
  let mosques = [];
  let filters = {};

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

  async function load() {
    page.innerHTML = '';
    const h = UI.el('div', { class: 'page-header' }, [
      UI.el('div', {}, [UI.el('h2', { text: 'الأصول والموجودات' }), UI.el('div', { class: 'page-subtitle', text: 'جرد أصول المساجد وحالتها' })])
    ]);
    if (Auth.can(['admin', 'supervisor'])) {
      h.appendChild(UI.el('button', { class: 'btn btn-primary', text: '+ إضافة أصل', onclick: function () { openForm(); } }));
    }
    page.appendChild(h);

    const toolbar = UI.el('div', { class: 'toolbar' });
    toolbar.appendChild(filterSelect('type', 'كل الأنواع', ENUMS.assetTypes));
    toolbar.appendChild(filterSelect('status', 'كل الحالات', ENUMS.assetStatus));
    page.appendChild(toolbar);

    const listWrap = UI.el('div');
    page.appendChild(listWrap);
    UI.showLoading(listWrap);

    try {
      if (!mosques.length) mosques = await Components.mosqueOptions();
      const data = await API.call('assets.list', filters);
      if (!data.items.length) { UI.emptyState(listWrap, 'لا توجد أصول مطابقة.'); return; }

      const columns = [
        { key: 'AssetNumber', label: 'رقم الأصل' },
        { key: 'Type', label: 'النوع' },
        { key: 'MosqueName', label: 'المسجد' },
        { key: 'Status', label: 'الحالة', render: function (r) { return UI.assetStatusBadge(r.Status); } },
        { key: 'LastMaintDate', label: 'آخر صيانة', render: function (r) { return UI.fmtDate(r.LastMaintDate); } }
      ];
      listWrap.innerHTML = '';
      listWrap.appendChild(Components.table(columns, data.items, {
        onView: viewDetail,
        onEdit: Auth.can(['admin', 'supervisor']) ? function (r) { openForm(r); } : null,
        onDelete: Auth.can(['admin']) ? confirmDelete : null
      }));
    } catch (err) { UI.emptyState(listWrap, err.message); }
  }

  function filterSelect(key, allLabel, options) {
    const sel = UI.el('select', { class: 'select', onchange: function () { if (this.value) filters[key] = this.value; else delete filters[key]; load(); } });
    sel.appendChild(UI.el('option', { value: '', text: allLabel }));
    options.forEach(function (o) {
      const opt = UI.el('option', { value: o, text: o });
      if (filters[key] === o) opt.setAttribute('selected', 'true');
      sel.appendChild(opt);
    });
    return sel;
  }

  function openForm(row) {
    const isEdit = !!row;
    Components.formModal(isEdit ? 'تعديل أصل' : 'إضافة أصل', fields(), row || {}, async function (vals, m) {
      const payload = Object.assign({}, vals);
      if (isEdit) { payload.id = row.ID; await API.call('assets.update', payload); }
      else { await API.call('assets.create', payload); }
      m.close();
      UI.toast(isEdit ? 'تم التحديث' : 'تمت الإضافة', 'success');
      load();
    });
  }

  function confirmDelete(row) {
    UI.confirm('حذف هذا الأصل؟', async function () {
      try { await API.call('assets.delete', { id: row.ID }); UI.toast('تم الحذف', 'success'); load(); }
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
