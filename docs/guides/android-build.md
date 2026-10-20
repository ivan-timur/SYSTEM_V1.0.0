# راهنمای ساخت نسخهٔ Android

## پیش‌نیازها

- Android Studio و Android SDK مطابق تنظیمات پروژه.
- JDK سازگار با Gradle و Android Gradle Plugin این پروژه.
- Node.js و npm برای بازسازی منابع وب.

## آماده‌سازی منابع

از ریشهٔ پروژه اجرا کن:

```bash
npm install --no-audit --no-fund
npm run prepare:android
npm test
npm run doctor
```

این دستور CSS و Service Worker را تازه می‌سازد و پوشهٔ وب را به `android/app/src/main/assets/www/` کپی می‌کند. پوشهٔ `www/` یک خروجی mirror است؛ تغییر مستقیم آن با اجرای همگام‌سازی از بین می‌رود.

## ساخت APK در Android Studio

1. پوشهٔ `android/` را در Android Studio باز کن.
2. Gradle Sync را کامل کن.
3. برای نصب آزمایشی، `assembleDebug` را اجرا کن.
4. برای انتشار، از `assembleRelease` همراه امضای release استفاده کن و قبل از انتشار، APK را روی یک دستگاه واقعی آزمایش کن.

فایل APK از سورس پروژه ساخته می‌شود؛ در این بسته APK کامپایل‌شده قرار ندارد.

## نسخه و به‌روزرسانی

نسخهٔ نمایشی و برچسب انتشار از `VERSION` گرفته می‌شود. Android `versionCode` با یک epoch جداگانه افزایش می‌یابد تا بازنشانی نام نمایشی به `1.0.0` به downgrade شدن Package Manager منجر نشود. از آنجا که نصب‌های بسیار قدیمی نسخهٔ `9.x` را از نظر updater بزرگ‌تر از `1.x` می‌بینند، برای عبور اولیه به این خط نسخه ممکن است نصب دستی APK لازم باشد؛ بعد از نصب نسخهٔ جدید، خط به‌روزرسانی `1.x` به‌صورت عادی مقایسه می‌شود.

برای انتشار از workflow خصوصی موجود استفاده کن و مطمئن شو نام APK و فایل SHA-256 مطابق قرارداد updater است. کلید امضا و GitHub token را وارد سورس عمومی نکن.


## Web-only updates without rebuilding an APK

For ordinary UI or JavaScript feature changes, use the independent OTA channel documented in [`../WEB_OTA_GUIDE_FA.md`](../WEB_OTA_GUIDE_FA.md). Increment `WEB_VERSION`, push to `main`, and let the `Publish SYSTEM web-only OTA bundle` workflow update the private `system-ota` branch. The workflow tests and packages the web app but does not build an APK. The OTA manager itself must first be included in an installed Android APK. Native Java/Kotlin, bridge, permission, and dependency changes still require a signed APK update.
