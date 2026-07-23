import { NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { sendEmail } from '@/lib/email';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: Request) {
  try {
    const { email }: { email: string } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      );
    }

    // Crear token en Convex
    const result = await convex.mutation(api.passwordReset.createResetToken, {
      email,
    });

    // Si el usuario existe, enviar email
    if (result.userExists && result.token) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const resetUrl = `${baseUrl}/reset-password?token=${result.token}`;

      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 560px; border-collapse: collapse; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #18181b;">
                Recuperar Contraseña
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 0 40px;">
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #52525b;">
                Hola,
              </p>
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #52525b;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta. 
                Haz clic en el botón de abajo para crear una nueva contraseña.
              </p>
              
              <!-- Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 8px 0 32px;">
                    <a href="${resetUrl}" 
                       style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: #ffffff; background-color: #7c3aed; border-radius: 8px; text-decoration: none; transition: background-color 0.2s;">
                      Restablecer Contraseña
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #71717a;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:
              </p>
              <p style="margin: 0 0 24px; font-size: 13px; line-height: 1.6; color: #7c3aed; word-break: break-all;">
                ${resetUrl}
              </p>
              
              <!-- Warning -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background: #fef3c7; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #92400e;">
                      <strong>Importante:</strong> Este enlace expirará en 1 hora. 
                      Si no solicitaste cambiar tu contraseña, puedes ignorar este correo.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 40px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #a1a1aa; text-align: center;">
                Este correo fue enviado desde la plataforma Synaptia.
                <br>
                Si tienes problemas, contacta a soporte.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `;

      const emailResult = await sendEmail({
        to: email,
        subject: 'Recuperar tu contraseña - Synaptia',
        html: emailHtml,
      });

      if (emailResult.error) {
        console.error('Error sending password reset email:', emailResult.error);
        // No revelamos el error al usuario por seguridad
      }
    }

    // Siempre respondemos con éxito para no revelar si el email existe
    return NextResponse.json({
      success: true,
      message: 'Si el correo está registrado, recibirás instrucciones para recuperar tu contraseña.',
    });

  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    );
  }
}
