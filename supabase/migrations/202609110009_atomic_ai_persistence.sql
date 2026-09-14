begin;

create function public.persist_ai_answer(
  p_conversation_id uuid, p_content text, p_tool_calls jsonb, p_sources jsonb,
  p_model text, p_usage jsonb, p_duration_ms integer, p_prompt_version integer
) returns uuid language plpgsql volatile security invoker set search_path=public as $$
declare message_id uuid; source jsonb;
begin
  if not exists(select 1 from public.conversations where id=p_conversation_id and user_id=auth.uid() and deleted_at is null) then raise exception 'conversation_not_found' using errcode='P0002'; end if;
  insert into public.messages(conversation_id,role,content,tool_calls,sources,model,usage)
  values(p_conversation_id,'assistant',p_content,coalesce(p_tool_calls,'[]'),coalesce(p_sources,'[]'),p_model,coalesce(p_usage,'{}')||jsonb_build_object('duration_ms',p_duration_ms,'prompt_version',p_prompt_version)) returning id into message_id;
  for source in select value from jsonb_array_elements(coalesce(p_sources,'[]')) loop
    insert into public.message_sources(message_id,source_type,source_id,label,excerpt)
    values(message_id,source->>'type',nullif(source->>'id','')::uuid,source->>'label',source->>'excerpt');
  end loop;
  insert into public.ai_usage_logs(user_id,feature,model,input_tokens,output_tokens,duration_ms,success)
  values(auth.uid(),'chat',p_model,coalesce((p_usage->>'input_tokens')::integer,0),coalesce((p_usage->>'output_tokens')::integer,0),p_duration_ms,true);
  return message_id;
end $$;

revoke all on function public.persist_ai_answer(uuid,text,jsonb,jsonb,text,jsonb,integer,integer) from public,anon;
grant execute on function public.persist_ai_answer(uuid,text,jsonb,jsonb,text,jsonb,integer,integer) to authenticated;

commit;
