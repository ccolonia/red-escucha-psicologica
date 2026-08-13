"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send } from "lucide-react";

/**
 * Widget Flotante de WhatsApp Interactivo con modal de chat desplegable.
 *
 * Diseño:
 *  - Botón FAB verde (#25D366) fijo en bottom-right con badge de notificación rojo
 *  - Al hacer clic, abre un popup con:
 *      Header: verde esmeralda REP (#10B981), logo circular + estado "En Línea"
 *      Body: fondo gris claro (#F0F2F5), burbuja de bienvenida tipo WhatsApp
 *      Footer: botón "Iniciar Conversación" que abre wa.me en pestaña nueva
 *
 * El número de WhatsApp se obtiene desde /api/cms/content (campo whatsapp_number)
 * con fallback al número corporativo por defecto.
 *
 * Se monta globalmente en <Providers/> pero se oculta para admins (tienen panel).
 * No se muestra si ya hay un FloatingChatWidget abierto (evita superposición
 * de dos popups verdes al mismo tiempo).
 */

const DEFAULT_WHATSAPP_NUMBER = "541168667898";
const DEFAULT_WHATSAPP_MESSAGE = "Hola, quisiera recibir información";

export function WhatsAppFloat() {
  const [isOpen, setIsOpen] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState(DEFAULT_WHATSAPP_NUMBER);
  const [whatsappMessage, setWhatsappMessage] = useState(DEFAULT_WHATSAPP_MESSAGE);
  const [currentTime, setCurrentTime] = useState("");
  const popupRef = useRef<HTMLDivElement | null>(null);

  // Cargar config de WhatsApp desde CMS
  useEffect(() => {
    fetch("/api/cms/content")
      .then((res) => res.json())
      .then((data) => {
        if (data.config?.whatsapp_number) {
          setWhatsappNumber(data.config.whatsapp_number);
        }
        if (data.config?.whatsapp_message) {
          setWhatsappMessage(data.config.whatsapp_message);
        }
      })
      .catch(() => {
        /* fallback a defaults */
      });
  }, []);

  // Hora actual dinámica para la burbuja de mensaje
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      setCurrentTime(`${hours}:${minutes}`);
    };
    updateTime();
    // Actualizar cada minuto por si el usuario deja el popup abierto
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Cerrar popup al hacer clic fuera
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        // No cerrar si el clic fue en el botón FAB (lo maneja el toggle)
        const target = e.target as HTMLElement;
        if (target.closest("[data-whatsapp-fab]")) return;
        setIsOpen(false);
      }
    };
    // Pequeño delay para evitar que el clic que abre también cierre
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Cerrar con tecla Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const handleStartConversation = () => {
    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50" ref={popupRef}>
      {/* Popup de chat (desplegable hacia arriba) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="whatsapp-popup"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute bottom-16 right-0 w-[calc(100vw-3rem)] sm:w-[360px] bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
          >
            {/* === Header (verde esmeralda REP) === */}
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Avatar circular con logo REP + badge en línea */}
                <div className="relative shrink-0">
                  <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-white/30">
                    {/* Logo REP circular HD */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/icon-192.png"
                      alt="REP"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {/* Badge verde "En Línea" */}
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-white" />
                </div>
                <div className="min-w-0 text-white">
                  <p className="font-bold text-sm leading-tight">REP</p>
                  <p className="text-[10px] text-emerald-50 leading-tight" style={{ fontFamily: "Montserrat, sans-serif" }}>
                    Escuchar · Acompañar · Transformar
                  </p>
                  <p className="text-[10px] text-emerald-100 flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-300 inline-block animate-pulse" />
                    Normalmente responde en unos minutos...
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded hover:bg-white/10 transition-colors shrink-0"
                aria-label="Cerrar chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* === Body (fondo gris claro tipo WhatsApp) === */}
            <div
              className="px-4 py-5 min-h-[140px]"
              style={{ backgroundColor: "#F0F2F5" }}
            >
              {/* Burbuja de mensaje recibido (estilo WhatsApp) */}
              <div className="relative bg-white rounded-lg shadow-sm px-3 py-2.5 max-w-[85%] ml-0">
                {/* Flechita a la izquierda (estilo WhatsApp recibido) */}
                <div
                  className="absolute -left-1.5 top-3 w-0 h-0"
                  style={{
                    borderTop: "6px solid transparent",
                    borderBottom: "6px solid transparent",
                    borderRight: "8px solid white",
                  }}
                />
                <p className="text-[11px] font-semibold text-emerald-700 mb-0.5">REP</p>
                <p className="text-sm text-slate-700 leading-snug">
                  Hola 🙂
                  <br />
                  <span className="font-medium">¿Cómo te puedo ayudar?</span>
                </p>
                <p className="text-[9px] text-slate-400 text-right mt-1">{currentTime}</p>
              </div>
            </div>

            {/* === Footer (botón Iniciar Conversación) === */}
            <div className="bg-white px-4 py-3 border-t border-slate-100">
              <button
                onClick={handleStartConversation}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium text-sm transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                  boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
                }}
              >
                {/* Ícono WhatsApp SVG oficial */}
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" aria-hidden>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Iniciar Conversación
                <Send className="w-3.5 h-3.5 opacity-80" />
              </button>
              <p className="text-[9px] text-slate-400 text-center mt-1.5">
                Te redirigirá a WhatsApp con un mensaje pre-cargado
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === Botón FAB flotante (trigger) === */}
      <motion.button
        data-whatsapp-fab
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
        style={{
          backgroundColor: "#25D366",
          boxShadow: "0 4px 16px rgba(37, 211, 102, 0.4)",
        }}
        aria-label={isOpen ? "Cerrar chat de WhatsApp" : "Abrir chat de WhatsApp"}
        whileTap={{ scale: 0.95 }}
      >
        {isOpen ? (
          <X className="w-7 h-7 text-white" />
        ) : (
          <>
            {/* Ícono WhatsApp SVG oficial */}
            <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white" aria-hidden>
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            {/* Badge de notificación rojo */}
            {!isOpen && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 border-2 border-white flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              </span>
            )}
          </>
        )}
      </motion.button>
    </div>
  );
}
