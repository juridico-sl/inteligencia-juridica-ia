import{NextRequest}from"next/server";import{PDFDocument,StandardFonts,rgb}from"pdf-lib";import{authorizePermission}from"@/lib/auth";import{reportRows}from"@/lib/reports";import{audit,enforceRateLimit}from"@/lib/security";import{writeXlsx}from"@/lib/xlsx";
function safeCell(value:unknown){const text=String(value??"");return /^[=+\-@\t\r]/.test(text)?`'${text}`:text}
function csv(rows:Record<string,unknown>[]){if(!rows.length)return"";const headers=Object.keys(rows[0]),escape=(v:unknown)=>`"${safeCell(v).replace(/"/g,'""')}"`;return[headers.map(escape).join(","),...rows.map(r=>headers.map(h=>escape(r[h])).join(","))].join("\r\n")}
async function pdf(rows:Record<string,unknown>[],title:string){const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);let page=doc.addPage([842,595]),y=560;page.drawText(title,{x:35,y,size:16,font:bold,color:rgb(.12,.16,.23)});y-=28;for(const row of rows){const line=`${row["Número CNJ"]} | ${row.Empresa} | ${row.Status} | ${row.Risco} | R$ ${Number(row.Exposição).toLocaleString("pt-BR")}`.slice(0,125);if(y<35){page=doc.addPage([842,595]);y=560}page.drawText(line.replace(/[^\x20-\xFF]/g,""),{x:35,y,size:8,font});y-=14}return doc.save()}
export async function GET(request:NextRequest){
  try{
    await authorizePermission("report.export");await enforceRateLimit("report-export",10,300);
    const format=request.nextUrl.searchParams.get("format")??"csv",type=request.nextUrl.searchParams.get("type")??"executive",rows=await reportRows(type,request.nextUrl.searchParams.get("start"),request.nextUrl.searchParams.get("end"));
    let body:BodyInit,contentType:string,extension:string;
    if(format==="xlsx"){body=new Blob([Uint8Array.from(await writeXlsx(rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,safeCell(value)]))),"Relatório")).buffer]);contentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";extension="xlsx"}
    else if(format==="pdf"){body=new Uint8Array(await pdf(rows,"Relatório Jurídico Executivo"));contentType="application/pdf";extension="pdf"}
    else{body=csv(rows);contentType="text/csv; charset=utf-8";extension="csv"}
    await audit("export","report",undefined,{type,format,rows:rows.length});
    return new Response(body,{headers:{"content-type":contentType,"content-disposition":`attachment; filename="relatorio-juridico-${new Date().toISOString().slice(0,10)}.${extension}"`,"cache-control":"private, no-store"}})
  }catch{return Response.json({error:"Não foi possível gerar relatório"},{status:400})}
}
