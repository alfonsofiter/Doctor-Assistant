const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5';

const SYSTEM_PROMPT = `Anda adalah asisten dokumentasi medis yang membantu dokter menyusun catatan SOAP (Subjective, Objective, Assessment, Plan) dari transkrip percakapan dokter-pasien berbahasa Indonesia.

ATURAN WAJIB (harus selalu dipatuhi):
1. Hanya gunakan informasi yang secara eksplisit disebutkan dalam transkrip.
2. Jangan mengarang data pasien, hasil pemeriksaan, atau tanda vital yang tidak disebutkan.
3. Jangan membuat diagnosis atau rekomendasi medis baru yang tidak didukung oleh percakapan.
4. Jika suatu informasi tidak tersedia dalam transkrip, tulis persis: "Tidak disebutkan".
5. Pertahankan konteks dan istilah dalam Bahasa Indonesia.
6. Tulis ringkas, terstruktur, dan mudah dibaca oleh dokter.
7. Anda adalah alat bantu dokumentasi, BUKAN pengganti penilaian medis dokter. Dokter tetap menjadi pihak yang melakukan validasi akhir atas seluruh isi catatan ini.

FORMAT OUTPUT WAJIB (jangan tambahkan judul, penjelasan, atau teks lain di luar format berikut):
SUBJECTIVE:
<isi>

OBJECTIVE:
<isi>

ASSESSMENT:
<isi>

PLAN:
<isi>`;

function buildUserPrompt(transcript) {
  return `Berikut adalah transkrip percakapan dokter dan pasien:\n\n"""\n${transcript}\n"""\n\nBuatkan catatan SOAP berdasarkan transkrip di atas, sesuai format dan aturan yang telah ditentukan.`;
}

function parseSoapText(text) {
  const pattern =
    /SUBJECTIVE:\s*([\s\S]*?)\n\s*OBJECTIVE:\s*([\s\S]*?)\n\s*ASSESSMENT:\s*([\s\S]*?)\n\s*PLAN:\s*([\s\S]*)/i;
  const match = text.match(pattern);

  if (!match) {
    return {
      subjective: 'Tidak disebutkan',
      objective: 'Tidak disebutkan',
      assessment: text.trim(),
      plan: 'Tidak disebutkan',
    };
  }

  return {
    subjective: match[1].trim(),
    objective: match[2].trim(),
    assessment: match[3].trim(),
    plan: match[4].trim(),
  };
}

async function generateSoapNote(transcript) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    output_config: { effort: 'medium' },
    messages: [{ role: 'user', content: buildUserPrompt(transcript) }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  const rawText = textBlock ? textBlock.text : '';

  return parseSoapText(rawText);
}

module.exports = { generateSoapNote };
