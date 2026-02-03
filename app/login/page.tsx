'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { ThemeToggle } from '@/components/theme-toggle';

import { login, signup } from './actions';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const formData = new FormData();
        formData.append('email', email);
        formData.append('password', password);

        startTransition(async () => {
            let result;
            if (mode === 'login') {
                result = await login(formData);
            } else {
                result = await signup(formData);
            }

            if (result?.error) {
                setError(result.error);
            }
        });
    };

    return (
        <div className="flex min-h-screen bg-background">
            {/* Theme Toggle */}
            <div className="absolute top-6 right-6 z-10">
                <ThemeToggle />
            </div>

            {/* Left Side - Login Form */}
            <div className="flex w-full flex-col justify-center px-8 py-12 lg:w-1/2 lg:px-24">
                <div className="mx-auto w-full max-w-sm">
                    {/* Logo */}
                    <div className="mb-16">
                        <div className="flex items-center gap-3">
                            <div className="relative h-10 w-10 overflow-hidden rounded-lg">
                                <Image
                                    src="/brand/logotipoacademy.png"
                                    alt="CleverX Academy"
                                    fill
                                    className="object-cover"
                                />
                            </div>
                            <div className="flex flex-col -space-y-1">
                                <span className="text-2xl font-bold text-foreground tracking-tight">CleverX</span>
                                <span className="text-[10px] font-medium text-muted uppercase tracking-[0.2em] ml-0.5">Academy</span>
                            </div>
                        </div>
                    </div>

                    {/* Welcome Text */}
                    <div className="mb-8">
                        <h1 className="text-2xl font-medium text-foreground">
                            {mode === 'login' ? 'Welcome back' : 'Create an account'}
                        </h1>
                        <p className="mt-1 text-sm text-muted">
                            {mode === 'login' ? 'Sign in to your account' : 'Enter your details to get started'}
                        </p>
                    </div>

                    {/* API/Auth Error Alert */}
                    {error && (
                        <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Social Login Buttons (Visual Only for now) */}
                    <div className="space-y-3 mb-6">
                        <button
                            type="button"
                            className="relative flex w-full items-center justify-center gap-3 rounded-md border border-border bg-card-bg px-4 py-2.5 text-sm font-normal text-foreground transition-colors hover:bg-hover-bg"
                        >
                            <svg className="h-4 w-4 absolute left-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                            </svg>
                            Continue with GitHub
                        </button>
                    </div>

                    {/* Divider */}
                    <div className="my-6 flex items-center">
                        <div className="flex-1 border-t border-border"></div>
                        <span className="px-3 text-xs text-muted">or</span>
                        <div className="flex-1 border-t border-border"></div>
                    </div>

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="email" className="block text-xs font-medium text-foreground mb-2">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="tu@email.com"
                                className="w-full rounded-md border border-border bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                                required
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label htmlFor="password" className="block text-xs font-medium text-foreground">
                                    Password
                                </label>
                                {mode === 'login' && (
                                    <a href="#" className="text-xs text-muted hover:text-foreground transition-colors">
                                        Forgot password?
                                    </a>
                                )}
                            </div>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full rounded-md border border-border bg-background px-3.5 py-2 pr-10 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? (
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isPending}
                            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isPending && <Loader2 size={16} className="animate-spin" />}
                            {mode === 'login' ? 'Sign in' : 'Sign up'}
                        </button>
                    </form>

                    {/* Toggle Login/Sign Up */}
                    <p className="mt-6 text-center text-sm text-muted">
                        {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
                        <button
                            type="button"
                            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                            className="font-medium text-foreground underline hover:text-primary transition-colors"
                        >
                            {mode === 'login' ? 'Sign up' : 'Sign in'}
                        </button>
                    </p>
                </div>
            </div>

            {/* Right Side - Testimonial */}
            <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-20 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-card-bg to-background"></div>
                <div className="relative max-w-lg">
                    <svg className="mb-8 h-12 w-12 text-muted/30" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                    </svg>
                    <blockquote className="text-[28px] font-normal leading-[1.4] text-foreground mb-10">
                        &quot;La plataforma de bootcamp ha transformado completamente cómo gestionamos y entregamos contenido educativo. La autenticación es súper fluida.&quot;
                    </blockquote>
                    <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-full bg-muted/10 flex items-center justify-center text-sm font-medium text-foreground border border-border">
                            FC
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">Francisco Class</span>
                            <span className="text-xs text-muted">@francisco_dev</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
