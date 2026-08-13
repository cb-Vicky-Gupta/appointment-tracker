-- Enforce one OPD No. per (userId, opdNo) — a repeat OPD No. must go
-- through POST /api/patients/:id/appointments, never a second Patient row.
DROP INDEX "Patient_userId_opdNo_idx";
CREATE UNIQUE INDEX "Patient_userId_opdNo_key" ON "Patient"("userId", "opdNo");
