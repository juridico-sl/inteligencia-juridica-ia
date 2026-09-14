import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root=path.resolve(__dirname,"..");
const read=(file:string)=>readFileSync(path.join(root,file),"utf8");
function sourceFiles(dir=root):string[]{return readdirSync(dir).flatMap(name=>{if([".git",".next","node_modules",".pytest_cache",".venv"].includes(name))return[];try{const file=path.join(dir,name),stat=statSync(file);return stat.isDirectory()?sourceFiles(file):/\.(?:ts|tsx|js|mjs|py|sql|md|example|toml|json)$/.test(name)?[file]:[]}catch{return[]}})}

describe("contratos de segurança",()=>{
  it("não contém token de provedor em arquivos do projeto",()=>{for(const file of sourceFiles())expect(readFileSync(file,"utf8"),file).not.toMatch(/\b(?:sk|tp)-[A-Za-z0-9_-]{20,}\b/)});
  it("mantém RLS, Storage privado e prazo automático pendente",()=>{const core=read("supabase/migrations/202609090001_core.sql"),rls=read("supabase/migrations/202609090002_rls.sql");expect(rls).toContain("enable row level security");expect(core).toMatch(/legal-documents','legal-documents',false/);expect(core).toContain("status = 'pending_confirmation'")});
  it("protege APIs mutáveis por origem e redirects locais",()=>{const proxy=read("src/proxy.ts"),security=read("src/lib/security.ts");expect(proxy).toContain('origin !== request.nextUrl.origin');expect(security).toContain("(?!\\/)")});
});
