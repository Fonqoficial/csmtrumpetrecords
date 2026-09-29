export interface Track {
  id: string;
  title: string;
  artist: string;
  duration: string;
  audio_url: string; // URL alojada en Cloudflare R2
  cover_url?: string; // Opcional: carátula de la pista
  created_at?: string;
}