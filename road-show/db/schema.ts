import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const records = sqliteTable('road_records', {
  id: text('id').primaryKey(),
  owner: text('owner').notNull(),
  payload: text('payload').notNull(),
  revision: integer('revision').notNull().default(1),
  mutation: text('mutation').notNull(),
  updatedAt: text('updated_at').notNull(),
}, t => [index('idx_road_records_owner').on(t.owner)]);

export const members = sqliteTable('road_members', {
  id: text('id').primaryKey(), name: text('name').notNull(), nameKey: text('name_key').notNull(),
  role: integer('role').notNull().default(3), leaderId: text('leader_id'), store: text('store').notNull().default(''),
  active: integer('active').notNull().default(1), verified: integer('verified').notNull().default(0),
  createdAt: text('created_at').notNull(),
}, t => [uniqueIndex('idx_road_members_name_key').on(t.nameKey),index('idx_road_members_leader').on(t.leaderId)]);
export const sessions = sqliteTable('road_sessions', {
  hash: text('hash').primaryKey(), memberId: text('member_id').notNull(), expires: integer('expires').notNull(),
  verified: integer('verified').notNull().default(0),
}, t => [index('idx_road_sessions_member').on(t.memberId)]);
export const settings = sqliteTable('road_settings', { key:text('key').primaryKey(), value:text('value').notNull() });
export const invitations = sqliteTable('road_invitations', {
  hash:text('hash').primaryKey(), issuer:text('issuer').notNull(), role:integer('role').notNull(),
  store:text('store').notNull().default(''), target:text('target'), expires:integer('expires').notNull(),
  usedBy:text('used_by'), revoked:integer('revoked').notNull().default(0), createdAt:text('created_at').notNull(),
}, t => [index('idx_road_invitations_issuer').on(t.issuer)]);
export const audit = sqliteTable('road_audit', {
  id:integer('id').primaryKey({autoIncrement:true}), actor:text('actor').notNull(), action:text('action').notNull(),
  target:text('target'), detail:text('detail').notNull().default(''), createdAt:text('created_at').notNull(),
});
