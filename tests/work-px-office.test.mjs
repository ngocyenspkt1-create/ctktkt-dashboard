import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {decodeReportFiles} from '../lib/work-px-reports.ts';

const parts={
 docx:['word/document.xml','application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>'],
 xlsx:['xl/workbook.xml','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets/></workbook>'],
 pptx:['ppt/presentation.xml','application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml','<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldIdLst/></p:presentation>'],
};
function office(extension='docx'){
 const zip=new JSZip(),[path,type,content]=parts[extension];
 zip.file('[Content_Types].xml',`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/${path}" ContentType="${type}"/></Types>`);
 zip.file(path,content);return zip;
}
const bytes=(zip,options={})=>zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',...options});
const upload=(data,extension='docx')=>decodeReportFiles([{name:`synthetic.${extension}`,base64:data.toString('base64')}]);

test('WP-06: valid Word, Excel and PowerPoint packages accept stored, compressed and streaming ZIP entries',async()=>{
 for(const extension of Object.keys(parts))for(const options of [{compression:'STORE'},{compression:'DEFLATE'},{streamFiles:true}]){
  const data=await bytes(office(extension),options);assert.equal(upload(data,extension)[0].size,data.length);
 }
});

test('WP-06: reject short ZIP headers, unrelated ZIPs, missing parts and renamed Office types',async()=>{
 assert.throws(()=>upload(Buffer.from([0x50,0x4b,0x03,0x04,0])));
 const arbitrary=new JSZip().file('unrelated.txt','Synthetic');
 const unrelated=await bytes(arbitrary);assert.throws(()=>upload(unrelated));
 const noMain=office();noMain.remove('word/document.xml');
 const noMainBytes=await bytes(noMain);assert.throws(()=>upload(noMainBytes));
 const noTypes=office();noTypes.remove('[Content_Types].xml');const noTypeBytes=await bytes(noTypes);assert.throws(()=>upload(noTypeBytes));
 const word=await bytes(office('docx'));for(const ext of ['xlsx','pptx'])assert.throws(()=>upload(word,ext));
 const wrongType=office();wrongType.file('[Content_Types].xml','<Types><Override PartName="/word/document.xml" ContentType="application/zip"/></Types>');const wrongBytes=await bytes(wrongType);assert.throws(()=>upload(wrongBytes));
});

test('WP-06: reject corrupt CRC, truncated archives, encrypted entries and traversal names',async()=>{
 const original=await bytes(office());assert.throws(()=>upload(original.subarray(0,original.length-8)));
 const corrupt=Buffer.from(original),central=corrupt.indexOf(Buffer.from('504b0102','hex'));corrupt[central+16]^=1;assert.throws(()=>upload(corrupt));
 const encrypted=Buffer.from(original);encrypted.writeUInt16LE(encrypted.readUInt16LE(central+8)|1,central+8);assert.throws(()=>upload(encrypted));
 const traversal=office();traversal.file('../unsafe.txt','Synthetic');const badPath=await bytes(traversal);assert.throws(()=>upload(badPath));
});

test('WP-06: bound expanded size and entry count, including a ZIP that lies about expanded size',async()=>{
 const bomb=office();bomb.file('large.xml',Buffer.alloc(20*1024*1024+1,65));const packed=await bytes(bomb);assert.ok(packed.length<1024*1024);assert.throws(()=>upload(packed),/20 MiB/);
 const lying=Buffer.from(packed);let cursor=lying.readUInt32LE(lying.length-22+16);
 while(lying.readUInt32LE(cursor)===0x02014b50){
  const length=lying.readUInt16LE(cursor+28),name=lying.subarray(cursor+46,cursor+46+length).toString();
  if(name==='large.xml'){lying.writeUInt32LE(1,cursor+24);lying.writeUInt32LE(1,lying.readUInt32LE(cursor+42)+22);break;}
  cursor+=46+length+lying.readUInt16LE(cursor+30)+lying.readUInt16LE(cursor+32);
 }
 assert.throws(()=>upload(lying),/20 MiB/);
 const many=office();for(let i=0;i<2000;i++)many.file(`entry-${i}.txt`,'x');const crowded=await bytes(many);assert.throws(()=>upload(crowded),/2.000/);
});
