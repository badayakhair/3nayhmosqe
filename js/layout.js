/**
 * layout.js
 * ----------------------------------------------------------------------------
 * يبني قشرة التطبيق المشتركة (الشريط الجانبي + الشريط العلوي) ويحقنها في الصفحة.
 * كل صفحة محمية تستدعي Layout.render('pageKey').
 * ----------------------------------------------------------------------------
 */
window.Layout = (function () {

  // عناصر القائمة الجانبية: المفتاح، العنوان، الأيقونة، الرابط، الأدوار المسموح لها بالرؤية
  const NAV = [
    { key: 'dashboard',     label: 'لوحة التحكم',   icon: '📊', href: 'dashboard.html' },
    { key: 'mosques',       label: 'المساجد',        icon: '🕌', href: 'mosques.html' },
    { key: 'visits',        label: 'الزيارات الميدانية', icon: '📋', href: 'visits.html' },
    { key: 'reports',       label: 'البلاغات',       icon: '🚩', href: 'reports.html' },
    { key: 'maintenance',   label: 'الصيانة',        icon: '🔧', href: 'maintenance.html' },
    { key: 'cleaning',      label: 'النظافة',        icon: '🧹', href: 'cleaning.html' },
    { key: 'assets',        label: 'الأصول',         icon: '📦', href: 'assets.html' },
    { key: 'notifications', label: 'الإشعارات',      icon: '🔔', href: 'notifications.html' },
    { key: 'settings',      label: 'المستخدمون',     icon: '⚙️', href: 'settings.html', roles: ['admin'] }
  ];

  function render(activeKey) {
    if (!Auth.requireAuth()) return;
    const user = Auth.getUser();

    const sidebar = buildSidebar(activeKey, user);
    const topbar = buildTopbar(activeKey, user);

    // إطار التطبيق
    const app = UI.el('div', { class: 'app-shell' });
    const main = UI.el('div', { class: 'app-main' });
    main.appendChild(topbar);

    // نقل محتوى <main id="page"> الأصلي إلى داخل القشرة
    const page = document.getElementById('page') || UI.el('main', { id: 'page', class: 'page-content' });
    main.appendChild(page);

    app.appendChild(sidebar);
    app.appendChild(main);

    document.body.insertBefore(app, document.body.firstChild);

    // زر فتح/إغلاق الشريط الجانبي على الجوال
    const toggle = topbar.querySelector('.menu-toggle');
    toggle.addEventListener('click', function () { sidebar.classList.toggle('open'); });
    document.addEventListener('click', function (e) {
      if (window.innerWidth <= 900 && sidebar.classList.contains('open') &&
          !sidebar.contains(e.target) && !toggle.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });

    // تحديث عدّاد الإشعارات
    refreshNotificationBadge();
  }

  function buildSidebar(activeKey, user) {
    const items = NAV.filter(function (n) { return !n.roles || Auth.can(n.roles); }).map(function (n) {
      return UI.el('a', {
        class: 'nav-item' + (n.key === activeKey ? ' active' : ''),
        href: n.href
      }, [
        UI.el('span', { class: 'nav-icon', text: n.icon }),
        UI.el('span', { class: 'nav-label', text: n.label }),
        n.key === 'notifications' ? UI.el('span', { class: 'nav-badge', id: 'nav-notif-badge', style: 'display:none' }) : null
      ]);
    });

    return UI.el('aside', { class: 'sidebar' }, [
      UI.el('div', { class: 'sidebar-brand' }, [
        UI.el('span', { class: 'brand-icon', text: '🕌' }),
        UI.el('div', {}, [
          UI.el('div', { class: 'brand-name', text: APP_CONFIG.APP_NAME }),
          UI.el('div', { class: 'brand-org', text: APP_CONFIG.ORG_NAME })
        ])
      ]),
      UI.el('nav', { class: 'nav' }, items),
      UI.el('div', { class: 'sidebar-footer', text: 'الإصدار ' + APP_CONFIG.VERSION })
    ]);
  }

  function buildTopbar(activeKey, user) {
    const current = NAV.find(function (n) { return n.key === activeKey; });

    const userMenu = UI.el('div', { class: 'user-menu' }, [
      UI.el('button', { class: 'user-btn', id: 'user-btn' }, [
        UI.el('span', { class: 'avatar', text: (user.name || '؟').charAt(0) }),
        UI.el('span', { class: 'user-info' }, [
          UI.el('span', { class: 'user-name', text: user.name }),
          UI.el('span', { class: 'user-role', text: Auth.roleLabel(user.role) })
        ])
      ]),
      UI.el('div', { class: 'user-dropdown', id: 'user-dropdown' }, [
        UI.el('button', { class: 'dropdown-item', text: 'تغيير كلمة المرور', onclick: openChangePassword }),
        UI.el('button', { class: 'dropdown-item danger', text: 'تسجيل الخروج', onclick: function () { Auth.logout(); } })
      ])
    ]);

    const topbar = UI.el('header', { class: 'topbar' }, [
      UI.el('button', { class: 'menu-toggle', html: '☰' }),
      UI.el('h1', { class: 'page-title', text: current ? current.label : '' }),
      UI.el('div', { class: 'topbar-actions' }, [
        UI.el('a', { class: 'notif-bell', href: 'notifications.html', title: 'الإشعارات' }, [
          UI.el('span', { text: '🔔' }),
          UI.el('span', { class: 'notif-count', id: 'topbar-notif-count', style: 'display:none' })
        ]),
        userMenu
      ])
    ]);

    // فتح/إغلاق قائمة المستخدم
    topbar.querySelector('#user-btn').addEventListener('click', function (e) {
      e.stopPropagation();
      topbar.querySelector('#user-dropdown').classList.toggle('open');
    });
    document.addEventListener('click', function () {
      const dd = topbar.querySelector('#user-dropdown');
      if (dd) dd.classList.remove('open');
    });

    return topbar;
  }

  async function refreshNotificationBadge() {
    try {
      const data = await API.call('notifications.list', { unreadOnly: true });
      const count = data.unread || 0;
      ['#nav-notif-badge', '#topbar-notif-count'].forEach(function (sel) {
        const node = document.querySelector(sel);
        if (!node) return;
        if (count > 0) { node.textContent = count > 99 ? '99+' : count; node.style.display = ''; }
        else node.style.display = 'none';
      });
    } catch (e) { /* تجاهل */ }
  }

  function openChangePassword() {
    const form = UI.el('form', { class: 'form' }, [
      field('كلمة المرور الحالية', UI.el('input', { type: 'password', name: 'oldPassword', required: 'true', class: 'input' })),
      field('كلمة المرور الجديدة', UI.el('input', { type: 'password', name: 'newPassword', required: 'true', minlength: '6', class: 'input' }))
    ]);
    const footer = UI.el('div', { class: 'modal-footer' });
    const m = UI.modal('تغيير كلمة المرور', form, { footer: footer });
    footer.appendChild(UI.el('button', { class: 'btn btn-ghost', text: 'إلغاء', onclick: m.close }));
    footer.appendChild(UI.el('button', {
      class: 'btn btn-primary', text: 'حفظ',
      onclick: async function () {
        const fd = new FormData(form);
        try {
          await API.call('auth.changePassword', { oldPassword: fd.get('oldPassword'), newPassword: fd.get('newPassword') });
          m.close();
          UI.toast('تم تغيير كلمة المرور بنجاح', 'success');
        } catch (err) { UI.toast(err.message, 'error'); }
      }
    }));
  }

  function field(label, inputNode) {
    return UI.el('div', { class: 'form-row' }, [
      UI.el('label', { class: 'form-label', text: label }),
      inputNode
    ]);
  }

  return { render: render, refreshNotificationBadge: refreshNotificationBadge, NAV: NAV };
})();
