import { relations } from "drizzle-orm";
import { users, files, images } from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  files: many(files),
  images: many(images),
}));

export const filesRelations = relations(files, ({ one }) => ({
  owner: one(users, { fields: [files.ownerId], references: [users.id] }),
}));

export const imagesRelations = relations(images, ({ one }) => ({
  owner: one(users, { fields: [images.ownerId], references: [users.id] }),
}));
