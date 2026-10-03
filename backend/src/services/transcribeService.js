const OpenAI = require("openai");
const { toFile } = require("openai");

const MODEL =
  process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-transcribe-diarize";
const LANGUAGE =
  process.env.OPENAI_TRANSCRIBE_LANGUAGE === undefined
    ? "id"
    : process.env.OPENAI_TRANSCRIBE_LANGUAGE;

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
    response_format: "diarized_json",
    chunking_strategy: "auto",
  };
  if (LANGUAGE) params.language = LANGUAGE;

  const result = await openai.audio.transcriptions.create(params);

  const turns = mergeSegmentsIntoTurns(result.segments);
  const speakers = [...new Set(turns.map((turn) => turn.speaker))];

  return {
    text: result.text || "",
    duration: result.duration ?? null,
    speakers,
    turns,
  };
}

module.exports = { transcribeWithDiarization, mergeSegmentsIntoTurns };
