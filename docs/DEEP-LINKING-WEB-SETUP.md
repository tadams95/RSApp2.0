# Deep Linking Web Setup Guide

> **Purpose**: Configure ragestate.com to enable Universal Links (iOS) and App Links (Android)  
> **Estimated Time**: 30 minutes  
> **Prerequisites**: Access to ragestate.com web hosting/deployment

---

## Overview

When users tap links to `ragestate.com` on their phones, we want the RAGESTATE app to open directly to the relevant content instead of opening in a browser. This requires hosting two verification files that Apple and Google check to confirm you own the domain.

---

## What You Need to Do

### 1. Create `.well-known` Directory

Create a `.well-known` folder at the root of your web app's public directory. Both files must be served at:

- `https://ragestate.com/.well-known/apple-app-site-association`
- `https://ragestate.com/.well-known/assetlinks.json`

---

### 2. Apple App Site Association (iOS Universal Links)

**File**: `.well-known/apple-app-site-association`  
**Content-Type**: `application/json` (no `.json` extension!)

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.tyrelle.ragestateapp",
        "paths": [
          "/events/*",
          "/event/*",
          "/user/*",
          "/users/*",
          "/post/*",
          "/posts/*",
          "/feed/post/*",
          "/transfer/*",
          "/transfers/*",
          "/claim-ticket",
          "/shop/*"
        ]
      }
    ]
  },
  "webcredentials": {
    "apps": ["TEAM_ID.com.tyrelle.ragestateapp"]
  }
}
```

#### ⚠️ IMPORTANT: Replace `TEAM_ID`

You need your **Apple Team ID** from [Apple Developer Portal](https://developer.apple.com/account):

1. Go to Membership Details
2. Copy your 10-character Team ID (e.g., `ABC123XYZ9`)
3. Replace `TEAM_ID` in the file above

**Example with real Team ID:**

```json
"appID": "ABC123XYZ9.com.tyrelle.ragestateapp"
```

#### Server Configuration

The file must be served with:

- **No file extension** (not `apple-app-site-association.json`)
- **Content-Type**: `application/json`
- **HTTPS only** (no HTTP)
- **No redirects** (Apple won't follow them)

**Next.js Example** (`next.config.js`):

```javascript
async headers() {
  return [
    {
      source: '/.well-known/apple-app-site-association',
      headers: [
        { key: 'Content-Type', value: 'application/json' },
      ],
    },
  ];
}
```

**Vercel** (`vercel.json`):

```json
{
  "headers": [
    {
      "source": "/.well-known/apple-app-site-association",
      "headers": [{ "key": "Content-Type", "value": "application/json" }]
    }
  ]
}
```

---

### 3. Android Asset Links (Android App Links)

**File**: `.well-known/assetlinks.json`

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.tyrelle.ragestate",
      "sha256_cert_fingerprints": [
        "E2:2A:EE:33:A3:A7:56:D4:6B:13:50:AE:3B:6E:FD:A1:2B:24:5C:AD:16:AF:71:0C:EE:87:C5:26:4A:75:2D:04"
      ]
    }
  }
]
```

This file is ready to use - no modifications needed!

#### ⚠️ IMPORTANT: Get SHA256 Fingerprint

**Option A: From EAS (Recommended)**

```bash
eas credentials --platform android
```

Look for "SHA256 Fingerprint" in the output.

**Option B: From Google Play Console**

1. Go to Google Play Console > Your App > Setup > App signing
2. Copy the "SHA-256 certificate fingerprint"

**Example with real fingerprint:**

```json
"sha256_cert_fingerprints": [
  "14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5"
]
```

---

## Route Mapping Reference

When these URLs are opened on a mobile device with the app installed:

| Web URL                                         | Opens in App          |
| ----------------------------------------------- | --------------------- |
| `ragestate.com/events/abc123`                   | Event detail screen   |
| `ragestate.com/user/johndoe`                    | User profile screen   |
| `ragestate.com/post/xyz789`                     | Post detail screen    |
| `ragestate.com/transfer/claim?token=abc&id=123` | Ticket claim screen   |
| `ragestate.com/claim-ticket?token=abc`          | Ticket claim screen   |
| `ragestate.com/shop/product/hoodie`             | Product detail screen |
| `ragestate.com/shop/collection/summer`          | Collection screen     |

---

## Testing

### Test Apple App Site Association

1. **Validator**: https://branch.io/resources/aasa-validator/
2. Enter `https://ragestate.com` and verify no errors

### Test Android Asset Links

1. **Validator**: https://developers.google.com/digital-asset-links/tools/generator
2. Enter:
   - Hosting site domain: `ragestate.com`
   - App package name: `com.tyrelle.ragestate`
   - App package fingerprint: (your SHA256)

### Manual Testing

**iOS**:

1. Text yourself a link like `https://ragestate.com/events/test123`
2. Tap it in Messages
3. Should open app directly (after rebuilding with new associatedDomains)

**Android**:

1. Same process - text yourself a link
2. Tap it
3. Should prompt to open in RAGESTATE or open directly

---

## Troubleshooting

### iOS Universal Links Not Working

1. **Check AASA is accessible**: `curl -I https://ragestate.com/.well-known/apple-app-site-association`
2. **Verify Content-Type**: Should be `application/json`
3. **Rebuild app**: Changes to `associatedDomains` require a new build
4. **Device cache**: Apple caches AASA for ~24 hours. Test on a fresh device or wait.

### Android App Links Not Working

1. **Verify assetlinks.json**: `curl https://ragestate.com/.well-known/assetlinks.json`
2. **Check fingerprint**: Must match your signing key exactly
3. **Rebuild app**: Changes to `intentFilters` require a new build

---

## Checklist

- [ ] Get Apple Team ID from developer.apple.com _(pending enrollment)_
- [x] Get Android SHA256 fingerprint via `eas credentials` ✅
- [ ] Create `/.well-known/apple-app-site-association` file _(needs Team ID)_
- [ ] Create `/.well-known/assetlinks.json` file _(ready to deploy!)_
- [ ] Configure server to serve AASA with correct Content-Type
- [ ] Deploy to ragestate.com
- [ ] Validate AASA at branch.io/resources/aasa-validator
- [ ] Validate assetlinks at Google's validator
- [ ] Build new development/preview app with updated app.json
- [ ] Test links on real iOS device
- [ ] Test links on real Android device

---

## Questions?

Provide the Team ID and SHA256 fingerprint to complete this setup, or run:

```bash
# Get Apple Team ID (requires Xcode/Apple Developer account)
# Check at https://developer.apple.com/account → Membership

# Get Android SHA256 fingerprint
cd /path/to/ragestate && eas credentials --platform android
```
