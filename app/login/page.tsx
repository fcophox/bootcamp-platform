'use client';

import { useState, useTransition, Suspense, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { ThemeLogo } from '@/components/theme-logo';
import { Loader2, Sparkles } from 'lucide-react';
import { useAuthActions } from '@convex-dev/auth/react';
import { useAction, useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

const translations = {
    es: {
        welcomeLogin: "Te damos la bienvenida",
        welcomeSignup: "Crear una cuenta",
        subtitleLogin: "Inicia sesión en tu cuenta",
        subtitleSignup: "Ingresa tus datos para comenzar",
        invitedTitle: "¡Has sido invitado!",
        invitedDesc: "Crea tu cuenta o inicia sesión para unirte al bootcamp.",
        nameLabel: "Nombre Completo",
        namePlaceholder: "Tu nombre",
        emailLabel: "Correo Electrónico",
        passwordLabel: "Contraseña",
        forgotPassword: "¿Olvidaste tu contraseña?",
        buttonLogin: "Iniciar sesión",
        buttonSignup: "Registrarse",
        footerLogin: "¿No tienes una cuenta? ",
        footerSignup: "¿Ya tienes una cuenta? ",
        footerActionLogin: "Regístrate",
        footerActionSignup: "Inicia sesión",
        quote: "El verdadero poder del conocimiento no reside en acumularlo, sino en ponerlo en práctica para transformar la realidad.",
        quoteAuthor: "El equipo de Synaptia",
    },
    en: {
        welcomeLogin: "We welcome you",
        welcomeSignup: "Create an account",
        subtitleLogin: "Sign in to your account",
        subtitleSignup: "Enter your details to get started",
        invitedTitle: "You have been invited!",
        invitedDesc: "Create your account or sign in to join the bootcamp.",
        nameLabel: "Full Name",
        namePlaceholder: "Your name",
        emailLabel: "Email",
        passwordLabel: "Password",
        forgotPassword: "Forgot password?",
        buttonLogin: "Sign in",
        buttonSignup: "Sign up",
        footerLogin: "Don't have an account? ",
        footerSignup: "Already have an account? ",
        footerActionLogin: "Sign up",
        footerActionSignup: "Sign in",
        quote: "The true power of knowledge does not lie in accumulating it, but in putting it into practice to transform reality.",
        quoteAuthor: "The Synaptia Team",
    }
};

function LoginContent() {
    const searchParams = useSearchParams();
    const inviteId = searchParams.get('invite');
    const token = searchParams.get('token');
    const router = useRouter();
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const modeParam = searchParams.get('mode') as 'login' | 'signup' | null;

    const lang = (searchParams.get('lang') === 'en') ? 'en' : 'es';
    const t = translations[lang];

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const { signIn } = useAuthActions();
    const checkLegacyUser = useAction(api.legacyAuth.checkLegacyUser);
    const acceptInvitation = useMutation(api.invitations.acceptInvitation);
    
    // Validate token if present
    const tokenValidation = useQuery(
        api.invitations.validateToken,
        token ? { token } : "skip"
    );

    const [mode, setMode] = useState<'login' | 'signup'>(
        modeParam || ((inviteId || token) ? 'signup' : 'login')
    );
    const [status, setStatus] = useState<{ type: 'error' | 'success' | 'warning', message: string } | null>(null);
    const [isPending, startTransition] = useTransition();

    const handleToggleMode = (newMode: 'login' | 'signup') => {
        setMode(newMode);
        const params = new URLSearchParams(searchParams.toString());
        params.set('mode', newMode);
        router.push(`/login?${params.toString()}`, { scroll: false });
    };

    const createQueryString = (name: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set(name, value);
        return '?' + params.toString();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus(null);

        startTransition(async () => {
            try {
                if (mode === 'login') {
                    // Check legacy / database role first so we know where to redirect
                    const legacyResult = await checkLegacyUser({ email, password });
                    const userRole = legacyResult.role;

                    let loginSuccessful = false;
                    try {
                        await signIn("password", { email, password, flow: "signIn" });
                        loginSuccessful = true;
                    } catch {
                        loginSuccessful = false;
                    }

                    if (!loginSuccessful) {
                        if (legacyResult.valid) {
                            try {
                                await signIn("password", {
                                    email,
                                    password,
                                    flow: "signUp",
                                    name: email.split('@')[0],
                                    role: legacyResult.role || 'alumno',
                                });
                                loginSuccessful = true;
                            } catch {
                                loginSuccessful = false;
                            }
                        } else if (legacyResult.isLegacy) {
                            setStatus({ type: 'error', message: 'Contraseña incorrecta.' });
                            return;
                        } else {
                            setStatus({ type: 'error', message: 'Correo o contraseña incorrectos.' });
                            return;
                        }
                    }

                    if (loginSuccessful) {
                        // If there's a token, process the invitation after login
                        if (token && tokenValidation?.valid) {
                            try {
                                await acceptInvitation({ token, userEmail: email, userName: name || email.split('@')[0] });
                            } catch (inviteErr) {
                                console.error("Error accepting invitation:", inviteErr);
                                // Don't block login if invitation fails
                            }
                        }
                        
                        const target = (userRole === 'superadmin' || userRole === 'docente') ? '/cms' : '/dashboard';
                        setTimeout(() => {
                            window.location.href = target;
                        }, 100);
                        return;
                    }

                    setStatus({ type: 'error', message: 'Error durante el inicio de sesión.' });
                } else {
                    // Sign Up
                    await signIn("password", {
                        email,
                        password,
                        flow: "signUp",
                        name,
                        role: "alumno",
                    });
                    
                    // If there's a token, process the invitation after signup
                    console.log("[Signup] Token:", token, "TokenValidation:", tokenValidation);
                    
                    if (token && tokenValidation?.valid) {
                        try {
                            console.log("[Signup] Calling acceptInvitation with:", { token, userEmail: email, userName: name });
                            const result = await acceptInvitation({ token, userEmail: email, userName: name });
                            console.log("[Signup] acceptInvitation result:", result);
                            setStatus({ type: 'success', message: `¡Cuenta creada! Te has unido a "${result.bootcampTitle}"` });
                        } catch (inviteErr: any) {
                            console.error("[Signup] Error accepting invitation:", inviteErr);
                            setStatus({ type: 'warning', message: '¡Cuenta creada! Pero hubo un error al unirte al bootcamp.' });
                        }
                    } else if (token) {
                        console.log("[Signup] Token present but validation failed:", tokenValidation);
                        setStatus({ type: 'warning', message: '¡Cuenta creada! Pero el enlace de invitación no es válido.' });
                    } else {
                        setStatus({ type: 'success', message: '¡Cuenta creada exitosamente!' });
                    }
                    
                    setTimeout(() => {
                        window.location.href = '/dashboard';
                    }, 1000);
                }
            } catch (err: any) {
                console.error("Auth error:", err);
                setStatus({ type: 'error', message: err?.message || 'Error durante el inicio de sesión.' });
            }
        });
    };

    return (
        <div className="flex min-h-screen bg-background">
            {/* Theme & Language Toggle */}
            <div className="absolute top-6 right-6 z-10 flex items-center gap-4">
                <Link
                    href={createQueryString('lang', lang === 'es' ? 'en' : 'es')}
                    className="text-xs font-semibold text-muted hover:text-foreground px-2 py-1 border border-border/50 rounded-md transition-colors"
                    title="Cambiar idioma / Change language"
                >
                    {lang === 'es' ? 'EN' : 'ES'}
                </Link>
                <ThemeToggle />
            </div>

            {/* Left Side - Login Form */}
            <div className="flex w-full flex-col justify-center px-8 py-12 lg:w-1/2 lg:px-24">
                <div className="mx-auto w-full max-w-sm">
                    {/* Logo */}
                    <div className="mb-16">
                        <div className="flex items-center">
                            <div className="relative h-10 w-64 overflow-hidden">
                                <ThemeLogo />
                            </div>
                        </div>
                    </div>

                    {/* Welcome Text */}
                    <div className="mb-8">
                        <h1 className="text-2xl font-medium text-foreground">
                            {mode === 'login' ? t.welcomeLogin : t.welcomeSignup}
                        </h1>
                        <p className="mt-1 text-sm text-muted">
                            {mode === 'login' ? t.subtitleLogin : t.subtitleSignup}
                        </p>
                    </div>

                    {/* Invitation Banner */}
                    {token && tokenValidation?.valid && !status && (
                        <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="p-2 rounded-full bg-primary/20 text-primary">
                                <Sparkles size={20} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-primary capitalize">{t.invitedTitle}</p>
                                <p className="text-xs text-primary/80">
                                    {lang === 'es' 
                                        ? `Únete a "${tokenValidation.bootcampTitle}"`
                                        : `Join "${tokenValidation.bootcampTitle}"`
                                    }
                                </p>
                            </div>
                        </div>
                    )}
                    
                    {token && tokenValidation && !tokenValidation.valid && !status && (
                        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="p-2 rounded-full bg-red-500/20 text-red-500">
                                <Sparkles size={20} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-red-500">Enlace inválido</p>
                                <p className="text-xs text-red-500/80">{tokenValidation.error}</p>
                            </div>
                        </div>
                    )}
                    
                    {inviteId && !token && !status && (
                        <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="p-2 rounded-full bg-primary/20 text-primary">
                                <Sparkles size={20} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-primary capitalize">{t.invitedTitle}</p>
                                <p className="text-xs text-primary/80">{t.invitedDesc}</p>
                            </div>
                        </div>
                    )}

                    {status && (
                        <div className={`mb-6 p-4 rounded-xl border text-sm animate-in fade-in slide-in-from-top-2 duration-300 ${status.type === 'error'
                                ? 'bg-red-500/10 border-red-500/20 text-red-500'
                                : status.type === 'warning'
                                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                            }`}>
                            <div className="flex items-center gap-2">
                                {status.type === 'warning' && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>}
                                <span className="leading-relaxed">{status.message}</span>
                            </div>
                        </div>
                    )}

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {mode === 'signup' && (
                            <div>
                                <label htmlFor="name" className="block text-xs font-medium text-foreground mb-2">
                                    {t.nameLabel}
                                </label>
                                <input
                                    id="name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder={t.namePlaceholder}
                                    className="w-full rounded-md border border-border bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                                    required
                                />
                            </div>
                        )}
                        <div>
                            <label htmlFor="email" className="block text-xs font-medium text-foreground mb-2">
                                {t.emailLabel}
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
                                    {t.passwordLabel}
                                </label>
                                {mode === 'login' && (
                                    <Link 
                                        href={`/forgot-password${lang === 'en' ? '?lang=en' : ''}`}
                                        className="text-xs text-muted hover:text-foreground transition-colors"
                                    >
                                        {t.forgotPassword}
                                    </Link>
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
                            {mode === 'login' ? t.buttonLogin : t.buttonSignup}
                        </button>
                    </form>

                    {/* Toggle Login/Sign Up */}
                    <p className="mt-6 text-center text-sm text-muted">
                        {mode === 'login' ? t.footerLogin : t.footerSignup}
                        <button
                            type="button"
                            onClick={() => handleToggleMode(mode === 'login' ? 'signup' : 'login')}
                            className="font-medium text-foreground underline hover:text-primary transition-colors"
                        >
                            {mode === 'login' ? t.footerActionLogin : t.footerActionSignup}
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
                        &quot;{t.quote}&quot;
                    </blockquote>
                    <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-full bg-muted/10 flex items-center justify-center text-sm font-medium text-foreground border border-border">
                            Sy
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">{t.quoteAuthor}</span>
                            <span className="text-xs text-muted">@synamtia_team</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}
