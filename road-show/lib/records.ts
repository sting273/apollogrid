import { z } from 'zod';
const counter = z.object({ SE: z.number().int().min(0).max(999999), W: z.number().int().min(0).max(999999), OTHER: z.number().int().min(0).max(999999) });
export const recordSchema = z.object({
  id: z.string().uuid(), name: z.string().max(200), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  unlocked: z.boolean(), complete: z.boolean(),
  sentence1: z.string().max(5000), sentence2: z.string().max(5000),
  s1a: counter, s1b: counter, s23: counter, s4: counter,
  detail: z.string().max(10000), other: z.string().max(10000),
});
export type RecordData = z.infer<typeof recordSchema>;
export type LocalRecord = RecordData & { revision: number; dirty: boolean; mutation: string; ownerId?:string; ownerName?:string };
export const categories = ['SE', 'W', 'OTHER'] as const;
export type CounterKey = 's1a'|'s1b'|'s23'|'s4';
export function freshRecord(): LocalRecord {
  const now = new Date();
  const date = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,10);
  return { id: crypto.randomUUID(), name: '路演现场', date, createdAt: now.toISOString(), updatedAt: now.toISOString(), unlocked: false, complete: false, sentence1: '', sentence2: '', s1a: {SE:0,W:0,OTHER:0}, s1b: {SE:0,W:0,OTHER:0}, s23: {SE:0,W:0,OTHER:0}, s4: {SE:0,W:0,OTHER:0}, detail:'', other:'', revision:0,dirty:true,mutation:crypto.randomUUID() };
}
export const total = (r: RecordData, k: CounterKey) => categories.reduce((s,c)=>s+r[k][c],0);
