import { db } from "./db";

async function seed() {
  console.log("🌱 Iniciando seed...");

  // Create admin user
  const admin = await db.user.create({
    data: {
      name: "Administrador AP",
      email: "admin@ap.com.ar",
      password: "admin123",
      role: "admin",
      phone: "+54 11 4567-8900",
    },
  });
  console.log("✅ Admin creado:", admin.email);

  // Create professionals
  const profData = [
    {
      name: "Lic. María González",
      email: "maria.gonzalez@ap.com.ar",
      phone: "+54 11 4567-8901",
      license: "MN-12345",
      specialty: "Psicología Clínica",
      bio: "Especialista en terapia cognitivo-conductual con más de 15 años de experiencia en ansiedad y depresión.",
    },
    {
      name: "Dr. Carlos Ramírez",
      email: "carlos.ramirez@ap.com.ar",
      phone: "+54 11 4567-8902",
      license: "MN-12346",
      specialty: "Terapia de Pareja y Familia",
      bio: "Experto en sistémica familiar y terapia de pareja con enfoque integrativo.",
    },
    {
      name: "Lic. Laura Martínez",
      email: "laura.martinez@ap.com.ar",
      phone: "+54 11 4567-8903",
      license: "MN-12347",
      specialty: "Psicología Infanto-Juvenil",
      bio: "Especialista en niños y adolescentes con formación en play therapy y neurodesarrollo.",
    },
    {
      name: "Lic. Roberto Fernández",
      email: "roberto.fernandez@ap.com.ar",
      phone: "+54 11 4567-8904",
      license: "MN-12348",
      specialty: "Psicología Clínica",
      bio: "Amplia experiencia en crisis vitales, duelo y acompañamiento en procesos de cambio.",
    },
  ];

  const professionals = [];
  for (const p of profData) {
    const user = await db.user.create({
      data: {
        name: p.name,
        email: p.email,
        password: "prof123",
        role: "professional",
        phone: p.phone,
      },
    });

    const professional = await db.professional.create({
      data: {
        userId: user.id,
        license: p.license,
        specialty: p.specialty,
        bio: p.bio,
        available: true,
      },
    });
    professionals.push(professional);
    console.log("✅ Profesional creado:", p.name);
  }

  // Create sample patients
  const patientData = [
    { name: "Ana López", email: "ana.lopez@email.com", phone: "+54 11 5555-0001" },
    { name: "Pedro Sánchez", email: "pedro.sanchez@email.com", phone: "+54 11 5555-0002" },
    { name: "Lucía Torres", email: "lucia.torres@email.com", phone: "+54 11 5555-0003" },
    { name: "Martín Díaz", email: "martin.diaz@email.com", phone: "+54 11 5555-0004" },
    { name: "Valentina Ruiz", email: "valentina.ruiz@email.com", phone: "+54 11 5555-0005" },
  ];

  const patients = [];
  for (const p of patientData) {
    const user = await db.user.create({
      data: {
        name: p.name,
        email: p.email,
        password: "patient123",
        role: "patient",
        phone: p.phone,
      },
    });

    const patient = await db.patient.create({
      data: {
        userId: user.id,
      },
    });
    patients.push(patient);
    console.log("✅ Paciente creado:", p.name);
  }

  // Create sample appointments
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(dayAfter.getDate() + 2);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const appointments = [
    {
      patientId: patients[0].id,
      professionalId: professionals[0].id,
      date: today.toISOString().split("T")[0],
      time: "10:00",
      status: "confirmed",
      reason: "Seguimiento ansiedad",
    },
    {
      patientId: patients[1].id,
      professionalId: professionals[0].id,
      date: today.toISOString().split("T")[0],
      time: "11:00",
      status: "pending",
      reason: "Primera consulta",
    },
    {
      patientId: patients[2].id,
      professionalId: professionals[1].id,
      date: today.toISOString().split("T")[0],
      time: "14:00",
      status: "confirmed",
      reason: "Terapia de pareja",
    },
    {
      patientId: patients[3].id,
      professionalId: professionals[2].id,
      date: today.toISOString().split("T")[0],
      time: "09:30",
      status: "completed",
      reason: "Evaluación inicial niño",
    },
    {
      patientId: patients[4].id,
      professionalId: professionals[3].id,
      date: tomorrow.toISOString().split("T")[0],
      time: "10:00",
      status: "pending",
      reason: "Crisis vital",
    },
    {
      patientId: patients[0].id,
      professionalId: professionals[1].id,
      date: tomorrow.toISOString().split("T")[0],
      time: "15:00",
      status: "pending",
      reason: "Problemas familiares",
    },
    {
      patientId: patients[1].id,
      professionalId: professionals[2].id,
      date: dayAfter.toISOString().split("T")[0],
      time: "11:30",
      status: "pending",
      reason: "Dificultades escolares",
    },
    {
      patientId: patients[2].id,
      professionalId: professionals[0].id,
      date: yesterday.toISOString().split("T")[0],
      time: "16:00",
      status: "completed",
      reason: "Sesión regular",
    },
    {
      patientId: patients[3].id,
      professionalId: professionals[3].id,
      date: yesterday.toISOString().split("T")[0],
      time: "09:00",
      status: "cancelled",
      reason: "Problemas de duelo",
    },
  ];

  for (const apt of appointments) {
    await db.appointment.create({ data: apt });
  }
  console.log("✅ Turnos de ejemplo creados");

  // Create sample contact requests
  const contacts = [
    {
      name: "Gabriela Muñoz",
      email: "gabriela.m@email.com",
      phone: "+54 11 6666-0001",
      message: "Me gustaría obtener información sobre los servicios de terapia familiar.",
      reason: "informacion",
    },
    {
      name: "Jorge Herrera",
      email: "jorge.h@email.com",
      message: "Necesito un turno para mi hija de 12 años que está teniendo problemas en el colegio.",
      reason: "solicitar_turno",
    },
    {
      name: "Silvia Vega",
      email: "silvia.v@email.com",
      phone: "+54 11 6666-0003",
      message: "¿Tienen atención por obra social? ¿Cuáles reciben?",
      reason: "consulta_general",
    },
  ];

  for (const c of contacts) {
    await db.contactRequest.create({ data: c });
  }
  console.log("✅ Consultas de contacto creadas");

  console.log("🎉 Seed completado exitosamente!");
  console.log("\n📋 Credenciales de acceso:");
  console.log("  Admin: admin@ap.com.ar / admin123");
  console.log("  Profesional: maria.gonzalez@ap.com.ar / prof123");
  console.log("  Paciente: ana.lopez@email.com / patient123");
}

seed()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
