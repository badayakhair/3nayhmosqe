/**
 * components.js
 * ----------------------------------------------------------------------------
 * مكوّنات قابلة لإعادة الاستخدام مبنية على وصف الحقول (field specs):
 * - بناء جدول بيانات مع أزرار إجراءات.
 * - بناء نموذج من وصف الحقول.
 * - قائمة منسدلة للمساجد.
 * - مخططات بسيطة (أعمدة وخط) بدون مكتبات خارجية.
 * ----------------------------------------------------------------------------
 */
window.Components = (function () {

  /**
   * بناء جدول بيانات.
   * @param {Array} columns [{ key, label, render?(row) }]
   * @param {Array} rows
   * @param {object} actions { onView, onEdit, onDelete } — اختيارية وتُخفى للقارئ
   */
  function table(columns, rows, actions) {
    actions = actions || {};
    const showActions = actions.onView || actions.onEdit || actions.onDelete;

    const thead = UI.el('thead', {}, [
      UI.el('tr', {}, columns.map(function (c) { return UI.el('th', { text: c.label }); })
        .concat(showActions ? [UI.el('th', { text: 'إجراءات' })] : []))
    ]);

    const tbody = UI.el('tbody');
    rows.forEach(function (row) {
      const tds = columns.map(function (c) {
        const td = UI.el('td');
        const val = c.render ? c.render(row) : row[c.key];
        if (c.render) td.innerHTML = (val == null ? '—' : val);
        else td.textContent = (val == null || val === '' ? '—' : val);
        return td;
      });

      if (showActions) {
        const cell = UI.el('td');
        const wrap = UI.el('div', { class: 'row-actions' });
        if (actions.onView) wrap.appendChild(UI.el('button', { class: 'btn btn-ghost btn-sm', text: 'عرض', onclick: function () { actions.onView(row); } }));
        if (actions.onEdit) wrap.appendChild(UI.el('button', { class: 'btn btn-ghost btn-sm', text: 'تعديل', onclick: function () { actions.onEdit(row); } }));
        if (actions.onDelete) wrap.appendChild(UI.el('button', { class: 'btn btn-danger btn-sm', text: 'حذف', onclick: function () { actions.onDelete(row); } }));
        cell.appendChild(wrap);
        tds.push(cell);
      }
      tbody.appendChild(UI.el('tr', {}, tds));
    });

    return UI.el('div', { class: 'table-wrap' }, [
      UI.el('table', { class: 'data-table' }, [thead, tbody])
    ]);
  }

  /**
   * بناء نموذج من وصف الحقول.
   * fields: [{ name, label, type, options?, required?, value?, full?, min?, step? }]
   * type: text|number|date|textarea|select|password|email
   * يعيد { formNode, getValues() }
   */
  function form(fields, values) {
    values = values || {};
    const grid = UI.el('div', { class: 'form-grid' });
    const formNode = UI.el('form', { class: 'form' }, [grid]);

    fields.forEach(function (f) {
      let input;
      const v = values[f.name] !== undefined ? values[f.name] : (f.value !== undefined ? f.value : '');

      if (f.type === 'textarea') {
        input = UI.el('textarea', { class: 'textarea', name: f.name });
        input.value = v;
      } else if (f.type === 'select') {
        input = UI.el('select', { class: 'select', name: f.name });
        if (!f.required) input.appendChild(UI.el('option', { value: '', text: '— اختر —' }));
        (f.options || []).forEach(function (opt) {
          const o = typeof opt === 'object' ? opt : { value: opt, label: opt };
          const optNode = UI.el('option', { value: o.value, text: o.label });
          if (String(o.value) === String(v)) optNode.setAttribute('selected', 'true');
          input.appendChild(optNode);
        });
      } else {
        const attrs = { class: 'input', type: f.type || 'text', name: f.name };
        if (f.min !== undefined) attrs.min = f.min;
        if (f.step !== undefined) attrs.step = f.step;
        input = UI.el('input', attrs);
        input.value = v;
      }
      if (f.required) input.setAttribute('required', 'true');

      const row = UI.el('div', { class: 'form-row' + (f.full ? ' full' : '') }, [
        UI.el('label', { class: 'form-label', text: f.label + (f.required ? ' *' : '') }),
        input
      ]);
      grid.appendChild(row);
    });

    function getValues() {
      const fd = new FormData(formNode);
      const out = {};
      fields.forEach(function (f) { out[f.name] = fd.get(f.name); });
      return out;
    }

    return { formNode: formNode, getValues: getValues };
  }

  /**
   * فتح نموذج داخل نافذة منبثقة (إنشاء/تعديل).
   */
  function formModal(title, fields, values, onSubmit) {
    const built = form(fields, values);
    const footer = UI.el('div', { class: 'modal-footer' });
    const m = UI.modal(title, built.formNode, { footer: footer });
    footer.appendChild(UI.el('button', { class: 'btn btn-ghost', text: 'إلغاء', onclick: m.close }));
    const saveBtn = UI.el('button', {
      class: 'btn btn-primary', text: 'حفظ',
      onclick: async function () {
        if (!built.formNode.reportValidity()) return;
        saveBtn.disabled = true; saveBtn.textContent = 'جارٍ الحفظ…';
        try {
          await onSubmit(built.getValues(), m);
        } catch (err) {
          UI.toast(err.message, 'error');
          saveBtn.disabled = false; saveBtn.textContent = 'حفظ';
        }
      }
    });
    footer.appendChild(saveBtn);
    return m;
  }

  /**
   * تحميل قائمة المساجد كخيارات [{value:ID, label:Name}].
   */
  async function mosqueOptions() {
    const data = await API.call('mosques.list', {});
    return data.items.map(function (m) { return { value: m.ID, label: m.Name }; });
  }

  /* ===================== المخططات ===================== */

  /**
   * مخطط أعمدة أفقي من كائن { label: value }.
   */
  function barChart(dataObj, colorClass) {
    const entries = Object.keys(dataObj).map(function (k) { return { label: k, value: Number(dataObj[k]) || 0 }; });
    const max = Math.max.apply(null, entries.map(function (e) { return e.value; }).concat([1]));
    const wrap = UI.el('div', { class: 'bar-chart' });
    entries.forEach(function (e) {
      const pct = Math.round((e.value / max) * 100);
      wrap.appendChild(UI.el('div', { class: 'bar-row' }, [
        UI.el('div', { class: 'bar-label', text: e.label }),
        UI.el('div', { class: 'bar-track' }, [
          UI.el('div', { class: 'bar-fill ' + (colorClass || ''), style: 'width:' + pct + '%' })
        ]),
        UI.el('div', { class: 'bar-value', text: UI.fmtNum(e.value) })
      ]));
    });
    return wrap;
  }

  /**
   * مخطط خطي بسيط بـ SVG من سلسلة [{label, value}].
   */
  function lineChart(series) {
    const w = 600, h = 160, pad = 30;
    const max = Math.max.apply(null, series.map(function (s) { return s.value; }).concat([1]));
    const stepX = (w - pad * 2) / Math.max(series.length - 1, 1);

    const points = series.map(function (s, i) {
      const x = pad + i * stepX;
      const y = h - pad - (s.value / max) * (h - pad * 2);
      return { x: x, y: y, s: s };
    });

    const path = points.map(function (p, i) { return (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ');
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);

    const poly = document.createElementNS(ns, 'path');
    poly.setAttribute('d', path);
    poly.setAttribute('fill', 'none');
    poly.setAttribute('stroke', getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#1f6f54');
    poly.setAttribute('stroke-width', '2.5');
    svg.appendChild(poly);

    points.forEach(function (p) {
      const c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', '3.5');
      c.setAttribute('fill', '#1f6f54');
      svg.appendChild(c);

      const t = document.createElementNS(ns, 'text');
      t.setAttribute('x', p.x); t.setAttribute('y', h - 8);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '9'); t.setAttribute('fill', '#6b7280');
      t.textContent = p.s.label.slice(2); // يكفي عرض الشهر
      svg.appendChild(t);

      const tv = document.createElementNS(ns, 'text');
      tv.setAttribute('x', p.x); tv.setAttribute('y', p.y - 8);
      tv.setAttribute('text-anchor', 'middle'); tv.setAttribute('font-size', '9'); tv.setAttribute('fill', '#1f2a37');
      tv.textContent = p.s.value;
      svg.appendChild(tv);
    });

    return UI.el('div', { class: 'line-chart' }, [svg]);
  }

  return {
    table: table, form: form, formModal: formModal,
    mosqueOptions: mosqueOptions, barChart: barChart, lineChart: lineChart
  };
})();
