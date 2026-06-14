/**
 * pages/maintenance.js — أعمال الصيانة
 */
(function () {
  Layout.render('maintenance');
  const page = UI.$('#page');
  let mosques = [];

  function fields() {
    return [
      { name: 'MosqueID', label: 'المسجد', type: 'select', required: true, options: mosques },
      { name: 'Date', label: 'تاريخ التنفيذ', type: 'date', required: true, value: UI.todayInput() },
      { name: 'Contractor', label: 'المقاول', type: 'text' },
      { name: 'Cost', label: 'التكلفة (ريال)', type: 'number', min: 0, step: '0.01' },
      { name: 'Documents', label: 'روابط المستندات (مفصولة بفاصلة)', type: 'text', full: true },
      { name: 'Description', label: 'وصف العمل / ملاحظات', type: 'textarea', full: true }
    ];
  }

  async function load() {
    page.innerHTML = '';
    const h = UI.el('div', { class: 'page-header' }, [
      UI.el('div', {}, [UI.el('h2', { text: 'أعمال الصيانة' }), UI.el('div', { class: 'page-subtitle', text: 'تسجيل أعمال الصيانة وتكاليفها' })])
    ]);
    if (Auth.cap('maintenance.create')) {
      h.appendChild(UI.el('button', { class: 'btn btn-primary', text: '+ تسجيل صيانة', onclick: function () { openForm(); } }));
    }
    page.appendChild(h);

    const listWrap = UI.el('div');
    page.appendChild(listWrap);
    UI.showLoading(listWrap);

    try {
      if (!mosques.length) mosques = await Components.mosqueOptions();
      const data = await API.call('maintenance.list', {});
      if (!data.items.length) { UI.emptyState(listWrap, 'لا توجد أعمال صيانة مسجّلة.'); return; }

      const total = data.items.reduce(function (s, r) { return s + (Number(r.Cost) || 0); }, 0);
      listWrap.appendChild(UI.el('div', { class: 'card', style: 'margin-bottom:16px' }, [
        UI.el('span', { class: 'text-muted', text: 'إجمالي تكاليف الصيانة: ' }),
        UI.el('strong', { text: UI.fmtNum(total) + ' ريال' })
      ]));

      const columns = [
        { key: 'Date', label: 'التاريخ', render: function (r) { return UI.fmtDate(r.Date); } },
        { key: 'MosqueName', label: 'المسجد' },
        { key: 'Contractor', label: 'المقاول' },
        { key: 'Cost', label: 'التكلفة', render: function (r) { return UI.fmtNum(r.Cost) + ' ريال'; } },
        { key: 'Description', label: 'الوصف', render: function (r) { return UI.escapeHtml((r.Description || '').slice(0, 40)); } }
      ];
      listWrap.appendChild(Components.table(columns, data.items, {
        onView: viewDetail,
        onEdit: Auth.cap('maintenance.edit') ? function (r) { openForm(r); } : null,
        onDelete: Auth.cap('maintenance.delete') ? confirmDelete : null
      }));
    } catch (err) { UI.emptyState(listWrap, err.message); }
  }

  function openForm(row) {
    const isEdit = !!row;
    Components.formModal(isEdit ? 'تعديل عمل صيانة' : 'تسجيل صيانة', fields(), row || {}, async function (vals, m) {
      const payload = Object.assign({}, vals);
      if (isEdit) { payload.id = row.ID; await API.call('maintenance.update', payload); }
      else { await API.call('maintenance.create', payload); }
      m.close();
      UI.toast(isEdit ? 'تم التحديث' : 'تم التسجيل', 'success');
      load();
    });
  }

  function confirmDelete(row) {
    UI.confirm('حذف عمل الصيانة هذا؟', async function () {
      try { await API.call('maintenance.delete', { id: row.ID }); UI.toast('تم الحذف', 'success'); load(); }
      catch (err) { UI.toast(err.message, 'error'); }
    });
  }

  function viewDetail(row) {
    const body = UI.el('div', { class: 'detail-list' });
    const rows = [
      ['المسجد', row.MosqueName], ['التاريخ', UI.fmtDate(row.Date)], ['المقاول', row.Contractor || '—'],
      ['التكلفة', UI.fmtNum(row.Cost) + ' ريال'], ['الوصف', row.Description || '—'], ['سجّله', row.CreatedBy]
    ];
    rows.forEach(function (r) {
      body.appendChild(UI.el('div', { class: 'detail-row' }, [UI.el('div', { class: 'k', text: r[0] }), UI.el('div', { class: 'v', text: String(r[1]) })]));
    });
    if (row.Documents) {
      const wrap = UI.el('div', { class: 'mt-16' });
      String(row.Documents).split(',').forEach(function (u) {
        u = u.trim(); if (u) wrap.appendChild(UI.el('a', { class: 'btn btn-ghost btn-sm', target: '_blank', href: u, text: '📎 مستند' }));
      });
      body.appendChild(wrap);
    }
    UI.modal('تفاصيل الصيانة', body);
  }

  load();
})();
