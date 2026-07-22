'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { Mail, MapPin, Briefcase, Calendar, Award, BookOpen, ShieldCheck, CheckCircle2, Save, X, Edit2, Loader2, Trophy, Clock, Code, Database, Layout, Globe, Server, Cloud, Cpu, Smartphone, Bot, BrainCircuit, Sparkles, Network, Terminal, Microscope, Rocket, Binary, Camera, Building2 } from 'lucide-react';
import { Sidebar } from '@/components/sidebar';
import { useSidebar } from '@/components/sidebar-context';
import { MobileMenuButton } from '@/components/mobile-menu-button';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { autoActivateStudents } from '@/app/actions/student';
import { formatDateString } from '@/utils/date';

const AVAILABLE_AVATARS = [0, 1, 2, 3, 4, 5, 6, 16, 17, 18, 19, 20, 21, 43, 44, 45, 46, 47];

const getAvatarStyle = (indexStr: string | undefined | null) => {
    if (!indexStr || indexStr === '') return {};
    const index = parseInt(indexStr) || 0;
    if (!AVAILABLE_AVATARS.includes(index)) return {};
    return {
        backgroundImage: `url('/perfil/${index}.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
    };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, any> = {
    code: Code, database: Database, layout: Layout, globe: Globe, server: Server, cloud: Cloud, cpu: Cpu, smartphone: Smartphone, bot: Bot, brain: BrainCircuit, sparkles: Sparkles, network: Network, terminal: Terminal, microscope: Microscope, rocket: Rocket, binary: Binary
};

const COLOR_MAP: Record<string, string> = {
    green: 'bg-green-500', blue: 'bg-blue-500', violet: 'bg-violet-500', orange: 'bg-orange-500', red: 'bg-red-500', pink: 'bg-pink-500',
};

export default function ProfilePage() {
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
        avatar: '',
        jobTitle: '',
        stats: {
            courses: 0,
            students: 0,
            rating: 5.0,
        }
    });

    const [formData, setFormData] = useState({ ...user });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [myBootcamps, setMyBootcamps] = useState<any[]>([]);
    const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
    const [skillInput, setSkillInput] = useState('');

    const mutateProfile = useMutation(api.users.updateProfile);

    // Get current authenticated user details from Convex
    const currentUser = useQuery(api.users.viewer);
    const userEmail = currentUser?.email || '';
    const roleFromDB = useQuery(
        api.legacyAuth.getRoleByEmail,
        userEmail ? { email: userEmail } : "skip"
    );
    const userRole = roleFromDB || (currentUser as any)?.role || 'alumno';

    // Get dashboard data to retrieve bootcamps
    const dashboardData = useQuery(
        api.dashboard.getStudentData,
        userEmail ? { email: userEmail } : "skip"
    );

    useEffect(() => {
        if (currentUser) {
            const displayRole = userRole === 'superadmin' ? 'Super Administrador' : (userRole === 'docente' ? 'Docente' : 'Alumno');
            const userData = {
                id: currentUser._id,
                name: currentUser.name || userEmail.split('@')[0] || '',
                role: displayRole,
                email: userEmail || '',
                location: (currentUser as any).location || 'Santiago, Chile',
                joinDate: new Date(currentUser._creationTime).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
                bio: (currentUser as any).bio || 'Sin biografía disponible.',
                skills: (currentUser as any).skills || '',
                avatar: (currentUser as any).avatar || '',
                jobTitle: (currentUser as any).jobTitle || '',
                stats: {
                    courses: userRole === 'alumno' ? 0 : 4,
                    students: userRole === 'alumno' ? 0 : 250,
                    rating: 4.8,
                }
            };
            setUser(userData);
            setFormData(prev => prev.id ? prev : userData);

            // Auto-activate enrolled students whose start date has arrived
            if (userEmail) {
                autoActivateStudents(userEmail).catch(console.error);
            }
        }
    }, [currentUser, userRole, userEmail]);

    useEffect(() => {
        if (dashboardData?.bootcamps) {
            setMyBootcamps(dashboardData.bootcamps);
        }
    }, [dashboardData]);

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
            try {
                await mutateProfile({
                    name: formData.name,
                    bio: formData.bio,
                    location: formData.location,
                    skills: formData.skills,
                    avatar: formData.avatar,
                    jobTitle: formData.jobTitle,
                });
                setUser(formData);
                setIsEditing(false);
                setStatus({ type: 'success', message: '¡Perfil actualizado con éxito!' });
                setTimeout(() => setStatus(null), 5000);
            } catch (err: any) {
                setStatus({ type: 'error', message: err.message || 'Error al actualizar el perfil' });
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

    const handleAddSkill = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && skillInput.trim()) {
            e.preventDefault();
            const currentSkills = formData.skills ? formData.skills.split(',').map(s => s.trim()).filter(Boolean) : [];
            const newSkill = skillInput.trim();
            if (!currentSkills.includes(newSkill)) {
                setFormData(prev => ({
                    ...prev,
                    skills: [...currentSkills, newSkill].join(', ')
                }));
            }
            setSkillInput('');
        }
    };

    const handleRemoveSkill = (skillToRemove: string) => {
        const currentSkills = formData.skills ? formData.skills.split(',').map(s => s.trim()).filter(Boolean) : [];
        setFormData(prev => ({
            ...prev,
            skills: currentSkills.filter(s => s !== skillToRemove).join(', ')
        }));
    };

    const skillsList = typeof user.skills === 'string'
        ? user.skills.split(',').map(s => s.trim()).filter(Boolean)
        : [];
        
    const editSkillsList = typeof formData.skills === 'string'
        ? formData.skills.split(',').map(s => s.trim()).filter(Boolean)
        : [];

    const { isCollapsed } = useSidebar();

    return (
        <div className="min-h-screen bg-background">
            <Sidebar />

            <div className={`flex flex-col min-h-screen transition-all duration-300 ml-0 md:${isCollapsed ? 'ml-16' : 'ml-64'}`}>
                <header className={`fixed top-0 right-0 z-10 h-[60px] bg-background border-b border-border transition-all duration-300 left-0 md:${isCollapsed ? 'left-16' : 'left-64'}`}>
                    <div className="px-6 h-full border-b border-border">
                        <div className="flex items-center justify-between h-full">
                            <div className="flex items-center gap-3">
                                <MobileMenuButton />
                                <h2 className="text-sm font-light text-foreground">Perfil</h2>
                            </div>
                            <div className="flex items-center gap-4"></div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto pt-[92px] px-6 pb-6">
                    <div className="max-w-6xl mx-auto space-y-8">

                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                            <div>
                                <h1 className="text-3xl font-bold text-foreground">Mi Perfil</h1>
                                <p className="text-muted mt-1">Gestiona tu información pública y tu progreso académico.</p>
                            </div>
                        </div>

                        {status && (
                            <div className={`p-4 rounded-xl border text-sm animate-in fade-in slide-in-from-top-4 ${
                                status.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                            }`}>
                                {status.message}
                            </div>
                        )}

                        <div className="flex flex-col lg:flex-row gap-8">
                            {/* COLUMNA IZQUIERDA: INFO DEL PERFIL */}
                            <div className="w-full lg:w-[350px] shrink-0 space-y-6">
                                <div className="bg-card-bg border border-border rounded-xl shadow-sm ring-1 ring-white/5 relative">
                                    <div className="p-6">
                                        <div className="flex items-center gap-4 mb-6">
                                            {/* Avatar Circular */}
                                            <div 
                                                className={`h-20 w-20 rounded-full bg-card-bg border-2 border-border flex items-center justify-center text-2xl font-bold text-primary shadow-lg overflow-hidden shrink-0 relative group ${isEditing ? 'cursor-pointer' : ''}`}
                                                onClick={() => isEditing && setIsAvatarModalOpen(true)}
                                            >
                                                <div 
                                                    className="absolute inset-0 bg-primary/10 flex items-center justify-center uppercase transition-transform group-hover:scale-110 duration-500 w-full h-full"
                                                    style={getAvatarStyle(isEditing ? formData.avatar : user.avatar)}
                                                >
                                                    {(!user.avatar && !formData.avatar) && (user.name ? user.name.slice(0, 2) : 'FC')}
                                                </div>
                                                {isEditing && (
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Camera size={24} className="text-white" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Nombre y Categoría */}
                                            <div className="flex-1 min-w-0 flex flex-col justify-center items-start">
                                                {isEditing ? (
                                                    <input name="name" value={formData.name} onChange={handleChange} className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-inner mb-2" placeholder="Nombre completo" />
                                                ) : (
                                                    <>
                                                        <h2 className="text-xl font-bold text-foreground flex items-center gap-1.5 mb-1 truncate w-full">
                                                            {user.name}
                                                            <CheckCircle2 size={16} className="text-blue-500 shrink-0" />
                                                        </h2>
                                                        <p className="text-primary font-medium flex items-center gap-1.5 text-xs truncate mb-2">
                                                            <Briefcase size={12} className="opacity-70 shrink-0" />
                                                            {user.role}
                                                        </p>
                                                    </>
                                                )}
                                                <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider flex items-center gap-1 shadow-sm w-max">
                                                    <ShieldCheck size={12} />
                                                    Verificado
                                                </span>
                                            </div>
                                        </div>

                                        {/* Listado de Datos */}
                                        <div className="w-full border-t border-border pt-2 space-y-4 text-sm text-left">
                                            <div className="flex items-center gap-4 group transition-colors hover:text-foreground">
                                                <div className="rounded-lg text-primary shrink-0"><Mail size={16} /></div>
                                                <span className="text-muted-foreground truncate">{user.email}</span>
                                            </div>
                                            <div className="flex items-center gap-4 group transition-colors hover:text-foreground">
                                                <div className="rounded-lg text-primary shrink-0"><Building2 size={16} /></div>
                                                {isEditing ? (
                                                    <input 
                                                        type="text" 
                                                        name="jobTitle" 
                                                        value={formData.jobTitle} 
                                                        onChange={handleChange} 
                                                        placeholder="Ej: Desarrollador Frontend" 
                                                        className="flex-1 min-w-0 bg-background border border-border rounded-lg px-3 py-1.5 text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-inner" 
                                                    />
                                                ) : (
                                                    <span className="text-muted-foreground truncate">{user.jobTitle || 'Sin cargo definido'}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 group transition-colors hover:text-foreground">
                                                <div className="rounded-lg text-primary shrink-0"><Calendar size={16} /></div>
                                                <span className="text-muted-foreground">Miembro desde {user.joinDate}</span>
                                            </div>
                                        </div>

                                        {/* Sobre Mí & Habilidades (Movidos a la izquierda) */}
                                        <div className="w-full border-t border-border pt-2 mt-4 space-y-6 text-left">
                                            {/* Sobre mí */}
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <h3 className="text-xs font-medium text-foreground uppercase tracking-wider">Sobre mí</h3>
                                                </div>
                                                {isEditing ? (
                                                    <textarea
                                                        name="bio"
                                                        value={formData.bio}
                                                        onChange={handleChange}
                                                        rows={4}
                                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none leading-relaxed shadow-inner"
                                                        placeholder="Cuéntanos un poco sobre ti..."
                                                    />
                                                ) : (
                                                    <p className="text-muted/90 leading-relaxed text-sm">
                                                        {user.bio}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Habilidades */}
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <h3 className="text-xs font-medium text-foreground uppercase tracking-wider">Habilidades</h3>
                                                </div>
                                                {isEditing ? (
                                                    <div className="flex flex-col gap-3">
                                                        <div className="flex flex-wrap gap-2 content-start">
                                                            {editSkillsList.map((skill) => (
                                                                <span key={skill} className="px-2 py-1 bg-primary/10 border border-primary/20 text-primary rounded-md text-xs font-semibold flex items-center gap-1.5">
                                                                    {skill}
                                                                    <button type="button" onClick={() => handleRemoveSkill(skill)} className="hover:text-red-500 transition-colors">
                                                                        <X size={12} />
                                                                    </button>
                                                                </span>
                                                            ))}
                                                        </div>
                                                        <input
                                                            type="text"
                                                            value={skillInput}
                                                            onChange={(e) => setSkillInput(e.target.value)}
                                                            onKeyDown={handleAddSkill}
                                                            placeholder="Escribe una habilidad y presiona Enter..."
                                                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none shadow-inner"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-wrap gap-2 content-start">
                                                        {skillsList.map((skill) => (
                                                            <span key={skill} className="px-2 py-1 bg-hover-bg border border-white/5 rounded-md text-xs font-semibold text-foreground/80 cursor-default">
                                                                {skill}
                                                            </span>
                                                        ))}
                                                        {skillsList.length === 0 && (
                                                            <div className="text-muted/40 italic text-xs">
                                                                No hay habilidades registradas.
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Botones de Acción */}
                                        <div className="w-full mt-8">
                                            {isEditing ? (
                                                <div className="flex flex-col gap-3">
                                                    <button onClick={handleSave} disabled={isPending} className="w-full px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-primary/25 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50">
                                                        {isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                                        <span>Guardar Cambios</span>
                                                    </button>
                                                    <button onClick={handleCancel} disabled={isPending} className="w-full px-4 py-2 bg-transparent border border-border hover:bg-hover-bg text-muted hover:text-foreground rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2">
                                                        <X size={18} />
                                                        <span>Cancelar</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <button onClick={handleEdit} className="w-full px-5 py-3 bg-hover-bg hover:bg-white/10 text-foreground border border-white/5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]">
                                                    <Edit2 size={18} className="text-primary" />
                                                    <span>Editar Perfil</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* COLUMNA DERECHA: PROGRESO Y DETALLES */}
                            <div className="flex-1 space-y-8">
                                
                                {/* Mi Progreso - Destaque */}
                                <div className="bg-card-bg border border-border rounded-xl p-6 shadow-xl ring-1 ring-white/5 relative overflow-hidden">
                                    {/* <div className="absolute -top-20 -right-20 text-primary/5 rotate-12 pointer-events-none">
                                        <Trophy size={350} />
                                    </div> */}
                                    
                                    <div className="relative z-10">
                                        <h3 className="text-md font-semibold text-foreground mb-8 flex items-center gap-3">
                                            <div className="text-primary rounded-xl">
                                                <Trophy size={16} />
                                            </div>
                                            Mis Bootcamps en Progreso
                                        </h3>
                                        
                                        <div className="space-y-4">
                                            {myBootcamps.length > 0 ? myBootcamps.map((bootcamp, index) => {
                                                const iconName = bootcamp.icon || 'code';
                                                const IconComponent = ICON_MAP[iconName] || BookOpen;
                                                const bgClass = bootcamp.color ? COLOR_MAP[bootcamp.color] : 'bg-primary';
                                                
                                                const progress = bootcamp.calculatedProgress || 0;

                                                return (
                                                    <Link key={bootcamp.id} href={`/dashboard/bootcamp/${bootcamp.id}`} className="flex items-center gap-6 p-5 bg-background border border-border rounded-2xl shadow-sm hover:border-primary/30 hover:shadow-md transition-all group cursor-pointer">
                                                        <div className={`w-12 h-12 rounded-full ${bgClass} flex items-center justify-center flex-shrink-0 text-white shadow-lg`}>
                                                            <IconComponent size={28} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="text-sm font-semibold text-foreground truncate mb-1.5 group-hover:text-primary transition-colors">{bootcamp.title}</h4>
                                                            <div className="flex items-center gap-4 text-xs text-muted">
                                                                <span className="flex items-center gap-1"><Clock size={12}/> {bootcamp.duration || '12 Semanas'}</span>
                                                                <span className="flex items-center gap-1"><Award size={12}/> {bootcamp.level || 'Todos'}</span>
                                                            </div>
                                                        </div>
                                                        <div className="w-32 md:w-48 shrink-0 flex flex-col gap-2">
                                                            <div className="flex justify-between items-center text-xs font-bold">
                                                                <span className="text-muted-foreground hidden md:inline">Progreso</span>
                                                                <span className="text-primary ml-auto">{progress}%</span>
                                                            </div>
                                                            <div className="h-2 w-full bg-hover-bg rounded-full overflow-hidden border border-white/5">
                                                                <div className="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                                                            </div>
                                                        </div>
                                                    </Link>
                                                );
                                            }) : (
                                                <div className="p-8 text-center border border-dashed border-border rounded-2xl bg-background/50">
                                                    <BookOpen size={32} className="mx-auto text-muted/50 mb-3" />
                                                    <p className="text-muted">No estás inscrito en ningún bootcamp aún.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </main>

                {/* Avatar Selection Modal */}
                {isAvatarModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-card-bg border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between p-5 border-b border-border bg-background/50">
                                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                    <Camera size={18} className="text-primary" />
                                    Selecciona tu Avatar
                                </h3>
                                <button 
                                    onClick={() => setIsAvatarModalOpen(false)}
                                    className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-hover-bg transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            
                            <div className="p-6">
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                                    {/* Opción de Iniciales */}
                                    <button
                                        onClick={() => {
                                            setFormData(prev => ({ ...prev, avatar: '' }));
                                            setIsAvatarModalOpen(false);
                                        }}
                                        className={`aspect-square w-full rounded-full shrink-0 border-2 transition-all group overflow-hidden relative bg-primary/10 flex items-center justify-center font-bold text-primary text-2xl uppercase ${formData.avatar === '' ? 'border-primary scale-105 shadow-lg shadow-primary/20 ring-4 ring-primary/20' : 'border-transparent hover:border-primary/50 hover:scale-105 hover:shadow-md'}`}
                                        type="button"
                                    >
                                        {user.name ? user.name.slice(0, 2) : 'FC'}
                                        {formData.avatar === '' && (
                                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                                <CheckCircle2 size={32} className="text-white drop-shadow-md" />
                                            </div>
                                        )}
                                    </button>

                                    {AVAILABLE_AVATARS.map((avatarId) => (
                                        <button
                                            key={avatarId}
                                            onClick={() => {
                                                setFormData(prev => ({ ...prev, avatar: avatarId.toString() }));
                                                setIsAvatarModalOpen(false);
                                            }}
                                            className={`aspect-square w-full rounded-full shrink-0 border-2 transition-all group overflow-hidden relative ${formData.avatar === avatarId.toString() ? 'border-primary scale-105 shadow-lg shadow-primary/20 ring-4 ring-primary/20' : 'border-transparent hover:border-primary/50 hover:scale-105 hover:shadow-md'}`}
                                            type="button"
                                        >
                                            <div 
                                                className="absolute inset-0 w-full h-full transition-transform group-hover:scale-110 duration-500"
                                                style={getAvatarStyle(avatarId.toString())}
                                            />
                                            {formData.avatar === avatarId.toString() && (
                                                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                                    <CheckCircle2 size={32} className="text-white drop-shadow-md" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="p-4 border-t border-border bg-background/50 flex justify-end">
                                <button
                                    onClick={() => setIsAvatarModalOpen(false)}
                                    className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold transition-all shadow-md active:scale-95"
                                >
                                    Listo
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

