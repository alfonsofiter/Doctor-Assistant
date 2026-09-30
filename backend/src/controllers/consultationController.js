const consultationModel = require('../models/consultationModel');

function create(req, res) {
  const {
    patientName,
    consultationDate,
    transcript,
    subjective,
    objective,
    assessment,
    plan,
  } = req.body;

  if (!transcript || !transcript.trim()) {
    return res.status(400).json({ error: 'Transkrip tidak boleh kosong.' });
  }

  const consultation = consultationModel.createConsultation({
    patientName: patientName || '',
    consultationDate: consultationDate || '',
    transcript,
    subjective: subjective || '',
    objective: objective || '',
    assessment: assessment || '',
    plan: plan || '',
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

function update(req, res) {
  const existing = consultationModel.getConsultationById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Konsultasi tidak ditemukan.' });
  }

  const {
    patientName,
    consultationDate,
    transcript,
    subjective,
    objective,
    assessment,
    plan,
  } = req.body;

  const updated = consultationModel.updateConsultation(req.params.id, {
    patientName: patientName ?? existing.patient_name,
    consultationDate: consultationDate ?? existing.consultation_date,
    transcript: transcript ?? existing.transcript,
    subjective: subjective ?? existing.subjective,
    objective: objective ?? existing.objective,
    assessment: assessment ?? existing.assessment,
    plan: plan ?? existing.plan,
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

module.exports = { create, getAll, getById, update, remove };
