-- Persistent rate limit store, atomic increment via RPC.
-- Replaces the in-memory Map in lib/rateLimit.ts, which did not work
-- across serverless / multi-instance deployments.

create table if not exists public.rate_limits (
  key         text        primary key,
  count       integer     not null default 0,
  reset_at    timestamptz not null,
  updated_at  timestamptz not null default now()
);

create index if not exists rate_limits_reset_at_idx on public.rate_limits (reset_at);

-- Service role only: this table is never read from the client.
alter table public.rate_limits enable row level security;

create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now       timestamptz := now();
  v_reset     timestamptz;
  v_count     integer;
  v_existing  public.rate_limits%rowtype;
begin
  select * into v_existing
    from public.rate_limits
    where key = p_key
    for update;

  if not found or v_existing.reset_at <= v_now then
    v_reset := v_now + make_interval(secs => p_window_seconds);
    insert into public.rate_limits (key, count, reset_at, updated_at)
      values (p_key, 1, v_reset, v_now)
      on conflict (key) do update
        set count = 1, reset_at = excluded.reset_at, updated_at = v_now;
    return query select true, greatest(p_limit - 1, 0), v_reset;
    return;
  end if;

  if v_existing.count >= p_limit then
    return query select false, 0, v_existing.reset_at;
    return;
  end if;

  update public.rate_limits
    set count = count + 1, updated_at = v_now
    where key = p_key
    returning count into v_count;

  return query select true, greatest(p_limit - v_count, 0), v_existing.reset_at;
end;
$$;

-- Housekeeping helper: delete expired rows. Call from a cron / edge fn.
create or replace function public.cleanup_rate_limits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.rate_limits where reset_at <= now();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;
