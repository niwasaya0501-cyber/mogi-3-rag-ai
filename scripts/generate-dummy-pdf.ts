import { PDFDocument, StandardFonts } from "pdf-lib";
import { writeFile } from "node:fs/promises";

// E2E検証用: 経費精算に関する簡単な社内マニュアル(ダミー)を生成する
async function main() {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page1 = pdfDoc.addPage([595, 842]);
  page1.drawText("Expense Reimbursement Manual (Dummy)", {
    x: 50,
    y: 780,
    size: 16,
    font,
  });
  page1.drawText(
    [
      "Section 1: Submission Deadline",
      "All expense reports must be submitted within 30 days",
      "of the expense date. Late submissions require manager",
      "approval and a written reason.",
    ].join("\n"),
    { x: 50, y: 700, size: 12, font, lineHeight: 18 }
  );

  const page2 = pdfDoc.addPage([595, 842]);
  page2.drawText(
    [
      "Section 2: Approval Limit",
      "Expenses under 10,000 JPY can be approved by a direct",
      "manager. Expenses of 10,000 JPY or more require",
      "approval from the department head.",
    ].join("\n"),
    { x: 50, y: 780, size: 12, font, lineHeight: 18 }
  );

  const bytes = await pdfDoc.save();
  await writeFile("scripts/dummy-manual.pdf", bytes);
  console.log("Generated scripts/dummy-manual.pdf");
}

main();
