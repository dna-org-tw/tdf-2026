# Stay Invite Code Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow an admin to email any `active` `stay_invite_codes` row to a specified address from `/admin/stay/invite-codes`, recording the most recent recipient on the row.

**Architecture:** Add three nullable columns to `stay_invite_codes` for recipient tracking. New `POST /api/admin/stay/invite-codes/[id]/send` route handles validation + Mailgun send (via a new `lib/stayInviteEmail.ts` helper that delegates to the existing `sendStayEmail` infrastructure). Admin page gains an inline per-row "寄送 / 重寄" form. Stay booking panel gains a one-line tweak to pre-fill the invite code from `?invite=` URL param.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (service role client), Mailgun (`mailgun.js`), Tailwind CSS 4. No new dependencies.

---

## File Structure

| Path | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/20260419_add_stay_invite_code_send_fields.sql` | create | Add `sent_to_email`, `sent_at`, `sent_by` columns |
| `lib/stayEmail.ts` | modify | Extend `StayEmailType` union with `'stay_invite_code'` |
| `lib/stayInviteEmail.ts` | create | Build bilingual email body + delegate to `sendStayEmail` |
| `app/api/admin/stay/invite-codes/[id]/send/route.ts` | create | Admin-gated send endpoint |
| `app/admin/stay/invite-codes/page.tsx` | modify | New "寄送" column + inline form per row |
| `components/stay/StayBookingPanel.tsx` | modify | Initialise `inviteCode` from `?invite=` |

---

## Task 1: Schema migration — add recipient tracking columns

**Files:**
- Create: `supabase/migrations/20260419_add_stay_invite_code_send_fields.sql`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/20260419_add_stay_invite_code_send_fields.sql` with:

```sql
ALTER TABLE stay_invite_codes
  ADD COLUMN sent_to_email TEXT,
  ADD COLUMN sent_at TIMESTAMPTZ,
  ADD COLUMN sent_by TEXT;
```

- [ ] **Step 2: Apply against the dev Supabase project**

Use the Supabase MCP `apply_migration` tool with name `add_stay_invite_code_send_fields` and the SQL above. (If MCP isn't available, paste the SQL into the Supabase SQL editor.)

Expected: migration applies without error.

- [ ] **Step 3: Verify columns exist**

Run via MCP `execute_sql`:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'stay_invite_codes'
  AND column_name IN ('sent_to_email', 'sent_at', 'sent_by')
ORDER BY column_name;
```

Expected: three rows, all `is_nullable = YES`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260419_add_stay_invite_code_send_fields.sql
git commit -m "feat(stay): add recipient tracking columns to stay_invite_codes"
```

---

## Task 2: Extend `StayEmailType` union

**Files:**
- Modify: `lib/stayEmail.ts:9-17`

- [ ] **Step 1: Add the new email type**

In `lib/stayEmail.ts`, edit the `StayEmailType` union to add `'stay_invite_code'`:

```ts
export type StayEmailType =
  | 'stay_booking_confirmed'
  | 'stay_booking_complimentary_confirmed'
  | 'stay_transfer_requested'
  | 'stay_transfer_accepted'
  | 'stay_waitlist_offer'
  | 'stay_waitlist_expired'
  | 'stay_modification_confirmed'
  | 'stay_no_show_charged'
  | 'stay_invite_code';
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/stayEmail.ts
git commit -m "feat(stay): add stay_invite_code email type"
```

---

## Task 3: Create `lib/stayInviteEmail.ts`

**Files:**
- Create: `lib/stayInviteEmail.ts`

- [ ] **Step 1: Write the helper**

Create `lib/stayInviteEmail.ts`:

```ts
import { sendStayEmail } from './stayEmail';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://2026.taiwandigitalfest.com';

export async function sendStayInviteEmail(input: { to: string; code: string }): Promise<void> {
  const { to, code } = input;
  const bookingUrl = `${SITE_URL}/stay?invite=${encodeURIComponent(code)}`;
  const subject = '[TDF 2026] Your Stay Booking Invite Code / 您的住宿預約邀請碼';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #1E1F1C; padding: 24px; border-radius: 8px; margin-bottom: 24px;">
    <h1 style="color: #10B8D9; margin: 0; font-size: 22px;">Taiwan Digital Fest 2026</h1>
  </div>

  <div style="background-color: #f9f9f9; padding: 28px; border-radius: 8px;">
    <h2 style="color: #1E1F1C; margin-top: 0; font-size: 18px;">您的住宿預約邀請碼</h2>
    <p>您好，</p>
    <p>感謝您支持 Taiwan Digital Fest 2026。以下是您的合作住宿預約邀請碼，請於預約時填入：</p>
    <p style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 18px; background:#fff; padding:12px 16px; border:1px solid #e5e7eb; border-radius:6px; display:inline-block; letter-spacing:1px;">${code}</p>
    <p style="margin-top: 24px;">
      <a href="${bookingUrl}" style="display: inline-block; background-color: #10B8D9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">立即預約 / Book Now</a>
    </p>
    <p style="color:#666; font-size: 13px;">若按鈕無法使用，請複製以下連結：<br><span style="word-break:break-all;">${bookingUrl}</span></p>

    <hr style="border:none; border-top:1px solid #e5e7eb; margin: 28px 0;">

    <h2 style="color: #1E1F1C; margin-top: 0; font-size: 18px;">Your Stay Booking Invite Code</h2>
    <p>Hi,</p>
    <p>Thanks for supporting Taiwan Digital Fest 2026. Below is your invite code for the partner stay booking. Enter it during checkout:</p>
    <p style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 18px; background:#fff; padding:12px 16px; border:1px solid #e5e7eb; border-radius:6px; display:inline-block; letter-spacing:1px;">${code}</p>
    <p style="margin-top: 24px;">
      <a href="${bookingUrl}" style="display: inline-block; background-color: #10B8D9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Book Now</a>
    </p>
    <p style="color:#666; font-size: 13px;">If the button doesn't work, copy this link:<br><span style="word-break:break-all;">${bookingUrl}</span></p>

    <p style="color:#666; font-size: 13px; margin-top: 24px;">Taiwan Digital Fest 2026 Team</p>
  </div>
</body>
</html>
`.trim();

  const text = `Taiwan Digital Fest 2026

【中文】
您好，

感謝您支持 Taiwan Digital Fest 2026。以下是您的合作住宿預約邀請碼：

  ${code}

請於預約時填入此邀請碼，或直接點擊下方連結（連結中已帶入邀請碼）：
${bookingUrl}

------------------------------------------------------------

[English]
Hi,

Thanks for supporting Taiwan Digital Fest 2026. Below is your invite code for the partner stay booking:

  ${code}

Enter the code during checkout, or open the link below (the code is already pre-filled):
${bookingUrl}

— Taiwan Digital Fest 2026 Team
`;

  await sendStayEmail({ to, subject, html, text, emailType: 'stay_invite_code' });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/stayInviteEmail.ts
git commit -m "feat(stay): add bilingual invite-code email helper"
```

---

## Task 4: Create the admin send API route

**Files:**
- Create: `app/api/admin/stay/invite-codes/[id]/send/route.ts`

- [ ] **Step 1: Write the route**

Create `app/api/admin/stay/invite-codes/[id]/send/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { sendStayInviteEmail } from '@/lib/stayInviteEmail';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const { id } = await params;

  let email: string;
  try {
    const body = await req.json();
    email = String(body?.email ?? '').trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  const { data: row, error: loadErr } = await supabaseServer
    .from('stay_invite_codes')
    .select('id, code, status')
    .eq('id', id)
    .maybeSingle();
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (row.status !== 'active') return NextResponse.json({ error: 'not_active' }, { status: 409 });

  try {
    await sendStayInviteEmail({ to: email, code: row.code });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'send_failed';
    if (message === 'mailgun_not_configured') {
      return NextResponse.json({ error: 'mailgun_not_configured' }, { status: 500 });
    }
    return NextResponse.json({ error: 'send_failed', detail: message }, { status: 502 });
  }

  const { data: updated, error: updateErr } = await supabaseServer
    .from('stay_invite_codes')
    .update({
      sent_to_email: email,
      sent_at: new Date().toISOString(),
      sent_by: session.email,
    })
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (updateErr) {
    return NextResponse.json(
      { error: 'persisted_send_failed', detail: updateErr.message, sent: true },
      { status: 500 },
    );
  }

  return NextResponse.json({ code: updated });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify ESLint passes**

Run: `npm run lint`
Expected: no errors for the new file.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/stay/invite-codes/[id]/send/route.ts
git commit -m "feat(stay): admin endpoint to email an invite code"
```

---

## Task 5: Stay booking panel — read `?invite=` from URL

**Files:**
- Modify: `components/stay/StayBookingPanel.tsx:1-12`

- [ ] **Step 1: Add `useSearchParams` import and lazy initial state**

In `components/stay/StayBookingPanel.tsx`, change the imports and the `inviteCode` state initialiser:

Before (lines 1-3):

```tsx
'use client';

import { useState } from 'react';
```

After:

```tsx
'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
```

Then change the `inviteCode` state line (currently at line 11):

Before:

```tsx
  const [inviteCode, setInviteCode] = useState('');
```

After:

```tsx
  const searchParams = useSearchParams();
  const [inviteCode, setInviteCode] = useState(() => searchParams.get('invite') ?? '');
```

The `searchParams` line must come after the `weekCodes` etc. is fine — place it directly above `inviteCode`. No other changes.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/stay/StayBookingPanel.tsx
git commit -m "feat(stay): pre-fill invite code from ?invite= URL param"
```

---

## Task 6: Admin UI — add "寄送 / 重寄" column with inline form

**Files:**
- Modify: `app/admin/stay/invite-codes/page.tsx`

- [ ] **Step 1: Replace the file with the updated component**

Replace the entire contents of `app/admin/stay/invite-codes/page.tsx` with:

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface InviteCode {
  id: string;
  code: string;
  status: string;
  batch_label: string | null;
  used_by_member_id: number | null;
  created_at: string;
  sent_to_email: string | null;
  sent_at: string | null;
  sent_by: string | null;
}

export default function StayInviteCodesPage() {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [count, setCount] = useState(10);
  const [prefix, setPrefix] = useState('STAY');
  const [batchLabel, setBatchLabel] = useState('');

  const [openSendId, setOpenSendId] = useState<string | null>(null);
  const [sendEmail, setSendEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/stay/invite-codes/batch')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setCodes(data.codes ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'load_failed'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/stay/invite-codes/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count,
          prefix,
          batchLabel: batchLabel.trim() || null,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'failed');
      setMessage(`已產生 ${payload.codes?.length ?? 0} 組邀請碼`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'generate_failed');
    } finally {
      setGenerating(false);
    }
  }

  function openSend(row: InviteCode) {
    setOpenSendId(row.id);
    setSendEmail(row.sent_to_email ?? '');
    setRowError(null);
  }

  function cancelSend() {
    setOpenSendId(null);
    setSendEmail('');
    setRowError(null);
  }

  async function submitSend(rowId: string) {
    setSending(true);
    setRowError(null);
    try {
      const res = await fetch(`/api/admin/stay/invite-codes/${rowId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sendEmail.trim() }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'send_failed');
      setMessage(`已寄出邀請碼至 ${sendEmail.trim()}`);
      setOpenSendId(null);
      setSendEmail('');
      load();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'send_failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">邀請碼管理</h1>
        <Link href="/admin/stay" className="text-sm text-slate-500 hover:text-cyan-600">
          ← 回總覽
        </Link>
      </div>

      <form onSubmit={generate} className="bg-white rounded-xl p-5 shadow-sm space-y-3">
        <h2 className="font-semibold text-slate-900">批次產生</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="block text-sm">
            <span className="text-slate-600">數量 (1-1000)</span>
            <input
              type="number"
              min={1}
              max={1000}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">前綴 (最多 16 字元)</span>
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">批次標籤 (選填)</span>
            <input
              type="text"
              value={batchLabel}
              onChange={(e) => setBatchLabel(e.target.value)}
              placeholder="e.g. partner-acme"
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={generating}
          className="px-3 py-2 text-sm bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          {generating ? '產生中...' : '產生邀請碼'}
        </button>
        {message && <p className="text-sm text-green-600">{message}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">已存在邀請碼</h2>
          <span className="text-xs text-slate-500">共 {codes.length} 組</span>
        </div>
        {loading ? (
          <p className="p-5 text-sm text-slate-500">載入中...</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="py-2 px-3 text-left">Code</th>
                <th className="py-2 px-3 text-left">狀態</th>
                <th className="py-2 px-3 text-left">批次</th>
                <th className="py-2 px-3 text-left">使用者</th>
                <th className="py-2 px-3 text-left">建立時間</th>
                <th className="py-2 px-3 text-left">寄送</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id} className="border-t border-slate-100 align-top">
                  <td className="py-2 px-3 font-mono text-slate-800">{c.code}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        c.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : c.status === 'used'
                          ? 'bg-slate-100 text-slate-700'
                          : c.status === 'reserved'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-700">{c.batch_label ?? '—'}</td>
                  <td className="py-2 px-3 text-slate-700">
                    {c.used_by_member_id ? `#${c.used_by_member_id}` : '—'}
                  </td>
                  <td className="py-2 px-3 text-slate-600 tabular-nums">
                    {new Date(c.created_at).toLocaleString()}
                  </td>
                  <td className="py-2 px-3">
                    {c.status !== 'active' ? (
                      <span className="text-slate-400">—</span>
                    ) : openSendId === c.id ? (
                      <div className="space-y-1">
                        <input
                          type="email"
                          value={sendEmail}
                          onChange={(e) => setSendEmail(e.target.value)}
                          placeholder="recipient@example.com"
                          className="w-56 px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900 text-xs"
                          disabled={sending}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => submitSend(c.id)}
                            disabled={sending || !sendEmail.trim()}
                            className="px-2 py-1 text-xs bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white rounded"
                          >
                            {sending ? '寄送中...' : '送出'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelSend}
                            disabled={sending}
                            className="px-2 py-1 text-xs border border-slate-300 text-slate-600 hover:bg-slate-50 rounded"
                          >
                            取消
                          </button>
                        </div>
                        {rowError && <p className="text-xs text-red-600">{rowError}</p>}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {c.sent_to_email && c.sent_at && (
                          <p className="text-xs text-slate-500">
                            已寄至 {c.sent_to_email} · {new Date(c.sent_at).toLocaleString()}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => openSend(c)}
                          className="px-2 py-1 text-xs bg-white border border-cyan-500 text-cyan-700 hover:bg-cyan-50 rounded"
                        >
                          {c.sent_to_email ? '重寄' : '寄送'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {codes.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-sm">
                    尚無邀請碼
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify ESLint passes**

Run: `npm run lint`
Expected: no errors for the modified file.

- [ ] **Step 4: Commit**

```bash
git add app/admin/stay/invite-codes/page.tsx
git commit -m "feat(stay): admin UI to send invite code to a recipient email"
```

---

## Task 7: Manual end-to-end smoke test

**Files:** none

- [ ] **Step 1: Confirm Mailgun env is set**

Verify `.env.local` contains `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `EMAIL_FROM`, and `NEXT_PUBLIC_SITE_URL`.

If unset, add temporarily — without these the helper throws `mailgun_not_configured` and the route returns 500.

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`
Expected: server starts on port 3000.

- [ ] **Step 3: Open `/admin/stay/invite-codes` in your browser**

Sign in with `kk@dna.org.tw` (the only allowed test account). You should see the existing list.

- [ ] **Step 4: Send an invite code to yourself**

Pick any `active` row (or generate a new one), click `寄送`, enter `kk@dna.org.tw`, click `送出`.

Expected:
- Top of page shows `已寄出邀請碼至 kk@dna.org.tw`.
- The row's send column now shows `已寄至 kk@dna.org.tw · <timestamp>` and a `重寄` button.
- Inbox receives a bilingual email with the code and a `Book Now` link to `https://<site>/stay?invite=<code>`.

- [ ] **Step 5: Verify the invite-pre-fill on `/stay`**

Click the `Book Now` link in the email. The Stay booking panel's invite-code input should be pre-filled with the code.

- [ ] **Step 6: Verify DB row was updated**

Via Supabase MCP `execute_sql`:

```sql
SELECT id, code, sent_to_email, sent_at, sent_by
FROM stay_invite_codes
WHERE id = '<row id>';
```

Expected: `sent_to_email` matches the recipient, `sent_at` is recent, `sent_by` is `kk@dna.org.tw`.

- [ ] **Step 7: Test re-send overwrites**

In the UI, click `重寄` on the same row, enter a different email (e.g. `kk+test@dna.org.tw` if Mailgun accepts it, otherwise just resend to `kk@dna.org.tw`), submit.

Expected: row updates with the new recipient + timestamp; previous values are overwritten.

- [ ] **Step 8: Test invalid email rejection**

Click `寄送` on another `active` row, enter `not-an-email`, submit.

Expected: red `invalid_email` text appears under the form; no email is sent; row stays unchanged.

- [ ] **Step 9: Test that non-active rows hide the button**

If you have a `used` or `reserved` row, confirm its 寄送 column shows `—` and no button.

If no such row exists, mark this step done — the conditional is straightforward and covered by the type check.

---

## Self-review notes

- All three new columns from the spec (`sent_to_email`, `sent_at`, `sent_by`) appear in: Task 1 migration, Task 4 update statement, Task 6 `InviteCode` interface and UI render. ✓
- All six "Files touched" entries from the spec map to a task: Task 1 (migration), Task 2 (stayEmail.ts), Task 3 (stayInviteEmail.ts), Task 4 (route), Task 5 (StayBookingPanel), Task 6 (admin page). ✓
- Error responses (400 invalid_email, 404 not_found, 409 not_active, 500 mailgun_not_configured, 502 send_failed) match the spec table. ✓
- Bilingual email body and `?invite=` URL param wiring covered. ✓
- No placeholders, no "TBD", no "similar to Task N". ✓
