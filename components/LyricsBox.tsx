import React, { useEffect, useRef, useState } from 'react';
import { LyricLine } from '../types';

interface LyricsBoxProps {
    lyrics: LyricLine[];
    currentTime: number;
    duration: number;
    audioRef: React.RefObject<HTMLAudioElement>;
    visible: boolean;
}

export const LyricsBox: React.FC<LyricsBoxProps> = ({ lyrics, currentTime, duration, audioRef, visible }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [isAutoScroll, setIsAutoScroll] = useState(true);
    const userScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Aktif satırı bulma mantığı
    useEffect(() => {
        if (!lyrics || lyrics.length === 0) return;
        
        let foundIndex = -1;
        // Basit toleranslı eşleşme
        for (let i = 0; i < lyrics.length; i++) {
            if (currentTime >= lyrics[i].start - 0.5) { // 0.5sn tolerans
                foundIndex = i;
            } else {
                break;
            }
        }
        
        if (foundIndex !== -1) {
            setActiveIndex(foundIndex);
        }
    }, [currentTime, lyrics]);

    // Otomatik Kaydırma (Scroll)
    useEffect(() => {
        if (isAutoScroll && activeIndex !== -1 && containerRef.current) {
            const activeEl = containerRef.current.children[activeIndex] as HTMLElement;
            if (activeEl) {
                activeEl.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'center'
                });
            }
        }
    }, [activeIndex, isAutoScroll]);

    // Kullanıcı manuel scroll yaparsa otomatik kaydırmayı kısa süre durdur
    const handleScroll = () => {
        setIsAutoScroll(false);
        if (userScrollTimeout.current) clearTimeout(userScrollTimeout.current);
        userScrollTimeout.current = setTimeout(() => {
            setIsAutoScroll(true);
        }, 3000); // 3 saniye sonra tekrar otomatiğe al
    };

    // TXT İndirme Fonksiyonu
    const downloadLyrics = () => {
        if (!lyrics || lyrics.length === 0) return;

        const content = lyrics.map(l => `[${formatTime(l.start)}] ${l.text}`).join('\n');
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'sarki_sozleri_analiz.txt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    if (!visible) return null;

    return (
        <div className="absolute inset-0 flex items-center justify-center z-30 fade-in duration-1000 pointer-events-auto">
            {/* Arka plan karartma (Vignette) */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/40 to-black/90 z-0 pointer-events-none"></div>
            
            {/* İndirme Butonu */}
            <button 
                onClick={downloadLyrics}
                className="absolute top-24 right-6 z-50 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2 rounded-full text-xs font-mono backdrop-blur-md transition-all flex items-center gap-2 group"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-y-0.5 transition-transform"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                TXT İNDİR
            </button>

            {/* Lyrics Konteyner */}
            <div 
                ref={containerRef}
                onScroll={handleScroll}
                className="relative z-10 w-full max-w-4xl h-[70vh] overflow-y-auto flex flex-col items-center py-[35vh] px-4 no-scrollbar cursor-grab active:cursor-grabbing"
                style={{
                    maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
                    scrollBehavior: 'smooth'
                }}
            >
                {lyrics.length > 0 ? (
                    lyrics.map((line, i) => {
                        const isActive = i === activeIndex;
                        const isFuture = i > activeIndex;
                        
                        return (
                            <div 
                                key={i}
                                className={`text-center transition-all duration-500 ease-out py-3 w-full flex justify-center`}
                            >
                                <p 
                                    className={`font-sans font-bold leading-tight transition-all duration-500 max-w-[90%] select-text
                                        ${isActive 
                                            ? 'text-white scale-110 opacity-100 blur-0' 
                                            : isFuture 
                                                ? 'text-gray-400 scale-95 opacity-40 blur-[1px]' 
                                                : 'text-gray-600 scale-90 opacity-20 blur-[2px]'
                                        }
                                    `}
                                    style={{ 
                                        fontSize: '15px', // Fixed size
                                        textShadow: isActive ? '0 0 15px rgba(255,255,255,0.5)' : 'none',
                                        whiteSpace: 'pre-wrap', // Enable wrapping
                                        wordBreak: 'break-word',
                                    }}
                                >
                                    {line.text}
                                </p>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-white/50 animate-pulse text-sm font-mono">...</div>
                )}
            </div>
            
            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
};