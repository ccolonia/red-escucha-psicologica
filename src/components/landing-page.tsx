"use client";

import { useState } from "react";
import { motion } from "framer-motion";
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
  Send,
  CheckCircle2,
  Leaf,
  ArrowRight,
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
  { icon: Brain, label: "Ansiedad y Estrés", desc: "Técnicas de manejo y afrontamiento" },
  { icon: Heart, label: "Depresión", desc: "Acompañamiento y terapia integral" },
  { icon: Sparkles, label: "Crisis Vitales", desc: "Soporte en momentos difíciles" },
  { icon: HeartHandshake, label: "Conflictos Vinculares", desc: "Mejora de relaciones interpersonales" },
  { icon: Baby, label: "Niños", desc: "Psicología infanto-juvenil" },
  { icon: UserCheck, label: "Adolescentes", desc: "Acompañamiento en la adolescencia" },
  { icon: Users, label: "Adultos", desc: "Terapia individual para adultos" },
  { icon: HeartHandshake, label: "Parejas", desc: "Terapia vincular y de pareja" },
  { icon: Shield, label: "Familias", desc: "Terapia familiar sistémica" },
];

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
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

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactSending(true);
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
      }
    } catch {
      // silent
    } finally {
      setContactSending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-teal-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-teal-600 flex items-center justify-center">
                <Leaf className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-bold text-lg text-teal-800">AP</span>
                <span className="hidden sm:inline text-sm text-teal-600 ml-2">
                  Red Asistencial de Salud Mental
                </span>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <a
                href="#inicio"
                className="text-sm font-medium text-teal-700 hover:text-teal-900 transition-colors"
              >
                Inicio
              </a>
              <a
                href="#servicios"
                className="text-sm font-medium text-teal-700 hover:text-teal-900 transition-colors"
              >
                Servicios
              </a>
              <a
                href="#contacto"
                className="text-sm font-medium text-teal-700 hover:text-teal-900 transition-colors"
              >
                Contacto
              </a>
              <Button
                onClick={() => setCurrentView("login")}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                Ingresar
              </Button>
            </nav>
            <Button
              variant="ghost"
              className="md:hidden text-teal-700"
              onClick={() => setCurrentView("login")}
            >
              Ingresar
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section id="inicio" className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-teal-50 via-emerald-50/30 to-white" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-teal-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-200/20 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7 }}
            >
              <div className="inline-flex items-center gap-2 bg-teal-100 text-teal-800 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
                <Leaf className="w-4 h-4" />
                Más de 30 años de experiencia
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-teal-900 leading-tight">
                Red Asistencial de{" "}
                <span className="text-teal-600">Salud Mental</span>
              </h1>
              <p className="mt-6 text-lg sm:text-xl text-teal-700/80 leading-relaxed max-w-xl">
                Más de 30 años acompañando tu bienestar. Nuestro equipo de
                profesionales está aquí para escucharte y ayudarte a transitar
                los momentos difíciles.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  onClick={() => setCurrentView("register")}
                  className="bg-teal-600 hover:bg-teal-700 text-white text-base px-8 h-12"
                >
                  Solicitar Turno
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() =>
                    document
                      .getElementById("contacto")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="border-teal-300 text-teal-700 hover:bg-teal-50 text-base px-8 h-12"
                >
                  <Phone className="mr-2 w-5 h-5" />
                  Contactanos
                </Button>
              </div>

              {/* No wait list highlight */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="mt-10 flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 w-fit"
              >
                <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-emerald-800">
                    ¡Sin listas de espera!
                  </p>
                  <p className="text-sm text-emerald-600">
                    Turnos disponibles en menos de 48 horas
                  </p>
                </div>
              </motion.div>
            </motion.div>

            {/* Hero illustration - calming abstract shape */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="hidden lg:flex justify-center"
            >
              <div className="relative w-96 h-96">
                {/* Abstract calming circles */}
                <div className="absolute inset-0 bg-gradient-to-br from-teal-400/20 to-emerald-300/20 rounded-full animate-pulse" />
                <div className="absolute inset-8 bg-gradient-to-tr from-teal-300/30 to-emerald-200/30 rounded-full" />
                <div className="absolute inset-16 bg-gradient-to-br from-teal-200/40 to-emerald-100/40 rounded-full" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Heart className="w-20 h-20 text-teal-500 mx-auto" />
                    <p className="mt-4 text-teal-700 font-medium text-lg">
                      Tu bienestar es nuestra prioridad
                    </p>
                  </div>
                </div>
                {/* Floating decorative elements */}
                <motion.div
                  animate={{ y: [-10, 10, -10] }}
                  transition={{ duration: 4, repeat: Infinity }}
                  className="absolute top-8 right-8 w-12 h-12 bg-teal-200/50 rounded-xl rotate-12"
                />
                <motion.div
                  animate={{ y: [10, -10, 10] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute bottom-16 left-8 w-10 h-10 bg-emerald-200/50 rounded-full"
                />
                <motion.div
                  animate={{ y: [-8, 8, -8] }}
                  transition={{ duration: 5, repeat: Infinity }}
                  className="absolute top-24 left-4 w-8 h-8 bg-teal-300/40 rounded-lg rotate-45"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-teal-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "30+", label: "Años de experiencia" },
              { value: "4", label: "Profesionales" },
              { value: "9", label: "Especialidades" },
              { value: "0", label: "Listas de espera" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <p className="text-3xl sm:text-4xl font-bold">{stat.value}</p>
                <p className="text-teal-200 text-sm mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="servicios" className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center max-w-2xl mx-auto mb-16"
            {...fadeInUp}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-teal-900">
              Nuestras Especialidades
            </h2>
            <p className="mt-4 text-teal-600 text-lg">
              Contamos con profesionales especializados en diversas áreas de la
              salud mental para brindarte la mejor atención.
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {specialties.map((spec, i) => (
              <motion.div
                key={i}
                variants={fadeInUp}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="border-teal-100 hover:border-teal-300 hover:shadow-lg transition-all duration-300 h-full">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mb-4">
                      <spec.icon className="w-6 h-6 text-teal-600" />
                    </div>
                    <h3 className="font-semibold text-teal-900 text-lg">
                      {spec.label}
                    </h3>
                    <p className="text-teal-600/70 text-sm mt-1">{spec.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-teal-600 to-teal-800 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div {...fadeInUp} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} initial={{ opacity: 0, y: 20 }}>
            <h2 className="text-3xl sm:text-4xl font-bold">
              ¿Necesitás hablar con alguien?
            </h2>
            <p className="mt-4 text-teal-100 text-lg max-w-2xl mx-auto">
              No estás solo/a. Nuestro equipo de profesionales está listo para
              acompañarte. Sin listas de espera, con turnos disponibles.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                onClick={() => setCurrentView("register")}
                className="bg-white text-teal-700 hover:bg-teal-50 text-base px-8 h-12 font-semibold"
              >
                Solicitar Turno
                <ChevronRight className="ml-1 w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10 text-base px-8 h-12"
                onClick={() =>
                  document
                    .getElementById("contacto")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                <Mail className="mr-2 w-5 h-5" />
                Enviar Consulta
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Contact Form */}
      <section id="contacto" className="py-16 sm:py-24 bg-teal-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl sm:text-4xl font-bold text-teal-900">
                Contactanos
              </h2>
              <p className="mt-4 text-teal-600 text-lg">
                Completá el formulario y nos comunicaremos con vos a la brevedad.
              </p>

              <div className="mt-8 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="font-medium text-teal-900">Dirección</p>
                    <p className="text-teal-600 text-sm">
                      Av. Corrientes 1234, CABA, Buenos Aires, Argentina
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="font-medium text-teal-900">Teléfono</p>
                    <p className="text-teal-600 text-sm">
                      +54 11 4567-8900
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="font-medium text-teal-900">Email</p>
                    <p className="text-teal-600 text-sm">
                      info@ap.com.ar
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="font-medium text-teal-900">Horarios</p>
                    <p className="text-teal-600 text-sm">
                      Lunes a Viernes: 9:00 - 20:00
                    </p>
                    <p className="text-teal-600 text-sm">
                      Sábados: 9:00 - 13:00
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <Card className="border-teal-100">
                <CardContent className="p-6 sm:p-8">
                  {contactSent ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center py-8"
                    >
                      <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
                      <h3 className="mt-4 text-xl font-semibold text-teal-900">
                        ¡Consulta enviada!
                      </h3>
                      <p className="mt-2 text-teal-600">
                        Nos comunicaremos con vos a la brevedad.
                      </p>
                    </motion.div>
                  ) : (
                    <form onSubmit={handleContactSubmit} className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="contact-name">Nombre *</Label>
                          <Input
                            id="contact-name"
                            required
                            value={contactForm.name}
                            onChange={(e) =>
                              setContactForm({ ...contactForm, name: e.target.value })
                            }
                            placeholder="Tu nombre completo"
                            className="border-teal-200 focus:border-teal-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="contact-email">Email *</Label>
                          <Input
                            id="contact-email"
                            type="email"
                            required
                            value={contactForm.email}
                            onChange={(e) =>
                              setContactForm({ ...contactForm, email: e.target.value })
                            }
                            placeholder="tu@email.com"
                            className="border-teal-200 focus:border-teal-500"
                          />
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="contact-phone">Teléfono</Label>
                          <Input
                            id="contact-phone"
                            value={contactForm.phone}
                            onChange={(e) =>
                              setContactForm({ ...contactForm, phone: e.target.value })
                            }
                            placeholder="+54 11 xxxx-xxxx"
                            className="border-teal-200 focus:border-teal-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="contact-reason">Motivo</Label>
                          <Select
                            value={contactForm.reason}
                            onValueChange={(value) =>
                              setContactForm({ ...contactForm, reason: value })
                            }
                          >
                            <SelectTrigger className="border-teal-200">
                              <SelectValue placeholder="Seleccioná un motivo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="solicitar_turno">
                                Solicitar Turno
                              </SelectItem>
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
                        <Label htmlFor="contact-message">Mensaje *</Label>
                        <Textarea
                          id="contact-message"
                          required
                          value={contactForm.message}
                          onChange={(e) =>
                            setContactForm({ ...contactForm, message: e.target.value })
                          }
                          placeholder="Contanos cómo podemos ayudarte..."
                          rows={4}
                          className="border-teal-200 focus:border-teal-500"
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={contactSending}
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white h-11"
                      >
                        <Send className="mr-2 w-4 h-4" />
                        {contactSending ? "Enviando..." : "Enviar Consulta"}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-teal-900 text-teal-100 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
                  <Leaf className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-lg text-white">AP</span>
              </div>
              <p className="text-teal-300 text-sm">
                Red Asistencial de Salud Mental. Más de 30 años acompañando tu
                bienestar en Buenos Aires, Argentina.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Navegación</h4>
              <ul className="space-y-2 text-sm text-teal-300">
                <li>
                  <a href="#inicio" className="hover:text-white transition-colors">
                    Inicio
                  </a>
                </li>
                <li>
                  <a href="#servicios" className="hover:text-white transition-colors">
                    Servicios
                  </a>
                </li>
                <li>
                  <a href="#contacto" className="hover:text-white transition-colors">
                    Contacto
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Contacto</h4>
              <ul className="space-y-2 text-sm text-teal-300">
                <li>Av. Corrientes 1234, CABA</li>
                <li>+54 11 4567-8900</li>
                <li>info@ap.com.ar</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-teal-800 text-center text-sm text-teal-400">
            © {new Date().getFullYear()} AP - Red Asistencial de Salud Mental.
            Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
