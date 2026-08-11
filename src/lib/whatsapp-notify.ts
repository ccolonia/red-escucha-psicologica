/**
 * Notificaciones por WhatsApp para alertas de turnos.
 *
 * Usa la API de WhatsApp Business Cloud (Meta) o un webhook de automatización
 * (ej: n8n, Make) para enviar mensajes al admin cuando un paciente solicita turno.
 *
 * Si el envío falla, se loguea el error pero NO bloquea el flujo del paciente.
 *
 * Soporta múltiples destinatarios: la variable ADMIN_WHATSAPP_NUMBER puede ser
 * una lista separada por comas (ej: "541176683429,541168667898").
 */

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
 * Ej: "541176683429, 541168667898" → ["541176683429", "541168667898"]
 */
function getAdminRecipients(): string[] {
  const raw = process.env.ADMIN_WHATSAPP_NUMBER || "541176683429";
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
  //
  // ⚠️ PAUSA DE EMERGENCIA ACTIVADA — 2026-08-10
  // Pausa solicitada por el admin por 24hs. Re-enable: cambiar a false.
  const WHATSAPP_PAUSED = process.env.WHATSAPP_PAUSED === "true" || true;
  if (WHATSAPP_PAUSED) {
    console.log("[WhatsApp Alert] ⏸️  PAUSADO por WHATSAPP_PAUSED=true — no se envía a los administradores. Datos del paciente igual se guardaron en DB.");
    console.log("[WhatsApp Alert] Paciente:", data.patientName, "| Email:", data.patientEmail, "| Motivo:", data.reason);
    return;
  }

  const cleanPatientPhone = cleanPhone(data.patientPhone || "");
  const waLink = cleanPatientPhone ? `https://wa.me/${cleanPatientPhone}` : "";

  // === Traducción humano-legible de los códigos internos ===
  // Los valores de modality y reason vienen como códigos internos
  // ("online", "ansiedad", etc.) que el admin reconoce pero no son
  // muy amigables en el mensaje. Los traducimos a etiquetas legibles.
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

    // Enviar en paralelo a todos los destinatarios (más rápido que en serie)
    const resultados = await Promise.allSettled(
      destinos.map(async (to) => {
        try {
          const res = await fetch(`https://graph.facebook.com/v25.0/${metaPhoneId}/messages`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${metaToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to,
              type: "text",
              text: { body: message },
            }),
          });
          if (!res.ok) {
            const errBody = await res.text().catch(() => "unknown");
            console.error(`[WhatsApp Alert] Meta API error para ${to}:`, res.status, errBody);
            return { to, ok: false, status: res.status };
          }
          console.log(`[WhatsApp Alert] ✅ Enviado a:`, to);
          return { to, ok: true, status: 200 };
        } catch (err) {
          console.error(`[WhatsApp Alert] Meta API exception para ${to}:`, err);
          return { to, ok: false, status: 0 };
        }
      })
    );

    const exitosos = resultados.filter((r) => r.status === "fulfilled" && r.value.ok).length;
    console.log(`[WhatsApp Alert] Resumen: ${exitosos}/${destinos.length} enviados OK`);
    return;
  }

  // === Estrategia 2: Webhook de automatización (n8n, Make, etc.) ===
  const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
  if (webhookUrl) {
    const destinos = getAdminRecipients();
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: destinos, // array para que el webhook loopee
          message,
          waLink,
          ...data,
        }),
      });
      if (!res.ok) {
        console.error("[WhatsApp Alert] Webhook error:", res.status);
      } else {
        console.log("[WhatsApp Alert] ✅ Enviado vía webhook a", destinos.length, "destinatario(s)");
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
