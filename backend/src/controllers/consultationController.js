const consultationModel = require('../models/consultationModel');

function create(req, res) {
  const {
    patientName,
    patientId,
    consultationDate,
    transcript,
    subjective,
    objective,
    assessment,
    plan,
    bloodPressure,
    heartRate,
    respiratoryRate,
    temperature,
    weight,
    height,
  } = req.body;

  if (!transcript || !transcript.trim()) {
    return res.status(400).json({ error: 'Transkrip tidak boleh kosong.' });
  }

  const consultation = consultationModel.createConsultation({
    patientName: patientName || '',
    patientId: patientId || '',
    consultationDate: consultationDate || '',
    transcript,
    subjective: subjective || '',
    objective: objective || '',
    assessment: assessment || '',
    plan: plan || '',
    bloodPressure: bloodPressure || '',
    heartRate: heartRate || '',
    respiratoryRate: respiratoryRate || '',
    temperature: temperature || '',
    weight: weight || '',
    height: height || '',
  });

  res.status(201).json(consultation);
}

function getAll(req, res) {
  res.json(consultationModel.getAllConsultations());
}

function getById(req, res) {
  const consultation = consultationModel.getConsultationById(req.params.id);
  if (!consultation) {
    return res.status(404).json({ error: 'Konsultasi tidak ditemukan.' });
  }
  res.json(consultation);
}

// Daftar pasien unik
function getPatients(req, res) {
  res.json(consultationModel.getPatients());
}

// Riwayat kunjungan pasien berdasarkan No. Identitas atau nama
function getByPatientId(req, res) {
  const { patientId } = req.params;
  const { name } = req.query;
  const consultations = consultationModel.getConsultationsByPatientId(patientId, name || '');
  res.json(consultations);
}

function update(req, res) {
  const existing = consultationModel.getConsultationById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Konsultasi tidak ditemukan.' });
  }

  const {
    patientName,
    patientId,
    consultationDate,
    transcript,
    subjective,
    objective,
    assessment,
    plan,
    bloodPressure,
    heartRate,
    respiratoryRate,
    temperature,
    weight,
    height,
  } = req.body;

  const updated = consultationModel.updateConsultation(req.params.id, {
    patientName: patientName ?? existing.patient_name,
    patientId: patientId ?? existing.patient_id,
    consultationDate: consultationDate ?? existing.consultation_date,
    transcript: transcript ?? existing.transcript,
    subjective: subjective ?? existing.subjective,
    objective: objective ?? existing.objective,
    assessment: assessment ?? existing.assessment,
    plan: plan ?? existing.plan,
    bloodPressure: bloodPressure ?? existing.blood_pressure,
    heartRate: heartRate ?? existing.heart_rate,
    respiratoryRate: respiratoryRate ?? existing.respiratory_rate,
    temperature: temperature ?? existing.temperature,
    weight: weight ?? existing.weight,
    height: height ?? existing.height,
  });

  res.json(updated);
}

function remove(req, res) {
  const deleted = consultationModel.deleteConsultation(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Konsultasi tidak ditemukan.' });
  }
  res.status(204).send();
}

module.exports = { create, getAll, getById, getPatients, getByPatientId, update, remove };
