'use server';

import { createClient } from '@/utils/supabase/server';
import {
    StorageSharedKeyCredential,
    BlobSASPermissions,
    generateBlobSASQueryParameters,
    SASProtocol,
} from '@azure/storage-blob';

const account = process.env.AZURE_STORAGE_ACCOUNT!;
const accountKey = process.env.AZURE_STORAGE_KEY!;
const container = process.env.AZURE_STORAGE_CONTAINER || 'media';
const publicBase = process.env.NEXT_PUBLIC_AZURE_BLOB_BASE!; // https://cuenta.blob.core.windows.net/media

// Devuelve una URL con SAS temporal para que el navegador suba el archivo
// directo a Azure (PUT), y la URL pública final para guardar en la BD.
// Solo docentes/superadmin (los únicos que suben media desde el CMS).
export async function getUploadSas(path: string): Promise<{ uploadUrl: string; publicUrl: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    const { data: roleRow } = await supabase.from('UserRole').select('role').eq('id', user.id).maybeSingle();
    if (roleRow?.role !== 'docente' && roleRow?.role !== 'superadmin') throw new Error('No autorizado');

    // Evita rutas raras / escapes. Mantiene los prefijos existentes (videos/, bootcamps/, …).
    const clean = path.replace(/^\/+/, '');
    if (clean.includes('..') || !/^[\w./-]+$/.test(clean)) throw new Error('Ruta inválida');

    const cred = new StorageSharedKeyCredential(account, accountKey);
    const sas = generateBlobSASQueryParameters({
        containerName: container,
        blobName: clean,
        permissions: BlobSASPermissions.parse('cw'), // create + write
        startsOn: new Date(Date.now() - 5 * 60 * 1000), // tolera desfase de reloj
        expiresOn: new Date(Date.now() + 60 * 60 * 1000), // 1h para subir
        protocol: SASProtocol.Https,
    }, cred).toString();

    const encoded = clean.split('/').map(encodeURIComponent).join('/');
    return {
        uploadUrl: `${publicBase}/${encoded}?${sas}`,
        publicUrl: `${publicBase}/${encoded}`,
    };
}
