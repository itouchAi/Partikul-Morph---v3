
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { MagicParticles } from './MagicParticles';
import * as THREE from 'three';
import { PresetType, AudioMode, ShapeType } from '../types';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

interface ExperienceProps {
  text: string;
  imageXY: string | null;
  imageYZ: string | null;
  useImageColors: boolean;
  particleColor: string;
  disableInteraction: boolean;
  depthIntensity: number;
  repulsionStrength: number;
  repulsionRadius: number;
  particleCount: number;
  particleSize: number;
  modelDensity: number;
  
  activePreset: PresetType;
  audioMode: AudioMode;
  analyser?: AnalyserNode | null; // Changed from raw audio props to AnalyserNode
  isPlaying: boolean;
  volume?: number;

  isDrawing: boolean;
  brushSize: number;
  getDrawingDataRef: React.MutableRefObject<{ getXY: () => string, getYZ: () => string } | null>;
  canvasRotation: [number, number, number];
  clearCanvasTrigger?: number;
  currentShape?: ShapeType;
  cameraResetTrigger?: number; 
  isSceneVisible?: boolean;
  
  // NEW: Rotation Props
  isAutoRotating?: boolean;
  onStopAutoRotation?: () => void;
  enableAudioReactivity?: boolean; // New prop for selective audio echo
  
  // VFX PROPS
  enableBloom?: boolean;
  enableTrails?: boolean;
}

const DrawingPlane3D: React.FC<{
  isDrawing: boolean;
  color: string;
  brushSize: number;
  getDataRef: React.MutableRefObject<{ getXY: () => string, getYZ: () => string } | null>;
  rotation: [number, number, number];
  clearTrigger?: number;
}> = ({ isDrawing, color, brushSize, getDataRef, rotation, clearTrigger }) => {
  
  const textureXYRef = useRef<THREE.CanvasTexture>(null);
  const contextXYRef = useRef<CanvasRenderingContext2D | null>(null);
  const canvasXYRef = useRef<HTMLCanvasElement | null>(null);

  const textureYZRef = useRef<THREE.CanvasTexture>(null);
  const contextYZRef = useRef<CanvasRenderingContext2D | null>(null);
  const canvasYZRef = useRef<HTMLCanvasElement | null>(null);

  const [lastUV, setLastUV] = useState<{x: number, y: number} | null>(null);
  const isDrawingAction = useRef(false);
  const activePlane = useRef<'XY' | 'YZ'>('XY');

  useEffect(() => {
    const initCanvas = () => {
        const c = document.createElement('canvas');
        c.width = 1024; c.height = 1024;
        const ctx = c.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, 1024, 1024);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        }
        return { c, ctx };
    };

    const xy = initCanvas();
    canvasXYRef.current = xy.c;
    contextXYRef.current = xy.ctx;

    const yz = initCanvas();
    canvasYZRef.current = yz.c;
    contextYZRef.current = yz.ctx;

    getDataRef.current = {
      getXY: () => canvasXYRef.current?.toDataURL('image/png') || '',
      getYZ: () => canvasYZRef.current?.toDataURL('image/png') || ''
    };
  }, []);

  useEffect(() => {
    if (contextXYRef.current) {
        contextXYRef.current.clearRect(0, 0, 1024, 1024);
    }
    if (contextYZRef.current) {
        contextYZRef.current.clearRect(0, 0, 1024, 1024);
    }
    if (textureXYRef.current) textureXYRef.current.needsUpdate = true;
    if (textureYZRef.current) textureYZRef.current.needsUpdate = true;
  }, [clearTrigger]);

  useEffect(() => {
    if (contextXYRef.current) {
        contextXYRef.current.strokeStyle = color;
        contextXYRef.current.lineWidth = brushSize * 2; 
    }
    if (contextYZRef.current) {
        contextYZRef.current.strokeStyle = color;
        contextYZRef.current.lineWidth = brushSize * 2;
    }
  }, [color, brushSize]);

  const draw = (uv: THREE.Vector2, plane: 'XY' | 'YZ') => {
    const ctx = plane === 'XY' ? contextXYRef.current : contextYZRef.current;
    const tex = plane === 'XY' ? textureXYRef.current : textureYZRef.current;
    
    if (!ctx || !tex) return;

    const x = uv.x * 1024;
    const y = (1 - uv.y) * 1024; 

    ctx.beginPath();
    if (lastUV) {
        ctx.moveTo(lastUV.x, lastUV.y);
        ctx.lineTo(x, y);
    } else {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y); 
    }
    ctx.stroke();
    
    tex.needsUpdate = true;
    setLastUV({ x, y });
  };

  const handlePointerDown = (e: any, plane: 'XY' | 'YZ') => {
    if (!isDrawing) return;
    if (e.button === 0) {
        e.stopPropagation(); 
        isDrawingAction.current = true;
        activePlane.current = plane;
        if (e.uv) {
            setLastUV(null); 
            draw(e.uv, plane);
        }
    }
  };

  const handlePointerMove = (e: any, plane: 'XY' | 'YZ') => {
    if (!isDrawing || !isDrawingAction.current) return;
    if (activePlane.current !== plane) return;

    if (e.uv) {
        e.stopPropagation();
        draw(e.uv, plane);
    }
  };

  const handlePointerUp = () => {
    isDrawingAction.current = false;
    setLastUV(null);
  };

  if (!isDrawing) return null;

  return (
    <group rotation={rotation}>
        <mesh 
            position={[0, 0, 0]}
            onPointerDown={(e) => handlePointerDown(e, 'XY')}
            onPointerMove={(e) => handlePointerMove(e, 'XY')}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
        >
            <planeGeometry args={[15, 15]} /> 
            <meshBasicMaterial transparent side={THREE.DoubleSide} depthWrite={false}>
                {canvasXYRef.current && (
                    <canvasTexture 
                        ref={textureXYRef} 
                        attach="map" 
                        image={canvasXYRef.current} 
                        premultiplyAlpha 
                        minFilter={THREE.LinearFilter}
                    />
                )}
            </meshBasicMaterial>
            <lineSegments>
                <edgesGeometry args={[new THREE.PlaneGeometry(15, 15)]} />
                <lineBasicMaterial color="#444" opacity={0.3} transparent />
            </lineSegments>
        </mesh>
        
        <gridHelper args={[15, 15, 0x888888, 0x222222]} rotation={[Math.PI/2, 0, 0]} position={[0, 0, 0.01]} />

        <mesh 
            rotation={[0, Math.PI / 2, 0]}
            onPointerDown={(e) => handlePointerDown(e, 'YZ')}
            onPointerMove={(e) => handlePointerMove(e, 'YZ')}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
        >
            <planeGeometry args={[15, 15]} /> 
            <meshBasicMaterial transparent side={THREE.DoubleSide} depthWrite={false}>
                {canvasYZRef.current && (
                    <canvasTexture 
                        ref={textureYZRef} 
                        attach="map" 
                        image={canvasYZRef.current} 
                        premultiplyAlpha 
                        minFilter={THREE.LinearFilter}
                    />
                )}
            </meshBasicMaterial>
             <lineSegments>
                <edgesGeometry args={[new THREE.PlaneGeometry(15, 15)]} />
                <lineBasicMaterial color="#4466aa" opacity={0.3} transparent />
            </lineSegments>
        </mesh>
        
        <gridHelper args={[15, 15, 0x4444ff, 0x111144]} rotation={[0, 0, Math.PI/2]} position={[0.01, 0, 0]} />
    </group>
  );
};

export const Experience: React.FC<ExperienceProps> = ({ 
  text, 
  imageXY,
  imageYZ,
  useImageColors, 
  particleColor, 
  disableInteraction, 
  depthIntensity,
  repulsionStrength,
  repulsionRadius,
  particleCount, 
  particleSize,
  modelDensity,
  activePreset,
  audioMode,
  analyser,
  isPlaying,
  volume = 0.5,
  isDrawing,
  brushSize,
  getDrawingDataRef,
  canvasRotation,
  clearCanvasTrigger,
  currentShape = 'sphere',
  cameraResetTrigger = 0,
  isSceneVisible = true,
  isAutoRotating = true,
  onStopAutoRotation,
  enableAudioReactivity = true,
  enableBloom = false,
  enableTrails = false
}) => {
  const controlsRef = useRef<any>(null);
  const objectGroupRef = useRef<THREE.Group>(null);
  const previousPositions = useRef<Float32Array | null>(null);

  useEffect(() => {
      // Resetlendiğinde kamerayı sıfırla
      if (controlsRef.current && cameraResetTrigger > 0) {
          controlsRef.current.reset();
      }
  }, [cameraResetTrigger]);

  return (
    <Canvas
      camera={{ position: [0, 0, 15], fov: 45 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }} 
      onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          gl.toneMapping = THREE.ReinhardToneMapping;
      }}
    >
      <OrbitControls 
        makeDefault
        domElement={document.body}
        ref={controlsRef}
        enablePan={false}
        enableZoom={true}
        enableDamping 
        dampingFactor={0.05} 
        minDistance={2} 
        maxDistance={100}
        rotateSpeed={0.5}
        mouseButtons={{
          LEFT: undefined, 
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.ROTATE 
        }}
      />
      
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      
      {/* Merkez Grup */}
      <group ref={objectGroupRef}>
          <DrawingPlane3D 
            isDrawing={isDrawing} 
            color={particleColor} 
            brushSize={brushSize}
            getDataRef={getDrawingDataRef}
            rotation={canvasRotation}
            clearTrigger={clearCanvasTrigger}
          />

          {!isDrawing && (
              <MagicParticles 
                text={text} 
                imageXY={imageXY}
                imageYZ={imageYZ}
                useImageColors={useImageColors}
                color={particleColor} 
                disableMouseRepulsion={disableInteraction} 
                depthIntensity={depthIntensity}
                repulsionStrength={repulsionStrength}
                repulsionRadius={repulsionRadius}
                particleCount={particleCount}
                particleSize={particleSize}
                modelDensity={modelDensity}
                previousPositions={previousPositions}
                activePreset={activePreset}
                audioMode={audioMode}
                analyser={analyser}
                isPlaying={isPlaying}
                volume={volume}
                isDrawing={false}
                canvasRotation={canvasRotation}
                currentShape={currentShape}
                visible={isSceneVisible}
                isAutoRotating={isAutoRotating}
                onStopAutoRotation={onStopAutoRotation}
                cameraResetTrigger={cameraResetTrigger}
                enableAudioReactivity={enableAudioReactivity}
                enableTrails={enableTrails}
              />
          )}
      </group>

      {/* BLOOM EFFECT COMPOSER - Inside Canvas */}
      {enableBloom && !isDrawing && (
          <EffectComposer multisampling={0} disableNormalPass={true}>
              <Bloom 
                  luminanceThreshold={0.15} // Eşik değeri
                  mipmapBlur // Yumuşak blur
                  intensity={1.2} // Parlaklık
                  radius={0.7} // Yayılma
              />
          </EffectComposer>
      )}
    </Canvas>
  );
};
