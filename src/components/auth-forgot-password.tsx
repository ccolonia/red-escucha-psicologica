"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useAppStore } from "@/lib/store";

export function AuthForgotPassword() {
  const { setCurrentView } = useAppStore();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!email.trim()) {
      setError("Ingresá tu email");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        setSubmitted(true);
      } else {
        setError(data.error || "Ocurrió un error. Intentá de nuevo.");
      }
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  // Success state — show confirmation message
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center paper-texture px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="bg-ivory-50 border-ivory-300/50 shadow-lg">
            <CardContent className="p-6 sm:p-8 text-center">
              <div className="w-16 h-16 bg-sage-300/20 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="w-8 h-8 text-sage-500" />
              </div>
              <h2 className="text-xl font-serif font-bold text-bark-700 mb-3">
                ¡Enlace enviado!
              </h2>
              <p className="text-bark-500 font-light leading-relaxed mb-2">
                Si el correo <strong className="text-bark-700">{email}</strong> está registrado,
                recibirás un enlace para restablecer tu contraseña.
              </p>
              <p className="text-sm text-bark-400 font-light leading-relaxed mb-6">
                Revisá también la carpeta de spam o correo no deseado. El enlace es válido por 1 hora.
              </p>
              <Button
                onClick={() => setCurrentView("login")}
                className="btn-gold text-bark-900 font-semibold px-8 h-11"
              >
                Volver a Iniciar Sesión
              </Button>
            </CardContent>
          </Card>

          <div className="mt-6 text-center">
            <button
              onClick={() => setCurrentView("landing")}
              className="text-sm text-bark-400 hover:text-bark-600 inline-flex items-center gap-1 font-light transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al inicio
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Form state
  return (
    <div className="min-h-screen flex items-center justify-center paper-texture px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-5">
            <img
              src="/images/logo.png"
              alt="Red Escucha Psicológica"
              className="w-11 h-11 rounded-lg object-contain"
            />
            <div className="flex items-baseline gap-1">
              <span className="font-serif font-bold text-lg text-bark-700">Red Escucha</span>
              <span className="text-xs text-sage-500 font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>Psicológica</span>
            </div>
          </div>
          <h1 className="text-2xl font-serif font-bold text-bark-700">Recuperar Contraseña</h1>
          <p className="text-bark-500 mt-1 font-light">
            Ingresá tu email y te enviaremos un enlace de recuperación
          </p>
        </div>

        <Card className="bg-ivory-50 border-ivory-300/50 shadow-lg">
          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email" className="text-bark-700 font-medium">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bark-300" />
                  <Input
                    id="forgot-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="pl-10 border-ivory-300 bg-ivory-100 focus:border-gold-400 focus:ring-gold-400/20"
                    disabled={loading}
                  />
                </div>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-red-600 bg-red-50 border border-red-100 p-3 rounded-lg"
                >
                  {error}
                </motion.p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full btn-gold text-bark-900 font-semibold h-11"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar enlace de recuperación"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <button
            onClick={() => setCurrentView("login")}
            className="text-sm text-bark-400 hover:text-bark-600 inline-flex items-center gap-1 font-light transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Iniciar Sesión
          </button>
        </div>
      </motion.div>
    </div>
  );
}
