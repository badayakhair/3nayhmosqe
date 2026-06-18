/**
 * pages/projects.js — المشاريع والترميم
 */
(function () {
  Layout.render('projects');
  const page = UI.$('#page');
  let mosques = [];
  let allItems = [];
  let filters = {};
  let searchQ = '';
  let listWrap = null;

  function fields() {
    return [
      { name: 'MosqueID',      label: 'المسجد',          type: 'select',   required: true, options: mosques },
      { name: 'Type',          label: 'نوع المشروع',     type: 'select',   required: true, options: ENUMS.projectTypes },
      { name: 'Title',         label: 'عنوان المشروع',   type: 'text',     required: true, full: true },
      { name: 'Priority',      label: 'الأولوية',        type: 'select',   options: ENUMS.projectPriority, value: 'متوسطة' },
      { name: 'Status',        label: 'الحالة',          type: 'select',   options: ENUMS.projectStatus,   value: 'دراسة' },
      { name: 'Phase',         label: 'المرحلة الحالية', type: 'select',   options: ENUMS.projectPhases },
      { name: 'CompletionPct', label: 'نسبة الإنجاز %',  type: 'number',   min: 0, max: 100, value: 0 },
      { name: 'Budget',        label: 'الميزانية (ريال)', type: 'number',  min: 0 },
      { name: 'ActualCost',    label: 'التكلفة الفعلية', type: 'number',   min: 0 },
      { name: 'Contractor',    label: 'المقاول / المورد', type: 'text' },
      { name: 'StartDate',     label: 'تاريخ البدء',     type: 'date' },
      { name: 'EndDate',       label: 'تاريخ الانتهاء المتوقع', type: 'date' },
      { name: 'Description',   label: 'وصف المشروع',     type: 'textarea', full: true },
      { name: 'Documents',     label: 'روابط الوثائق (مفصولة بفاصلة)', type: 'text', full: true },
      { name: 'Images',        label: 'روابط الصور (مفصولة بفاصلة)',   type: 'text', full: true }
    ];
  }

  function projectStatusBadge(status) {
    const map = {
      'دراسة': 'badge-study', 'تمويل': 'badge-fund',
      'تنفيذ': 'badge-exec',  'اكتمل': 'badge-done', 'متوقف': 'badge-paused'
    };
    return '<span class="badge ' + (map[status] || '') + '">' + UI.escapeHtml(status || '—') + '</span>';
  }

  function progressBar(pct, pid) {
    const p = Math.min(100, Math.max(0, Number(pct) || 0));
    const color = p === 100 ? 'var(--success)' : p >= 60 ? 'var(--primary)' : p >= 30 ? 'var(--warn)' : 'var(--danger)';
    const canEdit = pid && Auth.cap('projects.edit');
    const cls = 'progress-wrap' + (canEdit ? ' clickable' : '');
    const attrs = canEdit ? ' data-pid="' + UI.escapeHtml(pid) + '" title="انقر لتحديث نسبة الإنجاز"' : '';
    return '<div class="' + cls + '"' + attrs + '>' +
      '<div class="progress-track"><div class="progress-fill" style="width:' + p + '%;background:' + color + '"></div></div>' +
      '<span class="progress-pct">' + p + '%</span></div>';
  }

  const columns = [
    { key: 'MosqueName', label: 'المسجد' },
    { key: 'Type', label: 'النوع', render: function (r) { return '<span class="badge">' + UI.escapeHtml(r.Type) + '</span>'; } },
    { key: 'Title', label: 'عنوان المشروع' },
    { key: 'Status', label: 'الحالة', render: function (r) { return projectStatusBadge(r.Status); } },
    { key: 'Priority', label: 'الأولوية', render: function (r) {
        const cls = r.Priority === 'عاجلة' ? 'danger' : r.Priority === 'عالية' ? 'warn' : '';
        return cls ? '<span class="badge badge-' + cls + '">' + UI.escapeHtml(r.Priority) + '</span>' : (r.Priority || '—');
      }
    },
    { key: 'Phase', label: 'المرحلة' },
    { key: 'CompletionPct', label: 'الإنجاز', render: function (r) { return progressBar(r.CompletionPct, r.ID); } }
  ];

  function renderList() {
    if (!listWrap) return;
    const q = searchQ.trim().toLowerCase();
    const items = q ? allItems.filter(function (r) {
      return (r.MosqueName || '').toLowerCase().indexOf(q) > -1 ||
             (r.Title || '').toLowerCase().indexOf(q) > -1 ||
             (r.Contractor || '').toLowerCase().indexOf(q) > -1 ||
             (r.Description || '').toLowerCase().indexOf(q) > -1;
    }) : allItems;

    listWrap.innerHTML = '';
    if (!items.length) {
      UI.emptyState(listWrap, q ? 'لا توجد نتائج مطابقة.' : 'لا توجد مشاريع بعد.');
      return;
    }
    listWrap.appendChild(Components.table(columns, items, {
      onView: viewDetail,
      onEdit: Auth.cap('projects.edit') ? function (r) { openForm(r); } : null,
      onDelete: Auth.cap('projects.delete') ? confirmDelete : null
    }));
    listWrap.appendChild(UI.el('div', { class: 'text-muted', style: 'font-size:12px;margin-top:8px;text-align:start',
      text: 'إجمالي المشاريع: ' + items.length }));

    // تحديث سريع لنسبة الإنجاز بالنقر على شريط التقدّم (دون فتح نموذج التعديل الكامل)
    listWrap.querySelectorAll('.progress-wrap.clickable[data-pid]').forEach(function (el) {
      el.addEventListener('click', function () {
        const row = items.find(function (r) { return String(r.ID) === String(el.getAttribute('data-pid')); });
        if (row) quickProgress(row);
      });
    });
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
      UI.el('div', {}, [UI.el('h2', { text: 'المشاريع والترميم' }), UI.el('div', { class: 'page-subtitle', text: 'متابعة مشاريع الترميم والتأهيل' })])
    ]);
    if (Auth.cap('projects.create')) {
      h.appendChild(UI.el('button', { class: 'btn btn-primary', text: '+ إضافة مشروع', onclick: function () { openForm(); } }));
    }
    page.appendChild(h);

    const toolbar = UI.el('div', { class: 'toolbar' });
    const searchInp = UI.el('input', { class: 'input', type: 'search',
      placeholder: 'بحث بالعنوان أو المسجد أو المقاول…', value: searchQ });
    searchInp.addEventListener('input', function () { searchQ = this.value; renderList(); });
    toolbar.appendChild(searchInp);
    toolbar.appendChild(filterSelect('status', 'كل الحالات', ENUMS.projectStatus));
    toolbar.appendChild(filterSelect('type', 'كل الأنواع', ENUMS.projectTypes));
    page.appendChild(toolbar);

    listWrap = UI.el('div');
    page.appendChild(listWrap);
    UI.showLoading(listWrap);

    try {
      const results = await Promise.all([
        mosques.length ? Promise.resolve(mosques) : Components.mosqueOptions(),
        API.call('projects.list', filters)
      ]);
      if (!mosques.length) mosques = results[0];
      allItems = results[1].items;
      renderList();
    } catch (err) { UI.emptyState(listWrap, err.message); }
  }

  function openForm(row) {
    const isEdit = !!row;
    Components.formModal(isEdit ? 'تعديل مشروع' : 'إضافة مشروع', fields(), row || {}, async function (vals, m) {
      const payload = Object.assign({}, vals);
      if (isEdit) { payload.id = row.ID; await API.call('projects.update', payload); }
      else { await API.call('projects.create', payload); }
      m.close();
      UI.toast(isEdit ? 'تم تحديث المشروع' : 'تمت إضافة المشروع', 'success');
      allItems = []; load();
    });
  }

  /**
   * نافذة مركّزة لتحديث تقدّم المشروع بسرعة: نسبة الإنجاز + الحالة + المرحلة فقط.
   * تحل مشكلة "متابعة الإنجاز عبر زر التعديل الكامل" بجعلها بنقرة واحدة ومرتّبة.
   */
  function quickProgress(row) {
    const body = UI.el('div');

    const display = UI.el('div', { class: 'qp-pct-display' });
    const range = UI.el('input', { class: 'qp-range', type: 'range', min: '0', max: '100', step: '5' });
    let pct = Math.min(100, Math.max(0, Number(row.CompletionPct) || 0));
    range.value = String(pct);
    function paint() { display.textContent = pct + '%'; range.value = String(pct); }
    paint();
    range.addEventListener('input', function () { pct = Number(range.value) || 0; display.textContent = pct + '%'; });

    const chips = UI.el('div', { class: 'qp-quickrow' });
    [0, 25, 50, 75, 100].forEach(function (v) {
      chips.appendChild(UI.el('button', { class: 'qp-chip', type: 'button', text: v + '%',
        onclick: function () { pct = v; paint(); } }));
    });

    function labeled(labelText, control) {
      return UI.el('div', { class: 'form-row', style: 'margin-top:14px' }, [
        UI.el('label', { class: 'form-label', text: labelText }), control
      ]);
    }
    const statusSel = UI.el('select', { class: 'select' });
    ENUMS.projectStatus.forEach(function (s) {
      const o = UI.el('option', { value: s, text: s });
      if (s === row.Status) o.setAttribute('selected', 'true');
      statusSel.appendChild(o);
    });
    const phaseSel = UI.el('select', { class: 'select' });
    ENUMS.projectPhases.forEach(function (p) {
      const o = UI.el('option', { value: p, text: p });
      if (p === row.Phase) o.setAttribute('selected', 'true');
      phaseSel.appendChild(o);
    });

    body.appendChild(display);
    body.appendChild(range);
    body.appendChild(chips);
    body.appendChild(labeled('الحالة', statusSel));
    body.appendChild(labeled('المرحلة الحالية', phaseSel));

    const footer = UI.el('div', { class: 'modal-footer' });
    const m = UI.modal('تحديث تقدّم: ' + row.Title, body, { footer: footer });
    footer.appendChild(UI.el('button', { class: 'btn btn-ghost', text: 'إلغاء', onclick: m.close }));
    const saveBtn = UI.el('button', { class: 'btn btn-primary', text: 'حفظ التحديث', onclick: async function () {
      saveBtn.disabled = true; saveBtn.textContent = 'جارٍ الحفظ…';
      try {
        // عند بلوغ 100% نضبط الحالة تلقائياً إلى "اكتمل" إن لم يغيّرها المستخدم
        let status = statusSel.value;
        if (pct >= 100 && status !== 'اكتمل' && status === row.Status) status = 'اكتمل';
        await API.call('projects.update', { id: row.ID, CompletionPct: pct, Status: status, Phase: phaseSel.value });
        m.close();
        UI.toast('تم تحديث التقدّم', 'success');
        allItems = []; load();
      } catch (err) {
        UI.toast(err.message, 'error');
        saveBtn.disabled = false; saveBtn.textContent = 'حفظ التحديث';
      }
    } });
    footer.appendChild(saveBtn);
  }

  function confirmDelete(row) {
    UI.confirm('حذف المشروع "' + row.Title + '"؟', async function () {
      try { await API.call('projects.delete', { id: row.ID }); UI.toast('تم الحذف', 'success'); allItems = []; load(); }
      catch (err) { UI.toast(err.message, 'error'); }
    });
  }

  function viewDetail(row) {
    let detailModal = null;
    const body = UI.el('div', { class: 'detail-list' });

    // شريط تقدم بارز في الأعلى + زر تحديث سريع
    const pct = Math.min(100, Math.max(0, Number(row.CompletionPct) || 0));
    const progressSection = UI.el('div', { style: 'margin-bottom:18px' });
    progressSection.innerHTML = '<div class="card-title">نسبة الإنجاز</div>' + progressBar(pct);
    body.appendChild(progressSection);
    if (Auth.cap('projects.edit')) {
      progressSection.appendChild(UI.el('button', { class: 'btn btn-primary btn-sm mt-16', text: '📈 تحديث التقدّم والمرحلة',
        onclick: function () { if (detailModal) detailModal.close(); quickProgress(row); } }));
    }

    const detailRows = [
      ['المسجد', row.MosqueName], ['نوع المشروع', row.Type], ['العنوان', row.Title],
      ['الحالة', row.Status], ['الأولوية', row.Priority], ['المرحلة', row.Phase],
      ['الميزانية', row.Budget ? UI.fmtNum(row.Budget) + ' ريال' : '—'],
      ['التكلفة الفعلية', row.ActualCost ? UI.fmtNum(row.ActualCost) + ' ريال' : '—'],
      ['المقاول / المورد', row.Contractor || '—'],
      ['تاريخ البدء', UI.fmtDate(row.StartDate)],
      ['تاريخ الانتهاء المتوقع', UI.fmtDate(row.EndDate)],
      ['الوصف', row.Description || '—'],
      ['أُضيف بواسطة', row.CreatedBy || '—'],
      ['تاريخ الإضافة', UI.fmtDateTime(row.CreatedAt)]
    ];
    detailRows.forEach(function (r) {
      body.appendChild(UI.el('div', { class: 'detail-row' }, [
        UI.el('div', { class: 'k', text: r[0] }),
        UI.el('div', { class: 'v', text: String(r[1] == null ? '—' : r[1]) })
      ]));
    });

    if (row.Images) {
      const grid = UI.el('div', { class: 'image-grid' });
      String(row.Images).split(',').forEach(function (u) {
        u = u.trim(); if (u) grid.appendChild(UI.el('img', { src: u, alt: 'صورة' }));
      });
      body.appendChild(grid);
    }
    if (row.Documents) {
      const docsDiv = UI.el('div', { style: 'margin-top:12px' });
      String(row.Documents).split(',').forEach(function (u) {
        u = u.trim();
        if (u) docsDiv.appendChild(UI.el('a', { href: u, target: '_blank', class: 'btn btn-ghost btn-sm', text: '📎 وثيقة' }));
      });
      body.appendChild(docsDiv);
    }
    detailModal = UI.modal('تفاصيل المشروع: ' + row.Title, body);
  }

  load();
})();
