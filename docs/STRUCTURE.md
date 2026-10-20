# ساختار و معماری SYSTEM

## اصول

1. `VERSION` تنها مرجع نسخهٔ برنامه است؛ نسخه‌های npm، PWA، Android و JavaScript هنگام ساخت از آن همگام می‌شوند.
2. `css/system.css` و `sw.js` فایل‌های تولیدشده‌اند؛ منبع آن‌ها به‌ترتیب `css/**` و `scripts/build-sw.js` است. این خروجی‌ها را دستی ویرایش نکن.
3. `js/app.js` ترتیب بارگذاری برنامه را کنترل می‌کند؛ ترتیب فعلی بخشی از قرارداد سازگاری است.
4. شناسه‌های تم، کلیدهای ذخیره‌سازی و schemaهای Backup پایدارند. تغییر آن‌ها بدون مهاجرت و آزمون می‌تواند داده‌های قبلی را از دسترس خارج کند.
5. آرشیو گزارش‌های نسخه‌های قدیمی در `docs/history/` قرار دارد؛ راهنماهای مورد استفادهٔ روزمره باید بیرون از آرشیو بمانند.

## نقشهٔ پوشه‌ها

```text
/
├── VERSION                         # مرجع یگانهٔ نسخه
├── README.md                       # شروع سریع و معرفی محصول
├── CHANGELOG.md                    # تغییرات انتشار فعلی و تاریخچه
├── index.html                      # صفحهٔ اصلی و CSP
├── manifest.webmanifest            # فرادادهٔ PWA
├── sw.js                           # خروجی تولیدشدهٔ Service Worker
├── assets/images/                  # artwork، تصاویر و آیکون‌ها
├── css/
│   ├── system.css                  # خروجی bundle؛ ویرایش نشود
│   ├── foundation/                 # tokens، reset، layout، components، responsive
│   ├── features/                   # استایل قابلیت‌های مشخص
│   ├── pages/                      # استایل‌های اختصاصی صفحه‌ها
│   ├── themes/                     # تم‌ها و انتخاب‌گر تم
│   └── refinements/                # لایه‌های تکمیلی طراحی و دسترس‌پذیری
├── src/                            # هستهٔ TypeScript و adapter ذخیره‌سازی IndexedDB
│   ├── core/progression.ts          # انتقال خالص XP/Level/Rank/Quest
│   ├── core/achievements.ts         # معیارهای canonical برای Achievementهای پویا
│   ├── core/reward-command.ts       # اعتبارسنجی ورودی و هویت پایدار پاداش
│   ├── data/seed-validation.ts      # اعتبارسنجی کاتالوگ‌های JSON
│   └── storage/indexeddb.ts         # تراکنش اتمی مسیر جدید؛ هنوز مهاجرت سراسری نیست
├── dist/ts/                        # خروجی کامپایل‌شدهٔ TypeScript برای آزمون/ادغام آتی
├── js/
│   ├── app.js                      # entry point و ترتیب بارگذاری
│   ├── core/                       # محاسبات و سرویس‌های مستقل و قابل‌آزمون
│   ├── features/                   # اسکریپت‌های قابلیت‌ها
│   ├── modules/                    # ES Modules برای امنیت، ذخیره‌سازی، Android و نسخه
│   └── legacy/app-controller.js    # کنترل‌گر بزرگ سازگاری؛ مسیر مهاجرت تدریجی
├── android/                        # پروژهٔ Native WebView wrapper
├── data/                           # کاتالوگ‌ها/seedهای مرجع؛ فعلاً منبع runtime نیستند
├── scripts/                        # build، sync، doctor و اجرای E2E
├── tests/                          # آزمون‌های واحد، ایستای امنیت/یکپارچگی و Playwright
└── docs/
    ├── guides/                    # راهنماهای جاری
    └── history/                   # گزارش‌های تاریخی و اسناد نسخه‌های پیشین
```

## جریان شروع برنامه

1. مرورگر `index.html` را از HTTP/HTTPS باز می‌کند.
2. `js/app.js` نسخه، ذخیره‌سازی، سازگاری CSP، ناوبری AI و قابلیت‌های Android را آماده می‌کند.
3. ماژول‌های `js/core/` به‌ترتیب لازم بارگذاری می‌شوند. سپس اسکریپت‌های `js/features/` و کنترل‌گر `js/legacy/app-controller.js` اجرا می‌شوند.
4. در موفقیت، رویداد `system-app-ready` صادر می‌شود؛ شکست هر ماژول ضروری یک پیام قابل‌مشاهده ایجاد می‌کند.
5. `npm run build` فرادادهٔ نسخه را هماهنگ، `css/system.css` را از فهرست قطعی منابع تولید و `sw.js` را با منابع قابل‌کش ایجاد می‌کند.
6. `npm run prepare:android` همین خروجی وب را به `android/app/src/main/assets/www/` کپی می‌کند؛ فایل‌های این مسیر mirror تولیدی هستند و باید از سورس ساخته شوند، نه دستی ویرایش شوند.

## راهنمای CSS

- فایل‌های `foundation/`, `features/`, `pages/`, `themes/` و `refinements/` منبع‌اند. ترتیب واردکردن آن‌ها در `scripts/build-css.js` مهم است و به آبشار CSS وابسته است.
- `!important` در مسیر ساخت حذف می‌شود؛ برای رفع تعارض selector یا ترتیب لایه را اصلاح کن.
- اگر فایل CSS دارای تصویر پس‌زمینه باشد، مسیر آن باید نسبت به همان فایل منبع صحیح باشد؛ build آن را برای `css/system.css` بازنویسی می‌کند.

## کیفیت و آزمون

```bash
npm run build
npm test
npm run doctor
npm run architecture:check
npx playwright install chromium
npm run test:e2e
```

آزمون‌های واحد/ایستا با `npm test` اجرا می‌شوند. آزمون تراکنش IndexedDB با `npm run test:browser-idb` از CDP و Chromium سیستم استفاده می‌کند و اگر سیاست مدیریتی مرورگر صفحه‌های محلی را مسدود کند، این محدودیت را صریح گزارش می‌دهد؛ چنین نتیجه‌ای موفقیت آزمون محسوب نمی‌شود. آزمون تعاملی UI با Playwright جداگانه است. هیچ آزمون ایستایی جایگزین بررسی بصری واقعی روی موبایل و دسکتاپ نیست.

## بدهی فنی شناخته‌شده

`js/legacy/app-controller.js` هنوز کنترل‌های UI و چند مسئولیت دامنه را نگه می‌دارد؛ در نسخهٔ 2.5.0 شرط‌های بازشدن هشت Achievement پویا از این کنترل‌گر به `src/core/achievements.ts` منتقل شده‌اند. هستهٔ TypeScript و سرویس تراکنشی IndexedDB در نسخهٔ 1.2.0 آماده شده‌اند، اما هنوز مسیر اجرایی تمام مأموریت‌ها به آن‌ها منتقل نشده و پایگاه دادهٔ جدید نباید بدون مهاجرت صریح با ذخیرهٔ قدیمی جایگزین شود. راه درست، استخراج قابلیت‌ها به‌صورت مرحله‌ای با یک آزمون رگرسیون برای هر تغییر است؛ بازنویسی یک‌بارهٔ فایل، ریسک بالای شکستن ذخیره‌های موجود را دارد. فایل‌های `data/**/*.json` نیز فعلاً منبع اجرایی اصلی نیستند؛ اتصال آن‌ها باید با schema، migration و آزمون جداگانه انجام شود.

## Activity Ledger (v2.6.0)

`src/core/activity-ledger.ts` owns pure validation and aggregation for activity metadata and lifetime counters. `js/legacy/app-controller.js` remains the localStorage adapter for compatibility, but it commits the candidate record before updating in-memory history. The TypeScript source is compiled into `dist/ts/core/activity-ledger.js`, exposed by `js/app.js`, precached by the Service Worker, and mirrored into Android assets by the normal build pipeline.
