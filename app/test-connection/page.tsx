'use client';

import { createClient } from '@/utils/supabase/client';
import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function TestConnectionPage() {
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');
    const [envCheck, setEnvCheck] = useState({ url: false, key: false });

    useEffect(() => {
        // Verificar si las variables están cargadas (sin mostrar su valor)
        const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
        const hasKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        setEnvCheck({ url: hasUrl, key: hasKey });

        if (!hasUrl || !hasKey) {
            setStatus('error');
            setMessage('Faltan variables de entorno. Asegúrate de reiniciar el servidor después de editar .env.local');
            return;
        }

        const supabase = createClient();

        async function checkConnection() {
            try {
                // Intentamos obtener la sesión, es una llamada ligera que verifica credenciales
                const { error } = await supabase.auth.getSession();
                if (error) throw error;

                setStatus('success');
                setMessage('¡Conexión exitosa con Supabase!');
            } catch (e: unknown) {
                const errorMessage = e instanceof Error ? e.message : 'Unknown error';
                console.error(e);
                setStatus('error');
                setMessage(`Error de conexión: ${errorMessage}`);
            }
        }

        checkConnection();
    }, []);

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-card-bg border border-border rounded-xl p-8 shadow-xl">
                <h1 className="text-2xl font-bold text-foreground mb-6 text-center">Estado de Supabase</h1>

                <div className="space-y-4 mb-8">
                    <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                        <span className="text-muted text-sm">NEXT_PUBLIC_SUPABASE_URL</span>
                        {envCheck.url ? <CheckCircle size={18} className="text-green-500" /> : <XCircle size={18} className="text-red-500" />}
                    </div>
                    <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                        <span className="text-muted text-sm">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
                        {envCheck.key ? <CheckCircle size={18} className="text-green-500" /> : <XCircle size={18} className="text-red-500" />}
                    </div>
                </div>

                <div className={`p-4 rounded-lg flex items-center gap-3 mb-8 ${status === 'loading' ? 'bg-blue-500/10 text-blue-500' :
                    status === 'success' ? 'bg-green-500/10 text-green-500' :
                        'bg-red-500/10 text-red-500'
                    }`}>
                    {status === 'loading' && <Loader2 size={24} className="animate-spin" />}
                    {status === 'success' && <CheckCircle size={24} />}
                    {status === 'error' && <XCircle size={24} />}
                    <span className="font-medium">{status === 'loading' ? 'Verificando conexión...' : message}</span>
                </div>

                <Link href="/dashboard" className="block w-full text-center py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
                    Ir al Dashboard
                </Link>
            </div>
        </div>
    );
}
