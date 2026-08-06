import { readFile } from "node:fs/promises";
import { extractPdfPages, chunkPages } from "../src/lib/ingest";
import { embedText, embedTexts } from "../src/lib/embeddings";
import { searchRelevantChunks } from "../src/lib/search";
import { getDb } from "../src/db";
import { documents, chunks } from "../src/db/schema";

// 認証(Clerk)を経由せず、取り込み→埋め込み→pgvector検索のコアパイプラインだけを検証するスクリプト
async function main() {
  console.log("1. PDFテキスト抽出...");
  const pdfBytes = await readFile("scripts/dummy-manual.pdf");
  const pages = await extractPdfPages(pdfBytes.buffer.slice(0));
  console.log(`   ${pages.length}ページ抽出`);

  console.log("2. チャンク分割...");
  const textChunks = chunkPages(pages);
  console.log(`   ${textChunks.length}チャンクに分割`);

  console.log("3. 埋め込み生成...");
  const embeddings = await embedTexts(textChunks.map((c) => c.content));
  console.log(`   ${embeddings.length}件の埋め込みを生成 (次元数: ${embeddings[0]?.length})`);

  console.log("4. Neonへ保存...");
  const db = getDb();
  const [document] = await db
    .insert(documents)
    .values({
      title: "経費精算マニュアル(ダミー・検証用)",
      filename: "dummy-manual.pdf",
      blobUrl: "local://scripts/dummy-manual.pdf",
      sourceType: "pdf",
      uploadedBy: "verify-script",
    })
    .returning();

  await db.insert(chunks).values(
    textChunks.map((chunk, i) => ({
      documentId: document.id,
      content: chunk.content,
      pageNumber: chunk.pageNumber,
      embedding: embeddings[i],
    }))
  );
  console.log(`   document.id = ${document.id}`);

  console.log("5. 質問に対する類似検索...");
  const question = "経費の承認には誰の許可が必要ですか?";
  const queryEmbedding = await embedText(question);
  const results = await searchRelevantChunks(queryEmbedding, 3);

  console.log(`   質問: "${question}"`);
  for (const r of results) {
    console.log(
      `   - [similarity ${r.similarity.toFixed(3)}] ${r.documentTitle} p.${r.pageNumber}: ${r.content.slice(0, 60)}...`
    );
  }

  const topResult = results[0];
  const mentionsApproval =
    topResult?.content.includes("department head") ||
    topResult?.content.includes("manager");

  if (results.length > 0 && mentionsApproval) {
    console.log("\n✅ パイプライン検証OK: 質問に関連するチャンクが正しく検索されました");
  } else {
    console.log("\n⚠️ 期待したチャンクが上位に来ていません。ロジックを確認してください");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
