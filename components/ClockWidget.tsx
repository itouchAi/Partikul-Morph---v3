
import React, { useState, useEffect, useRef } from 'react';
import { BackgroundMode, BgImageStyle } from '../types';

const FONTS = [
  { name: 'Sans Serif', value: 'ui-sans-serif, system-ui, sans-serif' },
  { name: 'Serif', value: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' },
  { name: 'Mono', value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' },
  { name: 'Cursive', value: '"Comic Sans MS", "Chalkboard SE", "Comic Neue", sans-serif' },
  { name: 'Fantasy', value: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif' },
];

interface ClockWidgetProps {
    isMinimized: boolean;
    onToggleMinimize: () => void;
    bgMode: BackgroundMode;
    bgImageStyle?: BgImageStyle; 
    isUIHidden?: boolean;
    ssBgColor?: string;
    setSsBgColor?: (color: string) => void;
    ssTextColor?: string;
    setSsTextColor?: (color: string) => void;
    userText: string;
    onUserTextChange: (text: string) => void;
}

// Weather Types
type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'snow' | 'unknown';
interface WeatherData {
    temp: number;
    condition: WeatherCondition;
    city: string;
}

export const ClockWidget: React.FC<ClockWidgetProps> = ({ 
    isMinimized, 
    onToggleMinimize, 
    bgMode, 
    bgImageStyle, 
    isUIHidden = false,
    ssBgColor = '#000000',
    setSsBgColor,
    ssTextColor = '#ffffff',
    setSsTextColor,
    userText,
    onUserTextChange
}) => {
  const [time, setTime] = useState(new Date());
  const [showSettings, setShowSettings] = useState(false);
  const [isClosing, setIsClosing] = useState(false); 
  const [internalMinimized, setInternalMinimized] = useState(isMinimized); 

  const [tempText, setTempText] = useState('');
  const [selectedFont, setSelectedFont] = useState(FONTS[0].value);
  const [fontSize, setFontSize] = useState(14); 
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  
  const [hideInCleanMode, setHideInCleanMode] = useState(false);

  // --- Screensaver Color Picker State ---
  const [activeColorPicker, setActiveColorPicker] = useState<'none' | 'bg' | 'text'>('none');

  // --- Weather State ---
  const [useLocation, setUseLocation] = useState(true); // Varsayılan Açık
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>('C');
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  useEffect(() => {
      if (!isMinimized) {
          setInternalMinimized(false);
          setIsClosing(false);
      } else if (!isClosing && !internalMinimized) {
          setInternalMinimized(true);
      }
  }, [isMinimized]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchWeather = () => {
      if (useLocation && navigator.geolocation) {
          setWeatherLoading(true);
          navigator.geolocation.getCurrentPosition(
              async (position) => {
                  try {
                      const { latitude, longitude } = position.coords;
                      
                      // 1. Fetch Weather Data
                      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
                      const weatherJson = await weatherRes.json();
                      
                      // 2. Fetch City Name
                      const cityRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
                      const cityJson = await cityRes.json();

                      const code = weatherJson.current_weather.weathercode;
                      let condition: WeatherCondition = 'clear';
                      if (code >= 1 && code <= 3) condition = 'cloudy';
                      else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) condition = 'rain';
                      else if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) condition = 'snow';
                      else if (code > 3) condition = 'cloudy';

                      let cityName = cityJson.city || cityJson.locality || "LOC";
                      cityName = cityName.substring(0, 3).toUpperCase();

                      setWeatherData({
                          temp: weatherJson.current_weather.temperature,
                          condition: condition,
                          city: cityName
                      });
                  } catch (error) {
                      console.error("Weather fetch failed", error);
                      setWeatherData(null);
                  } finally {
                      setWeatherLoading(false);
                  }
              },
              (error) => {
                  console.warn("Location permission denied", error);
                  setUseLocation(false);
                  setWeatherLoading(false);
              }
          );
      }
  };

  // Initial Fetch & Interval
  useEffect(() => {
      fetchWeather();
      // Update weather every 15 minutes
      const interval = setInterval(fetchWeather, 900000); 
      return () => clearInterval(interval);
  }, [useLocation]);

  const formatTime = (date: Date) => date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formatDate = (date: Date) => date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const getDayName = (date: Date) => date.toLocaleDateString('tr-TR', { weekday: 'long' });

  const handleMinimizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSettings(false);
    setIsClosing(true); 
    setTimeout(() => {
        setInternalMinimized(true);
        setIsClosing(false);
        onToggleMinimize(); 
    }, 900);
  };

  const handleMaximize = (e: React.MouseEvent) => {
      e.stopPropagation();
      setInternalMinimized(false); 
      onToggleMinimize(); 
  };

  const handleSettingsOpen = (e: React.MouseEvent) => {
      e.stopPropagation();
      setTempText(userText); 
      setShowSettings(true);
      setActiveColorPicker('none');
  };

  const saveSettings = () => {
      onUserTextChange(tempText);
      setShowSettings(false);
  };

  // Color Picker Logic
  const handleSpectrumClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const hue = x * 360;
      // Basitlik için lightness'ı ortada tutuyoruz veya dikey eksen ekleyebiliriz.
      // Yatay eksen sadece Hue olsun.
      const color = `hsl(${hue}, 100%, 50%)`;
      
      if (activeColorPicker === 'bg' && setSsBgColor) setSsBgColor(color);
      if (activeColorPicker === 'text' && setSsTextColor) setSsTextColor(color);
  };

  // --- Display Colors Logic ---
  const isEffectiveDarkMode = bgMode === 'dark' || (bgMode === 'image' && bgImageStyle === 'contain');
  const isContrastMode = !isEffectiveDarkMode && bgMode !== 'light';
  
  let glassClass = "";
  let textClass = ""; 
  let subTextClass = ""; 
  let iconClass = "";

  if (isEffectiveDarkMode) {
      glassClass = "glass-panel-light";
      textClass = "text-transparent bg-gradient-to-b from-white to-white/70 bg-clip-text";
      subTextClass = "text-gray-300";
      iconClass = "text-white/80 hover:text-white";
  } else if (bgMode === 'light') {
      glassClass = "glass-panel-dark";
      textClass = "text-transparent bg-gradient-to-b from-white to-white/70 bg-clip-text";
      subTextClass = "text-gray-300";
      iconClass = "text-white/80 hover:text-white";
  } else {
      glassClass = "glass-panel-light";
      textClass = "text-black drop-shadow-none"; 
      subTextClass = "text-black/70";
      iconClass = "text-black/60 hover:text-black border-black/20";
  }

  const minimizedClass = isContrastMode ? "minimized-light" : (bgMode === 'light' ? "minimized-dark" : "minimized-light");
  const minimizedIconColor = isContrastMode ? "stroke-black" : "stroke-white";
  const shouldHide = isUIHidden && hideInCleanMode;
  const hideClass = shouldHide ? "opacity-0 -translate-y-full pointer-events-none" : "opacity-100 translate-y-0";

  // --- Render Animated Weather Icon ---
  const renderWeatherIcon = (condition: WeatherCondition) => {
      const strokeColor = isContrastMode ? "black" : "white";
      const fillColor = isContrastMode ? "black" : "white";

      if (condition === 'clear') {
          return (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="overflow-visible">
                  <g className="origin-center animate-spin-slow-custom">
                      <circle cx="12" cy="12" r="5" fill={fillColor} fillOpacity="0.2" stroke={strokeColor} strokeWidth="1.5" />
                      <path d="M12 2V4 M12 20V22 M4.93 4.93L6.34 6.34 M17.66 17.66L19.07 19.07 M2 12H4 M20 12H22 M4.93 19.07L6.34 17.66 M17.66 6.34L19.07 4.93" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
                  </g>
              </svg>
          );
      }
      if (condition === 'cloudy') {
          return (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="overflow-visible">
                  <path d="M16 19H7a4 4 0 0 1 0-8 3 3 0 0 1 3-3 4.5 4.5 0 0 1 5.6 1.5 2.5 2.5 0 0 1 .4 4.5" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="animate-cloud-drift-1" fill={fillColor} fillOpacity="0.1" />
                  <path d="M19 12H18.5" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M14 17H19a3 3 0 0 0 0-6 2.5 2.5 0 0 0-3.5 1" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="animate-cloud-drift-2 opacity-70" />
              </svg>
          );
      }
      if (condition === 'rain') {
          return (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="overflow-visible">
                  <path d="M16 16H7a4 4 0 0 1 0-8 3 3 0 0 1 3-3 4.5 4.5 0 0 1 5.6 1.5 2.5 2.5 0 0 1 2.4 4.5" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill={fillColor} fillOpacity="0.1" />
                  <line x1="8" y1="18" x2="8" y2="22" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" className="animate-rain-fall-1" />
                  <line x1="12" y1="18" x2="12" y2="22" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" className="animate-rain-fall-2" />
                  <line x1="16" y1="18" x2="16" y2="22" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" className="animate-rain-fall-3" />
              </svg>
          );
      }
      if (condition === 'snow') {
          return (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="overflow-visible">
                  <path d="M16 16H7a4 4 0 0 1 0-8 3 3 0 0 1 3-3 4.5 4.5 0 0 1 5.6 1.5 2.5 2.5 0 0 1 2.4 4.5" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill={fillColor} fillOpacity="0.1" />
                  <circle cx="8" cy="20" r="1" fill={strokeColor} className="animate-snow-fall-1" />
                  <circle cx="12" cy="20" r="1" fill={strokeColor} className="animate-snow-fall-2" />
                  <circle cx="16" cy="20" r="1" fill={strokeColor} className="animate-snow-fall-3" />
              </svg>
          );
      }
      return null;
  }

  return (
    <>
      <style>{`
        @keyframes marquee-one-way { 0% { transform: translateX(0%); } 100% { transform: translateX(-100%); } }
        .marquee-container { display: flex; overflow: hidden; white-space: nowrap; mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent); }
        .animate-marquee-one-way { display: inline-block; padding-left: 100%; animation: marquee-one-way 8s linear infinite; }
        
        /* Maximize Animasyonu */
        @keyframes open-slow { 0% { opacity: 0; transform: scale(0.6) translateY(-20px) rotateX(20deg); filter: blur(10px); } 60% { opacity: 1; transform: scale(1.02) translateY(5px); filter: blur(0px); } 100% { opacity: 1; transform: scale(1) translateY(0) rotateX(0deg); } }
        .animate-open-slow { animation: open-slow 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        
        /* Minimize Animasyonu */
        @keyframes close-slow { 0% { opacity: 1; transform: scale(1); filter: blur(0px); } 100% { opacity: 0; transform: scale(0.8) translateY(-20px); filter: blur(10px); } }
        .animate-close-slow { animation: close-slow 0.9s cubic-bezier(0.32, 0, 0.67, 0) forwards; pointer-events: none; }
        
        @keyframes menu-pop-fast { 0% { opacity: 0; transform: scale(0.8) translateY(-10px); filter: blur(4px); } 60% { transform: scale(1.05) translateY(0); filter: blur(0px); } 100% { opacity: 1; transform: scale(1); } }
        .animate-config-pop { animation: menu-pop-fast 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        
        @keyframes vfx-entry { 0% { opacity: 0; transform: translateY(15px); filter: blur(5px); } 100% { opacity: 1; transform: translateY(0); filter: blur(0px); } }
        .vfx-item { opacity: 0; animation: vfx-entry 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        
        /* Weather Animations */
        @keyframes spin-slow-custom { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow-custom { animation: spin-slow-custom 12s linear infinite; }

        @keyframes cloud-drift { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(2px); } }
        .animate-cloud-drift-1 { animation: cloud-drift 4s ease-in-out infinite; }
        .animate-cloud-drift-2 { animation: cloud-drift 5s ease-in-out infinite reverse; }

        @keyframes rain-fall { 0% { transform: translateY(0); opacity: 0; } 50% { opacity: 1; } 100% { transform: translateY(4px); opacity: 0; } }
        .animate-rain-fall-1 { animation: rain-fall 1s linear infinite; animation-delay: 0s; }
        .animate-rain-fall-2 { animation: rain-fall 1s linear infinite; animation-delay: 0.3s; }
        .animate-rain-fall-3 { animation: rain-fall 1s linear infinite; animation-delay: 0.6s; }

        @keyframes snow-fall { 0% { transform: translateY(0); opacity: 0; } 50% { opacity: 1; } 100% { transform: translateY(4px); opacity: 0; } }
        .animate-snow-fall-1 { animation: snow-fall 2s linear infinite; animation-delay: 0s; }
        .animate-snow-fall-2 { animation: snow-fall 2.5s linear infinite; animation-delay: 0.5s; }
        .animate-snow-fall-3 { animation: snow-fall 2.2s linear infinite; animation-delay: 1s; }
        
        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.2s; }
        .delay-3 { animation-delay: 0.3s; }
        .delay-4 { animation-delay: 0.4s; }
        .delay-5 { animation-delay: 0.5s; }
        .delay-6 { animation-delay: 0.6s; }
        
        .glass-panel-light { background: linear-gradient(145deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.05)); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.2); box-shadow: 0px 15px 35px rgba(0, 0, 0, 0.2); }
        .minimized-light { background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.3); box-shadow: 0 0 15px rgba(255, 255, 255, 0.2); }
        .glass-panel-dark { background: linear-gradient(145deg, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.5)); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0px 15px 35px rgba(0, 0, 0, 0.4); }
        .minimized-dark { background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2); box-shadow: 0 0 15px rgba(0, 0, 0, 0.3); }
      `}</style>

      <div className={`absolute top-6 left-6 z-[60] origin-top-left select-none transition-all duration-500 ${hideClass}`}>
        {internalMinimized ? (
          <div onClick={handleMaximize} className={`w-12 h-12 rounded-full cursor-pointer flex items-center justify-center group ${minimizedClass} hover:scale-110 transition-transform duration-300`}>
              <div className="relative">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`drop-shadow-md group-hover:rotate-180 transition-transform duration-500 ${minimizedIconColor}`}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  <div className="absolute inset-0 bg-blue-500/30 blur-md rounded-full -z-10 animate-pulse"></div>
              </div>
          </div>
        ) : (
          <div className={`relative w-min max-w-full rounded-3xl p-5 group ${glassClass} ${isClosing ? 'animate-close-slow' : 'animate-open-slow'}`}>
             <div className="absolute -top-3 -right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 scale-90">
                <button onClick={handleSettingsOpen} className={`p-1.5 rounded-full backdrop-blur-md shadow-lg transition-colors ${isContrastMode ? 'bg-white/60 border border-black/10 text-black hover:bg-white' : 'bg-black/60 border border-white/20 text-white/80 hover:text-white'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 0-2.83 2 2 0 0 1 0-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                </button>
                <button onClick={handleMinimizeStart} className={`p-1.5 rounded-full backdrop-blur-md shadow-lg transition-colors ${isContrastMode ? 'bg-white/60 border border-black/10 text-black hover:bg-white' : 'bg-black/60 border border-white/20 text-white/80 hover:text-white'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
             </div>
             <div className="flex flex-col items-center min-w-[180px]">
                 <div className={`font-mono tracking-tighter mb-1 text-center transition-all duration-300 whitespace-nowrap pr-4 ${textClass} vfx-item delay-1`} style={{ fontFamily: selectedFont, fontSize: `${fontSize * 3.0}px`, fontWeight: isBold ? 'bold' : 'normal', fontStyle: isItalic ? 'italic' : 'normal', lineHeight: 1.0 }}>{formatTime(time)}</div>
                 
                 {/* Alt Bölüm: Tarih ve Hava Durumu Split */}
                 <div className={`flex items-center ${useLocation ? 'justify-between px-1' : 'justify-center'} border-t pt-2 mb-1 w-full transition-all duration-300 ${isContrastMode ? 'border-black/10' : 'border-white/10'} vfx-item delay-2 gap-4`}>
                    
                    {/* Sol: Tarih */}
                    <div className={`flex flex-col ${useLocation ? 'items-start' : 'items-center'}`}>
                        <span className={`font-medium tracking-wide ${textClass} opacity-90`} style={{ fontFamily: selectedFont, fontSize: `${Math.max(10, fontSize * 0.9)}px`, fontWeight: isBold ? 'bold' : 'normal', fontStyle: isItalic ? 'italic' : 'normal' }}>{getDayName(time)}</span>
                        <span className={subTextClass} style={{ fontFamily: selectedFont, fontSize: `${Math.max(9, fontSize * 0.8)}px`, fontWeight: isBold ? 'bold' : 'normal', fontStyle: isItalic ? 'italic' : 'normal' }}>{formatDate(time)}</span>
                    </div>

                    {/* Sağ: Hava Durumu (Sadece useLocation açıkken görünür) */}
                    {useLocation && (
                        <>
                            {weatherData && (
                                <div className="flex flex-col items-end animate-in fade-in slide-in-from-right-2 duration-700">
                                    <div className="flex items-center gap-1 mb-0.5">
                                        {renderWeatherIcon(weatherData.condition)}
                                    </div>
                                    <div className={`flex items-baseline gap-1 ${subTextClass}`} style={{ fontSize: `${Math.max(9, fontSize * 0.7)}px`, fontFamily: 'monospace' }}>
                                        <span className={`font-bold ${isContrastMode ? 'text-black' : 'text-white'}`}>
                                            {tempUnit === 'C' ? Math.round(weatherData.temp) : Math.round(weatherData.temp * 1.8 + 32)}°{tempUnit}
                                        </span>
                                        <span className="opacity-70 tracking-tighter">{weatherData.city}</span>
                                    </div>
                                </div>
                            )}
                            {weatherLoading && (
                                <div className="flex flex-col items-end opacity-50 animate-pulse">
                                    <div className="w-5 h-5 rounded-full border-2 border-t-transparent border-current animate-spin mb-1"></div>
                                    <div className="h-2 w-8 bg-current rounded opacity-20"></div>
                                </div>
                            )}
                        </>
                    )}
                 </div>

                 {userText && (
                     <div className={`relative border-t pt-2 mt-1 w-full ${isContrastMode ? 'border-black/10' : 'border-white/10'} vfx-item delay-3`}>
                         {userText.length > 20 ? (
                             <div className="w-full overflow-hidden marquee-container"><div className="animate-marquee-one-way"><span className="whitespace-nowrap px-4" style={{ fontFamily: selectedFont, fontSize: `${fontSize}px`, fontWeight: isBold ? 'bold' : 'normal', fontStyle: isItalic ? 'italic' : 'normal', color: isContrastMode ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)' }}>{userText}</span></div></div>
                         ) : (
                             <div className="text-center w-full overflow-hidden text-ellipsis"><span className="whitespace-nowrap" style={{ fontFamily: selectedFont, fontSize: `${fontSize}px`, fontWeight: isBold ? 'bold' : 'normal', fontStyle: isItalic ? 'italic' : 'normal', color: isContrastMode ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)' }}>{userText}</span></div>
                         )}
                     </div>
                 )}
             </div>
          </div>
        )}
      </div>

      {showSettings && (
        <>
            {/* Backdrop to close menu when clicking outside */}
            <div 
                className="fixed inset-0 z-[240] bg-transparent" 
                onPointerDown={() => setShowSettings(false)} 
            />
            
            <div className="absolute top-20 left-6 z-[250] w-72 bg-[#111]/95 backdrop-blur-xl border border-white/20 rounded-2xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] animate-config-pop" onPointerDown={(e) => e.stopPropagation()}>
                <h4 className="text-xs font-mono uppercase text-gray-500 mb-4 tracking-widest border-b border-white/10 pb-2 vfx-item delay-1">Widget Ayarları</h4>
                
                {/* Önizleme */}
                <div className="mb-5 p-4 bg-gradient-to-br from-white/10 to-transparent rounded-xl border border-white/10 text-center min-h-[60px] flex flex-col items-center justify-center vfx-item delay-2">
                    <span className="pr-2" style={{ fontFamily: selectedFont, fontSize: `${fontSize}px`, fontWeight: isBold ? 'bold' : 'normal', fontStyle: isItalic ? 'italic' : 'normal', color: 'white' }}>12:34 - Metin</span>
                </div>

                {/* Font Selection */}
                <div className="mb-4 vfx-item delay-3">
                    <label className="text-xs text-gray-400 block mb-1.5 font-medium">Yazı Tipi</label>
                    <div className="relative">
                        <select value={selectedFont} onChange={(e) => setSelectedFont(e.target.value)} className="w-full bg-black/40 border border-white/20 rounded-lg text-sm text-white p-2.5 outline-none cursor-pointer">
                            {FONTS.map(f => (<option key={f.name} value={f.value} className="bg-gray-900 text-white py-2">{f.name}</option>))}
                        </select>
                    </div>
                </div>

                {/* Font Options */}
                <div className="flex gap-3 mb-4 vfx-item delay-3">
                    <div className="flex-1"><label className="text-xs text-gray-400 block mb-1.5 font-medium flex justify-between"><span>Boyut</span><span className="text-blue-400">{fontSize}px</span></label><input type="range" min="10" max="20" value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} className="w-full h-1.5 bg-white/10 rounded-lg cursor-pointer accent-blue-500"/></div>
                    <div className="flex items-end gap-1"><button onClick={() => setIsBold(!isBold)} className={`w-9 h-9 rounded-lg border flex items-center justify-center font-bold text-sm transition-all ${isBold ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-400'}`}>B</button><button onClick={() => setIsItalic(!isItalic)} className={`w-9 h-9 rounded-lg border flex items-center justify-center italic text-sm transition-all ${isItalic ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-400'}`}>I</button></div>
                </div>

                {/* Weather Settings */}
                <div className="mb-4 pt-2 border-t border-white/10 vfx-item delay-4">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs text-gray-400 font-medium flex items-center gap-2">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                            Konum ve Hava Durumu
                        </label>
                        <button onClick={() => setUseLocation(!useLocation)} className={`w-8 h-4 rounded-full relative transition-colors ${useLocation ? 'bg-green-600' : 'bg-white/10'}`}>
                            <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${useLocation ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                    </div>
                    {useLocation && (
                        <div className="flex gap-2 animate-in fade-in slide-in-from-top-1">
                            <button onClick={() => setTempUnit('C')} className={`flex-1 py-1 rounded text-[10px] border transition-colors ${tempUnit === 'C' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-400'}`}>Celsius (°C)</button>
                            <button onClick={() => setTempUnit('F')} className={`flex-1 py-1 rounded text-[10px] border transition-colors ${tempUnit === 'F' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-400'}`}>Fahrenheit (°F)</button>
                        </div>
                    )}
                </div>

                {/* Screensaver Colors */}
                <div className="mb-4 pt-2 border-t border-white/10 vfx-item delay-5">
                    <label className="text-xs text-gray-400 font-medium block mb-2">Ekran Koruyucu Renkleri</label>
                    <div className="flex gap-2 mb-2">
                        <button 
                            onClick={() => setActiveColorPicker(activeColorPicker === 'bg' ? 'none' : 'bg')} 
                            className={`flex-1 py-1.5 px-2 rounded-lg border border-white/10 bg-white/5 flex items-center justify-between group ${activeColorPicker === 'bg' ? 'ring-1 ring-blue-500 bg-white/10' : ''}`}
                        >
                            <span className="text-[10px] text-gray-300">Arka Plan</span>
                            <div className="w-4 h-4 rounded-full border border-white/30" style={{ backgroundColor: ssBgColor }}></div>
                        </button>
                        <button 
                            onClick={() => setActiveColorPicker(activeColorPicker === 'text' ? 'none' : 'text')} 
                            className={`flex-1 py-1.5 px-2 rounded-lg border border-white/10 bg-white/5 flex items-center justify-between group ${activeColorPicker === 'text' ? 'ring-1 ring-blue-500 bg-white/10' : ''}`}
                        >
                            <span className="text-[10px] text-gray-300">Yazı</span>
                            <div className="w-4 h-4 rounded-full border border-white/30" style={{ backgroundColor: ssTextColor }}></div>
                        </button>
                    </div>
                    
                    {/* Mini Spectrum Picker */}
                    {activeColorPicker !== 'none' && (
                        <div className="animate-in fade-in slide-in-from-top-1">
                            <div 
                                className="w-full h-8 rounded-lg cursor-crosshair relative overflow-hidden border border-white/20 mb-1" 
                                onMouseMove={(e) => { if(e.buttons === 1) handleSpectrumClick(e); }}
                                onClick={handleSpectrumClick}
                            >
                                <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)' }} />
                            </div>
                            <div className="flex justify-between items-center text-[9px] text-gray-500 font-mono">
                                <span>Renk Seç</span>
                                <span>{activeColorPicker === 'bg' ? ssBgColor : ssTextColor}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* User Input */}
                <div className="mb-4 vfx-item delay-6"><label className="text-xs text-gray-400 block mb-1.5 font-medium">Özel Metin</label><input type="text" value={tempText} onChange={(e) => setTempText(e.target.value)} placeholder="..." className="w-full bg-black/40 border border-white/20 rounded-lg text-sm text-white p-2.5 outline-none focus:bg-black/60"/></div>

                {/* Clean Mode Toggle */}
                <div className="mb-5 flex items-center justify-between border-t border-white/10 pt-4 vfx-item delay-6">
                    <span className="text-xs text-gray-400 font-medium">Temiz Modda Gizle</span>
                    <button onClick={() => setHideInCleanMode(!hideInCleanMode)} className={`w-10 h-5 rounded-full relative transition-colors ${hideInCleanMode ? 'bg-blue-600' : 'bg-white/10'}`}><div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform ${hideInCleanMode ? 'translate-x-5' : 'translate-x-0'}`} /></button>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2 border-t border-white/10 vfx-item delay-6">
                    <button onClick={() => setShowSettings(false)} className="flex-1 py-2.5 rounded-lg text-xs font-medium bg-white/5 text-gray-400 hover:text-white transition-colors">İptal</button>
                    <button onClick={saveSettings} className="flex-1 py-2.5 rounded-lg text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg transition-all">Uygula</button>
                </div>
            </div>
        </>
      )}
    </>
  );
};
