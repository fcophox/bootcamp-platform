import { createClient } from '@/utils/supabase/server';
import { getBootcamp } from '@/app/actions/bootcamp';
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
    const bootcampId = parseInt(resolvedParams.id);
    const bootcamp = await getBootcamp(bootcampId);

    if (!bootcamp) {
        return (
            <div className="flex items-center justify-center min-h-screen text-muted">
                Bootcamp no encontrado
            </div>
        );
    }

    // Get custom certificate template if exists
    const customCertificate = await getCertificateByBootcamp(bootcampId);

    return <CertificateClient bootcamp={bootcamp} userName={userName} customCertificate={customCertificate} />;
}
