'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { useSidebar } from '@/components/sidebar-context';
import { ConfirmationModal } from '@/components/confirmation-modal';
import { TiptapEditor } from '@/components/tiptap-editor';
import { RichTextEditor } from '@/components/rich-text-editor';
import {
    ChevronRight, Plus, FileText, Layout,
    Trash2, Edit2, ChevronDown, ChevronUp, GripVertical, MonitorPlay,
    Headphones, FileUp, Users, Trophy, Check, X, Clock, Loader2,
    Code, Terminal, Globe, Cpu, Database, Palette, Zap, Briefcase,
    MoreHorizontal, BarChart3, Radio, BookOpen, Calendar, Snowflake,
    Upload
} from 'lucide-react';

import { createModule, createLesson, updateLesson, updateModule, deleteModule, deleteLesson, reorderLessons, reorderModules } from '@/app/actions/module';
import { updateBootcamp } from '@/app/actions/bootcamp';
import { createClient } from '@/utils/supabase/client';
import { removeStudent, updateStudentStatus } from '@/app/actions/student';
import { useOnlineUsers } from '@/contexts/OnlineUsersContext';
import { formatDateString } from '@/utils/date';

import { createInvitation } from '@/app/actions/invitation';

interface Lesson {
    id: number;
    title: string;
    type: 'text' | 'video' | 'presentation' | 'podcast' | 'pdf' | 'exam' | 'subtitle';
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
    status: 'invited' | 'active' | 'completed' | 'frozen';
    invitedAt: string;
    joinedAt?: string;
}

interface ManageBootcampClientProps {
    bootcamp: {
        id: number;
        title: string;
        description?: string;
        icon?: string;
        color?: string;
        duration?: string;
        level?: string;
        startDate?: string;
        enableChecklist?: boolean;
        enableRanking?: boolean;
        imageUrl?: string;
    };

    modules: Module[];
    initialStudents?: Student[];
}

const getGroupedLessons = (lessons: Lesson[]) => {
    const groups: { subtitle: Lesson | null; lessons: Lesson[] }[] = [];
    let currentGroup: { subtitle: Lesson | null; lessons: Lesson[] } = { subtitle: null, lessons: [] };

    (lessons || []).forEach((lesson) => {
        if (lesson.type === 'subtitle') {
            if (currentGroup.subtitle !== null || currentGroup.lessons.length > 0) {
                groups.push(currentGroup);
            }
            currentGroup = { subtitle: lesson, lessons: [] };
        } else {
            currentGroup.lessons.push(lesson);
        }
    });

    if (currentGroup.subtitle !== null || currentGroup.lessons.length > 0) {
        groups.push(currentGroup);
    }

    return groups;
};

export function ManageBootcampClient({ bootcamp, modules, initialStudents = [] }: ManageBootcampClientProps) {
    const { isCollapsed } = useSidebar();
    const router = useRouter();

    // UI State
    const [activeTab, setActiveTab] = useState<'content' | 'students' | 'room' | 'ranking'>('content');
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);
    const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [openModuleMenuId, setOpenModuleMenuId] = useState<number | null>(null);
    const moduleMenuRef = useRef<HTMLDivElement>(null);

    const { onlineUsers } = useOnlineUsers();

    // Ranking State
    const [rankingData, setRankingData] = useState<{
        student: Student;
        points: number;
        completedLessonIds: number[];
    }[]>([]);
    const [isRankingLoading, setIsRankingLoading] = useState(true);
    const [completionsList, setCompletionsList] = useState<{ studentId: number; lessonId: number; completedAt: string }[]>([]);
    const [chartMode, setChartMode] = useState<'day' | 'week'>('day');
    const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

    useEffect(() => {
        async function fetchRanking() {
            const activeStudents = initialStudents.filter(s => s.status === 'active');
            if (activeStudents.length === 0) {
                setRankingData([]);
                setCompletionsList([]);
                setIsRankingLoading(false);
                return;
            }
            try {
                const supabase = createClient();
                const studentIds = activeStudents.map(s => s.id);
                
                // Get all lesson IDs in this bootcamp
                const lessonIds = modules.flatMap(m => m.lessons || []).map(l => l.id);
                
                if (lessonIds.length === 0) {
                    setRankingData(activeStudents.map(student => ({
                        student,
                        points: 0,
                        completedLessonIds: []
                    })));
                    setIsRankingLoading(false);
                    return;
                }

                // Query LessonCompletion for all students of this bootcamp
                const { data: completions, error } = await supabase
                    .from('LessonCompletion')
                    .select('studentId, lessonId, completedAt')
                    .in('studentId', studentIds)
                    .in('lessonId', lessonIds);

                if (error) {
                    console.error('Error fetching completions for ranking:', error);
                    return;
                }

                setCompletionsList(completions || []);

                // Group completions by studentId
                const completionsMap: Record<number, number[]> = {};
                studentIds.forEach(id => {
                    completionsMap[id] = [];
                });

                completions?.forEach((c: any) => {
                    if (completionsMap[c.studentId]) {
                        completionsMap[c.studentId].push(c.lessonId);
                    }
                });

                // Map students to ranking data
                const mappedRanking = activeStudents.map(student => {
                    const studentCompletions = completionsMap[student.id] || [];
                    return {
                        student,
                        points: studentCompletions.length,
                        completedLessonIds: studentCompletions
                    };
                });

                // Sort by points descending
                mappedRanking.sort((a, b) => b.points - a.points);

                setRankingData(mappedRanking);
            } catch (err) {
                console.error('Error in fetchRanking:', err);
            } finally {
                setIsRankingLoading(false);
            }
        }

        if (activeTab === 'ranking') {
            fetchRanking();
        }
    }, [activeTab, initialStudents, modules]);

    // Content Management State
    const [expandedModule, setExpandedModule] = useState<number | null>(null);
    const [isCreatingModule, setIsCreatingModule] = useState(false);
    const [newModuleTitle, setNewModuleTitle] = useState('');
    const [activeModuleForContent, setActiveModuleForContent] = useState<number | null>(null);
    const [isEditingBootcampModalOpen, setIsEditingBootcampModalOpen] = useState(false);
    const [tempBootcampTitle, setTempBootcampTitle] = useState(bootcamp.title);
    const [tempDescription, setTempDescription] = useState(bootcamp.description || '');
    const [tempDuration, setTempDuration] = useState(bootcamp.duration || '');
    const [tempLevel, setTempLevel] = useState(bootcamp.level || '');
    const [tempStartDate, setTempStartDate] = useState(bootcamp.startDate || '');
    const [tempEnableChecklist, setTempEnableChecklist] = useState<boolean>(bootcamp.enableChecklist ?? true);
    const [tempEnableRanking, setTempEnableRanking] = useState<boolean>(bootcamp.enableRanking ?? true);
    const [isEditingIcon, setIsEditingIcon] = useState(false);

    const [tempIcon, setTempIcon] = useState(bootcamp.icon || 'code');
    const [tempColor, setTempColor] = useState(bootcamp.color || 'blue');
    const [tempImageUrl, setTempImageUrl] = useState(bootcamp.imageUrl || '');
    const [isUploadingCover, setIsUploadingCover] = useState(false);

    const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        
        setIsUploadingCover(true);
        const supabase = createClient();
        
        const fileExt = file.name.split('.').pop();
        const fileName = `bootcamp-cover-${Date.now()}.${fileExt}`;
        const filePath = `bootcamps/${fileName}`;

        try {
            const { error: uploadError } = await supabase.storage
                .from('media')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('media').getPublicUrl(filePath);
            setTempImageUrl(data.publicUrl);
        } catch (error) {
            console.error('Upload error:', error);
            alert('Error al subir la imagen. Asegúrate de tener configurado el bucket "media" en Supabase.');
        } finally {
            setIsUploadingCover(false);
        }
    };
    const [editingModuleId, setEditingModuleId] = useState<number | null>(null);
    const [editingModuleTitle, setEditingModuleTitle] = useState('');
    const [editingLessonId, setEditingLessonId] = useState<number | null>(null);
    const [contentType, setContentType] = useState<'text' | 'video' | 'presentation' | 'podcast' | 'pdf' | 'exam' | 'exam_formal' | 'subtitle' | null>(null);
    const [contentTitle, setContentTitle] = useState('');

    const [editorContent, setEditorContent] = useState('');
    const [resourceContent, setResourceContent] = useState(''); // Valid for Video, PDF, Presentation, etc. URL
    const [isUploading, setIsUploading] = useState(false);
    const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false);
    const typeSelectorRef = useRef<HTMLDivElement>(null);

    // Exam Builder State
    const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([
        { id: '1', text: '', options: [{ id: '1-1', text: '', isCorrect: false }] }
    ]);
    const [examDuration, setExamDuration] = useState(15); // Default 15 mins

    const [toast, setToast] = useState<{ show: boolean, message: string } | null>(null);

    // Drag and Drop State
    const [localModules, setLocalModules] = useState(modules);
    const [draggedLessonId, setDraggedLessonId] = useState<number | null>(null);
    const [draggedModuleId, setDraggedModuleId] = useState<number | null>(null);
    const [dragOverLessonId, setDragOverLessonId] = useState<number | null>(null);
    const [dragOverModuleId, setDragOverModuleId] = useState<number | null>(null);
    const [draggedOptionId, setDraggedOptionId] = useState<string | null>(null);
    const [dragOverOptionId, setDragOverOptionId] = useState<string | null>(null);

    // Accordion state for separators (subtitles)
    const [collapsedSeparators, setCollapsedSeparators] = useState<Record<number, boolean>>({});

    const toggleSeparator = (separatorId: number) => {
        setCollapsedSeparators(prev => ({
            ...prev,
            [separatorId]: !prev[separatorId]
        }));
    };

    // Sync local modules when props change
    useEffect(() => {
        setLocalModules(modules);
    }, [modules]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpenMenuId(null);
                setMenuPosition(null);
            }
            if (moduleMenuRef.current && !moduleMenuRef.current.contains(event.target as Node)) {
                setOpenModuleMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Close student action menu on scroll or resize to prevent popover drift
    useEffect(() => {
        const handleScrollOrResize = () => {
            if (openMenuId !== null) {
                setOpenMenuId(null);
                setMenuPosition(null);
            }
        };
        window.addEventListener('scroll', handleScrollOrResize, { passive: true });
        window.addEventListener('resize', handleScrollOrResize);
        return () => {
            window.removeEventListener('scroll', handleScrollOrResize);
            window.removeEventListener('resize', handleScrollOrResize);
        };
    }, [openMenuId]);

    // Close type selector dropdown on outside click
    useEffect(() => {
        const handleClickOutsideTypeSelector = (event: MouseEvent) => {
            if (typeSelectorRef.current && !typeSelectorRef.current.contains(event.target as Node)) {
                setIsTypeSelectorOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutsideTypeSelector);
        return () => document.removeEventListener('mousedown', handleClickOutsideTypeSelector);
    }, []);


    // Modal State
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => Promise<void> | void;
        confirmText?: string;
        variant?: 'danger' | 'primary' | 'success';
        hideCancel?: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: async () => { },
    });
    const [isActionLoading, setIsActionLoading] = useState(false);

    const showToast = (message: string) => {
        setToast({ show: true, message });
        setTimeout(() => setToast(null), 5000);
    };

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
            hideCancel: false,
            onConfirm: async () => {
                setIsActionLoading(true);
                try {
                    await action();
                    setModalConfig(prev => ({ ...prev, isOpen: false }));
                    router.refresh();
                } catch (error: unknown) {
                    const e = error as Error;
                    console.error(e);
                    alert(e.message || 'Error al ejecutar la acción');

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
            router.refresh();
        } catch {
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
        } else if (contentType === 'subtitle') {
            finalContent = '';
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
            router.refresh();
        } catch {
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
                if (Array.isArray(parsed)) {
                    setExamQuestions(parsed);
                    setExamDuration(15);
                } else {
                    setExamQuestions(parsed.questions || []);
                    setExamDuration(parsed.settings?.duration || 15);
                }
                setEditorContent('');
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

    const handleToggleStatus = async (studentId: number, newStatus: 'invited' | 'active' | 'completed' | 'frozen') => {
        setIsActionLoading(true);
        try {
            await updateStudentStatus(studentId, bootcamp.id, newStatus);
        } catch (error: unknown) {
            const e = error as Error;
            alert(e.message);
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleToggleRanking = async () => {
        setIsActionLoading(true);
        try {
            const nextStatus = !(bootcamp.enableRanking ?? true);
            await updateBootcamp(bootcamp.id, { enableRanking: nextStatus });
            router.refresh();
        } catch (error) {
            console.error(error);
        } finally {
            setIsActionLoading(false);
        }
    };



    const handleGenerateUniqueLink = async () => {
        setIsActionLoading(true);
        const result = await createInvitation(bootcamp.id);
        setIsActionLoading(false);

        if ('error' in result) {
            alert(result.error);
            return;
        }

        const origin = window.location.origin;
        const inviteUrl = `${origin}/login?token=${result.token}`;

        navigator.clipboard.writeText(inviteUrl);

        showToast(`¡Enlace Único generado y copiado! \nEste enlace es de un solo uso.`);
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
            case 'frozen': return <span className="bg-cyan-500/10 text-cyan-500 px-2 py-0.5 rounded-full text-xs border border-cyan-500/20">Congelado</span>;
            case 'invited':
                return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">Pendiente</span>;
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
            router.refresh();
        } catch (error) {
            console.error(error);
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleUpdateBootcampInfo = async () => {
        if (!tempBootcampTitle.trim()) {
            return;
        }

        if (
            tempBootcampTitle === bootcamp.title && 
            tempDescription === bootcamp.description &&
            tempDuration === (bootcamp.duration || '') &&
            tempLevel === (bootcamp.level || '') &&
            tempStartDate === (bootcamp.startDate || '') &&
            tempEnableChecklist === (bootcamp.enableChecklist ?? true) &&
            tempEnableRanking === (bootcamp.enableRanking ?? true) &&
            tempImageUrl === (bootcamp.imageUrl || '')
        ) {
            setIsEditingBootcampModalOpen(false);
            return;
        }

        setIsActionLoading(true);
        try {
            await updateBootcamp(bootcamp.id, { 
                title: tempBootcampTitle,
                description: tempDescription,
                duration: tempDuration,
                level: tempLevel,
                startDate: tempStartDate,
                enableChecklist: tempEnableChecklist,
                enableRanking: tempEnableRanking,
                imageUrl: tempImageUrl || null
            });
            setIsEditingBootcampModalOpen(false);
            router.refresh();
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
            router.refresh();
        } catch (error) {
            console.error(error);
        } finally {
            setIsActionLoading(false);
        }
    };

    // DRAG AND DROP HANDLERS
    const handleLessonDragStart = (lessonId: number) => {
        setDraggedLessonId(lessonId);
    };

    const handleLessonDragOver = (e: React.DragEvent, targetLessonId: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (draggedLessonId !== null && draggedLessonId !== targetLessonId) {
            setDragOverLessonId(targetLessonId);
        }
    };


    const handleLessonDrop = async (targetLessonId: number, moduleId: number) => {
        setDragOverLessonId(null);
        if (draggedLessonId === null || draggedLessonId === targetLessonId) return;

        const targetModule = localModules.find(m => m.id === moduleId);
        if (!targetModule) return;

        const newLessons = [...targetModule.lessons];
        const draggedLesson = newLessons.find(l => l.id === draggedLessonId);
        const targetLesson = newLessons.find(l => l.id === targetLessonId);
        if (!draggedLesson || !targetLesson) return;

        const draggedIndex = newLessons.findIndex(l => l.id === draggedLessonId);
        const targetIndex = newLessons.findIndex(l => l.id === targetLessonId);
        if (draggedIndex === -1 || targetIndex === -1) return;

        // Get block of dragged item if it's a subtitle (Separación)
        let blockToMove: Lesson[] = [];
        if (draggedLesson.type === 'subtitle') {
            let nextSubtitleIndex = newLessons.findIndex((l, idx) => idx > draggedIndex && l.type === 'subtitle');
            if (nextSubtitleIndex === -1) nextSubtitleIndex = newLessons.length;
            blockToMove = newLessons.slice(draggedIndex, nextSubtitleIndex);
        } else {
            blockToMove = [draggedLesson];
        }

        // If dropping on itself or its own children, do nothing
        if (blockToMove.some(bm => bm.id === targetLessonId)) return;

        // Filter out the dragged block
        const remainingLessons = newLessons.filter(l => !blockToMove.some(bm => bm.id === l.id));

        // Now find where to insert in remainingLessons
        let insertIndex = remainingLessons.findIndex(l => l.id === targetLessonId);
        if (insertIndex === -1) return;

        // If dragging downwards, we want to insert AFTER the target item's block/element
        if (draggedIndex < targetIndex) {
            if (targetLesson.type === 'subtitle') {
                // Find next subtitle index in remainingLessons to insert after target block
                let targetBlockEndIndex = remainingLessons.findIndex((l, idx) => idx > insertIndex && l.type === 'subtitle');
                if (targetBlockEndIndex === -1) targetBlockEndIndex = remainingLessons.length;
                insertIndex = targetBlockEndIndex;
            } else {
                insertIndex = insertIndex + 1;
            }
        }

        remainingLessons.splice(insertIndex, 0, ...blockToMove);

        // Update local state
        setLocalModules(prev => prev.map(m => 
            m.id === moduleId ? { ...m, lessons: remainingLessons } : m
        ));

        // Save to server
        try {
            const lessonOrders = remainingLessons.map((l, index) => ({ id: l.id, order: index }));
            await reorderLessons(bootcamp.id, lessonOrders);
            showToast('¡Orden de lecciones y separadores actualizado con éxito!');
        } catch (error) {
            console.error('Error reordering lessons:', error);
            // Fallback to original order if failed
            setLocalModules(modules);
            alert('Error al guardar el nuevo orden de las lecciones');
        } finally {
            setDraggedLessonId(null);
            setDragOverLessonId(null);
        }
    };

    const handleModuleDragStart = (moduleId: number) => {
        setDraggedModuleId(moduleId);
    };

    const handleModuleDragOver = (e: React.DragEvent, targetModuleId: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (draggedModuleId !== null && draggedModuleId !== targetModuleId) {
            setDragOverModuleId(targetModuleId);
        }
    };


    const handleModuleDrop = async (targetModuleId: number) => {
        setDragOverModuleId(null);
        if (draggedModuleId === null || draggedModuleId === targetModuleId) return;

        const newModules = [...localModules];
        const draggedIndex = newModules.findIndex(m => m.id === draggedModuleId);
        const targetIndex = newModules.findIndex(m => m.id === targetModuleId);

        if (draggedIndex === -1 || targetIndex === -1) return;

        // Reorder locally
        const [movedModule] = newModules.splice(draggedIndex, 1);
        newModules.splice(targetIndex, 0, movedModule);
        setLocalModules(newModules);

        // Save to server
        try {
            const moduleOrders = newModules.map((m, index) => ({ id: m.id, order: index }));
            await reorderModules(bootcamp.id, moduleOrders);
            showToast('¡Orden de módulos actualizado con éxito!');
        } catch (error) {
            console.error('Error reordering modules:', error);
            setLocalModules(modules);
            alert('Error al guardar el nuevo orden de los módulos');
        } finally {
            setDraggedModuleId(null);
            setDragOverModuleId(null);
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

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'audio' | 'pdf' | 'video') => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        const supabase = createClient();
        setIsUploading(true);

        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        let filePath = '';
        if (type === 'image') filePath = `article-covers/${fileName}`;
        else if (type === 'audio') filePath = `podcasts/${fileName}`;
        else if (type === 'pdf') filePath = `documents/${fileName}`;
        else if (type === 'video') filePath = `videos/${fileName}`;

        try {
            const { error: uploadError } = await supabase.storage
                .from('media') // Same bucket for all media types
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('media').getPublicUrl(filePath);
            setResourceContent(data.publicUrl);
        } catch (error) {
            console.error('Upload error:', error);
            alert(`Error subiendo el archivo. Asegúrate de tener configurado el bucket "media" en Supabase.`);
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

            <div className="space-y-4">
                {/* Title */}
                <div>
                    <label className="block text-sm font-medium mb-1.5">
                        {contentType === 'subtitle' ? 'Texto del Separador / Subtítulo' : 'Título de la lección'}
                    </label>
                    <input
                        type="text"
                        value={contentTitle}
                        onChange={(e) => setContentTitle(e.target.value)}
                        className={`w-full px-4 rounded-md bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none ${contentType === 'subtitle' ? 'py-3 text-lg font-semibold text-muted-foreground' : 'py-2'}`}
                        placeholder={contentType === 'subtitle' ? "Ej: Sección Práctica..." : "Ej: Conceptos Básicos"}
                        autoFocus
                    />
                </div>

                {/* Category Tabs */}
                {contentType !== 'subtitle' && (
                <div>
                    <label className="block text-sm font-medium mb-1.5">Tipo de contenido</label>
                    <div className="flex flex-wrap gap-2">
                        {[
                            { id: 'text' as const, label: 'Texto', icon: <FileText size={14} />, color: 'green' },
                            { id: 'video' as const, label: 'Video', icon: <MonitorPlay size={14} />, color: 'blue' },
                            { id: 'presentation' as const, label: 'Slides', icon: <Layout size={14} />, color: 'orange' },
                            { id: 'podcast' as const, label: 'Podcast', icon: <Headphones size={14} />, color: 'violet' },
                            { id: 'pdf' as const, label: 'PDF', icon: <FileUp size={14} />, color: 'red' },
                            { id: 'exam' as const, label: 'Quiz', icon: <Trophy size={14} />, color: 'yellow' },
                            { id: 'exam_formal' as const, label: 'Examen', icon: <BarChart3 size={14} />, color: 'emerald' },
                            { id: 'subtitle' as const, label: 'Subtítulo', icon: <ChevronDown size={14} />, color: 'slate' },
                        ].map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setContentType(cat.id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                    contentType === cat.id
                                        ? `bg-${cat.color}-500/10 text-${cat.color}-500 border-${cat.color}-500/30`
                                        : 'border-border text-muted hover:text-foreground hover:border-foreground/20 hover:bg-hover-bg'
                                }`}
                            >
                                {cat.icon}
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>
                )}
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
                                            onChange={(e) => handleFileUpload(e, 'image')}
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
                    {contentType === 'exam_formal' && (
                        <div className="flex flex-col items-center justify-center py-12 px-6 border border-dashed border-emerald-500/30 rounded-xl bg-emerald-500/5">
                            <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-500 mb-4">
                                <BarChart3 size={32} />
                            </div>
                            <h4 className="text-lg font-semibold text-foreground mb-2">Examen Formal</h4>
                            <p className="text-sm text-muted text-center max-w-sm mb-4">
                                Los exámenes formales con calificación, tiempo límite estricto y certificación están en desarrollo.
                            </p>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-semibold border border-emerald-500/20">
                                <Loader2 size={12} className="animate-spin" />
                                Pronto...
                            </span>
                        </div>
                    )}
                    {contentType !== 'text' && contentType !== 'exam_formal' && contentType !== 'subtitle' && (
                        <div>
                            {contentType === 'exam' ? (
                                <div className="space-y-6 border border-border rounded-lg p-6 bg-background/50">
                                    <div className="flex items-center gap-2 mb-4 text-primary">
                                        <Trophy size={20} />
                                        <h4 className="font-semibold">Constructor de Cuestionario</h4>
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
                                                    <div 
                                                        key={option.id} 
                                                        className="relative"
                                                        onDragOver={(e) => {
                                                            e.preventDefault();
                                                            if (draggedOptionId !== null && draggedOptionId !== option.id) {
                                                                setDragOverOptionId(option.id);
                                                            }
                                                        }}

                                                        onDrop={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setDragOverOptionId(null);
                                                            if (!draggedOptionId || draggedOptionId === option.id) return;
                                                            try {
                                                                const data = JSON.parse(e.dataTransfer.getData('application/json'));
                                                                if (data.questionId !== question.id) return;
                                                                
                                                                const draggedId = data.optionId;
                                                                const newQuestions = [...examQuestions];
                                                                const q = newQuestions.find(q => q.id === question.id);
                                                                if (!q) return;

                                                                const draggedIndex = q.options.findIndex(o => o.id === draggedId);
                                                                const dropIndex = q.options.findIndex(o => o.id === option.id);
                                                                
                                                                if (draggedIndex !== -1 && dropIndex !== -1) {
                                                                    const [draggedItem] = q.options.splice(draggedIndex, 1);
                                                                    q.options.splice(dropIndex, 0, draggedItem);
                                                                    setExamQuestions(newQuestions);
                                                                }
                                                            } catch (err) {}
                                                            setDraggedOptionId(null);
                                                        }}
                                                    >
                                                        {dragOverOptionId === option.id && (
                                                            <div className="h-10 border-2 border-dashed border-primary/50 bg-primary/5 rounded-md my-1 flex items-center justify-center transition-all animate-in fade-in zoom-in-95 pointer-events-none">
                                                                <span className="text-[10px] font-semibold text-primary/70">Mover alternativa aquí</span>
                                                            </div>
                                                        )}
                                                        <div 
                                                            className={`flex items-center gap-3 group transition-all p-1 rounded-md ${draggedOptionId === option.id ? 'opacity-50 ring-1 ring-primary/20 bg-primary/5' : 'hover:bg-hover-bg/30'}`}
                                                            draggable
                                                            onDragStart={(e) => {
                                                                e.stopPropagation();
                                                                setDraggedOptionId(option.id);
                                                                e.dataTransfer.setData('application/json', JSON.stringify({ questionId: question.id, optionId: option.id }));
                                                            }}
                                                            onDragEnd={() => {
                                                                setDraggedOptionId(null);
                                                                setDragOverOptionId(null);
                                                            }}
                                                        >
                                                            <div className="cursor-grab active:cursor-grabbing text-muted/30 hover:text-primary transition-colors">
                                                                <GripVertical size={14} />
                                                            </div>
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
                                    {(contentType === 'podcast' || contentType === 'pdf' || contentType === 'video') && (
                                        <div className="mb-6 p-4  rounded-xl bg-background">
                                            <label className="block text-sm font-semibold mb-3 flex items-center gap-2">
                                                <FileUp size={18} className="text-primary" />
                                                {contentType === 'podcast' ? 'Subir Podcast desde PC' : (contentType === 'video' ? 'Subir Video desde PC' : 'Subir PDF desde PC')}
                                            </label>
                                            
                                            <div className="flex flex-col gap-4">
                                                {resourceContent && (
                                                    <div className="flex items-center justify-between p-3 bg-card-bg border border-border rounded-lg group animate-in slide-in-from-top-2">
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                                                {contentType === 'podcast' ? <Headphones size={20} /> : (contentType === 'video' ? <MonitorPlay size={20} /> : <FileUp size={20} />)}
                                                            </div>
                                                            <div className="truncate">
                                                                <p className="text-sm font-medium truncate">{resourceContent.split('/').pop()}</p>
                                                                <p className="text-[10px] text-muted uppercase tracking-wider">Archivo subido correctamente</p>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={() => setResourceContent('')}
                                                            className="p-2 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                                            title="Eliminar archivo"
                                                        >
                                                            <X size={18} />
                                                        </button>
                                                    </div>
                                                )}

                                                <input
                                                    type="file"
                                                    accept={contentType === 'podcast' ? 'audio/*' : (contentType === 'video' ? 'video/*' : 'application/pdf')}
                                                    onChange={(e) => handleFileUpload(e, contentType === 'podcast' ? 'audio' : (contentType === 'video' ? 'video' : 'pdf'))}
                                                    className="hidden"
                                                    id="media-upload"
                                                    disabled={isUploading}
                                                />
                                                <label
                                                    htmlFor="media-upload"
                                                    className={`
                                                        relative flex flex-col items-center justify-center gap-3 px-4 py-8 
                                                        border-2 border-dashed border-border rounded-xl cursor-pointer 
                                                        hover:border-primary hover:bg-primary/5 transition-all group
                                                        ${isUploading ? 'opacity-50 cursor-not-allowed border-primary animate-pulse' : ''}
                                                        ${resourceContent ? 'hidden' : 'flex'}
                                                    `}
                                                >
                                                    {isUploading ? (
                                                        <div className="flex flex-col items-center gap-2">
                                                            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                                            <span className="text-sm font-medium text-primary">Subiendo recurso...</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="p-3 bg-muted rounded-full group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                                                <FileUp size={32} />
                                                            </div>
                                                            <div className="text-center">
                                                                <p className="text-sm font-semibold mb-1">Examinar en mi PC</p>
                                                                <p className="text-xs text-muted">
                                                                    {contentType === 'podcast' ? 'MP3, WAV, M4A' : (contentType === 'video' ? 'MP4, WEBM, OGG' : 'Solo archivos PDF')}
                                                                </p>
                                                            </div>
                                                        </>
                                                    )}
                                                </label>
                                            </div>
                                            
                                            <div className="flex items-center gap-3 my-4">
                                                <div className="h-px bg-border flex-1"></div>
                                                <span className="text-[10px] text-muted font-bold uppercase tracking-widest">o usa un enlace externo</span>
                                                <div className="h-px bg-border flex-1"></div>
                                            </div>
                                        </div>
                                    )}

                                    <label className="block text-sm font-medium mb-1.5">
                                        {contentType === 'pdf' ? 'URL del archivo PDF' : (contentType === 'video' ? 'URL del video' : 'URL del recurso')}
                                    </label>
                                    <input
                                        type="text"
                                        value={resourceContent}
                                        onChange={(e) => setResourceContent(e.target.value)}
                                        className="w-full px-4 py-2 rounded-md bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none"
                                        placeholder="https://..."
                                    />
                                    <p className="text-xs text-muted mt-1 mb-4">
                                        {contentType === 'podcast'
                                            ? 'Pega el enlace de Spotify, Soundcloud o archivo externo.'
                                            : contentType === 'video'
                                                ? 'Ingresa la URL del video alojado en Supabase, YouTube, Vimeo, Mux, etc.'
                                                : contentType === 'pdf'
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
                        <button
                            onClick={() => {
                                setActiveModuleForContent(null);
                                setEditingLessonId(null);
                                setContentType(null);
                                setContentTitle('');
                                setEditorContent('');
                                setResourceContent('');
                            }}
                            className="px-4 py-2 text-sm text-foreground hover:bg-hover-bg rounded-lg"
                        >
                            Cancelar
                        </button>
                        <button onClick={handleSaveContent} disabled={!contentTitle || (contentType !== 'exam' && contentType !== 'exam_formal' && contentType !== 'subtitle' && !editorContent)} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">
                            {editingLessonId ? 'Actualizar' : 'Guardar'}
                        </button>
                    </div>
                </div>
        </div>
    );

    // Process chart data based on active mode
    const chartData = (() => {
        if (completionsList.length === 0) {
            if (chartMode === 'day') {
                return ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(label => ({ label, value: 0 }));
            } else {
                return ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'].map(label => ({ label, value: 0 }));
            }
        }

        if (chartMode === 'day') {
            const daysOfWeekLabels = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
            const dayMapping = [6, 0, 1, 2, 3, 4, 5]; // Sunday=0 -> idx 6, Monday=1 -> idx 0, etc.
            const dayCounts = Array(7).fill(0);
            
            completionsList.forEach(c => {
                if (c.completedAt) {
                    const date = new Date(c.completedAt);
                    if (!isNaN(date.getTime())) {
                        const dayIndex = dayMapping[date.getDay()];
                        dayCounts[dayIndex]++;
                    }
                }
            });

            return daysOfWeekLabels.map((label, idx) => ({
                label,
                value: dayCounts[idx]
            }));
        } else {
            // Week mode
            let start = bootcamp.startDate ? new Date(bootcamp.startDate) : null;
            if (!start && completionsList.length > 0) {
                const dates = completionsList.map(c => new Date(c.completedAt).getTime()).filter(t => !isNaN(t));
                if (dates.length > 0) {
                    start = new Date(Math.min(...dates));
                }
            }
            if (!start) {
                start = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
            }
            
            start.setHours(0, 0, 0, 0);
            
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const numWeeks = Math.max(Math.ceil(diffDays / 7), 4); // show at least 4 weeks
            
            const weekCounts = Array(numWeeks).fill(0);
            completionsList.forEach(c => {
                if (c.completedAt) {
                    const date = new Date(c.completedAt);
                    if (!isNaN(date.getTime())) {
                        const msDiff = date.getTime() - start!.getTime();
                        const dayDiff = msDiff / (1000 * 60 * 60 * 24);
                        const weekIdx = Math.floor(dayDiff / 7);
                        if (weekIdx >= 0 && weekIdx < numWeeks) {
                            weekCounts[weekIdx]++;
                        }
                    }
                }
            });

            return weekCounts.map((value, idx) => ({
                label: `Semana ${idx + 1}`,
                value
            }));
        }
    })();

    // Compute SVG constants for line chart
    const svgWidth = 500;
    const svgHeight = 120;
    const svgPadding = { top: 15, right: 15, bottom: 25, left: 30 };
    const chartWidth = svgWidth - svgPadding.left - svgPadding.right;
    const chartHeight = svgHeight - svgPadding.top - svgPadding.bottom;
    const maxChartValue = Math.max(...chartData.map(d => d.value), 4);

    const chartPoints = chartData.map((d, index) => {
        const x = svgPadding.left + (index / (chartData.length - 1 || 1)) * chartWidth;
        const y = svgPadding.top + chartHeight - (d.value / maxChartValue) * chartHeight;
        return { x, y, label: d.label, value: d.value };
    });

    const chartGridLines = [0, 1, 2, 3].map(i => {
        const val = (maxChartValue / 3) * i;
        const y = svgPadding.top + chartHeight - (val / maxChartValue) * chartHeight;
        return { y, value: Math.round(val) };
    });

    let chartLineD = '';
    let chartAreaD = '';
    if (chartPoints.length > 0) {
        chartLineD = `M ${chartPoints[0].x} ${chartPoints[0].y}`;
        for (let i = 0; i < chartPoints.length - 1; i++) {
            const p0 = chartPoints[i];
            const p1 = chartPoints[i + 1];
            const cp1x = p0.x + (p1.x - p0.x) / 3;
            const cp1y = p0.y;
            const cp2x = p0.x + 2 * (p1.x - p0.x) / 3;
            const cp2y = p1.y;
            chartLineD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
        }
        chartAreaD = `${chartLineD} L ${chartPoints[chartPoints.length - 1].x} ${svgPadding.top + chartHeight} L ${chartPoints[0].x} ${svgPadding.top + chartHeight} Z`;
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Sidebar />

            <div className={`flex flex-col min-h-screen transition-all duration-300 ${isCollapsed ? 'ml-16' : 'ml-64'}`}>
                {/* Header */}
                <header className={`fixed top-0 right-0 z-1 h-[60px] bg-background border-b border-border flex items-center px-6 justify-between transition-all duration-300 ${isCollapsed ? 'left-16' : 'left-64'}`}>
                    <div className="flex items-center gap-2 text-sm text-muted">
                        <Link href="/cms" className="hover:text-foreground transition-colors">Bootcamp</Link>
                        <ChevronRight size={14} />
                        <span className="text-foreground font-medium">{bootcamp.title}</span>
                    </div>
                </header>

                <main className="flex-1 pt-[92px] px-6 pb-12">

                    <div className="max-w-5xl mx-auto">

                        {/* Title & Tabs */}
                        <div className="flex flex-col gap-6 mb-8">
                            <div className="flex flex-col sm:flex-row justify-between items-start gap-6 w-full">
                                <div className="flex gap-4 items-start relative w-full sm:w-auto">
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

                                    <div className="flex-1 max-w-2xl">

                                        <div
                                            className="group flex flex-col mb-1 cursor-pointer w-fit"
                                            onClick={() => {
                                                setTempBootcampTitle(bootcamp.title);
                                                setTempDescription(bootcamp.description || '');
                                                setTempDuration(bootcamp.duration || '');
                                                setTempLevel(bootcamp.level || '');
                                                setTempStartDate(bootcamp.startDate || '');
                                                setTempEnableChecklist(bootcamp.enableChecklist ?? true);
                                                setTempEnableRanking(bootcamp.enableRanking ?? true);
                                                setTempImageUrl(bootcamp.imageUrl || '');
                                                setIsEditingBootcampModalOpen(true);
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <h1 className="text-2xl font-semibold">{bootcamp.title}</h1>
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground p-1 rounded hover:bg-muted/10">
                                                    <Edit2 size={18} />
                                                </div>
                                            </div>
                                            <div 
                                                className="text-muted text-sm mt-1 prose prose-sm dark:prose-invert max-w-none line-clamp-3"
                                                dangerouslySetInnerHTML={{ __html: bootcamp.description || 'Gestiona el contenido y los alumnos de tu curso.' }}
                                            />
                                            {/* Detalles del curso */}
                                            {(bootcamp.duration || bootcamp.level || bootcamp.startDate) && (
                                                <div className="flex flex-wrap items-center gap-3 mt-3 text-xs font-medium text-muted-foreground group-hover:text-foreground/80 transition-colors">
                                                    {bootcamp.duration && (
                                                        <span className="flex items-center gap-1.5 bg-background/60 px-2.5 py-1 rounded-md border border-border/50">
                                                            <Clock size={14} className="text-primary/70" /> {bootcamp.duration}
                                                        </span>
                                                    )}
                                                    {bootcamp.level && (
                                                        <span className="flex items-center gap-1.5 bg-background/60 px-2.5 py-1 rounded-md border border-border/50">
                                                            <BarChart3 size={14} className="text-primary/70" /> {bootcamp.level}
                                                        </span>
                                                    )}
                                                    {bootcamp.startDate && (
                                                        <span className="flex items-center gap-1.5 bg-background/60 px-2.5 py-1 rounded-md border border-border/50">
                                                            <Calendar size={14} className="text-primary/70" /> {formatDateString(bootcamp.startDate)}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                    </div>
                                </div>
                                {activeTab === 'content' && (
                                    <button
                                        onClick={() => setIsCreatingModule(true)}
                                        className="flex items-center justify-center gap-2 px-4 py-2 w-full sm:w-auto bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 mt-2 sm:mt-0"
                                    >
                                        <Plus size={20} />
                                        <span>Nuevo módulo</span>
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
                                <button
                                    onClick={() => setActiveTab('ranking')}
                                    className={`pb-3 px-1 text-sm font-medium transition-all ${activeTab === 'ranking'
                                        ? 'text-primary border-b-2 border-primary'
                                        : 'text-muted hover:text-foreground'
                                        }`}
                                >
                                    Ranking
                                </button>
                                {/* TODO: Oculto temporalmente
                                <button
                                    onClick={() => setActiveTab('room')}
                                    className={`pb-3 px-1 text-sm font-medium transition-all ${activeTab === 'room'
                                        ? 'text-primary border-b-2 border-primary'
                                        : 'text-muted hover:text-foreground'
                                        }`}
                                >
                                    Room
                                </button>
                                */}
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

                                    {localModules.map((module) => {
                                        return (
                                            <div 
                                                key={module.id} 
                                                className="relative"
                                                onDragOver={(e) => handleModuleDragOver(e, module.id)}

                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    handleModuleDrop(module.id);
                                                }}
                                            >
                                                {dragOverModuleId === module.id && (
                                                    <div className="h-16 border-2 border-dashed border-primary/50 bg-primary/5 rounded-xl mb-4 flex items-center justify-center transition-all animate-in fade-in zoom-in-95 pointer-events-none">
                                                        <span className="text-xs font-semibold text-primary/70">Soltar módulo aquí</span>
                                                    </div>
                                                )}
                                                <div 
                                                    className={`border border-border/50 bg-card-bg/50 rounded-xl mb-4 shadow-sm transition-all ${draggedModuleId === module.id ? 'opacity-50 ring-2 ring-primary/20 scale-[0.99]' : 'hover:border-border'}`}
                                                    draggable
                                                    onDragStart={(e) => {
                                                        const target = e.target as HTMLElement;
                                                        if (target.closest('button') || target.closest('.lesson-item')) {
                                                            e.preventDefault();
                                                            return;
                                                        }
                                                        handleModuleDragStart(module.id);
                                                    }}
                                                    onDragEnd={() => {
                                                        setDraggedModuleId(null);
                                                        setDragOverModuleId(null);
                                                    }}
                                                >
                                                {/* Module Header */}
                                                <div
                                                    className={`flex items-center justify-between p-4 bg-card-bg hover:bg-hover-bg transition-colors cursor-pointer ${expandedModule === module.id ? 'rounded-t-xl' : 'rounded-xl'}`}
                                                    onClick={() => toggleModule(module.id)}
                                                >
                                                    <div className="flex items-center gap-3 flex-1 mr-4">
                                                        <div className="p-1.5 rounded-md bg-card text-primary flex-shrink-0 cursor-grab active:cursor-grabbing">
                                                            <GripVertical size={16} className="text-muted/50" />
                                                        </div>
                                                        <div className="p-1.5 rounded-md bg-card text-primary flex-shrink-0">
                                                            <BookOpen size={20} />
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
                                                        <div className="relative">
                                                            <button
                                                                className="p-1 hover:text-foreground transition-colors hover:bg-hover-bg rounded"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setOpenModuleMenuId(openModuleMenuId === module.id ? null : module.id);
                                                                }}
                                                            >
                                                                <MoreHorizontal size={20} />
                                                            </button>
                                                            {openModuleMenuId === module.id && (
                                                                <div
                                                                    ref={moduleMenuRef}
                                                                    className="absolute right-0 top-full mt-1 w-32 bg-card-bg border border-border rounded-lg shadow-lg z-[9999] py-1"
                                                                >
                                                                    <button
                                                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-hover-bg transition-colors"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setOpenModuleMenuId(null);
                                                                            setEditingModuleId(module.id);
                                                                            setEditingModuleTitle(module.title);
                                                                        }}
                                                                    >
                                                                        <Edit2 size={14} /> Editar
                                                                    </button>
                                                                    <button
                                                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-500/10 transition-colors"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setOpenModuleMenuId(null);
                                                                            openConfirmModal(
                                                                                'Eliminar Módulo',
                                                                                '¿Estás seguro de eliminar este módulo? Se borrarán todas las lecciones contenidas.',
                                                                                () => deleteModule(module.id, bootcamp.id)
                                                                            );
                                                                        }}
                                                                    >
                                                                        <Trash2 size={14} /> Borrar
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {expandedModule === module.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                </div>
                                            </div>

                                            {/* Module Content */}
                                            {expandedModule === module.id && (
                                                <div className="border-t border-border bg-background/50 p-4 rounded-b-xl">
                                                    <div className="space-y-4 mb-6">
                                                        {getGroupedLessons(module.lessons || []).map((group, gIndex) => (
                                                            <div key={group.subtitle?.id || `ungrouped-${gIndex}`} className="space-y-2">
                                                                {/* Separator Header */}
                                                                {group.subtitle && (
                                                                    <div 
                                                                        className="relative"
                                                                        onDragOver={(e) => handleLessonDragOver(e, group.subtitle!.id)}
                                                                        onDrop={(e) => {
                                                                            e.stopPropagation();
                                                                            handleLessonDrop(group.subtitle!.id, module.id);
                                                                        }}
                                                                    >
                                                                        {dragOverLessonId === group.subtitle.id && (
                                                                            <div className="h-12 border-2 border-dashed border-primary/50 bg-primary/5 rounded-xl my-2 flex items-center justify-center transition-all animate-in fade-in zoom-in-95 pointer-events-none">
                                                                                <span className="text-xs font-semibold text-primary/70">Soltar sección aquí</span>
                                                                            </div>
                                                                        )}
                                                                        <div 
                                                                            draggable
                                                                            onDragStart={(e) => {
                                                                                e.stopPropagation();
                                                                                handleLessonDragStart(group.subtitle!.id);
                                                                            }}
                                                                            onDragEnd={() => {
                                                                                setDraggedLessonId(null);
                                                                                setDragOverLessonId(null);
                                                                            }}
                                                                            className={`lesson-item transition-all ${draggedLessonId === group.subtitle.id ? 'border-primary/50 ring-1 ring-primary/20 bg-primary/5 opacity-50 scale-[0.99]' : ''}`}
                                                                        >
                                                                            {editingLessonId === group.subtitle.id ? (
                                                                                renderContentForm()
                                                                            ) : (
                                                                                <div className="flex items-center justify-between py-3 mt-4 mb-2 group px-2 border-b border-border/30">
                                                                                    <div className="flex items-center gap-4 flex-1">
                                                                                        <GripVertical size={16} className="text-muted/50 cursor-grab active:cursor-grabbing hover:text-primary transition-colors" />
                                                                                        <span className="text-sm font-bold text-muted/80 flex items-center gap-1.5">
                                                                                            <BookOpen size={16} className="text-muted/80" />
                                                                                            {group.subtitle.title}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                            <button
                                                                                                onClick={() => handleEditLesson(group.subtitle!, module.id)}
                                                                                                className="p-1.5 hover:bg-hover-bg rounded text-primary/70 hover:text-primary"
                                                                                            >
                                                                                                <Edit2 size={14}  />
                                                                                            </button>
                                                                                            <button
                                                                                                className="p-1.5 hover:bg-red-500/10 rounded text-primary/70 hover:text-red-500"
                                                                                                onClick={() => {
                                                                                                    openConfirmModal(
                                                                                                        'Eliminar Separador',
                                                                                                        '¿Estás seguro de eliminar este separador? Las lecciones contenidas no se borrarán, sino que pasarán a estar sin agrupación.',
                                                                                                        () => deleteLesson(group.subtitle!.id, bootcamp.id)
                                                                                                    );
                                                                                                }}
                                                                                            >
                                                                                                <Trash2 size={14} />
                                                                                            </button>
                                                                                        </div>
                                                                                        <button
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                toggleSeparator(group.subtitle!.id);
                                                                                            }}
                                                                                            className="p-1.5 hover:bg-hover-bg rounded text-muted hover:text-foreground transition-colors"
                                                                                            title={collapsedSeparators[group.subtitle.id] ? "Expandir" : "Colapsar"}
                                                                                        >
                                                                                            {collapsedSeparators[group.subtitle.id] ? (
                                                                                                <ChevronDown size={16} />
                                                                                            ) : (
                                                                                                <ChevronUp size={16} />
                                                                                            )}
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Children inside this Separator */}
                                                                {(!group.subtitle || !collapsedSeparators[group.subtitle.id]) && (
                                                                    <div className={group.subtitle ? "pl-6 border-l-2 border-dashed border-border/20 ml-4 space-y-2 mt-2 mb-4 animate-in fade-in slide-in-from-top-1 duration-200" : "space-y-2"}>
                                                                    {group.lessons.map((lesson) => (
                                                                        <div 
                                                                            key={lesson.id} 
                                                                            className="relative"
                                                                            onDragOver={(e) => handleLessonDragOver(e, lesson.id)}
                                                                            onDrop={(e) => {
                                                                                e.stopPropagation();
                                                                                handleLessonDrop(lesson.id, module.id);
                                                                            }}
                                                                        >
                                                                            {dragOverLessonId === lesson.id && (
                                                                                <div className="h-12 border-2 border-dashed border-primary/50 bg-primary/5 rounded-xl my-2 flex items-center justify-center transition-all animate-in fade-in zoom-in-95 pointer-events-none">
                                                                                    <span className="text-xs font-semibold text-primary/70">Soltar contenido aquí</span>
                                                                                </div>
                                                                            )}
                                                                            <div 
                                                                                draggable
                                                                                onDragStart={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleLessonDragStart(lesson.id);
                                                                                }}
                                                                                onDragEnd={() => {
                                                                                    setDraggedLessonId(null);
                                                                                    setDragOverLessonId(null);
                                                                                }}
                                                                                className={`lesson-item transition-all ${draggedLessonId === lesson.id ? 'border-primary/50 ring-1 ring-primary/20 bg-primary/5 opacity-50 scale-[0.99]' : ''}`}
                                                                            >
                                                                                {editingLessonId === lesson.id ? (
                                                                                    renderContentForm()
                                                                                ) : (
                                                                                    <div className="flex items-center justify-between p-3.5 bg-background border border-border/60 hover:border-border rounded-xl group transition-all shadow-sm">
                                                                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                                                                            <GripVertical size={16} className="text-muted/50 cursor-grab active:cursor-grabbing hover:text-primary transition-colors flex-shrink-0" />
                                                                                            <div className="p-1.5 rounded-md bg-secondary/30 text-muted flex-shrink-0">
                                                                                                {getLessonIcon(lesson.type)}
                                                                                            </div>
                                                                                            <span className="text-sm font-medium truncate">{lesson.title}</span>
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
                                                                        </div>
                                                                    ))}
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
                                                            <div className="flex gap-2 w-full mt-2">
                                                                <button
                                                                    onClick={() => { setActiveModuleForContent(module.id); setContentType('text'); }}
                                                                    className="flex-1 py-3 border border-dashed border-border rounded-lg text-sm text-muted hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
                                                                >
                                                                    <Plus size={16} />
                                                                    Agregar Contenido
                                                                </button>
                                                                <button
                                                                    onClick={() => { setActiveModuleForContent(module.id); setContentType('subtitle'); }}
                                                                    className="flex-1 py-3 border border-dashed border-border rounded-lg text-sm text-muted hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
                                                                >
                                                                    <Plus size={16} />
                                                                    Agregar Separación
                                                                </button>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                                </div>
                            </div>
                        )}

                        {/* STUDENTS TAB */}
                        {activeTab === 'students' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex flex-col gap-6 mb-8">
                                    <div className="w-full">
                                        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
                                            <div className="flex items-start md:items-center gap-3 flex-1">
                                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                                                    <Zap size={20} />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-sm text-primary mb-1">Acceso por enlace único</h3>
                                                    <p className="text-xs text-muted-foreground m-0 max-w-2xl">
                                                        Genera una URL exclusiva para una sola inscripción. Se autodestruye al ser utilizada. El alumno registrado requiere activación manual en la lista inferior.
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleGenerateUniqueLink}
                                                className="whitespace-nowrap flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 transition-colors shadow-md shadow-primary/20 w-full md:w-auto"
                                            >
                                                <Plus size={16} />
                                                <span>Generar invitación</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="w-full">
                                        <div className="bg-card-bg border border-border rounded-xl p-6 shadow-sm overflow-hidden">
                                            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                                                <Users size={20} className="text-primary" />
                                                Lista de alumnos
                                            </h3>

                                            {initialStudents.length === 0 ? (
                                                <div className="text-center py-12 text-muted">
                                                    <Users size={48} className="mx-auto mb-3 opacity-20" />
                                                    <p>Aún no has invitado a ningún alumno.</p>
                                                </div>
                                            ) : (
                                                <div className="w-full overflow-x-auto rounded-lg border border-border">
                                                    <table className="w-full text-sm text-left">
                                                        <thead className="bg-secondary/30 text-muted uppercase text-xs font-semibold">
                                                            <tr>
                                                                <th className="px-4 py-3">Alumno</th>
                                                                <th className="px-4 py-3">Estado</th>
                                                                <th className="px-4 py-3">Invitado</th>
                                                                <th className="px-4 py-3 text-right">Acciones</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-border">
                                                            {initialStudents.map((student) => {
                                                                const isOnline = Object.values(onlineUsers).some(
                                                                    (u: any) => u.email && student.email && u.email.trim().toLowerCase() === student.email.trim().toLowerCase()
                                                                );
                                                                const initials = student.email ? student.email.slice(0, 2).toUpperCase() : 'U';

                                                                return (
                                                                    <tr key={student.id} className="bg-card-bg hover:bg-hover-bg transition-colors">
                                                                        <td className="px-4 py-3 font-medium">
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="relative flex-shrink-0">
                                                                                    <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                                                                                        {initials}
                                                                                    </div>
                                                                                    <span 
                                                                                        className={`absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full border-2 border-card-bg transition-colors duration-300 ${
                                                                                            isOnline ? 'bg-green-500 shadow-sm shadow-green-500/50' : 'bg-neutral-600'
                                                                                        }`}
                                                                                        title={isOnline ? 'Activo ahora' : 'Desconectado'}
                                                                                    />
                                                                                </div>
                                                                                <span className="truncate">{student.email}</span>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-4 py-3">{getStatusBadge(student.status)}</td>
                                                                        <td className="px-4 py-3 text-muted">
                                                                        {new Date(student.invitedAt).toLocaleDateString()}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right relative">
                                                                        <div className="flex justify-end items-center gap-2">
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    if (openMenuId === student.id) {
                                                                                        setOpenMenuId(null);
                                                                                        setMenuPosition(null);
                                                                                    } else {
                                                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                                                        setOpenMenuId(student.id);
                                                                                        setMenuPosition({
                                                                                            top: rect.bottom + window.scrollY,
                                                                                            left: rect.right - 192 + window.scrollX
                                                                                        });
                                                                                    }
                                                                                }}
                                                                                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-muted hover:text-foreground transition-all"
                                                                            >
                                                                                {isActionLoading && openMenuId === student.id ? <Loader2 size={16} className="animate-spin text-primary" /> : <MoreHorizontal size={18} />}
                                                                            </button>

                                                                            {openMenuId === student.id && menuPosition && typeof document !== 'undefined' && createPortal(
                                                                                <div
                                                                                    ref={menuRef}
                                                                                    style={{
                                                                                        position: 'absolute',
                                                                                        top: `${menuPosition.top}px`,
                                                                                        left: `${menuPosition.left}px`,
                                                                                    }}
                                                                                    className="w-48 bg-card-bg/95 backdrop-blur-md border border-white/10 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] z-[99999] py-1.5 animate-in fade-in zoom-in-95 duration-200 text-left"
                                                                                >
                                                                                    <Link
                                                                                        href={`/cms/bootcamp/${bootcamp.id}/student/${student.id}`}
                                                                                        onClick={() => {
                                                                                            setOpenMenuId(null);
                                                                                            setMenuPosition(null);
                                                                                        }}
                                                                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-foreground hover:bg-white/5 transition-colors"
                                                                                    >
                                                                                        <BarChart3 size={14} className="text-primary" />
                                                                                        Ver progreso
                                                                                    </Link>

                                                                                    <button
                                                                                        onClick={() => {
                                                                                            setOpenMenuId(null);
                                                                                            setMenuPosition(null);
                                                                                            handleToggleStatus(student.id, student.status === 'active' ? 'invited' : 'active');
                                                                                        }}
                                                                                        className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs transition-colors ${student.status === 'active' ? 'text-amber-500 hover:bg-amber-500/10' : 'text-green-500 hover:bg-green-500/10'}`}
                                                                                    >
                                                                                        {student.status === 'active' ? (
                                                                                            <>
                                                                                                <X size={14} />
                                                                                                Desactivar alumno
                                                                                            </>
                                                                                        ) : (
                                                                                            <>
                                                                                                <Check size={14} />
                                                                                                Activar alumno
                                                                                            </>
                                                                                        )}
                                                                                    </button>

                                                                                    <button
                                                                                        onClick={() => {
                                                                                            setOpenMenuId(null);
                                                                                            setMenuPosition(null);
                                                                                            handleToggleStatus(student.id, student.status === 'frozen' ? 'active' : 'frozen');
                                                                                        }}
                                                                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-cyan-500 hover:bg-cyan-500/10 transition-colors"
                                                                                    >
                                                                                        <Snowflake size={14} />
                                                                                        {student.status === 'frozen' ? 'Descongelar alumno' : 'Congelar alumno'}
                                                                                    </button>

                                                                                    <div className="h-px bg-white/5 my-1" />

                                                                                    <button
                                                                                        onClick={() => {
                                                                                            setOpenMenuId(null);
                                                                                            setMenuPosition(null);
                                                                                            openConfirmModal(
                                                                                                'Eliminar Registro',
                                                                                                '¿Estás seguro de eliminar este registro? El alumno ya no podrá ingresar.',
                                                                                                () => removeStudent(student.id, bootcamp.id)
                                                                                            );
                                                                                        }}
                                                                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-red-500 hover:bg-red-500/10 transition-colors font-medium"
                                                                                    >
                                                                                        <Trash2 size={14} />
                                                                                        Borrar registro
                                                                                    </button>
                                                                                </div>,
                                                                                document.body
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </div>


                                </div>
                            </div>
                        )}

                        {/* ROOM TAB */}
                        {activeTab === 'room' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="relative flex flex-col items-center justify-center min-h-[400px] p-8 md:p-16 border border-dashed border-primary/20 rounded-2xl bg-card-bg/30 mt-8 overflow-hidden shadow-sm">
                                    <div className="absolute inset-0 z-0 flex items-center justify-center opacity-40 pointer-events-none mix-blend-luminosity">
                                        <img src="/room.svg" alt="Room background" className="w-full h-full object-cover md:object-contain" />
                                    </div>
                                    {/* Online students avatars */}
                                    <div className="absolute inset-0 z-10 overflow-hidden animate-in zoom-in-95 duration-500 pointer-events-auto">
                                        {/* If there are online students, show them */}
                                        {Object.values(onlineUsers).filter((u: any) => u.email).length > 0 ? (
                                            <>
                                                {initialStudents.filter((student) =>
                                                    Object.values(onlineUsers).some((u: any) =>
                                                        u.email && student.email && u.email.trim().toLowerCase() === student.email.trim().toLowerCase()
                                                    )
                                                ).map((student) => {
                                                    const initials = student.email ? student.email.slice(0, 2).toUpperCase() : 'U';
                                                    
                                                    // Función de hash simple para generar posiciones "random" pero consistentes por alumno
                                                    let hash = 0;
                                                    const str = student.email || student.id.toString();
                                                    for (let i = 0; i < str.length; i++) {
                                                        hash = str.charCodeAt(i) + ((hash << 5) - hash);
                                                    }
                                                    // Mantener el avatar alejado de los bordes (entre 15% y 85%)
                                                    const top = Math.abs(hash % 70) + 15;
                                                    const left = Math.abs((hash >> 5) % 70) + 15;

                                                    return (
                                                        <div key={student.id} 
                                                             className="absolute flex flex-col items-center animate-in zoom-in duration-300 group cursor-pointer"
                                                             style={{ top: `${top}%`, left: `${left}%`, transform: 'translate(-50%, -50%)' }}
                                                        >
                                                            <div className="h-16 w-16 rounded-full bg-background/80 backdrop-blur-md border border-primary/30 flex items-center justify-center text-sm font-bold text-primary shadow-2xl shadow-primary/20 hover:scale-110 hover:border-primary/60 transition-all">
                                                                {initials}
                                                            </div>
                                                            <span className="absolute bottom-1 right-1 block h-3.5 w-3.5 rounded-full border-2 border-background bg-green-500 shadow-sm shadow-green-500/50" />
                                                            
                                                            <div className="absolute top-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 backdrop-blur-sm text-xs font-medium px-3 py-1.5 rounded-lg border border-border shadow-lg pointer-events-none whitespace-nowrap z-20">
                                                                {student.email}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </>
                                        ) : (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                <div className="w-20 h-20 bg-background/80 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 border border-border shadow-xl shadow-black/5">
                                                    <MonitorPlay size={36} className="text-primary" />
                                                </div>
                                                <h3 className="text-2xl font-bold text-foreground mb-4">Salón de conocimientos</h3>
                                                <p className="text-muted-foreground text-center max-w-lg rounded-xl leading-relaxed">
                                                    Aún no has configurado ninguna sala virtual para este bootcamp. Aquí podrás gestionar las sesiones en vivo y reuniones con los estudiantes.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* RANKING TAB */}
                        {activeTab === 'ranking' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {isRankingLoading ? (
                                    <div className="flex flex-col items-center justify-center min-h-[350px]">
                                        <Loader2 size={36} className="animate-spin text-primary mb-4" />
                                        <p className="text-muted text-sm">Cargando tabla de posiciones...</p>
                                    </div>
                                ) : rankingData.length === 0 ? (
                                    <div className="relative flex flex-col items-center justify-center min-h-[400px] p-8 md:p-16 border border-dashed border-primary/20 rounded-2xl bg-card-bg/30 mt-6 overflow-hidden shadow-sm">
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                                        
                                        <div className="relative z-10 flex flex-col items-center max-w-lg text-center">
                                            <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-primary/5">
                                                <Trophy size={32} className="text-primary" />
                                            </div>
                                            
                                            <h3 className="text-2xl font-bold text-foreground mb-3 tracking-tight">Tabla de Posiciones</h3>
                                            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                                                Aún no hay alumnos inscritos en este bootcamp para mostrar en el ranking.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-6 space-y-6">
                                        {/* Chart Card */}
                                        <div className="bg-card-bg/40 border border-border/60 rounded-2xl p-6 shadow-xl relative overflow-hidden backdrop-blur-sm">
                                            {/* Glowing Background Effect */}
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none" />
                                            
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
                                                <div>
                                                    <h4 className="text-base font-bold text-foreground flex items-center gap-2">
                                                        <BarChart3 size={18} className="text-primary" />
                                                        <span>Frecuencia de lecturas</span>
                                                    </h4>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        Distribución de lecciones vistas en el bootcamp
                                                    </p>
                                                </div>

                                                {/* Generar URL Ranking Toggle and Button */}
                                                <div className="flex items-center gap-4 self-start sm:self-center bg-card-bg/25 border border-white/5 rounded-xl px-3.5 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-muted-foreground">Generar URL</span>
                                                        <button
                                                            type="button"
                                                            disabled={isActionLoading}
                                                            onClick={handleToggleRanking}
                                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                                                (bootcamp.enableRanking ?? true) ? 'bg-primary' : 'bg-white/10'
                                                            } ${isActionLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                        >
                                                            <span
                                                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                                                    (bootcamp.enableRanking ?? true) ? 'translate-x-4.5' : 'translate-x-1'
                                                                }`}
                                                            />
                                                        </button>
                                                    </div>

                                                    {(bootcamp.enableRanking ?? true) && (
                                                        <>
                                                            <div className="w-[1px] h-4 bg-white/10" />
                                                            <button
                                                                onClick={() => {
                                                                    const slug = bootcamp.title.toLowerCase()
                                                                        .replace(/[^a-z0-9]+/g, '-')
                                                                        .replace(/(^-|-$)/g, '');
                                                                    const url = `/ranking/${bootcamp.id}-${slug}`;
                                                                    window.open(url, '_blank');
                                                                }}
                                                                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-border/40 bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all duration-300 flex items-center gap-1"
                                                            >
                                                                <Trophy size={11} className="text-yellow-500" />
                                                                <span>Ver Ranking</span>
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Line Chart Canvas */}
                                            <div className="relative w-full">
                                                <svg 
                                                    viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
                                                    className="w-full h-auto aspect-[500/120] overflow-visible"
                                                >
                                                    <defs>
                                                        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                                                            <stop offset="0%" stopColor="#06b6d4" />
                                                            <stop offset="50%" stopColor="#10b981" />
                                                            <stop offset="100%" stopColor="#eab308" />
                                                        </linearGradient>
                                                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
                                                            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                                                        </linearGradient>
                                                        <filter id="lineShadow" x="-5%" y="-5%" width="110%" height="110%">
                                                            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#06b6d4" floodOpacity="0.2" />
                                                        </filter>
                                                    </defs>

                                                    {/* Grid lines */}
                                                    {chartGridLines.map((line, idx) => (
                                                        <g key={idx} className="opacity-60">
                                                            <line 
                                                                x1={svgPadding.left} 
                                                                y1={line.y} 
                                                                x2={svgWidth - svgPadding.right} 
                                                                y2={line.y} 
                                                                stroke="rgba(255,255,255,0.06)" 
                                                                strokeWidth="1"
                                                            />
                                                            <text 
                                                                x={svgPadding.left - 5} 
                                                                y={line.y + 3} 
                                                                fill="rgba(255,255,255,0.35)" 
                                                                fontSize="8" 
                                                                textAnchor="end"
                                                                className="font-mono text-[5px]"
                                                            >
                                                                {line.value}
                                                            </text>
                                                        </g>
                                                    ))}

                                                    {/* Chart Area and Line */}
                                                    {chartPoints.length > 0 && (
                                                        <>
                                                            <path d={chartAreaD} fill="url(#areaGrad)" />
                                                            <path 
                                                                d={chartLineD} 
                                                                stroke="url(#lineGrad)" 
                                                                strokeWidth="2.5" 
                                                                fill="none" 
                                                                filter="url(#lineShadow)" 
                                                                strokeLinecap="round" 
                                                            />
                                                        </>
                                                    )}

                                                    {/* X Axis Labels */}
                                                    {chartPoints.map((pt, idx) => (
                                                        <text 
                                                            key={idx}
                                                            x={pt.x}
                                                            y={svgHeight - 4}
                                                            fill="rgba(255,255,255,0.35)"
                                                            fontSize="8"
                                                            textAnchor="middle"
                                                            className="font-semibold text-[5px]"
                                                        >
                                                            {chartMode === 'day' ? pt.label.slice(0, 3) : pt.label}
                                                        </text>
                                                    ))}

                                                    {/* Interactive Dotted Line and Glowing Points on Hover */}
                                                    {hoveredPointIndex !== null && chartPoints[hoveredPointIndex] && (
                                                        <g>
                                                            <line 
                                                                x1={chartPoints[hoveredPointIndex].x} 
                                                                y1={svgPadding.top} 
                                                                x2={chartPoints[hoveredPointIndex].x} 
                                                                y2={svgPadding.top + chartHeight} 
                                                                stroke="rgba(255,255,255,0.18)" 
                                                                strokeDasharray="3 3" 
                                                                strokeWidth="1.2"
                                                                className="pointer-events-none"
                                                            />
                                                            <circle 
                                                                cx={chartPoints[hoveredPointIndex].x} 
                                                                cy={chartPoints[hoveredPointIndex].y} 
                                                                r="6" 
                                                                fill="#10b981" 
                                                                opacity="0.35"
                                                                className="pointer-events-none"
                                                            />
                                                            <circle 
                                                                cx={chartPoints[hoveredPointIndex].x} 
                                                                cy={chartPoints[hoveredPointIndex].y} 
                                                                r="3" 
                                                                fill="#ffffff" 
                                                                stroke="#10b981"
                                                                strokeWidth="1.5"
                                                                className="pointer-events-none"
                                                            />
                                                        </g>
                                                    )}

                                                    {/* Hover Interaction Areas */}
                                                    {chartPoints.map((pt, idx) => {
                                                        const xStart = idx === 0 
                                                            ? svgPadding.left 
                                                            : pt.x - (pt.x - chartPoints[idx - 1].x) / 2;
                                                        const xEnd = idx === chartPoints.length - 1 
                                                            ? svgWidth - svgPadding.right 
                                                            : pt.x + (chartPoints[idx + 1].x - pt.x) / 2;
                                                        const rectWidth = xEnd - xStart;

                                                        return (
                                                            <rect
                                                                key={idx}
                                                                x={xStart}
                                                                y={svgPadding.top}
                                                                width={rectWidth}
                                                                height={chartHeight}
                                                                fill="transparent"
                                                                className="cursor-pointer"
                                                                onMouseEnter={() => setHoveredPointIndex(idx)}
                                                                onMouseLeave={() => setHoveredPointIndex(null)}
                                                            />
                                                        );
                                                    })}
                                                </svg>

                                                {/* Floating Tooltip */}
                                                {hoveredPointIndex !== null && chartPoints[hoveredPointIndex] && (
                                                    <div 
                                                        className="absolute bg-background/95 backdrop-blur-md border border-border/80 px-3 py-2 rounded-lg shadow-xl pointer-events-none z-30 flex flex-col text-[11px] transition-all duration-150 animate-in fade-in zoom-in-95"
                                                        style={{
                                                            left: `${(chartPoints[hoveredPointIndex].x / svgWidth) * 100}%`,
                                                            top: `${(chartPoints[hoveredPointIndex].y / svgHeight) * 100 - 15}%`,
                                                            transform: 'translate(-50%, -100%)'
                                                        }}
                                                    >
                                                        <span className="font-semibold text-foreground">{chartPoints[hoveredPointIndex].label}</span>
                                                        <span className="text-primary font-bold mt-0.5">
                                                            {chartPoints[hoveredPointIndex].value} {chartPoints[hoveredPointIndex].value === 1 ? 'lectura' : 'lecturas'}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center mb-4 px-2">
                                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                                <Trophy size={20} className="text-primary" />
                                                <span>Tabla de posiciones</span>
                                            </h3>
                                            <span className="text-xs text-muted-foreground bg-secondary/30 px-3 py-1 rounded-full border border-border/40 font-medium">
                                                Total alumnos: {rankingData.length}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3">
                                            {rankingData.map((item, index) => {
                                                const { student, points } = item;
                                                const totalLessons = modules.flatMap(m => m.lessons || []).length;
                                                const progressPercentage = totalLessons > 0 ? Math.round((points / totalLessons) * 100) : 0;
                                                const isOnline = Object.values(onlineUsers).some(
                                                    (u: any) => u.email && student.email && u.email.trim().toLowerCase() === student.email.trim().toLowerCase()
                                                );
                                                const name = student.email ? student.email.split('@')[0] : 'Alumno';
                                                const initials = student.email ? student.email.slice(0, 2).toUpperCase() : 'U';

                                                // Top 3 styles
                                                const isTop3 = index < 3;
                                                const podiumStyles = [
                                                    { bg: 'bg-yellow-500/10 border-yellow-500/30 hover:border-yellow-500/50 shadow-yellow-500/5', label: '🥇 1er Lugar' },
                                                    { bg: 'bg-slate-400/10 border-slate-400/30 hover:border-slate-400/50 shadow-slate-400/5', label: '🥈 2do Lugar' },
                                                    { bg: 'bg-amber-700/10 border-amber-700/30 hover:border-amber-700/50 shadow-amber-700/5', label: '🥉 3er Lugar' }
                                                ];

                                                const currentPodium = isTop3 ? podiumStyles[index] : null;

                                                return (
                                                    <div 
                                                        key={student.id} 
                                                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-all duration-300 ${
                                                            currentPodium 
                                                                ? `${currentPodium.bg} shadow-md` 
                                                                : 'bg-card-bg/40 border-border hover:border-foreground/20'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                                            {/* Posición / Rank index */}
                                                            <div className="flex items-center justify-center w-8 shrink-0">
                                                                {isTop3 ? (
                                                                    <span className="text-xl font-bold select-none">{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>
                                                                ) : (
                                                                    <span className="text-sm font-semibold text-muted select-none">#{index + 1}</span>
                                                                )}
                                                            </div>

                                                            {/* Avatar */}
                                                            <div className="relative shrink-0">
                                                                <div className={`h-11 w-11 rounded-full flex items-center justify-center font-bold text-sm shadow-inner transition-colors ${
                                                                    index === 0 
                                                                        ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' 
                                                                        : index === 1 
                                                                            ? 'bg-slate-400/20 text-slate-300 border border-slate-400/30' 
                                                                            : index === 2 
                                                                                ? 'bg-amber-700/20 text-amber-500 border border-amber-700/30' 
                                                                                : 'bg-primary/10 text-primary border border-primary/20'
                                                                }`}>
                                                                    {initials}
                                                                </div>
                                                                <span 
                                                                    className={`absolute bottom-0 right-0 block h-3 w-3 rounded-full border-2 transition-colors duration-300 ${
                                                                        currentPodium ? 'border-card-bg' : 'border-card'
                                                                    } ${
                                                                        isOnline ? 'bg-green-500 shadow-sm shadow-green-500/50' : 'bg-neutral-600'
                                                                    }`}
                                                                    title={isOnline ? 'Activo ahora' : 'Desconectado'}
                                                                />
                                                            </div>

                                                            {/* Nombre y correo */}
                                                            <div className="flex flex-col min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-semibold text-sm text-foreground truncate capitalize">
                                                                        {name}
                                                                    </span>
                                                                    {currentPodium && (
                                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-background/60 border border-border/40 uppercase tracking-wider scale-90">
                                                                            {currentPodium.label}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="text-xs text-muted-foreground truncate">
                                                                    {student.email}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Puntos y Progreso */}
                                                        <div className="flex items-center gap-6 mt-4 sm:mt-0 shrink-0 pl-12 sm:pl-0">
                                                            {/* Progreso bar & fraction */}
                                                            <div className="flex flex-col items-end text-right">
                                                                <span className="text-xs text-muted-foreground font-medium mb-1">
                                                                    {points} de {totalLessons} lecciones
                                                                </span>
                                                                <div className="w-24 h-1.5 bg-neutral-800 rounded-full overflow-hidden border border-border/20">
                                                                    <div 
                                                                        className={`h-full rounded-full transition-all duration-1000 ${
                                                                            index === 0 
                                                                                ? 'bg-yellow-500' 
                                                                                : index === 1 
                                                                                    ? 'bg-slate-300' 
                                                                                    : index === 2 
                                                                                        ? 'bg-amber-600' 
                                                                                        : 'bg-primary'
                                                                        }`}
                                                                        style={{ width: `${progressPercentage}%` }}
                                                                    />
                                                                </div>
                                                            </div>

                                                            {/* Puntos de Clasificación Badge */}
                                                            <div className={`h-12 w-20 rounded-xl flex flex-col items-center justify-center border font-bold select-none ${
                                                                index === 0 
                                                                    ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-500' 
                                                                    : index === 1 
                                                                        ? 'bg-slate-400/20 border-slate-400/40 text-slate-300' 
                                                                        : index === 2 
                                                                            ? 'bg-amber-700/20 border-amber-700/40 text-amber-500' 
                                                                            : 'bg-secondary/40 border-border text-foreground'
                                                            }`}>
                                                                <span className="text-lg leading-none">{points}</span>
                                                                <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">pts</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
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
                hideCancel={modalConfig.hideCancel}
                isLoading={isActionLoading}
            />

            {/* Edit Bootcamp Info Drawer */}
            {isEditingBootcampModalOpen && (
                <div className="fixed inset-0 z-[100] flex justify-end">
                    {/* Backdrop */}
                    <div 
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-500"
                        onClick={() => setIsEditingBootcampModalOpen(false)}
                    />
                    
                    {/* Drawer Content */}
                    <div className="relative w-full max-w-lg h-full bg-card-bg border-l border-border shadow-2xl animate-in slide-in-from-right duration-500 ease-out flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-border bg-background/50">
                            <h2 className="text-xl font-bold text-foreground">Editar Información</h2>
                            <button 
                                onClick={() => setIsEditingBootcampModalOpen(false)}
                                className="p-2 text-muted hover:text-foreground hover:bg-hover-bg rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-medium mb-1.5 text-foreground">Título</label>
                                <input
                                    type="text"
                                    value={tempBootcampTitle}
                                    onChange={(e) => setTempBootcampTitle(e.target.value)}
                                    className="w-full px-4 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-foreground"
                                    placeholder="Ej: Full Stack Development"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium mb-1.5 text-foreground">Descripción</label>
                                <RichTextEditor
                                    value={tempDescription}
                                    onChange={(val) => setTempDescription(val)}
                                    minHeight="min-h-[200px]"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                <div>
                                    <label className="block text-sm font-medium mb-1.5 text-foreground">Duración</label>
                                    <input
                                        type="text"
                                        value={tempDuration}
                                        onChange={(e) => setTempDuration(e.target.value)}
                                        className="w-full px-4 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-foreground"
                                        placeholder="Ej: 12 semanas"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5 text-foreground">Nivel</label>
                                    <input
                                        type="text"
                                        value={tempLevel}
                                        onChange={(e) => setTempLevel(e.target.value)}
                                        className="w-full px-4 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-foreground"
                                        placeholder="Principiante"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5 text-foreground">Fecha de Inicio</label>
                                    <input
                                        type="date"
                                        value={tempStartDate}
                                        onChange={(e) => setTempStartDate(e.target.value)}
                                        className="w-full px-4 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-foreground"
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <label className="block text-sm font-medium mb-1.5 text-foreground">Habilitar Checklist</label>
                                    <div className="flex items-center gap-3 h-[42px]">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setTempEnableChecklist(!tempEnableChecklist);
                                            }}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                tempEnableChecklist ? 'bg-primary' : 'bg-border'
                                            }`}
                                        >
                                            <span className="sr-only">Habilitar Checklist</span>
                                            <span
                                                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                                    tempEnableChecklist ? 'translate-x-5' : 'translate-x-1'
                                                }`}
                                            />
                                        </button>
                                        <span className="text-sm text-muted">
                                            {tempEnableChecklist ? 'Habilitado' : 'Deshabilitado'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-border/50">
                                <label className="block text-sm font-medium mb-3 text-foreground font-semibold">Imagen de Portada (Opcional)</label>
                                {tempImageUrl ? (
                                    <div className="relative w-full h-44 rounded-lg overflow-hidden border border-border">
                                        <img
                                            src={tempImageUrl}
                                            alt="Cover preview"
                                            className="w-full h-full object-cover"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setTempImageUrl('')}
                                            className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleCoverImageUpload}
                                            className="hidden"
                                            id="cover-upload-edit"
                                            disabled={isUploadingCover}
                                        />
                                        <label
                                            htmlFor="cover-upload-edit"
                                            className={`flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all ${
                                                isUploadingCover ? 'opacity-50 cursor-not-allowed' : ''
                                            }`}
                                        >
                                            {isUploadingCover ? (
                                                <>
                                                    <Loader2 size={24} className="text-primary animate-spin" />
                                                    <span className="text-sm text-muted">Subiendo portada...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Upload size={24} className="text-muted" />
                                                    <div className="text-center">
                                                        <p className="text-sm font-medium text-foreground">Subir imagen de portada</p>
                                                        <p className="text-xs text-muted mt-1">PNG, JPG o WEBP</p>
                                                    </div>
                                                </>
                                            )}
                                        </label>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-6 border-t border-border bg-background/50 mt-auto flex items-center justify-end gap-3">
                            <button
                                onClick={() => setIsEditingBootcampModalOpen(false)}
                                className="px-5 py-2 text-sm font-medium text-muted hover:text-foreground bg-transparent hover:bg-hover-bg rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleUpdateBootcampInfo}
                                disabled={isActionLoading || !tempBootcampTitle.trim()}
                                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isActionLoading && <Loader2 size={16} className="animate-spin" />}
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Premium Toast Notification */}
            {toast?.show && (
                <div className="fixed bottom-8 right-8 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="bg-emerald-500 text-white rounded-xl shadow-2xl shadow-emerald-500/20 py-4 px-6 border border-white/20 flex items-center gap-4 min-w-[320px]">
                        <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 animate-pulse">
                            <Check size={20} className="text-white" />
                        </div>
                        <div className="flex-1">
                            <p className="font-bold text-sm">Operación Exitosa</p>
                            <p className="text-xs opacity-90 leading-relaxed mt-0.5 whitespace-pre-line">{toast?.message}</p>
                        </div>
                        <button
                            onClick={() => setToast(null)}
                            className="p-1 hover:bg-white/10 rounded-md transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
