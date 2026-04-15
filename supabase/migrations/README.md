# Supabase Migrations

Supabase applies migrations in **alphabetical order by filename**. The files in
this directory do not use timestamped prefixes, so ordering relies on the
naming conventions documented below.

## Canonical apply order (fresh environment)

1. `create_auth_tables.sql`
2. `create_orders_table.sql` (also defines `update_updated_at_column()`)
3. `create_visitors_table.sql`
4. `create_email_logs_table.sql`
5. `create_notification_logs_table.sql`
6. `create_tracking_events_table.sql`
7. `add_email_queue_status.sql`
8. `add_notification_detail_tracking.sql`
9. `add_visitor_id_to_subscriptions_and_orders.sql` *(legacy; superseded — see below)*
10. `add_weekly_backer_to_orders_tier.sql`
11. `fix_rls_policies.sql`
12. `migrate_visitor_id_to_fingerprint.sql` *(legacy one-shot — see below)*
13. `z_add_visitor_id_to_subscriptions_and_orders.sql` *(idempotent replacement)*
14. `create_members_enriched_view.sql`
15. `zz_create_newsletter_subscriptions.sql`
16. `zz_create_award_votes.sql`
17. `zz_create_ig_posts.sql`
18. `zz_add_constraints_and_indexes.sql`

## Naming conventions

- `create_*.sql` — new tables
- `add_*.sql` — additive schema changes (columns, indexes, policies)
- `migrate_*.sql` — one-shot schema transforms (destructive; read before running)
- `fix_*.sql` — policy/security tightening
- `z_*.sql` / `zz_*.sql` — ordering prefix used to force a migration to run
  after everything lexicographically lower. Used for migrations that depend on
  the entire previous state (e.g. creating tables that were originally only
  in the dashboard).

## Known quirks

- **`migrate_visitor_id_to_fingerprint.sql` is destructive on fresh installs.**
  It `DROP TABLE visitors` then recreates it. On an empty database this
  effectively rebuilds the table from scratch; on a populated one it is
  meant as a one-shot UUID→fingerprint transform. Do not edit without
  understanding both call sites.
- **`z_add_visitor_id_to_subscriptions_and_orders.sql` duplicates the tail of
  `migrate_visitor_id_to_fingerprint.sql`** but is written with
  `IF NOT EXISTS`, so it is a safe no-op after the migrate file has run.
- **`newsletter_subscriptions`, `award_votes`, `ig_posts` were historically
  dashboard-only tables.** `zz_create_*` migrations declare them with
  `CREATE TABLE IF NOT EXISTS` plus `ADD COLUMN IF NOT EXISTS`, so applying
  them to an existing deployment is a no-op while still making fresh environments
  reproducible. This closes the gap that caused `fix_rls_policies.sql` to
  reference non-existent tables.

## Follow-ups (not yet migrations)

- `notification_logs.sent_by` is `TEXT` (admin email). Converting it to
  `UUID REFERENCES admin_users(id)` requires an `admin_users` table that
  does not exist yet.
- PII (emails, IP, phone) is stored unencrypted. GDPR deletion workflow and
  encryption-at-rest review pending.
- Unsubscribe/vote tokens are deterministic HMAC blobs that encode the email.
  Replacing with random one-time tokens is pending.
