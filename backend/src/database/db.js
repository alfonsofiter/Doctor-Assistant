const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'doctor_assistant.sqlite');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS consultations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_name TEXT,
    patient_id TEXT,
    consultation_date TEXT,
    transcript TEXT,
    subjective TEXT,
    objective TEXT,
    assessment TEXT,
    plan TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Migrasi aman untuk field tambahan tanpa merusak database yang sudah ada
const migrationColumns = [
  'patient_id TEXT',
  'blood_pressure TEXT',
  'heart_rate TEXT',
  'respiratory_rate TEXT',
  'temperature TEXT',
  'weight TEXT',
  'height TEXT',
];

for (const col of migrationColumns) {
  try {
    db.exec(`ALTER TABLE consultations ADD COLUMN ${col}`);
  } catch (_) {
    // Kolom sudah ada, lewati
  }
}

module.exports = db;
