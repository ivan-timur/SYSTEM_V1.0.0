# فاز ۳۳ — دروازهٔ محیط ساخت Android و آمادگی APK

## هدف
بررسی قابل‌اعتماد بودن مسیر ساخت APK و ثبت موانع واقعی محیط، بدون اعلام موفقیت ساختی که اجرا نشده است.

## تغییرات این فاز
- افزودن آزمون قراردادی `tests/phase33_android_environment_gate_test.js` برای بررسی پیش‌نیازهای Android، فرمان‌های npm، کنترل وجود فایل APK و مسیر CI.
- افزودن آزمون فاز ۳۳ به `npm run test:static`.
- نگه‌داشتن preflight به‌عنوان دروازهٔ اصلی ساخت؛ در این فاز هیچ بررسی امنیتی یا محدودیت سیستم دور زده نشده و APK جعلی تولید نشده است.

## بررسی واقعی محیط فعلی
اجرای `node scripts/android-build-preflight.js` گزارش کرد:

**آماده:** نسخهٔ canonical و `versionName`، نسخهٔ Android Gradle Plugin، پیکربندی SDK Platform 36، JDK 21، مسیر خروجی مستند و کنترل امضا/هش در workflow.

**مسدود:** Gradle در PATH موجود نیست؛ `ANDROID_HOME` و `ANDROID_SDK_ROOT` تنظیم نشده‌اند؛ `adb` و `sdkmanager` نیز در PATH موجود نیستند. در نتیجه ساخت APK واقعی در این محیط تأیید نشده است.

## آزمون‌های اجراشده
- `node scripts/architecture-guard.js` — PASS.
- آزمون‌های قراردادی فازهای ۲۷، ۲۸، ۲۹، ۳۰، ۳۱ و ۳۲ — PASS.
- آزمون جدید فاز ۳۳ — PASS.
- اجرای کامل `npm test` و ساخت APK — هنوز تأیید نشده‌اند.
- آزمون واقعی مرورگر IndexedDB همچنان به محدودیت سیاست Chromium در فاز ۳۲ برخورد می‌کند؛ آزمون قراردادی جایگزین آزمون مرورگر واقعی نیست.

## مراحل لازم برای ساخت APK روی لپ‌تاپ
1. نصب Android Studio و JDK 17 یا جدیدتر.
2. از SDK Manager نصب Android SDK Platform 36 و Build Tools 36.0.0؛ مطمئن‌شدن از موجود بودن `adb` و `sdkmanager`.
3. نصب/دسترسی به Gradle 8.13 طبق راهنمای پروژه.
4. در ریشهٔ پروژه اجرا شود: `npm install`، سپس `npm run doctor`، `npm test`، `npm run android:preflight` و در پایان `npm run android:build:debug`.
5. تأیید فایل `android/app/build/outputs/apk/debug/app-debug.apk` و نصب روی دستگاه برای آزمون آفلاین، ذخیره‌سازی و به‌روزرسانی.

## تصمیم انتشار
این نسخه برای **ادامهٔ اعتبارسنجی فنی** آماده است، اما تا عبور آزمون مرورگر واقعی، مجموعهٔ کامل آزمون‌ها و ساخت/نصب APK نباید «آمادهٔ انتشار نهایی» اعلام شود.
