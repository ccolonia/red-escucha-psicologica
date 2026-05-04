// Script para migrar datos de SQLite a PostgreSQL
// Ejecutar después de tener la DATABASE_URL de Neon configurada
// Uso: node scripts/migrate-data.js

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log('📦 Iniciando migración de datos...');

  const dataPath = path.join(__dirname, '..', 'db', 'migration-data.json');
  if (!fs.existsSync(dataPath)) {
    console.error('❌ No se encontró db/migration-data.json');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  console.log(`Encontrados: ${data.users.length} usuarios, ${data.patients.length} pacientes, ${data.professionals.length} profesionales, ${data.appointments.length} turnos, ${data.contacts.length} contactos`);

  // 1. Crear usuarios
  console.log('\n👤 Migrando usuarios...');
  for (const user of data.users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: {
        id: user.id,
        email: user.email,
        password: user.password,
        name: user.name,
        phone: user.phone,
        role: user.role,
        active: user.active,
        createdAt: new Date(user.createdAt),
        updatedAt: new Date(user.updatedAt),
      },
    });
  }
  console.log(`✅ ${data.users.length} usuarios migrados`);

  // 2. Crear pacientes
  console.log('\n🏥 Migrando pacientes...');
  for (const patient of data.patients) {
    await prisma.patient.upsert({
      where: { id: patient.id },
      update: {},
      create: {
        id: patient.id,
        userId: patient.userId,
        dateOfBirth: patient.dateOfBirth,
        emergencyContact: patient.emergencyContact,
        notes: patient.notes,
        createdAt: new Date(patient.createdAt),
        updatedAt: new Date(patient.updatedAt),
      },
    });
  }
  console.log(`✅ ${data.patients.length} pacientes migrados`);

  // 3. Crear profesionales
  console.log('\n👨‍⚕️ Migrando profesionales...');
  for (const prof of data.professionals) {
    await prisma.professional.upsert({
      where: { id: prof.id },
      update: {},
      create: {
        id: prof.id,
        userId: prof.userId,
        license: prof.license,
        specialty: prof.specialty,
        bio: prof.bio,
        available: prof.available,
        createdAt: new Date(prof.createdAt),
        updatedAt: new Date(prof.updatedAt),
      },
    });
  }
  console.log(`✅ ${data.professionals.length} profesionales migrados`);

  // 4. Crear turnos
  console.log('\n📅 Migrando turnos...');
  for (const apt of data.appointments) {
    await prisma.appointment.upsert({
      where: { id: apt.id },
      update: {},
      create: {
        id: apt.id,
        patientId: apt.patientId,
        professionalId: apt.professionalId,
        date: apt.date,
        time: apt.time,
        status: apt.status,
        reason: apt.reason,
        notes: apt.notes,
        createdAt: new Date(apt.createdAt),
        updatedAt: new Date(apt.updatedAt),
      },
    });
  }
  console.log(`✅ ${data.appointments.length} turnos migrados`);

  // 5. Crear contactos
  console.log('\n📧 Migrando consultas de contacto...');
  for (const contact of data.contacts) {
    await prisma.contactRequest.upsert({
      where: { id: contact.id },
      update: {},
      create: {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        message: contact.message,
        reason: contact.reason,
        createdAt: new Date(contact.createdAt),
      },
    });
  }
  console.log(`✅ ${data.contacts.length} contactos migrados`);

  console.log('\n🎉 ¡Migración completada exitosamente!');
  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('❌ Error en migración:', e);
    process.exit(1);
  });
