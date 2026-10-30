const OpenAI = require("openai");
const { toFile } = require("openai");

const MODEL =
  process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-transcribe-diarize";
const LANGUAGE =
  process.env.OPENAI_TRANSCRIBE_LANGUAGE === undefined
    ? "id"
    : process.env.OPENAI_TRANSCRIBE_LANGUAGE;

// Prompt panduan untuk Whisper: Mengajarkan konteks medis dan istilah dwibahasa Indonesia - Jawa
const CLINICAL_WHISPER_PROMPT =
  "Percakapan konsultasi medis klinis antara dokter dan pasien dalam Bahasa Indonesia bercampur Bahasa Jawa (Ngoko dan Krama). Kosa kata medis dan keluhan daerah: mumet, nggliyeng, ngelu, boyok linu, kemeng, weteng mules, sebah, sumer-sumer, athus-athus, adhem panas, gerah, watuk grok-grok, sesek, unjuk obat, nedha, tensi inggil, mboten saged sare, abuh, ndredeg. Transkripsikan dengan akurat kata-kata bahasa daerah dan medis tersebut.";

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

async function transcribeWithDiarization({ buffer, mimeType }) {
  const openai = getClient();

  const file = await toFile(buffer, `rekaman.${extensionFromMime(mimeType)}`, {
    type: mimeType || "audio/webm",
  });

  const params = {
    file,
    model: MODEL,
    prompt: CLINICAL_WHISPER_PROMPT,
  };

  if (MODEL.includes("diarize")) {
    params.response_format = "diarized_json";
    params.chunking_strategy = "auto";
  }

  if (LANGUAGE) params.language = LANGUAGE;

  try {
    const result = await openai.audio.transcriptions.create(params);

    if (result.segments && Array.isArray(result.segments)) {
      const turns = mergeSegmentsIntoTurns(result.segments);
      const speakers = [...new Set(turns.map((turn) => turn.speaker))];

      return {
        text: result.text || "",
        duration: result.duration ?? null,
        speakers,
        turns,
      };
    }

    const rawText = result.text || "";
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
    if (MODEL !== "whisper-1") {
      console.warn("Mencoba fallback ke model whisper-1...", error.message);
      const fallbackParams = {
        file,
        model: "whisper-1",
        prompt: CLINICAL_WHISPER_PROMPT,
      };
      if (LANGUAGE) fallbackParams.language = LANGUAGE;

      const fallbackResult = await openai.audio.transcriptions.create(fallbackParams);
      const rawText = fallbackResult.text || "";
      return {
        text: rawText,
        duration: fallbackResult.duration ?? null,
        speakers: ["A", "B"],
        turns: [{ speaker: "A", text: rawText }],
      };
    }
    throw error;
  }
}

module.exports = {
  transcribeWithDiarization,
  mergeSegmentsIntoTurns,
  CLINICAL_WHISPER_PROMPT,
};
