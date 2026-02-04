import { getBootcamp } from '@/app/actions/bootcamp';
import { CertificateClient } from './certificate-client';

export default async function CertificatePage({ params }: { params: { id: string } }) {
    const resolvedParams = await Promise.resolve(params);
    const bootcampId = parseInt(resolvedParams.id);
    const bootcamp = await getBootcamp(bootcampId);

    if (!bootcamp) {
        return (
            <div className="flex items-center justify-center min-h-screen text-muted">
                Bootcamp no encontrado
            </div>
        );
    }

    return <CertificateClient bootcamp={bootcamp} />;
}
