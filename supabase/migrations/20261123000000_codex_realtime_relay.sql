create policy "MyCode owner receives Codex broadcasts"
  on realtime.messages for select to authenticated
  using (
    extension = 'broadcast'
    and (select realtime.topic()) = ('mycode-codex:' || (select auth.uid())::text)
  );

create policy "MyCode owner sends Codex broadcasts"
  on realtime.messages for insert to authenticated
  with check (
    extension = 'broadcast'
    and (select realtime.topic()) = ('mycode-codex:' || (select auth.uid())::text)
  );
