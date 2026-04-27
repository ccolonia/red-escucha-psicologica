"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import { Leaf, Mail, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useAppStore } from "@/lib/store";

export function AuthLogin() {
  const { setCurrentView } = useAppStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Email o contraseña incorrectos");
      setLoading(false);
    }
    // If successful, session will update and redirect happens via main page
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-emerald-50/30 to-white px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center">
              <Leaf className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-2xl text-teal-800">AP</span>
          </div>
          <h1 className="text-2xl font-bold text-teal-900">Iniciar Sesión</h1>
          <p className="text-teal-600 mt-1">Ingresá a tu cuenta</p>
        </div>

        <Card className="border-teal-100 shadow-lg">
          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-400" />
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="pl-10 border-teal-200 focus:border-teal-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 pr-10 border-teal-200 focus:border-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-400 hover:text-teal-600"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-red-500 bg-red-50 p-3 rounded-lg"
                >
                  {error}
                </motion.p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white h-11"
              >
                {loading ? "Ingresando..." : "Ingresar"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-teal-600">
                ¿No tenés cuenta?{" "}
                <button
                  onClick={() => setCurrentView("register")}
                  className="text-teal-700 font-semibold hover:underline"
                >
                  Registrate
                </button>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <button
            onClick={() => setCurrentView("landing")}
            className="text-sm text-teal-500 hover:text-teal-700 inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </button>
        </div>
      </motion.div>
    </div>
  );
}
