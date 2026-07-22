import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { createClient } from '@/utils/supabase/server';
import { getCertificateByBootcamp } from '@/app/actions/certificate';
import { CertificateClient } from './certificate-client';
import { redirect } from 'next/navigation';

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return redirect('/login');
    
    const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Estudiante';
    
    const resolvedParams = await params;
    const idParam = resolvedParams.id;

    // Parse id - could be a number (legacyId) or a Convex ID string
    const legacyId = parseInt(idParam, 10);
    const isLegacyId = !isNaN(legacyId) && String(legacyId) === idParam;

    const token = await convexAuthNextjsToken();
    if (!token) return redirect('/login');

    // Get bootcamp from Convex (same as bootcamp page)
    const bootcamp = await fetchQuery(
        api.bootcamps.getWithModulesAndLessons,
        isLegacyId ? { legacyId } : { convexId: idParam },
        { token }
    );

    if (!bootcamp) {
        return (
            <div className="flex items-center justify-center min-h-screen text-muted">
                Bootcamp no encontrado
            </div>
        );
    }

    // Get custom certificate template if exists
    // Use legacyId if available, otherwise use the bootcamp id
    const bootcampIdForCertificate = bootcamp.legacyId ?? idParam;
    const customCertificate = await getCertificateByBootcamp(bootcampIdForCertificate);

    return <CertificateClient bootcamp={bootcamp} userName={userName} customCertificate={customCertificate} />;
}
