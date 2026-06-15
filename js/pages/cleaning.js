/**
 * pages/cleaning.js — أعمال النظافة وجداولها
 */
(function () {
  Layout.render('cleaning');
  const page = UI.$('#page');
  let mosques = [];
  let allItems = [];
  let searchQ = '';
  let listWrap = null;

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

  const columns = [
    { key: 'MosqueName', label: 'المسجد' },
    { key: 'ScheduleType', label: 'الجدول' },
    { key: 'LastVisit', label: 'آخر زيارة', render: function (r) { return UI.fmtDate(r.LastVisit); } },
    { key: 'NextVisit', label: 'القادمة', render: function (r) {
      const v = UI.fmtDate(r.NextVisit);
      const overdue = r.NextVisit && new Date(r.NextVisit).getTime() < Date.now();
      return overdue ? '<span style="color:var(--danger)">' + v + ' ⚠️</span>' : v;
    } },
    { key: 'Rating', label: 'التقييم', render: function (r) { return UI.ratingStars(r.Rating); } }
  ];

  function renderList() {
    if (!listWrap) return;
    const q = searchQ.trim().toLowerCase();
    const items = q ? allItems.filter(function (r) {
      return (r.MosqueName || '').toLowerCase().indexOf(q) > -1 ||
             (r.ScheduleType || '').toLowerCase().indexOf(q) > -1 ||
             (r.Notes || '').toLowerCase().indexOf(q) > -1;
    }) : allItems;

    if (!items.length) {
      UI.emptyState(listWrap, q ? 'لا توجد نتائج مطابقة للبحث.' : 'لا توجد سجلات نظافة بعد.');
      return;
    }
    const overdueCount = items.filter(function (r) { return r.NextVisit && new Date(r.NextVisit).getTime() < Date.now(); }).length;
    listWrap.innerHTML = '';
    if (overdueCount > 0) {
      listWrap.appendChild(UI.el('div', { class: 'card', style: 'margin-bottom:12px;border-inline-start:4px solid var(--danger);color:var(--danger)' }, [
        UI.el('span', { text: '⚠️ ' + overdueCount + ' مسجد متأخر في جدول النظافة' })
      ]));
    }
    listWrap.appendChild(Components.table(columns, items, {
      onView: viewDetail,
      onEdit: Auth.cap('cleaning.edit') ? function (r) { openForm(r); } : null,
      onDelete: Auth.cap('cleaning.delete') ? confirmDelete : null
    }));
    listWrap.appendChild(UI.el('div', { class: 'text-muted', style: 'font-size:12px;margin-top:8px;text-align:start',
      text: 'إجمالي النتائج: ' + items.length }));
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

    const toolbar = UI.el('div', { class: 'toolbar' });
    const searchInp = UI.el('input', { class: 'input', type: 'search',
      placeholder: 'بحث بالمسجد أو نوع الجدول…', value: searchQ });
    searchInp.addEventListener('input', function () { searchQ = this.value; renderList(); });
    toolbar.appendChild(searchInp);
    page.appendChild(toolbar);

    listWrap = UI.el('div');
    page.appendChild(listWrap);
    UI.showLoading(listWrap);

    try {
      const results = await Promise.all([
        mosques.length ? Promise.resolve(mosques) : Components.mosqueOptions(),
        API.call('cleaning.list', {})
      ]);
      if (!mosques.length) mosques = results[0];
      allItems = results[1].items;
      renderList();
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
      allItems = []; load();
    });
  }

  function confirmDelete(row) {
    UI.confirm('حذف سجل النظافة هذا؟', async function () {
      try { await API.call('cleaning.delete', { id: row.ID }); UI.toast('تم الحذف', 'success'); allItems = []; load(); }
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
