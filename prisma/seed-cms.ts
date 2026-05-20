import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding CMS data...');

  // ===== Hero Slides =====
  const heroSlides = [
    {
      badge: "MÁS DE 30 AÑOS DE EXPERIENCIA",
      title: "Red Escucha Psicológica",
      description: "Más de tres décadas acompañando tu bienestar. Nuestro equipo de profesionales está aquí para escucharte y ayudarte a transitar los momentos difíciles con respeto y profesionalismo.",
      cta: "Contactanos",
      secondaryCta: "Conocer Especialidades",
      imageUrl: "/images/carousel/nature.png",
      order: 0,
      active: true,
    },
    {
      badge: "TERAPIA INDIVIDUAL Y VINCULAR",
      title: "Un espacio seguro para vos",
      description: "Ofrecemos terapia individual, de pareja, familiar y grupal con profesionales especializados. Cada proceso es único, nos importan tus tiempos, necesidades y confidencialidad.",
      cta: "Conocer Especialidades",
      secondaryCta: "Contactanos",
      imageUrl: "/images/carousel/families.png",
      order: 1,
      active: true,
    },
    {
      badge: "SIN LISTAS DE ESPERA",
      title: "Turnos en menos de 48hs",
      description: "Accedé a la atención que necesitás sin esperas innecesarias. Nuestra plataforma te permite solicitar un turno de forma rápida y simple desde cualquier dispositivo.",
      cta: "Contactanos",
      secondaryCta: "Cómo Funciona",
      imageUrl: "/images/carousel/jovenes.png",
      order: 2,
      active: true,
    },
    {
      badge: "CONFIDENCIALIDAD GARANTIZADA",
      title: "Tu privacidad, nuestra prioridad",
      description: "El secreto profesional es el pilar de nuestra práctica. Garantizamos un espacio donde podés expresarte libremente, sabiendo que tu privacidad está protegida en todo momento.",
      cta: "Contactanos",
      secondaryCta: "Conocer Especialidades",
      imageUrl: "/images/carousel/ninos.png",
      order: 3,
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
  console.log(`✅ ${heroSlides.length} hero slides seeded`);

  // ===== Specialty Tabs =====
  const tabs = [
    { id: "tab-individual", label: "Individual", order: 0, active: true },
    { id: "tab-vincular", label: "Vínculos", order: 1, active: true },
    { id: "tab-infanto", label: "Infanto-Juvenil", order: 2, active: true },
  ];

  for (const tab of tabs) {
    await prisma.cmsSpecialtyTab.upsert({
      where: { id: tab.id },
      update: tab,
      create: tab,
    });
  }
  console.log(`✅ ${tabs.length} specialty tabs seeded`);

  // ===== Specialties =====
  const specialties = [
    { id: "spec-0", icon: "Brain", label: "Ansiedad y Estrés", description: "Técnicas de manejo y afrontamiento para recuperar la calma", tabId: "tab-individual", order: 0, active: true },
    { id: "spec-1", icon: "Heart", label: "Depresión", description: "Acompañamiento y terapia integral para transitar el dolor", tabId: "tab-individual", order: 1, active: true },
    { id: "spec-2", icon: "Sparkles", label: "Crisis Vitales", description: "Soporte profesional en momentos de transformación", tabId: "tab-individual", order: 2, active: true },
    { id: "spec-3", icon: "HeartHandshake", label: "Conflictos Vinculares", description: "Mejora de relaciones interpersonales y comunicación", tabId: "tab-vincular", order: 0, active: true },
    { id: "spec-4", icon: "Baby", label: "Niños", description: "Psicología infanto-juvenil con abordaje lúdico", tabId: "tab-infanto", order: 0, active: true },
    { id: "spec-5", icon: "UserCheck", label: "Adolescentes", description: "Acompañamiento respetuoso en la adolescencia", tabId: "tab-infanto", order: 1, active: true },
    { id: "spec-6", icon: "Users", label: "Adultos", description: "Terapia individual para adultos en todas las etapas", tabId: "tab-individual", order: 3, active: true },
    { id: "spec-7", icon: "HeartHandshake", label: "Parejas", description: "Terapia vincular y de pareja para reconstruir vínculos", tabId: "tab-vincular", order: 1, active: true },
    { id: "spec-8", icon: "Shield", label: "Familias", description: "Terapia familiar sistémica para armonizar el hogar", tabId: "tab-vincular", order: 2, active: true },
  ];

  for (const spec of specialties) {
    await prisma.cmsSpecialty.upsert({
      where: { id: spec.id },
      update: spec,
      create: spec,
    });
  }
  console.log(`✅ ${specialties.length} specialties seeded`);

  // ===== Philosophy =====
  const philosophies = [
    { id: "phil-0", icon: "HandHeart", title: "Acompañamiento", description: "Cada persona es única. Nuestros profesionales diseñan un abordaje personalizado, respetando tus tiempos y necesidades para que el proceso terapéutico sea significativo y transformador.", order: 0, active: true },
    { id: "phil-1", icon: "Shield", title: "Confidencialidad", description: "El secreto profesional es el pilar de nuestra práctica. Garantizamos un espacio seguro donde podés expresarte libremente, sabiendo que tu privacidad está protegida en todo momento.", order: 1, active: true },
    { id: "phil-2", icon: "BookOpen", title: "Profesionalismo", description: "Nuestro equipo se forma continuamente en las corrientes más reconocidas de la psicología, asegurando una atención de calidad basada en evidencia y buenas prácticas clínicas.", order: 2, active: true },
  ];

  for (const phil of philosophies) {
    await prisma.cmsPhilosophy.upsert({
      where: { id: phil.id },
      update: phil,
      create: phil,
    });
  }
  console.log(`✅ ${philosophies.length} philosophy items seeded`);

  // ===== Steps =====
  const steps = [
    { id: "step-0", icon: "CalendarPlus", title: "Solicitá tu turno", description: "Completá el registro y elegí el profesional y horario que mejor se ajuste a tus necesidades.", order: 0, active: true },
    { id: "step-1", icon: "MessageCircle", title: "Primer contacto", description: "El profesional se pondrá en contacto con vos para coordinar los detalles de la primera sesión.", order: 1, active: true },
    { id: "step-2", icon: "Heart", title: "Comenzá tu proceso", description: "Iniciá tu recorrido terapéutico en un espacio seguro, confidencial y profesional.", order: 2, active: true },
    { id: "step-3", icon: "Leaf", title: "Acompañamiento", description: "Recibí seguimiento continuo y personalizá tu tratamiento según tu evolución.", order: 3, active: true },
  ];

  for (const step of steps) {
    await prisma.cmsStep.upsert({
      where: { id: step.id },
      update: step,
      create: step,
    });
  }
  console.log(`✅ ${steps.length} steps seeded`);

  // ===== Stats =====
  const stats = [
    { id: "stat-0", value: "30+", label: "Años de experiencia", order: 0, active: true },
    { id: "stat-1", value: "50+", label: "Profesionales", order: 1, active: true },
    { id: "stat-2", value: "15+", label: "Especialidades", order: 2, active: true },
    { id: "stat-3", value: "0", label: "Listas de espera", order: 3, active: true },
  ];

  for (const stat of stats) {
    await prisma.cmsStat.upsert({
      where: { id: stat.id },
      update: stat,
      create: stat,
    });
  }
  console.log(`✅ ${stats.length} stats seeded`);

  // ===== Testimonials =====
  const testimonials = [
    { id: "test-0", text: "Encontré en Red Escucha Psicológica un espacio seguro donde puedo hablar sin ser juzgada. Mi terapeuta me ayudó a entender mis emociones y a construir herramientas para el día a día.", name: "M.L.", role: "Paciente", order: 0, active: true },
    { id: "test-1", text: "Después de años evitando buscar ayuda, el proceso de registro fue tan simple que me animé a dar el paso. Fue la mejor decisión que tomé para mi bienestar.", name: "R.G.", role: "Paciente", order: 1, active: true },
    { id: "test-2", text: "Como profesional, la plataforma me permite gestionar mi agenda de forma eficiente y concentrarme en lo que más importa: mis pacientes.", name: "Dra. S.R.", role: "Psicóloga", order: 2, active: true },
  ];

  for (const test of testimonials) {
    await prisma.cmsTestimonial.upsert({
      where: { id: test.id },
      update: test,
      create: test,
    });
  }
  console.log(`✅ ${testimonials.length} testimonials seeded`);

  // ===== Site Config =====
  const configs = [
    // General
    { key: "site_name", value: "Red Escucha Psicológica", group: "general" },
    { key: "site_description", value: "Más de tres décadas acompañando tu bienestar emocional", group: "general" },
    // Contact
    { key: "contact_address", value: "Av. Sanabria 1616, CABA, Buenos Aires, Argentina", group: "contact" },
    { key: "contact_phone", value: "+54 11 7668-3429", group: "contact" },
    { key: "contact_email", value: "contacto@redescuchapsicologica.com", group: "contact" },
    { key: "contact_hours_weekday", value: "Lunes a Viernes: 9:00 - 20:00", group: "contact" },
    { key: "contact_hours_saturday", value: "Sábados: 9:00 - 13:00", group: "contact" },
    // WhatsApp
    { key: "whatsapp_number", value: "5491176683429", group: "whatsapp" },
    { key: "whatsapp_message", value: "Hola, me gustaría obtener más información sobre los servicios de Red Escucha Psicológica", group: "whatsapp" },
    { key: "whatsapp_enabled", value: "true", group: "whatsapp" },
    // Sections
    { key: "philosophy_title", value: "Nuestra Filosofía", group: "sections" },
    { key: "philosophy_description", value: "En REP creemos que cada persona merece un espacio de escucha genuina. Desde hace más de 30 años, acompañamos a quienes buscan bienestar emocional con un enfoque humano, ético y profesional.", group: "sections" },
    { key: "specialties_title", value: "Nuestras Especialidades", group: "sections" },
    { key: "specialties_description", value: "Brindamos terapia individual, de pareja, familiar y grupal con profesionales altamente especializados. Entendemos que cada proceso es único, por eso respetamos tus tiempos, atendemos tus necesidades y garantizamos absoluta confidencialidad en cada acompañamiento.", group: "sections" },
    { key: "how_it_works_title", value: "¿Cómo Funciona?", group: "sections" },
    { key: "how_it_works_description", value: "Un proceso simple y respetuoso para que puedas acceder a la atención que necesitás.", group: "sections" },
    { key: "testimonials_enabled", value: "false", group: "sections" },
    { key: "testimonials_title", value: "Lo que Dicen de Nosotros", group: "sections" },
    { key: "cta_title", value: "¿Necesitás hablar con alguien?", group: "sections" },
    { key: "cta_description", value: "No estás solo/a. Nuestro equipo de profesionales está listo para acompañarte. Sin listas de espera, con turnos disponibles.", group: "sections" },
    { key: "contact_title", value: "Contactanos", group: "sections" },
    { key: "contact_description", value: "Completá el formulario y nos comunicaremos con vos a la brevedad.", group: "sections" },
  ];

  for (const config of configs) {
    await prisma.cmsSiteConfig.upsert({
      where: { key: config.key },
      update: config,
      create: config,
    });
  }
  console.log(`✅ ${configs.length} site configs seeded`);

  console.log('\n🎉 CMS seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding CMS:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
