const db = require('../database/db');

function createConsultation(data) {
  const stmt = db.prepare(`
    INSERT INTO consultations
      (patient_name, consultation_date, transcript, subjective, objective, assessment, plan)
    VALUES (@patientName, @consultationDate, @transcript, @subjective, @objective, @assessment, @plan)
  `);
  const result = stmt.run(data);
  return getConsultationById(result.lastInsertRowid);
}

function getAllConsultations() {
  return db
    .prepare('SELECT * FROM consultations ORDER BY created_at DESC')
    .all();
}

function getConsultationById(id) {
  return db.prepare('SELECT * FROM consultations WHERE id = ?').get(id);
}

function updateConsultation(id, data) {
  const stmt = db.prepare(`
    UPDATE consultations
    SET patient_name = @patientName,
        consultation_date = @consultationDate,
        transcript = @transcript,
        subjective = @subjective,
        objective = @objective,
        assessment = @assessment,
        plan = @plan
    WHERE id = @id
  `);
  stmt.run({ ...data, id });
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
  updateConsultation,
  deleteConsultation,
};
