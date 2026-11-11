-- Run this entire file once in Supabase: SQL Editor > New query > Run.

create table if not exists public.photo_board_items (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    storage_path text not null unique,
    caption text not null default '',
    photo_type text not null default 'inspiration',
    photo_date date,
    is_featured boolean not null default false,
    is_home_background boolean not null default false,
    created_at timestamptz not null default now(),
    constraint photo_board_type_check check (photo_type in ('inspiration', 'progress')),
    constraint photo_board_caption_length check (char_length(caption) <= 120)
);

create index if not exists photo_board_items_user_created_idx
on public.photo_board_items (user_id, created_at desc);

create unique index if not exists photo_board_one_featured_per_user_idx
on public.photo_board_items (user_id)
where is_featured;

create unique index if not exists photo_board_one_background_per_user_idx
on public.photo_board_items (user_id)
where is_home_background;

alter table public.photo_board_items enable row level security;

revoke all on table public.photo_board_items from anon, authenticated;
grant select, insert, update, delete on table public.photo_board_items to authenticated;

drop policy if exists "Users can read their own photo board" on public.photo_board_items;
create policy "Users can read their own photo board"
on public.photo_board_items for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can add to their own photo board" on public.photo_board_items;
create policy "Users can add to their own photo board"
on public.photo_board_items for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own photo board" on public.photo_board_items;
create policy "Users can update their own photo board"
on public.photo_board_items for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete from their own photo board" on public.photo_board_items;
create policy "Users can delete from their own photo board"
on public.photo_board_items for delete
to authenticated
using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'photo-board',
    'photo-board',
    false,
    8388608,
    array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can view their own photo files" on storage.objects;
create policy "Users can view their own photo files"
on storage.objects for select
to authenticated
using (
    bucket_id = 'photo-board'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can upload their own photo files" on storage.objects;
create policy "Users can upload their own photo files"
on storage.objects for insert
to authenticated
with check (
    bucket_id = 'photo-board'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can update their own photo files" on storage.objects;
create policy "Users can update their own photo files"
on storage.objects for update
to authenticated
using (
    bucket_id = 'photo-board'
    and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
    bucket_id = 'photo-board'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can delete their own photo files" on storage.objects;
create policy "Users can delete their own photo files"
on storage.objects for delete
to authenticated
using (
    bucket_id = 'photo-board'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

notify pgrst, 'reload schema';
