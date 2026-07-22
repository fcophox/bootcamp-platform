import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { getMasterclass } from '@/app/actions/masterclass';
import BootcampDetailsClient from './bootcamp-client';
import { notFound, redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function BootcampDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    const idParam = resolvedParams.id;

    const token = await convexAuthNextjsToken();
    if (!token) return redirect('/login');

    // Parse id - could be a number (legacyId) or a Convex ID string
    const legacyId = parseInt(idParam, 10);
    const isLegacyId = !isNaN(legacyId) && String(legacyId) === idParam;

    // Get bootcamp with modules and lessons from Convex
    const bootcamp = await fetchQuery(
        api.bootcamps.getWithModulesAndLessons,
        isLegacyId ? { legacyId } : { convexId: idParam },
        { token }
    );

    if (!bootcamp) {
        return notFound();
    }

    // Get masterclass
    const masterclass = await getMasterclass(isLegacyId ? legacyId : idParam);

    if (bootcamp.modules) {
        bootcamp.modules.sort((a: any, b: any) => a.order - b.order);
        bootcamp.modules.forEach((mod: any) => {
            if (mod.lessons) {
                mod.lessons.sort((a: any, b: any) => a.order - b.order);
            }
        });
    }

    return <BootcampDetailsClient bootcamp={bootcamp} masterclass={masterclass} />;
}
