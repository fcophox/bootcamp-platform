import { getBootcamp } from '@/app/actions/bootcamp';
import BootcampDetailsClient from './bootcamp-client';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function BootcampDetailsPage({ params }: { params: { id: string } }) {
    const resolvedParams = await Promise.resolve(params);
    const id = parseInt(resolvedParams.id);

    // Fetch by ID (reverted from slug)
    const bootcamp = await getBootcamp(id);

    if (!bootcamp) {
        return notFound();
    }

    // Sort modules and lessons
    // Sort modules and lessons
    if (bootcamp.modules) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        bootcamp.modules.sort((a: any, b: any) => a.order - b.order || a.id - b.id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        bootcamp.modules.forEach((mod: any) => {
            if (mod.lessons) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                mod.lessons.sort((a: any, b: any) => a.order - b.order || a.id - b.id);
            }
        });
    }

    return <BootcampDetailsClient bootcamp={bootcamp} />;
}
