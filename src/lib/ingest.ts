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

// 「1. 見出し」形式と「第1章 見出し」形式の両方の見出しに対応する
const SECTION_HEADING_RE = /^(?:\d+\.\s+\S|第\d+章\s*\S)/;

// ページのテキストを「1. 見出し」のような番号見出し単位で分割する。
// 見出し行が見つかるまでの前置き(会社名・改定日等)は、直後の最初のセクションに含める。
function splitIntoSections(rawText: string): string[] {
  const lines = rawText
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const sections: string[] = [];
  let current: string[] = [];
  let sawHeading = false;

  for (const line of lines) {
    const isHeading = SECTION_HEADING_RE.test(line);
    if (isHeading && sawHeading) {
      sections.push(current.join(" "));
      current = [line];
    } else {
      current.push(line);
      if (isHeading) sawHeading = true;
    }
  }
  if (current.length) sections.push(current.join(" "));
  return sections;
}

// 一定文字数(オーバーラップ付き)でチャンク化する(セクションが長すぎる場合のフォールバック)
function chunkByFixedSize(text: string, pageNumber: number): TextChunk[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const chunks: TextChunk[] = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_SIZE, normalized.length);
    const content = normalized.slice(start, end).trim();
    if (content) {
      chunks.push({ content, pageNumber });
    }
    if (end >= normalized.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

// ページ内テキストを、見出し(セクション)単位を尊重しつつチャンク化する。
// 見出しが見つからない文書は、従来通り固定文字数での分割にフォールバックする。
export function chunkPage(page: ExtractedPage): TextChunk[] {
  const sections = splitIntoSections(page.text);
  if (sections.length <= 1) {
    return chunkByFixedSize(page.text, page.pageNumber);
  }
  return sections.flatMap((section) =>
    chunkByFixedSize(section, page.pageNumber)
  );
}

export function chunkPages(pages: ExtractedPage[]): TextChunk[] {
  return pages.flatMap(chunkPage);
}
