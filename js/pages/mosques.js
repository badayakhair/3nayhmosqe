/**
 * pages/mosques.js — إدارة المساجد
 */
(function () {
  Layout.render('mosques');
  const page = UI.$('#page');

  const FIELDS = [
    { name: 'Name', label: 'اسم المسجد', type: 'text', required: true, full: true },
    { name: 'District', label: 'الحي', type: 'text', required: true },
    { name: 'City', label: 'المدينة', type: 'text', required: true },
    { name: 'Capacity', label: 'عدد المصلين التقريبي', type: 'number', min: 0 },
    { name: 'Toilets', label: 'عدد دورات المياه', type: 'number', min: 0 },
    { name: 'ACs', label: 'عدد المكيفات', type: 'number', min: 0 },
    { name: 'Courts', label: 'عدد الساحات', type: 'number', min: 0 },
    { name: 'MapURL', label: 'رابط موقع Google Maps (الصق رابط الموقع — تُستخرج الإحداثيات تلقائياً)', type: 'text', full: true },
    { name: 'Images', label: 'روابط الصور (مفصولة بفاصلة)', type: 'text', full: true },
    { name: 'Notes', label: 'ملاحظات عامة', type: 'textarea', full: true }
  ];

  function header() {
    const h = UI.el('div', { class: 'page-header' }, [
      UI.el('div', {}, [UI.el('h2', { text: 'سجل المساجد' }), UI.el('div', { class: 'page-subtitle', text: 'إدارة بيانات المساجد الكاملة' })])
    ]);
    if (!Auth.isReadOnly() && Auth.can(['admin', 'supervisor'])) {
      h.appendChild(UI.el('button', { class: 'btn btn-primary', text: '+ إضافة مسجد', onclick: function () { openForm(); } }));
    }
    return h;
  }

  async function load() {
    page.innerHTML = '';
    page.appendChild(header());
    const listWrap = UI.el('div');
    page.appendChild(listWrap);
    UI.showLoading(listWrap);

    try {
      const data = await API.call('mosques.list', {});
      if (!data.items.length) { UI.emptyState(listWrap, 'لا توجد مساجد بعد. ابدأ بإضافة مسجد.'); return; }

      const columns = [
        { key: 'Name', label: 'اسم المسجد' },
        { key: 'District', label: 'الحي' },
        { key: 'City', label: 'المدينة' },
        { key: 'Capacity', label: 'المصلون', render: function (r) { return UI.fmtNum(r.Capacity); } },
        { key: 'Toilets', label: 'دورات المياه' },
        { key: 'ACs', label: 'المكيفات' }
      ];
      listWrap.innerHTML = '';
      listWrap.appendChild(Components.table(columns, data.items, {
        onView: viewDetail,
        onEdit: function (r) { openForm(r); },
        onDelete: Auth.can(['admin']) ? confirmDelete : null
      }));

      renderMap(data.items);
    } catch (err) { UI.emptyState(listWrap, err.message); }
  }

  /**
   * خريطة تفاعلية أسفل القائمة تُظهر مواقع المساجد التي لها إحداثيات.
   */
  function renderMap(items) {
    const geo = items.filter(function (m) {
      return m.Lat !== '' && m.Lng !== '' && !isNaN(Number(m.Lat)) && !isNaN(Number(m.Lng));
    });

    const card = UI.el('div', { class: 'card mt-16' }, [
      UI.el('div', { class: 'card-title', text: '🗺️ خريطة المساجد' })
    ]);
    page.appendChild(card);

    if (typeof window.L === 'undefined') {
      card.appendChild(UI.el('div', { class: 'text-muted', text: 'تعذّر تحميل مكتبة الخرائط (تحقق من الاتصال بالإنترنت).' }));
      return;
    }
    if (!geo.length) {
      card.appendChild(UI.el('div', { class: 'text-muted',
        text: 'لا توجد مساجد بإحداثيات بعد. أضِف خط العرض (Lat) وخط الطول (Lng) لمسجد لإظهاره على الخريطة.' }));
      return;
    }

    const mapDiv = UI.el('div', { class: 'map-container', id: 'mosques-map' });
    card.appendChild(mapDiv);

    // الإنشاء يحتاج أن يكون العنصر داخل DOM وله أبعاد
    setTimeout(function () {
      const map = L.map(mapDiv).setView([Number(geo[0].Lat), Number(geo[0].Lng)], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© OpenStreetMap'
      }).addTo(map);

      const bounds = [];
      geo.forEach(function (m) {
        const lat = Number(m.Lat), lng = Number(m.Lng);
        bounds.push([lat, lng]);
        const link = m.MapURL || ('https://maps.google.com/?q=' + lat + ',' + lng);
        const popup =
          '<strong>' + UI.escapeHtml(m.Name) + '</strong><br>' +
          UI.escapeHtml(m.District + '، ' + m.City) + '<br>' +
          'المصلون: ' + UI.fmtNum(m.Capacity) + '<br>' +
          '<a href="' + UI.escapeHtml(link) + '" target="_blank">فتح في خرائط Google</a>';
        L.marker([lat, lng]).addTo(map).bindPopup(popup);
      });
      if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40] });
      // إصلاح أبعاد الخريطة بعد ظهورها
      setTimeout(function () { map.invalidateSize(); }, 200);
    }, 50);
  }

  /**
   * استخراج الإحداثيات من رابط Google Maps على جانب العميل
   * (نفس ترتيب الأولوية الموجود في extractCoords_ بـ Code.gs)
   */
  function extractCoordsFromUrl(url) {
    if (!url) return null;
    // !3d!4d يظهر مرتين في روابط الأماكن — آخر تطابق هو الموقع الفعلي من قاعدة Google
    var pat = /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/g;
    var last = null, m;
    while ((m = pat.exec(url)) !== null) { last = m; }
    if (last) return { lat: last[1], lng: last[2] };

    var patterns = [
      /[?&]q=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
      /[?&]ll=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
      /[?&]daddr=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
      /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
      /\/(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/
    ];
    for (var i = 0; i < patterns.length; i++) {
      var r = url.match(patterns[i]);
      if (r) return { lat: r[1], lng: r[2] };
    }
    return null;
  }

  /** هل الرابط مختصر (يحتاج redirect من الخادم)؟ */
  function isShortMapUrl(url) {
    return /maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url);
  }

  function openForm(row) {
    const isEdit = !!row;
    Components.formModal(isEdit ? 'تعديل مسجد' : 'إضافة مسجد', FIELDS, row || {}, async function (vals, m) {
      const payload = Object.assign({}, vals);
      const mapUrl = (vals.MapURL || '').trim();

      // استخراج الإحداثيات محلياً إن أمكن لتفادي بطء UrlFetchApp
      if (mapUrl && !isShortMapUrl(mapUrl)) {
        const coords = extractCoordsFromUrl(mapUrl);
        if (coords) {
          payload._clientLat = coords.lat;
          payload._clientLng = coords.lng;
        }
      }

      if (isEdit) { payload.id = row.ID; await API.call('mosques.update', payload); }
      else { await API.call('mosques.create', payload); }
      m.close();
      UI.toast(isEdit ? 'تم تحديث المسجد' : 'تمت إضافة المسجد', 'success');
      load();
    });
  }

  function confirmDelete(row) {
    UI.confirm('حذف المسجد "' + row.Name + '"؟', async function () {
      try { await API.call('mosques.delete', { id: row.ID }); UI.toast('تم الحذف', 'success'); load(); }
      catch (err) { UI.toast(err.message, 'error'); }
    });
  }

  function viewDetail(row) {
    const body = UI.el('div', { class: 'detail-list' });
    const rows = [
      ['اسم المسجد', row.Name], ['الحي', row.District], ['المدينة', row.City],
      ['عدد المصلين', UI.fmtNum(row.Capacity)], ['دورات المياه', row.Toilets],
      ['المكيفات', row.ACs], ['الساحات', row.Courts],
      ['الموقع', (row.Lat && row.Lng) ? (row.Lat + ', ' + row.Lng) : '—'],
      ['ملاحظات', row.Notes || '—'], ['أُضيف في', UI.fmtDateTime(row.CreatedAt)]
    ];
    rows.forEach(function (r) {
      body.appendChild(UI.el('div', { class: 'detail-row' }, [
        UI.el('div', { class: 'k', text: r[0] }), UI.el('div', { class: 'v', text: String(r[1] == null ? '—' : r[1]) })
      ]));
    });
    var mapsLink = row.MapURL || ((row.Lat && row.Lng) ? ('https://maps.google.com/?q=' + row.Lat + ',' + row.Lng) : '');
    if (mapsLink) {
      body.appendChild(UI.el('a', { class: 'btn btn-ghost btn-sm mt-16', target: '_blank',
        href: mapsLink, text: '📍 فتح في الخرائط' }));
    }
    if (row.Images) {
      const grid = UI.el('div', { class: 'image-grid' });
      String(row.Images).split(',').forEach(function (u) {
        u = u.trim(); if (u) grid.appendChild(UI.el('img', { src: u, alt: 'صورة' }));
      });
      body.appendChild(grid);
    }
    UI.modal(row.Name, body);
  }

  load();
})();
