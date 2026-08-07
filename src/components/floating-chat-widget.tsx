"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Loader2, MinusCircle, AlertCircle, RotateCw, Bell } from "lucide-react";
import { toast } from "sonner";
import { usePushNotifications } from "@/lib/use-push-notifications";

/**
 * Widget flotante de Chat Web en Vivo.
 *
 * Se monta a nivel global en <Providers/> para que esté disponible en toda la
 * web pública. El paciente anónimo ingresa nombre + teléfono + mensaje inicial;
 * se crea una ChatConversation en la DB y se guarda el ID en localStorage para
 * persistir el hilo entre recargas.
 *
 * Persistencia punta a punta:
 *  1. POST /api/chat { action: "start" } → backend crea conversación + 1er mensaje
 *  2. On success: localStorage.setItem("rep_chat_conversation_id", id)
 *  3. On mount: leer localStorage → setConversationId(stored)
 *  4. useEffect[conversationId] → GET /api/chat?conversationId=... → setConversation(data)
 *  5. Polling cada 4s con el mismo conversationId para refrescar mensajes del admin
 *
 * Si el GET devuelve 404 (el admin borró la conversación), se limpia localStorage
 * y se vuelve al formulario inicial.
 */

type Message = { id: string; sender: string; text: string; createdAt: string };

type Conversation = {
  id: string;
  patientName: string;
  patientPhone: string;
  patientEmail: string | null;
  status: string;
  unreadUser: boolean;
  messages: Message[];
};

const STORAGE_KEY = "rep_chat_conversation_id";

export function FloatingChatWidget() {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  // === Notificaciones Push nativas ===
  // Permite al paciente recibir notificaciones en su dispositivo cuando el
  // admin responde, incluso si la web está cerrada.
  const { permission: pushPermission, subscribe: subscribePush, subscribing: pushSubscribing } = usePushNotifications();

  const handleEnablePush = useCallback(async () => {
    if (!conversationId) {
      toast.error("Iniciá una conversación antes de activar notificaciones");
      return;
    }
    const ok = await subscribePush(conversationId);
    if (ok) {
      toast.success("Notificaciones activadas ✓ Te avisaremos cuando respondan");
    } else {
      toast.error("No se pudieron activar las notificaciones");
    }
  }, [conversationId, subscribePush]);

  // Form inicial (solo si no hay conversación)
  const [form, setForm] = useState({ patientName: "", patientPhone: "", patientEmail: "", text: "" });

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Refs para evitar stale closures dentro del interval de polling
  const conversationIdRef = useRef<string | null>(null);
  const openRef = useRef(false);

  // Mantener refs sincronizadas con el estado
  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);
  useEffect(() => { openRef.current = open; }, [open]);

  // === Cargar conversationId desde localStorage al montar ===
  // Esto garantiza que al recargar la página o cerrar/reabrir el widget,
  // el paciente vuelva a ver su hilo de conversación en lugar del form inicial.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && stored.trim()) {
        setConversationId(stored);
        setLoading(true); // mostramos spinner hasta que llegue el historial
      }
    } catch {
      /* localStorage puede no estar disponible (SSR / modo privado) */
    }
  }, []);

  // === Cargar conversación vía GET público por conversationId ===
  // Esta función es estable (sin deps) para que el setInterval no se reinicie
  // innecesariamente. Lee el conversationId actual desde la ref.
  const loadConversation = useCallback(async () => {
    const id = conversationIdRef.current;
    if (!id) return;
    try {
      const res = await fetch(`/api/chat?conversationId=${id}`);
      if (!res.ok) {
        // 404 = la conversación fue eliminada por el admin → reset total
        if (res.status === 404) {
          try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
          setConversationId(null);
          setConversation(null);
          setLoadError(false);
          return;
        }
        // Otros errores (500, red) → marcar error pero conservar ID para reintentar
        setLoadError(true);
        return;
      }
      const data: Conversation = await res.json();
      setConversation(data);
      setLoadError(false);

      // Contar no leídos del paciente y marcar como leído si el panel está abierto
      const wasUnread = data.unreadUser;
      if (wasUnread && openRef.current) {
        // Panel abierto → marcar como leído inmediatamente
        await fetch("/api/chat", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: id, action: "mark-user-read" }),
        });
        setUnreadCount(0);
      } else if (wasUnread && !openRef.current) {
        setUnreadCount(1); // Aviso visual de "nuevo mensaje" en el FAB
      } else {
        setUnreadCount(0);
      }
    } catch {
      // Error de red → marcar para reintentar en el próximo ciclo de polling
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []); // estable: sin deps

  // === Polling cada 4s cuando hay conversationId ===
  useEffect(() => {
    if (!conversationId) {
      // Si no hay conversationId, asegurarse de que no quede un intervalo activo
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    // Carga inmediata + polling
    loadConversation();
    pollRef.current = setInterval(loadConversation, 4000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [conversationId, loadConversation]);

  // === Cuando el panel se abre, forzar un refetch + marcar como leído ===
  useEffect(() => {
    if (open && conversationId) {
      loadConversation();
    }
  }, [open, conversationId, loadConversation]);

  // === Auto-scroll al final cuando llegan mensajes nuevos ===
  useEffect(() => {
    if (open && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversation?.messages.length, open]);

  // === Iniciar nueva conversación ===
  const handleStart = async () => {
    if (!form.patientName.trim() || !form.patientPhone.trim() || !form.text.trim()) {
      toast.error("Completa nombre, teléfono y mensaje");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          patientName: form.patientName,
          patientPhone: form.patientPhone,
          patientEmail: form.patientEmail || undefined,
          text: form.text,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "Error al iniciar chat");
        return;
      }
      const data: Conversation = await res.json();
      // === Persistir el conversationId en localStorage ===
      try { localStorage.setItem(STORAGE_KEY, data.id); } catch { /* */ }
      setConversation(data);
      setConversationId(data.id);
      setForm({ patientName: "", patientPhone: "", patientEmail: "", text: "" });
      toast.success("Conversación iniciada. Te responderemos a la brevedad.");
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSending(false);
    }
  };

  // === Enviar mensaje nuevo (paciente) ===
  const handleSend = async () => {
    if (!text.trim() || !conversationId) return;
    const currentText = text;
    setText(""); // optimista: limpiar input inmediatamente
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", conversationId, text: currentText }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "Error al enviar");
        setText(currentText); // restaurar texto si falló
        return;
      }
      await loadConversation(); // refresca inmediatamente
    } catch {
      toast.error("Error de conexión");
      setText(currentText); // restaurar texto si falló
    } finally {
      setSending(false);
    }
  };

  const handleReset = () => {
    if (!confirm("¿Cerrar esta conversación y empezar una nueva? Se perderá el historial actual.")) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
    setConversationId(null);
    setConversation(null);
    setUnreadCount(0);
    setLoadError(false);
  };

  const isClosed = conversation?.status === "CLOSED";

  // === Determinar qué mostrar en el body del widget ===
  // - Sin conversationId → form inicial
  // - Con conversationId pero cargando → spinner
  // - Con conversationId y error → mensaje de error + reintentar
  // - Con conversationId y conversation → hilo de mensajes
  const showForm = !conversationId;
  const showLoading = conversationId && loading && !conversation;
  const showError = conversationId && !loading && !conversation && loadError;
  const showThread = conversationId && conversation;

  return (
    <>
      {/* Botón flotante */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="chat-fab"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/30 flex items-center justify-center text-white"
            aria-label="Abrir chat de soporte"
          >
            <MessageCircle className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white animate-pulse">
                !
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Ventana de chat */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="chat-window"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] sm:w-[380px] h-[520px] max-h-[calc(100vh-2.5rem)] bg-white rounded-2xl shadow-2xl border border-emerald-200 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">Red Escucha Psicológica</p>
                  <p className="text-[10px] text-emerald-100 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 inline-block animate-pulse" />
                    En línea · respondemos a la brevedad
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {conversationId && (
                  <button onClick={handleReset} title="Nueva conversación" className="p-1 rounded hover:bg-white/20">
                    <MinusCircle className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => setOpen(false)} title="Cerrar" className="p-1 rounded hover:bg-white/20">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            {showForm ? (
              /* === Form de inicio === */
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-xs text-emerald-800">
                  Hola 👋 Escribinos tu consulta y te responderemos a la brevedad.
                  Ante una urgencia, llamá al <strong>0800-345-3456</strong> o al <strong>135</strong> (línea gratuita de salud mental).
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600">Nombre *</label>
                  <input
                    type="text"
                    value={form.patientName}
                    onChange={e => setForm({ ...form, patientName: e.target.value })}
                    placeholder="Tu nombre"
                    className="w-full mt-0.5 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600">Teléfono *</label>
                  <input
                    type="tel"
                    value={form.patientPhone}
                    onChange={e => setForm({ ...form, patientPhone: e.target.value })}
                    placeholder="+54 9 11..."
                    className="w-full mt-0.5 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600">Email (opcional)</label>
                  <input
                    type="email"
                    value={form.patientEmail}
                    onChange={e => setForm({ ...form, patientEmail: e.target.value })}
                    placeholder="tu@email.com"
                    className="w-full mt-0.5 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600">Mensaje *</label>
                  <textarea
                    value={form.text}
                    onChange={e => setForm({ ...form, text: e.target.value })}
                    placeholder="Contanos en qué podemos ayudarte..."
                    rows={3}
                    className="w-full mt-0.5 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none"
                  />
                </div>
                <button
                  onClick={handleStart}
                  disabled={sending}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Iniciar conversación
                </button>
              </div>
            ) : showLoading ? (
              /* === Cargando historial desde el servidor === */
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-3" />
                <p className="text-sm text-teal-700">Cargando tu conversación...</p>
                <p className="text-[10px] text-teal-400 mt-1">Recuperando el historial de mensajes</p>
              </div>
            ) : showError ? (
              /* === Error al cargar — botón de reintentar === */
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <AlertCircle className="w-8 h-8 text-amber-500 mb-3" />
                <p className="text-sm text-teal-700">No pudimos cargar tu conversación</p>
                <p className="text-[10px] text-teal-400 mt-1">Revisá tu conexión e intentá nuevamente</p>
                <button
                  onClick={() => { setLoading(true); setLoadError(false); loadConversation(); }}
                  className="mt-3 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg flex items-center gap-1.5"
                >
                  <RotateCw className="w-3.5 h-3.5" /> Reintentar
                </button>
              </div>
            ) : showThread ? (
              /* === Hilo de mensajes === */
              <>
                {/* Banner para activar notificaciones push (solo si no están activadas) */}
                {pushPermission === "default" && (
                  <div className="bg-emerald-50 border-b border-emerald-200 px-3 py-2 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-emerald-600 shrink-0" />
                    <p className="text-[11px] text-emerald-800 flex-1">
                      Activá las notificaciones para saber cuando respondan
                    </p>
                    <button
                      onClick={handleEnablePush}
                      disabled={pushSubscribing}
                      className="text-[10px] font-medium px-2 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-md shrink-0"
                    >
                      {pushSubscribing ? "..." : "Activar"}
                    </button>
                  </div>
                )}
                {pushPermission === "denied" && (
                  <div className="bg-amber-50 border-b border-amber-200 px-3 py-2">
                    <p className="text-[10px] text-amber-700">
                      Notificaciones bloqueadas. Activá los permisos del navegador para recibir avisos.
                    </p>
                  </div>
                )}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
                  {conversation.messages.length === 0 && (
                    <div className="text-center py-4">
                      <p className="text-xs text-teal-400 italic">Aún no hay mensajes en esta conversación</p>
                    </div>
                  )}
                  {conversation.messages.map(msg => {
                    const isPatient = msg.sender === "PATIENT";
                    return (
                      <div key={msg.id} className={`flex ${isPatient ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm ${
                          isPatient
                            ? "bg-emerald-600 text-white rounded-br-md"
                            : "bg-white border border-slate-200 text-slate-700 rounded-bl-md"
                        }`}>
                          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                          <p className={`text-[9px] mt-0.5 ${isPatient ? "text-emerald-100" : "text-slate-400"}`}>
                            {new Date(msg.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {isClosed && (
                  <div className="px-3 py-2 bg-amber-50 border-t border-amber-200 text-[11px] text-amber-700 text-center">
                    Esta conversación fue cerrada por el equipo. Iniciá una nueva si necesitás ayuda.
                  </div>
                )}

                {/* Input */}
                <div className="p-2 border-t border-slate-200 bg-white flex items-end gap-2">
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder={isClosed ? "Conversación cerrada" : "Escribí tu mensaje..."}
                    rows={1}
                    disabled={isClosed}
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none max-h-24 disabled:bg-slate-50"
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || isClosed || !text.trim()}
                    className="p-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg"
                    aria-label="Enviar mensaje"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
