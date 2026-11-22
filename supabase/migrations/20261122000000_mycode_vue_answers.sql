create table public.mycode_vue_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  summary text not null,
  answer_markdown text not null,
  created_at timestamptz not null default now()
);

create index mycode_vue_answers_owner_recent
  on public.mycode_vue_answers (user_id, created_at desc);

alter table public.mycode_vue_answers enable row level security;

revoke all on table public.mycode_vue_answers from public, anon, authenticated;
grant select on table public.mycode_vue_answers to authenticated;
grant insert, select on table public.mycode_vue_answers to service_role;

create policy "Read own Code Q&A answers"
  on public.mycode_vue_answers for select to authenticated
  using ((select auth.uid()) = user_id);
