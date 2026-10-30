import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  createConsultation,
  generateSoapNote,
  updateConsultation,
} from '../services/api';
import { downloadSoapPdf } from '../services/pdfService';
import './SOAPResult.css';

export default function SOAPResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialData = location.state;

  const [soap, setSoap] = useState(initialData?.soap);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState('');
  const [isEditing, setIsEditing] = useState(Boolean(initialData?.startEditing));
  const [consultationId, setConsultationId] = useState(
    initialData?.consultationId ?? null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedAt, setSavedAt] = useState(null);

  if (!initialData) {
    return (
      <div className="soap-result-page-wrap">
        <div className="empty-soap-box">
          <p>Tidak ada data konsultasi aktif. Silakan mulai sesi konsultasi baru.</p>
          <Link to="/consultation" className="btn-primary-capsule">
            Buka Halaman Konsultasi
          </Link>
        </div>
      </div>
    );
  }

  const {
    patientName,
    patientId,
    consultationDate,
    transcript,
    doctorClarification,
    vitalSigns,
  } = initialData;

  const backTo = initialData.from === 'history' ? '/history' : '/consultation';
  const backLabel =
    initialData.from === 'history'
      ? 'Kembali ke Riwayat Pasien'
      : 'Kembali ke Konsultasi';

  const handleFieldChange = (field, value) => {
    setSoap((prev) => ({ ...prev, [field]: value }));
    setSavedAt(null);
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    setRegenerateError('');
    try {
      const newSoap = await generateSoapNote(transcript, doctorClarification, vitalSigns);
      setSoap(newSoap);
      setSavedAt(null);
    } catch (error) {
      console.error('Gagal menyusun ulang SOAP:', error);
      setRegenerateError(
        error.message || 'Terjadi kesalahan saat menyusun ulang catatan medis.'
      );
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDownloadPdf = () => {
    downloadSoapPdf({
      patientName,
      patientId,
      consultationDate,
      transcript,
      soap,
      consultationId,
      vitalSigns,
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError('');

    const payload = {
      patientName,
      patientId: patientId || '',
      consultationDate,
      transcript,
      subjective: soap.subjective,
      objective: soap.objective,
      assessment: soap.assessment,
      plan: soap.plan,
      bloodPressure: vitalSigns?.bloodPressure || '',
      heartRate: vitalSigns?.heartRate || '',
      respiratoryRate: vitalSigns?.respiratoryRate || '',
      temperature: vitalSigns?.temperature || '',
      weight: vitalSigns?.weight || '',
      height: vitalSigns?.height || '',
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
      console.error('Gagal menyimpan rekam medis:', error);
      setSaveError(error.message || 'Gagal menyimpan rekam medis.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="soap-result-page-wrap">
      <div className="soap-container">
        
        {/* Navigasi Atas */}
        <div className="soap-top-bar">
          <Link to={backTo} className="back-capsule-link">
            &larr; {backLabel}
          </Link>
        </div>

        {/* Header Judul & Tombol Aksi */}
        <div className="soap-title-row">
          <div>
            <h1>Hasil Catatan Medis (SOAP)</h1>
            <p className="soap-subtitle">
              Ringkasan hasil anamnesis dan pemeriksaan pasien.
            </p>
          </div>

          <div className="soap-header-action-btns">
            <button
              className={`btn-header-action ${isEditing ? 'active' : ''}`}
              onClick={() => setIsEditing((prev) => !prev)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              {isEditing ? 'Selesai Edit' : 'Edit Catatan'}
            </button>

            <button
              className="btn-header-action save"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Rekam Medis'}
            </button>

            <button className="btn-header-action pdf" onClick={handleDownloadPdf}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              Unduh PDF
            </button>
          </div>
        </div>

        {/* Pemberitahuan */}
        <div className="ai-legal-disclaimer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
          </svg>
          <span>
            {soap.warning ||
              'Catatan ini dihasilkan secara otomatis dan wajib diperiksa kembali oleh dokter sebelum disimpan sebagai rekam medis resmi.'}
          </span>
        </div>

        {savedAt && (
          <div className="save-notification-pill">
            ✓ Berhasil disimpan pada pukul {savedAt.toLocaleTimeString('id-ID')}
          </div>
        )}

        {/* Data Singkat Pasien */}
        <section className="soap-card patient-overview-card">
          <div className="patient-overview-grid">
            <div className="patient-avatar-badge">
              {patientName ? patientName.slice(0, 2).toUpperCase() : 'PS'}
            </div>
            <div className="patient-meta-details">
              <div className="patient-main-name">{patientName || 'Tidak Disebutkan'}</div>
              <div className="patient-submeta">
                <span>No. RM: <strong>{patientId || '-'}</strong></span>
                <span>&bull;</span>
                <span>Tanggal Pemeriksaan: <strong>{consultationDate || 'Hari ini'}</strong></span>
              </div>
            </div>
          </div>
        </section>

        {/* Transkrip Sumber */}
        <section className="soap-card transcript-review-card">
          <div className="card-inner-header">
            <h2 className="card-section-title">Transkrip Percakapan</h2>
          </div>
          <div className="transcript-read-content">
            {transcript}
          </div>
        </section>

        {/* Bagian SOAP (Subjektif, Objektif, Asesmen, Rencana) */}
        <div className="soap-four-sections-grid">
          
          {/* Subjektif */}
          <div className="soap-card section-card subjective">
            <div className="section-title-bar">
              <span className="soap-letter-badge s">S</span>
              <div>
                <h3 className="section-name">Subjektif (S)</h3>
                <span className="section-helper">Keluhan Utama &amp; Anamnesis Pasien</span>
              </div>
            </div>
            {isEditing ? (
              <textarea
                className="soap-textarea"
                rows="6"
                value={soap.subjective}
                onChange={(e) => handleFieldChange('subjective', e.target.value)}
              />
            ) : (
              <div className="soap-text-block">{soap.subjective}</div>
            )}
          </div>

          {/* Objektif */}
          <div className="soap-card section-card objective">
            <div className="section-title-bar">
              <span className="soap-letter-badge o">O</span>
              <div>
                <h3 className="section-name">Objektif (O)</h3>
                <span className="section-helper">Pemeriksaan Fisik &amp; Tanda Vital</span>
              </div>
            </div>
            {isEditing ? (
              <textarea
                className="soap-textarea"
                rows="6"
                value={soap.objective}
                onChange={(e) => handleFieldChange('objective', e.target.value)}
              />
            ) : (
              <div className="soap-text-block">{soap.objective}</div>
            )}
          </div>

          {/* Asesmen */}
          <div className="soap-card section-card assessment">
            <div className="section-title-bar">
              <span className="soap-letter-badge a">A</span>
              <div>
                <h3 className="section-name">Asesmen (A)</h3>
                <span className="section-helper">Diagnosis Klinis &amp; Kode Diagnosis</span>
              </div>
            </div>
            {isEditing ? (
              <textarea
                className="soap-textarea"
                rows="6"
                value={soap.assessment}
                onChange={(e) => handleFieldChange('assessment', e.target.value)}
              />
            ) : (
              <div className="soap-text-block">{soap.assessment}</div>
            )}
          </div>

          {/* Rencana */}
          <div className="soap-card section-card plan">
            <div className="section-title-bar">
              <span className="soap-letter-badge p">P</span>
              <div>
                <h3 className="section-name">Rencana (P)</h3>
                <span className="section-helper">Tata Laksana, Terapi Obat &amp; Edukasi</span>
              </div>
            </div>
            {isEditing ? (
              <textarea
                className="soap-textarea"
                rows="6"
                value={soap.plan}
                onChange={(e) => handleFieldChange('plan', e.target.value)}
              />
            ) : (
              <div className="soap-text-block">{soap.plan}</div>
            )}
          </div>

        </div>

        {/* Tombol Aksi Bawah */}
        <div className="soap-bottom-bar">
          <button
            className="btn-secondary-action"
            onClick={handleRegenerate}
            disabled={isRegenerating}
          >
            {isRegenerating ? 'Memproses Ulang...' : 'Buat Ulang Catatan'}
          </button>
          <button className="btn-primary-action" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Menyimpan...' : 'Simpan Rekam Medis'}
          </button>
        </div>

      </div>
    </div>
  );
}
