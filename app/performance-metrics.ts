export type BodyMeasurement = {
  recordedAt: string;
  weightKg: number;
  waistCm?: number;
  restingHeartRate?: number;
};

export function calculateAge(birthDate?: string) {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

export function calculateBmi(weightKg?: number, heightCm?: number) {
  if (!weightKg || !heightCm || heightCm < 80) return null;
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

export function bmiCategory(bmi: number | null, age: number | null) {
  if (bmi === null) return "Dados incompletos";
  if (age !== null && age < 20) return "Categoria adulta não aplicável";
  if (bmi < 18.5) return "Abaixo da faixa de referência";
  if (bmi < 25) return "Faixa de referência";
  if (bmi < 30) return "Acima da faixa de referência";
  return "Faixa de obesidade";
}

export function waistToHeightRatio(waistCm?: number, heightCm?: number) {
  if (!waistCm || !heightCm) return null;
  return waistCm / heightCm;
}

export function waistRatioCategory(ratio: number | null) {
  if (ratio === null) return "Informe a cintura";
  if (ratio < 0.4) return "Abaixo de 0,40";
  if (ratio < 0.5) return "Sem aumento indicado";
  if (ratio < 0.6) return "Risco aumentado";
  return "Risco ainda maior";
}

export function estimateRestingEnergy(weightKg?: number, heightCm?: number, age?: number | null, biologicalSex?: string) {
  if (!weightKg || !heightCm || age === null || age === undefined || !["Masculino", "Feminino"].includes(biologicalSex || "")) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(base + (biologicalSex === "Masculino" ? 5 : -161));
}

export function epleyEstimatedOneRepMax(loadKg: number, repetitions: number) {
  if (loadKg <= 0 || repetitions <= 0 || repetitions > 10) return null;
  return loadKg * (1 + repetitions / 30);
}

export function linearProjection(measurements: BodyMeasurement[], daysAhead: number) {
  if (measurements.length < 2) return null;
  const sorted = [...measurements].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
  const firstTime = new Date(sorted[0].recordedAt).getTime();
  const points = sorted.map((item) => ({ x: (new Date(item.recordedAt).getTime() - firstTime) / 86_400_000, y: item.weightKg }));
  if (points[points.length - 1].x < 7) return null;
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const denominator = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
  if (!denominator) return null;
  const slope = points.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0) / denominator;
  const projected = points[points.length - 1].y + slope * daysAhead;
  if (!Number.isFinite(projected) || Math.abs(slope * 28) > 8) return null;
  return { projected, change: projected - points[points.length - 1].y };
}

export function formatMetric(value: number, digits = 1) {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}
