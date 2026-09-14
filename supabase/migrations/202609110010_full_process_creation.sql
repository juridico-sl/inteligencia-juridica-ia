begin;

create function public.create_full_process(input jsonb)
returns uuid language plpgsql volatile security definer set search_path=public as $$
declare created public.processes; field_row record;
begin
  if not public.has_permission('process.create') then raise exception 'access_denied' using errcode='42501'; end if;
  if coalesce(input->>'monitoring_frequency','0 6,10,14,18 * * *') not in ('0 * * * *','0 6,10,14,18 * * *','0 6,18 * * *','0 6 * * *','0 8 * * *') then raise exception 'invalid_monitoring_frequency' using errcode='22023'; end if;
  insert into public.processes(process_number,company_id,business_unit_id,category_id,subcategory,responsible_user_id,law_firm_id,status,risk_level,probability,impact,claim_value,estimated_exposure,provision,notes,tags,monitoring_enabled,monitoring_frequency,created_by)
  values(input->>'process_number',nullif(input->>'company_id','')::uuid,nullif(input->>'business_unit_id','')::uuid,nullif(input->>'category_id','')::uuid,nullif(input->>'subcategory',''),nullif(input->>'responsible_user_id','')::uuid,nullif(input->>'law_firm_id','')::uuid,coalesce(input->>'status','draft')::public.process_status,coalesce(input->>'risk_level','medium')::public.risk_level,nullif(input->>'probability','')::numeric,nullif(input->>'impact','')::numeric,nullif(input->>'claim_value','')::numeric,nullif(input->>'estimated_exposure','')::numeric,nullif(input->>'provision','')::numeric,nullif(input->>'notes',''),array(select jsonb_array_elements_text(coalesce(input->'tags','[]'::jsonb))),coalesce((input->>'monitoring_enabled')::boolean,true),coalesce(input->>'monitoring_frequency','0 6,10,14,18 * * *'),auth.uid()) returning * into created;
  insert into public.process_risk_history(process_id,new_level,new_probability,new_impact,reason,changed_by)
  values(created.id,created.risk_level,created.probability,created.impact,'Cadastro inicial',auth.uid());
  for field_row in select * from (values ('claim_value',created.claim_value),('estimated_exposure',created.estimated_exposure),('provision',created.provision)) fields(name,amount) where amount is not null loop
    insert into public.process_financial_history(process_id,field,new_value,reason,changed_by) values(created.id,field_row.name,field_row.amount,'Cadastro inicial',auth.uid());
  end loop;
  insert into public.job_queue(type,payload,idempotency_key) values('sync_process',jsonb_build_object('process_id',created.id,'reason','new_process'),'new-process:'||created.id);
  return created.id;
end $$;

revoke all on function public.create_full_process(jsonb) from public,anon;
grant execute on function public.create_full_process(jsonb) to authenticated;

commit;
