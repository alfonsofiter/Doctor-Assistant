const { generateSoapNote } = require("../services/claudeService");
const { validateTranscriptPlausibility } = require("../services/validationService");

async function generateSoap(req, res) {
  const { transcript, context, vitalSigns } = req.body;

  if (!transcript || !transcript.trim()) {
    return res.status(400).json({ error: "Transkrip tidak boleh kosong." });
  }

  try {
    const soap = await generateSoapNote(transcript, context || "", vitalSigns || {});
    res.json({
      ...soap,
      warning:
        "Hasil ini disusun otomatis oleh AI dan wajib diverifikasi serta ditandatangani oleh dokter yang berwenang sebelum diarsipkan sebagai rekam medis resmi.",
    });
  } catch (error) {
    console.error("Gagal generate SOAP note:", error);
    res
      .status(500)
      .json({ error: "Gagal menghasilkan SOAP Note. Silakan coba lagi." });
  }
}

async function validateTranscript(req, res) {
  const { transcript, context, stage, vitalSigns } = req.body;

  if (!transcript || !transcript.trim()) {
    return res
      .status(400)
      .json({ error: "Transkrip percakapan tidak boleh kosong untuk divalidasi." });
  }

  try {
    const result = await validateTranscriptPlausibility(
      transcript,
      context || "",
      stage || 1,
      vitalSigns || {}
    );
    res.json(result);
  } catch (error) {
    console.error("Gagal validasi kelayakan transkrip:", error);
    res.status(500).json({
      error: "Gagal memproses validasi transkrip. Silakan periksa koneksi atau coba lagi.",
    });
  }
}

module.exports = { generateSoap, validateTranscript };
