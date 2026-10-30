import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getConsultations } from '../services/api';
import './Dashboard.css';

const RECENT_LIMIT = 5;

function getInitials(name) {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  const initials = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2);
  return initials.toUpperCase();
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [riwayat, setRiwayat] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getConsultations()
      .then((data) => setRiwayat(data.slice(0, RECENT_LIMIT)))
      .catch((err) => console.error('Gagal memuat riwayat:', err))
      .finally(() => setIsLoading(false));
  }, []);

  const handleViewItem = (item) => {
    navigate('/soap-result', {
      state: {
        patientName: item.patient_name,
        patientId: item.patient_id || '',
        consultationDate: item.consultation_date,
        transcript: item.transcript,
        consultationId: item.id,
        soap: {
          subjective: item.subjective,
          objective: item.objective,
          assessment: item.assessment,
          plan: item.plan,
          warning:
            'Catatan ini dihasilkan secara otomatis. Periksa kembali sebelum digunakan sebagai rekam medis resmi.',
        },
        from: 'history',
      },
    });
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-content-wrap">
        
        {/* Hero Section Bersih, Ringkas & Profesional */}
        <section className="dashboard-hero-card">
          <h1 className="hero-title">Doctor Assistant</h1>
          <p className="hero-subtitle">
            Asisten Pencatatan Rekam Medis Klinis (SOAP)
          </p>
          <p className="hero-description">
            Membantu dokter menyusun catatan rekam medis secara otomatis dan terstruktur dari percakapan langsung dengan pasien.
          </p>

          <div className="hero-action-row">
            <Link to="/consultation" className="btn-hero-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0" />
                <line x1="12" y1="18" x2="12" y2="22" />
              </svg>
              Mulai Konsultasi
            </Link>
            <Link to="/history" className="btn-hero-secondary">
              Lihat Riwayat Pasien
            </Link>
          </div>
        </section>

        {/* Kartu Fitur Utama (Bahasa Indonesia Bersih & Rapi) */}
        <section className="dashboard-feature-grid">
          <div className="feature-item-card">
            <div className="feature-icon-badge coral">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
              </svg>
            </div>
            <h3 className="feature-title">Perekaman &amp; Transkripsi</h3>
            <p className="feature-desc">
              Merekam percakapan konsultasi secara akurat, mendukung Bahasa Indonesia maupun bahasa daerah.
            </p>
          </div>

          <div className="feature-item-card">
            <div className="feature-icon-badge teal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </div>
            <h3 className="feature-title">Validasi Kelayakan Klinis</h3>
            <p className="feature-desc">
              Sistem secara otomatis memastikan percakapan relevan dan konsisten sebelum catatan disusun.
            </p>
          </div>

          <div className="feature-item-card">
            <div className="feature-icon-badge amber">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <h3 className="feature-title">Format Catatan SOAP</h3>
            <p className="feature-desc">
              Menghasilkan ringkasan terstruktur lengkap beserta perkiraan kode diagnosis dan unduhan PDF.
            </p>
          </div>
        </section>

        {/* Riwayat Konsultasi Terakhir */}
        <section className="dashboard-history-card">
          <div className="history-header-flex">
            <div>
              <h2 className="history-heading">Riwayat Konsultasi Terakhir</h2>
              <span className="history-sublabel">Daftar rekam medis pasien terbaru</span>
            </div>
            <Link to="/history" className="see-all-capsule">
              Lihat Semua &rarr;
            </Link>
          </div>

          {isLoading && <p className="state-message">Memuat data...</p>}

          {!isLoading && riwayat.length === 0 && (
            <div className="empty-history-box">
              <p>Belum ada riwayat konsultasi tersimpan.</p>
              <Link to="/consultation" className="btn-empty-start">
                Mulai Konsultasi Baru
              </Link>
            </div>
          )}

          {!isLoading && riwayat.length > 0 && (
            <div className="history-list-wrap">
              {riwayat.map((item) => (
                <div key={item.id} className="history-card-row">
                  <div className="patient-avatar-disc">
                    {getInitials(item.patient_name)}
                  </div>
                  <div className="patient-info-meta">
                    <div className="patient-title-line">
                      <span className="patient-name-text">
                        {item.patient_name || 'Tidak disebutkan'}
                      </span>
                      {item.patient_id && (
                        <span className="patient-id-tag">{item.patient_id}</span>
                      )}
                    </div>
                    <span className="patient-date-text">
                      {item.consultation_date || 'Tanpa tanggal'}
                    </span>
                  </div>
                  <button
                    className="btn-view-capsule"
                    onClick={() => handleViewItem(item)}
                  >
                    Buka Catatan &rsaquo;
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
