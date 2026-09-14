import { createClient } from "@supabase/supabase-js";

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error("Supabase E2E env missing");
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),email="e2e.advogado@example.test",password="E2e-Juridico-2026!";
const{data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:"Advogado E2E"}});
if(error)throw error;
const{data:role,error:roleError}=await admin.from("roles").select("id").eq("name","ADVOGADO").single();if(roleError)throw roleError;
const{error:profileError}=await admin.from("profiles").update({role_id:role.id,full_name:"Advogado E2E"}).eq("id",data.user.id);if(profileError)throw profileError;
console.log("E2E user ready");
