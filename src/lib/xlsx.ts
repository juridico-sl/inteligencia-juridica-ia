import "server-only";
import JSZip from "jszip";

const MAX_SHEETS=100,MAX_TOTAL_SIZE=30*1024*1024,MAX_SHEET_SIZE=10*1024*1024,MAX_CELLS=100_000;

function decodeXml(value:string){return value.replace(/<[^>]+>/g,"").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&");}
function encodeXml(value:unknown){return String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");}
function columnIndex(reference:string){let value=0;for(const char of reference.match(/^[A-Z]+/i)?.[0]??"A")value=value*26+char.toUpperCase().charCodeAt(0)-64;return value-1;}

export async function readXlsx(data:Uint8Array){
  const zip=await JSZip.loadAsync(data,{checkCRC32:true}),sheets=Object.values(zip.files).filter(file=>/^xl\/worksheets\/sheet\d+\.xml$/i.test(file.name)&&!file.dir).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
  if(!sheets.length||sheets.length>MAX_SHEETS)throw new Error("Planilha XLSX inválida");
  const size=sheets.reduce((total,file)=>total+Number((file as unknown as {_data?:{uncompressedSize?:number}})._data?.uncompressedSize??0),0);
  if(size>MAX_TOTAL_SIZE)throw new Error("Planilha descompactada excede 30 MB");
  const sharedFile=zip.file("xl/sharedStrings.xml"),shared=sharedFile?Array.from((await sharedFile.async("string")).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g),match=>Array.from(match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g),part=>decodeXml(part[1])).join("")):[];
  let cells=0;
  return Promise.all(sheets.map(async file=>{
    const xml=await file.async("string");if(xml.length>MAX_SHEET_SIZE)throw new Error("Aba XLSX excede 10 MB");
    return Array.from(xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g),row=>{
      const values:string[]=[];let nextColumn=0;
      for(const cell of row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)){
        if(++cells>MAX_CELLS)throw new Error("Planilha excede 100 mil células");
        const reference=/\br="([^"]+)"/.exec(cell[1])?.[1],column=reference?columnIndex(reference):nextColumn,type=/\bt="([^"]+)"/.exec(cell[1])?.[1],raw=/<v\b[^>]*>([\s\S]*?)<\/v>/.exec(cell[2])?.[1]??/<t\b[^>]*>([\s\S]*?)<\/t>/.exec(cell[2])?.[1]??"";
        values[column]=type==="s"?shared[Number(raw)]??"":decodeXml(raw);nextColumn=column+1;
      }
      return Array.from({length:values.length},(_,index)=>values[index]??"");
    });
  }));
}

export async function writeXlsx(rows:Record<string,unknown>[],sheetName="Relatório"){
  const headers=rows.length?Object.keys(rows[0]):[],all=[headers,...rows.map(row=>headers.map(header=>row[header]))],cell=(value:unknown,column:number,row:number)=>`<c r="${String.fromCharCode(65+column)}${row}" t="inlineStr"><is><t>${encodeXml(value)}</t></is></c>`,sheet=all.map((values,row)=>`<row r="${row+1}">${values.map((value,column)=>cell(value,column,row+1)).join("")}</row>`).join("");
  if(headers.length>26)throw new Error("Relatório excede 26 colunas");
  const zip=new JSZip();
  zip.file("[Content_Types].xml",'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
  zip.file("_rels/.rels",'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file("xl/workbook.xml",`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${encodeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels",'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
  zip.file("xl/worksheets/sheet1.xml",`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheet}</sheetData></worksheet>`);
  return zip.generateAsync({type:"uint8array",compression:"DEFLATE"});
}
