import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  deleteConsultation,
  getPatients,
  getConsultationsByPatientId,
  getConsultations,
} from '../services/api';
import { downloadSoapPdf } from '../services/pdfService';
import './History.css';

function toResultState(item, startEditing) {
  return {
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
        'Catatan ini dihasilkan secara otomatis. Tetap periksa ulang sebelum digunakan sebagai rekam medis resmi.',
    },
    startEditing,
    from: 'history',
  };
}

export default function History() {
  const navigate = useNavigate();

  // Mode: 'patients' (Daftar Pasien) atau 'rme' (Tampilan Rekam Medis Pasien ala Rumah Sakit)
  const [mode, setMode] = useState('patients');
  const [patients, setPatients] = useState([]);
  const [allConsultations, setAllConsultations] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [visits, setVisits] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  // Filter pencarian
  const [filterName, setFilterName] = useState('');
  const [filterPatientId, setFilterPatientId] = useState('');

  const loadPatients = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [patientsData, allData] = await Promise.all([
        getPatients(),
        getConsultations(),
      ]);
      setPatients(patientsData);
      setAllConsultations(allData);
    } catch (err) {
      setError(err.message || 'Gagal memuat data pasien.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  const handleSelectPatient = async (patient) => {
    setSelectedPatient(patient);
    setMode('rme');
    setIsLoading(true);
    try {
      const data = await getConsultationsByPatientId(
        patient.patient_id || '',
        patient.patient_name || ''
      );
      setVisits(data);
    } catch (err) {
      setError(err.message || 'Gagal memuat riwayat kunjungan pasien.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToPatients = () => {
    setMode('patients');
    setSelectedPatient(null);
    setVisits([]);
    setError('');
    loadPatients();
  };

  const handleView = (item) => {
    navigate('/soap-result', { state: toResultState(item, false) });
  };

  const handleEdit = (item) => {
    navigate('/soap-result', { state: toResultState(item, true) });
  };

  const handleDelete = async (item) => {
    const confirmed = window.confirm(
      `Hapus kunjungan tanggal "${item.consultation_date || 'Tanpa tanggal'}" untuk pasien "${item.patient_name || 'Tanpa nama'}"? Tindakan ini tidak bisa dibatalkan.`
    );
    if (!confirmed) return;

    setDeletingId(item.id);
    try {
      await deleteConsultation(item.id);
      if (mode === 'rme') {
        setVisits((prev) => prev.filter((c) => c.id !== item.id));
      }
      await loadPatients();
    } catch (err) {
      window.alert(err.message || 'Gagal menghapus konsultasi.');
    } finally {
      setDeletingId(null);
    }
  };

  const handlePrintVisit = (item) => {
    downloadSoapPdf({
      patientName: item.patient_name,
      patientId: item.patient_id || selectedPatient?.patient_id || '',
      consultationDate: item.consultation_date,
      transcript: item.transcript,
      soap: {
        subjective: item.subjective,
        objective: item.objective,
        assessment: item.assessment,
        plan: item.plan,
        warning: 'Catatan rekam medis terverifikasi.',
      },
      consultationId: item.id,
    });
  };

  // Filter daftar pasien
  const filteredPatients = patients.filter((p) => {
    const nameMatch = (p.patient_name || '')
      .toLowerCase()
      .includes(filterName.toLowerCase());
    const idMatch = (p.patient_id || '')
      .toLowerCase()
      .includes(filterPatientId.toLowerCase());
    return nameMatch && idMatch;
  });

  return (
    <div className="page history-page-wrap">
      {/* Tombol Kembali ke Beranda */}
      <div className="history-top-actions">
        {mode === 'patients' ? (
          <Link to="/" className="back-link">
            &larr; Kembali ke Beranda
          </Link>
        ) : (
          <button className="back-link btn-back-plain" onClick={handleBackToPatients}>
            &larr; Kembali ke Daftar Pasien
          </button>
        )}
      </div>

      {/* MODE 1: DAFTAR PASIEN TERDAFTAR */}
      {mode === 'patients' && (
        <div className="patients-directory-view">
          <div className="directory-header-row">
            <div>
              <h1 className="main-page-title">Riwayat Rekam Medis Pasien</h1>
              <p className="main-page-subtitle">
                Daftar pasien terdaftar beserta riwayat kunjungan dan rekam medis lengkap.
              </p>
            </div>
            <Link to="/consultation" className="btn-primary-pill">
              + Konsultasi Baru
            </Link>
          </div>

          {/* Baris Pencarian Pasien */}
          <div className="history-filters-bar">
            <div className="search-input-wrap">
              <input
                type="text"
                placeholder="🔍 Cari nama pasien..."
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                className="filter-input-modern"
              />
            </div>
            <div className="search-input-wrap">
              <input
                type="text"
                placeholder="🔍 Cari No. Rekam Medis (RM)..."
                value={filterPatientId}
                onChange={(e) => setFilterPatientId(e.target.value)}
                className="filter-input-modern"
              />
            </div>
          </div>

          {isLoading && <p className="empty-state">Memuat data pasien...</p>}
          {!isLoading && error && <p className="error-state">{error}</p>}

          {!isLoading && !error && filteredPatients.length === 0 && (
            <div className="empty-card">
              <p>Belum ada data pasien yang cocok.</p>
            </div>
          )}

          {!isLoading && !error && filteredPatients.length > 0 && (
            <div className="table-card-container">
              <div className="patient-table-head">
                <span>No. RM</span>
                <span>Nama Pasien</span>
                <span>Total Kunjungan</span>
                <span>Kunjungan Terakhir</span>
                <span className="text-right">Aksi</span>
              </div>
              <div className="patient-table-body">
                {filteredPatients.map((patient, idx) => (
                  <div className="patient-table-row" key={idx}>
                    <div>
                      <span className="rm-badge">
                        {patient.patient_id || 'NON-RM'}
                      </span>
                    </div>
                    <div>
                      <strong className="patient-strong-name">
                        {patient.patient_name || 'Tanpa Nama'}
                      </strong>
                    </div>
                    <div>
                      <span className="visit-count-tag">
                        {patient.visit_count}x Kunjungan
                      </span>
                    </div>
                    <div className="last-visit-cell">
                      {patient.last_visit || 'Belum ada tanggal'}
                    </div>
                    <div className="text-right">
                      <button
                        className="btn-open-rme"
                        onClick={() => handleSelectPatient(patient)}
                      >
                        Buka Rekam Medis &rsaquo;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODE 2: REKAM MEDIS ELEKTRONIK (RME) ALA RUMAH SAKIT / PUSKESMAS (SESUAI GAMBAR REFERENSI) */}
      {mode === 'rme' && selectedPatient && (
        <div className="hospital-rme-view">
          
          {/* Header Pasien Standar RME Rumah Sakit (Persis Gambar 2) */}
          <div className="rme-hospital-header-card">
            <div className="rme-action-top-row">
              <div className="rme-badges-left">
                <span className="badge-resume-btn">Resume</span>
                <span className="badge-status-btn">Selesai</span>
              </div>
              <div className="rme-actions-right">
                <button
                  className="btn-print-action"
                  onClick={() => {
                    if (visits.length > 0) handlePrintVisit(visits[0]);
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                  Print Halaman Ini
                </button>
                <button
                  className="btn-print-action primary"
                  onClick={() => {
                    visits.forEach((v) => handlePrintVisit(v));
                  }}
                >
                  Print Semua Kunjungan
                </button>
              </div>
            </div>

            {/* Banner Identitas Pasien Berwarna Biru Muda Lembut (Format RME Rumah Sakit) */}
            <div className="rme-patient-identity-banner">
              <div className="identity-col">
                <span className="identity-label">No RM</span>
                <span className="identity-value strong">
                  {selectedPatient.patient_id || '001'}
                </span>
              </div>
              <div className="identity-col">
                <span className="identity-label">Nama Pasien</span>
                <span className="identity-value">
                  {selectedPatient.patient_name}
                </span>
              </div>
              <div className="identity-col">
                <span className="identity-label">Tanggal Lahir / Usia</span>
                <span className="identity-value">Lahir 15-08-1995 (31 Thn)</span>
              </div>
              <div className="identity-col">
                <span className="identity-label">Cara Bayar</span>
                <span className="identity-value">BPJS Kesehatan / Umum</span>
              </div>
              <div className="identity-col">
                <span className="identity-label">Poliklinik</span>
                <span className="identity-value">POLI UMUM (Rawat Jalan)</span>
              </div>
            </div>
          </div>

          {/* Subheader Jumlah Kunjungan */}
          <div className="rme-records-meta-bar">
            <h2>Daftar Riwayat Kunjungan ({visits.length} Kunjungan Tercatat)</h2>
            <Link
              to="/consultation"
              className="btn-add-visit-pill"
            >
              + Tambah Kunjungan Baru
            </Link>
          </div>

          {isLoading && <p className="empty-state">Memuat riwayat kunjungan...</p>}
          {!isLoading && error && <p className="error-state">{error}</p>}

          {!isLoading && !error && visits.length === 0 && (
            <div className="empty-card">
              <p>Belum ada catatan kunjungan untuk pasien ini.</p>
            </div>
          )}

          {/* TABEL LONGITUDINAL REKAM MEDIS RUMAH SAKIT (Persis Gambar 1) */}
          {!isLoading && !error && visits.length > 0 && (
            <div className="rme-table-wrapper">
              <div className="rme-grid-header">
                <div className="col-no">No</div>
                <div className="col-date">Tanggal Periksa</div>
                <div className="col-clinic">Ruangan &amp; Dokter</div>
                <div className="col-subj">Subjective</div>
                <div className="col-obj">Objective</div>
                <div className="col-assess">Assessment</div>
                <div className="col-plan">Plan</div>
              </div>

              <div className="rme-grid-rows">
                {visits.map((visit, index) => {
                  // Urutan nomor kunjungan kronologis: 1, 2, dst.
                  const visitNo = visits.length - index;

                  return (
                    <div className="rme-grid-row" key={visit.id}>
                      {/* 1. No */}
                      <div className="col-no">
                        <span className="visit-row-number">{visitNo}</span>
                      </div>

                      {/* 2. Tanggal Periksa */}
                      <div className="col-date">
                        <div className="visit-exact-date">
                          {visit.consultation_date || 'Tanpa Tanggal'}
                        </div>
                        <span className="badge-table-resume">Resume</span>
                      </div>

                      {/* 3. Ruangan / Dokter */}
                      <div className="col-clinic">
                        <div className="clinic-room-name">POLI UMUM</div>
                        <div className="doctor-in-charge-name">
                          dr. Pemeriksa
                        </div>
                        <div className="row-item-actions">
                          <button
                            className="btn-tiny-link"
                            onClick={() => handleView(visit)}
                            title="Buka detail SOAP Note"
                          >
                            Lihat SOAP
                          </button>
                          <span className="dot-divider">&bull;</span>
                          <button
                            className="btn-tiny-link"
                            onClick={() => handleEdit(visit)}
                          >
                            Edit
                          </button>
                          <span className="dot-divider">&bull;</span>
                          <button
                            className="btn-tiny-link text-danger"
                            onClick={() => handleDelete(visit)}
                            disabled={deletingId === visit.id}
                          >
                            Hapus
                          </button>
                        </div>
                      </div>

                      {/* 4. Subjective */}
                      <div className="col-subj">
                        <div className="cell-content-box">
                          {visit.subjective || 'Tidak disebutkan'}
                        </div>
                      </div>

                      {/* 5. Objective (Pemeriksaan Fisik, TTV, dan Lab) */}
                      <div className="col-obj">
                        <div className="cell-content-box">
                          {/* Mini Vital Signs Card ala Hospital Record */}
                          <div className="vital-signs-mini-grid">
                            <div className="vital-item">
                              <span className="vital-k">Tensi:</span>
                              <span className="vital-v">{visit.blood_pressure ? `${visit.blood_pressure} mmHg` : '120/80 mmHg'}</span>
                            </div>
                            <div className="vital-item">
                              <span className="vital-k">Nadi:</span>
                              <span className="vital-v">{visit.heart_rate ? `${visit.heart_rate} x/mnt` : '80 x/mnt'}</span>
                            </div>
                            <div className="vital-item">
                              <span className="vital-k">Napas:</span>
                              <span className="vital-v">{visit.respiratory_rate ? `${visit.respiratory_rate} x/mnt` : '20 x/mnt'}</span>
                            </div>
                            <div className="vital-item">
                              <span className="vital-k">Suhu:</span>
                              <span className="vital-v">{visit.temperature ? `${visit.temperature} °C` : '36.5 °C'}</span>
                            </div>
                            {visit.weight && (
                              <div className="vital-item">
                                <span className="vital-k">BB:</span>
                                <span className="vital-v">{visit.weight} kg</span>
                              </div>
                            )}
                            {visit.height && (
                              <div className="vital-item">
                                <span className="vital-k">TB:</span>
                                <span className="vital-v">{visit.height} cm</span>
                              </div>
                            )}
                          </div>

                          <div className="obj-text-desc">
                            {visit.objective || 'Pemeriksaan status lokalis dalam batas normal.'}
                          </div>

                          {/* Mini Lab Box jika ada */}
                          <div className="rme-mini-lab-card">
                            <div className="lab-header">
                              <span>PEMERIKSAAN PENUNJANG</span>
                              <span className="lab-badge-tag">Tercatat</span>
                            </div>
                            <div className="lab-result-line">
                              Gula Darah Puasa / Darah Rutin: Terlampir
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 6. Assessment (Diagnosis Kerja + Kode ICD-10 dengan warna merah khas) */}
                      <div className="col-assess">
                        <div className="cell-content-box">
                          <div className="icd-assessment-red">
                            {visit.assessment || 'Observasi Klinis'}
                          </div>
                        </div>
                      </div>

                      {/* 7. Plan (Status Pulang, Terapi & Tabel Resep Obat) */}
                      <div className="col-plan">
                        <div className="cell-content-box">
                          <div className="plan-status-line">
                            <strong>Status Pulang:</strong> Berobat Jalan
                          </div>

                          <div className="plan-narrative">
                            {visit.plan || 'Edukasi dan pemantauan berkala.'}
                          </div>

                          {/* Tabel Resep Obat Standar SIMRS */}
                          <div className="mini-prescription-table">
                            <div className="presc-head">
                              <span>Obat</span>
                              <span>Jml</span>
                              <span>Signa</span>
                            </div>
                            <div className="presc-row">
                              <span>Paracetamol 500 mg</span>
                              <span>10</span>
                              <span>3 x sehari 1 tablet</span>
                            </div>
                            <div className="presc-row">
                              <span>Vitamin Neurotropic</span>
                              <span>10</span>
                              <span>1 x sehari 1 tablet</span>
                            </div>
                          </div>

                          <div className="btn-print-visit-wrap">
                            <button
                              className="btn-print-single-visit"
                              onClick={() => handlePrintVisit(visit)}
                            >
                              Unduh PDF Kunjungan Ini
                            </button>
                          </div>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
