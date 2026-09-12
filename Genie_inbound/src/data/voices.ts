import voicesData from './voices.json';

export interface VoiceConfig {
  value: string;
  label: string;
  provider: string;
  gender: string;
  audioUrl?: string;
  avatar_url?: string;
  accent?: string;
  age?: string;
  description?: string;
  useCase?: string;
  voice_type?: string;
}

export const allVoices: VoiceConfig[] = voicesData.map((v: any) => ({
  value: v.voice_id,
  label: v.voice_name,
  provider: v.provider,
  gender: v.gender,
  audioUrl: v.preview_audio_url,
  avatar_url: v.avatar_url,
  accent: v.accent,
  age: v.age,
  voice_type: v.voice_type,
  description: `${v.accent} accent, ${v.age}`,
  useCase: v.standard_voice_type === 'retell' ? 'Retell specialized' : 'General'
}));

// Placeholder for backward compatibility if needed, though we will remove these categories from UI
export const vapiVoices: VoiceConfig[] = allVoices.filter(v => v.provider === 'vapi');
export const deepgramVoices: VoiceConfig[] = allVoices.filter(v => v.provider === 'deepgram');
