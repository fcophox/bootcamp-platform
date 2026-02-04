'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/sidebar';
import { useSidebar } from '@/components/sidebar-context';
import { ChevronRight, Clock, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, Send } from 'lucide-react';
import { ConfirmationModal } from '@/components/confirmation-modal';
import { submitExam } from '@/app/actions/exam';
import { useRouter } from 'next/navigation';

interface Option {
    id: number;
    text: string;
}

interface Question {
    id: number;
    text: string;
    options: Option[];
}

interface Exam {
    id: number;
    title: string;
    description: string;
    timeLimitSeconds: number;
}

interface ExamClientProps {
    exam: Exam;
    questions: Question[];
}

export function ExamClient({ exam, questions }: ExamClientProps) {
    const { isCollapsed } = useSidebar();
    const router = useRouter();

    // State: 'intro' | 'active' | 'review' | 'result'
    const [status, setStatus] = useState<'intro' | 'active' | 'review' | 'result'>('intro');

    // Quiz State
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<number, number>>({}); // questionId -> optionId
    const [timeLeft, setTimeLeft] = useState(exam.timeLimitSeconds);
    const [result, setResult] = useState<{ score: number; total: number } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

    // Timer Logic
    useEffect(() => {
        if (status !== 'active') return;

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleTimeOut();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [status]);

    const handleTimeOut = () => {
        alert('¡El tiempo se ha agotado!');
        setStatus('review'); // Force review or auto-submit
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleStart = () => {
        setStatus('active');
        setTimeLeft(exam.timeLimitSeconds);
    };

    const handleAnswer = (questionId: number, optionId: number) => {
        setAnswers(prev => ({ ...prev, [questionId]: optionId }));
    };

    const handleNext = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            setStatus('review');
        }
    };

    const handlePrevious = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(prev => prev - 1);
        }
    };

    const handleSubmit = () => {
        setIsConfirmModalOpen(true);
    };

    const handleConfirmSubmit = async () => {
        setIsSubmitting(true);
        try {
            const formattedAnswers = Object.entries(answers).map(([qId, optId]) => ({
                questionId: parseInt(qId),
                optionId: optId
            }));

            const res = await submitExam(exam.id, formattedAnswers);
            setResult({ score: res.score, total: res.totalQuestions });
            setStatus('result');
            setIsConfirmModalOpen(false);
        } catch (error) {
            console.error(error);
            alert('Hubo un error al enviar el examen. Por favor intenta nuevamente.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const progressPercentage = ((Object.keys(answers).length) / questions.length) * 100;

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Sidebar />

            <div className={`flex flex-col min-h-screen transition-all duration-300 ${isCollapsed ? 'ml-16' : 'ml-64'}`}>
                {/* Header (Simplified for Exam) */}
                <header className={`fixed top-0 right-0 z-1 h-[60px] bg-background/80 backdrop-blur-md border-b border-border flex items-center px-6 justify-between transition-all duration-300 ${isCollapsed ? 'left-16' : 'left-64'}`}>
                    <div className="flex items-center gap-2 text-sm text-foreground font-medium">
                        <span>Examen</span>
                        <ChevronRight size={14} className="text-muted" />
                        <span className="text-primary">{exam.title}</span>
                    </div>
                    {status === 'active' && (
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-mono font-medium border ${timeLeft < 60 ? 'bg-red-500/10 text-red-500 border-red-500/20 animate-pulse' : 'bg-primary/5 text-primary border-primary/20'}`}>
                            <Clock size={16} />
                            <span>{formatTime(timeLeft)}</span>
                        </div>
                    )}
                </header>

                <main className="flex-1 pt-[92px] px-6 pb-12 flex flex-col items-center justify-center min-h-[calc(100vh-60px)]">

                    {/* INTRO STEP */}
                    {status === 'intro' && (
                        <div className="max-w-2xl w-full bg-card-bg border border-border rounded-2xl p-8 shadow-sm text-center animate-in fade-in zoom-in-95">
                            <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle2 size={32} />
                            </div>
                            <h1 className="text-3xl font-bold mb-4">{exam.title}</h1>
                            <p className="text-muted mb-8 text-lg leading-relaxed">{exam.description || 'Este examen evaluará tus conocimientos sobre el módulo. Tienes un tiempo límite para completarlo.'}</p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 text-sm">
                                <div className="p-4 rounded-lg bg-background border border-border">
                                    <span className="block text-muted mb-1">Preguntas</span>
                                    <span className="font-semibold text-lg">{questions.length}</span>
                                </div>
                                <div className="p-4 rounded-lg bg-background border border-border">
                                    <span className="block text-muted mb-1">Tiempo</span>
                                    <span className="font-semibold text-lg">{Math.round(exam.timeLimitSeconds / 60)} min</span>
                                </div>
                                <div className="p-4 rounded-lg bg-background border border-border">
                                    <span className="block text-muted mb-1">Aprobación</span>
                                    <span className="font-semibold text-lg">70%</span>
                                </div>
                            </div>

                            <button
                                onClick={handleStart}
                                className="w-full md:w-auto px-8 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                            >
                                Comenzar Examen
                            </button>
                        </div>
                    )}

                    {/* ACTIVE QUIZ STEP */}
                    {status === 'active' && (
                        <div className="max-w-3xl w-full space-y-6 animate-in slide-in-from-right-4">
                            {/* Progress Bar */}
                            <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all duration-500"
                                    style={{ width: `${progressPercentage}%` }}
                                />
                            </div>

                            {/* Question Card */}
                            <div className="min-h-[400px] flex flex-col">
                                <span className="text-sm font-medium text-muted uppercase tracking-wider mb-4">
                                    Pregunta {currentQuestionIndex + 1} de {questions.length}
                                </span>

                                <h2 className="text-2xl font-semibold mb-8">
                                    {questions[currentQuestionIndex].text}
                                </h2>

                                <div className="space-y-3 flex-1">
                                    {questions[currentQuestionIndex].options.map((option) => {
                                        const isSelected = answers[questions[currentQuestionIndex].id] === option.id;
                                        return (
                                            <button
                                                key={option.id}
                                                onClick={() => handleAnswer(questions[currentQuestionIndex].id, option.id)}
                                                className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between group ${isSelected
                                                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                                    }`}
                                            >
                                                <span className={`${isSelected ? 'text-primary font-medium' : 'text-foreground'}`}>
                                                    {option.text}
                                                </span>
                                                {isSelected && <CheckCircle2 size={18} className="text-primary" />}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Navigation */}
                                <div className="flex items-center justify-between pt-8 mt-4 border-t border-border">
                                    <button
                                        onClick={handlePrevious}
                                        disabled={currentQuestionIndex === 0}
                                        className="flex items-center gap-2 px-4 py-2 text-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ArrowLeft size={18} />
                                        Anterior
                                    </button>

                                    <button
                                        onClick={handleNext}
                                        disabled={!answers[questions[currentQuestionIndex].id]}
                                        className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-primary/10"
                                    >
                                        {currentQuestionIndex === questions.length - 1 ? 'Revisar' : 'Siguiente'}
                                        {currentQuestionIndex < questions.length - 1 && <ArrowRight size={18} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* REVIEW STEP */}
                    {status === 'review' && (
                        <div className="max-w-3xl w-full  animate-in fade-in">
                            <h2 className="text-2xl font-bold mb-2">Revisión de respuestas</h2>
                            <p className="text-muted mb-8">Revisa tus selecciones antes de enviar. Una vez enviado no hay vuelta atrás.</p>

                            <div className="space-y-4 mb-8 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                {questions.map((q, idx) => {
                                    const selectedOptionId = answers[q.id];
                                    const selectedOption = q.options.find(o => o.id === selectedOptionId);

                                    return (
                                        <div key={q.id} className="p-4 rounded-lg bg-background border border-border">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-medium text-sm text-muted">Pregunta {idx + 1}</h4>
                                                <button
                                                    onClick={() => {
                                                        setCurrentQuestionIndex(idx);
                                                        setStatus('active');
                                                    }}
                                                    className="text-primary text-md hover:underline"
                                                >
                                                    Editar
                                                </button>
                                            </div>
                                            <p className="font-medium mb-2">{q.text}</p>
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-muted">Tu respuesta:</span>
                                                <span className={selectedOption ? 'text-primary font-medium' : 'text-red-500'}>
                                                    {selectedOption ? selectedOption.text : 'Sin responder'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex gap-3 justify-end border-t border-border pt-6">
                                <button
                                    onClick={() => setStatus('active')}
                                    className="px-6 py-2.5 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                    Volver
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting}
                                    className="flex items-center gap-2 px-8 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
                                >
                                    {isSubmitting ? 'Enviando...' : 'Enviar Examen'}
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* RESULT STEP */}
                    {status === 'result' && result && (
                        <div className="max-w-xl w-full bg-card-bg border border-border rounded-2xl p-10 shadow-lg text-center animate-in zoom-in-95">
                            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${result.score / result.total >= 0.7 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                {result.score / result.total >= 0.7 ? <CheckCircle2 size={48} /> : <AlertCircle size={48} />}
                            </div>

                            <h2 className="text-3xl font-bold mb-2">
                                {result.score / result.total >= 0.7 ? '¡Felicitaciones!' : 'Sigue intentando'}
                            </h2>
                            <p className="text-muted mb-8">
                                Has completado el examen. Aquí está tu resultado:
                            </p>

                            <div className="py-8 border-y border-border mb-8">
                                <div className="text-5xl font-black mb-2 text-foreground">
                                    {Math.round((result.score / result.total) * 100)}%
                                </div>
                                <p className="text-muted">
                                    {result.score} correctas de {result.total}
                                </p>
                            </div>

                            <button
                                onClick={() => router.push('/dashboard')}
                                className="w-full px-8 py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:opacity-90 transition-all"
                            >
                                Volver al Dashboard
                            </button>
                        </div>
                    )}

                </main>
            </div>
            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={handleConfirmSubmit}
                title="¿Estás seguro?"
                message="¿Estás seguro de enviar tu examen? No podrás cambiar tus respuestas."
                isLoading={isSubmitting}
                confirmText="Enviar"
                cancelText="Cancelar"
                variant="success"
            />
        </div>
    );
}
