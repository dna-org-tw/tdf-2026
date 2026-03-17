#!/usr/bin/env npx tsx
/**
 * 會員登入系統（Magic Link）端對端測試腳本
 *
 * 測試項目：
 * 1. 環境變數檢查（Supabase + Mailgun）
 * 2. Magic Link API — 產生 & 寄送
 * 3. OTP Token 驗證（模擬 callback）
 * 4. 會員 Session & JWT 取得
 * 5. 受保護的 Orders API 存取
 * 6. 登出與 Session 失效
 *
 * 使用方式：npx tsx scripts/test-auth.ts [--email test@example.com]
 *
 * 注意：
 * - 需要 dev server 運行在 localhost:3000（用於測試 API routes）
 * - 使用 Supabase Admin API 直接產生 token，不實際寄信
 * - 測試結束後會清理建立的測試使用者
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;

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
  assert(!!PUBLISHABLE_KEY, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 已設定');
  assert(!!MAILGUN_API_KEY, 'MAILGUN_API_KEY 已設定');
  assert(!!MAILGUN_DOMAIN, 'MAILGUN_DOMAIN 已設定');
  assert(!!process.env.EMAIL_FROM, 'EMAIL_FROM 已設定');
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

// ─── 3. Supabase Admin 產生 Token & 驗證 OTP ────
async function testTokenVerification(
  secClient: SupabaseClient,
  pubClient: SupabaseClient
): Promise<{ accessToken: string; userId: string } | null> {
  console.log('\n🔐 3. Token 產生 & OTP 驗證');

  // 3a. 使用 Admin API 產生 magic link token
  const { data: linkData, error: linkError } = await secClient.auth.admin.generateLink({
    type: 'magiclink',
    email: TEST_EMAIL,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    assert(false, 'Admin generateLink 產生 hashed_token', linkError?.message);
    return null;
  }

  const tokenHash = linkData.properties.hashed_token;
  assert(true, `Admin generateLink 產生 hashed_token (${tokenHash.slice(0, 12)}...)`);

  // 3b. 驗證 callback URL 格式
  const callbackUrl = `${BASE_URL}/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink`;
  const url = new URL(callbackUrl);
  assert(url.searchParams.get('token_hash') === tokenHash, 'Callback URL 包含正確的 token_hash');
  assert(url.searchParams.get('type') === 'magiclink', 'Callback URL type=magiclink');
  assert(url.pathname === '/auth/callback', 'Callback URL path=/auth/callback');

  // 3c. 使用 Publishable Key client 驗證 OTP（模擬瀏覽器端行為）
  const { data: verifyData, error: verifyError } = await pubClient.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  });

  if (verifyError) {
    assert(false, 'verifyOtp 成功驗證', verifyError.message);
    return null;
  }

  assert(!!verifyData.session, 'verifyOtp 返回有效 session');
  assert(!!verifyData.session?.access_token, 'Session 包含 access_token');
  assert(
    verifyData.session?.user?.email === TEST_EMAIL,
    `Session user email 正確 (${verifyData.session?.user?.email})`
  );
  assert(!!verifyData.session?.user?.id, `Session user id 存在 (${verifyData.session?.user?.id})`);

  return {
    accessToken: verifyData.session!.access_token,
    userId: verifyData.session!.user.id,
  };
}

// ─── 4. Callback 頁面可達性測試 ────────────────
async function testCallbackPage() {
  console.log('\n🌐 4. Auth Callback 頁面可達性');

  // 4a. 無 token_hash → 應渲染錯誤頁
  try {
    const res = await fetch(`${BASE_URL}/auth/callback`);
    assert(res.status === 200, '/auth/callback 無參數 → 頁面可達 (200)');
    const html = await res.text();
    assert(html.includes('Login Failed') || html.includes('Invalid'), '頁面顯示錯誤提示');
  } catch (err) {
    assert(false, '/auth/callback 無參數 → 頁面可達', `${err}`);
  }

  // 4b. 有完整參數 → 頁面可達
  try {
    const res = await fetch(`${BASE_URL}/auth/callback?token_hash=fakehash&type=magiclink`);
    assert(res.status === 200, '/auth/callback 含參數 → 頁面可達 (200)');
  } catch (err) {
    assert(false, '/auth/callback 含參數 → 頁面可達', `${err}`);
  }
}

// ─── 5. Orders API 驗證測試 ────────────────────
async function testOrdersAPI(accessToken: string) {
  console.log('\n📦 5. Orders API 受保護端點測試');

  // 5a. 無 Authorization header → 401
  try {
    const res = await fetch(`${BASE_URL}/api/auth/orders?email=${encodeURIComponent(TEST_EMAIL)}`);
    assert(res.status === 401, 'GET /api/auth/orders 無 token → 401 Unauthorized', `實際 status: ${res.status}`);
  } catch (err) {
    assert(false, 'GET /api/auth/orders 無 token → 401', `${err}`);
  }

  // 5b. 無效 token → 401
  try {
    const res = await fetch(`${BASE_URL}/api/auth/orders?email=${encodeURIComponent(TEST_EMAIL)}`, {
      headers: { Authorization: 'Bearer invalid_token_here' },
    });
    assert(res.status === 401, 'GET /api/auth/orders 無效 token → 401 Unauthorized', `實際 status: ${res.status}`);
  } catch (err) {
    assert(false, 'GET /api/auth/orders 無效 token → 401', `${err}`);
  }

  // 5c. 缺少 email 參數 → 400
  try {
    const res = await fetch(`${BASE_URL}/api/auth/orders`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assert(res.status === 400, 'GET /api/auth/orders 無 email → 400 Bad Request', `實際 status: ${res.status}`);
  } catch (err) {
    assert(false, 'GET /api/auth/orders 無 email → 400', `${err}`);
  }

  // 5d. email 不匹配 → 401
  try {
    const res = await fetch(`${BASE_URL}/api/auth/orders?email=wrong@email.com`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assert(res.status === 401, 'GET /api/auth/orders email 不匹配 → 401 Unauthorized', `實際 status: ${res.status}`);
  } catch (err) {
    assert(false, 'GET /api/auth/orders email 不匹配 → 401', `${err}`);
  }

  // 5e. 正確 token + email → 200 + orders array
  try {
    const res = await fetch(`${BASE_URL}/api/auth/orders?email=${encodeURIComponent(TEST_EMAIL)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assert(res.status === 200, 'GET /api/auth/orders 正確 token + email → 200', `實際 status: ${res.status}`);

    const data = await res.json();
    assert(Array.isArray(data.orders), '回傳 orders 陣列', `type: ${typeof data.orders}`);
    console.log(`    ℹ️  目前有 ${data.orders?.length ?? 0} 筆訂單`);
  } catch (err) {
    assert(false, 'GET /api/auth/orders 正確 token + email → 200', `${err}`);
  }
}

// ─── 6. Member 頁面測試 ────────────────────────
async function testMemberPage() {
  console.log('\n👤 6. Member 頁面可達性');

  try {
    const res = await fetch(`${BASE_URL}/member`);
    assert(res.status === 200, '/member → 頁面可達 (200)');
    const html = await res.text();
    // 頁面應包含登入表單或會員儀表板相關內容
    const hasAuthContent = html.includes('member') || html.includes('login') || html.includes('Sign');
    assert(hasAuthContent, '/member 頁面包含登入或會員相關內容');
  } catch (err) {
    assert(false, '/member → 頁面可達', `${err}`);
  }
}

// ─── 7. Email 寄送紀錄驗證 ─────────────────────
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
    assert(!!log.from_email, `email_logs 有 from_email (${log.from_email})`);
  }
}

// ─── 8. 登出 & Session 失效 ────────────────────
async function testSignOut(
  secClient: SupabaseClient,
  accessToken: string
) {
  console.log('\n🚪 8. 登出 & Session 失效');

  // Use admin to revoke session
  // First get the user from the token
  const { data: { user }, error: getUserErr } = await secClient.auth.getUser(accessToken);
  assert(!getUserErr && !!user, 'Admin getUser 使用 access_token 成功');

  if (user) {
    // Sign out the user (admin)
    const { error: signOutErr } = await secClient.auth.admin.signOut(accessToken);
    assert(!signOutErr, 'Admin signOut 成功');

    // After sign out, the token should be invalid
    const res = await fetch(`${BASE_URL}/api/auth/orders?email=${encodeURIComponent(TEST_EMAIL)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assert(res.status === 401, '登出後 orders API → 401 Unauthorized', `實際 status: ${res.status}`);
  }
}

// ─── 9. 清理測試資料 ────────────────────────────
async function cleanup(secClient: SupabaseClient, userId?: string) {
  console.log('\n🧹 9. 清理測試資料');

  // 清理 email_logs
  const { error: logErr } = await secClient
    .from('email_logs')
    .delete()
    .eq('to_email', TEST_EMAIL)
    .eq('email_type', 'magic_link');
  assert(!logErr, '清理 email_logs 測試紀錄');

  // 刪除測試使用者（僅自動產生的測試 email）
  if (userId && TEST_EMAIL.includes('test_auth_') && TEST_EMAIL.endsWith('.local')) {
    const { error: delErr } = await secClient.auth.admin.deleteUser(userId);
    assert(!delErr, `刪除測試使用者 (${userId.slice(0, 8)}...)`);
  } else {
    console.log('  ⏭️  跳過刪除使用者（使用真實 email）');
  }
}

// ─── Main ────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  會員登入系統（Magic Link）端對端測試       ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`  測試 Email: ${TEST_EMAIL}`);
  console.log(`  目標 Server: ${BASE_URL}`);

  // 1. 環境變數
  testEnvVars();

  if (!SUPABASE_URL || !SECRET_KEY || !PUBLISHABLE_KEY) {
    console.error('\n❌ Supabase 環境變數缺失，無法繼續測試');
    process.exit(1);
  }

  const secClient = createClient(SUPABASE_URL, SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const pubClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
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

  // 3. Token 產生 & OTP 驗證
  const authResult = await testTokenVerification(secClient, pubClient);

  // 4. Callback 頁面
  await testCallbackPage();

  // 5. Orders API
  if (authResult) {
    await testOrdersAPI(authResult.accessToken);
  } else {
    console.log('\n📦 5. Orders API 受保護端點測試');
    console.log('  ⏭️  跳過（無有效 session）');
  }

  // 6. Member 頁面
  await testMemberPage();

  // 7. Email Log
  if (emailSent) {
    await testEmailLog(secClient);
  } else {
    console.log('\n📋 7. Email Log 紀錄驗證');
    console.log('  ⏭️  跳過（email 未成功寄送）');
  }

  // 8. 登出
  if (authResult) {
    await testSignOut(secClient, authResult.accessToken);
  } else {
    console.log('\n🚪 8. 登出 & Session 失效');
    console.log('  ⏭️  跳過（無有效 session）');
  }

  // 9. 清理
  await cleanup(secClient, authResult?.userId);

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
