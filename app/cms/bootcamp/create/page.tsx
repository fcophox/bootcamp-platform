'use client';

import { useState } from 'react';
import { BootcampCard } from '@/components/bootcamp-card';
import { Sidebar } from '@/components/sidebar';
import { useSidebar } from '@/components/sidebar-context';
import { ChevronRight, Code, Database, Layout, Globe, Server, Cloud, Cpu, Smartphone } from 'lucide-react';
import { createBootcamp } from '@/app/actions/bootcamp';

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
    smartphone: Smartphone
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
        color: 'green'
    });

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
                <header className={`fixed top-0 right-0 z-10 h-[60px] bg-background border-b border-border transition-all duration-300 flex items-center px-6 justify-between ${isCollapsed ? 'left-16' : 'left-64'}`}>
                    <div className="flex items-center gap-2 text-sm text-muted">
                        <span>CMS</span>
                        <ChevronRight size={14} />
                        <span>Bootcamps</span>
                        <ChevronRight size={14} />
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

                                <form action={createBootcamp}>
                                    <input type="hidden" name="icon" value={formData.icon} />
                                    <input type="hidden" name="color" value={formData.color} />

                                    <div className="space-y-6 bg-card-bg p-6 rounded-lg border border-border">
                                        <h2 className="text-lg font-medium border-b border-border pb-4 mb-4">Información General</h2>

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
                                                <textarea
                                                    id="description"
                                                    name="description"
                                                    value={formData.description}
                                                    onChange={handleInputChange}
                                                    rows={4}
                                                    className="w-full px-4 py-2 rounded-md bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none"
                                                    placeholder="Describe lo que aprenderán los estudiantes..."
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-6 bg-card-bg p-6 rounded-lg border border-border">
                                        <h2 className="text-lg font-medium border-b border-border pb-4 mb-4">Apariencia</h2>

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
                                    </div>

                                    <div className="space-y-6 bg-card-bg p-6 rounded-lg border border-border">
                                        <h2 className="text-lg font-medium border-b border-border pb-4 mb-4">Detalles del Curso</h2>

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
                                                    type="text"
                                                    id="startDate"
                                                    name="startDate"
                                                    value={formData.startDate}
                                                    onChange={handleInputChange}
                                                    className="w-full px-4 py-2 rounded-md bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                                                    placeholder="Ej: 15 Feb 2026"
                                                />
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
                                        startDate={formData.startDate || '--'}
                                        className="bg-card-bg shadow-xl"
                                        icon={formData.icon}
                                        color={formData.color}
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
