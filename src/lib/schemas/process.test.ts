import { describe, expect, it } from "vitest";
import { processCreateSchema, processUpdateSchema } from "./process";

describe("schemas de processo",()=>{
  it("bloqueia campos inesperados",()=>expect(()=>processUpdateSchema.parse({status:"active",admin:true})).toThrow());
  it("limita agendamentos aos suportados",()=>expect(()=>processUpdateSchema.parse({monitoring_frequency:"* * * * *"})).toThrow());
  it("aceita CNJ e normaliza IDs vazios",()=>expect(processCreateSchema.parse({process_number:"0000000-89.2026.8.26.0001",company_id:""}).company_id).toBeNull());
  it("normaliza o cadastro financeiro completo",()=>{const value=processCreateSchema.parse({process_number:"0000000-89.2026.8.26.0001",claim_value:"1500.25",probability:"35",tags:"fiscal, urgente",monitoring_enabled:"false"});expect(value).toMatchObject({claim_value:1500.25,probability:35,tags:["fiscal","urgente"],monitoring_enabled:false})});
});
