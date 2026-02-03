import { createClient } from '@/utils/supabase/server';
import { DashboardClient } from './dashboard-client';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    const supabase = await createClient();

    // Fetch bootcamps
    const { data: bootcamps, error } = await supabase
        .from('Bootcamp')
        .select('*')
        .order('createdAt', { ascending: false });

    if (error) {
        console.error('Error fetching bootcamps:', error);
        // Return empty array or handle error appropriately
        return <DashboardClient bootcamps={[]} />;
    }

    return <DashboardClient bootcamps={bootcamps || []} />;
}
