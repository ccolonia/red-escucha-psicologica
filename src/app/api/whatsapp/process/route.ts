import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getUpcomingAvailableSlots, formatSlotForWhatsApp } from "@/lib/available-slots";

// === Cliente universal OpenAI con baseURL configurable ===
//
// Usamos el SDK `openai` (estándar de la industria) que es compatible con
// cualquier proveedor que hable el protocolo OpenAI:
//   - OpenAI (api.openai.com/v1)
//   - Groq (api.groq.com/openai/v1) — recomendado para WhatsApp (ultra rápido)
//   - Google Gemini (generativelanguage.googleapis.com/v1beta/openai/)
//   - OpenRouter (openrouter.ai/api/v1)
//   - Cualquier proxy OpenAI-compatible
//
// El proveedor se elige con variables de entorno:
//   AI_API_KEY  → API key del proveedor
//   AI_BASE_URL → URL base (default: https://api.groq.com/openai/v1)
//   AI_MODEL    → nombre del modelo (default: llama-3.3-70b-versatile)
//
// La instancia se cachea a nivel de módulo porque las credenciales no
// cambian entre invocaciones en serverless.
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (openaiClient) return openaiClient;

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error("Falta variable de entorno AI_API_KEY");
  }

  openaiClient = new OpenAI({
    apiKey,
    baseURL: process.env.AI_BASE_URL || "https://api.groq.com/openai/v1",
  });
  return openaiClient;
}

// === POST /api/whatsapp/process ===
//
// Endpoint del "Cerebro" del Agente IA de WhatsApp para REP.
// Recibe mensajes capturados por el microservicio nocturno de WhatsApp,
// los procesa con la IA (z-ai-web-dev-sdk) y devuelve la respuesta.
//
// === Seguridad ===
// Verifica el header x-api-secret contra process.env.WHATSAPP_BOT_SECRET
// para que solo el microservicio autorizado pueda consumir este endpoint.
//
// === Payload esperado ===
// {
//   sender: string,   // Ej: "+5491176683429"
//   message: string   // Ej: "Hola, necesito un turno para mañana"
// }
//
// === Respuesta ===
// 200 + { reply: string }
// 400 — payload inválido
// 401 — token incorrecto/faltante
// 500 — error interno

// === System Prompt con Guardrails Clínicos de REP ===
// Reglas innegociables del Asistente Virtual nocturno de la Red de Escucha
// Psicológica. El modelo NUNCA puede saltarse estas reglas.
const REP_SYSTEM_PROMPT = `Sos el Asistente Virtual nocturno de la Red de Escucha Psicológica (REP).

=== IDENTIDAD ===
- Cálido, empático, profesional y resolutivo.
- Tu función es ayudar a las personas a agendar una consulta con un profesional calificado de nuestro equipo.
- Hablás en español rioplatense, usando "vos" (no "tú").

=== LÍMITE CLARO (INNEGOCIABLE) ===
- NO sos un profesional de la salud mental.
- NO brindás consejo terapéutico, diagnóstico ni tratamiento.
- Si te preguntan por problemas específicos, respondé:
  "No soy un profesional de la salud mental ni brindo consejo terapéutico. Mi función es ayudarte a agendar una consulta con un profesional calificado de nuestro equipo."

=== PROTOCOLO DE EMERGENCIA / CRISIS (INNEGOCIABLE) ===
Si el mensaje del usuario indica CUALQUIERA de estas señales:
- Ideación suicida ("quiero morirme", "no quiero vivir", "me quiero matar")
- Autolesión ("me quiero cortar", "me hago daño")
- Crisis extrema ("no aguanto más", "estoy al límite", "me quiero desmayar")
- Abuso sexual o violencia en curso
- Psicosis aguda (alucinaciones, pérdida de contacto con la realidad)

NO intentes agendar. Respondé INMEDIATAMENTE con contención y estos recursos:
- Línea de Prevención del Suicidio: 135 (Argentina, las 24 hs, gratuita)
- Línea 0800-345-1435 (Salud Mental, Ministerio de Salud de la Nación)
- Indicá ACUDIR a la guardia del hospital más cercano.
- Mantené un tono calmo, contenedor y empático. No juzgues.
- No uses emojis en este caso.

=== FORMATO DE RESPUESTA ===
- Respuestas BREVES (máximo 3-4 líneas salvo en crisis).
- Pensadas para leerse en la pantalla de un celular por WhatsApp.
- Usá saltos de línea (\\n) para separar ideas.
- Usá emojis con moderación (máximo 1-2 por mensaje).
- No uses markdown ni asteriscos para formato (no se renderiza en WhatsApp).

=== OFERTA DE TURNOS ===
Si el usuario pregunta por disponibilidad o quiere agendar:
- Si te paso slots disponibles en el contexto, ofrecelos en este formato:
  📅 [Día fecha] a las [hora] hs
     con [primer nombre del profesional] ([modalidad])
- Ofrecé máximo 2-3 opciones por mensaje.
- Después de ofrecer, preguntá cuál prefiere o si quiere otras opciones.
- Si no hay slots disponibles en el contexto, decí que en este momento no
  tenés turnos cargados para los próximos días y derivá a que un coordinador
  se contacte a la brevedad (dejá tu teléfono si te lo dan).

=== MODALIDADES ===
- Online: sesión por videollamada.
- Presencial: en consultorio (puede ser CABA, GBA o interior).
- A domicilio: el profesional va al domicilio del paciente.
- Aclará la modalidad de cada turno que ofrezcas.

=== CIERRE ===
- Si el usuario confirma un turno, decí que un coordinador humano le va a
  escribir a la brevedad para confirmar datos y enviar el link de pago
  (si corresponde) o el link de la sesión online.
- NO confirms turnos directamente; el coordinador humano es quien cierra.`;

// === Detección de mensajes de crisis ===
// Patrones que disparan el protocolo de emergencia ANTES de llamar a la IA.
// Esto es un safety net: aunque el system prompt ya lo maneja, este check
// garantiza que la respuesta de emergencia sea inmediata y consistente,
// sin depender del modelo.
const CRISIS_PATTERNS = [
  /suicid/i,
  /matarme/i,
  /morir/i,
  /no quiero vivir/i,
  /no aguanto más/i,
  /no aguanto mas/i,
  /cortarme/i,
  /hacerme daño/i,
  /hacerme dano/i,
  /me quiero morir/i,
  /me quiero matar/i,
  /acabar con todo/i,
  /no valgo nada/i,
  /nadie me va a extrañar/i,
  /nadie me va a extraniar/i,
  /alucin/i,
  /escucho voces/i,
  /me violaron/i,
  /me están lastimando/i,
  /me estan lastimando/i,
];

function isCrisisMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return CRISIS_PATTERNS.some((pattern) => pattern.test(lower));
}

// === Respuesta de emergencia constante ===
// Para que la respuesta sea SIEMPRE la misma, sin variaciones del modelo.
const CRISIS_RESPONSE = `Entiendo que estás pasando por un momento muy difícil y me alegra que estés buscando ayuda. Lo que estás sintiendo es real y merece atención inmediata.

Por favor, comunícate AHORA con estos recursos (están disponibles las 24 horas y son gratuitos):

📞 Línea de Prevención del Suicidio: 135 (Argentina)
📞 Salud Mental: 0800-345-1435 (Ministerio de Salud)

Si la situación es urgente, acudí a la guardia del hospital más cercano.

No estás solo/a. Hay personas preparadas para escucharte y acompañarte en este momento.`;

export async function POST(request: NextRequest) {
  try {
    // === 1. Seguridad: verificar token secreto ===
    const apiSecret = request.headers.get("x-api-secret");
    const expectedSecret = process.env.WHATSAPP_BOT_SECRET;

    if (!expectedSecret) {
      // Si la variable de entorno no está configurada, rechazar por seguridad
      console.error("WHATSAPP_BOT_SECRET no está configurado en las variables de entorno");
      return NextResponse.json(
        { error: "Servidor mal configurado" },
        { status: 500 }
      );
    }

    if (apiSecret !== expectedSecret) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // === 2. Parsear y validar payload ===
    const body = await request.json();
    const { sender, message } = body;

    if (!sender || typeof sender !== "string") {
      return NextResponse.json(
        { error: "Campo 'sender' es obligatorio y debe ser string" },
        { status: 400 }
      );
    }
    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Campo 'message' es obligatorio y debe ser string" },
        { status: 400 }
      );
    }
    if (message.trim().length === 0) {
      return NextResponse.json(
        { error: "El mensaje no puede estar vacío" },
        { status: 400 }
      );
    }
    if (message.length > 2000) {
      return NextResponse.json(
        { error: "El mensaje es demasiado largo (máximo 2000 caracteres)" },
        { status: 400 }
      );
    }

    // === 3. Protocolo de Emergencia (safety net) ===
    // Si el mensaje indica crisis, responder inmediatamente SIN llamar a la IA.
    // Esto garantiza una respuesta consistente y sin demoras en situaciones críticas.
    if (isCrisisMessage(message)) {
      console.log(`🚨 [whatsapp-bot] Mensaje de crisis detectado de ${sender}. Respuesta de emergencia enviada.`);
      return NextResponse.json({ reply: CRISIS_RESPONSE });
    }

    // === 4. Detectar si el usuario quiere agendar ===
    // Si menciona turno/horario/disponibilidad/agendar, buscar slots disponibles
    // para inyectarlos en el contexto del modelo.
    const wantsAppointment = /turno|horario|disponib|agendar|consulta|sesión|sesion|reunir|cita|reservar/i.test(message);

    let slotsContext = "";
    if (wantsAppointment) {
      try {
        const slots = await getUpcomingAvailableSlots(3, 14);
        if (slots.length > 0) {
          const slotsText = slots
            .map((s) => formatSlotForWhatsApp(s))
            .join("\n");
          slotsContext = `\n\n=== SLOTS DISPONIBLES ACTUALMENTE (ofrecelos si el usuario pregunta) ===\n${slotsText}\n=== FIN SLOTS ===`;
        } else {
          slotsContext = `\n\n=== SLOTS DISPONIBLES ACTUALMENTE ===\nNo hay turnos disponibles cargados para los próximos 14 días. Si el usuario pregunta por turnos, decí que en este momento no hay turnos disponibles y que un coordinador humano se va a contactar a la brevedad.\n=== FIN SLOTS ===`;
        }
      } catch (err) {
        console.error("Error obteniendo slots disponibles:", err);
        // No bloquear el flujo — continuar sin contexto de slots
      }
    }

    // === 5. Llamar a la IA con cliente universal OpenAI ===
    let openai;
    try {
      openai = getOpenAIClient();
    } catch (err) {
      console.error("Error inicializando cliente OpenAI:", err);
      return NextResponse.json(
        { error: "Servicio de IA no configurado" },
        { status: 500 }
      );
    }

    const model = process.env.AI_MODEL || "llama-3.3-70b-versatile";

    let reply: string | null = null;
    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: REP_SYSTEM_PROMPT + slotsContext,
          },
          {
            role: "user",
            content: `[Paciente - Tel: ${sender}]: ${message}`,
          },
        ],
        temperature: 0.3, // baja temperatura para respuestas consistentes y predecibles
        max_tokens: 400,  // límite de tokens para mantener respuestas breves (WhatsApp)
      });

      reply = response.choices?.[0]?.message?.content || null;
    } catch (err) {
      console.error("Error llamando a la IA:", err);
      // Fallback graceful: si la IA falla, responder con mensaje estándar
      // para que el usuario no se quede sin respuesta por WhatsApp.
      const errorMessage = err instanceof Error ? err.message : "Error desconocido";
      console.error(`[whatsapp-bot] IA fallback para ${sender}: ${errorMessage}`);
      return NextResponse.json({
        reply: "Hola 👋 En este momento no puedo procesar tu mensaje automáticamente, pero un coordinador humano te va a contactar a la brevedad. Si es una urgencia, escribinos a contacto@redescuchapsicologica.com o llamá al 0800-345-1435 (Salud Mental, las 24 hs).",
      });
    }

    if (!reply) {
      console.error("La IA no devolvió contenido en la respuesta");
      return NextResponse.json({
        reply: "Hola 👋 En este momento no pude procesar tu mensaje. Un coordinador humano te va a contactar a la brevedad. Si es una urgencia, llamá al 0800-345-1435 (Salud Mental, las 24 hs).",
      });
    }

    // === 6. Log para auditoría (sin PII sensible) ===
    // Guardar log para debugging y métricas, sin revelar el contenido del mensaje.
    console.log(`[whatsapp-bot] Mensaje procesado de ${sender} (${message.length} chars) → respuesta ${reply.length} chars`);

    // === 7. Opcional: guardar en DB para histórico ===
    // Descomentar cuando se quiera trackear conversaciones:
    // try {
    //   await db.whatsappBotLog.create({
    //     data: { sender, message, reply, createdAt: new Date() },
    //   });
    // } catch (err) {
    //   console.error("Error guardando log en DB (no bloqueante):", err);
    // }

    return NextResponse.json({ reply });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error en /api/whatsapp/process:", error);
    return NextResponse.json(
      { error: "Error interno del servidor", detail: message },
      { status: 500 }
    );
  }
}

// === GET: endpoint de health check para verificar que está vivo ===
// No requiere autenticación — solo confirma que el endpoint responde.
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "whatsapp-bot-process",
    timestamp: new Date().toISOString(),
  });
}
