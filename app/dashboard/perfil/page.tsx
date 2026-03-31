'use client';

import { useState, useEffect, useTransition } from 'react';
import { Mail, MapPin, Briefcase, Calendar, Award, BookOpen, ShieldCheck, CheckCircle2, Save, X, Edit2, Loader2 } from 'lucide-react';
import { Sidebar } from '@/components/sidebar';
import { useSidebar } from '@/components/sidebar-context';
import { createClient } from '@/utils/supabase/client';
import { updateProfile } from '@/app/actions/profile';

export default function ProfilePage() {
    const supabase = createClient();
    const [isPending, startTransition] = useTransition();
    const [isEditing, setIsEditing] = useState(false);
    const [status, setStatus] = useState<{ type: 'error' | 'success', message: string } | null>(null);

    const [user, setUser] = useState({
        id: '',
        name: '',
        role: 'Estudiante',
        email: '',
        location: '',
        joinDate: '',
        bio: '',
        skills: '',
        stats: {
            courses: 0,
            students: 0,
            rating: 5.0,
        }
    });

    const [formData, setFormData] = useState({ ...user });

    useEffect(() => {
        async function fetchUser() {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser) {
                const metadata = authUser.user_metadata || {};
                const userData = {
                    id: authUser.id,
                    name: metadata.full_name || authUser.email?.split('@')[0] || '',
                    role: metadata.role === 'superadmin' ? 'Super Administrador' : (metadata.role === 'docente' ? 'Docente' : 'Alumno'),
                    email: authUser.email || '',
                    location: metadata.location || 'Santiago, Chile',
                    joinDate: new Date(authUser.created_at).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
                    bio: metadata.bio || 'Sin biografía disponible.',
                    skills: metadata.skills || '',
                    stats: {
                        courses: metadata.role === 'alumno' ? 0 : 4,
                        students: metadata.role === 'alumno' ? 0 : 250,
                        rating: 4.8,
                    }
                };
                setUser(userData);
                setFormData(userData);
            }
        }
        fetchUser();
    }, [supabase.auth]);

    const handleEdit = () => {
        setStatus(null);
        setFormData(user);
        setIsEditing(true);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setFormData(user);
    };

    const handleSave = () => {
        setStatus(null);
        startTransition(async () => {
            const result = await updateProfile({
                full_name: formData.name,
                bio: formData.bio,
                location: formData.location,
                skills: formData.skills,
            });

            if (result.error) {
                setStatus({ type: 'error', message: result.error });
            } else {
                setUser(formData);
                setIsEditing(false);
                setStatus({ type: 'success', message: '¡Perfil actualizado con éxito!' });
                
                // Limpiar mensaje de éxito después de unos segundos
                setTimeout(() => setStatus(null), 5000);
            }
        });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const skillsList = typeof user.skills === 'string'
        ? user.skills.split(',').map(s => s.trim()).filter(Boolean)
        : [];

    const { isCollapsed } = useSidebar();

    return (
        <div className="min-h-screen bg-background">
            <Sidebar />

            <div className={`flex flex-col min-h-screen transition-all duration-300 ${isCollapsed ? 'ml-16' : 'ml-64'}`}>
                <header className={`fixed top-0 right-0 z-10 h-[60px] bg-background border-b border-border transition-all duration-300 ${isCollapsed ? 'left-16' : 'left-64'}`}>
                    <div className="px-6 h-full border-b border-border">
                        <div className="flex items-center justify-between h-full">
                            <h2 className="text-sm font-light text-foreground">Perfil</h2>
                            <div className="flex items-center gap-4"></div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto pt-[92px]">
                    <div className="max-w-4xl mx-auto space-y-8 px-6 pb-12">

                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                            <div>
                                <h1 className="text-3xl font-bold text-foreground">Mi Perfil</h1>
                                <p className="text-muted mt-1">Gestiona tu información pública y datos personales.</p>
                            </div>
                        </div>

                        {status && (
                            <div className={`p-4 rounded-xl border text-sm animate-in fade-in slide-in-from-top-4 ${
                                status.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                            }`}>
                                {status.message}
                            </div>
                        )}

                        <div className="bg-card-bg border border-border rounded-xl overflow-hidden shadow-sm ring-1 ring-white/5">
                            <div className="h-40 bg-gradient-to-r from-primary/30 via-indigo-500/20 to-primary/10 w-full relative">
                                <div className="absolute top-4 right-4 group">
                                    <span className="bg-primary/20 text-primary border border-primary/30 px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 shadow-sm backdrop-blur-md">
                                        <ShieldCheck size={14} />
                                        Perfil Verificado
                                    </span>
                                </div>
                            </div>

                            <div className="px-8 pb-8">
                                <div className="flex flex-col md:flex-row gap-8 items-start relative -mt-16">
                                    {/* Profile Photo Placeholder */}
                                    <div className="h-32 w-32 rounded-2xl bg-card-bg border-4 border-card-bg flex items-center justify-center text-4xl font-bold text-primary shadow-2xl overflow-hidden shrink-0 relative group">
                                        <div className="absolute inset-0 bg-primary/10 flex items-center justify-center uppercase transition-transform group-hover:scale-110 duration-500">
                                            {user.name ? user.name.slice(0, 2) : 'FC'}
                                        </div>
                                    </div>

                                    <div className="flex-1 md:mt-12 space-y-6">
                                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                                            <div className="w-full">
                                                {isEditing ? (
                                                    <div className="space-y-4 max-w-sm">
                                                        <div>
                                                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 block">Nombre registrado</label>
                                                            <input name="name" value={formData.name} onChange={handleChange} className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-inner" />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1">
                                                        <h2 className="text-3xl font-bold text-foreground flex items-center gap-3">
                                                            {user.name}
                                                            <div className="bg-blue-500/10 p-1 rounded-full"><CheckCircle2 size={16} className="text-blue-500" /></div>
                                                        </h2>
                                                        <p className="text-primary font-medium flex items-center gap-2 text-sm">
                                                            <Briefcase size={16} className="opacity-70" />
                                                            {user.role}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex gap-3 shrink-0">
                                                {isEditing ? (
                                                    <>
                                                        <button onClick={handleCancel} disabled={isPending} className="px-4 py-2 bg-transparent hover:bg-hover-bg text-muted hover:text-foreground rounded-lg text-sm font-medium transition-all flex items-center gap-2">
                                                            <X size={18} />
                                                            <span>Cancelar</span>
                                                        </button>
                                                        <button onClick={handleSave} disabled={isPending} className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-primary/25 flex items-center gap-2 active:scale-[0.98] disabled:opacity-50">
                                                            {isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                                            <span>Guardar Cambios</span>
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button onClick={handleEdit} className="px-5 py-2.5 bg-hover-bg hover:bg-white/10 text-foreground border border-white/5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 shadow-sm active:scale-[0.98]">
                                                        <Edit2 size={18} className="text-primary" />
                                                        <span>Editar Perfil</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-6 text-sm text-muted/80">
                                            <div className="flex items-center gap-2 group transition-colors hover:text-foreground">
                                                <Mail size={16} className="text-primary/70" />
                                                <span className="cursor-default">{user.email}</span>
                                            </div>
                                            <div className="flex items-center gap-2 group transition-colors hover:text-foreground">
                                                <MapPin size={16} className="text-primary/70" />
                                                {isEditing ? (
                                                    <input name="location" value={formData.location} onChange={handleChange} className="bg-background border border-border rounded-md px-2 py-1 text-foreground text-xs focus:ring-1 focus:ring-primary outline-none" />
                                                ) : (
                                                    <span>{user.location}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 group">
                                                <Calendar size={16} className="text-primary/70" />
                                                <span>Miembro desde {user.joinDate}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="md:col-span-2 space-y-8">
                                <div className="bg-card-bg border border-border rounded-xl p-8 shadow-sm ring-1 ring-white/5">
                                    <div className="flex items-center gap-2 mb-6">
                                        <div className="h-6 w-1 bg-primary rounded-full"></div>
                                        <h3 className="text-xl font-bold text-foreground">Sobre mí</h3>
                                    </div>
                                    {isEditing ? (
                                        <textarea
                                            name="bio"
                                            value={formData.bio}
                                            onChange={handleChange}
                                            rows={5}
                                            className="w-full bg-background border border-border rounded-xl px-5 py-4 text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none leading-relaxed shadow-inner"
                                            placeholder="Cuéntanos un poco sobre ti..."
                                        />
                                    ) : (
                                        <p className="text-muted/90 leading-relaxed text-base">
                                            {user.bio}
                                        </p>
                                    )}
                                </div>

                                <div className="bg-card-bg border border-border rounded-xl p-8 shadow-sm ring-1 ring-white/5">
                                    <div className="flex items-center gap-2 mb-6">
                                        <div className="h-6 w-1 bg-primary rounded-full"></div>
                                        <h3 className="text-xl font-bold text-foreground">Habilidades & Especialidades</h3>
                                    </div>
                                    {isEditing ? (
                                        <div className="space-y-4">
                                            <textarea
                                                name="skills"
                                                value={formData.skills}
                                                onChange={handleChange}
                                                rows={2}
                                                placeholder="React, Next.js, Node.js, Arquitectura Cloud..."
                                                className="w-full bg-background border border-border rounded-xl px-5 py-4 text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none shadow-inner"
                                            />
                                            <div className="flex items-start gap-2 text-xs text-muted/60 bg-white/5 p-3 rounded-lg border border-white/5">
                                                <ShieldCheck size={14} className="mt-0.5 shrink-0" />
                                                <p>Separa tus habilidades por comas para que sean indexables por el buscador del campus.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2.5">
                                            {skillsList.map((skill) => (
                                                <span key={skill} className="px-4 py-2 bg-hover-bg border border-white/5 rounded-xl text-xs font-semibold text-foreground/80 hover:border-primary transition-all cursor-default">
                                                    {skill}
                                                </span>
                                            ))}
                                            {skillsList.length === 0 && (
                                                <div className="flex flex-col items-center justify-center py-6 w-full text-muted/40 italic text-sm">
                                                    <BookOpen size={24} className="mb-2 opacity-20" />
                                                    No hay habilidades registradas.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-8">
                                <div className="bg-card-bg border border-border rounded-xl p-8 shadow-sm ring-1 ring-white/5">
                                    <h3 className="text-xl font-bold text-foreground mb-6">Mi Progreso</h3>
                                    <div className="space-y-5">
                                        <div className="flex items-center p-4 bg-primary/5 border border-primary/10 rounded-2xl relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-1 text-primary/5 transition-transform group-hover:scale-150 duration-700">
                                                <BookOpen size={64} />
                                            </div>
                                            <div className="p-3 bg-primary/10 text-primary rounded-xl mr-4 shrink-0">
                                                <BookOpen size={24} />
                                            </div>
                                            <div className="relative z-10">
                                                <p className="text-2xl font-black text-foreground">{user.stats.courses}</p>
                                                <p className="text-[10px] text-muted uppercase tracking-[0.2em] font-bold">Bootcamps</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-1 text-emerald-500/5 transition-transform group-hover:scale-150 duration-700">
                                                <Award size={64} />
                                            </div>
                                            <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl mr-4 shrink-0">
                                                <Award size={24} />
                                            </div>
                                            <div className="relative z-10">
                                                <p className="text-2xl font-black text-foreground">+{user.stats.students}</p>
                                                <p className="text-[10px] text-muted uppercase tracking-[0.2em] font-bold">Puntos XP</p>
                                            </div>
                                        </div>

                                        <div className="p-5 bg-hover-bg/50 border border-white/5 rounded-2xl">
                                            <div className="flex justify-between items-end mb-2">
                                                <span className="text-xs text-muted/60 font-medium">Nivel de Perfil</span>
                                                <span className="text-xs text-primary font-bold">Intermedio</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-background rounded-full overflow-hidden">
                                                <div className="h-full bg-primary w-[65%] rounded-full"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

