import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { put } from "@vercel/blob";
import { getDb } from "@/db";
import { documents, chunks } from "@/db/schema";
import { extractPdfPages, chunkPages } from "@/lib/ingest";
import { embedTexts } from "@/lib/embeddings";

export const maxDuration = 300;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const title = formData.get("title");

  if (!(file instanceof File) || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "unsupported_file_type" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();

  const blob = await put(`documents/${crypto.randomUUID()}-${file.name}`, arrayBuffer, {
    access: "private",
    contentType: "application/pdf",
  });

  const pages = await extractPdfPages(arrayBuffer);
  const textChunks = chunkPages(pages);

  if (textChunks.length === 0) {
    return NextResponse.json(
      { error: "no_extractable_text" },
      { status: 422 }
    );
  }

  const embeddings = await embedTexts(textChunks.map((c) => c.content));

  const db = getDb();
  const [document] = await db
    .insert(documents)
    .values({
      title: title.trim(),
      filename: file.name,
      blobUrl: blob.url,
      sourceType: "pdf",
      uploadedBy: userId,
    })
    .returning();

  await db.insert(chunks).values(
    textChunks.map((chunk, index) => ({
      documentId: document.id,
      content: chunk.content,
      pageNumber: chunk.pageNumber,
      embedding: embeddings[index],
    }))
  );

  return NextResponse.json({
    documentId: document.id,
    chunkCount: textChunks.length,
  });
}
