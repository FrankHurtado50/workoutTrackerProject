-- Workout Tracker social features
-- Run this entire file once in the Supabase SQL Editor.

create table if not exists public.profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    username text,
    display_name text not null default 'Athlete',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint profiles_username_format check (
        username is null or username ~ '^[a-z0-9_]{3,20}$'
    )
);

create unique index if not exists profiles_username_lower_unique
on public.profiles (lower(username))
where username is not null;

create index if not exists profiles_username_search_idx
on public.profiles (lower(username) text_pattern_ops)
where username is not null;

create table if not exists public.friend_connections (
    id uuid primary key default gen_random_uuid(),
    requester_id uuid not null references public.profiles(user_id) on delete cascade,
    addressee_id uuid not null references public.profiles(user_id) on delete cascade,
    status text not null default 'pending',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint friend_connections_no_self check (requester_id <> addressee_id),
    constraint friend_connections_status check (status in ('pending', 'accepted', 'declined'))
);

create unique index if not exists friend_connections_unique_pair
on public.friend_connections (
    least(requester_id::text, addressee_id::text),
    greatest(requester_id::text, addressee_id::text)
);

create index if not exists friend_connections_requester_idx
on public.friend_connections (requester_id, status);

create index if not exists friend_connections_addressee_idx
on public.friend_connections (addressee_id, status);

create table if not exists public.wall_posts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(user_id) on delete cascade,
    workout_id text,
    workout jsonb not null,
    caption text not null default '',
    created_at timestamptz not null default now(),
    constraint wall_posts_workout_object check (jsonb_typeof(workout) = 'object'),
    constraint wall_posts_caption_length check (char_length(caption) <= 300)
);

create index if not exists wall_posts_user_created_idx
on public.wall_posts (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.friend_connections enable row level security;
alter table public.wall_posts enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.friend_connections from anon, authenticated;
revoke all on table public.wall_posts from anon, authenticated;

grant select on table public.profiles to authenticated;
grant select on table public.friend_connections to authenticated;
grant select, insert, delete on table public.wall_posts to authenticated;

drop policy if exists "Signed in users can view social profiles" on public.profiles;
create policy "Signed in users can view social profiles"
on public.profiles for select
to authenticated
using (username is not null);

drop policy if exists "Users can view their own profile before choosing a username" on public.profiles;
create policy "Users can view their own profile before choosing a username"
on public.profiles for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their own connections" on public.friend_connections;
create policy "Users can view their own connections"
on public.friend_connections for select
to authenticated
using ((select auth.uid()) in (requester_id, addressee_id));

drop policy if exists "Users can view their own and friends wall posts" on public.wall_posts;
create policy "Users can view their own and friends wall posts"
on public.wall_posts for select
to authenticated
using (
    user_id = (select auth.uid())
    or exists (
        select 1
        from public.friend_connections connection
        where connection.status = 'accepted'
          and (
              (connection.requester_id = (select auth.uid()) and connection.addressee_id = wall_posts.user_id)
              or
              (connection.addressee_id = (select auth.uid()) and connection.requester_id = wall_posts.user_id)
          )
    )
);

drop policy if exists "Users can create their own wall posts" on public.wall_posts;
create policy "Users can create their own wall posts"
on public.wall_posts for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own wall posts" on public.wall_posts;
create policy "Users can delete their own wall posts"
on public.wall_posts for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.handle_new_social_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    requested_username text;
    requested_name text;
begin
    requested_username := nullif(lower(btrim(new.raw_user_meta_data ->> 'username')), '');
    requested_name := coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'first_name'), ''),
        nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
        'Athlete'
    );

    insert into public.profiles (user_id, username, display_name)
    values (new.id, requested_username, requested_name)
    on conflict (user_id) do update
    set username = coalesce(public.profiles.username, excluded.username),
        display_name = excluded.display_name,
        updated_at = now();

    return new;
end;
$$;

drop trigger if exists on_auth_user_created_social_profile on auth.users;
create trigger on_auth_user_created_social_profile
after insert or update of raw_user_meta_data on auth.users
for each row execute function public.handle_new_social_profile();

insert into public.profiles (user_id, username, display_name)
select
    users.id,
    null,
    coalesce(
        nullif(btrim(users.raw_user_meta_data ->> 'first_name'), ''),
        nullif(split_part(users.email, '@', 1), ''),
        'Athlete'
    )
from auth.users users
on conflict (user_id) do nothing;

create or replace function public.is_username_available(p_username text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
    select
        lower(btrim(coalesce(p_username, ''))) ~ '^[a-z0-9_]{3,20}$'
        and not exists (
            select 1 from public.profiles
            where lower(username) = lower(btrim(p_username))
        );
$$;

create or replace function public.set_my_username(p_username text)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    clean_username text := lower(btrim(coalesce(p_username, '')));
    updated_profile public.profiles;
begin
    if auth.uid() is null then
        raise exception 'You must be signed in.';
    end if;
    if clean_username !~ '^[a-z0-9_]{3,20}$' then
        raise exception 'Username must be 3 to 20 characters using letters, numbers, or underscores.';
    end if;

    update public.profiles
    set username = clean_username,
        updated_at = now()
    where user_id = auth.uid()
      and username is null
    returning * into updated_profile;

    if updated_profile.user_id is null then
        raise exception 'Your username is already set.';
    end if;
    return updated_profile;
exception
    when unique_violation then
        raise exception 'That username is already taken.';
end;
$$;

drop function if exists public.search_social_profiles(text);
create function public.search_social_profiles(p_query text)
returns table (
    connection_id uuid,
    user_id uuid,
    username text,
    display_name text,
    relationship text
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
    select
        connection.id,
        profile.user_id,
        profile.username,
        profile.display_name,
        case
            when connection.status = 'accepted' then 'friend'
            when connection.status = 'pending' and connection.requester_id = auth.uid() then 'pending_sent'
            when connection.status = 'pending' and connection.addressee_id = auth.uid() then 'pending_received'
            else 'none'
        end as relationship
    from public.profiles profile
    left join public.friend_connections connection
      on (
          (connection.requester_id = auth.uid() and connection.addressee_id = profile.user_id)
          or
          (connection.addressee_id = auth.uid() and connection.requester_id = profile.user_id)
      )
      and connection.status in ('pending', 'accepted')
    where auth.uid() is not null
      and profile.user_id <> auth.uid()
      and profile.username is not null
      and lower(profile.username) like lower(btrim(coalesce(p_query, ''))) || '%'
    order by profile.username
    limit 25;
$$;

create or replace function public.get_my_social_connections()
returns table (
    connection_id uuid,
    user_id uuid,
    username text,
    display_name text,
    relationship text,
    created_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
    select
        connection.id,
        other_profile.user_id,
        other_profile.username,
        other_profile.display_name,
        case
            when connection.status = 'accepted' then 'friend'
            when connection.requester_id = auth.uid() then 'pending_sent'
            else 'pending_received'
        end,
        connection.created_at
    from public.friend_connections connection
    join public.profiles other_profile
      on other_profile.user_id = case
          when connection.requester_id = auth.uid() then connection.addressee_id
          else connection.requester_id
      end
    where auth.uid() is not null
      and auth.uid() in (connection.requester_id, connection.addressee_id)
      and connection.status in ('pending', 'accepted')
    order by connection.status, connection.created_at desc;
$$;

create or replace function public.send_friend_request(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    existing_connection public.friend_connections;
begin
    if auth.uid() is null then raise exception 'You must be signed in.'; end if;
    if p_user_id = auth.uid() then raise exception 'You cannot add yourself.'; end if;
    if not exists (select 1 from public.profiles where user_id = p_user_id and username is not null) then
        raise exception 'That user could not be found.';
    end if;

    select * into existing_connection
    from public.friend_connections
    where least(requester_id::text, addressee_id::text) = least(auth.uid()::text, p_user_id::text)
      and greatest(requester_id::text, addressee_id::text) = greatest(auth.uid()::text, p_user_id::text)
    for update;

    if existing_connection.id is null then
        insert into public.friend_connections (requester_id, addressee_id, status)
        values (auth.uid(), p_user_id, 'pending');
        return 'pending_sent';
    elsif existing_connection.status = 'accepted' then
        return 'friend';
    elsif existing_connection.status = 'pending' and existing_connection.addressee_id = auth.uid() then
        update public.friend_connections
        set status = 'accepted', updated_at = now()
        where id = existing_connection.id;
        return 'friend';
    else
        update public.friend_connections
        set requester_id = auth.uid(), addressee_id = p_user_id, status = 'pending', updated_at = now()
        where id = existing_connection.id;
        return 'pending_sent';
    end if;
end;
$$;

create or replace function public.respond_to_friend_request(p_connection_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    updated_status text;
begin
    update public.friend_connections
    set status = case when p_accept then 'accepted' else 'declined' end,
        updated_at = now()
    where id = p_connection_id
      and addressee_id = auth.uid()
      and status = 'pending'
    returning status into updated_status;

    if updated_status is null then raise exception 'That friend request is no longer available.'; end if;
    return updated_status;
end;
$$;

create or replace function public.remove_social_connection(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    removed_count integer;
begin
    delete from public.friend_connections
    where auth.uid() is not null
      and (
          (requester_id = auth.uid() and addressee_id = p_user_id)
          or
          (addressee_id = auth.uid() and requester_id = p_user_id)
      );
    get diagnostics removed_count = row_count;
    return removed_count > 0;
end;
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

revoke all on function public.set_my_username(text) from public, anon;
grant execute on function public.set_my_username(text) to authenticated;

revoke all on function public.search_social_profiles(text) from public, anon;
grant execute on function public.search_social_profiles(text) to authenticated;

revoke all on function public.get_my_social_connections() from public, anon;
grant execute on function public.get_my_social_connections() to authenticated;

revoke all on function public.send_friend_request(uuid) from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;

revoke all on function public.respond_to_friend_request(uuid, boolean) from public, anon;
grant execute on function public.respond_to_friend_request(uuid, boolean) to authenticated;

revoke all on function public.remove_social_connection(uuid) from public, anon;
grant execute on function public.remove_social_connection(uuid) to authenticated;

notify pgrst, 'reload schema';
