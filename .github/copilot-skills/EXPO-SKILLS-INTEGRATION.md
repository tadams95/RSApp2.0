# Expo Skills Integration Summary

**Date:** January 16, 2026  
**Source:** [Expo Skills Repository](https://github.com/expo/skills)

---

## What Was Added

Two new Copilot Skills have been created from Expo's official skills repository:

### 1. **Expo Deployment** (`expo-deployment.md`)

Covers the complete lifecycle of deploying RAGESTATE to app stores:

- **iOS App Store & TestFlight**

  - Building for iOS with EAS
  - App Store Connect setup and submission
  - TestFlight beta testing workflow
  - Common iOS issues and solutions

- **Android Play Store**

  - Building for Android with EAS
  - Google Play Console setup
  - Release tracks (internal, beta, production)
  - Staged rollouts (10% → 100%)
  - Common Android issues

- **Version Management**

  - Semantic versioning (MAJOR.MINOR.PATCH)
  - Build numbers and version codes
  - Version bump workflow

- **EAS Workflows (CI/CD)**

  - Build profiles (preview, preview2, production)
  - Automated deployment configurations
  - Environment variables and secrets management

- **Deployment Checklists**
  - Pre-deployment verification
  - Post-deployment monitoring
  - Rollback procedures

### 2. **Expo SDK Upgrade** (`expo-sdk-upgrade.md`)

Guides safe and efficient Expo SDK version upgrades:

- **Upgrade Process**

  - Step-by-step procedure using `npx expo install`
  - Cache clearing (metro, iOS, Android)
  - Doctor checks and verification

- **Breaking Changes**

  - How to identify and handle breaking changes
  - Package migrations (e.g., expo-av → expo-audio/expo-video)
  - Config changes and deprecations

- **Dependency Management**

  - Peer dependency conflict resolution
  - `--legacy-peer-deps` usage (current RAGESTATE approach)
  - Version compatibility matrix

- **Testing After Upgrade**

  - Critical features to test
  - Device testing procedures
  - Compatibility considerations

- **Rollback Procedures**
  - How to safely revert if issues arise
  - Full rollback workflow

---

## Current RAGESTATE Context

### Current SDK Version

- **Expo:** 54.0.0
- **React:** 19.1.0
- **React Native:** 0.81.5
- **Node:** 22.13.1
- **npm:** 11.4.2

### Current Deployment Status

✅ **Phase 4: Production Readiness** in progress

- App Check implementation ✅
- Deep linking setup ✅
- Theme migration ~50% complete
- Performance optimization pending
- **App Store submission** - UPCOMING

---

## How to Use These Skills

### When Deploying to App Stores

```
@copilot Using the Expo Deployment skill, walk me through preparing
RAGESTATE version 2.2.0 for iOS App Store submission
```

or

```
#file:.github/copilot-skills/expo-deployment.md
Create a deployment checklist for Android Play Store beta release
```

### When Upgrading Expo SDK

```
@copilot Using the Expo SDK Upgrade skill, help me upgrade RAGESTATE
from Expo 54 to Expo 55, identifying any breaking changes
```

### For EAS/CI-CD Help

```
#file:.github/copilot-skills/expo-deployment.md
Review our eas.json configuration and suggest improvements
```

---

## Key References in Skills

### Deployment Skill Covers:

- EAS Build configuration (eas.json structure)
- App Store Connect setup (metadata, screenshots, pricing)
- Google Play Console setup (content rating, feature graphics)
- TestFlight beta testing workflow
- Staged rollouts and monitoring
- Version management (currently at 2.0.0)
- Environment secrets management

### SDK Upgrade Skill Covers:

- `npx expo install` command usage
- Cache clearing procedures
- Doctor checks (`npx expo doctor`)
- Breaking change identification
- Common migrations for newer Expo versions
- Dependency conflict handling

---

## Integration with Existing Skills

These new skills complement your existing skills:

| Existing Skill             | Complements With                        |
| -------------------------- | --------------------------------------- |
| React Native Component     | Uses components built per spec in prod  |
| Theming & Styling          | Deploys themed app to stores            |
| Firebase & Firestore       | Backend services used during deployment |
| Error Handling             | Catches issues pre-release              |
| Analytics & PostHog        | Tracks post-deployment user behavior    |
| **Expo Deployment** (NEW)  | Final step before public release        |
| **Expo SDK Upgrade** (NEW) | Maintains and updates Expo dependencies |

---

## Next Steps for Your Project

### Phase 4 Production Readiness Integration

1. **Before Deployment:** Review `expo-deployment.md`

   - [ ] Verify version 2.1.0+ in app.json
   - [ ] Set up App Store Connect metadata
   - [ ] Configure EAS Build profiles
   - [ ] Set environment secrets

2. **During SDK Maintenance:** Reference `expo-sdk-upgrade.md`

   - [ ] Plan quarterly Expo SDK upgrades
   - [ ] Monitor breaking changes
   - [ ] Test on multiple Android/iOS versions

3. **Post-Release:** Use deployment skill for monitoring
   - [ ] Track crash rates
   - [ ] Monitor user feedback
   - [ ] Plan staged rollouts

---

## Files Created/Modified

```
.github/copilot-skills/
├── README.md                    (✅ Updated with new skills)
├── expo-deployment.md           (✨ NEW - Deployment guide)
├── expo-sdk-upgrade.md          (✨ NEW - Upgrade guide)
├── react-native-component.md    (existing)
├── theming-and-styling.md       (existing)
├── firebase-firestore.md        (existing)
├── error-handling.md            (existing)
└── analytics-posthog.md         (existing)
```

---

## Accessing Expo Skills Repository

If you need the source material or additional Expo skills:

- **GitHub:** [expo/skills](https://github.com/expo/skills)
- **Installation for Claude Code:** `/plugin install expo-deployment`, etc.
- **Installation for other agents:** `bunx add-skill expo/skills`

---

## Notes

- Both skills are **fine-tuned for Opus models** but work with any AI agent
- These skills are MIT licensed (same as your project)
- Skills are regularly updated by Expo team (check repo for updates)
- RAGESTATE is using SDK 54, so Expo SDK Upgrade will be most relevant for future versions

---

**Ready to use these skills! Ask Copilot to reference them when:**

- Preparing for App Store submission
- Planning EAS Build configuration
- Troubleshooting dependency issues
- Planning next Expo SDK upgrade
