"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Loader2, MinusCircle } from "lucide-react";
import { toast } from "sonner";

/**
 * Widget flotante de Chat Web en Vivo.
 *
 * Se monta a nivel global en <Providers/> para que esté disponible en toda la
 * web pública. El paciente anónimo ingresa nombre + teléfono + mensaje inicial;
 * se crea una ChatConversation en la DB y se guarda el ID en localStorage para
 * persistir el hilo entre recargas.
 *
 * Realiza polling cada 4s para refrescar mensajes nuevos del admin.
 */

type Conversation = {
  id: string;
  patientName: string;
  patientPhone: string;
  patientEmail: string | null;
  status: string;
  unreadUser: boolean;
  messages: { id: string; sender: string; text: string; createdAt: string }[];
};

const STORAGE_KEY = "rep_chat_conversation_id";

export function FloatingChatWidget() {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  // Form inicial (solo si no hay conversación)
  const [form, setForm] = useState({ patientName: "", patientPhone: "", patientEmail: "", text: "" });

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // === Cargar conversationId desde localStorage al montar ===
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setConversationId(stored);
    } catch {
      /* localStorage puede no estar disponible (SSR / modo privado) */
    }
  }, []);

  // === Cargar conversación + polling ===
  const loadConversation = useCallback(async () => {
    if (!conversationId) return;
    try {
      const res = await fetch(`/api/chat?conversationId=${conversationId}`);
      if (!res.ok) {
        // 404 = la conversación fue eliminada por el admin → reset
        if (res.status === 404) {
          localStorage.removeItem(STORAGE_KEY);
          setConversationId(null);
          setConversation(null);
        }
        return;
      }
      const data: Conversation = await res.json();
      setConversation(data);

      // Contar no leídos del paciente
      const wasUnread = data.unreadUser;
      if (wasUnread && open) {
        // Si el panel está abierto, marcar como leído
        await fetch("/api/chat", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, action: "mark-user-read" }),
        });
        setUnreadCount(0);
      } else if (wasUnread && !open) {
        setUnreadCount(1); // Aviso visual de "nuevo mensaje"
      } else {
        setUnreadCount(0);
      }
    } catch {
      /* silencioso: el polling reintenta */
    }
  }, [conversationId, open]);

  useEffect(() => {
    if (conversationId) {
      loadConversation();
      pollRef.current = setInterval(loadConversation, 4000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
  }, [conversationId, loadConversation]);

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
      setConversation(data);
      setConversationId(data.id);
      try { localStorage.setItem(STORAGE_KEY, data.id); } catch { /* */ }
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
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", conversationId, text }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "Error al enviar");
        return;
      }
      setText("");
      await loadConversation(); // refresca inmediatamente
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSending(false);
    }
  };

  const handleReset = () => {
    if (!confirm("¿Cerrar esta conversación y empezar una nueva?")) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
    setConversationId(null);
    setConversation(null);
    setUnreadCount(0);
  };

  const isClosed = conversation?.status === "CLOSED";

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
            {!conversationId ? (
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
            ) : (
              /* === Hilo de mensajes === */
              <>
                <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
                  {loading && !conversation && (
                    <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-emerald-500" /></div>
                  )}
                  {conversation?.messages.map(msg => {
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
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
