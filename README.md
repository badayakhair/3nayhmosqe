# 🕌 نظام العناية بالمساجد

نظام تشغيلي داخلي لإدارة أعمال العناية بالمساجد (زيارات، بلاغات، صيانة، نظافة، أصول)
مبني بالكامل على بنية مجانية:

**GitHub Pages (الواجهة) + Google Apps Script (الخادم/API) + Google Sheets (قاعدة البيانات)**

> مخصص للاستخدام الداخلي — أقل من 20 مستخدماً. لا حضور/انصراف ولا رواتب.

---

## 📁 هيكل المشروع

```
3nayhmosqe/
├── index.html              # تسجيل الدخول
├── dashboard.html          # لوحة التحكم
├── mosques.html            # المساجد
├── visits.html             # الزيارات الميدانية
├── reports.html            # البلاغات
├── maintenance.html        # الصيانة
├── cleaning.html           # النظافة
├── assets.html             # الأصول
├── notifications.html      # الإشعارات
├── settings.html           # المستخدمون والصلاحيات
│
├── css/
│   ├── main.css            # المتغيرات + القشرة + RTL
│   └── components.css      # المكوّنات (أزرار، جداول، نماذج، نوافذ...)
│
├── js/
│   ├── config.js           # ⚙️ رابط الـ API والثوابت (عدّله بعد النشر)
│   ├── api.js              # غلاف استدعاء الـ API
│   ├── auth.js             # الجلسة والصلاحيات على الواجهة
│   ├── utils.js            # أدوات الواجهة (toast/modal/تنسيق)
│   ├── components.js       # جداول/نماذج/مخططات قابلة لإعادة الاستخدام
│   ├── layout.js           # الشريط الجانبي والعلوي المشترك
│   └── pages/              # منطق كل صفحة
│       ├── dashboard.js · mosques.js · visits.js · reports.js
│       ├── maintenance.js · cleaning.js · assets.js
│       └── notifications.js · settings.js
│
├── gas/                    # كود Google Apps Script
│   └── Code.gs             # 🚦 الكود الكامل في ملف واحد — انسخه كله إلى محرر
│                           #    Apps Script. مقسّم داخلياً إلى 15 قسماً معلّماً:
│                           #    Config · Utils · Shared · APIDispatcher (Router) ·
│                           #    Auth · Dashboard · Mosques · Visits · Reports ·
│                           #    Maintenance · Cleaning · Assets · Notifications ·
│                           #    Users · Setup
│
├── DEPLOYMENT.md           # دليل النشر خطوة بخطوة
├── ROADMAP.md              # خطة التطوير طويلة المدى
└── .nojekyll               # تعطيل معالجة Jekyll في GitHub Pages
```

---

## 🗄️ تصميم قاعدة البيانات (Google Sheets)

كل جدول = شيت مستقل. الصف الأول رؤوس الأعمدة (مجمّدة).
المخطط الرسمي معرّف في `gas/Config.gs` (`SHEETS`).

| الشيت | الأعمدة |
|------|---------|
| **Users** | ID, Name, Email, Role, PasswordHash, Active, CreatedAt |
| **Sessions** | Token, UserID, ExpiresAt, CreatedAt |
| **Mosques** | ID, Name, District, City, Lat, Lng, Capacity, Toilets, ACs, Courts, Notes, Images, CreatedAt, UpdatedAt |
| **Visits** | ID, MosqueID, Date, Inspector, CleanRating, MaintRating, ACRating, ToiletRating, Notes, Images, CreatedBy, CreatedAt |
| **Reports** | ID, MosqueID, Type, Priority, Description, Status, Images, CreatedBy, CreatedAt, UpdatedAt, ResolvedAt |
| **Maintenance** | ID, MosqueID, Contractor, Cost, Date, Description, Documents, CreatedBy, CreatedAt |
| **Cleaning** | ID, MosqueID, ScheduleType, LastVisit, NextVisit, Rating, Notes, CreatedBy, CreatedAt |
| **Assets** | ID, MosqueID, Type, AssetNumber, Status, LastMaintDate, Notes, CreatedAt, UpdatedAt |
| **Notifications** | ID, UserID, Title, Body, Type, IsRead, RefModule, RefID, CreatedAt |
| **AuditLog** | ID, UserID, UserName, Action, Module, RecordID, Timestamp |

> الشيتات تُنشأ تلقائياً عند تشغيل `setup()`، فلا حاجة لإنشائها يدوياً.

### القيم المرجعية (Enums)
- **الأدوار:** admin / supervisor / inspector / viewer
- **حالة البلاغ:** جديد / تحت التنفيذ / مكتمل / مؤجل
- **أولوية البلاغ:** منخفضة / متوسطة / عالية / حرجة
- **حالة الأصل:** يعمل / يحتاج صيانة / معطل / خارج الخدمة

---

## 🔌 طبقة الـ API (APIDispatcher)

نقطة دخول واحدة. كل طلب POST يحمل JSON:

```json
{ "action": "mosques.list", "token": "<session-token>", "payload": { } }
```

الاستجابة موحّدة دائماً:

```json
{ "ok": true,  "data": { } }
{ "ok": false, "error": { "code": "UNAUTHORIZED", "message": "..." } }
```

التوجيه والصلاحيات معرّفان في جدول `getRoutes_()` داخل `APIDispatcher.gs`.
لإضافة عملية جديدة: أنشئ دالة `handleXxx_yyy(payload, user)` وسجّلها في الجدول.

> **ملاحظة CORS:** الواجهة ترسل `Content-Type: text/plain` لتفادي طلب preflight
> الذي لا يدعمه Apps Script. لا تغيّر هذا في `api.js`.

---

## 🚀 التشغيل السريع

1. اتبع **[DEPLOYMENT.md](DEPLOYMENT.md)** لإنشاء الـ Sheet ونشر Apps Script.
2. ضع رابط النشر في `js/config.js` (`API_URL`).
3. فعّل GitHub Pages على هذا المستودع.
4. ادخل بحساب المدير الافتراضي: `admin@masajid.local` / `admin123` ثم **غيّر كلمة المرور فوراً**.

---

## 🧩 قابلية التطوير بالذكاء الاصطناعي مستقبلاً

- **بنية معيارية:** كل وحدة في ملف مستقل (Backend + Frontend) بنمط موحّد متكرر.
- **مخطط مركزي:** تعديل الأعمدة يبدأ من `Config.gs` فقط.
- **جدول توجيه صريح:** إضافة ميزة = دالة معالجة + سطر في `getRoutes_()`.
- **تعليقات عربية واضحة** في كل ملف تشرح الغرض ونقاط التوسعة.

راجع **[ROADMAP.md](ROADMAP.md)** للمراحل المستقبلية.
