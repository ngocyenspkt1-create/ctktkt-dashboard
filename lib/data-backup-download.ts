// Browser-only orchestration: bounded requests, one archive, no operating-data writes.
type ExportTable={name:string;label:string;total:number;ceiling:number};
type ExportManifest={tables:ExportTable[];range:{from:string;to:string}|null};
type ExportPage={file:{tables:Record<string,unknown[]>};count:number;nextAfter:number;done:boolean};
const api="/api/admin/data-backup";

export async function collectBackupParts(query:string,request:typeof fetch,onProgress:(text:string)=>void){
  const parameters=new URLSearchParams(query);
  const read=async<T>(params:URLSearchParams):Promise<T>=>{
    const response=await request(`${api}?${params}`,{cache:"no-store",signal:AbortSignal.timeout(65000)});
    if(!response.ok){const body=await response.json().catch(()=>null) as {error?:string}|null;throw new Error(body?.error||`Không tải được phần sao lưu (HTTP ${response.status}). Chưa tạo tệp tải xuống.`);}
    return await response.json() as T;
  };
  parameters.set("action","manifest");
  onProgress("Đang kiểm tra phạm vi dữ liệu…");
  const manifest=await read<ExportManifest>(parameters);
  const files:Array<{name:string;content:string}>=[];
  let downloaded=0;
  const total=manifest.tables.reduce((sum,table)=>sum+table.total,0);
  for(const table of manifest.tables){
    let after=0,tableCount=0,part=0;
    if(!table.total)continue;
    while(true){
      onProgress(`Đang tải ${table.label}: ${downloaded.toLocaleString("vi-VN")} / ${total.toLocaleString("vi-VN")} bản ghi…`);
      const params=new URLSearchParams(query);
      params.set("action","part");params.set("table",table.name);params.set("after",String(after));params.set("ceiling",String(table.ceiling));
      const page=await read<ExportPage>(params);
      if(!Number.isSafeInteger(page.nextAfter)||(!page.done&&page.nextAfter<=after)||!Number.isSafeInteger(page.count)||page.count<0||page.count>1000||page.nextAfter>table.ceiling)throw new Error("Phần sao lưu không hợp lệ; chưa tạo tệp tải xuống.");
      if(page.count){files.push({name:`${table.name}-${String(++part).padStart(4,"0")}.json`,content:JSON.stringify(page.file)});}
      after=page.nextAfter;tableCount+=page.count;downloaded+=page.count;
      if(page.done)break;
    }
    if(tableCount!==table.total)throw new Error("Dữ liệu đã thay đổi trong lúc tải. Chưa tạo gói bị thiếu; hãy bấm tải lại khi không có người chỉnh số liệu.");
  }
  onProgress(`Đã nhận đủ ${downloaded.toLocaleString("vi-VN")} bản ghi. Đang nén thành ZIP…`);
  return {files,total:downloaded,range:manifest.range};
}
