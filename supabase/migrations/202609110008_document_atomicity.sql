begin;

create table public.document_chunk_staging (
  run_id uuid not null,
  document_id uuid not null references public.documents(id) on delete cascade,
  page integer,
  chunk_index integer not null,
  content text not null,
  embedding extensions.vector(1536),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  primary key (run_id, chunk_index)
);

alter table public.document_chunk_staging enable row level security;

create function public.register_document_upload(
  p_process_id uuid, p_knowledge_item_id uuid, p_name text, p_type text,
  p_storage_path text, p_mime_type text, p_size bigint, p_sha256 text,
  p_uploaded_by uuid, p_ocr_status text
) returns uuid language plpgsql volatile security definer set search_path=public as $$
declare document_id uuid;
begin
  insert into public.documents(process_id,knowledge_item_id,name,type,storage_path,mime_type,size,sha256,uploaded_by,ocr_status)
  values(p_process_id,p_knowledge_item_id,p_name,p_type,p_storage_path,p_mime_type,p_size,p_sha256,p_uploaded_by,p_ocr_status)
  returning id into document_id;
  insert into public.document_versions(document_id,version,storage_path,size,sha256,created_by)
  values(document_id,1,p_storage_path,p_size,p_sha256,p_uploaded_by);
  insert into public.job_queue(type,payload,idempotency_key)
  values('extract_document',jsonb_build_object('document_id',document_id),'extract:'||document_id||':1');
  return document_id;
end $$;

create function public.register_document_version(
  p_document_id uuid, p_name text, p_storage_path text, p_mime_type text,
  p_size bigint, p_sha256 text, p_created_by uuid, p_ocr_status text
) returns integer language plpgsql volatile security definer set search_path=public as $$
declare next_version integer;
begin
  perform 1 from public.documents where id=p_document_id and deleted_at is null for update;
  if not found then raise exception 'document_not_found' using errcode='P0002'; end if;
  select coalesce(max(version),0)+1 into next_version from public.document_versions where document_id=p_document_id;
  insert into public.document_versions(document_id,version,storage_path,size,sha256,created_by)
  values(p_document_id,next_version,p_storage_path,p_size,p_sha256,p_created_by);
  update public.documents set name=p_name,storage_path=p_storage_path,mime_type=p_mime_type,size=p_size,sha256=p_sha256,extraction_status='pending',ocr_status=p_ocr_status where id=p_document_id;
  insert into public.job_queue(type,payload,idempotency_key)
  values('extract_document',jsonb_build_object('document_id',p_document_id),'extract:'||p_document_id||':'||next_version);
  return next_version;
end $$;

create function public.finalize_document_chunks(
  p_run_id uuid, p_document_id uuid, p_extracted_text text,
  p_ocr_status text, p_metadata jsonb
) returns integer language plpgsql volatile security definer set search_path=public as $$
declare chunk_count integer;
begin
  select count(*) into chunk_count from public.document_chunk_staging where run_id=p_run_id and document_id=p_document_id;
  if chunk_count=0 then raise exception 'empty_document_chunks' using errcode='22023'; end if;
  delete from public.document_chunks where document_id=p_document_id;
  insert into public.document_chunks(document_id,page,chunk_index,content,embedding,metadata)
  select document_id,page,chunk_index,content,embedding,metadata from public.document_chunk_staging where run_id=p_run_id and document_id=p_document_id order by chunk_index;
  update public.documents set extracted_text=left(p_extracted_text,2000000),extraction_status='completed',ocr_status=p_ocr_status,metadata=p_metadata where id=p_document_id and deleted_at is null;
  if not found then raise exception 'document_not_found' using errcode='P0002'; end if;
  delete from public.document_chunk_staging where run_id=p_run_id;
  return chunk_count;
end $$;

revoke all on table public.document_chunk_staging from public,anon,authenticated;
revoke all on function public.register_document_upload(uuid,uuid,text,text,text,text,bigint,text,uuid,text), public.register_document_version(uuid,text,text,text,bigint,text,uuid,text), public.finalize_document_chunks(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant all on table public.document_chunk_staging to service_role;
grant execute on function public.register_document_upload(uuid,uuid,text,text,text,text,bigint,text,uuid,text), public.register_document_version(uuid,text,text,text,bigint,text,uuid,text), public.finalize_document_chunks(uuid,uuid,text,text,jsonb) to service_role;

commit;
