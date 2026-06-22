import { getUploadSas } from '@/app/actions/storage';

// Sube un archivo a Azure Blob vía SAS directo y devuelve su URL pública.
// Reemplaza el patrón supabase.storage.from('media').upload(...) + getPublicUrl(...).
// ponytail: un solo Put Blob (tope ~5000 MiB/archivo); si algún video supera eso,
//           habría que trocear en bloques (Put Block / Put Block List).
export async function uploadToAzure(file: File, path: string): Promise<string> {
    const { uploadUrl, publicUrl } = await getUploadSas(path);

    const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            'x-ms-blob-type': 'BlockBlob',
            'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
    });

    if (!res.ok) throw new Error(`Error subiendo a Azure (${res.status})`);
    return publicUrl;
}
