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

function Dashboard() {
  const navigate = useNavigate();
  const [riwayat, setRiwayat] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getConsultations()
      .then((data) => setRiwayat(data.slice(0, RECENT_LIMIT)))
      .catch((err) => console.error('Gagal memuat riwayat terakhir:', err))
      .finally(() => setIsLoading(false));
  }, []);

  const handleViewItem = (item) => {
    navigate('/soap-result', {
      state: {
        patientName: item.patient_name,
        consultationDate: item.consultation_date,
        transcript: item.transcript,
        consultationId: item.id,
        soap: {
          subjective: item.subjective,
          objective: item.objective,
          assessment: item.assessment,
          plan: item.plan,
          warning:
            'Hasil ini tersimpan sebelumnya. Tetap periksa ulang sebelum digunakan sebagai rekam medis resmi.',
        },
        from: 'history',
      },
    });
  };

  return (
    <div className="page dashboard">
      <header className="dashboard-header">
        <div className="hero-badge">DA</div>
        <h1>Doctor Assistant</h1>
        <p className="subtitle">
          Physician Note Taker Assistant untuk Penulisan Medical Record
        </p>
        <p className="description">
          Bantu dokter membuat physician note (SOAP Note) secara otomatis dari
          percakapan dokter dan pasien. Alat ini adalah bantu dokumentasi,
          bukan pengganti penilaian medis dokter.
        </p>
        <Link to="/consultation" className="btn btn-primary btn-hero">
          Mulai Konsultasi
        </Link>
      </header>

      <section className="dashboard-history">
        <div className="dashboard-history-header">
          <h2>Riwayat Konsultasi Terakhir</h2>
          <Link to="/history" className="see-all-link">
            Lihat Semua &rarr;
          </Link>
        </div>

        {isLoading && <p className="empty-state">Memuat...</p>}

        {!isLoading && riwayat.length === 0 && (
          <p className="empty-state">Belum ada riwayat konsultasi.</p>
        )}

        {!isLoading && riwayat.length > 0 && (
          <ul className="history-list">
            {riwayat.map((item) => (
              <li key={item.id} className="history-item">
                <span className="history-avatar">{getInitials(item.patient_name)}</span>
                <span className="history-item-info">
                  <span className="history-item-name">
                    {item.patient_name || 'Tidak disebutkan'}
                  </span>
                  <span className="history-item-date">
                    {item.consultation_date || 'Tidak disebutkan'}
                  </span>
                </span>
                <button
                  className="btn btn-secondary btn-small"
                  onClick={() => handleViewItem(item)}
                >
                  Lihat
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default Dashboard;
