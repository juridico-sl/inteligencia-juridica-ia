import { NextRequest, NextResponse } from "next/server";
import { authorizePermission } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { audit } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(_:NextRequest,{params}:{params:Promise<{id:string}>}){try{const{user}=await authorizePermission("document.delete"),{id}=await params,supabase=await createClient(),{data,error}=await supabase.from("documents").update({deleted_at:new Date().toISOString(),deleted_by:user.id}).eq("id",id).is("deleted_at",null).select("id").single();if(error||!data)throw new Error("Documento não encontrado");await audit("archive","document",id);return NextResponse.json({ok:true})}catch(error){return apiError(error)}}
