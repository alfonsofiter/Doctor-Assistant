import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deleteConsultation, getConsultations } from '../services/api';
import './History.css';

function toResultState(item, startEditing) {
  return {
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
    startEditing,
    from: 'history',
  };
}

function History() {
  const navigate = useNavigate();
  const [consultations, setConsultations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const loadConsultations = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await getConsultations();
      setConsultations(data);
    } catch (err) {
      console.error('Gagal memuat riwayat:', err);
      setError(err.message || 'Gagal memuat riwayat konsultasi.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConsultations();
  }, []);

  const handleView = (item) => {
    navigate('/soap-result', { state: toResultState(item, false) });
  };

  const handleEdit = (item) => {
    navigate('/soap-result', { state: toResultState(item, true) });
  };

  const handleDelete = async (item) => {
    const confirmed = window.confirm(
      `Hapus riwayat konsultasi "${item.patient_name || 'Tanpa nama'}"? Tindakan ini tidak bisa dibatalkan.`
    );
    if (!confirmed) return;

    setDeletingId(item.id);
    try {
      await deleteConsultation(item.id);
      setConsultations((prev) => prev.filter((c) => c.id !== item.id));
    } catch (err) {
      console.error('Gagal menghapus konsultasi:', err);
      window.alert(err.message || 'Gagal menghapus konsultasi.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="page history">
      <Link to="/" className="back-link">
        &larr; Kembali ke Dashboard
      </Link>

      <h1>Riwayat Konsultasi</h1>

      {isLoading && <p className="empty-state">Memuat riwayat...</p>}
      {!isLoading && error && <p className="generate-error">{error}</p>}

      {!isLoading && !error && consultations.length === 0 && (
        <p className="empty-state">Belum ada riwayat konsultasi.</p>
      )}

      {!isLoading && !error && consultations.length > 0 && (
        <div className="history-table">
          <div className="history-row history-row-head">
            <span>Nama / Inisial</span>
            <span>Tanggal</span>
            <span>Status</span>
            <span>Aksi</span>
          </div>
          {consultations.map((item) => (
            <div className="history-row" key={item.id}>
              <span>{item.patient_name || 'Tidak disebutkan'}</span>
              <span>{item.consultation_date || 'Tidak disebutkan'}</span>
              <span className="status-badge">Tersimpan</span>
              <span className="row-actions">
                <button className="btn btn-secondary" onClick={() => handleView(item)}>
                  Lihat
                </button>
                <button className="btn btn-secondary" onClick={() => handleEdit(item)}>
                  Edit
                </button>
                <button
                  className="btn btn-danger-outline"
                  onClick={() => handleDelete(item)}
                  disabled={deletingId === item.id}
                >
                  {deletingId === item.id ? 'Menghapus...' : 'Hapus'}
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default History;
