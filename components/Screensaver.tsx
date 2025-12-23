import React, { useState, useEffect } from 'react';

interface ScreensaverProps {
  active: boolean;
  onClick: () => void;
  className?: string;
  style?: React.CSSProperties;
  bgColor?: string;
  textColor?: string;
  userText?: string;
}

// Weather Types
type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'snow' | 'unknown';
interface WeatherData {
    temp: number;
    condition: WeatherCondition;
    city: string;
}

// 7-Segment Haritası (0-9)
const DIGIT_MAP: Record<number, string[]> = {
    0: ['A', 'B', 'C', 'D', 'E', 'F'],
    1: ['B', 'C'],
    2: ['A', 'B', 'D', 'E', 'G'],
    3: ['A', 'B', 'C', 'D', 'G'],
    4: ['B', 'C', 'F', 'G'],
    5: ['A', 'C', 'D', 'F', 'G'],
    6: ['A', 'C', 'D', 'E', 'F', 'G'],
    7: ['A', 'B', 'C'],
    8: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
    9: ['A', 'B', 'C', 'D', 'F', 'G'],
};

/* 
   GEOMETRİ VE GRID SİSTEMİ (4x7)
*/

// Dikey Yüzdeler
const H1 = '14.2857%'; // 1 birim (Kalınlık)
const H2 = '28.5714%'; // 2 birim (Uzunluk)
const H_POS_0 = '0%';
const H_POS_1 = '14.2857%';
const H_POS_3 = '42.8571%';
const H_POS_4 = '57.1428%';
const H_POS_6 = '85.7142%';

// Yatay Yüzdeler
const W1 = '25%'; // 1 birim (Kalınlık)
const W2 = '50%'; // 2 birim (Uzunluk)
const W_POS_0 = '0%';
const W_POS_1 = '25%';
const W_POS_3 = '75%';

// Pozisyonlar
const SEGMENT_STYLES: Record<string, React.CSSProperties> = {
    // YATAYLAR
    A: { top: H_POS_0, left: W_POS_1, width: W2, height: H1 }, 
    G: { top: H_POS_3, left: W_POS_1, width: W2, height: H1 },
    D: { top: H_POS_6, left: W_POS_1, width: W2, height: H1 },
    
    // DİKEYLER
    F: { top: H_POS_1, left: W_POS_0, width: W1, height: H2 },
    B: { top: H_POS_1, left: W_POS_3, width: W1, height: H2 },
    E: { top: H_POS_4, left: W_POS_0, width: W1, height: H2 },
    C: { top: H_POS_4, left: W_POS_3, width: W1, height: H2 },
};

// SIKIŞTIRMA (SQUEEZE) AYARLARI
const SEGMENT_TRANSFORMS: Record<string, string> = {
    A: 'translateY(2px)',  // Aşağı
    D: 'translateY(-2px)', // Yukarı
    G: 'translateY(0)',    // Orta sabit
    F: 'translateX(2px)',  // Sağa
    E: 'translateX(2px)',  // Sağa
    B: 'translateX(-2px)', // Sola
    C: 'translateX(-2px)', // Sola
};

// DÖNÜŞ EKSENİ (Medallion Flip)
const ROTATION_AXIS: Record<string, 'X' | 'Y'> = {
    A: 'X', G: 'X', D: 'X',
    F: 'Y', B: 'Y', E: 'Y', C: 'Y'
};

// Z-Index Priority for Active Segments (To handle shadow overlapping correctly)
// Items closer to Bottom-Right (direction of shadow) should be on top.
const SEGMENT_Z_PRIORITY: Record<string, number> = {
    A: 1, // Top
    F: 2, // Top-Left
    B: 3, // Top-Right
    G: 4, // Middle
    E: 5, // Bottom-Left
    C: 6, // Bottom-Right
    D: 7  // Bottom
};

const Segment: React.FC<{ 
    id: string; 
    active: boolean; 
    color: string; 
    bgColor: string;
    zIndexBase?: number;
}> = ({ id, active, color, bgColor, zIndexBase = 0 }) => {
    
    const axis = ROTATION_AXIS[id];
    const rotateVal = active ? '0deg' : '-180deg';
    const transformString = `rotate${axis}(${rotateVal})`;
    
    // Calculate Z-Index
    // Active: High base + Digit Offset + Segment Priority
    // Passive: 1 (Background)
    const priority = SEGMENT_Z_PRIORITY[id];
    const zIndex = active ? (50 + zIndexBase + priority) : 1;

    return (
        <div 
            className="absolute"
            style={{ 
                ...SEGMENT_STYLES[id], 
                zIndex: zIndex, 
                perspective: '1200px', 
            }}
        >
             <div 
                className="w-full h-full relative transition-transform duration-700 cubic-bezier(0.4, 0.0, 0.2, 1)"
                style={{
                    transformStyle: 'preserve-3d',
                    transform: `${SEGMENT_TRANSFORMS[id]} ${transformString}`
                }}
             >
                {/* --- ÖN YÜZ (Active Color) --- */}
                <div 
                    className="absolute inset-[0.5px] rounded-[4px] border border-white/10"
                    style={{
                        backfaceVisibility: 'hidden',
                        backgroundColor: color,
                        // GÜÇLENDİRİLMİŞ SAĞ-ARKA GÖLGE VE KABARTMA
                        boxShadow: `
                            inset 2px 2px 4px rgba(255,255,255,0.4), 
                            inset -2px -2px 4px rgba(0,0,0,0.4),
                            0 0 10px ${color}66,
                            15px 15px 25px rgba(0,0,0,0.7) 
                        `,
                        zIndex: 2
                    }}
                >
                     <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent rounded-[4px] pointer-events-none"></div>
                </div>

                {/* --- ARKA YÜZ (Background Color) --- */}
                <div 
                    className="absolute inset-[0.5px] rounded-[4px]"
                    style={{
                        backfaceVisibility: 'hidden',
                        backgroundColor: bgColor, 
                        transform: `rotate${axis}(180deg)`, 
                        zIndex: 1,
                    }}
                />
             </div>
        </div>
    );
};

const Digit: React.FC<{ value: number; color: string; bgColor: string; size: string; zIndexBase?: number }> = ({ value, color, bgColor, size, zIndexBase }) => {
    const activeSegments = DIGIT_MAP[value] || [];

    return (
        <div 
            className="relative inline-block mx-[0.5vmin]"
            style={{
                width: `calc(${size} * 0.5714)`, 
                height: size,
            }}
        >
            {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((seg) => (
                <Segment 
                    key={seg} 
                    id={seg} 
                    active={activeSegments.includes(seg)} 
                    color={color} 
                    bgColor={bgColor}
                    zIndexBase={zIndexBase}
                />
            ))}
        </div>
    );
};

const AnimatedWeatherIcon: React.FC<{ condition: WeatherCondition, color: string }> = ({ condition, color }) => {
    // İkonlar için Drop Shadow (SVG olduğu için text-shadow işlemez)
    const iconFilter = "drop-shadow(4px 4px 6px rgba(0,0,0,0.6))";

    if (condition === 'clear') {
        return (
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" className="overflow-visible" style={{ filter: iconFilter }}>
                <g className="origin-center animate-spin-slow-custom">
                    <circle cx="12" cy="12" r="5" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5" />
                    <path d="M12 2V4 M12 20V22 M4.93 4.93L6.34 6.34 M17.66 17.66L19.07 19.07 M2 12H4 M20 12H22 M4.93 19.07L6.34 17.66 M17.66 6.34L19.07 4.93" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
                </g>
            </svg>
        );
    }
    if (condition === 'cloudy') {
        return (
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" className="overflow-visible" style={{ filter: iconFilter }}>
                <path d="M16 19H7a4 4 0 0 1 0-8 3 3 0 0 1 3-3 4.5 4.5 0 0 1 5.6 1.5 2.5 2.5 0 0 1 .4 4.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="animate-cloud-drift-1" fill={color} fillOpacity="0.1" />
                <path d="M19 12H18.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
                <path d="M14 17H19a3 3 0 0 0 0-6 2.5 2.5 0 0 0-3.5 1" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="animate-cloud-drift-2 opacity-70" />
            </svg>
        );
    }
    if (condition === 'rain') {
        return (
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" className="overflow-visible" style={{ filter: iconFilter }}>
                <path d="M16 16H7a4 4 0 0 1 0-8 3 3 0 0 1 3-3 4.5 4.5 0 0 1 5.6 1.5 2.5 2.5 0 0 1 2.4 4.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill={color} fillOpacity="0.1" />
                <line x1="8" y1="18" x2="8" y2="22" stroke={color} strokeWidth="1.5" strokeLinecap="round" className="animate-rain-fall-1" />
                <line x1="12" y1="18" x2="12" y2="22" stroke={color} strokeWidth="1.5" strokeLinecap="round" className="animate-rain-fall-2" />
                <line x1="16" y1="18" x2="16" y2="22" stroke={color} strokeWidth="1.5" strokeLinecap="round" className="animate-rain-fall-3" />
            </svg>
        );
    }
    if (condition === 'snow') {
        return (
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" className="overflow-visible" style={{ filter: iconFilter }}>
                <path d="M16 16H7a4 4 0 0 1 0-8 3 3 0 0 1 3-3 4.5 4.5 0 0 1 5.6 1.5 2.5 2.5 0 0 1 2.4 4.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill={color} fillOpacity="0.1" />
                <circle cx="8" cy="20" r="1" fill={color} className="animate-snow-fall-1" />
                <circle cx="12" cy="20" r="1" fill={color} className="animate-snow-fall-2" />
                <circle cx="16" cy="20" r="1" fill={color} className="animate-snow-fall-3" />
            </svg>
        );
    }
    return null;
}

export const Screensaver: React.FC<ScreensaverProps> = ({ 
  active, 
  onClick, 
  className, 
  style,
  bgColor = '#000000',
  textColor = '#ff0000',
  userText
}) => {
  const [time, setTime] = useState(new Date());
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [active]);

  const fetchWeather = () => {
      // Konum varsa veriyi çek
      if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
              async (position) => {
                  try {
                      const { latitude, longitude } = position.coords;
                      
                      // Weather Data
                      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
                      const weatherJson = await weatherRes.json();
                      
                      // City Name
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
                      console.error("Screensaver weather fetch error", error);
                  }
              },
              () => console.warn("Location permission needed for screensaver weather")
          );
      }
  };

  // Hava Durumu Fetch Logic
  useEffect(() => {
    if (!active) return;
    
    fetchWeather();
    const interval = setInterval(fetchWeather, 900000); // 15 mins
    return () => clearInterval(interval);
  }, [active]);

  const hours = time.getHours();
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  const dayName = time.toLocaleDateString('tr-TR', { weekday: 'long' });
  const dateStr = time.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

  const digitSize = "40vmin";

  // Renk Kontrolleri
  const isDefaultBlack = bgColor.toLowerCase() === '#000000' || bgColor.toLowerCase() === '#000';
  const effectiveBgColor = isDefaultBlack ? '#000000' : bgColor;

  // Kabartma (Emboss) Style - Yazılar İçin
  const embossStyle: React.CSSProperties = {
      textShadow: '3px 3px 6px rgba(0,0,0,0.6), -1px -1px 2px rgba(255,255,255,0.15)',
      color: textColor
  };

  return (
    <div 
      className={`absolute inset-0 flex flex-col items-center justify-center cursor-pointer overflow-hidden select-none z-[100] ${className || ''}`}
      style={{
          ...style,
          backgroundColor: effectiveBgColor
      }}
      onClick={onClick}
    >
      <style>{`
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
      `}</style>

      {/* --- HAVA DURUMU WIDGET (SAĞ ÜST) --- */}
      {weatherData && (
          <div className="absolute top-10 right-10 flex flex-col items-center animate-in fade-in zoom-in duration-1000">
              <AnimatedWeatherIcon condition={weatherData.condition} color={textColor} />
              <div className="flex flex-col items-center mt-2" style={embossStyle}>
                  <span className="text-4xl font-bold font-mono tracking-tighter">{Math.round(weatherData.temp)}°C</span>
                  <span className="text-2xl font-mono opacity-80">{weatherData.city}</span>
              </div>
          </div>
      )}

      {/* --- ANA SAAT KONTEYNERİ --- */}
      <div className="relative z-10 flex flex-col items-center justify-center gap-2 p-8">
         
         {/* DİJİTAL SAAT */}
         <div className="flex items-center gap-4 sm:gap-6 mb-8">
            {/* SAAT */}
            <div className="flex">
                <Digit value={Math.floor(hours / 10)} color={textColor} bgColor={effectiveBgColor} size={digitSize} zIndexBase={10} />
                <Digit value={hours % 10} color={textColor} bgColor={effectiveBgColor} size={digitSize} zIndexBase={20} />
            </div>

            {/* AYIRAÇ */}
            <div className="flex flex-col gap-[3vmin] mx-2 justify-center opacity-80 relative" style={{ height: digitSize, zIndex: 25 }}>
                <div className="w-[3vmin] h-[3vmin] rounded-full" style={{ backgroundColor: textColor, boxShadow: `0 0 20px ${textColor}, 5px 5px 10px rgba(0,0,0,0.5)` }} />
                <div className="w-[3vmin] h-[3vmin] rounded-full" style={{ backgroundColor: textColor, boxShadow: `0 0 20px ${textColor}, 5px 5px 10px rgba(0,0,0,0.5)` }} />
            </div>

            {/* DAKİKA */}
            <div className="flex">
                <Digit value={Math.floor(minutes / 10)} color={textColor} bgColor={effectiveBgColor} size={digitSize} zIndexBase={30} />
                <Digit value={minutes % 10} color={textColor} bgColor={effectiveBgColor} size={digitSize} zIndexBase={40} />
            </div>

            {/* AYIRAÇ */}
            <div className="flex flex-col gap-[3vmin] mx-2 justify-center opacity-80 relative" style={{ height: digitSize, zIndex: 45 }}>
                <div className="w-[3vmin] h-[3vmin] rounded-full" style={{ backgroundColor: textColor, boxShadow: `0 0 20px ${textColor}, 5px 5px 10px rgba(0,0,0,0.5)` }} />
                <div className="w-[3vmin] h-[3vmin] rounded-full" style={{ backgroundColor: textColor, boxShadow: `0 0 20px ${textColor}, 5px 5px 10px rgba(0,0,0,0.5)` }} />
            </div>

            {/* SANİYE */}
            <div className="flex">
                <Digit value={Math.floor(seconds / 10)} color={textColor} bgColor={effectiveBgColor} size={digitSize} zIndexBase={50} />
                <Digit value={seconds % 10} color={textColor} bgColor={effectiveBgColor} size={digitSize} zIndexBase={60} />
            </div>
         </div>

         {/* --- BİLGİ ALANI (GÜN, TARİH, METİN) --- */}
         {/* Tüm metinlere Emboss Style uygulandı */}
         <div className="flex flex-col items-center gap-4 w-full text-center">
             {/* GÜN ADI */}
             <div className="text-6xl md:text-8xl font-bold tracking-wide uppercase" style={embossStyle}>
                 {dayName}
             </div>
             
             {/* TAM TARİH */}
             <div className="text-4xl md:text-6xl font-medium opacity-90 tracking-wider" style={embossStyle}>
                 {dateStr}
             </div>

             {/* KULLANICI METNİ */}
             {userText && (
                 <div className="text-3xl md:text-5xl font-light opacity-80 mt-4 px-4 max-w-[80vw] break-words" style={embossStyle}>
                     {userText}
                 </div>
             )}
         </div>

      </div>
      
    </div>
  );
};