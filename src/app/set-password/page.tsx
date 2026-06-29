"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Leaf, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setTokenError("No se proporcionó un token válido");
      setValidating(false);
      return;
    }

    fetch(`/api/auth/set-password?token=${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setTokenValid(true);
        } else {
          setTokenError(data.error || "Token inválido");
        }
      })
      .catch(() => {
        setTokenError("Error al verificar el enlace");
      })
      .finally(() => {
        setValidating(false);
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres, una mayúscula y un símbolo");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError("La contraseña debe incluir al menos una letra mayúscula");
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>_+\-=]/.test(password)) {
      setError("La contraseña debe incluir al menos un símbolo (!, $, #, etc.)");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error || "Error al establecer la contraseña");
      }
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  // Validating token
  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-beige-100">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-sage-500 animate-spin mx-auto mb-4" />
          <p className="text-forest-500 font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
            Verificando enlace...
          </p>
        </div>
      </div>
    );
  }

  // Token invalid or expired
  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-beige-100">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-xl font-serif font-bold text-forest-500 mb-3">
              Enlace no válido
            </h1>
            <p className="text-forest-400 font-light mb-6" style={{ fontFamily: "Montserrat, sans-serif" }}>
              {tokenError}
            </p>
            <p className="text-sm text-forest-300 font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Contactá al administrador en{" "}
              <a href="mailto:contacto@redescuchapsicologica.com" className="text-sage-500 underline">
                contacto@redescuchapsicologica.com
              </a>{" "}
              para solicitar un nuevo enlace.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Success
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-beige-100">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-sage-300/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-sage-500" />
            </div>
            <h1 className="text-xl font-serif font-bold text-forest-500 mb-3">
              ¡Contraseña establecida!
            </h1>
            <p className="text-forest-400 font-light mb-6" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Tu contraseña ha sido creada exitosamente. Ya podés ingresar a tu cuenta.
            </p>
            <Button
              onClick={() => router.push("/")}
              className="btn-sage text-forest-900 font-semibold px-8 h-11 rounded-full"
              style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              Ir a Iniciar Sesión
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Set password form
  return (
    <div className="min-h-screen flex items-center justify-center bg-beige-100 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-forest-900 px-8 py-8 text-center">
            <img
              src="/images/logo.png"
              alt="Red Escucha Psicológica"
              className="w-14 h-14 rounded-full mx-auto mb-4 object-contain"
            />
            <h1 className="text-xl font-serif font-bold text-beige-50">
              Establecer Contraseña
            </h1>
            <p className="text-beige-200 text-sm mt-2 font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Red Escucha Psicológica
            </p>
          </div>

          {/* Form */}
          <div className="p-8">
            <p className="text-forest-400 text-sm mb-6 font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Creá tu contraseña para acceder a la plataforma.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  Nueva Contraseña
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ingresá tu contraseña"
                    className="border-beige-300 bg-beige-50 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-forest-300 hover:text-forest-500"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* === Micro-badges de validación en tiempo real === */}
                {(() => {
                  const hasMinLength = password.length >= 8;
                  const hasUppercase = /[A-Z]/.test(password);
                  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>_+\-=]/.test(password);
                  return (
                    <div className={`flex flex-col gap-0.5 pt-1 transition-opacity ${password ? "opacity-100" : "opacity-0"}`}>
                      <span className={`text-[10px] flex items-center gap-1 transition-colors ${hasMinLength ? "text-emerald-600" : "text-slate-400"}`}>
                        {hasMinLength ? "✓" : "•"} Mínimo 8 caracteres
                      </span>
                      <span className={`text-[10px] flex items-center gap-1 transition-colors ${hasUppercase ? "text-emerald-600" : "text-slate-400"}`}>
                        {hasUppercase ? "✓" : "•"} Una mayúscula
                      </span>
                      <span className={`text-[10px] flex items-center gap-1 transition-colors ${hasSpecialChar ? "text-emerald-600" : "text-slate-400"}`}>
                        {hasSpecialChar ? "✓" : "•"} Un símbolo (!, $, #...)
                      </span>
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-forest-500 font-medium" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  Confirmar Contraseña
                </Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repetí la contraseña"
                    className={`bg-beige-50 pr-10 transition-colors ${
                      confirmPassword && confirmPassword === password
                        ? "border-emerald-400"
                        : confirmPassword
                          ? "border-red-400"
                          : "border-beige-300"
                    }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-forest-300 hover:text-forest-500"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* === Indicador de coincidencia === */}
                {confirmPassword && (
                  <div className={`text-[10px] flex items-center gap-1 transition-colors ${
                    confirmPassword === password ? "text-emerald-600" : "text-red-500"
                  }`}>
                    {confirmPassword === password
                      ? <>✓ Las contraseñas coinciden</>
                      : <>✗ Las contraseñas no coinciden</>
                    }
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={
                  loading ||
                  !(
                    password.length >= 8 &&
                    /[A-Z]/.test(password) &&
                    /[!@#$%^&*(),.?":{}|<>_+\-=]/.test(password) &&
                    password === confirmPassword
                  )
                }
                className="w-full btn-sage text-forest-900 font-semibold h-11 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Establecer Contraseña"
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function SetPasswordFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-beige-100">
      <div className="text-center">
        <Loader2 className="w-10 h-10 text-sage-500 animate-spin mx-auto mb-4" />
        <p className="text-forest-500 font-light" style={{ fontFamily: "Montserrat, sans-serif" }}>
          Cargando...
        </p>
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<SetPasswordFallback />}>
      <SetPasswordContent />
    </Suspense>
  );
}
