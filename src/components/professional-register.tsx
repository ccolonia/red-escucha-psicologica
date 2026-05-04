"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus,
  Mail,
  Lock,
  Phone,
  CreditCard,
  Award,
  Stethoscope,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Leaf,
  MapPin,
  Monitor,
  Home,
  Heart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";

const THERAPY_TYPES = [
  "Psicoanálisis",
  "Terapia cognitivo-conductual",
  "Terapia sistémica",
  "Terapia humanista",
  "Terapia gestáltica",
  "Terapia junguiana",
  "EMDR",
  "Mindfulness",
  "Logoterapia",
  "Psicodrama",
  "Neuropsicología",
  "Psicoterapia Integral",
  "Sexología",
  "Terapia de Pareja y Familia",
  "Psicología Clínica",
  "Psicología Infanto-Juvenil",
  "Deportología",
  "Psicología Positiva",
  "Psicocorporal Reichiana",
  "Terapia transpersonal",
  "Terapia constructivista",
  "Otras terapias",
];

const TARGET_AUDIENCES = [
  "Adultos",
  "Adolescentes",
  "Niños",
  "Pareja",
  "Familiar",
  "Mayores",
];

const ZONES = [
  "Capital Federal (CABA)",
  "GBA Zona Norte",
  "GBA Zona Oeste",
  "GBA Zona Sur",
  "La Plata",
  "Mar del Plata",
  "Córdoba",
  "Rosario",
  "Mendoza",
  "Otra (indicar en mensaje)",
];

const SPECIALTIES = [
  "Psicología Clínica",
  "Terapia de Pareja y Familia",
  "Psicología Infanto-Juvenil",
  "Psiquiatría",
  "Psicopedagogía",
  "Musicoterapia",
];

const TITLES = ["Lic.", "Dr.", "Dra.", "Ninguno"];

export function ProfessionalRegister() {
  const { setCurrentView } = useAppStore();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [form, setForm] = useState({
    // Step 1: Cuenta
    email: "",
    confirmEmail: "",
    password: "",
    confirmPassword: "",
    // Step 2: Datos personales
    title: "Lic.",
    firstName: "",
    lastName: "",
    phone: "",
    cuil: "",
    gender: "",
    // Step 3: Datos profesionales
    profession: "Psicólogo",
    license: "",
    specialty: "",
    therapyTypes: [] as string[],
    targetAudience: [] as string[],
    therapyModality: [] as string[],
    // Step 4: Zonas y modalidad de atención
    onlineAttention: true,
    presentialAttention: true,
    homeAttention: false,
    zones: [] as string[],
    bio: "",
  });

  const totalSteps = 4;

  const updateForm = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleArrayItem = (field: "therapyTypes" | "targetAudience" | "therapyModality" | "zones", item: string) => {
    setForm((prev) => {
      const arr = prev[field] as string[];
      return {
        ...prev,
        [field]: arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item],
      };
    });
  };

  const validateStep = (s: number): boolean => {
    switch (s) {
      case 1:
        if (!form.email || !form.confirmEmail) {
          toast.error("Ingresá tu email y confirmalo");
          return false;
        }
        if (form.email !== form.confirmEmail) {
          toast.error("Los emails no coinciden");
          return false;
        }
        if (!form.email.includes("@")) {
          toast.error("Ingresá un email válido");
          return false;
        }
        if (!form.password || form.password.length < 6) {
          toast.error("La contraseña debe tener al menos 6 caracteres");
          return false;
        }
        if (form.password !== form.confirmPassword) {
          toast.error("Las contraseñas no coinciden");
          return false;
        }
        return true;

      case 2:
        if (!form.firstName.trim() || !form.lastName.trim()) {
          toast.error("Nombre y apellido son obligatorios");
          return false;
        }
        if (!form.phone.trim()) {
          toast.error("Ingresá tu teléfono");
          return false;
        }
        return true;

      case 3:
        if (!form.license.trim()) {
          toast.error("Ingresá tu número de matrícula");
          return false;
        }
        if (!form.specialty) {
          toast.error("Seleccioná tu especialidad");
          return false;
        }
        if (form.therapyTypes.length === 0) {
          toast.error("Seleccioná al menos un tipo de terapia");
          return false;
        }
        if (form.targetAudience.length === 0) {
          toast.error("Seleccioná al menos un público objetivo");
          return false;
        }
        return true;

      case 4:
        if (!acceptedTerms) {
          toast.error("Debés aceptar los términos y condiciones");
          return false;
        }
        if (!form.onlineAttention && !form.presentialAttention && !form.homeAttention) {
          toast.error("Seleccioná al menos una modalidad de atención");
          return false;
        }
        if (form.zones.length === 0) {
          toast.error("Seleccioná al menos una zona de atención");
          return false;
        }
        return true;

      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, totalSteps));
    }
  };

  const prevStep = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(step)) return;

    setSubmitting(true);
    try {
      const fullName = `${form.title !== "Ninguno" ? form.title + " " : ""}${form.firstName} ${form.lastName}`;

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName,
          email: form.email,
          phone: form.phone,
          password: form.password,
          role: "professional",
          license: form.license,
          specialty: form.specialty,
          bio: form.bio || null,
          title: form.title,
          cuil: form.cuil || null,
          gender: form.gender || null,
          therapyTypes: form.therapyTypes,
          targetAudience: form.targetAudience,
          therapyModality: form.therapyModality,
          onlineAttention: form.onlineAttention,
          presentialAttention: form.presentialAttention,
          homeAttention: form.homeAttention,
          zones: form.zones,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        toast.success("Registro enviado exitosamente");
      } else {
        toast.error(data.error || "Error al registrarse");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  };

  // Success screen
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center"
        >
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-teal-900 mb-3">
            ¡Registro enviado!
          </h1>
          <p className="text-teal-600 mb-2">
            Tu solicitud fue enviada exitosamente. Un administrador la revisará y activará tu cuenta.
          </p>
          <p className="text-teal-500 text-sm mb-8">
            Recibirás un email de confirmación cuando tu cuenta sea aprobada.
          </p>
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white"
            onClick={() => setCurrentView("landing")}
          >
            <ArrowLeft className="mr-2 w-4 h-4" />
            Volver al inicio
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
      {/* Header */}
      <div className="bg-white border-b border-teal-100">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => setCurrentView("landing")}
            className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
              <Leaf className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-sm text-teal-800">Red Escucha</span>
              <p className="text-[10px] text-teal-500 -mt-0.5 leading-tight">Psicológica</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-4">
            <Stethoscope className="w-8 h-8 text-teal-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-teal-900">
            Sumate a nuestra red
          </h1>
          <p className="text-teal-600 mt-2">
            Completá el formulario para formar parte de Red Escucha Psicológica
          </p>
        </motion.div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  s === step
                    ? "bg-teal-600 text-white"
                    : s < step
                    ? "bg-emerald-500 text-white"
                    : "bg-teal-100 text-teal-400"
                }`}
              >
                {s < step ? <CheckCircle2 className="w-4 h-4" /> : s}
              </div>
              {s < 4 && (
                <div
                  className={`w-8 sm:w-12 h-0.5 ${
                    s < step ? "bg-emerald-500" : "bg-teal-100"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Labels */}
        <div className="grid grid-cols-4 gap-2 mb-8 text-center">
          <span className={`text-xs ${step === 1 ? "text-teal-700 font-medium" : "text-teal-400"}`}>
            Cuenta
          </span>
          <span className={`text-xs ${step === 2 ? "text-teal-700 font-medium" : "text-teal-400"}`}>
            Personal
          </span>
          <span className={`text-xs ${step === 3 ? "text-teal-700 font-medium" : "text-teal-400"}`}>
            Profesional
          </span>
          <span className={`text-xs ${step === 4 ? "text-teal-700 font-medium" : "text-teal-400"}`}>
            Atención
          </span>
        </div>

        {/* Form Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="border-teal-100 shadow-lg">
              <CardHeader>
                <CardTitle className="text-teal-900 flex items-center gap-2">
                  {step === 1 && <><Mail className="w-5 h-5" /> Datos de Cuenta</>}
                  {step === 2 && <><UserPlus className="w-5 h-5" /> Datos Personales</>}
                  {step === 3 && <><Award className="w-5 h-5" /> Datos Profesionales</>}
                  {step === 4 && <><MapPin className="w-5 h-5" /> Zonas y Atención</>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* STEP 1: Cuenta */}
                {step === 1 && (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                      Si tu cuenta es Hotmail, Live o Outlook los correos pueden llegar como no deseado (spam).
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Email *</Label>
                        <Input
                          type="email"
                          value={form.email}
                          onChange={(e) => updateForm("email", e.target.value)}
                          className="border-teal-200"
                          placeholder="tu@email.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Repetir email *</Label>
                        <Input
                          type="email"
                          value={form.confirmEmail}
                          onChange={(e) => updateForm("confirmEmail", e.target.value)}
                          className="border-teal-200"
                          placeholder="repetir@email.com"
                        />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Contraseña *</Label>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            value={form.password}
                            onChange={(e) => updateForm("password", e.target.value)}
                            className="border-teal-200 pr-10"
                            placeholder="Mínimo 6 caracteres"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-400 hover:text-teal-600"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Repetir contraseña *</Label>
                        <div className="relative">
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            value={form.confirmPassword}
                            onChange={(e) => updateForm("confirmPassword", e.target.value)}
                            className="border-teal-200 pr-10"
                            placeholder="Repetir contraseña"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-400 hover:text-teal-600"
                          >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: Datos Personales */}
                {step === 2 && (
                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Título *</Label>
                        <Select value={form.title} onValueChange={(v) => updateForm("title", v)}>
                          <SelectTrigger className="border-teal-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TITLES.map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Nombre *</Label>
                        <Input
                          value={form.firstName}
                          onChange={(e) => updateForm("firstName", e.target.value)}
                          className="border-teal-200"
                          placeholder="Tu nombre"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Apellido *</Label>
                        <Input
                          value={form.lastName}
                          onChange={(e) => updateForm("lastName", e.target.value)}
                          className="border-teal-200"
                          placeholder="Tu apellido"
                        />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Teléfono *</Label>
                        <Input
                          value={form.phone}
                          onChange={(e) => updateForm("phone", e.target.value)}
                          className="border-teal-200"
                          placeholder="1149999999 (sin 0 ni 15)"
                        />
                        <p className="text-xs text-teal-400">
                          Ingresá tu número con código de área sin el 0 y sin el 15
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>CUIT / CUIL</Label>
                        <div className="relative">
                          <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-400" />
                          <Input
                            value={form.cuil}
                            onChange={(e) => updateForm("cuil", e.target.value)}
                            className="border-teal-200 pl-10"
                            placeholder="20-12345678-9"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Sexo</Label>
                      <Select value={form.gender} onValueChange={(v) => updateForm("gender", v)}>
                        <SelectTrigger className="border-teal-200 w-full sm:w-48">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Femenino">Femenino</SelectItem>
                          <SelectItem value="Masculino">Masculino</SelectItem>
                          <SelectItem value="Otro">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* STEP 3: Datos Profesionales */}
                {step === 3 && (
                  <div className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Profesión *</Label>
                        <Select value={form.profession} onValueChange={(v) => updateForm("profession", v)}>
                          <SelectTrigger className="border-teal-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Psicólogo">Psicólogo/a</SelectItem>
                            <SelectItem value="Psiquiatra">Psiquiatra</SelectItem>
                            <SelectItem value="Psicopedagogo">Psicopedagogo/a</SelectItem>
                            <SelectItem value="Musicoterapeuta">Musicoterapeuta</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Nº de matrícula *</Label>
                        <Input
                          value={form.license}
                          onChange={(e) => updateForm("license", e.target.value)}
                          className="border-teal-200"
                          placeholder="MN-XXXXX"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Especialidad *</Label>
                      <Select value={form.specialty} onValueChange={(v) => updateForm("specialty", v)}>
                        <SelectTrigger className="border-teal-200">
                          <SelectValue placeholder="Seleccionar especialidad" />
                        </SelectTrigger>
                        <SelectContent>
                          {SPECIALTIES.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo de Terapia * (seleccioná al menos uno)</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto border border-teal-100 rounded-lg p-3">
                        {THERAPY_TYPES.map((t) => (
                          <label
                            key={t}
                            className="flex items-center gap-2 text-sm cursor-pointer hover:bg-teal-50 rounded px-1 py-0.5"
                          >
                            <Checkbox
                              checked={form.therapyTypes.includes(t)}
                              onCheckedChange={() => toggleArrayItem("therapyTypes", t)}
                            />
                            <span className="text-teal-700">{t}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Dirigido a * (seleccioná al menos uno)</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 border border-teal-100 rounded-lg p-3">
                        {TARGET_AUDIENCES.map((t) => (
                          <label
                            key={t}
                            className="flex items-center gap-2 text-sm cursor-pointer hover:bg-teal-50 rounded px-1 py-0.5"
                          >
                            <Checkbox
                              checked={form.targetAudience.includes(t)}
                              onCheckedChange={() => toggleArrayItem("targetAudience", t)}
                            />
                            <span className="text-teal-700">{t}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Modalidad de Terapia</Label>
                      <div className="grid grid-cols-2 gap-2 border border-teal-100 rounded-lg p-3">
                        {["Individual", "Grupal"].map((m) => (
                          <label
                            key={m}
                            className="flex items-center gap-2 text-sm cursor-pointer hover:bg-teal-50 rounded px-1 py-0.5"
                          >
                            <Checkbox
                              checked={form.therapyModality.includes(m)}
                              onCheckedChange={() => toggleArrayItem("therapyModality", m)}
                            />
                            <span className="text-teal-700">{m}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 4: Zonas y Atención */}
                {step === 4 && (
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Modalidad de atención *</Label>
                      <div className="grid sm:grid-cols-3 gap-3">
                        <label
                          className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                            form.onlineAttention
                              ? "border-teal-500 bg-teal-50"
                              : "border-teal-100 hover:border-teal-200"
                          }`}
                        >
                          <Checkbox
                            checked={form.onlineAttention}
                            onCheckedChange={(v) => updateForm("onlineAttention", v)}
                          />
                          <Monitor className="w-5 h-5 text-teal-600" />
                          <span className="text-sm font-medium text-teal-800">Online</span>
                        </label>
                        <label
                          className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                            form.presentialAttention
                              ? "border-teal-500 bg-teal-50"
                              : "border-teal-100 hover:border-teal-200"
                          }`}
                        >
                          <Checkbox
                            checked={form.presentialAttention}
                            onCheckedChange={(v) => updateForm("presentialAttention", v)}
                          />
                          <Home className="w-5 h-5 text-teal-600" />
                          <span className="text-sm font-medium text-teal-800">Presencial</span>
                        </label>
                        <label
                          className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                            form.homeAttention
                              ? "border-teal-500 bg-teal-50"
                              : "border-teal-100 hover:border-teal-200"
                          }`}
                        >
                          <Checkbox
                            checked={form.homeAttention}
                            onCheckedChange={(v) => updateForm("homeAttention", v)}
                          />
                          <Heart className="w-5 h-5 text-teal-600" />
                          <span className="text-sm font-medium text-teal-800">Domicilio</span>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Zonas de atención * (seleccioná al menos una)</Label>
                      <div className="grid grid-cols-2 gap-2 border border-teal-100 rounded-lg p-3 max-h-56 overflow-y-auto">
                        {ZONES.map((z) => (
                          <label
                            key={z}
                            className="flex items-center gap-2 text-sm cursor-pointer hover:bg-teal-50 rounded px-1 py-0.5"
                          >
                            <Checkbox
                              checked={form.zones.includes(z)}
                              onCheckedChange={() => toggleArrayItem("zones", z)}
                            />
                            <span className="text-teal-700">{z}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Acerca de tu práctica (opcional)</Label>
                      <textarea
                        value={form.bio}
                        onChange={(e) => updateForm("bio", e.target.value)}
                        className="w-full min-h-[80px] p-3 border border-teal-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-y"
                        placeholder="Contanos brevemente sobre tu enfoque terapéutico, experiencia o lo que consideres relevante..."
                      />
                    </div>

                    {/* Terms */}
                    <div className="border border-teal-100 rounded-lg p-4 bg-teal-50/50">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox
                          checked={acceptedTerms}
                          onCheckedChange={(v) => setAcceptedTerms(v as boolean)}
                          className="mt-0.5"
                        />
                        <span className="text-sm text-teal-700">
                          Acepto cumplir con todos los{" "}
                          <span className="font-medium text-teal-800">
                            Términos y Condiciones
                          </span>{" "}
                          de Red Escucha Psicológica, incluyendo las normas de confidencialidad y ética profesional.
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex justify-between pt-4 border-t border-teal-50">
                  <Button
                    variant="outline"
                    onClick={step === 1 ? () => setCurrentView("landing") : prevStep}
                    className="border-teal-200 text-teal-600"
                  >
                    <ArrowLeft className="mr-2 w-4 h-4" />
                    {step === 1 ? "Volver" : "Anterior"}
                  </Button>

                  {step < totalSteps ? (
                    <Button
                      onClick={nextStep}
                      className="bg-teal-600 hover:bg-teal-700 text-white"
                    >
                      Siguiente
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle2 className="mr-2 w-4 h-4" />
                      {submitting ? "Enviando..." : "Completar Registro"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
