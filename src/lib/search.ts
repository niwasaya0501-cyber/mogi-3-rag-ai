import { cosineDistance, sql, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { chunks, documents } from "@/db/schema";

export interface RetrievedChunk {
  content: string;
  pageNumber: number | null;
  documentId: string;
  documentTitle: string;
  blobUrl: string;
  similarity: number;
}

export async function searchRelevantChunks(
  queryEmbedding: number[],
  topK = 5
): Promise<RetrievedChunk[]> {
  const db = getDb();
  const similarity = sql<number>`1 - (${cosineDistance(chunks.embedding, queryEmbedding)})`;

  const rows = await db
    .select({
      content: chunks.content,
      pageNumber: chunks.pageNumber,
      documentId: documents.id,
      documentTitle: documents.title,
      blobUrl: documents.blobUrl,
      similarity,
    })
    .from(chunks)
    .innerJoin(documents, eq(chunks.documentId, documents.id))
    .orderBy((t) => sql`${t.similarity} desc`)
    .limit(topK);

  return rows;
}
