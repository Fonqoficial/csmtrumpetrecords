export interface Track {
  id: string;
  title: string;
  artist: string;
  category?: string;
  duration?: string;
  audio_url: string; // URL alojada en Cloudflare R2
  score_url?: string | null; // Partitura en PDF (opcional)
  cover_url?: string;
  created_at?: string;
}
