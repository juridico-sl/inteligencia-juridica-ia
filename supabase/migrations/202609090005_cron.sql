create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule('legal-sync-processes', '0 * * * *', $$select public.enqueue_monitored_processes()$$)
where not exists (select 1 from cron.job where jobname='legal-sync-processes');
select cron.schedule('legal-operations', '*/15 * * * *', $$select public.enqueue_daily_operations()$$)
where not exists (select 1 from cron.job where jobname='legal-operations');
select cron.schedule('legal-daily-report', '0 7 * * 1-5', $$insert into public.job_queue(type,payload,idempotency_key) values('daily_report','{}','daily-report:'||current_date) on conflict do nothing$$)
where not exists (select 1 from cron.job where jobname='legal-daily-report');
select cron.schedule('legal-weekly-report', '0 7 * * 1', $$insert into public.job_queue(type,payload,idempotency_key) values('weekly_report','{}','weekly-report:'||date_trunc('week',current_date)) on conflict do nothing$$)
where not exists (select 1 from cron.job where jobname='legal-weekly-report');
select cron.schedule('legal-monthly-report', '0 7 1 * *', $$insert into public.job_queue(type,payload,idempotency_key) values('monthly_report','{}','monthly-report:'||date_trunc('month',current_date)) on conflict do nothing$$)
where not exists (select 1 from cron.job where jobname='legal-monthly-report');
select cron.schedule('legal-retention', '0 3 1 * *', $$insert into public.job_queue(type,payload,idempotency_key) values('apply_retention','{}','retention:'||date_trunc('month',current_date)) on conflict do nothing$$)
where not exists (select 1 from cron.job where jobname='legal-retention');
