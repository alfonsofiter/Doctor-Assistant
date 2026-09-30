import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  createConsultation,
  generateSoapNote,
  updateConsultation,
} from "../services/api";
import { downloadSoapPdf } from "../services/pdfService";
import "./SOAPResult.css";

function SOAPResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialData = location.state;

  const [soap, setSoap] = useState(initialData?.soap);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState("");
  const [isEditing, setIsEditing] = useState(
    Boolean(initialData?.startEditing),
  );
  const [consultationId, setConsultationId] = useState(
    initialData?.consultationId ?? null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedAt, setSavedAt] = useState(null);

  if (!initialData) {
    return (
      <div className="page soap-result">
        <p className="empty-state">
          Tidak ada data konsultasi untuk ditampilkan. Silakan mulai dari
          halaman Konsultasi.
        </p>
        <Link to="/consultation" className="btn btn-primary">
          Ke Halaman Konsultasi
        </Link>
      </div>
    );
  }

  const { patientName, consultationDate, transcript } = initialData;
  const backTo = initialData.from === "history" ? "/history" : "/consultation";
  const backLabel =
    initialData.from === "history"
      ? "Kembali ke Riwayat"
      : "Kembali ke Konsultasi";

  const handleFieldChange = (field, value) => {
    setSoap((prev) => ({ ...prev, [field]: value }));
    setSavedAt(null);
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    setRegenerateError("");
    try {
      const newSoap = await generateSoapNote(transcript);
      setSoap(newSoap);
      setSavedAt(null);
    } catch (error) {
      console.error("Gagal generate ulang SOAP:", error);
      setRegenerateError(
        error.message ||
          "Terjadi kesalahan saat menghubungi server. Coba lagi.",
      );
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDownloadPdf = () => {
    downloadSoapPdf({
      patientName,
      consultationDate,
      transcript,
      soap,
      consultationId,
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError("");

    const payload = {
      patientName,
      consultationDate,
      transcript,
      subjective: soap.subjective,
      objective: soap.objective,
      assessment: soap.assessment,
      plan: soap.plan,
    };

    try {
      if (consultationId) {
        await updateConsultation(consultationId, payload);
      } else {
        const saved = await createConsultation(payload);
        setConsultationId(saved.id);
      }
      setIsEditing(false);
      setSavedAt(new Date());
    } catch (error) {
      console.error("Gagal menyimpan konsultasi:", error);
      setSaveError(error.message || "Gagal menyimpan data. Coba lagi.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page soap-result">
      <Link to={backTo} className="back-link">
        &larr; {backLabel}
      </Link>

      <h1>Hasil SOAP Note</h1>

      <p className="ai-warning">⚠ {soap.warning}</p>

      <section className="info-card">
        <h2>Informasi Pasien</h2>
        <p>
          <strong>Nama / Inisial:</strong> {patientName || "Tidak disebutkan"}
        </p>
        <p>
          <strong>Tanggal Konsultasi:</strong>{" "}
          {consultationDate || "Tidak disebutkan"}
        </p>
      </section>

      <section className="info-card">
        <h2>Transkripsi</h2>
        <p className="transcript-readonly">{transcript}</p>
      </section>

      <section className="info-card soap-note">
        <h2>SOAP Note</h2>

        <div className="soap-field">
          <h3>S - Subjective</h3>
          {isEditing ? (
            <textarea
              className="soap-edit-box"
              value={soap.subjective}
              onChange={(e) => handleFieldChange("subjective", e.target.value)}
            />
          ) : (
            <p>{soap.subjective}</p>
          )}
        </div>
        <div className="soap-field">
          <h3>O - Objective</h3>
          {isEditing ? (
            <textarea
              className="soap-edit-box"
              value={soap.objective}
              onChange={(e) => handleFieldChange("objective", e.target.value)}
            />
          ) : (
            <p>{soap.objective}</p>
          )}
        </div>
        <div className="soap-field">
          <h3>A -Assessment</h3>
          {isEditing ? (
            <textarea
              className="soap-edit-box"
              value={soap.assessment}
              onChange={(e) => handleFieldChange("assessment", e.target.value)}
            />
          ) : (
            <p>{soap.assessment}</p>
          )}
        </div>
        <div className="soap-field">
          <h3>P -Plan</h3>
          {isEditing ? (
            <textarea
              className="soap-edit-box"
              value={soap.plan}
              onChange={(e) => handleFieldChange("plan", e.target.value)}
            />
          ) : (
            <p>{soap.plan}</p>
          )}
        </div>
      </section>

      {regenerateError && <p className="generate-error">{regenerateError}</p>}
      {saveError && <p className="generate-error">{saveError}</p>}
      {savedAt && !isSaving && (
        <p className="save-success">
          ✓ Tersimpan pukul {savedAt.toLocaleTimeString("id-ID")}
        </p>
      )}

      <div className="action-buttons">
        <button
          className="btn btn-secondary"
          onClick={() => setIsEditing((prev) => !prev)}
        >
          {isEditing ? "Selesai Edit" : "Edit"}
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? "Menyimpan..." : "Simpan"}
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleRegenerate}
          disabled={isRegenerating}
        >
          {isRegenerating ? "Memproses..." : "Generate Ulang"}
        </button>
        <button className="btn btn-secondary" onClick={handleDownloadPdf}>
          Download PDF
        </button>
        <button className="btn btn-secondary" onClick={() => navigate(backTo)}>
          {backLabel}
        </button>
      </div>
    </div>
  );
}

export default SOAPResult;
