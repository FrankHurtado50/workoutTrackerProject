-- Run this entire file once in Supabase: SQL Editor > New query > Run.

create table if not exists public.user_data (
    user_id uuid primary key references auth.users(id) on delete cascade,
    first_name text not null default '',
    workouts jsonb not null default '[]'::jsonb,
    routines jsonb not null default '[]'::jsonb,
    routine_progress jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    constraint user_data_workouts_array check (jsonb_typeof(workouts) = 'array'),
    constraint user_data_routines_array check (jsonb_typeof(routines) = 'array'),
    constraint user_data_progress_object check (jsonb_typeof(routine_progress) = 'object')
);

alter table public.user_data enable row level security;

revoke all on table public.user_data from anon, authenticated;
grant select, insert, update, delete on table public.user_data to authenticated;

drop policy if exists "Users can read their own workout data" on public.user_data;
create policy "Users can read their own workout data"
on public.user_data for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own workout data" on public.user_data;
create policy "Users can create their own workout data"
on public.user_data for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own workout data" on public.user_data;
create policy "Users can update their own workout data"
on public.user_data for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own workout data" on public.user_data;
create policy "Users can delete their own workout data"
on public.user_data for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.get_workout_leaderboard_exercises()
returns table(exercise text)
language sql
stable
security definer
set search_path = ''
as $$
    select distinct workout.value ->> 'exercise' as exercise
    from public.user_data as account
    cross join lateral jsonb_array_elements(account.workouts) as workout(value)
    where nullif(btrim(workout.value ->> 'exercise'), '') is not null
    order by exercise;
$$;

create or replace function public.get_workout_leaderboard(p_exercise text, p_metric text)
returns table(
    user_id uuid,
    display_name text,
    score numeric,
    recorded_at timestamptz,
    is_current_user boolean
)
language sql
stable
security definer
set search_path = ''
as $$
    with scored_workouts as (
        select
            account.user_id,
            coalesce(nullif(btrim(account.first_name), ''), 'Athlete') as display_name,
            coalesce(nullif(workout.value ->> 'recordedAt', '')::timestamptz, account.updated_at) as recorded_at,
            case p_metric
                when 'weight' then
                    case
                        when jsonb_typeof(workout.value -> 'setDetails') = 'array'
                             and jsonb_array_length(workout.value -> 'setDetails') > 0
                        then coalesce((
                            select max(coalesce(nullif(set_row.value ->> 'weight', '')::numeric, 0))
                            from jsonb_array_elements(workout.value -> 'setDetails') as set_row(value)
                        ), 0)
                        else coalesce(nullif(workout.value ->> 'weight', '')::numeric, 0)
                    end
                when 'reps' then
                    case
                        when jsonb_typeof(workout.value -> 'setDetails') = 'array'
                             and jsonb_array_length(workout.value -> 'setDetails') > 0
                        then coalesce((
                            select sum(coalesce(nullif(set_row.value ->> 'reps', '')::numeric, 0))
                            from jsonb_array_elements(workout.value -> 'setDetails') as set_row(value)
                        ), 0)
                        else
                            coalesce(nullif(workout.value ->> 'reps', '')::numeric, 0)
                            * coalesce(nullif(workout.value ->> 'sets', '')::numeric, 0)
                    end
                else coalesce(nullif(workout.value ->> 'total', '')::numeric, 0)
            end as score
        from public.user_data as account
        cross join lateral jsonb_array_elements(account.workouts) as workout(value)
        where lower(btrim(workout.value ->> 'exercise')) = lower(btrim(p_exercise))
    ),
    best_per_user as (
        select
            scored_workouts.*,
            row_number() over (
                partition by scored_workouts.user_id
                order by scored_workouts.score desc, scored_workouts.recorded_at desc
            ) as result_position
        from scored_workouts
        where scored_workouts.score > 0
    )
    select
        best_per_user.user_id,
        best_per_user.display_name,
        best_per_user.score,
        best_per_user.recorded_at,
        best_per_user.user_id = (select auth.uid()) as is_current_user
    from best_per_user
    where best_per_user.result_position = 1
    order by best_per_user.score desc, best_per_user.display_name;
$$;

revoke all on function public.get_workout_leaderboard_exercises() from public, anon;
grant execute on function public.get_workout_leaderboard_exercises() to authenticated;

revoke all on function public.get_workout_leaderboard(text, text) from public, anon;
grant execute on function public.get_workout_leaderboard(text, text) to authenticated;

notify pgrst, 'reload schema';
