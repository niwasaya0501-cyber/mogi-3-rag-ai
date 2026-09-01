import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { embedText } from "@/lib/embeddings";
import { searchRelevantChunks } from "@/lib/search";

export const maxDuration = 60;

const CHAT_MODEL = "openai/gpt-4o-mini";

function buildSystemPrompt(context: string) {
  return [
    "あなたは社内マニュアル検索アシスタントです。",
    "以下の「参考文書」に書かれている内容のみを根拠に回答してください。",
    "参考文書に書かれていない内容は、推測せず「文書内に該当する情報が見つかりませんでした」と答えてください。",
    "回答の最後に、根拠にした文書名とページ番号を「出典: 文書名 (p.X)」の形式で必ず列挙してください。",
    "同じ内容が複数の文書に書かれている場合は、一方だけでなく該当する文書すべてを出典として列挙してください。",
    "",
    "## 参考文書",
    context || "(該当する文書が見つかりませんでした)",
  ].join("\n");
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { messages }: { messages: UIMessage[] } = await request.json();
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const question = lastUserMessage?.parts
    ?.filter((p) => p.type === "text")
    .map((p) => ("text" in p ? p.text : ""))
    .join(" ")
    .trim();

  if (!question) {
    return NextResponse.json({ error: "empty_question" }, { status: 400 });
  }

  const queryEmbedding = await embedText(question);
  const results = await searchRelevantChunks(queryEmbedding, 5);

  const context = results
    .map(
      (r) =>
        `[${r.documentTitle} p.${r.pageNumber ?? "?"}]\n${r.content}`
    )
    .join("\n\n---\n\n");

  const result = streamText({
    model: gateway(CHAT_MODEL),
    system: buildSystemPrompt(context),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
