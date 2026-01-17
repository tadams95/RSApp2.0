# Expo SDK Upgrade Skill

> **Purpose:** Guide safe and efficient Expo SDK version upgrades  
> **Applies to:** package.json, app.json, dependency management, breaking changes  
> **Last Updated:** January 16, 2026  
> **Source:** Expo Skills - upgrading-expo plugin

---

## Core Principles

1. **Use `expo install`** - Always use this command, never `npm install` for Expo upgrades
2. **Check breaking changes** - Review Changelog for SDK version before upgrading
3. **Test thoroughly** - Test on both iOS and Android after upgrade
4. **Incremental upgrades** - Upgrade one or two SDK versions at a time, not multiple jumps
5. **Clear cache** - Clear metro bundler cache after major upgrades

---

## Upgrade Process

### Step 1: Check Current Version

```bash
# See installed Expo version
npm list expo

# Current RAGESTATE version: 54.0.0
```

### Step 2: Review Changelog

Always check what changed in the target version:

- [Expo SDK Changelog](https://docs.expo.dev/versions/latest/sdk-overview/)
- Search for "breaking changes" or "deprecations"
- Note any package migrations (e.g., expo-av → expo-audio/expo-video)

### Step 3: Upgrade Command

```bash
# Upgrade to latest (or specific version)
npx expo install expo@latest
# or
npx expo install expo@55

# This will:
# 1. Update expo package.json
# 2. Auto-install compatible dependency versions
# 3. Flag any peer dependency conflicts
```

### Step 4: Clean Cache

```bash
# Clear metro bundler cache
rm -rf .metro-cache

# Clear node_modules and reinstall (if needed)
rm -rf node_modules && npm install
```

### Step 5: Verify Installation

```bash
# Check installed version
npm list expo

# Verify app.json is compatible
npx expo doctor

# This will flag any deprecated config values
```

### Step 6: Test

```bash
# Test on iOS
eas build --platform ios --profile preview

# Test on Android
eas build --platform android --profile preview

# Or run locally
npm run ios
npm run android
```

---

## Common Migrations by SDK Version

### Current: SDK 54 → Future Versions

#### Hypothetical SDK 55 Changes (Example)

| Package              | Old                | New                         | Migration                           |
| -------------------- | ------------------ | --------------------------- | ----------------------------------- |
| `expo-av`            | Audio/video player | `expo-audio` + `expo-video` | Split functionality, update imports |
| `expo-splash-screen` | 31.0.x             | 31.1.x (major)              | Config in app.json changes          |
| Firebase             | v10                | v11+                        | Breaking API changes                |

### Deprecated Packages

When upgrading, watch for these package deprecations:

| Old Package            | New Package                 | Reason                  |
| ---------------------- | --------------------------- | ----------------------- |
| `expo-av` (audio only) | `expo-audio`                | Focused module          |
| `expo-av` (video only) | `expo-video`                | Better performance      |
| `react-native-webview` | `expo-webview` (future)     | Native integration      |
| `react-native-camera`  | `expo-camera` (use instead) | Maintained by Expo team |

---

## Handling Breaking Changes

### Example: Config Changes

Before:

```json
{
  "expo": {
    "ios": {
      "supportsTabletMode": true
    }
  }
}
```

After (SDK 55 hypothetical):

```json
{
  "expo": {
    "ios": {
      "devices": ["phone", "tablet"]
    }
  }
}
```

**Steps to resolve:**

1. Find the deprecated key in warnings
2. Check [Expo Config Documentation](https://docs.expo.dev/versions/latest/config/app/)
3. Replace old key with new one
4. Verify with `npx expo doctor`

### Example: Package Migration

**Upgrading from SDK 54 to hypothetical SDK 55 that deprecates expo-av audio:**

```bash
# Old code
import { Audio } from 'expo-av';

# New code (after upgrade)
import { Audio } from 'expo-audio';
```

**Steps:**

1. Install new package: `npx expo install expo-audio`
2. Update all imports in codebase
3. Check API differences in documentation
4. Test audio functionality
5. Remove old package: `npm uninstall expo-av` (if no longer needed)

---

## Dependency Conflict Resolution

### Peer Dependency Warnings

When upgrading, you may see warnings like:

```
npm WARN ERESOLVE overriding peer dependency
@firebase/auth@1.7.9 requests @react-native-async-storage/async-storage@^1.18.1
but currently installed @react-native-async-storage/async-storage@2.2.0
```

**Solutions:**

1. **Use `--legacy-peer-deps`** (temporary)

   ```bash
   npm install --legacy-peer-deps
   ```

   Only use if absolutely necessary—doesn't solve the problem, just ignores it.

2. **Downgrade package to match peer dependency**

   ```bash
   npm install @react-native-async-storage/async-storage@1.24.0
   ```

   Verify this doesn't break your app.

3. **Wait for packages to update**
   Check if new versions of conflicting packages are available that fix the conflict.

4. **File an issue** with the package maintainer if conflict is blocking.

**RAGESTATE Strategy:** We use `--legacy-peer-deps` for Firebase compatibility, but should monitor for updates.

---

## Cache Issues After Upgrade

### Metro Bundler Cache

Clear if you see "cannot find module" errors after upgrade:

```bash
# Clear metro cache
rm -rf .metro-cache

# Or more aggressive
rm -rf .metro-cache node_modules package-lock.json
npm install
```

### iOS Build Cache

```bash
# Clear iOS build cache
rm -rf ios/build

# Or full clean
cd ios
xcodebuild clean
cd ..
```

### Android Build Cache

```bash
# Clear Android build cache
rm -rf android/build

# Or with Gradle
cd android
./gradlew clean
cd ..
```

---

## Testing After Upgrade

### Critical Tests

After any SDK upgrade, test these core features:

1. **App launches** without crash
2. **Authentication** (login/signup works)
3. **Navigation** (all screens accessible)
4. **Firebase operations** (reads/writes work)
5. **Media** (image loading, camera, audio/video if using)
6. **Notifications** (if using expo-notifications)
7. **Offline functionality** (sync after reconnect)

### Device Testing

```bash
# Test on actual iOS device (via TestFlight or local)
eas build --platform ios --profile preview --device

# Test on actual Android device
eas build --platform android --profile preview --device
```

### Compatibility Matrix

| SDK | React | React Native | Status  |
| --- | ----- | ------------ | ------- |
| 54  | 19    | 0.81         | Current |
| 55  | 19    | 0.82         | TBD     |
| 56  | 20    | 0.83         | TBD     |

---

## Rollback Procedure

If upgrade introduces critical issues:

```bash
# Rollback to previous version in package.json
npm install expo@54.0.0

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps

# Clear cache
rm -rf .metro-cache

# Test
npm run ios
```

---

## Environment-Specific Upgrades

### Staging Upgrade First

1. Create a `staging` branch
2. Upgrade on branch and test thoroughly
3. If successful, merge to `main`
4. Communicate to team

```bash
# On staging branch
git checkout -b upgrade/sdk-55
npx expo install expo@55
# Test thoroughly...
git commit -m "chore: upgrade Expo SDK to 55"
git push origin upgrade/sdk-55
# Create PR for review
```

---

## Upgrade Checklist

- [ ] Read Changelog and breaking changes
- [ ] Backup current working version in git
- [ ] Run `npx expo install expo@latest`
- [ ] Review updated package.json
- [ ] Run `npx expo doctor`
- [ ] Clear caches (metro, iOS, Android)
- [ ] Test on iOS (preview build)
- [ ] Test on Android (preview build)
- [ ] Verify all critical features work
- [ ] Update any deprecated imports/config
- [ ] Commit and push changes
- [ ] Deploy to staging for QA testing
- [ ] If all good, deploy to production

---

## Common Commands

```bash
# Check current version
npm list expo

# Upgrade to latest
npx expo install expo@latest

# Upgrade to specific version
npx expo install expo@55

# Doctor check for issues
npx expo doctor

# Check dependencies for expo packages
npm ls | grep expo

# Clean install after upgrade
rm -rf node_modules && npm install --legacy-peer-deps

# List available versions
npm view expo versions
```

---

## References

- [Expo SDK Versions & Changelog](https://docs.expo.dev/versions/latest/)
- [Expo Install Guide](https://docs.expo.dev/get-started/install/)
- [Troubleshooting Upgrades](https://docs.expo.dev/guides/upgrading-expo-sdk-walkthrough/)
- [Breaking Changes Documentation](https://docs.expo.dev/versions/latest/sdk-overview/)
