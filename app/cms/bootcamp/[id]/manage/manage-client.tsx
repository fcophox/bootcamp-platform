'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/sidebar';
import { useSidebar } from '@/components/sidebar-context';
import { ConfirmationModal } from '@/components/confirmation-modal';
import { TiptapEditor } from '@/components/tiptap-editor';
import {
    ChevronRight, Plus, FileText, Video, Layout,
    Trash2, Edit2, ChevronDown, ChevronUp, GripVertical, MonitorPlay,
    Headphones, FileUp, Users, Mail, UserMinus, Trophy, Check, X, Circle, HelpCircle, Clock,
    Code, Terminal, Globe, Cpu, Database, Palette, Zap, Briefcase
} from 'lucide-react';
import { createModule, createLesson, updateLesson, updateModule, deleteModule, deleteLesson } from '@/app/actions/module';
import { updateBootcamp } from '@/app/actions/bootcamp';
import { createClient } from '@/utils/supabase/client';
import { inviteStudent, removeStudent } from '@/app/actions/student'; // Import student actions

interface Lesson {
    id: number;
    title: string;
    type: 'text' | 'video' | 'presentation' | 'podcast' | 'pdf' | 'exam';
    content: string;
}

interface ExamOption {
    id: string;
    text: string;
    isCorrect: boolean;
}

interface ExamQuestion {
    id: string;
    text: string;
    options: ExamOption[];
}

interface Module {
    id: number;
    title: string;
    lessons: Lesson[];
}

interface Student {
    id: number;
    email: string;
    status: 'invited' | 'active' | 'completed';
    invitedAt: string;
    joinedAt?: string;
}

interface ManageBootcampClientProps {
    bootcamp: {
        id: number;
        title: string;
        icon?: string;
        color?: string;
    };
    modules: Module[];
    initialStudents?: Student[];
}

export function ManageBootcampClient({ bootcamp, modules, initialStudents = [] }: ManageBootcampClientProps) {
    const { isCollapsed } = useSidebar();

    // UI State
    const [activeTab, setActiveTab] = useState<'content' | 'students'>('content');

    // Content Management State
    const [expandedModule, setExpandedModule] = useState<number | null>(null);
    const [isCreatingModule, setIsCreatingModule] = useState(false);
    const [newModuleTitle, setNewModuleTitle] = useState('');
    const [activeModuleForContent, setActiveModuleForContent] = useState<number | null>(null);
    const [isEditingBootcampTitle, setIsEditingBootcampTitle] = useState(false);
    const [tempBootcampTitle, setTempBootcampTitle] = useState(bootcamp.title);
    const [isEditingIcon, setIsEditingIcon] = useState(false);
    const [tempIcon, setTempIcon] = useState(bootcamp.icon || 'code');
    const [tempColor, setTempColor] = useState(bootcamp.color || 'blue');
    const [editingModuleId, setEditingModuleId] = useState<number | null>(null);
    const [editingModuleTitle, setEditingModuleTitle] = useState('');
    const [editingLessonId, setEditingLessonId] = useState<number | null>(null);
    const [contentType, setContentType] = useState<'text' | 'video' | 'presentation' | 'podcast' | 'pdf' | 'exam' | null>(null);
    const [contentTitle, setContentTitle] = useState('');

    const [editorContent, setEditorContent] = useState('');
    const [resourceContent, setResourceContent] = useState(''); // Valid for Video, PDF, Presentation, etc. URL
    const [isUploading, setIsUploading] = useState(false);

    // Exam Builder State
    const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([
        { id: '1', text: '', options: [{ id: '1-1', text: '', isCorrect: false }] }
    ]);
    const [examDuration, setExamDuration] = useState(15); // Default 15 mins

    // Student Management State
    const [inviteEmail, setInviteEmail] = useState('');
    const [isInviting, setIsInviting] = useState(false);

    // Modal State
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => Promise<void>;
        confirmText?: string;
        variant?: 'danger' | 'primary' | 'success';
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: async () => { },
    });
    const [isActionLoading, setIsActionLoading] = useState(false);

    // Helpers
    const toggleModule = (id: number) => {
        setExpandedModule(expandedModule === id ? null : id);
    };

    const openConfirmModal = (title: string, message: string, action: () => Promise<void>, confirmText = 'Eliminar', variant: 'danger' | 'primary' | 'success' = 'danger') => {
        setModalConfig({
            isOpen: true,
            title,
            message,
            confirmText,
            variant,
            onConfirm: async () => {
                setIsActionLoading(true);
                try {
                    await action();
                    setModalConfig(prev => ({ ...prev, isOpen: false }));
                } catch (error: any) {
                    console.error(error);
                    alert(error.message || 'Error al ejecutar la acción');
                } finally {
                    setIsActionLoading(false);
                }
            }
        });
    };

    const handleCreateModule = async () => {
        if (!newModuleTitle.trim()) return;
        try {
            await createModule(bootcamp.id, newModuleTitle);
            setNewModuleTitle('');
            setIsCreatingModule(false);
        } catch (error) {
            alert('Error al crear módulo');
        }
    };

    const handleSaveContent = async () => {
        if (!activeModuleForContent || !contentType || !contentTitle) return;

        let finalContent = editorContent;

        // Serialize Exam Data if content type is exam
        if (contentType === 'exam') {
            // Validate Exam
            const isValid = examQuestions.every(q => q.text.trim() && q.options.length > 0 && q.options.every(o => o.text.trim()));
            if (!isValid) {
                alert('Por favor completa todas las preguntas y alternativas.');
                return;
            }
            finalContent = JSON.stringify({
                questions: examQuestions,
                settings: {
                    duration: examDuration
                }
            });
        } else if (contentType === 'text') {
            // New structure for Text: JSON with html + imageUrl
            // We use resourceContent state for the image URL
            finalContent = JSON.stringify({
                html: editorContent,
                imageUrl: resourceContent
            });
        } else {
            // For Video, PDF, Presentation, Podcast -> Combine URL + Description
            finalContent = JSON.stringify({
                url: resourceContent,
                html: editorContent
            });
        }

        try {
            if (editingLessonId) {
                // Update existing lesson
                await updateLesson(
                    editingLessonId,
                    bootcamp.id,
                    contentTitle,
                    contentType,
                    finalContent
                );
            } else {
                // Create new lesson
                await createLesson(
                    activeModuleForContent,
                    bootcamp.id,
                    contentTitle,
                    contentType,
                    finalContent
                );
            }

            // Reset
            setActiveModuleForContent(null);
            setEditingLessonId(null);
            setContentType(null);
            setContentTitle('');
            setEditorContent('');
            setResourceContent('');
            setExamQuestions([{ id: '1', text: '', options: [{ id: '1-1', text: '', isCorrect: false }] }]); // Reset Exam
            setExamDuration(15);
        } catch (error) {
            alert('Error al guardar contenido');
        }
    };

    const handleEditLesson = (lesson: Lesson, moduleId: number) => {
        setActiveModuleForContent(moduleId);
        setEditingLessonId(lesson.id);
        setContentType(lesson.type);
        setContentTitle(lesson.title);

        if (lesson.type === 'exam') {
            try {
                const parsed = JSON.parse(lesson.content);
                // Handle both old array format and new object format for backward compatibility
                if (Array.isArray(parsed)) {
                    setExamQuestions(parsed);
                    setExamDuration(15); // Default defaults
                } else {
                    setExamQuestions(parsed.questions || []);
                    setExamDuration(parsed.settings?.duration || 15);
                }
                setEditorContent(''); // Clear text editor content
            } catch (e) {
                console.error("Error parsing exam content for edit", e);
                setExamQuestions([{ id: '1', text: '', options: [{ id: '1-1', text: '', isCorrect: false }] }]);
            }
        } else if (lesson.type === 'text') {
            try {
                const parsed = JSON.parse(lesson.content);
                // Check if it's our new JSON format
                if (parsed.html !== undefined || parsed.imageUrl !== undefined) {
                    setEditorContent(parsed.html || '');
                    setResourceContent(parsed.imageUrl || '');
                } else {
                    // It's just a JSON string that isn't our structure? Unlikely for 'text', assume plain string fallback
                    setEditorContent(lesson.content);
                    setResourceContent('');
                }
            } catch {
                // Legacy plain text content
                setEditorContent(lesson.content);
                setResourceContent('');
            }
            // Reset exam state just in case
            setExamQuestions([{ id: '1', text: '', options: [{ id: '1-1', text: '', isCorrect: false }] }]);
        } else {
            // Try to parse JSON for other types (Video, etc)
            try {
                const parsed = JSON.parse(lesson.content);
                if (parsed.url !== undefined) {
                    setResourceContent(parsed.url);
                    setEditorContent(parsed.html || '');
                } else {
                    // Legacy: content is just URL
                    setResourceContent(lesson.content);
                    setEditorContent('');
                }
            } catch {
                // Not JSON, treat as legacy URL
                setResourceContent(lesson.content);
                setEditorContent('');
            }
            // Reset exam state just in case
            setExamQuestions([{ id: '1', text: '', options: [{ id: '1-1', text: '', isCorrect: false }] }]);
        }
    };

    const handleInviteStudent = async () => {
        if (!inviteEmail || !inviteEmail.includes('@')) return;
        setIsInviting(true);
        try {
            await inviteStudent(bootcamp.id, inviteEmail);
            setInviteEmail('');
            alert('Invitación enviada correctamente (simulado)');
        } catch (error: any) {
            alert(error.message);
        } finally {
            setIsInviting(false);
        }
    };

    const getLessonIcon = (type: string) => {
        switch (type) {
            case 'video': return <MonitorPlay size={18} className="text-blue-500" />;
            case 'presentation': return <Layout size={18} className="text-orange-500" />;
            case 'podcast': return <Headphones size={18} className="text-violet-500" />;
            case 'pdf': return <FileUp size={18} className="text-red-500" />;
            case 'exam': return <Trophy size={18} className="text-yellow-500" />;
            default: return <FileText size={18} className="text-green-500" />;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active': return <span className="bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full text-xs border border-green-500/20">Activo</span>;
            case 'completed': return <span className="bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full text-xs border border-blue-500/20">Completado</span>;
            default: return <span className="bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-full text-xs border border-orange-500/20">Invitado</span>;
        }
    };

    const handleUpdateModule = async (moduleId: number) => {
        if (!editingModuleTitle.trim()) return;
        setIsActionLoading(true);
        try {
            await updateModule(moduleId, bootcamp.id, editingModuleTitle);
            setEditingModuleId(null);
            setEditingModuleTitle('');
        } catch (error) {
            console.error(error);
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleUpdateBootcampTitle = async () => {
        if (!tempBootcampTitle.trim() || tempBootcampTitle === bootcamp.title) {
            setIsEditingBootcampTitle(false);
            setTempBootcampTitle(bootcamp.title);
            return;
        }

        setIsActionLoading(true);
        try {
            await updateBootcamp(bootcamp.id, { title: tempBootcampTitle });
            setIsEditingBootcampTitle(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleUpdateBootcampIcon = async () => {
        setIsActionLoading(true);
        try {
            await updateBootcamp(bootcamp.id, { icon: tempIcon, color: tempColor });
            setIsEditingIcon(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsActionLoading(false);
        }
    };

    const AVAILABLE_ICONS = [
        { id: 'code', icon: Code },
        { id: 'terminal', icon: Terminal },
        { id: 'globe', icon: Globe },
        { id: 'cpu', icon: Cpu },
        { id: 'database', icon: Database },
        { id: 'layout', icon: Layout },
        { id: 'palette', icon: Palette },
        { id: 'zap', icon: Zap },
        { id: 'briefcase', icon: Briefcase },
    ];

    const AVAILABLE_COLORS = [
        { id: 'blue', value: 'bg-blue-500', text: 'text-blue-500', border: 'border-blue-500' },
        { id: 'green', value: 'bg-green-500', text: 'text-green-500', border: 'border-green-500' },
        { id: 'purple', value: 'bg-purple-500', text: 'text-purple-500', border: 'border-purple-500' },
        { id: 'orange', value: 'bg-orange-500', text: 'text-orange-500', border: 'border-orange-500' },
        { id: 'red', value: 'bg-red-500', text: 'text-red-500', border: 'border-red-500' },
        { id: 'pink', value: 'bg-pink-500', text: 'text-pink-500', border: 'border-pink-500' },
    ];

    const getIconComponent = (iconId: string) => {
        const iconInfo = AVAILABLE_ICONS.find(i => i.id === iconId);
        return iconInfo ? iconInfo.icon : Code;
    };

    const getColorClass = (colorId: string) => {
        const colorInfo = AVAILABLE_COLORS.find(c => c.id === colorId);
        return colorInfo || AVAILABLE_COLORS[0];
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        const supabase = createClient();
        setIsUploading(true);

        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `article-covers/${fileName}`;

        try {
            const { error: uploadError } = await supabase.storage
                .from('media') // Using 'media' bucket
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('media').getPublicUrl(filePath);
            setResourceContent(data.publicUrl);
        } catch (error) {
            console.error('Upload error:', error);
            alert('Error subiendo imagen. Asegúrate de tener configurado el bucket "media" en Supabase.');
        } finally {
            setIsUploading(false);
        }
    };

    const renderContentForm = () => (
        <div className="bg-card-bg border border-border rounded-lg px-4 py-3 animate-in fade-in zoom-in-95 my-2 shadow-lg ring-1 ring-primary/5">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
                <h4 className="font-medium flex items-center gap-2">
                    {editingLessonId ? <Edit2 size={16} className="text-primary" /> : <Plus size={16} className="text-primary" />}
                    {editingLessonId ? 'Editar Contenido' : 'Nuevo Contenido'}
                </h4>
                <button
                    onClick={() => {
                        setActiveModuleForContent(null);
                        setEditingLessonId(null);
                        setContentType(null);
                        setContentTitle('');
                        setEditorContent('');
                        setResourceContent('');
                    }}
                    className="text-xs text-muted hover:text-foreground px-2 py-1 rounded hover:bg-hover-bg"
                >
                    Cancelar
                </button>
            </div>

            {!contentType ? (
                <div className="grid grid-cols-3 gap-4">
                    {/* Content Type Buttons */}
                    <button onClick={() => setContentType('text')} className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all text-center group">
                        <div className="p-2 rounded-full bg-green-500/10 text-green-500 group-hover:scale-110 transition-transform"><FileText size={24} /></div>
                        <span className="text-sm font-medium">Texto / Artículo</span>
                    </button>
                    <button onClick={() => setContentType('video')} className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all text-center group">
                        <div className="p-2 rounded-full bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform"><MonitorPlay size={24} /></div>
                        <span className="text-sm font-medium">Video</span>
                    </button>
                    <button onClick={() => setContentType('presentation')} className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all text-center group">
                        <div className="p-2 rounded-full bg-orange-500/10 text-orange-500 group-hover:scale-110 transition-transform"><Layout size={24} /></div>
                        <span className="text-sm font-medium">Presentación</span>
                    </button>
                    <button onClick={() => setContentType('podcast')} className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all text-center group">
                        <div className="p-2 rounded-full bg-violet-500/10 text-violet-500 group-hover:scale-110 transition-transform"><Headphones size={24} /></div>
                        <span className="text-sm font-medium">Podcast</span>
                    </button>
                    <button onClick={() => setContentType('pdf')} className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all text-center group">
                        <div className="p-2 rounded-full bg-red-500/10 text-red-500 group-hover:scale-110 transition-transform"><FileUp size={24} /></div>
                        <span className="text-sm font-medium">Subir PDF</span>
                    </button>
                    <button onClick={() => setContentType('exam')} className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all text-center group">
                        <div className="p-2 rounded-full bg-yellow-500/10 text-yellow-500 group-hover:scale-110 transition-transform"><Trophy size={24} /></div>
                        <span className="text-sm font-medium">Crear Examen</span>
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1.5">Título de la lección</label>
                        <input
                            type="text"
                            value={contentTitle}
                            onChange={(e) => setContentTitle(e.target.value)}
                            className="w-full px-4 py-2 rounded-md bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none"
                            placeholder="Ej: Conceptos Básicos"
                            autoFocus
                        />
                    </div>
                    {contentType === 'text' && (
                        <div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1.5">Imagen de Portada</label>
                                <div className="flex items-start gap-4">
                                    {resourceContent && (
                                        <div className="relative w-32 h-20 rounded-lg overflow-hidden border border-border group shrink-0">
                                            <img src={resourceContent} alt="Cover" className="w-full h-full object-cover" />
                                            <button
                                                onClick={() => setResourceContent('')}
                                                className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                                            >
                                                <X size={20} />
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className="hidden"
                                            id="cover-upload"
                                            disabled={isUploading}
                                        />
                                        <label
                                            htmlFor="cover-upload"
                                            className={`flex items-center justify-center gap-2 px-4 py-8 border border-dashed border-border rounded-lg cursor-pointer hover:bg-hover-bg transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            {isUploading ? (
                                                <span className="text-sm font-medium">Subiendo imagen...</span>
                                            ) : (
                                                <div className="flex flex-col items-center gap-1">
                                                    <FileUp size={24} className="text-muted" />
                                                    <span className="text-sm text-muted-foreground font-medium">Examinar en mi PC</span>
                                                    <span className="text-xs text-muted">JPG, PNG, WEBP</span>
                                                </div>
                                            )}
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <label className="block text-sm font-medium mb-1.5">Contenido</label>
                            <TiptapEditor content={editorContent} onChange={setEditorContent} />
                        </div>
                    )}
                    {contentType !== 'text' && (
                        <div>
                            {contentType === 'exam' ? (
                                <div className="space-y-6 border border-border rounded-lg p-6 bg-background/50">
                                    <div className="flex items-center gap-2 mb-4 text-primary">
                                        <Trophy size={20} />
                                        <h4 className="font-semibold">Constructor de Examen</h4>
                                    </div>

                                    <div className="mb-6 p-4 bg-secondary/20 rounded-lg border border-border flex items-center gap-4">
                                        <Clock size={20} className="text-muted" />
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Duración (minutos)</label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="180"
                                                value={examDuration}
                                                onChange={(e) => setExamDuration(Number(e.target.value))}
                                                className="w-24 px-3 py-1.5 rounded-md bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none text-center font-medium"
                                            />
                                        </div>
                                        <p className="text-sm text-muted">Tiempo límite para los estudiantes</p>
                                    </div>

                                    {examQuestions.map((question, qIndex) => (
                                        <div key={question.id} className="bg-card-bg border border-border/60 rounded-xl p-4 shadow-sm">
                                            <div className="flex justify-between items-start mb-3 gap-4">
                                                <div className="flex-1">
                                                    <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1 block">Pregunta {qIndex + 1}</label>
                                                    <input
                                                        type="text"
                                                        value={question.text}
                                                        onChange={(e) => {
                                                            const newQuestions = [...examQuestions];
                                                            newQuestions[qIndex].text = e.target.value;
                                                            setExamQuestions(newQuestions);
                                                        }}
                                                        className="w-full px-3 py-2 text-lg font-medium bg-transparent border-b border-border focus:border-primary outline-none transition-colors"
                                                        placeholder="Escribe tu pregunta aquí..."
                                                    />
                                                </div>
                                                {examQuestions.length > 1 && (
                                                    <button
                                                        onClick={() => {
                                                            const newQuestions = examQuestions.filter(q => q.id !== question.id);
                                                            setExamQuestions(newQuestions);
                                                        }}
                                                        className="text-muted hover:text-red-500 p-1"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="space-y-2 mt-4 pl-4 border-l-2 border-border/50">
                                                <label className="text-xs font-semibold text-muted mb-2 block">Alternativas</label>

                                                {question.options.map((option, oIndex) => (
                                                    <div key={option.id} className="flex items-center gap-3 group">
                                                        <div
                                                            className={`w-4 h-4 rounded-full border flex items-center justify-center cursor-pointer transition-colors ${option.isCorrect ? 'bg-green-500 border-green-500' : 'border-muted hover:border-foreground'}`}
                                                            onClick={() => {
                                                                const newQuestions = [...examQuestions];
                                                                newQuestions[qIndex].options.forEach(o => o.isCorrect = false);
                                                                newQuestions[qIndex].options[oIndex].isCorrect = true;
                                                                setExamQuestions(newQuestions);
                                                            }}
                                                        >
                                                            {option.isCorrect && <Check size={10} className="text-white" />}
                                                        </div>

                                                        <input
                                                            type="text"
                                                            value={option.text}
                                                            onChange={(e) => {
                                                                const newQuestions = [...examQuestions];
                                                                newQuestions[qIndex].options[oIndex].text = e.target.value;
                                                                setExamQuestions(newQuestions);
                                                            }}
                                                            className={`flex-1 px-3 py-1.5 rounded-md text-sm border ${option.isCorrect ? 'border-green-500/30 bg-green-500/5' : 'border-border bg-background'} outline-none focus:border-primary/50`}
                                                            placeholder={`Opción ${oIndex + 1}`}
                                                        />

                                                        <button
                                                            onClick={() => {
                                                                const newQuestions = [...examQuestions];
                                                                newQuestions[qIndex].options.forEach(o => o.isCorrect = false);
                                                                newQuestions[qIndex].options[oIndex].isCorrect = true;
                                                                setExamQuestions(newQuestions);
                                                            }}
                                                            className={`text-xs px-2 py-1 rounded transition-colors ${option.isCorrect ? 'text-green-500 bg-green-500/10' : 'text-muted hover:text-foreground'}`}
                                                        >
                                                            {option.isCorrect ? 'Respuesta Correcta' : 'Marcar Correcta'}
                                                        </button>

                                                        <button
                                                            onClick={() => {
                                                                const newQuestions = [...examQuestions];
                                                                newQuestions[qIndex].options = newQuestions[qIndex].options.filter(o => o.id !== option.id);
                                                                setExamQuestions(newQuestions);
                                                            }}
                                                            className="text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ))}

                                                <button
                                                    onClick={() => {
                                                        const newQuestions = [...examQuestions];
                                                        newQuestions[qIndex].options.push({ id: `${question.id}-${Date.now()}`, text: '', isCorrect: false });
                                                        setExamQuestions(newQuestions);
                                                    }}
                                                    className="mt-3 text-xs flex items-center gap-1 text-primary hover:text-primary/80 font-medium"
                                                >
                                                    <Plus size={14} /> Agregar Alternativa
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    <button
                                        onClick={() => {
                                            setExamQuestions([
                                                ...examQuestions,
                                                { id: `${Date.now()}`, text: '', options: [{ id: `${Date.now()}-1`, text: '', isCorrect: false }] }
                                            ]);
                                        }}
                                        className="w-full py-3 border border-dashed border-primary/30 rounded-lg text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2 font-medium"
                                    >
                                        <Plus size={18} />
                                        Agregar Nueva Pregunta
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">
                                        {contentType === 'pdf' ? 'URL del archivo PDF' : 'URL del recurso'}
                                    </label>
                                    <input
                                        type="text"
                                        value={resourceContent}
                                        onChange={(e) => setResourceContent(e.target.value)}
                                        className="w-full px-4 py-2 rounded-md bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none"
                                        placeholder="https://..."
                                    />
                                    <p className="text-xs text-muted mt-1 mb-4">
                                        {contentType === 'pdf'
                                            ? 'Ingresa la URL del PDF alojado (Google Drive, Dropbox, etc.)'
                                            : 'Pega el enlace directo al recurso.'}
                                    </p>

                                    <label className="block text-sm font-medium mb-1.5">Contenido / Descripción</label>
                                    <TiptapEditor content={editorContent} onChange={setEditorContent} />
                                </div>
                            )}
                        </div>
                    )}
                    <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                        <button onClick={() => setContentType(null)} className="px-4 py-2 text-sm text-foreground hover:bg-hover-bg rounded-lg">Atrás</button>
                        <button onClick={handleSaveContent} disabled={!contentTitle || (contentType !== 'exam' && !editorContent)} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">
                            {editingLessonId ? 'Actualizar Lección' : 'Guardar Lección'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Sidebar />

            <div className={`flex flex-col min-h-screen transition-all duration-300 ${isCollapsed ? 'ml-16' : 'ml-64'}`}>
                {/* Header */}
                <header className={`fixed top-0 right-0 z-1 h-[60px] bg-background border-b border-border flex items-center px-6 justify-between transition-all duration-300 ${isCollapsed ? 'left-16' : 'left-64'}`}>
                    <div className="flex items-center gap-2 text-sm text-muted">
                        <Link href="/cms" className="hover:text-foreground transition-colors">CMS</Link>
                        <ChevronRight size={14} />
                        <span className="text-foreground font-medium">{bootcamp.title}</span>
                    </div>
                </header>

                <main className="flex-1 pt-[92px] px-6 pb-12">

                    <div className="max-w-5xl mx-auto">

                        {/* Title & Tabs */}
                        <div className="flex flex-col gap-6 mb-8">
                            <div className="flex justify-between items-start">
                                <div className="flex gap-4 items-start relative">
                                    {/* Icon & Color Editor */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setIsEditingIcon(!isEditingIcon)}
                                            className={`w-13 h-13 rounded-full flex items-center justify-center transition-transform hover:scale-105 ${getColorClass(bootcamp.color || 'blue').value} text-white shadow-lg shadow-primary/20`}
                                        >
                                            {(() => {
                                                const IconComp = getIconComponent(bootcamp.icon || 'code');
                                                return <IconComp size={24} />;
                                            })()}
                                            <div className="absolute -bottom-1 -right-1 bg-background border border-border p-1 rounded-full text-foreground shadow-sm">
                                                <Edit2 size={12} />
                                            </div>
                                        </button>

                                        {isEditingIcon && (
                                            <div className="absolute top-full left-0 mt-2 z-50 w-72 bg-card-bg border border-border rounded-xl shadow-xl p-4 animate-in fade-in zoom-in-95">
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="text-xs font-semibold text-muted mb-2 block uppercase">Icono</label>
                                                        <div className="grid grid-cols-5 gap-2">
                                                            {AVAILABLE_ICONS.map((item) => (
                                                                <button
                                                                    key={item.id}
                                                                    onClick={() => setTempIcon(item.id)}
                                                                    className={`p-2 rounded-lg flex items-center justify-center transition-all ${tempIcon === item.id ? 'bg-primary/20 text-primary ring-2 ring-primary/50' : 'hover:bg-hover-bg text-muted hover:text-foreground'}`}
                                                                >
                                                                    <item.icon size={20} />
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-semibold text-muted mb-2 block uppercase">Color</label>
                                                        <div className="flex gap-2 flex-wrap">
                                                            {AVAILABLE_COLORS.map((item) => (
                                                                <button
                                                                    key={item.id}
                                                                    onClick={() => setTempColor(item.id)}
                                                                    className={`w-8 h-8 rounded-full border-2 transition-all ${item.value} ${tempColor === item.id ? 'ring-2 ring-offset-2 ring-foreground border-transparent' : 'border-transparent hover:scale-110'}`}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-end gap-2 pt-2 border-t border-border">
                                                        <button
                                                            onClick={() => setIsEditingIcon(false)}
                                                            className="px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground"
                                                        >
                                                            Cancelar
                                                        </button>
                                                        <button
                                                            onClick={handleUpdateBootcampIcon}
                                                            className="px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-md hover:bg-primary/90"
                                                        >
                                                            Guardar
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1">
                                        {isEditingBootcampTitle ? (
                                            <div className="mb-2">
                                                <input
                                                    type="text"
                                                    value={tempBootcampTitle}
                                                    onChange={(e) => setTempBootcampTitle(e.target.value)}
                                                    className="text-2xl font-semibold bg-transparent border-b-2 border-primary outline-none text-foreground w-full py-1"
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleUpdateBootcampTitle();
                                                        if (e.key === 'Escape') {
                                                            setIsEditingBootcampTitle(false);
                                                            setTempBootcampTitle(bootcamp.title);
                                                        }
                                                    }}
                                                    onBlur={handleUpdateBootcampTitle}
                                                />
                                            </div>
                                        ) : (
                                            <div
                                                className="group flex items-center gap-3 mb-1 cursor-pointer w-fit"
                                                onClick={() => {
                                                    setTempBootcampTitle(bootcamp.title);
                                                    setIsEditingBootcampTitle(true);
                                                }}
                                            >
                                                <h1 className="text-2xl font-semibold">{bootcamp.title}</h1>
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground p-1 rounded hover:bg-muted/10">
                                                    <Edit2 size={18} />
                                                </div>
                                            </div>
                                        )}
                                        <p className="text-muted">Gestiona el contenido y los alumnos de tu curso.</p>
                                    </div>
                                </div>
                                {activeTab === 'content' && (
                                    <button
                                        onClick={() => setIsCreatingModule(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                                    >
                                        <Plus size={20} />
                                        <span>Nuevo Módulo</span>
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-4 border-b border-border">
                                <button
                                    onClick={() => setActiveTab('content')}
                                    className={`pb-3 px-1 text-sm font-medium transition-all ${activeTab === 'content'
                                        ? 'text-primary border-b-2 border-primary'
                                        : 'text-muted hover:text-foreground'
                                        }`}
                                >
                                    Contenido
                                </button>
                                <button
                                    onClick={() => setActiveTab('students')}
                                    className={`pb-3 px-1 text-sm font-medium transition-all ${activeTab === 'students'
                                        ? 'text-primary border-b-2 border-primary'
                                        : 'text-muted hover:text-foreground'
                                        }`}
                                >
                                    Alumnos
                                </button>
                            </div>
                        </div>

                        {/* CONTENT TAB */}
                        {activeTab === 'content' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">


                                {/* Create Module Form */}
                                {isCreatingModule && (
                                    <div className="mb-6 p-4 border border-border rounded-lg bg-card-bg animate-in fade-in slide-in-from-top-2">
                                        <h3 className="text-sm font-medium mb-3">Nombre del Módulo</h3>
                                        <div className="flex gap-3">
                                            <input
                                                type="text"
                                                value={newModuleTitle}
                                                onChange={(e) => setNewModuleTitle(e.target.value)}
                                                placeholder="Ej: Introducción a React"
                                                className="flex-1 px-4 py-2 rounded-md bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none"
                                                autoFocus
                                            />
                                            <button
                                                onClick={handleCreateModule}
                                                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
                                            >
                                                Guardar
                                            </button>
                                            <button
                                                onClick={() => setIsCreatingModule(false)}
                                                className="px-4 py-2 border border-border rounded-md hover:bg-hover-bg"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Modules List */}
                                <div className="space-y-4">
                                    {modules.length === 0 && !isCreatingModule && (
                                        <div className="text-center p-12 border border-dashed border-border rounded-xl bg-card-bg/50">
                                            <p className="text-muted">No hay módulos creados aún.</p>
                                        </div>
                                    )}

                                    {modules.map((module) => (
                                        <div key={module.id} className="border border-border rounded-xl bg-card-bg overflow-hidden shadow-sm">
                                            {/* Module Header */}
                                            <div
                                                className="flex items-center justify-between p-4 bg-card-bg hover:bg-hover-bg transition-colors cursor-pointer"
                                                onClick={() => toggleModule(module.id)}
                                            >
                                                <div className="flex items-center gap-3 flex-1 mr-4">
                                                    <div className="p-1.5 rounded-md bg-primary/10 text-primary flex-shrink-0">
                                                        <Layout size={20} />
                                                    </div>

                                                    {editingModuleId === module.id ? (
                                                        <div className="flex items-center gap-2 flex-1" onClick={(e) => e.stopPropagation()}>
                                                            <input
                                                                type="text"
                                                                value={editingModuleTitle}
                                                                onChange={(e) => setEditingModuleTitle(e.target.value)}
                                                                className="flex-1 px-3 py-1.5 rounded-md bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none text-lg font-medium"
                                                                autoFocus
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') handleUpdateModule(module.id);
                                                                    if (e.key === 'Escape') {
                                                                        setEditingModuleId(null);
                                                                        setEditingModuleTitle('');
                                                                    }
                                                                }}
                                                            />
                                                            <button
                                                                onClick={() => handleUpdateModule(module.id)}
                                                                className="p-1.5 bg-green-500/10 text-green-500 rounded hover:bg-green-500/20"
                                                            >
                                                                <Check size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setEditingModuleId(null);
                                                                    setEditingModuleTitle('');
                                                                }}
                                                                className="p-1.5 bg-red-500/10 text-red-500 rounded hover:bg-red-500/20"
                                                            >
                                                                <X size={18} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-medium text-lg">{module.title}</span>
                                                            <span className="text-xs px-2 py-0.5 rounded-full bg-input-bg text-muted border border-border">
                                                                {module.lessons?.length || 0} lecciones
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 text-muted">
                                                    {editingModuleId !== module.id && (
                                                        <>
                                                            <button
                                                                className="p-2 hover:text-foreground transition-colors"
                                                                title="Editar Nombre"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setEditingModuleId(module.id);
                                                                    setEditingModuleTitle(module.title);
                                                                }}
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>
                                                            <button className="p-2 hover:text-red-500 transition-colors" title="Eliminar Módulo"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openConfirmModal(
                                                                        'Eliminar Módulo',
                                                                        '¿Estás seguro de eliminar este módulo? Se borrarán todas las lecciones contenidas.',
                                                                        () => deleteModule(module.id, bootcamp.id)
                                                                    );
                                                                }}
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </>
                                                    )}
                                                    {expandedModule === module.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                </div>
                                            </div>

                                            {/* Module Content */}
                                            {expandedModule === module.id && (
                                                <div className="border-t border-border bg-background/50 p-4">
                                                    <div className="space-y-2 mb-6">
                                                        {module.lessons?.map((lesson) => (
                                                            <div key={lesson.id}>
                                                                {editingLessonId === lesson.id ? (
                                                                    renderContentForm()
                                                                ) : (
                                                                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card-bg hover:border-primary/30 transition-all group">
                                                                        <div className="flex items-center gap-3">
                                                                            <GripVertical size={16} className="text-muted cursor-move opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                            {getLessonIcon(lesson.type)}
                                                                            <span className="text-sm font-medium">{lesson.title}</span>
                                                                        </div>
                                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                            <button
                                                                                onClick={() => handleEditLesson(lesson, module.id)}
                                                                                className="p-1.5 hover:bg-hover-bg rounded text-muted hover:text-foreground"
                                                                            >
                                                                                <Edit2 size={14} />
                                                                            </button>
                                                                            <button
                                                                                className="p-1.5 hover:bg-red-500/10 rounded text-muted hover:text-red-500"
                                                                                onClick={() => {
                                                                                    openConfirmModal(
                                                                                        'Eliminar Lección',
                                                                                        '¿Estás seguro de eliminar esta lección?',
                                                                                        () => deleteLesson(lesson.id, bootcamp.id)
                                                                                    );
                                                                                }}
                                                                            >
                                                                                <Trash2 size={14} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                        {module.lessons?.length === 0 && (
                                                            <p className="text-sm text-muted italic ml-8">No hay lecciones en este módulo.</p>
                                                        )}
                                                    </div>

                                                    {!editingLessonId && (
                                                        activeModuleForContent === module.id ? (
                                                            renderContentForm()
                                                        ) : (
                                                            <button
                                                                onClick={() => setActiveModuleForContent(module.id)}
                                                                className="w-full py-3 border border-dashed border-border rounded-lg text-sm text-muted hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
                                                            >
                                                                <Plus size={16} />
                                                                Agregar Contenido
                                                            </button>
                                                        )
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* STUDENTS TAB */}
                        {activeTab === 'students' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                    <div className="md:col-span-2">
                                        <div className="bg-card-bg border border-border rounded-xl p-6 shadow-sm">
                                            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                                                <Users size={20} className="text-primary" />
                                                Lista de Alumnos
                                            </h3>

                                            {initialStudents.length === 0 ? (
                                                <div className="text-center py-12 text-muted">
                                                    <Users size={48} className="mx-auto mb-3 opacity-20" />
                                                    <p>Aún no has invitado a ningún alumno.</p>
                                                </div>
                                            ) : (
                                                <div className="overflow-hidden rounded-lg border border-border">
                                                    <table className="w-full text-sm text-left">
                                                        <thead className="bg-secondary/30 text-muted uppercase text-xs font-semibold">
                                                            <tr>
                                                                <th className="px-4 py-3">Email</th>
                                                                <th className="px-4 py-3">Estado</th>
                                                                <th className="px-4 py-3">Invitado</th>
                                                                <th className="px-4 py-3 text-right">Acciones</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-border">
                                                            {initialStudents.map((student) => (
                                                                <tr key={student.id} className="bg-card-bg hover:bg-hover-bg transition-colors">
                                                                    <td className="px-4 py-3 font-medium">{student.email}</td>
                                                                    <td className="px-4 py-3">{getStatusBadge(student.status)}</td>
                                                                    <td className="px-4 py-3 text-muted">
                                                                        {new Date(student.invitedAt).toLocaleDateString()}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right">
                                                                        <button
                                                                            onClick={() => openConfirmModal(
                                                                                'Eliminar Alumno',
                                                                                '¿Estás seguro de eliminar a este alumno? Perderá el acceso al curso.',
                                                                                () => removeStudent(student.id, bootcamp.id)
                                                                            )}
                                                                            className="text-muted hover:text-red-500 transition-colors p-1"
                                                                            title="Eliminar acceso"
                                                                        >
                                                                            <UserMinus size={16} />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="bg-card-bg border border-border rounded-xl p-6 shadow-sm sticky top-24">
                                            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                                                <Mail size={20} className="text-primary" />
                                                Invitar Alumnos
                                            </h3>
                                            <p className="text-sm text-muted mb-4">Envía una invitación por correo electrónico para dar acceso al curso.</p>

                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-sm font-medium mb-1.5">Correo Electrónico</label>
                                                    <input
                                                        type="email"
                                                        value={inviteEmail}
                                                        onChange={(e) => setInviteEmail(e.target.value)}
                                                        className="w-full px-4 py-2 rounded-md bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none"
                                                        placeholder="alumno@ejemplo.com"
                                                    />
                                                </div>
                                                <button
                                                    onClick={handleInviteStudent}
                                                    disabled={!inviteEmail || isInviting}
                                                    className="w-full py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                >
                                                    {isInviting ? 'Enviando...' : 'Enviar Invitación'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            <ConfirmationModal
                isOpen={modalConfig.isOpen}
                onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={modalConfig.onConfirm}
                title={modalConfig.title}
                message={modalConfig.message}
                confirmText={modalConfig.confirmText}
                variant={modalConfig.variant}
                isLoading={isActionLoading}
            />
        </div>
    );
}
