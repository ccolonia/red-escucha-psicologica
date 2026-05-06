"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Shield,
  Users,
  Clock,
  Brain,
  Baby,
  UserCheck,
  HeartHandshake,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Send,
  CheckCircle2,
  Leaf,
  ArrowRight,
  Menu,
  X,
  CalendarPlus,
  HandHeart,
  BookOpen,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/lib/store";

const specialties = [
  { icon: Brain, label: "Ansiedad y Estrés", desc: "Técnicas de manejo y afrontamiento para recuperar la calma" },
  { icon: Heart, label: "Depresión", desc: "Acompañamiento y terapia integral para transitar el dolor" },
  { icon: Sparkles, label: "Crisis Vitales", desc: "Soporte profesional en momentos de transformación" },
  { icon: HeartHandshake, label: "Conflictos Vinculares", desc: "Mejora de relaciones interpersonales y comunicación" },
  { icon: Baby, label: "Niños", desc: "Psicología infanto-juvenil con abordaje lúdico" },
  { icon: UserCheck, label: "Adolescentes", desc: "Acompañamiento respetuoso en la adolescencia" },
  { icon: Users, label: "Adultos", desc: "Terapia individual para adultos en todas las etapas" },
  { icon: HeartHandshake, label: "Parejas", desc: "Terapia vincular y de pareja para reconstruir vínculos" },
  { icon: Shield, label: "Familias", desc: "Terapia familiar sistémica para armonizar el hogar" },
];

const specialtyTabs = [
  { id: "individual", label: "Individual", items: [0, 1, 2, 6] },
  { id: "vincular", label: "Vínculos", items: [3, 7, 8] },
  { id: "infanto", label: "Infanto-Juvenil", items: [4, 5] },
];

const testimonials = [
  {
    text: "Encontré en Red Escucha Psicológica un espacio seguro donde puedo hablar sin ser juzgada. Mi terapeuta me ayudó a entender mis emociones y a construir herramientas para el día a día.",
    name: "M.L.",
    role: "Paciente",
  },
  {
    text: "Después de años evitando buscar ayuda, el proceso de registro fue tan simple que me animé a dar el paso. Fue la mejor decisión que tomé para mi bienestar.",
    name: "R.G.",
    role: "Paciente",
  },
  {
    text: "Como profesional, la plataforma me permite gestionar mi agenda de forma eficiente y concentrarme en lo que más importa: mis pacientes.",
    name: "Dra. S.R.",
    role: "Psicóloga",
  },
];

const heroSlides = [
  {
    badge: "MÁS DE 30 AÑOS DE EXPERIENCIA",
    title: <>Red Escucha <span className="text-sage-300">Psicológica</span></>,
    description: "Más de tres décadas acompañando tu bienestar. Nuestro equipo de profesionales está aquí para escucharte y ayudarte a transitar los momentos difíciles con respeto y profesionalismo.",
    cta: "Contactanos",
    ctaIcon: Phone,
    secondaryCta: "Conocer Especialidades",
    secondaryIcon: ArrowRight,
    image: "/images/carousel/nature.png",
  },
  {
    badge: "TERAPIA INDIVIDUAL Y VINCULAR",
    title: <>Un espacio seguro <span className="text-sage-300">para vos</span></>,
    description: "Ofrecemos terapia individual, de pareja, familiar y grupal con profesionales especializados. Cada proceso es único, nos importan tus tiempos, necesidades y confidencialidad.",
    cta: "Conocer Especialidades",
    ctaIcon: ArrowRight,
    secondaryCta: "Contactanos",
    secondaryIcon: Phone,
    image: "/images/carousel/families.png",
  },
  {
    badge: "SIN LISTAS DE ESPERA",
    title: <>Turnos en <span className="text-sage-300">menos de 48hs</span></>,
    description: "Accedé a la atención que necesitás sin esperas innecesarias. Nuestra plataforma te permite solicitar un turno de forma rápida y simple desde cualquier dispositivo.",
    cta: "Contactanos",
    ctaIcon: Phone,
    secondaryCta: "Cómo Funciona",
    secondaryIcon: MessageCircle,
    image: "/images/carousel/jovenes.png",
  },
  {
    badge: "CONFIDENCIALIDAD GARANTIZADA",
    title: <>Tu privacidad, <span className="text-sage-300">nuestra prioridad</span></>,
    description: "El secreto profesional es el pilar de nuestra práctica. Garantizamos un espacio donde podés expresarte libremente, sabiendo que tu privacidad está protegida en todo momento.",
    cta: "Contactanos",
    ctaIcon: Phone,
    secondaryCta: "Conocer Especialidades",
    secondaryIcon: ArrowRight,
    image: "/images/carousel/ninos.png",
  },
];

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 },
};

export function LandingPage() {
  const { setCurrentView } = useAppStore();
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
    reason: "",
  });
  const [contactSent, setContactSent] = useState(false);
  const [contactSending, setContactSending] = useState(false);
  const [contactError, setContactError] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("individual");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-advance carousel
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isPaused]);

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(index);
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactSending(true);
    setContactError(false);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      });
      if (res.ok) {
        setContactSent(true);
        setContactForm({ name: "", email: "", phone: "", message: "", reason: "" });
        setTimeout(() => setContactSent(false), 4000);
      } else {
        setContactError(true);
      }
    } catch {
      setContactError(true);
    } finally {
      setContactSending(false);
    }
  };

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-beige-100">
      {/* ===== NAVBAR ===== */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-forest-900/60 backdrop-blur-xl"
            : "bg-forest-900/15 backdrop-blur-sm"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-18">
            {/* Logo */}
            <img
              src="/images/logo.png"
              alt="Red Escucha Psicológica"
              className="h-12 sm:h-14 w-auto object-contain"
            />

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-8">
              <button
                onClick={() => scrollToSection("inicio")}
                className="text-sm text-beige-100 hover:text-sage-300 transition-colors font-light tracking-wide" style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                Inicio
              </button>
              <button
                onClick={() => scrollToSection("nosotros")}
                className="text-sm text-beige-100 hover:text-sage-300 transition-colors font-light tracking-wide" style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                Nosotros
              </button>
              <button
                onClick={() => scrollToSection("especialidades")}
                className="text-sm text-beige-100 hover:text-sage-300 transition-colors font-light tracking-wide" style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                Especialidades
              </button>
              <button
                onClick={() => scrollToSection("contacto")}
                className="text-sm text-beige-100 hover:text-sage-300 transition-colors font-light tracking-wide" style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                Contacto
              </button>
              <button
                onClick={() => setCurrentView("login")}
                className="text-sm text-beige-100 hover:text-sage-300 transition-colors font-light tracking-wide" style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                Ingresar
              </button>
              {/* Botón "Solicitar Turno" deshabilitado temporalmente */}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2.5 text-beige-50 active:bg-white/10 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            mobileMenuOpen ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
          }`}
          style={{ pointerEvents: mobileMenuOpen ? "auto" : "none" }}
        >
          <div className="bg-forest-900/80 backdrop-blur-xl border-t border-beige-50/10 px-4 py-4 space-y-1">
            <button
              onClick={() => scrollToSection("inicio")}
              className="w-full text-left px-4 py-3 text-beige-100 hover:text-sage-300 hover:bg-white/5 rounded-lg transition-colors text-base min-h-[44px] flex items-center" style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              Inicio
            </button>
            <button
              onClick={() => scrollToSection("nosotros")}
              className="w-full text-left px-4 py-3 text-beige-100 hover:text-sage-300 hover:bg-white/5 rounded-lg transition-colors text-base min-h-[44px] flex items-center" style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              Nosotros
            </button>
            <button
              onClick={() => scrollToSection("especialidades")}
              className="w-full text-left px-4 py-3 text-beige-100 hover:text-sage-300 hover:bg-white/5 rounded-lg transition-colors text-base min-h-[44px] flex items-center" style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              Especialidades
            </button>
            <button
              onClick={() => scrollToSection("contacto")}
              className="w-full text-left px-4 py-3 text-beige-100 hover:text-sage-300 hover:bg-white/5 rounded-lg transition-colors text-base min-h-[44px] flex items-center" style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              Contacto
            </button>
            <div className="pt-2 space-y-2">
              <button
                onClick={() => { setMobileMenuOpen(false); setCurrentView("login"); }}
                className="w-full text-left px-4 py-3 text-beige-100 hover:text-sage-300 hover:bg-white/5 rounded-lg transition-colors text-base min-h-[44px] flex items-center" style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                Ingresar
              </button>
              {/* Botón "Solicitar Turno" deshabilitado temporalmente */}
            </div>
            {/* Mobile: Professional network CTA */}
            <div className="mt-4 pt-4 border-t border-beige-50/10 flex flex-col items-center text-center">
              <p className="text-beige-100 text-sm font-light leading-relaxed mb-3 tracking-wide" style={{ fontFamily: "Montserrat, sans-serif" }}>
                Querés formar parte de nuestra red de profesionales?
              </p>
              <Button
                onClick={() => { setMobileMenuOpen(false); setCurrentView("professional-register"); }}
                className="btn-sage text-forest-900 font-semibold text-sm px-6 h-9 rounded-full" style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                Pulsar aquí
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* ===== HERO CAROUSEL WITH BACKGROUND IMAGES ===== */}
      <section
        id="inicio"
        className="relative min-h-screen flex items-center overflow-hidden"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Background image - changes per slide */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${heroSlides[currentSlide].image})` }}
            />
          </motion.div>
        </AnimatePresence>

        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 hero-overlay" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-40 w-full">
          <div className="flex flex-col lg:flex-row lg:items-start lg:gap-12">
          {/* Left column - Hero content */}
          <div className="max-w-3xl flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.5 }}
              >
                {/* Badge */}
                <div className="inline-flex items-center gap-2 border border-sage-300/40 text-sage-200 px-4 py-1.5 rounded-full text-sm font-light mb-8 tracking-wider" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  <Leaf className="w-4 h-4" />
                  {heroSlides[currentSlide].badge}
                </div>

                {/* Title */}
                <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-serif font-bold text-beige-50 leading-tight">
                  {heroSlides[currentSlide].title}
                </h1>

                {/* Description */}
                <p className="mt-6 text-lg sm:text-xl text-beige-200/90 leading-relaxed max-w-xl font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  {heroSlides[currentSlide].description}
                </p>

                {/* CTAs */}
                <div className="mt-10 flex flex-col sm:flex-row gap-4">
                  <Button
                    size="lg"
                    onClick={() => {
                      const cta = heroSlides[currentSlide].cta;
                      if (cta === "Conocer Especialidades") {
                        scrollToSection("especialidades");
                      } else if (cta === "Contactanos") {
                        scrollToSection("contacto");
                      }
                    }}
                    className="btn-sage text-forest-900 font-semibold text-base px-8 h-12 rounded-full" style={{ fontFamily: "Montserrat, sans-serif" }}
                  >
                    {heroSlides[currentSlide].cta === "Contactanos" && <Phone className="mr-2 w-5 h-5" />}
                    {heroSlides[currentSlide].cta === "Conocer Especialidades" && <ArrowRight className="mr-2 w-5 h-5" />}
                    {heroSlides[currentSlide].cta}
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => {
                      const sCta = heroSlides[currentSlide].secondaryCta;
                      if (sCta === "Cómo Funciona") {
                        scrollToSection("inicio");
                      } else if (sCta === "Conocer Especialidades") {
                        scrollToSection("especialidades");
                      } else {
                        scrollToSection("contacto");
                      }
                    }}
                    className="border-beige-200/30 text-beige-100 hover:bg-beige-50/10 text-base px-8 h-12 rounded-full bg-transparent" style={{ fontFamily: "Montserrat, sans-serif" }}
                  >
                    {heroSlides[currentSlide].secondaryCta === "Conocer Especialidades" && <ArrowRight className="mr-2 w-5 h-5" />}
                    {heroSlides[currentSlide].secondaryCta === "Contactanos" && <Phone className="mr-2 w-5 h-5" />}
                    {heroSlides[currentSlide].secondaryCta}
                  </Button>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Carousel controls */}
            <div className="mt-14 flex items-center gap-6">
              {/* Dots */}
              <div className="flex items-center gap-2.5">
                {heroSlides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goToSlide(i)}
                    className={`transition-all duration-300 rounded-full ${
                      i === currentSlide
                        ? "w-8 h-2.5 bg-sage-300"
                        : "w-2.5 h-2.5 bg-beige-200/30 hover:bg-beige-200/50"
                    }`}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>

              {/* Divider */}
              <div className="w-px h-6 bg-beige-200/20" />

              {/* Arrows */}
              <div className="flex items-center gap-2">
                <button
                  onClick={prevSlide}
                  className="w-9 h-9 rounded-full border border-beige-200/20 flex items-center justify-center text-beige-200/60 hover:text-sage-300 hover:border-sage-300/40 transition-colors"
                  aria-label="Slide anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={nextSlide}
                  className="w-9 h-9 rounded-full border border-beige-200/20 flex items-center justify-center text-beige-200/60 hover:text-sage-300 hover:border-sage-300/40 transition-colors"
                  aria-label="Siguiente slide"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Divider */}
              <div className="w-px h-6 bg-beige-200/20" />

              {/* Trust badges */}
              <div className="hidden sm:flex items-center gap-4">
                <div className="flex items-center gap-2 text-sage-300">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-medium text-beige-100" style={{ fontFamily: "Montserrat, sans-serif" }}>Sin listas de espera</span>
                </div>
                <div className="w-px h-4 bg-beige-200/30" />
                <div className="flex items-center gap-2 text-sage-300">
                  <Clock className="w-5 h-5" />
                  <span className="text-sm font-medium text-beige-100" style={{ fontFamily: "Montserrat, sans-serif" }}>Turnos en menos de 48hs</span>
                </div>
              </div>
            </div>

            {/* Mobile trust badges */}
            <div className="sm:hidden mt-6 flex items-center gap-4">
              <div className="flex items-center gap-2 text-sage-300">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-medium text-beige-100" style={{ fontFamily: "Montserrat, sans-serif" }}>Sin listas de espera</span>
              </div>
              <div className="flex items-center gap-2 text-sage-300">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-medium text-beige-100" style={{ fontFamily: "Montserrat, sans-serif" }}>Turnos en 48hs</span>
              </div>
            </div>

            {/* Mobile: Professional network CTA in hero */}
            <motion.div
              className="lg:hidden mt-8 flex flex-col items-center text-center"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <Leaf className="w-6 h-6 text-sage-300 mb-3" />
              </motion.div>
              <p className="text-beige-100 text-base font-light leading-relaxed mb-4 tracking-wide" style={{ fontFamily: "Montserrat, sans-serif" }}>
                Querés formar parte de nuestra red de profesionales?
              </p>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  onClick={() => setCurrentView("professional-register")}
                  className="btn-sage text-forest-900 font-semibold text-sm px-6 h-10 rounded-full" style={{ fontFamily: "Montserrat, sans-serif" }}
                >
                  Pulsar aquí
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </motion.div>
            </motion.div>
          </div>

          {/* Right column - Professional network CTA */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0, y: [0, -10, 0] }}
            transition={{ opacity: { duration: 0.8, delay: 0.4 }, y: { duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 } }}
            className="hidden lg:flex flex-col items-center text-center bg-transparent border-0 rounded-2xl px-8 py-8 max-w-xs mt-0"
          >
            <motion.div
              animate={{ rotate: [0, 12, -12, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Leaf className="w-8 h-8 text-sage-300 mb-4" />
            </motion.div>
            <p className="text-beige-100 text-base font-light leading-relaxed mb-6 tracking-wide" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Querés formar parte de nuestra red de profesionales?
            </p>
            <motion.div
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                onClick={() => setCurrentView("professional-register")}
                className="btn-sage text-forest-900 font-semibold text-sm px-6 h-10 rounded-full" style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                Pulsar aquí
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </motion.div>
          </motion.div>

          </div>
        </div>
      </section>

      {/* ===== NOSOTROS / PHILOSOPHY ===== */}
      <section id="nosotros" className="paper-texture py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="sage-line max-w-xs mx-auto mb-12" />
          <motion.div
            className="text-center max-w-3xl mx-auto mb-16"
            {...fadeInUp}
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-forest-500 leading-tight">
              Nuestra Filosofía
            </h2>
            <p className="mt-6 text-forest-400 text-lg leading-relaxed font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Creemos que cada persona merece un espacio de escucha genuina.
              Desde hace más de 30 años, acompañamos a quienes buscan
              bienestar emocional con un enfoque humano, ético y profesional.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {[
              {
                icon: HandHeart,
                title: "Acompañamiento",
                desc: "Cada persona es única. Nuestros profesionales diseñan un abordaje personalizado, respetando tus tiempos y necesidades para que el proceso terapéutico sea significativo y transformador.",
              },
              {
                icon: Shield,
                title: "Confidencialidad",
                desc: "El secreto profesional es el pilar de nuestra práctica. Garantizamos un espacio seguro donde podés expresarte libremente, sabiendo que tu privacidad está protegida en todo momento.",
              },
              {
                icon: BookOpen,
                title: "Profesionalismo",
                desc: "Nuestro equipo se forma continuamente en las corrientes más reconocidas de la psicología, asegurando una atención de calidad basada en evidencia y buenas prácticas clínicas.",
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-sage-300/15 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <item.icon className="w-8 h-8 text-sage-500" />
                </div>
                <h3 className="font-serif text-xl font-semibold text-forest-500 mb-3">
                  {item.title}
                </h3>
                <p className="text-forest-400 font-light leading-relaxed" style={{ fontFamily: "Montserrat, sans-serif" }}>{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== ESPECIALIDADES ===== */}
      <section id="especialidades" className="bg-beige-50 py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="sage-line max-w-xs mx-auto mb-12" />
          <motion.div className="text-center max-w-2xl mx-auto mb-12" {...fadeInUp}>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-forest-500">
              Nuestras Especialidades
            </h2>
            <p className="mt-4 text-forest-400 text-lg font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Brindamos terapia individual, de pareja, familiar y grupal con profesionales altamente especializados. Entendemos que cada proceso es único, por eso respetamos tus tiempos, atendemos tus necesidades y garantizamos absoluta confidencialidad en cada acompañamiento.
            </p>
          </motion.div>

          {/* Tabs */}
          <div className="flex justify-center gap-2 mb-10">
            {specialtyTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                  activeTab === tab.id
                    ? "bg-forest-500 text-beige-50 shadow-md"
                    : "bg-beige-200 text-forest-600 hover:bg-beige-300"
                }`}
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
          >
            {specialtyTabs
              .find((t) => t.id === activeTab)
              ?.items.map((idx) => {
                const spec = specialties[idx];
                return (
                  <div
                    key={idx}
                    className="specialty-card bg-beige-100 rounded-xl p-6 cursor-default"
                  >
                    <div className="w-12 h-12 bg-sage-300/15 rounded-xl flex items-center justify-center mb-4">
                      <spec.icon className="w-6 h-6 text-sage-500" />
                    </div>
                    <h3 className="font-serif font-semibold text-forest-500 text-lg">
                      {spec.label}
                    </h3>
                    <p className="text-forest-400 text-sm mt-1.5 font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>{spec.desc}</p>
                  </div>
                );
              })}
          </motion.div>
        </div>
      </section>

      {/* ===== CÓMO FUNCIONA ===== */}
      <section className="bg-forest-700 py-20 sm:py-28 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-sage-300/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-earth-400/5 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="sage-line max-w-xs mx-auto mb-12" />
          <motion.div className="text-center max-w-2xl mx-auto mb-16" {...fadeInUp}>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-beige-50">
              ¿Cómo Funciona?
            </h2>
            <p className="mt-4 text-beige-200 text-lg font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Un proceso simple y respetuoso para que puedas acceder a la atención que necesitás.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                step: "01",
                icon: CalendarPlus,
                title: "Solicitá tu turno",
                desc: "Completá el registro y elegí el profesional y horario que mejor se ajuste a tus necesidades.",
              },
              {
                step: "02",
                icon: MessageCircle,
                title: "Primer contacto",
                desc: "El profesional se pondrá en contacto con vos para coordinar los detalles de la primera sesión.",
              },
              {
                step: "03",
                icon: Heart,
                title: "Comenzá tu proceso",
                desc: "Iniciá tu recorrido terapéutico en un espacio seguro, confidencial y profesional.",
              },
              {
                step: "04",
                icon: Leaf,
                title: "Acompañamiento",
                desc: "Recibí seguimiento continuo y personalizá tu tratamiento según tu evolución.",
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
                className="text-center"
              >
                <div className="text-sage-300 font-serif text-4xl font-bold mb-4">
                  {item.step}
                </div>
                <div className="w-14 h-14 bg-beige-50/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-7 h-7 text-sage-300" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-beige-50 mb-2">
                  {item.title}
                </h3>
                <p className="text-beige-200/80 text-sm font-light leading-relaxed" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== STATS BAR ===== */}
      <section className="bg-sage-300 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "30+", label: "Años de experiencia" },
              { value: "50+", label: "Profesionales" },
              { value: "15+", label: "Especialidades" },
              { value: "0", label: "Listas de espera" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <p className="text-3xl sm:text-4xl font-serif font-bold text-forest-900">{stat.value}</p>
                <p className="text-forest-700 text-sm mt-1 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIOS (deshabilitado temporalmente) ===== */}
      {false && (
      <section className="paper-texture py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="sage-line max-w-xs mx-auto mb-12" />
          <motion.div className="text-center max-w-2xl mx-auto mb-14" {...fadeInUp}>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-forest-500">
              Lo que Dicen de Nosotros
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
              >
                <Card className="bg-beige-50 border-beige-300/50 h-full">
                  <CardContent className="p-6 sm:p-8">
                    <div className="text-sage-500 text-4xl font-serif leading-none mb-4">&ldquo;</div>
                    <p className="text-forest-600 font-light leading-relaxed mb-6" style={{ fontFamily: "Montserrat, sans-serif" }}>{t.text}</p>
                    <div className="border-t border-beige-300/50 pt-4">
                      <p className="font-serif font-semibold text-forest-500">{t.name}</p>
                      <p className="text-sm text-forest-400 font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>{t.role}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ===== CTA ===== */}
      <section className="bg-forest-500 py-16 sm:py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-1/4 w-48 h-48 bg-sage-300 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-1/4 w-64 h-64 bg-earth-400 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div {...fadeInUp} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} initial={{ opacity: 0, y: 20 }}>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-beige-50">
              ¿Necesitás hablar con alguien?
            </h2>
            <p className="mt-5 text-beige-200 text-lg max-w-2xl mx-auto font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
              No estás solo/a. Nuestro equipo de profesionales está listo para
              acompañarte. Sin listas de espera, con turnos disponibles.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              {/* Botón "Solicitar Turno" deshabilitado temporalmente */}
              <Button
                size="lg"
                variant="outline"
                className="border-beige-200/30 text-beige-100 hover:bg-beige-50/10 text-base px-8 h-12 rounded-full bg-transparent" style={{ fontFamily: "Montserrat, sans-serif" }}
                onClick={() => scrollToSection("contacto")}
              >
                <Mail className="mr-2 w-5 h-5" />
                Enviar Consulta
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== CONTACT ===== */}
      <section id="contacto" className="paper-texture py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="sage-line max-w-xs mx-auto mb-12" />
          <div className="grid lg:grid-cols-2 gap-12">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl sm:text-4xl font-serif font-bold text-forest-500">
                Contactanos
              </h2>
              <p className="mt-4 text-forest-400 text-lg font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
                Completá el formulario y nos comunicaremos con vos a la brevedad.
              </p>

              <div className="mt-8 space-y-6">
                {[
                  { icon: MapPin, title: "Dirección", text: "Av. Sanabria 1616, CABA, Buenos Aires, Argentina" },
                  { icon: Phone, title: "Teléfono", text: "+54 11 7668-3429" },
                  { icon: Mail, title: "Email", text: "info@redescuchapsicologica.com" },
                  { icon: Clock, title: "Horarios", text: "Lunes a Viernes: 9:00 - 20:00\nSábados: 9:00 - 13:00" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-sage-300/15 rounded-lg flex items-center justify-center shrink-0">
                      <item.icon className="w-5 h-5 text-sage-500" />
                    </div>
                    <div>
                      <p className="font-serif font-semibold text-forest-500">{item.title}</p>
                      <p className="text-forest-400 text-sm font-light whitespace-pre-line" style={{ fontFamily: "Montserrat, sans-serif" }}>{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <Card className="bg-beige-50 border-beige-300/50 shadow-lg">
                <CardContent className="p-6 sm:p-8">
                  {contactSent ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center py-8"
                    >
                      <CheckCircle2 className="w-16 h-16 text-sage-500 mx-auto" />
                      <h3 className="mt-4 font-serif text-xl font-semibold text-forest-500">
                        ¡Consulta enviada!
                      </h3>
                      <p className="mt-2 text-forest-400 font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
                        Nos comunicaremos con vos a la brevedad.
                      </p>
                    </motion.div>
                  ) : (
                    <form onSubmit={handleContactSubmit} className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="contact-name" className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>Nombre *</Label>
                          <Input
                            id="contact-name"
                            required
                            value={contactForm.name}
                            onChange={(e) =>
                              setContactForm({ ...contactForm, name: e.target.value })
                            }
                            placeholder="Tu nombre completo"
                            className="border-beige-300 bg-beige-100 focus:border-sage-300 focus:ring-sage-300/20"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="contact-email" className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>Email *</Label>
                          <Input
                            id="contact-email"
                            type="email"
                            required
                            value={contactForm.email}
                            onChange={(e) =>
                              setContactForm({ ...contactForm, email: e.target.value })
                            }
                            placeholder="tu@email.com"
                            className="border-beige-300 bg-beige-100 focus:border-sage-300 focus:ring-sage-300/20"
                          />
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="contact-phone" className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>Teléfono</Label>
                          <Input
                            id="contact-phone"
                            value={contactForm.phone}
                            onChange={(e) =>
                              setContactForm({ ...contactForm, phone: e.target.value })
                            }
                            placeholder="+54 11 xxxx-xxxx"
                            className="border-beige-300 bg-beige-100 focus:border-sage-300 focus:ring-sage-300/20"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="contact-reason" className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>Motivo</Label>
                          <Select
                            value={contactForm.reason}
                            onValueChange={(value) =>
                              setContactForm({ ...contactForm, reason: value })
                            }
                          >
                            <SelectTrigger className="border-beige-300 bg-beige-100 focus:ring-sage-300/20">
                              <SelectValue placeholder="Seleccioná un motivo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="consulta_general">
                                Consulta General
                              </SelectItem>
                              <SelectItem value="informacion">
                                Información
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="contact-message" className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>Mensaje *</Label>
                        <Textarea
                          id="contact-message"
                          required
                          value={contactForm.message}
                          onChange={(e) =>
                            setContactForm({ ...contactForm, message: e.target.value })
                          }
                          placeholder="Contanos cómo podemos ayudarte..."
                          rows={4}
                          className="border-beige-300 bg-beige-100 focus:border-sage-300 focus:ring-sage-300/20"
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={contactSending}
                        className="w-full btn-sage text-forest-900 font-semibold h-11" style={{ fontFamily: "Montserrat, sans-serif" }}
                      >
                        <Send className="mr-2 w-4 h-4" />
                        {contactSending ? "Enviando..." : "Enviar Consulta"}
                      </Button>
                      {contactError && (
                        <p className="text-sm text-red-500 text-center mt-2" style={{ fontFamily: "Montserrat, sans-serif" }}>
                          Ocurrió un error al enviar. Por favor, intentá nuevamente.
                        </p>
                      )}
                    </form>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-forest-900 text-beige-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <div>
              <div className="mb-4">
                <img
                  src="/images/logo.png"
                  alt="Red Escucha Psicológica"
                  className="h-10 w-auto object-contain"
                />
              </div>
              <p className="text-beige-300 text-sm font-light leading-relaxed" style={{ fontFamily: "Montserrat, sans-serif" }}>
                Red Escucha Psicológica. Más de 30 años acompañando tu
                bienestar en Buenos Aires, Argentina.
              </p>
            </div>
            <div>
              <h4 className="font-serif font-semibold text-beige-50 mb-3">Navegación</h4>
              <ul className="space-y-2 text-sm text-beige-300">
                <li>
                  <button onClick={() => scrollToSection("inicio")} className="hover:text-sage-300 transition-colors font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
                    Inicio
                  </button>
                </li>
                <li>
                  <button onClick={() => scrollToSection("nosotros")} className="hover:text-sage-300 transition-colors font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
                    Nosotros
                  </button>
                </li>
                <li>
                  <button onClick={() => scrollToSection("especialidades")} className="hover:text-sage-300 transition-colors font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
                    Especialidades
                  </button>
                </li>
                <li>
                  <button onClick={() => scrollToSection("contacto")} className="hover:text-sage-300 transition-colors font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
                    Contacto
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-serif font-semibold text-beige-50 mb-3">Contacto</h4>
              <ul className="space-y-2 text-sm text-beige-300 font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
                <li>Av. Sanabria 1616, CABA</li>
                <li>+54 11 7668-3429</li>
                <li>info@redescuchapsicologica.com</li>
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-beige-50/10 text-center text-sm text-beige-400 font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
            &copy; {new Date().getFullYear()} Red Escucha Psicológica.
            Todos los derechos reservados.
          </div>
        </div>
      </footer>

      {/* ===== WHATSAPP FLOATING BUTTON ===== */}
      <a
        href="https://wa.me/541176683429"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contactar por WhatsApp"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#25D366] hover:bg-[#20bd5a] rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
      >
        <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>
    </div>
  );
}
