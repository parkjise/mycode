grant delete on table public.mycode_vue_answers to authenticated;

create policy "Delete own Code Q&A answers"
  on public.mycode_vue_answers for delete to authenticated
  using ((select auth.uid()) = user_id);
