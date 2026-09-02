import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const assessments = sqliteTable("assessments", {
  id: text("id").primaryKey(),
  postcode: text("postcode").notNull(),
  address: text("address").notNull(),
  annualUsageKwh: integer("annual_usage_kwh").notNull(),
  usageSource: text("usage_source").notNull(),
  panelCount: integer("panel_count").notNull(),
  panelWatts: integer("panel_watts").notNull(),
  systemKwp: real("system_kwp").notNull(),
  annualGenerationKwh: integer("annual_generation_kwh").notNull(),
  annualBillBefore: real("annual_bill_before").notNull(),
  annualBillSolarOnly: real("annual_bill_solar_only").notNull(),
  annualBillSolarBattery: real("annual_bill_solar_battery").notNull(),
  annualBenefit: real("annual_benefit").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const leads = sqliteTable("leads", {
  id: text("id").primaryKey(),
  assessmentId: text("assessment_id").references(() => assessments.id),
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  preferredTime: text("preferred_time").notNull().default(""),
  consent: integer("consent", { mode: "boolean" }).notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const pylonComparisons = sqliteTable("pylon_comparisons", {
  id: text("id").primaryKey(),
  assessmentId: text("assessment_id").notNull().references(() => assessments.id),
  proposalUrl: text("proposal_url").notNull().default(""),
  pylonAnnualUsageKwh: integer("pylon_annual_usage_kwh").notNull(),
  pylonPanelCount: integer("pylon_panel_count").notNull(),
  pylonGenerationKwh: integer("pylon_generation_kwh").notNull(),
  pylonBillBefore: real("pylon_bill_before").notNull(),
  pylonBillAfter: real("pylon_bill_after").notNull(),
  inputHitRate: real("input_hit_rate").notNull(),
  generationHitRate: real("generation_hit_rate").notNull(),
  benefitHitRate: real("benefit_hit_rate").notNull(),
  overallHitRate: real("overall_hit_rate").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const admins = sqliteTable("admins", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
