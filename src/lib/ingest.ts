import { extractText, getDocumentProxy } from "unpdf";

const CHUNK_SIZE = 700;
const CHUNK_OVERLAP = 100;

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export async function extractPdfPages(
  file: ArrayBuffer
): Promise<ExtractedPage[]> {
  const pdf = await getDocumentProxy(new Uint8Array(file));
  const { text } = await extractText(pdf, { mergePages: false });
  return text.map((pageText, index) => ({
    pageNumber: index + 1,
    text: pageText,
  }));
}

export interface TextChunk {
  content: string;
  pageNumber: number;
}

// ページ内テキストを、文の区切りを尊重しつつ一定文字数(オーバーラップ付き)でチャンク化する
export function chunkPage(page: ExtractedPage): TextChunk[] {
  const normalized = page.text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const chunks: TextChunk[] = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_SIZE, normalized.length);
    const content = normalized.slice(start, end).trim();
    if (content) {
      chunks.push({ content, pageNumber: page.pageNumber });
    }
    if (end >= normalized.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

export function chunkPages(pages: ExtractedPage[]): TextChunk[] {
  return pages.flatMap(chunkPage);
}
