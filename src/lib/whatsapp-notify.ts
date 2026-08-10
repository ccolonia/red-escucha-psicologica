/**
 * Notificaciones por WhatsApp para alertas de turnos.
 *
 * Usa la API de WhatsApp Business Cloud (Meta) o un webhook de automatización
 * (ej: n8n, Make) para enviar mensajes al admin cuando un paciente solicita turno.
 *
 * Si el envío falla, se loguea el error pero NO bloquea el flujo del paciente.
 */

const ADMIN_WHATSAPP_NUMBER = process.env.ADMIN_WHATSAPP_NUMBER || "5491176683429";

/**
 * Limpia un número de teléfono para formato wa.me (solo dígitos, con código de país).
 */
function cleanPhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
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
}): Promise<void> {
  const cleanPatientPhone = cleanPhone(data.patientPhone || "");
  const waLink = cleanPatientPhone ? `https://wa.me/${cleanPatientPhone}` : "";

  const message = `🚨 ¡NUEVA SOLICITUD DE TURNO!
----------------------------------
👤 Paciente: ${data.patientName}
📱 Teléfono: ${data.patientPhone || "No informado"}
📧 Email: ${data.patientEmail || "No informado"}
${data.professional ? `👨‍⚕️ Profesional: ${data.professional}` : ""}
${data.zone ? `📍 Zona / Consulta: ${data.zone}` : ""}
${data.modality ? `🔄 Modalidad: ${data.modality}` : ""}
${data.reason ? `📝 Motivo: ${data.reason}` : ""}
${data.age ? `👶 Edad: ${data.age}` : ""}

👉 Mandar mensaje directo: ${waLink || "Sin teléfono"}`;

  // === Estrategia 1: Meta WhatsApp Cloud API (si está configurada) ===
  const metaToken = process.env.META_WHATSAPP_TOKEN;
  const metaPhoneId = process.env.META_WHATSAPP_PHONE_ID;

  if (metaToken && metaPhoneId) {
    try {
      const res = await fetch(`https://graph.facebook.com/v18.0/${metaPhoneId}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${metaToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: ADMIN_WHATSAPP_NUMBER,
          type: "text",
          text: { body: message },
        }),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "unknown");
        console.error("[WhatsApp Alert] Meta API error:", res.status, errBody);
      } else {
        console.log("[WhatsApp Alert] ✅ Enviado al admin:", ADMIN_WHATSAPP_NUMBER);
      }
    } catch (err) {
      console.error("[WhatsApp Alert] Meta API exception:", err);
    }
    return;
  }

  // === Estrategia 2: Webhook de automatización (n8n, Make, etc.) ===
  const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: ADMIN_WHATSAPP_NUMBER,
          message,
          waLink,
          ...data,
        }),
      });
      if (!res.ok) {
        console.error("[WhatsApp Alert] Webhook error:", res.status);
      } else {
        console.log("[WhatsApp Alert] ✅ Enviado vía webhook");
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
