/**
 * pages/settings.js — المستخدمون والصلاحيات (admin فقط)
 *
 * يتضمّن قسمين:
 *  1) إدارة حسابات المستخدمين (إضافة/تعديل/حذف).
 *  2) مصفوفة الصلاحيات القابلة للتخصيص: دور × عملية (checkbox) تُحفظ في الخادم.
 */
(function () {
  Layout.render('settings');
  const page = UI.$('#page');

  if (!Auth.can(['admin'])) {
    UI.emptyState(page, 'هذه الصفحة متاحة لمدير النظام فقط.');
    return;
  }

  function fields(isEdit) {
    const f = [
      { name: 'Name', label: 'الاسم', type: 'text', required: true },
      { name: 'Role', label: 'الدور', type: 'select', required: true, options: ENUMS.roles }
    ];
    if (!isEdit) f.splice(1, 0, { name: 'Email', label: 'البريد الإلكتروني', type: 'email', required: true });
    f.push({ name: 'Password', label: isEdit ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور', type: 'password', required: !isEdit });
    f.push({ name: 'Active', label: 'الحالة', type: 'select', options: [{ value: 'true', label: 'نشط' }, { value: 'false', label: 'موقوف' }], value: 'true' });
    return f;
  }

  async function load() {
    page.innerHTML = '';
    const h = UI.el('div', { class: 'page-header' }, [
      UI.el('div', {}, [UI.el('h2', { text: 'المستخدمون والصلاحيات' }), UI.el('div', { class: 'page-subtitle', text: 'إدارة حسابات النظام وتخصيص صلاحيات كل دور' })]),
      UI.el('button', { class: 'btn btn-primary', text: '+ إضافة مستخدم', onclick: function () { openForm(); } })
    ]);
    page.appendChild(h);

    const listWrap = UI.el('div');
    page.appendChild(listWrap);
    UI.showLoading(listWrap);

    try {
      const data = await API.call('users.list', {});
      const columns = [
        { key: 'Name', label: 'الاسم' },
        { key: 'Email', label: 'البريد' },
        { key: 'Role', label: 'الدور', render: function (r) { return Auth.roleLabel(r.Role); } },
        { key: 'Active', label: 'الحالة', render: function (r) { return r.Active ? '<span class="badge badge-done">نشط</span>' : '<span class="badge badge-critical">موقوف</span>'; } }
      ];
      listWrap.innerHTML = '';
      listWrap.appendChild(Components.table(columns, data.items, {
        onEdit: function (r) { openForm(r); },
        onDelete: confirmDelete
      }));
    } catch (err) { UI.emptyState(listWrap, err.message); }

    // قسم مصفوفة الصلاحيات
    const permWrap = UI.el('div', { class: 'mt-16' });
    page.appendChild(permWrap);
    renderPermissions(permWrap);
  }

  /* ---------------- مصفوفة الصلاحيات ---------------- */

  async function renderPermissions(wrap) {
    UI.showLoading(wrap);
    let data;
    try { data = await API.call('permissions.get', {}, { noCache: true }); }
    catch (err) { UI.emptyState(wrap, err.message); return; }

    const roles = data.roles;            // الأدوار القابلة للتخصيص (دون admin)
    const caps = data.capabilities;      // [{ key, label, group }]
    const matrix = data.matrix;          // { role: { cap: bool } }

    // تجميع الصلاحيات حسب المجموعة للعرض المرتب
    const groups = [];
    const byGroup = {};
    caps.forEach(function (c) {
      if (!byGroup[c.group]) { byGroup[c.group] = []; groups.push(c.group); }
      byGroup[c.group].push(c);
    });

    wrap.innerHTML = '';
    const card = UI.el('div', { class: 'card' });
    card.appendChild(UI.el('div', { class: 'card-title', text: '🔑 مصفوفة الصلاحيات' }));
    card.appendChild(UI.el('div', { class: 'text-muted', style: 'font-size:13px;margin-bottom:12px',
      text: 'حدّد ما يستطيع كل دور فعله. «مدير النظام» يملك كل الصلاحيات دائماً. التغييرات تُطبّق فوراً على الخادم وتظهر للمستخدمين عند دخولهم التالي.' }));

    // جدول المصفوفة
    const tableWrap = UI.el('div', { class: 'table-wrap' });
    const table = UI.el('table', { class: 'data-table perm-matrix' });

    const headRow = UI.el('tr', {}, [UI.el('th', { text: 'الصلاحية' })].concat(
      roles.map(function (r) { return UI.el('th', { text: Auth.roleLabel(r), style: 'text-align:center' }); })
    ));
    table.appendChild(UI.el('thead', {}, [headRow]));

    const tbody = UI.el('tbody');
    const checkboxes = {}; // role -> cap -> input

    roles.forEach(function (r) { checkboxes[r] = {}; });

    groups.forEach(function (g) {
      // صف عنوان المجموعة
      const gRow = UI.el('tr', { class: 'perm-group-row' }, [
        UI.el('td', { text: g, colspan: String(roles.length + 1), style: 'font-weight:700;background:var(--primary-light)' })
      ]);
      tbody.appendChild(gRow);

      byGroup[g].forEach(function (c) {
        const cells = [UI.el('td', { text: c.label })];
        roles.forEach(function (r) {
          const cb = UI.el('input', { type: 'checkbox' });
          cb.checked = !!(matrix[r] && matrix[r][c.key]);
          checkboxes[r][c.key] = cb;
          cells.push(UI.el('td', { style: 'text-align:center' }, [cb]));
        });
        tbody.appendChild(UI.el('tr', {}, cells));
      });
    });
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    card.appendChild(tableWrap);

    // أزرار الحفظ والاستعادة
    const bar = UI.el('div', { class: 'mt-16', style: 'display:flex;gap:10px;flex-wrap:wrap' });
    const saveBtn = UI.el('button', { class: 'btn btn-primary', text: '💾 حفظ الصلاحيات', onclick: async function () {
      const out = {};
      roles.forEach(function (r) {
        out[r] = {};
        caps.forEach(function (c) { out[r][c.key] = checkboxes[r][c.key].checked; });
      });
      saveBtn.disabled = true; saveBtn.textContent = 'جارٍ الحفظ…';
      try {
        await API.call('permissions.update', { matrix: out });
        UI.toast('تم حفظ الصلاحيات بنجاح', 'success');
      } catch (err) { UI.toast(err.message, 'error'); }
      saveBtn.disabled = false; saveBtn.textContent = '💾 حفظ الصلاحيات';
    } });
    bar.appendChild(saveBtn);

    bar.appendChild(UI.el('button', { class: 'btn btn-ghost', text: '↩️ استعادة الافتراضي', onclick: function () {
      roles.forEach(function (r) {
        caps.forEach(function (c) {
          checkboxes[r][c.key].checked = !!(data.defaults[r] && data.defaults[r][c.key]);
        });
      });
      UI.toast('تمت استعادة القيم الافتراضية (اضغط حفظ للتطبيق).', 'info');
    } }));
    card.appendChild(bar);

    wrap.appendChild(card);
  }

  function openForm(row) {
    const isEdit = !!row;
    const vals = row ? { Name: row.Name, Role: row.Role, Active: String(row.Active) } : {};
    Components.formModal(isEdit ? 'تعديل مستخدم' : 'إضافة مستخدم', fields(isEdit), vals, async function (v, m) {
      const payload = { Name: v.Name, Role: v.Role, Active: v.Active === 'true' };
      if (v.Password) payload.Password = v.Password;
      if (isEdit) { payload.id = row.ID; await API.call('users.update', payload); }
      else { payload.Email = v.Email; await API.call('users.create', payload); }
      m.close();
      UI.toast(isEdit ? 'تم تحديث المستخدم' : 'تمت إضافة المستخدم', 'success');
      load();
    });
  }

  function confirmDelete(row) {
    UI.confirm('حذف المستخدم "' + row.Name + '"؟', async function () {
      try { await API.call('users.delete', { id: row.ID }); UI.toast('تم الحذف', 'success'); load(); }
      catch (err) { UI.toast(err.message, 'error'); }
    });
  }

  load();
})();
