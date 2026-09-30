import jsPDF from "jspdf";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_RESERVE = 14;

const COLOR = {
  primary: [15, 118, 110],
  primaryDark: [11, 92, 86],
  sectionBg: [224, 242, 241],
  border: [209, 213, 219],
  text: [31, 41, 55],
  textMuted: [107, 114, 128],
  warnBg: [255, 251, 235],
  warnBorder: [253, 230, 138],
  warnText: [146, 64, 14],
};

function ensureSpace(doc, y, neededHeight) {
  if (y + neededHeight > PAGE_HEIGHT - MARGIN - FOOTER_RESERVE) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function drawLetterhead(doc) {
  doc.setFillColor(...COLOR.primary);
  doc.rect(0, 0, PAGE_WIDTH, 24, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("DOCTOR ASSISTANT", MARGIN, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    "Physician Note Taker Assistant untuk Penulisan Medical Record",
    MARGIN,
    17,
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("CATATAN MEDIS (SOAP)", PAGE_WIDTH - MARGIN, 14, { align: "right" });

  doc.setTextColor(...COLOR.text);
  return 32;
}

function drawWarningBox(doc, y, text) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH - 10);
  const boxHeight = lines.length * 4.5 + 6;

  doc.setFillColor(...COLOR.warnBg);
  doc.setDrawColor(...COLOR.warnBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, boxHeight, 2, 2, "FD");

  doc.setTextColor(...COLOR.warnText);
  let ty = y + 6;
  lines.forEach((line) => {
    doc.text(line, MARGIN + 5, ty);
    ty += 4.5;
  });

  doc.setTextColor(...COLOR.text);
  return y + boxHeight + 8;
}

function drawPatientInfoBox(
  doc,
  y,
  { patientName, consultationDate, consultationId },
) {
  const boxHeight = 22;

  doc.setDrawColor(...COLOR.border);
  doc.setFillColor(250, 250, 250);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, y, CONTENT_WIDTH, boxHeight, "FD");

  const col1X = MARGIN + 6;
  const col2X = MARGIN + CONTENT_WIDTH / 2 + 2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR.textMuted);
  doc.text("NAMA / INISIAL PASIEN", col1X, y + 7);
  doc.text("TANGGAL KONSULTASI", col2X, y + 7);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLOR.text);
  doc.text(patientName || "Tidak disebutkan", col1X, y + 13);
  doc.text(consultationDate || "Tidak disebutkan", col2X, y + 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR.textMuted);
  const printedAt = new Date().toLocaleString("id-ID");
  const idLabel = consultationId
    ? `ID Konsultasi: #${consultationId}`
    : "ID Konsultasi: (belum tersimpan)";
  doc.text(
    `${idLabel}   |   Dicetak pada: ${printedAt}`,
    col1X,
    y + boxHeight - 3,
  );

  doc.setTextColor(...COLOR.text);
  return y + boxHeight + 8;
}

function drawSoapSection(doc, y, title, content) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(
    content && content.trim() ? content : "Tidak disebutkan",
    CONTENT_WIDTH - 10,
  );
  const lineHeight = 5;
  const titleBarHeight = 8;
  const paddingY = 4;
  const boxHeight = titleBarHeight + paddingY * 2 + lines.length * lineHeight;

  y = ensureSpace(doc, y, boxHeight + 6);

  doc.setDrawColor(...COLOR.border);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, y, CONTENT_WIDTH, boxHeight, "S");

  doc.setFillColor(...COLOR.sectionBg);
  doc.rect(MARGIN, y, CONTENT_WIDTH, titleBarHeight, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR.primaryDark);
  doc.text(title, MARGIN + 4, y + 5.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR.text);
  let ty = y + titleBarHeight + paddingY + 3;
  lines.forEach((line) => {
    doc.text(line, MARGIN + 5, ty);
    ty += lineHeight;
  });

  return y + boxHeight + 6;
}

function drawSignatureBlock(doc, y) {
  y = ensureSpace(doc, y, 35);

  const blockWidth = 75;
  const x = PAGE_WIDTH - MARGIN - blockWidth;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR.text);
  doc.text("Dokter Pemeriksa,", x, y);

  const lineY = y + 20;
  doc.setDrawColor(...COLOR.text);
  doc.setLineWidth(0.2);
  doc.line(x, lineY, x + blockWidth, lineY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR.textMuted);
  doc.text("(Nama & Tanda Tangan)", x + blockWidth / 2, lineY + 4, {
    align: "center",
  });

  doc.setTextColor(...COLOR.text);
  return lineY + 12;
}

function writeWrapped(
  doc,
  startY,
  text,
  { fontSize = 10, lineHeight = 5, font = "helvetica", style = "normal" } = {},
) {
  let y = startY;
  doc.setFont(font, style);
  doc.setFontSize(fontSize);
  const rawLines = (text && text.trim() ? text : "-").split("\n");
  const lines = rawLines.flatMap((rawLine) => doc.splitTextToSize(rawLine, CONTENT_WIDTH));
  lines.forEach((line) => {
    if (y > PAGE_HEIGHT - MARGIN - FOOTER_RESERVE) {
      doc.addPage();
      y = MARGIN;
    }
    doc.text(line, MARGIN, y);
    y += lineHeight;
  });
  return y;
}

function drawTranscriptSection(doc, transcript) {
  doc.addPage();

  doc.setFillColor(...COLOR.primary);
  doc.rect(0, 0, PAGE_WIDTH, 16, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("LAMPIRAN - TRANSKRIPSI PERCAKAPAN", MARGIN, 10);

  let y = 24;
  doc.setTextColor(...COLOR.textMuted);
  y = writeWrapped(
    doc,
    y,
    "Dokumentasi internal. Transkripsi mentah hasil speech-to-text, belum tentu merepresentasikan kalimat baku.",
    { fontSize: 8, lineHeight: 4, style: "italic" },
  );
  y += 4;

  doc.setTextColor(...COLOR.text);
  writeWrapped(doc, y, transcript, {
    fontSize: 9.5,
    lineHeight: 5,
    font: "courier",
  });
}

function drawFooters(doc) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i);

    doc.setDrawColor(...COLOR.border);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, PAGE_HEIGHT - 12, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR.textMuted);
    doc.text(
      "Dihasilkan oleh Doctor Assistant - dokumen bantu, wajib divalidasi dokter",
      MARGIN,
      PAGE_HEIGHT - 7,
    );
    doc.text(
      `Halaman ${i} dari ${total}`,
      PAGE_WIDTH - MARGIN,
      PAGE_HEIGHT - 7,
      {
        align: "right",
      },
    );
  }
}

export function downloadSoapPdf({
  patientName,
  consultationDate,
  transcript,
  soap,
  consultationId,
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  let y = drawLetterhead(doc);
  y = drawWarningBox(
    doc,
    y,
    soap.warning ||
      "Catatan ini dihasilkan dengan bantuan AI dan wajib diperiksa kembali oleh dokter sebelum digunakan sebagai rekam medis resmi.",
  );
  y = drawPatientInfoBox(doc, y, {
    patientName,
    consultationDate,
    consultationId,
  });

  y = drawSoapSection(doc, y, "KELUHAN PASIEN (Subjective)", soap.subjective);
  y = drawSoapSection(doc, y, "HASIL PEMERIKSAAN (Objective)", soap.objective);
  y = drawSoapSection(doc, y, "DIAGNOSIS / PENILAIAN (Assessment)", soap.assessment);
  y = drawSoapSection(doc, y, "RENCANA PENGOBATAN (Plan)", soap.plan);

  drawSignatureBlock(doc, y + 4);
  drawTranscriptSection(doc, transcript);
  drawFooters(doc);

  const safeName = (patientName || "pasien").trim().replace(/\s+/g, "_");
  const safeDate = (consultationDate || "tanggal").trim().replace(/\s+/g, "_");
  doc.save(`SOAP_${safeName}_${safeDate}.pdf`);
}
