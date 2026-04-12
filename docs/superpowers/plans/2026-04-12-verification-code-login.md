# Verification Code Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace magic link login with 6-digit verification code so users enter a code on-site instead of clicking an email link.

**Architecture:** Reuse existing `auth_tokens` table, `lib/auth.ts` JWT/session logic, and `AuthContext`. Add two new API routes (send-code, verify-code) and update the member page login form to a two-step flow (email → code input). Enable the Navbar auth links.

**Tech Stack:** Next.js API Routes, Supabase (auth_tokens table), Mailgun (email), jose (JWT)

---

### Task 1: Create `/api/auth/send-code` API Route

**Files:**
- Create: `app/api/auth/send-code/route.ts`

- [ ] **Step 1: Create the send-code route**

This route generates a 6-digit numeric code, hashes it with SHA-256, stores in `auth_tokens`, and sends via Mailgun. Reuses rate limiting from the existing magic-link route.

```typescript
// app/api/auth/send-code/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { logEmail } from '@/lib/emailLog';
import { checkRateLimit } from '@/lib/rateLimit';
import { createHash, randomInt } from 'crypto';
import formData from 'form-data';
import Mailgun from 'mailgun.js';

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const fromEmail = process.env.EMAIL_FROM || `noreply@${mailgunDomain || 'example.com'}`;

const CODE_EXPIRY_MINUTES = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const mailgunClient = mailgunApiKey && mailgunDomain
  ? new Mailgun(formData).client({ username: 'api', key: mailgunApiKey })
  : null;

function generateCode(): string {
  return String(randomInt(100000, 999999));
}

export async function POST(req: NextRequest) {
  try {
    if (!supabaseServer) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }
    if (!mailgunClient || !mailgunDomain) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const ipLimit = checkRateLimit(`send-code:ip:${ip}`, { limit: 5, windowSeconds: 15 * 60 });
    if (!ipLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    if (!body?.email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const email = body.email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const emailLimit = checkRateLimit(`send-code:email:${email}`, { limit: 3, windowSeconds: 15 * 60 });
    if (!emailLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests for this email' }, { status: 429 });
    }

    // Upsert user
    const { error: userError } = await supabaseServer
      .from('users')
      .upsert({ email }, { onConflict: 'email', ignoreDuplicates: true });
    if (userError) {
      console.error('[Auth] Failed to upsert user:', userError);
      return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
    }

    // Invalidate previous unused tokens for this email
    await supabaseServer
      .from('auth_tokens')
      .update({ used: true })
      .eq('email', email)
      .eq('used', false);

    // Clean up old tokens (fire and forget)
    const cleanupThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    supabaseServer
      .from('auth_tokens')
      .delete()
      .eq('used', true)
      .lt('created_at', cleanupThreshold)
      .then(({ error }) => {
        if (error) console.error('[Auth] Token cleanup error:', error);
      });

    // Generate 6-digit code
    const code = generateCode();
    const tokenHash = createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();

    const { error: tokenError } = await supabaseServer
      .from('auth_tokens')
      .insert({ email, token_hash: tokenHash, expires_at: expiresAt });
    if (tokenError) {
      console.error('[Auth] Failed to store token:', tokenError);
      return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 });
    }

    // Send email
    const subject = 'Your Login Code / 您的登入驗證碼 — Taiwan Digital Fest 2026';
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #1E1F1C; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="color: #10B8D9; margin: 0; font-size: 24px;">Taiwan Digital Fest 2026</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
    <h2 style="color: #10B8D9; margin-top: 0;">Login Code / 登入驗證碼</h2>
    <p>Enter this code on the website to sign in. It expires in ${CODE_EXPIRY_MINUTES} minutes.</p>
    <p>在網站上輸入此驗證碼以登入。驗證碼將在 ${CODE_EXPIRY_MINUTES} 分鐘後失效。</p>
    <div style="text-align: center; margin: 30px 0;">
      <span style="display: inline-block; background-color: #1E1F1C; color: #10B8D9; padding: 16px 32px; border-radius: 8px; font-size: 32px; font-weight: 700; letter-spacing: 8px; font-family: monospace;">${code}</span>
    </div>
    <p style="color: #666; font-size: 14px;">
      If you didn't request this code, you can safely ignore this email.<br>
      如果您未要求此驗證碼，可以安全地忽略此郵件。
    </p>
  </div>
  <div style="text-align: center; color: #999; font-size: 12px;">
    <p>This is an automated email. Please do not reply.</p>
  </div>
</body>
</html>`;

    const textContent = `Taiwan Digital Fest 2026 - Login Code

Your login code: ${code}

Enter this code on the website to sign in. It expires in ${CODE_EXPIRY_MINUTES} minutes.
在網站上輸入此驗證碼以登入。驗證碼將在 ${CODE_EXPIRY_MINUTES} 分鐘後失效。

If you didn't request this code, you can safely ignore this email.
如果您未要求此驗證碼，可以安全地忽略此郵件。`;

    const response = await mailgunClient.messages.create(mailgunDomain, {
      from: fromEmail,
      to: email,
      subject,
      html: htmlContent,
      text: textContent,
    });

    if (!response?.id) {
      logEmail({
        to_email: email, from_email: fromEmail, subject,
        email_type: 'magic_link', status: 'failed',
        error_message: 'Mailgun returned no message ID',
        metadata: { type: 'login_code' },
      }).catch(() => {});
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    logEmail({
      to_email: email, from_email: fromEmail, subject,
      email_type: 'magic_link', status: 'sent',
      mailgun_message_id: response.id,
      metadata: { type: 'login_code' },
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Auth] Error in send-code:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify the route compiles**

Run: `npx tsc --noEmit app/api/auth/send-code/route.ts 2>&1 || true`

Check no type errors specific to this file.

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/send-code/route.ts
git commit -m "feat: add send-code API route for 6-digit verification code login"
```

---

### Task 2: Create `/api/auth/verify-code` API Route

**Files:**
- Create: `app/api/auth/verify-code/route.ts`

- [ ] **Step 1: Create the verify-code route**

This route accepts `{ email, code }`, hashes the code, looks up a matching unused+unexpired row in `auth_tokens`, marks it used, signs a JWT, and returns it via a Set-Cookie header.

```typescript
// app/api/auth/verify-code/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { signSessionToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { createHash } from 'crypto';

const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days
const SESSION_COOKIE = 'tdf_session';

export async function POST(req: NextRequest) {
  try {
    if (!supabaseServer) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const limit = checkRateLimit(`verify-code:ip:${ip}`, { limit: 10, windowSeconds: 15 * 60 });
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    if (!body?.email || !body?.code) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });
    }

    const email = body.email.trim().toLowerCase();
    const code = body.code.trim();

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Invalid code format' }, { status: 400 });
    }

    // Per-email rate limit to prevent brute force (10 attempts per 15 min)
    const emailLimit = checkRateLimit(`verify-code:email:${email}`, { limit: 10, windowSeconds: 15 * 60 });
    if (!emailLimit.allowed) {
      return NextResponse.json({ error: 'Too many attempts for this email' }, { status: 429 });
    }

    const tokenHash = createHash('sha256').update(code).digest('hex');

    // Find matching token
    const { data: tokenRow, error: findError } = await supabaseServer
      .from('auth_tokens')
      .select('*')
      .eq('email', email)
      .eq('token_hash', tokenHash)
      .eq('used', false)
      .single();

    if (findError || !tokenRow) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 });
    }

    // Check expiration
    if (new Date(tokenRow.expires_at) < new Date()) {
      await supabaseServer
        .from('auth_tokens')
        .update({ used: true })
        .eq('id', tokenRow.id);
      return NextResponse.json({ error: 'Code has expired' }, { status: 401 });
    }

    // Mark token as used
    await supabaseServer
      .from('auth_tokens')
      .update({ used: true })
      .eq('id', tokenRow.id);

    // Get user
    const { data: user, error: userError } = await supabaseServer
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (userError || !user) {
      console.error('[Auth] User not found for verified code:', email);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }

    // Update last login
    await supabaseServer
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    // Sign JWT and set cookie
    const jwt = await signSessionToken(user.email, user.id);
    const response = NextResponse.json({ success: true });

    response.cookies.set(SESSION_COOKIE, jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });

    return response;
  } catch (error) {
    console.error('[Auth] Error in verify-code:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify the route compiles**

Run: `npx tsc --noEmit app/api/auth/verify-code/route.ts 2>&1 || true`

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/verify-code/route.ts
git commit -m "feat: add verify-code API route for 6-digit code validation"
```

---

### Task 3: Update i18n Content for Code-Based Login

**Files:**
- Modify: `data/content.ts:46-68` (en auth block)
- Modify: `data/content.ts:893-915` (zh auth block)

- [ ] **Step 1: Update English auth translations**

Change the `auth` block in the `en` section. Replace magic-link copy with verification code copy, and add `codePlaceholder`, `verifyCode`, `verifying`, `resendCode`, `codeSuccessTitle`, `codeSuccessMessage`, `invalidCode`, `codeExpired` keys.

```typescript
// In data/content.ts — en.auth block (around line 46)
auth: {
  loginTitle: "Sign In",
  loginDescription: "Enter your email to receive a 6-digit verification code. No password needed.",
  emailPlaceholder: "your@email.com",
  sendCode: "Send Verification Code",
  sending: "Sending...",
  codeSentTitle: "Enter Verification Code",
  codeSentMessage: "We've sent a 6-digit code to your email. Enter it below to sign in.",
  codePlaceholder: "000000",
  verifyCode: "Verify",
  verifying: "Verifying...",
  resendCode: "Resend Code",
  invalidCode: "Invalid or expired code. Please try again.",
  errorMessage: "Failed to send verification code. Please try again.",
  logout: "Sign Out",
  memberTitle: "My Account",
  orderHistory: "Order History",
  noOrders: "You don't have any orders yet.",
  ticketTier: "Ticket Tier",
  orderDate: "Order Date",
  orderStatus: "Status",
  amount: "Amount",
  viewDetails: "View Details",
  statusPaid: "Paid",
  statusPending: "Pending",
  statusFailed: "Failed",
  statusCancelled: "Cancelled",
  statusRefunded: "Refunded",
  statusExpired: "Expired",
},
```

- [ ] **Step 2: Update Chinese auth translations**

```typescript
// In data/content.ts — zh.auth block (around line 893)
auth: {
  loginTitle: "登入",
  loginDescription: "輸入您的電子郵件，我們將發送 6 位數驗證碼。無需密碼。",
  emailPlaceholder: "your@email.com",
  sendCode: "發送驗證碼",
  sending: "發送中...",
  codeSentTitle: "輸入驗證碼",
  codeSentMessage: "我們已將 6 位數驗證碼發送至您的信箱，請在下方輸入以登入。",
  codePlaceholder: "000000",
  verifyCode: "驗證",
  verifying: "驗證中...",
  resendCode: "重新發送驗證碼",
  invalidCode: "驗證碼無效或已過期，請重試。",
  errorMessage: "發送驗證碼失敗，請稍後再試。",
  logout: "登出",
  memberTitle: "我的帳戶",
  orderHistory: "訂單紀錄",
  noOrders: "目前沒有任何訂單。",
  ticketTier: "票種",
  orderDate: "訂單日期",
  orderStatus: "狀態",
  amount: "金額",
  viewDetails: "查看詳情",
  statusPaid: "已付款",
  statusPending: "待付款",
  statusFailed: "失敗",
  statusCancelled: "已取消",
  statusRefunded: "已退款",
  statusExpired: "已過期",
},
```

- [ ] **Step 3: Commit**

```bash
git add data/content.ts
git commit -m "feat: update i18n auth translations for verification code login"
```

---

### Task 4: Rewrite Member Page Login Form to Two-Step Code Flow

**Files:**
- Modify: `app/member/page.tsx` (LoginForm component, lines 11-78)

- [ ] **Step 1: Replace the LoginForm component**

Replace the existing `LoginForm` with a two-step flow: Step 1 shows email input + "Send Code" button. Step 2 shows 6-digit code input + "Verify" button + "Resend" link. On successful verify, call `refreshSession()` from AuthContext to update the user state (which triggers MemberDashboard to render).

```tsx
function LoginForm() {
  const { t } = useTranslation();
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
        throw new Error(data.error || 'Failed');
      }

      setStep('code');
      setCode('');
    } catch {
      setError(t.auth.errorMessage);
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

      if (!res.ok) {
        throw new Error('Invalid code');
      }

      await refreshSession();
    } catch {
      setError(t.auth.invalidCode);
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setSending(true);
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) throw new Error();
      setCode('');
    } catch {
      setError(t.auth.errorMessage);
    } finally {
      setSending(false);
    }
  };

  if (step === 'code') {
    return (
      <div className="w-full max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-2 text-center">{t.auth.codeSentTitle}</h1>
        <p className="text-slate-600 mb-8 text-center">{t.auth.codeSentMessage}</p>

        <form onSubmit={handleVerifyCode} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={t.auth.codePlaceholder}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B8D9] focus:border-transparent text-slate-900 text-center text-2xl tracking-[0.3em] font-mono"
          />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={verifying || code.length !== 6}
            className="w-full bg-[#10B8D9] hover:bg-[#0EA5C4] disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {verifying ? t.auth.verifying : t.auth.verifyCode}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={handleResend}
            disabled={sending}
            className="text-sm text-[#10B8D9] hover:underline disabled:opacity-50"
          >
            {sending ? t.auth.sending : t.auth.resendCode}
          </button>
        </div>
        <div className="mt-2 text-center">
          <button
            onClick={() => { setStep('email'); setError(''); setCode(''); }}
            className="text-sm text-slate-500 hover:underline"
          >
            {email}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 mb-2 text-center">{t.auth.loginTitle}</h1>
      <p className="text-slate-600 mb-8 text-center">{t.auth.loginDescription}</p>

      <form onSubmit={handleSendCode} className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.auth.emailPlaceholder}
          required
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B8D9] focus:border-transparent text-slate-900"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={sending}
          className="w-full bg-[#10B8D9] hover:bg-[#0EA5C4] disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          {sending ? t.auth.sending : t.auth.sendCode}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Verify compile**

Run: `npm run build 2>&1 | tail -20`

- [ ] **Step 3: Commit**

```bash
git add app/member/page.tsx
git commit -m "feat: rewrite member login form to use 6-digit verification code"
```

---

### Task 5: Enable Navbar Auth Links

**Files:**
- Modify: `components/Navbar.tsx:11,15,176,198`

- [ ] **Step 1: Uncomment the auth import and hook usage**

At line 11, change:
```typescript
// import { useAuth } from '@/contexts/AuthContext'; // temporarily hidden
```
to:
```typescript
import { useAuth } from '@/contexts/AuthContext';
```

At line 15, change:
```typescript
// const { user, loading: authLoading } = useAuth(); // temporarily hidden
```
to:
```typescript
const { user, loading: authLoading } = useAuth();
```

- [ ] **Step 2: Add desktop auth link at line 176**

Replace the comment `{/* Auth: Login / Member — temporarily hidden */}` with:

```tsx
{!authLoading && (
  <Link
    href="/member"
    className={`text-sm font-medium transition-colors ${
      scrolled ? 'text-[#1E1F1C] hover:text-[#10B8D9]' : 'text-white hover:text-[#10B8D9]'
    }`}
  >
    {user ? t.nav.member : t.nav.login}
  </Link>
)}
```

- [ ] **Step 3: Add mobile auth link at line 198**

Replace the comment `{/* Auth: Login / Member (mobile) — temporarily hidden */}` with:

```tsx
{!authLoading && (
  <Link
    href="/member"
    className={`transition-colors ${
      scrolled ? 'text-[#1E1F1C] hover:text-[#10B8D9]' : 'text-white hover:text-[#10B8D9]'
    }`}
  >
    {user ? t.nav.member : t.nav.login}
  </Link>
)}
```

- [ ] **Step 4: Verify compile**

Run: `npm run build 2>&1 | tail -20`

- [ ] **Step 5: Commit**

```bash
git add components/Navbar.tsx
git commit -m "feat: enable auth links in Navbar for member login"
```

---

### Task 6: Manual Smoke Test

- [ ] **Step 1: Start dev server and test the full flow**

Run: `npm run dev`

1. Open `http://localhost:3000` — verify Navbar shows "Sign In" / "登入" link
2. Click the link — should navigate to `/member` with email input form
3. Enter a test email — should show "sending" state, then transition to code input step
4. Check Mailgun logs or email inbox for the 6-digit code
5. Enter the code — should log in and show order history dashboard
6. Verify Navbar now shows "My Account" / "我的帳戶"
7. Click sign out — should return to login form, Navbar shows "Sign In" again
8. Test error cases: wrong code, expired code, rate limiting
