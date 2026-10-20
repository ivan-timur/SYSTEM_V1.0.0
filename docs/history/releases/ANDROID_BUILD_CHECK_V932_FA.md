# گزارش بررسی ساخت Android — SYSTEM v9.3.2

## آنچه در این محیط تأیید شد
- `npm test`: موفق؛ مجموعهٔ تست ایستا با ۳٬۶۵۶ بررسی/assertion دارای شمارش صریح، به‌علاوهٔ آزمون تنظیمات به‌روزرسانی Android که جداگانه موفق شد.
- `npm run doctor`: موفق.
- `npm run prepare:android`: موفق؛ وب‌اپ و دارایی‌ها داخل Android همگام شدند.
- ۵۵ فایل JavaScript بدون خطای نحوی.
- ۲۴ فایل JSON/Webmanifest، پنج XML و سه Workflow YAML معتبر هستند.
- تنظیمات به‌روزرسانی Android و وجود checksum در workflow تست ایستا را می‌گذرانند.

## آنچه هنوز تأیید نشده
- وابستگی `@playwright/test` در محیط حاضر نصب نشد؛ دسترسی به npm با خطای DNS (`EAI_AGAIN`) شکست خورد.
- مرورگر مدیریت‌شده در این محیط رفتن به `localhost` و `file://` را مسدود کرد؛ بنابراین E2E واقعی در همین اجرا ممکن نبود.
- Android SDK و Gradle نصب نیستند؛ هیچ APKی در این محیط کامپایل، امضا یا روی گوشی نصب نشده است.

## اجرای ساخت آزمون از GitHub
۱. ZIP را به مخزن خصوصی `ivan-timur/SYSTEM_V1.0.0` منتقل کن.
۲. در GitHub Actions، **Build SYSTEM Android APK** را اجرا کن؛ گردش‌کار پیش از ساخت `npm test` و `npm run doctor` را اجرا می‌کند.
۳. Artifact با نام `SYSTEM-v9.3.2-debug-apk` برای آزمایش دریافت می‌شود. Debug APK برای self-update استفاده نمی‌شود.
۴. برای انتشار امضاشده، Secretهای `ANDROID_KEYSTORE_BASE64`، `ANDROID_KEYSTORE_PASSWORD`، `ANDROID_KEY_ALIAS` و `ANDROID_KEY_PASSWORD` را تنظیم کن و تگ `v9.3.2` را منتشر کن.
۵. گردش‌کار Release قبل از ساخت، تست ایستا، سلامت پروژه و Playwright Chromium را اجرا می‌کند. فقط در صورت موفقیت همهٔ آن‌ها APK امضاشده و فایل SHA-256 منتشر می‌شود.

**مهم:** این گزارش ادعای ساخت موفق APK نمی‌کند؛ این تأیید باید از لاگ موفق GitHub Actions و نصب عملی روی دستگاه به‌دست آید.
