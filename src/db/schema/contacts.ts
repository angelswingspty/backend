import { serial, text, timestamp } from "drizzle-orm/pg-core";
import { app } from "./namespace.js";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contactsTable = app.table("contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertContactSchema = createInsertSchema(contactsTable).omit({ id: true, createdAt: true });
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contactsTable.$inferSelect;
