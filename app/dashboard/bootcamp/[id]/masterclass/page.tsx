import { getMasterclass } from '@/app/actions/masterclass';
import { getBootcamp } from '@/app/actions/bootcamp';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import MasterclassClient from './masterclass-client';

export const dynamic = 'force-dynamic';

export default async function MasterclassPage({ params }: { params: { id: string } }) {
    const id = parseInt(params.id);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return redirect('/login');

    const [bootcamp, masterclass] = await Promise.all([
        getBootcamp(id),
        getMasterclass(id),
    ]);

    if (!bootcamp) return notFound();
    if (!masterclass?.videoUrl) return redirect(`/dashboard/bootcamp/${id}`);

    return <MasterclassClient bootcamp={bootcamp} masterclass={masterclass} />;
}
