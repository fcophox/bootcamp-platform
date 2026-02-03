import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
    // Verificación básica para evitar crash si las variables no están cargadas
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !key || !url.startsWith('http')) {
        console.warn('Supabase credentials missing or invalid in environment variables.')
        // Retornamos un cliente con valores dummy para permitir que la UI cargue y muestre el aviso
        return createBrowserClient(
            'https://placeholder.supabase.co',
            'placeholder-key'
        )
    }

    return createBrowserClient(url, key)
}
