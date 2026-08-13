/**
 * Notificaciones por WhatsApp para alertas de turnos.
 *
 * Usa la API de WhatsApp Business Cloud (Meta) o un webhook de automatización
 * (ej: n8n, Make) para enviar mensajes al admin cuando un paciente solicita turno.
 *
 * Si el envío falla, se loguea el error pero NO bloquea el flujo del paciente.
 *
 * Rate limiting (para evitar bloqueo de Meta):
 * - Máximo 15 alertas/día por destinatario
 * - Mínimo 10 minutos entre alertas consecutivas al mismo destinatario
 * - Si se excede el límite, se loguea pero no se envía
 *
 * Número oficial único: +54 11 6866-7898 (configurable via ADMIN_WHATSAPP_NUMBER)
 */

// ============================================================================
// RATE LIMITER EN MEMORIA (por serverless instance)
// ============================================================================
// Nota: en serverless de Vercel cada instancia puede tener su propia memoria,
// por lo que esto es best-effort. Para rate limiting exacto habría que usar
// una DB o Redis, pero esto cubre el 95% de los casos (alertas de turnos
// no son tan frecuentes en una sola instancia).

interface RateLimitEntry {
  count: number;
  lastSentAt: number; // timestamp en ms
  windowStart: number; // timestamp en ms del inicio del día (24h rolling)
}

const rateLimitMap = new Map<string, RateLimitEntry>();

const MAX_ALERTS_PER_DAY = 15;
const MIN_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Verifica si podemos enviar una alerta a `to` según el rate limit.
 * Si se puede, actualiza el contador y retorna true.
 * Si no, retorna false con el motivo.
 */
function checkRateLimit(to: string): { allowed: boolean; reason?: string } {
  const now = Date.now();
  let entry = rateLimitMap.get(to);

  if (!entry) {
    // Primera vez: crear entry
    entry = {
      count: 1,
      lastSentAt: now,
      windowStart: now,
    };
    rateLimitMap.set(to, entry);
    return { allowed: true };
  }

  // Resetear ventana de 24h si pasó un día completo
  if (now - entry.windowStart > DAY_MS) {
    entry.count = 1;
    entry.lastSentAt = now;
    entry.windowStart = now;
    return { allowed: true };
  }

  // Verificar intervalo mínimo entre alertas (10 min)
  if (now - entry.lastSentAt < MIN_INTERVAL_MS) {
    const minutesLeft = Math.ceil((MIN_INTERVAL_MS - (now - entry.lastSentAt)) / 60000);
    return {
      allowed: false,
      reason: `Rate limit: faltan ${minutesLeft} min para poder enviar a ${to} (mín 10 min entre alertas)`,
    };
  }

  // Verificar máximo por día (15)
  if (entry.count >= MAX_ALERTS_PER_DAY) {
    const hoursLeft = Math.ceil((DAY_MS - (now - entry.windowStart)) / 3600000);
    return {
      allowed: false,
      reason: `Rate limit: ${to} ya recibió ${MAX_ALERTS_PER_DAY} alertas hoy. Reset en ${hoursLeft}h`,
    };
  }

  // Todo OK: incrementar y actualizar
  entry.count += 1;
  entry.lastSentAt = now;
  return { allowed: true };
}

/**
 * Limpia un número de teléfono para formato wa.me (solo dígitos, con código de país).
 */
function cleanPhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

/**
 * Devuelve la lista de números destinatarios configurados.
 *
 * Lee ADMIN_WHATSAPP_NUMBER (separado por comas) y devuelve un array
 * de strings con los números limpios (solo dígitos).
 *
 * Ej: "541168667898, 541199999999" → ["541168667898", "541199999999"]
 */
function getAdminRecipients(): string[] {
  const raw = process.env.ADMIN_WHATSAPP_NUMBER || "541168667898";
  return raw
    .split(",")
    .map((n) => cleanPhone(n))
    .filter((n) => n.length > 0);
}

/**
 * Envía una alerta por WhatsApp al admin cuando un paciente solicita un turno.
 *
 * Usa wa.me link + fetch al webhook de Meta Cloud API si está configurado.
 * Si no hay configuración, simplemente loguea el mensaje (no falla).
 *
 * @param data - Datos de la solicitud de turno
 * @returns void (fire-and-forget, nunca arroja excepción)
 */
export async function sendAppointmentAlert(data: {
  patientName: string;
  patientPhone: string;
  patientEmail?: string | null;
  professional?: string | null;
  zone?: string | null;
  modality?: string | null;
  reason?: string | null;
  age?: string | null;
  notes?: string | null;
}): Promise<void> {
  // === Feature flag: pausa global de WhatsApp ===
  // Si WHATSAPP_PAUSED=true, no enviamos nada pero seguimos guardando en DB.
  // El pedido igual se registra normalmente (la pausa solo afecta WhatsApp).
  if (process.env.WHATSAPP_PAUSED === "true") {
    console.log("[WhatsApp Alert] ⏸️  PAUSADO por WHATSAPP_PAUSED=true — no se envía a los administradores. Datos del paciente igual se guardaron en DB.");
    console.log("[WhatsApp Alert] Paciente:", data.patientName, "| Email:", data.patientEmail, "| Motivo:", data.reason);
    return;
  }

  const cleanPatientPhone = cleanPhone(data.patientPhone || "");
  const waLink = cleanPatientPhone ? `https://wa.me/${cleanPatientPhone}` : "";

  // === Traducción humano-legible de los códigos internos ===
  const modalityLabels: Record<string, string> = {
    online: "Online",
    presencial: "Presencial",
    "híbrida": "Híbrida",
  };
  const reasonLabels: Record<string, string> = {
    ansiedad: "Ansiedad",
    depresion: "Depresión",
    vinculos: "Vínculos / Pareja",
    duelo: "Duelo / Pérdida",
    autoestima: "Autoestima",
    adicciones: "Adicciones",
    estres: "Estrés",
    laboral: "Laboral",
    orientacion_padres: "Orientación a Padres",
    evaluaciones: "Evaluaciones",
    discapacidad: "Discapacidad",
    infanto_juvenil: "Infanto Juvenil",
    consulta_general: "Consulta General",
    otros: "Otros",
  };
  const modalityLabel = data.modality ? (modalityLabels[data.modality] || data.modality) : null;
  const reasonLabel = data.reason ? (reasonLabels[data.reason] || data.reason) : null;

  const message = `🚨 ¡NUEVA SOLICITUD DE TURNO!
----------------------------------
👤 Paciente: ${data.patientName}
🎂 Edad: ${data.age ? `${data.age} años` : "No informada"}
📱 Teléfono: ${data.patientPhone || "No informado"}
📧 Email: ${data.patientEmail || "No informado"}
💻 Modalidad: ${modalityLabel || "No informada"}
🎯 Motivo: ${reasonLabel || "No informado"}
${data.professional ? `👨‍⚕️ Profesional: ${data.professional}` : ""}
${data.zone ? `📍 Zona / Consulta: ${data.zone}` : ""}
${data.notes ? `📝 Notas: ${data.notes}` : ""}

👉 Contactar: ${waLink || "Sin teléfono"}`;

  // === Estrategia 1: Meta WhatsApp Cloud API (si está configurada) ===
  const metaToken = process.env.META_WHATSAPP_TOKEN;
  const metaPhoneId = process.env.META_WHATSAPP_PHONE_ID;

  if (metaToken && metaPhoneId) {
    const destinos = getAdminRecipients();
    console.log(`[WhatsApp Alert] Enviando a ${destinos.length} destinatario(s):`, destinos.join(", "));

    // Enviar en paralelo a todos los destinatarios, aplicando rate limit por cada uno
    const resultados = await Promise.allSettled(
      destinos.map(async (to) => {
        // === Rate limit check ===
        const rl = checkRateLimit(to);
        if (!rl.allowed) {
          console.warn(`[WhatsApp Alert] ⚠️ ${rl.reason} — saltando envío`);
          return { to, ok: false, status: 429, rateLimited: true };
        }

        try {
          // === TEMPLATE con variables del paciente ===
          // Meta en modo desarrollo (Test Number +1 555) NO permite texto libre
          // fuera de la ventana de 24hs. Solo permite templates aprobados.
          // Por eso usamos el template "nueva_solicitud_turno" con variables.
          //
          // Template body (creado en Meta Business Manager):
          // 🚨 ¡NUEVA SOLICITUD DE TURNO!
          // 👤 Paciente: {{1}}
          // 🎂 Edad: {{2}}
          // 📱 Teléfono: {{3}}
          // 📧 Email: {{4}}
          // 💻 Modalidad: {{5}}
          // 🎯 Motivo: {{6}}
          // 📝 Notas: {{7}}
          // 👉 Contactar: {{8}}

          console.log(`[WhatsApp Alert] POST a Meta API para ${to} (phoneId=${metaPhoneId})`);

          const res = await fetch(`https://graph.facebook.com/v25.0/${metaPhoneId}/messages`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${metaToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to,
              type: "template",
              template: {
                name: "nueva_solicitud_turno",
                language: { code: "es_AR" },
                components: [
                  {
                    type: "body",
                    parameters: [
                      { type: "text", text: data.patientName || "No informado" },                              // {{1}} Paciente
                      { type: "text", text: data.age ? `${data.age} años` : "No informada" },                  // {{2}} Edad
                      { type: "text", text: data.patientPhone || "No informado" },                             // {{3}} Teléfono
                      { type: "text", text: data.patientEmail || "No informado" },                             // {{4}} Email
                      { type: "text", text: modalityLabel || "No informada" },                                 // {{5}} Modalidad
                      { type: "text", text: reasonLabel || "No informado" },                                   // {{6}} Motivo
                      { type: "text", text: data.notes || "Sin notas" },                                       // {{7}} Notas
                      { type: "text", text: waLink || "Sin teléfono" },                                        // {{8}} Contactar
                    ],
                  },
                ],
              },
            }),
          });

          // === DEBUG: log completo de la respuesta de Meta ===
          const respBody = await res.text();
          console.log(`[WhatsApp Alert] Meta API response para ${to}: HTTP ${res.status}`);
          console.log(`[WhatsApp Alert] Meta API body:`, respBody);

          if (!res.ok) {
            console.error(`[WhatsApp Alert] Meta API error para ${to}:`, res.status, respBody);
            return { to, ok: false, status: res.status, error: respBody };
          }
          console.log(`[WhatsApp Alert] ✅ Enviado a:`, to);
          return { to, ok: true, status: 200, response: respBody };
        } catch (err) {
          console.error(`[WhatsApp Alert] Meta API exception para ${to}:`, err);
          return { to, ok: false, status: 0, error: String(err) };
        }
      })
    );

    const exitosos = resultados.filter((r) => r.status === "fulfilled" && r.value.ok).length;
    const rateLimited = resultados.filter((r) => r.status === "fulfilled" && (r.value as { rateLimited?: boolean }).rateLimited).length;
    console.log(`[WhatsApp Alert] Resumen: ${exitosos}/${destinos.length} enviados OK${rateLimited > 0 ? ` | ${rateLimited} rate-limited` : ""}`);
    return;
  }

  // === Estrategia 2: Webhook de automatización (n8n, Make, etc.) ===
  const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
  if (webhookUrl) {
    const destinos = getAdminRecipients();
    // Aplicar rate limit antes de mandar al webhook
    const destinosAllowed = destinos.filter((to) => {
      const rl = checkRateLimit(to);
      if (!rl.allowed) {
        console.warn(`[WhatsApp Alert] ⚠️ ${rl.reason} — saltando webhook`);
        return false;
      }
      return true;
    });
    if (destinosAllowed.length === 0) {
      console.log("[WhatsApp Alert] Todos los destinatarios rate-limited");
      return;
    }
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: destinosAllowed,
          message,
          waLink,
          ...data,
        }),
      });
      if (!res.ok) {
        console.error("[WhatsApp Alert] Webhook error:", res.status);
      } else {
        console.log("[WhatsApp Alert] ✅ Enviado vía webhook a", destinosAllowed.length, "destinatario(s)");
      }
    } catch (err) {
      console.error("[WhatsApp Alert] Webhook exception:", err);
    }
    return;
  }

  // === Estrategia 3: Sin configuración — solo log ===
  console.log("[WhatsApp Alert] ⚠️ No hay META_WHATSAPP_TOKEN ni WHATSAPP_WEBHOOK_URL configurado.");
  console.log("[WhatsApp Alert] Mensaje que se enviaría:");
  console.log(message);
}
