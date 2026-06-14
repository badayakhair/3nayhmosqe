/**
 * pages/mosques.js — إدارة المساجد
 */
(function () {
  Layout.render('mosques');
  const page = UI.$('#page');

  const FIELDS = [
    { name: 'Name', label: 'اسم المسجد', type: 'text', required: true, full: true },
    { name: 'District', label: 'الحي', type: 'text', required: true },
    { name: 'City', label: 'المدينة', type: 'text', required: true },
    { name: 'Capacity', label: 'عدد المصلين التقريبي', type: 'number', min: 0 },
    { name: 'Toilets', label: 'عدد دورات المياه', type: 'number', min: 0 },
    { name: 'ACs', label: 'عدد المكيفات', type: 'number', min: 0 },
    { name: 'Courts', label: 'عدد الساحات', type: 'number', min: 0 },
    { name: 'Lat', label: 'خط العرض (Lat)', type: 'text' },
    { name: 'Lng', label: 'خط الطول (Lng)', type: 'text' },
    { name: 'Images', label: 'روابط الصور (مفصولة بفاصلة)', type: 'text', full: true },
    { name: 'Notes', label: 'ملاحظات عامة', type: 'textarea', full: true }
  ];

  function header() {
    const h = UI.el('div', { class: 'page-header' }, [
      UI.el('div', {}, [UI.el('h2', { text: 'سجل المساجد' }), UI.el('div', { class: 'page-subtitle', text: 'إدارة بيانات المساجد الكاملة' })])
    ]);
    if (!Auth.isReadOnly() && Auth.can(['admin', 'supervisor'])) {
      h.appendChild(UI.el('button', { class: 'btn btn-primary', text: '+ إضافة مسجد', onclick: function () { openForm(); } }));
    }
    return h;
  }

  async function load() {
    page.innerHTML = '';
    page.appendChild(header());
    const listWrap = UI.el('div');
    page.appendChild(listWrap);
    UI.showLoading(listWrap);

    try {
      const data = await API.call('mosques.list', {});
      if (!data.items.length) { UI.emptyState(listWrap, 'لا توجد مساجد بعد. ابدأ بإضافة مسجد.'); return; }

      const columns = [
        { key: 'Name', label: 'اسم المسجد' },
        { key: 'District', label: 'الحي' },
        { key: 'City', label: 'المدينة' },
        { key: 'Capacity', label: 'المصلون', render: function (r) { return UI.fmtNum(r.Capacity); } },
        { key: 'Toilets', label: 'دورات المياه' },
        { key: 'ACs', label: 'المكيفات' }
      ];
      listWrap.innerHTML = '';
      listWrap.appendChild(Components.table(columns, data.items, {
        onView: viewDetail,
        onEdit: function (r) { openForm(r); },
        onDelete: Auth.can(['admin']) ? confirmDelete : null
      }));
    } catch (err) { UI.emptyState(listWrap, err.message); }
  }

  function openForm(row) {
    const isEdit = !!row;
    Components.formModal(isEdit ? 'تعديل مسجد' : 'إضافة مسجد', FIELDS, row || {}, async function (vals, m) {
      const payload = Object.assign({}, vals);
      if (isEdit) { payload.id = row.ID; await API.call('mosques.update', payload); }
      else { await API.call('mosques.create', payload); }
      m.close();
      UI.toast(isEdit ? 'تم تحديث المسجد' : 'تمت إضافة المسجد', 'success');
      load();
    });
  }

  function confirmDelete(row) {
    UI.confirm('حذف المسجد "' + row.Name + '"؟', async function () {
      try { await API.call('mosques.delete', { id: row.ID }); UI.toast('تم الحذف', 'success'); load(); }
      catch (err) { UI.toast(err.message, 'error'); }
    });
  }

  function viewDetail(row) {
    const body = UI.el('div', { class: 'detail-list' });
    const rows = [
      ['اسم المسجد', row.Name], ['الحي', row.District], ['المدينة', row.City],
      ['عدد المصلين', UI.fmtNum(row.Capacity)], ['دورات المياه', row.Toilets],
      ['المكيفات', row.ACs], ['الساحات', row.Courts],
      ['الموقع', (row.Lat && row.Lng) ? (row.Lat + ', ' + row.Lng) : '—'],
      ['ملاحظات', row.Notes || '—'], ['أُضيف في', UI.fmtDateTime(row.CreatedAt)]
    ];
    rows.forEach(function (r) {
      body.appendChild(UI.el('div', { class: 'detail-row' }, [
        UI.el('div', { class: 'k', text: r[0] }), UI.el('div', { class: 'v', text: String(r[1] == null ? '—' : r[1]) })
      ]));
    });
    if (row.Lat && row.Lng) {
      body.appendChild(UI.el('a', { class: 'btn btn-ghost btn-sm mt-16', target: '_blank',
        href: 'https://maps.google.com/?q=' + row.Lat + ',' + row.Lng, text: '📍 فتح في الخرائط' }));
    }
    if (row.Images) {
      const grid = UI.el('div', { class: 'image-grid' });
      String(row.Images).split(',').forEach(function (u) {
        u = u.trim(); if (u) grid.appendChild(UI.el('img', { src: u, alt: 'صورة' }));
      });
      body.appendChild(grid);
    }
    UI.modal(row.Name, body);
  }

  load();
})();
