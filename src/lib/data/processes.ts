import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ProcessFilters = { page?: string; per_page?: string; novo?: string; q?: string; party?: string; cnpj?: string; company?: string; unit?: string; category?: string; status?: string; risk?: string; responsible?: string; firm?: string; court?: string; state?: string; from?: string; to?: string; monitoring?: string };

export async function listProcesses(filters: ProcessFilters) {
  const page = Math.max(1, Number(filters.page ?? 1));
  const perPage = Math.min(100, Math.max(1, Number(filters.per_page ?? 25)));
  const offset = (page - 1) * perPage;
  const supabase = await createClient();
  let query = supabase.from("process_list").select("id,process_number,status,risk_level,claim_value,provision,last_synced_at,monitoring_enabled,court_name,state,company_name,unit_name,category_name,responsible_name,law_firm_name,party_names,last_movement_at,next_deadline_at", { count: "exact" });
  const search = filters.q?.replace(/[%_,()]/g, "").trim();
  if (search) query = query.or(`process_number.ilike.%${search}%,court_name.ilike.%${search}%`);
  if(filters.party)query=query.ilike("party_names",`%${filters.party.replace(/[%_,()]/g,"").trim()}%`);
  if(filters.cnpj)query=query.eq("company_cnpj",filters.cnpj.replace(/\D/g,""));
  for (const [value, column] of [[filters.status,"status"],[filters.risk,"risk_level"],[filters.company,"company_id"],[filters.unit,"business_unit_id"],[filters.category,"category_id"],[filters.responsible,"responsible_user_id"],[filters.firm,"law_firm_id"]] as const) if (value) query = query.eq(column, value);
  if(filters.state&&/^[a-z]{2}$/i.test(filters.state))query=query.eq("state",filters.state.toUpperCase());
  if(filters.court)query=query.ilike("court_name",`%${filters.court.replace(/[%_,()]/g,"")}%`);
  if(filters.from&&/^\d{4}-\d{2}-\d{2}$/.test(filters.from))query=query.gte("filing_date",filters.from);
  if(filters.to&&/^\d{4}-\d{2}-\d{2}$/.test(filters.to))query=query.lte("filing_date",filters.to);
  if(filters.monitoring==="true"||filters.monitoring==="false")query=query.eq("monitoring_enabled",filters.monitoring==="true");
  const { data, count, error } = await query.order("updated_at", { ascending: false }).range(offset, offset + perPage - 1);
  if (error) throw error;
  return { data: data ?? [], page, perPage, total: count ?? 0 };
}

export async function getSavedProcessFilters(){const supabase=await createClient(),{data,error}=await supabase.from("saved_filters").select("id,name,filters").eq("resource","processes").order("name");if(error)throw error;return data??[];}

export async function getProcess(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("processes").select("*,companies(id,trade_name,legal_name),business_units(id,name),categories(id,name),profiles!processes_responsible_user_id_fkey(id,full_name,email),law_firms(id,name),process_parties(role,is_client,parties(id,name,type,document_masked))").eq("id", id).is("deleted_at", null).single();
  if (error) return null;
  return data;
}

export async function getProcessOptions() {
  const supabase = await createClient();
  const [companies, units, categories, profiles, firms] = await Promise.all([
    supabase.from("companies").select("id,trade_name,legal_name").eq("active", true).is("deleted_at", null).order("trade_name"),
    supabase.from("business_units").select("id,name,company_id").eq("active", true).is("deleted_at", null).order("name"),
    supabase.from("categories").select("id,name").eq("active", true).order("name"),
    supabase.from("profiles").select("id,full_name,email").eq("active", true).order("full_name"),
    supabase.from("law_firms").select("id,name").eq("active", true).is("deleted_at", null).order("name")
  ]);
  for (const result of [companies, units, categories, profiles, firms]) if (result.error) throw result.error;
  return { companies: companies.data ?? [], units: units.data ?? [], categories: categories.data ?? [], profiles: profiles.data ?? [], firms: firms.data ?? [] };
}
