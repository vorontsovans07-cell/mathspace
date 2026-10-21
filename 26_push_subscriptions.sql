-- Run after Stage 25. Device subscriptions are private to their owners.
begin;
create table if not exists public.ms_push_subscriptions (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique,
 p256dh text not null,
 auth_key text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint ms_push_endpoint_len check (length(endpoint) between 30 and 2048),
 constraint ms_push_keys_len check (length(p256dh) between 30 and 512 and length(auth_key) between 10 and 512)
);
create index if not exists ms_push_subscriptions_user_idx on public.ms_push_subscriptions(user_id);
alter table public.ms_push_subscriptions enable row level security;
revoke all on public.ms_push_subscriptions from public,anon,authenticated;
grant select,insert,delete on public.ms_push_subscriptions to authenticated;
-- A user can add their own device, see their devices, and remove them.
drop policy if exists ms_push_select on public.ms_push_subscriptions;
create policy ms_push_select on public.ms_push_subscriptions for select to authenticated using(user_id=auth.uid());
drop policy if exists ms_push_insert on public.ms_push_subscriptions;
create policy ms_push_insert on public.ms_push_subscriptions for insert to authenticated with check(user_id=auth.uid());
drop policy if exists ms_push_delete on public.ms_push_subscriptions;
create policy ms_push_delete on public.ms_push_subscriptions for delete to authenticated using(user_id=auth.uid());
-- No client UPDATE: changing ownership of an existing endpoint is disallowed.
notify pgrst, 'reload schema';
commit;
