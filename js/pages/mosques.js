/**
 * pages/mosques.js — إدارة المساجد
 */
(function () {
  Layout.render('mosques');
  const page = UI.$('#page');
  let allItems = [];
  let searchQ = '';
  let listWrap = null;

  // الحقول النصية للنموذج (الموقع يُدار عبر منتقي الخريطة التفاعلي بشكل منفصل)
  const TEXT_FIELDS = [
    { name: 'Name', label: 'اسم المسجد', type: 'text', required: true, full: true },
    { name: 'District', label: 'الحي', type: 'text', required: true },
    { name: 'City', label: 'المدينة', type: 'text', required: true },
    { name: 'Capacity', label: 'عدد المصلين التقريبي', type: 'number', min: 0 },
    { name: 'Toilets', label: 'عدد دورات المياه', type: 'number', min: 0 },
    { name: 'ACs', label: 'عدد المكيفات', type: 'number', min: 0 },
    { name: 'Courts', label: 'عدد الساحات', type: 'number', min: 0 },
    { name: 'Images', label: 'روابط الصور (مفصولة بفاصلة)', type: 'text', full: true },
    { name: 'Notes', label: 'ملاحظات عامة', type: 'textarea', full: true }
  ];

  const DEFAULT_CENTER = [24.7136, 46.6753]; // الرياض — مركز افتراضي عند غياب الموقع

  function header() {
    const h = UI.el('div', { class: 'page-header' }, [
      UI.el('div', {}, [UI.el('h2', { text: 'سجل المساجد' }), UI.el('div', { class: 'page-subtitle', text: 'إدارة بيانات المساجد الكاملة' })])
    ]);
    if (Auth.cap('mosques.create')) {
      h.appendChild(UI.el('button', { class: 'btn btn-primary', text: '+ إضافة مسجد', onclick: function () { openForm(); } }));
    }
    return h;
  }

  const columns = [
    { key: 'Name', label: 'اسم المسجد' },
    { key: 'District', label: 'الحي' },
    { key: 'City', label: 'المدينة' },
    { key: 'Capacity', label: 'المصلون', render: function (r) { return UI.fmtNum(r.Capacity); } },
    { key: 'Toilets', label: 'دورات المياه' },
    { key: 'ACs', label: 'المكيفات' }
  ];

  function renderList() {
    if (!listWrap) return;
    const q = searchQ.trim().toLowerCase();
    const items = q ? allItems.filter(function (r) {
      return (r.Name || '').toLowerCase().indexOf(q) > -1 ||
             (r.District || '').toLowerCase().indexOf(q) > -1 ||
             (r.City || '').toLowerCase().indexOf(q) > -1 ||
             (r.Notes || '').toLowerCase().indexOf(q) > -1;
    }) : allItems;

    listWrap.innerHTML = '';
    if (!items.length) {
      UI.emptyState(listWrap, q ? 'لا توجد نتائج مطابقة.' : 'لا توجد مساجد بعد. ابدأ بإضافة مسجد.');
      return;
    }
    listWrap.appendChild(Components.table(columns, items, {
      onView: viewDetail,
      onEdit: Auth.cap('mosques.edit') ? function (r) { openForm(r); } : null,
      onDelete: Auth.cap('mosques.delete') ? confirmDelete : null
    }));
    listWrap.appendChild(UI.el('div', { class: 'text-muted', style: 'font-size:12px;margin-top:8px;text-align:start',
      text: 'إجمالي المساجد: ' + items.length }));
  }

  async function load() {
    page.innerHTML = '';
    page.appendChild(header());

    const toolbar = UI.el('div', { class: 'toolbar' });
    const searchInp = UI.el('input', { class: 'input', type: 'search',
      placeholder: 'بحث بالاسم أو الحي أو المدينة…', value: searchQ });
    searchInp.addEventListener('input', function () { searchQ = this.value; renderList(); });
    toolbar.appendChild(searchInp);
    page.appendChild(toolbar);

    listWrap = UI.el('div');
    page.appendChild(listWrap);
    UI.showLoading(listWrap);

    try {
      const data = await API.call('mosques.list', {});
      allItems = data.items;
      renderList();
      renderMap(allItems);
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
        text: 'لا توجد مساجد بمواقع بعد. عدّل مسجداً وحدّد موقعه من منتقي الخريطة لإظهاره هنا.' }));
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

  /**
   * منتقي موقع تفاعلي: خريطة بدبوس قابل للسحب + حقل لصق رابط Google Maps.
   * الإحداثيات المخزّنة هي بالضبط مكان الدبوس الذي يراه المستخدم ويؤكده — وهذا
   * يحل مشكلة الدقة من جذورها بدل الاعتماد على تحليل روابط غامضة.
   * يعيد كائناً فيه node (للإدراج) و getState() لقراءة { lat, lng, url }.
   */
  function buildLocationPicker(row) {
    let lat = row && row.Lat !== '' && !isNaN(Number(row.Lat)) ? Number(row.Lat) : null;
    let lng = row && row.Lng !== '' && !isNaN(Number(row.Lng)) ? Number(row.Lng) : null;
    let mapUrl = (row && row.MapURL) || '';
    let pendingShortUrl = ''; // رابط مختصر يحلّه الخادم لاحقاً

    const wrap = UI.el('div', { class: 'loc-picker' });
    wrap.appendChild(UI.el('label', { class: 'form-label', text: '📍 موقع المسجد' }));
    wrap.appendChild(UI.el('div', { class: 'text-muted', style: 'font-size:12px;margin-bottom:8px',
      text: 'الصق رابط Google Maps، أو انقر على الخريطة، أو اسحب الدبوس لتحديد الموقع بدقة.' }));

    const urlInput = UI.el('input', { class: 'input', type: 'text',
      placeholder: 'الصق رابط Google Maps هنا (اختياري)', value: mapUrl });
    wrap.appendChild(urlInput);

    const readout = UI.el('div', { class: 'loc-readout text-muted', style: 'font-size:12px;margin:8px 0' });
    wrap.appendChild(readout);

    function updateReadout() {
      readout.textContent = (lat != null && lng != null)
        ? ('الإحداثيات المحددة: ' + Number(lat).toFixed(6) + ', ' + Number(lng).toFixed(6))
        : 'لم يُحدّد موقع بعد.';
    }
    updateReadout();

    let map = null, marker = null;

    if (typeof window.L === 'undefined') {
      wrap.appendChild(UI.el('div', { class: 'text-muted',
        text: 'تعذّر تحميل الخريطة — سيُستخرج الموقع من الرابط عند الحفظ.' }));
    } else {
      const mapDiv = UI.el('div', { class: 'map-container map-pick' });
      wrap.appendChild(mapDiv);

      setTimeout(function () {
        const start = (lat != null && lng != null) ? [lat, lng] : DEFAULT_CENTER;
        const zoom = (lat != null && lng != null) ? 16 : 6;
        map = L.map(mapDiv).setView(start, zoom);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19, attribution: '© OpenStreetMap'
        }).addTo(map);

        function placeMarker(la, ln) {
          lat = la; lng = ln;
          if (!marker) {
            marker = L.marker([la, ln], { draggable: true }).addTo(map);
            marker.on('dragend', function () {
              const p = marker.getLatLng();
              lat = p.lat; lng = p.lng; pendingShortUrl = ''; updateReadout();
            });
          } else {
            marker.setLatLng([la, ln]);
          }
          updateReadout();
        }
        if (lat != null && lng != null) placeMarker(lat, lng);

        map.on('click', function (e) {
          placeMarker(e.latlng.lat, e.latlng.lng);
          pendingShortUrl = ''; // النقر يحسم الموقع يدوياً
        });

        // لصق رابط → انقل الدبوس فوراً إن أمكن استخراج الإحداثيات محلياً
        urlInput.addEventListener('input', function () {
          const u = urlInput.value.trim();
          mapUrl = u;
          const c = extractCoordsFromUrl(u);
          if (c) {
            pendingShortUrl = '';
            placeMarker(Number(c.lat), Number(c.lng));
            map.setView([Number(c.lat), Number(c.lng)], 16);
          } else if (u && isShortMapUrl(u)) {
            pendingShortUrl = u; // الخادم سيحلّه
            readout.textContent = 'رابط مختصر — سيُحدَّد الموقع على الخادم عند الحفظ.';
          }
        });

        setTimeout(function () { map.invalidateSize(); }, 250);
      }, 60);
    }

    // مزامنة الرابط عند غياب الخريطة أيضاً
    urlInput.addEventListener('input', function () {
      mapUrl = urlInput.value.trim();
      if (!map) {
        const c = extractCoordsFromUrl(mapUrl);
        if (c) { lat = Number(c.lat); lng = Number(c.lng); pendingShortUrl = ''; updateReadout(); }
        else if (mapUrl && isShortMapUrl(mapUrl)) { pendingShortUrl = mapUrl; }
      }
    });

    return {
      node: wrap,
      getState: function () {
        return { lat: lat, lng: lng, url: mapUrl, shortUrl: pendingShortUrl };
      }
    };
  }

  function openForm(row) {
    const isEdit = !!row;
    const built = Components.form(TEXT_FIELDS, row || {});
    const picker = buildLocationPicker(row);

    // إدراج منتقي الموقع داخل النموذج (بعرض كامل)
    const locRow = UI.el('div', { class: 'form-row full' }, [picker.node]);
    built.formNode.querySelector('.form-grid').appendChild(locRow);

    const footer = UI.el('div', { class: 'modal-footer' });
    const m = UI.modal(isEdit ? 'تعديل مسجد' : 'إضافة مسجد', built.formNode, { footer: footer });
    footer.appendChild(UI.el('button', { class: 'btn btn-ghost', text: 'إلغاء', onclick: m.close }));
    const saveBtn = UI.el('button', { class: 'btn btn-primary', text: 'حفظ', onclick: async function () {
      if (!built.formNode.reportValidity()) return;
      const vals = built.getValues();
      const loc = picker.getState();
      const payload = Object.assign({}, vals);
      payload.MapURL = loc.url || '';
      // إحداثيات الدبوس المؤكَّدة (الأولوية) — تُرسل صراحةً للخادم
      if (loc.lat != null && loc.lng != null) {
        payload._clientLat = String(loc.lat);
        payload._clientLng = String(loc.lng);
      } else if (loc.shortUrl) {
        payload.MapURL = loc.shortUrl; // يحلّه الخادم
      }

      saveBtn.disabled = true; saveBtn.textContent = 'جارٍ الحفظ…';
      try {
        if (isEdit) { payload.id = row.ID; await API.call('mosques.update', payload); }
        else { await API.call('mosques.create', payload); }
        m.close();
        UI.toast(isEdit ? 'تم تحديث المسجد' : 'تمت إضافة المسجد', 'success');
        allItems = []; load();
      } catch (err) {
        UI.toast(err.message, 'error');
        saveBtn.disabled = false; saveBtn.textContent = 'حفظ';
      }
    } });
    footer.appendChild(saveBtn);
  }

  function confirmDelete(row) {
    UI.confirm('حذف المسجد "' + row.Name + '"؟', async function () {
      try { await API.call('mosques.delete', { id: row.ID }); UI.toast('تم الحذف', 'success'); allItems = []; load(); }
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
