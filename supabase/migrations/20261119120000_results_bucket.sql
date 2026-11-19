-- Approval file. Do not apply this from the app, and do not run it against
-- production until it has been read. It does not UPDATE, DELETE, or ALTER
-- any planner_state row. It adds a private bucket for result photos when
-- that bucket is missing, and policies that let each signed-in account
-- read and write only its own folder.
--
-- Until this is applied, result photos are stored in the existing private
-- `board` bucket at `{user id}/results/…`, which the current folder policy
-- already confines to the signed-in account.

insert into storage.buckets (id, name, public)
select 'results', 'results', false
where not exists (select 1 from storage.buckets where id = 'results');

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'results_select_own'
  ) then
    create policy results_select_own on storage.objects
      for select to authenticated
      using (
        bucket_id = 'results'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'results_insert_own'
  ) then
    create policy results_insert_own on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'results'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'results_delete_own'
  ) then
    create policy results_delete_own on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'results'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

-- Read-only check, for a human, after the policies exist. Confirms
-- planner_state still has row-level policies and this file did not replace them.
-- select polname, polcmd
-- from pg_policy
-- where polrelid = 'public.planner_state'::regclass
-- order by polname;
