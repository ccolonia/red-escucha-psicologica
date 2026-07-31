import { Resend } from "resend";
import { db } from "@/lib/db";
import crypto from "crypto";

// Lazy initialization to avoid build-time errors when API key is not set
export function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY no está configurada. Agregala en las variables de entorno de Vercel.");
  }
  // Hardening: en producción, EMAIL_FROM debe estar seteada explícitamente.
  // Sin ella, Resend cae al sandbox (onboarding@resend.dev) que SÓLO entrega
  // al owner de la cuenta — los emails a pacientes/profesionales se descartan
  // silenciosamente. Lanzamos error acá para que el fallo sea ruidoso en logs.
  // En development mantenemos el fallback para conveniencia local.
  if (process.env.NODE_ENV === "production" && !process.env.EMAIL_FROM) {
    throw new Error(
      "EMAIL_FROM no está configurada en producción. Agregala en las variables de entorno de Vercel. " +
      "Formato sugerido: 'Red Escucha Psicológica <noreply@redescuchapsicologica.com>'"
    );
  }
  return new Resend(apiKey);
}

// Email links must always point to the public-facing domain.
// NEXTAUTH_URL may be set to the Vercel internal domain, so we
// prioritize EMAIL_APP_URL, then force the correct public domain
// if NEXTAUTH_URL is the old Vercel domain.
const _nextAuthUrl = process.env.NEXTAUTH_URL || "";
const APP_URL = process.env.EMAIL_APP_URL
  || (_nextAuthUrl && !_nextAuthUrl.includes("vercel.app") ? _nextAuthUrl : "https://www.redescuchapsicologica.com");
// Use custom domain email in production, Resend sandbox in development
// For production: set EMAIL_FROM="Red Escucha Psicológica <noreply@redescuchapsicologica.com>"
// For development: falls back to Resend's sandbox sender
const FROM_EMAIL = process.env.EMAIL_FROM || "Red Escucha Psicológica <onboarding@resend.dev>";
export { FROM_EMAIL };

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

// ---- Password Reset Email ----

interface SendPasswordResetEmailParams {
  userEmail: string;
  userName: string;
  userId: string;
}

export async function sendPasswordResetEmail({ userEmail, userName, userId }: SendPasswordResetEmailParams) {
  // Generate a secure random token
  const token = crypto.randomBytes(32).toString("hex");

  // Token expires in 1 hour
  const expiresAt = new Date();
  expiresAt.setTime(expiresAt.getTime() + 3600000); // 1 hour

  // Save token to database (reuse PasswordToken model)
  await db.passwordToken.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  const resetPasswordUrl = `${APP_URL}/reset-password?token=${token}`;

  const resend = getResend();

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: [userEmail],
    subject: "Recuperá tu contraseña - Red Escucha Psicológica",
    html: `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recuperar contraseña - Red Escucha Psicológica</title>
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
          .security-note {
            background-color: #faf6ee;
            border-left: 4px solid #e8c060;
            border-radius: 0 8px 8px 0;
            padding: 16px 20px;
            margin-top: 24px;
          }
          .security-note p {
            font-size: 13px;
            line-height: 1.6;
            color: #6a5a4a;
            margin: 0;
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
              <div class="subtitle">Recuperación de contraseña</div>
            </div>
            <div class="body">
              <p class="greeting">¡Hola, ${userName}!</p>
              <p class="message">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta. Si fuiste vos, hacé clic en el botón de abajo para crear una nueva contraseña:
              </p>

              <div class="button-container">
                <a href="${resetPasswordUrl}" class="button">Restablecer mi contraseña</a>
              </div>

              <p class="warning">
                ⏰ Este enlace es válido por <strong>1 hora</strong>. Si expiró, podés solicitar uno nuevo desde la página de inicio de sesión.
              </p>

              <div class="security-note">
                <p>
                  <strong>¿No solicitaste este cambio?</strong> Ignorá este email. Tu contraseña permanecerá sin cambios y tu cuenta estará segura. Si tenés dudas, contactanos a <a href="mailto:contacto@redescuchapsicologica.com" style="color:#6a8a6a;">contacto@redescuchapsicologica.com</a>.
                </p>
              </div>
            </div>
            <div class="footer">
              Red Escucha Psicológica<br>
              <a href="mailto:contacto@redescuchapsicologica.com">contacto@redescuchapsicologica.com</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  });

  if (error) {
    console.error("Error sending password reset email:", error);
    throw new Error("No se pudo enviar el email de recuperación");
  }

  return { data, token };
}

// ---- Professional Registration Confirmation Email ----

interface SendProfessionalRegistrationConfirmationParams {
  userEmail: string;
  userName: string;
}

export async function sendProfessionalRegistrationConfirmation({ userEmail, userName }: SendProfessionalRegistrationConfirmationParams) {
  const resend = getResend();

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: [userEmail],
    subject: "Recibimos tu solicitud de registro - Red Escucha Psicológica",
    html: `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Registro recibido - Red Escucha Psicológica</title>
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
          .step-list {
            background-color: #f0ebe0;
            border-radius: 12px;
            padding: 20px 20px 20px 36px;
            margin-bottom: 28px;
          }
          .step-list li {
            font-size: 14px;
            line-height: 1.8;
            color: #4a5a4a;
            margin-bottom: 8px;
          }
          .step-list li:last-child {
            margin-bottom: 0;
          }
          .step-list strong {
            color: #2d3b2d;
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
              <div class="subtitle">Recibimos tu solicitud de registro</div>
            </div>
            <div class="body">
              <p class="greeting">¡Hola, ${userName}!</p>
              <p class="message">
                Gracias por tu interés en formar parte de <strong>Red Escucha Psicológica</strong>.
                Hemos recibido tu solicitud de registro como profesional y la estamos revisando.
              </p>

              <div class="info-box">
                <div class="label">Tu email de registro</div>
                <div class="value">${userEmail}</div>
              </div>

              <p class="message">
                <strong>¿Qué sigue?</strong> Estos son los próximos pasos:
              </p>

              <ol class="step-list">
                <li>Nuestro equipo <strong>revisará tu solicitud</strong> y verificará tus datos profesionales.</li>
                <li>Si tu solicitud es aprobada, recibirás un <strong>email de confirmación</strong> con las instrucciones para activar tu cuenta.</li>
                <li>Una vez activada, podrás <strong>acceder a la plataforma</strong> y configurar tu perfil profesional.</li>
              </ol>

              <p class="message">
                Este proceso suele demorar entre <strong>24 y 48 horas hábiles</strong>. Si no recibiste novedades en ese plazo, podés contactarnos respondiendo este email.
              </p>
            </div>
            <div class="footer">
              Red Escucha Psicológica<br>
              <a href="mailto:contacto@redescuchapsicologica.com">contacto@redescuchapsicologica.com</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  });

  if (error) {
    console.error("Error sending professional registration confirmation email:", error);
    // Don't throw - registration was successful, email is secondary
    return { data: null, error };
  }

  return { data, error: null };
}

// ---- New Professional Registration Admin Notification Email ----

interface SendNewProfessionalAdminNotificationParams {
  professionalName: string;
  professionalEmail: string;
  professionalPhone: string | null;
  profession: string | null;
  license: string;
  specialty: string;
  title: string | null;
}

export async function sendNewProfessionalAdminNotification({
  professionalName,
  professionalEmail,
  professionalPhone,
  profession,
  license,
  specialty,
  title,
}: SendNewProfessionalAdminNotificationParams) {
  const resend = getResend();
  const adminUrl = `${APP_URL}/#login`;

  // professionalName already includes the title (e.g. "Lic. Monica Quiroga")
  // so we don't add it again. Also strip duplicate title prefixes just in case.
  const displayName = professionalName
    .replace(/^(Lic\.\s+)+/, "Lic. ")
    .replace(/^(Dr\.\s+)+/, "Dr. ")
    .replace(/^(Dra\.\s+)+/, "Dra. ")
    .replace(/^(Psic\.\s+)+/, "Psic. ");

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: ["contacto@redescuchapsicologica.com", "redescuchapsicologica@gmail.com"],
    subject: `🩺 Nueva solicitud de registro profesional: ${displayName}`,
    html: `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nuevo profesional registrado</title>
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
            margin-bottom: 16px;
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
          .field .value a {
            color: #6a8a6a;
            text-decoration: none;
          }
          .badge {
            display: inline-block;
            background-color: #e8c060;
            color: #2d3b2d;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
          }
          .divider {
            border: none;
            border-top: 1px solid #e0e0d0;
            margin: 20px 0;
          }
          .button-container {
            text-align: center;
            margin: 24px 0;
          }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #a8c0a8 0%, #8aaa8a 100%);
            color: #2d3b2d;
            text-decoration: none;
            padding: 14px 36px;
            border-radius: 50px;
            font-size: 15px;
            font-weight: 700;
            letter-spacing: 0.5px;
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
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <h1>Red Escucha Psicológica</h1>
              <div class="subtitle">Nueva solicitud de registro profesional</div>
            </div>
            <div class="body">
              <p style="font-size:15px;color:#4a5a4a;margin-bottom:20px;">
                Un nuevo profesional se ha registrado en la plataforma y está <strong>pendiente de aprobación</strong>.
              </p>

              <div class="field">
                <div class="label">Nombre completo</div>
                <div class="value" style="font-weight:600;font-size:17px;">${displayName}</div>
              </div>

              <div class="field">
                <div class="label">Email</div>
                <div class="value"><a href="mailto:${professionalEmail}">${professionalEmail}</a></div>
              </div>

              ${professionalPhone ? `
              <div class="field">
                <div class="label">Teléfono</div>
                <div class="value"><a href="tel:${professionalPhone}">${professionalPhone}</a></div>
              </div>
              ` : ''}

              <div class="field">
                <div class="label">Profesión</div>
                <div class="value">${profession || 'No especificada'}</div>
              </div>

              <div class="field">
                <div class="label">Matrícula</div>
                <div class="value" style="font-weight:600;">${license}</div>
              </div>

              <div class="field">
                <div class="label">Especialidad</div>
                <div class="value">${specialty}</div>
              </div>

              <div class="field">
                <div class="label">Estado</div>
                <div class="value"><span class="badge">Pendiente de aprobación</span></div>
              </div>

              <hr class="divider">

              <p style="font-size:14px;color:#4a5a4a;margin-bottom:16px;">
                Ingresá al panel de administración para revisar y aprobar este profesional:
              </p>

              <div class="button-container">
                <a href="${adminUrl}" class="button">Ir al panel de administración</a>
              </div>
            </div>
            <div class="footer">
              Red Escucha Psicológica<br>
              <a href="mailto:contacto@redescuchapsicologica.com">contacto@redescuchapsicologica.com</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  });

  if (error) {
    console.error("Error sending new professional admin notification email:", error);
    // Don't throw - registration was successful, email is secondary
    return { data: null, error };
  }

  return { data, error: null };
}

// ---- Contact Form Notification Email ----

interface SendContactNotificationParams {
  name: string;
  email: string;
  phone: string | null;
  message: string;
  reason: string | null;
  modality?: string | null;
  age?: string | null;
}

const REASON_MAP: Record<string, string> = {
  consulta_general: "Consulta general",
  solicitar_turno: "Solicitar turno",
  informacion: "Información",
};

export async function sendContactNotification({ name, email, phone, message, reason, modality, age }: SendContactNotificationParams) {
  const resend = getResend();
  const reasonLabel = reason ? (REASON_MAP[reason] || reason) : "No especificado";

  // Mapear modalidad a label legible
  const MODALITY_MAP: Record<string, string> = {
    online: "Online",
    presencial: "Presencial",
    "híbrida": "Híbrida",
    hibrida: "Híbrida",
  };
  const modalityLabel = modality ? (MODALITY_MAP[modality] || modality) : null;

  // === Botón de WhatsApp para el teléfono ===
  // Si el consultante dejó teléfono, generamos un link wa.me con mensaje
  // pre-rellenado para que el admin pueda responder con un clic.
  // El mensaje pre-rellenado incluye el nombre del consultante para que el
  // admin no tenga que tipear nada al iniciar el chat.
  const waPhone = phone ? formatPhoneForWhatsApp(phone) : null;
  const waMessage = phone
    ? encodeURIComponent(
        `Hola ${name}, te contacto desde Red Escucha Psicológica por tu consulta.`
      )
    : null;
  const waUrl = waPhone ? `https://wa.me/${waPhone}?text=${waMessage}` : null;

  // Bloque "Teléfono" que reemplaza al anterior (que solo tenía tel:).
  // Muestra el número + botón verde "Enviar WhatsApp" con el mismo estilo
  // que ya usa el email de triage para consistencia visual.
  const phoneField = phone
    ? `
              <div class="field">
                <div class="label">Teléfono</div>
                <div class="value">
                  <a href="tel:${phone.replace(/[^0-9+]/g, "")}" style="color:#6a8a6a;text-decoration:none;">${phone}</a>
                  ${waUrl ? `
                  <br/>
                  <a href="${waUrl}" target="_blank" rel="noopener noreferrer"
                     style="display:inline-block;margin-top:8px;padding:6px 14px;background-color:#25D366;color:#ffffff;text-decoration:none;border-radius:6px;font-size:12px;font-weight:600;line-height:1;box-shadow:0 1px 2px rgba(0,0,0,0.1);">
                    <span>Enviar WhatsApp</span>
                  </a>
                  ` : ""}
                </div>
              </div>
    `
    : "";

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

              ${phoneField}

              ${age ? `
              <div class="field">
                <div class="label">Edad</div>
                <div class="value" style="font-weight:600;">${age} años</div>
              </div>
              ` : ''}

              <div class="field">
                <div class="label">Motivo</div>
                <div class="value"><span class="reason-badge">${reasonLabel}</span></div>
              </div>

              ${modalityLabel ? `
              <div class="field">
                <div class="label">Modalidad preferida</div>
                <div class="value"><span class="reason-badge">${modalityLabel}</span></div>
              </div>
              ` : ''}

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

// ---- Triage Assignment: Notify Professional ----

interface SendTriageProfessionalNotificationParams {
  professionalEmail: string;
  professionalName: string;
  patientName: string;
  patientPhone: string | null;
  modality: string;
  date: string | null;
  time: string | null;
  timeEnd: string | null;
  reason: string;
  officeAddress?: string | null;
}

const MODALITY_EMAIL_MAP: Record<string, string> = {
  online: "Online (videollamada)",
  presencial: "Presencial",
  "P": "Presencial",
  "OL": "Online (videollamada)",
  híbrida: "Híbrida (lo que suceda primero)",
};

// === Helper: sanitizar teléfono para WhatsApp ===
// Limpia espacios, guiones, paréntesis y el símbolo +.
// Si no empieza con 54 (Argentina), asume formato local y agrega 549
// (código de país + prefijo de celular obligatorio para WhatsApp Argentina).
// Ej: "+54 11 7668-3429" → "5491176683429"
//     "1176683429" → "5491176683429"
//     "5491176683429" → "5491176683429" (sin cambios)
export function formatPhoneForWhatsApp(phone: string | null): string | null {
  if (!phone) return null;
  // === Quitar todo lo que no sea dígito ===
  // Se eliminan espacios, guiones, paréntesis, etc.
  // Se respeta el '+' que indica formato internacional E.164.
  let cleaned = phone.replace(/[^0-9]/g, "");
  if (cleaned.length === 0) return null;

  // === Detección de código de país ===
  // Ya no se hardcodea '549' a todos los números. Se respeta el código
  // de país que viene guardado en la DB. Solo se aplica el fallback
  // argentino si el número es claramente local (sin código de país).

  // 1. Argentina móvil: ya tiene el prefijo 549 → dejar así
  if (cleaned.startsWith("549")) {
    return cleaned;
  }
  // 2. Argentina fijo: ya tiene 54 pero no 549 → dejar así (línea fija)
  //    (no agregar el 9 porque es solo para celulares)
  if (cleaned.startsWith("54") && cleaned.length >= 12) {
    return cleaned;
  }
  // 3. Otros países con código de país explícito (longitud >= 11 dígitos):
  //    - Perú (+51): 51998465686 → 12 dígitos
  //    - Chile (+56): 56912345678 → 11 dígitos
  //    - México (+52): 521234567890 → 13 dígitos
  //    - España (+34): 34612345678 → 11 dígitos
  //    - EE.UU. (+1): 12125551234 → 11 dígitos
  //    Si empieza con un código de país conocido, dejarlo así.
  const knownCountryCodes = [
    "51",  // Perú
    "52",  // México
    "53",  // Cuba
    "54",  // Argentina (ya manejado arriba)
    "55",  // Brasil
    "56",  // Chile
    "57",  // Colombia
    "58",  // Venezuela
    "1",   // EE.UU. / Canadá
    "34",  // España
    "44",  // UK
    "33",  // Francia
    "49",  // Alemania
    "39",  // Italia
    "598", // Uruguay
    "595", // Paraguay
    "591", // Bolivia
    "593", // Ecuador
    "503", // El Salvador
    "504", // Honduras
    "505", // Nicaragua
    "506", // Costa Rica
    "507", // Panamá
    "502", // Guatemala
    "1809", // Rep. Dominicana
  ];
  // Si el número tiene 11+ dígitos y empieza con un código conocido,
  // asumir que ya viene con código de país → no tocar
  if (cleaned.length >= 11) {
    for (const code of knownCountryCodes) {
      if (cleaned.startsWith(code)) {
        return cleaned;
      }
    }
  }

  // 4. Número local argentino sin código de país:
  //    - Si empieza con 0 (ej: 01176683429), quitar el 0 y agregar 549
  //    - Si tiene 10 dígitos (ej: 1176683429), agregar 549
  //    - Si tiene 9 dígitos y empieza con 9 (ej: 91176683429), agregar 54
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }
  // Asumir Argentina: agregar 549 (celular) como fallback
  // Esto es retrocompatible con números ya guardados sin código de país
  return "549" + cleaned;
}

export async function sendTriageProfessionalNotification({
  professionalEmail,
  professionalName,
  patientName,
  patientPhone,
  modality,
  date,
  time,
  timeEnd,
  reason,
  officeAddress,
}: SendTriageProfessionalNotificationParams) {
  try {
    const resend = getResend();
    const modalityLabel = MODALITY_EMAIL_MAP[modality] || modality;
    // Build time range display
    const timeDisplay = date && time
      ? timeEnd
        ? `${date} de ${time} a ${timeEnd} hs`
        : `${date} a las ${time} hs`
      : "";
    const appointmentInfo = timeDisplay
      ? `<div class="field"><div class="label">Horario asignado</div><div class="value" style="font-weight:600;font-size:17px;">${timeDisplay}</div></div>`
      : "";
    // Dynamic location: officeAddress for presencial, enlace for online
    const locationInfo = (modality === "P" || modality === "presencial") && officeAddress
      ? `<div class="field"><div class="label">Dirección del consultorio</div><div class="value">${officeAddress}</div></div>`
      : (modality === "OL" || modality === "online")
        ? `<div class="field"><div class="label">Modalidad</div><div class="value">Online (videollamada) — Enviá el enlace de videollamada al paciente</div></div>`
        : "";

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [professionalEmail],
      subject: `🩺 Nuevo paciente asignado: ${patientName}`,
      html: `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Nuevo paciente asignado</title>
          <style>
            body { margin:0; padding:0; font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif; background-color:#f5f0e8; color:#2d3b2d; }
            .container { max-width:600px; margin:0 auto; padding:20px; }
            .card { background-color:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
            .header { background:linear-gradient(135deg,#2d3b2d 0%,#3d5a3d 100%); padding:30px; text-align:center; }
            .header h1 { color:#e8e0d0; margin:0; font-size:22px; font-weight:700; }
            .header .subtitle { color:#a8c0a8; margin-top:8px; font-size:14px; }
            .body { padding:30px; }
            .field { margin-bottom:16px; }
            .field .label { font-size:12px; text-transform:uppercase; letter-spacing:1px; color:#7a8a7a; margin-bottom:4px; }
            .field .value { font-size:15px; color:#2d3b2d; line-height:1.6; }
            .highlight { background-color:#f0ebe0; border-radius:12px; padding:20px; margin:20px 0; }
            .footer { background-color:#f8f4ec; padding:20px 30px; text-align:center; font-size:12px; color:#9a8a7a; line-height:1.6; }
            .footer a { color:#6a8a6a; text-decoration:none; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="card">
              <div class="header">
                <h1>Red Escucha Psicológica</h1>
                <div class="subtitle">Nuevo paciente asignado</div>
              </div>
              <div class="body">
                <p style="font-size:16px;font-weight:600;color:#2d3b2d;margin-bottom:16px;">Hola, ${professionalName}:</p>
                <p style="font-size:15px;color:#4a5a4a;margin-bottom:20px;">
                  Se te ha asignado un nuevo paciente desde el sistema de triage. Por favor, contactalo/a a la brevedad para coordinar el inicio del proceso terapéutico.
                </p>
                <div class="highlight">
                  <div class="field">
                    <div class="label">Paciente</div>
                    <div class="value" style="font-weight:600;font-size:17px;">${patientName}</div>
                  </div>
                  ${patientPhone ? (() => { const waPhone = formatPhoneForWhatsApp(patientPhone); return `<div class="field"><div class="label">Teléfono del paciente</div><div class="value"><a href="https://wa.me/${waPhone}" target="_blank" style="color:#6a8a6a;text-decoration:none;">${patientPhone}</a> <a href="https://wa.me/${waPhone}" target="_blank" style="display:inline-block;margin-left:8px;padding:4px 12px;background-color:#25D366;color:#ffffff;text-decoration:none;border-radius:4px;font-size:12px;font-weight:600;">Enviar WhatsApp</a></div></div>`; })() : ""}
                  <div class="field">
                    <div class="label">Modalidad</div>
                    <div class="value">${modalityLabel}</div>
                  </div>
                  ${appointmentInfo}
                  ${locationInfo}
                  <div class="field">
                    <div class="label">Motivo de consulta</div>
                    <div class="value">${reason}</div>
                  </div>
                </div>
                <p style="font-size:14px;color:#4a5a4a;margin-top:20px;">
                  <strong>Importante:</strong> Si la modalidad es Online, enviale el enlace de videollamada. Si es Presencial, reconfirmale las indicaciones para acercarse al consultorio.
                </p>
              </div>
              <div class="footer">
                Red Escucha Psicológica<br>
                <a href="mailto:contacto@redescuchapsicologica.com">contacto@redescuchapsicologica.com</a>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Error sending triage professional notification:", error);
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    console.error("Error sending triage professional notification:", err);
    return { data: null, error: err };
  }
}

// ---- Triage Assignment: Notify Patient ----

interface SendTriagePatientNotificationParams {
  patientEmail: string;
  patientName: string;
  professionalName: string;
  modality: string;
  date: string | null;
  time: string | null;
  timeEnd: string | null;
  officeAddress?: string | null;
}

export async function sendTriagePatientNotification({
  patientEmail,
  patientName,
  professionalName,
  modality,
  date,
  time,
  timeEnd,
  officeAddress,
}: SendTriagePatientNotificationParams) {
  try {
    const resend = getResend();
    const modalityLabel = MODALITY_EMAIL_MAP[modality] || modality;
    // Build time range display
    const timeDisplay = date && time
      ? timeEnd
        ? `${date} de ${time} a ${timeEnd} hs`
        : `${date} a las ${time} hs`
      : "";
    const appointmentInfo = timeDisplay
      ? `<div class="field"><div class="label">Fecha y hora</div><div class="value" style="font-weight:600;">${timeDisplay}</div></div>`
      : "";
    // Dynamic location
    const locationInfo = (modality === "P" || modality === "presencial") && officeAddress
      ? `<div class="field"><div class="label">Dirección</div><div class="value">${officeAddress}</div></div>`
      : (modality === "OL" || modality === "online")
        ? `<div class="field"><div class="label">Modalidad</div><div class="value">Online (videollamada) — El profesional te enviará el enlace</div></div>`
        : "";

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [patientEmail],
      subject: "Tu solicitud fue procesada - Red Escucha Psicológica",
      html: `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Solicitud procesada</title>
          <style>
            body { margin:0; padding:0; font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif; background-color:#f5f0e8; color:#2d3b2d; }
            .container { max-width:600px; margin:0 auto; padding:20px; }
            .card { background-color:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
            .header { background:linear-gradient(135deg,#2d3b2d 0%,#3d5a3d 100%); padding:40px 30px; text-align:center; }
            .header h1 { color:#e8e0d0; margin:0; font-size:24px; font-weight:700; }
            .header .subtitle { color:#a8c0a8; margin-top:8px; font-size:14px; }
            .body { padding:36px 30px; }
            .highlight { background-color:#f0ebe0; border-radius:12px; padding:20px; margin:20px 0; }
            .field { margin-bottom:16px; }
            .field .label { font-size:12px; text-transform:uppercase; letter-spacing:1px; color:#7a8a7a; margin-bottom:4px; }
            .field .value { font-size:15px; color:#2d3b2d; line-height:1.6; }
            .footer { background-color:#f8f4ec; padding:24px 30px; text-align:center; font-size:12px; color:#9a8a7a; line-height:1.6; }
            .footer a { color:#6a8a6a; text-decoration:none; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="card">
              <div class="header">
                <h1>Red Escucha Psicológica</h1>
                <div class="subtitle">Tu solicitud ha sido procesada</div>
              </div>
              <div class="body">
                <p style="font-size:16px;font-weight:600;color:#2d3b2d;margin-bottom:16px;">Hola, ${patientName}:</p>
                <p style="font-size:15px;color:#4a5a4a;margin-bottom:20px;">
                  Nos alegra informarte que tu solicitud ha sido procesada. Te hemos asignado con un/a profesional de nuestra red.
                </p>
                <div class="highlight">
                  <div class="field">
                    <div class="label">Tu profesional asignado/a</div>
                    <div class="value" style="font-weight:600;font-size:17px;">${professionalName}</div>
                  </div>
                  <div class="field">
                    <div class="label">Modalidad</div>
                    <div class="value">${modalityLabel}</div>
                  </div>
                  ${appointmentInfo}
                  ${locationInfo}
                </div>
                <p style="font-size:15px;color:#4a5a4a;margin-top:20px;">
                  A la brevedad, el/la profesional se pondrá en contacto contigo para coordinar el inicio de tu proceso. Si es Online, recibirás el enlace de videollamada. Si es Presencial, te confirmará las indicaciones para tu primera sesión.
                </p>
                <p style="font-size:14px;color:#7a8a7a;margin-top:16px;">
                  Si tenés alguna consulta, podés escribirnos a <a href="mailto:contacto@redescuchapsicologica.com" style="color:#6a8a6a;">contacto@redescuchapsicologica.com</a>
                </p>
              </div>
              <div class="footer">
                Red Escucha Psicológica<br>
                <a href="mailto:contacto@redescuchapsicologica.com">contacto@redescuchapsicologica.com</a>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Error sending triage patient notification:", error);
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    console.error("Error sending triage patient notification:", err);
    return { data: null, error: err };
  }
}

// ---- Cancellation by Professional ----
// Se dispara cuando un profesional cancela un turno confirmado o pendiente.
// El appointment queda en estado 'cancelled_by_professional' (intermedio)
// hasta que el admin decida reasignar a otro profesional o cancelarlo
// definitivamente. El email le avisa al paciente que el profesional tuvo
// que cancelar y que el equipo de Red Escucha se va a comunicar para
// reasignarlo.

interface SendCancellationByProfessionalEmailParams {
  patientEmail: string;
  patientName: string;
  professionalName: string;
  date: string | null;
  time: string | null;
  timeEnd?: string | null;
  reason?: string | null; // motivo opcional que el profesional puede escribir
  modality: string;
}

export async function sendCancellationByProfessionalEmail({
  patientEmail,
  patientName,
  professionalName,
  date,
  time,
  timeEnd,
  reason,
  modality,
}: SendCancellationByProfessionalEmailParams) {
  try {
    const resend = getResend();
    const modalityLabel = MODALITY_EMAIL_MAP[modality] || modality;
    const timeDisplay = date && time
      ? timeEnd
        ? `${date} de ${time} a ${timeEnd} hs`
        : `${date} a las ${time} hs`
      : "";
    const appointmentInfo = timeDisplay
      ? `<div class="field"><div class="label">Turno cancelado</div><div class="value" style="font-weight:600;">${timeDisplay}</div></div>`
      : "";
    const reasonInfo = reason
      ? `<div class="field"><div class="label">Motivo</div><div class="value">${reason}</div></div>`
      : "";

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [patientEmail],
      subject: "Tu turno fue cancelado por el profesional - Red Escucha Psicológica",
      html: `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f5f0e8;color:#2d3b2d;">
          <div style="max-width:600px;margin:0 auto;padding:20px;">
            <div class="card" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
              <div class="header" style="background:linear-gradient(135deg,#8a3d3d 0%,#6d2828 100%);padding:30px;text-align:center;">
                <h1 style="color:#f5e0e0;margin:0;font-size:22px;font-weight:700;">Turno cancelado</h1>
                <p class="subtitle" style="color:#e8c0c0;margin-top:6px;font-size:13px;">Te avisamos sobre una cancelación</p>
              </div>
              <div style="padding:30px;">
                <p style="font-size:16px;font-weight:600;color:#2d3b2d;margin-bottom:16px;">Hola, ${patientName}:</p>
                <p style="font-size:15px;color:#4a5a4a;margin-bottom:20px;">
                  Lamentamos informarte que <strong>${professionalName}</strong> tuvo que cancelar tu turno programado.
                  Entendemos que esto puede ser una molestia y pedimos disculpas por los inconvenientes.
                </p>
                <div class="highlight" style="background:#faf7f2;border-radius:12px;padding:20px;margin:20px 0;">
                  ${appointmentInfo}
                  ${reasonInfo}
                  <div class="field">
                    <div class="label" style="font-size:12px;color:#8a7a6a;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Modalidad</div>
                    <div class="value" style="font-size:15px;color:#2d3b2d;">${modalityLabel}</div>
                  </div>
                </div>
                <p style="font-size:15px;color:#4a5a4a;margin-top:20px;">
                  <strong>¿Qué pasa ahora?</strong> Nuestro equipo de Red Escucha Psicológica se va a comunicar con vos
                  a la brevedad para reasignarte con otro profesional disponible que se ajuste a tus necesidades.
                  Si preferís contactarnos vos, podés escribir a
                  <a href="mailto:contacto@redescuchapsicologica.com" style="color:#6a8a6a;">contacto@redescuchapsicologica.com</a>
                  o respondiendo este email.
                </p>
                <p style="font-size:14px;color:#4a5a4a;margin-top:16px;">
                  Gracias por tu comprensión y confianza.
                </p>
              </div>
              <div class="footer" style="background:#f5f0e8;padding:20px 30px;text-align:center;font-size:12px;color:#8a7a6a;">
                Red Escucha Psicológica<br>
                <a href="mailto:contacto@redescuchapsicologica.com" style="color:#8a7a6a;">contacto@redescuchapsicologica.com</a>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Error sending cancellation by professional email:", error);
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    console.error("Error sending cancellation by professional email:", err);
    return { data: null, error: err };
  }
}
