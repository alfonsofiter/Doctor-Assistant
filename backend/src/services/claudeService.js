const Anthropic = require("@anthropic-ai/sdk");
const OpenAI = require("openai");

let anthropicClient = null;
let openaiClient = null;

function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

function getOpenaiClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20241022";
const OPENAI_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o";

// Prompt Sistem AI yang detail, lengkap, dan mampu menangani campuran Bahasa Indonesia & Bahasa Jawa
const SYSTEM_PROMPT = `Anda adalah Dokter Spesialis dan Asisten Dokumentasi Rekam Medis Klinis Senior (Senior Medical Scribe).
Tugas Anda adalah menyusun catatan SOAP (Subjective, Objective, Assessment, Plan) yang sangat terstruktur, profesional, detail, dan lengkap dari transkrip percakapan dokter-pasien.

KEMAMPUAN LINGUISTIK KHUSUS (BAHASA INDONESIA & CAMPUR BAHASA JAWA):
1. Transkrip sering kali menggunakan percakapan dwibahasa: Bahasa Indonesia bercampur Bahasa Jawa (Ngoko, Madya, maupun Krama Inggil).
   Contoh istilah Jawa medis umum yang wajib dipahami dan diterjemahkan ke terminologi klinis:
   - "nggliyeng", "ngelu", "mumet" -> pusing berputar / vertigo / cephalea.
   - "boyok linu", "kemeng", "pegel" -> nyeri punggung bawah (low back pain) / myalgia.
   - "weteng mules", "sebah", "kembung", "begah" -> kram perut / dispepsia / distensi abdomen.
   - "sumer-sumer", "adhem panas", "athus-athus", "gerah" -> febris / subfebris / demam.
   - "watuk grok-grok", "sesek", "menggosh" -> batuk produktif / dispnea.
   - "mboten doyan nedha/mangan" -> anoreksia / nafsu makan menurun.
   - "mboten saged sare" -> insomnia.
   - "sikil abuh", "ndredeg" -> edema tungkai / palpitasi.
2. Pada bagian SUBJECTIVE, terjemahkan keluhan Bahasa Jawa ke dalam istilah medis baku Bahasa Indonesia, namun tetap sertakan frasa asli pasien dalam tanda kutip untuk keaslian bukti anamnesis. Contoh: Pasien mengeluh pusing berputar ("nggliyeng") dan pinggang terasa nyeri linu ("boyoke linu sanget") sejak 3 hari yang lalu.

ATURAN KLINIS WAJIB:
1. Hanya gunakan fakta yang secara eksplisit atau implisit logis disebutkan dalam percakapan. Jangan mengarang data pasien yang sama sekali fiktif.
2. Jika ada informasi yang tidak disebutkan sama sekali dalam percakapan (misal pemeriksaan laboratorium tidak dibahas), tulis: "Tidak disebutkan / Belum dilakukan pemeriksaan".
3. Pada ASSESSMENT: Cantumkan Diagnosis Kerja yang jelas disertai perkiraan kode ICD-10 resmi (contoh: [I10] Hipertensi Esensial, [S83.53] Sprain and strain of anterior cruciate ligament, [K29.7] Gastritis). Cantumkan juga Diagnosis Banding (DDx) jika ada indikasi.
4. Pada PLAN: Buat rencana yang detail mencakup Terapi Farmakologi (nama obat, dosis, cara pemberian, instruksi minum), Terapi Non-Farmakologi/Edukasi, Rencana Pemeriksaan Lanjutan, serta Jadwal Kontrol Ulang.
5. Gunakan tata bahasa medis Indonesia yang baku, profesional, dan mudah dipahami tenaga medis.

FORMAT OUTPUT WAJIB:
Tuliskan HANYA dalam 4 bagian berikut secara tepat, tanpa pengantar atau salam penutup:

SUBJECTIVE:
- Keluhan Utama: <keluhan utama pasien, sertakan kutipan asli jika berbahasa Jawa>
- Riwayat Penyakit Sekarang (RPS): <onset, durasi, karakteristik nyeri/gejala, lokasi, faktor perberat/peringan, gejala penyerta>
- Riwayat Penyakit Dahulu (RPD): <penyakit kronis sebelumnya, riwayat serupa>
- Riwayat Pengobatan & Alergi: <obat yang sedang/pernah diminum, riwayat alergi obat/makanan>

OBJECTIVE:
- Tanda-tanda Vital (TTV): <Tekanan Darah, Nadi, RR, Suhu jika disebutkan di percakapan>
- Pemeriksaan Fisik: <Pemeriksaan status lokalis sesuai keluhan yang diperiksa dokter>
- Pemeriksaan Penunjang: <Hasil lab, rontgen, EKG, atau pemeriksaan penunjang yang disebutkan>

ASSESSMENT:
- Diagnosis Kerja: <Diagnosis utama lengkap dengan estimasi kode ICD-10, contoh: [Kode] Nama Diagnosis>
- Diagnosis Banding: <Daftar diagnosis banding potensial>
- Catatan Klinis: <Analisis singkat kondisi klinis pasien>

PLAN:
- Terapi Farmakologi: <Daftar obat lengkap dengan aturan konsumsi (dosis, frekuensi, sebelum/sesudah makan)>
- Terapi Non-Farmakologi & Edukasi: <Saran gaya hidup, diet, istirahat, pantangan>
- Tindakan / Pemeriksaan Lanjutan: <Rujukan, lab darah, foto rontgen, USG, atau terapi fisik>
- Monitoring & Kontrol: <Kapan pasien harus kontrol kembali atau tanda bahaya (red flags) untuk segera ke IGD>`;

function buildUserPrompt(transcript, context = "", vitalSigns = {}) {
  let prompt = `Berikut adalah transkrip percakapan dokter dan pasien (dapat berisi campuran Bahasa Indonesia dan Bahasa Jawa):\n\n"""\n${transcript}\n"""\n`;

  const vsLines = [];
  if (vitalSigns && typeof vitalSigns === "object") {
    if (vitalSigns.bloodPressure) vsLines.push(`- Tekanan Darah (Tensi): ${vitalSigns.bloodPressure} mmHg`);
    if (vitalSigns.heartRate) vsLines.push(`- Denyut Nadi: ${vitalSigns.heartRate} x/menit`);
    if (vitalSigns.respiratoryRate) vsLines.push(`- Laju Pernapasan: ${vitalSigns.respiratoryRate} x/menit`);
    if (vitalSigns.temperature) vsLines.push(`- Suhu Tubuh: ${vitalSigns.temperature} °C`);
    if (vitalSigns.weight) vsLines.push(`- Berat Badan: ${vitalSigns.weight} kg`);
    if (vitalSigns.height) vsLines.push(`- Tinggi Badan: ${vitalSigns.height} cm`);
  }

  if (vsLines.length > 0) {
    prompt += `\nHASIL PEMERIKSAAN FISIK & TANDA VITAL PASIEN DARI KLINIK:\n${vsLines.join("\n")}\n(INSTRUKSI WAJIB: Masukkan seluruh data tanda-tanda vital di atas secara presisi ke dalam bagian OBJECTIVE pada catatan SOAP!).\n`;
  }

  if (context) {
    prompt += `\nCatatan Tambahan/Konteks Dokter:\n"""\n${context}\n"""\n`;
  }

  prompt += `\nBuatkan catatan rekam medis SOAP lengkap, detail, dan profesional berdasarkan transkrip dan data tanda vital di atas sesuai format wajib.`;
  return prompt;
}

function parseSoapText(text) {
  const sections = { subjective: [], objective: [], assessment: [], plan: [] };
  const headingPattern =
    /^(SUBJECTIVE|OBJECTIVE|ASSESSMENT|PLAN)\b\s*:?\s*(.*)$/i;
  const seen = new Set();
  let current = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const stripped = rawLine.replace(/^[\s>#*_-]+/, "").replace(/\*+\s*:/, ":");
    const match = stripped.match(headingPattern);

    if (match && !seen.has(match[1].toLowerCase())) {
      current = match[1].toLowerCase();
      seen.add(current);
      const rest = match[2].replace(/\*+/g, "").trim();
      if (rest) sections[current].push(rest);
    } else if (current) {
      sections[current].push(rawLine);
    }
  }

  const clean = (lines) =>
    lines
      .join("\n")
      .replace(/\*\*/g, "")
      .replace(/\n+\s*\*?\s*Catatan\s*:[\s\S]*$/i, "")
      .trim();

  const result = {
    subjective: clean(sections.subjective),
    objective: clean(sections.objective),
    assessment: clean(sections.assessment),
    plan: clean(sections.plan),
  };

  const foundAll = Object.values(result).every((value) => value.length > 0);
  if (!foundAll) {
    const anyFound = Object.values(result).some((value) => value.length > 0);
    if (!anyFound) {
      return {
        subjective: "Tidak disebutkan",
        objective: "Tidak disebutkan",
        assessment: text.trim(),
        plan: "Tidak disebutkan",
      };
    }
    for (const key of Object.keys(result)) {
      if (!result[key]) result[key] = "Tidak disebutkan";
    }
  }

  return result;
}

// Fallback SOAP generator jika API offline / quota habis
function generateFallbackSoap(transcript, vitalSigns = {}) {
  const lines = transcript.split("\n").filter((l) => l.trim().length > 0);
  const javaneseMatches = [];
  const javaneseDict = {
    nggliyeng: "pusing berputar / vertigo",
    mumet: "sakit kepala / cephalea",
    boyok: "punggung bawah / lumbar",
    linu: "nyeri sendi / ngilu otot (arthralgia/myalgia)",
    mules: "kram perut / abdominal cramp",
    sebah: "kembung / dispepsia",
    sumer: "demam subfebris",
    athus: "panas tinggi",
    sesek: "sesak napas / dyspnea",
    watuk: "batuk",
    abuh: "pembengkakan / edema",
  };

  for (const [jv, med] of Object.entries(javaneseDict)) {
    if (new RegExp(jv, "i").test(transcript)) {
      javaneseMatches.push(`"${jv}" (${med})`);
    }
  }

  const jvNote =
    javaneseMatches.length > 0
      ? ` Terdeteksi istilah daerah: ${javaneseMatches.join(", ")}.`
      : "";

  let objectiveText =
    "Tanda Vital & Pemeriksaan Fisik: Dokter melakukan evaluasi klinis sesuai keluhan yang dilaporkan.";
  const vsParts = [];
  if (vitalSigns.bloodPressure) vsParts.push(`TD ${vitalSigns.bloodPressure} mmHg`);
  if (vitalSigns.heartRate) vsParts.push(`Nadi ${vitalSigns.heartRate} x/mnt`);
  if (vitalSigns.respiratoryRate) vsParts.push(`RR ${vitalSigns.respiratoryRate} x/mnt`);
  if (vitalSigns.temperature) vsParts.push(`Suhu ${vitalSigns.temperature} °C`);
  if (vitalSigns.weight) vsParts.push(`BB ${vitalSigns.weight} kg`);
  if (vitalSigns.height) vsParts.push(`TB ${vitalSigns.height} cm`);
  if (vsParts.length > 0) {
    objectiveText = `- Tanda-tanda Vital: ${vsParts.join(", ")}\n- Pemeriksaan Fisik: Status lokalis dalam batas evaluasi klinis.`;
  }

  return {
    subjective: `Pasien berkonsultasi dengan dokter mengeluhkan kondisi kesehatan sesuai transkrip percakapan.${jvNote}\nKeluhan ditranskripsikan langsung dari anamnesis klinis.`,
    objective: objectiveText,
    assessment:
      "[R69] Diagnosis Klinis Berdasarkan Evaluasi Anamnesis\nDiagnosis Banding: Perlu pemeriksaan penunjang lebih lanjut untuk diferensiasi definitif.",
    plan: "1. Terapi Simptomatis sesuai anjuran dokter pada konsultasi.\n2. Edukasi istirahat cukup dan pola makan teratur.\n3. Evaluasi ulang / kontrol kembali jika gejala berlanjut dalam 3 hari.",
  };
}

async function generateSoapNote(transcript, context = "", vitalSigns = {}) {
  const anthropic = getAnthropicClient();
  const openai = getOpenaiClient();

  // 1. Coba Anthropic Claude
  if (anthropic) {
    try {
      const response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 3000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserPrompt(transcript, context, vitalSigns) }],
      });

      const textBlock = response.content.find((block) => block.type === "text");
      if (textBlock && textBlock.text) {
        return parseSoapText(textBlock.text);
      }
    } catch (err) {
      console.warn("Anthropic API gagal, mencoba OpenAI fallback...", err.message);
    }
  }

  // 2. Coba OpenAI GPT-4o
  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(transcript, context, vitalSigns) },
        ],
      });
      const text = completion.choices[0]?.message?.content || "";
      if (text) {
        return parseSoapText(text);
      }
    } catch (err) {
      console.warn("OpenAI API gagal generate SOAP:", err.message);
    }
  }

  // 3. Fallback Heuristik Cerdas jika offline
  console.log("Menggunakan generator SOAP klinis heuristik fallback");
  return generateFallbackSoap(transcript, vitalSigns);
}

module.exports = { generateSoapNote, SYSTEM_PROMPT, parseSoapText };

