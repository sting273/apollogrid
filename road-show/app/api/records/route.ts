import { requireActor, visibleScope, canAccess, failure, payload } from '@/lib/access';
import { db } from '@/lib/db';
import { recordSchema } from '@/lib/records';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status=200) => Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET() {
  try {
    const user=await requireActor();const scope=visibleScope(user);
    const condition=user.role===0?'1=1':`(r.owner = ? OR r.owner IN (SELECT m.id FROM road_members m WHERE ${scope.sql}))`;
    const args=user.role===0?[]:[user.id,...scope.args];
    const result=await db().prepare(`SELECT r.payload, r.revision, r.owner, m.name AS ownerName FROM road_records r LEFT JOIN road_members m ON m.id=r.owner WHERE ${condition} ORDER BY r.updated_at DESC`).bind(...args).all<{payload:string;revision:number;owner:string;ownerName:string|null}>();
    return json({records:result.results.map(r=>({...JSON.parse(r.payload),ownerId:r.owner,ownerName:r.ownerName||'Legacy / 历史账户',revision:r.revision,dirty:false}))});
  } catch(e) { return failure(e); }
}
const input=z.object({record:recordSchema,revision:z.number().int().nonnegative(),mutation:z.string().uuid()});
export async function PUT(request: Request) {
  try {
    const user=await requireActor();
    const parsed=input.safeParse(await payload(request));if(!parsed.success)return json({error:'invalid'},400);
    const {record,revision,mutation}=parsed.data;
    const database=db();
    const existing=await database.prepare('SELECT owner, revision, mutation FROM road_records WHERE id = ?').bind(record.id).first<{owner:string;revision:number;mutation:string}>();
    if(existing && !await canAccess(user,existing.owner)) return json({error:'denied'},403);
    if(existing?.mutation===mutation) return json({revision:existing.revision});
    const now=new Date().toISOString();
    if(!existing && revision===0) {
      const result=await database.prepare('INSERT OR IGNORE INTO road_records (id,owner,payload,revision,mutation,updated_at) VALUES (?,?,?,1,?,?)').bind(record.id,user.id,JSON.stringify(record),mutation,now).run();
      if(result.meta.changes===1) return json({revision:1});
    } else if(existing && existing.revision===revision) {
      const result=await database.prepare('UPDATE road_records SET payload = ?, revision = revision + 1, mutation = ?, updated_at = ? WHERE id = ? AND owner = ? AND revision = ?').bind(JSON.stringify(record),mutation,now,record.id,existing.owner,revision).run();
      if(result.meta.changes===1) return json({revision:revision+1});
    }
    return json({error:'conflict'},409);
  } catch(e) { return failure(e); }
}
