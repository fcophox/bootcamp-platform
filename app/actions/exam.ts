'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getExam(examId: number) {
    const supabase = await createClient();

    // Fetch Exam
    const { data: exam, error: examError } = await supabase
        .from('Exam')
        .select('*')
        .eq('id', examId)
        .single();

    if (examError || !exam) {
        throw new Error('Exam not found');
    }

    // Fetch Questions and Options
    // We explicitly DO NOT select 'isCorrect' to avoid cheating
    const { data: questions, error: questionsError } = await supabase
        .from('Question')
        .select(`
            id,
            text,
            order,
            options:Option (
                id,
                text
            )
        `)
        .eq('examId', examId)
        .order('order');

    if (questionsError) {
        throw new Error('Error fetching questions');
    }

    return { exam, questions };
}

export async function submitExam(examId: number, answers: { questionId: number; optionId: number }[]) {
    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // 1. Calculate Score
    // Fetch correct answers for these questions
    const questionIds = answers.map(a => a.questionId);

    const { data: correctOptions } = await supabase
        .from('Option')
        .select('questionId, id')
        .eq('isCorrect', true)
        .in('questionId', questionIds);

    let score = 0;
    const totalQuestions = questionIds.length;

    // Map correct options for easy lookup
    const correctMap = new Map(); // questionId -> optionId
    correctOptions?.forEach(opt => correctMap.set(opt.questionId, opt.id));

    answers.forEach(ans => {
        if (correctMap.get(ans.questionId) === ans.optionId) {
            score++;
        }
    });

    // 2. Save Attempt
    const { data: attempt, error: attemptError } = await supabase
        .from('ExamAttempt')
        .insert({
            userId: user.id,
            examId: examId,
            startedAt: new Date().toISOString(), // In reality we should pass the start time from client or just use now as finish time
            finishedAt: new Date().toISOString(),
            score: score
        })
        .select()
        .single();

    if (attemptError) throw attemptError;

    // 3. Save Responses
    const responsesToInsert = answers.map(ans => ({
        attemptId: attempt.id,
        questionId: ans.questionId,
        optionId: ans.optionId
    }));

    const { error: responseError } = await supabase
        .from('ExamResponse')
        .insert(responsesToInsert);

    if (responseError) throw responseError;

    revalidatePath(`/dashboard/exam/${examId}`);
    return { success: true, score, totalQuestions, attemptId: attempt.id };
}
