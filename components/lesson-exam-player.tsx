'use client';

import { useState, useEffect } from 'react';
import {
    Clock, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, Send,
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
    explanation?: string;
    options: Option[];
}

interface LessonExamPlayerProps {
    title: string;
    questions: Question[];
    durationMinutes: number | null; // null means no time limit
    onComplete: (score: number, passed: boolean) => void;
    onNext?: () => void; // Optional callback for navigation
    passingScore?: number; // percentage, default 70
    maxAttempts?: number | null;
    attemptStorageKey?: string;
    initialAttemptCount?: number;
    variant?: 'quiz' | 'exam';
}

export function LessonExamPlayer({ title, questions, durationMinutes, onComplete, onNext, passingScore = 70, maxAttempts = null, attemptStorageKey, initialAttemptCount = 0, variant = 'quiz' }: LessonExamPlayerProps) {
    // State: 'intro' | 'active' | 'review' | 'result'
    const [status, setStatus] = useState<'intro' | 'active' | 'review' | 'result'>('intro');

    // Quiz State
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({}); // questionId -> optionId
    const [timeLeft, setTimeLeft] = useState((durationMinutes || 0) * 60);
    const [result, setResult] = useState<{ score: number; total: number } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [attemptCount, setAttemptCount] = useState(() => {
        if (!attemptStorageKey || typeof window === 'undefined') return initialAttemptCount;
        const storedAttemptCount = Number(window.localStorage.getItem(attemptStorageKey));
        return Math.max(initialAttemptCount, Number.isFinite(storedAttemptCount) ? storedAttemptCount : 0);
    });
    const hasTimeLimit = durationMinutes !== null && durationMinutes > 0;
    const attemptsRemaining = maxAttempts ? Math.max(maxAttempts - attemptCount, 0) : null;
    const hasReachedAttemptLimit = maxAttempts !== null && attemptCount >= maxAttempts;
    const contentLabel = variant === 'exam' ? 'examen' : 'cuestionario';
    const contentLabelTitle = variant === 'exam' ? 'Examen' : 'Cuestionario';

    function handleTimeOut() {
        // alert('¡El tiempo se ha agotado!'); // Removing intrusive alert
        setStatus('review'); // Force review or auto-submit
    }

    // Timer Logic
    useEffect(() => {
        if (status !== 'active' || !hasTimeLimit) return;

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
    }, [status, hasTimeLimit]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleStart = () => {
        if (hasReachedAttemptLimit) return;
        setStatus('active');
        setTimeLeft((durationMinutes || 0) * 60);
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
        const nextAttemptCount = attemptCount + 1;
        setAttemptCount(nextAttemptCount);
        if (attemptStorageKey) {
            window.localStorage.setItem(attemptStorageKey, String(nextAttemptCount));
        }

        // Notify parent
        onComplete(finalScore, passed);
    };

    const handleRetry = () => {
        if (hasReachedAttemptLimit) return;
        setStatus('intro');
        setResult(null);
        setAnswers({});
        setCurrentQuestionIndex(0);
    };

    const progressPercentage = ((Object.keys(answers).length) / questions.length) * 100;

    // RENDER
    return (
        <div className="w-full h-full flex flex-col bg-background relative overflow-hidden">
            {/* Header / Top Bar for Exam Context */}
            {status === 'active' && (
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card-bg/50">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted uppercase tracking-wider">
                            Pregunta {currentQuestionIndex + 1} / {questions.length}
                        </span>
                    </div>
                    {hasTimeLimit && (
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-mono font-medium border ${timeLeft < 60 ? 'bg-red-500/10 text-red-500 border-red-500/20 animate-pulse' : 'bg-primary/5 text-primary border-primary/20'}`}>
                            <Clock size={16} />
                            <span>{formatTime(timeLeft)}</span>
                        </div>
                    )}
                </div>
            )}

            <div className={`flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-12 flex flex-col items-center min-h-[500px] ${status === 'review' || status === 'result' ? 'justify-start' : 'justify-center'}`}>

                {/* INTRO STEP */}
                {status === 'intro' && (
                    <div className="relative w-full flex flex-col items-center justify-center min-h-[500px]">
                        {/* Top Banner Image as per screenshot */}
                        <div className="absolute top-0 left-0 right-0 h-[380px] z-0 overflow-hidden">
                            <img
                                src="/complements/quiz.png"
                                className="w-full h-full object-cover"
                                alt="Quiz Banner"
                            />
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
                        </div>

                        <div className="max-w-2xl w-full bg-card-bg/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] text-center animate-in fade-in zoom-in-95 relative z-10 mt-10">
                            <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6 shadow-none">
                                <Trophy size={32} />
                            </div>
                            <h1 className="text-3xl font-bold mb-4">{title}</h1>
                            <p className="text-muted mb-8 text-lg leading-relaxed">
                                Este {contentLabel} evaluará tus conocimientos. <br />
                                {hasTimeLimit ? (
                                    <>Tienes <span className="font-semibold text-foreground">{durationMinutes} minutos</span> para responder <span className="font-semibold text-foreground">{questions.length} preguntas</span>.</>
                                ) : (
                                    <>Tienes <span className="font-semibold text-foreground">tiempo indefinido</span> para responder <span className="font-semibold text-foreground">{questions.length} preguntas</span>.</>
                                )}
                            </p>

                            <div className="grid grid-cols-3 gap-4 mb-8 text-sm">
                                <div className="p-4 rounded-lg bg-background border border-border">
                                    <span className="block text-muted mb-1">Preguntas</span>
                                    <span className="font-semibold text-lg">{questions.length}</span>
                                </div>
                                <div className="p-4 rounded-lg bg-background border border-border">
                                    <span className="block text-muted mb-1">Tiempo</span>
                                    <span className="font-semibold text-lg">{hasTimeLimit ? `${durationMinutes} min` : 'Indefinido'}</span>
                                </div>
                                <div className="p-4 rounded-lg bg-background border border-border">
                                    <span className="block text-muted mb-1">Intentos</span>
                                    <span className="font-semibold text-lg">{attemptsRemaining === null ? 'Infinitos' : attemptsRemaining}</span>
                                </div>
                            </div>

                            {hasReachedAttemptLimit && (
                                <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-sm font-medium">
                                    Ya alcanzaste el límite de intentos para este {contentLabel}.
                                </div>
                            )}

                            <button
                                onClick={handleStart}
                                disabled={hasReachedAttemptLimit}
                                className="w-full md:w-auto px-10 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                            >
                                Comenzar {contentLabelTitle}
                            </button>
                        </div>
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
                    <div className="max-w-4xl w-full animate-in fade-in">
                        <div className="mb-8">
                            <h2 className="text-3xl font-bold mb-2">Revisión de respuestas</h2>
                            <p className="text-muted">Revisa tus selecciones antes de enviar. Una vez enviado no hay vuelta atrás.</p>
                        </div>

                        <div className="space-y-4 mb-8">
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
                                        <div className="text-sm">
                                            <span className="block text-muted mb-1">Tu respuesta:</span>
                                            <span className={`block ${selectedOption ? 'text-primary font-medium' : 'text-red-500'}`}>
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
                                {isSubmitting ? 'Enviando...' : 'Enviar Cuestionario'}
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                )}

                {/* RESULT STEP */}
                {status === 'result' && result && (
                    <div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-3">
                        <div className="mb-8 flex flex-col gap-5 rounded-3xl bg-card-bg/60 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 border border-border/40">
                            <div className="flex items-center gap-4 min-w-0">
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center shrink-0 ${(result.score / result.total) * 100 >= passingScore ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                    {(result.score / result.total) * 100 >= passingScore ? <CheckCircle size={32} /> : <AlertCircle size={32} />}
                                </div>
                                <div className="min-w-0 text-left">
                                    <h2 className="text-2xl font-bold mb-1">
                                        {(result.score / result.total) * 100 >= passingScore ? '¡Felicitaciones!' : 'Sigue intentando'}
                                    </h2>
                                    <p className="text-sm text-muted">
                                        Has completado el {contentLabel}. Aquí está tu resultado:
                                    </p>
                                </div>
                            </div>

                            <div className="text-left sm:text-right">
                                <div className="text-4xl font-black text-foreground sm:text-5xl">
                                    {Math.round((result.score / result.total) * 100)}%
                                </div>
                                <p className="mt-1 text-sm text-muted">
                                    {result.score} correctas de {result.total}
                                </p>
                            </div>
                        </div>

                        <div className="mb-8 text-left">
                            <div className="flex items-center justify-between gap-3 mb-4">
                                <h3 className="text-xl font-semibold">Detalle de respuestas</h3>
                                <span className="text-xs text-muted">Revisa cada pregunta</span>
                            </div>
                            <div className="space-y-4">
                                {questions.map((question, index) => {
                                    const selectedOptionId = answers[question.id];
                                    const selectedOption = question.options.find(option => option.id === selectedOptionId);
                                    const correctOption = question.options.find(option => option.isCorrect);
                                    const isCorrect = Boolean(correctOption && selectedOptionId === correctOption.id);

                                    return (
                                        <div key={question.id} className="p-4 rounded-xl border border-border bg-background">
                                            <div className="flex items-start justify-between gap-3 mb-3">
                                                <div>
                                                    <span className="text-xs font-semibold text-muted uppercase tracking-wider">Pregunta {index + 1}</span>
                                                    <p className="font-medium mt-1 text-foreground">{question.text}</p>
                                                </div>
                                                <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${isCorrect ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                                    {isCorrect ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                                                    {isCorrect ? 'Correcta' : 'Incorrecta'}
                                                </span>
                                            </div>

                                            <div className="space-y-2">
                                                {question.options.map((option) => {
                                                    const isSelected = option.id === selectedOptionId;
                                                    const optionIsCorrect = Boolean(option.isCorrect);
                                                    const showAsWrong = isSelected && !optionIsCorrect;
                                                    const showAsCorrect = optionIsCorrect;

                                                    return (
                                                        <div
                                                            key={option.id}
                                                            className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${showAsCorrect
                                                                ? 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300'
                                                                : showAsWrong
                                                                ? 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
                                                                : 'border-border bg-background text-muted'
                                                                }`}
                                                        >
                                                            <span>{option.text}</span>
                                                            <span className="shrink-0 text-xs font-semibold">
                                                                {showAsCorrect ? (isSelected ? 'Tu respuesta correcta' : 'Respuesta correcta') : showAsWrong ? 'Tu respuesta' : ''}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {!selectedOption && (
                                                <p className="mt-3 text-sm text-red-500 font-medium">No respondiste esta pregunta.</p>
                                            )}

                                            {question.explanation?.trim() && (
                                                <div className="mt-3 rounded-lg bg-background border border-border px-3 py-2">
                                                    <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Explicación</p>
                                                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{question.explanation}</p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            {(result.score / result.total) * 100 >= passingScore ? (
                                onNext && (
                                    <button
                                        onClick={onNext}
                                        className="w-auto self-end px-8 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 sm:ml-auto"
                                    >
                                        Siguiente <ArrowRight size={18} />
                                    </button>
                                )
                            ) : (
                                <>
                                    {!hasReachedAttemptLimit && (
                                        <button
                                            onClick={handleRetry}
                                            className="w-auto px-8 py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2"
                                        >
                                        <RefreshCw size={18} /> Volver a realizar {contentLabel}
                                        </button>
                                    )}
                                    {onNext && (
                                        <button
                                            onClick={onNext}
                                            className="w-auto self-end px-8 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 sm:ml-auto"
                                        >
                                            Siguiente <ArrowRight size={18} />
                                        </button>
                                    )}
                                </>
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
                message={`¿Estás seguro de enviar tu ${contentLabel}? No podrás cambiar tus respuestas.`}
                isLoading={isSubmitting}
                confirmText="Enviar"
                cancelText="Cancelar"
                variant="success"
            />
        </div>
    );
}
