import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { redirect } from 'next/navigation';
import { getAllLessonFeedback } from '@/app/actions/feedback';
import { FeedbackClient } from './feedback-client';

export const dynamic = 'force-dynamic';

export default async function FeedbackPage() {
    const token = await convexAuthNextjsToken();
    if (!token) return redirect('/login');

    // Get current user with role from Convex
    const currentUser = await fetchQuery(
        api.users.getCurrentUserWithRole,
        {},
        { token }
    );

    if (!currentUser || currentUser.role !== 'superadmin') {
        return redirect('/cms');
    }

    const feedbacks = await getAllLessonFeedback();

    return <FeedbackClient initialFeedbacks={feedbacks} />;
}
