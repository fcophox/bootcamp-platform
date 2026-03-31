# Solución de Problemas de Despliegue en Vercel

Si encuentras el error "Application error: a server-side exception has occurred" al intentar iniciar sesión, sigue estos pasos:

## 1. Configurar Variables de Entorno

Este error ocurre comúnmente cuando el servidor intenta conectarse a Supabase pero no encuentra las credenciales necesarias.

1. Ve a tu panel de control de **Vercel**.
2. Selecciona tu proyecto (`bootcamp-platform`).
3. Ve a la pestaña **Settings** (Configuración).
4. En el menú lateral, selecciona **Environment Variables**.
5. Asegúrate de agregar las siguientes variables (copiándolas de tu archivo local `.env.local`):

| Variable | Valor |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://tu-proyecto.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `tu-clave-anonima-larga` |

> **Importante:** Después de agregar las variables, debes **redesplegar** tu aplicación (o ir a Deployments > Redeploy) para que los cambios surtan efecto.

## 2. Verificar Logs en Vercel

Si el problema persiste:
1. Ve a la pestaña **Logs** en tu dashboard de Vercel.
2. Filtra por "Error" o busca el ID "Digest" que aparece en la pantalla de error.
3. Esto te dará el mensaje exacto del error (ej. "Error Crítico: Las variables de entorno...").
