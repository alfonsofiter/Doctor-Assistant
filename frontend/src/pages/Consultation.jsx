import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { generateSoapNote } from "../services/api";
import "./Consultation.css";

function Consultation() {
  const navigate = useNavigate();

  const [patientName, setPatientName] = useState("");
  const [consultationDate, setConsultationDate] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [isSupported, setIsSupported] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [speaker, setSpeaker] = useState("dokter");

  const recognitionRef = useRef(null);
  const speakerRef = useRef("dokter");
  const lastSpeakerRef = useRef(null);
  // Teks mentah (belum di-final-kan browser) dari ucapan yang sedang berjalan.
  const rawInterimRef = useRef("");
  // Berapa karakter dari rawInterimRef yang SUDAH dikunci ke transkrip
  // (karena pengguna mengklik switch di tengah ucapan).
  const committedLengthRef = useRef(0);

  const commitLine = (targetSpeaker, text) => {
    const cleanText = text.trim();
    if (!cleanText) return;
    const label = targetSpeaker === "dokter" ? "Dokter" : "Pasien";

    setTranscript((prev) => {
      if (lastSpeakerRef.current !== targetSpeaker) {
        lastSpeakerRef.current = targetSpeaker;
        const line = `${label}: ${cleanText}`;
        return prev ? `${prev}\n${line}` : line;
      }
      return prev ? `${prev} ${cleanText}` : cleanText;
    });
  };

  const handleSetSpeaker = (role) => {
    if (role === speakerRef.current) return;

    // Kunci teks yang sedang tampil SAAT INI ke peran yang lama, persis di
    // detik tombol diklik, tanpa menunggu browser bilang "final".
    const uncommitted = rawInterimRef.current.slice(committedLengthRef.current);
    if (uncommitted.trim()) {
      commitLine(speakerRef.current, uncommitted);
    }
    committedLengthRef.current = rawInterimRef.current.length;

    setSpeaker(role);
    speakerRef.current = role;
    setInterimText("");
  };

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "id-ID";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => {
      setIsRecording(false);
      setInterimText("");
    };
    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
    };

    recognition.onresult = (event) => {
      let finalChunk = "";
      let interimChunk = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          finalChunk += result[0].transcript;
        } else {
          interimChunk += result[0].transcript;
        }
      }

      rawInterimRef.current = interimChunk;

      if (finalChunk) {
        // Ambil bagian yang BELUM sempat dikunci manual lewat switch tombol
        // (kalau tidak ada switch sama sekali, ini ya seluruh finalChunk).
        const remaining = finalChunk.slice(committedLengthRef.current);
        commitLine(speakerRef.current, remaining);
        committedLengthRef.current = 0;
        rawInterimRef.current = "";
      }

      // Tampilkan cuma bagian yang belum masuk ke transkrip, supaya teks
      // yang sudah dikunci ke peran lama tidak terlihat dobel di preview.
      setInterimText(interimChunk.slice(committedLengthRef.current));
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, []);

  const handleStartRecording = () => {
    if (!recognitionRef.current || isRecording) return;
    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error("Tidak bisa memulai rekaman:", error);
    }
  };

  const handleStopRecording = () => {
    if (!recognitionRef.current || !isRecording) return;
    recognitionRef.current.stop();
  };

  const handleClearTranscript = () => {
    if (!transcript) return;
    const confirmed = window.confirm(
      "Hapus semua teks transkripsi? Tindakan ini tidak bisa dibatalkan.",
    );
    if (confirmed) {
      setTranscript("");
      lastSpeakerRef.current = null;
      rawInterimRef.current = "";
      committedLengthRef.current = 0;
    }
  };

  const handleGenerateSoap = async () => {
    if (!transcript.trim() || isGenerating) return;

    setIsGenerating(true);
    setGenerateError("");

    try {
      const soap = await generateSoapNote(transcript);
      navigate("/soap-result", {
        state: {
          patientName,
          consultationDate,
          transcript,
          soap,
        },
      });
    } catch (error) {
      console.error("Gagal generate SOAP:", error);
      setGenerateError(
        error.message ||
          "Terjadi kesalahan saat menghubungi server. Coba lagi.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const canGenerate = transcript.trim().length > 0 && !isGenerating;

  return (
    <div className="page consultation">
      <Link to="/" className="back-link">
        &larr; Kembali ke Dashboard
      </Link>

      <h1>Konsultasi Baru</h1>

      {!isSupported && (
        <p className="unsupported-warning">
          Browser ini tidak mendukung Web Speech API. Gunakan Google Chrome atau
          Microsoft Edge untuk merekam percakapan.
        </p>
      )}

      <section className="card consultation-card">
        <div className="patient-form">
          <div className="form-field">
            <label htmlFor="patientName">Nama / Inisial Pasien</label>
            <input
              id="patientName"
              type="text"
              placeholder="Contoh: Bpk. A"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="consultationDate">Tanggal Konsultasi</label>
            <input
              id="consultationDate"
              type="date"
              value={consultationDate}
              onChange={(e) => setConsultationDate(e.target.value)}
            />
          </div>
        </div>

        <div className="speaker-toggle">
          <span className="speaker-toggle-label">Yang sedang bicara:</span>
          <button
            type="button"
            className={`speaker-switch speaker-switch-${speaker}`}
            onClick={() =>
              handleSetSpeaker(speaker === "dokter" ? "pasien" : "dokter")
            }
          >
            {speaker === "dokter" ? "Dokter" : "Pasien"}
            <span className="speaker-switch-hint">(klik untuk ganti)</span>
          </button>
        </div>

        <div className="recording-controls">
          <button
            className="btn btn-primary"
            onClick={handleStartRecording}
            disabled={!isSupported || isRecording}
          >
            Mulai Rekam
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleStopRecording}
            disabled={!isSupported || !isRecording}
          >
            Stop
          </button>
          {isRecording && (
            <span className="recording-indicator">
              <span className="recording-dot" /> Merekam sebagai{" "}
              {speaker === "dokter" ? "Dokter" : "Pasien"}...
            </span>
          )}
        </div>
      </section>

      <section className="card transcript-section">
        <div className="transcript-header">
          <h2>Transkripsi Percakapan</h2>
          <button
            className="btn btn-danger-outline"
            onClick={handleClearTranscript}
            disabled={!transcript}
          >
            Hapus Semua
          </button>
        </div>

        <textarea
          className="transcript-box"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Transkripsi akan muncul di sini saat perekaman berjalan. Anda juga bisa mengetik/mengedit langsung di sini untuk memperbaiki kesalahan deteksi suara."
        />

        {interimText && (
          <p className="interim-live">
            Sedang mendengar:{" "}
            <span className="interim-text">{interimText}</span>
          </p>
        )}

        <p className="hint">
          Sebelum berbicara, tekan tombol &quot;Dokter&quot; atau
          &quot;Pasien&quot; di atas sesuai giliran bicara. Transkrip akan
          otomatis diberi label sesuai peran yang aktif. Anda juga dapat
          mengedit langsung teks di atas untuk memperbaiki kata yang salah
          dikenali. Catatan: pemisahan pembicara di MVP ini bersifat manual
          (dipilih pengguna), bukan deteksi otomatis berbasis suara.
        </p>
      </section>

      {generateError && <p className="generate-error">{generateError}</p>}

      <button
        className="btn btn-primary generate-btn"
        onClick={handleGenerateSoap}
        disabled={!canGenerate}
      >
        {isGenerating ? "Sedang Memproses..." : "Generate SOAP Note"}
      </button>
    </div>
  );
}

export default Consultation;
