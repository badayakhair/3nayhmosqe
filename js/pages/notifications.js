/**
 * pages/notifications.js — الإشعارات والتنبيهات
 */
(function () {
  Layout.render('notifications');
  const page = UI.$('#page');

  async function load() {
    page.innerHTML = '';
    const h = UI.el('div', { class: 'page-header' }, [
      UI.el('div', {}, [UI.el('h2', { text: 'الإشعارات' }), UI.el('div', { class: 'page-subtitle', text: 'التنبيهات الداخلية وتنبيهات البلاغات والصيانة' })])
    ]);
    const actions = UI.el('div', { class: 'row-actions' });
    actions.appendChild(UI.el('button', { class: 'btn btn-ghost', text: 'تعليم الكل كمقروء', onclick: markAll }));
    if (Auth.cap('notifications.generate')) {
      actions.appendChild(UI.el('button', { class: 'btn btn-primary', text: 'فحص التنبيهات الآن', onclick: generate }));
    }
    h.appendChild(actions);
    page.appendChild(h);

    const listWrap = UI.el('div');
    page.appendChild(listWrap);
    UI.showLoading(listWrap);

    try {
      const data = await API.call('notifications.list', {});
      if (!data.items.length) { UI.emptyState(listWrap, 'لا توجد إشعارات.'); return; }

      listWrap.innerHTML = '';
      data.items.forEach(function (n) {
        const unread = !(n.IsRead === true || String(n.IsRead).toLowerCase() === 'true');
        const card = UI.el('div', {
          class: 'card', style: 'margin-bottom:10px;display:flex;gap:14px;align-items:flex-start' + (unread ? ';border-inline-start:4px solid var(--primary)' : '')
        }, [
          UI.el('div', { style: 'font-size:22px', text: n.Type === 'alert' ? '⚠️' : '🔔' }),
          UI.el('div', { style: 'flex:1' }, [
            UI.el('div', { style: 'font-weight:700', text: n.Title }),
            UI.el('div', { class: 'text-muted', style: 'font-size:13px', text: n.Body || '' }),
            UI.el('div', { class: 'text-muted', style: 'font-size:11px;margin-top:4px', text: UI.fmtDateTime(n.CreatedAt) })
          ]),
          unread ? UI.el('button', { class: 'btn btn-ghost btn-sm', text: 'تعليم كمقروء', onclick: async function () {
            try { await API.call('notifications.markRead', { id: n.ID }); Layout.refreshNotificationBadge(); load(); }
            catch (err) { UI.toast(err.message, 'error'); }
          } }) : null
        ]);
        listWrap.appendChild(card);
      });
    } catch (err) { UI.emptyState(listWrap, err.message); }
  }

  async function markAll() {
    try { await API.call('notifications.markRead', { id: 'ALL' }); UI.toast('تم تعليم الكل كمقروء', 'success'); Layout.refreshNotificationBadge(); load(); }
    catch (err) { UI.toast(err.message, 'error'); }
  }

  async function generate() {
    try {
      const r = await API.call('notifications.generate', {});
      UI.toast('تم توليد ' + (r.created || 0) + ' تنبيه', 'success');
      Layout.refreshNotificationBadge(); load();
    } catch (err) { UI.toast(err.message, 'error'); }
  }

  load();
})();
