"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";

// ============================================================================
// GlobalAudioPlayer — Reproductor de audio ambiente persistente
// ============================================================================
//
// Arquitectura:
//   - Se monta UNA sola vez en layout.tsx (fuera de la jerarquía de páginas)
//   - El elemento <audio> se mantiene vivo entre navegaciones de Next.js
//   - Usa useRef para acceso directo al elemento DOM (sin re-renders)
//
// Autoplay policy handling:
//   1. Al montar: intenta play() automáticamente.
//   2. Si el navegador bloquea (NotAllowedError): registra listeners de
//      interacción (click/touchstart/scroll) e inicia reproducción al
//      primer evento, removiendo los listeners automáticamente.
//   3. Una vez iniciado, el usuario puede pausar/reanudar con el botón.
//
// UI:
//   - Flotante bottom-right, glassmorphism con backdrop-blur.
//   - Micro-ecualizador animado de 4 barritas cuando está reproduciendo.
//   - Volume2 / VolumeX de Lucide para indicar estado.
//   - Tooltip sutil al hover.
//   - Tamaño compacto en mobile (sm:bottom-4 sm:right-4).
// ============================================================================

interface GlobalAudioPlayerProps {
  /** Ruta del archivo de audio dentro de /public */
  src?: string;
  /** Volumen inicial (0-1). Default: 0.45 (sutil, no intrusivo) */
  volume?: number;
}

export function GlobalAudioPlayer({
  src = "/audio/despues-de-la-tormenta.mp3",
  volume = 0.45,
}: GlobalAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // ========================================================================
  // 1. Inicialización: NO autoplay — solo setear volumen
  // ========================================================================
  // La música NUNCA se reproduce automáticamente al cargar la página.
  // El usuario debe hacer clic explícito en el botón Play para iniciar.
  // Esto cumple con las políticas de autoplay de los navegadores y
  // mejora la UX (no sorprende al usuario con música inesperada).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.pause();
    setIsPlaying(false);
  }, [src, volume]);

  // ========================================================================
  // 2. Toggle play/pause desde el botón (control exclusivo del usuario)
  // ========================================================================
  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        // Silencioso: si el navegador bloquea por alguna razón
      }
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, []);

  // ========================================================================
  // 3. Render
  // ========================================================================
  return (
    <div
      className="fixed top-20 right-4 sm:top-24 sm:right-8 z-50"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Tooltip flotante — se despliega hacia ABAJO desde el botón (origen top-right)
          para no cortarse con el borde superior de la pantalla */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute right-0 top-full mt-2 px-3 py-1.5 bg-emerald-950/90 text-white text-xs font-medium rounded-lg shadow-lg whitespace-nowrap pointer-events-none backdrop-blur-sm border border-emerald-100/10 origin-top-right"
          >
            {isPlaying ? "Desactivar música de fondo" : "Activar música de fondo"}
            {/* Flecha triangular pointing up hacia el botón */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full -mb-1 w-2 h-2 bg-emerald-950/90 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botón principal */}
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? "Pausar música de fondo" : "Reproducir música de fondo"}
        aria-pressed={isPlaying}
        className="group relative flex items-center gap-2 px-3 py-2 rounded-full bg-white/80 hover:bg-white/90 backdrop-blur-md border border-emerald-100/40 shadow-lg transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      >
        {/* Elemento audio (invisible) */}
        <audio
          ref={audioRef}
          src={src}
          loop
          preload="auto"
          className="hidden"
          aria-hidden="true"
        />

        {/* Micro-ecualizador animado (visible solo cuando está reproduciendo) */}
        <div className="flex items-end gap-[2px] h-4 w-5" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="flex-1 bg-emerald-500 rounded-full origin-bottom"
              style={{ minHeight: "3px" }}
              initial={{ height: "30%" }}
              animate={
                isPlaying
                  ? {
                      height: ["30%", "100%", "50%", "85%", "40%", "70%", "30%"],
                    }
                  : { height: "30%", opacity: 0.35 }
              }
              transition={
                isPlaying
                  ? {
                      duration: 1.2 + i * 0.15,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: i * 0.1,
                    }
                  : { duration: 0.3 }
              }
            />
          ))}
        </div>

        {/* Ícono de altavoz (con transición suave) */}
        <div className="relative w-4 h-4 flex items-center justify-center">
          <motion.div
            initial={false}
            animate={{
              opacity: isPlaying ? 1 : 0,
              scale: isPlaying ? 1 : 0.7,
            }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Volume2 className="w-4 h-4 text-emerald-700" strokeWidth={2} />
          </motion.div>
          <motion.div
            initial={false}
            animate={{
              opacity: isPlaying ? 0 : 1,
              scale: isPlaying ? 0.7 : 1,
            }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <VolumeX className="w-4 h-4 text-emerald-600/70" strokeWidth={2} />
          </motion.div>
        </div>

        {/* Punto indicador de estado (sutil, esquina superior derecha) */}
        <motion.span
          className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
          animate={{
            backgroundColor: isPlaying ? "#10B981" : "#9CA3AF",
            opacity: isPlaying ? 0.9 : 0.5,
          }}
          transition={{ duration: 0.3 }}
        />
      </button>
    </div>
  );
}
