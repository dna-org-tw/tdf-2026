/**
 * Apply a single SQL migration file against the production Supabase database
 * using psql. Reads connection info from .env.production.local — looks for
 * (in order) DATABASE_URL, POSTGRES_URL, SUPABASE_DB_URL.
 *
 * Usage:
 *   npx tsx scripts/run-migration.ts supabase/migrations/add_luma_event_capacity.sql
 */

import { readFileSync } from 'fs';
import { resolve, basename } from 'path';
import { spawnSync } from 'child_process';

for (const file of ['.env.production.local', '.env.local']) {
  let content: string;
  try {
    content = readFileSync(resolve(process.cwd(), file), 'utf-8');
  } catch {
    continue;
  }
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    const val = trimmed.slice(eqIdx + 1);
    if (!process.env[key]) process.env[key] = val;
  }
}

const migrationPath = process.argv[2];
if (!migrationPath) {
  console.error('usage: npx tsx scripts/run-migration.ts <path-to-sql>');
  process.exit(1);
}

const candidates = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'SUPABASE_DB_URL',
  'SUPABASE_DATABASE_URL',
] as const;

const dbUrl = candidates.map((k) => process.env[k]).find((v) => v && v.trim().length > 0);

if (!dbUrl) {
  console.error(
    `No Postgres URL found in env. Checked: ${candidates.join(', ')}.\n` +
      'Add one of these to .env.production.local (e.g. from Supabase project settings → Database → Connection string), then re-run.',
  );
  process.exit(1);
}

const absMigration = resolve(process.cwd(), migrationPath);
const sql = readFileSync(absMigration, 'utf-8');
const safeUrl = dbUrl.replace(/:[^:@]*@/, ':***@');

console.log(`\nMigration:  ${basename(absMigration)}`);
console.log(`Connection: ${safeUrl}`);
console.log(`\n--- SQL ---`);
console.log(sql);
console.log(`--- END SQL ---\n`);

const result = spawnSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', absMigration], {
  stdio: 'inherit',
});

if (result.error) {
  console.error('psql spawn failed:', result.error.message);
  process.exit(1);
}
if (typeof result.status === 'number' && result.status !== 0) {
  console.error(`\npsql exited with code ${result.status}`);
  process.exit(result.status);
}
console.log('\n✓ Migration applied successfully.');
