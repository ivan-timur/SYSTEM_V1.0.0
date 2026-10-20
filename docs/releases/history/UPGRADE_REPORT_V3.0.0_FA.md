# گزارش تحلیل و ارتقای SYSTEM v3.0.0 — Preview-Bound Storage Migration Gate

## خلاصهٔ اجرایی

نسخهٔ 3.0.0 به‌جای فعال‌کردن شتاب‌زدهٔ IndexedDB، مرز مهاجرت را ایمن‌تر می‌سازد. API مهاجرت اکنون باید از سه مرحله بگذرد: `preview()`، سپس `approve(preview, options)`، و در پایان `migrate(approval)`. موافقت باید صریح باشد، هشدارهای Preview باید تأیید شوند، و تصویب تنها به fingerprint ذخیرهٔ legacy و تاریخ محلی همان Preview متصل می‌شود.

**این نسخه IndexedDB را به‌عنوان منبع اصلی UI فعال نمی‌کند، کلیدهای localStorage را حذف نمی‌کند و APK تولیدشده ادعا نمی‌کند.** این‌ها دروازه‌های جداگانه‌اند که به آزمون مرورگر مجاز و ساخت Gradle واقعی نیاز دارند.

## تغییرات واقعی در سورس

### 1. تأیید مقید به Preview

در `src/storage/legacy-migration.ts` موارد زیر اضافه/تغییر شدند:

- `LegacyMigrationApproval` و `LegacyMigrationApprovalOptions`؛
- `createLegacyMigrationApproval()` برای الزام تأیید صریح و پذیرش صریح هشدارها؛
- `validateLegacyMigrationApproval()` برای بازسازی طرح مهاجرت و بررسی مجدد داده‌های فعلی پیش از بازکردن IndexedDB؛
- تغییر امضای `migrateLegacyLocalStorageToIndexedDB()` تا بدون یک approval معتبر اجرا نشود.

اگر localStorage پس از Preview تغییر کند، روز محلی عوض شود، تاریخ تأیید در آینده باشد یا هشدارها تأیید نشده باشند، اجرای مهاجرت پیش از آغاز نوشتن در IndexedDB متوقف می‌شود. درون تراکنش نیز اثرانگشت منبع دوباره بررسی می‌شود تا تغییر هم‌زمان پس از بررسی اولیه شناسایی گردد.

### 2. اتصال امن‌تر در نقطهٔ ورود برنامه

`js/app.js` اکنون این API را در namespace منجمد `window.SYSTEMProgressionMigration` ارائه می‌کند:

- `preview()` — خواندن و پیش‌نمایش فقط؛
- `approve(preview, options)` — ثبت تأیید صریح؛
- `migrate(approval)` — اجرای مهاجرت فقط با approval.

هیچ‌یک از این عملیات در هنگام شروع برنامه به شکل خودکار اجرا نمی‌شود.

### 3. آزمون‌های تازه

فایل `tests/typescript/legacy-migration-approval.test.mjs` اضافه شد و در `npm test` ثبت گردید. آزمون‌ها تأیید گمشده، تأییدندادن هشدارها، تغییر source fingerprint، تغییر روز، timestamp آینده و حفظ localStorage را بررسی می‌کنند. آزمون واقعی مرورگر `tests/browser/indexeddb-transaction-test.js` نیز برای استفاده از گردش‌کار جدید Preview → Approval → Migration به‌روزرسانی شد.

### 4. مستندات و ساخت Android

`CHANGELOG.md`، `README.md`، `docs/ARCHITECTURE.md`، `docs/ARCHITECTURE_ROADMAP_FA.md` و نگهبان معماری به‌روز شدند. شمارهٔ نسخه از `VERSION` خوانده و فرادادهٔ Android و Web همگام‌سازی شد. دارایی‌های وب به دایرکتوری Android کپی شدند.

## نتیجهٔ آزمون‌های انجام‌شده

- `npm test` — موفق؛ کامپایل TypeScript و مجموعهٔ کامل آزمون‌های حوزه، ایستا، رگرسیون و نگهبان معماری.
- `npm run doctor` — موفق؛ وابستگی Playwright در این محیط نصب نبود.
- `npm run prepare:android` — موفق؛ build وب و همگام‌سازی ۱۳۶ فایل، حدود ۶٫۰۲ مگابایت.
- `npm run test:browser-idb` — اجرا شد، اما مرورگر Chromium این محیط به‌دلیل سیاست مدیریتی `URLBlocklist: ["*"]` صفحهٔ محلی را با `ERR_BLOCKED_BY_ADMINISTRATOR` مسدود کرد. نتیجهٔ آزمون واقعی IndexedDB **نامشخص/اجرانشده** است؛ شکست به‌عنوان موفقیت گزارش نشده و سیاست مرورگر تغییر داده نشد.
- `npm run test:e2e` — اجرا نشد؛ بستهٔ توسعهٔ `@playwright/test` در دسترس نبود و نصب npm در این محیط timeout شد.
- ساخت APK — انجام نشد؛ مرحلهٔ Gradle اجرا نشده است.

## مرزهای ایمنی و محدودیت‌ها

1. localStorage منبع فعال فعلی برنامه باقی می‌ماند.
2. مهاجرت هیچ‌وقت کلیدهای قدیمی را حذف یا بازنویسی نمی‌کند؛ این حفظ منبع قدیمی امکان بازگشت به مسیر قبلی را فراهم می‌کند، اما **rollback فیزیکی رکوردهای IndexedDB پس از تغییرات آینده پیاده‌سازی نشده است**.
3. Preview fingerprint یک اثرانگشت سازگاری برای شناسایی تغییر منبع است؛ احراز هویت رمزنگاری‌شده یا تضمین امنیتی ضددستکاری نیست.
4. آزمون‌های واقعی IndexedDB و E2E باید در GitHub Actions یا مرورگر مجازی که دسترسی localhost را مجاز می‌سازد اجرا شوند.
5. همگام‌سازی assetهای Android به‌معنی ساخت یا تأیید APK نیست.

## مرحلهٔ بعدی پیشنهادی

پس از مشاهدهٔ موفق آزمون واقعی IndexedDB در CI، یک مسیر محدود را به‌صورت آزمایشی از منبع قدیمی به IndexedDB متصل کن؛ ابتدا export/backup، تطبیق شمارنده‌ها و Questها، replay safety و مسیر recovery را بررسی کن. تنها پس از سبزشدن این دروازه می‌توان cutover زنده را بررسی کرد. تا آن زمان، `localStorage` باید مرجع اصلی باقی بماند.
