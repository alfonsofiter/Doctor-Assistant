import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { generateSoapNote, transcribeAudio, validateTranscript } from '../services/api';
import './Consultation.css';

// Sampel untuk demonstrasi jika dibutuhkan
const SAMPLE_CONVERSATION_JAVANESE = `Dokter: Selamat pagi Ibu, apa yang dirasakan hari ini?
Pasien: Ngeten lho Dok, sirah kulo niku nggliyeng sanget sampun tigang dinten. Menawi tangi saking tilem, rasane mumet muter-muter.
Dokter: Ada mual atau muntah tidak Bu?
Pasien: Mual Dok, kaliyan weteng kulo mules sebah. Boyok kulo ugi linu sanget.
Dokter: Baik Bu, saya periksa tekanan darahnya dulu ya. Tensi 140/90 mmHg, agak tinggi. Saya resepkan betahistine untuk pusingnya dan paracetamol untuk pegal linu. Minum obat teratur dan kurangi makanan asin ya Bu.
Pasien: Nggih Dok, matur nuwun sanget.`;

const SAMPLE_NONSENSE_CONVERSATION = `Pembicara A: Kemarin pertandingan bola seru banget ya, gol di menit akhir.
Pembicara B: Iya, kemarin saya seharian beli baju di mall sama beli martabak manis.
Pembicara A: Nanti malam kita jadi nonton bioskop dekat stasiun kan?
Pembicara B: Jadi dong, nanti jam tujuh malam kumpul di kafe.`;

export default function Consultation() {
  const navigate = useNavigate();

  const [patientName, setPatientName] = useState('');
  const [patientId, setPatientId] = useState('');
  const [consultationDate, setConsultationDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Fitur Tanda Vital Pasien (Tensi, Nadi, Napas, Suhu, BB, TB)
  const [bloodPressure, setBloodPressure] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [respiratoryRate, setRespiratoryRate] = useState('');
  const [temperature, setTemperature] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');

  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState('');

  // Validasi & Klarifikasi (Berjalan di sistem)
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationAlert, setValidationAlert] = useState(null);
  const [doctorClarification, setDoctorClarification] = useState('');
  const [processError, setProcessError] = useState('');

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);

  const canRecordAudio =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';

  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null;
        recorder.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const handleStartRecording = async () => {
    if (isRecording || isTranscribing) return;
    setTranscribeError('');
    setValidationAlert(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      audioChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];

        if (blob.size > 0) {
          setIsTranscribing(true);
          try {
            const result = await transcribeAudio(blob);
            let formatted = result.text || '';
            if (result.turns && result.turns.length > 0) {
              formatted = result.turns
                .map((t) => `${t.speaker === 'A' ? 'Dokter' : 'Pasien'}: ${t.text}`)
                .join('\n');
            }
            setTranscript((prev) => (prev ? `${prev}\n${formatted}` : formatted));
          } catch (err) {
            console.error('Gagal transkripsi:', err);
            setTranscribeError('Gagal memproses rekaman suara. Silakan coba lagi.');
          } finally {
            setIsTranscribing(false);
          }
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Akses mikrofon gagal:', err);
      setTranscribeError('Izin mikrofon belum diberikan pada peramban.');
    }
  };

  const handleStopRecording = () => {
    if (!isRecording) return;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  };

  // Proses Utama: Validasi Filtering (by sistem) lalu Generate SOAP dengan membaca Transkrip + Tanda Vital
  const handleProcessSoap = async (forceStage2 = false) => {
    if (!transcript.trim() || isProcessing) return;

    setIsProcessing(true);
    setProcessError('');

    const vitalSigns = {
      bloodPressure,
      heartRate,
      respiratoryRate,
      temperature,
      weight,
      height,
    };

    try {
      // 1. Pengecekan Filtering Kelayakan oleh Sistem di latar belakang
      const validation = await validateTranscript(
        transcript,
        doctorClarification,
        forceStage2 ? 2 : 1,
        vitalSigns
      );

      // Jika percakapan janggal / tidak masuk akal -> Tampilkan alur klarifikasi
      if (!validation.is_valid && !forceStage2) {
        setValidationAlert(validation);
        setIsProcessing(false);
        return;
      }

      // 2. Jika valid (atau setelah klarifikasi tahap 2 lolos), buat catatan SOAP
      // AI membaca transkrip percakapan DAN isian tanda vital secara terpadu
      const soap = await generateSoapNote(transcript, doctorClarification, vitalSigns);
      navigate('/soap-result', {
        state: {
          patientName,
          patientId,
          consultationDate,
          transcript,
          soap,
          doctorClarification,
          vitalSigns,
        },
      });
    } catch (err) {
      console.error('Proses gagal:', err);
      setProcessError(err.message || 'Terjadi kesalahan saat menyusun catatan medis.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="consultation-page-wrap">
      <div className="consultation-container">
        
        {/* Navigasi Atas */}
        <div className="consult-top-bar">
          <Link to="/" className="back-capsule-link">
            &larr; Kembali ke Beranda
          </Link>
        </div>

        {/* Judul Halaman */}
        <div className="consult-header-intro">
          <h1>Konsultasi Baru</h1>
          <p className="intro-desc">
            Rekam atau masukkan percakapan dokter dan pasien beserta tanda vital untuk menghasilkan catatan rekam medis (SOAP).
          </p>
        </div>

        {/* 1. Data Pasien */}
        <section className="consult-card">
          <div className="meta-grid">
            <div className="form-group">
              <label>Nama Pasien</label>
              <input
                type="text"
                placeholder="Nama lengkap pasien"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>No. Rekam Medis</label>
              <input
                type="text"
                placeholder="Contoh: RM-00123"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Tanggal Pemeriksaan</label>
              <input
                type="date"
                value={consultationDate}
                onChange={(e) => setConsultationDate(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* 2. Fitur Input Tanda Vital (Tensi, Nadi, Napas, Suhu, BB, TB) */}
        <section className="consult-card vital-signs-input-card">
          <div className="vitals-header-row">
            <div>
              <h2 className="card-subheading">Pemeriksaan Tanda Vital Pasien (TTV)</h2>
              <span className="card-subtext-muted">Data ini akan dibaca oleh AI dan dimasukkan ke bagian Objektif (O) rekam medis</span>
            </div>
          </div>

          <div className="vitals-input-grid">
            <div className="form-group">
              <label>Tensi / TD (mmHg)</label>
              <input
                type="text"
                placeholder="Contoh: 120/80"
                value={bloodPressure}
                onChange={(e) => setBloodPressure(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Denyut Nadi (x/mnt)</label>
              <input
                type="text"
                placeholder="Contoh: 80"
                value={heartRate}
                onChange={(e) => setHeartRate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Laju Napas (x/mnt)</label>
              <input
                type="text"
                placeholder="Contoh: 20"
                value={respiratoryRate}
                onChange={(e) => setRespiratoryRate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Suhu Tubuh (°C)</label>
              <input
                type="text"
                placeholder="Contoh: 36.5"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Berat Badan (kg)</label>
              <input
                type="text"
                placeholder="Contoh: 60"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Tinggi Badan (cm)</label>
              <input
                type="text"
                placeholder="Contoh: 165"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* 3. Perekaman Suara */}
        <section className="consult-card">
          <div className="recorder-top-row">
            <h2 className="card-subheading">Perekaman Suara</h2>

            {/* Opsi draf halus untuk kemudahan pengujian tanpa mengganggu dokter */}
            <div className="subtle-draft-options">
              <button
                type="button"
                className="btn-subtle-link"
                onClick={() => {
                  setTranscript(SAMPLE_CONVERSATION_JAVANESE);
                  setPatientName('Ny. Siti Rahayu');
                  setPatientId('002');
                  setBloodPressure('140/90');
                  setHeartRate('82');
                  setRespiratoryRate('18');
                  setTemperature('36.8');
                  setWeight('58');
                  setHeight('155');
                  setValidationAlert(null);
                }}
              >
                Gunakan contoh percakapan &amp; tensi
              </button>
              <span className="dot-divider">&bull;</span>
              <button
                type="button"
                className="btn-subtle-link"
                onClick={() => {
                  setTranscript(SAMPLE_NONSENSE_CONVERSATION);
                  setValidationAlert(null);
                }}
              >
                Contoh percakapan non-medis
              </button>
            </div>
          </div>

          <div className="recording-action-bar">
            {!isRecording ? (
              <button
                className="btn-action-primary record"
                onClick={handleStartRecording}
                disabled={!canRecordAudio || isTranscribing}
              >
                <span className="mic-circle-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="9" y="2" width="6" height="12" rx="3" />
                    <path d="M5 11a7 7 0 0 0 14 0" />
                    <line x1="12" y1="18" x2="12" y2="22" />
                  </svg>
                </span>
                Mulai Rekam
              </button>
            ) : (
              <button className="btn-action-primary stop" onClick={handleStopRecording}>
                <span className="stop-square-icon" />
                Selesai Rekam
              </button>
            )}

            {isRecording && (
              <div className="recording-live-status">
                <span className="live-red-dot" />
                Sedang merekam percakapan...
              </div>
            )}

            {isTranscribing && (
              <div className="transcribing-status">
                Memproses transkripsi suara...
              </div>
            )}
          </div>

          {transcribeError && <div className="error-alert-banner">{transcribeError}</div>}
        </section>

        {/* 4. Transkrip Percakapan */}
        <section className="consult-card">
          <div className="editor-header-row">
            <h2 className="card-subheading">Transkrip Percakapan</h2>
            {transcript && (
              <button
                className="btn-pill-subtle"
                onClick={() => {
                  setTranscript('');
                  setValidationAlert(null);
                }}
              >
                Bersihkan
              </button>
            )}
          </div>

          <textarea
            className="transcript-textarea"
            rows="7"
            value={transcript}
            onChange={(e) => {
              setTranscript(e.target.value);
              setValidationAlert(null);
            }}
            placeholder="Transkrip percakapan akan muncul di sini setelah perekaman selesai, atau dapat diketik langsung..."
          />
        </section>

        {/* 5. Alur Koreksi (HANYA MUNCUL JIKA SISTEM MENDETEKSI PERCAKAPAN TIDAK MASUK AKAL) */}
        {validationAlert && (
          <section className="consult-card alert-clarification-card">
            <div className="clarification-header">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#D97706">
                <path d="M12 2L1 21h22L12 2zm0 4l7.53 13H4.47L12 6zm-1 5v4h2v-4h-2zm0 6v2h2v-2h-2z" />
              </svg>
              <span>Percakapan Memerlukan Klarifikasi Klinis</span>
            </div>

            <p className="clarification-desc">
              Sistem mendeteksi bahwa percakapan belum memuat keluhan medis atau pemeriksaan yang cukup jelas. Anda dapat memperbaiki transkrip di atas atau menambahkan catatan konteks di bawah ini:
            </p>

            <div className="clarification-field">
              <label>Catatan / Klarifikasi Dokter (Opsional):</label>
              <textarea
                rows="2"
                value={doctorClarification}
                onChange={(e) => setDoctorClarification(e.target.value)}
                placeholder="Contoh: Pasien mengeluhkan pusing berputar dan nyeri perut sejak 3 hari lalu..."
              />
            </div>

            <div className="clarification-btn-row">
              <button
                className="btn-action-primary"
                onClick={() => handleProcessSoap(true)}
                disabled={isProcessing}
              >
                {isProcessing ? 'Memproses Ulang...' : 'Periksa Ulang & Lanjutkan'}
              </button>
            </div>
          </section>
        )}

        {/* 6. Tombol Utama Buat Catatan SOAP */}
        <section className="soap-generate-bottom-card">
          {processError && <div className="error-alert-banner">{processError}</div>}

          <div className="generate-footer-flex">
            <div>
              <div className="generate-title">Selesai &amp; Susun Rekam Medis</div>
              <div className="generate-subtext">
                Klik tombol di samping untuk menghasilkan catatan rekam medis (SOAP) otomatis berdasarkan transkrip dan data tanda vital.
              </div>
            </div>

            <button
              className="btn-hero-generate"
              onClick={() => handleProcessSoap(false)}
              disabled={!transcript.trim() || isProcessing}
            >
              {isProcessing ? (
                <>
                  <span className="btn-spinner" />
                  Memproses Catatan Medis...
                </>
              ) : (
                'Buat Catatan SOAP'
              )}
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
