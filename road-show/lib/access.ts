import { cookies } from 'next/headers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { db } from './db';
export const ADMIN_EMAIL = 'guoyiding273@outlook.com';
export const SESSION_COOKIE = 'road_session';
export type Member = {id:string;name:string;name_key:string;role:number;leader_id:string|null;store:string;active:number;verified:number;created_at:string};
export class ApiError extends Error { constructor(public code:string,public status=400){super(code);} }
export const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export function failure(e:unknown){if(e instanceof ApiError)return json({error:e.code},e.status);console.error('Road Show operation failed',e);return json({error:'unavailable'},503);}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');if(request.headers.get('sec-fetch-site')==='cross-site'||(origin&&origin!==new URL(request.url).origin))throw new ApiError('origin',403);}
export async function payload(request:Request){sameOrigin(request);const body=await request.text();if(body.length>70000)throw new ApiError('tooLarge',413);try{return JSON.parse(body);}catch{throw new ApiError('invalid');}}
export async function sha(text:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
export function secret(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');}
export const now=()=>new Date().toISOString();
export const nameKey=(s:string)=>s.trim().replace(/\s+/g,' ').toLowerCase();
export function validName(value:unknown){
 if(typeof value!=='string')throw new ApiError('nameInvalid');const n=value.trim().replace(/\s+/g,' ');
 if(!/^[A-Za-z][A-Za-z0-9.' -]{0,39}(?:_[A-Za-z][A-Za-z0-9.' -]{0,39})?(?:_[0-9]{2,4})?$/.test(n))throw new ApiError('nameInvalid');return n;
}
export async function qrRequired(){return (await db().prepare("SELECT value FROM road_settings WHERE key = 'qr_required'").first<{value:string}>())?.value==='true';}
export async function getMember(id:string){return db().prepare('SELECT * FROM road_members WHERE id = ?').bind(id).first<Member>();}
export async function actor():Promise<Member|null>{
 const identity=await getChatGPTUser();
 if(identity?.email.toLowerCase()===ADMIN_EMAIL){
  await db().prepare('INSERT OR IGNORE INTO road_members (id,name,name_key,role,leader_id,store,active,verified,created_at) VALUES (?,?,?,0,NULL,?,1,1,?)').bind(identity.userId,'Yiding Guo','__root__','',now()).run();
  const root=await getMember(identity.userId);if(root?.role===0)return root;
  throw new ApiError('denied',403);
 }
 const token=(await cookies()).get(SESSION_COOKIE)?.value;if(!token)return null;
 const session=await db().prepare('SELECT member_id, verified FROM road_sessions WHERE hash = ? AND expires > ?').bind(await sha(token),Date.now()).first<{member_id:string;verified:number}>();
 if(!session)return null;const user=await getMember(session.member_id);if(!user||!user.active||user.role===0)return null;
 if((user.role<3||await qrRequired())&&!session.verified)return null;
 return user;
}
export async function requireActor(){const user=await actor();if(!user)throw new ApiError('loginRequired',401);return user;}
export function visibleScope(user:Member,alias='m'):{sql:string;args:string[]}{
 if(user.role===0)return {sql:'1=1',args:[]};
 if(user.role===1)return {sql:`(${alias}.id = ? OR (${alias}.role > 1 AND (${alias}.leader_id = ? OR ${alias}.leader_id IN (SELECT id FROM road_members WHERE leader_id = ? AND role = 2))))`,args:[user.id,user.id,user.id]};
 if(user.role===2)return {sql:`(${alias}.id = ? OR (${alias}.role = 3 AND ${alias}.leader_id = ?))`,args:[user.id,user.id]};
 return {sql:`${alias}.id = ?`,args:[user.id]};
}
export async function canAccess(user:Member,id:string,manage=false){if(id===user.id)return !manage;if(user.role===0){const target=await getMember(id);return !manage||Boolean(target&&target.role>0);}const scope=visibleScope(user);return Boolean(await db().prepare(`SELECT id FROM road_members m WHERE m.id = ? AND ${scope.sql} AND m.role > ?`).bind(id,...scope.args,user.role).first());}
export async function auditLog(actorId:string,action:string,target:string|null,detail=''){await db().prepare('INSERT INTO road_audit (actor,action,target,detail,created_at) VALUES (?,?,?,?,?)').bind(actorId,action,target,detail,now()).run();}
export async function createSession(memberId:string,verified:boolean){const token=secret();await db().prepare('INSERT INTO road_sessions (hash,member_id,expires,verified) VALUES (?,?,?,?)').bind(await sha(token),memberId,Date.now()+30*86400000,verified?1:0).run();return token;}
export function withSession(response:Response,token:string,request:Request){const secure=new URL(request.url).protocol==='https:'?'; Secure':'';response.headers.set('Set-Cookie',`${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`);return response;}
