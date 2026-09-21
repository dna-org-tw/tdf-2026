# Member Visa Support Letter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/me` flow that lets any logged-in member save visa-document identity details and download an English-first PDF invitation letter, with conditional paid-order verification, official organizer info, the association seal, and issuance logging.

**Architecture:** Keep visa data separate from public member-card data by adding a dedicated `member_visa_profiles` table plus a `visa_letter_issuances` audit table. Server-side helpers in `lib/memberVisa.ts` own validation, rate limiting, member lookup, best-paid-order selection, and PDF hashing; `lib/visaLetter.tsx` renders the formal PDF using `@react-pdf/renderer`, a bundled CJK font, and `public/legal/tdna_stamp.png`. The member dashboard mounts a new `VisaSupportSection` client component that reads/saves `/api/member/visa-profile`, previews whether paid-order verification will appear, and downloads `/api/member/visa-letter`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase service-role routes, Tailwind CSS 4, existing member auth (`getSessionFromRequest`), existing `checkRateLimit`, Playwright for E2E verification, and a new runtime dependency on `@react-pdf/renderer`. **The repo has no unit-test framework** — verification uses Playwright, `npm run lint`, `npm run build`, and SQL checks.

**Spec:** `docs/superpowers/specs/2026-04-19-member-visa-support-letter-design.md`

---

## File Map

**Create:**
- `public/legal/tdna_stamp.png` — tracked copy of the official seal asset used in PDFs
- `public/fonts/NotoSansCJKtc-Regular.otf` — CJK-capable font for the PDF header/signature block
- `supabase/migrations/zzzzzzzzz_add_member_visa_profiles.sql` — visa profile table + trigger
- `supabase/migrations/zzzzzzzzzz_create_visa_letter_issuances.sql` — issuance log table + generated document number
- `lib/memberVisa.ts` — server-only types, validation, member lookup, best paid order selection, rate limiting, SHA-256 helper
- `lib/visaLetter.tsx` — `@react-pdf/renderer` document + `renderVisaLetterPdf`
- `app/api/member/visa-profile/route.ts` — GET/PUT for signed-in member visa data
- `app/api/member/visa-letter/route.ts` — POST to create issuance log + PDF download
- `components/member/VisaSupportForm.tsx` — form fields + inline validation rendering
- `components/member/VisaLetterSummary.tsx` — preview card for paid/unpaid variants
- `components/member/VisaSupportSection.tsx` — fetch/save/download state machine mounted on `/me`
- `tests/e2e/member-visa-support.spec.ts` — dashboard E2E covering save + download

**Modify:**
- `package.json`
- `package-lock.json`
- `app/me/page.tsx`
- `data/content.ts`
- `docs/superpowers/specs/2026-04-19-member-visa-support-letter-design.md` — add official website to organizer info

---

### Task 1: PDF Runtime Dependency and Legal Assets

**Files:**
- Create: `public/legal/tdna_stamp.png`
- Create: `public/fonts/NotoSansCJKtc-Regular.otf`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install the PDF renderer dependency**

Run:
```bash
npm install @react-pdf/renderer
```
Expected: `package.json` gains `@react-pdf/renderer` under `dependencies`, and `package-lock.json` updates accordingly.

- [ ] **Step 2: Copy the official seal into a stable tracked asset path and vendor a CJK font**

Run:
```bash
mkdir -p public/legal public/fonts
cp tdna_stamp.png public/legal/tdna_stamp.png
curl -L https://github.com/notofonts/noto-cjk/raw/main/Sans/OTF/TraditionalChinese/NotoSansCJKtc-Regular.otf \
  -o public/fonts/NotoSansCJKtc-Regular.otf
```
Expected: two new files exist at `public/legal/tdna_stamp.png` and `public/fonts/NotoSansCJKtc-Regular.otf`.

- [ ] **Step 3: Verify the assets are readable**

Run:
```bash
file public/legal/tdna_stamp.png
file public/fonts/NotoSansCJKtc-Regular.otf
ls -lh public/legal/tdna_stamp.png public/fonts/NotoSansCJKtc-Regular.otf
```
Expected: `tdna_stamp.png` reports a PNG image, `NotoSansCJKtc-Regular.otf` reports an OpenType font, and both files show non-zero sizes.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json public/legal/tdna_stamp.png public/fonts/NotoSansCJKtc-Regular.otf
git commit -m "feat(pdf): add visa letter rendering dependency and legal assets"
```

---

### Task 2: Database Schema for Visa Profiles and Issuances

**Files:**
- Create: `supabase/migrations/zzzzzzzzz_add_member_visa_profiles.sql`
- Create: `supabase/migrations/zzzzzzzzzz_create_visa_letter_issuances.sql`

- [ ] **Step 1: Write `member_visa_profiles` migration**

Create `supabase/migrations/zzzzzzzzz_add_member_visa_profiles.sql` with:

```sql
-- Dedicated storage for visa-document identity data.
-- Kept separate from member_profiles because this table contains passport PII.

CREATE TABLE IF NOT EXISTS member_visa_profiles (
  id BIGSERIAL PRIMARY KEY,
  member_id BIGINT NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE,
  legal_name_en TEXT NOT NULL,
  nationality TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  passport_number TEXT NOT NULL,
  passport_country TEXT NOT NULL,
  passport_expiry_date DATE NOT NULL,
  planned_arrival_date DATE NOT NULL,
  planned_departure_date DATE NOT NULL,
  taiwan_stay_address TEXT NOT NULL,
  destination_mission TEXT,
  notes_for_letter TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_visa_profiles_member_id
  ON member_visa_profiles(member_id);

CREATE TRIGGER trg_member_visa_profiles_updated_at
  BEFORE UPDATE ON member_visa_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_member_profiles_updated_at();

COMMENT ON TABLE member_visa_profiles IS
  'Server-only visa support letter profile data; includes passport-related PII.';
COMMENT ON COLUMN member_visa_profiles.legal_name_en IS
  'Legal English name exactly as shown on the passport.';
COMMENT ON COLUMN member_visa_profiles.destination_mission IS
  'Optional ROC mission / office where the member will submit the application.';

ALTER TABLE member_visa_profiles ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Write `visa_letter_issuances` migration**

Create `supabase/migrations/zzzzzzzzzz_create_visa_letter_issuances.sql` with:

```sql
-- Audit trail for each visa support letter generation.
-- document_no is generated from the row id so the app can rely on a race-free identifier.

CREATE TABLE IF NOT EXISTS visa_letter_issuances (
  id BIGSERIAL PRIMARY KEY,
  member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  document_no TEXT GENERATED ALWAYS AS (
    'TDF-VISA-2026-' || LPAD(id::text, 6, '0')
  ) STORED UNIQUE,
  letter_type TEXT NOT NULL DEFAULT 'visa_support'
    CHECK (letter_type = 'visa_support'),
  has_paid_order BOOLEAN NOT NULL DEFAULT FALSE,
  order_snapshot JSONB,
  profile_snapshot JSONB NOT NULL,
  pdf_checksum TEXT,
  issued_by TEXT NOT NULL DEFAULT 'system',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visa_letter_issuances_member_issued_at
  ON visa_letter_issuances(member_id, issued_at DESC);

COMMENT ON TABLE visa_letter_issuances IS
  'One row per generated visa support PDF.';
COMMENT ON COLUMN visa_letter_issuances.document_no IS
  'Public-facing document number shown on the PDF.';
COMMENT ON COLUMN visa_letter_issuances.order_snapshot IS
  'Paid-order details included in the PDF at issue time, if any.';
COMMENT ON COLUMN visa_letter_issuances.profile_snapshot IS
  'Full member visa profile used to render the PDF.';

ALTER TABLE visa_letter_issuances ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 3: Apply the migrations in lexical order**

Use the same Supabase workflow as the rest of the repo. If using SQL editor / MCP, apply `zzzzzzzzz_add_member_visa_profiles.sql` first, then `zzzzzzzzzz_create_visa_letter_issuances.sql`.

Expected: both tables exist on the dev database, and `document_no` is generated automatically.

- [ ] **Step 4: Verify the schema**

Run these SQL checks:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'member_visa_profiles'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable, generation_expression
FROM information_schema.columns
WHERE table_name = 'visa_letter_issuances'
ORDER BY ordinal_position;
```

Expected:
- `member_visa_profiles` includes the 14 business columns plus timestamps.
- `visa_letter_issuances.document_no` shows a generated expression based on `id`.

Then verify `document_no` generation with a temporary insert:

```sql
WITH sample_member AS (
  SELECT id FROM members ORDER BY id ASC LIMIT 1
), inserted AS (
  INSERT INTO visa_letter_issuances (member_id, profile_snapshot)
  SELECT id, '{"legal_name_en":"TEST USER"}'::jsonb FROM sample_member
  RETURNING id, document_no
)
SELECT * FROM inserted;
```

Expected: one row with `document_no` like `TDF-VISA-2026-000001` (or the next sequence value). Delete that row after confirming the format:

```sql
DELETE FROM visa_letter_issuances
WHERE profile_snapshot = '{"legal_name_en":"TEST USER"}'::jsonb;
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/zzzzzzzzz_add_member_visa_profiles.sql \
        supabase/migrations/zzzzzzzzzz_create_visa_letter_issuances.sql
git commit -m "feat(db): add visa profile and issuance audit tables"
```

---

### Task 3: Server Helpers for Validation, Order Selection, and Rate Limiting

**Files:**
- Create: `lib/memberVisa.ts`

- [ ] **Step 1: Create `lib/memberVisa.ts`**

Create `lib/memberVisa.ts` with:

```ts
import { createHash } from 'node:crypto';
import { checkRateLimit } from '@/lib/rateLimit';
import { supabaseServer } from '@/lib/supabaseServer';
import { TICKET_TIER_RANK, type TicketTier } from '@/lib/members';
import { getValidityPeriod, FESTIVAL_START } from '@/lib/ticketPricing';
import type { Order } from '@/lib/types/order';

const HAN_RE = /[\u3400-\u9FFF\uF900-\uFAFF]/u;

export interface MemberVisaProfileInput {
  legal_name_en: string;
  nationality: string;
  date_of_birth: string;
  passport_number: string;
  passport_country: string;
  passport_expiry_date: string;
  planned_arrival_date: string;
  planned_departure_date: string;
  taiwan_stay_address: string;
  destination_mission: string | null;
  notes_for_letter: string | null;
}

export interface MemberRow {
  id: number;
  member_no: string;
  email: string;
}

export interface PaidOrderSnapshot {
  id: string;
  ticket_tier: TicketTier;
  status: 'paid';
  amount_total: number;
  currency: string;
  valid_from: string;
  valid_until: string;
  created_at: string;
}

function trimOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function validateVisaProfileInput(body: unknown): { data?: MemberVisaProfileInput; error?: string } {
  if (!body || typeof body !== 'object') return { error: 'Invalid body' };

  const legalName = trimOrNull((body as Record<string, unknown>).legal_name_en);
  const nationality = trimOrNull((body as Record<string, unknown>).nationality);
  const dob = trimOrNull((body as Record<string, unknown>).date_of_birth);
  const passportNumber = trimOrNull((body as Record<string, unknown>).passport_number)?.toUpperCase() ?? null;
  const passportCountry = trimOrNull((body as Record<string, unknown>).passport_country);
  const passportExpiry = trimOrNull((body as Record<string, unknown>).passport_expiry_date);
  const arrival = trimOrNull((body as Record<string, unknown>).planned_arrival_date);
  const departure = trimOrNull((body as Record<string, unknown>).planned_departure_date);
  const stayAddress = trimOrNull((body as Record<string, unknown>).taiwan_stay_address);
  const destinationMission = trimOrNull((body as Record<string, unknown>).destination_mission);
  const notes = trimOrNull((body as Record<string, unknown>).notes_for_letter);

  if (!legalName || !nationality || !dob || !passportNumber || !passportCountry || !passportExpiry || !arrival || !departure || !stayAddress) {
    return { error: 'Missing required fields' };
  }
  if (HAN_RE.test(legalName)) {
    return { error: 'Legal name must be entered in passport English only' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dobDate = new Date(dob);
  const arrivalDate = new Date(arrival);
  const departureDate = new Date(departure);
  const passportExpiryDate = new Date(passportExpiry);

  if (Number.isNaN(dobDate.getTime()) || Number.isNaN(arrivalDate.getTime()) || Number.isNaN(departureDate.getTime()) || Number.isNaN(passportExpiryDate.getTime())) {
    return { error: 'Invalid date values' };
  }
  if (dobDate >= today) return { error: 'Date of birth must be in the past' };
  if (departureDate <= arrivalDate) return { error: 'Planned departure must be after planned arrival' };
  if (passportExpiryDate <= departureDate) return { error: 'Passport expiry must be after planned departure' };

  return {
    data: {
      legal_name_en: legalName,
      nationality,
      date_of_birth: dob,
      passport_number: passportNumber,
      passport_country: passportCountry,
      passport_expiry_date: passportExpiry,
      planned_arrival_date: arrival,
      planned_departure_date: departure,
      taiwan_stay_address: stayAddress,
      destination_mission: destinationMission,
      notes_for_letter: notes,
    },
  };
}

export async function getMemberByEmail(email: string): Promise<MemberRow | null> {
  if (!supabaseServer) throw new Error('Database not configured');
  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabaseServer
    .from('members')
    .select('id, member_no, email')
    .eq('email', normalized)
    .maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, member_no: data.member_no, email: data.email } : null;
}

export async function getVisaProfile(memberId: number) {
  if (!supabaseServer) throw new Error('Database not configured');
  const { data, error } = await supabaseServer
    .from('member_visa_profiles')
    .select('*')
    .eq('member_id', memberId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertVisaProfile(memberId: number, input: MemberVisaProfileInput) {
  if (!supabaseServer) throw new Error('Database not configured');
  const { data, error } = await supabaseServer
    .from('member_visa_profiles')
    .upsert({ member_id: memberId, ...input }, { onConflict: 'member_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

function resolveValidity(order: Pick<Order, 'ticket_tier' | 'valid_from' | 'valid_until'>): { valid_from: string; valid_until: string } {
  if (order.valid_from && order.valid_until) {
    return { valid_from: order.valid_from, valid_until: order.valid_until };
  }
  return getValidityPeriod(order.ticket_tier);
}

export function pickBestPaidOrder(orders: Order[]): PaidOrderSnapshot | null {
  const paid = orders.filter((order) => order.status === 'paid');
  if (paid.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);
  const festivalStarted = today >= FESTIVAL_START;

  const rank = (order: Order) => TICKET_TIER_RANK[order.ticket_tier];
  const byRankThenCreated = (a: Order, b: Order) => {
    const rankDiff = rank(b) - rank(a);
    if (rankDiff !== 0) return rankDiff;
    return b.created_at.localeCompare(a.created_at);
  };

  const active = festivalStarted
    ? paid.filter((order) => {
        const validity = resolveValidity(order);
        return today >= validity.valid_from && today <= validity.valid_until;
      })
    : [];

  const best = (active.length > 0 ? active : paid).sort(byRankThenCreated)[0];
  const validity = resolveValidity(best);
  return {
    id: best.id,
    ticket_tier: best.ticket_tier,
    status: 'paid',
    amount_total: best.amount_total,
    currency: best.currency,
    valid_from: validity.valid_from,
    valid_until: validity.valid_until,
    created_at: best.created_at,
  };
}

export async function getPaidOrdersForEmail(email: string): Promise<Order[]> {
  if (!supabaseServer) throw new Error('Database not configured');
  const { data, error } = await supabaseServer
    .from('orders')
    .select('*')
    .eq('customer_email', email.trim().toLowerCase())
    .eq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as Order[];
}

export async function enforceVisaLetterRateLimit(memberNo: string) {
  const result = await checkRateLimit(`visa-letter:${memberNo}`, {
    limit: 5,
    windowSeconds: 60 * 60,
  });
  if (!result.allowed) {
    const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    const error = new Error('RATE_LIMITED');
    (error as Error & { retryAfter?: number }).retryAfter = retryAfter;
    throw error;
  }
  return result;
}

export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function formatIssueDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(iso));
}
```

- [ ] **Step 2: Type-check the helper**

Run:
```bash
npx tsc --noEmit
```
Expected: no TypeScript errors from `lib/memberVisa.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/memberVisa.ts
git commit -m "feat(visa): add shared visa profile and order selection helpers"
```

---

### Task 4: Formal PDF Renderer with Organizer Website and Seal

**Files:**
- Create: `lib/visaLetter.tsx`

- [ ] **Step 1: Create `lib/visaLetter.tsx`**

Create `lib/visaLetter.tsx` with:

```tsx
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer';
import type { PaidOrderSnapshot, MemberVisaProfileInput } from '@/lib/memberVisa';

let fontsRegistered = false;
let sealDataUri: string | null = null;

function ensurePdfAssets() {
  const fontPath = path.join(process.cwd(), 'public', 'fonts', 'NotoSansCJKtc-Regular.otf');
  const sealPath = path.join(process.cwd(), 'public', 'legal', 'tdna_stamp.png');

  if (!existsSync(fontPath)) throw new Error(`Missing PDF font at ${fontPath}`);
  if (!existsSync(sealPath)) throw new Error(`Missing seal image at ${sealPath}`);

  if (!fontsRegistered) {
    Font.register({
      family: 'NotoSansCJKtc',
      src: fontPath,
    });
    fontsRegistered = true;
  }

  if (!sealDataUri) {
    const file = readFileSync(sealPath);
    sealDataUri = `data:image/png;base64,${file.toString('base64')}`;
  }
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansCJKtc',
    fontSize: 10.5,
    paddingTop: 36,
    paddingBottom: 40,
    paddingHorizontal: 44,
    color: '#111827',
    lineHeight: 1.45,
  },
  header: { marginBottom: 18, borderBottomWidth: 1, borderBottomColor: '#D1D5DB', paddingBottom: 10 },
  titleCn: { fontSize: 13, fontWeight: 700, marginBottom: 2 },
  titleEn: { fontSize: 12, fontWeight: 700, marginBottom: 6 },
  metaLine: { marginBottom: 2 },
  subject: { fontSize: 12, fontWeight: 700, marginBottom: 12 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 10, fontWeight: 700, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.6 },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: 130, color: '#4B5563' },
  value: { flex: 1 },
  body: { marginTop: 8 },
  disclaimer: {
    marginTop: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#D1D5DB',
    fontSize: 9,
    color: '#4B5563',
  },
  signatureWrap: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  seal: {
    width: 128,
    height: 96,
    objectFit: 'contain',
  },
  signatureText: {
    width: 220,
    alignItems: 'flex-start',
    gap: 2,
  },
});

export interface VisaLetterPdfData {
  documentNo: string;
  issueDate: string;
  destinationMission: string | null;
  profile: MemberVisaProfileInput;
  paidOrder: PaidOrderSnapshot | null;
}

function OrganizerBlock() {
  return (
    <View style={styles.header}>
      <Text style={styles.titleCn}>社團法人台灣數位遊牧者協會</Text>
      <Text style={styles.titleEn}>TAIWAN DIGITAL NOMADS ASSOCIATION, INCORPORATED ASSOCIATION</Text>
      <Text style={styles.metaLine}>VAT 93214386</Text>
      <Text style={styles.metaLine}>Certificate No. 1130006174</Text>
      <Text style={styles.metaLine}>臺北市中正區黎明里忠孝西路1段72號2樓之1</Text>
      <Text style={styles.metaLine}>2F-1, NO. 72, SECTION 1, ZHONGXIAO WEST ROAD, LIMING DISTRICT, ZHONGZHENG DISTRICT, TAIPEI CITY</Text>
      <Text style={styles.metaLine}>Email: kk@dna.org.tw | Phone: +886 983665352 | Website: https://fest.dna.org.tw</Text>
    </View>
  );
}

function VisaLetterDocument({ data }: { data: VisaLetterPdfData }) {
  return (
    <Document title={data.documentNo} author="Taiwan Digital Nomads Association">
      <Page size="A4" style={styles.page}>
        <OrganizerBlock />

        <Text style={styles.subject}>Subject: Visa Support Invitation Letter for Taiwan Digital Fest 2026</Text>
        <View style={styles.section}>
          <Text>Document No.: {data.documentNo}</Text>
          <Text>Issue Date: {data.issueDate}</Text>
        </View>

        <View style={styles.section}>
          <Text>{data.destinationMission ? `To: ${data.destinationMission}` : 'To Whom It May Concern'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Applicant Identity</Text>
          <View style={styles.row}><Text style={styles.label}>Legal Name</Text><Text style={styles.value}>{data.profile.legal_name_en}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Nationality</Text><Text style={styles.value}>{data.profile.nationality}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Date of Birth</Text><Text style={styles.value}>{data.profile.date_of_birth}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Passport Number</Text><Text style={styles.value}>{data.profile.passport_number}</Text></View>
        </View>

        <View style={styles.body}>
          <Text>
            This letter is to confirm that the above-named member is invited by TAIWAN DIGITAL NOMADS
            ASSOCIATION, INCORPORATED ASSOCIATION to visit Taiwan in May 2026 to participate in Taiwan
            Digital Fest 2026, including festival activities, community gatherings, networking, workshops,
            and cultural exchange programs in Taiwan, primarily in Taitung and Hualien.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Travel Plan</Text>
          <View style={styles.row}><Text style={styles.label}>Planned Arrival</Text><Text style={styles.value}>{data.profile.planned_arrival_date}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Planned Departure</Text><Text style={styles.value}>{data.profile.planned_departure_date}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Intended Stay Address</Text><Text style={styles.value}>{data.profile.taiwan_stay_address}</Text></View>
        </View>

        {data.paidOrder ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Verified Festival Purchase Details</Text>
            <View style={styles.row}><Text style={styles.label}>Order Reference</Text><Text style={styles.value}>{data.paidOrder.id}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Ticket Tier</Text><Text style={styles.value}>{data.paidOrder.ticket_tier}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Order Status</Text><Text style={styles.value}>Paid</Text></View>
            <View style={styles.row}><Text style={styles.label}>Validity Period</Text><Text style={styles.value}>{data.paidOrder.valid_from} to {data.paidOrder.valid_until}</Text></View>
          </View>
        ) : null}

        <View style={styles.signatureWrap}>
          <Image src={sealDataUri ?? ''} style={styles.seal} />
          <View style={styles.signatureText}>
            <Text>Contact Person: Kai Hsu</Text>
            <Text>Email: kk@dna.org.tw</Text>
            <Text>Phone: +886 983665352</Text>
            <Text>Website: https://fest.dna.org.tw</Text>
            <Text>Signatory: Kai Hsu, President</Text>
          </View>
        </View>

        <View style={styles.disclaimer}>
          <Text>This letter is issued as a supporting document for visa application purposes only.</Text>
          <Text>This letter does not guarantee visa issuance.</Text>
          <Text>Visa approval remains subject to the decision of the relevant Republic of China (Taiwan) overseas mission.</Text>
          <Text>This letter is issued based on the information provided by the member and the records available in our system as of the issue date.</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderVisaLetterPdf(data: VisaLetterPdfData): Promise<Buffer> {
  ensurePdfAssets();
  const rendered = await renderToBuffer(<VisaLetterDocument data={data} />);
  return Buffer.isBuffer(rendered) ? rendered : Buffer.from(rendered);
}
```

- [ ] **Step 2: Smoke-test the file at build time**

Run:
```bash
npx tsc --noEmit
```
Expected: JSX in `lib/visaLetter.tsx` compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add lib/visaLetter.tsx
git commit -m "feat(visa): add formal PDF letter renderer"
```

---

### Task 5: Authenticated API Routes for Profile Save and PDF Download

**Files:**
- Create: `app/api/member/visa-profile/route.ts`
- Create: `app/api/member/visa-letter/route.ts`

- [ ] **Step 1: Create `app/api/member/visa-profile/route.ts`**

Create the route with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getMemberByEmail, getVisaProfile, upsertVisaProfile, validateVisaProfileInput } from '@/lib/memberVisa';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const member = await getMemberByEmail(session.email);
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    const profile = await getVisaProfile(member.id);
    return NextResponse.json(profile ?? {
      legal_name_en: null,
      nationality: null,
      date_of_birth: null,
      passport_number: null,
      passport_country: null,
      passport_expiry_date: null,
      planned_arrival_date: null,
      planned_departure_date: null,
      taiwan_stay_address: null,
      destination_mission: null,
      notes_for_letter: null,
      updated_at: null,
    });
  } catch (error) {
    console.error('[Visa Profile GET]', error);
    return NextResponse.json({ error: 'Failed to load visa profile' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = validateVisaProfileInput(body);
  if (!parsed.data) {
    return NextResponse.json({ error: parsed.error ?? 'Invalid body' }, { status: 400 });
  }

  try {
    const member = await getMemberByEmail(session.email);
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    const profile = await upsertVisaProfile(member.id, parsed.data);
    return NextResponse.json(profile);
  } catch (error) {
    console.error('[Visa Profile PUT]', error);
    return NextResponse.json({ error: 'Failed to save visa profile' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create `app/api/member/visa-letter/route.ts`**

Create the route with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { getSessionFromRequest } from '@/lib/auth';
import {
  enforceVisaLetterRateLimit,
  formatIssueDate,
  getMemberByEmail,
  getPaidOrdersForEmail,
  getVisaProfile,
  pickBestPaidOrder,
  sha256,
  validateVisaProfileInput,
} from '@/lib/memberVisa';
import { renderVisaLetterPdf } from '@/lib/visaLetter';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    const member = await getMemberByEmail(session.email);
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    await enforceVisaLetterRateLimit(member.member_no);

    const profile = await getVisaProfile(member.id);
    if (!profile) {
      return NextResponse.json({ error: 'Visa profile not found' }, { status: 400 });
    }
    const parsed = validateVisaProfileInput(profile);
    if (!parsed.data) {
      return NextResponse.json({ error: parsed.error ?? 'Invalid saved visa profile' }, { status: 400 });
    }

    const paidOrder = pickBestPaidOrder(await getPaidOrdersForEmail(member.email));

    const { data: issuance, error: insertError } = await supabaseServer
      .from('visa_letter_issuances')
      .insert({
        member_id: member.id,
        has_paid_order: !!paidOrder,
        order_snapshot: paidOrder,
        profile_snapshot: profile,
      })
      .select('id, document_no, issued_at')
      .single();
    if (insertError || !issuance) throw insertError ?? new Error('Failed to create issuance row');

    try {
      const pdfBuffer = await renderVisaLetterPdf({
        documentNo: issuance.document_no,
        issueDate: formatIssueDate(issuance.issued_at),
        destinationMission: parsed.data.destination_mission,
        profile: parsed.data,
        paidOrder,
      });

      const checksum = sha256(pdfBuffer);
      const { error: updateError } = await supabaseServer
        .from('visa_letter_issuances')
        .update({ pdf_checksum: checksum })
        .eq('id', issuance.id);
      if (updateError) throw updateError;

      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename=\"tdf-visa-support-letter-${issuance.document_no}.pdf\"`,
          'Cache-Control': 'no-store',
        },
      });
    } catch (renderError) {
      await supabaseServer.from('visa_letter_issuances').delete().eq('id', issuance.id);
      throw renderError;
    }
  } catch (error) {
    const retryAfter = (error as Error & { retryAfter?: number }).retryAfter;
    if (retryAfter) {
      return NextResponse.json({ error: 'Too many download attempts', retryAfter }, { status: 429 });
    }
    console.error('[Visa Letter POST]', error);
    return NextResponse.json({ error: 'Failed to generate visa letter' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Run route-level typecheck**

Run:
```bash
npx tsc --noEmit
```
Expected: both new API routes compile cleanly.

- [ ] **Step 4: Commit**

```bash
git add app/api/member/visa-profile/route.ts app/api/member/visa-letter/route.ts
git commit -m "feat(api): add member visa profile and visa letter endpoints"
```

---

### Task 6: Member Dashboard UI, Summary Card, and Translations

**Files:**
- Create: `components/member/VisaSupportForm.tsx`
- Create: `components/member/VisaLetterSummary.tsx`
- Create: `components/member/VisaSupportSection.tsx`
- Modify: `app/me/page.tsx`
- Modify: `data/content.ts`

- [ ] **Step 1: Add translation strings to `data/content.ts`**

Under `auth`, add a new `visaSupport` block in both `en` and `zh`:

```ts
visaSupport: {
  title: "Visa Support Documents",
  intro: "Generate a supporting invitation letter for your Taiwan visa application.",
  disclaimer: "This document supports your application but does not guarantee visa issuance. You may still need to provide a passport, photo, proof of funds, itinerary, and return ticket.",
  legalName: "Legal name (as shown on passport)",
  nationality: "Nationality",
  dateOfBirth: "Date of birth",
  passportNumber: "Passport number",
  passportCountry: "Passport issuing country",
  passportExpiry: "Passport expiry date",
  arrival: "Planned arrival date",
  departure: "Planned departure date",
  stayAddress: "Address in Taiwan",
  destinationMission: "ROC mission / office for application",
  save: "Save details",
  saving: "Saving…",
  saved: "Details saved.",
  download: "Download visa support letter",
  downloading: "Preparing PDF…",
  summaryTitle: "Letter summary",
  summaryPaid: "Verified purchase will be included",
  summaryUnpaid: "General membership invitation only",
  summaryEnglish: "Document will be generated in English.",
  fieldRequired: "This field is required.",
  fieldDateOrder: "Departure must be after arrival.",
  fieldPassportExpiry: "Passport expiry must be after planned departure.",
  fieldLegalName: "Use passport English only.",
  loadError: "Could not load your visa details. Please try again.",
  saveError: "Could not save your visa details. Please try again.",
  downloadError: "Could not generate the PDF. Please try again.",
  rateLimited: "Too many download attempts. Please wait {minutes} minute(s) and try again.",
}
```

Mirror the block in zh-TW:

```ts
visaSupport: {
  title: "簽證輔助文件",
  intro: "產生可用於申請來台簽證的邀請函輔助文件。",
  disclaimer: "本文件僅作為簽證申請輔助文件，不保證簽證核發。你仍可能需要自行準備護照、照片、財力證明、行程與回程機票。",
  legalName: "護照英文姓名",
  nationality: "國籍",
  dateOfBirth: "出生日期",
  passportNumber: "護照號碼",
  passportCountry: "護照核發國家",
  passportExpiry: "護照到期日",
  arrival: "預計入境日",
  departure: "預計離境日",
  stayAddress: "在台停留地址",
  destinationMission: "申請館處",
  save: "儲存資料",
  saving: "儲存中…",
  saved: "資料已儲存。",
  download: "下載簽證邀請函",
  downloading: "正在產生 PDF…",
  summaryTitle: "文件摘要",
  summaryPaid: "會附上已驗證的付費票券資訊",
  summaryUnpaid: "僅會顯示一般會員邀請資訊",
  summaryEnglish: "文件將以英文產生。",
  fieldRequired: "此欄位為必填。",
  fieldDateOrder: "離境日必須晚於入境日。",
  fieldPassportExpiry: "護照到期日必須晚於預計離境日。",
  fieldLegalName: "請使用護照英文姓名。",
  loadError: "無法載入簽證資料，請稍後再試。",
  saveError: "無法儲存簽證資料，請稍後再試。",
  downloadError: "無法產生 PDF，請稍後再試。",
  rateLimited: "下載次數過多，請於 {minutes} 分鐘後再試。",
}
```

- [ ] **Step 2: Create `components/member/VisaSupportForm.tsx`**

```tsx
'use client';

interface VisaSupportFormProps {
  values: Record<string, string>;
  errors: Partial<Record<string, string>>;
  labels: Record<string, string>;
  onChange: (field: string, value: string) => void;
}

const INPUT = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#10B8D9]';

export default function VisaSupportForm({ values, errors, labels, onChange }: VisaSupportFormProps) {
  const rows = [
    ['legal_name_en', labels.legalName, 'text'],
    ['nationality', labels.nationality, 'text'],
    ['date_of_birth', labels.dateOfBirth, 'date'],
    ['passport_number', labels.passportNumber, 'text'],
    ['passport_country', labels.passportCountry, 'text'],
    ['passport_expiry_date', labels.passportExpiry, 'date'],
    ['planned_arrival_date', labels.arrival, 'date'],
    ['planned_departure_date', labels.departure, 'date'],
    ['taiwan_stay_address', labels.stayAddress, 'textarea'],
    ['destination_mission', labels.destinationMission, 'text'],
  ] as const;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {rows.map(([field, label, type]) => (
        <label key={field} className={field === 'taiwan_stay_address' ? 'sm:col-span-2' : ''}>
          <span className="mb-1 block text-[12px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
          {type === 'textarea' ? (
            <textarea
              value={values[field] ?? ''}
              onChange={(e) => onChange(field, e.target.value)}
              rows={3}
              className={INPUT}
            />
          ) : (
            <input
              type={type}
              value={values[field] ?? ''}
              onChange={(e) => onChange(field, e.target.value)}
              className={INPUT}
            />
          )}
          {errors[field] ? <span className="mt-1 block text-xs text-red-500">{errors[field]}</span> : null}
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create `components/member/VisaLetterSummary.tsx`**

```tsx
'use client';

interface VisaLetterSummaryProps {
  title: string;
  englishHint: string;
  paidLabel: string;
  unpaidLabel: string;
  hasPaidOrder: boolean;
  values: Record<string, string>;
}

export default function VisaLetterSummary({
  title,
  englishHint,
  paidLabel,
  unpaidLabel,
  hasPaidOrder,
  values,
}: VisaLetterSummaryProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-stone-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${hasPaidOrder ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-700'}`}>
          {hasPaidOrder ? paidLabel : unpaidLabel}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500">{englishHint}</p>
      <dl className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
        <div><dt className="text-xs uppercase tracking-wide text-slate-400">Name</dt><dd>{values.legal_name_en || '—'}</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-slate-400">Nationality</dt><dd>{values.nationality || '—'}</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-slate-400">Travel</dt><dd>{values.planned_arrival_date && values.planned_departure_date ? `${values.planned_arrival_date} → ${values.planned_departure_date}` : '—'}</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-slate-400">Mission</dt><dd>{values.destination_mission || 'To Whom It May Concern'}</dd></div>
      </dl>
    </div>
  );
}
```

- [ ] **Step 4: Create `components/member/VisaSupportSection.tsx`**

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Order } from '@/lib/types/order';
import CollapsibleSection from '@/components/member/CollapsibleSection';
import VisaSupportForm from './VisaSupportForm';
import VisaLetterSummary from './VisaLetterSummary';

interface VisaSupportSectionProps {
  orders: Order[];
  labels: {
    title: string;
    intro: string;
    disclaimer: string;
    legalName: string;
    nationality: string;
    dateOfBirth: string;
    passportNumber: string;
    passportCountry: string;
    passportExpiry: string;
    arrival: string;
    departure: string;
    stayAddress: string;
    destinationMission: string;
    save: string;
    saving: string;
    saved: string;
    download: string;
    downloading: string;
    summaryTitle: string;
    summaryPaid: string;
    summaryUnpaid: string;
    summaryEnglish: string;
    fieldRequired: string;
    fieldDateOrder: string;
    fieldPassportExpiry: string;
    fieldLegalName: string;
    loadError: string;
    saveError: string;
    downloadError: string;
    rateLimited: string;
  };
}

const REQUIRED_FIELDS = [
  'legal_name_en',
  'nationality',
  'date_of_birth',
  'passport_number',
  'passport_country',
  'passport_expiry_date',
  'planned_arrival_date',
  'planned_departure_date',
  'taiwan_stay_address',
] as const;

const DEFAULT_VALUES: Record<string, string> = {
  legal_name_en: '',
  nationality: '',
  date_of_birth: '',
  passport_number: '',
  passport_country: '',
  passport_expiry_date: '',
  planned_arrival_date: '',
  planned_departure_date: '',
  taiwan_stay_address: '',
  destination_mission: '',
};

export default function VisaSupportSection({ orders, labels }: VisaSupportSectionProps) {
  const [values, setValues] = useState<Record<string, string>>(DEFAULT_VALUES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/member/visa-profile')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => {
        setValues({
          legal_name_en: data.legal_name_en ?? '',
          nationality: data.nationality ?? '',
          date_of_birth: data.date_of_birth ?? '',
          passport_number: data.passport_number ?? '',
          passport_country: data.passport_country ?? '',
          passport_expiry_date: data.passport_expiry_date ?? '',
          planned_arrival_date: data.planned_arrival_date ?? '',
          planned_departure_date: data.planned_departure_date ?? '',
          taiwan_stay_address: data.taiwan_stay_address ?? '',
          destination_mission: data.destination_mission ?? '',
        });
        setSaved(Boolean(data.updated_at));
      })
      .catch(() => setError(labels.loadError))
      .finally(() => setLoading(false));
  }, [labels.loadError]);

  const errors = useMemo(() => {
    const next: Partial<Record<string, string>> = {};
    for (const field of REQUIRED_FIELDS) {
      if (!values[field]) next[field] = labels.fieldRequired;
    }
    if (/[\\u3400-\\u9FFF\\uF900-\\uFAFF]/u.test(values.legal_name_en)) {
      next.legal_name_en = labels.fieldLegalName;
    }
    if (values.planned_arrival_date && values.planned_departure_date && values.planned_departure_date <= values.planned_arrival_date) {
      next.planned_departure_date = labels.fieldDateOrder;
    }
    if (values.passport_expiry_date && values.planned_departure_date && values.passport_expiry_date <= values.planned_departure_date) {
      next.passport_expiry_date = labels.fieldPassportExpiry;
    }
    return next;
  }, [values, labels]);

  const hasPaidOrder = orders.some((order) => order.status === 'paid');
  const canDownload = saved && Object.keys(errors).length === 0 && !downloading && !loading;

  async function saveDetails() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/member/visa-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
    } catch {
      setError(labels.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function downloadLetter() {
    setDownloading(true);
    setError('');
    try {
      const res = await fetch('/api/member/visa-letter', { method: 'POST' });
      if (res.status === 429) {
        const data = await res.json();
        const minutes = Math.max(1, Math.ceil((Number(data.retryAfter) || 60) / 60));
        throw new Error(labels.rateLimited.replace('{minutes}', String(minutes)));
      }
      if (!res.ok) throw new Error(labels.downloadError);

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = res.headers.get('Content-Disposition')?.match(/filename=\"?([^\"]+)\"?/)?.[1] ?? 'tdf-visa-support-letter.pdf';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.downloadError);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <CollapsibleSection title={labels.title} count={loading ? '…' : 'PDF'} defaultOpen={false}>
      <div className="mt-2 space-y-4">
        <p className="text-sm text-slate-600">{labels.intro}</p>
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{labels.disclaimer}</p>
        <VisaSupportForm
          values={values}
          errors={errors}
          labels={labels}
          onChange={(field, value) => {
            setValues((prev) => ({ ...prev, [field]: value }));
            setSaved(false);
          }}
        />
        <VisaLetterSummary
          title={labels.summaryTitle}
          englishHint={labels.summaryEnglish}
          paidLabel={labels.summaryPaid}
          unpaidLabel={labels.summaryUnpaid}
          hasPaidOrder={hasPaidOrder}
          values={values}
        />
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        {saved && !error ? <p className="text-sm text-green-600">{labels.saved}</p> : null}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={saving || Object.keys(errors).length > 0}
            onClick={saveDetails}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
          >
            {saving ? labels.saving : labels.save}
          </button>
          <button
            type="button"
            disabled={!canDownload}
            onClick={downloadLetter}
            className="rounded-lg bg-[#10B8D9] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
          >
            {downloading ? labels.downloading : labels.download}
          </button>
        </div>
      </div>
    </CollapsibleSection>
  );
}
```

- [ ] **Step 5: Mount the new section in `app/me/page.tsx`**

Add the import:

```tsx
import VisaSupportSection from '@/components/member/VisaSupportSection';
```

Then render it inside `MemberDashboard`, below the existing orders block and before email preferences:

```tsx
      <VisaSupportSection
        orders={orders}
        labels={t.auth.visaSupport}
      />

      <EmailPreferences email={user?.email ?? ''} />
```

- [ ] **Step 6: Type-check and lint the UI**

Run:
```bash
npm run lint
```
Expected: ESLint passes and the new components import cleanly.

- [ ] **Step 7: Commit**

```bash
git add components/member/VisaSupportForm.tsx \
        components/member/VisaLetterSummary.tsx \
        components/member/VisaSupportSection.tsx \
        app/me/page.tsx \
        data/content.ts \
        docs/superpowers/specs/2026-04-19-member-visa-support-letter-design.md
git commit -m "feat(member): add visa support documents section"
```

---

### Task 7: End-to-End Coverage and Manual Paid/Unpaid Verification

**Files:**
- Create: `tests/e2e/member-visa-support.spec.ts`

- [ ] **Step 1: Add a Playwright test for save + download**

Create `tests/e2e/member-visa-support.spec.ts` with:

```ts
import { expect, test } from '@playwright/test';

test('member can save visa details and download a visa support letter', async ({ page }) => {
  await page.goto('/me');
  await expect(page.getByRole('button', { name: /sign out|登出/i })).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /visa support documents|簽證輔助文件/i }).click();

  await page.getByLabel(/legal name|護照英文姓名/i).fill('KAI HSU');
  await page.getByLabel(/nationality|國籍/i).fill('Taiwan');
  await page.getByLabel(/date of birth|出生日期/i).fill('1990-01-01');
  await page.getByLabel(/passport number|護照號碼/i).fill('A12345678');
  await page.getByLabel(/passport issuing country|護照核發國家/i).fill('Taiwan');
  await page.getByLabel(/passport expiry date|護照到期日/i).fill('2027-12-31');
  await page.getByLabel(/planned arrival date|預計入境日/i).fill('2026-05-01');
  await page.getByLabel(/planned departure date|預計離境日/i).fill('2026-05-31');
  await page.getByLabel(/address in taiwan|在台停留地址/i).fill('Taitung City, Taiwan');
  await page.getByLabel(/ROC mission|申請館處/i).fill('Taipei Economic and Cultural Office in Los Angeles');

  await page.getByRole('button', { name: /save details|儲存資料/i }).click();
  await expect(page.getByText(/details saved|資料已儲存/i)).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /download visa support letter|下載簽證邀請函/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('tdf-visa-support-letter-TDF-VISA-2026-');
});
```

- [ ] **Step 2: Ensure an unpaid dev-login user exists**

Run this SQL against the dev database:

```sql
INSERT INTO users (email)
VALUES ('test@localhost')
ON CONFLICT (email) DO NOTHING;

INSERT INTO members (email)
VALUES ('test@localhost')
ON CONFLICT (email) DO NOTHING;
```

Expected: `test@localhost` can authenticate through the existing `/api/auth/dev-signin` route and has no paid orders.

- [ ] **Step 3: Ensure the default E2E account has one paid order for the paid-path verification**

First check:

```sql
SELECT id, stripe_session_id, customer_email, status, ticket_tier, valid_from, valid_until
FROM orders
WHERE customer_email = 'kk@dna.org.tw'
  AND status = 'paid'
ORDER BY created_at DESC
LIMIT 5;
```

If zero rows return, insert a local fixture order:

```sql
INSERT INTO orders (
  stripe_session_id,
  ticket_tier,
  status,
  amount_subtotal,
  amount_total,
  amount_tax,
  amount_discount,
  currency,
  customer_email,
  customer_name,
  source,
  valid_from,
  valid_until
)
VALUES (
  'local_visa_test_kk',
  'explore',
  'paid',
  2500,
  2500,
  0,
  0,
  'usd',
  'kk@dna.org.tw',
  'Kai Hsu',
  'stripe_invoice_offline',
  '2026-05-01',
  '2026-05-31'
)
ON CONFLICT (stripe_session_id) DO NOTHING;
```

- [ ] **Step 4: Run lint, build, and the Playwright flow for the paid account**

Run:
```bash
npm run lint
npm run build
npm run e2e -- tests/e2e/member-visa-support.spec.ts
```
Expected: all three commands pass for `kk@dna.org.tw`, and the Playwright test downloads a PDF.

- [ ] **Step 5: Run the same Playwright flow for the unpaid account**

Run:
```bash
E2E_EMAIL=test@localhost npm run e2e -- tests/e2e/member-visa-support.spec.ts
```
Expected: the same UI flow succeeds, but the generated PDF omits the `Verified Festival Purchase Details` section.

- [ ] **Step 6: Verify paid vs unpaid issuance rows and rate limit behavior**

After one run for each account, inspect the audit table:

```sql
SELECT v.document_no, m.email, v.has_paid_order, v.pdf_checksum, v.issued_at
FROM visa_letter_issuances v
JOIN members m ON m.id = v.member_id
WHERE m.email IN ('kk@dna.org.tw', 'test@localhost')
ORDER BY v.issued_at DESC
LIMIT 10;
```

Expected:
- `kk@dna.org.tw` rows show `has_paid_order = true`
- `test@localhost` rows show `has_paid_order = false`
- all successful rows have a non-null `pdf_checksum`

Then verify rate limiting from a dev session:

```bash
node <<'NODE'
const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3100';
const secret = process.env.DEV_SIGNIN_SECRET;
async function main() {
  const signin = await fetch(`${base}/api/auth/dev-signin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-dev-signin-secret': secret ?? '',
    },
    body: JSON.stringify({ email: 'kk@dna.org.tw' }),
  });
  const cookie = signin.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error('No auth cookie returned');

  for (let i = 1; i <= 6; i += 1) {
    const res = await fetch(`${base}/api/member/visa-letter`, {
      method: 'POST',
      headers: { cookie },
    });
    console.log(i, res.status);
  }
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
NODE
```

Expected: requests 1–5 return `200`, request 6 returns `429`.

- [ ] **Step 7: Commit**

```bash
git add tests/e2e/member-visa-support.spec.ts
git commit -m "test(member): cover visa support save and download flow"
```

---

## Self-Review Checklist

- Spec coverage: Tasks 1–7 cover dependency/assets, schema, helpers, PDF generation, API, UI/i18n, and paid/unpaid/rate-limit verification.
- Placeholder scan: no `TODO`, `TBD`, or `<timestamp>` placeholders remain; migration file names are concrete and lexically ordered after the existing schema files.
- Type consistency: the plan consistently uses `MemberVisaProfileInput`, `PaidOrderSnapshot`, `visaSupport`, `member_visa_profiles`, and `visa_letter_issuances`.
