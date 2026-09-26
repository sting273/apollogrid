import { requireChatGPTUser } from '../chatgpt-auth';
import { ADMIN_EMAIL } from '@/lib/access';
import { redirect } from 'next/navigation';
export const dynamic='force-dynamic';
export default async function AdminEntry(){const user=await requireChatGPTUser('/admin-entry');if(user.email.toLowerCase()!==ADMIN_EMAIL)return <main className="workspace"><h1>Access restricted / 无管理权限</h1><p>Only the designated administrator can use this sign-in.</p><a href="/">Return / 返回</a></main>;redirect('/');}
