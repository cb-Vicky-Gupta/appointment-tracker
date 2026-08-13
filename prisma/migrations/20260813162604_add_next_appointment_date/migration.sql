-- AlterTable
-- Nullable with no default: existing visits genuinely have no follow-up on
-- record, and back-filling one would invent appointments nobody booked.
ALTER TABLE "Appointment" ADD COLUMN "nextAppointmentDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Appointment_nextAppointmentDate_idx" ON "Appointment"("nextAppointmentDate");
