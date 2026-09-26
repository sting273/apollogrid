import { categories, type LocalRecord } from './records';
const xml=(s:unknown)=>String(s??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const enc=new TextEncoder();
function crc32(bytes:Uint8Array){let c=0xffffffff;for(const b of bytes){c^=b;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function zip(files:Record<string,string>){
  const parts:Uint8Array[]=[],central:Uint8Array[]=[];let offset=0;
  for(const [name,body] of Object.entries(files)){
    const n=enc.encode(name),b=enc.encode(body),crc=crc32(b);
    const h=new Uint8Array(30+n.length),v=new DataView(h.buffer);
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint32(14,crc,true);v.setUint32(18,b.length,true);v.setUint32(22,b.length,true);v.setUint16(26,n.length,true);h.set(n,30);
    const ch=new Uint8Array(46+n.length),cv=new DataView(ch.buffer);
    cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint32(16,crc,true);cv.setUint32(20,b.length,true);cv.setUint32(24,b.length,true);cv.setUint16(28,n.length,true);cv.setUint32(42,offset,true);ch.set(n,46);
    parts.push(h,b);central.push(ch);offset+=h.length+b.length;
  }
  const size=central.reduce((s,b)=>s+b.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);
  e.setUint32(0,0x06054b50,true);e.setUint16(8,central.length,true);e.setUint16(10,central.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);
  const result=new Uint8Array(offset+size+22);let i=0;for(const p of [...parts,...central,end]){result.set(p,i);i+=p.length;}return result;
}
function col(n:number){let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
function sheet(rows:(string|number)[][]){return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="30" width="23" customWidth="1"/></cols><sheetData>${rows.map((row,i)=>`<row r="${i+1}">${row.map((v,j)=>typeof v==='number'?`<c r="${col(j)}${i+1}"><v>${v}</v></c>`:`<c r="${col(j)}${i+1}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`).join('')}</row>`).join('')}</sheetData><autoFilter ref="A1:${col(rows[0].length-1)}${rows.length}"/></worksheet>`;}
export function workbook(records:LocalRecord[],lang:'zh'|'en'='zh'){
 const rows:(string|number)[][]=[['记录ID','场次','日期','状态','同步状态','创建时间','更新时间','Sentence 1','S1-1 SE','S1-1 W','S1-1 OTHER','Sentence 2','S1-2 SE','S1-2 W','S1-2 OTHER','S2–3 SE','S2–3 W','S2–3 OTHER','S4 SE','S4 W','S4 OTHER','Step 4 Detail','Others']];
 if(lang==='en')rows[0]=['Record ID','Session','Date','Status','Sync','Created (UTC)','Updated (UTC)','Sentence 1','S1-1 SE','S1-1 W','S1-1 OTHER','Sentence 2','S1-2 SE','S1-2 W','S1-2 OTHER','S2-3 SE','S2-3 W','S2-3 OTHER','S4 SE','S4 W','S4 OTHER','Step 4 detail','Others'];
 rows[0].push(lang==='zh'?'成员':'Member',lang==='zh'?'账户 ID':'Account ID');
 for(const r of records)rows.push([r.id,r.name,r.date,r.complete?(lang==='zh'?'已完成':'Complete'):(lang==='zh'?'进行中':'In progress'),r.dirty?(lang==='zh'?'待同步':'Pending'):(lang==='zh'?'已同步':'Synced'),r.createdAt,r.updatedAt,r.sentence1,...categories.map(c=>r.s1a[c]),r.sentence2,...categories.map(c=>r.s1b[c]),...categories.map(c=>r.s23[c]),...categories.map(c=>r.s4[c]),r.detail,r.other,r.ownerName||'',r.ownerId||'']);
 const detail:(string|number)[][]=[['记录ID','场次','日期','步骤','话术','类别','计数']];
 if(lang==='en')detail[0]=['Record ID','Session','Date','Step','Opening line','Category','Count'];
 detail[0].push(lang==='zh'?'成员':'Member');
 for(const r of records)for(const [k,label,phrase] of [['s1a','Step 1 · Sentence 1',r.sentence1],['s1b','Step 1 · Sentence 2',r.sentence2],['s23','Step 2–3',''],['s4','Step 4','']] as const)for(const c of categories)detail.push([r.id,r.name,r.date,label,phrase,c,r[k][c],r.ownerName||'']);
 return zip({
 '[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
 '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
 'xl/workbook.xml':`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${lang==='zh'?'场次记录':'Sessions'}" sheetId="1" r:id="rId1"/><sheet name="${lang==='zh'?'计数明细':'Counts'}" sheetId="2" r:id="rId2"/></sheets></workbook>`,
 'xl/_rels/workbook.xml.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>',
 'xl/worksheets/sheet1.xml':sheet(rows),'xl/worksheets/sheet2.xml':sheet(detail)});
}
export function exportExcel(records:LocalRecord[],lang:'zh'|'en'='zh'){const b=workbook(records,lang);const url=URL.createObjectURL(new Blob([b.buffer as ArrayBuffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const a=document.createElement('a');a.href=url;a.download=`Road-Show-${new Date().toISOString().slice(0,10)}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
