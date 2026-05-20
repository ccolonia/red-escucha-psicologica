const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding CMS data...');

  // ─── Hero Slides ─────────────────────────────────────────────
  const heroSlides = [
    {
      badge: 'Psicología Online',
      title: 'Tu espacio de escucha',
      description: 'Profesionales de la salud mental acompañándote en cada paso del camino.',
      cta: 'Agendar sesión',
      secondaryCta: 'Conocer más',
      imageUrl: '/images/hero-1.jpg',
      order: 0,
      active: true,
    },
    {
      badge: 'Atención personalizada',
      title: 'Escucha profesional y humana',
      description: 'Encontrá el acompañamiento que necesitás con profesionales matriculados.',
      cta: 'Solicitar turno',
      secondaryCta: '',
      imageUrl: '/images/hero-2.jpg',
      order: 1,
      active: true,
    },
  ];

  for (const slide of heroSlides) {
    await prisma.cmsHeroSlide.upsert({
      where: { id: `hero-${slide.order}` },
      update: slide,
      create: { id: `hero-${slide.order}`, ...slide },
    });
  }
  console.log('✅ Hero slides seeded');

  // ─── Specialty Tabs ──────────────────────────────────────────
  const tabs = [
    { id: 'tab-adultos', label: 'Adultos', order: 0, active: true },
    { id: 'tab-parejas', label: 'Parejas y Familia', order: 1, active: true },
    { id: 'tab-infanto', label: 'Infanto-Juvenil', order: 2, active: true },
  ];

  for (const tab of tabs) {
    await prisma.cmsSpecialtyTab.upsert({
      where: { id: tab.id },
      update: tab,
      create: tab,
    });
  }
  console.log('✅ Specialty tabs seeded');

  // ─── Specialties ────────────────────────────────────────────
  const specialties = [
    { id: 'spec-1', icon: 'Brain', label: 'Psicología Clínica', description: 'Tratamiento de trastornos emocionales, ansiedad, depresión y estrés.', tabId: 'tab-adultos', order: 0, active: true },
    { id: 'spec-2', icon: 'HeartHandshake', label: 'Terapia de Duelo', description: 'Acompañamiento en procesos de pérdida y elaboración del duelo.', tabId: 'tab-adultos', order: 1, active: true },
    { id: 'spec-3', icon: 'Shield', label: 'Trauma y EMDR', description: 'Tratamiento especializado para trauma con técnicas basadas en evidencia.', tabId: 'tab-adultos', order: 2, active: true },
    { id: 'spec-4', icon: 'Heart', label: 'Terapia de Pareja', description: 'Mediación y acompañamiento para conflictos de pareja y familia.', tabId: 'tab-parejas', order: 0, active: true },
    { id: 'spec-5', icon: 'Users', label: 'Terapia Familiar', description: 'Intervención sistémica para dinámicas familiares complejas.', tabId: 'tab-parejas', order: 1, active: true },
    { id: 'spec-6', icon: 'Baby', label: 'Psicología Infantil', description: 'Evaluación y tratamiento para niños con dificultades emocionales o conductuales.', tabId: 'tab-infanto', order: 0, active: true },
    { id: 'spec-7', icon: 'UserCheck', label: 'Adolescentes', description: 'Espacio de escucha y contención para adolescentes.', tabId: 'tab-infanto', order: 1, active: true },
  ];

  for (const spec of specialties) {
    await prisma.cmsSpecialty.upsert({
      where: { id: spec.id },
      update: spec,
      create: spec,
    });
  }
  console.log('✅ Specialties seeded');

  // ─── Philosophy ─────────────────────────────────────────────
  const philosophy = [
    { id: 'phil-1', icon: 'Heart', title: 'Empatía', description: 'Escuchamos sin juzgar, acompañamos con respeto y calidez humana.', order: 0, active: true },
    { id: 'phil-2', icon: 'Shield', title: 'Profesionalidad', description: 'Todos nuestros profesionales están matriculados y en formación continua.', order: 1, active: true },
    { id: 'phil-3', icon: 'Sparkles', title: 'Accesibilidad', description: 'Psicología accesible para quien la necesita, sin barreras innecesarias.', order: 2, active: true },
  ];

  for (const item of philosophy) {
    await prisma.cmsPhilosophy.upsert({
      where: { id: item.id },
      update: item,
      create: item,
    });
  }
  console.log('✅ Philosophy seeded');

  // ─── Steps ──────────────────────────────────────────────────
  const steps = [
    { id: 'step-1', icon: 'CalendarPlus', title: 'Solicitá tu turno', description: 'Completá el formulario con tus datos y preferencias de horario.', order: 0, active: true },
    { id: 'step-2', icon: 'UserCheck', title: 'Te asignamos un profesional', description: 'Te contactamos para confirmar la sesión con el profesional adecuado.', order: 1, active: true },
    { id: 'step-3', icon: 'MessageCircle', title: 'Comenzá tu proceso', description: 'Asistí a tu primera sesión y comenzá tu camino de bienestar.', order: 2, active: true },
  ];

  for (const item of steps) {
    await prisma.cmsStep.upsert({
      where: { id: item.id },
      update: item,
      create: item,
    });
  }
  console.log('✅ Steps seeded');

  // ─── Stats ──────────────────────────────────────────────────
  const stats = [
    { id: 'stat-1', value: '+500', label: 'Pacientes acompañados', order: 0, active: true },
    { id: 'stat-2', value: '+30', label: 'Profesionales', order: 1, active: true },
    { id: 'stat-3', value: '+1000', label: 'Sesiones realizadas', order: 2, active: true },
    { id: 'stat-4', value: '98%', label: 'Satisfacción', order: 3, active: true },
  ];

  for (const item of stats) {
    await prisma.cmsStat.upsert({
      where: { id: item.id },
      update: item,
      create: item,
    });
  }
  console.log('✅ Stats seeded');

  // ─── Testimonials ───────────────────────────────────────────
  const testimonials = [
    { id: 'test-1', text: 'Encontré un espacio seguro donde puedo expresarme libremente. El acompañamiento fue fundamental en mi proceso.', name: 'María G.', role: 'Paciente', order: 0, active: true },
    { id: 'test-2', text: 'La atención fue excelente desde el primer contacto. Me sentí escuchada y contenida en todo momento.', name: 'Carolina L.', role: 'Paciente', order: 1, active: true },
    { id: 'test-3', text: 'Gracias a la red pude acceder a terapia cuando más lo necesitaba. Profesionales comprometidos y humanos.', name: 'Andrés M.', role: 'Paciente', order: 2, active: true },
  ];

  for (const item of testimonials) {
    await prisma.cmsTestimonial.upsert({
      where: { id: item.id },
      update: item,
      create: item,
    });
  }
  console.log('✅ Testimonials seeded');

  // ─── Site Config ────────────────────────────────────────────
  const configs = [
    { id: 'cfg-1', key: 'site_name', value: 'Red Escucha Psicológica', group: 'general' },
    { id: 'cfg-2', key: 'site_description', value: 'Red de profesionales de la salud mental', group: 'general' },
    { id: 'cfg-3', key: 'contact_email', value: 'info@redescuchapsicologica.com', group: 'contact' },
    { id: 'cfg-4', key: 'contact_email_secondary', value: 'redescuchapsicologica@gmail.com', group: 'contact' },
    { id: 'cfg-5', key: 'whatsapp_number', value: '5491130880380', group: 'whatsapp' },
    { id: 'cfg-6', key: 'whatsapp_message', value: 'Hola, me gustaría obtener más información', group: 'whatsapp' },
    { id: 'cfg-7', key: 'show_hero', value: 'true', group: 'sections' },
    { id: 'cfg-8', key: 'show_specialties', value: 'true', group: 'sections' },
    { id: 'cfg-9', key: 'show_philosophy', value: 'true', group: 'sections' },
    { id: 'cfg-10', key: 'show_steps', value: 'true', group: 'sections' },
    { id: 'cfg-11', key: 'show_stats', value: 'true', group: 'sections' },
    { id: 'cfg-12', key: 'show_testimonials', value: 'true', group: 'sections' },
  ];

  for (const item of configs) {
    await prisma.cmsSiteConfig.upsert({
      where: { key: item.key },
      update: { value: item.value, group: item.group },
      create: item,
    });
  }
  console.log('✅ Site config seeded');

  console.log('\n🎉 CMS seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
