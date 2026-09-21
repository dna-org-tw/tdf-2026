#!/usr/bin/env npx tsx
/**
 * 會員登入系統（Custom Magic Link）端對端測試腳本
 *
 * 測試項目：
 * 1. 環境變數檢查（Supabase + Mailgun + AUTH_SECRET）
 * 2. Magic Link API — 產生 & 寄送
 * 3. Token 驗證（直接呼叫 verify API）
 * 4. Session API 取得
 * 5. 受保護的 Orders API 存取
 * 6. 登出與 Session 失效
 *
 * 使用方式：npx tsx scripts/test-auth.ts [--email test@example.com]
 *
 * 注意：
 * - 需要 dev server 運行在 localhost:3000（用於測試 API routes）
 * - 直接操作 DB 產生 token，不實際寄信
 * - 測試結束後會清理建立的測試資料
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ─── Load .env ──────────────────────────────────
try {
  const envPath = resolve(__dirname, '../.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch {
  // .env file not found, rely on existing env vars
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
const AUTH_SECRET = process.env.AUTH_SECRET;

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

// Parse CLI args
const args = process.argv.slice(2);
const emailIdx = args.indexOf('--email');
const TEST_EMAIL = emailIdx >= 0 && args[emailIdx + 1]
  ? args[emailIdx + 1]
  : `test_auth_${Date.now()}@test.tdf2026.local`;

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ ${message}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

// ─── 1. 環境變數檢查 ────────────────────────────
function testEnvVars() {
  console.log('\n🔧 1. 環境變數檢查');
  assert(!!SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL 已設定');
  assert(!!SECRET_KEY, 'SUPABASE_SECRET_KEY 已設定');
  assert(!!MAILGUN_API_KEY, 'MAILGUN_API_KEY 已設定');
  assert(!!MAILGUN_DOMAIN, 'MAILGUN_DOMAIN 已設定');
  assert(!!process.env.EMAIL_FROM, 'EMAIL_FROM 已設定');
  assert(!!AUTH_SECRET, 'AUTH_SECRET 已設定');
}

// ─── 2. Magic Link API 端點測試 ────────────────
async function testMagicLinkAPI(): Promise<boolean> {
  console.log('\n📧 2. Magic Link API 端點測試');

  // 2a. 缺少 email 應回 400
  try {
    const res = await fetch(`${BASE_URL}/api/auth/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert(res.status === 400, 'POST 無 email → 400 Bad Request', `實際 status: ${res.status}`);
  } catch (err) {
    assert(false, 'POST 無 email → 400 Bad Request', `fetch 失敗: ${err}`);
  }

  // 2b. 無效 JSON 應回 400
  try {
    const res = await fetch(`${BASE_URL}/api/auth/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    assert(res.status === 400, 'POST 無效 JSON → 400 Bad Request', `實際 status: ${res.status}`);
  } catch (err) {
    assert(false, 'POST 無效 JSON → 400 Bad Request', `fetch 失敗: ${err}`);
  }

  // 2c. 正常寄送 magic link
  try {
    const res = await fetch(`${BASE_URL}/api/auth/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL }),
    });
    const data = await res.json();
    assert(res.status === 200 && data.success === true, `POST email=${TEST_EMAIL} → 200 成功寄送`, `status: ${res.status}, body: ${JSON.stringify(data)}`);
    return res.status === 200;
  } catch (err) {
    assert(false, `POST email=${TEST_EMAIL} → 200 成功寄送`, `fetch 失敗: ${err}`);
    return false;
  }
}

// ─── 3. Token 驗證（直接 DB 操作模擬） ────────
async function testTokenVerification(
  secClient: SupabaseClient
): Promise<string | null> {
  console.log('\n🔐 3. Token 產生 & 驗證');

  // 3a. 在 DB 中插入一個測試 token
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  // Ensure user exists
  await secClient.from('users').upsert({ email: TEST_EMAIL }, { onConflict: 'email', ignoreDuplicates: true });

  // Invalidate existing tokens
  await secClient.from('auth_tokens').update({ used: true }).eq('email', TEST_EMAIL).eq('used', false);

  const { error: insertError } = await secClient.from('auth_tokens').insert({
    email: TEST_EMAIL,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });
  assert(!insertError, 'DB 插入測試 auth_token', insertError?.message);

  // 3b. 呼叫 verify API（不跟隨 redirect）
  try {
    const res = await fetch(`${BASE_URL}/api/auth/verify?token=${rawToken}`, {
      redirect: 'manual',
    });
    assert(res.status === 307 || res.status === 308 || res.status === 302, `verify API → redirect (${res.status})`);

    const location = res.headers.get('location') || '';
    assert(location.includes('/me'), 'Redirect 到 /me', `location: ${location}`);

    // Extract session cookie
    const setCookieHeader = res.headers.get('set-cookie') || '';
    assert(setCookieHeader.includes('tdf_session'), 'Set-Cookie 包含 tdf_session');

    // Extract cookie value
    const cookieMatch = setCookieHeader.match(/tdf_session=([^;]+)/);
    return cookieMatch ? cookieMatch[1] : null;
  } catch (err) {
    assert(false, 'verify API 呼叫成功', `${err}`);
    return null;
  }
}

// ─── 4. Session API 測試 ────────────────────────
async function testSessionAPI(sessionCookie: string) {
  console.log('\n🔑 4. Session API 測試');

  // 4a. 無 cookie → user: null
  try {
    const res = await fetch(`${BASE_URL}/api/auth/session`);
    const data = await res.json();
    assert(res.status === 200 && data.user === null, 'GET /api/auth/session 無 cookie → user: null');
  } catch (err) {
    assert(false, 'GET /api/auth/session 無 cookie', `${err}`);
  }

  // 4b. 有效 cookie → user 資料
  try {
    const res = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: { Cookie: `tdf_session=${sessionCookie}` },
    });
    const data = await res.json();
    assert(res.status === 200 && data.user !== null, 'GET /api/auth/session 有效 cookie → user 資料');
    assert(data.user?.email === TEST_EMAIL, `Session user email 正確 (${data.user?.email})`);
    assert(!!data.user?.id, `Session user id 存在`);
  } catch (err) {
    assert(false, 'GET /api/auth/session 有效 cookie', `${err}`);
  }
}

// ─── 5. Orders API 驗證測試 ────────────────────
async function testOrdersAPI(sessionCookie: string) {
  console.log('\n📦 5. Orders API 受保護端點測試');

  // 5a. 無 cookie → 401
  try {
    const res = await fetch(`${BASE_URL}/api/auth/orders?email=${encodeURIComponent(TEST_EMAIL)}`);
    assert(res.status === 401, 'GET /api/auth/orders 無 cookie → 401 Unauthorized', `實際 status: ${res.status}`);
  } catch (err) {
    assert(false, 'GET /api/auth/orders 無 cookie → 401', `${err}`);
  }

  // 5b. email 不匹配 → 401
  try {
    const res = await fetch(`${BASE_URL}/api/auth/orders?email=wrong@email.com`, {
      headers: { Cookie: `tdf_session=${sessionCookie}` },
    });
    assert(res.status === 401, 'GET /api/auth/orders email 不匹配 → 401 Unauthorized', `實際 status: ${res.status}`);
  } catch (err) {
    assert(false, 'GET /api/auth/orders email 不匹配 → 401', `${err}`);
  }

  // 5c. 正確 cookie + email → 200 + orders array
  try {
    const res = await fetch(`${BASE_URL}/api/auth/orders?email=${encodeURIComponent(TEST_EMAIL)}`, {
      headers: { Cookie: `tdf_session=${sessionCookie}` },
    });
    assert(res.status === 200, 'GET /api/auth/orders 正確 cookie + email → 200', `實際 status: ${res.status}`);

    const data = await res.json();
    assert(Array.isArray(data.orders), '回傳 orders 陣列', `type: ${typeof data.orders}`);
    console.log(`    ℹ️  目前有 ${data.orders?.length ?? 0} 筆訂單`);
  } catch (err) {
    assert(false, 'GET /api/auth/orders 正確 cookie + email → 200', `${err}`);
  }
}

// ─── 6. Callback 頁面 & Member 頁面可達性 ─────
async function testPages() {
  console.log('\n🌐 6. 頁面可達性');

  // Callback error page
  try {
    const res = await fetch(`${BASE_URL}/auth/callback?error=expired`);
    assert(res.status === 200, '/auth/callback?error=expired → 頁面可達 (200)');
  } catch (err) {
    assert(false, '/auth/callback → 頁面可達', `${err}`);
  }

  // Member page
  try {
    const res = await fetch(`${BASE_URL}/me`);
    assert(res.status === 200, '/me → 頁面可達 (200)');
  } catch (err) {
    assert(false, '/me → 頁面可達', `${err}`);
  }
}

// ─── 7. Email Log 紀錄驗證 ─────────────────────
async function testEmailLog(secClient: SupabaseClient) {
  console.log('\n📋 7. Email Log 紀錄驗證');

  const { data: logs, error } = await secClient
    .from('email_logs')
    .select('*')
    .eq('to_email', TEST_EMAIL)
    .eq('email_type', 'magic_link')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    assert(false, 'email_logs 查詢成功', error.message);
    return;
  }

  assert((logs?.length ?? 0) > 0, `email_logs 有 magic_link 紀錄 (to: ${TEST_EMAIL})`);

  if (logs && logs.length > 0) {
    const log = logs[0];
    assert(log.status === 'sent', `email_logs status = sent`, `實際: ${log.status}`);
    assert(!!log.mailgun_message_id, `email_logs 有 mailgun_message_id`);
  }
}

// ─── 8. 登出 & Session 失效 ────────────────────
async function testSignOut(sessionCookie: string) {
  console.log('\n🚪 8. 登出 & Session 失效');

  // Logout
  try {
    const res = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: `tdf_session=${sessionCookie}` },
    });
    const data = await res.json();
    assert(res.status === 200 && data.success, 'POST /api/auth/logout → 200 成功');

    // Check set-cookie clears the session
    const setCookie = res.headers.get('set-cookie') || '';
    assert(setCookie.includes('tdf_session=') && setCookie.includes('Max-Age=0'), 'Set-Cookie 清除 tdf_session');
  } catch (err) {
    assert(false, 'POST /api/auth/logout', `${err}`);
  }
}

// ─── 9. 清理測試資料 ────────────────────────────
async function cleanup(secClient: SupabaseClient) {
  console.log('\n🧹 9. 清理測試資料');

  // 清理 auth_tokens
  const { error: tokenErr } = await secClient
    .from('auth_tokens')
    .delete()
    .eq('email', TEST_EMAIL);
  assert(!tokenErr, '清理 auth_tokens 測試紀錄');

  // 清理 email_logs
  const { error: logErr } = await secClient
    .from('email_logs')
    .delete()
    .eq('to_email', TEST_EMAIL)
    .eq('email_type', 'magic_link');
  assert(!logErr, '清理 email_logs 測試紀錄');

  // 刪除測試使用者（僅自動產生的測試 email）
  if (TEST_EMAIL.includes('test_auth_') && TEST_EMAIL.endsWith('.local')) {
    const { error: delErr } = await secClient
      .from('users')
      .delete()
      .eq('email', TEST_EMAIL);
    assert(!delErr, `刪除測試使用者 (${TEST_EMAIL})`);
  } else {
    console.log('  ⏭️  跳過刪除使用者（使用真實 email）');
  }
}

// ─── Main ────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  會員登入系統（Custom Magic Link）端對端測試  ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`  測試 Email: ${TEST_EMAIL}`);
  console.log(`  目標 Server: ${BASE_URL}`);

  // 1. 環境變數
  testEnvVars();

  if (!SUPABASE_URL || !SECRET_KEY) {
    console.error('\n❌ Supabase 環境變數缺失，無法繼續測試');
    process.exit(1);
  }

  const secClient = createClient(SUPABASE_URL, SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 檢查 dev server 是否運行
  try {
    await fetch(BASE_URL, { signal: AbortSignal.timeout(5000) });
  } catch {
    console.error(`\n❌ 無法連接 ${BASE_URL}，請先啟動 dev server (npm run dev)`);
    process.exit(1);
  }

  // 2. Magic Link API
  const emailSent = await testMagicLinkAPI();

  // 3. Token 驗證
  const sessionCookie = await testTokenVerification(secClient);

  // 4. Session API
  if (sessionCookie) {
    await testSessionAPI(sessionCookie);
  } else {
    console.log('\n🔑 4. Session API 測試');
    console.log('  ⏭️  跳過（無有效 session cookie）');
  }

  // 5. Orders API
  if (sessionCookie) {
    await testOrdersAPI(sessionCookie);
  } else {
    console.log('\n📦 5. Orders API 受保護端點測試');
    console.log('  ⏭️  跳過（無有效 session cookie）');
  }

  // 6. 頁面可達性
  await testPages();

  // 7. Email Log
  if (emailSent) {
    await testEmailLog(secClient);
  } else {
    console.log('\n📋 7. Email Log 紀錄驗證');
    console.log('  ⏭️  跳過（email 未成功寄送）');
  }

  // 8. 登出
  if (sessionCookie) {
    await testSignOut(sessionCookie);
  } else {
    console.log('\n🚪 8. 登出 & Session 失效');
    console.log('  ⏭️  跳過（無有效 session cookie）');
  }

  // 9. 清理
  await cleanup(secClient);

  // 結果
  console.log('\n══════════════════════════════════════════');
  console.log(`結果: ${passed} 通過, ${failed} 失敗`);
  console.log('══════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('測試執行錯誤:', err);
  process.exit(1);
});
