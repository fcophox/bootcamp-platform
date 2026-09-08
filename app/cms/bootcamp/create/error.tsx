'use client';

export default function CreateBootcampError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    if (process.env.NODE_ENV === 'development') {
        console.error('[CreateBootcampError]', error.message, error.stack);
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-8">
            <div className="max-w-md rounded-xl border border-red-500/20 bg-red-500/10 p-6">
                <h2 className="text-lg font-semibold text-red-500 mb-2">
                    Error al cargar la página
                </h2>
                <p className="text-sm text-red-400/80 mb-4">
                    {process.env.NODE_ENV === 'development'
                        ? error.message
                        : 'Ocurrió un error inesperado al cargar el formulario de creación.'}
                </p>
                <button
                    onClick={reset}
                    className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors"
                >
                    Reintentar
                </button>
            </div>
        </div>
    );
}