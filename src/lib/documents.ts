import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { readXlsx } from "@/lib/xlsx";

export const ALLOWED_MIME = new Set(["application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","text/plain","text/csv","image/png","image/jpeg","image/tiff"]);

export function safeFileName(name: string) { return name.normalize("NFKD").replace(/\p{M}+/gu,"").replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,180) || "documento"; }
export function sha256(data: Uint8Array) { return createHash("sha256").update(data).digest("hex"); }

export function hasValidSignature(mime: string, data: Uint8Array) {
  const head = Buffer.from(data.subarray(0,8));
  if(mime==="application/pdf")return head.subarray(0,5).toString()==="%PDF-";
  if(mime.includes("openxmlformats"))return head[0]===0x50&&head[1]===0x4b;
  if(mime==="image/png")return head.equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if(mime==="image/jpeg")return head[0]===0xff&&head[1]===0xd8&&head[2]===0xff;
  if(mime==="image/tiff")return (head[0]===0x49&&head[1]===0x49)||(head[0]===0x4d&&head[1]===0x4d);
  return mime==="text/plain"||mime==="text/csv";
}

export async function scanFile(data: Uint8Array, name: string, mime: string) {
  const endpoint=process.env.ANTIVIRUS_URL;
  if(!endpoint){if(process.env.NODE_ENV==="production")throw new Error("Antivírus não configurado");return;}
  const form=new FormData();form.append("file",new Blob([Uint8Array.from(data).buffer],{type:mime}),name);
  const response=await fetch(endpoint,{method:"POST",body:form,signal:AbortSignal.timeout(30_000)});if(!response.ok)throw new Error("Falha na verificação antivírus");const result=await response.json();if(result.clean!==true)throw new Error("Arquivo rejeitado pelo antivírus");
}

export type ExtractedPage={page:number;text:string;ocr?:boolean};
async function extractSpreadsheet(data:Uint8Array):Promise<ExtractedPage[]>{return(await readXlsx(data)).map((rows,index)=>({page:index+1,text:`Planilha ${index+1}\n${rows.map(row=>row.join("\t")).join("\n")}`}));}
export async function extractText(data:Uint8Array,mime:string,name:string):Promise<ExtractedPage[]>{
  if(mime==="text/plain"||mime==="text/csv")return[{page:1,text:Buffer.from(data).toString("utf8")}];
  if(mime.includes("wordprocessingml")){const result=await mammoth.extractRawText({buffer:Buffer.from(data)});return[{page:1,text:result.value}];}
  if(mime.includes("spreadsheetml"))return extractSpreadsheet(data);
  if(mime==="application/pdf"){const parser=new PDFParse({data});try{const result=await parser.getText();const pages=result.pages.map(p=>({page:p.num,text:p.text}));if(pages.some(p=>p.text.trim().length>40))return pages;}finally{await parser.destroy();}}
  return runOcr(data,mime,name);
}

async function runOcr(data:Uint8Array,mime:string,name:string):Promise<ExtractedPage[]>{const endpoint=process.env.OCR_API_URL,key=process.env.OCR_API_KEY;if(!endpoint)throw new Error("Documento exige OCR, mas OCR_API_URL não está configurado");const form=new FormData();form.append("file",new Blob([Uint8Array.from(data).buffer],{type:mime}),name);const response=await fetch(endpoint,{method:"POST",headers:key?{authorization:`Bearer ${key}`}:{},body:form,signal:AbortSignal.timeout(120_000)});if(!response.ok)throw new Error("OCR indisponível");const result=await response.json();if(Array.isArray(result.pages))return result.pages.map((p:{page?:number;text?:string},i:number)=>({page:p.page??i+1,text:p.text??"",ocr:true}));return[{page:1,text:String(result.text??""),ocr:true}];}

export function chunkLegalDocument(pages:ExtractedPage[],maxChars=1600,overlap=200){const chunks:{page:number;chunk_index:number;content:string;metadata:Record<string,unknown>}[]=[];let index=0;for(const page of pages){const clean=page.text.replace(/\r/g,"").replace(/[ \t]+/g," ").replace(/\n{3,}/g,"\n\n").trim();let start=0;while(start<clean.length){let end=Math.min(clean.length,start+maxChars);if(end<clean.length){const boundary=Math.max(clean.lastIndexOf("\n",end),clean.lastIndexOf(". ",end));if(boundary>start+maxChars/2)end=boundary+1;}const content=clean.slice(start,end).trim(),section=clean.slice(0,start===0?end:start+1).split("\n").reverse().find(line=>line.length>2&&line.length<=140&&(/^(?:\d+(?:\.\d+)*[.)]?|CAP[IÍ]TULO|SE[CÇ][AÃ]O|T[IÍ]TULO|CL[AÁ]USULA)\s/i.test(line)||line===line.toLocaleUpperCase("pt-BR")));if(content)chunks.push({page:page.page,chunk_index:index++,content,metadata:{page:page.page,section:section??null,document_data_only:true}});if(end>=clean.length)break;start=Math.max(start+1,end-overlap);}}return chunks;}

export function verifyInternalSecret(value:string|null){const expected=process.env.CRON_SECRET;if(!value||!expected)return false;const a=Buffer.from(value.replace(/^Bearer\s+/,"")),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);}
