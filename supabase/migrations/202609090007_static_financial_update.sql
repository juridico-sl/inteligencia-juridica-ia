begin;

create or replace function public.update_process_financial(process_id uuid, field_name text, amount numeric, change_reason text)
returns public.processes language plpgsql volatile security definer set search_path=public as $$
declare previous public.processes; old_amount numeric; result public.processes;
begin
  if not public.has_permission('risk.update') then raise exception 'access_denied' using errcode='42501'; end if;
  if field_name not in ('claim_value','estimated_exposure','provision','settlement_value','paid_value','recovered_value') or amount<0 or trim(change_reason)='' then raise exception 'invalid_financial_change' using errcode='22023'; end if;
  select * into previous from public.processes where id=process_id and deleted_at is null for update;
  if previous.id is null then raise exception 'not_found' using errcode='P0002'; end if;
  old_amount := case field_name when 'claim_value' then previous.claim_value when 'estimated_exposure' then previous.estimated_exposure when 'provision' then previous.provision when 'settlement_value' then previous.settlement_value when 'paid_value' then previous.paid_value else previous.recovered_value end;
  update public.processes set
    claim_value=case when field_name='claim_value' then amount else claim_value end,
    estimated_exposure=case when field_name='estimated_exposure' then amount else estimated_exposure end,
    provision=case when field_name='provision' then amount else provision end,
    settlement_value=case when field_name='settlement_value' then amount else settlement_value end,
    paid_value=case when field_name='paid_value' then amount else paid_value end,
    recovered_value=case when field_name='recovered_value' then amount else recovered_value end
  where id=process_id returning * into result;
  insert into public.process_financial_history(process_id,field,previous_value,new_value,reason,changed_by) values(process_id,field_name,old_amount,amount,change_reason,auth.uid());
  return result;
end $$;

commit;
