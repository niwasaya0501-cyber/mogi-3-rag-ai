import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  vector,
  index,
} from "drizzle-orm/pg-core";

// text-embedding-3-small の出力次元数
export const EMBEDDING_DIMENSIONS = 1536;

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  filename: text("filename").notNull(),
  blobUrl: text("blob_url").notNull(),
  sourceType: text("source_type").notNull().default("pdf"),
  // Phase 2: 部署別アクセス制御用。MVPでは未使用(全社員共通アクセス)
  department: text("department"),
  uploadedBy: text("uploaded_by").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const chunks = pgTable(
  "chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    pageNumber: integer("page_number"),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
  },
  (table) => [
    index("chunks_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
  ]
);

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;
