import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { chunkLegalDocument, extractText, hasValidSignature, safeFileName, sha256 } from "./documents";
import { readXlsx, writeXlsx } from "./xlsx";

describe("pipeline documental", () => {
  it("valida assinatura, nome e hash", () => {
    const pdf = new TextEncoder().encode("%PDF-1.7");
    expect(hasValidSignature("application/pdf", pdf)).toBe(true);
    expect(hasValidSignature("image/png", pdf)).toBe(false);
    expect(safeFileName("Petição nº 1.pdf")).toBe("Peticao-no-1.pdf");
    expect(sha256(pdf)).toHaveLength(64);
  });

  it("preserva página e seção durante chunking", () => {
    const chunks = chunkLegalDocument([{ page: 3, text: "CLÁUSULA PRIMEIRA\n" + "Conteúdo jurídico. ".repeat(30) }], 180, 30);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(chunk => chunk.page === 3 && chunk.metadata.page === 3)).toBe(true);
    expect(chunks[0].metadata.section).toBe("CLÁUSULA PRIMEIRA");
  });

  it("marca saída produzida por OCR", async () => {
    vi.stubEnv("OCR_API_URL", "https://ocr.test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: "texto reconhecido" }) }));
    await expect(extractText(new Uint8Array([0xff, 0xd8, 0xff]), "image/jpeg", "scan.jpg")).resolves.toEqual([{ page: 1, text: "texto reconhecido", ocr: true }]);
    vi.unstubAllGlobals(); vi.unstubAllEnvs();
  });

  it("extrai XLSX sem executar fórmulas", async () => {
    const zip=new JSZip();zip.file("xl/sharedStrings.xml",'<sst><si><t>Processo</t></si></sst>');zip.file("xl/worksheets/sheet1.xml",'<worksheet><sheetData><row><c t="s"><v>0</v></c><c><f>1+1</f><v>2</v></c></row></sheetData></worksheet>');
    const file=await zip.generateAsync({type:"uint8array"});
    await expect(extractText(file,"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","dados.xlsx")).resolves.toEqual([{page:1,text:"Planilha 1\nProcesso\t2"}]);
  });
  it("gera XLSX seguro que pode ser lido novamente", async () => {
    const file=await writeXlsx([{numero_cnj:"'=2+2",status:"ativo"}]);
    await expect(readXlsx(file)).resolves.toEqual([[ ["numero_cnj","status"],["'=2+2","ativo"] ]]);
  });
});
