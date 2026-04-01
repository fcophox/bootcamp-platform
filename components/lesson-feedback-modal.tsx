'use client';

import { X, Send, Heart } from 'lucide-react';
import { useEffect, useState } from 'react';

interface LessonFeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (comment: string) => Promise<void>;
    isLoading?: boolean;
    initialComment?: string;
}

export function LessonFeedbackModal({
    isOpen,
    onClose,
    onSubmit,
    isLoading = false,
    initialComment = ''
}: LessonFeedbackModalProps) {
    const [comment, setComment] = useState(initialComment);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Use setTimeout to avoid synchronous state update during render/effect cycle
            const timer2 = setTimeout(() => setComment(initialComment), 0);

            const timer = setTimeout(() => {
                setIsVisible(true);
                document.body.style.overflow = 'hidden';
            }, 10);
            return () => {
                clearTimeout(timer);
                clearTimeout(timer2);
            };
        } else {
            const timer = setTimeout(() => setIsVisible(false), 300);
            document.body.style.overflow = 'unset';
            return () => clearTimeout(timer);
        }
    }, [isOpen, initialComment]);


    if (!isVisible && !isOpen) return null;

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (comment.trim()) {
            await onSubmit(comment);
            onClose();
        }
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={!isLoading ? onClose : undefined}
            ></div>

            <div className={`relative w-full max-w-lg bg-card-bg border border-border rounded-2xl shadow-2xl transform transition-all duration-300 ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}>
                <div className="flex items-center justify-between p-6 border-b border-border bg-background/50 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <Heart size={20} fill="currentColor" className="animate-pulse" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground">Tu feedback nos importa</h3>
                            <p className="text-xs text-muted">Cuéntanos tu experiencia con esta clase</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="text-muted hover:text-foreground transition-colors p-2 rounded-xl hover:bg-hover-bg border border-transparent hover:border-border"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleFormSubmit}>
                    <div className="p-8">
                        <label htmlFor="feedback-comment" className="block text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                            ¿Qué te pareció el contenido?
                            <span className="px-2 py-0.5 rounded text-[10px] bg-primary/20 text-primary uppercase tracking-wider font-bold italic">Opcional</span>
                        </label>
                        <div className="relative group">
                            <textarea
                                id="feedback-comment"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Comparte tus dudas, sugerencias o lo que más te gustó... ¡Tu opinión nos ayuda a seguir mejorando!"
                                disabled={isLoading}
                                className="w-full h-40 bg-background/50 border border-border rounded-xl p-4 text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all resize-none group-hover:border-border/80 custom-scrollbar"
                            />
                            <div className="absolute bottom-3 right-4 text-[10px] text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                                Shift + Enter para nueva línea
                            </div>
                        </div>

                    </div>

                    <div className="flex justify-end gap-3 p-6 border-t border-border bg-background/50 rounded-b-2xl">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="px-5 py-2.5 text-sm font-bold text-muted hover:text-foreground bg-transparent border border-transparent rounded-xl hover:bg-hover-bg transition-all active:scale-95"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !comment.trim()}
                            className="px-6 py-2.5 text-sm font-bold rounded-xl bg-primary hover:bg-primary/90 text-white transition-all shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-none"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Enviando...
                                </>
                            ) : (
                                <>
                                    Enviar Comentario <Send size={16} />
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
