const db = require('../database/db');

function createConsultation(data) {
  let patientId = (data.patientId || '').trim();
  const patientName = (data.patientName || '').trim();

  // Jika patient_id kosong tapi nama pasien sudah pernah tercatat memiliki No. RM sebelumnya,
  // sistem otomatis mengaitkannya ke No. RM yang sama agar kunjungan tidak terpecah.
  if (!patientId && patientName) {
    const existing = db.prepare(`
      SELECT patient_id FROM consultations
      WHERE LOWER(TRIM(patient_name)) = LOWER(TRIM(?))
        AND patient_id IS NOT NULL AND TRIM(patient_id) != ''
      ORDER BY id DESC LIMIT 1
    `).get(patientName);

    if (existing && existing.patient_id) {
      patientId = existing.patient_id;
    }
  }

  const payload = {
    patientName,
    patientId,
    consultationDate: data.consultationDate || '',
    transcript: data.transcript || '',
    subjective: data.subjective || '',
    objective: data.objective || '',
    assessment: data.assessment || '',
    plan: data.plan || '',
    bloodPressure: data.bloodPressure || '',
    heartRate: data.heartRate || '',
    respiratoryRate: data.respiratoryRate || '',
    temperature: data.temperature || '',
    weight: data.weight || '',
    height: data.height || '',
  };

  const stmt = db.prepare(`
    INSERT INTO consultations
      (patient_name, patient_id, consultation_date, transcript, subjective, objective, assessment, plan,
       blood_pressure, heart_rate, respiratory_rate, temperature, weight, height)
    VALUES
      (@patientName, @patientId, @consultationDate, @transcript, @subjective, @objective, @assessment, @plan,
       @bloodPressure, @heartRate, @respiratoryRate, @temperature, @weight, @height)
  `);
  const result = stmt.run(payload);
  return getConsultationById(result.lastInsertRowid);
}

function getAllConsultations() {
  return db
    .prepare('SELECT * FROM consultations ORDER BY consultation_date DESC, id DESC')
    .all();
}

function getConsultationById(id) {
  return db.prepare('SELECT * FROM consultations WHERE id = ?').get(id);
}

// Mengambil seluruh riwayat kunjungan pasien berdasarkan patient_id atau nama pasien
function getConsultationsByPatientId(patientId, patientName = '') {
  const pId = (patientId || '').trim();
  const pName = (patientName || '').trim();

  if (pId && !pId.startsWith('NON-RM-')) {
    return db
      .prepare(`
        SELECT * FROM consultations 
        WHERE patient_id = ? 
           OR (LOWER(TRIM(patient_name)) = LOWER(TRIM(?)) AND (patient_id IS NULL OR TRIM(patient_id) = ''))
        ORDER BY consultation_date DESC, id DESC
      `)
      .all(pId, pName || pId);
  } else if (pName) {
    return db
      .prepare(`
        SELECT * FROM consultations 
        WHERE LOWER(TRIM(patient_name)) = LOWER(TRIM(?))
        ORDER BY consultation_date DESC, id DESC
      `)
      .all(pName);
  }

  return db
    .prepare('SELECT * FROM consultations WHERE patient_id = ? ORDER BY consultation_date DESC, id DESC')
    .all(patientId);
}

// Daftar pasien unik dengan perhitungan total kunjungan akurat
function getPatients() {
  return db.prepare(`
    SELECT
      COALESCE(NULLIF(TRIM(patient_id), ''), 'NON-RM-' || LOWER(TRIM(patient_name))) as group_key,
      MAX(NULLIF(TRIM(patient_id), '')) as patient_id,
      patient_name,
      COUNT(*) as visit_count,
      MAX(consultation_date) as last_visit
    FROM consultations
    WHERE patient_name IS NOT NULL AND TRIM(patient_name) != ''
    GROUP BY LOWER(TRIM(patient_name))
    ORDER BY last_visit DESC
  `).all();
}

function updateConsultation(id, data) {
  const existing = getConsultationById(id) || {};
  const payload = {
    id,
    patientName: data.patientName ?? existing.patient_name,
    patientId: data.patientId ?? existing.patient_id,
    consultationDate: data.consultationDate ?? existing.consultation_date,
    transcript: data.transcript ?? existing.transcript,
    subjective: data.subjective ?? existing.subjective,
    objective: data.objective ?? existing.objective,
    assessment: data.assessment ?? existing.assessment,
    plan: data.plan ?? existing.plan,
    bloodPressure: data.bloodPressure ?? existing.blood_pressure ?? '',
    heartRate: data.heartRate ?? existing.heart_rate ?? '',
    respiratoryRate: data.respiratoryRate ?? existing.respiratory_rate ?? '',
    temperature: data.temperature ?? existing.temperature ?? '',
    weight: data.weight ?? existing.weight ?? '',
    height: data.height ?? existing.height ?? '',
  };

  const stmt = db.prepare(`
    UPDATE consultations
    SET patient_name = @patientName,
        patient_id = @patientId,
        consultation_date = @consultationDate,
        transcript = @transcript,
        subjective = @subjective,
        objective = @objective,
        assessment = @assessment,
        plan = @plan,
        blood_pressure = @bloodPressure,
        heart_rate = @heartRate,
        respiratory_rate = @respiratoryRate,
        temperature = @temperature,
        weight = @weight,
        height = @height
    WHERE id = @id
  `);
  stmt.run(payload);
  return getConsultationById(id);
}

function deleteConsultation(id) {
  const stmt = db.prepare('DELETE FROM consultations WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

module.exports = {
  createConsultation,
  getAllConsultations,
  getConsultationById,
  getConsultationsByPatientId,
  getPatients,
  updateConsultation,
  deleteConsultation,
};
