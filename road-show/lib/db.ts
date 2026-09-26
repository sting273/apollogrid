import { env } from 'cloudflare:workers';
export function db(): D1Database {
  const binding = (env as unknown as {DB?: D1Database}).DB;
  if (!binding) throw new Error('Database binding unavailable');
  return binding;
}
