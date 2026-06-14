/**
 * pages/settings.js — المستخدمون والصلاحيات (admin فقط)
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
      UI.el('div', {}, [UI.el('h2', { text: 'المستخدمون والصلاحيات' }), UI.el('div', { class: 'page-subtitle', text: 'إدارة حسابات النظام وأدوارها' })]),
      UI.el('button', { class: 'btn btn-primary', text: '+ إضافة مستخدم', onclick: function () { openForm(); } })
    ]);
    page.appendChild(h);

    // شرح الأدوار
    page.appendChild(UI.el('div', { class: 'card', style: 'margin-bottom:16px' }, [
      UI.el('div', { class: 'card-title', text: 'صلاحيات الأدوار' }),
      UI.el('div', { class: 'text-muted', style: 'font-size:13px', html:
        '<strong>مدير النظام:</strong> صلاحية كاملة بما فيها إدارة المستخدمين والحذف.<br>' +
        '<strong>مشرف ميداني:</strong> إضافة وتعديل كل الوحدات وإدارة حالة البلاغات.<br>' +
        '<strong>مراقب:</strong> تسجيل الزيارات والبلاغات والنظافة.<br>' +
        '<strong>قارئ فقط:</strong> عرض البيانات دون تعديل.'
      })
    ]));

    const listWrap = UI.el('div');
    page.appendChild(listWrap);
    UI.showLoading(listWrap);

    try {
      const data = await API.call('users.list', {});
      const columns = [
        { key: 'Name', label: 'الاسم' },
        { key: 'Email', label: 'البريد' },
        { key: 'Role', label: 'الدور', render: function (r) { return Auth.roleLabel(r.Role); } },
        { key: 'Active', label: 'الحالة', render: function (r) { return r.Active ? UI.statusBadge('مكتمل').replace('مكتمل', 'نشط') : '<span class="badge badge-critical">موقوف</span>'; } }
      ];
      listWrap.innerHTML = '';
      listWrap.appendChild(Components.table(columns, data.items, {
        onEdit: function (r) { openForm(r); },
        onDelete: confirmDelete
      }));
    } catch (err) { UI.emptyState(listWrap, err.message); }
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
