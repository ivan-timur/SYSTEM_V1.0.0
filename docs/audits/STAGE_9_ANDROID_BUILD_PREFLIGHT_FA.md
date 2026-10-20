# گزارش مرحلهٔ ۹ — پیش‌بررسی ساخت APK

## نتیجهٔ اصلی

پیکربندی ساخت اندروید و مسیرهای CI بررسی شدند و یک فرمان پیش‌بررسی محلی اضافه شد. در محیط اجرای فعلی APK ساخته یا روی دستگاه نصب نشد؛ بنابراین این مرحله «پیش‌بررسی ساخت» است، نه تأیید نهایی APK.

## تغییرات

- افزودن `scripts/android-build-preflight.js` برای گزارش وضعیت JDK، Gradle، Android SDK، `adb` و `sdkmanager`.
- افزودن فرمان `npm run android:preflight`.
- افزودن آزمون قرارداد برای بررسی تنظیمات Gradle/SDK و workflowهای ساخت و انتشار.
- اتصال آزمون قرارداد به `npm run test:static`.
- حفظ نسخهٔ canonical پروژه روی `1.0.0`.

## یافته‌های محیط فعلی

- Java نصب است؛ نسخهٔ تشخیص‌داده‌شده ۲۱ است و برای پروژه‌ای که source compatibility آن Java 17 است کفایت نسخه‌ای دارد.
- Gradle CLI در PATH یافت نشد.
- `ANDROID_HOME` و `ANDROID_SDK_ROOT` تنظیم نیستند.
- `adb` و `sdkmanager` در PATH یافت نشدند.
- پروژه Gradle Wrapper محلی ندارد؛ بااین‌حال workflowهای CI، Gradle 8.13 را نصب می‌کنند و Android SDK Platform 36 و Build Tools 36.0.0 را درخواست می‌کنند.
- workflow انتشار امضای APK و SHA-256 را بررسی می‌کند.

## اجرای بررسی

```bash
npm run android:preflight
```

برای آنکه نبود ابزارهای لازم باعث کد خروج غیرصفر شود:

```bash
node scripts/android-build-preflight.js --strict
```

## آنچه هنوز اثبات نشده است

- ساخت موفق `assembleDebug` یا `assembleRelease` در محیط واقعی.
- اعتبارسنجی APK با `apksigner` روی فایل ساخته‌شده.
- نصب، اجرا، حفظ داده‌ها و به‌روزرسانی روی دستگاه اندروید واقعی.

پس از نصب Android SDK و Gradle 8.13، اجرای `npm run prepare:android` و سپس `gradle --no-daemon assembleDebug` از پوشهٔ `android` گام بعدی است.
