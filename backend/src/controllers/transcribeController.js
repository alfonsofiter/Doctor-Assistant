const { transcribeWithDiarization } = require("../services/transcribeService");

async function transcribe(req, res) {
  if (!req.file || !req.file.buffer || req.file.size === 0) {
    return res
      .status(400)
      .json({ error: "File audio tidak ditemukan atau kosong." });
  }

  try {
    const result = await transcribeWithDiarization({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
    });

    if (!result.turns.length) {
      return res.status(422).json({
        error:
          "Tidak ada ucapan yang terdeteksi pada rekaman. Coba rekam ulang.",
      });
    }

    res.json(result);
  } catch (error) {
    console.error("Gagal transkripsi audio:", error);

    if (error.code === "MISSING_API_KEY") {
      return res.status(500).json({ error: error.message });
    }
    if (error.status === 401) {
      return res.status(500).json({ error: "OPENAI_API_KEY tidak valid." });
    }
    if (error.status === 429) {
      return res.status(429).json({
        error: "Batas penggunaan OpenAI tercapai. Coba lagi beberapa saat.",
      });
    }

    res
      .status(500)
      .json({ error: "Gagal mentranskripsi audio. Silakan coba lagi." });
  }
}

module.exports = { transcribe };
