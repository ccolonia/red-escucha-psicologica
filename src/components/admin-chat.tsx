"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Send, Loader2, Search, X, Phone, Mail, User,
  CheckCheck, Circle, Ban, RotateCcw, MessageCircle, Inbox,
  Bell, BellOff,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

/**
 * Reproduce un tono corto tipo "campana / ding" usando Web Audio API nativa.
 * No depende de archivos .mp3 externos. Si el navegador bloquea el AudioContext
 * (autoplay policy), el error se captura silenciosamente.
 */
function playNotificationSound() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Tono principal: campana clara en A5 (880 Hz) con decaimiento exponencial a A4 (440 Hz)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.5);

    // Cerrar el contexto después de que termine el sonido para liberar recursos
    osc.onended = () => {
      try { ctx.close(); } catch { /* */ }
    };
  } catch (e) {
    console.error("Error reproduciendo sonido de notificación:", e);
  }
}

type ChatMessage = {
  id: string;
  sender: string;
  text: string;
  createdAt: string;
};

type Conversation = {
  id: string;
  patientName: string;
  patientEmail: string | null;
  patientPhone: string;
  status: string;
  unreadAdmin: boolean;
  unreadUser: boolean;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  _count?: { messages: number };
};

/**
 * Panel de administración del Chat Web en Vivo.
 *
 * Layout de 2 columnas:
 *  - Izquierda: inbox de conversaciones (con badges de no leído y preview)
 *  - Derecha: hilo de mensajes + input para responder
 *
 * Polling cada 5s para refrescar conversaciones y mensajes.
 * Auto-marca como leído al seleccionar una conversación.
 * Alerta sonora (campana) cuando llega un nuevo mensaje de un paciente.
 */
export function AdminChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  // selectedConversation: hilo COMPLETO con todos los mensajes (fetch separado vía
  // GET /api/chat?conversationId=xxx). NO usar conversations.find() porque esa
  // lista solo trae el último mensaje (take: 1) para preview del inbox.
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "UNREAD" | "ACTIVE" | "CLOSED">("ALL");
  const [soundEnabled, setSoundEnabled] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  // Set de IDs de mensajes ya vistos (para detectar cuáles son NUEVOS)
  const seenMessageIds = useRef<Set<string>>(new Set());
  // Flag para distinguir la primera carga (no reproducir sonido en la inicial)
  const isFirstLoad = useRef(true);
  // Ref para acceder a soundEnabled dentro del polling sin reiniciar el interval
  const soundEnabledRef = useRef(true);
  // Ref para acceder a selectedId dentro del polling (refetch del hilo seleccionado)
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/chat");
      if (!res.ok) return;
      const data: Conversation[] = await res.json();
      setConversations(data);

      // === Detección de nuevos mensajes del paciente para alerta sonora ===
      // Recorremos todas las conversaciones y buscamos mensajes con sender="PATIENT"
      // cuyo ID no esté en seenMessageIds. Si encontramos al menos uno nuevo y no
      // es la primera carga, reproducimos el sonido.
      if (isFirstLoad.current) {
        // Primera carga: poblar el Set sin reproducir sonido
        data.forEach(c => {
          (c.messages || []).forEach(m => seenMessageIds.current.add(m.id));
        });
        isFirstLoad.current = false;
      } else {
        // Cargas subsequentes: buscar mensajes nuevos del paciente
        let hasNewPatientMessage = false;
        data.forEach(c => {
          (c.messages || []).forEach(m => {
            if (!seenMessageIds.current.has(m.id)) {
              seenMessageIds.current.add(m.id);
              if (m.sender === "PATIENT") {
                hasNewPatientMessage = true;
              }
            }
          });
        });
        if (hasNewPatientMessage && soundEnabledRef.current) {
          playNotificationSound();
        }
      }

      // === Si hay una conversación seleccionada, refetch del hilo completo ===
      // para garantizar que el admin siempre vea todos los mensajes (incluidos
      // los nuevos que llegaron en este ciclo de polling).
      const selId = selectedIdRef.current;
      if (selId) {
        try {
          const threadRes = await fetch(`/api/chat?conversationId=${selId}`);
          if (threadRes.ok) {
            const threadData: Conversation = await threadRes.json();
            setSelectedConversation(threadData);
          }
        } catch {
          /* silencioso: el hilo se refrescará en el próximo ciclo */
        }
      }
    } catch {
      /* silencioso */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  // === Persistencia de la conversación seleccionada vía URL ?id=UUID ===
  // Esto garantiza que al recargar la página (F5), el admin vuelva a la misma
  // conversación que estaba mirando, con su historial completo cargado desde la DB.
  //
  // Usamos window.location.replace con query string en lugar de hash, porque el
  // hash se mezcla con el routing SPA existente (useAppStore maneja #login etc.).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const idFromUrl = params.get("id");
    if (idFromUrl && idFromUrl !== selectedId) {
      setSelectedId(idFromUrl);
    }
  }, []); // solo al montar

  // === Cuando cambia selectedId, fetch del hilo completo + sync URL ===
  useEffect(() => {
    if (!selectedId) {
      setSelectedConversation(null);
      // Limpiar ?id= de la URL si no hay selección
      if (typeof window !== "undefined" && window.location.search) {
        const url = new URL(window.location.href);
        url.searchParams.delete("id");
        window.history.replaceState({}, "", url.toString());
      }
      return;
    }

    // Actualizar URL sin recargar la página
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("id", selectedId);
      window.history.replaceState({}, "", url.toString());
    }

    // Fetch del hilo completo desde la DB
    let cancelled = false;
    setLoadingThread(true);
    (async () => {
      try {
        const res = await fetch(`/api/chat?conversationId=${selectedId}`);
        if (!res.ok) {
          if (res.status === 404) {
            toast.error("La conversación ya no existe");
            setSelectedId(null);
            setSelectedConversation(null);
          }
          return;
        }
        const data: Conversation = await res.json();
        if (!cancelled) {
          setSelectedConversation(data);
          // Marcar como leído en el backend
          await fetch("/api/chat", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversationId: selectedId, action: "mark-admin-read" }),
          });
          setConversations(prev => prev.map(c => c.id === selectedId ? { ...c, unreadAdmin: false } : c));
        }
      } catch {
        /* silencioso */
      } finally {
        if (!cancelled) setLoadingThread(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedId]);

  // === Alias 'selected' para compatibilidad con el JSX existente ===
  const selected = selectedConversation;

  // === Al hacer clic en una conversación del inbox ===
  // Solo setea el selectedId; el useEffect[selectedId] se encarga de:
  //  - actualizar la URL
  //  - hacer fetch del hilo completo
  //  - marcar como leído en el backend
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  // === Enviar respuesta como admin ===
  const handleSend = async () => {
    if (!text.trim() || !selectedId) return;
    const currentText = text;
    setText(""); // optimista
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "admin-send", conversationId: selectedId, text: currentText }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "Error al enviar");
        setText(currentText); // restaurar
        return;
      }
      // Refetch inmediato del hilo + lista para ver el mensaje enviado
      await loadConversations();
    } catch {
      toast.error("Error de conexión");
      setText(currentText);
    } finally {
      setSending(false);
    }
  };

  // === Cerrar / reabrir conversación ===
  const handleCloseToggle = async () => {
    if (!selectedId) return;
    const action = selected?.status === "CLOSED" ? "reopen" : "close";
    try {
      await fetch("/api/chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selectedId, action }),
      });
      setConversations(prev => prev.map(c => c.id === selectedId ? { ...c, status: action === "close" ? "CLOSED" : "ACTIVE" } : c));
      toast.success(action === "close" ? "Conversación cerrada" : "Conversación reabierta");
    } catch {
      toast.error("Error al actualizar estado");
    }
  };

  // === Auto-scroll al final cuando llega un mensaje nuevo ===
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedConversation?.messages.length, selectedId]);

  // === Filtros aplicados ===
  const filteredConversations = conversations.filter(c => {
    if (filter === "UNREAD" && !c.unreadAdmin) return false;
    if (filter === "ACTIVE" && c.status !== "ACTIVE") return false;
    if (filter === "CLOSED" && c.status !== "CLOSED") return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.patientName.toLowerCase().includes(q) ||
        c.patientPhone.toLowerCase().includes(q) ||
        (c.patientEmail || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalUnread = conversations.filter(c => c.unreadAdmin).length;
  const totalActive = conversations.filter(c => c.status === "ACTIVE").length;

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-teal-900">Chat en Vivo</h2>
            <p className="text-xs text-teal-500">
              Inbox de conversaciones con pacientes · {totalActive} activas
              {totalUnread > 0 && <span className="ml-2 text-amber-600 font-medium">· {totalUnread} sin leer</span>}
            </p>
          </div>
        </div>
        {/* Toggle de alerta sonora */}
        <button
          onClick={() => {
            const next = !soundEnabled;
            setSoundEnabled(next);
            // Si se activa, reproducir una vez para confirmar que funciona
            if (next) {
              playNotificationSound();
              toast.success("Alerta sonora activada");
            } else {
              toast.info("Alerta sonora desactivada");
            }
          }}
          title={soundEnabled ? "Sonido activado (clic para silenciar)" : "Sonido desactivado (clic para activar)"}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            soundEnabled
              ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
              : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
          }`}
        >
          {soundEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
          {soundEnabled ? "Sonido ON" : "Sonido OFF"}
        </button>
      </div>

      {/* Layout 2 columnas */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[320px_1fr] gap-3 min-h-0">
        {/* === Columna izquierda: Inbox === */}
        <div className="flex flex-col min-h-0 bg-white rounded-xl border border-teal-100 overflow-hidden">
          {/* Buscador + filtros */}
          <div className="p-2 border-b border-teal-100 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-teal-400" />
              <input
                type="text"
                placeholder="Buscar paciente..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-teal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              />
            </div>
            <div className="flex gap-1">
              {([
                { key: "ALL", label: "Todas" },
                { key: "UNREAD", label: `Sin leer${totalUnread ? ` (${totalUnread})` : ""}` },
                { key: "ACTIVE", label: "Activas" },
                { key: "CLOSED", label: "Cerradas" },
              ] as const).map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`flex-1 px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                    filter === f.key
                      ? "bg-emerald-600 text-white"
                      : "bg-teal-50 text-teal-600 hover:bg-teal-100"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin text-teal-400 mx-auto" /></div>
            ) : filteredConversations.length === 0 ? (
              <div className="py-12 text-center">
                <Inbox className="w-8 h-8 text-teal-200 mx-auto mb-2" />
                <p className="text-xs text-teal-500">No hay conversaciones</p>
              </div>
            ) : (
              filteredConversations.map(c => {
                const lastMsg = c.messages?.[0]; // viene ordenado desc
                const isSelected = c.id === selectedId;
                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelect(c.id)}
                    className={`w-full text-left px-3 py-2.5 border-b border-teal-50 hover:bg-teal-50/50 transition-colors ${
                      isSelected ? "bg-emerald-50 border-l-2 border-l-emerald-600" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        c.unreadAdmin ? "bg-emerald-600 text-white" : "bg-teal-100 text-teal-600"
                      }`}>
                        <User className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className={`text-xs truncate ${c.unreadAdmin ? "font-bold text-teal-900" : "text-teal-700"}`}>
                            {c.patientName}
                          </p>
                          <span className="text-[9px] text-teal-400 shrink-0">
                            {new Date(c.updatedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-[10px] text-teal-500 truncate">
                          {lastMsg ? (
                            <>
                              {lastMsg.sender === "ADMIN" && <span className="text-emerald-600">Tú: </span>}
                              {lastMsg.text}
                            </>
                          ) : (
                            <span className="italic text-teal-300">Sin mensajes</span>
                          )}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          {c.unreadAdmin && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          )}
                          {c.status === "CLOSED" && (
                            <Badge variant="outline" className="text-[8px] py-0 px-1 bg-slate-100 text-slate-500">Cerrada</Badge>
                          )}
                          <span className="text-[9px] text-teal-400">{c._count?.messages || 0} msgs</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* === Columna derecha: Hilo de mensajes === */}
        <div className="flex flex-col min-h-0 bg-white rounded-xl border border-teal-100 overflow-hidden">
          {!selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <MessageCircle className="w-12 h-12 text-teal-200 mb-3" />
              <p className="text-sm font-medium text-teal-700">Seleccioná una conversación</p>
              <p className="text-xs text-teal-500 mt-1">Elegí un paciente del inbox para ver el hilo completo</p>
            </div>
          ) : loadingThread && !selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-3" />
              <p className="text-sm text-teal-700">Cargando historial de mensajes...</p>
              <p className="text-[10px] text-teal-400 mt-1">Recuperando la conversación desde la base de datos</p>
            </div>
          ) : !selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <MessageCircle className="w-12 h-12 text-teal-200 mb-3" />
              <p className="text-sm font-medium text-teal-700">No se pudo cargar la conversación</p>
              <button
                onClick={() => setSelectedId(null)}
                className="mt-3 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg"
              >
                Volver al inbox
              </button>
            </div>
          ) : (
            <>
              {/* Header conversación */}
              <div className="p-3 border-b border-teal-100 bg-teal-50/30">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-teal-900 truncate">{selected.patientName}</p>
                      {selected.status === "CLOSED" && (
                        <Badge variant="outline" className="text-[9px] py-0 px-1.5 bg-slate-100 text-slate-600 border-slate-200">CERRADA</Badge>
                      )}
                      {selected.unreadAdmin && (
                        <Badge variant="outline" className="text-[9px] py-0 px-1.5 bg-emerald-100 text-emerald-700 border-emerald-200">NUEVO</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-[10px] text-teal-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {selected.patientPhone}
                      </span>
                      {selected.patientEmail && (
                        <span className="text-[10px] text-teal-500 flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3" /> {selected.patientEmail}
                        </span>
                      )}
                      <span className="text-[10px] text-teal-400">
                        Iniciada: {new Date(selected.createdAt).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      onClick={() => setSelectedId(null)}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 border-slate-300 text-slate-500 hover:bg-slate-50"
                      title="Volver al inbox"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                    <Button
                      onClick={handleCloseToggle}
                      variant="outline"
                      size="sm"
                      className={`text-xs h-7 ${selected.status === "CLOSED" ? "border-emerald-300 text-emerald-600 hover:bg-emerald-50" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}
                    >
                      {selected.status === "CLOSED" ? (
                        <><RotateCcw className="w-3 h-3 mr-1" /> Reabrir</>
                      ) : (
                        <><Ban className="w-3 h-3 mr-1" /> Cerrar</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Mensajes */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
                {selected.messages.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-xs text-teal-400 italic">Aún no hay mensajes en esta conversación</p>
                  </div>
                ) : (
                  selected.messages.map(msg => {
                    const isPatient = msg.sender === "PATIENT";
                    return (
                      <div key={msg.id} className={`flex ${isPatient ? "justify-start" : "justify-end"}`}>
                        <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                          isPatient
                            ? "bg-white border border-slate-200 text-slate-700 rounded-bl-md"
                            : "bg-emerald-600 text-white rounded-br-md"
                        }`}>
                          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                          <p className={`text-[9px] mt-0.5 ${isPatient ? "text-slate-400" : "text-emerald-100"}`}>
                            {new Date(msg.createdAt).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

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
                  placeholder={selected.status === "CLOSED" ? "Reabrí la conversación para responder" : "Escribí tu respuesta..."}
                  rows={1}
                  disabled={selected.status === "CLOSED"}
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none max-h-24 disabled:bg-slate-50"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || selected.status === "CLOSED" || !text.trim()}
                  className="p-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg"
                  aria-label="Enviar respuesta"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
