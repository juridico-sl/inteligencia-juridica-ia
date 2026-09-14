create function public.dashboard_metrics(
  filter_company_id uuid default null,
  filter_category_id uuid default null,
  filter_risk public.risk_level default null,
  filter_start_date date default null,
  filter_end_date date default null
) returns jsonb language sql stable security invoker set search_path=public as $$
with filtered as (
  select p.* from public.processes p where p.deleted_at is null
    and (filter_company_id is null or p.company_id=filter_company_id)
    and (filter_category_id is null or p.category_id=filter_category_id)
    and (filter_risk is null or p.risk_level=filter_risk)
    and (filter_start_date is null or p.created_at::date>=filter_start_date)
    and (filter_end_date is null or p.created_at::date<=filter_end_date)
), by_risk as (select risk_level::text label,count(*) value from filtered group by risk_level),
by_status as (select status::text label,count(*) value from filtered group by status),
by_category as (select coalesce(c.name,'Sem categoria') label,count(*) value from filtered f left join public.categories c on c.id=f.category_id group by c.name),
by_company as (select coalesce(c.trade_name,c.legal_name,'Sem empresa') label,count(*) value from filtered f left join public.companies c on c.id=f.company_id group by c.trade_name,c.legal_name),
by_court as (select coalesce(court_name,court,'Não informado') label,count(*) value from filtered group by court_name,court order by value desc limit 15),
by_month as (select to_char(date_trunc('month',created_at),'YYYY-MM') label,count(*) value from filtered where created_at>=now()-interval '12 months' group by 1 order by 1),
deadline_stats as (
  select count(*) filter(where d.due_at>=now() and d.due_at<=now()+interval '7 days' and d.status<>'completed') upcoming,
         count(*) filter(where d.due_at<now() and d.status<>'completed') overdue
  from public.deadlines d join filtered f on f.id=d.process_id where d.deleted_at is null
), task_stats as (
  select count(*) filter(where t.status<>'completed') open from public.tasks t join filtered f on f.id=t.process_id where t.deleted_at is null
), movement_stats as (
  select count(*) recent from public.process_movements m join filtered f on f.id=m.process_id where m.created_at>=now()-interval '24 hours'
)
select jsonb_build_object(
  'total',count(*),'active',count(*)filter(where status='active'),'closed',count(*)filter(where status='closed'),
  'unassigned',count(*)filter(where responsible_user_id is null),'claim_value',coalesce(sum(claim_value),0),
  'exposure',coalesce(sum(estimated_exposure),0),'provision',coalesce(sum(provision),0),
  'deadlines',(select upcoming from deadline_stats),'overdue',(select overdue from deadline_stats),
  'tasks',(select open from task_stats),'movements',(select recent from movement_stats),
  'by_risk',(select coalesce(jsonb_agg(to_jsonb(by_risk)),'[]')from by_risk),
  'by_status',(select coalesce(jsonb_agg(to_jsonb(by_status)),'[]')from by_status),
  'by_category',(select coalesce(jsonb_agg(to_jsonb(by_category)),'[]')from by_category),
  'by_company',(select coalesce(jsonb_agg(to_jsonb(by_company)),'[]')from by_company),
  'by_court',(select coalesce(jsonb_agg(to_jsonb(by_court)),'[]')from by_court),
  'by_month',(select coalesce(jsonb_agg(to_jsonb(by_month)),'[]')from by_month)
) from filtered;
$$;
grant execute on function public.dashboard_metrics(uuid,uuid,public.risk_level,date,date) to authenticated;

create function public.find_similar_processes(source_process_id uuid, match_count integer default 10)
returns table(id uuid, process_number text, judicial_class text, status public.process_status, risk_level public.risk_level, score numeric, reasons text[])
language sql stable security invoker set search_path=public as $$
with source as (select * from public.processes where id=source_process_id and deleted_at is null), ranked as (
  select p.id,p.process_number,p.judicial_class,p.status,p.risk_level,
    (case when p.category_id is not distinct from s.category_id and p.category_id is not null then .30 else 0 end +
     case when lower(coalesce(p.judicial_class,''))=lower(coalesce(s.judicial_class,'')) and p.judicial_class is not null then .25 else 0 end +
     case when p.court=s.court and p.court is not null then .10 else 0 end +
     case when p.tags && s.tags then .10 else 0 end +
     case when exists(select 1 from public.process_parties a join public.process_parties b on b.party_id=a.party_id where a.process_id=s.id and b.process_id=p.id) then .25 else 0 end)::numeric score,
    array_remove(array[
      case when p.category_id=s.category_id and p.category_id is not null then 'mesma categoria' end,
      case when lower(coalesce(p.judicial_class,''))=lower(coalesce(s.judicial_class,'')) and p.judicial_class is not null then 'mesma classe' end,
      case when p.court=s.court and p.court is not null then 'mesmo tribunal' end,
      case when p.tags && s.tags then 'tags relacionadas' end,
      case when exists(select 1 from public.process_parties a join public.process_parties b on b.party_id=a.party_id where a.process_id=s.id and b.process_id=p.id) then 'parte em comum' end
    ],null) reasons
  from public.processes p cross join source s where p.id<>s.id and p.deleted_at is null
) select * from ranked where score>0 order by score desc,process_number limit least(greatest(match_count,1),50);
$$;
grant execute on function public.find_similar_processes(uuid,integer) to authenticated;
