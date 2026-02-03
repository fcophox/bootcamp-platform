import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
    const cookieStore = await cookies()

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // Verificación estricta: Si la URL no es válida, usamos el placeholder
    // Esto evita que la aplicación se rompa totalmente si el .env está mal
    const isValidUrl = url && (url.startsWith('http://') || url.startsWith('https://'));

    if (!isValidUrl) {
        throw new Error('❌ Error Crítico: Las variables de entorno NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY no están configuradas correctamente. Revisa tu archivo .env.local.');
    }

    return createServerClient(
        url!,
        key!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value, ...options })
                    } catch {
                        // Ignorar si se llama desde un Server Component
                    }
                },
                remove(name: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value: '', ...options })
                    } catch {
                        // Ignorar si se llama desde un Server Component
                    }
                },
            },
        }
    )
}
