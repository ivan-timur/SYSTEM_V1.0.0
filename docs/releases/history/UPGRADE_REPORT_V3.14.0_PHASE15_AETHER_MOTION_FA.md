# SYSTEM v3.14.0 — فاز پانزدهم: Aether Motion

## هدف
ارتقای لایهٔ بصری Canvas و بازخوردهای milestone با عمق فضایی بیشتر، بدون تغییر در منطق XP، مأموریت‌ها، مهارت‌ها، ذخیره‌سازی یا قوانین پاداش.

## سه بخش ارتقا

### ۱. عمق فضایی Canvas
- سه مدار بیضوی کم‌تراکم با شفافیت بسیار پایین به میدان ذرات اضافه شد.
- حرکت مدارها آهسته است تا مزاحم خوانایی رابط نشود.
- از strokeهای سبک استفاده شده و از blur سنگین در حلقهٔ رندر اجتناب شده است.

### ۲. انیمیشن سینمایی milestone
- بازخورد رویدادها از حلقه‌های دوگانه با easing نرم استفاده می‌کند.
- درخشش مرکزی کوتاه و کم‌هزینه به burst افزوده شد.
- ورود toast با انیمیشن کوتاه و کنترل‌شده بهبود یافت.

### ۳. موبایل، دسترس‌پذیری و پایداری
- حالت reduced-motion حفظ شده و انیمیشن ورود toast نیز در این حالت خاموش می‌شود.
- شدت بصری در موبایل محدودتر است.
- CSS منبع و باندل از نظر `!important` بررسی شد؛ تعداد اعلان‌های runtime برابر صفر است.
- نسخهٔ ماژول‌ها و CSS در مسیر Android نیز همگام شد.

## فایل‌های تغییر یافته
- `js/modules/visual-effects.js`
- `css/features/visual-effects.css`
- `tests/visual-effects-contract-test.js`
- `VERSION`, `package.json`, `CHANGELOG.md` و فراداده‌های نسخه که توسط اسکریپت همگام‌سازی تولید شده‌اند
- فایل‌های همسان ماژول و CSS در `android/app/src/main/assets/www/`
- `sw.js` و نسخهٔ Android آن

## بررسی‌های اجراشده
- `node scripts/build-css.js` — موفق
- `node scripts/build-sw.js` — موفق؛ 143 منبع same-origin در precache
- `node tests/visual-effects-contract-test.js` — موفق
- `node tests/project-integrity-test.js` — موفق؛ 84 بررسی
- `node tests/release-pipeline-test.js` — موفق؛ 14 بررسی
- `node tests/security-audit.js` — موفق؛ 62 بررسی

## محدودیت اعتبارسنجی
این گزارش آزمون‌های مشخص‌شده را ثبت می‌کند؛ به معنی اجرای کامل تمام آزمون‌های TypeScript، Playwright یا بررسی تصویری روی دستگاه فیزیکی نیست.
