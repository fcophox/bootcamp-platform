'use client';

import { useState } from 'react';
import { BootcampCard } from '@/components/bootcamp-card';
import { Sidebar } from '@/components/sidebar';
import { useSidebar } from '@/components/sidebar-context';
import { RichTextEditor } from '@/components/rich-text-editor';
import { ChevronRight, Code, Database, Layout, Globe, Server, Cloud, Cpu, Smartphone, Bot, BrainCircuit, Sparkles, Network, Terminal, Microscope, Rocket, Binary, Upload, X, Loader2 } from 'lucide-react';
import { createBootcamp } from '@/app/actions/bootcamp';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { formatDateString } from '@/utils/date';

// Map of icon names to components
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, any> = {
    code: Code,
    database: Database,
    layout: Layout,
    globe: Globe,
    server: Server,
    cloud: Cloud,
    cpu: Cpu,
    smartphone: Smartphone,
    bot: Bot,
    brain: BrainCircuit,
    sparkles: Sparkles,
    network: Network,
    terminal: Terminal,
    microscope: Microscope,
    rocket: Rocket,
    binary: Binary
};

// Map of colors
const COLORS = [
    { name: 'green', class: 'bg-green-500', text: 'text-green-500' },
    { name: 'blue', class: 'bg-blue-500', text: 'text-blue-500' },
    { name: 'violet', class: 'bg-violet-500', text: 'text-violet-500' },
    { name: 'orange', class: 'bg-orange-500', text: 'text-orange-500' },
    { name: 'red', class: 'bg-red-500', text: 'text-red-500' },
    { name: 'pink', class: 'bg-pink-500', text: 'text-pink-500' }
];

export default function CreateBootcampPage() {
    const { isCollapsed } = useSidebar();

    // State for the form
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        duration: '',
        level: 'Principiante',
        startDate: '',
        students: 0,
        icon: 'code',
        color: 'green',
        enableChecklist: true
    });

    const [isUploading, setIsUploading] = useState(false);
    const [imageUrl, setImageUrl] = useState('');

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        
        setIsUploading(true);
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
            setImageUrl(data.publicUrl);
        } catch (error) {
            console.error('Upload error:', error);
            alert('Error al subir la imagen. Asegúrate de tener configurado el bucket "media" en Supabase.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleIconSelect = (iconKey: string) => {
        setFormData(prev => ({ ...prev, icon: iconKey }));
    };

    const handleColorSelect = (colorName: string) => {
        setFormData(prev => ({ ...prev, color: colorName }));
    };


    return (
        <div className="min-h-screen bg-background text-foreground">
            <Sidebar />

            <div className={`flex flex-col min-h-screen transition-all duration-300 ${isCollapsed ? 'ml-16' : 'ml-64'}`}>
                {/* Header */}
                <header className={`fixed top-0 right-0 z-1 h-[60px] bg-background border-b border-border transition-all duration-300 flex items-center px-6 justify-between ${isCollapsed ? 'left-16' : 'left-64'}`}>
                    <div className="flex items-center gap-2 text-sm text-muted">
                        <Link href="/cms" className="hover:text-foreground transition-colors">Bootcamp</Link>                        <ChevronRight size={14} />
                        <span className="text-foreground font-medium">Crear Nuevo</span>
                    </div>
                </header>

                <main className="flex-1 pt-[92px] px-6 pb-12">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex flex-col lg:flex-row gap-8 items-start">

                            {/* Left Column: Form */}
                            <div className="flex-1 w-full space-y-6">
                                <div>
                                    <h1 className="text-2xl font-semibold mb-2">Crear Nuevo Bootcamp</h1>
                                    <p className="text-muted">Completa la información del curso para publicarlo.</p>
                                </div>

                                <form action={createBootcamp} className="space-y-6">
                                    <input type="hidden" name="icon" value={formData.icon} />
                                    <input type="hidden" name="color" value={formData.color} />
                                    <input type="hidden" name="imageUrl" value={imageUrl} />

                                    <div className="space-y-6 bg-card-bg p-6 rounded-lg border border-border">
                                        <h2 className="text-sm font-medium border-b border-border pb-4 mb-4">Información General</h2>

                                        <div className="space-y-4">
                                            <div>
                                                <label htmlFor="title" className="block text-sm font-medium mb-1.5">Título del Bootcamp</label>
                                                <input
                                                    type="text"
                                                    id="title"
                                                    name="title"
                                                    value={formData.title}
                                                    onChange={handleInputChange}
                                                    className="w-full px-4 py-2 rounded-md bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                                                    placeholder="Ej: Full Stack Python"
                                                />
                                            </div>

                                            <div>
                                                <label htmlFor="description" className="block text-sm font-medium mb-1.5">Descripción</label>
                                                <RichTextEditor
                                                    value={formData.description}
                                                    onChange={(val) => setFormData(prev => ({ ...prev, description: val }))}
                                                    minHeight="min-h-[280px]"
                                                />
                                                <input type="hidden" name="description" value={formData.description} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-6 bg-card-bg p-6 rounded-lg border border-border">
                                        <h2 className="text-sm font-medium border-b border-border pb-4 mb-4">Apariencia</h2>

                                        <div>
                                            <label className="block text-sm font-medium mb-3">Icono Representativo</label>
                                            <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                                                {Object.entries(ICON_MAP).map(([key, Icon]) => (
                                                    <button
                                                        key={key}
                                                        type="button"
                                                        onClick={() => handleIconSelect(key)}
                                                        className={`p-3 rounded-lg border flex items-center justify-center transition-all ${formData.icon === key
                                                            ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                                                            : 'border-border hover:border-foreground/50 text-muted hover:text-foreground'
                                                            }`}
                                                    >
                                                        <Icon size={20} />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-3">Color del Tema</label>
                                            <div className="flex flex-wrap gap-4">
                                                {COLORS.map((color) => (
                                                    <button
                                                        key={color.name}
                                                        type="button"
                                                        onClick={() => handleColorSelect(color.name)}
                                                        className={`w-10 h-10 rounded-full cursor-pointer transition-transform ${color.class} ${formData.color === color.name ? 'ring-4 ring-offset-2 ring-offset-card-bg scale-110' : 'hover:scale-105 opacity-80 hover:opacity-100'
                                                            }`}
                                                        style={{ boxShadow: formData.color === color.name ? `0 0 0 2px var(--background), 0 0 0 4px currentColor` : 'none' }}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-border/50">
                                            <label className="block text-sm font-medium mb-3">Imagen de Portada (Opcional)</label>
                                            {imageUrl ? (
                                                <div className="relative w-full h-44 rounded-lg overflow-hidden border border-border">
                                                    <img
                                                        src={imageUrl}
                                                        alt="Cover preview"
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setImageUrl('')}
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
                                                        onChange={handleImageUpload}
                                                        className="hidden"
                                                        id="cover-upload"
                                                        disabled={isUploading}
                                                    />
                                                    <label
                                                        htmlFor="cover-upload"
                                                        className={`flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all ${
                                                            isUploading ? 'opacity-50 cursor-not-allowed' : ''
                                                        }`}
                                                    >
                                                        {isUploading ? (
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

                                    <div className="space-y-6 bg-card-bg p-6 rounded-lg border border-border">
                                        <h2 className="text-sm font-medium border-b border-border pb-4 mb-4">Detalles del Curso</h2>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label htmlFor="duration" className="block text-sm font-medium mb-1.5">Duración</label>
                                                <input
                                                    type="text"
                                                    id="duration"
                                                    name="duration"
                                                    value={formData.duration}
                                                    onChange={handleInputChange}
                                                    className="w-full px-4 py-2 rounded-md bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                                                    placeholder="Ej: 12 semanas"
                                                />
                                            </div>

                                            <div>
                                                <label htmlFor="level" className="block text-sm font-medium mb-1.5">Nivel</label>
                                                <select
                                                    id="level"
                                                    name="level"
                                                    value={formData.level}
                                                    onChange={handleInputChange}
                                                    className="w-full px-4 py-2 rounded-md bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none appearance-none"
                                                >
                                                    <option value="Principiante">Principiante</option>
                                                    <option value="Intermedio">Intermedio</option>
                                                    <option value="Avanzado">Avanzado</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label htmlFor="startDate" className="block text-sm font-medium mb-1.5">Fecha de Inicio</label>
                                                <input
                                                    type="date"
                                                    id="startDate"
                                                    name="startDate"
                                                    value={formData.startDate}
                                                    onChange={handleInputChange}
                                                    className="w-full px-4 py-2 rounded-md bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                                                />
                                            </div>
                                            <div className="flex flex-col">
                                                <label className="block text-sm font-medium mb-1.5">Habilitar Checklist</label>
                                                <div className="flex items-center gap-3 h-[42px]">
                                                    <input type="hidden" name="enableChecklist" value={formData.enableChecklist ? 'true' : 'false'} />
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setFormData(prev => ({ ...prev, enableChecklist: !prev.enableChecklist }));
                                                        }}
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                            formData.enableChecklist ? 'bg-primary' : 'bg-border'
                                                        }`}
                                                    >
                                                        <span className="sr-only">Habilitar Checklist</span>
                                                        <span
                                                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                                                formData.enableChecklist ? 'translate-x-5' : 'translate-x-1'
                                                            }`}
                                                        />
                                                    </button>
                                                    <span className="text-sm text-muted">
                                                        {formData.enableChecklist ? 'Habilitado' : 'Deshabilitado'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 pt-4">
                                        <button type="submit" className="px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors">
                                            Crear Bootcamp
                                        </button>
                                        <button type="button" className="px-6 py-2.5 bg-transparent border border-border text-foreground font-medium rounded-lg hover:bg-hover-bg transition-colors">
                                            Cancelar
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* Right Column: Live Preview */}
                            <div className="w-full lg:w-[380px] flex-shrink-0">
                                <div className="sticky top-[92px]">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                        <span className="text-sm font-medium text-muted">Vista Previa en Vivo</span>
                                    </div>

                                    {/* The Preview Card */}
                                    <BootcampCard
                                        id={0} // Preview ID
                                        title={formData.title || 'Título del Bootcamp'}
                                        description={formData.description || 'Descripción del bootcamp...'}
                                        duration={formData.duration || '--'}
                                        level={formData.level}
                                        students={formData.students}
                                        startDate={formatDateString(formData.startDate) || '--'}
                                        className="bg-card-bg shadow-xl"
                                        icon={formData.icon}
                                        color={formData.color}
                                        imageUrl={imageUrl || undefined}
                                    />

                                    <div className="mt-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm text-blue-400">
                                        <p>Esta tarjeta es exactamente como la verán los estudiantes en el dashboard.</p>
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
