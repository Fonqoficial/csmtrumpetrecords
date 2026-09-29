import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

// Los navegadores ignoran el atributo "download" en URLs de otro dominio (R2),
// por eso se sirve el archivo desde aquí con un nombre limpio.
export const GET: APIRoute = async ({ params }) => {
  const { data } = await supabase.from('tracks').select('title,artist,audio_url').eq('id', params.id).single();
  if (!data) return new Response('Grabación no encontrada', { status: 404 });

  const upstream = await fetch(data.audio_url);
  if (!upstream.ok || !upstream.body) return new Response('Archivo no disponible', { status: 502 });

  const name = `${data.artist} - ${data.title}`.replace(/[^\p{L}\p{N} .,_-]/gu, '').trim() || 'grabacion';
  const headers: Record<string, string> = {
    'Content-Type': 'audio/mpeg',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}.mp3`,
  };
  const len = upstream.headers.get('content-length');
  if (len) headers['Content-Length'] = len;
  return new Response(upstream.body, { headers });
};
