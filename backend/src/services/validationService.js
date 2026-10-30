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

// Glosarium istilah medis Jawa - Indonesia untuk deteksi dan normalisasi
const JAVANESE_CLINICAL_MAP = {
  nggliyeng: "pusing berputar / vertigo",
  mumet: "sakit kepala / cephalea",
  ngelu: "nyeri kepala",
  boyok: "pinggang / punggung bawah (lumbar)",
  linu: "nyeri sendi / pegal otot (myalgia/arthralgia)",
  kemeng: "pegal linu pada otot",
  mules: "kram perut / abdominal cramp",
  sebah: "kembung / begah (abdominal bloating)",
  sumer: "demam ringan / subfebris",
  athus: "demam tinggi / panas membara",
  gerah: "demam / badan terasa panas",
  adhem: "kedinginan / menggigil (chills)",
  watuk: "batuk",
  sesek: "sesak napas / dyspnea",
  menggosh: "napas terengah-engah / mengi",
  abuh: "bengkak / edema",
  ndredeg: "gemetar / jantung berdebar (palpitasi)",
  pegel: "pegal-pegal",
  sare: "tidur (misal: mboten saged sare = insomnia)",
  nedha: "makan (misal: mboten doyan nedha = anoreksia)",
  unjuk: "minum obat",
};

// Kata kunci medis umum untuk evaluasi heuristik
const MEDICAL_KEYWORDS = [
  "dokter", "pasien", "sakit", "keluhan", "nyeri", "demam", "pusing", "obat",
  "resep", "tensi", "darah", "batuk", "flu", "mual", "muntah", "diare", "infeksi",
  "periksa", "gejala", "alergi", "lambung", "jantung", "paru", "lutut", "kaki",
  "tangan", "sendi", "otot", "radang", "perut", "minum", "dosis", "sembuh"
];

// Heuristik validator cadangan
function evaluateHeuristicPlausibility(transcript, context = "", stage = 1, vitalSigns = {}) {
  const vsText = vitalSigns ? Object.values(vitalSigns).filter(Boolean).join(" ") : "";
  const text = `${transcript} ${context} ${vsText}`.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);

  // 1. Deteksi Bahasa Jawa
  const javaneseTermsFound = [];
  for (const [jv, idn] of Object.entries(JAVANESE_CLINICAL_MAP)) {
    if (new RegExp(`\\b${jv}\\b`, "i").test(text)) {
      javaneseTermsFound.push({ term: jv, meaning: idn });
    }
  }

  // 2. Hitung densitas medis
  let medicalHitCount = 0;
  for (const kw of MEDICAL_KEYWORDS) {
    if (text.includes(kw)) medicalHitCount++;
  }
  medicalHitCount += javaneseTermsFound.length;
  if (vitalSigns && (vitalSigns.bloodPressure || vitalSigns.heartRate)) {
    medicalHitCount += 3;
  }

  // 3. Deteksi dialog antara pembicara
  const hasMultipleTurns =
    /(dokter|pasien|pembicara\s*[12ab]|a:|b:)/i.test(transcript) ||
    transcript.split("\n").filter((l) => l.trim()).length >= 2;

  // 4. Deteksi kejanggalan ekstrem / non-medis
  const nonsenseIndicators = [
    "alien", "terbang ke mars", "bitcoin", "skincare korea", "chelsea vs arsenal",
    "masak rendang", "beli baju", "resep martabak"
  ];
  let nonsenseHit = false;
  for (const non of nonsenseIndicators) {
    if (text.includes(non)) {
      nonsenseHit = true;
      break;
    }
  }

  const issues = [];
  const suggestions = [];

  if (words.length < 8) {
    issues.push("Transkrip terlalu pendek untuk dianalisis sebagai percakapan klinis bermakna.");
    suggestions.push("Lakukan anamnesis lebih mendalam atau pastikan mikrofon merekam seluruh dialog.");
  }

  if (medicalHitCount < 2 && !context) {
    issues.push("Tidak terdeteksi keluhan medis, gejala fisik, atau pembahasan klinis yang relevan.");
    suggestions.push("Pastikan transkrip berisi percakapan dokter-pasien mengenai keluhan kesehatan.");
  }

  if (nonsenseHit) {
    issues.push("Terdeteksi konten percakapan di luar konteks medis klinis.");
    suggestions.push("Hapus bagian percakapan non-medis atau masukkan catatan klarifikasi dokter.");
  }

  // Perhitungan skor
  let score = 50;
  if (words.length >= 15) score += 15;
  if (medicalHitCount >= 2) score += 20;
  if (medicalHitCount >= 5) score += 10;
  if (hasMultipleTurns) score += 10;
  if (javaneseTermsFound.length > 0) score += 5;
  if (context && context.trim().length > 5) score += 15;
  if (nonsenseHit) score -= 40;
  if (words.length < 8) score -= 30;

  score = Math.max(0, Math.min(100, score));

  const isValid = score >= (stage === 2 ? 60 : 65);
  const verdict = isValid
    ? "MASUK_AKAL"
    : score >= 45
    ? "PERLU_KLARIFIKASI"
    : "TIDAK_MASUK_AKAL";

  return {
    stage,
    is_valid: isValid,
    plausibility_score: score,
    verdict,
    summary: isValid
      ? "Transkrip mencerminkan interaksi klinis yang masuk akal dan memuat keluhan medis yang dapat ditindaklanjuti."
      : "Transkrip terdeteksi kurang masuk akal atau belum memenuhi standar percakapan medis klinis.",
    javanese_detected: javaneseTermsFound.length > 0,
    javanese_terms: javaneseTermsFound,
    issues: issues.length > 0 ? issues : ["Tidak ditemukan kejanggalan fatal."],
    suggestions: suggestions.length > 0 ? suggestions : ["Transkrip siap diproses untuk generate SOAP Note."],
    clinical_observations: [
      `Densitas istilah klinis terdeteksi: ${medicalHitCount} indikator.`,
      hasMultipleTurns ? "Struktur tanya-jawab antar pembicara terdeteksi." : "Struktur dialog tunggal / belum terpisah jelas.",
      javaneseTermsFound.length > 0
        ? `Terdeteksi ${javaneseTermsFound.length} ungkapan Bahasa Jawa yang telah dinormalisasi.`
        : "Bahasa dominan: Bahasa Indonesia medis standard."
    ]
  };
}

const VALIDATION_SYSTEM_PROMPT = `Anda adalah Dokter Validator Rekam Medis dan Auditor Klinis AI.
Tugas Anda adalah melakukan FILTERING & VERIFIKASI KELAYAKAN (Plausibility Check) atas transkrip percakapan antara Dokter (A) dan Pasien (B).

Transkrip dapat berisi campuran Bahasa Indonesia dan Bahasa Jawa (Ngoko / Krama, misal: mumet, nggliyeng, boyok linu, mules, sumer, dll).

KRITERIA PENILAIAN MASUK AKAL ATAU TIDAK (PLAUSIBILITY):
1. RELEVANSI KLINIS: Apakah percakapan benar membahas masalah kesehatan nyata, anamnesis, gejala, pemeriksaan, atau pengobatan?
2. KONSISTENSI & LOGIKA: Apakah keluhan dan respon dokter/pasien logis dan saling berkaitan? (Bukan teks absurd, halusinasi suara, lelucon, atau percakapan acak non-medis seperti gosip, belanja, resep masakan, dll).
3. PERAN PEMBICARA: Apakah peran Dokter dan Pasien dapat dibedakan secara wajar?
4. INTEGRASI BAHASA DAERAH: Ungkapan Bahasa Jawa adalah hal wajar dalam praktik medis di Indonesia dan HARUS DIANGGAP VALID jika itu keluhan nyata pasien.

OUTPUT WAJIB DALAM FORMAT JSON VALID:
{
  "is_valid": true/false,
  "plausibility_score": <angka 0-100>,
  "verdict": "MASUK_AKAL" | "PERLU_KLARIFIKASI" | "TIDAK_MASUK_AKAL",
  "summary": "<ringkasan evaluasi kelayakan klinis>",
  "javanese_detected": true/false,
  "javanese_terms": [
    { "term": "<kata jawa>", "meaning": "<arti klinis indonesia>" }
  ],
  "issues": [
    "<daftar poin kejanggalan jika ada, atau kosongkan jika masuk akal>"
  ],
  "suggestions": [
    "<saran langkah perbaikan untuk dokter jika transkrip tidak masuk akal>"
  ],
  "clinical_observations": [
    "<observasi mengenai gejala yang disebutkan, hubungan dokter-pasien, dsb>"
  ]
}`;

async function validateTranscriptPlausibility(transcript, context = "", stage = 1, vitalSigns = {}) {
  if (!transcript || !transcript.trim()) {
    return {
      stage,
      is_valid: false,
      plausibility_score: 0,
      verdict: "TIDAK_MASUK_AKAL",
      summary: "Transkrip kosong.",
      javanese_detected: false,
      javanese_terms: [],
      issues: ["Transkrip percakapan belum diisi atau kosong."],
      suggestions: ["Mulai rekam percakapan atau ketik transkrip konsultasi."],
      clinical_observations: []
    };
  }

  const anthropic = getAnthropicClient();
  const openai = getOpenaiClient();

  const vsDesc = vitalSigns && Object.keys(vitalSigns).length > 0
    ? `\nTANDA VITAL: ${JSON.stringify(vitalSigns)}`
    : "";

  const userPrompt = `Lakukan evaluasi kelayakan filtering Tahap ${stage} atas transkrip percakapan berikut:

TRANSKRIP:
"""
${transcript}
"""
${context ? `\nCATATAN / KONTEKS TAMBAHAN DARI DOKTER:\n"""\n${context}\n"""\n` : ""}${vsDesc}

Berikan hasil evaluasi dalam format JSON sesuai instruksi.`;

  // 1. Coba Anthropic Claude
  if (anthropic) {
    try {
      const response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1500,
        system: VALIDATION_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      if (textBlock && textBlock.text) {
        const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return { stage, ...parsed };
        }
      }
    } catch (err) {
      console.warn("Anthropic validation failed, fallback to OpenAI...", err.message);
    }
  }

  // 2. Coba OpenAI GPT-4o
  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: VALIDATION_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      });
      const content = completion.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        return { stage, ...parsed };
      }
    } catch (err) {
      console.warn("OpenAI validation failed:", err.message);
    }
  }

  // 3. Fallback Heuristik
  return evaluateHeuristicPlausibility(transcript, context, stage);
}

module.exports = {
  validateTranscriptPlausibility,
  JAVANESE_CLINICAL_MAP,
};

