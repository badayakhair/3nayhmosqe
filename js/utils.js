/**
 * utils.js
 * ----------------------------------------------------------------------------
 * أدوات واجهة مشتركة: إنشاء العناصر، التنبيهات (toast)، النوافذ (modal)،
 * تنسيق التواريخ والأرقام، وبناء عناصر النماذج.
 * ----------------------------------------------------------------------------
 */
window.UI = (function () {

  /* ---- اختصارات DOM ---- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else if (attrs[k] !== null && attrs[k] !== undefined) {
          node.setAttribute(k, attrs[k]);
        }
      });
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  /**
   * يعيد رابطاً آمناً للعرض: يقبل فقط http(s) والروابط النسبية. يمنع
   * javascript: و data: ونحوها (حماية من XSS عبر روابط مخزّنة).
   * يعيد '' إذا كان الرابط غير آمن.
   */
  function safeUrl(u) {
    if (u == null) return '';
    var s = String(u).trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) return s;        // مطلق آمن
    if (/^(\/|\.\/|\.\.\/)/.test(s)) return s;     // نسبي
    if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return ''; // أي مخطط آخر (javascript:, data:…) مرفوض
    return s;                                       // بلا مخطط (نسبي ضمنياً)
  }

  /* ---- التنبيهات (Toast) ---- */
  function toast(message, type) {
    let cont = $('#toast-container');
    if (!cont) {
      cont = el('div', { id: 'toast-container', class: 'toast-container' });
      document.body.appendChild(cont);
    }
    const t = el('div', { class: 'toast toast-' + (type || 'info'), text: message });
    cont.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 10);
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { t.remove(); }, 300);
    }, 3500);
  }

  /* ---- النوافذ المنبثقة (Modal) ---- */
  let _openModals = 0;

  function modal(title, bodyNode, opts) {
    opts = opts || {};
    const overlay = el('div', { class: 'modal-overlay' });
    const box = el('div', { class: 'modal' });

    const header = el('div', { class: 'modal-header' }, [
      el('h3', { text: title }),
      el('button', { class: 'modal-close', html: '&times;', onclick: close })
    ]);
    const body = el('div', { class: 'modal-body' }, [bodyNode]);
    box.appendChild(header);
    box.appendChild(body);

    if (opts.footer) box.appendChild(opts.footer);

    overlay.appendChild(box);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

    // إخفاء خرائط الخلفية برمجياً (الحل المضمون لمنع طبقات Leaflet من الطفو فوق
    // النافذة)، مع استثناء أي خريطة داخل نافذة منبثقة (مثل منتقي موقع المسجد).
    const maps = Array.prototype.slice.call(document.querySelectorAll('.map-container'))
      .filter(function (m) { return !m.closest('.modal-overlay'); });
    maps.forEach(function (m) { m.style.visibility = 'hidden'; });
    _openModals++;
    document.body.classList.add('has-modal');

    document.body.appendChild(overlay);
    setTimeout(function () { overlay.classList.add('show'); }, 10);

    function close() {
      overlay.classList.remove('show');
      _openModals = Math.max(0, _openModals - 1);
      if (_openModals === 0) {
        document.body.classList.remove('has-modal');
        maps.forEach(function (m) { m.style.visibility = ''; });
      }
      setTimeout(function () { overlay.remove(); }, 200);
    }
    return { close: close, overlay: overlay, body: body };
  }

  function confirm(message, onYes) {
    const body = el('p', { text: message });
    const footer = el('div', { class: 'modal-footer' });
    const m = modal('تأكيد', body, { footer: footer });
    footer.appendChild(el('button', { class: 'btn btn-ghost', text: 'إلغاء', onclick: m.close }));
    footer.appendChild(el('button', {
      class: 'btn btn-danger', text: 'تأكيد',
      onclick: function () { m.close(); onYes && onYes(); }
    }));
  }

  /* ---- تنسيق ---- */
  // التقويم الميلادي مع أرقام لاتينية — متّسق مع بقية الأرقام في النظام
  function fmtDate(v) {
    if (!v) return '—';
    const d = new Date(v);
    if (isNaN(d)) return v;
    return d.toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  function fmtDateTime(v) {
    if (!v) return '—';
    const d = new Date(v);
    if (isNaN(d)) return v;
    return d.toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' }) + ' ' +
           d.toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit' });
  }

  function fmtNum(v) {
    const n = Number(v) || 0;
    // أرقام لاتينية (0-9) أوضح وأنظف في لوحات المؤشرات من الأرقام العربية-الهندية
    return n.toLocaleString('en-US');
  }

  function todayInput() {
    return new Date().toISOString().slice(0, 10);
  }

  /* ---- شارات الحالة/الأولوية ---- */
  function statusBadge(status) {
    const map = { 'جديد': 'new', 'تحت التنفيذ': 'progress', 'مكتمل': 'done', 'مؤجل': 'hold' };
    return '<span class="badge badge-' + (map[status] || 'new') + '">' + escapeHtml(status) + '</span>';
  }

  function priorityBadge(p) {
    const map = { 'منخفضة': 'low', 'متوسطة': 'med', 'عالية': 'high', 'حرجة': 'critical' };
    return '<span class="badge badge-' + (map[p] || 'low') + '">' + escapeHtml(p) + '</span>';
  }

  function assetStatusBadge(s) {
    const map = { 'يعمل': 'done', 'يحتاج صيانة': 'med', 'معطل': 'critical', 'خارج الخدمة': 'hold' };
    return '<span class="badge badge-' + (map[s] || 'new') + '">' + escapeHtml(s) + '</span>';
  }

  function ratingStars(n) {
    n = Number(n) || 0;
    let s = '';
    for (let i = 1; i <= 5; i++) s += '<span class="star ' + (i <= n ? 'on' : '') + '">★</span>';
    return '<span class="rating">' + s + '</span>';
  }

  /* ---- مؤشر التحميل ---- */
  function showLoading(target) {
    const node = typeof target === 'string' ? $(target) : target;
    if (node) node.innerHTML = '<div class="loading"><div class="spinner"></div><span>جارٍ التحميل…</span></div>';
  }

  function emptyState(target, message) {
    const node = typeof target === 'string' ? $(target) : target;
    if (node) node.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>' + escapeHtml(message || 'لا توجد بيانات') + '</p></div>';
  }

  return {
    $: $, $all: $all, el: el, escapeHtml: escapeHtml, safeUrl: safeUrl,
    toast: toast, modal: modal, confirm: confirm,
    fmtDate: fmtDate, fmtDateTime: fmtDateTime, fmtNum: fmtNum, todayInput: todayInput,
    statusBadge: statusBadge, priorityBadge: priorityBadge,
    assetStatusBadge: assetStatusBadge, ratingStars: ratingStars,
    showLoading: showLoading, emptyState: emptyState
  };
})();
