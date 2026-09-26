import { actor, qrRequired, json, failure, payload, ApiError, validName, nameKey, createSession, withSession, sha, now, auditLog, getMember, SESSION_COOKIE } from '@/lib/access';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
export const dynamic='force-dynamic';
type Invite={hash:string;issuer:string;role:number;store:string;target:string|null;expires:number;used_by:string|null;revoked:number};
async function invite(token:unknown){if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw new ApiError('inviteInvalid');const i=await db().prepare('SELECT * FROM road_invitations WHERE hash = ?').bind(await sha(token)).first<Invite>();if(!i||i.used_by||i.revoked||i.expires<Date.now())throw new ApiError('inviteInvalid');const issuer=await getMember(i.issuer);if(!issuer?.active||issuer.role>=i.role)throw new ApiError('inviteInvalid');return {i,issuer};}
export async function GET(){try{return json({user:await actor(),qrRequired:await qrRequired()});}catch(e){return failure(e);}}
export async function POST(request:Request){try{
 const input=await payload(request);
 if(input.action==='logout'){const token=(await cookies()).get(SESSION_COOKIE)?.value;if(token)await db().prepare('DELETE FROM road_sessions WHERE hash = ?').bind(await sha(token)).run();const r=json({ok:true});r.headers.set('Set-Cookie',`${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);return r;}
 if(input.action==='inspect'){const {i,issuer}=await invite(input.token);const target=i.target?await getMember(i.target):null;return json({role:i.role,store:i.store,leader:issuer.name,target:target?.name||null,expires:i.expires});}
 const required=await qrRequired();const hasInvite=Boolean(input.token);const context=hasInvite?await invite(input.token):null;
 if(required&&!context)throw new ApiError('inviteRequired',403);
 if(input.action==='login'){
  if(context)throw new ApiError('invalid');const n=validName(input.name);const existing=await db().prepare('SELECT * FROM road_members WHERE name_key = ?').bind(nameKey(n)).first<import('@/lib/access').Member>();
  if(!existing)throw new ApiError('notFound',404);if(!existing.active||existing.role!==3||existing.verified)throw new ApiError('useInvite',403);
  return withSession(json({user:existing}),await createSession(existing.id,false),request);
 }
 if(input.action!=='register')throw new ApiError('invalid');
 const n=validName(input.name);const role=context?.i.role??3;const leader=context?.issuer;const target=context?.i.target?await getMember(context.i.target):null;
 if(context?.i.target&&(!target||!target.active||target.role!==role))throw new ApiError('inviteInvalid');
 if(target&&nameKey(n)!==target.name_key)throw new ApiError('targetName');
 if(leader&&!target&&n.includes('_')){const suffix=n.split('_')[1];const leaderName=leader.name.split('_')[0];if(nameKey(suffix)!==nameKey(leaderName))throw new ApiError('leaderSuffix');}
 const existing=await db().prepare('SELECT id FROM road_members WHERE name_key = ?').bind(nameKey(n)).first<{id:string}>();
 if(existing&&existing.id!==target?.id)return json({error:'duplicate',leader:leader?.name.split('_')[0]||null},409);
 const id=target?.id||crypto.randomUUID();
 if(context){
  // D1 batch is transactional. A consumed invite cannot create a second member.
  const claim=db().prepare('UPDATE road_invitations SET used_by = ? WHERE hash = ? AND used_by IS NULL AND revoked = 0 AND expires > ?').bind(id,context.i.hash,Date.now());
  const write=target?db().prepare('UPDATE road_members SET verified = 1 WHERE id = ? AND EXISTS (SELECT 1 FROM road_invitations WHERE hash = ? AND used_by = ?)').bind(id,context.i.hash,id):db().prepare('INSERT INTO road_members (id,name,name_key,role,leader_id,store,active,verified,created_at) SELECT ?,?,?,?,?,?,1,1,? WHERE EXISTS (SELECT 1 FROM road_invitations WHERE hash = ? AND used_by = ?)').bind(id,n,nameKey(n),role,leader!.id,context.i.store,now(),context.i.hash,id);
  const result=await db().batch([claim,write]);if(result[0].meta.changes!==1)throw new ApiError('inviteInvalid');
 }else{
  const result=await db().prepare('INSERT OR IGNORE INTO road_members (id,name,name_key,role,leader_id,store,active,verified,created_at) VALUES (?,?,?,3,NULL,?,1,0,?)').bind(id,n,nameKey(n),'',now()).run();if(result.meta.changes!==1)throw new ApiError('duplicate',409);
 }
 await auditLog(id,target?'recover':'register',id);
 return withSession(json({user:await getMember(id)}),await createSession(id,hasInvite),request);
}catch(e){return failure(e);}}
