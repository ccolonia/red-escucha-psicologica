import { Resend } from "resend";
import { db } from "@/lib/db";
import crypto from "crypto";

// Lazy initialization to avoid build-time errors when API key is not set
function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY no está configurada. Agregala en las variables de entorno de Vercel.");
  }
  return new Resend(apiKey);
}

const APP_URL = process.env.NEXTAUTH_URL || "https://red-escucha-psicologica.vercel.app";
// Use custom domain email in production, Resend sandbox in development
// For production: set EMAIL_FROM="Red Escucha Psicológica <noreply@redescuchapsicologica.com>"
// For development: falls back to Resend's sandbox sender
const FROM_EMAIL = process.env.EMAIL_FROM || "Red Escucha Psicológica <onboarding@resend.dev>";

interface SendApprovalEmailParams {
  userEmail: string;
  userName: string;
  userId: string;
}

export async function sendApprovalEmail({ userEmail, userName, userId }: SendApprovalEmailParams) {
  // Generate a secure random token
  const token = crypto.randomBytes(32).toString("hex");

  // Token expires in 48 hours
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 48);

  // Save token to database
  await db.passwordToken.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  const setPasswordUrl = `${APP_URL}/set-password?token=${token}`;

  const resend = getResend();

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: [userEmail],
    subject: "¡Tu cuenta fue aprobada! - Red Escucha Psicológica",
    html: `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Cuenta aprobada - Red Escucha Psicológica</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f5f0e8;
            color: #2d3b2d;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .card {
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 24px rgba(0,0,0,0.08);
          }
          .header {
            background: linear-gradient(135deg, #2d3b2d 0%, #3d5a3d 100%);
            padding: 40px 30px;
            text-align: center;
          }
          .header h1 {
            color: #e8e0d0;
            margin: 0;
            font-size: 24px;
            font-weight: 700;
          }
          .header .subtitle {
            color: #a8c0a8;
            margin-top: 8px;
            font-size: 14px;
          }
          .leaf-icon {
            font-size: 36px;
            display: block;
            margin-bottom: 12px;
          }
          .body {
            padding: 36px 30px;
          }
          .greeting {
            font-size: 18px;
            font-weight: 600;
            color: #2d3b2d;
            margin-bottom: 16px;
          }
          .message {
            font-size: 15px;
            line-height: 1.7;
            color: #4a5a4a;
            margin-bottom: 24px;
          }
          .info-box {
            background-color: #f0ebe0;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 28px;
          }
          .info-box .label {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #7a8a7a;
            margin-bottom: 6px;
          }
          .info-box .value {
            font-size: 16px;
            font-weight: 600;
            color: #2d3b2d;
          }
          .button-container {
            text-align: center;
            margin: 28px 0;
          }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #a8c0a8 0%, #8aaa8a 100%);
            color: #2d3b2d;
            text-decoration: none;
            padding: 16px 40px;
            border-radius: 50px;
            font-size: 16px;
            font-weight: 700;
            letter-spacing: 0.5px;
          }
          .warning {
            font-size: 13px;
            color: #8a7a6a;
            text-align: center;
            margin-top: 20px;
            line-height: 1.6;
          }
          .footer {
            background-color: #f8f4ec;
            padding: 24px 30px;
            text-align: center;
            font-size: 12px;
            color: #9a8a7a;
            line-height: 1.6;
          }
          .footer a {
            color: #6a8a6a;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <span class="leaf-icon">🍃</span>
              <h1>Red Escucha Psicológica</h1>
              <div class="subtitle">Tu cuenta ha sido aprobada</div>
            </div>
            <div class="body">
              <p class="greeting">¡Hola, ${userName}!</p>
              <p class="message">
                Nos alegra informarte que tu solicitud de registro como profesional ha sido <strong>aprobada</strong>.
                Ya podés acceder a tu cuenta en la plataforma de Red Escucha Psicológica.
              </p>

              <div class="info-box">
                <div class="label">Tu usuario de acceso</div>
                <div class="value">${userEmail}</div>
              </div>

              <p class="message">
                Para comenzar, necesitás establecer tu contraseña de acceso. Hacé clic en el botón de abajo:
              </p>

              <div class="button-container">
                <a href="${setPasswordUrl}" class="button">Establecer mi contraseña</a>
              </div>

              <p class="warning">
                ⏰ Este enlace es válido por <strong>48 horas</strong>. Si expiró, contactá al administrador para solicitar uno nuevo.
              </p>
            </div>
            <div class="footer">
              Red Escucha Psicológica<br>
              Av. Sanabria 1616, CABA, Buenos Aires, Argentina<br>
              <a href="mailto:contacto@redescuchapsicologica.com">contacto@redescuchapsicologica.com</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  });

  if (error) {
    console.error("Error sending approval email:", error);
    throw new Error("No se pudo enviar el email de aprobación");
  }

  return { data, token };
}

// ---- Contact Form Notification Email ----

interface SendContactNotificationParams {
  name: string;
  email: string;
  phone: string | null;
  message: string;
  reason: string | null;
}

const REASON_MAP: Record<string, string> = {
  consulta_general: "Consulta general",
  solicitar_turno: "Solicitar turno",
  informacion: "Información",
};

export async function sendContactNotification({ name, email, phone, message, reason }: SendContactNotificationParams) {
  const resend = getResend();
  const reasonLabel = reason ? (REASON_MAP[reason] || reason) : "No especificado";

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: ["contacto@redescuchapsicologica.com", "redescuchapsicologica@gmail.com"],
    subject: `🚀 Nueva consulta de contacto: ${name}`,
    html: `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nueva consulta de contacto</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f5f0e8;
            color: #2d3b2d;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .card {
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 24px rgba(0,0,0,0.08);
          }
          .header {
            background: linear-gradient(135deg, #2d3b2d 0%, #3d5a3d 100%);
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            color: #e8e0d0;
            margin: 0;
            font-size: 22px;
            font-weight: 700;
          }
          .header .subtitle {
            color: #a8c0a8;
            margin-top: 8px;
            font-size: 14px;
          }
          .body {
            padding: 30px;
          }
          .field {
            margin-bottom: 20px;
          }
          .field .label {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #7a8a7a;
            margin-bottom: 4px;
          }
          .field .value {
            font-size: 15px;
            color: #2d3b2d;
            line-height: 1.6;
          }
          .message-box {
            background-color: #f0ebe0;
            border-radius: 12px;
            padding: 16px;
            margin-top: 4px;
          }
          .reason-badge {
            display: inline-block;
            background-color: #a8c0a8;
            color: #2d3b2d;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
          }
          .footer {
            background-color: #f8f4ec;
            padding: 20px 30px;
            text-align: center;
            font-size: 12px;
            color: #9a8a7a;
            line-height: 1.6;
          }
          .footer a {
            color: #6a8a6a;
            text-decoration: none;
          }
          .divider {
            border: none;
            border-top: 1px solid #e0e0d0;
            margin: 16px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <h1>Red Escucha Psicológica</h1>
              <div class="subtitle">Nueva consulta de contacto recibida</div>
            </div>
            <div class="body">
              <div class="field">
                <div class="label">Nombre</div>
                <div class="value" style="font-weight:600;">${name}</div>
              </div>

              <div class="field">
                <div class="label">Email</div>
                <div class="value"><a href="mailto:${email}" style="color:#6a8a6a;">${email}</a></div>
              </div>

              ${phone ? `
              <div class="field">
                <div class="label">Teléfono</div>
                <div class="value"><a href="tel:${phone}" style="color:#6a8a6a;">${phone}</a></div>
              </div>
              ` : ''}

              <div class="field">
                <div class="label">Motivo</div>
                <div class="value"><span class="reason-badge">${reasonLabel}</span></div>
              </div>

              <hr class="divider">

              <div class="field">
                <div class="label">Mensaje</div>
                <div class="message-box">${message.replace(/\n/g, '<br>')}</div>
              </div>
            </div>
            <div class="footer">
              Este mensaje fue enviado desde el formulario de contacto de<br>
              <a href="${APP_URL}">www.redescuchapsicologica.com</a><br>
              <a href="mailto:contacto@redescuchapsicologica.com">contacto@redescuchapsicologica.com</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  });

  if (error) {
    console.error("Error sending contact notification email:", error);
    // Don't throw - the contact was already saved to DB, just log the email error
    return { data: null, error };
  }

  return { data, error: null };
}
