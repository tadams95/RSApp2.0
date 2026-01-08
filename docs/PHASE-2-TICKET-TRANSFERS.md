# Phase 2: Ticket Transfer Enhancement

> **Timeline**: 1 week | **Priority**: 🔴 High  
> **Dependencies**: Phase 1 (user profiles for recipient preview)  
> **Outcome**: Full feature parity with web ticket transfers

---

## Overview

The web app supports three transfer methods: QR scan, @username lookup, and email. Mobile currently only supports QR scan. This phase adds the missing transfer methods that are key differentiators.

---

## Current State Analysis (Scouted)

### ✅ What Already Exists

| Component                         | Location                                                                  | Status                            |
| --------------------------------- | ------------------------------------------------------------------------- | --------------------------------- |
| QR code scanning                  | [my-events.tsx](<../src/app/(app)/events/my-events.tsx>) L278-420         | ✅ Working                        |
| Transfer modal UI                 | [my-events.tsx](<../src/app/(app)/events/my-events.tsx>) L126-136         | ✅ Working                        |
| Username search service           | [userSearchService.ts](../src/services/userSearchService.ts) L68-101      | ✅ Already built!                 |
| Cloud Function `/transfer-ticket` | [stripe.js](../functions/stripe.js) L1642                                 | ✅ Supports both email & username |
| Cloud Function `/cancel-transfer` | [stripe.js](../functions/stripe.js) L1970                                 | ✅ Working                        |
| Transfer notifications            | [notificationManager.ts](../src/services/notificationManager.ts) L576-615 | ✅ Working                        |
| Deep link scheme                  | [app.json](../app.json) `"scheme": "ragestate"`                           | ✅ Configured                     |
| Firestore indexes                 | [firestore.indexes.json](../firestore.indexes.json) L142-170              | ✅ `ticketTransfers` indexed      |

### ❌ What's Missing

| Component               | Description                                      | Priority  |
| ----------------------- | ------------------------------------------------ | --------- |
| TransferMethodPicker UI | Modal to choose QR/Username/Email                | 🔴 High   |
| UsernameTransferForm    | Input + autocomplete + preview                   | 🔴 High   |
| EmailTransferForm       | Email input + validation                         | 🟡 Medium |
| RecipientPreview        | Profile card before confirm                      | 🔴 High   |
| transferService.ts      | Cloud Function API wrapper                       | 🔴 High   |
| transfer/claim.tsx      | Claim screen for incoming transfers              | 🔴 High   |
| transfer/pending.tsx    | View/cancel outgoing transfers                   | 🟡 Medium |
| Deep link handler       | Handle `ragestate://transfer/{id}?token={token}` | 🔴 High   |
| PendingTransferCard     | Show pending transfers in My Events              | 🟡 Medium |

### 🔧 Current Transfer Flow (QR-only)

**File:** [my-events.tsx](<../src/app/(app)/events/my-events.tsx>)

```
Current flow (direct Firestore update - no Cloud Functions):
1. User taps "Transfer Ticket" → toggleTransferModal() L456-520
2. Camera opens for QR scan → handleBarCodeScanned() L278-420
3. QR data = recipient's Firebase UID
4. Look up recipient in RTDB → get(ref(db, `userProfiles/${data}`)) L310-330
5. Confirm dialog → Alert.alert("Confirm Transfer"...) L340-365
6. Direct Firestore update → transferTicket() L258-277
7. Local push notification → sendPushNotification() L422-435
```

**Problem:** Current flow bypasses Cloud Functions, doesn't create `ticketTransfers` doc, no email notifications, no claim tokens.

---

## 2.1 @Username Transfer (~2-3 days)

### ✅ User Lookup Service - ALREADY EXISTS!

**File:** [userSearchService.ts](../src/services/userSearchService.ts)

```typescript
// Already implemented! Just need to import and use:
import {
  searchUsersByUsername,
  UserSearchResult,
} from "../services/userSearchService";

// Usage example:
const results = await searchUsersByUsername("@djragetime", 10);
// Returns: { userId, displayName, username, profilePicture, verificationStatus, bio }
```

**Note:** The Phase 2 doc originally proposed creating `userLookupService.ts` but `userSearchService.ts` already does this! We'll extend it slightly rather than duplicate.

### Transfer UI Components

```typescript
// src/components/transfer/TransferMethodPicker.tsx
interface TransferMethodPickerProps {
  onSelectQR: () => void;
  onSelectUsername: () => void;
  onSelectEmail: () => void;
}

// src/components/transfer/UsernameTransferForm.tsx
interface UsernameTransferFormProps {
  ticketId: string;
  eventId: string;
  eventName: string;
  onTransferComplete: () => void;
  onCancel: () => void;
}

// src/components/transfer/RecipientPreview.tsx
interface RecipientPreviewProps {
  user: UserSearchResult; // From existing userSearchService.ts
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}
```

### Implementation Flow

```
1. User taps "Transfer Ticket" on My Events
2. TransferMethodPicker shows: [Scan QR] [@Username] [Email]
3. User selects @Username
4. UsernameTransferForm shows:
   - Username input with @ prefix
   - Autocomplete suggestions as typing (use existing searchUsersByUsername)
   - "Find User" button
5. On valid username:
   - RecipientPreview shows profile card
   - Display name, photo, verified badge
   - "Confirm Transfer" button
6. On confirm:
   - Call transferService.initiateTransfer() → Cloud Function `/transfer-ticket`
   - Show success/pending state
```

### Implementation Checklist 2.1

- [x] **2.1.1** Create `src/components/transfer/TransferMethodPicker.tsx` ✅

  - Three buttons: QR Scan, @Username, Email
  - Consistent styling with app theme
  - Icons from MaterialCommunityIcons

- [x] **2.1.2** Create `src/components/transfer/UsernameTransferForm.tsx` ✅

  - TextInput with `@` prefix styling
  - Debounced search using existing `searchUsersByUsername()`
  - FlatList autocomplete dropdown
  - Loading states

- [x] **2.1.3** Create `src/components/transfer/RecipientPreview.tsx` ✅

  - Profile picture (or initials fallback)
  - Display name + @username
  - Verification badge if verified/artist
  - Confirm/Cancel buttons

- [x] **2.1.4** Update `my-events.tsx` transfer modal ✅

  - Replace direct QR scanner with TransferMethodPicker
  - Add state: `transferMode: 'picker' | 'qr' | 'username' | 'email'`
  - Conditionally render based on mode

- [x] **2.1.5** Add input validation ✅ (Implemented in UsernameTransferForm)

  - Username format: `^@?[a-zA-Z0-9_]{3,20}$`
  - Show error for invalid format

- [x] **2.1.6** Handle user not found gracefully ✅ (Implemented in UsernameTransferForm)
  - "No user found with username @xyz"
  - Suggest email transfer instead

---

## 2.2 Email Transfer (~1-2 days)

### Email Transfer Form

```typescript
// src/components/transfer/EmailTransferForm.tsx
interface EmailTransferFormProps {
  ticketId: string;
  eventId: string;
  eventName: string;
  onTransferComplete: () => void;
  onCancel: () => void;
}

// Features:
// - Email input with validation
// - Optional: Check if email matches existing user
// - Show warning for non-user recipients (they'll get email to claim)
// - Confirm button
```

### Implementation Flow

```
1. User selects [Email] from TransferMethodPicker
2. EmailTransferForm shows:
   - Email input field
   - Email validation feedback
   - Note: "Recipient will receive an email to claim"
3. On valid email:
   - Optional: Check if email has account (show mini preview)
   - If no account, show "New user" indicator
4. On confirm:
   - Call transferService.initiateTransfer({ recipientEmail })
   - Cloud Function sends claim email via AWS SES
   - Show success with "Pending" status
```

### Implementation Checklist 2.2

- [ ] **2.2.1** Create `src/components/transfer/EmailTransferForm.tsx`

  - TextInput with email keyboard type
  - Real-time email format validation
  - Loading state during submission

- [ ] **2.2.2** Add email validation utility

  - Regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
  - Show inline error for invalid format

- [ ] **2.2.3** Integrate with Cloud Function

  - Call `transferService.initiateTransfer({ ragerId, eventId, recipientEmail })`
  - Handle success/error responses

- [ ] **2.2.4** Show pending transfer status

  - Success message: "Transfer sent! They'll receive an email to claim."
  - Display in PendingTransferCard (section 2.5)

- [ ] **2.2.5** Add "Resend Email" for pending transfers
  - Button in PendingTransferCard
  - Re-call `/transfer-ticket` endpoint (same logic)

---

## 2.3 Cloud Function Integration

### ✅ Existing Endpoints (Already Built!)

From [stripe.js](../functions/stripe.js):

| Endpoint           | Method | Body                                                                                                 | Line  |
| ------------------ | ------ | ---------------------------------------------------------------------------------------------------- | ----- |
| `/transfer-ticket` | POST   | `{ ragerId, eventId, recipientEmail?, recipientUsername?, senderUserId, senderEmail?, senderName? }` | L1642 |
| `/cancel-transfer` | POST   | `{ transferId }`                                                                                     | L1970 |

**Note:** The doc originally referenced `/initiate-transfer` and `/claim-transfer` but actual endpoints are `/transfer-ticket` and `/cancel-transfer`. There's no explicit claim endpoint - claiming is done by visiting the claim URL.

### Transfer Service (NEW - wraps Cloud Functions)

```typescript
// src/services/transferService.ts
import { getAuth } from "firebase/auth";

const FUNCTIONS_URL =
  "https://us-central1-ragestate-app.cloudfunctions.net/stripePayment";

export interface InitiateTransferParams {
  ragerId: string;
  eventId: string;
  recipientEmail?: string;
  recipientUsername?: string;
}

export interface TransferResult {
  transferId: string;
  claimToken: string;
  eventName: string;
  recipientEmail: string;
  recipientUsername?: string;
  recipientDisplayName?: string;
}

export async function initiateTransfer(
  params: InitiateTransferParams
): Promise<TransferResult> {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) throw new Error("Not authenticated");

  const response = await fetch(`${FUNCTIONS_URL}/transfer-ticket`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Note: Uses x-proxy-key header, not Bearer token
    },
    body: JSON.stringify({
      ...params,
      senderUserId: user.uid,
      senderEmail: user.email,
      senderName: user.displayName,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Transfer failed");
  }

  return response.json();
}

export async function cancelTransfer(transferId: string): Promise<void> {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) throw new Error("Not authenticated");

  const response = await fetch(`${FUNCTIONS_URL}/cancel-transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transferId, userId: user.uid }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Cancel failed");
  }
}

export async function getPendingTransfers(userId: string): Promise<Transfer[]> {
  // Query Firestore directly - ticketTransfers where fromUserId === userId && status === 'pending'
  const q = query(
    collection(db, "ticketTransfers"),
    where("fromUserId", "==", userId),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc")
  );
  // ...
}
```

### Implementation Checklist

- [ ] **2.3.1** Create `src/services/transferService.ts`

  - `initiateTransfer()` - wraps `/transfer-ticket`
  - `cancelTransfer()` - wraps `/cancel-transfer`
  - `getPendingTransfers()` - queries Firestore `ticketTransfers`
  - `getIncomingTransfers()` - queries where `toUserId === userId`

- [ ] **2.3.2** Add proper error handling

  - Network errors
  - Auth errors (not logged in)
  - Validation errors (ticket already transferred, etc.)
  - Rate limit errors (429)

- [ ] **2.3.3** Add loading states

  - Use React Query mutations for optimistic updates
  - Show spinner during API calls

- [ ] **2.3.4** Update my-events.tsx to use Cloud Function
  - Replace direct `updateDoc()` in `transferTicket()` with `initiateTransfer()`
  - This creates proper `ticketTransfers` doc + sends claim email

---

## 2.4 Transfer Claim Flow (~1-2 days)

### Deep Link Configuration

**Already configured in [app.json](../app.json):**

```json
"scheme": "ragestate"
```

This enables URLs like: `ragestate://transfer/abc123?token=xyz`

Web claim URL (sent via email): `https://ragestate.com/claim-ticket?t={claimToken}`

### Deep Link Handler

**Add to [\_layout.tsx](../src/app/_layout.tsx)** (around line 60, in RootLayout):

```typescript
import * as Linking from "expo-linking";
import { router } from "expo-router";

// Inside RootLayout component:
useEffect(() => {
  const handleDeepLink = async (event: { url: string }) => {
    const parsed = Linking.parse(event.url);
    console.log("Deep link received:", parsed);

    // Handle transfer claim URLs
    // ragestate://transfer/{transferId}?token={claimToken}
    // OR web: https://ragestate.com/claim-ticket?t={claimToken}
    if (
      parsed.path?.includes("transfer") ||
      parsed.path?.includes("claim-ticket")
    ) {
      const transferId = parsed.queryParams?.id as string;
      const token = (parsed.queryParams?.token ||
        parsed.queryParams?.t) as string;

      if (token) {
        router.push({
          pathname: "/(app)/transfer/claim",
          params: { token, transferId },
        });
      }
    }
  };

  const subscription = Linking.addEventListener("url", handleDeepLink);

  // Check if app was opened from a deep link
  Linking.getInitialURL().then((url) => {
    if (url) handleDeepLink({ url });
  });

  return () => subscription.remove();
}, []);
```

### Claim Screen

```typescript
// src/app/(app)/transfer/claim.tsx
import { useLocalSearchParams, router } from "expo-router";
import { useState, useEffect } from "react";
import { View, Text, ActivityIndicator, Alert } from "react-native";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";

export default function ClaimTransferScreen() {
  const { token, transferId } = useLocalSearchParams<{
    token: string;
    transferId?: string;
  }>();
  const [transfer, setTransfer] = useState<TicketTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTransferDetails();
  }, [token]);

  const loadTransferDetails = async () => {
    try {
      // Hash the token client-side to match stored hash
      const tokenHash = await hashToken(token);

      // Query ticketTransfers by claimTokenHash
      const q = query(
        collection(db, "ticketTransfers"),
        where("claimTokenHash", "==", tokenHash),
        where("status", "==", "pending")
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setError("Transfer not found or already claimed");
        return;
      }

      setTransfer({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
    } catch (err) {
      setError("Failed to load transfer details");
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    // 1. Update ticketTransfers doc: status = 'claimed'
    // 2. Update rager doc: firebaseId = currentUser.uid
    // 3. Navigate to My Events
    // 4. Show success notification
  };

  // Render: Event name, sender info, "Claim Ticket" button
}
```

### New Routes

```
src/app/(app)/transfer/
├── _layout.tsx          # Stack navigator with header
├── claim.tsx            # Claim incoming transfer (from deep link)
└── pending.tsx          # View/cancel outgoing transfers
```

### Implementation Checklist

- [ ] **2.4.1** Add deep link handler to `_layout.tsx`

  - Handle `ragestate://transfer/...` scheme
  - Handle `https://ragestate.com/claim-ticket?t=...` web URLs
  - Navigate to claim screen with token param

- [ ] **2.4.2** Create `src/app/(app)/transfer/_layout.tsx`

  - Stack navigator with "Claim Ticket" / "Pending Transfers" headers
  - Back button to My Events

- [ ] **2.4.3** Create `src/app/(app)/transfer/claim.tsx`

  - Query `ticketTransfers` by hashed claim token
  - Display: Event name, date, sender name, ticket quantity
  - "Claim Ticket" button
  - Loading and error states

- [ ] **2.4.4** Implement claim logic

  - Verify transfer is still pending
  - Verify expiration (72 hours)
  - Update `ticketTransfers` status to 'claimed'
  - Update `rager` doc with new owner's firebaseId
  - Create notification for sender

- [ ] **2.4.5** Handle expired transfers

  - Check `expiresAt` field
  - Show "This transfer has expired" message
  - Option to contact sender

- [ ] **2.4.6** Handle already claimed transfers

  - Show "This ticket has already been claimed"
  - Link to My Events

- [ ] **2.4.7** Create `src/app/(app)/transfer/pending.tsx`

  - List all pending outgoing transfers
  - Show recipient, event, status, time remaining
  - "Cancel Transfer" button per item

- [ ] **2.4.8** Add cancel transfer functionality
  - Call `transferService.cancelTransfer()`
  - Remove `pendingTransferTo` from rager doc
  - Update `ticketTransfers` status to 'cancelled'

---

## 2.5 Pending Transfers Management

### My Events Integration

**Modify [my-events.tsx](<../src/app/(app)/events/my-events.tsx>):**

```typescript
import { useQuery } from "@tanstack/react-query";
import { getPendingTransfers } from "../../../services/transferService";
import { PendingTransferCard } from "../../../components/transfer";

// Inside MyEventsScreen component:
const { data: pendingTransfers, refetch: refetchPending } = useQuery({
  queryKey: ["pendingTransfers", currentUser],
  queryFn: () => getPendingTransfers(currentUser!),
  enabled: !!currentUser,
});

// In render, before events list:
{
  pendingTransfers && pendingTransfers.length > 0 && (
    <View style={styles.pendingSection}>
      <Text style={styles.sectionTitle}>Pending Transfers</Text>
      {pendingTransfers.map((transfer) => (
        <PendingTransferCard
          key={transfer.id}
          transfer={transfer}
          onCancel={async () => {
            await cancelTransfer(transfer.id);
            refetchPending();
          }}
          onResend={() => {
            /* Re-send claim email */
          }}
        />
      ))}
    </View>
  );
}
```

### PendingTransferCard Component

```typescript
// src/components/transfer/PendingTransferCard.tsx
interface PendingTransferCardProps {
  transfer: {
    id: string;
    eventName: string;
    toUsername?: string;
    toEmail: string;
    createdAt: Timestamp;
    expiresAt: Timestamp;
    status: "pending" | "claimed" | "cancelled" | "expired";
  };
  onCancel: () => void;
  onResend?: () => void;
}

// Shows:
// - Event name
// - Recipient (username or email)
// - Time remaining before expiration
// - Cancel button
// - Resend email button (optional)
```

### Implementation Checklist

- [ ] **2.5.1** Create `src/components/transfer/PendingTransferCard.tsx`

  - Event name display
  - Recipient info (username with @ or email)
  - Time remaining countdown (or "Expires in X hours")
  - Cancel button with confirmation
  - Resend button

- [ ] **2.5.2** Add `getPendingTransfers()` React Query hook

  - Query `ticketTransfers` collection
  - Filter: `fromUserId === currentUser && status === 'pending'`
  - Order by `createdAt` desc

- [ ] **2.5.3** Integrate into my-events.tsx

  - Add pending transfers section above events list
  - Show count badge if pending > 0
  - Pull-to-refresh includes pending transfers

- [ ] **2.5.4** Add "View All Pending" link
  - Navigate to `/transfer/pending` for full list
  - Useful if many pending transfers

### Notification Integration (Prep for Phase 3)

These notification types should be added to NotificationManager:

| Trigger            | Notification                     | Recipient                       |
| ------------------ | -------------------------------- | ------------------------------- |
| Transfer initiated | "You sent a ticket to @user"     | Sender                          |
| Transfer claimed   | "Your transfer was claimed!"     | Sender                          |
| Transfer cancelled | "Transfer was cancelled"         | Recipient (if they had account) |
| Transfer expired   | "Your transfer to @user expired" | Sender                          |

**Note:** [notificationManager.ts](../src/services/notificationManager.ts) already has `sendTicketTransferConfirmation()` - extend this for new scenarios.

---

## Analytics Events

| Event                          | Properties                                                      | When                       |
| ------------------------------ | --------------------------------------------------------------- | -------------------------- |
| `transfer_method_selected`     | `method` (qr/username/email), `event_id`, `ticket_id`           | User picks transfer method |
| `transfer_recipient_searched`  | `search_term`, `results_count`, `method`                        | Username/email search      |
| `transfer_recipient_previewed` | `recipient_id`, `recipient_username`, `method`                  | Profile preview shown      |
| `transfer_initiated`           | `transfer_id`, `method`, `event_id`, `has_recipient_account`    | Transfer sent              |
| `transfer_cancelled`           | `transfer_id`, `cancellation_reason`                            | Sender cancels             |
| `transfer_claimed`             | `transfer_id`, `event_id`, `time_to_claim_hours`                | Recipient claims           |
| `transfer_claim_failed`        | `transfer_id`, `error_type` (expired/not_found/already_claimed) | Claim fails                |
| `transfer_expired`             | `transfer_id`, `event_id`                                       | 72h expiration             |

**Note:** Many analytics events already exist in my-events.tsx for QR transfers - extend pattern for new methods.

---

## Success Criteria

### Must Have ✅

- [ ] Users can transfer tickets via @username lookup
- [ ] Users can transfer tickets via email
- [ ] Profile preview shows before confirming transfer
- [ ] Cloud Function `/transfer-ticket` used instead of direct Firestore
- [ ] Transfer creates `ticketTransfers` doc for tracking
- [ ] Claim emails sent via AWS SES

### Should Have 🟡

- [ ] Pending transfers visible in My Events
- [ ] Users can cancel pending transfers
- [ ] Deep links open claim screen
- [ ] Transfer claim works end-to-end
- [ ] Expired transfers handled gracefully

### Nice to Have 🔵

- [ ] Username autocomplete while typing
- [ ] "Resend email" for pending transfers
- [ ] All transfer events tracked in PostHog

---

## Files to Create/Modify

### New Files

```
src/
├── app/(app)/transfer/
│   ├── _layout.tsx              # Stack navigator
│   ├── claim.tsx                # Claim incoming transfer
│   └── pending.tsx              # View/cancel outgoing transfers
├── components/transfer/
│   ├── index.ts                 # Barrel export
│   ├── TransferMethodPicker.tsx # Choose QR/Username/Email
│   ├── UsernameTransferForm.tsx # Username input + autocomplete
│   ├── EmailTransferForm.tsx    # Email input + validation
│   ├── RecipientPreview.tsx     # Profile card before confirm
│   └── PendingTransferCard.tsx  # Pending transfer list item
├── services/
│   └── transferService.ts       # Cloud Function API wrapper
└── hooks/
    └── useTransfers.ts          # React Query hooks (optional)
```

### Existing Files to Modify

| File                                                             | Changes                                                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [my-events.tsx](<../src/app/(app)/events/my-events.tsx>)         | Replace QR-only modal with TransferMethodPicker, add pending transfers section |
| [\_layout.tsx](../src/app/_layout.tsx)                           | Add deep link handler for transfer URLs                                        |
| [userSearchService.ts](../src/services/userSearchService.ts)     | Add `lookupUserByUsername()` for exact match (optional)                        |
| [notificationManager.ts](../src/services/notificationManager.ts) | Extend transfer notifications for new scenarios                                |

---

## Migration Strategy

### Phase 1: Add New Methods (Days 1-3)

1. Create transferService.ts
2. Build transfer UI components
3. Add TransferMethodPicker to my-events.tsx
4. Test username + email transfers

### Phase 2: Deep Link & Claim (Days 4-5)

1. Add deep link handler to \_layout.tsx
2. Create transfer/claim.tsx screen
3. Implement claim logic
4. Test end-to-end claim flow

### Phase 3: Polish (Days 6-7)

1. Add pending transfers section to my-events.tsx
2. Create transfer/pending.tsx
3. Add analytics events
4. Handle edge cases (expired, cancelled)

### Backward Compatibility

- QR transfer continues to work exactly as before
- New methods are additive, not replacing existing flow
- Existing `transferTicket()` function can remain for QR (or migrate to Cloud Function)

---

## Quick Reference: All Checklist Items

### 2.1 @Username Transfer

- [ ] 2.1.1 Create `TransferMethodPicker.tsx`
- [ ] 2.1.2 Create `UsernameTransferForm.tsx`
- [ ] 2.1.3 Create `RecipientPreview.tsx`
- [ ] 2.1.4 Update `my-events.tsx` transfer modal
- [ ] 2.1.5 Add username format validation
- [ ] 2.1.6 Handle user not found error

### 2.2 Email Transfer

- [ ] 2.2.1 Create `EmailTransferForm.tsx`
- [ ] 2.2.2 Add email validation utility
- [ ] 2.2.3 Integrate with Cloud Function
- [ ] 2.2.4 Show pending transfer status
- [ ] 2.2.5 Add "Resend Email" for pending

### 2.3 Cloud Function Integration

- [ ] 2.3.1 Create `transferService.ts`
- [ ] 2.3.2 Add error handling
- [ ] 2.3.3 Add loading states
- [ ] 2.3.4 Update my-events.tsx to use Cloud Function

### 2.4 Transfer Claim Flow

- [ ] 2.4.1 Add deep link handler to `_layout.tsx`
- [ ] 2.4.2 Create `transfer/_layout.tsx`
- [ ] 2.4.3 Create `transfer/claim.tsx`
- [ ] 2.4.4 Implement claim logic
- [ ] 2.4.5 Handle expired transfers
- [ ] 2.4.6 Handle already claimed transfers
- [ ] 2.4.7 Create `transfer/pending.tsx`
- [ ] 2.4.8 Add cancel transfer functionality

### 2.5 Pending Transfers

- [ ] 2.5.1 Create `PendingTransferCard.tsx`
- [ ] 2.5.2 Add `getPendingTransfers()` hook
- [ ] 2.5.3 Integrate into my-events.tsx
- [ ] 2.5.4 Add "View All Pending" link

---

## Key Discoveries from Scouting

1. **`userSearchService.ts` already exists** - No need to create `userLookupService.ts`
2. **Cloud Function is `/transfer-ticket`** not `/initiate-transfer`
3. **Deep link scheme already configured** - `ragestate://` in app.json
4. **Firestore indexes for `ticketTransfers`** already exist
5. **Current transfer bypasses Cloud Functions** - Direct Firestore update
6. **`notificationManager.ts` has transfer methods** - Just needs extension
