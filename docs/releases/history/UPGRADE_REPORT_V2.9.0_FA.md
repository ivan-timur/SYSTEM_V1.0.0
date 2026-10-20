# گزارش تحلیل و ارتقای SYSTEM v2.9.0 — Typed Quest Completion Plans

## خلاصهٔ اجرایی

در این مرحله منطق تصمیم‌گیری دربارهٔ اجرای پاداش‌های Custom Quest و Boss Quest و نتیجهٔ شواهد Goal از شاخه‌بندی مستقیم کنترل‌گر قدیمی خارج شد. ماژول جدید `src/features/quest-completion-plan.ts` طرح‌های داده‌ای خالص تولید می‌کند. نوشتن localStorage، ثبت XP/Coins، به‌روزرسانی UI و rollback عمداً همچنان در آداپتور موجود می‌مانند تا تغییر رفتار یا قالب داده به‌صورت ناگهانی رخ ندهد.

## پیاده‌سازی واقعی

- `planCustomQuestCompletion` رکوردِ هنوز تکمیل‌نشده را بررسی کرده و timestamp، پاداش کانونی، شمارنده و درخواست اختیاری ثبت evidence را تولید می‌کند. شناسه یا مقدار پاداش نامعتبر مانع ساخت برنامه می‌شود.
- `planBossQuestClaim` فقط برای Boss شناخته‌شده، واجد شرایط و تکمیل‌نشده طرح پاداش تولید می‌کند؛ شناسهٔ ناشناخته، قفل یا claim قبلی fail-closed می‌شود.
- `planGoalEvidenceDecision` خروجی legacy Goal evidence adapter را به تصمیم‌های `abort`، `detach-link`، `no-op` یا `persist-goals` تبدیل می‌کند. پاداش Goal تنها وقتی ارائه می‌شود که Goal در همین عملیات برای نخستین بار کامل شده و شناسهٔ evidence معتبر باشد.
- اجرای کنترل‌گر تغییر کرد تا از planهای TypeScript استفاده کند؛ کلیهٔ تغییرات همچنان داخل `runSystemTransaction` می‌مانند.
- APIهای جدید از `js/app.js` به‌صورت object محدود در `SYSTEMTypeScriptQuestDomain` منتشر شدند.
- آزمون مستقل `tests/typescript/quest-completion-plan.test.mjs` برای مسیرهای عادی، شناسه‌های نامعتبر، جوایز تکراری، Goal کهنه/ناهمخوان و کامل‌شدن Goal افزوده شد.
- `scripts/architecture-guard.js`, `npm test`, مستندات معماری و CHANGELOG به‌روز شدند.

## ایمنی داده و سازگاری

کلیدهای ذخیره‌سازی موجود حفظ شده‌اند، از جمله `system_v2_custom_quests`, `system_v2_boss_completed`, `system_v2_goals`, `system_v2_progress` و کلیدهای تاریخچه/پاداش جاری. این نسخه انتقال خودکار به IndexedDB انجام نمی‌دهد. طرح TypeScript به خودی خود تضمین atomic بودن localStorage نیست؛ ضمانت عملی فعلی همچنان به `runSystemTransaction` و `SYSTEMStorage` وابسته است.

رفتار مهم: خطای غیرقابل‌ترمیم در ثبت Goal evidence عملیات اصلی را متوقف می‌کند تا rollback انجام شود؛ پیوند stale یا ناهمخوان با Stat جدا می‌شود و Custom Quest معتبر می‌تواند طبق رفتار سازگار قبلی تکمیل گردد؛ evidence تکراری پاداش Goal جدید نمی‌دهد.

## بررسی‌ها

این نسخه پس از تغییرات باید با این دستورات بررسی شود:

```bash
npm test
npm run doctor
npm run architecture:check
npm run prepare:android
```

`npm test` شامل کامپایل TypeScript، تست‌های حوزه، آزمون‌های ایستا/رگرسیون و نگهبان معماری است. خروجی اجرای نهایی در فایل‌های `SYSTEM_v2.9.0_TEST_LOG.txt`, `SYSTEM_v2.9.0_DOCTOR_LOG.txt` و `SYSTEM_v2.9.0_ANDROID_SYNC_LOG.txt` کنار ZIP نگه‌داری می‌شود.

## محدودیت‌های باقی‌مانده

- آزمون واقعی Chromium/Playwright و IndexedDB فقط وقتی قابل ادعا است که مرورگر و وابستگی‌ها در runner مجاز واقعاً اجرا شوند.
- هیچ APK جدیدی ادعا نمی‌شود، مگر آن‌که Gradle اجرا، فایل APK تولید و خروجی بررسی شود.
- کنترل‌گر `js/legacy/app-controller.js` هنوز مسئول UI و ذخیره‌سازی است؛ migration دیتابیس و split کامل adapter جزو این نسخه نیست.
- `SQLite`, `Kotlin`, server runtime, `Canvas/WebGL`, `Python` runtime, `Rust/WASM` و `ICU MessageFormat` به‌صورت نمایشی وارد runtime نشده‌اند.

## مرحلهٔ پیشنهادی بعدی

نسخهٔ 3.0 باید ابتدا آزمون browser/e2e مجاز و بررسی end-to-end ذخیره‌سازی/rollback را در CI تثبیت کند؛ بعد می‌توان یک مسیر کوچک (نه همهٔ ذخیره‌سازی) را با IndexedDB از طریق migration قابل پیش‌نمایش و rollback انتقال داد. پیش از آن، قطع localStorage یا حذف کلیدهای قدیمی ممنوع است.
