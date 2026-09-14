import { z } from "zod";
import { isValidCnj, normalizeCnj } from "@/lib/legal";

const optionalUuid = z.union([z.uuid(), z.literal("")]).optional().transform((value) => value || null);
const optionalMoney=z.preprocess(value=>value===""||value==null?null:value,z.coerce.number().nonnegative().nullable()).optional();
const optionalText=z.union([z.string().trim().max(10000),z.null()]).optional().transform(value=>value||null);
export const processCreateSchema = z.object({
  process_number: z.string().transform(normalizeCnj).refine(isValidCnj, "Número CNJ inválido"),
  company_id: optionalUuid,
  business_unit_id: optionalUuid,
  category_id: optionalUuid,
  responsible_user_id: optionalUuid,
  law_firm_id: optionalUuid,
  subcategory:z.string().trim().max(120).optional().transform(value=>value||null),
  status:z.enum(["draft","active","suspended","closed","archived"]).default("draft"),
  risk_level:z.enum(["low","medium","high","critical"]).default("medium"),
  probability:z.preprocess(value=>value===""||value==null?null:value,z.coerce.number().min(0).max(100).nullable()).optional(),
  impact:optionalMoney,claim_value:optionalMoney,estimated_exposure:optionalMoney,provision:optionalMoney,
  notes:optionalText,
  tags:z.union([z.array(z.string()),z.string()]).optional().transform(value=>(Array.isArray(value)?value:String(value??"").split(",")).map(item=>item.trim()).filter(Boolean).slice(0,30)),
  monitoring_enabled:z.union([z.boolean(),z.enum(["true","false"])]).optional().transform(value=>value===undefined?true:value===true||value==="true"),
  monitoring_frequency:z.enum(["0 * * * *","0 6,10,14,18 * * *","0 6,18 * * *","0 6 * * *","0 8 * * *"]).default("0 6,10,14,18 * * *")
}).strict();

export const processUpdateSchema = z.object({
  company_id: optionalUuid,
  business_unit_id: optionalUuid,
  category_id: optionalUuid,
  responsible_user_id: optionalUuid,
  law_firm_id: optionalUuid,
  subcategory: z.string().trim().max(120).nullable().optional(),
  status: z.enum(["draft","active","suspended","closed","archived"]).optional(),
  notes: z.string().trim().max(10000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
  monitoring_enabled: z.boolean().optional(),
  monitoring_frequency: z.enum(["0 * * * *","0 6,10,14,18 * * *","0 6,18 * * *","0 6 * * *","0 8 * * *"]).optional()
}).strict();

export const riskUpdateSchema = z.object({
  level: z.enum(["low","medium","high","critical"]),
  probability: z.number().min(0).max(100).nullable(),
  impact: z.number().nonnegative().nullable(),
  reason: z.string().trim().min(3).max(1000)
});
