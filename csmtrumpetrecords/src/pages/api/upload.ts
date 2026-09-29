import type { APIRoute } from 'astro';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { Buffer } from 'buffer';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${import.meta.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: import.meta.env.R2_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.R2_SECRET_ACCESS_KEY,
  },
});

export const POST: APIRoute = async ({ request, cookies }) => {
    if (!cookies.has('admin_session')) {
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

    // 1. Preparar el archivo para R2
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;

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
        audio_url: publicUrl
      }
    ]);

    if (dbError) throw new Error(dbError.message);

    return new Response(JSON.stringify({ success: true, url: publicUrl }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};