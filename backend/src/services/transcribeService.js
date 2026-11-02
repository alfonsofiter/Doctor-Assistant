const OpenAI = require("openai");
const { toFile } = require("openai");

const MODEL =
  process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1";
const LANGUAGE =
  process.env.OPENAI_TRANSCRIBE_LANGUAGE === undefined
    ? "id"
    : process.env.OPENAI_TRANSCRIBE_LANGUAGE;

// Prompt untuk Whisper: bukan perintah, melainkan CONTOH TEKS dalam gaya & ejaan yang diharapkan.
// Whisper meniru gaya/ejaan teks ini, jadi tulis seperti ucapan nyata (Jawa krama + Indonesia).
// Silakan ubah/tambah kalimat dan kata sesuai gaya bicara yang sering dipakai.
const CLINICAL_WHISPER_PROMPT =
  "Sugeng siang, Pak. Menapa ingkang dipun raosaken? Nggih, Dok. Sirah kula mumet nggliyeng sampun tigang dinten, boyok kula linu, lan weteng kula mules sebah. Kula sampun unjuk obat, nanging dereng sae. Tensi kula inggil, kadang adhem panas, watuk, lan sesek. Mboten saged sare. Tensi panjenengan 140 per 90 mmHg. Mangga unjuk obat menika kaping tiga sedinten, lan dhahar ingkang mboten asin. Matur nuwun, Dok.";

let client = null;

function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error("OPENAI_API_KEY belum diatur di backend/.env");
    error.code = "MISSING_API_KEY";
    throw error;
  }
  if (!client) {
    client = new OpenAI();
  }
  return client;
}

function extensionFromMime(mimeType = "") {
  const type = mimeType.toLowerCase();
  if (type.includes("webm")) return "webm";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("wav")) return "wav";
  if (type.includes("mp4") || type.includes("m4a")) return "m4a";
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
  return "webm";
}

function mergeSegmentsIntoTurns(segments = []) {
  const turns = [];

  for (const segment of segments) {
    const text = (segment.text || "").trim();
    if (!text) continue;

    const last = turns[turns.length - 1];
    if (last && last.speaker === segment.speaker) {
      last.text = `${last.text} ${text}`;
      last.end = segment.end;
    } else {
      turns.push({
        speaker: segment.speaker,
        text,
        start: segment.start,
        end: segment.end,
      });
    }
  }

  return turns;
}

// ---------------------------------------------------------------------------
// Penentuan peran Dokter/Pasien dari ISI percakapan (bukan dari siapa bicara duluan).
// Memakai OPENAI_API_KEY yang sama dengan transkripsi. Jika gagal, hasil bawaan dipakai.
// Catatan: ini terpisah dari AI pembuat SOAP (claudeService.js) dan tidak mengubahnya.
// ---------------------------------------------------------------------------
const ROLE_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o";

const ROLE_RULES = `Cara menentukan peran (berdasarkan ISI percakapan, BUKAN urutan bicara):
- DOKTER: menyapa/membuka konsultasi, menanyakan keluhan dan riwayat (anamnesis), menyebut hasil pemeriksaan (tensi, nadi, suhu), menjelaskan diagnosis, meresepkan obat, memberi anjuran, menutup konsultasi.
- PASIEN: menceritakan keluhan dan perasaannya, menjawab pertanyaan riwayat, bertanya soal penyakit/obat, mengucapkan terima kasih.
- Petunjuk sapaan: pembicara yang memanggil lawan bicaranya "Dok"/"Dokter" adalah PASIEN. Pembicara yang memanggil lawan bicaranya "Pak", "Bu", "Mas", "Mbak", atau "Bapak/Ibu" lazimnya DOKTER. Sapaan adalah petunjuk kuat, tetapi pertimbangkan juga isi kalimatnya.
- Jangan berasumsi siapa yang bicara lebih dulu.
- Bahasa Jawa (ngoko/krama) bercampur Indonesia adalah hal wajar.`;

const ASSIGN_ROLE_PROMPT = `Anda menentukan siapa DOKTER pada transkrip konsultasi medis yang sudah dipisahkan per pembicara ("Pembicara 1", "Pembicara 2", dst).

${ROLE_RULES}

Keluarkan HANYA JSON, contoh: {"dokter":"Pembicara 2"}`;

const SPLIT_ROLE_PROMPT = `Anda memberi label pembicara pada transkrip konsultasi medis (tanpa label) dan memecahnya menjadi giliran bicara antara DOKTER dan PASIEN.

${ROLE_RULES}

Tugas:
1. Tentukan setiap bagian ucapan diucapkan oleh Dokter atau Pasien, berdasarkan isi dan sapaannya.
2. Giliran TIDAK harus bergantian. Jika beberapa kalimat berurutan jelas berasal dari pembicara yang sama, gabungkan dalam satu giliran.
3. JANGAN mengubah, menambah, atau menghapus kata apa pun. Salin teks persis seperti aslinya, hanya dipotong per giliran bicara.

Keluarkan HANYA JSON: {"turns":[{"speaker":"Dokter","text":"..."},{"speaker":"Pasien","text":"..."}]}`;

async function askRoleJson(openai, systemPrompt, userPrompt) {
  try {
    const completion = await openai.chat.completions.create({
      model: ROLE_CHAT_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    return JSON.parse(completion.choices[0]?.message?.content || "null");
  } catch (err) {
    console.warn("Panggilan AI pendukung gagal, memakai hasil bawaan:", err.message);
    return null;
  }
}

// Untuk hasil diarization (sudah ada label pembicara berdasarkan suara):
// tentukan label mana yang Dokter dari isi ucapan. Dokter = "A", lainnya = "B".
async function assignRolesByContent(openai, turns) {
  const labels = [...new Set(turns.map((t) => t.speaker))];
  if (labels.length < 2) return turns;

  const nameOf = (label) => `Pembicara ${labels.indexOf(label) + 1}`;
  const dialogue = turns
    .map((t) => `${nameOf(t.speaker)}: ${t.text}`)
    .join("\n")
    .slice(0, 12000);

  const parsed = await askRoleJson(
    openai,
    ASSIGN_ROLE_PROMPT,
    `Transkrip:\n"""\n${dialogue}\n"""`,
  );

  const doctorIndex = labels.findIndex((l) => nameOf(l) === parsed?.dokter);
  if (doctorIndex === -1) return turns; // gagal -> pakai hasil bawaan

  const doctorLabel = labels[doctorIndex];
  return turns.map((t) => ({
    ...t,
    speaker: t.speaker === doctorLabel ? "A" : "B",
  }));
}

// Untuk teks tanpa label pembicara (whisper-1): pecah jadi giliran bergantian
// dan tentukan perannya dari isi. Mengembalikan null jika gagal.
async function splitTurnsByContent(openai, rawText) {
  if (!rawText || !rawText.trim()) return null;

  const parsed = await askRoleJson(
    openai,
    SPLIT_ROLE_PROMPT,
    `Transkrip:\n"""\n${rawText}\n"""`,
  );
  if (!parsed || !Array.isArray(parsed.turns)) return null;

  const turns = parsed.turns
    .map((t) => ({
      speaker: /dokter/i.test(t.speaker || "") ? "A" : "B",
      text: (t.text || "").trim(),
    }))
    .filter((t) => t.text);
  if (turns.length === 0) return null;

  // Pengaman: AI tidak boleh mengubah isi transkrip secara berarti
  const squash = (str) => str.replace(/\s+/g, " ").trim().length;
  const ratio = squash(turns.map((t) => t.text).join(" ")) / Math.max(squash(rawText), 1);
  if (ratio < 0.9 || ratio > 1.1) return null;

  return mergeSegmentsIntoTurns(turns);
}

async function transcribeSingleModel({ buffer, mimeType }) {
  const openai = getClient();
  const ext = extensionFromMime(mimeType);
  const type = mimeType || "audio/webm";

  const params = {
    file: await toFile(buffer, `rekaman.${ext}`, { type }),
    model: MODEL,
    prompt: CLINICAL_WHISPER_PROMPT,
  };

  // Only diarize models support diarized_json; whisper-1 uses verbose_json
  if (MODEL.includes("diarize")) {
    params.response_format = "diarized_json";
    params.chunking_strategy = "auto";
  } else if (MODEL.startsWith("gpt-4o")) {
    // gpt-4o-transcribe / mini tidak mendukung verbose_json
    params.response_format = "json";
  } else {
    params.response_format = "verbose_json";
  }

  if (LANGUAGE) params.language = LANGUAGE;

  try {
    const result = await openai.audio.transcriptions.create(params);

    // Diarized model returns segments with speaker labels
    // (whisper-1 juga punya "segments", tetapi TANPA label speaker -> bukan diarization)
    const hasSpeakerLabels =
      Array.isArray(result.segments) && result.segments.some((s) => s.speaker);

    if (hasSpeakerLabels) {
      let turns = mergeSegmentsIntoTurns(result.segments);
      turns = await assignRolesByContent(openai, turns);
      turns = mergeSegmentsIntoTurns(turns);
      const speakers = [...new Set(turns.map((turn) => turn.speaker))];
      if (speakers.length >= 2) {
        return {
          text: result.text || "",
          duration: result.duration ?? null,
          speakers,
          turns,
        };
      }
    }

    // whisper-1 verbose_json: pisahkan Dokter/Pasien dari isi percakapan
    const rawText = result.text || "";
    const aiTurns = await splitTurnsByContent(openai, rawText);
    if (aiTurns) {
      return {
        text: rawText,
        duration: result.duration ?? null,
        speakers: ["A", "B"],
        turns: aiTurns,
      };
    }

    // Jika AI gagal: cara lama (pisah per baris, else satu pembicara)
    const lines = rawText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const turns = [];

    if (lines.length > 1) {
      lines.forEach((line, idx) => {
        const speaker = idx % 2 === 0 ? "A" : "B";
        turns.push({ speaker, text: line.trim() });
      });
    } else if (rawText) {
      turns.push({ speaker: "A", text: rawText });
    }

    return {
      text: rawText,
      duration: result.duration ?? null,
      speakers: ["A", "B"],
      turns,
    };
  } catch (error) {
    // Fallback: recreate file object (original stream may be consumed) and use whisper-1
    if (MODEL !== "whisper-1") {
      console.warn("Fallback ke whisper-1:", error.message);
      try {
        const fallbackFile = await toFile(buffer, `rekaman.${ext}`, { type });
        const fallbackResult = await openai.audio.transcriptions.create({
          file: fallbackFile,
          model: "whisper-1",
          prompt: CLINICAL_WHISPER_PROMPT,
          response_format: "verbose_json",
          ...(LANGUAGE ? { language: LANGUAGE } : {}),
        });
        const rawText = fallbackResult.text || "";
        const aiTurns = await splitTurnsByContent(openai, rawText);
        return {
          text: rawText,
          duration: fallbackResult.duration ?? null,
          speakers: ["A", "B"],
          turns: aiTurns || (rawText ? [{ speaker: "A", text: rawText }] : []),
        };
      } catch (fallbackError) {
        console.error("Fallback whisper-1 juga gagal:", fallbackError.message);
        throw fallbackError;
      }
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// MODE GABUNGAN (default saat model teks = whisper-1):
//  - SUARA  : model diarize menentukan siapa yang bicara & kapan (berdasarkan suara)
//  - TULISAN: whisper-1 + prompt Jawa menghasilkan teks
//  Keduanya dipanggil bersamaan lalu digabung berdasarkan waktu.
//  Matikan dengan OPENAI_DIARIZE_MODEL=off (kembali ke satu model saja).
// ---------------------------------------------------------------------------
const DIARIZE_MODEL =
  process.env.OPENAI_DIARIZE_MODEL === undefined
    ? "gpt-4o-transcribe-diarize"
    : process.env.OPENAI_DIARIZE_MODEL;

// Pilih pembicara yang paling lama beririsan waktu dengan segmen teks
function pickSpeakerByTime(segment, voiceSegments) {
  const overlap = {};
  for (const v of voiceSegments) {
    const o = Math.min(segment.end, v.end) - Math.max(segment.start, v.start);
    if (o > 0) overlap[v.speaker] = (overlap[v.speaker] || 0) + o;
  }
  const ranked = Object.keys(overlap).sort((a, b) => overlap[b] - overlap[a]);
  if (ranked.length > 0) return ranked[0];

  // Tidak beririsan: ambil segmen suara terdekat
  const mid = (segment.start + segment.end) / 2;
  let best = voiceSegments[0].speaker;
  let bestDist = Infinity;
  for (const v of voiceSegments) {
    const d = mid < v.start ? v.start - mid : mid > v.end ? mid - v.end : 0;
    if (d < bestDist) {
      bestDist = d;
      best = v.speaker;
    }
  }
  return best;
}

// Pastikan label hanya "A" (Dokter) / "B" (Pasien) agar cocok dengan frontend
function normalizeLabels(turns = []) {
  const labels = [...new Set(turns.map((t) => t.speaker))];
  if (labels.every((l) => l === "A" || l === "B")) return turns;
  return turns.map((t) => ({
    ...t,
    speaker: labels.indexOf(t.speaker) === 0 ? "A" : "B",
  }));
}

async function transcribeHybrid({ buffer, mimeType }) {
  const openai = getClient();
  const ext = extensionFromMime(mimeType);
  const type = mimeType || "audio/webm";

  const textParams = {
    file: await toFile(buffer, `rekaman.${ext}`, { type }),
    model: "whisper-1",
    prompt: CLINICAL_WHISPER_PROMPT,
    response_format: "verbose_json",
    ...(LANGUAGE ? { language: LANGUAGE } : {}),
  };
  // Model diarize tidak menerima prompt; hanya dipakai untuk mengenali SUARA
  const voiceParams = {
    file: await toFile(buffer, `rekaman.${ext}`, { type }),
    model: DIARIZE_MODEL,
    response_format: "diarized_json",
    chunking_strategy: "auto",
  };

  const [textRes, voiceRes] = await Promise.allSettled([
    openai.audio.transcriptions.create(textParams),
    openai.audio.transcriptions.create(voiceParams),
  ]);

  if (textRes.status === "rejected") throw textRes.reason;

  const textResult = textRes.value;
  const rawText = textResult.text || "";
  const duration = textResult.duration ?? null;

  if (voiceRes.status === "rejected") {
    console.warn("Deteksi suara gagal:", voiceRes.reason?.message);
  }
  const voiceSegments =
    voiceRes.status === "fulfilled" && Array.isArray(voiceRes.value.segments)
      ? voiceRes.value.segments.filter(
        (s) => s.speaker && typeof s.start === "number" && typeof s.end === "number",
      )
      : [];

  const textSegments = Array.isArray(textResult.segments)
    ? textResult.segments.filter(
      (s) =>
        (s.text || "").trim() &&
        typeof s.start === "number" &&
        typeof s.end === "number",
    )
    : [];

  if (voiceSegments.length > 0 && textSegments.length > 0) {
    let turns = mergeSegmentsIntoTurns(
      textSegments.map((seg) => ({
        ...seg,
        speaker: pickSpeakerByTime(seg, voiceSegments),
      })),
    );

    const voices = new Set(turns.map((t) => t.speaker));
    if (voices.size >= 2) {
      // Suara sudah terpisah; tentukan siapa Dokter dari ISI ucapan
      turns = await assignRolesByContent(openai, turns);
    } else {
      // Hanya 1 suara terdeteksi: suara tidak bisa membedakan peran,
      // jadi peran tiap bagian ditentukan dari ISI ucapan (sapaan, pertanyaan, dll).
      const byContent = await splitTurnsByContent(openai, rawText);
      if (byContent) {
        return {
          text: rawText,
          duration,
          speakers: [...new Set(byContent.map((t) => t.speaker))],
          turns: byContent,
        };
      }
      // AI gagal: semua dianggap satu pembicara (Dokter)
      turns = turns.map((t) => ({ ...t, speaker: "A" }));
    }
    turns = mergeSegmentsIntoTurns(normalizeLabels(turns));

    return {
      text: rawText,
      duration,
      speakers: [...new Set(turns.map((t) => t.speaker))],
      turns,
    };
  }

  // Deteksi suara tidak tersedia: tebak dari isi percakapan (kurang akurat)
  console.warn("Pemisahan suara tidak tersedia, memakai tebakan dari isi percakapan.");
  const aiTurns = await splitTurnsByContent(openai, rawText);
  return {
    text: rawText,
    duration,
    speakers: ["A", "B"],
    turns: aiTurns || (rawText ? [{ speaker: "A", text: rawText }] : []),
  };
}

async function transcribeCore(args) {
  const useHybrid =
    MODEL === "whisper-1" && DIARIZE_MODEL && DIARIZE_MODEL !== "off";
  return useHybrid ? transcribeHybrid(args) : transcribeSingleModel(args);
}

// ---------------------------------------------------------------------------
// Koreksi ejaan transkrip: dijalankan SETELAH suara menjadi teks dan dipisah per pembicara,
// SEBELUM ditampilkan. Hanya merapikan ejaan/pilihan kata sesuai konteks ucapan.
// TIDAK menyaring topik: pengecekan kesesuaian anamnesis tetap dilakukan
// oleh validationService saat tombol "Buat Catatan SOAP" ditekan.
// Jika gagal / hasil mencurigakan, teks asli dipakai. Matikan dengan TRANSCRIPT_REFINE=off.
// ---------------------------------------------------------------------------
const REFINE_PROMPT = `Anda adalah editor transkrip konsultasi medis. Input adalah daftar ucapan hasil speech-to-text (Bahasa Indonesia bercampur Bahasa Jawa ngoko/krama alus/krama inggil). Teks bisa salah eja karena salah dengar.

Tugas: perbaiki HANYA ejaan dan pilihan kata agar sesuai dengan apa yang paling mungkin diucapkan, dengan memakai konteks percakapan untuk memilih kata yang paling masuk akal ketika bunyinya mirip.

Aturan ketat:
- Pertahankan bahasa aslinya. JANGAN menerjemahkan Jawa ke Indonesia.
- Tulis kata Jawa dengan ejaan yang lazim. Rujukan istilah keluhan: mumet, nggliyeng, ngelu, boyok linu, kemeng, weteng mules, sebah, sumer-sumer, athus-athus, adhem panas, gerah, watuk grok-grok, sesek, unjuk obat, nedha, tensi inggil, mboten saged sare, abuh, ndredeg.
- Perbaiki penulisan istilah medis dan nama obat hanya jika Anda yakin.
- JANGAN mengubah angka, satuan, dosis, atau nama orang. JANGAN menambah atau menghapus informasi, dan JANGAN mengubah makna.
- Jika ragu pada suatu kata, biarkan apa adanya.
- JANGAN menilai, menyaring, atau menolak isi ucapan; topik apa pun tetap ditulis apa adanya.
- Jumlah baris keluaran HARUS sama persis dengan masukan, dengan urutan yang sama.

Keluarkan HANYA JSON: {"lines":["...","..."]}`;

const digitsOf = (str) => (str.match(/\d+(?:[.,/:]\d+)*/g) || []).join("|");

async function refineBatch(openai, texts) {
  const parsed = await askRoleJson(
    openai,
    REFINE_PROMPT,
    `Baris ucapan (JSON):\n${JSON.stringify(texts)}`,
  );
  const lines = parsed?.lines;
  if (!Array.isArray(lines) || lines.length !== texts.length) return texts;

  return texts.map((orig, i) => {
    const fixed = typeof lines[i] === "string" ? lines[i].trim() : "";
    if (!fixed) return orig;
    const ratio = fixed.length / Math.max(orig.length, 1);
    if (ratio < 0.6 || ratio > 1.6) return orig; // terlalu berbeda -> curiga
    if (digitsOf(fixed) !== digitsOf(orig)) return orig; // angka tidak boleh berubah
    return fixed;
  });
}

async function refineTurns(openai, turns = []) {
  if (!turns.length) return turns;
  const result = turns.map((t) => ({ ...t }));
  const BATCH = 30;
  for (let i = 0; i < result.length; i += BATCH) {
    const slice = result.slice(i, i + BATCH);
    const fixed = await refineBatch(openai, slice.map((t) => t.text));
    slice.forEach((t, j) => {
      t.text = fixed[j];
    });
  }
  return result;
}

async function transcribeWithDiarization(args) {
  const result = await transcribeCore(args);

  if (process.env.TRANSCRIPT_REFINE === "off") return result;

  try {
    const refined = await refineTurns(getClient(), result.turns);
    const changed = refined.some((t, i) => t.text !== result.turns[i].text);
    if (changed) {
      result.turns = refined;
      result.text = refined.map((t) => t.text).join(" ");
    }
  } catch (err) {
    console.warn("Koreksi ejaan transkrip dilewati:", err.message);
  }

  return result;
}

module.exports = {
  transcribeWithDiarization,
  mergeSegmentsIntoTurns,
  CLINICAL_WHISPER_PROMPT,
};