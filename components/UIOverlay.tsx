
import React, { useState, useRef, useEffect, forwardRef } from 'react';
import { PresetType, AudioMode, BackgroundMode, BgImageStyle, ShapeType, SlideshowSettings, SlideshowTransition, SlideshowOrder, SongInfo } from '../types';

const FONTS = [
  { name: 'Mono', value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' },
  { name: 'Sans Serif', value: 'ui-sans-serif, system-ui, sans-serif' },
  { name: 'Serif', value: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' },
  { name: 'Cursive', value: '"Comic Sans MS", "Chalkboard SE", "Comic Neue", sans-serif' },
  { name: 'Fantasy', value: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif' },
];

interface UIOverlayProps {
  onSubmit: (text: string) => void;
  onImageUpload: (imgSrc: string, useOriginalColors: boolean) => void;
  onDrawingStart: () => void;
  onDrawingConfirm: () => void;
  isDrawing: boolean;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  canvasRotation: [number, number, number];
  onRotateX: () => void;
  onRotateY: () => void;
  onRotateZ: () => void;
  currentColor: string;
  onColorChange: (color: string) => void;
  onResetColors: () => void;
  isOriginalColors: boolean;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
  hasImage: boolean;
  depthIntensity: number;
  onDepthChange: (val: number) => void;
  repulsionStrength: number;
  onRepulsionChange: (val: number) => void;
  repulsionRadius: number;
  onRadiusChange: (val: number) => void;
  particleCount: number;
  onParticleCountChange: (val: number) => void;
  particleSize: number;
  onParticleSizeChange: (val: number) => void;
  modelDensity: number;
  onModelDensityChange: (val: number) => void;
  activePreset: PresetType;
  onPresetChange: (preset: PresetType) => void;
  onAudioChange: (mode: AudioMode, url: string | null, title?: string, lang?: string) => void;
  audioMode: AudioMode;
  audioTitle?: string | null;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  volume?: number;
  onVolumeChange?: (vol: number) => void;
  onResetAll: () => void;
  onClearCanvas: () => void;
  bgMode: BackgroundMode;
  onBgModeChange: (mode: BackgroundMode, data?: string) => void;
  onBgImageConfirm: (img: string, style: BgImageStyle) => void; 
  customBgColor: string;
  currentShape: ShapeType;
  onShapeChange: (shape: ShapeType) => void;
  isWidgetMinimized: boolean;
  isUIHidden: boolean;
  onToggleUI: () => void;
  isSceneVisible?: boolean;
  onToggleScene?: () => void;
  bgImages?: string[];
  onBgImagesAdd?: (images: string[]) => void;
  onBgImageSelect?: (img: string) => void;
  onBgImageStyleChange?: (style: BgImageStyle) => void;
  bgImageStyle?: BgImageStyle;
  onRemoveBgImage?: (img: string) => void;
  onBgPositionChange?: (pos: string, zoom: number) => void; 
  onBgTransformChange?: (croppedDataUrl: string) => void; 
  onResetDeck?: (deleteImages: boolean, resetSize: boolean) => void;
  slideshowSettings?: SlideshowSettings;
  onSlideshowSettingsChange?: (settings: React.SetStateAction<SlideshowSettings>) => void;
  isAutoRotating?: boolean;
  onToggleAutoRotation?: () => void;
  useLyricParticles?: boolean;
  onToggleLyricParticles?: () => void;
  hasLyrics?: boolean;
  useLyricEcho?: boolean; 
  onToggleLyricEcho?: () => void; 
  generatedImages?: string[];
  generatedPrompts?: string[];
  songInfo?: SongInfo | null;
  showInfoPanel?: boolean;
  onToggleInfoPanel?: () => void;
  isMoodSyncActive?: boolean;
  onToggleMoodSync?: () => void;
  enableBloom?: boolean;
  onToggleBloom?: () => void;
  enableTrails?: boolean;
  onToggleTrails?: () => void;
  showLyrics?: boolean;
  onToggleShowLyrics?: () => void;
  // LIVE CHAT PROPS
  isLiveActive?: boolean;
  liveStatus?: 'disconnected' | 'connecting' | 'connected' | 'speaking';
  onToggleLive?: () => void;
}

const ImageDeck: React.FC<{
    images: string[];
    activeIndex: number;
    onIndexChange: (index: number) => void;
    onSelect: (img: string) => void;
    onRemove: (img: string) => void;
    onHover?: (img: string) => void;
    side: 'left' | 'right';
    isUIHidden: boolean;
    hideInCleanMode: boolean;
    extraButtons?: React.ReactNode;
    downloadable?: boolean;
}> = ({ images, activeIndex, onIndexChange, onSelect, onRemove, onHover, side, isUIHidden, hideInCleanMode, extraButtons, downloadable }) => {
    const [expanded, setExpanded] = useState(false);
    const [scrollOffset, setScrollOffset] = useState(0);
    const [animState, setAnimState] = useState<'idle' | 'next' | 'prev'>('idle');
    const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const VISIBLE_STACK = 3;
    const EXPANDED_VISIBLE_COUNT = 6;
    
    useEffect(() => {
        if (images.length === 0 && activeIndex !== 0) onIndexChange(0);
    }, [images.length]);

    const handleWheel = (e: React.WheelEvent) => {
        e.stopPropagation();
        if (images.length <= 1) return;
        if (expanded) {
            if (images.length <= EXPANDED_VISIBLE_COUNT) return;
            const dir = e.deltaY > 0 ? 1 : -1;
            setScrollOffset(prev => {
                const maxOffset = Math.max(0, images.length - EXPANDED_VISIBLE_COUNT);
                return Math.max(0, Math.min(maxOffset, prev + dir));
            });
        } else {
            if (animState !== 'idle') return;
            const dir = e.deltaY > 0 ? 'next' : 'prev';
            setAnimState(dir);
            if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
            animTimeoutRef.current = setTimeout(() => {
                setAnimState('idle');
                let nextIndex;
                if (dir === 'next') nextIndex = (activeIndex + 1) % images.length;
                else nextIndex = (activeIndex - 1 + images.length) % images.length;
                onIndexChange(nextIndex);
            }, 400); 
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation(); setExpanded(!expanded); if (!expanded) setScrollOffset(0);
    };
    const handleCardClick = (e: React.MouseEvent, img: string, realIndex?: number) => {
        e.stopPropagation();
        if (expanded) { if (realIndex !== undefined) onIndexChange(realIndex); onSelect(img); setExpanded(false); } else { onSelect(img); }
    };
    const downloadImage = (e: React.MouseEvent, dataUrl: string, index: number) => {
        e.stopPropagation(); const link = document.createElement('a'); link.href = dataUrl; link.download = `image_${index + 1}.png`; document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const renderCollapsedStack = () => {
        if (images.length === 0) return null;
        const stackItems = [];
        const count = Math.min(images.length, VISIBLE_STACK);
        for (let i = 0; i < count; i++) {
            let logicalIndex = (activeIndex + i) % images.length;
            let zIndex = 50 - i * 10;
            let transform = `translateY(${-i * 4}px) translateX(${side === 'left' ? i * 2 : -i * 2}px) scale(${1 - i * 0.05})`;
            let opacity = 1 - i * 0.2;
            let className = "deck-card group";
            if (animState === 'next') { if (i === 0) { className += " anim-throw-back"; zIndex = 60; } else { className += " anim-slide-forward"; } } else if (animState === 'prev') { if (i === 0 || i === 1) className += " anim-slide-backward"; }
            stackItems.push( <div key={`stack-${logicalIndex}-${i}`} className={className} style={{ backgroundImage: `url(${images[logicalIndex]})`, zIndex, transform, opacity }} onContextMenu={handleContextMenu} onClick={(e) => handleCardClick(e, images[logicalIndex])} > {i === 0 && !expanded && extraButtons} </div> );
        }
        if (animState === 'prev') { const prevIndex = (activeIndex - 1 + images.length) % images.length; stackItems.push(<div key="ghost-prev" className="deck-card anim-fetch-front" style={{ backgroundImage: `url(${images[prevIndex]})`, zIndex: 100 }} />); }
        return <div className="relative w-full h-full perspective-[500px]">{stackItems}</div>;
    };

    const renderExpandedList = () => {
        const visibleImages = images.slice(scrollOffset, scrollOffset + EXPANDED_VISIBLE_COUNT);
        return ( <div className="flex flex-col-reverse gap-2 w-full h-full animate-in slide-in-from-bottom-4 duration-300"> {visibleImages.map((img, idx) => { const realIdx = scrollOffset + idx; return ( <div key={`exp-${realIdx}`} className="w-full h-16 rounded-lg bg-cover bg-center border border-white/20 hover:border-blue-400 hover:scale-105 transition-all shadow-lg relative group cursor-pointer shrink-0" style={{ backgroundImage: `url(${img})` }} onClick={(e) => handleCardClick(e, img, realIdx)} onMouseEnter={() => onHover && onHover(img)} > <button onClick={(e) => { e.stopPropagation(); onRemove(img); }} className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 rounded-full text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10 hover:bg-red-500" title="Sil">-</button> {downloadable && ( <button onClick={(e) => downloadImage(e, img, realIdx)} className="absolute -top-2 -left-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10 hover:bg-blue-500" title="İndir"> <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> </button> )} {realIdx === activeIndex && <div className="absolute inset-0 border-2 border-blue-500 rounded-lg pointer-events-none"></div>} </div> ); })} </div> );
    };

    const shouldHide = isUIHidden && hideInCleanMode;
    const containerClass = shouldHide ? "translate-y-[200%] opacity-0 pointer-events-none" : "translate-y-0 opacity-100";
    useEffect(() => { if(expanded) { const close = () => setExpanded(false); window.addEventListener('click', close); return () => window.removeEventListener('click', close); } }, [expanded]);
    return ( <div className={`absolute bottom-24 w-24 h-16 transition-all duration-500 ease-in-out z-[55] ${side === 'left' ? 'right-48' : 'right-6'} ${containerClass}`} onWheel={handleWheel} onClick={(e) => e.stopPropagation()} > {expanded ? ( <div className="absolute bottom-0 w-28 flex flex-col p-2 max-h-[80vh]" style={{ transform: 'translateX(-8px)' }}>{renderExpandedList()}</div> ) : renderCollapsedStack()} </div> );
};

export const UIOverlay = forwardRef<HTMLInputElement, UIOverlayProps>(({ 
  onSubmit, onImageUpload, onDrawingStart, onDrawingConfirm, isDrawing, brushSize, onBrushSizeChange, canvasRotation, onRotateX, onRotateY, onRotateZ, currentColor, onColorChange, onResetColors, isOriginalColors, onInteractionStart, onInteractionEnd, hasImage, depthIntensity, onDepthChange, repulsionStrength, onRepulsionChange, repulsionRadius, onRadiusChange, particleCount, onParticleCountChange, particleSize, onParticleSizeChange, modelDensity, onModelDensityChange, activePreset, onPresetChange, onAudioChange, audioMode, audioTitle, isPlaying = true, onTogglePlay, volume = 0.5, onVolumeChange, onResetAll, onClearCanvas, bgMode, onBgModeChange, onBgImageConfirm, customBgColor, currentShape, onShapeChange, isWidgetMinimized, isUIHidden, onToggleUI, isSceneVisible = true, onToggleScene, bgImages = [], onBgImagesAdd, onBgImageSelect, onBgImageStyleChange, bgImageStyle = 'cover', onRemoveBgImage, onBgPositionChange, onBgTransformChange, onResetDeck, slideshowSettings, onSlideshowSettingsChange, isAutoRotating = true, onToggleAutoRotation, useLyricParticles = false, onToggleLyricParticles, hasLyrics = false, useLyricEcho = false, onToggleLyricEcho, generatedImages = [], generatedPrompts = [], songInfo, showInfoPanel = true, onToggleInfoPanel, isMoodSyncActive, onToggleMoodSync, enableBloom = false, onToggleBloom, enableTrails = false, onToggleTrails, showLyrics = false, onToggleShowLyrics, isLiveActive, liveStatus, onToggleLive
}, ref) => {
  const [inputValue, setInputValue] = useState('');
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isBgPaletteOpen, setIsBgPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isShapeMenuOpen, setIsShapeMenuOpen] = useState(false); 
  const [savedColor, setSavedColor] = useState(currentColor);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [useOriginalImageColors, setUseOriginalImageColors] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState('turkish');
  const [showMusicSettings, setShowMusicSettings] = useState(false);
  const [musicShowInCleanMode, setMusicShowInCleanMode] = useState(false);
  const [showVolumeControl, setShowVolumeControl] = useState(false);
  const [isMusicPlayerMinimized, setIsMusicPlayerMinimized] = useState(false);
  const [musicFont, setMusicFont] = useState(FONTS[0].value);
  const [musicBold, setMusicBold] = useState(false);
  const [musicItalic, setMusicItalic] = useState(false);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);
  const [userDeckIndex, setUserDeckIndex] = useState(0);
  const [aiDeckIndex, setAiDeckIndex] = useState(0);
  const [deckShowSettings, setDeckShowSettings] = useState(false);
  const [deckHideInCleanMode, setDeckHideInCleanMode] = useState(false);
  const [showSlideshowPanel, setShowSlideshowPanel] = useState(false);
  const [showTransitionGrid, setShowTransitionGrid] = useState(false);
  const [showResetMenu, setShowResetMenu] = useState(false);
  const [resetDeleteAll, setResetDeleteAll] = useState(false);
  const [resetResetSize, setResetResetSize] = useState(true);
  const [showCropper, setShowCropper] = useState(false);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [cropScale, setCropScale] = useState(1);
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [startOffset, setStartOffset] = useState({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null); 
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const cropImageRef = useRef<HTMLImageElement>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  
  const isLightMode = bgMode === 'light';
  const isAnyMenuOpen = isSettingsOpen || isThemeMenuOpen || isShapeMenuOpen || isBgPaletteOpen || isPaletteOpen || showMusicSettings || deckShowSettings || showResetMenu;
  const actualAudioInputRef = (ref as React.RefObject<HTMLInputElement>) || audioInputRef;

  const closeAllMenus = () => {
    setIsSettingsOpen(false); setIsThemeMenuOpen(false); setIsShapeMenuOpen(false); setIsBgPaletteOpen(false); setIsPaletteOpen(false); setShowMusicSettings(false); setDeckShowSettings(false); setShowResetMenu(false); setShowSlideshowPanel(false); 
    if (isInfoExpanded) setIsInfoExpanded(false);
    onInteractionEnd();
  };

  useEffect(() => { if (isDrawing) closeAllMenus(); }, [isDrawing]);
  useEffect(() => { [...bgImages, ...generatedImages].forEach(src => { const img = new Image(); img.src = src; }); }, [bgImages, generatedImages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { if (inputValue.trim() === '') onSubmit(''); else onSubmit(inputValue); } };
  const handleShapeSelect = (shape: ShapeType) => { onShapeChange(shape); setIsShapeMenuOpen(false); };
  const handleSpectrumMove = (e: React.MouseEvent<HTMLDivElement>) => { const rect = e.currentTarget.getBoundingClientRect(); const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)); const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)); onColorChange(`hsl(${x * 360}, 100%, ${(1 - y) * 100}%)`); };
  const handleSpectrumClick = (e: React.MouseEvent<HTMLDivElement>) => { const rect = e.currentTarget.getBoundingClientRect(); const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)); const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)); const color = `hsl(${x * 360}, 100%, ${(1 - y) * 100}%)`; setSavedColor(color); onColorChange(color); if (!isDrawing) setIsPaletteOpen(false); onInteractionEnd(); };
  const handleBgSpectrumMove = (e: React.MouseEvent<HTMLDivElement>) => { const rect = e.currentTarget.getBoundingClientRect(); const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)); const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)); onBgModeChange('color', `hsl(${x * 360}, 100%, ${(1 - y) * 100}%)`); };
  const handleBgSpectrumClick = (e: React.MouseEvent<HTMLDivElement>) => { handleBgSpectrumMove(e); setIsBgPaletteOpen(false); };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = (event) => { if (event.target?.result) { setPendingImage(event.target.result as string); setUseOriginalImageColors(true); setShowImageModal(true); onInteractionStart(); } }; reader.readAsDataURL(file); } if (fileInputRef.current) fileInputRef.current.value = ''; };
  const handleBgImagesSelect = (e: React.ChangeEvent<HTMLInputElement>) => { const files = e.target.files; if (files && files.length > 0) { Promise.all(Array.from(files).map((file) => new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = (e) => resolve(e.target?.result as string); reader.readAsDataURL(file as any as Blob); }))).then(images => { if (onBgImagesAdd) onBgImagesAdd(images); setIsThemeMenuOpen(false); onInteractionEnd(); }); } if (bgImageInputRef.current) bgImageInputRef.current.value = ''; }
  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { onAudioChange('file', URL.createObjectURL(file as any as Blob), file.name, selectedLanguage); setShowAudioModal(false); onInteractionEnd(); } }
  const confirmImageUpload = () => { if (pendingImage) { onImageUpload(pendingImage, useOriginalImageColors); setInputValue(''); } setShowImageModal(false); setPendingImage(null); onInteractionEnd(); };
  const handleCountChange = (val: number) => { onParticleCountChange(Math.max(20000, Math.min(60000, val))); };
  const cancelDrawing = () => onResetAll();
  const stopProp = (e: React.PointerEvent | React.MouseEvent) => e.stopPropagation();
  const toggleThemeMenu = () => { setIsThemeMenuOpen(!isThemeMenuOpen); setIsShapeMenuOpen(false); setIsSettingsOpen(false); setIsBgPaletteOpen(false); };
  const toggleShapeMenu = () => { setIsShapeMenuOpen(!isShapeMenuOpen); setIsThemeMenuOpen(false); setIsSettingsOpen(false); setIsBgPaletteOpen(false); }
  const handleGenImageHover = (img: string) => { onBgModeChange('image', img); };
  const handleGenImageClick = (img: string) => { if (onBgImageSelect) onBgImageSelect(img); if (onSlideshowSettingsChange) onSlideshowSettingsChange(prev => ({...prev, active: false})); };
  const hideTopClass = isUIHidden ? "-translate-y-[200%] opacity-0 pointer-events-none" : "translate-y-0 opacity-100";
  const hideBottomClass = isUIHidden ? "translate-y-[200%] opacity-0 pointer-events-none" : "translate-y-0 opacity-100";
  const hideLeftClass = isUIHidden ? "-translate-x-[200%] opacity-0 pointer-events-none" : "translate-x-0 opacity-100";
  const hideRightClass = isUIHidden ? "translate-x-[200%] opacity-0 pointer-events-none" : "translate-x-0 opacity-100";
  
  const handleBgImageSelectFromDeck = (img: string) => { if (onBgImageSelect) onBgImageSelect(img); if (onSlideshowSettingsChange) onSlideshowSettingsChange(prev => ({...prev, active: false})); };
  const currentUserActiveImage = bgImages && bgImages.length > 0 ? bgImages[userDeckIndex % bgImages.length] : null;
  const openCropper = (e?: React.MouseEvent) => { if(e) e.stopPropagation(); if(currentUserActiveImage) { setCropImage(currentUserActiveImage); setShowCropper(true); setDeckShowSettings(false); setCropOffset({x: 0, y: 0}); setCropScale(1); } };
  const handleCropMouseDown = (e: React.MouseEvent) => { setIsDraggingCrop(true); setDragStart({ x: e.clientX, y: e.clientY }); setStartOffset({ ...cropOffset }); };
  const handleCropMouseMove = (e: React.MouseEvent) => { if (!isDraggingCrop) return; const dx = e.clientX - dragStart.x; const dy = e.clientY - dragStart.y; setCropOffset({ x: startOffset.x + dx, y: startOffset.y + dy }); };
  const handleCropMouseUp = () => { setIsDraggingCrop(false); };
  const handleCropWheel = (e: React.WheelEvent) => { e.stopPropagation(); const delta = e.deltaY > 0 ? -0.1 : 0.1; setCropScale(prev => Math.max(0.1, Math.min(5, prev + delta))); };
  const confirmCrop = () => { if(onBgTransformChange && cropContainerRef.current && cropImageRef.current) { const img = cropImageRef.current; const frameWidth = Math.min(window.innerWidth * 0.8, 1280); const frameHeight = frameWidth * (9/16); const canvas = document.createElement('canvas'); canvas.width = frameWidth; canvas.height = frameHeight; const ctx = canvas.getContext('2d'); if (ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.translate(canvas.width / 2, canvas.height / 2); ctx.translate(cropOffset.x, cropOffset.y); ctx.scale(cropScale, cropScale); if(img.complete) { const drawW = img.naturalWidth; const drawH = img.naturalHeight; ctx.drawImage(img, -drawW / 2, -drawH / 2); } const dataUrl = canvas.toDataURL('image/png', 1.0); onBgTransformChange(dataUrl); } } setShowCropper(false); };
  const openResetMenu = (e: React.MouseEvent) => { e.stopPropagation(); setShowResetMenu(true); setDeckShowSettings(false); };
  const handleResetConfirm = () => { if (onResetDeck) { onResetDeck(resetDeleteAll, resetResetSize); } if (resetDeleteAll) setUserDeckIndex(0); setShowResetMenu(false); };
  const toggleSlideshow = () => { if (onSlideshowSettingsChange && slideshowSettings) { onSlideshowSettingsChange(prev => ({ ...prev, active: !prev.active })); } };
  const updateSlideshow = (updates: Partial<SlideshowSettings>) => { if (onSlideshowSettingsChange) { onSlideshowSettingsChange(prev => ({ ...prev, ...updates })); } };
  const TRANSITION_ICONS: Record<SlideshowTransition, React.ReactNode> = { 'random': <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l5 5M4 4l5 5"/></svg>, 'slide-left': <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>, 'slide-right': <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>, 'slide-up': <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>, 'slide-down': <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>, 'particles': <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="4" cy="4" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="20" cy="4" r="2"/><circle cx="4" cy="20" r="2"/><circle cx="12" cy="20" r="2"/><circle cx="20" cy="20" r="2"/></svg>, 'transform': <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 0 1 0 20"/></svg>, 'fade': <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="4 4"/></svg>, 'blur': <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg> };
  const TRANSITION_NAMES: Record<SlideshowTransition, string> = { 'random': 'Rastgele', 'slide-left': 'Sola Kay', 'slide-right': 'Sağa Kay', 'slide-up': 'Yukarı', 'slide-down': 'Aşağı', 'particles': 'Partikül', 'transform': 'Dönüşüm', 'fade': 'Solma', 'blur': 'Bulanık' };

  const vinylArt = songInfo?.coverArt;
  const isLoadingInfo = songInfo?.artistBio === "Analiz Ediliyor...";
  const isUnknownArtist = songInfo?.artistBio === "Bilinmeyen Sanatçı" || songInfo?.artistName === "AI Artist";
  const toggleInfoExpand = (e: React.MouseEvent) => { e.stopPropagation(); setIsInfoExpanded(!isInfoExpanded); };
  const handleInfoBackdropClick = (e: React.MouseEvent) => { e.stopPropagation(); setIsInfoExpanded(false); };

  return (
    <>
      <style>{`
        /* ... Styles ... */
        @keyframes electric-pulse { 0% { box-shadow: 0 0 5px #0ff; border-color: #0ff; } 50% { box-shadow: 0 0 20px #0ff, 0 0 10px #fff; border-color: #fff; } 100% { box-shadow: 0 0 5px #0ff; border-color: #0ff; } }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 8s linear infinite; }
        .paused-spin { animation-play-state: paused; }
        .icon-animate-wiggle:hover { animation: wiggle 0.5s ease-in-out infinite; }
        .icon-animate-bounce:hover { animation: bounce 0.5s infinite; }
        .icon-animate-pulse:hover { animation: pulse 1s infinite; }
        .icon-animate-spin:hover { animation: spin 1s linear infinite; }
        @keyframes wiggle { 0%, 100% { transform: rotate(-10deg); } 50% { transform: rotate(10deg); } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .preset-btn { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); }
        .preset-btn.active { transform: scale(1.15); z-index: 10; }
        .preset-electric.active { box-shadow: 0 0 15px #0ff, inset 0 0 10px rgba(0, 255, 255, 0.5); border-color: #0ff !important; background: rgba(0, 255, 255, 0.1) !important; }
        .preset-electric.active svg { animation: wiggle 0.5s ease-in-out infinite; filter: drop-shadow(0 0 5px #0ff); }
        .preset-fire.active { box-shadow: 0 0 15px #f50, inset 0 0 10px rgba(255, 85, 0, 0.5); border-color: #f50 !important; background: rgba(255, 85, 0, 0.1) !important; }
        .preset-fire.active svg { animation: bounce 0.5s infinite; filter: drop-shadow(0 0 5px #f50); }
        .preset-water.active { box-shadow: 0 0 15px #0af, inset 0 0 10px rgba(0, 170, 255, 0.5); border-color: #0af !important; background: rgba(0, 170, 255, 0.1) !important; }
        .preset-water.active svg { animation: wiggle 1s infinite; filter: drop-shadow(0 0 5px #0af); }
        .preset-mercury.active { box-shadow: 0 0 15px #aaa, inset 0 0 10px rgba(170, 170, 170, 0.5); border-color: #fff !important; background: rgba(255, 255, 255, 0.1) !important; }
        .preset-mercury.active div { animation: pulse 1s infinite; background: white; }
        @keyframes rainbow-border { 0% { border-color: red; box-shadow: 0 0 10px red; } 20% { border-color: yellow; box-shadow: 0 0 10px yellow; } 40% { border-color: lime; box-shadow: 0 0 10px lime; } 60% { border-color: cyan; box-shadow: 0 0 10px cyan; } 80% { border-color: blue; box-shadow: 0 0 10px blue; } 100% { border-color: magenta; box-shadow: 0 0 10px magenta; } }
        .preset-disco.active { animation: rainbow-border 2s linear infinite; transform: scale(1.15) rotate(10deg); }
        .theme-menu-item { position: relative; opacity: 0; transform: translateY(-10px); transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); pointer-events: none; }
        .shape-menu-open .theme-menu-item, .theme-menu-open .theme-menu-item { opacity: 1; transform: translateY(0); pointer-events: auto; }
        .deck-card { position: absolute; width: 100%; height: 100%; background-size: cover; background-position: center; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1); transform-origin: center bottom; }
        @keyframes throwToBack { 0% { transform: translateY(0) scale(1); opacity: 1; z-index: 60; } 50% { transform: translateY(-100px) rotate(10deg) scale(1.1); opacity: 0.8; z-index: 60; } 51% { z-index: 0; } 100% { transform: translateY(0) rotate(0) scale(0.9); opacity: 1; z-index: 0; } }
        .anim-throw-back { animation: throwToBack 0.4s forwards; }
        @keyframes slideForward { 0% { transform: translateY(-4px) scale(0.95); opacity: 0.9; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
        .anim-slide-forward { animation: slideForward 0.4s forwards; }
        @keyframes fetchFromBack { 0% { transform: translateY(20px) scale(0.8); opacity: 0; z-index: 0; } 50% { transform: translateY(-50px) rotate(-5deg) scale(1.05); opacity: 1; z-index: 60; } 100% { transform: translateY(0) scale(1); opacity: 1; z-index: 60; } }
        .anim-fetch-front { animation: fetchFromBack 0.4s forwards; }
        @keyframes slideBackward { 0% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(-4px) scale(0.95); opacity: 0.9; } }
        .anim-slide-backward { animation: slideBackward 0.4s forwards; }
        .vinyl-grooves { background: repeating-radial-gradient( #111 0, #111 2px, #222 3px, #222 4px ); }
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .custom-thin-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-thin-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-thin-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0); border-radius: 4px; transition: background 0.3s; }
        .custom-thin-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); }
        @keyframes marquee-loop { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-marquee-loop { animation: marquee-loop 15s linear infinite; display: flex; width: max-content; }
        .mask-linear-fade { mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent); WebkitMaskImage: linear-gradient(to right, transparent, black 10%, black 90%, transparent); }
        .custom-vol-slider-h { -webkit-appearance: none; height: 8px; background: rgba(255,255,255,0.2); border-radius: 4px; outline: none; cursor: pointer; }
        .custom-vol-slider-h::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; border-radius: 50%; background: white; cursor: pointer; box-shadow: 0 0 10px rgba(0,0,0,0.5); }
      `}</style>
      
      {isAnyMenuOpen && ( <div className="fixed inset-0 z-40 bg-transparent" onPointerDown={closeAllMenus} /> )}
      {isInfoExpanded && ( <div className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm transition-opacity duration-700" onClick={handleInfoBackdropClick} /> )}

      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
      <input type="file" accept="audio/*" ref={actualAudioInputRef} onChange={handleAudioSelect} className="hidden" />
      <input type="file" accept="image/*" multiple ref={bgImageInputRef} onChange={handleBgImagesSelect} className="hidden" />

      {/* --- MÜZİK ÇALAR WIDGET --- */}
      {(audioMode !== 'none' && (!isUIHidden || musicShowInCleanMode) && !isDrawing) && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[60] group/player pb-10">
              <div className={`absolute top-12 right-0 mt-1 flex gap-1 transition-all duration-300 transform ${isMusicPlayerMinimized ? 'opacity-0 pointer-events-none scale-0' : 'opacity-0 -translate-y-2 group-hover/player:opacity-100 group-hover/player:translate-y-0 scale-100'} `}>
                   <button onClick={(e) => { e.stopPropagation(); setShowMusicSettings(!showMusicSettings); }} className="p-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full text-white/80 hover:text-white border border-white/10 transition-colors shadow-sm" title="Ayarlar"> <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={showMusicSettings ? 'rotate-90' : ''}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 0-2.83 2 2 0 0 1 0-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> </button>
                   <button onClick={(e) => { e.stopPropagation(); setIsMusicPlayerMinimized(true); setShowMusicSettings(false); }} className="p-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full text-white/80 hover:text-white border border-white/10 transition-colors shadow-sm" title="Simge Durumuna Küçült"> <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg> </button>
              </div>
              <div className={`relative transition-all duration-700 ease-[cubic-bezier(0.25,0.8,0.25,1)] translate-y-0 ${isMusicPlayerMinimized ? 'w-12 h-12 rounded-full' : 'w-[200px] h-12 rounded-full'} backdrop-blur-xl border shadow-[0_4px_20px_rgba(0,0,0,0.3)] ${isLightMode ? 'bg-white/20 border-white/40 text-black' : 'bg-black/20 border-white/10 text-white'} overflow-hidden `} onMouseEnter={() => { onInteractionStart(); setShowVolumeControl(true); }} onMouseLeave={() => { onInteractionEnd(); setShowVolumeControl(false); setShowMusicSettings(false); }}>
                  <div className={`absolute inset-0 flex items-center justify-between px-2 z-20 transition-opacity duration-300 pointer-events-none ${isMusicPlayerMinimized ? 'opacity-0' : 'opacity-0 group-hover/player:opacity-100 group-hover/player:pointer-events-auto'} `}>
                       <div className="flex items-center relative group/vol">
                          <button className="p-1.5 hover:bg-white/10 rounded-full text-current transition-colors z-10"> <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg> </button>
                          <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-300 ease-out flex items-center"> <div className="w-16 h-1 bg-current/20 rounded-full ml-1 relative flex items-center"> <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => onVolumeChange && onVolumeChange(parseFloat(e.target.value))} className="custom-vol-slider-h w-full opacity-80 hover:opacity-100" /> </div> </div>
                       </div>
                       <div className="pr-0.5"> <button onClick={(e) => { e.stopPropagation(); onTogglePlay && onTogglePlay(); }} className="p-1.5 hover:bg-white/10 rounded-full text-current transition-colors"> {isPlaying ? ( <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> ) : ( <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> )} </button> </div>
                  </div>
                  <div className={`absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none transition-all duration-500 ease-in-out ${!isMusicPlayerMinimized ? 'group-hover/player:blur-sm group-hover/player:opacity-40 group-hover/player:scale-95' : ''} `}>
                       <div className={`flex w-full h-full items-center transition-all duration-700 ease-[cubic-bezier(0.25,0.8,0.25,1)] pointer-events-auto ${isMusicPlayerMinimized ? 'justify-center' : 'justify-between pl-1 pr-3'} `}>
                           <div className={` relative flex-shrink-0 border-2 flex items-center justify-center overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.25,0.8,0.25,1)] ${isLightMode ? 'border-black/10 bg-white/50' : 'border-white/10 bg-white/5'} ${isMusicPlayerMinimized ? 'w-10 h-10 rounded-full border-2 hover:scale-110 cursor-pointer shadow-lg shadow-white/10' : 'w-8 h-8 rounded-full'} `} onClick={(e) => { if(isMusicPlayerMinimized) { e.stopPropagation(); setIsMusicPlayerMinimized(false); } }}>
                              {songInfo?.coverArt ? ( <img src={songInfo.coverArt} alt="art" className={`w-full h-full object-cover ${isPlaying ? 'animate-spin-slow' : ''}`} /> ) : ( <div className={`w-full h-full flex items-center justify-center ${isPlaying ? 'animate-spin-slow' : ''}`}> <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg> </div> )}
                              {isMusicPlayerMinimized && ( <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300"> <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="drop-shadow-md"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg> </div> )}
                           </div>
                           <div className={`flex flex-col overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.25,0.8,0.25,1)] ml-2 flex-1 text-right ${isMusicPlayerMinimized ? 'w-0 opacity-0' : 'opacity-100'} `}>
                              <div className="w-full overflow-hidden whitespace-nowrap mask-linear-fade flex items-center justify-end"> <div className={`${(audioTitle && audioTitle.length > 18) ? 'animate-marquee-loop' : ''} flex flex-row items-center`}> <span className="text-[10px] tracking-wide block pr-2" style={{ fontFamily: musicFont, fontWeight: musicBold ? 'bold' : 'normal', fontStyle: musicItalic ? 'italic' : 'normal', whiteSpace: 'nowrap' }}>{audioTitle || "Bilinmeyen Şarkı"}</span> {(audioTitle && audioTitle.length > 18) && ( <span className="text-[10px] tracking-wide ml-6 block pr-2" style={{ fontFamily: musicFont, fontWeight: musicBold ? 'bold' : 'normal', fontStyle: musicItalic ? 'italic' : 'normal', whiteSpace: 'nowrap' }}>{audioTitle || "Bilinmeyen Şarkı"}</span> )} </div> </div>
                              <span className="text-[9px] opacity-60 font-mono truncate">{songInfo?.artistName || "Sanatçı"}</span>
                           </div>
                       </div>
                  </div>
              </div>
              {showMusicSettings && ( <div className="absolute top-20 left-1/2 -translate-x-1/2 w-64 bg-[#111]/95 backdrop-blur-xl border border-white/20 rounded-xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.8)] animate-config-pop z-20" onPointerDown={stopProp}> <h5 className="text-[10px] font-mono text-gray-400 text-center uppercase tracking-widest mb-3 border-b border-white/10 pb-1">Müzik Ayarları</h5> <div className="mb-3"> <div className="relative"> <select value={musicFont} onChange={(e) => setMusicFont(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg text-[10px] text-white p-2 outline-none cursor-pointer hover:bg-white/10 transition-colors"> {FONTS.map(f => (<option key={f.name} value={f.value} className="bg-gray-900 text-white">{f.name}</option>))} </select> </div> </div> <div className="flex gap-2 mb-3"> <button onClick={() => setMusicBold(!musicBold)} className={`flex-1 py-1.5 rounded border text-[10px] font-bold transition-all ${musicBold ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>Kalın</button> <button onClick={() => setMusicItalic(!musicItalic)} className={`flex-1 py-1.5 rounded border text-[10px] italic transition-all ${musicItalic ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>Eğik</button> </div> <div className="space-y-2"> <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/5"> <div className="flex flex-col"> <span className={`text-[10px] ${isMoodSyncActive ? 'text-blue-200' : 'text-gray-300'}`}>Mood-Sync</span> <span className="text-[8px] text-gray-500 italic">Duyguya Göre Değiş</span> </div> <button onClick={onToggleMoodSync} className={`w-8 h-4 rounded-full relative transition-colors ${isMoodSyncActive ? 'bg-blue-600' : 'bg-white/10'}`}><div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${isMoodSyncActive ? 'translate-x-4' : 'translate-x-0'}`} /></button> </div> <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/5"> <span className="text-[10px] text-gray-300">Temiz Modda Göster</span> <button onClick={() => setMusicShowInCleanMode(!musicShowInCleanMode)} className={`w-8 h-4 rounded-full relative transition-colors ${musicShowInCleanMode ? 'bg-blue-600' : 'bg-white/10'}`}><div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${musicShowInCleanMode ? 'translate-x-4' : 'translate-x-0'}`} /></button> </div> 
              
              {/* --- SÖZLER BÖLÜMÜ --- */}
              <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                {/* Ana Toggle: Sözleri Göster */}
                <div className="flex items-center justify-between mb-2"> 
                    <span className="text-[10px] text-gray-300 flex items-center gap-2"> Şarkı Sözleri {showLyrics && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>} </span> 
                    <button onClick={() => onToggleShowLyrics && onToggleShowLyrics()} className={`w-8 h-4 rounded-full relative transition-colors ${showLyrics ? 'bg-green-600' : 'bg-white/10'}`}><div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${showLyrics ? 'translate-x-4' : 'translate-x-0'}`} /></button> 
                </div>

                {/* Alt Toggle: 3D Modu (Sadece sözler açıksa görünür) */}
                {showLyrics && (
                    <div className="flex items-center justify-between pl-2 border-l border-white/10 ml-1 animate-in slide-in-from-left-2 duration-300">
                        <span className="text-[10px] text-gray-400">3D Partikül Modu</span>
                        <button onClick={onToggleLyricParticles} className={`w-8 h-4 rounded-full relative transition-colors ${useLyricParticles ? 'bg-purple-600' : 'bg-white/10'}`}>
                            <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${useLyricParticles ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                    </div>
                )}
              </div>

              <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/5"> <span className="text-[10px] text-gray-300" title="Yazının müziğe tepki vermesini engeller">Eko Efekti</span> <button onClick={onToggleLyricEcho} className={`w-8 h-4 rounded-full relative transition-colors ${useLyricEcho ? 'bg-cyan-600' : 'bg-white/10'}`}><div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${useLyricEcho ? 'translate-x-4' : 'translate-x-0'}`} /></button> </div> <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/5"> <span className="text-[10px] text-gray-300">Disk Görünümü</span> <button onClick={() => onToggleInfoPanel && onToggleInfoPanel()} className={`w-8 h-4 rounded-full relative transition-colors ${showInfoPanel ? 'bg-green-600' : 'bg-white/10'}`}><div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${showInfoPanel ? 'translate-x-4' : 'translate-x-0'}`} /></button> </div> </div> </div> )}
          </div>
      )}

      {/* --- Song Info Panel --- */}
      {(showInfoPanel && audioMode !== 'none') && !isDrawing && (
          <div onClick={toggleInfoExpand} className={` cursor-pointer preserve-3d transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] transform-gpu ${isWidgetMinimized ? '-translate-y-[100px]' : ''} ${hideLeftClass} ${isInfoExpanded ? 'rotate-y-180 z-[200]' : 'rotate-y-0 z-[50]'} `} style={{ position: 'fixed', top: isInfoExpanded ? '50%' : '230px', left: isInfoExpanded ? '50%' : '80px', width: isInfoExpanded ? '500px' : '230px', height: isInfoExpanded ? '500px' : '252px', transform: isInfoExpanded ? 'translate(-50%, -50%) rotateY(180deg)' : `translate(0, 0) rotateY(0deg) ${isWidgetMinimized ? 'translateY(-100px)' : ''}`, overflow: 'visible' }} >
              <div className={` absolute inset-0 backface-hidden rounded-3xl border backdrop-blur-xl shadow-2xl flex flex-col ${isLightMode ? 'bg-white/40 border-black/10 text-black' : 'bg-black/40 border-white/20 text-white'} ${!isInfoExpanded ? 'bg-black/20 border-white/20 shadow-[0_0_15px_rgba(0,0,0,0.3)]' : ''} `} style={{ overflow: 'visible' }} >
                  <div className="absolute left-1/2 -translate-x-1/2 -top-16"> <div className={`w-32 h-32 rounded-full shadow-xl border-4 ${isLightMode ? 'border-gray-200' : 'border-gray-800'} relative flex items-center justify-center overflow-hidden ${isPlaying || isLoadingInfo ? 'animate-spin-slow' : 'animate-spin-slow paused-spin'}`}> {vinylArt ? ( <img src={vinylArt} alt="Cover" className="w-full h-full object-cover" /> ) : ( <div className="w-full h-full vinyl-grooves opacity-80 flex items-center justify-center"> {isLoadingInfo && <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>} </div> )} <div className={`absolute w-8 h-8 rounded-full ${isLightMode ? 'bg-gray-200' : 'bg-black'} border-2 border-white/20 z-10`}></div> <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/20 to-transparent pointer-events-none"></div> </div> </div>
                  <div className="pt-[65px] px-4 pb-4 flex flex-col items-center justify-start flex-grow">
                      <div className="text-center w-full mt-0 mb-2"> <h3 className={`font-bold leading-tight tracking-tight drop-shadow-sm text-xl w-full truncate max-w-[190px] mx-auto px-2 ${isLoadingInfo ? 'animate-pulse opacity-50' : ''}`}>{songInfo ? songInfo.artistName : "Analiz Bekleniyor..."}</h3> {songInfo && !isUnknownArtist && !isLoadingInfo && ( <p className="opacity-70 font-mono text-[10px] mt-1 truncate w-full max-w-[190px] mx-auto">{songInfo.artistBio}</p> )} </div>
                      {songInfo && !isLoadingInfo && ( <div className="w-full px-1 flex flex-col gap-2 mt-1 overflow-hidden h-[110px]"> <div className={`text-xs leading-snug text-white font-medium italic text-center drop-shadow-md overflow-hidden text-ellipsis line-clamp-3`}> <span className="font-bold not-italic opacity-80 text-[10px] mr-1 block mb-0.5 text-blue-300">Şarkı Analizi (TR):</span> "{songInfo.meaningTR}" </div> <div className={`text-xs leading-snug text-white/90 font-medium italic text-center drop-shadow-md overflow-hidden text-ellipsis line-clamp-3`}> <span className="font-bold not-italic opacity-80 text-[10px] mr-1 block mb-0.5 text-blue-300">Song Analysis (En):</span> "{songInfo.meaningEN}" </div> </div> )} {isLoadingInfo && ( <div className="mt-4 text-[10px] opacity-60 font-mono animate-pulse">Analiz Ediliyor...</div> )}
                  </div>
              </div>
              <div className={`absolute inset-0 backface-hidden rounded-3xl border backdrop-blur-3xl shadow-2xl flex flex-col ${isLightMode ? 'bg-white/85 border-black/10 text-black' : 'bg-[#111]/85 border-white/10 text-white'}`} style={{ transform: 'rotateY(180deg)', overflow: 'visible' }} dir="ltr" >
                  <div className="absolute left-1/2 -translate-x-1/2 -top-16 z-30 pointer-events-none"> <div className={`w-32 h-32 rounded-full shadow-xl border-4 ${isLightMode ? 'border-gray-200' : 'border-gray-800'} relative flex items-center justify-center overflow-hidden ${isPlaying || isLoadingInfo ? 'animate-spin-slow' : 'animate-spin-slow paused-spin'}`}> {vinylArt ? ( <img src={vinylArt} alt="Cover" className="w-full h-full object-cover" /> ) : ( <div className="w-full h-full vinyl-grooves opacity-80 flex items-center justify-center"> {isLoadingInfo && <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>} </div> )} <div className={`absolute w-8 h-8 rounded-full ${isLightMode ? 'bg-gray-200' : 'bg-black'} border-2 border-white/20 z-10`}></div> <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/20 to-transparent pointer-events-none"></div> </div> </div> {vinylArt && <img src={vinylArt} alt="bg" className="absolute inset-0 w-full h-full object-cover opacity-10 blur-sm scale-110 pointer-events-none rounded-3xl overflow-hidden" />}
                  <div className={`p-8 pt-[70px] pb-4 z-20 flex-shrink-0 border-b ${isLightMode ? 'border-black/5 bg-white/50' : 'border-white/5 bg-black/50'} backdrop-blur-md rounded-t-3xl`}> <h2 className="text-3xl font-bold leading-tight text-center mt-2">{songInfo?.artistName || "Detay Yok"}</h2> {songInfo && !isUnknownArtist && <p className="font-mono text-sm opacity-60 mt-1 text-center">{songInfo.artistBio}</p>} </div>
                  <div className="flex-1 p-8 pt-6 overflow-y-auto custom-thin-scrollbar relative z-10"> {songInfo ? ( <div className="space-y-8"> <div> <h4 className="font-bold text-lg mb-2 opacity-80 border-b border-current pb-1 inline-block uppercase tracking-wider">Şarkı Analizi (TR)</h4> <p className="text-2xl leading-relaxed italic opacity-90">{songInfo.meaningTR}</p> </div> <div> <h4 className="font-bold text-lg mb-2 opacity-80 border-b border-current pb-1 inline-block uppercase tracking-wider">Song Analysis (En)</h4> <p className="text-2xl leading-relaxed italic opacity-80">{songInfo.meaningEN}</p> </div> {songInfo.mood && ( <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2"> <span className="text-[10px] font-mono uppercase opacity-60">Mood:</span> <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full uppercase font-bold tracking-wide border border-blue-500/30">{songInfo.mood}</span> </div> )} </div> ) : <p className="opacity-50">Henüz analiz verisi yok.</p>} <div className="mt-8 pt-8 border-t border-dashed border-opacity-20 border-gray-500 text-center opacity-50 text-xs">Yapay Zeka tarafından analiz edilmiştir.</div> </div>
              </div>
          </div>
      )}
      
      <ImageDeck images={generatedImages} activeIndex={aiDeckIndex} onIndexChange={setAiDeckIndex} onSelect={handleGenImageClick} onRemove={(img) => {}} onHover={handleGenImageHover} side="right" isUIHidden={isUIHidden} hideInCleanMode={deckHideInCleanMode} downloadable={true} extraButtons={ !generatedImages || generatedImages.length === 0 ? null : ( <div className="absolute top-1 right-1 w-4 h-4 bg-purple-600 rounded-full flex items-center justify-center text-white/90 text-[8px] font-bold shadow-sm">AI</div> ) } />
      <ImageDeck images={bgImages} activeIndex={userDeckIndex} onIndexChange={setUserDeckIndex} onSelect={handleBgImageSelectFromDeck} onRemove={onRemoveBgImage || (() => {})} onHover={handleBgImageSelectFromDeck} side="left" isUIHidden={isUIHidden} hideInCleanMode={deckHideInCleanMode} extraButtons={ <> <button onClick={(e) => { e.stopPropagation(); setDeckShowSettings(!deckShowSettings); setShowResetMenu(false); }} className="absolute top-1 right-1 w-4 h-4 bg-black/60 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm"><svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 0-2.83 2 2 0 0 1 0-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></button> <button onClick={openResetMenu} className="absolute top-1 left-1 w-4 h-4 bg-red-600/80 rounded-full flex items-center justify-center text-white hover:bg-red-500 opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm"><svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button> </> } />
      
      {deckShowSettings && ( <div className="absolute bottom-40 right-64 mb-4 w-32 bg-[#111]/95 backdrop-blur-xl border border-white/20 rounded-xl p-2 shadow-[0_10px_30px_rgba(0,0,0,0.5)] animate-config-pop origin-bottom z-[60]" onClick={stopProp}> {showSlideshowPanel && slideshowSettings && ( <div className="absolute bottom-full left-0 w-full mb-2 bg-[#111]/95 backdrop-blur-xl border border-white/20 rounded-xl p-2 shadow-xl animate-in slide-in-from-bottom-2 fade-in duration-200 z-[70] origin-bottom"> <h5 className="text-[9px] font-mono text-gray-400 text-center uppercase tracking-widest mb-2 border-b border-white/10 pb-1">Slayt Ayarları</h5> <div className="flex items-center gap-1 mb-2 bg-white/5 rounded p-1 border border-white/10"> <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> <input type="number" min="3" max="300" value={slideshowSettings.duration} onChange={(e) => updateSlideshow({ duration: Math.max(3, Math.min(300, parseInt(e.target.value) || 3)) })} className="w-full bg-transparent text-[10px] text-white text-center outline-none" /> <span className="text-[9px] text-gray-500">sn</span> </div> <div className="flex gap-1 mb-2"> <button onClick={() => updateSlideshow({ order: 'random' })} className={`flex-1 py-1 rounded flex justify-center items-center hover:scale-105 transition-all ${slideshowSettings.order === 'random' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400'}`} title="Rastgele"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={slideshowSettings.order === 'random' ? 'animate-spin-slow' : ''}><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l5 5M4 4l5 5"/></svg></button> <button onClick={() => updateSlideshow({ order: 'sequential' })} className={`flex-1 py-1 rounded flex justify-center items-center hover:scale-105 transition-all ${slideshowSettings.order === 'sequential' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400'}`} title="Sırayla"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg></button> </div> <div className="relative"> <button onClick={() => setShowTransitionGrid(!showTransitionGrid)} className="w-full py-1.5 rounded bg-white/5 border border-white/10 text-[9px] text-gray-300 hover:bg-white/10 flex items-center justify-between px-2"> <div className="flex items-center gap-1">{TRANSITION_ICONS[slideshowSettings.transition]}<span className="truncate max-w-[60px]">{TRANSITION_NAMES[slideshowSettings.transition]}</span></div> <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${showTransitionGrid ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg> </button> {showTransitionGrid && ( <div className="absolute bottom-full left-0 w-full mb-1 bg-[#111] border border-white/20 rounded-lg p-1 grid grid-cols-3 gap-1 shadow-2xl z-[80]"> {(Object.keys(TRANSITION_ICONS) as SlideshowTransition[]).map((t) => ( <button key={t} onClick={() => { updateSlideshow({ transition: t }); setShowTransitionGrid(false); }} className={`w-full aspect-square flex items-center justify-center rounded hover:scale-110 transition-all ${slideshowSettings.transition === t ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`} title={TRANSITION_NAMES[t]}><div className="hover:animate-pulse">{TRANSITION_ICONS[t]}</div></button> ))} </div> )} </div> </div> )} <h4 className="text-[10px] font-mono uppercase text-gray-500 mb-2 tracking-widest text-center border-b border-white/10 pb-1">Resim Boyutu</h4> <div className="flex flex-col gap-1 mb-2"> <div className="flex gap-1"> <button onClick={(e) => { onBgImageStyleChange && onBgImageStyleChange('cover'); openCropper(e); }} className={`flex-1 text-[10px] py-1 px-1 rounded border transition-colors ${bgImageStyle === 'cover' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>Doldur</button> {bgImageStyle === 'cover' && ( <button onClick={(e) => openCropper(e)} className="w-6 flex items-center justify-center rounded border border-white/10 bg-white/5 hover:bg-white/20 text-white" title="Konumla"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 0-2.83 2 2 0 0 1 0-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></button> )} </div> <button onClick={() => onBgImageStyleChange && onBgImageStyleChange('contain')} className={`text-[10px] py-1 px-2 rounded border transition-colors ${bgImageStyle === 'contain' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>Ortala</button> <button onClick={() => onBgImageStyleChange && onBgImageStyleChange('fill')} className={`text-[10px] py-1 px-2 rounded border transition-colors ${bgImageStyle === 'fill' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>Uzat</button> <button onClick={() => { toggleSlideshow(); setShowSlideshowPanel(!showSlideshowPanel); }} className={`text-[10px] py-1 px-2 rounded border transition-colors flex items-center justify-center gap-1 ${slideshowSettings?.active ? 'bg-green-600 border-green-500 text-white shadow-[0_0_10px_rgba(0,255,0,0.3)] animate-pulse' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>{slideshowSettings?.active ? 'SLAYT AÇIK' : 'SLAYT'}</span></button> </div> <div className="border-t border-white/10 pt-2 flex items-center justify-between"> <span className="text-[9px] text-gray-400">Temiz Modda Gizle</span> <button onClick={() => setDeckHideInCleanMode(!deckHideInCleanMode)} className={`w-6 h-3 rounded-full relative transition-colors ${deckHideInCleanMode ? 'bg-blue-600' : 'bg-white/10'}`}><div className={`absolute top-0.5 left-0.5 w-2 h-2 rounded-full bg-white transition-transform ${deckHideInCleanMode ? 'translate-x-3' : 'translate-x-0'}`} /></button> </div> </div> )}
      {showResetMenu && ( <div className="absolute bottom-40 right-64 mb-4 w-40 bg-[#111]/95 backdrop-blur-xl border border-white/20 rounded-xl p-3 shadow-[0_10px_30px_rgba(0,0,0,0.5)] animate-config-pop origin-bottom z-[60]" onClick={stopProp}> <h4 className="text-[10px] font-mono uppercase text-red-400 mb-2 tracking-widest text-center border-b border-white/10 pb-1">Sıfırlama</h4> <div className="flex flex-col gap-2 mb-3"> <label className="flex items-center gap-2 cursor-pointer group"><div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${resetDeleteAll ? 'bg-red-600 border-red-500' : 'border-white/30 group-hover:border-white/50'}`}>{resetDeleteAll && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"></polyline></svg>}</div><input type="checkbox" className="hidden" checked={resetDeleteAll} onChange={() => setResetDeleteAll(!resetDeleteAll)} /><span className="text-[10px] text-gray-300">Tümünü Sil</span></label> <label className="flex items-center gap-2 cursor-pointer group"><div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${resetResetSize ? 'bg-blue-600 border-blue-500' : 'border-white/30 group-hover:border-white/50'}`}>{resetResetSize && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"></polyline></svg>}</div><input type="checkbox" className="hidden" checked={resetResetSize} onChange={() => setResetResetSize(!resetResetSize)} /><span className="text-[10px] text-gray-300">Boyutu Sıfırla</span></label> </div> <div className="flex gap-2"><button onClick={() => setShowResetMenu(false)} className="flex-1 py-1 rounded bg-white/10 text-[10px] text-gray-300 hover:bg-white/20">İptal</button><button onClick={handleResetConfirm} className="flex-1 py-1 rounded bg-red-600 text-[10px] text-white hover:bg-red-500 font-bold">Onayla</button></div> </div> )}
      {showCropper && cropImage && ( <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black" onPointerDown={(e) => e.stopPropagation()}> <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg z-20 font-mono tracking-wider">KONUMLANDIRMA MODU</div> <div className="relative w-full h-full overflow-hidden flex items-center justify-center" ref={cropContainerRef} onMouseDown={handleCropMouseDown} onMouseMove={handleCropMouseMove} onMouseUp={handleCropMouseUp} onMouseLeave={handleCropMouseUp} onWheel={handleCropWheel} style={{ cursor: isDraggingCrop ? 'grabbing' : 'grab' }}> <img ref={cropImageRef} src={cropImage} alt="Target" className="absolute max-w-none transition-transform duration-75" style={{ transform: `translate(${cropOffset.x}px, ${cropOffset.y}px) scale(${cropScale})`, transformOrigin: 'center center' }} draggable={false} /> <div className="absolute inset-0 bg-black/60 pointer-events-none"></div> <div className="relative w-[80vw] max-w-[1280px] aspect-video border-2 border-blue-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.85)] pointer-events-none z-10"><div className="absolute left-1/3 top-0 bottom-0 w-px bg-blue-500/30"></div><div className="absolute right-1/3 top-0 bottom-0 w-px bg-blue-500/30"></div><div className="absolute top-1/3 left-0 right-0 h-px bg-blue-500/30"></div><div className="absolute bottom-1/3 left-0 right-0 h-px bg-blue-500/30"></div><div className="absolute bottom-2 left-2 text-blue-400 text-[10px] font-mono opacity-70">16:9 REFERENCE FRAME</div></div> </div> <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-4 z-50"> <div className="bg-black/80 backdrop-blur border border-white/10 px-4 py-2 rounded-full text-white/50 text-xs font-mono">POS: {Math.round(cropOffset.x)},{Math.round(cropOffset.y)} | ZOOM: {cropScale.toFixed(2)}x</div> <button onClick={() => setShowCropper(false)} className="px-6 py-2 rounded-full bg-white/10 text-white/70 hover:text-white text-xs font-bold transition-colors border border-white/10">İPTAL</button> <button onClick={confirmCrop} className="px-8 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-500 text-xs font-bold shadow-lg shadow-blue-900/50 transition-all hover:scale-105">UYGULA</button> </div> </div> )}
      {showAudioModal && ( <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm" onPointerDown={(e) => e.stopPropagation()}> <div className="bg-[#111] border border-white/20 p-6 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in duration-300"> <div className="flex flex-col items-center gap-4 mb-6"> <div className="w-16 h-16 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center border border-green-500/50"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></div> <h3 className="text-white font-mono text-lg text-center">Ses Kaynağı Seçin</h3> <p className="text-gray-400 text-xs text-center">Partiküller seçtiğiniz müziğin ritmine göre dans edecek.</p> </div> <div className="mb-6"><label className="text-[10px] text-gray-400 block mb-2 font-mono uppercase tracking-wider text-center">Analiz Dili</label><div className="flex bg-black/40 p-1 rounded-lg border border-white/10"><button onClick={() => setSelectedLanguage('auto')} className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${selectedLanguage === 'auto' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>Otomatik</button><button onClick={() => setSelectedLanguage('turkish')} className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${selectedLanguage === 'turkish' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>Türkçe</button><button onClick={() => setSelectedLanguage('english')} className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${selectedLanguage === 'english' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>English</button></div></div> <div className="flex gap-3"><button onClick={() => { onAudioChange('mic', null, 'Mikrofon Girişi', selectedLanguage); setShowAudioModal(false); onInteractionEnd(); }} className="flex-1 py-3 rounded-lg bg-white/10 text-white/90 hover:bg-white/20 hover:text-white transition-colors font-bold text-sm border border-white/10">Mikrofon</button><button onClick={() => actualAudioInputRef.current?.click()} className="flex-1 py-3 rounded-lg bg-green-600 text-white hover:bg-green-500 transition-colors font-bold text-sm shadow-lg shadow-green-900/50">Dosya Seç</button></div> <div className="mt-3"><button onClick={() => { setShowAudioModal(false); onInteractionEnd(); }} className="w-full py-3 rounded-lg border border-white/10 text-white/50 hover:bg-white/5 hover:text-white transition-colors text-sm">İptal</button></div> </div> </div> )}

      {/* --- PRESETS (SOL MENÜ) --- */}
      <div className={`absolute left-6 z-50 flex flex-col gap-4 transition-all duration-500 ease-in-out ${isWidgetMinimized ? 'top-32' : 'top-[230px]'} ${hideLeftClass}`} onMouseEnter={onInteractionStart} onMouseLeave={onInteractionEnd} onPointerDown={stopProp}>
          <button onClick={() => onPresetChange(activePreset === 'electric' ? 'none' : 'electric')} className={`preset-btn preset-electric w-10 h-10 rounded-full border backdrop-blur-md flex items-center justify-center relative ${activePreset === 'electric' ? 'active' : ''} ${isLightMode ? 'border-black/20 bg-black/5 hover:bg-black/10' : 'border-white/20 bg-black/50 hover:bg-white/10'}`} title="Elektrik Efekti"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400 icon-animate-wiggle"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg></button>
          <button onClick={() => onPresetChange(activePreset === 'fire' ? 'none' : 'fire')} className={`preset-btn preset-fire w-10 h-10 rounded-full border backdrop-blur-md flex items-center justify-center relative ${activePreset === 'fire' ? 'active' : ''} ${isLightMode ? 'border-black/20 bg-black/5 hover:bg-black/10' : 'border-white/20 bg-black/50 hover:bg-white/10'}`} title="Ateş Efekti"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500 icon-animate-bounce"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.1.2-2.2.5-3 .5.7 1 1.3 2 1.5z"></path></svg></button>
          <button onClick={() => onPresetChange(activePreset === 'water' ? 'none' : 'water')} className={`preset-btn preset-water w-10 h-10 rounded-full border backdrop-blur-md flex items-center justify-center relative ${activePreset === 'water' ? 'active' : ''} ${isLightMode ? 'border-black/20 bg-black/5 hover:bg-black/10' : 'border-white/20 bg-black/50 hover:bg-white/10'}`} title="Su Efekti"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 icon-animate-wiggle"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg></button>
          <button onClick={() => onPresetChange(activePreset === 'mercury' ? 'none' : 'mercury')} className={`preset-btn preset-mercury w-10 h-10 rounded-full border backdrop-blur-md flex items-center justify-center relative ${activePreset === 'mercury' ? 'active' : ''} ${isLightMode ? 'border-black/20 bg-black/5 hover:bg-black/10' : 'border-white/20 bg-black/50 hover:bg-white/10'}`} title="Civa Efekti"><div className="w-4 h-4 rounded-full bg-gradient-to-br from-gray-300 to-gray-600 border border-white/50 icon-animate-pulse"></div></button>
          <button onClick={() => onPresetChange(activePreset === 'disco' ? 'none' : 'disco')} className={`preset-btn preset-disco w-10 h-10 rounded-full border backdrop-blur-md flex items-center justify-center relative ${activePreset === 'disco' ? 'active' : ''} ${isLightMode ? 'border-black/20 bg-black/5 hover:bg-black/10' : 'border-white/20 bg-black/50 hover:bg-white/10'}`} title="Disco Modu"><div className="w-4 h-4 rounded-full bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)] border border-white/50 animate-spin icon-animate-spin" style={{ animationDuration: '3s' }}></div></button>
      </div>

      {!isDrawing && ( <div className={`absolute bottom-6 left-6 z-10 pointer-events-none select-none text-xs font-mono space-y-2 transition-transform duration-500 ${hideBottomClass} ${isLightMode ? 'text-black/60' : 'text-white/50'}`}> <div className="flex items-center gap-2"><div className={`w-4 h-4 border rounded grid place-items-center text-[10px] ${isLightMode ? 'border-black/30' : 'border-white/30'}`}>L</div><span>Sol Tık: Dağıt</span></div> <div className="flex items-center gap-2"><div className={`w-4 h-4 border rounded grid place-items-center text-[10px] ${isLightMode ? 'border-black/30' : 'border-white/30'}`}>R</div><span>Sağ Tık: Döndür</span></div> <div className="flex items-center gap-2"><div className={`w-4 h-4 border rounded grid place-items-center text-[10px] ${isLightMode ? 'border-black/30' : 'border-white/30'}`}>M</div><span>Tekerlek: Yakınlaş</span></div> </div> )}
      {isDrawing && ( <div className={`absolute top-10 left-1/2 -translate-x-1/2 z-50 pointer-events-none select-none bg-black/50 px-6 py-2 rounded-full border border-white/20 backdrop-blur-md flex flex-col items-center transition-transform duration-500 ${hideTopClass}`}> <p className="text-white text-sm font-mono animate-pulse">3D Tuval: Sol Tık Çiz - Sağ Tık Kamera</p> <p className="text-white/50 text-[10px] mt-1">Tuvali döndürmek için sağ menüdeki okları kullanın</p> </div> )}
      {isBgPaletteOpen && !isUIHidden && ( <div className="absolute bottom-24 right-4 z-[100] origin-bottom-right oval-picker-container" onMouseEnter={onInteractionStart} onMouseLeave={onInteractionEnd} onPointerDown={stopProp}> <div className={`backdrop-blur-xl border border-white/20 p-2 rounded-3xl shadow-2xl relative w-64 ${isLightMode ? 'bg-black/90' : 'bg-[#111]/90'}`}> <div className="flex justify-between items-center px-3 py-1 border-b border-white/10 mb-2"> <span className="text-white/70 text-[10px] font-mono tracking-widest uppercase">BG Color VFX</span> <button onClick={() => setIsBgPaletteOpen(false)} className="w-5 h-5 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/20 text-white/50 hover:text-white transition-colors"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"></path></svg></button> </div> <div className="w-full h-24 rounded-2xl cursor-crosshair relative overflow-hidden shadow-inner border border-white/10 group mx-auto" onMouseMove={handleBgSpectrumMove} onClick={handleBgSpectrumClick} style={{ background: 'white' }}> <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)' }} /> <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0) 50%, rgba(0,0,0,1) 100%)' }} /> <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border-2 border-white/20 rounded-2xl"></div> </div> <div className="mt-2 flex gap-3 items-center justify-center pb-1"> <div className="w-5 h-5 rounded-full border border-white/30 shadow-[0_0_10px_rgba(255,255,255,0.2)]" style={{ backgroundColor: customBgColor }}></div> <span className="text-[10px] font-mono text-white/50">{customBgColor.toUpperCase()}</span> </div> </div> </div> )}
      
      {/* --- BOTTOM RIGHT BUTTONS --- */}
      <button onClick={onToggleAutoRotation} className={`absolute bottom-6 right-32 z-[60] w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border backdrop-blur-md shadow-lg group ${hideBottomClass} ${isLightMode ? 'border-black/20 text-black bg-black/5 hover:bg-black/10' : 'border-white/20 text-white bg-white/10 hover:bg-white/20'}`} title={isAutoRotating ? "Dönmeyi Durdur" : "Rastgele Döndür"}><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`group-hover:animate-spin ${!isAutoRotating ? 'opacity-50' : ''}`}><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path></svg></button>
      <button onClick={onToggleScene} className={`absolute bottom-6 right-20 z-[60] w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border backdrop-blur-md shadow-lg group ${hideBottomClass} ${isLightMode ? 'border-black/20 text-black bg-black/5 hover:bg-black/10' : 'border-white/20 text-white bg-white/10 hover:bg-white/20'}`} title={isSceneVisible ? "Nesneyi Gizle" : "Nesneyi Göster"}>{isSceneVisible ? (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-animate-pulse"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>) : (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>)}</button>
      <button onClick={onToggleUI} className={`absolute bottom-6 right-6 z-[60] w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border backdrop-blur-md shadow-lg group ${isLightMode ? 'border-black/20 text-black bg-black/5 hover:bg-black/10' : 'border-white/20 text-white bg-white/10 hover:bg-white/20'}`} title={isUIHidden ? "Arayüzü Göster" : "Temiz Mod"}>{isUIHidden ? (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-animate-spin"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>) : (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-animate-bounce"><line x1="5" y1="12" x2="19" y2="12"></line></svg>)}</button>

      {/* --- SIDE MENU (THEME & SHAPE) - (BURASI KORUNDU) --- */}
      <div className={`absolute top-6 right-6 z-50 flex flex-col items-end gap-3 transition-transform duration-500 ${hideTopClass}`} onPointerDown={stopProp}>
          <div className="flex flex-row gap-4 items-start"> 
            {/* ŞEKİL MENÜSÜ */}
            <div className="relative flex flex-col items-center"> 
                <button onClick={(e) => { e.stopPropagation(); toggleShapeMenu(); }} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border group z-20 relative ${isLightMode ? `border-black/20 text-black ${isShapeMenuOpen ? 'bg-black/20 scale-110' : 'bg-black/5 hover:bg-black/10'}` : `border-white/20 text-white ${isShapeMenuOpen ? 'bg-white/20 scale-110' : 'bg-white/5 hover:bg-white/10'}`}`} title="Şekil Değiştir">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-animate-wiggle"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                </button> 
                <div className={`absolute top-full flex flex-col gap-0 items-center w-10 pt-2 ${isShapeMenuOpen ? 'shape-menu-open' : ''}`}> 
                    <button onClick={() => handleShapeSelect('sphere')} className="theme-menu-item item-1 w-10 h-10 rounded-full border border-white/20 flex items-center justify-center transition-all bg-black/60 backdrop-blur text-white hover:scale-110 mb-1" title="Küre"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle></svg></button>
                    <button onClick={() => handleShapeSelect('cube')} className="theme-menu-item item-2 w-10 h-10 rounded-full border border-white/20 flex items-center justify-center transition-all bg-black/60 backdrop-blur text-white hover:scale-110 mb-1" title="Küp"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg></button>
                    <button onClick={() => handleShapeSelect('prism')} className="theme-menu-item item-3 w-10 h-10 rounded-full border border-white/20 flex items-center justify-center transition-all bg-black/60 backdrop-blur text-white hover:scale-110 mb-1" title="Prizma"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path></svg></button>
                    <button onClick={() => handleShapeSelect('star')} className="theme-menu-item item-4 w-10 h-10 rounded-full border border-white/20 flex items-center justify-center transition-all bg-black/60 backdrop-blur text-white hover:scale-110 mb-1" title="Yıldız"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></button>
                    <button onClick={() => handleShapeSelect('spiky')} className="theme-menu-item item-5 w-10 h-10 rounded-full border border-white/20 flex items-center justify-center transition-all bg-black/60 backdrop-blur text-white hover:scale-110 mb-1" title="Dikenli"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line></svg></button>
                </div> 
            </div> 
            
            {/* TEMA MENÜSÜ */}
            <div className="relative flex flex-col items-center"> 
                <button onClick={(e) => { e.stopPropagation(); toggleThemeMenu(); }} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border group z-20 relative ${isLightMode ? `border-black/20 text-black ${isThemeMenuOpen ? 'bg-black/20 scale-110' : 'bg-black/5 hover:bg-black/10'}` : `border-white/20 text-white ${isThemeMenuOpen ? 'bg-white/20 scale-110' : 'bg-white/5 hover:bg-white/10'}`}`} title="Tema ve Arka Plan">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-animate-spin"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path><path d="M16 16.5l-3 3"></path><path d="M11 11.5l-3 3"></path></svg>
                </button> 
                <div className={`absolute top-full flex flex-col gap-0 items-center w-10 pt-2 ${isThemeMenuOpen ? 'theme-menu-open' : ''}`}> 
                    <button onClick={() => { onBgModeChange('dark'); setIsThemeMenuOpen(false); }} className="theme-menu-item item-1 w-10 h-10 rounded-full border border-white/20 flex items-center justify-center transition-all bg-black/80 text-white hover:scale-110 mb-1" title="Karanlık Mod"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg></button>
                    <button onClick={() => { onBgModeChange('light'); setIsThemeMenuOpen(false); }} className="theme-menu-item item-2 w-10 h-10 rounded-full border border-white/20 flex items-center justify-center transition-all bg-white text-black hover:scale-110 mb-1" title="Aydınlık Mod"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line></svg></button>
                    <button onClick={() => { bgImageInputRef.current?.click(); }} className="theme-menu-item item-3 w-10 h-10 rounded-full border border-white/20 flex items-center justify-center transition-all bg-gray-800 text-white hover:scale-110 mb-1" title="Resim"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></button>
                    <button onClick={() => { setIsBgPaletteOpen(!isBgPaletteOpen); setIsThemeMenuOpen(false); }} className="theme-menu-item item-4 w-10 h-10 rounded-full border border-white/20 flex items-center justify-center transition-all bg-gradient-to-tr from-pink-500 to-purple-500 text-white hover:scale-110 mb-1" title="Renk"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="13.5" cy="6.5" r=".5"></circle><circle cx="17.5" cy="10.5" r=".5"></circle><circle cx="8.5" cy="7.5" r=".5"></circle><circle cx="6.5" cy="12.5" r=".5"></circle><path d="M12 22.5A9.5 9.5 0 0 0 22 12c0-4.9-4.5-9-10-9S2 7.1 2 12c0 2.25 1 5.38 2.5 7.5"></path></svg></button>
                    <button onClick={() => { onBgModeChange('gradient'); setIsThemeMenuOpen(false); }} className="theme-menu-item item-5 w-10 h-10 rounded-full border border-white/20 flex items-center justify-center transition-all bg-[linear-gradient(45deg,red,blue)] text-white hover:scale-110 mb-1" title="Disko"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg></button>
                    <button onClick={() => { onBgModeChange('auto'); setIsThemeMenuOpen(false); }} className="theme-menu-item item-6 w-10 h-10 rounded-full border border-white/20 flex items-center justify-center transition-all bg-gray-900 text-white hover:scale-110 mb-1" title="Auto"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg></button>
                </div> 
            </div> 
            
            {/* AYARLAR BUTONU */}
            <button onClick={(e) => { e.stopPropagation(); setIsSettingsOpen(!isSettingsOpen); setIsThemeMenuOpen(false); setIsShapeMenuOpen(false); setIsBgPaletteOpen(false); }} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border group ${isLightMode ? `border-black/20 text-black ${isSettingsOpen ? 'bg-black/20 rotate-90' : 'bg-black/5 hover:bg-black/10'}` : `border-white/20 text-white ${isSettingsOpen ? 'bg-white/20 rotate-90' : 'bg-white/5 hover:bg-white/10'}`}`} title="Konfigürasyon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-animate-spin"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button> 
          </div> 
      </div>

      {isSettingsOpen && ( 
        <div className={`absolute top-20 right-6 z-[60] w-80 backdrop-blur-2xl border border-white/20 rounded-3xl p-6 shadow-[0_30px_60px_rgba(0,0,0,0.8)] animate-config-pop origin-top-right cursor-default transition-colors duration-300 ${isLightMode ? 'bg-white/80 text-black border-black/10' : 'bg-[#0a0a0a]/90 text-white border-white/10'}`} onPointerDown={stopProp}> 
            {/* Header */}
            <div className={`flex justify-between items-center border-b pb-3 mb-4 ${isLightMode ? 'border-black/10' : 'border-white/10'}`}> <div className="flex items-center gap-2"> <div className={`w-2 h-2 rounded-full ${isLightMode ? 'bg-black' : 'bg-white'} animate-pulse`}></div> <h4 className="text-sm font-bold tracking-wide font-mono uppercase">Sistem Ayarları</h4> </div> <button onClick={() => setIsSettingsOpen(false)} className={`p-1 rounded-full transition-colors ${isLightMode ? 'hover:bg-black/10' : 'hover:bg-white/10'}`}> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"></path></svg> </button> </div> 
            
            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar"> 
                {/* Physics Section */}
                <div> <h5 className={`text-[10px] font-bold uppercase mb-3 opacity-60 flex items-center gap-2 ${isLightMode ? 'text-black' : 'text-white'}`}> <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg> Fizik Motoru </h5> <div className="space-y-4"> <div className="group"> <div className="flex justify-between mb-1.5"> <span className="text-xs font-medium opacity-80">İtme Kuvveti</span> <span className="text-xs font-mono font-bold text-blue-500">%{repulsionStrength}</span> </div> <div className="relative h-1.5 w-full rounded-full bg-gray-500/20 overflow-hidden"> <div className="absolute top-0 left-0 h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${repulsionStrength}%` }}></div> <input type="range" min="0" max="100" value={repulsionStrength} onChange={(e) => onRepulsionChange(parseInt(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" /> </div> </div> <div className="group"> <div className="flex justify-between mb-1.5"> <span className="text-xs font-medium opacity-80">Etki Alanı</span> <span className="text-xs font-mono font-bold text-purple-500">%{repulsionRadius}</span> </div> <div className="relative h-1.5 w-full rounded-full bg-gray-500/20 overflow-hidden"> <div className="absolute top-0 left-0 h-full bg-purple-500 rounded-full transition-all duration-300" style={{ width: `${repulsionRadius}%` }}></div> <input type="range" min="10" max="100" value={repulsionRadius} onChange={(e) => onRadiusChange(parseInt(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" /> </div> </div> </div> </div> 
                
                {/* Structure Section */}
                <div> <h5 className={`text-[10px] font-bold uppercase mb-3 opacity-60 flex items-center gap-2 ${isLightMode ? 'text-black' : 'text-white'}`}> <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg> Partikül Yapısı </h5> <div className="space-y-4"> <div className="group"> <div className="flex justify-between mb-1.5"> <span className="text-xs font-medium opacity-80">Yoğunluk (Adet)</span> <span className="text-xs font-mono font-bold text-green-500">{(particleCount / 1000).toFixed(1)}k</span> </div> <div className="relative h-1.5 w-full rounded-full bg-gray-500/20 overflow-hidden"> <div className="absolute top-0 left-0 h-full bg-green-500 rounded-full transition-all duration-300" style={{ width: `${(particleCount - 20000) / (60000 - 20000) * 100}%` }}></div> <input type="range" min="20000" max="60000" step="1000" value={particleCount} onChange={(e) => handleCountChange(parseInt(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" /> </div> </div> <div className="group"> <div className="flex justify-between mb-1.5"> <span className="text-xs font-medium opacity-80">Boyut</span> <span className="text-xs font-mono font-bold text-yellow-500">{particleSize}px</span> </div> <div className="relative h-1.5 w-full rounded-full bg-gray-500/20 overflow-hidden"> <div className="absolute top-0 left-0 h-full bg-yellow-500 rounded-full transition-all duration-300" style={{ width: `${(particleSize / 50) * 100}%` }}></div> <input type="range" min="1" max="50" value={particleSize} onChange={(e) => onParticleSizeChange(parseInt(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" /> </div> </div> <div className="group"> <div className="flex justify-between mb-1.5"> <span className="text-xs font-medium opacity-80">Form Sıkılığı</span> <span className="text-xs font-mono font-bold text-orange-500">%{modelDensity}</span> </div> <div className="relative h-1.5 w-full rounded-full bg-gray-500/20 overflow-hidden"> <div className="absolute top-0 left-0 h-full bg-orange-500 rounded-full transition-all duration-300" style={{ width: `${modelDensity}%` }}></div> <input type="range" min="0" max="100" value={modelDensity} onChange={(e) => onModelDensityChange(parseInt(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" /> </div> </div> </div> </div> 
                
                {/* --- VISUAL EFFECTS SECTION (UPDATED) --- */}
                <div>
                  <h5 className={`text-[10px] font-bold uppercase mb-3 opacity-60 flex items-center gap-2 ${isLightMode ? 'text-black' : 'text-white'}`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg> Görsel Efektler
                  </h5>
                  
                  {hasImage && ( 
                    <div className="group mb-4"> 
                      <div className="flex justify-between mb-1.5"> 
                        <span className="text-xs font-medium opacity-80">3D Kabartma</span> 
                        <span className="text-xs font-mono font-bold text-red-500">%{Math.round(depthIntensity * 10)}</span> 
                      </div> 
                      <div className="relative h-1.5 w-full rounded-full bg-gray-500/20 overflow-hidden"> 
                        <div className="absolute top-0 left-0 h-full bg-red-500 rounded-full transition-all duration-300" style={{ width: `${(depthIntensity / 20) * 100}%` }}></div> 
                        <input type="range" min="0" max="20" value={depthIntensity} onChange={(e) => onDepthChange(parseInt(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" /> 
                      </div> 
                    </div> 
                  )}

                  <div className="grid grid-cols-1 gap-2">
                      {/* BLOOM TOGGLE */}
                      <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/5 hover:bg-white/10 transition-colors">
                          <div className="flex flex-col">
                              <span className={`text-[10px] font-bold flex items-center gap-2 ${enableBloom ? 'text-pink-300' : 'text-gray-300'}`}>
                                  {enableBloom && <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse shadow-[0_0_5px_#f472b6]"></span>}
                                  Neon Parlama (Bloom)
                              </span>
                              <span className="text-[8px] text-gray-500 italic">Yüksek parlaklık efekti</span>
                          </div>
                          <button onClick={() => onToggleBloom && onToggleBloom()} className={`w-8 h-4 rounded-full relative transition-colors ${enableBloom ? 'bg-pink-600' : 'bg-white/10'}`}>
                              <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${enableBloom ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                      </div>

                      {/* TRAILS TOGGLE */}
                      <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/5 hover:bg-white/10 transition-colors">
                          <div className="flex flex-col">
                              <span className={`text-[10px] font-bold flex items-center gap-2 ${enableTrails ? 'text-blue-300' : 'text-gray-300'}`}>
                                  {enableTrails && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_5px_#3b82f6]"></span>}
                                  İz Efekti (Motion Blur)
                              </span>
                              <span className="text-[8px] text-gray-500 italic">Hız izleri bırakır</span>
                          </div>
                          <button onClick={() => onToggleTrails && onToggleTrails()} className={`w-8 h-4 rounded-full relative transition-colors ${enableTrails ? 'bg-blue-600' : 'bg-white/10'}`}>
                              <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${enableTrails ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                      </div>
                  </div>
                </div>

            </div> 
            
            <div className={`mt-6 pt-4 border-t flex justify-end ${isLightMode ? 'border-black/10' : 'border-white/10'}`}> <button onClick={onResetAll} className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-500 transition-colors shadow-lg shadow-red-900/30 flex items-center gap-2"> <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg> SIFIRLA </button> </div> 
        </div> 
      )}

      {/* --- BOTTOM CONTROL BAR --- */}
      <div className="absolute bottom-10 left-0 w-full flex justify-center items-center pointer-events-none z-[100] px-4">
        <div className={`pointer-events-auto w-full max-w-lg relative flex gap-2 items-center transition-transform duration-500 ${hideBottomClass}`} onPointerDown={stopProp}>
          {isPaletteOpen && ( <div className="absolute bottom-full right-0 translate-x-2 mb-2 bg-black/80 backdrop-blur-xl border border-white/20 p-2 rounded-xl shadow-2xl animate-in fade-in zoom-in duration-200 origin-bottom-right" onMouseEnter={() => onInteractionStart()} onMouseLeave={() => { if(!isDrawing) onColorChange(savedColor); onInteractionEnd(); }}> <div className="text-white/60 text-[10px] mb-1 font-mono text-center">Renk Seçici</div> <div className="w-48 h-32 rounded-lg cursor-crosshair relative overflow-hidden shadow-inner border border-white/10" onMouseMove={handleSpectrumMove} onClick={handleSpectrumClick} style={{ background: 'white' }}> <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)' }} /> <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0) 50%, rgba(0,0,0,1) 100%)' }} /> </div> </div> )}
          
          {/* --- CANLI SOHBET BUTONU (GEMINI LIVE) --- */}
          {!isDrawing && (
              <button
                  onClick={onToggleLive}
                  className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center transition-all duration-300 border mr-1 group relative overflow-hidden ${
                      isLiveActive 
                        ? (liveStatus === 'speaking' 
                            ? 'bg-green-500/20 text-green-300 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.4)]' 
                            : (liveStatus === 'connecting' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50 animate-pulse' : 'bg-blue-500/20 text-blue-300 border-blue-500/50'))
                        : (isLightMode 
                            ? 'bg-black/5 hover:bg-black/10 border-black/20 hover:border-blue-500 text-black/80 hover:text-blue-600' 
                            : 'bg-white/10 hover:bg-white/20 border-white/20 hover:border-blue-400 text-white hover:text-blue-300')
                  }`}
                  title={isLiveActive ? (liveStatus === 'speaking' ? "Konuşuyor..." : "Dinliyor...") : "Asistanla Sohbet Et"}
                  onMouseEnter={onInteractionStart} 
                  onMouseLeave={onInteractionEnd}
              >
                  {/* Rings for speaking state */}
                  {isLiveActive && liveStatus === 'speaking' && (
                      <>
                        <div className="absolute inset-0 rounded-full border border-green-400 opacity-0 animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
                        <div className="absolute inset-0 rounded-full border border-green-400 opacity-0 animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite_0.5s]"></div>
                      </>
                  )}

                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={isLiveActive ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`relative z-10 transition-transform duration-300 ${isLiveActive ? '' : 'group-hover:scale-110'} ${liveStatus === 'speaking' ? 'animate-bounce' : ''}`}>
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                      <line x1="12" y1="19" x2="12" y2="23"></line>
                      <line x1="8" y1="23" x2="16" y2="23"></line>
                  </svg>
              </button>
          )}

          {!isDrawing && (
              <button 
                onClick={() => { setShowAudioModal(true); onInteractionStart(); }} 
                className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center transition-all duration-300 border ${audioMode !== 'none' ? 'bg-green-500/20 text-green-300 border-green-500/50' : isLightMode ? 'bg-black/5 hover:bg-black/10 border-black/20 hover:border-black/50 text-black/80' : 'bg-white/10 hover:bg-white/20 border-white/20 hover:border-white/50 text-white'}`} 
                title="Müzik/Ses Ekle" 
                onMouseEnter={onInteractionStart} onMouseLeave={onInteractionEnd}
              >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-animate-wiggle"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
              </button>
          )}
          
          {!isDrawing && (<button onClick={() => fileInputRef.current?.click()} className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center transition-all duration-300 border ${isLightMode ? 'bg-black/5 hover:bg-black/10 border-black/20 hover:border-black/50 text-black/80' : 'bg-white/10 hover:bg-white/20 border-white/20 hover:border-white/50 text-white'}`} title="Resim Yükle" onMouseEnter={onInteractionStart} onMouseLeave={onInteractionEnd}><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-animate-bounce"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></button>)}
          <button onClick={isDrawing ? cancelDrawing : onDrawingStart} className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center transition-all duration-300 border ${isDrawing ? 'bg-red-500/20 text-red-200 border-red-500/50 hover:bg-red-500/40' : isLightMode ? 'bg-black/5 hover:bg-black/10 border-black/20 hover:border-black/50 text-black/80' : 'bg-white/10 hover:bg-white/20 border-white/20 hover:border-white/50 text-white'}`} title={isDrawing ? "Çizimi İptal Et" : "Çizim Yap"} onMouseEnter={onInteractionStart} onMouseLeave={onInteractionEnd}>{isDrawing ? (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-animate-wiggle"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>) : (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-animate-bounce"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path><path d="M2 2l7.586 7.586"></path><circle cx="11" cy="11" r="2"></circle></svg>)}</button>
          
          {!isDrawing && (<input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} onFocus={() => onInteractionStart()} onBlur={() => onInteractionEnd()} placeholder="Metin yazın (Türkçe destekli)..." className={`flex-1 backdrop-blur-md border rounded-full px-6 py-4 outline-none transition-all duration-300 shadow-lg text-center font-light tracking-wide text-lg ${isLightMode ? 'bg-black/5 border-black/10 text-black placeholder-gray-500 focus:bg-black/10 focus:border-black/30' : 'bg-white/10 border-white/20 text-white placeholder-gray-400 focus:bg-white/20 focus:border-white/50'}`} />)}

          {isDrawing && (<button onClick={onDrawingConfirm} className="w-16 flex-shrink-0 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 hover:border-green-400 text-green-100 rounded-full px-2 py-4 transition-all duration-300 shadow-lg text-center font-light tracking-wide flex items-center justify-center gap-2 group" title="Çizimi Dönüştür"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform icon-animate-pulse"><polyline points="20 6 9 17 4 12"></polyline></svg></button>)}
          <div className="flex items-center gap-2">
            {hasImage && !isOriginalColors && !isDrawing && (<button onClick={onResetColors} className="w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center bg-gradient-to-tr from-gray-800 to-gray-700 hover:from-gray-700 hover:to-gray-600 transition-all duration-300 border border-white/20 hover:border-white/50 text-white/80 hover:text-white animate-in fade-in zoom-in group" title="Orijinal Renklere Dön" onMouseEnter={onInteractionStart} onMouseLeave={onInteractionEnd}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-animate-spin"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg></button>)}
            <button onClick={() => setIsPaletteOpen(!isPaletteOpen)} className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center transition-all duration-300 border-2 z-20 group ${isLightMode ? 'bg-black/5 hover:bg-black/20 border-black/20 hover:border-black shadow-[0_0_15px_rgba(0,0,0,0.1)] hover:shadow-[0_0_20px_rgba(0,0,0,0.3)]' : 'bg-white/5 hover:bg-white/20 border-white/20 hover:border-white shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]'}`} title="Renk Paletini Aç" onMouseEnter={onInteractionStart} onMouseLeave={onInteractionEnd}><div className={`w-6 h-6 rounded-full shadow-sm icon-animate-pulse ${isLightMode ? 'border border-black/20' : 'border border-white/50'}`} style={{ backgroundColor: currentColor }} /></button>
             <button onClick={isDrawing ? onClearCanvas : onResetAll} className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center transition-all duration-300 border group ${isDrawing ? 'bg-orange-500/10 hover:bg-orange-500/30 hover:border-orange-400 border-white/20 text-white/70 hover:text-white' : isLightMode ? 'bg-red-500/10 hover:bg-red-500/30 hover:border-red-400 border-black/20 text-black/70 hover:text-black' : 'bg-red-500/10 hover:bg-red-500/30 hover:border-red-400 border-white/20 text-white/70 hover:text-white'}`} title="Tuvali Temizle" onMouseEnter={onInteractionStart} onMouseLeave={onInteractionEnd}>{isDrawing ? (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-animate-wiggle"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>) : (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-animate-spin"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M16 16h5v5"></path></svg>)}</button>
          </div>
        </div>
        {!isDrawing && (<div className={`absolute -bottom-6 text-center text-[10px] font-mono opacity-50 ${isLightMode ? 'text-black' : 'text-gray-500'}`}>Küre moduna dönmek için boş Enter</div>)}
      </div>

    </>
  );
});
