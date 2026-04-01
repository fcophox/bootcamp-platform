import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { getAllLessonFeedback } from '@/app/actions/feedback';
import { FeedbackClient } from './feedback-client';

export const dynamic = 'force-dynamic';

export default async function FeedbackPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return redirect('/login');

    const { data: roleData } = await supabase
        .from('UserRole')
        .select('role')
        .eq('id', user.id)
        .single();

    if (!roleData || roleData.role !== 'superadmin') {
        return redirect('/cms');
    }

    const feedbacks = await getAllLessonFeedback();

    return <FeedbackClient initialFeedbacks={feedbacks} />;
}
