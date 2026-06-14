/**
 * pages/cleaning.js — أعمال النظافة وجداولها
 */
(function () {
  Layout.render('cleaning');
  const page = UI.$('#page');
  let mosques = [];

  const RATINGS = [{ value: '', label: '— غير مقيّم —' }, 1, 2, 3, 4, 5];

  function fields() {
    return [
      { name: 'MosqueID', label: 'المسجد', type: 'select', required: true, options: mosques },
      { name: 'ScheduleType', label: 'نوع الجدول', type: 'select', required: true, options: ENUMS.cleaningSchedule },
      { name: 'LastVisit', label: 'آخر زيارة نظافة', type: 'date' },
      { name: 'NextVisit', label: 'الزيارة القادمة', type: 'date' },
      { name: 'Rating', label: 'تقييم مستوى النظافة (1-5)', type: 'select', options: RATINGS },
      { name: 'Notes', label: 'ملاحظات', type: 'textarea', full: true }
    ];
  }

  async function load() {
    page.innerHTML = '';
    const h = UI.el('div', { class: 'page-header' }, [
      UI.el('div', {}, [UI.el('h2', { text: 'أعمال النظافة' }), UI.el('div', { class: 'page-subtitle', text: 'جداول النظافة وتقييم مستواها' })])
    ]);
    if (Auth.cap('cleaning.create')) {
      h.appendChild(UI.el('button', { class: 'btn btn-primary', text: '+ سجل نظافة', onclick: function () { openForm(); } }));
    }
    page.appendChild(h);

    const listWrap = UI.el('div');
    page.appendChild(listWrap);
    UI.showLoading(listWrap);

    try {
      if (!mosques.length) mosques = await Components.mosqueOptions();
      const data = await API.call('cleaning.list', {});
      if (!data.items.length) { UI.emptyState(listWrap, 'لا توجد سجلات نظافة بعد.'); return; }

      const columns = [
        { key: 'MosqueName', label: 'المسجد' },
        { key: 'ScheduleType', label: 'الجدول' },
        { key: 'LastVisit', label: 'آخر زيارة', render: function (r) { return UI.fmtDate(r.LastVisit); } },
        { key: 'NextVisit', label: 'القادمة', render: function (r) { return UI.fmtDate(r.NextVisit); } },
        { key: 'Rating', label: 'التقييم', render: function (r) { return UI.ratingStars(r.Rating); } }
      ];
      listWrap.innerHTML = '';
      listWrap.appendChild(Components.table(columns, data.items, {
        onView: viewDetail,
        onEdit: Auth.cap('cleaning.edit') ? function (r) { openForm(r); } : null,
        onDelete: Auth.cap('cleaning.delete') ? confirmDelete : null
      }));
    } catch (err) { UI.emptyState(listWrap, err.message); }
  }

  function openForm(row) {
    const isEdit = !!row;
    Components.formModal(isEdit ? 'تعديل سجل نظافة' : 'سجل نظافة', fields(), row || {}, async function (vals, m) {
      const payload = Object.assign({}, vals);
      if (isEdit) { payload.id = row.ID; await API.call('cleaning.update', payload); }
      else { await API.call('cleaning.create', payload); }
      m.close();
      UI.toast(isEdit ? 'تم التحديث' : 'تمت الإضافة', 'success');
      load();
    });
  }

  function confirmDelete(row) {
    UI.confirm('حذف سجل النظافة هذا؟', async function () {
      try { await API.call('cleaning.delete', { id: row.ID }); UI.toast('تم الحذف', 'success'); load(); }
      catch (err) { UI.toast(err.message, 'error'); }
    });
  }

  function viewDetail(row) {
    const body = UI.el('div', { class: 'detail-list' });
    [['المسجد', row.MosqueName], ['نوع الجدول', row.ScheduleType], ['آخر زيارة', UI.fmtDate(row.LastVisit)],
     ['الزيارة القادمة', UI.fmtDate(row.NextVisit)], ['ملاحظات', row.Notes || '—']].forEach(function (r) {
      body.appendChild(UI.el('div', { class: 'detail-row' }, [UI.el('div', { class: 'k', text: r[0] }), UI.el('div', { class: 'v', text: r[1] })]));
    });
    body.appendChild(UI.el('div', { class: 'detail-row' }, [UI.el('div', { class: 'k', text: 'التقييم' }), UI.el('div', { class: 'v', html: UI.ratingStars(row.Rating) })]));
    UI.modal('تفاصيل النظافة', body);
  }

  load();
})();
