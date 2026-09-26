'use client';
import {createContext,useContext} from 'react';
export type Lang='zh'|'en';
export const Locale=createContext<Lang>('en');
export const useText=()=>{const lang=useContext(Locale);return (zh:string,en:string)=>lang==='zh'?zh:en;};
const errors:Record<string,[string,string]>={
 unavailable:['云端暂不可用，请重试。本机记录保留。','Service unavailable. Please retry. Local records are retained.'],
 invalid:['请检查填写内容','Please check your input.'],nameInvalid:['请使用公司英文名，可含字母、数字、空格、点、横线。重名使用 英文名_直属领导英文名。','Use your company English name. For duplicates use Name_LeaderName.'],
 duplicate:['该英文名已使用，请按“英文名_直属领导英文名”注册；仍重名可加 _02。已有账户请切换“已有账户”。','Name already used. Register as Name_LeaderName; add _02 if needed. Existing users: choose Returning member.'],
 inviteInvalid:['邀请已使用、过期或已撤销，请联系直属领导','This invitation is used, expired or revoked. Contact your supervisor.'],
 inviteRequired:['已开启二维码注册，请扫描直属领导的邀请或设备恢复二维码','QR registration is enabled. Scan your supervisor’s invitation or device recovery QR.'],
 targetName:['请使用恢复邀请对应的账户名','Use the account name shown in this recovery invitation.'],leaderSuffix:['下划线后的领导英文名需与邀请人一致','The leader suffix must match your inviter’s English name.'],
 useInvite:['此账户需要邀请或恢复二维码，请联系直属领导','This account requires an invitation or recovery QR. Contact your supervisor.'],
 notFound:['未找到此账户，请首次注册','Account not found. Please register first.'],denied:['无权执行此操作','You do not have access to this action.'],
 loginRequired:['登录已过期或需要验证，请重新进入','Session expired or verification required. Please sign in again.'],
 storeRequired:['请填写门店名称','Enter a store name.'],origin:['请求来源无效','Invalid request origin.'],tooLarge:['内容太长，请缩短后重试','Content is too long. Please shorten it.'],
};
export function errorText(code:string,lang:Lang){return errors[code]?.[lang==='zh'?0:1]||errors.unavailable[lang==='zh'?0:1];}
export const roleLabels=[['最高管理员','Owner'],['店长','Store manager'],['店员 / 带队人员','Team lead'],['兼职 / 普通成员','Member']];
