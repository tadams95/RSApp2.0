# Phase 2: Ticket Transfer Enhancement

> **Timeline**: 1 week | **Priority**: 🔴 High  
> **Dependencies**: Phase 1 (user profiles for recipient preview)  
> **Outcome**: Full feature parity with web ticket transfers

---

## Overview

The web app supports three transfer methods: QR scan, @username lookup, and email. Mobile currently only supports QR scan. This phase adds the missing transfer methods that are key differentiators.

---

## Current State

**What Works:**

- QR code scanning for transfers (`src/app/(app)/events/my-events.tsx`)
- Basic transfer modal UI
- Firestore ticket updates

**What's Missing:**

- @username search/lookup
- Email-based transfers
- Cloud Function integration for secure transfers
- Profile preview before confirming transfer
- Transfer claim flow from deep links

---

## 2.1 @Username Transfer (~2-3 days)

### User Lookup Service

```typescript
// src/services/userLookupService.ts
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "../firebase/firebase";

export interface UserLookupResult {
  id: string;
  username: string;
  displayName: string;
  photoURL?: string;
  verified: boolean;
}

/**
 * Search users by username (exact match, case-insensitive)
 */
export async function lookupUserByUsername(
  username: string
): Promise<UserLookupResult | null> {
  const normalizedUsername = username.toLowerCase().replace("@", "");

  // Check usernames collection for O(1) lookup
  const usernameDoc = await getDoc(doc(db, "usernames", normalizedUsername));

  if (!usernameDoc.exists()) {
    return null;
  }

  const userId = usernameDoc.data().uid;

  // Fetch user profile
  const userDoc = await getDoc(doc(db, "users", userId));
  // Also check RTDB if needed

  return {
    id: userId,
    username: normalizedUsername,
    displayName: userDoc.data()?.displayName || normalizedUsername,
    photoURL: userDoc.data()?.photoURL,
    verified: userDoc.data()?.verificationStatus === "verified",
  };
}

/**
 * Search users by username prefix (for autocomplete)
 */
export async function searchUsersByUsername(
  prefix: string,
  maxResults: number = 5
): Promise<UserLookupResult[]> {
  const normalizedPrefix = prefix.toLowerCase().replace("@", "");

  const q = query(
    collection(db, "usernames"),
    where("__name__", ">=", normalizedPrefix),
    where("__name__", "<=", normalizedPrefix + "\uf8ff"),
    limit(maxResults)
  );

  const snapshot = await getDocs(q);

  // Batch fetch user details
  const results = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const userId = doc.data().uid;
      // Fetch user profile...
      return { id: userId, username: doc.id /* ... */ };
    })
  );

  return results;
}
```

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
  onTransferInitiated: (transferId: string) => void;
  onCancel: () => void;
}

// src/components/transfer/RecipientPreview.tsx
interface RecipientPreviewProps {
  user: UserLookupResult;
  onConfirm: () => void;
  onCancel: () => void;
}
```

### Implementation Flow

```
1. User taps "Transfer Ticket" on My Events
2. TransferMethodPicker shows: [Scan QR] [@Username] [Email]
3. User selects @Username
4. UsernameTransferForm shows:
   - Username input with @ prefix
   - Autocomplete suggestions as typing
   - "Find User" button
5. On valid username:
   - RecipientPreview shows profile card
   - Display name, photo, verified badge
   - "Confirm Transfer" button
6. On confirm:
   - Call Cloud Function `/initiate-transfer`
   - Show success/pending state
```

### Implementation Checklist

- [ ] Create `userLookupService.ts`
- [ ] Build `TransferMethodPicker` component
- [ ] Build `UsernameTransferForm` with autocomplete
- [ ] Build `RecipientPreview` component
- [ ] Integrate with existing transfer modal in `my-events.tsx`
- [ ] Add input validation (@username format)
- [ ] Handle user not found error gracefully

---

## 2.2 Email Transfer (~1-2 days)

### Email Transfer Form

```typescript
// src/components/transfer/EmailTransferForm.tsx
interface EmailTransferFormProps {
  ticketId: string;
  eventId: string;
  onTransferInitiated: (transferId: string) => void;
  onCancel: () => void;
}

// Features:
// - Email input with validation
// - Optional: Check if email matches existing user
// - Show warning for non-user recipients
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
   - Optional: Check if email has account
   - If account exists, show mini profile preview
   - If no account, show "New user" indicator
4. On confirm:
   - Call Cloud Function `/initiate-transfer`
   - Email sent by Cloud Function
   - Show success with "Pending" status
```

### Implementation Checklist

- [ ] Build `EmailTransferForm` component
- [ ] Add email validation
- [ ] Integrate with Cloud Function
- [ ] Show pending transfer status
- [ ] Add "Resend Email" option for pending transfers

---

## 2.3 Cloud Function Integration

### Existing Endpoints

From `mobile-integration-spec.md`:

| Endpoint             | Method | Body                                               |
| -------------------- | ------ | -------------------------------------------------- |
| `/initiate-transfer` | POST   | `{ ragerId, recipientEmail?, recipientUsername? }` |
| `/claim-transfer`    | POST   | `{ transferId, claimToken }`                       |
| `/cancel-transfer`   | POST   | `{ transferId }`                                   |

### Transfer Service

```typescript
// src/services/transferService.ts
const FUNCTIONS_URL =
  "https://us-central1-ragestate-app.cloudfunctions.net/stripePayment";

export async function initiateTransfer(params: {
  ragerId: string;
  recipientEmail?: string;
  recipientUsername?: string;
}): Promise<{ transferId: string; status: string }> {
  const idToken = await auth.currentUser?.getIdToken();

  const response = await fetch(`${FUNCTIONS_URL}/initiate-transfer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Transfer failed");
  }

  return response.json();
}

export async function claimTransfer(
  transferId: string,
  claimToken: string
): Promise<{ success: boolean; ticketId: string }> {
  // Similar implementation
}

export async function cancelTransfer(
  transferId: string
): Promise<{ success: boolean }> {
  // Similar implementation
}

export async function getPendingTransfers(userId: string): Promise<Transfer[]> {
  // Query ticketTransfers where senderId === userId && status === 'pending'
}
```

### Implementation Checklist

- [ ] Create `transferService.ts`
- [ ] Implement `initiateTransfer` for both methods
- [ ] Add auth token handling
- [ ] Handle error responses
- [ ] Add loading states during API calls

---

## 2.4 Transfer Claim Flow (~1-2 days)

### Deep Link Handling

```typescript
// Handle: ragestate://transfer/{transferId}?token={claimToken}
// Handle: https://ragestate.com/transfer/claim?id={transferId}&token={claimToken}

// In src/app/_layout.tsx or dedicated handler
import * as Linking from "expo-linking";

useEffect(() => {
  const handleDeepLink = async (event: { url: string }) => {
    const parsed = Linking.parse(event.url);

    if (parsed.path?.includes("transfer")) {
      const transferId = parsed.queryParams?.id || parsed.path.split("/")[1];
      const token = parsed.queryParams?.token;

      if (transferId && token) {
        // Navigate to claim screen
        router.push({
          pathname: "/transfer/claim",
          params: { transferId, token },
        });
      }
    }
  };

  Linking.addEventListener("url", handleDeepLink);

  // Check initial URL
  Linking.getInitialURL().then((url) => {
    if (url) handleDeepLink({ url });
  });
}, []);
```

### Claim Screen

```typescript
// src/app/(app)/transfer/claim.tsx
export default function ClaimTransferScreen() {
  const { transferId, token } = useLocalSearchParams();
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  // Fetch transfer details
  // Show: Event name, sender info, ticket count
  // "Claim Ticket" button
  // Handle expired transfers
}
```

### New Routes

```
src/app/(app)/transfer/
├── _layout.tsx
├── claim.tsx         # Claim incoming transfer
└── pending.tsx       # View pending outgoing transfers
```

### Implementation Checklist

- [ ] Set up deep link handler for transfer URLs
- [ ] Create `transfer/claim.tsx` screen
- [ ] Display transfer details (event, sender, quantity)
- [ ] Implement claim action via Cloud Function
- [ ] Handle expired/cancelled transfers
- [ ] Navigate to My Events after successful claim
- [ ] Create `transfer/pending.tsx` for sent transfers
- [ ] Add "Cancel Transfer" option for pending

---

## 2.5 Pending Transfers Management

### My Events Integration

Add to `my-events.tsx`:

```typescript
// Show pending outgoing transfers
const { data: pendingTransfers } = useQuery({
  queryKey: ["pendingTransfers", userId],
  queryFn: () => getPendingTransfers(userId),
});

// Render section for pending transfers
{
  pendingTransfers?.length > 0 && (
    <View>
      <Text>Pending Transfers</Text>
      {pendingTransfers.map((transfer) => (
        <PendingTransferCard
          key={transfer.id}
          transfer={transfer}
          onCancel={() => handleCancelTransfer(transfer.id)}
        />
      ))}
    </View>
  );
}
```

### Notification Integration

Prep for Phase 3:

- Transfer initiated → Notify sender (confirmation)
- Transfer claimed → Notify sender (success)
- Transfer cancelled → Notify recipient (if applicable)
- Transfer expired → Notify sender

---

## Analytics Events

| Event                          | Properties                              |
| ------------------------------ | --------------------------------------- |
| `transfer_method_selected`     | method (qr/username/email)              |
| `transfer_initiated`           | method, event_id, has_recipient_account |
| `transfer_recipient_previewed` | recipient_id                            |
| `transfer_confirmed`           | transfer_id, method                     |
| `transfer_cancelled`           | transfer_id                             |
| `transfer_claimed`             | transfer_id, event_id                   |
| `transfer_claim_failed`        | transfer_id, error_type                 |

---

## Success Criteria

- [ ] Users can transfer tickets via @username lookup
- [ ] Users can transfer tickets via email
- [ ] Profile preview shows before confirming transfer
- [ ] Pending transfers visible in My Events
- [ ] Users can cancel pending transfers
- [ ] Deep links open claim screen
- [ ] Transfer claim works end-to-end
- [ ] Expired transfers handled gracefully
- [ ] All transfer events tracked in PostHog

---

## Files to Create

```
src/
├── app/(app)/transfer/
│   ├── _layout.tsx
│   ├── claim.tsx
│   └── pending.tsx
├── components/transfer/
│   ├── TransferMethodPicker.tsx
│   ├── UsernameTransferForm.tsx
│   ├── EmailTransferForm.tsx
│   ├── RecipientPreview.tsx
│   ├── PendingTransferCard.tsx
│   └── index.ts
├── services/
│   ├── transferService.ts
│   └── userLookupService.ts
└── hooks/
    └── useTransfers.ts
```

---

## Migration from QR-Only

Update existing `my-events.tsx` transfer modal:

```typescript
// Before: Direct QR scanner
<TransferModal onScan={handleQRTransfer} />

// After: Method picker first
<TransferModal>
  <TransferMethodPicker
    onSelectQR={() => setMode('qr')}
    onSelectUsername={() => setMode('username')}
    onSelectEmail={() => setMode('email')}
  />
  {mode === 'qr' && <QRScanner onScan={handleQRTransfer} />}
  {mode === 'username' && <UsernameTransferForm {...props} />}
  {mode === 'email' && <EmailTransferForm {...props} />}
</TransferModal>
```
