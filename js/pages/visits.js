/**
 * pages/visits.js — الزيارات الميدانية
 */
(function () {
  Layout.render('visits');
  const page = UI.$('#page');
  let mosques = [];
  let allItems = [];
  let searchQ = '';
  let listWrap = null;

  const RATINGS = [{ value: '', label: '— غير مقيّم —' }, 1, 2, 3, 4, 5];

  function fields() {
    return [
      { name: 'MosqueID', label: 'المسجد', type: 'select', required: true, options: mosques },
      { name: 'Date', label: 'تاريخ الزيارة', type: 'date', required: true, value: UI.todayInput() },
      { name: 'Inspector', label: 'اسم المراقب', type: 'text', value: Auth.getUser().name },
      { name: 'CleanRating', label: 'تقييم النظافة (1-5)', type: 'select', options: RATINGS },
      { name: 'MaintRating', label: 'تقييم الصيانة (1-5)', type: 'select', options: RATINGS },
      { name: 'ACRating', label: 'تقييم التكييف (1-5)', type: 'select', options: RATINGS },
      { name: 'ToiletRating', label: 'تقييم دورات المياه (1-5)', type: 'select', options: RATINGS },
      { name: 'Images', label: 'روابط الصور (مفصولة بفاصلة)', type: 'text', full: true },
      { name: 'Notes', label: 'ملاحظات', type: 'textarea', full: true }
    ];
  }

  const columns = [
    { key: 'Date', label: 'التاريخ', render: function (r) { return UI.fmtDate(r.Date); } },
    { key: 'MosqueName', label: 'المسجد' },
    { key: 'Inspector', label: 'المراقب' },
    { key: 'CleanRating', label: 'النظافة', render: function (r) { return UI.ratingStars(r.CleanRating); } },
    { key: 'MaintRating', label: 'الصيانة', render: function (r) { return UI.ratingStars(r.MaintRating); } },
    { key: 'ACRating', label: 'التكييف', render: function (r) { return UI.ratingStars(r.ACRating); } }
  ];

  function renderList() {
    if (!listWrap) return;
    const q = searchQ.trim().toLowerCase();
    const items = q ? allItems.filter(function (r) {
      return (r.MosqueName || '').toLowerCase().indexOf(q) > -1 ||
             (r.Inspector || '').toLowerCase().indexOf(q) > -1 ||
             (r.Notes || '').toLowerCase().indexOf(q) > -1;
    }) : allItems;

    if (!items.length) {
      UI.emptyState(listWrap, q ? 'لا توجد نتائج مطابقة للبحث.' : 'لا توجد زيارات مسجّلة بعد.');
      return;
    }
    listWrap.innerHTML = '';
    listWrap.appendChild(Components.table(columns, items, {
      onView: viewDetail,
      onEdit: Auth.cap('visits.edit') ? function (r) { openForm(r); } : null,
      onDelete: Auth.cap('visits.delete') ? confirmDelete : null
    }));
    listWrap.appendChild(UI.el('div', { class: 'text-muted', style: 'font-size:12px;margin-top:8px;text-align:start',
      text: 'إجمالي النتائج: ' + items.length }));
  }

  async function load() {
    page.innerHTML = '';
    const h = UI.el('div', { class: 'page-header' }, [
      UI.el('div', {}, [UI.el('h2', { text: 'الزيارات الميدانية' }), UI.el('div', { class: 'page-subtitle', text: 'تسجيل ومتابعة الزيارات والتقييمات' })])
    ]);
    if (Auth.cap('visits.create')) {
      h.appendChild(UI.el('button', { class: 'btn btn-primary', text: '+ تسجيل زيارة', onclick: function () { openForm(); } }));
    }
    page.appendChild(h);

    const toolbar = UI.el('div', { class: 'toolbar' });
    const searchInp = UI.el('input', { class: 'input', type: 'search',
      placeholder: 'بحث بالمسجد أو المراقب أو الملاحظات…', value: searchQ });
    searchInp.addEventListener('input', function () { searchQ = this.value; renderList(); });
    toolbar.appendChild(searchInp);
    page.appendChild(toolbar);

    listWrap = UI.el('div');
    page.appendChild(listWrap);
    UI.showLoading(listWrap);

    try {
      const results = await Promise.all([
        mosques.length ? Promise.resolve(mosques) : Components.mosqueOptions(),
        API.call('visits.list', {})
      ]);
      if (!mosques.length) mosques = results[0];
      allItems = results[1].items;
      renderList();
    } catch (err) { UI.emptyState(listWrap, err.message); }
  }

  function openForm(row) {
    const isEdit = !!row;
    Components.formModal(isEdit ? 'تعديل زيارة' : 'تسجيل زيارة', fields(), row || {}, async function (vals, m) {
      const payload = Object.assign({}, vals);
      if (isEdit) { payload.id = row.ID; await API.call('visits.update', payload); }
      else { await API.call('visits.create', payload); }
      m.close();
      UI.toast(isEdit ? 'تم تحديث الزيارة' : 'تم تسجيل الزيارة', 'success');
      allItems = [];
      load();
    });
  }

  function confirmDelete(row) {
    UI.confirm('حذف هذه الزيارة؟', async function () {
      try { await API.call('visits.delete', { id: row.ID }); UI.toast('تم الحذف', 'success'); allItems = []; load(); }
      catch (err) { UI.toast(err.message, 'error'); }
    });
  }

  function viewDetail(row) {
    const body = UI.el('div', { class: 'detail-list' });
    const rows = [
      ['المسجد', row.MosqueName], ['التاريخ', UI.fmtDate(row.Date)], ['المراقب', row.Inspector]
    ];
    rows.forEach(function (r) {
      body.appendChild(UI.el('div', { class: 'detail-row' }, [UI.el('div', { class: 'k', text: r[0] }), UI.el('div', { class: 'v', text: r[1] || '—' })]));
    });
    [['النظافة', row.CleanRating], ['الصيانة', row.MaintRating], ['التكييف', row.ACRating], ['دورات المياه', row.ToiletRating]].forEach(function (r) {
      const v = UI.el('div', { class: 'v', html: UI.ratingStars(r[1]) });
      body.appendChild(UI.el('div', { class: 'detail-row' }, [UI.el('div', { class: 'k', text: r[0] }), v]));
    });
    body.appendChild(UI.el('div', { class: 'detail-row' }, [UI.el('div', { class: 'k', text: 'ملاحظات' }), UI.el('div', { class: 'v', text: row.Notes || '—' })]));
    UI.modal('تفاصيل الزيارة', body);
  }

  load();
})();
