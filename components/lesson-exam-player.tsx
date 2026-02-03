'use client';

import { useState, useEffect } from 'react';
import {
    ChevronRight, Clock, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, Send,
    CheckCircle, Trophy, RefreshCw
} from 'lucide-react';
import { ConfirmationModal } from '@/components/confirmation-modal';

interface Option {
    id: string;
    text: string;
    isCorrect?: boolean;
}

interface Question {
    id: string;
    text: string;
    options: Option[];
}

interface LessonExamPlayerProps {
    title: string;
    questions: Question[];
    durationMinutes: number; // Duration in minutes
    onComplete: (score: number, passed: boolean) => void;
    onNext?: () => void; // Optional callback for navigation
    passingScore?: number; // percentage, default 70
}

export function LessonExamPlayer({ title, questions, durationMinutes, onComplete, onNext, passingScore = 70 }: LessonExamPlayerProps) {
    // State: 'intro' | 'active' | 'review' | 'result'
    const [status, setStatus] = useState<'intro' | 'active' | 'review' | 'result'>('intro');

    // Quiz State
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({}); // questionId -> optionId
    const [timeLeft, setTimeLeft] = useState(durationMinutes * 60);
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
        // alert('¡El tiempo se ha agotado!'); // Removing intrusive alert
        setStatus('review'); // Force review or auto-submit
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleStart = () => {
        setStatus('active');
        setTimeLeft(durationMinutes * 60);
        setAnswers({});
        setCurrentQuestionIndex(0);
    };

    const handleAnswer = (questionId: string, optionId: string) => {
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
        // Simulate network delay for effect
        await new Promise(resolve => setTimeout(resolve, 800));

        // Calculate Score
        let correctCount = 0;
        questions.forEach(q => {
            const selectedOptId = answers[q.id];
            const correctOpt = q.options.find(o => o.isCorrect);
            if (correctOpt && correctOpt.id === selectedOptId) {
                correctCount++;
            }
        });

        const finalScore = Math.round((correctCount / questions.length) * 100);
        const passed = finalScore >= passingScore;

        setResult({ score: correctCount, total: questions.length });
        setStatus('result');
        setIsConfirmModalOpen(false);
        setIsSubmitting(false);

        // Notify parent
        onComplete(finalScore, passed);
    };

    const handleRetry = () => {
        setStatus('intro');
        setResult(null);
        setAnswers({});
        setCurrentQuestionIndex(0);
    };

    const progressPercentage = ((Object.keys(answers).length) / questions.length) * 100;

    // RENDER
    return (
        <div className="w-full h-full flex flex-col bg-background">
            {/* Header / Top Bar for Exam Context */}
            {status === 'active' && (
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card-bg/50">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted uppercase tracking-wider">
                            Pregunta {currentQuestionIndex + 1} / {questions.length}
                        </span>
                    </div>
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-mono font-medium border ${timeLeft < 60 ? 'bg-red-500/10 text-red-500 border-red-500/20 animate-pulse' : 'bg-primary/5 text-primary border-primary/20'}`}>
                        <Clock size={16} />
                        <span>{formatTime(timeLeft)}</span>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-12 flex flex-col items-center justify-center min-h-[500px]">

                {/* INTRO STEP */}
                {status === 'intro' && (
                    <div className="max-w-2xl w-full bg-card-bg border border-border rounded-2xl p-8 shadow-sm text-center animate-in fade-in zoom-in-95">
                        <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6 shadow-none">
                            <Trophy size={32} />
                        </div>
                        <h1 className="text-3xl font-bold mb-4">{title}</h1>
                        <p className="text-muted mb-8 text-lg leading-relaxed">
                            Este examen evaluará tus conocimientos. <br />
                            Tienes <span className="font-semibold text-foreground">{durationMinutes} minutos</span> para responder <span className="font-semibold text-foreground">{questions.length} preguntas</span>.
                        </p>

                        <div className="grid grid-cols-3 gap-4 mb-8 text-sm">
                            <div className="p-4 rounded-lg bg-background border border-border">
                                <span className="block text-muted mb-1">Preguntas</span>
                                <span className="font-semibold text-lg">{questions.length}</span>
                            </div>
                            <div className="p-4 rounded-lg bg-background border border-border">
                                <span className="block text-muted mb-1">Tiempo</span>
                                <span className="font-semibold text-lg">{durationMinutes} min</span>
                            </div>
                            <div className="p-4 rounded-lg bg-background border border-border">
                                <span className="block text-muted mb-1">Aprobación</span>
                                <span className="font-semibold text-lg">{passingScore}%</span>
                            </div>
                        </div>

                        <button
                            onClick={handleStart}
                            className="w-full md:w-auto px-10 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:scale-105"
                        >
                            Comenzar Examen
                        </button>
                    </div>
                )}

                {/* ACTIVE QUIZ STEP */}
                {status === 'active' && (
                    <div className="max-w-3xl w-full space-y-8 animate-in slide-in-from-right-4">
                        {/* Progress Bar */}
                        <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all duration-500"
                                style={{ width: `${progressPercentage}%` }}
                            />
                        </div>

                        {/* Question Card */}
                        <div className="min-h-[300px] flex flex-col">

                            <h2 className="text-2xl font-semibold mb-8 leading-relaxed">
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
                            <div className="flex items-center justify-between pt-8 mt-6 border-t border-border">
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
                    <div className="max-w-3xl w-full animate-in fade-in">
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
                        <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${(result.score / result.total) * 100 >= passingScore ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                            {(result.score / result.total) * 100 >= passingScore ? <CheckCircle size={48} /> : <AlertCircle size={48} />}
                        </div>

                        <h2 className="text-3xl font-bold mb-2">
                            {(result.score / result.total) * 100 >= passingScore ? '¡Felicitaciones!' : 'Sigue intentando'}
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

                        <div className="flex flex-col gap-3">
                            {(result.score / result.total) * 100 >= passingScore ? (
                                onNext && (
                                    <button
                                        onClick={onNext}
                                        className="w-full px-8 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                                    >
                                        Siguiente Clase <ArrowRight size={18} />
                                    </button>
                                )
                            ) : (
                                <button
                                    onClick={handleRetry}
                                    className="w-full px-8 py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2"
                                >
                                    <RefreshCw size={18} /> Reintentar
                                </button>
                            )}
                        </div>
                    </div>
                )}
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
