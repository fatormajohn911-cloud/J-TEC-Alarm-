# AI Wake — Intelligent Android Alarm Clock & Assistant

AI Wake is an intelligent, privacy-first Android alarm clock and personal wake-up assistant built with **React**, **TypeScript**, **Capacitor 8**, and custom **Kotlin native plugins** (`com.aiwake.app`).

---

## Project Structure

- `src/`: React + TypeScript application UI, hooks, services, and Capacitor plugin bridge.
- `assets/`: Vector brand artwork (`logo.svg`, `icon-foreground.svg`, `icon-background.svg`, `notification-icon.svg`, `splash.svg`).
- `native-overlay/android/`: Custom Kotlin alarm engine (`MainActivity.kt`, `AlarmPlugin.kt`, `AlarmScheduler.kt`, `AlarmReceiver.kt`, `AlarmService.kt`, `AlarmNotificationHelper.kt`, `AlarmStore.kt`, `BootReceiver.kt`, `BriefingWorker.kt`), `AndroidManifest.xml`, and vector drawables copied over the generated Capacitor `android/` folder during builds.
- `.github/workflows/`: Automated CI/CD pipelines for GitHub Pages (`pages.yml`) and Android APK/AAB builds (`android.yml`).

---

## Local Development

```bash
npm install
npm run dev
```

Useful scripts:
- `npm run build:web` — Builds the static web bundle (`dist/`) with `base: './'`.
- `npm run assets` — Converts SVG assets in `assets/` to 1024px PNGs with `sharp` and generates Android launcher icons and splash screens.
- `npm run cap:sync` — Syncs `dist/` and Capacitor plugins into `android/`.

---

## CI/CD Setup Guide

### 1. Add GitHub Repository Secrets

In your GitHub repository, open **Settings > Secrets and variables > Actions** and click **New repository secret** for each key below:

| Secret Name | Purpose |
| --- | --- |
| `VITE_GEMINI_TEXT_KEY` | Gemini Text API key for AI Assistant chat and morning briefing scripts |
| `VITE_GEMINI_VOICE_KEY` | Gemini Voice TTS API key for spoken briefings and Test Tone |
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded release upload keystore (for signed release APK/AAB) |
| `ANDROID_KEYSTORE_PASSWORD` | Password for the keystore file |
| `ANDROID_KEY_ALIAS` | Alias of the signing key inside the keystore |
| `ANDROID_KEY_PASSWORD` | Password for the signing key alias |

*(Never commit `.env`, `.jks`, or `.keystore` files to Git.)*

---

### 2. Create an Android Keystore & Encode to Base64

Run `keytool` (included with JDK 21) to generate a release keystore:

```bash
keytool -genkeypair -v \
  -keystore aiwake-release.jks \
  -alias aiwake \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Encode the keystore file to a single-line base64 string for `ANDROID_KEYSTORE_BASE64`:

```bash
# macOS / Linux
base64 -w 0 aiwake-release.jks 2>/dev/null || base64 -i aiwake-release.jks | tr -d '\n'
```

Copy the output string into the `ANDROID_KEYSTORE_BASE64` repository secret and store `aiwake-release.jks` safely outside the repository.

---

### 3. Enable GitHub Pages

1. Push the repository to the `main` branch.
2. Open **Settings > Pages** in your GitHub repository.
3. Under **Build and deployment > Source**, select **GitHub Actions**.
4. The **Deploy Web App to GitHub Pages** workflow (`.github/workflows/pages.yml`) will automatically build `dist/` and publish the site on every push to `main` (or when triggered manually).

---

### 4. Download the Debug APK from GitHub Actions

1. Every push to `main` (or manual run from the **Actions** tab) runs **Build Android APK & Release** (`.github/workflows/android.yml`).
2. Open the **Actions** tab, select the latest **Build Android APK & Release** workflow run, and scroll down to **Artifacts**.
3. Download **`AIWake-debug-apk`** and unzip it to install the APK on your Android device.

---

### 5. Start a Signed Play Store Release (APK + AAB)

When your signing secrets (`ANDROID_KEYSTORE_*`) are configured, push a version tag starting with `v`:

```bash
git tag v1.0.0
git push origin v1.0.0
```

This triggers `.github/workflows/android.yml` to set `versionName` to `1.0.0` (and `versionCode` to the run number), build both a signed **Release APK** and a Google Play Store **AAB** (`bundleRelease`), upload them as workflow artifacts, and attach both files to a new **GitHub Release**.
