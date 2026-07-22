import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { getMasterclass } from '@/app/actions/masterclass';
import { notFound, redirect } from 'next/navigation';
import MasterclassClient from './masterclass-client';

export const dynamic = 'force-dynamic';

export default async function MasterclassPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: idParam } = await params;

    const token = await convexAuthNextjsToken();
    if (!token) return redirect('/login');

    // Parse id - could be a number (legacyId) or a Convex ID string
    const legacyId = parseInt(idParam, 10);
    const isLegacyId = !isNaN(legacyId) && String(legacyId) === idParam;

    // Get bootcamp from Convex
    const bootcamp = await fetchQuery(
        api.bootcamps.getWithModulesAndLessons,
        isLegacyId ? { legacyId } : { convexId: idParam },
        { token }
    );

    if (!bootcamp) return notFound();

    // Get masterclass - use the numeric id if available
    const masterclassId = typeof bootcamp.id === 'number' ? bootcamp.id : (isLegacyId ? legacyId : idParam);
    const masterclass = await getMasterclass(masterclassId);

    if (!masterclass?.videoUrl) return redirect(`/dashboard/bootcamp/${idParam}`);

    return <MasterclassClient bootcamp={{ id: bootcamp.id, title: bootcamp.title }} masterclass={masterclass} />;
}
