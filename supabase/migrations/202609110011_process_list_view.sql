begin;

create view public.process_list with (security_invoker=true) as
select p.id,p.process_number,p.company_id,p.business_unit_id,p.category_id,p.responsible_user_id,p.law_firm_id,p.status,p.risk_level,p.claim_value,p.provision,p.last_synced_at,p.monitoring_enabled,p.court_name,p.state,p.filing_date,p.created_at,p.updated_at,
  coalesce(c.trade_name,c.legal_name) company_name,c.cnpj company_cnpj,u.name unit_name,category.name category_name,profile.full_name responsible_name,firm.name law_firm_name,
  coalesce((select string_agg(party.name,', ' order by party.name) from public.process_parties pp join public.parties party on party.id=pp.party_id where pp.process_id=p.id),'') party_names,
  (select max(movement_date) from public.process_movements movement where movement.process_id=p.id) last_movement_at,
  (select min(due_at) from public.deadlines deadline where deadline.process_id=p.id and deadline.deleted_at is null and deadline.status in ('pending_confirmation','confirmed','overdue')) next_deadline_at
from public.processes p
left join public.companies c on c.id=p.company_id
left join public.business_units u on u.id=p.business_unit_id
left join public.categories category on category.id=p.category_id
left join public.profiles profile on profile.id=p.responsible_user_id
left join public.law_firms firm on firm.id=p.law_firm_id
where p.deleted_at is null;

revoke all on public.process_list from public,anon;
grant select on public.process_list to authenticated;

commit;
