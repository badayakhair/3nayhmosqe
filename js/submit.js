/**
 * submit.js — منطق النموذج العام (صفحة submit.html)
 * ----------------------------------------------------------------------------
 * صفحة عامة مستقلة تماماً عن النظام الداخلي: لا تحمّل auth/layout/api.
 * تستدعي مسارَين عامَّين فقط على نفس الخادم: public.config و public.submit.
 * ----------------------------------------------------------------------------
 */
(function () {
  const app = document.getElementById('app');
  let cfg = null;
  let kind = null;          // 'report' | 'need'
  let formArea = null;

  /** اتصال مباشر بالخادم (بلا توكن) — مساران عامان فقط. */
  async function postPublic(action, payload) {
    if (!APP_CONFIG.API_URL || APP_CONFIG.API_URL.indexOf('REPLACE_WITH') > -1) {
      throw new Error('لم يتم ضبط رابط الخدمة بعد.');
    }
    const body = JSON.stringify({ action: action, payload: payload || {} });
    let res;
    try {
      res = await fetch(APP_CONFIG.API_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: body, redirect: 'follow'
      });
    } catch (e) { throw new Error('تعذّر الاتصال بالخادم. تحقق من اتصال الإنترنت.'); }
    let json;
    try { json = await res.json(); } catch (e) { throw new Error('استجابة غير صالحة من الخادم.'); }
    if (!json.ok) throw new Error((json.error && json.error.message) || 'حدث خطأ غير متوقع.');
    return json.data;
  }

  function logo() {
    return UI.el('div', { class: 'pub-logo' }, [
      UI.el('div', { class: 'icon', text: '🕌' }),
      UI.el('h1', { text: 'بوابة طلبات المساجد' }),
      UI.el('p', { text: (cfg && cfg.org) || 'جمعية العناية بالمساجد' })
    ]);
  }

  function field(labelText, input, hint) {
    const row = UI.el('div', { class: 'form-row' }, [
      UI.el('label', { class: 'form-label', text: labelText }), input
    ]);
    if (hint) row.appendChild(UI.el('div', { class: 'text-muted', style: 'font-size:11px;margin-top:2px', text: hint }));
    return row;
  }

  function selectEl(options, placeholder) {
    const sel = UI.el('select', { class: 'select' });
    if (placeholder) sel.appendChild(UI.el('option', { value: '', text: placeholder }));
    options.forEach(function (o) {
      const obj = typeof o === 'object' ? o : { value: o, label: o };
      sel.appendChild(UI.el('option', { value: obj.value, text: obj.label }));
    });
    return sel;
  }

  /* ---- المسجد: حقل بحث + قائمة تُفلتر ---- */
  function mosquePicker() {
    const wrap = UI.el('div');
    const search = UI.el('input', { class: 'input', type: 'search', placeholder: 'ابحث باسم المسجد أو الحي…', style: 'margin-bottom:6px' });
    const sel = UI.el('select', { class: 'select' });

    function fill(q) {
      sel.innerHTML = '';
      sel.appendChild(UI.el('option', { value: '', text: '— اختر المسجد —' }));
      const ql = (q || '').trim().toLowerCase();
      cfg.mosques.forEach(function (m) {
        const text = m.name + (m.district ? ' — ' + m.district : '') + (m.city ? '، ' + m.city : '');
        if (ql && text.toLowerCase().indexOf(ql) === -1) return;
        sel.appendChild(UI.el('option', { value: m.id, text: text }));
      });
    }
    fill('');
    search.addEventListener('input', function () { fill(search.value); });
    wrap.appendChild(search);
    wrap.appendChild(sel);
    wrap._select = sel;
    return wrap;
  }

  function renderChooser() {
    app.innerHTML = '';
    app.appendChild(logo());
    app.appendChild(UI.el('div', { class: 'pub-intro',
      text: 'ساعدنا في العناية بمساجدنا — أبلغ عن مشكلة أو اطلب احتياجاً، وسيصل طلبك مباشرة للفريق المختص.' }));

    const toggle = UI.el('div', { class: 'kind-toggle' });
    const reportBtn = UI.el('button', { class: 'kind-btn' + (kind === 'report' ? ' active' : ''), type: 'button' }, [
      UI.el('span', { class: 'k-icon', text: '🚩' }),
      UI.el('span', { class: 'k-label', text: 'بلاغ / مشكلة' }),
      UI.el('span', { class: 'k-desc', text: 'عطل، نظافة، تكييف، كهرباء…' })
    ]);
    const needBtn = UI.el('button', { class: 'kind-btn' + (kind === 'need' ? ' active' : ''), type: 'button' }, [
      UI.el('span', { class: 'k-icon', text: '📋' }),
      UI.el('span', { class: 'k-label', text: 'طلب احتياج' }),
      UI.el('span', { class: 'k-desc', text: 'فرش، مصاحف، أجهزة، تجهيزات…' })
    ]);
    reportBtn.addEventListener('click', function () { kind = 'report'; renderChooser(); });
    needBtn.addEventListener('click', function () { kind = 'need'; renderChooser(); });
    toggle.appendChild(reportBtn);
    toggle.appendChild(needBtn);
    app.appendChild(toggle);

    formArea = UI.el('div');
    app.appendChild(formArea);
    if (kind) renderForm();

    app.appendChild(UI.el('div', { class: 'pub-footer', text: '© ' + ((cfg && cfg.org) || 'جمعية العناية بالمساجد') }));
  }

  function renderForm() {
    formArea.innerHTML = '';
    const form = UI.el('div', { class: 'pub-form' });

    // معلومات المسجد
    const picker = mosquePicker();
    form.appendChild(field('المسجد *', picker));

    // حقول خاصة بالنوع
    let typeSel, prioSel, descInp;          // بلاغ
    let catSel, itemInp, qtyInp, unitInp, notesInp;  // احتياج

    if (kind === 'report') {
      form.appendChild(UI.el('div', { class: 'pub-section-title', text: 'تفاصيل البلاغ' }));
      typeSel = selectEl(cfg.reportTypes, '— نوع البلاغ —');
      form.appendChild(field('نوع البلاغ *', typeSel));
      prioSel = selectEl(cfg.reportPriority, '');
      prioSel.value = 'متوسطة';
      form.appendChild(field('درجة الأهمية', prioSel));
      descInp = UI.el('textarea', { class: 'textarea', placeholder: 'صف المشكلة بوضوح (مكانها، منذ متى…)' });
      form.appendChild(field('وصف المشكلة *', descInp));
    } else {
      form.appendChild(UI.el('div', { class: 'pub-section-title', text: 'تفاصيل الاحتياج' }));
      catSel = selectEl(cfg.needsCategories, '— فئة الاحتياج —');
      form.appendChild(field('الفئة *', catSel));
      itemInp = UI.el('input', { class: 'input', type: 'text', placeholder: 'مثال: مصاحف، سجاد، مكيّف…' });
      form.appendChild(field('الصنف المطلوب *', itemInp));
      qtyInp = UI.el('input', { class: 'input', type: 'number', min: '0', placeholder: 'العدد التقريبي' });
      unitInp = UI.el('input', { class: 'input', type: 'text', placeholder: 'الوحدة (حبة، علبة…)' });
      form.appendChild(UI.el('div', { class: 'form-grid' }, [field('الكمية', qtyInp), field('الوحدة', unitInp)]));
      notesInp = UI.el('textarea', { class: 'textarea', placeholder: 'تفاصيل إضافية (اختياري)' });
      form.appendChild(field('ملاحظات', notesInp));
    }

    // بيانات المُبلِّغ
    form.appendChild(UI.el('div', { class: 'pub-section-title', text: 'بيانات التواصل (اختياري)' }));
    const roleSel = selectEl(cfg.submitterRoles || [], '— صفتك —');
    form.appendChild(field('الصفة', roleSel));
    const nameInp = UI.el('input', { class: 'input', type: 'text', placeholder: 'اسمك (اختياري)' });
    form.appendChild(field('الاسم', nameInp));
    const phoneInp = UI.el('input', { class: 'input', type: 'tel', placeholder: '05xxxxxxxx', inputmode: 'numeric' });
    form.appendChild(field('رقم الجوال', phoneInp, 'للتواصل معك عند الحاجة ومتابعة الطلب.'));

    // فخّ الروبوتات
    const hp = UI.el('input', { class: 'hp-field', type: 'text', name: 'company', tabindex: '-1', autocomplete: 'off' });
    form.appendChild(hp);

    const submitBtn = UI.el('button', { class: 'btn btn-primary', type: 'button', style: 'margin-top:8px;justify-content:center',
      text: kind === 'report' ? 'إرسال البلاغ' : 'إرسال الطلب' });

    submitBtn.addEventListener('click', async function () {
      const mosqueId = picker._select.value;
      if (!mosqueId) { UI.toast('يرجى اختيار المسجد.', 'error'); return; }

      const payload = {
        kind: kind, mosqueId: mosqueId,
        submitterRole: roleSel.value, submitterName: nameInp.value, submitterPhone: phoneInp.value,
        _hp: hp.value
      };

      if (kind === 'report') {
        if (!typeSel.value) { UI.toast('يرجى تحديد نوع البلاغ.', 'error'); return; }
        if (!descInp.value.trim()) { UI.toast('يرجى كتابة وصف المشكلة.', 'error'); return; }
        payload.type = typeSel.value;
        payload.priority = prioSel.value;
        payload.description = descInp.value;
      } else {
        if (!catSel.value) { UI.toast('يرجى تحديد فئة الاحتياج.', 'error'); return; }
        if (!itemInp.value.trim()) { UI.toast('يرجى تحديد الصنف المطلوب.', 'error'); return; }
        payload.category = catSel.value;
        payload.item = itemInp.value;
        payload.needed = qtyInp.value;
        payload.unit = unitInp.value;
        payload.notes = notesInp.value;
      }

      submitBtn.disabled = true; submitBtn.textContent = 'جارٍ الإرسال…';
      try {
        const res = await postPublic('public.submit', payload);
        renderSuccess(res.ref);
      } catch (err) {
        UI.toast(err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = kind === 'report' ? 'إرسال البلاغ' : 'إرسال الطلب';
      }
    });

    form.appendChild(submitBtn);
    formArea.appendChild(form);
  }

  function renderSuccess(ref) {
    app.innerHTML = '';
    app.appendChild(logo());
    const box = UI.el('div', { class: 'pub-success' }, [
      UI.el('div', { class: 's-icon', text: '✅' }),
      UI.el('h2', { text: 'تم استلام طلبك بنجاح' }),
      UI.el('p', { class: 'text-muted', text: 'شكراً لمساهمتك في العناية بمساجدنا. سيطّلع الفريق المختص على طلبك قريباً.' })
    ]);
    if (ref) box.appendChild(UI.el('div', { class: 's-ref', text: 'رقم الطلب: ' + ref }));
    box.appendChild(UI.el('div', { style: 'margin-top:16px' }, [
      UI.el('button', { class: 'btn btn-primary', style: 'justify-content:center', text: '＋ إرسال طلب آخر',
        onclick: function () { kind = null; renderChooser(); } })
    ]));
    app.appendChild(box);
    app.appendChild(UI.el('div', { class: 'pub-footer', text: '© ' + ((cfg && cfg.org) || 'جمعية العناية بالمساجد') }));
  }

  async function init() {
    try { cfg = await postPublic('public.config', {}); }
    catch (err) {
      app.innerHTML = '';
      app.appendChild(logo());
      app.appendChild(UI.el('div', { class: 'empty-state' }, [
        UI.el('div', { class: 'empty-icon', text: '⚠️' }),
        UI.el('p', { text: err.message })
      ]));
      return;
    }
    renderChooser();
  }

  init();
})();
