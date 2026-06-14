/**
 * pages/reports.js — البلاغات والملاحظات
 */
(function () {
  Layout.render('reports');
  const page = UI.$('#page');
  let mosques = [];
  let filters = {};

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

  async function load() {
    page.innerHTML = '';
    const h = UI.el('div', { class: 'page-header' }, [
      UI.el('div', {}, [UI.el('h2', { text: 'البلاغات والملاحظات' }), UI.el('div', { class: 'page-subtitle', text: 'إنشاء ومتابعة البلاغات حتى الإغلاق' })])
    ]);
    if (Auth.can(['admin', 'supervisor', 'inspector'])) {
      h.appendChild(UI.el('button', { class: 'btn btn-primary', text: '+ إنشاء بلاغ', onclick: function () { openForm(); } }));
    }
    page.appendChild(h);

    // أدوات الفلترة
    const toolbar = UI.el('div', { class: 'toolbar' });
    toolbar.appendChild(filterSelect('status', 'كل الحالات', ENUMS.reportStatus));
    toolbar.appendChild(filterSelect('priority', 'كل الأولويات', ENUMS.reportPriority));
    toolbar.appendChild(filterSelect('type', 'كل الأنواع', ENUMS.reportTypes));
    page.appendChild(toolbar);

    const listWrap = UI.el('div');
    page.appendChild(listWrap);
    UI.showLoading(listWrap);

    try {
      if (!mosques.length) mosques = await Components.mosqueOptions();
      const data = await API.call('reports.list', filters);
      if (!data.items.length) { UI.emptyState(listWrap, 'لا توجد بلاغات مطابقة.'); return; }

      const columns = [
        { key: 'CreatedAt', label: 'التاريخ', render: function (r) { return UI.fmtDate(r.CreatedAt); } },
        { key: 'MosqueName', label: 'المسجد' },
        { key: 'Type', label: 'النوع' },
        { key: 'Priority', label: 'الأولوية', render: function (r) { return UI.priorityBadge(r.Priority); } },
        { key: 'Description', label: 'الوصف', render: function (r) { return UI.escapeHtml((r.Description || '').slice(0, 40)) + ((r.Description || '').length > 40 ? '…' : ''); } },
        { key: 'Status', label: 'الحالة', render: function (r) { return UI.statusBadge(r.Status); } }
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
    Components.formModal(isEdit ? 'تعديل بلاغ' : 'إنشاء بلاغ', fields(), row || {}, async function (vals, m) {
      const payload = Object.assign({}, vals);
      if (isEdit) { payload.id = row.ID; await API.call('reports.update', payload); }
      else { await API.call('reports.create', payload); }
      m.close();
      UI.toast(isEdit ? 'تم تحديث البلاغ' : 'تم إنشاء البلاغ', 'success');
      load();
    });
  }

  function confirmDelete(row) {
    UI.confirm('حذف هذا البلاغ؟', async function () {
      try { await API.call('reports.delete', { id: row.ID }); UI.toast('تم الحذف', 'success'); load(); }
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

    // إدارة الحالة (للمشرفين والمدير)
    const statusRow = UI.el('div', { class: 'detail-row' }, [UI.el('div', { class: 'k', text: 'الحالة' })]);
    if (Auth.can(['admin', 'supervisor'])) {
      const sel = UI.el('select', { class: 'select' });
      ENUMS.reportStatus.forEach(function (s) {
        const o = UI.el('option', { value: s, text: s });
        if (s === row.Status) o.setAttribute('selected', 'true');
        sel.appendChild(o);
      });
      const v = UI.el('div', { class: 'v' }, [sel, UI.el('button', {
        class: 'btn btn-primary btn-sm', text: 'تحديث', style: 'margin-inline-start:8px',
        onclick: async function () {
          try { await API.call('reports.updateStatus', { id: row.ID, status: sel.value }); UI.toast('تم تحديث الحالة', 'success'); }
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
