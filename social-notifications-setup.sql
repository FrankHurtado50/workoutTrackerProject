-- Workout Tracker likes, comments, and notification bell
-- Run this entire file once in the Supabase SQL Editor after social-setup.sql.

create table if not exists public.wall_post_likes (
    post_id uuid not null references public.wall_posts(id) on delete cascade,
    user_id uuid not null references public.profiles(user_id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (post_id, user_id)
);

create index if not exists wall_post_likes_user_created_idx
on public.wall_post_likes (user_id, created_at desc);

create table if not exists public.wall_post_comments (
    id uuid primary key default gen_random_uuid(),
    post_id uuid not null references public.wall_posts(id) on delete cascade,
    user_id uuid not null references public.profiles(user_id) on delete cascade,
    body text not null,
    created_at timestamptz not null default now(),
    constraint wall_post_comments_body_length check (
        char_length(btrim(body)) between 1 and 240
    )
);

create index if not exists wall_post_comments_post_created_idx
on public.wall_post_comments (post_id, created_at);

create table if not exists public.social_notifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(user_id) on delete cascade,
    actor_id uuid not null references public.profiles(user_id) on delete cascade,
    notification_type text not null,
    post_id uuid references public.wall_posts(id) on delete cascade,
    connection_id uuid references public.friend_connections(id) on delete cascade,
    comment_id uuid references public.wall_post_comments(id) on delete cascade,
    is_read boolean not null default false,
    created_at timestamptz not null default now(),
    constraint social_notifications_type check (
        notification_type in ('friend_request', 'friend_accepted', 'post_like', 'post_comment')
    ),
    constraint social_notifications_not_self check (user_id <> actor_id)
);

create index if not exists social_notifications_user_created_idx
on public.social_notifications (user_id, created_at desc);

create index if not exists social_notifications_user_unread_idx
on public.social_notifications (user_id, is_read, created_at desc);

alter table public.wall_post_likes enable row level security;
alter table public.wall_post_comments enable row level security;
alter table public.social_notifications enable row level security;

revoke all on table public.wall_post_likes from anon, authenticated;
revoke all on table public.wall_post_comments from anon, authenticated;
revoke all on table public.social_notifications from anon, authenticated;

grant select, insert, delete on table public.wall_post_likes to authenticated;
grant select, insert, delete on table public.wall_post_comments to authenticated;

drop policy if exists "Users can view likes on visible wall posts" on public.wall_post_likes;
create policy "Users can view likes on visible wall posts"
on public.wall_post_likes for select
to authenticated
using (
    exists (
        select 1 from public.wall_posts post
        where post.id = wall_post_likes.post_id
    )
);

drop policy if exists "Users can like visible wall posts" on public.wall_post_likes;
create policy "Users can like visible wall posts"
on public.wall_post_likes for insert
to authenticated
with check (
    user_id = (select auth.uid())
    and exists (
        select 1 from public.wall_posts post
        where post.id = wall_post_likes.post_id
    )
);

drop policy if exists "Users can remove their own wall likes" on public.wall_post_likes;
create policy "Users can remove their own wall likes"
on public.wall_post_likes for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can view comments on visible wall posts" on public.wall_post_comments;
create policy "Users can view comments on visible wall posts"
on public.wall_post_comments for select
to authenticated
using (
    exists (
        select 1 from public.wall_posts post
        where post.id = wall_post_comments.post_id
    )
);

drop policy if exists "Users can comment on visible wall posts" on public.wall_post_comments;
create policy "Users can comment on visible wall posts"
on public.wall_post_comments for insert
to authenticated
with check (
    user_id = (select auth.uid())
    and exists (
        select 1 from public.wall_posts post
        where post.id = wall_post_comments.post_id
    )
);

drop policy if exists "Users can delete permitted wall comments" on public.wall_post_comments;
create policy "Users can delete permitted wall comments"
on public.wall_post_comments for delete
to authenticated
using (
    user_id = (select auth.uid())
    or exists (
        select 1 from public.wall_posts post
        where post.id = wall_post_comments.post_id
          and post.user_id = (select auth.uid())
    )
);

drop policy if exists "Users can view their own social notifications" on public.social_notifications;
create policy "Users can view their own social notifications"
on public.social_notifications for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can update their own social notifications" on public.social_notifications;
create policy "Users can update their own social notifications"
on public.social_notifications for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create or replace function public.notify_wall_post_like()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    post_owner uuid;
begin
    if tg_op = 'DELETE' then
        select user_id into post_owner from public.wall_posts where id = old.post_id;
        delete from public.social_notifications
        where user_id = post_owner
          and actor_id = old.user_id
          and notification_type = 'post_like'
          and post_id = old.post_id;
        return old;
    end if;

    select user_id into post_owner from public.wall_posts where id = new.post_id;
    if post_owner is not null and post_owner <> new.user_id then
        insert into public.social_notifications (
            user_id, actor_id, notification_type, post_id
        ) values (
            post_owner, new.user_id, 'post_like', new.post_id
        );
    end if;
    return new;
end;
$$;

drop trigger if exists on_wall_post_like_notification on public.wall_post_likes;
create trigger on_wall_post_like_notification
after insert or delete on public.wall_post_likes
for each row execute function public.notify_wall_post_like();

create or replace function public.notify_wall_post_comment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    post_owner uuid;
begin
    select user_id into post_owner from public.wall_posts where id = new.post_id;
    if post_owner is not null and post_owner <> new.user_id then
        insert into public.social_notifications (
            user_id, actor_id, notification_type, post_id, comment_id
        ) values (
            post_owner, new.user_id, 'post_comment', new.post_id, new.id
        );
    end if;
    return new;
end;
$$;

drop trigger if exists on_wall_post_comment_notification on public.wall_post_comments;
create trigger on_wall_post_comment_notification
after insert on public.wall_post_comments
for each row execute function public.notify_wall_post_comment();

create or replace function public.notify_friend_connection_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if tg_op = 'INSERT' and new.status = 'pending' then
        insert into public.social_notifications (
            user_id, actor_id, notification_type, connection_id
        ) values (
            new.addressee_id, new.requester_id, 'friend_request', new.id
        );
        return new;
    end if;

    if tg_op = 'UPDATE' then
        if new.status = 'pending'
           and (
               old.status is distinct from new.status
               or old.requester_id is distinct from new.requester_id
               or old.addressee_id is distinct from new.addressee_id
           ) then
            insert into public.social_notifications (
                user_id, actor_id, notification_type, connection_id
            ) values (
                new.addressee_id, new.requester_id, 'friend_request', new.id
            );
        end if;

        if old.status = 'pending' and new.status in ('accepted', 'declined') then
            update public.social_notifications
            set is_read = true
            where user_id = new.addressee_id
              and notification_type = 'friend_request'
              and connection_id = new.id;

            if new.status = 'accepted' and new.requester_id <> new.addressee_id then
                insert into public.social_notifications (
                    user_id, actor_id, notification_type, connection_id
                ) values (
                    new.requester_id, new.addressee_id, 'friend_accepted', new.id
                );
            end if;
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists on_friend_connection_notification on public.friend_connections;
create trigger on_friend_connection_notification
after insert or update of status, requester_id, addressee_id on public.friend_connections
for each row execute function public.notify_friend_connection_change();

create or replace function public.get_my_social_notifications(p_limit integer default 30)
returns table (
    id uuid,
    notification_type text,
    actor_id uuid,
    actor_username text,
    actor_display_name text,
    post_id uuid,
    workout_name text,
    comment_preview text,
    connection_id uuid,
    is_read boolean,
    created_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
    select
        notification.id,
        notification.notification_type,
        notification.actor_id,
        actor.username,
        actor.display_name,
        notification.post_id,
        coalesce(post.workout ->> 'exercise', 'your workout'),
        left(comment.body, 80),
        notification.connection_id,
        notification.is_read,
        notification.created_at
    from public.social_notifications notification
    join public.profiles actor on actor.user_id = notification.actor_id
    left join public.wall_posts post on post.id = notification.post_id
    left join public.wall_post_comments comment on comment.id = notification.comment_id
    where notification.user_id = auth.uid()
    order by notification.created_at desc
    limit least(greatest(coalesce(p_limit, 30), 1), 50);
$$;

create or replace function public.mark_social_notifications_read(p_notification_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    updated_count integer;
begin
    update public.social_notifications
    set is_read = true
    where user_id = auth.uid()
      and (p_notification_id is null or id = p_notification_id)
      and is_read = false;
    get diagnostics updated_count = row_count;
    return updated_count;
end;
$$;

revoke all on function public.get_my_social_notifications(integer) from public, anon;
grant execute on function public.get_my_social_notifications(integer) to authenticated;

revoke all on function public.mark_social_notifications_read(uuid) from public, anon;
grant execute on function public.mark_social_notifications_read(uuid) to authenticated;

insert into public.social_notifications (
    user_id, actor_id, notification_type, connection_id, created_at
)
select
    connection.addressee_id,
    connection.requester_id,
    'friend_request',
    connection.id,
    connection.created_at
from public.friend_connections connection
where connection.status = 'pending'
  and not exists (
      select 1 from public.social_notifications notification
      where notification.notification_type = 'friend_request'
        and notification.connection_id = connection.id
  );

notify pgrst, 'reload schema';
