import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const reviews = sqliteTable('reviews', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  fragranceId: text('fragrance_id').notNull(),
  author: text('author').notNull(),
  rating: integer('rating').notNull(),
  experience: text('experience').notNull(),
  disclosure: text('disclosure').notNull(),
  body: text('body').notNull(),
  status: text('status').notNull().default('pending'),
  consent: integer('consent').notNull(),
  createdAt: text('created_at').notNull(),
  moderatedBy: text('moderated_by'),
  moderatedAt: text('moderated_at'),
  moderationNote: text('moderation_note'),
}, table => [
  index('idx_reviews_user_created').on(table.userId, table.createdAt),
  index('idx_reviews_status_created').on(table.status, table.createdAt),
]);
