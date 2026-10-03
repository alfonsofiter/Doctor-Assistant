import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { generateSoapNote, transcribeAudio } from "../services/api";
import "./Consultation.css";

function MicIcon() {
  return (
    <svg
      className="btn-icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg
      className="btn-icon"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  );
}

const RECORDER_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function pickRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return (
    RECORDER_MIME_CANDIDATES.find((type) =>
      MediaRecorder.isTypeSupported(type),
    ) || ""
  );
}

// Pemetaan label pembicara dari diarisasi (A, B, ...) ke peran.
// Asumsi awal: yang bicara pertama adalah dokter.
function buildRoleMap(speakers) {
  const roles = ["Dokter", "Pasien"];
  const map = {};
  speakers.forEach((speaker, index) => {
    map[speaker] = roles[index] || `Pembicara ${speaker}`;
  });
  return map;
}

function formatTurns(turns, roleMap) {
  return turns
    .map((turn) => `${roleMap[turn.speaker] || turn.speaker}: ${turn.text}`)
    .join("\n");
}

function Consultation() {
  const navigate = useNavigate();

  const [patientName, setPatientName] = useState("");
  const [consultationDate, setConsultationDate] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState("");

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);

  const canRecordAudio =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const appendBatchToTranscript = (text) => {
    setTranscript((prev) => (prev ? `${prev}\n${text}` : text));
  };

  const processRecordedAudio = async (blob) => {
    setIsTranscribing(true);
    setTranscribeError("");
    try {
      const result = await transcribeAudio(blob);
      const roleMap = buildRoleMap(result.speakers);
      const text = formatTurns(result.turns, roleMap);
      appendBatchToTranscript(text);
    } catch (error) {
      console.error("Gagal transkripsi Whisper:", error);
      setTranscribeError(
        error.message || "Gagal mentranskripsi audio. Coba lagi.",
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleStartRecording = async () => {
    if (isRecording || isTranscribing) return;
    setTranscribeError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickRecorderMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );

      audioChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });
        audioChunksRef.current = [];
        if (blob.size > 0) processRecordedAudio(blob);
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Tidak bisa mengakses mikrofon:", error);
      setTranscribeError(
        "Tidak bisa mengakses mikrofon. Pastikan izin mikrofon diberikan pada browser.",
      );
    }
  };

  const handleStopRecording = () => {
    if (!isRecording) return;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  };

  const handleClearTranscript = () => {
    if (!transcript) return;
    const confirmed = window.confirm(
      "Hapus semua teks transkripsi? Tindakan ini tidak bisa dibatalkan.",
    );
    if (confirmed) {
      setTranscript("");
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

      {!canRecordAudio && (
        <p className="unsupported-warning">
          Browser ini tidak mendukung perekaman audio (MediaRecorder) atau
          mikrofon tidak tersedia. Gunakan Chrome/Edge versi terbaru lewat
          localhost atau HTTPS.
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

        <div className="recording-controls">
          <button
            className="btn btn-primary"
            onClick={handleStartRecording}
            disabled={!canRecordAudio || isRecording || isTranscribing}
          >
            <MicIcon />
            Mulai Rekam
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleStopRecording}
            disabled={!canRecordAudio || !isRecording}
          >
            <StopIcon />
            Stop
          </button>
          {isRecording && (
            <span className="recording-indicator">
              <span className="recording-dot" />{" "}
              Merekam (pembicara dipisah otomatis setelah Stop)...
            </span>
          )}
          {isTranscribing && (
            <span className="processing-indicator">
              Memproses audio &amp; memisahkan pembicara...
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
          placeholder="Transkripsi akan muncul di sini setelah rekaman selesai diproses. Anda juga bisa mengetik/mengedit langsung di sini untuk memperbaiki hasil deteksi."
        />

        {transcribeError && <p className="generate-error">{transcribeError}</p>}

        <p className="hint">
          Tekan <strong>Mulai Rekam</strong>, lakukan percakapan, lalu tekan{" "}
          <strong>Stop</strong>. Audio dikirim ke OpenAI Whisper untuk
          ditranskripsi dan dipisahkan per pembicara secara otomatis. Pembicara
          pertama otomatis diberi label <em>Dokter</em>. Periksa dan edit hasil
          di kotak di atas jika diperlukan.
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

