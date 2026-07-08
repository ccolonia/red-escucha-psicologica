import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getResend, FROM_EMAIL } from "@/lib/email";

// GET /api/admin/email-test?to=email@example.com
//
// Endpoint de diagnóstico: dispara un email de prueba a la dirección
// indicada en `?to=` y devuelve { success, messageId?, from, to, error? }.
//
// Restricción: SOLO super_admin (no admin) puede usarlo, para evitar abuso.
//
// Uso típico:
//   curl 'https://www.redescuchapsicologica.com/api/admin/email-test?to=test@example.com' \
//     -H 'Cookie: next-auth.session-token=...'
//
// Posibles respuestas:
//   200 + { success: true, messageId, from, to }    → email enviado OK
//   500 + { success: false, error: "..." }          → Resend rechazó el envío
//   500 + { success: false, error: "EMAIL_FROM..." }→ falta variable de entorno
//   401 / 403 / 400                                 → auth / validación
export async function GET(req: NextRequest) {
  // 1. Auth: solo super_admin
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (role !== "super_admin") {
    return NextResponse.json(
      { error: "Solo super_admin puede usar este endpoint de diagnóstico" },
      { status: 403 }
    );
  }

  // 2. Validar parámetro `to`
  const url = new URL(req.url);
  const to = url.searchParams.get("to");
  if (!to) {
    return NextResponse.json(
      { error: "Falta parámetro 'to' (email destino). Ejemplo: /api/admin/email-test?to=test@example.com" },
      { status: 400 }
    );
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    return NextResponse.json(
      { error: `Email destino inválido: '${to}'` },
      { status: 400 }
    );
  }

  // 3. Disparar email de prueba
  try {
    const resend = getResend(); // Lanza error si falta RESEND_API_KEY o EMAIL_FROM en prod
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: "Test de configuración de email — Red Escucha Psicológica",
      html: `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, sans-serif; background-color: #f5f0e8; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px;">
            <h2 style="color: #2d3b2d; margin-top: 0;">Test de configuración de email</h2>
            <p style="color: #4a5a4a; font-size: 15px;">
              Este email fue enviado desde el endpoint de diagnóstico
              <code style="background: #f0ede5; padding: 2px 6px; border-radius: 4px;">/api/admin/email-test</code>
              de Red Escucha Psicológica.
            </p>
            <p style="color: #4a5a4a; font-size: 15px;">
              Si estás leyendo esto, la configuración de email está funcionando correctamente.
              Los emails de triage (asignación de turnos), aprobación de profesionales,
              reset de password, etc. deberían llegar sin problemas.
            </p>
            <div style="background: #f0ede5; padding: 16px; border-radius: 8px; margin-top: 20px;">
              <p style="margin: 4px 0; color: #2d3b2d;"><strong>From:</strong> ${FROM_EMAIL}</p>
              <p style="margin: 4px 0; color: #2d3b2d;"><strong>To:</strong> ${to}</p>
              <p style="margin: 4px 0; color: #2d3b2d;"><strong>Fecha:</strong> ${new Date().toISOString()}</p>
              <p style="margin: 4px 0; color: #2d3b2d;"><strong>Entorno:</strong> ${process.env.NODE_ENV || "undefined"}</p>
            </div>
            <p style="color: #8a8a8a; font-size: 12px; margin-top: 24px;">
              Si este email llegó a spam, marcá "No es spam" para que futuros emails del sistema
              lleguen a la bandeja principal.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Email test failed:", error);
      return NextResponse.json(
        {
          success: false,
          error: error.message || String(error),
          from: FROM_EMAIL,
          to,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: data?.id || null,
      from: FROM_EMAIL,
      to,
    });
  } catch (error: any) {
    console.error("Email test exception:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || String(error),
        from: FROM_EMAIL,
        to,
      },
      { status: 500 }
    );
  }
}
