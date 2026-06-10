import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export default async function BootcampLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}) {
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return redirect('/login');

    const { data: enrollment, error: enrollError } = await supabase
        .from('BootcampStudent')
        .select('status')
        .eq('bootcampId', id)
        .eq('email', user.email)
        .maybeSingle();

    if (enrollError || !enrollment || enrollment.status !== 'active') {
        return redirect('/dashboard');
    }

    return <>{children}</>;
}
