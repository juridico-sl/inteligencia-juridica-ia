begin;

alter table public.law_firms add column responsible_user_id uuid references public.profiles(id);

create view public.law_firm_metrics with (security_invoker=true) as
select lf.id,lf.name,lf.contact_name,lf.email,lf.phone,lf.practice_areas,lf.responsible_user_id,owner.full_name responsible_name,
  coalesce(pm.active_processes,0) active_processes,coalesce(pm.closed_processes,0) closed_processes,coalesce(pm.amount_involved,0) amount_involved,
  dm.average_deadline_days,coalesce(cm.processes_by_category,'{}'::jsonb) processes_by_category
from public.law_firms lf
left join public.profiles owner on owner.id=lf.responsible_user_id
left join lateral (
  select count(*) filter(where p.status='active') active_processes,count(*) filter(where p.status='closed') closed_processes,sum(coalesce(p.claim_value,0)) amount_involved
  from public.processes p where p.law_firm_id=lf.id and p.deleted_at is null
) pm on true
left join lateral (
  select round(avg(extract(epoch from (d.due_at-d.created_at))/86400)::numeric,1) average_deadline_days
  from public.deadlines d join public.processes p on p.id=d.process_id
  where p.law_firm_id=lf.id and p.deleted_at is null and d.deleted_at is null and d.due_at>=d.created_at
) dm on true
left join lateral (
  select jsonb_object_agg(category,total) processes_by_category from (
    select coalesce(c.name,'Sem categoria') category,count(*) total from public.processes p left join public.categories c on c.id=p.category_id
    where p.law_firm_id=lf.id and p.deleted_at is null group by coalesce(c.name,'Sem categoria')
  ) grouped
) cm on true
where lf.deleted_at is null;

grant select on public.law_firm_metrics to authenticated;

insert into public.system_settings(key,value,description) values
('ai.model','"mimo-v2.5-pro"','Modelo principal da IA'),
('ai.features_enabled','["chat","drafts","movement_analysis","embeddings"]','Funcionalidades de IA habilitadas'),
('retention.document_days','3650','Retenção de documentos arquivados'),
('retention.temporary_days','7','Retenção de arquivos temporários')
on conflict(key) do nothing;

commit;
