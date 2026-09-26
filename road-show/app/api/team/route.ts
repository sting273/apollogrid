import { db } from '@/lib/db';
import { requireActor,visibleScope,canAccess,getMember,json,failure,payload,ApiError,validName,nameKey,qrRequired,sha,secret,now,auditLog } from '@/lib/access';
export const dynamic='force-dynamic';
export async function GET(){try{const user=await requireActor();if(user.role>2)throw new ApiError('denied',403);const scope=visibleScope(user);const members=await db().prepare(`SELECT m.* FROM road_members m WHERE ${scope.sql} ORDER BY m.role,m.name`).bind(...scope.args).all();const invitations=await db().prepare('SELECT hash,role,store,target,expires,used_by,revoked,created_at FROM road_invitations WHERE issuer = ? ORDER BY created_at DESC LIMIT 30').bind(user.id).all();return json({members:members.results,invitations:invitations.results,qrRequired:await qrRequired()});}catch(e){return failure(e);}}
export async function POST(request:Request){try{
 const user=await requireActor();if(user.role>2)throw new ApiError('denied',403);const input=await payload(request);
 if(input.action==='settings'){if(user.role!==0)throw new ApiError('denied',403);if(typeof input.enabled!=='boolean')throw new ApiError('invalid');await db().prepare("INSERT INTO road_settings (key,value) VALUES ('qr_required',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(input.enabled)).run();await auditLog(user.id,'qr_mode',null,String(input.enabled));return json({qrRequired:input.enabled});}
 if(input.action==='invite'){
  const target=typeof input.target==='string'?await getMember(input.target):null;
  if(input.target&&(!target||!target.active||!await canAccess(user,target.id,true)))throw new ApiError('denied',403);
  const role=target?.role??user.role+1;const store=target?.store||(user.role===0?String(input.store||'').trim().slice(0,100):user.store);
  if(!target&&user.role===0&&!store)throw new ApiError('storeRequired');
  const token=secret(),hash=await sha(token);const expires=Date.now()+24*3600000;
  await db().prepare('INSERT INTO road_invitations (hash,issuer,role,store,target,expires,used_by,revoked,created_at) VALUES (?,?,?,?,?,?,NULL,0,?)').bind(hash,user.id,role,store,target?.id??null,expires,now()).run();await auditLog(user.id,'invite',target?.id??null,`role:${role}`);return json({token,expires,role,store});
 }
 if(input.action==='revokeInvite'){if(typeof input.hash!=='string')throw new ApiError('invalid');await db().prepare('UPDATE road_invitations SET revoked = 1 WHERE hash = ? AND issuer = ? AND used_by IS NULL').bind(input.hash,user.id).run();return json({ok:true});}
 if(typeof input.id!=='string'||!await canAccess(user,input.id,true))throw new ApiError('denied',403);
 const target=await getMember(input.id);if(!target)throw new ApiError('notFound',404);
 if(input.action==='rename'){const n=validName(input.name);const duplicate=await db().prepare('SELECT id FROM road_members WHERE name_key = ? AND id != ?').bind(nameKey(n),target.id).first();if(duplicate)throw new ApiError('duplicate',409);await db().prepare('UPDATE road_members SET name = ?, name_key = ? WHERE id = ?').bind(n,nameKey(n),target.id).run();await auditLog(user.id,'rename',target.id,n);return json({ok:true});}
 if(input.action==='active'){if(typeof input.active!=='boolean')throw new ApiError('invalid');await db().batch([db().prepare('UPDATE road_members SET active = ? WHERE id = ?').bind(input.active?1:0,target.id),db().prepare('DELETE FROM road_sessions WHERE member_id = ?').bind(target.id),db().prepare('UPDATE road_invitations SET revoked = 1 WHERE issuer = ? AND used_by IS NULL').bind(target.id)]);await auditLog(user.id,input.active?'activate':'disable',target.id);return json({ok:true});}
 if(input.action==='assign'){
  if(user.role!==0||typeof input.leaderId!=='string'||target.role!==3)throw new ApiError('denied',403);
  const leader=await getMember(input.leaderId);if(!leader?.active||leader.role!==2)throw new ApiError('invalid');
  await db().prepare('UPDATE road_members SET leader_id = ?, store = ? WHERE id = ?').bind(leader.id,leader.store,target.id).run();await auditLog(user.id,'assign',target.id,leader.id);return json({ok:true});
 }
 if(input.action==='merge'){
  if(target.role!==3||typeof input.into!=='string'||input.into===target.id||!await canAccess(user,input.into,true))throw new ApiError('denied',403);const dest=await getMember(input.into);if(!dest?.active||dest.role!==3)throw new ApiError('invalid');
  await db().batch([db().prepare('UPDATE road_records SET owner = ? WHERE owner = ?').bind(dest.id,target.id),db().prepare('UPDATE road_members SET active = 0 WHERE id = ?').bind(target.id),db().prepare('DELETE FROM road_sessions WHERE member_id = ?').bind(target.id),db().prepare('UPDATE road_invitations SET revoked = 1 WHERE target = ?').bind(target.id)]);await auditLog(user.id,'merge',target.id,dest.id);return json({ok:true});
 }
 throw new ApiError('invalid');
}catch(e){return failure(e);}}
