import { getExam } from '@/app/actions/exam';
import { ExamClient } from './exam-client';

export const dynamic = 'force-dynamic';

export default async function ExamPage({ params }: { params: { id: string } }) {
    const resolvedParams = await Promise.resolve(params);
    const id = parseInt(resolvedParams.id);
    let examData = null;

    try {
        examData = await getExam(id);
    } catch {
        // Error handling via check below
    }

    if (!examData || !examData.exam) {
        return (
            <div className="flex items-center justify-center min-h-screen text-muted-foreground">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-2">Error</h1>
                    <p>No se pudo cargar el examen o no existe.</p>
                </div>
            </div>
        );
    }
    return <ExamClient exam={examData.exam} questions={examData.questions} />;
}
