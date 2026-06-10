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
  ChevronDown,
  ChevronRight,
  FileText,
  Upload,
  X,
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
  "Psicología clínica",
  "Psicoanálisis",
  "Terapia cognitivo-conductual",
  "Terapias vinculares",
  "Terapia sistémica",
  "Logoterapia",
  "Terapia gestáltica",
  "Neuropsicología",
  "Sexología",
  "Mindfulness",
  "Psicología laboral / organizacional",
  "Psicología positiva",
  "Psicología forense",
  "Adicciones",
  "Trauma y EMDR",
  "Trastornos alimentarios",
  "Psiconutrición",
  "Psicooncología",
  "Psicología geriátrica",
  "Psicología deportiva",
  "Psicología perinatal",
  "Terapia humanista",
  "Terapia junguiana",
  "Psicodrama",
  "Psicoterapia Integral",
  "Terapia de Pareja y Familia",
  "Psicología Infanto-Juvenil",
  "Deportología",
  "Psicocorporal Reichiana",
  "Terapia transpersonal",
  "Terapia constructivista",
  "Otras terapias",
];

const TARGET_AUDIENCES = [
  "Niños/as",
  "Adolescentes",
  "Adultos mayores",
  "Adultos",
  "Jóvenes",
  "Parejas",
  "Familias",
  "Orientación a padres",
];

const ZONES_HIERARCHY: { region: string; areas: string[] }[] = [
  {
    region: "Capital Federal (CABA)",
    areas: [
      "Abasto", "Agronomía", "Almagro", "Balvanera (Once)", "Barracas",
      "Belgrano", "Boedo", "Caballito", "Chacarita", "Coghlan",
      "Colegiales", "Congreso - Tribunales", "Constitución", "Flores", "Floresta",
      "La Boca", "La Paternal", "Liniers", "Mataderos", "Monserrat",
      "Monte Castro", "Nueva Pompeya", "Núñez", "Palermo", "Parque Avellaneda",
      "Parque Chacabuco", "Parque Chas", "Parque Patricios", "Puerto Madero",
      "Recoleta - Barrio Norte", "Retiro", "Saavedra", "San Cristobal",
      "San Nicolas", "San Telmo", "Vélez Sarsfield", "Versalles",
      "Villa Crespo", "Villa del Parque", "Villa Devoto", "Villa General Mitre",
      "Villa Lugano", "Villa Luro", "Villa Ortúzar", "Villa Pueyrredón",
      "Villa Real", "Villa Riachuelo", "Villa Santa Rita", "Villa Soldati",
      "Villa Urquiza",
    ],
  },
  {
    region: "GBA Zona Norte",
    areas: [
      "Escobar", "General San Martin", "Pilar", "San Fernando",
      "San Isidro", "Tigre - Nordelta", "Vicente López",
    ],
  },
  {
    region: "GBA Zona Oeste",
    areas: [
      "General Rodriguez", "Hurlingham", "Ituzaingó", "La Matanza",
      "Merlo", "Moreno", "Morón", "San Miguel", "Tres de Febrero",
    ],
  },
  {
    region: "GBA Zona Sur",
    areas: [
      "Almirante Brown", "Avellaneda", "Berazategui", "Esteban Echeverría",
      "Ezeiza", "Florencio Varela", "Lanús", "Lomas de Zamora",
      "Presidente Peron", "Quilmes", "San Vicente",
    ],
  },
  {
    region: "Prov. de Buenos Aires",
    areas: ["La Plata", "Mar del Plata (MDQ)", "Tandil"],
  },
  {
    region: "Prov. de Córdoba",
    areas: ["Córdoba (Ciudad)"],
  },
  {
    region: "Prov. de Mendoza",
    areas: ["Mendoza (Ciudad)"],
  },
  {
    region: "Prov. de Santa Fe",
    areas: ["Rosario", "Santa Fe"],
  },
];

const SPECIALTIES = [
  "Psicología Clínica",
  "Terapia de Pareja y Familia",
  "Psicología Infanto-Juvenil",
  "Psiquiatría",
  "Psicopedagogía",
  "Musicoterapia",
  "Neuropsicología",
  "Psicología Laboral / Organizacional",
  "Psicología Educativa",
  "Psicología Deportiva",
  "Psicología Forense",
  "Psicología Social / Comunitaria",
  "Psicología de la Salud",
  "Sexología / Terapia Sexual",
  "Adicciones",
  "Duelo y Pérdida",
  "Trauma y EMDR",
  "Trastornos Alimentarios",
  "Psicología Geriátrica",
  "Psicología Transcultural",
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
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvFileName, setCvFileName] = useState<string>("");

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
    profession: "",
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

  // --- Restricción de entrada en tiempo real ---
  const onlyLetters = (v: string) => v.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, "");
  const onlyNumbers = (v: string) => v.replace(/[^0-9]/g, "");
  const onlyCuitFormat = (v: string) => v.replace(/[^0-9-]/g, "");
  const onlyLicenseFormat = (v: string) => v.replace(/[^0-9MNMPmnmp.\-\s]/g, "").toUpperCase();

  const updateForm = (field: string, value: unknown) => {
    let sanitized = value as string;
    if (field === "firstName" || field === "lastName") {
      sanitized = onlyLetters(sanitized);
    } else if (field === "phone") {
      sanitized = onlyNumbers(sanitized);
    } else if (field === "cuil") {
      sanitized = onlyCuitFormat(sanitized);
    } else if (field === "license") {
      sanitized = onlyLicenseFormat(sanitized);
    }
    setForm((prev) => ({ ...prev, [field]: sanitized }));
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

  const toggleRegion = (region: string) => {
    setExpandedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(region)) {
        next.delete(region);
      } else {
        next.add(region);
      }
      return next;
    });
  };

  const selectAllInRegion = (region: string, areas: string[]) => {
    setForm((prev) => {
      const currentZones = prev.zones as string[];
      const allSelected = areas.every((a) => currentZones.includes(a));
      if (allSelected) {
        // Deselect all in this region
        return { ...prev, zones: currentZones.filter((z) => !areas.includes(z)) };
      } else {
        // Select all in this region (add missing ones)
        const newZones = [...new Set([...currentZones, ...areas])];
        return { ...prev, zones: newZones };
      }
    });
  };

  const handleCvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Solo se permiten archivos PDF o Word");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("El archivo no puede superar los 10MB");
      return;
    }
    setCvFile(file);
    setCvFileName(file.name);
  };

  const removeCv = () => {
    setCvFile(null);
    setCvFileName("");
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
        if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(form.firstName.trim())) {
          toast.error("El nombre solo puede contener letras");
          return false;
        }
        if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(form.lastName.trim())) {
          toast.error("El apellido solo puede contener letras");
          return false;
        }
        if (!form.phone.trim()) {
          toast.error("Ingresá tu teléfono");
          return false;
        }
        if (!/^[0-9]+$/.test(form.phone.trim())) {
          toast.error("El teléfono solo puede contener números");
          return false;
        }
        if (form.phone.trim().length < 8 || form.phone.trim().length > 12) {
          toast.error("Ingresá un teléfono válido (código de área + número, sin 0 ni 15)");
          return false;
        }
        // CUIT/CUIL validation (optional but if filled must be valid)
        if (form.cuil.trim()) {
          const cuilClean = form.cuil.replace(/[\s.-]/g, "");
          if (!/^\d{2}\d{8}\d$/.test(cuilClean) && !/^\d{2}-\d{7,8}-\d$/.test(form.cuil.trim())) {
            toast.error("El CUIT/CUIL debe tener el formato XX-XXXXXXXX-X (11 dígitos)");
            return false;
          }
        }
        return true;

      case 3:
        if (!form.profession) {
          toast.error("Seleccioná tu profesión");
          return false;
        }
        if (!form.license.trim()) {
          toast.error("Ingresá tu número de matrícula");
          return false;
        }
        // Matrícula: MN o MP + 4-6 dígitos
        const licenseDigits = form.license.replace(/[\s.-]/g, "");
        const licenseMatch = licenseDigits.match(/^(MN|MP)(\d{4,6})$/);
        if (!licenseMatch) {
          toast.error("La matrícula debe ser MN o MP seguido de 4 a 6 dígitos (ej: MN-12345 o MP-5432)");
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
        if (!cvFile) {
          toast.error("Adjuntá tu CV / Curriculum es obligatorio");
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
      const fullName = `${form.title && form.title !== "Ninguno" ? form.title + " " : ""}${form.firstName} ${form.lastName}`;

      // Convert CV to base64
      let cvBase64: string | null = null;
      let cvOriginalName: string | null = null;
      let cvMimeType: string | null = null;
      if (cvFile) {
        cvOriginalName = cvFile.name;
        cvMimeType = cvFile.type;
        const arrayBuffer = await cvFile.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        cvBase64 = btoa(binary);
      }

      const payload: Record<string, unknown> = {
        name: fullName,
        email: form.email,
        phone: form.phone,
        password: form.password,
        role: "professional",
        profession: form.profession,
        license: form.license,
        specialty: form.specialty,
        bio: form.bio || null,
        title: form.title || null,
        cuil: form.cuil || null,
        gender: form.gender || null,
        therapyTypes: form.therapyTypes,
        targetAudience: form.targetAudience,
        therapyModality: form.therapyModality,
        onlineAttention: form.onlineAttention,
        presentialAttention: form.presentialAttention,
        homeAttention: form.homeAttention,
        zones: form.zones,
        cvBase64,
        cvOriginalName,
        cvMimeType,
      };

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      <div className="min-h-screen bg-beige-100 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center"
        >
          <div className="w-20 h-20 rounded-full bg-sage-300/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-sage-500" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-forest-500 mb-3">
            ¡Registro enviado!
          </h1>
          <p className="text-forest-400 font-light mb-2" style={{ fontFamily: "Montserrat, sans-serif" }}>
            Tu solicitud fue enviada exitosamente. Un administrador la revisará y activará tu cuenta.
          </p>
          <p className="text-forest-300 text-sm mb-8 font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
            Recibirás un email de confirmación cuando tu cuenta sea aprobada.
          </p>
          <Button
            className="btn-sage text-forest-900 font-semibold px-8 h-11 rounded-full"
            style={{ fontFamily: "Montserrat, sans-serif" }}
            onClick={() => { history.replaceState(null, "", window.location.pathname); setCurrentView("landing"); }}
          >
            <ArrowLeft className="mr-2 w-4 h-4" />
            Volver al inicio
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-beige-100">
      {/* Header */}
      <div className="bg-forest-900">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => { history.replaceState(null, "", window.location.pathname); setCurrentView("landing"); }}
            className="p-2 text-beige-200 hover:text-sage-300 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <img
              src="/images/logo.png"
              alt="Red Escucha Psicológica"
              className="w-8 h-8 rounded-lg object-contain"
            />
            <div className="flex items-baseline gap-1">
              <span className="font-serif font-bold text-sm text-beige-50">Red Escucha</span>
              <span className="text-[10px] text-sage-300 font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>Psicológica</span>
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
          <div className="w-16 h-16 rounded-full bg-sage-300/15 flex items-center justify-center mx-auto mb-4">
            <Stethoscope className="w-8 h-8 text-sage-500" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-forest-500">
            Sumate a nuestra red
          </h1>
          <p className="text-forest-400 mt-2 font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
            Completá el formulario para formar parte de Red Escucha Psicológica
          </p>
        </motion.div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  s === step
                    ? "bg-forest-500 text-beige-50"
                    : s < step
                    ? "bg-sage-300 text-forest-900"
                    : "bg-beige-300 text-forest-300"
                }`}
              >
                {s < step ? <CheckCircle2 className="w-4 h-4" /> : s}
              </div>
              {s < 4 && (
                <div
                  className={`w-8 sm:w-12 h-0.5 ${
                    s < step ? "bg-sage-300" : "bg-beige-300"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Labels */}
        <div className="grid grid-cols-4 gap-2 mb-8 text-center">
          <span className={`text-xs ${step === 1 ? "text-forest-500 font-medium" : "text-forest-300"}`} style={{ fontFamily: "Montserrat, sans-serif" }}>
            Cuenta
          </span>
          <span className={`text-xs ${step === 2 ? "text-forest-500 font-medium" : "text-forest-300"}`} style={{ fontFamily: "Montserrat, sans-serif" }}>
            Personal
          </span>
          <span className={`text-xs ${step === 3 ? "text-forest-500 font-medium" : "text-forest-300"}`} style={{ fontFamily: "Montserrat, sans-serif" }}>
            Profesional
          </span>
          <span className={`text-xs ${step === 4 ? "text-forest-500 font-medium" : "text-forest-300"}`} style={{ fontFamily: "Montserrat, sans-serif" }}>
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
            <Card className="border-beige-300/50 shadow-lg bg-white">
              <CardHeader>
                <CardTitle className="text-forest-500 font-serif flex items-center gap-2">
                  {step === 1 && <><Mail className="w-5 h-5 text-sage-500" /> Datos de Cuenta</>}
                  {step === 2 && <><UserPlus className="w-5 h-5 text-sage-500" /> Datos Personales</>}
                  {step === 3 && <><Award className="w-5 h-5 text-sage-500" /> Datos Profesionales</>}
                  {step === 4 && <><MapPin className="w-5 h-5 text-sage-500" /> Zonas y Atención</>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* STEP 1: Cuenta */}
                {step === 1 && (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800" style={{ fontFamily: "Montserrat, sans-serif" }}>
                      Si tu cuenta es Hotmail, Live o Outlook los correos pueden llegar como no deseado (spam).
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>Email *</Label>
                        <Input
                          type="email"
                          value={form.email}
                          onChange={(e) => updateForm("email", e.target.value)}
                          className="border-beige-300 bg-beige-50 focus:ring-sage-300/20"
                          placeholder="tu@email.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>Repetir email *</Label>
                        <Input
                          type="email"
                          value={form.confirmEmail}
                          onChange={(e) => updateForm("confirmEmail", e.target.value)}
                          className="border-beige-300 bg-beige-50 focus:ring-sage-300/20"
                          placeholder="repetir@email.com"
                        />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>Contraseña *</Label>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            value={form.password}
                            onChange={(e) => updateForm("password", e.target.value)}
                            className="border-beige-300 bg-beige-50 pr-10 focus:ring-sage-300/20"
                            placeholder="Mínimo 6 caracteres"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-forest-300 hover:text-forest-500"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>Repetir contraseña *</Label>
                        <div className="relative">
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            value={form.confirmPassword}
                            onChange={(e) => updateForm("confirmPassword", e.target.value)}
                            className="border-beige-300 bg-beige-50 pr-10 focus:ring-sage-300/20"
                            placeholder="Repetir contraseña"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-forest-300 hover:text-forest-500"
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
                        <Label className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>Título *</Label>
                        <Select value={form.title} onValueChange={(v) => updateForm("title", v)}>
                          <SelectTrigger className="border-beige-300 bg-beige-50">
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
                        <Label className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>Nombre *</Label>
                        <Input
                          value={form.firstName}
                          onChange={(e) => updateForm("firstName", e.target.value)}
                          className="border-beige-300 bg-beige-50 focus:ring-sage-300/20"
                          placeholder="Tu nombre"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>Apellido *</Label>
                        <Input
                          value={form.lastName}
                          onChange={(e) => updateForm("lastName", e.target.value)}
                          className="border-beige-300 bg-beige-50 focus:ring-sage-300/20"
                          placeholder="Tu apellido"
                        />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>Teléfono *</Label>
                        <Input
                          value={form.phone}
                          onChange={(e) => updateForm("phone", e.target.value)}
                          className="border-beige-300 bg-beige-50 focus:ring-sage-300/20"
                          placeholder="1149999999 (sin 0 ni 15)"
                        />
                        <p className="text-xs text-forest-300 font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
                          Ingresá tu número con código de área sin el 0 y sin el 15
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>CUIT / CUIL</Label>
                        <div className="relative">
                          <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forest-300" />
                          <Input
                            value={form.cuil}
                            onChange={(e) => updateForm("cuil", e.target.value)}
                            className="border-beige-300 bg-beige-50 pl-10 focus:ring-sage-300/20"
                            placeholder="20-12345678-9"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>Sexo</Label>
                      <Select value={form.gender} onValueChange={(v) => updateForm("gender", v)}>
                        <SelectTrigger className="border-beige-300 bg-beige-50 w-full sm:w-48">
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
                        <Label className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>Profesión *</Label>
                        <Select value={form.profession} onValueChange={(v) => updateForm("profession", v)}>
                          <SelectTrigger className="border-beige-300 bg-beige-50">
                            <SelectValue placeholder="Seleccionar profesión" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Psicólogo">Psicólogo/a</SelectItem>
                            <SelectItem value="Psiquiatra">Psiquiatra</SelectItem>
                            <SelectItem value="Psicopedagogo">Psicopedagogo/a</SelectItem>
                            <SelectItem value="Musicoterapeuta">Musicoterapeuta</SelectItem>
                            <SelectItem value="Licenciado en Psicología">Lic. en Psicología</SelectItem>
                            <SelectItem value="Doctor en Psicología">Dr. en Psicología</SelectItem>
                            <SelectItem value="Neuropsicólogo">Neuropsicólogo/a</SelectItem>
                            <SelectItem value="Terapista Ocupacional">Terapista Ocupacional</SelectItem>
                            <SelectItem value="Trabajador Social">Trabajador/a Social</SelectItem>
                            <SelectItem value="Coach Profesional">Coach Profesional</SelectItem>
                            <SelectItem value="Estimulador/ora Temprana">Estimulador/ora Temprana</SelectItem>
                            <SelectItem value="Neuropsicomotrista">Neuropsicomotrista</SelectItem>
                            <SelectItem value="Neuropsicolingüista">Neuropsicolingüista</SelectItem>
                            <SelectItem value="Nutricionista">Nutricionista</SelectItem>
                            <SelectItem value="Fonoaudiólogo/a">Fonoaudiólogo/a</SelectItem>
                            <SelectItem value="Otra">Otra</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>Nº de matrícula *</Label>
                        <Input
                          value={form.license}
                          onChange={(e) => updateForm("license", e.target.value)}
                          className="border-beige-300 bg-beige-50 focus:ring-sage-300/20"
                          placeholder="MN-12345 o MP-5432"
                        />
                      </div>
                    </div>
                    {/* CV Upload */}
                    <div className="space-y-2">
                      <Label className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>CV / Curriculum *</Label>
                      <p className="text-xs text-forest-300 font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
                        Adjuntá tu curriculum en formato PDF o Word (máx. 10MB). Es obligatorio para validar tu perfil profesional.
                      </p>
                      {cvFileName ? (
                        <div className="flex items-center gap-2 p-3 bg-sage-300/10 border border-sage-300/30 rounded-lg">
                          <FileText className="w-5 h-5 text-sage-500 shrink-0" />
                          <span className="text-sm text-forest-500 truncate flex-1" style={{ fontFamily: "Montserrat, sans-serif" }}>{cvFileName}</span>
                          <button
                            type="button"
                            onClick={removeCv}
                            className="p-1 text-forest-300 hover:text-red-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex items-center gap-3 p-4 border-2 border-dashed border-beige-300 rounded-lg cursor-pointer hover:border-sage-300/50 hover:bg-sage-300/5 transition-colors">
                          <Upload className="w-5 h-5 text-forest-300" />
                          <span className="text-sm text-forest-400 font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
                            Hacé clic para adjuntar tu CV
                          </span>
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx"
                            onChange={handleCvUpload}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>Especialidad *</Label>
                      <Select value={form.specialty} onValueChange={(v) => updateForm("specialty", v)}>
                        <SelectTrigger className="border-beige-300 bg-beige-50">
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
                      <Label className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>Tipo de Terapia * (seleccioná al menos uno)</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto border border-beige-300 rounded-lg p-3 bg-beige-50">
                        {THERAPY_TYPES.map((t) => (
                          <label
                            key={t}
                            className="flex items-center gap-2 text-sm cursor-pointer hover:bg-sage-300/10 rounded px-1 py-0.5 transition-colors"
                          >
                            <Checkbox
                              checked={form.therapyTypes.includes(t)}
                              onCheckedChange={() => toggleArrayItem("therapyTypes", t)}
                            />
                            <span className="text-forest-500">{t}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>Dirigido a * (seleccioná al menos uno)</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 border border-beige-300 rounded-lg p-3 bg-beige-50">
                        {TARGET_AUDIENCES.map((t) => (
                          <label
                            key={t}
                            className="flex items-center gap-2 text-sm cursor-pointer hover:bg-sage-300/10 rounded px-1 py-0.5 transition-colors"
                          >
                            <Checkbox
                              checked={form.targetAudience.includes(t)}
                              onCheckedChange={() => toggleArrayItem("targetAudience", t)}
                            />
                            <span className="text-forest-500">{t}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>Modalidad de Terapia</Label>
                      <div className="grid grid-cols-2 gap-2 border border-beige-300 rounded-lg p-3 bg-beige-50">
                        {["Individual", "Vincular", "Evaluaciones", "Terapia Grupal", "Orientación a Padres", "Asesoría a Empresas"].map((m) => (
                          <label
                            key={m}
                            className="flex items-center gap-2 text-sm cursor-pointer hover:bg-sage-300/10 rounded px-1 py-0.5 transition-colors"
                          >
                            <Checkbox
                              checked={form.therapyModality.includes(m)}
                              onCheckedChange={() => toggleArrayItem("therapyModality", m)}
                            />
                            <span className="text-forest-500">{m}</span>
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
                      <Label className="text-forest-500 font-medium text-base" style={{ fontFamily: "Montserrat, sans-serif" }}>Modalidad de atención *</Label>
                      <div className="grid sm:grid-cols-3 gap-3">
                        <label
                          className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                            form.onlineAttention
                              ? "border-sage-300 bg-sage-300/10"
                              : "border-beige-300 hover:border-sage-300/50"
                          }`}
                        >
                          <Checkbox
                            checked={form.onlineAttention}
                            onCheckedChange={(v) => updateForm("onlineAttention", v)}
                          />
                          <Monitor className="w-5 h-5 text-sage-500" />
                          <span className="text-sm font-medium text-forest-500" style={{ fontFamily: "Montserrat, sans-serif" }}>Online</span>
                        </label>
                        <label
                          className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                            form.presentialAttention
                              ? "border-sage-300 bg-sage-300/10"
                              : "border-beige-300 hover:border-sage-300/50"
                          }`}
                        >
                          <Checkbox
                            checked={form.presentialAttention}
                            onCheckedChange={(v) => updateForm("presentialAttention", v)}
                          />
                          <Home className="w-5 h-5 text-sage-500" />
                          <span className="text-sm font-medium text-forest-500" style={{ fontFamily: "Montserrat, sans-serif" }}>Presencial</span>
                        </label>
                        <label
                          className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                            form.homeAttention
                              ? "border-sage-300 bg-sage-300/10"
                              : "border-beige-300 hover:border-sage-300/50"
                          }`}
                        >
                          <Checkbox
                            checked={form.homeAttention}
                            onCheckedChange={(v) => updateForm("homeAttention", v)}
                          />
                          <Heart className="w-5 h-5 text-sage-500" />
                          <span className="text-sm font-medium text-forest-500" style={{ fontFamily: "Montserrat, sans-serif" }}>Domicilio</span>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-forest-500 font-medium text-base" style={{ fontFamily: "Montserrat, sans-serif" }}>Zonas de atención * (seleccioná al menos una)</Label>
                      {form.zones.length > 0 && (
                        <p className="text-xs text-sage-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>
                          {form.zones.length} zona{form.zones.length !== 1 ? "s" : ""} seleccionada{form.zones.length !== 1 ? "s" : ""}
                        </p>
                      )}
                      <div className="border border-beige-300 rounded-lg bg-beige-50 max-h-80 overflow-y-auto">
                        {ZONES_HIERARCHY.map((zoneGroup) => {
                          const isExpanded = expandedRegions.has(zoneGroup.region);
                          const selectedInRegion = zoneGroup.areas.filter((a) => form.zones.includes(a));
                          const allSelected = zoneGroup.areas.length > 0 && selectedInRegion.length === zoneGroup.areas.length;
                          const someSelected = selectedInRegion.length > 0 && !allSelected;

                          return (
                            <div key={zoneGroup.region} className="border-b border-beige-200 last:border-b-0">
                              {/* Region header */}
                              <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-sage-300/10 cursor-pointer transition-colors" onClick={() => toggleRegion(zoneGroup.region)}>
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-forest-400 shrink-0" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-forest-400 shrink-0" />
                                )}
                                <Checkbox
                                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                                  onCheckedChange={() => selectAllInRegion(zoneGroup.region, zoneGroup.areas)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span className="text-sm font-semibold text-forest-600 flex-1" style={{ fontFamily: "Montserrat, sans-serif" }}>
                                  {zoneGroup.region}
                                </span>
                                {selectedInRegion.length > 0 && (
                                  <span className="text-xs text-sage-500 bg-sage-300/20 px-2 py-0.5 rounded-full" style={{ fontFamily: "Montserrat, sans-serif" }}>
                                    {selectedInRegion.length}/{zoneGroup.areas.length}
                                  </span>
                                )}
                              </div>

                              {/* Areas list */}
                              {isExpanded && (
                                <div className="pl-10 pr-3 pb-2 grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-0.5">
                                  {zoneGroup.areas.map((area) => (
                                    <label
                                      key={area}
                                      className="flex items-center gap-2 text-sm cursor-pointer hover:bg-sage-300/10 rounded px-1 py-0.5 transition-colors"
                                    >
                                      <Checkbox
                                        checked={form.zones.includes(area)}
                                        onCheckedChange={() => toggleArrayItem("zones", area)}
                                      />
                                      <span className="text-forest-500 text-xs sm:text-sm">{area}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>Acerca de tu práctica (opcional)</Label>
                      <textarea
                        value={form.bio}
                        onChange={(e) => updateForm("bio", e.target.value)}
                        className="w-full min-h-[80px] p-3 border border-beige-300 bg-beige-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sage-300/20 focus:border-sage-300 resize-y text-forest-600"
                        placeholder="Contanos brevemente sobre tu enfoque terapéutico, experiencia o lo que consideres relevante..."
                      />
                    </div>

                    {/* Terms */}
                    <div className="border border-beige-300 rounded-lg p-4 bg-sage-300/5">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox
                          checked={acceptedTerms}
                          onCheckedChange={(v) => setAcceptedTerms(v as boolean)}
                          className="mt-0.5"
                        />
                        <span className="text-sm text-forest-400 font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
                          Acepto cumplir con todos los{" "}
                          <span className="font-medium text-forest-500">
                            Términos y Condiciones
                          </span>{" "}
                          de Red Escucha Psicológica, incluyendo las normas de confidencialidad y ética profesional.
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex justify-between pt-4 border-t border-beige-200">
                  <Button
                    variant="outline"
                    onClick={step === 1 ? () => { history.replaceState(null, "", window.location.pathname); setCurrentView("landing"); } : prevStep}
                    className="border-beige-300 text-forest-400 hover:text-forest-600 hover:bg-beige-50"
                    style={{ fontFamily: "Montserrat, sans-serif" }}
                  >
                    <ArrowLeft className="mr-2 w-4 h-4" />
                    {step === 1 ? "Volver" : "Anterior"}
                  </Button>

                  {step < totalSteps ? (
                    <Button
                      onClick={nextStep}
                      className="btn-sage text-forest-900 font-semibold"
                      style={{ fontFamily: "Montserrat, sans-serif" }}
                    >
                      Siguiente
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="bg-forest-500 hover:bg-forest-600 text-beige-50 font-semibold"
                      style={{ fontFamily: "Montserrat, sans-serif" }}
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
