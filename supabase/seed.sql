-- Development-only data. Never run automatically in production.
insert into public.companies (id, legal_name, trade_name, cnpj)
values ('00000000-0000-4000-8000-000000000001', 'Empresa Fictícia de Desenvolvimento S.A.', 'Empresa Demo', '00000000000000')
on conflict do nothing;

insert into public.business_units (company_id, name, kind, city, state)
values ('00000000-0000-4000-8000-000000000001', 'Unidade de Testes', 'unit', 'Santa Maria', 'RS')
on conflict do nothing;
