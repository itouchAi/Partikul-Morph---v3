
export type PresetType = 'none' | 'electric' | 'fire' | 'water' | 'mercury' | 'disco';
export type AudioMode = 'none' | 'file' | 'mic';
export type BackgroundMode = 'dark' | 'light' | 'image' | 'color' | 'gradient' | 'auto';
export type BgImageStyle = 'cover' | 'contain' | 'fill' | 'none';
export type ShapeType = 'sphere' | 'cube' | 'prism' | 'star' | 'spiky';

export type SlideshowOrder = 'random' | 'sequential';
export type SlideshowTransition = 'random' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'particles' | 'transform' | 'fade' | 'blur';

export interface SlideshowSettings {
    active: boolean;
    duration: number; // seconds
    order: SlideshowOrder;
    transition: SlideshowTransition;
}

export interface LyricLine {
    text: string;
    start: number; // saniye cinsinden
    end: number;   // saniye cinsinden
}

export type SongMood = 'energetic' | 'calm' | 'sad' | 'mysterious' | 'romantic';

export interface SongInfo {
    artistName: string;
    artistBio: string; // Yaş, doğum yeri vb.
    meaningTR: string;
    meaningEN: string;
    coverArt: string | null; // Base64 image
    isAiGenerated: boolean;
    mood?: SongMood;
    suggestedColor?: string;
}
