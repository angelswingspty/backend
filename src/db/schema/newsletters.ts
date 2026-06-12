import { serial, text, timestamp } from "drizzle-orm/pg-core";
import { app } from "./namespace.js";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const newslettersTable = app.table("newsletters", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNewsletterSchema = createInsertSchema(newslettersTable).omit({ id: true, createdAt: true });
export type InsertNewsletter = z.infer<typeof insertNewsletterSchema>;
export type Newsletter = typeof newslettersTable.$inferSelect;
