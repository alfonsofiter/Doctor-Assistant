const BASE_URL = "http://localhost:5000/api";

export async function checkBackendHealth() {
  const response = await fetch(`${BASE_URL}/health`);
  if (!response.ok) {
    throw new Error("Backend tidak merespons");
  }
  return response.json();
}

export async function generateSoapNote(transcript) {
  const response = await fetch(`${BASE_URL}/soap/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Gagal menghasilkan SOAP Note.");
  }

  return data;
}

export async function createConsultation(payload) {
  const response = await fetch(`${BASE_URL}/consultations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Gagal menyimpan konsultasi.");
  }

  return data;
}

export async function updateConsultation(id, payload) {
  const response = await fetch(`${BASE_URL}/consultations/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Gagal memperbarui konsultasi.");
  }

  return data;
}

export async function getConsultations() {
  const response = await fetch(`${BASE_URL}/consultations`);
  if (!response.ok) {
    throw new Error("Gagal mengambil riwayat konsultasi.");
  }
  return response.json();
}

export async function deleteConsultation(id) {
  const response = await fetch(`${BASE_URL}/consultations/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Gagal menghapus konsultasi.");
  }
}
export async function transcribeAudio(audioBlob) {
  const formData = new FormData();
  formData.append("audio", audioBlob, "rekaman");

  const response = await fetch(`${BASE_URL}/transcribe`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Gagal mentranskripsi audio.");
  }

  return data;
}
