import { createClient } from '@/utils/supabase/server';
import { CmsClient } from './cms-client';

export const dynamic = 'force-dynamic';

export default async function CmsPage() {
    const supabase = await createClient();

    const { data: bootcamps, error } = await supabase
        .from('Bootcamp')
        .select('*')
        .order('createdAt', { ascending: false });

    if (error) {
        console.error('Error fetching bootcamps:', error);
        return <CmsClient bootcamps={[]} />;
    }

    return <CmsClient bootcamps={bootcamps || []} />;
}
