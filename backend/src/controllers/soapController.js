const { generateSoapNote } = require('../services/claudeService');

async function generateSoap(req, res) {
  const { transcript } = req.body;

  if (!transcript || !transcript.trim()) {
    return res.status(400).json({ error: 'Transkrip tidak boleh kosong.' });
  }

  try {
    const soap = await generateSoapNote(transcript);
    res.json({
      ...soap,
      warning:
        'Hasil ini dihasilkan oleh AI dan wajib diperiksa kembali oleh dokter sebelum digunakan sebagai rekam medis resmi.',
    });
  } catch (error) {
    console.error('Gagal generate SOAP note:', error);
    res.status(500).json({ error: 'Gagal menghasilkan SOAP Note. Silakan coba lagi.' });
  }
}

module.exports = { generateSoap };
