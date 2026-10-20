# گزارش فاز ۲۳ — آزمون سرتاسری SYSTEM v3.22.0

## دامنه
این فاز مجموعهٔ آزمون‌های سرتاسری موجود را گسترش می‌دهد و آزمون‌های تازه‌ای برای Settings، Backup/Restore و چیدمان موبایل اضافه می‌کند.

## پوشش آزمون
- Status و Quest: `tests/playwright/status-quest.spec.js`
- Skill Tree و مسیر پیشرفت: در مجموعهٔ Status/Quest و Smart Roadmap
- Rewards: `tests/playwright/rewards.spec.js`
- مسیر هوشمند: `tests/playwright/smart-roadmap.spec.js`
- Settings، کنترل زبان، بررسی سلامت ذخیره‌سازی، خروجی JSON و ورودی Restore: `tests/playwright/phase23-settings-backup.spec.js`
- موبایل: viewport باریک، دسترسی به صفحات اصلی و بررسی سرریز افقی

## اجرای آزمون‌ها
فرمان کامل: `npm run test:e2e:phase23`
فرمان موبایل: `npm run test:e2e:mobile`
پیش‌نیاز اجرا: نصب وابستگی‌های پروژه و مرورگر Chromium با Playwright.

## محدودیت گزارش
در محیط فعلی وابستگی محلی Playwright و مرورگر آزمون در دسترس نبود؛ بنابراین در این مرحله فایل‌های آزمون و فرمان‌های اجرا آماده شده‌اند، اما اجرای واقعی مرورگر و گوشی ادعا نمی‌شود. برای اعلام نتیجهٔ قبولی، فرمان‌های بالا باید در محیطی با وابستگی‌ها و Chromium نصب‌شده اجرا شوند.
