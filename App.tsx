
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type, LiveServerMessage, Modality, FunctionDeclaration, Tool } from "@google/genai"; // Import Gemini SDK
import { Experience } from './components/Experience';
import { UIOverlay } from './components/UIOverlay';
import { ClockWidget } from './components/ClockWidget';
import { Screensaver } from './components/Screensaver';
import { LyricsBox } from './components/LyricsBox';
import { PresetType, AudioMode, BackgroundMode, BgImageStyle, ShapeType, SlideshowSettings, LyricLine, SlideshowTransition, SongInfo } from './types';
import { getSongImages, saveSongImages, getSongLyrics, saveSongLyrics, getSongInfo, saveSongInfo } from './utils/db'; // Import DB Utils Updated

// Ekran Koruyucu Durumları (Kesin Sıralı - 5 Adım)
type ScreensaverState = 
    'idle' | 
    // GİRİŞ ADIMLARI
    'e1_app_blur' |      // 1. Ana ekran blur
    'e2_app_shrink' |    // 2. Ana ekran sıkışma - SS Opak ama aşağıda
    'e3_ss_slide_up' |   // 3. SS alttan gelme
    'e4_ss_unblur' |     // 4. SS netleşme
    'e5_ss_expand' |     // 5. SS büyüme
    'active' |           // Tam ekran aktif
    // ÇIKIŞ ADIMLARI (Tersi)
    'x1_ss_shrink' |     // 1. SS sıkışma
    'x2_ss_blur' |       // 2. SS blur
    'x3_ss_slide_down' | // 3. SS aşağı kayma
    'x4_app_expand' |    // 4. Ana ekran büyüme - SS aşağıda kalır
    'x5_app_unblur';     // 5. Ana ekran netleşme

// --- WORKER KODU (String olarak) ---
const WORKER_CODE = `
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.16.0/dist/transformers.min.js';

// Skip local model checks
env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber = null;

self.addEventListener('message', async (event) => {
    const { audio, language } = event.data;

    try {
        if (!transcriber) {
            self.postMessage({ status: 'loading_model' });
            // Whisper Base modelini yükle (Daha hassas, yaklaşık 200MB)
            transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base');
            self.postMessage({ status: 'model_ready' });
        }

        self.postMessage({ status: 'transcribing' });

        // Dil ayarını belirle
        const targetLang = (language === 'auto' || !language) ? null : language;

        // Analizi başlat
        const output = await transcriber(audio, {
            chunk_length_s: 30,
            stride_length_s: 5,
            language: targetLang, 
            task: 'transcribe',
            return_timestamps: true,
        });

        self.postMessage({ status: 'complete', output });

    } catch (error) {
        self.postMessage({ status: 'error', error: error.message });
    }
});
`;

// --- AUDIO UTILS FOR GEMINI LIVE ---
function floatTo16BitPCM(float32Array: Float32Array) {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
}

function base64EncodeAudio(float32Array: Float32Array) {
    const int16Buffer = floatTo16BitPCM(float32Array);
    let binary = '';
    const bytes = new Uint8Array(int16Buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function base64DecodeAudio(base64: string) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// --- TOOL DECLARATIONS ---
const toolsDeclarations: Tool[] = [
  {
    functionDeclarations: [
      {
        name: 'stopSession',
        description: 'Stop the voice assistant and disconnect immediately. Use when user says "close", "shut down", "goodbye", "stop listening".',
        parameters: { type: Type.OBJECT, properties: {} }
      },
      {
        name: 'resetSystem',
        description: 'Reset the entire application to default state. Clears canvas, settings, and audio.',
        parameters: { type: Type.OBJECT, properties: {} }
      },
      {
        name: 'controlBackground',
        description: 'Control the background image or mode. Can switch between images in the deck or change themes.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            action: { 
                type: Type.STRING, 
                enum: ['next_image', 'prev_image', 'random_image', 'dark_mode', 'light_mode', 'gradient_mode'],
                description: 'The action to perform on the background.'
            }
          },
          required: ['action']
        }
      },
      {
        name: 'changeVolume',
        description: 'Change the music volume level.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING, enum: ['set', 'increase', 'decrease', 'mute'], description: 'The type of volume change.' },
            value: { type: Type.NUMBER, description: 'The target volume level (0-100) for "set" action, or amount to change for increase/decrease.' }
          },
          required: ['action']
        }
      },
      {
        name: 'changeColor',
        description: 'Change the color of the particles. Use hex codes or color names.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            color: { type: Type.STRING, description: 'The color to set (e.g., #ff0000, blue, gold)' }
          },
          required: ['color']
        }
      },
      {
        name: 'changeShape',
        description: 'Change the 3D shape formed by the particles.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            shape: { type: Type.STRING, enum: ['sphere', 'cube', 'prism', 'star', 'spiky'], description: 'The target shape' }
          },
          required: ['shape']
        }
      },
      {
        name: 'setPreset',
        description: 'Apply a visual preset effect (fire, water, electric, etc.).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            preset: { type: Type.STRING, enum: ['none', 'fire', 'water', 'electric', 'mercury', 'disco'], description: 'The preset name' }
          },
          required: ['preset']
        }
      },
      {
        name: 'toggleBloom',
        description: 'Turn the neon glow (bloom) effect on or off.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            active: { type: Type.BOOLEAN, description: 'True to enable bloom, false to disable' }
          },
          required: ['active']
        }
      },
      {
        name: 'toggleMusic',
        description: 'Play or pause the current music.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            playing: { type: Type.BOOLEAN, description: 'True to play, false to pause' }
          },
          required: ['playing']
        }
      },
      {
        name: 'writeText',
        description: 'Write a specific text using particles.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING, description: 'The text to display' }
          },
          required: ['text']
        }
      }
    ]
  }
];

const App: React.FC = () => {
  const [currentText, setCurrentText] = useState<string>('');
  const [widgetUserText, setWidgetUserText] = useState<string>('');
  const [particleColor, setParticleColor] = useState<string>('#ffffff');
  
  // Arka Plan State'leri
  const [bgMode, setBgMode] = useState<BackgroundMode>('dark');
  const [customBgColor, setCustomBgColor] = useState<string>('#000000');
  
  // Çoklu Arka Plan Resmi Yönetimi
  const [bgImages, setBgImages] = useState<string[]>([]);
  const [bgImage, setBgImage] = useState<string | null>(null);
  
  // Refs for State Access inside Closures (Fixes "It didn't work" issues)
  const bgImagesRef = useRef<string[]>(bgImages);
  const bgImageRef = useRef<string | null>(bgImage);
  
  useEffect(() => { bgImagesRef.current = bgImages; }, [bgImages]);
  useEffect(() => { bgImageRef.current = bgImage; }, [bgImage]);

  // AI Generated Images
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [generatedPrompts, setGeneratedPrompts] = useState<string[]>([]); // New state for debug
  
  // AI Status Management
  const [imageGenStatus, setImageGenStatus] = useState<{
      state: 'idle' | 'loading' | 'success' | 'error' | 'warning';
      message: string;
  }>({ state: 'idle', message: '' });

  // Slayt Gösterisi State
  const [slideshowSettings, setSlideshowSettings] = useState<SlideshowSettings>({
      active: false,
      duration: 5,
      order: 'sequential',
      transition: 'fade'
  });
  // Fix: Rastgele geçiş için kararlı state (Strobe effect prevention)
  const [activeTransitionClass, setActiveTransitionClass] = useState('transition-opacity duration-700');
  
  const [croppedBgImage, setCroppedBgImage] = useState<string | null>(null); 
  const [bgImageStyle, setBgImageStyle] = useState<BgImageStyle>('cover');
  const [isWidgetMinimized, setIsWidgetMinimized] = useState<boolean>(false);
  const [isUIHidden, setIsUIHidden] = useState<boolean>(false);
  const [isSceneVisible, setIsSceneVisible] = useState<boolean>(true);
  const [currentShape, setCurrentShape] = useState<ShapeType>('sphere');
  const [imageSourceXY, setImageSourceXY] = useState<string | null>(null);
  const [imageSourceYZ, setImageSourceYZ] = useState<string | null>(null);
  const [useImageColors, setUseImageColors] = useState<boolean>(false);
  const [depthIntensity, setDepthIntensity] = useState<number>(0); 
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [brushSize, setBrushSize] = useState<number>(10);
  const [canvasRotation, setCanvasRotation] = useState<[number, number, number]>([0, 0, 0]);
  const [clearCanvasTrigger, setClearCanvasTrigger] = useState<number>(0);
  const [cameraResetTrigger, setCameraResetTrigger] = useState<number>(0);
  const getDrawingDataRef = useRef<{ getXY: () => string, getYZ: () => string } | null>(null);
  const [activePreset, setActivePreset] = useState<PresetType>('none');
  const [audioMode, setAudioMode] = useState<AudioMode>('none');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioTitle, setAudioTitle] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [volume, setVolume] = useState<number>(0.5);
  // Volume Ref for Live API
  const volumeRef = useRef<number>(volume);
  useEffect(() => { volumeRef.current = volume; }, [volume]);

  const [repulsionStrength, setRepulsionStrength] = useState<number>(50);
  const [repulsionRadius, setRepulsionRadius] = useState<number>(50);
  const [particleCount, setParticleCount] = useState<number>(40000); 
  const [particleSize, setParticleSize] = useState<number>(20); 
  const [modelDensity, setModelDensity] = useState<number>(50); 
  const [isUIInteraction, setIsUIInteraction] = useState<boolean>(false);
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(false);

  // --- Lyrics & Analysis State ---
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<string>('');
  const [showLyrics, setShowLyrics] = useState(false); // DOM Overlay Lyrics
  const [useLyricParticles, setUseLyricParticles] = useState(false); // 3D Particle Lyrics (DEFAULT FALSE for 2D)
  const [useLyricEcho, setUseLyricEcho] = useState(false); // Eko (Audio Reactivity) Toggle
  const [activeLyricText, setActiveLyricText] = useState<string>(''); // Currently sung line
  
  // --- Song Info State ---
  const [songInfo, setSongInfo] = useState<SongInfo | null>(null);
  const [showInfoPanel, setShowInfoPanel] = useState<boolean>(true); // User toggle for info panel
  
  // --- MOOD SYNC STATE ---
  const [isMoodSyncActive, setIsMoodSyncActive] = useState<boolean>(false); // Start false to prevent override
  
  // --- BLOOM / GLOW STATE ---
  const [enableBloom, setEnableBloom] = useState<boolean>(false);

  // --- TRAIL (PARTICLE TRAILS) STATE ---
  const [enableTrails, setEnableTrails] = useState<boolean>(false);

  // --- LIVE CHAT STATE (NEW) ---
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveStatus, setLiveStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'speaking'>('disconnected');
  const liveSessionRef = useRef<any>(null);
  const liveInputContextRef = useRef<AudioContext | null>(null);
  const liveOutputContextRef = useRef<AudioContext | null>(null);
  const liveAudioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const liveNextStartTimeRef = useRef<number>(0);

  // --- USER SETTINGS MEMORY (FOR REVERTING MOOD SYNC) ---
  const userSettingsRef = useRef({
      preset: activePreset,
      strength: repulsionStrength,
      density: modelDensity,
      color: particleColor,
      echo: useLyricEcho,
      bloom: enableBloom,
      trails: enableTrails
  });

  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const workerRef = useRef<Worker | null>(null);
  const hiddenAudioRef = useRef<HTMLAudioElement>(null); 
  const [isModelReady, setIsModelReady] = useState(false);
  
  // NEW: Robust ID Tracking & Versioning
  const analysisIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [audioVersion, setAudioVersion] = useState(0); // Bu değiştiğinde Player yeniden doğar
  
  // NEW: Audio Title Ref to avoid stale closures in worker callbacks
  const audioTitleRef = useRef<string | null>(null);

  // --- Audio Engine State (Centralized) ---
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | MediaStreamAudioSourceNode | null>(null);

  // --- Screensaver State ---
  const [ssState, setSsState] = useState<ScreensaverState>('idle');
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ssBgColor, setSsBgColor] = useState('#000000');
  const [ssTextColor, setSsTextColor] = useState('#ffffff');

  // Keep Ref updated
  useEffect(() => {
      audioTitleRef.current = audioTitle;
  }, [audioTitle]);

  // --- GEMINI LIVE CONNECTION HANDLER ---
  const connectToGeminiLive = async () => {
      if (!process.env.API_KEY) {
          setStatus('error', "API Anahtarı Eksik", true);
          return;
      }

      setLiveStatus('connecting');
      setIsLiveActive(true);

      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          
          // Setup Audio Contexts
          liveInputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
          liveOutputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          
          // Microphone Stream
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          
          const sessionPromise = ai.live.connect({
              model: 'gemini-2.5-flash-native-audio-preview-09-2025',
              callbacks: {
                  onopen: () => {
                      setLiveStatus('connected');
                      console.log("Gemini Live Connected");
                      
                      // Start Input Streaming
                      const ctx = liveInputContextRef.current;
                      if (ctx) {
                          const source = ctx.createMediaStreamSource(stream);
                          const processor = ctx.createScriptProcessor(4096, 1, 1);
                          
                          processor.onaudioprocess = (e) => {
                              const inputData = e.inputBuffer.getChannelData(0);
                              const base64Data = base64EncodeAudio(inputData);
                              
                              sessionPromise.then(session => {
                                  session.sendRealtimeInput({
                                      media: {
                                          mimeType: "audio/pcm;rate=16000",
                                          data: base64Data
                                      }
                                  });
                              });
                          };
                          
                          source.connect(processor);
                          processor.connect(ctx.destination);
                      }
                  },
                  onmessage: async (msg: LiveServerMessage) => {
                      // 1. Handle Tool Calls (Action)
                      if (msg.toolCall) {
                          for (const fc of msg.toolCall.functionCalls) {
                              console.log("Tool call received:", fc.name, fc.args);
                              
                              // Execute Action
                              if (fc.name === 'stopSession') {
                                  disconnectGeminiLive();
                              } else if (fc.name === 'resetSystem') {
                                  handleResetAll();
                              } else if (fc.name === 'changeColor') {
                                  setParticleColor(fc.args.color as string);
                                  // Eğer resim modundaysa orijinal renkleri kapat
                                  setUseImageColors(false);
                              } else if (fc.name === 'changeShape') {
                                  setCurrentShape(fc.args.shape as ShapeType);
                                  // Şekil değişince metni sıfırla ki şekil görünsün
                                  setCurrentText('');
                                  setIsSceneVisible(true);
                              } else if (fc.name === 'setPreset') {
                                  setActivePreset(fc.args.preset as PresetType);
                              } else if (fc.name === 'toggleBloom') {
                                  setEnableBloom(!!fc.args.active);
                              } else if (fc.name === 'toggleMusic') {
                                  setIsPlaying(!!fc.args.playing);
                              } else if (fc.name === 'writeText') {
                                  setCurrentText(fc.args.text as string);
                                  setIsSceneVisible(true);
                              } else if (fc.name === 'changeVolume') {
                                  // Volume Control
                                  const action = fc.args.action as string;
                                  let newVal = volumeRef.current;
                                  
                                  if (action === 'set') {
                                      newVal = (fc.args.value as number || 50) / 100;
                                  } else if (action === 'increase') {
                                      newVal = Math.min(1, newVal + (fc.args.value as number || 10) / 100);
                                  } else if (action === 'decrease') {
                                      newVal = Math.max(0, newVal - (fc.args.value as number || 10) / 100);
                                  } else if (action === 'mute') {
                                      newVal = 0;
                                  }
                                  setVolume(newVal);
                              } else if (fc.name === 'controlBackground') {
                                  const action = fc.args.action as string;
                                  
                                  if (action === 'dark_mode') {
                                      setBgMode('dark');
                                      setParticleColor('#ffffff');
                                  } else if (action === 'light_mode') {
                                      setBgMode('light');
                                      setParticleColor('#000000');
                                  } else if (action === 'gradient_mode') {
                                      setBgMode('gradient');
                                  } else if (['next_image', 'prev_image', 'random_image'].includes(action)) {
                                      // IMPORTANT: Use Ref to get CURRENT list, not closure list
                                      const currentImages = bgImagesRef.current;
                                      const currentBg = bgImageRef.current;
                                      
                                      if (currentImages && currentImages.length > 0) {
                                          setBgMode('image');
                                          let currentIndex = -1;
                                          if (currentBg) currentIndex = currentImages.indexOf(currentBg);
                                          
                                          let nextIndex = 0;
                                          if (action === 'next_image') {
                                              nextIndex = (currentIndex + 1) % currentImages.length;
                                          } else if (action === 'prev_image') {
                                              nextIndex = (currentIndex - 1 + currentImages.length) % currentImages.length;
                                          } else if (action === 'random_image') {
                                              nextIndex = Math.floor(Math.random() * currentImages.length);
                                          }
                                          
                                          const nextImg = currentImages[nextIndex];
                                          setBgImage(nextImg);
                                          // Slayt gösterisini durdur
                                          setSlideshowSettings(prev => ({ ...prev, active: false }));
                                      } else {
                                          console.warn("No images in deck to switch to");
                                      }
                                  }
                              }

                              // Send Response back to Model (Except for stopSession which closes connection)
                              if (fc.name !== 'stopSession') {
                                  sessionPromise.then(session => {
                                      session.sendToolResponse({
                                          functionResponses: [{
                                              id: fc.id,
                                              name: fc.name,
                                              response: { result: "Action executed successfully" }
                                          }]
                                      });
                                  });
                              }
                          }
                      }

                      // 2. Handle Audio Output (Voice)
                      const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                      if (audioData && liveOutputContextRef.current) {
                          setLiveStatus('speaking');
                          const ctx = liveOutputContextRef.current;
                          const buffer = await decodeAudioData(base64DecodeAudio(audioData), ctx, 24000);
                          
                          // Play Logic
                          liveNextStartTimeRef.current = Math.max(liveNextStartTimeRef.current, ctx.currentTime);
                          const source = ctx.createBufferSource();
                          source.buffer = buffer;
                          source.connect(ctx.destination);
                          
                          source.addEventListener('ended', () => {
                              liveAudioSourcesRef.current.delete(source);
                              if (liveAudioSourcesRef.current.size === 0) {
                                  setLiveStatus('connected');
                              }
                          });
                          
                          source.start(liveNextStartTimeRef.current);
                          liveNextStartTimeRef.current += buffer.duration;
                          liveAudioSourcesRef.current.add(source);
                      }
                      
                      if (msg.serverContent?.interrupted) {
                          // Clear queue if interrupted
                          liveAudioSourcesRef.current.forEach(s => {
                              try { s.stop(); } catch(e) {}
                          });
                          liveAudioSourcesRef.current.clear();
                          liveNextStartTimeRef.current = 0;
                          setLiveStatus('connected');
                      }
                  },
                  onclose: () => {
                      console.log("Gemini Live Closed");
                      disconnectGeminiLive();
                  },
                  onerror: (err) => {
                      console.error("Gemini Live Error", err);
                      setStatus('error', "Bağlantı Hatası");
                      disconnectGeminiLive();
                  }
              },
              config: {
                  responseModalities: [Modality.AUDIO],
                  speechConfig: {
                      voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
                  },
                  tools: toolsDeclarations, // ARTIK ARAÇLAR TANIMLI
                  systemInstruction: `Sen 'Partikül Yazı Morfolojisi' deneyiminin sesli asistanısın. Sitenin tüm özelliklerini kontrol edebilirsin.
                  
                  ÖNEMLİ: Kullanıcı "Kapat", "Görüşürüz", "Dinlemeyi durdur" derse 'stopSession' aracını kullan ve konuşmayı bitir.
                  
                  Kullanıcı "Arka planı değiştir", "Sıradaki resim", "Önceki resim" derse 'controlBackground' aracını kullan. Eğer hiç resim yüklenmemişse kullanıcıyı uyar.
                  "Sistemi sıfırla", "Baştan başlat" derse 'resetSystem' aracını kullan.
                  "Sesi aç", "Kıs", "%50 yap", "Kapat" gibi komutlarda 'changeVolume' aracını kullan.
                  
                  Diğer komutlar:
                  - "Rengi kırmızı yap" -> changeColor
                  - "Şekli küp yap" -> changeShape
                  - "Ateş efekti aç" -> setPreset
                  - "Müziği durdur/başlat" -> toggleMusic
                  - "Parlamayı aç/kapat" -> toggleBloom
                  - "Merhaba yaz" -> writeText
                  
                  Türkçe veya İngilizce cevap ver. Kısa, samimi ve onayı net cümleler kur. İşlemi yaparken "Hemen", "Yapıyorum", "Tamamdır" gibi geri bildirimler ver.`
              }
          });
          
          liveSessionRef.current = sessionPromise;

      } catch (e) {
          console.error("Connection Failed", e);
          setStatus('error', "Bağlantı Kurulamadı");
          disconnectGeminiLive();
      }
  };

  const disconnectGeminiLive = () => {
      setLiveStatus('disconnected');
      setIsLiveActive(false);
      
      // Close Contexts
      if (liveInputContextRef.current) liveInputContextRef.current.close();
      if (liveOutputContextRef.current) liveOutputContextRef.current.close();
      
      // Stop Sources
      liveAudioSourcesRef.current.forEach(s => {
          try { s.stop(); } catch(e){}
      });
      liveAudioSourcesRef.current.clear();
      
      // Close Session
      if (liveSessionRef.current) {
          liveSessionRef.current.then((session: any) => session.close());
          liveSessionRef.current = null;
      }
  };

  const toggleLiveConnection = () => {
      if (isLiveActive) {
          disconnectGeminiLive();
      } else {
          connectToGeminiLive();
      }
  };

  // --- HANDLER FOR MOOD SYNC TOGGLE ---
  const handleMoodSyncToggle = () => {
      if (!isMoodSyncActive) {
          // AÇILIYOR: Mevcut durumu kaydet (Snapshot)
          userSettingsRef.current = {
              preset: activePreset,
              strength: repulsionStrength,
              density: modelDensity,
              color: particleColor,
              echo: useLyricEcho,
              bloom: enableBloom,
              trails: enableTrails
          };
          setIsMoodSyncActive(true);
      } else {
          // KAPANIYOR: Eski duruma geri dön (Restore)
          setIsMoodSyncActive(false);
          setActivePreset(userSettingsRef.current.preset);
          setRepulsionStrength(userSettingsRef.current.strength);
          setModelDensity(userSettingsRef.current.density);
          setParticleColor(userSettingsRef.current.color);
          setUseLyricEcho(userSettingsRef.current.echo);
          setEnableBloom(userSettingsRef.current.bloom);
          setEnableTrails(userSettingsRef.current.trails);
      }
  };

  // --- MOOD SYNC EFFECT (Only Apply, Restoration is in Toggle) ---
  useEffect(() => {
    if (isMoodSyncActive && songInfo && songInfo.mood) {
        console.log(`Applying Mood: ${songInfo.mood}`);
        
        // 1. Color Application
        if (songInfo.suggestedColor) {
            setParticleColor(songInfo.suggestedColor);
        }

        // 2. Preset & Physics Mapping
        switch (songInfo.mood) {
            case 'energetic':
                setActivePreset('disco');
                setRepulsionStrength(85);
                setModelDensity(40);
                setUseLyricEcho(true); // Enerjik şarkılarda eko aç
                setEnableBloom(true); // Enerjik şarkılarda neon efektini aç
                setEnableTrails(true); // Enerjik şarkılarda izleri aç
                break;
            case 'calm':
                setActivePreset('water');
                setRepulsionStrength(25);
                setModelDensity(70);
                setEnableBloom(false);
                setEnableTrails(false);
                break;
            case 'sad':
                setActivePreset('mercury');
                setRepulsionStrength(35);
                setModelDensity(60);
                setEnableBloom(false);
                setEnableTrails(false);
                break;
            case 'mysterious':
                setActivePreset('electric');
                setRepulsionStrength(65);
                setModelDensity(55);
                setUseLyricEcho(true);
                setEnableBloom(true);
                setEnableTrails(true);
                break;
            case 'romantic':
                setActivePreset('none');
                setRepulsionStrength(40);
                setModelDensity(80);
                setEnableBloom(true);
                setEnableTrails(false);
                break;
        }
    }
  }, [songInfo, isMoodSyncActive]);

  // Helper to manage status timeout
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setStatus = (state: 'idle' | 'loading' | 'success' | 'error' | 'warning', message: string, autoClear = false) => {
      setImageGenStatus({ state, message });
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
      if (autoClear) {
          statusTimeoutRef.current = setTimeout(() => {
              setImageGenStatus({ state: 'idle', message: '' });
          }, 8000); // Increased duration to read messages
      }
  };

  // --- MP3 Cover Extraction ---
  const extractCoverArt = (file: File): Promise<string | null> => {
      return new Promise((resolve) => {
          if (typeof (window as any).jsmediatags === 'undefined') {
              console.warn("jsmediatags library not loaded");
              resolve(null);
              return;
          }

          (window as any).jsmediatags.read(file, {
              onSuccess: (tag: any) => {
                  const picture = tag.tags.picture;
                  if (picture) {
                      let base64String = "";
                      for (let i = 0; i < picture.data.length; i++) {
                          base64String += String.fromCharCode(picture.data[i]);
                      }
                      const base64 = "data:" + picture.format + ";base64," + window.btoa(base64String);
                      resolve(base64);
                  } else {
                      resolve(null);
                  }
              },
              onError: (error: any) => {
                  console.log("Cover art extract error:", error);
                  resolve(null);
              }
          });
      });
  };

  // --- Gemini Song Info Generation ---
  const generateSongInfo = async (lyricsText: string, songTitle: string, coverArt: string | null) => {
      if (!process.env.API_KEY) return;

      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          
          // Escape quotes in lyrics to prevent prompt injection or confusion
          const safeLyrics = lyricsText ? lyricsText.slice(0, 500).replace(/"/g, "'").replace(/\n/g, " ") : "";

          const prompt = `
            You are a music metadata API.
            Analyze the song "${songTitle}" based on its title and the following lyrics snippet:
            "${safeLyrics}..."
            
            Task 1: Identify the Artist using Google Search.
            Task 2: Explain the meaning (TR/EN).
            Task 3: Identify the mood/vibe. Choose exactly ONE from: "energetic", "calm", "sad", "mysterious", "romantic".
            Task 4: Suggest a vibrant CSS Hex Color that matches this mood.

            Output strictly valid JSON ONLY:
            {
                "artistName": "String",
                "artistBio": "String",
                "meaningTR": "String",
                "meaningEN": "String",
                "isAiGenerated": Boolean,
                "mood": "energetic" | "calm" | "sad" | "mysterious" | "romantic",
                "suggestedColor": "#hex"
            }
          `;

          const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: prompt,
              config: {
                  tools: [{googleSearch: {}}]
              }
          });

          const rawText = response.text || '{}';
          // Clean potential markdown blocks if the model adds them despite instructions
          let cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          
          // Robustly extract JSON block if there is extra text
          const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
              cleanJson = jsonMatch[0];
          } else {
              // If no JSON block is found, throw to trigger fallback
              throw new Error("No JSON object found in response");
          }
          
          let info;
          try {
            info = JSON.parse(cleanJson);
          } catch (parseError) {
            console.warn("JSON Parse failed", parseError);
            throw parseError;
          }

          const finalInfo: SongInfo = {
              artistName: info.artistName || songTitle,
              artistBio: info.artistBio || "Bilinmeyen Sanatçı",
              meaningTR: info.meaningTR || "Bilgi yok.",
              meaningEN: info.meaningEN || "No info.",
              coverArt: coverArt, 
              isAiGenerated: info.isAiGenerated || false,
              mood: info.mood,
              suggestedColor: info.suggestedColor
          };

          // Save to DB
          await saveSongInfo(songTitle, finalInfo);
          setSongInfo(finalInfo);

      } catch (e) {
          console.error("Song Info Gen Error:", e);
          // Fallback
          setSongInfo(prev => prev ? {
              ...prev,
              artistName: songTitle,
              artistBio: "Bilgi bulunamadı",
              meaningTR: "Şarkı analizi yapılamadı veya bağlantı hatası.",
              meaningEN: "Analysis failed or connection error.",
              isAiGenerated: true
          } : null);
      }
  };

  // --- AI IMAGE GENERATION (Gemini) ---
  const generateBackgrounds = async (lyricsText: string, songTitle: string) => {
      // 1. Önce Veritabanını Kontrol Et
      try {
          const cachedImages = await getSongImages(songTitle);
          if (cachedImages && cachedImages.length > 0) {
              setGeneratedImages(cachedImages);
              console.log("Görseller önbellekten yüklendi.");
              setStatus('success', 'Görseller Hafızadan Yüklendi', true);
              
              return cachedImages;
          }
      } catch (e) {
          console.error("Cache check failed", e);
      }

      // API Key kontrolü (Environment variable)
      if (!process.env.API_KEY) {
          console.warn("API Key eksik, görsel üretilemiyor.");
          setStatus('warning', 'API Anahtarı Eksik!', true);
          return null;
      }

      // Prompt Üretimi Başlıyor Mesajı
      setStatus('loading', 'Sahne Tasarlanıyor... (Promptlar Hazırlanıyor)');

      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

          // Girdi Kontrolü
          const cleanLyrics = lyricsText ? lyricsText.trim() : "";
          const contentPrompt = cleanLyrics.length > 20 
            ? `Analyze the mood, colors, and imagery of these song lyrics: "${cleanLyrics.slice(0, 800)}...".`
            : `Create an artistic visual interpretation for a song titled "${songTitle}".`;

          // 2. Prompt Üretimi (Lyrics -> 4 Abstract Prompt)
          let prompts: string[] = [];
          
          try {
              const promptResponse = await ai.models.generateContent({
                  model: 'gemini-3-flash-preview',
                  contents: `${contentPrompt} 
                  Based on this, create 4 distinct, artistic, abstract, and high-quality image generation prompts suitable for a web background wallpaper.
                  They should be visually stunning but not too busy.
                  Return ONLY a JSON array of 4 strings. Do not use Markdown code blocks.`,
                  config: { 
                      responseMimeType: 'application/json',
                      responseSchema: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING }
                      }
                  }
              });

              const rawText = promptResponse.text || '[]';
              // Markdown backticks temizle
              const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
              prompts = JSON.parse(cleanJson);
          } catch (promptError) {
              console.warn("Prompt generation failed, using fallback:", promptError);
              // Fallback prompts
              prompts = [
                  `Abstract artistic background for song ${songTitle}, vibrant colors, 4k`,
                  `Digital art visualization of music ${songTitle}, high quality wallpaper, atmospheric`,
                  `Dreamy landscape inspired by ${songTitle}, soft lighting, abstract shapes`,
                  `Geometric patterns and particles for music ${songTitle}, dark background, neon accents`
              ];
          }
          
          // CRITICAL: Set prompts immediately so user can download them even if image gen fails
          setGeneratedPrompts(prompts); 

          if (prompts.length === 0) {
               // Should trigger catch block below
               throw new Error("Prompt listesi boş");
          }

          setStatus('loading', 'Promptlar Hazır. Görseller Çiziliyor...');

          // 3. Görsel Üretimi (Parallel Requests)
          // gemini-2.5-flash-image kullanarak 4 görseli üretiyoruz.
          const imagePromises = prompts.map(async (prompt: string) => {
              try {
                  const result = await ai.models.generateContent({
                      model: 'gemini-2.5-flash-image',
                      contents: {
                          parts: [{ text: prompt }]
                      },
                      config: {
                          imageConfig: { aspectRatio: "16:9" }
                      }
                  });
                  // Extract Image
                  for (const part of result.candidates[0].content.parts) {
                      if (part.inlineData) {
                          return `data:image/png;base64,${part.inlineData.data}`;
                      }
                  }
              } catch (innerErr) {
                  console.error("Single image gen failed:", innerErr);
              }
              return null;
          });

          const results = await Promise.all(imagePromises);
          const validImages = results.filter(img => img !== null) as string[];

          // 4. Kaydet ve Göster
          if (validImages.length > 0) {
              await saveSongImages(songTitle, validImages);
              setGeneratedImages(validImages);
              setStatus('success', 'Tüm Görseller Hazırlandı!', true);
              return validImages;
          } else {
              // Görseller başarısız olsa bile promptlar var
              setStatus('warning', 'Görsel çizilemedi ancak promptlar hazır.', true);
              return null;
          }

      } catch (error: any) {
          console.error("AI Genel Hata:", error);
          let userMsg = 'İşlem Başarısız (Promptlar İndirilebilir)';
          if (error.message && error.message.includes('429')) userMsg = 'Hata: API Kotası Aşıldı';
          if (error.message && error.message.includes('403')) userMsg = 'Hata: API Yetkisi Yok';
          
          setStatus('error', userMsg, true);
          return null;
      } finally {
          // Analiz durumu temizle
          if(!isAnalyzing) setAnalysisStatus('');
      }
  };

  // --- Initialize Worker Function ---
  const initWorker = () => {
      if (workerRef.current) return; 

      try {
        const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        workerRef.current = new Worker(url, { type: 'module' });
        workerRef.current.onmessage = (event) => {
            const { status, output, error } = event.data;
            if (status === 'loading_model') setAnalysisStatus('AI Yükleniyor...');
            else if (status === 'model_ready') { setIsModelReady(true); setAnalysisStatus('Analiz Başlıyor...'); }
            else if (status === 'transcribing') setAnalysisStatus('Sözler Çıkarılıyor...');
            else if (status === 'complete') {
                // ŞARKI SÖZLERİ HAZIR
                const rawChunks = output.chunks || [];
                const formattedLyrics: LyricLine[] = [];
                const rawLyrics: LyricLine[] = [];
                let fullTextForImage = "";

                for (const chunk of rawChunks) {
                    let text = chunk.text;
                    if (text) {
                        fullTextForImage += text + " "; 
                        if(text.trim().length > 1) {
                             rawLyrics.push({ text: text.trim(), start: chunk.timestamp[0], end: chunk.timestamp[1] || chunk.timestamp[0] + 3 });
                        }
                    }
                    
                    if (!text) continue;

                    text = text.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').trim();
                    if (text.length < 2) continue;
                    const lower = text.toLowerCase();
                    if (lower === 'müzik' || lower === 'music' || lower === 'alkış' || lower === 'applause' || lower === 'sessizlik' || lower === 'silence' || lower.startsWith('altyazı')) continue;
                    const words = lower.replace(/[^a-zçğıöşü0-9 ]/g, '').split(/\s+/).filter((w: string) => w.length > 0);
                    if (words.length > 5) {
                        const uniqueWords = new Set(words);
                        if (uniqueWords.size < words.length * 0.3) { console.warn("Hallucination detected:", text); continue; }
                    }
                    formattedLyrics.push({ text: text, start: chunk.timestamp[0], end: chunk.timestamp[1] || chunk.timestamp[0] + 3 });
                }
                
                // Sözler ayarlandı
                let finalLyrics: LyricLine[] = [];
                if (formattedLyrics.length === 0) {
                    if (rawLyrics.length > 0) {
                        const filteredRaw = rawLyrics.filter(l => !l.text.includes('[Müzik]') && !l.text.includes('[Music]'));
                        finalLyrics = filteredRaw.length > 0 ? filteredRaw : [{ text: "...", start: 0, end: 5 }];
                    } else finalLyrics = [{ text: "...", start: 0, end: 5 }];
                } else finalLyrics = formattedLyrics;
                
                setLyrics(finalLyrics);
                setIsAnalyzing(false); 
                setUseLyricParticles(false); // DEFAULT 2D
                setShowLyrics(true); // GÖSTER

                // Use the Ref instead of the state directly to avoid stale closures
                const currentTitle = audioTitleRef.current;

                if (currentTitle) {
                    // *** YENİ: Sözleri Kaydet ***
                    saveSongLyrics(currentTitle, finalLyrics).catch(e => console.error("Lyrics save error", e));

                    // --- GÖRSEL ÜRETİMİ TETİKLE ---
                    // Kullanıcıya hemen bilgi ver
                    setAnalysisStatus('Analiz Tamamlandı!');
                    setStatus('loading', 'Görsel Üretimi Başlatılıyor...');

                    // Verinin worker'dan gelmesi bazen anlık olabiliyor, string birleştirmeyi garantiye alalım
                    const finalLyricsText = fullTextForImage || "";
                    
                    setTimeout(() => {
                         console.log("Calling generateBackgrounds with:", currentTitle);
                         generateBackgrounds(finalLyricsText, currentTitle)
                            .then((images) => {
                                // GÖRSEL ÜRETİMİ BİTTİKTEN SONRA BİLGİ ÜRETİMİ (Eğer mevcut değilse)
                                setSongInfo(prev => {
                                    // Eğer cover art yoksa ve AI görsel üretildiyse, ilk görseli kullan
                                    const art = prev?.coverArt || (images && images.length > 0 ? images[0] : null);
                                    
                                    // Bilgi üret
                                    generateSongInfo(finalLyricsText, currentTitle, art);
                                    
                                    // Geri dönüşte loading durumundan çıkması için kısmi update
                                    // Tam veri generateSongInfo içinde set edilecek.
                                    return prev ? { ...prev, coverArt: art } : null;
                                });
                            })
                            .catch(e => {
                             console.error("Gen Backgrounds Error:", e);
                             setStatus('error', "Üretim Başlatılamadı");
                         });
                    }, 500);
                } else {
                    console.warn("Audio title missing in worker callback", currentTitle);
                    setStatus('warning', 'Şarkı başlığı bulunamadı, görsel üretilemiyor.');
                }

            } else if (status === 'error') {
                console.error("AI Error:", error); 
                setIsAnalyzing(false); 
                setStatus('error', 'Ses Analizi Başarısız', true);
            }
        };
      } catch (e) { console.error("Worker creation failed:", e); }
  };

  useEffect(() => { return () => { if (workerRef.current) workerRef.current.terminate(); }; }, []);

  // --- Audio Analysis Function (Isolated) ---
  const analyzeAudio = async (url: string, lang: string = 'turkish', analysisId: number) => {
      // NOTE: Cache check is now done in handleAudioChange to prevent UI flashing
      // This function now only handles the actual expensive analysis work
      
      if (analysisId !== analysisIdRef.current) return;

      setIsAnalyzing(true); 
      initWorker();
      setAnalysisStatus('Ses İndiriliyor...');
      
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
          // Fetch separately from playback
          const response = await fetch(url, { signal: abortController.signal });
          const arrayBuffer = await response.arrayBuffer();
          
          if (analysisId !== analysisIdRef.current) return;

          setAnalysisStatus('İşleniyor...');
          // Use a completely separate context for decoding to avoid locking the main one
          const offlineCtx = new AudioContext({ sampleRate: 16000 }); 
          
          try {
              const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
              
              if (analysisId !== analysisIdRef.current) return;

              let audioData = audioBuffer.getChannelData(0);
              setAnalysisStatus('Yapay Zeka Dinliyor...');
              
              if (workerRef.current) {
                  workerRef.current.postMessage({ audio: audioData, language: lang });
              }
          } finally {
              offlineCtx.close();
          }
      } catch (e: any) {
          if (e.name !== 'AbortError' && analysisId === analysisIdRef.current) {
              console.error("Analysis failed:", e); 
              setIsAnalyzing(false); 
              setAnalysisStatus('Hata');
          }
      }
  };

  // --- Centralized Audio Context Management ---
  // Re-run whenever audioVersion changes (new song)
  useEffect(() => {
      if (audioMode === 'none') {
          if (audioContextRef.current) {
              audioContextRef.current.suspend();
          }
          return;
      }

      const initAudioContext = async () => {
          if (!audioContextRef.current) {
              const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
              audioContextRef.current = new AudioContextClass();
              
              const analyser = audioContextRef.current.createAnalyser();
              analyser.fftSize = 256;
              analyser.smoothingTimeConstant = 0.5;
              analyserRef.current = analyser;
          }

          const ctx = audioContextRef.current;
          const analyser = analyserRef.current;

          if (!ctx || !analyser) return;

          if (ctx.state === 'suspended') {
              await ctx.resume();
          }

          // Clean up old connections
          if (sourceNodeRef.current) {
              sourceNodeRef.current.disconnect();
              sourceNodeRef.current = null;
          }

          // Wait for DOM update
          setTimeout(() => {
              if (audioMode === 'file' && hiddenAudioRef.current) {
                  try {
                      const source = ctx.createMediaElementSource(hiddenAudioRef.current);
                      source.connect(analyser);
                      analyser.connect(ctx.destination); 
                      sourceNodeRef.current = source;
                  } catch (e) {
                      // Already connected error is fine here since we destroy the element
                  }
              } else if (audioMode === 'mic') {
                  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
                      const source = ctx.createMediaStreamSource(stream);
                      source.connect(analyser);
                      sourceNodeRef.current = source;
                  }).catch(e => console.error("Mic error", e));
              }
          }, 100);
      };

      initAudioContext();
  }, [audioMode, audioVersion]);

  // Sync Audio Time for Lyrics
  useEffect(() => {
      const audio = hiddenAudioRef.current;
      if (!audio) return;

      const updateTime = () => {
          const t = audio.currentTime;
          setAudioCurrentTime(t);
          
          if (lyrics.length > 0) {
              const activeLine = lyrics.find(l => t >= l.start && t < l.end);
              if (activeLine) {
                  setActiveLyricText(activeLine.text);
              }
          }
      };
      const updateDuration = () => setAudioDuration(audio.duration);
      
      // Events need to be re-attached because the element is new
      audio.addEventListener('timeupdate', updateTime);
      audio.addEventListener('loadedmetadata', updateDuration);
      
      return () => { 
          audio.removeEventListener('timeupdate', updateTime); 
          audio.removeEventListener('loadedmetadata', updateDuration); 
      };
  }, [audioVersion, lyrics]);

  // --- PLAYBACK CONTROL ---
  useEffect(() => {
      const audio = hiddenAudioRef.current;
      if (!audio) return;

      const playAudio = async () => {
          audio.volume = volume;
          if (isPlaying && audioUrl) {
              try {
                  await audio.play();
              } catch (e) {
                  console.warn("Autoplay prevented", e);
              }
          } else {
              audio.pause();
          }
      };
      
      // Small delay to ensure DOM is ready after remount
      const t = setTimeout(playAudio, 100);
      return () => clearTimeout(t);
  }, [isPlaying, volume, audioVersion, audioUrl]);


  // --- Slayt Gösterisi ve Transition Mantığı ---
  useEffect(() => {
      let intervalId: any;

      const getTransitionClassString = (t: SlideshowTransition) => {
          switch (t) {
              case 'slide-left': return 'animate-slide-left';
              case 'slide-right': return 'animate-slide-right';
              case 'slide-up': return 'animate-slide-up';
              case 'slide-down': return 'animate-slide-down';
              case 'fade': return 'animate-fade-in-out';
              case 'blur': return 'animate-blur-in-out';
              case 'transform': return 'animate-transform-zoom';
              case 'particles': return 'animate-pixelate';
              default: return 'transition-all duration-1000';
          }
      };

      if (slideshowSettings.active && bgImages.length > 1 && bgMode === 'image') {
          intervalId = setInterval(() => {
              setBgImages(currentImages => {
                  if (currentImages.length <= 1) return currentImages;
                  setBgImage(currentImg => {
                      const currentIndex = currentImages.indexOf(currentImg || '');
                      let nextIndex = 0;
                      if (slideshowSettings.order === 'random') {
                          do { nextIndex = Math.floor(Math.random() * currentImages.length); } while (nextIndex === currentIndex && currentImages.length > 1);
                      } else {
                          nextIndex = (currentIndex + 1) % currentImages.length;
                      }
                      return currentImages[nextIndex];
                  });
                  return currentImages;
              });
              setCroppedBgImage(null);

              let nextT = slideshowSettings.transition;
              if (nextT === 'random') {
                  const effects = ['slide-left', 'slide-right', 'slide-up', 'slide-down', 'fade', 'blur', 'transform'];
                  nextT = effects[Math.floor(Math.random() * effects.length)] as any;
              }
              setActiveTransitionClass(getTransitionClassString(nextT));

          }, Math.max(3000, slideshowSettings.duration * 1000));
      }
      return () => { if (intervalId) clearInterval(intervalId); };
  }, [slideshowSettings, bgImages.length, bgMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setActivePreset('none'); if (isDrawing) setIsDrawing(false); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawing]);

  // --- EKRAN KORUYUCU ---
  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (ssState !== 'idle') return;
          if (e.clientY <= 10 || e.clientY >= window.innerHeight - 10) {
              if (!hoverTimerRef.current) hoverTimerRef.current = setTimeout(() => setSsState('e1_app_blur'), 2000);
          } else { if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; } }
      };
      window.addEventListener('mousemove', handleMouseMove);
      return () => { window.removeEventListener('mousemove', handleMouseMove); if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); };
  }, [ssState]); 

  useEffect(() => {
      let timer: ReturnType<typeof setTimeout>;
      if (ssState === 'e1_app_blur') timer = setTimeout(() => setSsState('e2_app_shrink'), 300);
      else if (ssState === 'e2_app_shrink') timer = setTimeout(() => setSsState('e3_ss_slide_up'), 300);
      else if (ssState === 'e3_ss_slide_up') timer = setTimeout(() => setSsState('e4_ss_unblur'), 300);
      else if (ssState === 'e4_ss_unblur') timer = setTimeout(() => setSsState('e5_ss_expand'), 300);
      else if (ssState === 'e5_ss_expand') timer = setTimeout(() => setSsState('active'), 300);
      else if (ssState === 'x1_ss_shrink') timer = setTimeout(() => setSsState('x2_ss_blur'), 300);
      else if (ssState === 'x2_ss_blur') timer = setTimeout(() => setSsState('x3_ss_slide_down'), 300);
      else if (ssState === 'x3_ss_slide_down') timer = setTimeout(() => setSsState('x4_app_expand'), 300);
      else if (ssState === 'x4_app_expand') timer = setTimeout(() => setSsState('x5_app_unblur'), 300);
      else if (ssState === 'x5_app_unblur') timer = setTimeout(() => setSsState('idle'), 300);
      return () => { if (timer) clearTimeout(timer); };
  }, [ssState]);

  const handleScreensaverClick = () => { if (ssState === 'active') setSsState('x1_ss_shrink'); };

  // Handlers
  const handleBgModeChange = (mode: BackgroundMode, extraData?: string) => {
      setBgMode(mode);
      if (mode === 'light') { setParticleColor('#000000'); setUseImageColors(false); } else if (mode === 'dark') setParticleColor('#ffffff');
      if (mode === 'image' && extraData) { setBgImage(extraData); setCroppedBgImage(null); }
      if (mode === 'color' && extraData) setCustomBgColor(extraData);
  };
  const handleBgImagesAdd = (newImages: string[]) => {
      setBgImages(prev => [...prev, ...newImages]);
      if (!bgImage && newImages.length > 0) { setBgImage(newImages[0]); setCroppedBgImage(null); setBgMode('image'); }
  };
  const handleBgImageSelectFromDeck = (img: string) => { 
      setBgImage(img); 
      setCroppedBgImage(null); 
      setBgMode('image'); 
      // Slayt gösterisini durdur (Kullanıcı manuel seçim yaptı)
      setSlideshowSettings(prev => ({ ...prev, active: false }));
  };
  const handleApplyCrop = (croppedDataUrl: string) => { setCroppedBgImage(croppedDataUrl); setBgMode('image'); };
  const handleRemoveBgImage = (imgToRemove: string) => {
      setBgImages(prev => {
          const newList = prev.filter(img => img !== imgToRemove);
          if (bgImage === imgToRemove) {
              if (newList.length > 0) { setBgImage(newList[0]); setCroppedBgImage(null); } else { setBgImage(null); setCroppedBgImage(null); setBgMode('dark'); }
          }
          return newList;
      });
  };
  const handleDeckReset = (deleteImages: boolean, resetSize: boolean) => {
      if (deleteImages) { setBgImages([]); setBgImage(null); setCroppedBgImage(null); setBgMode('dark'); setSlideshowSettings(prev => ({ ...prev, active: false })); }
      if (resetSize) { setBgImageStyle('cover'); setCroppedBgImage(null); }
  };
  const handleBgImageStyleChange = (style: BgImageStyle) => { setBgImageStyle(style); if (style !== 'cover') setCroppedBgImage(null); };
  const handleTextSubmit = (text: string) => {
    setCurrentText(text); setImageSourceXY(null); setImageSourceYZ(null); setDepthIntensity(0); setIsDrawing(false); setCanvasRotation([0, 0, 0]); setCameraResetTrigger(prev => prev + 1); setIsSceneVisible(true); setShowLyrics(false);
  };
  const handleDualImageUpload = (imgXY: string | null, imgYZ: string | null, useOriginalColors: boolean, keepRotation = false) => {
    setImageSourceXY(imgXY); setImageSourceYZ(imgYZ); setUseImageColors(useOriginalColors); setCurrentText(''); setActivePreset('none'); setIsSceneVisible(true); setShowLyrics(false);
    if (isDrawing) { setDepthIntensity(0); setIsDrawing(false); if (!keepRotation) setCanvasRotation([0, 0, 0]); } else { setDepthIntensity(0); setCanvasRotation([0, 0, 0]); }
  };
  
  // *** FIXED: Explicitly sets image as background AND adds to deck ***
  const handleImageUpload = (imgSrc: string, useOriginalColors: boolean) => { 
      // 1. Particle System update (3D Scene)
      handleDualImageUpload(imgSrc, null, useOriginalColors, false);
      
      // 2. Add to Thumbnail Deck
      setBgImages(prev => [...prev, imgSrc]);
      
      // 3. Set as Background Wallpaper Immediately (User Feedback)
      setBgImage(imgSrc);
      setCroppedBgImage(null);
      setBgMode('image');
  };

  const handleDrawingStart = () => {
    setCurrentText(''); setImageSourceXY(null); setImageSourceYZ(null); setUseImageColors(false); setIsDrawing(true); setParticleColor(particleColor); setCanvasRotation([0, 0, 0]); setClearCanvasTrigger(prev => prev + 1); setIsSceneVisible(true); setShowLyrics(false);
  };
  const handleDrawingConfirm = () => {
    if (getDrawingDataRef.current) { const dataUrlXY = getDrawingDataRef.current.getXY(); const dataUrlYZ = getDrawingDataRef.current.getYZ(); handleDualImageUpload(dataUrlXY, dataUrlYZ, true, true); }
  };
  const handleColorChange = (color: string) => { setParticleColor(color); setActivePreset('none'); if ((imageSourceXY || imageSourceYZ) && !isDrawing) setUseImageColors(false); };
  const handleResetColors = () => { if (imageSourceXY || imageSourceYZ) setUseImageColors(true); };
  
  // *** MODIFIED HANDLE AUDIO CHANGE: Checks Cache FIRST ***
  const handleAudioChange = async (mode: AudioMode, url: string | null, title?: string, lang?: string) => { 
      // Clean title from extensions like .mp3, .wav etc.
      const cleanTitle = title ? title.replace(/\.(mp3|wav|ogg|m4a|flac)$/i, '') : null;

      // 1. New Version ID -> Kills old player
      const newAnalysisId = analysisIdRef.current + 1;
      analysisIdRef.current = newAnalysisId;

      // 2. Kill old analysis
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
      }
      if (workerRef.current) {
          workerRef.current.terminate();
          workerRef.current = null;
      }

      // 3. Force Element Re-render
      setAudioVersion(v => v + 1);

      // 4. Update State (Basic Audio)
      setAudioMode(mode); 
      setAudioUrl(url); 
      setAudioTitle(cleanTitle); 
      setIsPlaying(true);

      // 5. CACHE CHECK & LOGIC
      if (mode === 'file' && url && cleanTitle) {
          
          // EXTRACT COVER ART IF FILE
          if (audioInputRef.current?.files?.[0]) {
              const file = audioInputRef.current.files[0];
              // Check against original filename, not cleaned title
              if (file.name === title) {
                  extractCoverArt(file).then(cover => {
                      setSongInfo(prev => prev ? { ...prev, coverArt: cover } : null);
                  });
              }
          }

          // ** IMMEDIATE CACHE CHECK **
          try {
              const [cachedLyrics, cachedInfo, cachedImages] = await Promise.all([
                  getSongLyrics(cleanTitle),
                  getSongInfo(cleanTitle),
                  getSongImages(cleanTitle)
              ]);

              if (cachedLyrics && cachedLyrics.length > 0) {
                  console.log("CACHE HIT: Loading from DB");
                  
                  // Restore State Directly
                  setLyrics(cachedLyrics);
                  setUseLyricParticles(false); // DEFAULT 2D FROM CACHE
                  setShowLyrics(true); // SHOW 2D
                  setAnalysisStatus('Hafızadan Yüklendi');
                  setIsAnalyzing(false); // Stop loading spinner
                  
                  if (cachedImages && cachedImages.length > 0) {
                      setGeneratedImages(cachedImages);
                  }
                  
                  if (cachedInfo) {
                      // Info loaded perfectly
                      setSongInfo(cachedInfo);
                  } else {
                      // Info missing, generate partial
                      setSongInfo({
                          artistName: cleanTitle.split('-')[0]?.trim() || "Yükleniyor...",
                          artistBio: "Bilgi bulunamadı",
                          meaningTR: "Daha önce analiz edilmiş ancak detaylar eksik.",
                          meaningEN: "Previously analyzed but details missing.",
                          coverArt: null,
                          isAiGenerated: true
                      });
                  }
                  
                  // Exit function, do not trigger worker
                  return;
              }
          } catch (e) {
              console.warn("Cache check failed, proceeding to analysis", e);
          }

          // ** IF NOT IN CACHE **
          // Clear Previous Data & Show Loading
          setLyrics([]);
          setActiveLyricText(''); 
          setGeneratedImages([]); 
          setGeneratedPrompts([]);
          
          setSongInfo({
              artistName: cleanTitle?.split('-')[0]?.trim() || "Yükleniyor...",
              artistBio: "Analiz Ediliyor...",
              meaningTR: "...",
              meaningEN: "...",
              coverArt: null, 
              isAiGenerated: false
          });

          // Schedule Analysis
          setTimeout(() => {
              if (analysisIdRef.current === newAnalysisId) {
                  analyzeAudio(url, lang || 'turkish', newAnalysisId);
              }
          }, 1500); 

      } else { 
          // Reset if not file mode
          setIsAnalyzing(false); 
          setAnalysisStatus('');
          setLyrics([]);
          setShowLyrics(false); 
          setIsSceneVisible(true); 
      }
  };
  
  // Ref for file input needed for cover art extraction
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleClearCanvas = () => { setClearCanvasTrigger(prev => prev + 1); };
  const handleShapeChange = (shape: ShapeType) => { setCurrentShape(shape); setCurrentText(''); setImageSourceXY(null); setImageSourceYZ(null); setUseImageColors(false); setDepthIntensity(0); setIsSceneVisible(true); setShowLyrics(false); };
  const handleResetAll = () => {
    setCurrentText(''); setParticleColor('#ffffff'); setImageSourceXY(null); setImageSourceYZ(null); setUseImageColors(false); setDepthIntensity(0); setActivePreset('none'); setAudioMode('none'); setAudioUrl(null); setAudioTitle(null); setIsPlaying(true); setRepulsionStrength(50); setRepulsionRadius(50); setParticleCount(40000); setParticleSize(20); setModelDensity(50); setIsDrawing(false); setCanvasRotation([0, 0, 0]); setCurrentShape('sphere'); setCameraResetTrigger(prev => prev + 1); setBgMode('dark'); setIsSceneVisible(true); setBgImage(null); setCroppedBgImage(null); setSlideshowSettings(prev => ({...prev, active: false})); setIsAutoRotating(false); setShowLyrics(false); setLyrics([]); setIsAnalyzing(false); setUseLyricParticles(false); setActiveLyricText(''); setUseLyricEcho(false); setGeneratedImages([]); setGeneratedPrompts([]); setImageGenStatus({state:'idle', message:''}); setSongInfo(null); setEnableBloom(false); setEnableTrails(false);
    
    // CRITICAL: Clear file inputs to allow re-uploading the same file
    if (audioInputRef.current) audioInputRef.current.value = '';
    // Force re-render of audio element to clear source
    setAudioVersion(v => v + 1);
  };
  
  const rotateCanvasX = () => setCanvasRotation(prev => [prev[0] + Math.PI / 2, prev[1], prev[2]]);
  const rotateCanvasY = () => setCanvasRotation(prev => [prev[0], prev[1] + Math.PI / 2, prev[2]]);
  const rotateCanvasZ = () => setCanvasRotation(prev => [prev[0], prev[1], prev[2] + Math.PI / 2]);

  const displayImage = bgMode === 'image' ? (croppedBgImage || bgImage) : null;

  // --- Screensaver & App Layer Styles ---
  let appDuration = '0.25s', ssDuration = '0.25s';
  let appFilter = 'blur(0px) brightness(1)', appTransform = 'scale(1)', appInset = '0px', appRadius = '0px';
  let ssTransform = 'translateY(100%)', ssInset = '20px', ssBlur = 'blur(10px)', ssOpacity = '0', ssPointer = 'none', ssRadius = '30px', ssScale = '0.95';

  switch (ssState) {
      case 'idle': break;
      case 'e1_app_blur': appDuration = '0.25s'; appFilter = 'blur(0px) brightness(1)'; appInset = '20px'; appRadius = '30px'; appTransform = 'scale(0.95)'; break;
      case 'e2_app_shrink': appDuration = '0.25s'; appFilter = 'blur(10px) brightness(0.7)'; appInset = '20px'; appRadius = '30px'; appTransform = 'scale(0.95)'; ssDuration = '0.25s'; ssOpacity = '1'; ssTransform = 'translateY(100%)'; ssBlur = 'blur(10px)'; break;
      case 'e3_ss_slide_up': appFilter = 'blur(10px) brightness(0.5)'; appInset = '20px'; appRadius = '30px'; appTransform = 'scale(0.95)'; ssDuration = '0.25s'; ssOpacity = '1'; ssTransform = 'translateY(0)'; ssInset = '20px'; ssBlur = 'blur(10px)'; ssRadius = '30px'; ssScale = '0.95'; break;
      case 'e4_ss_unblur': appFilter = 'blur(10px) brightness(0.5)'; appInset = '20px'; appRadius = '30px'; appTransform = 'scale(0.95)'; ssDuration = '0.25s'; ssOpacity = '1'; ssTransform = 'translateY(0)'; ssBlur = 'blur(0px)'; ssInset = '20px'; ssRadius = '30px'; ssScale = '0.95'; break;
      case 'e5_ss_expand': appFilter = 'blur(10px) brightness(0.5)'; appInset = '20px'; appRadius = '30px'; appTransform = 'scale(0.95)'; ssDuration = '0.25s'; ssOpacity = '1'; ssTransform = 'translateY(0)'; ssBlur = 'blur(0px)'; ssInset = '0px'; ssRadius = '0px'; ssScale = '1'; break;
      case 'active': appFilter = 'blur(10px) brightness(0.5)'; appInset = '20px'; appRadius = '30px'; appTransform = 'scale(0.95)'; ssOpacity = '1'; ssPointer = 'auto'; ssTransform = 'translateY(0)'; ssBlur = 'blur(0px)'; ssInset = '0px'; ssRadius = '0px'; ssScale = '1'; break;
      case 'x1_ss_shrink': appFilter = 'blur(10px) brightness(0.5)'; appInset = '20px'; appRadius = '30px'; appTransform = 'scale(0.95)'; ssDuration = '0.25s'; ssOpacity = '1'; ssTransform = 'translateY(0)'; ssBlur = 'blur(0px)'; ssInset = '20px'; ssRadius = '30px'; ssScale = '0.95'; break;
      case 'x2_ss_blur': appFilter = 'blur(10px) brightness(0.5)'; appInset = '20px'; appRadius = '30px'; appTransform = 'scale(0.95)'; ssDuration = '0.25s'; ssOpacity = '1'; ssTransform = 'translateY(0)'; ssBlur = 'blur(10px)'; ssInset = '20px'; ssRadius = '30px'; ssScale = '0.95'; break;
      case 'x3_ss_slide_down': appFilter = 'blur(10px) brightness(0.5)'; appInset = '20px'; appRadius = '30px'; appTransform = 'scale(0.95)'; ssDuration = '0.25s'; ssOpacity = '1'; ssTransform = 'translateY(100%)'; ssBlur = 'blur(10px)'; ssInset = '20px'; ssRadius = '30px'; ssScale = '0.95'; break;
      case 'x4_app_expand': ssOpacity = '1'; ssTransform = 'translateY(100%)'; appDuration = '0.25s'; appFilter = 'blur(10px) brightness(0.7)'; appInset = '0px'; appRadius = '0px'; appTransform = 'scale(1)'; break;
      case 'x5_app_unblur': ssOpacity = '0'; ssDuration = '0.25s'; appDuration = '0.25s'; appFilter = 'blur(0px) brightness(1)'; appInset = '0px'; appRadius = '0px'; appTransform = 'scale(1)'; break;
  }

  const appLayerStyle: React.CSSProperties = { transition: `all ${appDuration} cubic-bezier(0.4, 0, 0.2, 1)`, position: 'absolute', overflow: 'hidden', zIndex: 0, filter: appFilter, transform: appTransform, top: appInset !== '0px' ? appInset : 0, left: appInset !== '0px' ? appInset : 0, right: appInset !== '0px' ? appInset : 0, bottom: appInset !== '0px' ? appInset : 0, width: appInset !== '0px' ? `calc(100% - ${parseInt(appInset)*2}px)` : '100%', height: appInset !== '0px' ? `calc(100% - ${parseInt(appInset)*2}px)` : '100%', borderRadius: appRadius };
  const ssLayerStyle: React.CSSProperties = { transition: `all ${ssDuration} cubic-bezier(0.4, 0, 0.2, 1)`, position: 'absolute', zIndex: 100, opacity: ssOpacity, pointerEvents: ssPointer as any, transform: ssTransform.includes('translate') ? `${ssTransform} scale(${ssScale})` : ssTransform, top: ssInset !== '0px' ? ssInset : 0, left: ssInset !== '0px' ? ssInset : 0, right: ssInset !== '0px' ? ssInset : 0, bottom: ssInset !== '0px' ? ssInset : 0, width: ssInset !== '0px' ? `calc(100% - ${parseInt(ssInset)*2}px)` : '100%', height: ssInset !== '0px' ? `calc(100% - ${parseInt(ssInset)*2}px)` : '100%', filter: ssBlur, borderRadius: ssRadius };

  // Prioritize Lyric Text over Current Text if enabled
  const displayParticlesText = (useLyricParticles && activeLyricText) ? activeLyricText : currentText;

  // Status Styling Logic
  let statusBg = "bg-purple-900/60 border-purple-400/20";
  let statusShadow = "shadow-[0_0_15px_#a855f7]";
  let statusIcon = <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>;

  if (imageGenStatus.state === 'success') {
      statusBg = "bg-green-900/60 border-green-400/20";
      statusShadow = "shadow-[0_0_15px_#22c55e]";
      statusIcon = <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>;
  } else if (imageGenStatus.state === 'error') {
      statusBg = "bg-red-900/60 border-red-400/20";
      statusShadow = "shadow-[0_0_15px_#ef4444]";
      statusIcon = <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>;
  } else if (imageGenStatus.state === 'warning') {
      statusBg = "bg-yellow-900/60 border-yellow-400/20";
      statusShadow = "shadow-[0_0_15px_#eab308]";
      statusIcon = <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>;
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      <style>{`
          @keyframes gradientMove { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
          @keyframes colorCycle { 0% { background-color: #ff0000; } 20% { background-color: #ffff00; } 40% { background-color: #00ff00; } 60% { background-color: #00ffff; } 80% { background-color: #0000ff; } 100% { background-color: #ff00ff; } }
          .animate-color-cycle { animation: colorCycle 10s infinite alternate linear; }
          /* ... (Diğer animasyonlar) ... */
          @keyframes slide-left { 0% { transform: translateX(100%); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } } .animate-slide-left { animation: slide-left 1s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
          @keyframes slide-right { 0% { transform: translateX(-100%); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } } .animate-slide-right { animation: slide-right 1s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
          @keyframes slide-up { 0% { transform: translateY(100%); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } } .animate-slide-up { animation: slide-up 1s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
          @keyframes slide-down { 0% { transform: translateY(-100%); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } } .animate-slide-down { animation: slide-down 1s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
          @keyframes fade-in-out { 0% { opacity: 0; } 100% { opacity: 1; } } .animate-fade-in-out { animation: fade-in-out 1.5s ease-in-out forwards; }
          @keyframes blur-in-out { 0% { filter: blur(20px); opacity: 0; } 100% { filter: blur(0px); opacity: 1; } } .animate-blur-in-out { animation: blur-in-out 1.2s ease-out forwards; }
          @keyframes transform-zoom { 0% { transform: scale(1.5) rotate(5deg); opacity: 0; } 100% { transform: scale(1) rotate(0deg); opacity: 1; } } .animate-transform-zoom { animation: transform-zoom 1.5s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
          @keyframes pixelate { 0% { filter: contrast(200%) brightness(500%) saturate(0); opacity: 0; transform: scale(1.2); } 50% { filter: contrast(100%) brightness(100%) saturate(1); opacity: 1; transform: scale(1); } 100% { opacity: 1; } } .animate-pixelate { animation: pixelate 1s steps(10) forwards; }
      `}</style>

      {audioUrl && (
          // KEY PROP IS CRITICAL HERE FOR RESETTING PLAYER
          <audio key={audioVersion} ref={hiddenAudioRef} src={audioUrl} loop hidden crossOrigin="anonymous" />
      )}

      <div id="app-layer" style={appLayerStyle} className="bg-black shadow-2xl">
          <div className="relative w-full h-full overflow-hidden">
            <div className="absolute inset-0 z-0 transition-colors duration-1000 ease-in-out" style={{ backgroundColor: bgMode === 'dark' ? '#000' : bgMode === 'light' ? '#fff' : bgMode === 'color' ? customBgColor : 'transparent' }}>
                {displayImage && (<img key={displayImage} src={displayImage} alt="background" className={`w-full h-full object-cover select-none pointer-events-none ${slideshowSettings.active ? activeTransitionClass : 'transition-opacity duration-700'}`} style={{ objectFit: bgImageStyle, objectPosition: 'center center' }} />)}
                {bgMode === 'gradient' && ( <div className="w-full h-full bg-[linear-gradient(45deg,#ff0000,#ff7300,#fffb00,#48ff00,#00ffd5,#002bff,#7a00ff,#ff00c8,#ff0000)] bg-[length:400%_400%] animate-gradient-xy opacity-80" style={{ animation: 'gradientMove 15s ease infinite' }} /> )}
                {bgMode === 'auto' && ( <div className="w-full h-full animate-color-cycle" /> )}
            </div>
            
            <ClockWidget isMinimized={isWidgetMinimized} onToggleMinimize={() => setIsWidgetMinimized(!isWidgetMinimized)} bgMode={bgMode} bgImageStyle={bgImageStyle} isUIHidden={isUIHidden} ssBgColor={ssBgColor} setSsBgColor={setSsBgColor} ssTextColor={ssTextColor} setSsTextColor={setSsTextColor} userText={widgetUserText} onUserTextChange={setWidgetUserText} />

            {/* Non-intrusive Analysis Indicator (Left/Center Top) */}
            {isAnalyzing && (
                <div className="absolute top-20 right-6 z-30 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 flex items-center gap-3 animate-pulse shadow-[0_0_15px_#3b82f6]">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-white text-xs font-mono tracking-wider">{analysisStatus}</span>
                </div>
            )}

            {/* AI Image Generation Status (Right Top - Stacked) */}
            {imageGenStatus.state !== 'idle' && (
                <div className={`absolute top-32 right-6 z-30 ${statusBg} backdrop-blur-md px-4 py-2 rounded-full border flex items-center gap-3 animate-in fade-in slide-in-from-right-5 duration-300 ${statusShadow}`}>
                    {statusIcon}
                    <span className="text-white text-xs font-mono tracking-wider">{imageGenStatus.message}</span>
                </div>
            )}

            {/* DOM Lyrics Box - Only show if Particles are disabled and we have lyrics */}
            {showLyrics && !useLyricParticles && ( <LyricsBox lyrics={lyrics} currentTime={audioCurrentTime} duration={audioDuration} audioRef={hiddenAudioRef} visible={showLyrics} /> )}

            <div className={`absolute inset-0 z-10 transition-all duration-1000 ${isSceneVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none blur-sm'}`}>
                <Experience 
                  text={displayParticlesText} 
                  imageXY={imageSourceXY} 
                  imageYZ={imageSourceYZ} 
                  useImageColors={useImageColors} 
                  particleColor={particleColor} 
                  disableInteraction={isUIInteraction} 
                  depthIntensity={depthIntensity} 
                  repulsionStrength={repulsionStrength} 
                  repulsionRadius={repulsionRadius} 
                  particleCount={particleCount} 
                  particleSize={particleSize} 
                  modelDensity={modelDensity} 
                  activePreset={activePreset} 
                  audioMode={audioMode} 
                  analyser={analyserRef.current} 
                  isPlaying={isPlaying} 
                  volume={volume} 
                  isDrawing={isDrawing} 
                  brushSize={brushSize} 
                  getDrawingDataRef={getDrawingDataRef} 
                  canvasRotation={canvasRotation} 
                  clearCanvasTrigger={clearCanvasTrigger} 
                  currentShape={currentShape} 
                  cameraResetTrigger={cameraResetTrigger} 
                  isSceneVisible={isSceneVisible} 
                  isAutoRotating={isAutoRotating} 
                  onStopAutoRotation={() => setIsAutoRotating(false)} 
                  enableAudioReactivity={useLyricEcho} 
                  enableBloom={enableBloom}
                  enableTrails={enableTrails} // Pass Trail State
                />
            </div>
            
            <UIOverlay 
                onSubmit={handleTextSubmit} 
                onImageUpload={handleImageUpload} 
                onDrawingStart={handleDrawingStart} 
                onDrawingConfirm={handleDrawingConfirm} 
                isDrawing={isDrawing} 
                brushSize={brushSize} 
                onBrushSizeChange={setBrushSize} 
                canvasRotation={canvasRotation} 
                onRotateX={rotateCanvasX} 
                onRotateY={rotateCanvasY} 
                onRotateZ={rotateCanvasZ} 
                currentColor={particleColor} 
                onColorChange={handleColorChange} 
                onResetColors={handleResetColors} 
                isOriginalColors={useImageColors} 
                onInteractionStart={() => setIsUIInteraction(true)} 
                onInteractionEnd={() => setIsUIInteraction(false)} 
                hasImage={!!imageSourceXY || !!imageSourceYZ} 
                depthIntensity={depthIntensity} 
                onDepthChange={setDepthIntensity} 
                repulsionStrength={repulsionStrength} 
                onRepulsionChange={setRepulsionStrength} 
                repulsionRadius={repulsionRadius} 
                onRadiusChange={setRepulsionRadius} 
                particleCount={particleCount} 
                onParticleCountChange={setParticleCount} 
                particleSize={particleSize} 
                onParticleSizeChange={setParticleSize} 
                modelDensity={modelDensity} 
                onModelDensityChange={setModelDensity} 
                activePreset={activePreset} 
                onPresetChange={setActivePreset} 
                onAudioChange={handleAudioChange} 
                audioMode={audioMode} 
                audioTitle={audioTitle} 
                isPlaying={isPlaying} 
                onTogglePlay={() => setIsPlaying(!isPlaying)} 
                volume={volume} 
                onVolumeChange={setVolume} 
                onResetAll={handleResetAll} 
                onClearCanvas={handleClearCanvas} 
                bgMode={bgMode} 
                onBgModeChange={handleBgModeChange} 
                onBgImageConfirm={(img, style) => {}} 
                customBgColor={customBgColor} 
                currentShape={currentShape} 
                onShapeChange={handleShapeChange} 
                isWidgetMinimized={isWidgetMinimized} 
                isUIHidden={isUIHidden} 
                onToggleUI={() => setIsUIHidden(!isUIHidden)} 
                isSceneVisible={isSceneVisible} 
                onToggleScene={() => { setIsSceneVisible(!isSceneVisible); if(lyrics.length > 0 && !isSceneVisible) setShowLyrics(true); else setShowLyrics(false); }} 
                bgImages={bgImages} 
                onBgImagesAdd={handleBgImagesAdd} 
                onBgImageSelect={handleBgImageSelectFromDeck} 
                onBgImageStyleChange={handleBgImageStyleChange} 
                bgImageStyle={bgImageStyle} 
                onRemoveBgImage={handleRemoveBgImage} 
                onBgTransformChange={handleApplyCrop} 
                onResetDeck={handleDeckReset} 
                slideshowSettings={slideshowSettings} 
                onSlideshowSettingsChange={setSlideshowSettings} 
                isAutoRotating={isAutoRotating} 
                onToggleAutoRotation={() => setIsAutoRotating(!isAutoRotating)} 
                useLyricParticles={useLyricParticles}
                onToggleLyricParticles={() => setUseLyricParticles(!useLyricParticles)}
                hasLyrics={lyrics.length > 0}
                useLyricEcho={useLyricEcho}
                onToggleLyricEcho={() => setUseLyricEcho(!useLyricEcho)}
                generatedImages={generatedImages} 
                generatedPrompts={generatedPrompts} 
                ref={audioInputRef} 
                songInfo={songInfo} 
                showInfoPanel={showInfoPanel && audioMode !== 'none'} 
                onToggleInfoPanel={() => setShowInfoPanel(!showInfoPanel)}
                isMoodSyncActive={isMoodSyncActive}
                onToggleMoodSync={handleMoodSyncToggle}
                // BLOOM PROPS
                enableBloom={enableBloom}
                onToggleBloom={() => setEnableBloom(!enableBloom)}
                // TRAIL PROPS
                enableTrails={enableTrails}
                onToggleTrails={() => setEnableTrails(!enableTrails)}
                // LYRIC UI PROPS
                showLyrics={showLyrics}
                onToggleShowLyrics={() => setShowLyrics(!showLyrics)}
                // LIVE CHAT PROPS
                isLiveActive={isLiveActive}
                liveStatus={liveStatus}
                onToggleLive={toggleLiveConnection}
            />
          </div>
      </div>

      <div id="screensaver-layer" style={ssLayerStyle} className="shadow-2xl">
          <Screensaver active={ssState === 'active' || ssState.startsWith('e') || ssState.startsWith('x')} onClick={handleScreensaverClick} bgColor={ssBgColor} textColor={ssTextColor} userText={widgetUserText} />
      </div>
    </div>
  );
};

export default App;
