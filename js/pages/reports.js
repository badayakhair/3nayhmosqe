/**
 * pages/reports.js — البلاغات والملاحظات
 */
(function () {
  Layout.render('reports');
  const page = UI.$('#page');
  let mosques = [];
  let allItems = [];
  let filters = {};
  let searchQ = '';
  let listWrap = null;

  function fields() {
    return [
      { name: 'MosqueID', label: 'المسجد', type: 'select', required: true, options: mosques },
      { name: 'Type', label: 'نوع البلاغ', type: 'select', required: true, options: ENUMS.reportTypes },
      { name: 'Priority', label: 'الأولوية', type: 'select', required: true, options: ENUMS.reportPriority },
      { name: 'Status', label: 'الحالة', type: 'select', options: ENUMS.reportStatus, value: 'جديد' },
      { name: 'Images', label: 'روابط الصور (مفصولة بفاصلة)', type: 'text', full: true },
      { name: 'Description', label: 'وصف البلاغ', type: 'textarea', required: true, full: true }
    ];
  }

  const columns = [
    { key: 'CreatedAt', label: 'التاريخ', render: function (r) { return UI.fmtDate(r.CreatedAt); } },
    { key: 'MosqueName', label: 'المسجد' },
    { key: 'Type', label: 'النوع' },
    { key: 'Priority', label: 'الأولوية', render: function (r) { return UI.priorityBadge(r.Priority); } },
    { key: 'Description', label: 'الوصف', render: function (r) { return UI.escapeHtml((r.Description || '').slice(0, 40)) + ((r.Description || '').length > 40 ? '…' : ''); } },
    { key: 'Status', label: 'الحالة', render: function (r) { return UI.statusBadge(r.Status); } }
  ];

  function renderList() {
    if (!listWrap) return;
    const q = searchQ.trim().toLowerCase();
    const items = q ? allItems.filter(function (r) {
      return (r.MosqueName || '').toLowerCase().indexOf(q) > -1 ||
             (r.Description || '').toLowerCase().indexOf(q) > -1 ||
             (r.Type || '').toLowerCase().indexOf(q) > -1;
    }) : allItems;

    if (!items.length) {
      UI.emptyState(listWrap, q ? 'لا توجد نتائج مطابقة للبحث.' : 'لا توجد بلاغات مطابقة.');
      return;
    }
    listWrap.innerHTML = '';
    listWrap.appendChild(Components.table(columns, items, {
      onView: viewDetail,
      onEdit: Auth.cap('reports.edit') ? function (r) { openForm(r); } : null,
      onDelete: Auth.cap('reports.delete') ? confirmDelete : null
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
      UI.el('div', {}, [UI.el('h2', { text: 'البلاغات والملاحظات' }), UI.el('div', { class: 'page-subtitle', text: 'إنشاء ومتابعة البلاغات حتى الإغلاق' })])
    ]);
    if (Auth.cap('reports.create')) {
      h.appendChild(UI.el('button', { class: 'btn btn-primary', text: '+ إنشاء بلاغ', onclick: function () { openForm(); } }));
    }
    page.appendChild(h);

    const toolbar = UI.el('div', { class: 'toolbar' });
    const searchInp = UI.el('input', { class: 'input', type: 'search',
      placeholder: 'بحث بالمسجد أو الوصف أو النوع…', value: searchQ });
    searchInp.addEventListener('input', function () { searchQ = this.value; renderList(); });
    toolbar.appendChild(searchInp);
    toolbar.appendChild(filterSelect('status', 'كل الحالات', ENUMS.reportStatus));
    toolbar.appendChild(filterSelect('priority', 'كل الأولويات', ENUMS.reportPriority));
    toolbar.appendChild(filterSelect('type', 'كل الأنواع', ENUMS.reportTypes));
    page.appendChild(toolbar);

    listWrap = UI.el('div');
    page.appendChild(listWrap);
    UI.showLoading(listWrap);

    try {
      const results = await Promise.all([
        mosques.length ? Promise.resolve(mosques) : Components.mosqueOptions(),
        API.call('reports.list', filters)
      ]);
      if (!mosques.length) mosques = results[0];
      allItems = results[1].items;
      renderList();
    } catch (err) { UI.emptyState(listWrap, err.message); }
  }

  function openForm(row) {
    const isEdit = !!row;
    Components.formModal(isEdit ? 'تعديل بلاغ' : 'إنشاء بلاغ', fields(), row || {}, async function (vals, m) {
      const payload = Object.assign({}, vals);
      if (isEdit) { payload.id = row.ID; await API.call('reports.update', payload); }
      else { await API.call('reports.create', payload); }
      m.close();
      UI.toast(isEdit ? 'تم تحديث البلاغ' : 'تم إنشاء البلاغ', 'success');
      allItems = []; load();
    });
  }

  function confirmDelete(row) {
    UI.confirm('حذف هذا البلاغ؟', async function () {
      try { await API.call('reports.delete', { id: row.ID }); UI.toast('تم الحذف', 'success'); allItems = []; load(); }
      catch (err) { UI.toast(err.message, 'error'); }
    });
  }

  function viewDetail(row) {
    const body = UI.el('div', { class: 'detail-list' });
    [['المسجد', row.MosqueName], ['النوع', row.Type]].forEach(function (r) {
      body.appendChild(UI.el('div', { class: 'detail-row' }, [UI.el('div', { class: 'k', text: r[0] }), UI.el('div', { class: 'v', text: r[1] || '—' })]));
    });
    body.appendChild(UI.el('div', { class: 'detail-row' }, [UI.el('div', { class: 'k', text: 'الأولوية' }), UI.el('div', { class: 'v', html: UI.priorityBadge(row.Priority) })]));
    body.appendChild(UI.el('div', { class: 'detail-row' }, [UI.el('div', { class: 'k', text: 'الوصف' }), UI.el('div', { class: 'v', text: row.Description })]));
    body.appendChild(UI.el('div', { class: 'detail-row' }, [UI.el('div', { class: 'k', text: 'أنشأه' }), UI.el('div', { class: 'v', text: row.CreatedBy })]));
    body.appendChild(UI.el('div', { class: 'detail-row' }, [UI.el('div', { class: 'k', text: 'تاريخ الإنشاء' }), UI.el('div', { class: 'v', text: UI.fmtDateTime(row.CreatedAt) })]));
    // بيانات المُبلِّغ للبلاغات الواردة عبر النموذج العام
    if (row.Source === 'عام') {
      body.appendChild(UI.el('div', { class: 'detail-row' }, [UI.el('div', { class: 'k', text: 'المصدر' }),
        UI.el('div', { class: 'v', html: '<span class="badge badge-info">نموذج عام</span>' })]));
      if (row.SubmitterName) body.appendChild(UI.el('div', { class: 'detail-row' }, [UI.el('div', { class: 'k', text: 'اسم المُبلِّغ' }), UI.el('div', { class: 'v', text: row.SubmitterName })]));
      if (row.SubmitterPhone) body.appendChild(UI.el('div', { class: 'detail-row' }, [UI.el('div', { class: 'k', text: 'جوال المُبلِّغ' }),
        UI.el('div', { class: 'v', html: '<a href="tel:' + UI.escapeHtml(row.SubmitterPhone) + '">' + UI.escapeHtml(row.SubmitterPhone) + '</a>' })]));
    }

    const statusRow = UI.el('div', { class: 'detail-row' }, [UI.el('div', { class: 'k', text: 'الحالة' })]);
    if (Auth.cap('reports.status')) {
      const sel = UI.el('select', { class: 'select' });
      ENUMS.reportStatus.forEach(function (s) {
        const o = UI.el('option', { value: s, text: s });
        if (s === row.Status) o.setAttribute('selected', 'true');
        sel.appendChild(o);
      });
      const v = UI.el('div', { class: 'v' }, [sel, UI.el('button', {
        class: 'btn btn-primary btn-sm', text: 'تحديث', style: 'margin-inline-start:8px',
        onclick: async function () {
          try { await API.call('reports.updateStatus', { id: row.ID, status: sel.value }); UI.toast('تم تحديث الحالة', 'success'); allItems = []; }
          catch (err) { UI.toast(err.message, 'error'); }
        }
      })]);
      statusRow.appendChild(v);
    } else {
      statusRow.appendChild(UI.el('div', { class: 'v', html: UI.statusBadge(row.Status) }));
    }
    body.appendChild(statusRow);

    if (row.Images) {
      const grid = UI.el('div', { class: 'image-grid' });
      String(row.Images).split(',').forEach(function (u) { u = u.trim(); if (u) grid.appendChild(UI.el('img', { src: u, alt: 'صورة' })); });
      body.appendChild(grid);
    }
    const m = UI.modal('تفاصيل البلاغ', body);
    m.overlay.addEventListener('click', function (e) { if (e.target === m.overlay) load(); });
  }

  load();
})();
