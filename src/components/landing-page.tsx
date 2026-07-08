"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  ArrowUp,
  Menu,
  X,
  CalendarPlus,
  HandHeart,
  BookOpen,
  MessageCircle,
  FileText,
  Facebook,
  Instagram,
  Linkedin,
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

// ===== Icon map for dynamic CMS content =====
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Brain, Heart, Shield, Users, Baby, UserCheck,
  HeartHandshake, Sparkles, HandHeart, BookOpen,
  CalendarPlus, MessageCircle, Leaf, Phone, Mail,
  MapPin, Clock, Send, CheckCircle2, FileText,
};

// ===== Default (fallback) data =====
const defaultSpecialties = [
  { icon: Baby, label: "Niños/Niñas", desc: "Psicología infanto-juvenil con abordaje lúdico y adaptado a cada etapa del desarrollo" },
  { icon: UserCheck, label: "Adolescentes", desc: "Acompañamiento respetuoso en la adolescencia, entendiendo sus necesidades y desafíos" },
  { icon: Users, label: "Jóvenes", desc: "Terapia para jóvenes que transitan momentos de cambio, búsqueda y crecimiento personal" },
  { icon: Users, label: "Adultos", desc: "Terapia individual para adultos en todas las etapas de la vida" },
  { icon: Heart, label: "Adulto Mayor", desc: "Acompañamiento psicológico para adultos mayores, atendiendo sus necesidades específicas" },
  { icon: Shield, label: "Discapacidad (CUD)", desc: "Atención psicológica para personas con discapacidad, con certificado CUD" },
  { icon: HeartHandshake, label: "Parejas", desc: "Terapia vincular y de pareja para reconstruir y fortalecer la relación" },
  { icon: Baby, label: "Materno filial", desc: "Acompañamiento en el vínculo madre e hijo/a, fortaleciendo la relación y la crianza" },
  { icon: Baby, label: "Paterno filial", desc: "Acompañamiento en el vínculo padre e hijo/a, fortaleciendo la relación y la crianza" },
  { icon: Shield, label: "Familias", desc: "Terapia familiar sistémica para armonizar el hogar y mejorar la comunicación" },
  { icon: FileText, label: "Pericias de parte", desc: "Evaluaciones periciales realizadas por profesionales matriculados, con rigor y confidencialidad" },
  { icon: Brain, label: "Psicodiagnósticos", desc: "Evaluaciones psicológicas integrales para orientar el diagnóstico y el plan terapéutico" },
  { icon: CheckCircle2, label: "Apto psicológico", desc: "Evaluaciones psicológicas para aptitud laboral, conducción y otros requisitos" },
];

const defaultSpecialtyTabs = [
  { id: "individual", label: "Individual", items: [0, 1, 2, 3, 4, 5] },
  { id: "vincular", label: "Vincular", items: [6, 7, 8, 9] },
  { id: "evaluaciones", label: "Evaluaciones", items: [10, 11, 12] },
];

const defaultTestimonials = [
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

const defaultHeroSlides = [
  {
    badge: "MÁS DE 30 AÑOS DE EXPERIENCIA",
    title: <>Red Escucha <span className="text-sage-300">Psicológica</span></>,
    description: "Más de tres décadas acompañando tu bienestar. Nuestro equipo de profesionales está aquí para escucharte y ayudarte a transitar los momentos difíciles con respeto y profesionalismo.",
    cta: "Contactanos",
    ctaIcon: Phone,
    secondaryCta: "Conocer Especialidades",
    secondaryIcon: ArrowRight,
    image: "/images/carousel/nature.png",
    imageWebp: null, // nature.png no se beneficia de WebP (era JPEG chico)
  },
  {
    badge: "TERAPIA INDIVIDUAL Y VINCULAR",
    title: <>Un espacio seguro <span className="text-sage-300">para vos</span></>,
    description: "Brindamos terapia individual, de pareja, familiar y grupal con profesionales altamente especializados. Entendemos que cada proceso es único, por eso respetamos tus tiempos y necesidades.",
    cta: "Conocer Especialidades",
    ctaIcon: ArrowRight,
    secondaryCta: "Contactanos",
    secondaryIcon: Phone,
    image: "/images/carousel/families.png",
    imageWebp: "/images/carousel/families.webp",
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
    imageWebp: "/images/carousel/jovenes.webp",
  },
  {
    badge: "CONFIDENCIALIDAD GARANTIZADA",
    title: <>Escucharte es nuestra <span className="text-sage-300">prioridad</span></>,
    description: "Te garantizamos un espacio donde podés expresarte libremente, en el que un profesional capacitado te acompañará en cada paso de tu proceso.",
    cta: "Contactanos",
    ctaIcon: Phone,
    secondaryCta: "Conocer Especialidades",
    secondaryIcon: ArrowRight,
    image: "/images/carousel/ninos.png",
    imageWebp: "/images/carousel/ninos.webp",
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
    modality: "",
    consultReason: "",
    // === Edad y Protocolo de Minoridad ===
    // patientAge y guardianName se mandan al backend solo cuando el
    // usuario eligió "Solicitar Turno" en el combo principal.
    patientAge: "",
    guardianName: "",
  });
  const [contactSent, setContactSent] = useState(false);
  const [contactSending, setContactSending] = useState(false);
  const [contactError, setContactError] = useState(false);
  // Mensaje específico para el caso de email con appointment activo (409)
  // Se setea cuando el backend devuelve code=EMAIL_HAS_ACTIVE_APPOINTMENT
  const [activeApptError, setActiveApptError] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("individual");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // ===== Animated tagline in navbar =====
  const taglines = ["Escuchar", "Acompañar", "Transformar"];
  const [taglineIndex, setTaglineIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTaglineIndex((prev) => (prev + 1) % taglines.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [taglines.length]);

  // ===== CMS Dynamic Content =====
  const [cmsHeroSlides, setCmsHeroSlides] = useState(defaultHeroSlides);

  // Helper: render CMS title with sage-300 accent on last word(s)
  // For CMS string titles like "Red Escucha Psicológica", highlights last word
  // For JSX titles (defaults), renders as-is
  const renderHeroTitle = (title: React.ReactNode) => {
    if (typeof title !== "string") return title;
    // Split title: first N-1 words normal, last word in sage-300
    const words = title.trim().split(/\s+/);
    if (words.length <= 1) return title;
    const mainPart = words.slice(0, -1).join(" ");
    const accentPart = words[words.length - 1];
    return <>{mainPart} <span className="text-sage-300">{accentPart}</span></>;
  };
  const [cmsSpecialties, setCmsSpecialties] = useState(defaultSpecialties);
  const [cmsSpecialtyTabs, setCmsSpecialtyTabs] = useState(defaultSpecialtyTabs);
  const [cmsTestimonials, setCmsTestimonials] = useState(defaultTestimonials);
  const [cmsPhilosophies, setCmsPhilosophies] = useState<Array<{ icon: string; title: string; description: string }>>([]);
  const [cmsSteps, setCmsSteps] = useState<Array<{ icon: string; title: string; description: string }>>([]);
  const [cmsStats, setCmsStats] = useState<Array<{ value: string; label: string }>>([]);
  const [cmsConfig, setCmsConfig] = useState<Record<string, string>>({});
  const [cmsLoaded, setCmsLoaded] = useState(false);

  // Fetch CMS content
  useEffect(() => {
    fetch("/api/cms/content")
      .then((res) => res.json())
      .then((data) => {
        if (data.heroSlides?.length) {
          setCmsHeroSlides(data.heroSlides.map((s: { badge: string; title: string; description: string; cta: string; secondaryCta: string; imageUrl: string }) => ({
            badge: s.badge,
            title: s.title,
            description: s.description,
            cta: s.cta,
            secondaryCta: s.secondaryCta,
            image: s.imageUrl,
          })));
        }
        if (data.specialtyTabs?.length) {
          const allSpecs: Array<{ icon: React.ComponentType<{ className?: string }>; label: string; desc: string }> = [];
          const specIndexMap: Record<string, number> = {};
          const tabs = data.specialtyTabs.map((tab: { id: string; label: string; specialties: Array<{ icon: string; label: string; description: string }> }) => {
            const itemIndices = tab.specialties.map((spec: { icon: string; label: string; description: string }) => {
              const key = `${tab.id}-${spec.label}`;
              if (!(key in specIndexMap)) {
                specIndexMap[key] = allSpecs.length;
                allSpecs.push({ icon: ICON_MAP[spec.icon] || Brain, label: spec.label, desc: spec.description });
              }
              return specIndexMap[key];
            });
            return { id: tab.id, label: tab.label, items: itemIndices };
          });
          if (allSpecs.length > 0) setCmsSpecialties(allSpecs);
          if (tabs.length > 0) {
            setCmsSpecialtyTabs(tabs);
            setActiveTab(tabs[0].id); // Fix: set activeTab to first CMS tab id
          }
        }
        if (data.philosophies?.length) {
          setCmsPhilosophies(data.philosophies);
        }
        if (data.steps?.length) {
          setCmsSteps(data.steps);
        }
        if (data.stats?.length) {
          setCmsStats(data.stats);
        }
        if (data.testimonials?.length) {
          setCmsTestimonials(data.testimonials);
        }
        if (data.config) {
          setCmsConfig(data.config);
        }
        setCmsLoaded(true);
      })
      .catch(() => {
        // Use defaults on error
        setCmsLoaded(true);
      });
  }, []);

  // Preload carousel images
  useEffect(() => {
    const images = cmsHeroSlides.map((slide) => {
      const img = new window.Image();
      img.src = slide.image;
      return img;
    });
    let loadedCount = 0;
    const checkAllLoaded = () => {
      loadedCount++;
      if (loadedCount >= images.length) {
        setImagesLoaded(true);
      }
    };
    images.forEach((img) => {
      if (img.complete) {
        checkAllLoaded();
      } else {
        img.onload = checkAllLoaded;
        img.onerror = checkAllLoaded; // Don't block on error
      }
    });
  }, [cmsHeroSlides]);

  // Auto-advance carousel
  useEffect(() => {
    if (isPaused || !imagesLoaded) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % cmsHeroSlides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isPaused, cmsHeroSlides.length, imagesLoaded]);

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(index);
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % cmsHeroSlides.length);
  }, [cmsHeroSlides.length]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + cmsHeroSlides.length) % cmsHeroSlides.length);
  }, [cmsHeroSlides.length]);

  // Touch/swipe handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const diff = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;
    if (Math.abs(diff) > minSwipeDistance) {
      if (diff > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
  }, [nextSlide, prevSlide]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Google Ads conversion: Chatbot Cliengo - Register the conversion function
  // so the Cliengo chatbot widget can trigger it when a conversation converts
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as unknown as Record<string, unknown>).triggerCliengoConversion = () => {
        // TODO: GOOGLE ADS — reactivar cuando tengas el nuevo label de
        // conversión para la cuenta AW-18195001096 (la anterior era
        // AW-1017920443/MmDKCKewx9MBELv3sOUD). Crear la conversión en
        // Google Ads → Herramientas → Conversiones y reemplazar el
        // send_to de abajo por el nuevo.
        // if (typeof (window as unknown as Record<string, unknown>).gtag === "function") {
        //   (window as unknown as Record<string, unknown>).gtag("event", "conversion", {
        //     send_to: "AW-18195001096/XXXXXXXXXXXXXXXX",
        //     value: 1.0,
        //     currency: "ARS",
        //   });
        // }
      };
    }
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
    setActiveApptError(null);
    try {
      // If requesting an appointment, also create a PatientRequest for triage
      if (contactForm.reason === "solicitar_turno") {
        const prRes = await fetch("/api/patient-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: contactForm.name,
            email: contactForm.email,
            phone: contactForm.phone || null,
            modality: contactForm.modality || "presencial",
            notes: contactForm.message || null,
            // === Edad y Protocolo de Minoridad ===
            // El backend valida que patientAge sea entero 1-120 y que
            // guardianName no esté vacío si patientAge < 18.
            // Fallback 'otros' (antes 'consulta_general', depreciado).
            patientAge: contactForm.patientAge ? parseInt(contactForm.patientAge, 10) : null,
            guardianName: contactForm.guardianName || null,
            reason: contactForm.consultReason || "otros",
          }),
        });

        // Si el backend bloquea por email con appointment activo (409),
        // mostramos el mensaje específico y abortamos el flujo (no mandamos
        // el /api/contact porque sería confuso mandar el mensaje de éxito).
        if (prRes.status === 409) {
          const data = await prRes.json().catch(() => ({}));
          if (data.code === "EMAIL_HAS_ACTIVE_APPOINTMENT") {
            setActiveApptError(data.error);
            // Scroll al form para asegurar que el usuario vea el mensaje
            return;
          }
          // Otro 409 desconocido → tratar como error genérico
          setContactError(true);
          return;
        }

        // Cualquier otro error del POST (500, etc.) → igual mandamos el
        // /api/contact para que al menos llegue el mensaje al admin, pero
        // no bloqueamos el flujo. El triage se puede hacer manualmente.
        if (!prRes.ok && prRes.status !== 201) {
          console.error("Error al crear PatientRequest:", prRes.status);
        }
      }

      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contactForm.name,
          email: contactForm.email,
          phone: contactForm.phone,
          message: contactForm.message,
          reason: contactForm.reason,
          // Enviar modality cuando es solicitar_turno (para que el admin
          // la vea en el panel de Consultas de Contacto)
          modality: contactForm.reason === "solicitar_turno" ? (contactForm.modality || "presencial") : null,
        }),
      });
      if (res.ok) {
        setContactSent(true);
        setContactForm({ name: "", email: "", phone: "", message: "", reason: "", modality: "", consultReason: "", patientAge: "", guardianName: "" });
        // Google Ads conversion: Formulario de Contacto (1)
        // Cuenta: AW-18195001096 (migrada de AW-1017920443 en commit 5bf1cdb)
        // Label: hCYcCPbIorscEIjehuRD
        // Dispara cuando el usuario envía el form de contacto exitosamente
        // (tanto para consultas generales como para solicitudes de turno).
        if (typeof window !== "undefined" && typeof (window as unknown as Record<string, unknown>).gtag === "function") {
          (window as unknown as Record<string, unknown>).gtag("event", "conversion", {
            send_to: "AW-18195001096/hCYcCPbIorscEIjehuRD",
            value: 1.0,
            currency: "ARS",
          });
        }
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

  // Normalize string for comparison (lowercase, remove accents)
  const normalizeCta = (s: string | undefined) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    // Clear any view-related hash when navigating within the landing
    if (window.location.hash === "#registro-profesional" || window.location.hash === "#login" || window.location.hash === "#registro") {
      history.replaceState(null, "", window.location.pathname);
    }
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-beige-100 overflow-x-hidden">
      {/* ===== NAVBAR ===== */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white shadow-md"
            : "bg-white/95 backdrop-blur-sm"
        }`}
        style={{ WebkitBackdropFilter: scrolled ? undefined : 'blur(8px)', backdropFilter: scrolled ? undefined : 'blur(8px)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 md:h-22">
            {/* Logo */}
            <div className="flex items-center flex-shrink-0">
              <picture>
                <source srcSet="/images/logo.webp" type="image/webp" />
                <img
                  src="/images/logo.png"
                  alt="Red Escucha Psicológica"
                  className="h-12 sm:h-14 md:h-16 w-auto object-contain"
                />
              </picture>
            </div>

            {/* === Botón "Pedí tu turno aquí" en el navbar ===
                Reemplaza al tagline animado anterior. Centrado entre el logo
                y el menú de navegación. Estilo amber fijo (sin parpadeo).
                Al hacer click abre WhatsApp directamente.
                Visible en todos los tamaños (mobile + PC). */}
            <div className="flex flex-1 items-center justify-center">
              <a
                href={`https://wa.me/${cmsConfig.whatsapp_number || "5491176683429"}?text=${encodeURIComponent(cmsConfig.whatsapp_message || "Hola, quiero hacer una consulta")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="relative inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-medium text-sm px-4 py-1.5 rounded-full shadow-md border border-amber-300/40 whitespace-nowrap backdrop-blur-sm cursor-pointer transition-colors"
                style={{ fontFamily: "Montserrat, sans-serif" }}
                aria-label="Pedí tu turno aquí por WhatsApp"
              >
                <CalendarPlus className="w-4 h-4 relative" />
                <span className="relative">
                  Pedí tu turno aquí
                </span>
              </a>
            </div>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-8 flex-shrink-0">
              <button
                onClick={() => scrollToSection("inicio")}
                className="text-sm text-forest-700 hover:text-sage-300 transition-colors font-medium tracking-wide" style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                Inicio
              </button>
              <button
                onClick={() => scrollToSection("nosotros")}
                className="text-sm text-forest-700 hover:text-sage-300 transition-colors font-medium tracking-wide" style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                Nosotros
              </button>
              <button
                onClick={() => scrollToSection("especialidades")}
                className="text-sm text-forest-700 hover:text-sage-300 transition-colors font-medium tracking-wide" style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                Especialidades
              </button>
              <button
                onClick={() => scrollToSection("testimonios")}
                className="text-sm text-forest-700 hover:text-sage-300 transition-colors font-medium tracking-wide" style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                Testimonios
              </button>
              <button
                onClick={() => scrollToSection("contacto")}
                className="text-sm text-forest-700 hover:text-sage-300 transition-colors font-medium tracking-wide" style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                Contacto
              </button>
              <button
                onClick={() => setCurrentView("login")}
                className="text-sm text-forest-700 hover:text-sage-300 transition-colors font-medium tracking-wide" style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                Ingresar
              </button>
              {/* Botón "Solicitar Turno" deshabilitado temporalmente */}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2.5 text-forest-900 active:bg-forest-900/10 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
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
          <div className="bg-beige-100/95 backdrop-blur-xl border-t border-forest-900/10 px-4 py-4 space-y-1">
            <button
              onClick={() => scrollToSection("inicio")}
              className="w-full text-left px-4 py-3 text-forest-700 hover:text-sage-300 hover:bg-forest-900/5 rounded-lg transition-colors text-base min-h-[44px] flex items-center" style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              Inicio
            </button>
            <button
              onClick={() => scrollToSection("nosotros")}
              className="w-full text-left px-4 py-3 text-forest-700 hover:text-sage-300 hover:bg-forest-900/5 rounded-lg transition-colors text-base min-h-[44px] flex items-center" style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              Nosotros
            </button>
            <button
              onClick={() => scrollToSection("especialidades")}
              className="w-full text-left px-4 py-3 text-forest-700 hover:text-sage-300 hover:bg-forest-900/5 rounded-lg transition-colors text-base min-h-[44px] flex items-center" style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              Especialidades
            </button>
            <button
              onClick={() => scrollToSection("testimonios")}
              className="w-full text-left px-4 py-3 text-forest-700 hover:text-sage-300 hover:bg-forest-900/5 rounded-lg transition-colors text-base min-h-[44px] flex items-center" style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              Testimonios
            </button>
            <button
              onClick={() => scrollToSection("contacto")}
              className="w-full text-left px-4 py-3 text-forest-700 hover:text-sage-300 hover:bg-forest-900/5 rounded-lg transition-colors text-base min-h-[44px] flex items-center" style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              Contacto
            </button>
            <div className="pt-2 space-y-2">
              <button
                onClick={() => { setMobileMenuOpen(false); setCurrentView("login"); }}
                className="w-full text-left px-4 py-3 text-forest-700 hover:text-sage-300 hover:bg-forest-900/5 rounded-lg transition-colors text-base min-h-[44px] flex items-center" style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                Ingresar
              </button>
              {/* Botón "Solicitar Turno" deshabilitado temporalmente */}
            </div>
            {/* Mobile: Professional network CTA */}
            <div className="mt-4 pt-4 border-t border-forest-900/10 flex flex-col items-center text-center">
              <p className="text-forest-900 text-sm font-light leading-relaxed mb-3 tracking-wide" style={{ fontFamily: "Montserrat, sans-serif" }}>
                Querés formar parte de nuestra red de profesionales?
              </p>
              <Button
                onClick={() => { setMobileMenuOpen(false); window.location.hash = "registro-profesional"; setCurrentView("professional-register"); }}
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
        style={{ touchAction: 'pan-y' }}
      >
        {/* Preload hidden images for instant swapping */}
        <div className="hidden" aria-hidden="true">
          {cmsHeroSlides.map((slide, i) => (
            <picture key={i}>
              {slide.imageWebp && <source srcSet={slide.imageWebp} type="image/webp" />}
              <img src={slide.image} alt="" />
            </picture>
          ))}
        </div>

        {/* Background images - crossfade layers */}
        <div className="absolute inset-0">
          {cmsHeroSlides.map((slide, i) => (
            <div
              key={i}
              className="absolute inset-0 transition-opacity duration-700 ease-in-out"
              style={{
                opacity: i === currentSlide ? 1 : 0,
                zIndex: i === currentSlide ? 1 : 0,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <picture>
                {slide.imageWebp && <source srcSet={slide.imageWebp} type="image/webp" />}
                <img
                  src={slide.image}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="eager"
                  style={{ objectPosition: "center" }}
                  onError={(e) => {
                    // Fallback: hide broken image, show background color
                    const target = e.currentTarget;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.style.backgroundColor = '#1a2e1c';
                    }
                  }}
                />
              </picture>
            </div>
          ))}
        </div>

        {/* Loading placeholder */}
        {!imagesLoaded && (
          <div className="absolute inset-0 bg-forest-900 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-sage-300/30 border-t-sage-300 rounded-full animate-spin" />
              <span className="text-sage-300/60 text-sm font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>Cargando...</span>
            </div>
          </div>
        )}

        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 hero-overlay z-[2]" />

        <div className="relative z-[3] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32 lg:py-40 w-full min-w-0">
          <div className="flex flex-col lg:flex-row lg:items-start lg:gap-12 min-w-0">
          {/* Left column - Hero content */}
          <div className="max-w-3xl flex-1 min-w-0">
            {/* Hero text content - smooth crossfade with CSS */}
            <div className="transition-opacity duration-500 ease-in-out">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 border border-sage-300/40 text-sage-200 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-light mb-5 sm:mb-8 tracking-wider" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  <Leaf className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {cmsHeroSlides[currentSlide].badge}
                </div>

                {/* Title — responsive: más chico en mobile chico */}
                <h1 className="text-3xl xs:text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-serif font-bold text-beige-50 leading-tight">
                  {renderHeroTitle(cmsHeroSlides[currentSlide].title)}
                </h1>

                {/* Description — responsive: más chica en mobile */}
                <p className="mt-4 sm:mt-6 text-base sm:text-lg lg:text-xl text-beige-200/90 leading-relaxed max-w-xl font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  {cmsHeroSlides[currentSlide].description}
                </p>

                {/* CTAs */}
                {/* Orden: arriba botón transparente (outline), abajo botón verde */}
                <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => {
                      const sCta = normalizeCta(cmsHeroSlides[currentSlide].secondaryCta);
                      if (sCta.includes("como funciona")) {
                        scrollToSection("como-funciona");
                      } else if (sCta.includes("conocer especialidades")) {
                        scrollToSection("especialidades");
                      } else if (sCta.includes("contact")) {
                        scrollToSection("contacto");
                      } else {
                        scrollToSection("contacto");
                      }
                    }}
                    className="border-beige-200/30 text-beige-100 hover:bg-beige-50/10 text-sm sm:text-base px-6 sm:px-8 h-11 sm:h-12 rounded-full bg-transparent" style={{ fontFamily: "Montserrat, sans-serif" }}
                  >
                    {(normalizeCta(cmsHeroSlides[currentSlide].secondaryCta).includes("conocer especialidades") || normalizeCta(cmsHeroSlides[currentSlide].secondaryCta).includes("como funciona")) && <ArrowRight className="mr-2 w-5 h-5" />}
                    {normalizeCta(cmsHeroSlides[currentSlide].secondaryCta).includes("contact") && <Phone className="mr-2 w-5 h-5" />}
                    {cmsHeroSlides[currentSlide].secondaryCta}
                  </Button>
                  <Button
                    size="lg"
                    onClick={() => {
                      const cta = normalizeCta(cmsHeroSlides[currentSlide].cta);
                      if (cta.includes("conocer especialidades")) {
                        scrollToSection("especialidades");
                      } else if (cta.includes("contact")) {
                        scrollToSection("contacto");
                      } else if (cta.includes("como funciona")) {
                        scrollToSection("como-funciona");
                      }
                    }}
                    className="bg-sage-300/25 hover:bg-sage-300/60 backdrop-blur-sm text-forest-900 font-semibold text-sm sm:text-base px-6 sm:px-8 h-11 sm:h-12 rounded-full border border-sage-200/30 transition-all" style={{ fontFamily: "Montserrat, sans-serif" }}
                  >
                    {normalizeCta(cmsHeroSlides[currentSlide].cta).includes("contact") && <Phone className="mr-2 w-5 h-5" />}
                    {(normalizeCta(cmsHeroSlides[currentSlide].cta).includes("conocer especialidades") || normalizeCta(cmsHeroSlides[currentSlide].cta).includes("como funciona")) && <ArrowRight className="mr-2 w-5 h-5" />}
                    {cmsHeroSlides[currentSlide].cta}
                  </Button>
                </div>
            </div>

            {/* Carousel controls — responsive */}
            <div className="mt-10 sm:mt-14 flex flex-wrap items-center gap-3 sm:gap-6">
              {/* Dots */}
              <div className="flex items-center gap-2 sm:gap-2.5">
                {cmsHeroSlides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goToSlide(i)}
                    className={`transition-all duration-300 rounded-full ${
                      i === currentSlide
                        ? "w-6 sm:w-8 h-2 sm:h-2.5 bg-sage-300"
                        : "w-2 sm:w-2.5 h-2 sm:h-2.5 bg-beige-200/30 hover:bg-beige-200/50"
                    }`}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>

              {/* Divider */}
              <div className="hidden sm:block w-px h-6 bg-beige-200/20" />

              {/* Arrows */}
              <div className="flex items-center gap-2">
                <button
                  onClick={prevSlide}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-beige-200/20 flex items-center justify-center text-beige-200/60 hover:text-sage-300 hover:border-sage-300/40 transition-colors"
                  aria-label="Slide anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={nextSlide}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-beige-200/20 flex items-center justify-center text-beige-200/60 hover:text-sage-300 hover:border-sage-300/40 transition-colors"
                  aria-label="Siguiente slide"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Divider */}
              <div className="hidden sm:block w-px h-6 bg-beige-200/20" />

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
                  onClick={() => { window.location.hash = "registro-profesional"; setCurrentView("professional-register"); }}
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
                onClick={() => { window.location.hash = "registro-profesional"; setCurrentView("professional-register"); }}
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

          {/* Quiénes somos */}
          <motion.div
            className="text-center mb-14"
            {...fadeInUp}
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-forest-500 leading-tight">
              Quiénes somos
            </h2>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start mb-20">
            {/* Image */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="order-2 lg:order-1"
            >
              <div className="rounded-2xl overflow-hidden shadow-xl border border-beige-200/50 lg:sticky lg:top-24">
                <picture>
                  <source srcSet="/images/quienes-somos.webp" type="image/webp" />
                  <img
                    src="/images/quienes-somos.jpg"
                    alt="Profesionales de la salud mental"
                    className="w-full max-h-[480px] object-cover object-top"
                  />
                </picture>
              </div>
            </motion.div>

            {/* Text */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="order-1 lg:order-2"
            >
              <p className="text-forest-500 text-base sm:text-lg leading-relaxed font-light mb-5" style={{ fontFamily: "Montserrat, sans-serif" }}>
                <strong className="text-forest-600 font-semibold">REP</strong> es una red de profesionales de la salud mental con sólida formación clínica y amplia experiencia en la atención de niños, adolescentes, jóvenes, adultos, parejas y familias.
              </p>
              <p className="text-forest-500 text-base sm:text-lg leading-relaxed font-light mb-5" style={{ fontFamily: "Montserrat, sans-serif" }}>
                Brindamos un espacio de escucha, orientación, acompañamiento y tratamiento para aquellas personas que atraviesan situaciones que generan malestar, incertidumbre o sufrimiento emocional. Entendemos que cada historia es única; por ello, nuestros abordajes son personalizados y adaptados a las necesidades de cada consultante. El profesional interviniente evaluará la modalidad terapéutica más adecuada para cada caso.
              </p>
              <p className="text-forest-500 text-base sm:text-lg leading-relaxed font-light mb-5" style={{ fontFamily: "Montserrat, sans-serif" }}>
                Con más de <strong className="text-forest-600 font-semibold">30 años de trayectoria</strong>, contamos con una extensa red de consultorios en distintos barrios de CABA y GBA, además de ofrecer alternativas de atención que facilitan el acceso al acompañamiento profesional. <strong className="text-forest-600 font-semibold">Contamos con turnos disponibles.</strong>
              </p>
            </motion.div>
          </div>

          <div className="sage-line max-w-xs mx-auto mb-12" />
          <motion.div
            className="text-center max-w-3xl mx-auto mb-16"
            {...fadeInUp}
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-forest-500 leading-tight">
              {cmsConfig.philosophy_title || "Nuestra Filosofía"}
            </h2>
            <p className="mt-6 text-forest-400 text-lg leading-relaxed font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
              {cmsConfig.philosophy_description || <>En <strong className="text-forest-500">REP</strong> creemos que cada persona merece un espacio de escucha genuina.
              Desde hace más de 30 años, acompañamos a quienes buscan
              bienestar emocional con un enfoque humano, ético y profesional.</>}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {(cmsPhilosophies.length > 0 ? cmsPhilosophies : [
              {
                icon: "HandHeart",
                title: "Acompañamiento",
                description: "Cada persona es única. Nuestros profesionales diseñan un abordaje personalizado, respetando tus tiempos y necesidades para que el proceso terapéutico sea significativo y transformador.",
              },
              {
                icon: "Shield",
                title: "Confidencialidad",
                description: "Escucharte es nuestra prioridad, te garantizamos un espacio seguro donde podés expresarte libremente, en el que un profesional capacitado te acompañará en cada paso de tu proceso.",
              },
              {
                icon: "BookOpen",
                title: "Profesionalismo",
                description: "Nuestro equipo se forma continuamente en las corrientes más reconocidas de la psicología, asegurando una atención de calidad basada en evidencia y buenas prácticas clínicas.",
              },
            ]).map((item, i) => {
              const IconComp = ICON_MAP[item.icon] || HandHeart;
              return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-sage-300/15 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <IconComp className="w-8 h-8 text-sage-500" />
                </div>
                <h3 className="font-serif text-xl font-semibold text-forest-500 mb-3">
                  {item.title}
                </h3>
                <p className="text-forest-400 font-light leading-relaxed" style={{ fontFamily: "Montserrat, sans-serif" }}>{item.description}</p>
              </motion.div>
            )})}
          </div>
        </div>
      </section>

      {/* ===== ESPECIALIDADES ===== */}
      <section id="especialidades" className="bg-beige-50 py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="sage-line max-w-xs mx-auto mb-12" />
          <motion.div className="text-center max-w-2xl mx-auto mb-12" {...fadeInUp}>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-forest-500">
              {cmsConfig.specialties_title || "Nuestras Especialidades"}
            </h2>
            <p className="mt-4 text-forest-400 text-lg font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
              {cmsConfig.specialties_description || "Brindamos terapia individual, de pareja, familiar y grupal con profesionales altamente especializados. Entendemos que cada proceso es único, por eso respetamos tus tiempos y necesidades, garantizando confidencialidad y profesionalismo en cada acompañamiento."}
            </p>
          </motion.div>

          {/* Tabs */}
          {/* === Strip deslizable en mobile + flex centrado en desktop === */}
          {/* En mobile (default): flex-nowrap + overflow-x-auto = carrusel
              horizontal fluido que se desliza con el dedo. Los botones no
              se amontonan en múltiples renglones (que ensuciaban la UI en
              celulares con 9 especialidades).
              En pantallas medianas+ (md:): flex-wrap + justify-center =
              distribución tradicional centrada en una o más líneas.
              scrollbar-none oculta la scrollbar nativa fea de Chrome/Safari.
              snap-x snap-mandatory + snap-align-start en botones = scroll
              magnético suave al deslizar. */}
          <div className="flex flex-nowrap md:flex-wrap overflow-x-auto md:overflow-x-visible md:justify-center gap-2 px-4 md:px-0 pb-3 md:pb-0 scrollbar-none snap-x snap-mandatory mb-10">
            {cmsSpecialtyTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap snap-start ${
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
            {cmsSpecialtyTabs
              .find((t) => t.id === activeTab)
              ?.items.map((idx) => {
                const spec = cmsSpecialties[idx];
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

          {/* Listado de especialidades */}
          <p className="text-center mt-10 text-forest-400 text-sm font-light italic" style={{ fontFamily: "Montserrat, sans-serif" }}>
            Depresión, ansiedad, fobias, trastornos alimentarios, discapacidad, psiconutrición, duelos, adicciones, estrés, estrés laboral, autoestima, problemas conductuales, problemas vinculares, crisis vital, autolesión, rendimiento escolar, otros.
          </p>
        </div>
      </section>

      {/* ===== CÓMO FUNCIONA ===== */}
      <section id="como-funciona" className="bg-forest-700 py-20 sm:py-28 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-sage-300/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-earth-400/5 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="sage-line max-w-xs mx-auto mb-12" />
          <motion.div className="text-center max-w-2xl mx-auto mb-16" {...fadeInUp}>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-beige-50">
              {cmsConfig.how_it_works_title || "¿Cómo Funciona?"}
            </h2>
            <p className="mt-4 text-beige-200 text-lg font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
              {cmsConfig.how_it_works_description || "Un proceso simple y respetuoso para que puedas acceder a la atención que necesitás."}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {(cmsSteps.length > 0 ? cmsSteps.slice(0, 3) : [
              { icon: "CalendarPlus", title: "Solicitá tu turno", description: "Completá el registro y elegí el profesional y horario que mejor se ajuste a tus necesidades." },
              { icon: "MessageCircle", title: "Primer contacto", description: "El profesional se pondrá en contacto con vos para coordinar los detalles de la primera sesión." },
              { icon: "Heart", title: "Comenzá tu proceso", description: "Iniciá tu recorrido terapéutico en un espacio seguro, confidencial y profesional." },
            ]).map((item, i) => {
              const IconComp = ICON_MAP[item.icon] || CalendarPlus;
              return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
                className="text-center"
              >
                <div className="text-sage-300 font-serif text-4xl font-bold mb-4">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="w-14 h-14 bg-beige-50/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <IconComp className="w-7 h-7 text-sage-300" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-beige-50 mb-2">
                  {item.title}
                </h3>
                <p className="text-beige-200/80 text-sm font-light leading-relaxed" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  {item.description}
                </p>
              </motion.div>
            )})}
          </div>
        </div>
      </section>

      {/* ===== STATS BAR ===== */}
      {cmsStats.length > 0 && (
      <section className="bg-sage-300 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {cmsStats.map((stat, i) => (
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
      )}

      {/* ===== TESTIMONIOS ===== */}
      <section id="testimonios" className="paper-texture py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="sage-line max-w-xs mx-auto mb-12" />
          <motion.div className="text-center max-w-2xl mx-auto mb-14" {...fadeInUp}>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-forest-500">
              {cmsConfig.testimonials_title || "Lo que Dicen de Nosotros"}
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {cmsTestimonials.map((t, i) => (
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

      {/* ===== CTA ===== */}
      <section className="bg-forest-500 py-16 sm:py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-1/4 w-48 h-48 bg-sage-300 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-1/4 w-64 h-64 bg-earth-400 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div {...fadeInUp} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} initial={{ opacity: 0, y: 20 }}>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-beige-50">
              {cmsConfig.cta_title || "¿Necesitás hablar con alguien?"}
            </h2>
            <p className="mt-5 text-beige-200 text-lg max-w-2xl mx-auto font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
              {cmsConfig.cta_description || "No estás solo/a. Nuestro equipo de profesionales está listo para acompañarte. Sin listas de espera, con turnos disponibles."}
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
                {cmsConfig.contact_title || "Contactanos"}
              </h2>
              <p className="mt-4 text-forest-400 text-lg font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
                {cmsConfig.contact_description || "Completá el formulario y nos comunicaremos con vos a la brevedad."}
              </p>

              <div className="mt-8 space-y-6">
                {[
                  ...(cmsConfig.contact_address ? [{ icon: MapPin, title: "Dirección", text: cmsConfig.contact_address }] : []),
                  { icon: Phone, title: "Teléfono", text: cmsConfig.contact_phone || "+54 11 7668-3429" },
                  { icon: Mail, title: "Email", text: cmsConfig.contact_email || "contacto@redescuchapsicologica.com" },
                  { icon: Clock, title: "Horarios", text: [cmsConfig.contact_hours_weekday || "24 horas, los 365 días del año", ...(cmsConfig.contact_hours_saturday ? [cmsConfig.contact_hours_saturday] : [])].join("\n") },
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
                          <Label htmlFor="contact-reason" className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>Solicitar</Label>
                          <Select
                            value={contactForm.reason}
                            onValueChange={(value) =>
                              setContactForm({ ...contactForm, reason: value })
                            }
                          >
                            <SelectTrigger className="border-beige-300 bg-beige-100 focus:ring-sage-300/20">
                              <SelectValue placeholder="Seleccioná una opción" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="solicitar_turno">
                                Solicitar Turno
                              </SelectItem>
                              <SelectItem value="informacion">
                                Información
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {contactForm.reason === "solicitar_turno" && (
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="contact-modality" className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>Modalidad preferida</Label>
                            <Select
                              value={contactForm.modality}
                              onValueChange={(value) =>
                                setContactForm({ ...contactForm, modality: value })
                              }
                            >
                              <SelectTrigger className="border-beige-300 bg-beige-100 focus:ring-sage-300/20">
                                <SelectValue placeholder="Seleccioná modalidad" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="presencial">Presencial</SelectItem>
                                <SelectItem value="online">Online</SelectItem>
                                <SelectItem value="híbrida">Híbrida</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="consult-reason" className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>Motivo de consulta</Label>
                            <Select
                              value={contactForm.consultReason}
                              onValueChange={(value) =>
                                setContactForm({ ...contactForm, consultReason: value })
                              }
                            >
                              <SelectTrigger className="border-beige-300 bg-beige-100 focus:ring-sage-300/20">
                                <SelectValue placeholder="Seleccioná un motivo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ansiedad">Ansiedad</SelectItem>
                                <SelectItem value="depresion">Depresión</SelectItem>
                                <SelectItem value="vinculos">Vínculos / Pareja</SelectItem>
                                <SelectItem value="duelo">Duelo / Pérdida</SelectItem>
                                <SelectItem value="autoestima">Autoestima</SelectItem>
                                <SelectItem value="adicciones">Adicciones</SelectItem>
                                <SelectItem value="estres">Estrés</SelectItem>
                                <SelectItem value="laboral">Laboral</SelectItem>
                                <SelectItem value="orientacion_padres">Orientación a Padres</SelectItem>
                                <SelectItem value="evaluaciones">Evaluaciones</SelectItem>
                                <SelectItem value="discapacidad">Discapacidad</SelectItem>
                                <SelectItem value="otros">Otros</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                      {/* === Edad del Paciente + Protocolo de Minoridad === */}
                      {/* Solo visible cuando el motivo principal es "solicitar_turno".
                          IMPORTANTE: por discreción del paciente, NO mostramos al
                          usuario público ninguna etiqueta de etapa vital (Niñez,
                          Adolescencia, etc.). Esa inteligencia de categorización
                          es exclusiva del panel Triage admin (ver admin-triage.tsx). */}
                      {contactForm.reason === "solicitar_turno" && (
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor="patient-age" className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>
                              Edad del Paciente <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id="patient-age"
                              type="number"
                              min={1}
                              max={120}
                              value={contactForm.patientAge}
                              onChange={(e) => {
                                setContactForm({ ...contactForm, patientAge: e.target.value });
                              }}
                              placeholder="Ingresá la edad (1 a 120)"
                              className="border-beige-300 bg-beige-100 focus:border-sage-300 focus:ring-sage-300/20"
                            />
                          </div>

                          {/* === Protocolo de Minoridad === */}
                          {/* Si la edad es < 18, aparece suavemente el campo del tutor.
                              No se muestra ninguna etiqueta de etapa vital — solo el
                              campo de tutor cuando corresponde, para mantener
                              discreción en el form público. */}
                          {(() => {
                            const ageNum = parseInt(contactForm.patientAge, 10);
                            const isMinor = Number.isFinite(ageNum) && ageNum > 0 && ageNum < 18;
                            return (
                              <div
                                className={`transition-all duration-300 ease-in-out overflow-hidden ${
                                  isMinor ? "max-h-60 opacity-100 mt-2" : "max-h-0 opacity-0"
                                }`}
                              >
                                <div className="space-y-2 p-3 rounded-lg bg-amber-50/60 border border-amber-200">
                                  <Label htmlFor="guardian-name" className="text-amber-800 font-medium block" style={{ fontFamily: "Montserrat, sans-serif" }}>
                                    Nombre Completo del Adulto Responsable o Tutor <span className="text-red-500">*</span>
                                  </Label>
                                  <Input
                                    id="guardian-name"
                                    type="text"
                                    value={contactForm.guardianName}
                                    onChange={(e) => {
                                      setContactForm({ ...contactForm, guardianName: e.target.value });
                                    }}
                                    placeholder="Nombre y apellido del tutor legal"
                                    className="border-amber-300 bg-white focus:border-amber-400 focus:ring-amber-300/20"
                                  />
                                  <p className="text-xs text-amber-700" style={{ fontFamily: "Montserrat, sans-serif" }}>
                                    Para pacientes menores de 18 años, se requiere el registro del adulto responsable.
                                  </p>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="contact-message" className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>Mensaje {contactForm.reason === "solicitar_turno" ? "" : "*"}</Label>
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
                      {activeApptError && (
                        <div
                          className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm"
                          style={{ fontFamily: "Montserrat, sans-serif" }}
                          role="alert"
                        >
                          <p className="font-semibold mb-1">Ya tenés un turno activo</p>
                          <p>{activeApptError}</p>
                        </div>
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
              <div className="mb-4 bg-beige-100/90 rounded-lg p-2 inline-block">
                <picture>
                  <source srcSet="/images/logo.webp" type="image/webp" />
                  <img
                    src="/images/logo.png"
                    alt="Red Escucha Psicológica"
                    className="h-14 w-auto object-contain"
                  />
                </picture>
              </div>
              <p className="text-beige-300 text-sm font-light leading-relaxed" style={{ fontFamily: "Montserrat, sans-serif" }}>
                Más de 30 años acompañando tu
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
                  <button onClick={() => scrollToSection("testimonios")} className="hover:text-sage-300 transition-colors font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
                    Testimonios
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
                {cmsConfig.contact_address && <li>{cmsConfig.contact_address}</li>}
                <li>{cmsConfig.contact_phone || "+54 11 7668-3429"}</li>
                <li>{cmsConfig.contact_email || "contacto@redescuchapsicologica.com"}</li>
              </ul>
              {/* Social Media Icons — debajo de Contacto */}
              {(cmsConfig.social_facebook_url || cmsConfig.social_instagram_url || cmsConfig.social_tiktok_url || cmsConfig.social_linkedin_url) && (
                <div className="flex items-center gap-3 mt-4">
                  {cmsConfig.social_facebook_url && (
                    <a
                      href={cmsConfig.social_facebook_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-beige-400 hover:text-sage-300 transition-colors duration-200"
                      aria-label="Facebook"
                    >
                      <Facebook className="w-5 h-5" />
                    </a>
                  )}
                  {cmsConfig.social_instagram_url && (
                    <a
                      href={cmsConfig.social_instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-beige-400 hover:text-sage-300 transition-colors duration-200"
                      aria-label="Instagram"
                    >
                      <Instagram className="w-5 h-5" />
                    </a>
                  )}
                  {cmsConfig.social_tiktok_url && (
                    <a
                      href={cmsConfig.social_tiktok_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-beige-400 hover:text-sage-300 transition-colors duration-200"
                      aria-label="TikTok"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                        <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
                      </svg>
                    </a>
                  )}
                  {cmsConfig.social_linkedin_url && (
                    <a
                      href={cmsConfig.social_linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-beige-400 hover:text-sage-300 transition-colors duration-200"
                      aria-label="LinkedIn"
                    >
                      <Linkedin className="w-5 h-5" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-beige-50/10 text-center text-sm text-beige-400 font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
            {/* Tagline "Escuchar · Acompañar · Transformar" — responsive */}
            {/* En mobile: texto chico + tracking reducido + separadores con menos margen
                para que entre en una línea. En sm+: tamaño y tracking normales. */}
            <p className="mb-3 text-xs xs:text-sm sm:text-base lg:text-lg font-semibold tracking-[0.15em] xs:tracking-[0.2em] sm:tracking-[0.3em] uppercase">
              <span className="text-sage-300">Escuchar</span>
              <span className="text-beige-400/50 mx-1 xs:mx-1.5 sm:mx-2">·</span>
              <span className="text-amber-300">Acompañar</span>
              <span className="text-beige-400/50 mx-1 xs:mx-1.5 sm:mx-2">·</span>
              <span className="text-beige-100">Transformar</span>
            </p>
            &copy; {new Date().getFullYear()} Red Escucha Psicológica.
            Todos los derechos reservados.
            <span className="mx-1">|</span>
            <a
              href="https://www.sextosistema.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-sage-300 transition-colors duration-200"
            >
              Diseño Web - Sexto Sistema
            </a>
          </div>
        </div>
      </footer>

      {/* ===== VOLVER ARRIBA (scroll-to-top) FLOATING BUTTON ===== */}
      {/* Aparece cuando el usuario scrollea fuera del hero (scrolled = true).
          Se ubica en el lado izquierdo para no chocar con los botones
          flotantes de la derecha (Profesionales, Turno, WhatsApp).
          Al hacer click, hace scroll suave hasta el inicio del hero. */}
      {scrolled && (
        <button
          onClick={() => scrollToSection("inicio")}
          className="fixed z-50 w-12 h-12 bg-forest-700/80 hover:bg-forest-700 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 backdrop-blur-sm border border-forest-500/30"
          style={{
            bottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))',
            left: 'max(1.5rem, env(safe-area-inset-left, 1.5rem))'
          }}
          aria-label="Volver al inicio del carrusel"
          title="Volver al inicio"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}

      {/* ===== PROFESIONALES FLOATING BUTTON (top of the stack) ===== */}
      <button
        onClick={() => { window.location.hash = "registro-profesional"; setCurrentView("professional-register"); }}
        className="fixed z-50 w-14 h-14 bg-sage-500 hover:bg-sage-600 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
        style={{ bottom: 'max(9.5rem, calc(env(safe-area-inset-bottom, 1.5rem) + 8rem))', right: 'max(1.5rem, env(safe-area-inset-right, 1.5rem))' }}
        aria-label="Registro de Profesionales"
      >
        <span className="relative w-full h-full flex items-center justify-center">
          <svg viewBox="0 0 56 56" className="absolute inset-0 w-full h-full animate-[spin_20s_linear_infinite]">
            <defs>
              <path id="prof-circle" d="M 28,28 m -21,0 a 21,21 0 1,1 42,0 a 21,21 0 1,1 -42,0" />
            </defs>
            <text fontSize="9.5" fontWeight="700" fontFamily="Montserrat, sans-serif" fill="white" letterSpacing="1.8">
              <textPath href="#prof-circle" startOffset="0%">
                Profesionales ✦
              </textPath>
            </text>
          </svg>
          <Users className="w-4 h-4 relative z-10" />
        </span>
      </button>

      {/* ===== TURNO AQUÍ FLOATING BUTTON (middle of the stack) ===== */}
      <button
        onClick={() => scrollToSection("contacto")}
        className="fixed z-50 w-14 h-14 bg-amber-500 hover:bg-amber-600 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
        style={{ bottom: 'max(5.5rem, calc(env(safe-area-inset-bottom, 1.5rem) + 4rem))', right: 'max(1.5rem, env(safe-area-inset-right, 1.5rem))' }}
        aria-label="Solicitar Turno"
      >
        <span className="relative w-full h-full flex items-center justify-center">
          <svg viewBox="0 0 56 56" className="absolute inset-0 w-full h-full animate-[spin_20s_linear_infinite]">
            <defs>
              <path id="turno-circle" d="M 28,28 m -21,0 a 21,21 0 1,1 42,0 a 21,21 0 1,1 -42,0" />
            </defs>
            <text fontSize="10.2" fontWeight="700" fontFamily="Montserrat, sans-serif" fill="white" letterSpacing="1.8">
              <textPath href="#turno-circle" startOffset="0%">
                Turno aquí ✦
              </textPath>
            </text>
          </svg>
          <CalendarPlus className="w-4 h-4 relative z-10" />
        </span>
      </button>

      {/* ===== WHATSAPP FLOATING BUTTON (bottom of the stack) ===== */}
      {cmsConfig.whatsapp_enabled !== "false" && (
      <a
        href={`https://wa.me/${cmsConfig.whatsapp_number || "5491176683429"}?text=${encodeURIComponent(cmsConfig.whatsapp_message || "Hola, quiero hacer una consulta")}`}
        rel="noopener noreferrer"
        aria-label="Contactar por WhatsApp"
        className="fixed z-50 w-14 h-14 bg-[#25D366] hover:bg-[#20bd5a] rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
        style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))', right: 'max(1.5rem, env(safe-area-inset-right, 1.5rem))' }}
        onClick={() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const w = window as any;
          if (typeof w !== "undefined" && typeof w.gtag === "function") {
            w.gtag("event", "conversion", {
              send_to: "AW-1017920443/KQ2mCOeP-8ccELv3sOUD",
            });
          }
        }}
      >
        <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>
      )}
    </div>
  );
}
