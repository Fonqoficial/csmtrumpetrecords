import type { APIRoute } from 'astro';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { Buffer } from 'buffer';
import { isValidSession } from '../../lib/auth';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${import.meta.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: import.meta.env.R2_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.R2_SECRET_ACCESS_KEY,
  },
});

export const POST: APIRoute = async ({ request, cookies }) => {
    if (!isValidSession(cookies.get('admin_session')?.value)) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }
  
    try {
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const artist = formData.get('artist') as string;
    const category = formData.get('category') as string;
    const file = formData.get('file') as File;

    if (!file || !title || !artist) {
      return new Response(JSON.stringify({ error: 'Faltan datos requeridos' }), { status: 400 });
    }

    if (file.type && !file.type.startsWith('audio/')) {
      return new Response(JSON.stringify({ error: 'Solo se admiten archivos de audio' }), { status: 400 });
    }

    // 1. Preparar el archivo para R2
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;

    // Partitura opcional: se sube una sola vez por lote y se reutiliza su URL
    const score = formData.get('score') as File | null;
    let scoreUrl = (formData.get('score_url') as string) || null;
    if (score && score.size > 0) {
      if (score.type !== 'application/pdf') {
        return new Response(JSON.stringify({ error: 'La partitura debe ser un PDF' }), { status: 400 });
      }
      const key = `${Date.now()}-${score.name.replace(/\s+/g, '-')}`;
      await s3.send(new PutObjectCommand({ Bucket: import.meta.env.R2_BUCKET_NAME, Key: key, Body: Buffer.from(await score.arrayBuffer()), ContentType: 'application/pdf' }));
      scoreUrl = `${import.meta.env.PUBLIC_R2_DOMAIN}/${key}`;
    }

    // 2. Subir a Cloudflare R2
    await s3.send(new PutObjectCommand({
      Bucket: import.meta.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: file.type || 'audio/mpeg',
    }));

    const publicUrl = `${import.meta.env.PUBLIC_R2_DOMAIN}/${fileName}`;

    const supabaseAdmin = createClient(
        import.meta.env.PUBLIC_SUPABASE_URL,
        import.meta.env.SUPABASE_SERVICE_KEY
    );

    // 3. Guardar en Supabase
    const { error: dbError } = await supabaseAdmin.from('tracks').insert([
      {
        title,
        artist,
        category: category || 'General',
        audio_url: publicUrl,
        score_url: scoreUrl
      }
    ]);

    if (dbError) throw new Error(dbError.message);

    return new Response(JSON.stringify({ success: true, url: publicUrl, score_url: scoreUrl }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};