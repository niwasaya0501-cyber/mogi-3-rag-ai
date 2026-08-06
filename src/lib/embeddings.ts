import { embed, embedMany } from "ai";
import { gateway } from "@ai-sdk/gateway";

const EMBEDDING_MODEL = "openai/text-embedding-3-small";

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: gateway.textEmbeddingModel(EMBEDDING_MODEL),
    value: text,
  });
  return embedding;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: gateway.textEmbeddingModel(EMBEDDING_MODEL),
    values: texts,
  });
  return embeddings;
}
