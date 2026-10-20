import {mirrorAuthorized} from '@/lib/google-mirror-auth';
import {buildMirrorSnapshot} from '@/lib/google-mirror-snapshot';
import {validMirrorPeriod} from '@/lib/google-mirror';
import {vietnamDateIso} from '@/lib/operating-date';
export const maxDuration=60;
export async function GET(request:Request){
 if(!await mirrorAuthorized(request))return Response.json({error:'Không có quyền đồng bộ.'},{status:401});
 const period=new URL(request.url).searchParams.get('period')||vietnamDateIso().slice(0,7);
 if(!validMirrorPeriod(period)||period>vietnamDateIso().slice(0,7))return Response.json({error:'Tháng không hợp lệ.'},{status:400});
 try{return Response.json(await buildMirrorSnapshot(period),{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({error:'Không tạo được bản đồng bộ. File Google Sheets cũ được giữ nguyên.'},{status:503});}
}
