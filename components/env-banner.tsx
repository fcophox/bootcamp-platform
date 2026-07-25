import { isProdEnv } from '@/utils/env';

// Fixed strip at the very top of the viewport so dev is unmistakable at a
// glance when jumping between bootcamp-dev.nodrize.dev and the real prod
// site. Renders nothing in production.
export function EnvBanner() {
    if (isProdEnv()) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-yellow-400 text-black text-center text-xs font-semibold py-1 tracking-wide">
            ENTORNO DE DESARROLLO — no es el sitio real
        </div>
    );
}
