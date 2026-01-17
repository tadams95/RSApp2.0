# Expo Deployment Skill

> **Purpose:** Guide deployment of RAGESTATE to iOS App Store, Android Play Store, and web  
> **Applies to:** EAS Build configuration, CI/CD workflows, version management, store submissions  
> **Last Updated:** January 16, 2026  
> **Source:** Expo Skills - expo-deployment plugin

---

## Core Principles

1. **EAS Build for native apps** - Use EAS Build for iOS and Android releases, not local builds
2. **Version control** - Maintain semantic versioning in app.json and build properties
3. **Environment separation** - Different profiles for development, staging, and production
4. **Automated CI/CD** - Use EAS Workflows for automated testing and deployment
5. **Beta testing** - TestFlight for iOS, Google Play internal/beta tracks for Android

---

## EAS Build Configuration (app.json)

### Build Profiles Structure

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleRelease"
      },
      "ios": { "buildType": "simulator" }
    },
    "preview2": {
      "android": { "gradleCommand": ":app:assembleRelease" },
      "ios": { "buildType": "archive" }
    },
    "production": {
      "android": { "buildType": "app-bundle" },
      "ios": { "buildType": "archive" }
    }
  }
}
```

### Profile Breakdown

| Profile      | Use Case               | Android     | iOS       |
| ------------ | ---------------------- | ----------- | --------- |
| `preview`    | Quick internal testing | APK         | Simulator |
| `preview2`   | Device testing         | Release APK | Archive   |
| `production` | App Store / Play Store | App Bundle  | Archive   |

---

## iOS App Store Submission

### Prerequisites

- Apple Developer Program membership ($99/year)
- App signing certificate and provisioning profiles (managed by EAS)
- App ID created in Apple App Store Connect

### Build for App Store

```bash
eas build --platform ios --auto-submit
```

This:

1. Builds the app for iOS
2. Creates an Ad Hoc provisioning profile
3. Signs with your certificate
4. Automatically submits to App Store

### App Store Connect Setup

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Create new app (select RAGESTATE bundle ID: `com.ragestate.app`)
3. Fill in:
   - App name, subtitle, description
   - Screenshots (6.5" and 5.5" sizes)
   - Preview video (optional)
   - Keywords
   - Support URL
   - Privacy policy URL
   - Category
   - Age rating
4. Set pricing and availability
5. Add TestFlight testers

### TestFlight Beta Testing

```bash
# Build and automatically submit to TestFlight
eas build --platform ios --auto-submit --profile production
```

**TestFlight Workflow:**

1. Build submitted to TestFlight
2. Apple reviews within 24-48 hours
3. Testers invited via email
4. Can test for 30 days
5. Feedback collected before public release

### Common iOS Issues

| Issue                        | Solution                                                         |
| ---------------------------- | ---------------------------------------------------------------- |
| Code signing fails           | Run `eas credentials` to reset certificate                       |
| Build rejected for policy    | Check app.json for required fields (privacy policy, support URL) |
| App crashes on TestFlight    | Enable crash logs in Xcode organizer                             |
| Provisioning profile expired | EAS manages automatically, run `eas credentials` if needed       |

---

## Android Play Store Submission

### Prerequisites

- Google Play Developer account ($25 one-time)
- Google Play signing certificate (EAS handles this)
- App created in Google Play Console

### Build for Play Store

```bash
eas build --platform android --auto-submit
```

### Google Play Console Setup

1. Go to [Google Play Console](https://play.google.com/console/)
2. Create new app (select RAGESTATE package ID: `com.ragestate.app`)
3. Fill in:
   - App name and description
   - Screenshots (phone: 1080x1920, tablet: 1200x1920, wear: 480x480)
   - Feature graphic (1024x500)
   - Icon (512x512)
   - Category and content rating
   - Privacy policy URL
   - Support email
4. Complete content rating questionnaire
5. Set pricing and availability

### Play Store Release Tracks

| Track           | Visibility | Use Case                                      |
| --------------- | ---------- | --------------------------------------------- |
| `internal`      | Private    | Internal team testing before beta             |
| `closed` (beta) | Opt-in     | Limited beta users (1-3K for initial testing) |
| `open` (beta)   | Public     | Broader beta before production (10-50K)       |
| `production`    | Public     | General release to all users                  |

### Staged Rollout

Deploy to percentage of users to monitor stability:

```json
{
  "inAppUpdates": {
    "isEnabled": true,
    "priority": "high",
    "userFraction": 0.1
  }
}
```

- Start with 10% of users
- Monitor crash rates and reviews
- Gradually increase to 100%
- Takes ~2-4 weeks for full rollout

### Common Android Issues

| Issue                            | Solution                                            |
| -------------------------------- | --------------------------------------------------- |
| Build rejected for security      | Update targetSdkVersion in app.json (currently 35+) |
| Privacy policy required          | Add to `app.json` with `privacy_policy_url`         |
| Duplicate permission declaration | Check build.gradle - may be from dependencies       |
| App crashes on specific devices  | Run builds for specific Android versions and test   |

---

## Version Management

### Semantic Versioning

```json
{
  "expo": {
    "name": "RAGESTATE",
    "version": "2.1.0"
  }
}
```

Format: `MAJOR.MINOR.PATCH`

- **MAJOR** (2): Breaking changes or major features
- **MINOR** (1): New features without breaking changes
- **PATCH** (0): Bug fixes and minor improvements

### Build Numbers

```json
{
  "ios": {
    "buildNumber": "21"
  },
  "android": {
    "versionCode": 21
  }
}
```

- iOS: Use build number (`buildNumber`)
- Android: Use version code (`versionCode`)
- Increment both for each build, even if version doesn't change

### Version Bump Workflow

```bash
# Before submitting a new version:
# 1. Update version in app.json
# 2. Update buildNumber/versionCode
# 3. Test with EAS preview build
# 4. Submit to store

# Example: bumping from 2.1.0 to 2.2.0
# app.json: "version": "2.2.0", "buildNumber": "22"
# git commit -m "chore: bump version to 2.2.0"
```

---

## EAS Workflows (CI/CD)

### Workflow File Location

```
eas.json  # EAS Build and submit configuration
.github/workflows/  # GitHub Actions (optional)
```

### Basic EAS Workflow Example

```yaml
# eas.json
{
  "build":
    {
      "preview":
        {
          "android": { "buildType": "apk" },
          "ios": { "buildType": "simulator" },
        },
      "production":
        {
          "env": "production",
          "android":
            {
              "buildType": "app-bundle",
              "artifactPath": "android/app/build/outputs/bundle/release/app-release.aab",
            },
          "ios":
            { "buildType": "archive", "artifactPath": "build/RageState.ipa" },
        },
    },
  "submit":
    {
      "production":
        {
          "android":
            {
              "serviceAccount": "@local GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH",
              "track": "internal",
              "changesNotSentForReview": false,
            },
          "ios":
            {
              "appleId": "@env APPLE_ID",
              "appleIdPassword": "@env APPLE_ID_PASSWORD",
              "teamId": "@env APPLE_TEAM_ID",
              "ascAppId": "1234567890",
            },
        },
    },
}
```

### Deploy Workflow Steps

1. **Trigger:** Commit to `main` or manual trigger
2. **Build:** EAS builds for iOS and Android
3. **Test:** Run automated tests if configured
4. **Submit:** Auto-submit to TestFlight and Google Play internal track
5. **Notify:** Post to Slack or email on completion

---

## Environment Variables for Deployment

Store sensitive data in EAS secrets:

```bash
# Set EAS secrets
eas secret:create --scope project --name APPLE_ID
eas secret:create --scope project --name APPLE_ID_PASSWORD
eas secret:create --scope project --name APPLE_TEAM_ID
eas secret:create --scope project --name GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH
```

### Required Secrets

| Secret                             | Value                                                | For     |
| ---------------------------------- | ---------------------------------------------------- | ------- |
| `APPLE_ID`                         | Apple ID email                                       | iOS     |
| `APPLE_ID_PASSWORD`                | App-specific password (not your main Apple password) | iOS     |
| `APPLE_TEAM_ID`                    | 10-character team ID from Developer Account          | iOS     |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Path to service account JSON from Google Cloud       | Android |

---

## Deployment Checklist

### Pre-Deployment

- [ ] Version bumped in app.json
- [ ] BuildNumber/versionCode incremented
- [ ] All tests passing
- [ ] Code reviewed and merged to main
- [ ] No hardcoded debug values
- [ ] Analytics/Sentry configured for production
- [ ] All environment variables set in EAS

### iOS Submission

- [ ] Build succeeds locally with `eas build --platform ios`
- [ ] Signing certificates valid
- [ ] App Store Connect metadata complete
- [ ] Screenshots uploaded for all required sizes
- [ ] Privacy policy and support URLs set
- [ ] Build submitted and appears in TestFlight
- [ ] TestFlight build approved by Apple

### Android Submission

- [ ] Build succeeds locally with `eas build --platform android`
- [ ] Google Play Console setup complete
- [ ] Screenshots, feature graphic, icon uploaded
- [ ] Privacy policy URL set
- [ ] Content rating completed
- [ ] Build submitted to internal track
- [ ] Released to staged rollout (10% → 100%)

### Post-Deployment

- [ ] Monitor crash rates in Xcode Organizer (iOS)
- [ ] Monitor crash rates in Google Play Console (Android)
- [ ] Check user reviews and ratings
- [ ] Follow up with TestFlight testers for feedback
- [ ] Plan next release cycle

---

## Rollback Procedures

### If Critical Issues Found

**iOS:**

1. Go to App Store Connect > Version Release
2. Click "Remove from Sale" if needed
3. Build and submit a new version with fix
4. Resubmit for review (expedited)

**Android:**

1. Go to Google Play Console > Release
2. Create new release with fix
3. Submit to internal track first
4. Gradually rollout if stable

---

## References & Tools

- [EAS Build Documentation](https://docs.expo.dev/eas-build/introduction/)
- [EAS Submit Documentation](https://docs.expo.dev/eas-submit/introduction/)
- [App Store Connect](https://appstoreconnect.apple.com/)
- [Google Play Console](https://play.google.com/console/)
- [Apple Developer Account](https://developer.apple.com/account/)
- [Google Play Developer Account](https://play.google.com/console/developers/)

---

## Common Commands

```bash
# Preview build for testing
eas build --platform ios --profile preview
eas build --platform android --profile preview

# Production build with auto-submit
eas build --platform ios --profile production --auto-submit
eas build --platform android --profile production --auto-submit

# Check EAS secrets
eas secret:list

# View build history
eas build:list

# Check current configuration
eas build:view
```
