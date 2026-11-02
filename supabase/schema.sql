-- SignBridge database (Supabase / PostgreSQL)
-- Run once: Supabase dashboard -> SQL Editor -> New query -> paste this whole file -> Run.
-- Then run seed.sql. Safe to run again (it skips things that already exist).

-- =========================================================================
-- 1. TABLES
-- =========================================================================

-- One row per user, created automatically when someone signs up (trigger below).
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  role       text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

-- The sign vocabulary.
create table if not exists public.signs (
  id                   bigint generated always as identity primary key,
  english              text not null unique,
  urdu                 text not null,
  category             text not null check (category in ('alphabet', 'greeting', 'classroom', 'daily')),
  sign_type            text not null check (sign_type in ('static', 'dynamic')),
  model_label          int unique,      -- the class number the model uses; NULL = not trained yet
  reference_video_path text,            -- path inside the 'sign-media' bucket, e.g. 'videos/thank-you.mp4'
  reference_image_path text,            -- path inside the 'sign-media' bucket, e.g. 'images/a.png'
  created_at           timestamptz not null default now()
);

-- Recorded training samples. landmarks = RAW points [frame][hand][21][x,y,z] (decisions.md D4).
create table if not exists public.samples (
  id          bigint generated always as identity primary key,
  sign_id     bigint not null references public.signs(id) on delete cascade,
  recorded_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  signer_code text not null check (signer_code ~ '^S[0-9]{2}$'),   -- e.g. 'S01'
  num_frames  int not null check (num_frames > 0),
  landmarks   jsonb not null,
  lighting    text check (lighting in ('bright', 'normal', 'dim')),
  background  text check (background in ('plain', 'busy')),
  is_valid    boolean not null default true,   -- set false to exclude a bad sample from training
  created_at  timestamptz not null default now()
);
create index if not exists samples_sign_id_idx on public.samples(sign_id);
create index if not exists samples_recorded_by_idx on public.samples(recorded_by);

-- Each user's saved translations.
create table if not exists public.translations (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  english_text text not null,
  urdu_text    text not null,
  confidence   real check (confidence between 0 and 1),
  created_at   timestamptz not null default now()
);
create index if not exists translations_user_id_idx on public.translations(user_id);

-- =========================================================================
-- 2. HELPERS
-- =========================================================================

-- Is the logged-in user an admin? (security definer: it can read profiles even though
-- profiles has RLS, without causing an infinite loop in the policies.)
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Create a profile automatically for every new user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users must not be able to make themselves admin.
create or replace function public.protect_role()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() and auth.uid() is not null then
    raise exception 'Only an admin can change roles';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_role();

-- Per-sign sample counts, for the Record Samples page.
-- security_invoker = true means the view obeys RLS: users see counts of their own samples,
-- admins see everyone's.
create or replace view public.sample_counts with (security_invoker = true) as
  select sign_id, signer_code, count(*)::int as total
  from public.samples
  where is_valid
  group by sign_id, signer_code;

-- =========================================================================
-- 3. ROW LEVEL SECURITY (on for every table - decisions.md D10)
-- =========================================================================
alter table public.profiles     enable row level security;
alter table public.signs        enable row level security;
alter table public.samples      enable row level security;
alter table public.translations enable row level security;

-- profiles: you see and edit your own; admins see all.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- signs: everyone (even logged out) reads; only admins add / change / delete.
drop policy if exists signs_select on public.signs;
create policy signs_select on public.signs for select to anon, authenticated using (true);
drop policy if exists signs_admin_insert on public.signs;
create policy signs_admin_insert on public.signs for insert to authenticated with check (public.is_admin());
drop policy if exists signs_admin_update on public.signs;
create policy signs_admin_update on public.signs for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists signs_admin_delete on public.signs;
create policy signs_admin_delete on public.signs for delete to authenticated using (public.is_admin());

-- samples: users add and read their own (and can fix / delete their own); admins read and manage all.
drop policy if exists samples_insert_own on public.samples;
create policy samples_insert_own on public.samples for insert to authenticated
  with check (recorded_by = auth.uid());
drop policy if exists samples_select on public.samples;
create policy samples_select on public.samples for select to authenticated
  using (recorded_by = auth.uid() or public.is_admin());
drop policy if exists samples_update on public.samples;
create policy samples_update on public.samples for update to authenticated
  using (recorded_by = auth.uid() or public.is_admin())
  with check (recorded_by = auth.uid() or public.is_admin());
drop policy if exists samples_delete on public.samples;
create policy samples_delete on public.samples for delete to authenticated
  using (recorded_by = auth.uid() or public.is_admin());

-- translations: private to each user.
drop policy if exists translations_own on public.translations;
create policy translations_own on public.translations for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =========================================================================
-- 4. STORAGE: 'sign-media' bucket (public read, admins upload)
-- =========================================================================
insert into storage.buckets (id, name, public)
values ('sign-media', 'sign-media', true)
on conflict (id) do nothing;

drop policy if exists sign_media_admin_insert on storage.objects;
create policy sign_media_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'sign-media' and public.is_admin());
drop policy if exists sign_media_admin_update on storage.objects;
create policy sign_media_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'sign-media' and public.is_admin());
drop policy if exists sign_media_admin_delete on storage.objects;
create policy sign_media_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'sign-media' and public.is_admin());