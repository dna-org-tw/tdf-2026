# Partner Stay Booking (`/stay`) — Design

**Date:** 2026-04-19
**Status:** Approved
**Scope:** New `/stay` booking flow for Norden Ruder partner accommodation, plus member management flow, waitlist, transfer, invite codes, and admin operations.

## Problem

The current website only points members to accommodation information or external channels. It doesn't provide a first-party booking flow for the reserved Norden Ruder room block, doesn't enforce weekly inventory, and doesn't support the booking-specific business rules the organizers need:

- Members book in whole-week units only.
- There is only one partner property and one room type.
- A member can reserve at most one room, but can reserve multiple weeks in one flow.
- Each room can host 1-2 guests, but only the primary booker must be a member.
- Regular bookings require card verification up front, on-site payment later, and a full-week charge on any cancellation or no-show.
- Invite-code bookings are complimentary, skip card verification, and also stay complimentary after transfer.
- Sold-out weeks need a waitlist with priority offers.
- Members must be able to modify to another week for free if space exists, and transfer to another member.

The existing `orders` model is designed for immediate ticket payment. It isn't a good fit for a lodging guarantee flow where the primary concern is inventory and responsibility transfer, not up-front collection.

## Goals

1. Launch a single-property, light-mode-only `/stay` page that looks and behaves like a booking flow, not a generic information page.
2. Let any member who can log into `/me` reserve one partner room across one or more selected weeks in a single flow.
3. Support both regular guaranteed bookings and complimentary invite-code bookings.
4. Enforce weekly capacity, waitlist ordering, and transfer acceptance rules in a way that is auditable for admins.
5. Repeat the high-risk policy clearly enough that bookers can't reasonably miss it: any cancellation or no-show charges the full booked week.

## Non-Goals

- Multi-property or multi-room-type marketplace UX
- Path-based language routing changes
- Replacing the existing ticket `orders` / `checkout` system
- In-person payment collection tooling for the hotel front desk
- Partial refunds, cancellation credits, or coupon-style discounts for stay bookings
- Public booking access for non-members

## Decisions made during brainstorming

| Topic | Decision |
| --- | --- |
| Property model | Single partner property only; page is not designed as a marketplace |
| Eligibility | Any member who can log into the member system can book |
| Room count | One member can hold at most one room, but can book multiple weeks |
| Occupancy | 1-2 guests per room; only the primary booker must be a member |
| Week selection UX | Frontend looks like one reservation flow; backend splits into one record per booked week |
| Invite codes | Single-use only; complimentary stay; no card verification; no on-site payment |
| Cancellation / no-show | Any cancellation or no-show charges the full booked week |
| Modification | Free change to another week if inventory exists |
| Transfer | Allowed to another member |
| Transfer responsibility | Regular bookings require the recipient to accept and bind their own card; complimentary transfers remain no-card |
| Booking confirmation | Immediate upon successful inventory check and guarantee step |
| Sold-out handling | Waitlist stays open; offers go to the first waitlisted member with a time-limited hold |
| Visual direction | Light mode only; no dark variant for `/stay` |

## UX and IA

### Primary page: `/stay`

`/stay` is a single partner-stay landing + booking page. It should feel like a booking detail page, not a catalog.

Desktop layout:

- Left column: stay information and policy content
- Right column: sticky booking or management panel

Mobile layout:

- Hero and warning first
- Weekly inventory next
- Booking / management panel after the member understands the rules

The page always uses light mode and high-contrast text on pale backgrounds. No dark hero, dark cards, or dark warning bands.

### Required sections on `/stay`

1. Hero
   - Norden Ruder partner stay label
   - Room type name
   - Single property / weekly booking / members-only badges
2. Critical warning block
   - Above the fold
   - States plainly that any cancellation or no-show charges the full booked week
3. Weekly inventory grid
   - 4 fixed stay weeks
   - Price, capacity, current availability
   - Sold-out weeks show waitlist CTA rather than booking CTA
4. Room details
   - Photos
   - 8 m², one double bed, en-suite shower room, 1-2 guests
   - No extra bed / not suitable for children under 12
5. Booking rules
   - Regular booking: verify card now, pay on site, full-week charge on cancellation / no-show
   - Complimentary booking: invite code required, no card verification, no on-site payment
   - Modification and transfer rules
6. FAQ / logistics
   - Address
   - Organizer-provided arrival / support notes only; detailed hotel check-in operations are out of scope for MVP
   - Contact / organizer support path

### Right-side panel behavior

The right panel changes based on session and stay state:

- Logged out: sign-in gate
- Logged in, no stay yet: booking form
- Logged in, already booked: management summary + manage CTA
- Sold-out week selected: waitlist form
- Incoming transfer: accept-transfer flow

The panel should never suggest booking a second room for the same member.

## User flows

### A. Regular booking flow

1. Member opens `/stay`
2. Member signs in if needed
3. Member selects one or more available weeks
4. Member enters primary guest info, optional second guest info, optional invite code
5. System validates:
   - member is logged in
   - selected weeks are still available
   - member doesn't already hold an active room for those weeks
6. If no invite code:
   - show policy again
   - capture explicit consent for future no-show / cancellation charge
   - run Stripe card setup flow
7. On success:
   - create one booking container
   - create one booking-week row per selected week
   - link guarantee record
   - send confirmation email
8. Member lands on success / management state

### B. Complimentary invite-code booking flow

1. Member follows the same start flow
2. Member enters a valid unused invite code
3. System validates code and reserves it
4. Card setup is skipped
5. Booking is created as complimentary
6. Confirmation email explicitly states:
   - complimentary stay
   - no card required
   - no on-site payment required

### C. Waitlist flow

1. Member selects a sold-out week
2. Panel switches from booking to waitlist mode
3. Member submits waitlist request
4. System records queue order
5. When inventory reopens:
   - first waitlisted member receives an offer email
   - offer expires after a configured hold window
   - if expired or declined, next member is offered

### D. Modification flow

1. Member opens stay management
2. Member selects a booked week to modify
3. System shows alternative weeks with available inventory
4. Member selects target week
5. System atomically:
   - marks the old week as modified out
   - creates / confirms the replacement week
   - releases old inventory
   - keeps guarantee type unchanged
6. Confirmation email lists old and new week

### E. Transfer flow

1. Original member initiates transfer to another member email
2. System creates a pending transfer request
3. Recipient receives email and opens accept page
4. If booking is regular:
   - recipient must accept policy
   - recipient must complete their own card setup
5. If booking is complimentary:
   - recipient accepts without card setup
6. On accept:
   - responsibility shifts to recipient
   - original holder loses management control
   - booking-week ownership updates
7. On expiry:
   - transfer stays with original holder

## Data model

The stay flow should use dedicated tables rather than extending `orders`.

### New table: `stay_weeks`

Fixed inventory definition for each 7-night slot.

```sql
CREATE TABLE stay_weeks (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  price_twd INTEGER NOT NULL,
  room_capacity INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'sold_out', 'closed')),
  waitlist_offer_expires_in_minutes INTEGER NOT NULL DEFAULT 120,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Seed rows:

- `2026-w1` → 2026-04-30 to 2026-05-07 → NT$7,656 → 30 rooms
- `2026-w2` → 2026-05-07 to 2026-05-14 → NT$6,130 → 40 rooms
- `2026-w3` → 2026-05-14 to 2026-05-21 → NT$6,282 → 40 rooms
- `2026-w4` → 2026-05-21 to 2026-05-28 → NT$6,400 → 40 rooms

### New table: `stay_bookings`

Booking container visible to members as a single reservation.

```sql
CREATE TABLE stay_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN (
    'draft', 'confirmed', 'partially_transferred', 'transferred', 'cancelled', 'completed'
  )),
  booking_type TEXT NOT NULL CHECK (booking_type IN ('guaranteed', 'complimentary')),
  primary_guest_name TEXT NOT NULL,
  primary_guest_email TEXT NOT NULL,
  primary_guest_phone TEXT NOT NULL,
  guest_count INTEGER NOT NULL CHECK (guest_count IN (1, 2)),
  second_guest_name TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### New table: `stay_booking_weeks`

Actual inventory ownership. One row per booked week.

```sql
CREATE TABLE stay_booking_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES stay_bookings(id) ON DELETE CASCADE,
  member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  week_id BIGINT NOT NULL REFERENCES stay_weeks(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN (
    'confirmed', 'modified_out', 'modified_in', 'pending_transfer',
    'transferred', 'cancelled', 'no_show', 'completed'
  )),
  booked_price_twd INTEGER NOT NULL,
  hold_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_id, week_id)
);
```

Additional partial uniqueness:

- One member can hold at most one active room per week.
- Enforce with a partial unique index on `(member_id, week_id)` where `status IN ('confirmed', 'modified_in', 'pending_transfer')`.

### New table: `stay_guarantees`

Stores the guarantee mechanism and Stripe linkage.

```sql
CREATE TABLE stay_guarantees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES stay_bookings(id) ON DELETE CASCADE,
  guarantee_type TEXT NOT NULL CHECK (guarantee_type IN ('stripe_card', 'complimentary')),
  stripe_customer_id TEXT,
  stripe_setup_intent_id TEXT,
  stripe_payment_method_id TEXT,
  card_brand TEXT,
  card_last4 TEXT,
  consented_at TIMESTAMPTZ,
  replaced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### New table: `stay_invite_codes`

Single-use complimentary access.

```sql
CREATE TABLE stay_invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active', 'reserved', 'used', 'disabled')),
  used_by_member_id BIGINT REFERENCES members(id) ON DELETE SET NULL,
  used_by_booking_id UUID REFERENCES stay_bookings(id) ON DELETE SET NULL,
  batch_label TEXT,
  notes TEXT,
  created_by TEXT,
  reserved_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### New table: `stay_waitlist_entries`

Per-week queue.

```sql
CREATE TABLE stay_waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id BIGINT NOT NULL REFERENCES stay_weeks(id) ON DELETE CASCADE,
  member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN (
    'active', 'offered', 'accepted', 'expired', 'declined', 'removed'
  )),
  position INTEGER NOT NULL,
  offered_at TIMESTAMPTZ,
  offer_expires_at TIMESTAMPTZ,
  accepted_booking_week_id UUID REFERENCES stay_booking_weeks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (week_id, member_id)
);
```

### New table: `stay_transfers`

Explicit transfer lifecycle so admin can inspect and intervene.

```sql
CREATE TABLE stay_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_week_id UUID NOT NULL REFERENCES stay_booking_weeks(id) ON DELETE CASCADE,
  from_member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  to_member_id BIGINT REFERENCES members(id) ON DELETE RESTRICT,
  to_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'pending_acceptance', 'accepted', 'expired', 'revoked'
  )),
  booking_type TEXT NOT NULL CHECK (booking_type IN ('guaranteed', 'complimentary')),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Stripe design

### Important technical constraint

The booking rule says "verify card now, pay on site, charge later only for cancellation or no-show." That sounds similar to hotel authorization, but a long-lived uncaptured authorization is not a good fit here.

Per current Stripe docs:

- Manual capture / authorization windows for online card payments are typically only a few days, often around 5-7 days depending on the network.
- Future off-session charging is handled through a saved payment method and a later PaymentIntent.

**Inference from the docs:** because members may book well before the stay week, `/stay` should not rely on a long-lived manual-capture authorization. Instead, the system should save and authenticate a card for future off-session use, then only create a charge if the cancellation / no-show rule needs to be enforced.

### Recommended Stripe flow

Regular booking:

1. Create or reuse a Stripe Customer for the member
2. Run a SetupIntent (or equivalent Checkout setup flow) for `off_session` future use
3. Store the resulting PaymentMethod on the booking guarantee
4. Record consent language and timestamp
5. Later, if the organizer must charge for cancellation / no-show:
   - create an off-session PaymentIntent
   - amount = full booked week price for the affected week(s)
   - record the resulting Stripe IDs in admin-side charge history

Complimentary booking:

- No SetupIntent
- No saved PaymentMethod
- `guarantee_type='complimentary'`

Transfer behavior:

- Guaranteed booking transfer replaces the guarantee with a newly set up PaymentMethod from the recipient
- Complimentary booking transfer keeps `guarantee_type='complimentary'`

### Consent requirements

The booking flow must collect explicit agreement that the organizer may initiate a later off-session charge for the booked week(s) in the event of cancellation or no-show. The consent copy must be shown at the guarantee step and recorded with timestamp.

## API surface

All member-facing stay APIs should require a valid session from the existing auth system.

### Member-facing routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/stay/weeks` | Public / authed weekly inventory summary |
| POST | `/api/stay/quote` | Validate selected weeks and return booking summary before setup |
| POST | `/api/stay/bookings` | Create guaranteed or complimentary booking |
| GET | `/api/stay/bookings/:id` | Read one booking for the owning member |
| POST | `/api/stay/bookings/:id/modify` | Change one booked week to another available week |
| POST | `/api/stay/bookings/:id/transfer` | Initiate transfer |
| POST | `/api/stay/transfers/:id/accept` | Recipient accepts transfer |
| POST | `/api/stay/waitlist` | Join waitlist for a week |
| DELETE | `/api/stay/waitlist/:id` | Leave waitlist |
| POST | `/api/stay/invite-code/validate` | Validate invite code before final submit |

### Admin routes

All admin routes require `getAdminSession`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/admin/stay/summary` | Dashboard counts by week / state |
| GET | `/api/admin/stay/bookings` | Filtered list |
| GET | `/api/admin/stay/bookings/:id` | Full booking detail |
| POST | `/api/admin/stay/invite-codes/batch` | Batch create single-use invite codes |
| PATCH | `/api/admin/stay/weeks/:id` | Adjust capacity / status / hold time |
| POST | `/api/admin/stay/transfers/:id/resend` | Resend transfer invitation |
| POST | `/api/admin/stay/waitlist/:id/offer` | Manually offer a released slot |
| POST | `/api/admin/stay/bookings/:id/no-show` | Mark no-show and trigger charge workflow |
| POST | `/api/admin/stay/bookings/:id/comp` | Create manual complimentary booking |

## Member UI additions

### `/stay`

The main booking page described above.

### `/me`

Add a stay summary card showing:

- Whether the member currently has a stay booking
- Booked week chips
- Complimentary vs guaranteed badge
- Waitlist count
- Transfer pending state
- CTA:
  - `Book stay`
  - `Manage stay`
  - `Accept transfer`

### Stay management page

Use either `/stay` logged-in panel expansion or a dedicated route such as `/stay/manage/[id]`.

Must support:

- Read booking summary
- See each booked week and status
- Start a modification
- Start a transfer
- See guarantee type
- Review policy copy again

### Transfer accept page

A focused page opened from email:

- identifies the week(s) being transferred
- identifies whether it is complimentary or guaranteed
- if guaranteed, runs card setup before accept
- if complimentary, accepts immediately

## Admin UI

Add a new admin navigation entry: `住宿 Stay`.

### `/admin/stay`

Dashboard cards:

- total confirmed room-weeks by week
- remaining capacity by week
- active waitlist counts
- pending transfers
- bookings missing guarantee data
- no-show actions pending review

### `/admin/stay/bookings`

Filterable table:

- member no
- email
- guest name
- week(s)
- guaranteed / complimentary
- status
- card summary if applicable
- created_at

### `/admin/stay/bookings/[id]`

Detail view:

- booking summary
- week timeline
- guarantee details
- invite-code usage if any
- transfer history
- waitlist / modification history
- admin notes

### `/admin/stay/weeks`

One card per week:

- configured capacity
- confirmed room-weeks
- held / pending states
- waitlist size
- button to close / reopen / adjust capacity

### `/admin/stay/invite-codes`

Support batch creation with:

- count
- prefix or autogenerated codes
- optional batch label
- created_by

Display:

- code
- status
- used_by member
- used_by booking
- used_at

## Messaging and risk disclosure

The cancellation / no-show rule is the highest-risk content in the feature. It must be repeated, not implied.

Required placements:

1. Above the fold on `/stay`
2. Adjacent to week selection
3. Immediately before card setup
4. In final confirmation checkbox copy
5. On booking success page
6. In booking-confirmation email
7. In transfer-accept flow

Suggested final consent text:

> I understand that this reservation is guaranteed with my saved payment method. If I cancel or do not show up, I authorize Taiwan Digital Fest to charge the full booked week amount for the affected week(s).

Complimentary flow wording must be separate and must not mention card setup.

## Email / notification events

Required notification types:

- `stay_booking_confirmed`
- `stay_booking_complimentary_confirmed`
- `stay_transfer_requested`
- `stay_transfer_accepted`
- `stay_waitlist_offer`
- `stay_waitlist_expired`
- `stay_modification_confirmed`
- `stay_no_show_charged`

All notifications should be sent through the existing Mailgun-based email infrastructure and logged in the existing email log system with a clear `email_type`.

## Error handling

- Capacity checks must happen server-side at final write time, not just on page load.
- Invite-code validation must be atomic so one code can't be consumed twice.
- Transfer acceptance must fail cleanly if the recipient email doesn't map to a member account.
- Waitlist offers must expire automatically and release inventory / offer rights to the next person.
- Modification must be transactional so inventory is not lost if the new week write fails after the old week is released.

## Implementation notes for this repo

- Reuse existing auth (`AuthContext`, `/api/auth/session`, `/me`) rather than creating new auth.
- Reuse existing admin gate (`getAdminSession`, `/admin/layout.tsx`).
- Keep stay logic in a dedicated `lib/stay*` module family rather than burying it in `lib/orders.ts`.
- Put stay UI in a focused set of components, for example:
  - `components/stay/StayBookingPanel.tsx`
  - `components/stay/StayWeekSelector.tsx`
  - `components/stay/StayPolicyNotice.tsx`
  - `components/stay/StayManagementPanel.tsx`
  - `components/stay/StayTransferAccept.tsx`
- Add stay copy to `data/content.ts` so it remains bilingual under the existing translation model.

## Verification

No automated test framework is configured today, so implementation verification must at minimum cover manual scenarios:

1. Member can book one available week with card setup.
2. Member can book multiple available weeks in one flow.
3. Invite code creates complimentary booking without card setup.
4. Invite code cannot be reused.
5. Member cannot book a second room for the same week.
6. Sold-out week only allows waitlist.
7. Waitlist offer expires and moves to the next member.
8. Guaranteed transfer requires recipient card setup.
9. Complimentary transfer does not require recipient card setup.
10. Modification releases old week and reserves new week atomically.
11. Critical policy copy appears in all required UI and email touchpoints.

## Open technical note

If organizers later require a true short-term authorization hold close to check-in, that should be treated as a separate enhancement. The initial `/stay` implementation should be designed around card-on-file setup plus later off-session charging, because that matches Stripe's current future-use flow and avoids authorization-expiry issues for early bookings.

## References

- Stripe Setup Intents: https://docs.stripe.com/payments/setup-intents
- Stripe save and reuse for later charges: https://docs.stripe.com/payments/checkout/save-and-reuse
- Stripe manual capture / authorization windows: https://docs.stripe.com/payments/place-a-hold-on-a-payment-method
