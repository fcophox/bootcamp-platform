'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { useSidebar } from '@/components/sidebar-context';
import { ArrowLeft, Upload, Award, Save, Loader2, X, Menu } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { updateCertificate } from '@/app/actions/certificate';
import { uploadToAzure } from '@/lib/azure-upload';

interface Bootcamp {
    id: number;
    title: string;
    icon: string | null;
    color: string | null;
}

interface Certificate {
    id: number;
    bootcampId: number;
    title: string;
    backgroundImageUrl: string | null;
    textColor: string;
    instructorName: string | null;
    directorName: string | null;
    instructorSignatureUrl: string | null;
    directorSignatureUrl: string | null;
    showInstructorSignature: boolean;
    showDirectorSignature: boolean;
    isActive: boolean;
    Bootcamp: {
        id: number;
        title: string;
        icon: string | null;
        color: string | null;
    };
}

export function EditCertificateClient({ certificate, bootcamps }: { certificate: Certificate, bootcamps: Bootcamp[] }) {
    const { isCollapsed, setIsMobileOpen } = useSidebar();
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    
    // Form state - initialized with certificate data
    const [bootcampId, setBootcampId] = useState<number>(certificate.bootcampId);
    const [backgroundImageUrl, setBackgroundImageUrl] = useState(certificate.backgroundImageUrl || '');
    const [textColor, setTextColor] = useState(certificate.textColor || '#1e293b');
    const [instructorName, setInstructorName] = useState(certificate.instructorName || '');
    const [directorName, setDirectorName] = useState(certificate.directorName || '');
    const [showInstructorSignature, setShowInstructorSignature] = useState(certificate.showInstructorSignature);
    const [showDirectorSignature, setShowDirectorSignature] = useState(certificate.showDirectorSignature);
    const [instructorSignatureUrl, setInstructorSignatureUrl] = useState(certificate.instructorSignatureUrl || '');
    const [directorSignatureUrl, setDirectorSignatureUrl] = useState(certificate.directorSignatureUrl || '');
    const [isUploadingInstructorSig, setIsUploadingInstructorSig] = useState(false);
    const [isUploadingDirectorSig, setIsUploadingDirectorSig] = useState(false);

    // Preview data
    const previewName = "Nombre del Alumno";
    const previewDate = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    const selectedBootcamp = bootcamps.find(b => b.id === bootcampId);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        
        setIsUploading(true);
        
        const fileExt = file.name.split('.').pop();
        const fileName = `certificate-bg-${Date.now()}.${fileExt}`;
        const filePath = `certificates/${fileName}`;

        try {
            const publicUrl = await uploadToAzure(file, filePath);
            setBackgroundImageUrl(publicUrl);
        } catch (error) {
            console.error('Upload error:', error);
            alert('Error al subir la imagen. Asegúrate de tener configurado el bucket "media" en Supabase.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'instructor' | 'director') => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        
        if (type === 'instructor') {
            setIsUploadingInstructorSig(true);
        } else {
            setIsUploadingDirectorSig(true);
        }
        
        const fileExt = file.name.split('.').pop();
        const fileName = `signature-${type}-${Date.now()}.${fileExt}`;
        const filePath = `certificates/signatures/${fileName}`;

        try {
            const publicUrl = await uploadToAzure(file, filePath);

            if (type === 'instructor') {
                setInstructorSignatureUrl(publicUrl);
            } else {
                setDirectorSignatureUrl(publicUrl);
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('Error al subir la firma. Asegúrate de tener configurado el bucket "media" en Supabase.');
        } finally {
            if (type === 'instructor') {
                setIsUploadingInstructorSig(false);
            } else {
                setIsUploadingDirectorSig(false);
            }
        }
    };

    const handleSubmit = async () => {
        if (!bootcampId || !selectedBootcamp) {
            alert('Por favor selecciona un bootcamp');
            return;
        }

        setIsLoading(true);

        const result = await updateCertificate(certificate.id, {
            title: selectedBootcamp.title,
            bootcampId: bootcampId,
            backgroundImageUrl: backgroundImageUrl || undefined,
            textColor,
            instructorName: instructorName || undefined,
            directorName: directorName || undefined,
            instructorSignatureUrl: instructorSignatureUrl || undefined,
            directorSignatureUrl: directorSignatureUrl || undefined,
            showInstructorSignature,
            showDirectorSignature,
        });

        setIsLoading(false);

        if (result.error) {
            alert(result.error);
        } else {
            router.push('/cms/certificados');
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <Sidebar />

            <div className={`flex flex-col min-h-screen transition-all duration-300 ml-0 md:${isCollapsed ? 'ml-16' : 'ml-64'}`}>
                {/* Header */}
                <header className={`fixed top-0 right-0 z-10 h-[60px] bg-background transition-all duration-300 left-0 md:${isCollapsed ? 'left-16' : 'left-64'}`}>
                    <div className="px-6 h-full border-b border-border">
                        <div className="flex items-center justify-between h-full">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setIsMobileOpen(true)}
                                    className="p-1.5 rounded-lg border border-border bg-hover-bg md:hidden hover:bg-background text-foreground"
                                >
                                    <Menu size={20} />
                                </button>
                                <Link href="/cms/certificados" className="text-muted hover:text-foreground transition-colors">
                                    <ArrowLeft size={20} />
                                </Link>
                                <h2 className="text-sm font-light text-foreground">Editar Certificado</h2>
                                {certificate.isActive && (
                                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-green-500/20 text-green-500 rounded-full">
                                        Activo
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={handleSubmit}
                                disabled={isLoading || !bootcampId}
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                Guardar cambios
                            </button>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto pt-[92px] px-6 pb-6">
                    <div className="max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Form */}
                            <div className="space-y-6">
                                <div className="bg-card-bg border border-border rounded-2xl p-6">
                                    <h3 className="text-lg font-semibold text-foreground mb-6">Información del Certificado</h3>
                                    
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-foreground mb-1.5">
                                                Bootcamp asociado *
                                            </label>
                                            <select
                                                value={bootcampId}
                                                onChange={(e) => setBootcampId(parseInt(e.target.value))}
                                                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                                            >
                                                <option value="">Selecciona un bootcamp</option>
                                                {bootcamps.map((bootcamp) => (
                                                    <option key={bootcamp.id} value={bootcamp.id}>
                                                        {bootcamp.title}
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="text-xs text-muted mt-1.5">El certificado usará el nombre del bootcamp seleccionado</p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-foreground mb-1.5">
                                                Color del texto
                                            </label>
                                            <div className="flex gap-3">
                                                <input
                                                    type="color"
                                                    value={textColor}
                                                    onChange={(e) => setTextColor(e.target.value)}
                                                    className="w-12 h-10 rounded-lg border border-border cursor-pointer"
                                                />
                                                <input
                                                    type="text"
                                                    value={textColor}
                                                    onChange={(e) => setTextColor(e.target.value)}
                                                    className="flex-1 px-4 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none font-mono text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-card-bg border border-border rounded-2xl p-6">
                                    <h3 className="text-lg font-semibold text-foreground mb-6">Imagen de Fondo</h3>
                                    
                                    <div className="space-y-4">
                                        {backgroundImageUrl ? (
                                            <div className="relative aspect-[1.414/1] w-full rounded-lg overflow-hidden border border-border">
                                                <img
                                                    src={backgroundImageUrl}
                                                    alt="Background"
                                                    className="w-full h-full object-cover"
                                                />
                                                <button
                                                    onClick={() => setBackgroundImageUrl('')}
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
                                                    id="bg-upload"
                                                    disabled={isUploading}
                                                />
                                                <label
                                                    htmlFor="bg-upload"
                                                    className={`flex flex-col items-center justify-center gap-3 p-12 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all ${
                                                        isUploading ? 'opacity-50 cursor-not-allowed' : ''
                                                    }`}
                                                >
                                                    {isUploading ? (
                                                        <>
                                                            <Loader2 size={32} className="text-primary animate-spin" />
                                                            <span className="text-sm text-muted">Subiendo imagen...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Upload size={32} className="text-muted" />
                                                            <div className="text-center">
                                                                <p className="text-sm font-medium text-foreground">Subir imagen de fondo</p>
                                                                <p className="text-xs text-muted mt-1">PNG, JPG hasta 5MB</p>
                                                                <p className="text-xs text-muted">Recomendado: 1414 x 1000 px (formato A4 horizontal)</p>
                                                            </div>
                                                        </>
                                                    )}
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-card-bg border border-border rounded-2xl p-6">
                                    <h3 className="text-lg font-semibold text-foreground mb-6">Firmas</h3>
                                    
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-medium text-foreground">
                                                Mostrar firma del Instructor
                                            </label>
                                            <button
                                                onClick={() => setShowInstructorSignature(!showInstructorSignature)}
                                                className={`w-12 h-6 rounded-full transition-colors ${
                                                    showInstructorSignature ? 'bg-primary' : 'bg-border'
                                                }`}
                                            >
                                                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                                                    showInstructorSignature ? 'translate-x-6' : 'translate-x-0.5'
                                                }`} />
                                            </button>
                                        </div>
                                        
                                        {showInstructorSignature && (
                                            <div className="space-y-3">
                                                <input
                                                    type="text"
                                                    value={instructorName}
                                                    onChange={(e) => setInstructorName(e.target.value)}
                                                    placeholder="Nombre del instructor"
                                                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                                                />
                                                
                                                {/* Firma digitalizada del instructor */}
                                                <div>
                                                    <label className="block text-xs text-muted mb-1.5">Firma digitalizada (PNG)</label>
                                                    {instructorSignatureUrl ? (
                                                        <div className="flex items-center gap-3 p-3 border border-border rounded-lg bg-background">
                                                            <img 
                                                                src={instructorSignatureUrl} 
                                                                alt="Firma instructor" 
                                                                className="h-12 object-contain"
                                                            />
                                                            <button
                                                                onClick={() => setInstructorSignatureUrl('')}
                                                                className="ml-auto p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="relative">
                                                            <input
                                                                type="file"
                                                                accept="image/png"
                                                                onChange={(e) => handleSignatureUpload(e, 'instructor')}
                                                                className="hidden"
                                                                id="instructor-sig-upload"
                                                                disabled={isUploadingInstructorSig}
                                                            />
                                                            <label
                                                                htmlFor="instructor-sig-upload"
                                                                className={`flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all ${
                                                                    isUploadingInstructorSig ? 'opacity-50 cursor-not-allowed' : ''
                                                                }`}
                                                            >
                                                                {isUploadingInstructorSig ? (
                                                                    <>
                                                                        <Loader2 size={16} className="animate-spin text-primary" />
                                                                        <span className="text-sm text-muted">Subiendo...</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Upload size={16} className="text-muted" />
                                                                        <span className="text-sm text-muted">Examinar firma PNG</span>
                                                                    </>
                                                                )}
                                                            </label>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between pt-4 border-t border-border">
                                            <label className="text-sm font-medium text-foreground">
                                                Mostrar firma del Director
                                            </label>
                                            <button
                                                onClick={() => setShowDirectorSignature(!showDirectorSignature)}
                                                className={`w-12 h-6 rounded-full transition-colors ${
                                                    showDirectorSignature ? 'bg-primary' : 'bg-border'
                                                }`}
                                            >
                                                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                                                    showDirectorSignature ? 'translate-x-6' : 'translate-x-0.5'
                                                }`} />
                                            </button>
                                        </div>

                                        {showDirectorSignature && (
                                            <div className="space-y-3">
                                                <input
                                                    type="text"
                                                    value={directorName}
                                                    onChange={(e) => setDirectorName(e.target.value)}
                                                    placeholder="Nombre del director"
                                                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                                                />
                                                
                                                {/* Firma digitalizada del director */}
                                                <div>
                                                    <label className="block text-xs text-muted mb-1.5">Firma digitalizada (PNG)</label>
                                                    {directorSignatureUrl ? (
                                                        <div className="flex items-center gap-3 p-3 border border-border rounded-lg bg-background">
                                                            <img 
                                                                src={directorSignatureUrl} 
                                                                alt="Firma director" 
                                                                className="h-12 object-contain"
                                                            />
                                                            <button
                                                                onClick={() => setDirectorSignatureUrl('')}
                                                                className="ml-auto p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="relative">
                                                            <input
                                                                type="file"
                                                                accept="image/png"
                                                                onChange={(e) => handleSignatureUpload(e, 'director')}
                                                                className="hidden"
                                                                id="director-sig-upload"
                                                                disabled={isUploadingDirectorSig}
                                                            />
                                                            <label
                                                                htmlFor="director-sig-upload"
                                                                className={`flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all ${
                                                                    isUploadingDirectorSig ? 'opacity-50 cursor-not-allowed' : ''
                                                                }`}
                                                            >
                                                                {isUploadingDirectorSig ? (
                                                                    <>
                                                                        <Loader2 size={16} className="animate-spin text-primary" />
                                                                        <span className="text-sm text-muted">Subiendo...</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Upload size={16} className="text-muted" />
                                                                        <span className="text-sm text-muted">Examinar firma PNG</span>
                                                                    </>
                                                                )}
                                                            </label>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Preview */}
                            <div className="lg:sticky lg:top-24">
                                <div className="bg-card-bg border border-border rounded-2xl p-6">
                                    <h3 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
                                        <Award size={20} className="text-primary" />
                                        Vista Previa
                                    </h3>
                                    
                                    <div className="relative aspect-[1.414/1] w-full rounded-lg overflow-hidden shadow-xl">
                                        {/* Background */}
                                        {backgroundImageUrl ? (
                                            <img
                                                src={backgroundImageUrl}
                                                alt="Certificate Background"
                                                className="absolute inset-0 w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="absolute inset-0 bg-white">
                                                {/* Default decorative background */}
                                                <div style={{
                                                    position: 'absolute',
                                                    inset: 0,
                                                    opacity: 0.03,
                                                    backgroundImage: `repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 50%), repeating-linear-gradient(-45deg, #000 0, #000 1px, transparent 0, transparent 50%)`,
                                                    backgroundSize: '20px 20px'
                                                }} />
                                                <div className="absolute inset-4 border-4 border-double border-slate-200" />
                                            </div>
                                        )}

                                        {/* Certificate Content Overlay */}
                                        <div 
                                            className="absolute inset-0 flex flex-col items-center justify-center text-center p-8"
                                            style={{ color: textColor }}
                                        >
                                            {/* Header */}
                                            <div className="mb-4">
                                                <div style={{ fontSize: '20px', fontFamily: 'serif', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                                    Certificado
                                                </div>
                                                <div style={{ fontSize: '16px', fontFamily: 'serif', fontStyle: 'italic', opacity: 0.8 }}>
                                                    de finalización
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 flex flex-col justify-center w-full max-w-[80%]">
                                                <p style={{ fontSize: '12px', fontFamily: 'serif', fontStyle: 'italic', opacity: 0.7 }}>
                                                    Se otorga el presente documento a:
                                                </p>
                                                <h2 style={{ fontSize: '24px', fontFamily: 'serif', fontWeight: 'bold', margin: '8px 0', borderBottom: `1px solid ${textColor}40`, paddingBottom: '4px' }}>
                                                    {previewName}
                                                </h2>
                                                <p style={{ fontSize: '12px', fontFamily: 'serif', fontStyle: 'italic', opacity: 0.7 }}>
                                                    Por haber completado satisfactoriamente el programa:
                                                </p>
                                                <h3 style={{ fontSize: '18px', fontFamily: 'serif', fontWeight: 'bold', color: '#d97706', margin: '8px 0' }}>
                                                    {selectedBootcamp?.title || 'Selecciona un bootcamp'}
                                                </h3>
                                                <p style={{ fontSize: '10px', opacity: 0.6 }}>
                                                    {previewDate}
                                                </p>
                                            </div>

                                            {/* Signatures */}
                                            <div className="w-full flex justify-center gap-16 mt-4">
                                                {showInstructorSignature && (
                                                    <div className="text-center flex flex-col items-center">
                                                        {/* Firma digitalizada del instructor */}
                                                        {instructorSignatureUrl && (
                                                            <img 
                                                                src={instructorSignatureUrl} 
                                                                alt="Firma instructor" 
                                                                style={{ 
                                                                    height: '40px', 
                                                                    objectFit: 'contain',
                                                                    marginBottom: '4px'
                                                                }}
                                                            />
                                                        )}
                                                        <div style={{ width: '100px', borderTop: `1px solid ${textColor}60`, paddingTop: '4px', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.7 }}>
                                                            {instructorName || 'Instructor'}
                                                        </div>
                                                    </div>
                                                )}

                                                {showDirectorSignature && (
                                                    <div className="text-center flex flex-col items-center">
                                                        {/* Firma digitalizada del director */}
                                                        {directorSignatureUrl && (
                                                            <img 
                                                                src={directorSignatureUrl} 
                                                                alt="Firma director" 
                                                                style={{ 
                                                                    height: '40px', 
                                                                    objectFit: 'contain',
                                                                    marginBottom: '4px'
                                                                }}
                                                            />
                                                        )}
                                                        <div style={{ width: '100px', borderTop: `1px solid ${textColor}60`, paddingTop: '4px', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.7 }}>
                                                            {directorName || 'Director'}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-xs text-muted text-center mt-4">
                                        Esta es una vista previa. Los datos del alumno se llenarán automáticamente.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
