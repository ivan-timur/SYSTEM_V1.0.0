# گزارش ارتقای SYSTEM v1.5.0 — هستهٔ واقعی Progression در TypeScript

## چه چیزی واقعاً به برنامه وصل شد؟

1. **منبع واحد محاسبات XP در TypeScript:** منبع `src/core/progression-math-runtime.ts` به فایل تولیدشدهٔ `js/generated/progression-math.js` کامپایل می‌شود. `js/core/progression-math.js` اکنون فقط یک محافظ سازگاری است و فرمول‌های XP/Rank را دوباره پیاده‌سازی نمی‌کند.
2. **XP و Level شاخص‌های Player/Stat:** توابع قدیمی `addPlayerXP()` و `addStatXP()` در `js/legacy/app-controller.js` دیگر حلقه‌های level-up خودشان را ندارند؛ آن‌ها transition محاسباتی TypeScript را فراخوانی می‌کنند. UI، تاریخچه، شمارنده‌ها و ذخیره‌سازی فعلی به‌عنوان آداپتر سازگاری باقی مانده‌اند.
3. **مسیر واقعی Quest:** نقطهٔ مرکزی `applyProgressionReward()` در حال حاضر برای XP، Level، Rank و Coins بازیکن تابع TypeScript `completeQuest()` را فراخوانی می‌کند. بعد از آن، به‌روزرسانی‌های Stat/Skill و تاریخچه از مسیرهای قبلی اجرا می‌شوند تا قالب ذخیرهٔ قدیمی تغییر نکند.
4. **خروجی TypeScript در نسخهٔ وب و Android:** ساخت پروژه اکنون ابتدا TypeScript را کامپایل می‌کند؛ Service Worker خروجی‌های لازم را cache می‌کند و مرحلهٔ آماده‌سازی Android آن‌ها را در دارایی‌های WebView کپی می‌کند.
5. **سازگاری:** منحنی XP فعلی، آستانه‌های رتبه، سقف عددی، سقف Level، انتقال XP اضافی به Level بعدی، یازده تم و قالب ذخیره‌های قدیمی حفظ شده‌اند.

## آزمون‌هایی که اجرا شدند

- `npm test` — **موفق**؛ ساخت پروژه و TypeScript، آزمون‌های progression، ذخیره‌سازی، seed JSON، امنیت، تم‌ها، چیدمان و release pipeline.
- آزمون مستقیم transitionهای Player و Stat XP با فایل جاوااسکریپت تولیدشده از TypeScript — **موفق**.
- آزمون اتصال واقعی `completeQuest()` از خروجی کامپایل‌شده به مسیر پاداش Quest — **موفق**؛ Level-up، XP اضافی، Coins، Stat/Skill، تاریخچه و رد ورودی نامعتبر بررسی شدند.
- `npm run doctor` — در اجرای اولیه موفق بود؛ فایل‌های ضروری و metadata سازگار بودند، اما Playwright در محیط نصب نشده بود.
- `npm run prepare:android` — **موفق**؛ وب‌اپ و فایل‌های TypeScript به دارایی‌های Android کپی شدند.
- بررسی سلامت ZIP در انتهای ساخت بسته اجرا و نتیجه ثبت شد.

## مواردی که هنوز نباید ادعا کنیم

- آزمون End-to-End مرورگر اجرا نشد، چون وابستگی محلی `@playwright/test` نصب نیست. بنابراین این نسخه از نظر آزمون خودکار و قراردادهای integration بررسی شده، اما کلیک واقعی در Chromium یا دستگاه Android در این محیط تأیید نشده است.
- APK کامپایل نشد؛ این مرحله خروجی WebView را برای ساخت Android آماده می‌کند، اما نصب و اجرای APK را تأیید نمی‌کند.
- محافظ تکراری‌شدن مأموریت در حال حاضر همان state/handler و `runSystemTransaction()` موجود است. آرایهٔ `xpEvents` و `completedQuestIds` داخل `completeQuest()` هنوز دفتر رخداد پایدار مشترک برای تمام داده‌های قدیمی نیستند. اتصال durable ledger و مهاجرت کنترل‌شدهٔ ذخیره‌سازی به IndexedDB مرحلهٔ بعد است.

## فایل‌های کلیدی

- `src/core/progression.ts` — انتقال دامنه‌ای `completeQuest()`.
- `src/core/progression-math-runtime.ts` — فرمول‌های واقعی Runtime XP/Level/Rank.
- `js/generated/progression-math.js` — خروجی تولیدشده؛ مستقیم ویرایش نشود.
- `js/app.js` — واردکردن هستهٔ TypeScript برای Runtime.
- `js/legacy/app-controller.js` — آداپتر سازگاری پاداش، Stat/Skill، تاریخچه و تراکنش.
- `tests/typescript/runtime-reward-bridge.test.mjs` — تست اتصال `completeQuest()` به جریان فعال پاداش.

**نتیجه:** این نسخه فراتر از scaffold است: TypeScript به مسیر زندهٔ XP/Level و پاداش Quest وصل شده است؛ با این حال، مهاجرت کامل دفتر رخداد/ذخیره‌سازی و آزمون مرورگر واقعی هنوز انجام نشده است.
