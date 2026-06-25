'use client';

import { useSidebar } from '@/components/sidebar-context';
import { Sidebar } from '@/components/sidebar';
import { MobileMenuButton } from '@/components/mobile-menu-button';
import Link from 'next/link';
import { ArrowLeft, Download, CheckCircle, Award, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface Module {
    id: number;
    title: string;
}

interface Bootcamp {
    id: number;
    title: string;
    modules?: Module[];
}

interface CustomCertificate {
    id: number;
    title: string;
    backgroundImageUrl: string | null;
    textColor: string;
    instructorName: string | null;
    directorName: string | null;
    instructorSignatureUrl: string | null;
    directorSignatureUrl: string | null;
    showInstructorSignature: boolean;
    showDirectorSignature: boolean;
}

interface CertificateClientProps {
    bootcamp: Bootcamp;
    userName: string;
    customCertificate?: CustomCertificate | null;
}

export function CertificateClient({ bootcamp, userName, customCertificate }: CertificateClientProps) {
    const { isCollapsed } = useSidebar();
    const [mounted, setMounted] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const certificateRef = useRef<HTMLDivElement>(null);

    // Prevent hydration mismatch for sidebar state
    useEffect(() => {
        const frame = requestAnimationFrame(() => setMounted(true));
        return () => cancelAnimationFrame(frame);
    }, []);

    // Animation Effect
    useEffect(() => {
        if (!mounted) return;

        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        const randomInRange = (min: number, max: number) => {
            return Math.random() * (max - min) + min;
        };

        const interval: NodeJS.Timeout = setInterval(function () {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);

        return () => clearInterval(interval);
    }, [mounted]);

    const sidebarWidthClass = !mounted ? 'ml-0 md:ml-64' : (isCollapsed ? 'ml-0 md:ml-16' : 'ml-0 md:ml-64');

    // Completion date
    const completionDate = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

    // Generate PDF function
    const handleDownloadPDF = async () => {
        if (!certificateRef.current) {
            console.error('Certificate ref not found');
            alert('Error: No se encontró el certificado.');
            return;
        }
        
        setIsGeneratingPDF(true);
        
        try {
            // Wait for images to load
            const images = certificateRef.current.querySelectorAll('img');
            await Promise.all(
                Array.from(images).map((img) => {
                    if (img.complete) return Promise.resolve();
                    return new Promise((resolve) => {
                        img.onload = resolve;
                        img.onerror = resolve;
                    });
                })
            );

            const canvas = await html2canvas(certificateRef.current, {
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true,
                allowTaint: true,
                imageTimeout: 15000,
            });
            
            const imgData = canvas.toDataURL('image/png', 1.0);
            
            // A4 landscape dimensions in mm
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            // Calculate dimensions to fit the certificate
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
            
            const imgX = (pdfWidth - imgWidth * ratio) / 2;
            const imgY = (pdfHeight - imgHeight * ratio) / 2;
            
            pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
            
            // Generate filename
            const sanitizedTitle = bootcamp.title.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s]/g, '').replace(/\s+/g, '_');
            const sanitizedName = userName.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s]/g, '').replace(/\s+/g, '_');
            pdf.save(`Certificado_${sanitizedTitle}_${sanitizedName}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert(`Error al generar el PDF: ${(error as Error).message}`);
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-background">
            <Sidebar />

            <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarWidthClass}`}>
                {/* Header */}
                <header className="h-[60px] border-b border-border flex items-center px-6 justify-between bg-card-bg/50 backdrop-blur-sm sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <MobileMenuButton />
                        <Link href={`/dashboard/bootcamp/${bootcamp.id}`} className="text-muted hover:text-foreground transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <h1 className="text-sm font-medium">Certificación</h1>
                    </div>
                </header>

                <main className="flex-1 p-6 md:p-12 flex items-center justify-center min-h-[calc(100vh-60px)]">
                    <div className="max-w-6xl w-full">
                        <div className="flex flex-col mb-12 text-center items-center">
                            <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-amber-500/20">
                                <Award size={32} className="text-white" />
                            </div>
                            <h1 className="text-3xl md:text-4xl font-bold mb-4">¡Felicitaciones, {userName}!</h1>
                            <p className="text-muted text-lg max-w-2xl">
                                Has completado exitosamente el <strong>{bootcamp.title}</strong>. Aquí tienes tu certificado oficial que valida tus conocimientos.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                            {/* Left Column: Details & Skills */}
                            <div className="space-y-8 animate-in slide-in-from-left-4 duration-500">
                                <div className="bg-card-bg border border-border rounded-2xl p-8 shadow-sm">
                                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                        <CheckCircle className="text-green-500" size={20} />
                                        Habilidades Adquiridas
                                    </h3>

                                    <div className="space-y-4">
                                        <p className="text-sm text-muted">
                                            Este certificado valida que el estudiante ha demostrado dominio en las siguientes áreas:
                                        </p>
                                        <ul className="grid grid-cols-1 gap-3">
                                            {bootcamp.modules?.map((module) => (
                                                <li key={module.id} className="flex items-start gap-3 text-sm p-3 rounded-lg bg-background border border-border/50">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                                    <span className="leading-tight">{module.title}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-4">
                                    <button 
                                        onClick={handleDownloadPDF}
                                        disabled={isGeneratingPDF}
                                        className="w-full py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {isGeneratingPDF ? (
                                            <>
                                                <Loader2 size={20} className="animate-spin" />
                                                Generando PDF...
                                            </>
                                        ) : (
                                            <>
                                                <Download size={20} />
                                                Descargar Certificado (PDF)
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Right Column: Certificate Preview (Visible - larger fonts) */}
                            <div className="relative animate-in slide-in-from-right-4 duration-500 delay-100">
                                <div 
                                    style={{
                                        position: 'relative',
                                        aspectRatio: '1.414/1',
                                        width: '100%',
                                        backgroundColor: '#ffffff',
                                        color: customCertificate?.textColor || '#000000',
                                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                                        borderRadius: '2px',
                                        overflow: 'hidden',
                                    }}
                                >
                                    {/* Background - Custom or Default */}
                                    {customCertificate?.backgroundImageUrl ? (
                                        <img
                                            src={customCertificate.backgroundImageUrl}
                                            alt="Certificate Background"
                                            style={{
                                                position: 'absolute',
                                                inset: 0,
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                            }}
                                        />
                                    ) : (
                                        <>
                                            {/* Default decorative background */}
                                            <div style={{
                                                position: 'absolute',
                                                inset: 0,
                                                border: '8px double #e2e8f0',
                                            }}></div>
                                            <div style={{
                                                position: 'absolute',
                                                inset: 0,
                                                opacity: 0.03,
                                                backgroundImage: `repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 50%), repeating-linear-gradient(-45deg, #000 0, #000 1px, transparent 0, transparent 50%)`,
                                                backgroundSize: '20px 20px'
                                            }}></div>
                                            <div style={{
                                                position: 'absolute',
                                                inset: '32px',
                                                border: '4px solid #1e293b',
                                                pointerEvents: 'none'
                                            }}></div>
                                        </>
                                    )}

                                    {/* Certificate Content - Visible version with larger fonts */}
                                    <div style={{
                                        position: 'relative',
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        textAlign: 'center',
                                        padding: '48px',
                                    }}>

                                        {/* Header */}
                                        <div>
                                            <div style={{ fontSize: '14px', fontFamily: 'serif', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Certificado</div>
                                            <div style={{ fontSize: '16px', fontFamily: 'serif', fontStyle: 'italic', opacity: 0.8 }}>de finalización</div>
                                        </div>

                                        {/* Content */}
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%', gap: '4px' }}>
                                            <p style={{ fontFamily: 'serif', fontStyle: 'italic', fontSize: '14px', opacity: 0.7 }}>Se otorga el presente documento a:</p>

                                            <div style={{ borderBottom: `1px solid ${customCertificate?.textColor || '#cbd5e1'}40`, paddingBottom: '4px', width: '75%', margin: '0 auto' }}>
                                                <h2 style={{ fontSize: '20px', fontFamily: 'serif', fontWeight: 'bold' }}>{userName}</h2>
                                            </div>

                                            <p style={{ fontFamily: 'serif', fontStyle: 'italic', fontSize: '12px', opacity: 0.7 }}>Por haber completado satisfactoriamente el programa:</p>

                                            <h3 style={{ fontSize: '18px', fontFamily: 'serif', fontWeight: 'bold', color: '#d97706' }}>{bootcamp.title}</h3>

                                            <p style={{ fontSize: '12px', fontWeight: '600', opacity: 0.6, marginTop: '8px' }}>{completionDate}</p>
                                        </div>

                                        {/* Footer / Signatures */}
                                        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '80px' }}>
                                            {(customCertificate?.showInstructorSignature !== false) && (
                                                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    {customCertificate?.instructorSignatureUrl && (
                                                        <img 
                                                            src={customCertificate.instructorSignatureUrl} 
                                                            alt="Firma instructor"
                                                            style={{ 
                                                                height: '48px', 
                                                                objectFit: 'contain',
                                                                marginBottom: '4px'
                                                            }}
                                                        />
                                                    )}
                                                    <div style={{ width: '128px', borderTop: `1px solid ${customCertificate?.textColor || '#64748b'}60`, paddingTop: '4px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.7 }}>
                                                        {customCertificate?.instructorName || 'Instructor'}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {(customCertificate?.showDirectorSignature !== false) && (
                                                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    {customCertificate?.directorSignatureUrl && (
                                                        <img 
                                                            src={customCertificate.directorSignatureUrl} 
                                                            alt="Firma director"
                                                            style={{ 
                                                                height: '48px', 
                                                                objectFit: 'contain',
                                                                marginBottom: '4px'
                                                            }}
                                                        />
                                                    )}
                                                    <div style={{ width: '128px', borderTop: `1px solid ${customCertificate?.textColor || '#64748b'}60`, paddingTop: '4px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.7 }}>
                                                        {customCertificate?.directorName || 'Director'}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Shadow Effect underneath */}
                                <div className="absolute -bottom-4 -right-4 -z-10 w-full h-full bg-black/5 rounded-sm transform rotate-1"></div>
                            </div>
                        </div>
                    </div>
                </main>

                {/* Hidden Certificate for PDF (smaller fonts) */}
                <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                    <div 
                        ref={certificateRef}
                        style={{
                            position: 'relative',
                            width: '1000px',
                            height: '707px',
                            backgroundColor: '#ffffff',
                            color: customCertificate?.textColor || '#000000',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Background - Custom or Default */}
                        {customCertificate?.backgroundImageUrl ? (
                            <img
                                src={customCertificate.backgroundImageUrl}
                                alt="Certificate Background"
                                crossOrigin="anonymous"
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                }}
                            />
                        ) : (
                            <>
                                {/* Default decorative background */}
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    border: '8px double #e2e8f0',
                                }}></div>
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    opacity: 0.03,
                                    backgroundImage: `repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 50%), repeating-linear-gradient(-45deg, #000 0, #000 1px, transparent 0, transparent 50%)`,
                                    backgroundSize: '20px 20px'
                                }}></div>
                                <div style={{
                                    position: 'absolute',
                                    inset: '32px',
                                    border: '4px solid #1e293b',
                                    pointerEvents: 'none'
                                }}></div>
                            </>
                        )}

                        {/* Certificate Content - PDF version with smaller fonts */}
                        <div style={{
                            position: 'relative',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            padding: '40px',
                        }}>

                            {/* Header */}
                            <div>
                                <div style={{ fontSize: '18px', fontFamily: 'serif', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Certificado</div>
                                <div style={{ fontSize: '16px', fontFamily: 'serif', fontStyle: 'italic', opacity: 0.8 }}>de finalización</div>
                            </div>

                            {/* Content */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%', gap: '8px' }}>
                                <p style={{ fontFamily: 'serif', fontStyle: 'italic', fontSize: '14px', opacity: 0.7 }}>Se otorga el presente documento a:</p>

                                <div style={{ borderBottom: `1px solid ${customCertificate?.textColor || '#cbd5e1'}40`, paddingBottom: '12px', width: '70%', margin: '0 auto' }}>
                                    <h2 style={{ fontSize: '28px', fontFamily: 'serif', fontWeight: 'bold', marginBottom: '0' }}>{userName}</h2>
                                </div>

                                <p style={{ fontFamily: 'serif', fontStyle: 'italic', fontSize: '14px', opacity: 0.7 }}>Por haber completado satisfactoriamente el programa:</p>

                                <h3 style={{ fontSize: '24px', fontFamily: 'serif', fontWeight: 'bold', color: '#d97706' }}>{bootcamp.title}</h3>

                                <p style={{ fontSize: '14px', fontWeight: '600', opacity: 0.6, marginTop: '8px' }}>{completionDate}</p>
                            </div>

                            {/* Footer / Signatures */}
                            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '120px' }}>
                                {(customCertificate?.showInstructorSignature !== false) && (
                                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        {customCertificate?.instructorSignatureUrl && (
                                            <img 
                                                src={customCertificate.instructorSignatureUrl} 
                                                alt="Firma instructor"
                                                crossOrigin="anonymous"
                                                style={{ 
                                                    height: '60px', 
                                                    objectFit: 'contain',
                                                    marginBottom: '4px'
                                                }}
                                            />
                                        )}
                                        <div style={{ width: '150px', borderTop: `1px solid ${customCertificate?.textColor || '#64748b'}60`, paddingTop: '4px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.7 }}>
                                            {customCertificate?.instructorName || 'Instructor'}
                                        </div>
                                    </div>
                                )}
                                
                                {(customCertificate?.showDirectorSignature !== false) && (
                                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        {customCertificate?.directorSignatureUrl && (
                                            <img 
                                                src={customCertificate.directorSignatureUrl} 
                                                alt="Firma director"
                                                crossOrigin="anonymous"
                                                style={{ 
                                                    height: '60px', 
                                                    objectFit: 'contain',
                                                    marginBottom: '4px'
                                                }}
                                            />
                                        )}
                                        <div style={{ width: '150px', borderTop: `1px solid ${customCertificate?.textColor || '#64748b'}60`, paddingTop: '4px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.7 }}>
                                            {customCertificate?.directorName || 'Director'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
