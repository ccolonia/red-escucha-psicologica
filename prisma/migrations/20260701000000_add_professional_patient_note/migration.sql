-- CreateTable: Notas privadas del profesional sobre un paciente
-- Cada profesional puede tener UNA nota privada por paciente (relación 1:1
-- efectiva mediante @@unique([professionalId, patientId])).
-- El contenido es editable desde el panel del profesional y NUNCA es visible
-- para el paciente ni para el administrador.
CREATE TABLE "ProfessionalPatientNote" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalPatientNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: una nota por par profesional-paciente (upsert-friendly)
CREATE UNIQUE INDEX "ProfessionalPatientNote_professionalId_patientId_key"
    ON "ProfessionalPatientNote"("professionalId", "patientId");

-- AddForeignKey: profesional → si se borra el profesional, se borran sus notas
ALTER TABLE "ProfessionalPatientNote"
    ADD CONSTRAINT "ProfessionalPatientNote_professionalId_fkey"
    FOREIGN KEY ("professionalId") REFERENCES "Professional"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: paciente → si se borra el paciente, se borran sus notas
ALTER TABLE "ProfessionalPatientNote"
    ADD CONSTRAINT "ProfessionalPatientNote_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
