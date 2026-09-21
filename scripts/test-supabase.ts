#!/usr/bin/env npx tsx
/**
 * Supabase 串接測試腳本
 *
 * 測試項目：
 * 1. Secret Key 連線與基本 CRUD
 * 2. Publishable Key RLS 防護驗證
 * 3. 所有資料表 RLS 狀態確認
 * 4. 各 API route 所需的資料表存取
 *
 * 使用方式：npx tsx scripts/test-supabase.ts
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env manually without dotenv dependency
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

const TABLES = [
  'visitors',
  'email_logs',
  'orders',
  'award_votes',
  'ig_posts',
  'newsletter_subscriptions',
] as const;

type TableName = (typeof TABLES)[number];

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ ${message}`);
    failed++;
  }
}

// ─── 1. 環境變數檢查 ────────────────────────────
function testEnvVars() {
  console.log('\n🔧 1. 環境變數檢查');
  assert(!!SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL 已設定');
  assert(SUPABASE_URL.includes('supabase.co'), 'SUPABASE_URL 格式正確');
  assert(!!SECRET_KEY, 'SUPABASE_SECRET_KEY 已設定');
  assert(SECRET_KEY.startsWith('sb_secret_'), 'Secret Key 使用新版格式 (sb_secret_)');
  assert(!!PUBLISHABLE_KEY, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 已設定');
  assert(
    PUBLISHABLE_KEY.startsWith('sb_publishable_'),
    'Publishable Key 使用新版格式 (sb_publishable_)'
  );

  // 確認沒有舊版金鑰
  assert(!process.env.SUPABASE_ANON_KEY, '無舊版 SUPABASE_ANON_KEY');
  assert(!process.env.SUPABASE_SERVICE_ROLE_KEY, '無舊版 SUPABASE_SERVICE_ROLE_KEY');
  assert(!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, '無舊版 NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// ─── 2. Secret Key 連線測試 ──────────────────────
async function testSecretKeyConnection(secClient: SupabaseClient) {
  console.log('\n🔑 2. Secret Key 連線測試');

  for (const table of TABLES) {
    const { count, error } = await secClient.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      assert(false, `${table}: SELECT 失敗 (${error.code}: ${error.message})`);
    } else {
      assert(true, `${table}: SELECT 成功 (${count} 筆)`);
    }
  }
}

// ─── 3. RLS 防護測試 ─────────────────────────────
async function testRLSProtection(
  pubClient: SupabaseClient,
  secClient: SupabaseClient
) {
  console.log('\n🛡️  3. RLS 防護測試（Publishable Key 應全部被擋）');

  for (const table of TABLES) {
    // SELECT 測試
    const { count: secCount } = await secClient
      .from(table)
      .select('*', { count: 'exact', head: true });
    const { count: pubCount } = await pubClient
      .from(table)
      .select('*', { count: 'exact', head: true });

    if ((secCount ?? 0) > 0) {
      assert(pubCount === 0, `${table}: SELECT 被 RLS 擋住 (secret=${secCount}, pub=${pubCount})`);
    } else {
      assert(true, `${table}: 空資料表，無法驗證 SELECT RLS（跳過）`);
    }
  }

  // INSERT 測試
  console.log('\n  INSERT 測試：');

  const insertTests: { table: TableName; data: Record<string, unknown> }[] = [
    { table: 'visitors', data: { fingerprint: '__rls_test_' + Date.now(), user_agent: 'test' } },
    { table: 'email_logs', data: { to_email: 'rls@test.com', email_type: 'rls_test', status: 'sent' } },
    { table: 'newsletter_subscriptions', data: { email: 'rls@test.com', source: 'rls_test' } },
    { table: 'orders', data: { stripe_session_id: 'rls_test', ticket_tier: 'explore', amount_subtotal: 0, amount_total: 0 } },
    { table: 'award_votes', data: { post_id: 'rls_test', email: 'rls@test.com' } },
  ];

  for (const { table, data } of insertTests) {
    const { error } = await pubClient.from(table).insert(data);
    assert(
      error?.code === '42501',
      `${table}: INSERT 被 RLS 擋住${error ? '' : ' ⚠️ 未被擋住！'}`
    );
  }

  // 清理可能穿透的測試資料
  await secClient.from('visitors').delete().like('fingerprint', '__rls_test_%');
  await secClient.from('email_logs').delete().eq('email_type', 'rls_test');
  await secClient.from('newsletter_subscriptions').delete().eq('source', 'rls_test');
  await secClient.from('orders').delete().eq('stripe_session_id', 'rls_test');
  await secClient.from('award_votes').delete().eq('post_id', 'rls_test');
}

// ─── 4. CRUD 操作測試（Secret Key）──────────────
async function testCRUDOperations(secClient: SupabaseClient) {
  console.log('\n📝 4. CRUD 操作測試（Secret Key）');

  const testFingerprint = '__crud_test_' + Date.now();

  // INSERT
  const { data: inserted, error: insertErr } = await secClient
    .from('visitors')
    .insert({ fingerprint: testFingerprint, user_agent: 'crud-test', ip_address: '127.0.0.1' })
    .select()
    .single();
  assert(!insertErr && !!inserted, `visitors INSERT 成功`);

  if (!inserted) return;

  // SELECT
  const { data: selected, error: selectErr } = await secClient
    .from('visitors')
    .select('*')
    .eq('fingerprint', testFingerprint)
    .single();
  assert(!selectErr && selected?.fingerprint === testFingerprint, `visitors SELECT 成功`);

  // UPDATE
  const { error: updateErr } = await secClient
    .from('visitors')
    .update({ user_agent: 'crud-test-updated' })
    .eq('fingerprint', testFingerprint);
  assert(!updateErr, `visitors UPDATE 成功`);

  // Verify UPDATE
  const { data: updated } = await secClient
    .from('visitors')
    .select('user_agent')
    .eq('fingerprint', testFingerprint)
    .single();
  assert(updated?.user_agent === 'crud-test-updated', `visitors UPDATE 結果正確`);

  // DELETE
  const { error: deleteErr } = await secClient
    .from('visitors')
    .delete()
    .eq('fingerprint', testFingerprint);
  assert(!deleteErr, `visitors DELETE 成功`);

  // Verify DELETE
  const { data: deleted } = await secClient
    .from('visitors')
    .select('*')
    .eq('fingerprint', testFingerprint);
  assert(deleted?.length === 0, `visitors DELETE 結果正確（已清除）`);
}

// ─── 5. API Route 資料表存取模式驗證 ──────────────
async function testAPIRouteAccess(secClient: SupabaseClient) {
  console.log('\n🌐 5. API Route 資料表存取模式驗證');

  // newsletter/subscribe → newsletter_subscriptions INSERT
  const testEmail = `test_${Date.now()}@test.com`;
  const { error: subErr } = await secClient
    .from('newsletter_subscriptions')
    .insert({ email: testEmail, source: 'api_test' })
    .select();
  assert(!subErr, 'newsletter/subscribe: INSERT newsletter_subscriptions');

  // newsletter/count → newsletter_subscriptions SELECT count
  const { count, error: countErr } = await secClient
    .from('newsletter_subscriptions')
    .select('*', { count: 'exact', head: true });
  assert(!countErr && (count ?? 0) > 0, `newsletter/count: SELECT count (${count})`);

  // newsletter/unsubscribe → newsletter_subscriptions DELETE
  const { error: unsubErr } = await secClient
    .from('newsletter_subscriptions')
    .delete()
    .eq('email', testEmail);
  assert(!unsubErr, 'newsletter/unsubscribe: DELETE newsletter_subscriptions');

  // award/posts → ig_posts SELECT with vote count
  const { error: postsErr } = await secClient
    .from('ig_posts')
    .select('*, award_votes(count)');
  assert(!postsErr, 'award/posts: SELECT ig_posts with award_votes join');

  // visitors → visitors UPSERT
  const { error: visErr } = await secClient
    .from('visitors')
    .upsert(
      { fingerprint: '__api_test', user_agent: 'test', ip_address: '127.0.0.1' },
      { onConflict: 'fingerprint' }
    );
  assert(!visErr, 'visitors: UPSERT visitors');
  await secClient.from('visitors').delete().eq('fingerprint', '__api_test');

  // email_logs → email_logs INSERT
  const { error: logErr } = await secClient
    .from('email_logs')
    .insert({ to_email: 'test@t.com', email_type: 'api_test', status: 'sent' });
  assert(!logErr, 'email/send: INSERT email_logs');
  await secClient.from('email_logs').delete().eq('email_type', 'api_test');
}

// ─── Main ────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║  Supabase 串接測試                     ║');
  console.log('╚══════════════════════════════════════╝');

  // 1. 環境變數
  testEnvVars();

  if (!SUPABASE_URL || !SECRET_KEY || !PUBLISHABLE_KEY) {
    console.error('\n❌ 環境變數缺失，無法繼續測試');
    process.exit(1);
  }

  const secClient = createClient(SUPABASE_URL, SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const pubClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 2. Secret Key 連線
  await testSecretKeyConnection(secClient);

  // 3. RLS 防護
  await testRLSProtection(pubClient, secClient);

  // 4. CRUD 操作
  await testCRUDOperations(secClient);

  // 5. API Route 存取
  await testAPIRouteAccess(secClient);

  // 結果
  console.log('\n══════════════════════════════════════');
  console.log(`結果: ${passed} 通過, ${failed} 失敗`);
  console.log('══════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('測試執行錯誤:', err);
  process.exit(1);
});
