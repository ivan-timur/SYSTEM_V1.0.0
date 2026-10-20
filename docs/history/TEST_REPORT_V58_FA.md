# گزارش آزمون SYSTEM v5.8.0

آخرین دستور اجراشده: `npm test`

| بررسی | نتیجه |
|---|---:|
| CSS + نسخه + Service Worker build | موفق |
| Theme registry | ۹ تم |
| Smoke / Unit | ۱۷۵ بررسی موفق؛ ۲۲ فایل JSON بررسی شد |
| Storage tests | ۲۰ بررسی موفق |
| Auto-snapshot tests | ۵ بررسی موفق |
| Security/build audit | ۵۷ بررسی موفق؛ ۹۶ ورودی precache موجود |
| بررسی نحوی JavaScript | تمام فایل‌های JS بدون خطای parser |
| بررسی JSON manifest/package | موفق |
| `!important` در کل پوشهٔ CSS | صفر |
| فایل‌های precache مفقود | صفر |
| proxy UI/logic در فایل‌های اجرایی | صفر |
| JavaScript placeholders | صفر |
| HTML placeholders غیرفعال | صفر؛ ۱۴ صفحه حذف شده‌اند |

## آزمون مرورگر Playwright

Playwright spec افزوده شده و دارای پروژهٔ Chromium دسکتاپ و Pixel 7 mobile emulation است. مواردی که پوشش می‌دهد: پنل‌های Status (Level/XP/Rank/Stats)، صفحهٔ Quest، RTL، جلوگیری از overflow افقی، و سازگاری اولیه با CSP.

این مجموعه در محیط فعلی اجرا نشده است، زیرا نصب وابستگی npm timeout شد. اجرای headless Chromium محلی هم در این محیط به نتیجهٔ قابل‌استفاده نرسید. بنابراین تمام نتایج بالا مربوط به آزمون‌های ایستا و Node است، نه تأیید screenshot یا رفتار واقعی مرورگر.
