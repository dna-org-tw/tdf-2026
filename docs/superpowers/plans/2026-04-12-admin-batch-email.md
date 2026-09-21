# Admin Batch Email Notification System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin dashboard at `/admin` where `@dna.org.tw` team members can send batch notification emails to paid members and/or newsletter subscribers, with filtering by ticket tier and full send history.

**Architecture:** Next.js App Router pages (`/admin`, `/admin/send`) protected by domain-based auth check. Three API routes (`/api/admin/recipients`, `/api/admin/send`, `/api/admin/history`) use the existing Supabase server client and Mailgun SDK. A new `notification_logs` table tracks each batch send.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Supabase (server-side), Mailgun batch sending, existing JWT auth system.

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/create_notification_logs_table.sql` | DB migration for notification_logs table |
| Create | `lib/adminAuth.ts` | Admin auth helper — verifies session + domain check |
| Create | `lib/recipients.ts` | Query logic for fetching deduplicated recipient emails |
| Create | `lib/notificationEmail.ts` | Mailgun batch send + brand HTML template for notifications |
| Create | `app/api/admin/recipients/route.ts` | GET endpoint — returns recipient count and emails |
| Create | `app/api/admin/send/route.ts` | POST endpoint — batch send via Mailgun, log to DB |
| Create | `app/api/admin/history/route.ts` | GET endpoint — returns notification_logs list |
| Create | `app/admin/page.tsx` | Admin dashboard — send history list |
| Create | `app/admin/send/page.tsx` | Compose & send notification page |
| Create | `app/admin/layout.tsx` | Admin layout — auth gate + nav wrapper |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/create_notification_logs_table.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Create notification_logs table for tracking batch email sends
CREATE TABLE notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  recipient_groups JSONB NOT NULL,
  recipient_tiers JSONB,
  recipient_count INTEGER NOT NULL,
  sent_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_logs_created_at ON notification_logs (created_at DESC);
CREATE INDEX idx_notification_logs_sent_by ON notification_logs (sent_by);

-- Enable RLS (service role bypasses it, consistent with other tables)
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs FORCE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Apply the migration**

Run the migration via Supabase MCP tool `apply_migration`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/create_notification_logs_table.sql
git commit -m "feat(admin): add notification_logs table migration"
```

---

## Task 2: Admin Auth Helper

**Files:**
- Create: `lib/adminAuth.ts`

- [ ] **Step 1: Create the admin auth helper**

This module provides a single function that API routes and the admin layout call to verify the request comes from a logged-in `@dna.org.tw` user. It reuses `getSessionFromRequest` from `lib/auth.ts`.

```typescript
// lib/adminAuth.ts
import { NextRequest } from 'next/server';
import { getSessionFromRequest, type SessionPayload } from '@/lib/auth';

const ADMIN_EMAIL_DOMAIN = process.env.ADMIN_EMAIL_DOMAIN || 'dna.org.tw';

export function isAdminEmail(email: string): boolean {
  return email.endsWith(`@${ADMIN_EMAIL_DOMAIN}`);
}

export async function getAdminSession(req: NextRequest): Promise<SessionPayload | null> {
  const session = await getSessionFromRequest(req);
  if (!session) return null;
  if (!isAdminEmail(session.email)) return null;
  return session;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/adminAuth.ts
git commit -m "feat(admin): add admin auth helper with domain check"
```

---

## Task 3: Recipient Query Logic

**Files:**
- Create: `lib/recipients.ts`

- [ ] **Step 1: Create the recipients module**

This module queries `orders` (status='paid') and `newsletter_subscriptions` tables and returns deduplicated emails. It accepts group and tier filters.

```typescript
// lib/recipients.ts
import { supabaseServer } from '@/lib/supabaseServer';

export type RecipientGroup = 'orders' | 'subscribers';
export type TicketTier = 'explore' | 'contribute' | 'weekly_backer' | 'backer';

interface RecipientsResult {
  emails: string[];
  count: number;
}

export async function getRecipients(
  groups: RecipientGroup[],
  tiers?: TicketTier[]
): Promise<RecipientsResult> {
  if (!supabaseServer) {
    throw new Error('Supabase not configured');
  }

  const emailSet = new Set<string>();

  if (groups.includes('orders')) {
    let query = supabaseServer
      .from('orders')
      .select('customer_email')
      .eq('status', 'paid')
      .not('customer_email', 'is', null);

    if (tiers && tiers.length > 0) {
      query = query.in('ticket_tier', tiers);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[Recipients] Error fetching orders:', error);
      throw new Error('Failed to fetch paid members');
    }
    for (const row of data || []) {
      if (row.customer_email) {
        emailSet.add(row.customer_email.trim().toLowerCase());
      }
    }
  }

  if (groups.includes('subscribers')) {
    const { data, error } = await supabaseServer
      .from('newsletter_subscriptions')
      .select('email');

    if (error) {
      console.error('[Recipients] Error fetching subscribers:', error);
      throw new Error('Failed to fetch subscribers');
    }
    for (const row of data || []) {
      if (row.email) {
        emailSet.add(row.email.trim().toLowerCase());
      }
    }
  }

  const emails = Array.from(emailSet);
  return { emails, count: emails.length };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/recipients.ts
git commit -m "feat(admin): add recipient query logic with group/tier filters"
```

---

## Task 4: Notification Email Template & Batch Send

**Files:**
- Create: `lib/notificationEmail.ts`

- [ ] **Step 1: Create the notification email module**

This module builds the branded HTML template from plain text and sends via Mailgun batch API (up to 1,000 recipients per call).

```typescript
// lib/notificationEmail.ts
import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { supabaseServer } from '@/lib/supabaseServer';

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const fromEmail = process.env.EMAIL_FROM || `noreply@${mailgunDomain || 'example.com'}`;

const mailgunClient = mailgunApiKey && mailgunDomain
  ? new Mailgun(formData).client({ username: 'api', key: mailgunApiKey })
  : null;

const BATCH_SIZE = 1000;

function buildHtml(body: string, subject: string): string {
  const bodyHtml = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #1E1F1C; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="color: #10B8D9; margin: 0; font-size: 24px;">Taiwan Digital Fest 2026</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
    <h2 style="color: #10B8D9; margin-top: 0;">${subject}</h2>
    <div style="color: #333; font-size: 16px;">${bodyHtml}</div>
    <p style="color: #666; font-size: 14px; margin-top: 30px;">
      Best regards,<br>
      Taiwan Digital Fest 2026 Team
    </p>
  </div>
  <div style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
    <p>This is an automated email from Taiwan Digital Fest 2026.</p>
  </div>
</body>
</html>`;
}

function buildPlainText(body: string): string {
  return `Taiwan Digital Fest 2026\n\n${body}\n\nBest regards,\nTaiwan Digital Fest 2026 Team`;
}

interface BatchSendResult {
  success: boolean;
  totalSent: number;
  error?: string;
}

export async function sendBatchNotification(
  emails: string[],
  subject: string,
  body: string,
  notificationId: string
): Promise<BatchSendResult> {
  if (!mailgunClient || !mailgunDomain) {
    return { success: false, totalSent: 0, error: 'Mailgun not configured' };
  }

  const html = buildHtml(body, subject);
  const text = buildPlainText(body);
  let totalSent = 0;

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);

    try {
      await mailgunClient.messages.create(mailgunDomain, {
        from: fromEmail,
        to: batch,
        subject,
        html,
        text,
      });
      totalSent += batch.length;
    } catch (error) {
      console.error(`[NotificationEmail] Batch ${i / BATCH_SIZE + 1} failed:`, error);

      // Update notification_logs with partial failure
      if (supabaseServer) {
        await supabaseServer
          .from('notification_logs')
          .update({
            status: 'partial_failure',
            error_message: error instanceof Error ? error.message : String(error),
          })
          .eq('id', notificationId);
      }

      return {
        success: false,
        totalSent,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return { success: true, totalSent };
}

export { buildHtml as buildNotificationHtml };
```

- [ ] **Step 2: Commit**

```bash
git add lib/notificationEmail.ts
git commit -m "feat(admin): add notification email template and batch send via Mailgun"
```

---

## Task 5: Recipients API Route

**Files:**
- Create: `app/api/admin/recipients/route.ts`

- [ ] **Step 1: Create the recipients endpoint**

```typescript
// app/api/admin/recipients/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { getRecipients, type RecipientGroup, type TicketTier } from '@/lib/recipients';

const VALID_GROUPS: RecipientGroup[] = ['orders', 'subscribers'];
const VALID_TIERS: TicketTier[] = ['explore', 'contribute', 'weekly_backer', 'backer'];

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const groupsParam = searchParams.get('groups');
  const tiersParam = searchParams.get('tiers');

  if (!groupsParam) {
    return NextResponse.json({ error: 'groups parameter is required' }, { status: 400 });
  }

  const groups = groupsParam.split(',').filter((g): g is RecipientGroup =>
    VALID_GROUPS.includes(g as RecipientGroup)
  );

  if (groups.length === 0) {
    return NextResponse.json({ error: 'At least one valid group is required' }, { status: 400 });
  }

  const tiers = tiersParam
    ? tiersParam.split(',').filter((t): t is TicketTier =>
        VALID_TIERS.includes(t as TicketTier)
      )
    : undefined;

  try {
    const result = await getRecipients(groups, tiers);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Admin Recipients]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch recipients' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/recipients/route.ts
git commit -m "feat(admin): add GET /api/admin/recipients endpoint"
```

---

## Task 6: Send API Route

**Files:**
- Create: `app/api/admin/send/route.ts`

- [ ] **Step 1: Create the send endpoint**

```typescript
// app/api/admin/send/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { getRecipients, type RecipientGroup, type TicketTier } from '@/lib/recipients';
import { sendBatchNotification } from '@/lib/notificationEmail';
import { supabaseServer } from '@/lib/supabaseServer';
import { checkRateLimit } from '@/lib/rateLimit';

const VALID_GROUPS: RecipientGroup[] = ['orders', 'subscribers'];
const VALID_TIERS: TicketTier[] = ['explore', 'contribute', 'weekly_backer', 'backer'];

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit: 1 batch send per minute per admin
  const rateKey = `admin-send:${session.email}`;
  const limit = checkRateLimit(rateKey, { limit: 1, windowSeconds: 60 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: '請等待一分鐘後再發送' },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body?.subject?.trim() || !body?.body?.trim() || !body?.groups) {
    return NextResponse.json(
      { error: '主旨、內容和收件群組為必填' },
      { status: 400 }
    );
  }

  const subject = body.subject.trim();
  const emailBody = body.body.trim();
  const groups = (body.groups as string[]).filter((g): g is RecipientGroup =>
    VALID_GROUPS.includes(g as RecipientGroup)
  );

  if (groups.length === 0) {
    return NextResponse.json({ error: '請至少選擇一個收件群組' }, { status: 400 });
  }

  const tiers = body.tiers
    ? (body.tiers as string[]).filter((t): t is TicketTier =>
        VALID_TIERS.includes(t as TicketTier)
      )
    : undefined;

  try {
    // Fetch recipients
    const { emails, count } = await getRecipients(groups, tiers);

    if (count === 0) {
      return NextResponse.json({ error: '沒有符合條件的收件人' }, { status: 400 });
    }

    if (!supabaseServer) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Create notification log entry
    const { data: logEntry, error: logError } = await supabaseServer
      .from('notification_logs')
      .insert({
        subject,
        body: emailBody,
        recipient_groups: groups,
        recipient_tiers: tiers || null,
        recipient_count: count,
        sent_by: session.email,
        status: 'sending',
      })
      .select()
      .single();

    if (logError || !logEntry) {
      console.error('[Admin Send] Failed to create log:', logError);
      return NextResponse.json({ error: 'Failed to create send record' }, { status: 500 });
    }

    // Send batch emails
    const result = await sendBatchNotification(emails, subject, emailBody, logEntry.id);

    // Update log status
    await supabaseServer
      .from('notification_logs')
      .update({
        status: result.success ? 'sent' : 'partial_failure',
        error_message: result.error || null,
      })
      .eq('id', logEntry.id);

    return NextResponse.json({
      success: result.success,
      recipientCount: result.totalSent,
      notificationId: logEntry.id,
    });
  } catch (error) {
    console.error('[Admin Send]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/send/route.ts
git commit -m "feat(admin): add POST /api/admin/send endpoint with batch Mailgun sending"
```

---

## Task 7: History API Route

**Files:**
- Create: `app/api/admin/history/route.ts`

- [ ] **Step 1: Create the history endpoint**

```typescript
// app/api/admin/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    const { data, error } = await supabaseServer
      .from('notification_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[Admin History]', error);
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }

    return NextResponse.json({ notifications: data });
  } catch (error) {
    console.error('[Admin History]', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/history/route.ts
git commit -m "feat(admin): add GET /api/admin/history endpoint"
```

---

## Task 8: Admin Layout (Auth Gate)

**Files:**
- Create: `app/admin/layout.tsx`

- [ ] **Step 1: Create the admin layout**

This layout wraps all `/admin/*` pages. It checks auth state client-side: if the user is not logged in, it shows the login form (reusing the member page pattern). If logged in but not `@dna.org.tw`, it shows an access denied message.

```typescript
// app/admin/layout.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

function AdminNav() {
  const { user, signOut } = useAuth();

  return (
    <nav className="bg-[#1E1F1C] text-white px-6 py-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="text-[#10B8D9] font-bold text-lg">
            TDF 2026 Admin
          </Link>
          <Link href="/admin/send" className="text-sm text-slate-300 hover:text-white transition-colors">
            發送通知
          </Link>
          <Link href="/admin" className="text-sm text-slate-300 hover:text-white transition-colors">
            發送紀錄
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400">{user?.email}</span>
          <button
            onClick={signOut}
            className="text-sm text-slate-400 hover:text-red-400 transition-colors"
          >
            登出
          </button>
        </div>
      </div>
    </nav>
  );
}

function LoginForm() {
  const { refreshSession } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '發送失敗');
      }
      setStep('code');
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '發送失敗');
    } finally {
      setSending(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setVerifying(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });
      if (!res.ok) throw new Error('驗證碼無效');
      await refreshSession();
    } catch {
      setError('驗證碼無效或已過期');
    } finally {
      setVerifying(false);
    }
  };

  if (step === 'code') {
    return (
      <div className="w-full max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-2 text-center">輸入驗證碼</h1>
        <p className="text-slate-600 mb-6 text-center text-sm">驗證碼已發送至 {email}</p>
        <form onSubmit={handleVerifyCode} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B8D9] text-slate-900 text-center text-2xl tracking-[0.3em] font-mono"
          />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={verifying || code.length !== 6}
            className="w-full bg-[#10B8D9] hover:bg-[#0EA5C4] disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {verifying ? '驗證中...' : '驗證'}
          </button>
        </form>
        <button
          onClick={() => { setStep('email'); setError(''); setCode(''); }}
          className="mt-3 w-full text-sm text-slate-500 hover:underline text-center"
        >
          使用其他信箱
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-2 text-center">管理後台登入</h1>
      <p className="text-slate-600 mb-6 text-center text-sm">請使用 @dna.org.tw 信箱登入</p>
      <form onSubmit={handleSendCode} className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@dna.org.tw"
          required
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B8D9] text-slate-900"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={sending}
          className="w-full bg-[#10B8D9] hover:bg-[#0EA5C4] disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          {sending ? '發送中...' : '發送驗證碼'}
        </button>
      </form>
    </div>
  );
}

const ADMIN_EMAIL_DOMAIN = 'dna.org.tw';

function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="animate-spin w-8 h-8 border-3 border-[#10B8D9] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6">
        <LoginForm />
      </div>
    );
  }

  if (!user.email?.endsWith(`@${ADMIN_EMAIL_DOMAIN}`)) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">存取被拒絕</h1>
          <p className="text-slate-600 mb-4">此頁面僅限 @{ADMIN_EMAIL_DOMAIN} 帳號存取。</p>
          <p className="text-sm text-slate-400">目前登入帳號：{user.email}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <AdminNav />
      <main className="max-w-5xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-stone-50">
          <div className="animate-spin w-8 h-8 border-3 border-[#10B8D9] border-t-transparent rounded-full" />
        </div>
      }
    >
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/layout.tsx
git commit -m "feat(admin): add admin layout with auth gate and navigation"
```

---

## Task 9: Admin Dashboard Page (History)

**Files:**
- Create: `app/admin/page.tsx`

- [ ] **Step 1: Create the admin dashboard page**

```typescript
// app/admin/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface NotificationLog {
  id: string;
  subject: string;
  recipient_groups: string[];
  recipient_tiers: string[] | null;
  recipient_count: number;
  sent_by: string;
  status: string;
  created_at: string;
}

const GROUP_LABELS: Record<string, string> = {
  orders: '付費會員',
  subscribers: '電子報訂閱者',
};

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  sending: { label: '發送中', className: 'bg-yellow-100 text-yellow-700' },
  sent: { label: '已發送', className: 'bg-green-100 text-green-700' },
  partial_failure: { label: '部分失敗', className: 'bg-red-100 text-red-700' },
};

export default function AdminDashboard() {
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/history')
      .then((res) => res.json())
      .then((data) => setNotifications(data.notifications || []))
      .catch((err) => console.error('[Admin]', err))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Taipei',
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">發送紀錄</h1>
        <Link
          href="/admin/send"
          className="bg-[#10B8D9] hover:bg-[#0EA5C4] text-white font-semibold px-5 py-2.5 rounded-lg transition-colors"
        >
          發送新通知
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-sm animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
              <div className="h-3 bg-slate-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-xl p-8 shadow-sm text-center">
          <p className="text-slate-500">尚無發送紀錄</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const statusStyle = STATUS_STYLES[n.status] || { label: n.status, className: 'bg-slate-100 text-slate-600' };
            return (
              <div key={n.id} className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900 truncate">{n.subject}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusStyle.className}`}>
                        {statusStyle.label}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">
                      {n.recipient_groups.map((g) => GROUP_LABELS[g] || g).join('、')}
                      {n.recipient_tiers && n.recipient_tiers.length > 0 && (
                        <span className="ml-1">({n.recipient_tiers.join(', ')})</span>
                      )}
                      <span className="mx-2">·</span>
                      {n.recipient_count} 人
                      <span className="mx-2">·</span>
                      {n.sent_by}
                    </p>
                  </div>
                  <span className="text-sm text-slate-400 shrink-0">{formatDate(n.created_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat(admin): add admin dashboard with send history list"
```

---

## Task 10: Send Notification Page

**Files:**
- Create: `app/admin/send/page.tsx`

- [ ] **Step 1: Create the send notification page**

```typescript
// app/admin/send/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { buildNotificationHtml } from '@/lib/notificationEmail';

type RecipientGroup = 'orders' | 'subscribers';
type TicketTier = 'explore' | 'contribute' | 'weekly_backer' | 'backer';

const GROUP_OPTIONS: { value: RecipientGroup; label: string }[] = [
  { value: 'orders', label: '付費會員' },
  { value: 'subscribers', label: '電子報訂閱者' },
];

const TIER_OPTIONS: { value: TicketTier; label: string }[] = [
  { value: 'explore', label: 'Explore' },
  { value: 'contribute', label: 'Contribute' },
  { value: 'weekly_backer', label: 'Weekly Backer' },
  { value: 'backer', label: 'Backer' },
];

export default function SendNotificationPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<RecipientGroup[]>([]);
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Fetch recipient count when filters change
  const fetchCount = useCallback(async () => {
    if (groups.length === 0) {
      setRecipientCount(null);
      return;
    }
    setLoadingCount(true);
    try {
      const params = new URLSearchParams();
      params.set('groups', groups.join(','));
      if (groups.includes('orders') && tiers.length > 0) {
        params.set('tiers', tiers.join(','));
      }
      const res = await fetch(`/api/admin/recipients?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRecipientCount(data.count);
      }
    } catch {
      setRecipientCount(null);
    } finally {
      setLoadingCount(false);
    }
  }, [groups, tiers]);

  useEffect(() => {
    const timer = setTimeout(fetchCount, 300);
    return () => clearTimeout(timer);
  }, [fetchCount]);

  const toggleGroup = (group: RecipientGroup) => {
    setGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  };

  const toggleTier = (tier: TicketTier) => {
    setTiers((prev) =>
      prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier]
    );
  };

  const canSend = groups.length > 0 && subject.trim() && body.trim() && recipientCount && recipientCount > 0;

  const handleSend = async () => {
    setShowConfirm(false);
    setSending(true);
    setError('');

    try {
      const res = await fetch('/api/admin/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          body: body.trim(),
          groups,
          tiers: groups.includes('orders') ? tiers : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '發送失敗');
      }

      router.push('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : '發送失敗');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">發送通知信</h1>

      {/* Recipient Selection */}
      <section className="bg-white rounded-xl p-6 shadow-sm mb-4">
        <h2 className="font-semibold text-slate-900 mb-3">收件群組</h2>
        <div className="flex flex-wrap gap-3">
          {GROUP_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={groups.includes(opt.value)}
                onChange={() => toggleGroup(opt.value)}
                className="w-4 h-4 accent-[#10B8D9]"
              />
              <span className="text-sm text-slate-700">{opt.label}</span>
            </label>
          ))}
        </div>

        {groups.includes('orders') && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-slate-600 mb-2">票種篩選（不選則包含全部）</h3>
            <div className="flex flex-wrap gap-3">
              {TIER_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tiers.includes(opt.value)}
                    onChange={() => toggleTier(opt.value)}
                    className="w-4 h-4 accent-[#10B8D9]"
                  />
                  <span className="text-sm text-slate-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 text-sm text-slate-500">
          {loadingCount ? (
            '計算收件人數...'
          ) : recipientCount !== null ? (
            <span>共 <strong className="text-slate-900">{recipientCount}</strong> 位收件人</span>
          ) : (
            '請選擇收件群組'
          )}
        </div>
      </section>

      {/* Email Content */}
      <section className="bg-white rounded-xl p-6 shadow-sm mb-4">
        <h2 className="font-semibold text-slate-900 mb-3">信件內容</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">主旨</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="輸入信件主旨"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B8D9] text-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">內容（純文字）</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="輸入信件內容..."
              rows={10}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B8D9] text-slate-900 resize-y"
            />
          </div>
        </div>
      </section>

      {/* Preview */}
      {subject.trim() && body.trim() && (
        <section className="bg-white rounded-xl p-6 shadow-sm mb-4">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="text-sm font-medium text-[#10B8D9] hover:underline"
          >
            {showPreview ? '隱藏預覽' : '顯示信件預覽'}
          </button>
          {showPreview && (
            <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">
              <iframe
                srcDoc={buildNotificationHtml(body, subject)}
                title="Email preview"
                className="w-full h-[400px] border-0"
              />
            </div>
          )}
        </section>
      )}

      {/* Actions */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => setShowConfirm(true)}
          disabled={!canSend || sending}
          className="bg-[#10B8D9] hover:bg-[#0EA5C4] disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
        >
          {sending ? '發送中...' : '發送通知'}
        </button>
        <button
          onClick={() => router.push('/admin')}
          className="text-slate-500 hover:text-slate-700 font-medium px-6 py-2.5 transition-colors"
        >
          取消
        </button>
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-2">確認發送</h3>
            <p className="text-slate-600 mb-1">主旨：{subject}</p>
            <p className="text-slate-600 mb-4">
              將發送給 <strong>{recipientCount}</strong> 位收件人。此操作無法撤銷。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="text-slate-500 hover:text-slate-700 font-medium px-4 py-2 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSend}
                className="bg-[#10B8D9] hover:bg-[#0EA5C4] text-white font-semibold px-5 py-2 rounded-lg transition-colors"
              >
                確認發送
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Note:** The `buildNotificationHtml` import from `lib/notificationEmail.ts` won't work directly in a client component because it's a server module. We need to handle the preview differently — render the preview HTML inline in the client component instead.

- [ ] **Step 2: Replace the preview approach**

Instead of importing from the server module, duplicate the simple HTML builder inline in the page component. Replace the import line and the `srcDoc` usage:

Remove the import line `import { buildNotificationHtml } from '@/lib/notificationEmail';` and add a local function at the top of the component file:

```typescript
function buildPreviewHtml(body: string, subject: string): string {
  const bodyHtml = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #1E1F1C; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="color: #10B8D9; margin: 0; font-size: 24px;">Taiwan Digital Fest 2026</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
    <h2 style="color: #10B8D9; margin-top: 0;">${subject.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h2>
    <div style="color: #333; font-size: 16px;">${bodyHtml}</div>
    <p style="color: #666; font-size: 14px; margin-top: 30px;">Best regards,<br>Taiwan Digital Fest 2026 Team</p>
  </div>
  <div style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
    <p>This is an automated email from Taiwan Digital Fest 2026.</p>
  </div>
</body>
</html>`;
}
```

And in the iframe: `srcDoc={buildPreviewHtml(body, subject)}`.

- [ ] **Step 3: Commit**

```bash
git add app/admin/send/page.tsx
git commit -m "feat(admin): add send notification page with preview and confirmation"
```

---

## Task 11: Verify Build & Manual Test

- [ ] **Step 1: Run the build**

```bash
npm run build
```

Expected: No TypeScript errors, all pages compile successfully.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: No lint errors.

- [ ] **Step 3: Start dev server and test manually**

```bash
npm run dev
```

Test:
1. Navigate to `/admin` — should see login form
2. Enter a non-`@dna.org.tw` email, verify code, and confirm "access denied" appears
3. Log out, enter a `@dna.org.tw` email and verify — should see admin dashboard
4. Navigate to `/admin/send` — verify recipient selection, count fetching, email preview, and confirmation dialog all work
5. Send a test notification and verify it appears in `/admin` history

- [ ] **Step 4: Final commit**

Fix any issues found during testing and commit.
