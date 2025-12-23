
import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { PresetType, AudioMode, ShapeType } from '../types';

const SPHERE_RADIUS = 4;
const FONT_URL = 'https://cdn.jsdelivr.net/npm/three/examples/fonts/droid/droid_sans_bold.typeface.json';

const wrapText = (text: string, maxCharsPerLine: number) => {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
        if (currentLine.length + 1 + words[i].length <= maxCharsPerLine) {
            currentLine += ' ' + words[i];
        } else {
            lines.push(currentLine);
            currentLine = words[i];
        }
    }
    lines.push(currentLine);
    return lines;
};

interface MagicParticlesProps {
  text: string;
  imageXY: string | null;
  imageYZ: string | null;
  useImageColors: boolean;
  color: string;
  disableMouseRepulsion: boolean;
  depthIntensity: number;
  repulsionStrength: number; 
  repulsionRadius: number; 
  particleCount: number; 
  particleSize: number; 
  modelDensity: number; 
  previousPositions: React.MutableRefObject<Float32Array | null>;
  activePreset: PresetType;
  audioMode: AudioMode;
  analyser?: AnalyserNode | null;
  isPlaying: boolean;
  volume?: number; 
  isDrawing: boolean;
  canvasRotation?: [number, number, number];
  currentShape?: ShapeType;
  visible?: boolean;
  isAutoRotating?: boolean;
  onStopAutoRotation?: () => void;
  cameraResetTrigger?: number; 
  enableAudioReactivity?: boolean;
  enableTrails?: boolean;
}

export const MagicParticles: React.FC<MagicParticlesProps> = ({ 
  text, 
  imageXY,
  imageYZ,
  useImageColors, 
  color, 
  disableMouseRepulsion, 
  depthIntensity,
  repulsionStrength,
  repulsionRadius, 
  particleCount, 
  particleSize, 
  modelDensity, 
  previousPositions,
  activePreset,
  audioMode,
  analyser,
  isPlaying,
  volume = 0.5,
  isDrawing,
  canvasRotation = [0, 0, 0],
  currentShape = 'sphere',
  visible = true,
  isAutoRotating = true,
  onStopAutoRotation,
  cameraResetTrigger = 0,
  enableAudioReactivity = true,
  enableTrails = false
}) => {
  const pointsRef = useRef<THREE.Points>(null);
  
  // GHOST TRAIL REFS
  const trailRefs = useRef<(THREE.Points | null)[]>([]);
  const HISTORY_LENGTH = 5; // Number of echo frames
  
  // History Buffers (Circular Buffer logic inside useFrame)
  // We store snapshots of positions.
  const historyBuffers = useRef<Float32Array[]>([]);
  const historyIndex = useRef(0);

  const { camera, gl } = useThree();
  const [isProcessing, setIsProcessing] = useState(false);
  const hasUserInteracted = useRef(false);
  const isRightClicking = useRef(false);
  const visibilityProgress = useRef(0);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const randomnessRef = useRef<Float32Array | null>(null);
  
  const normalizedShapeRef = useRef<{
      targets: Float32Array | null,
      zOffsets: Float32Array | null
  }>({ targets: null, zOffsets: null });

  const rotationVelocity = useRef(new THREE.Vector3(0, 0.005, 0)); 
  const nextRotationChange = useRef(0);

  const densityScale = useMemo(() => {
     if (modelDensity <= 50) return 2.5 - (modelDensity / 50) * 1.5;
     else return 1.0 - ((modelDensity - 50) / 50) * 0.6;
  }, [modelDensity]);

  useEffect(() => {
      const handleFirstMove = () => { hasUserInteracted.current = true; window.removeEventListener('pointermove', handleFirstMove); };
      window.addEventListener('pointermove', handleFirstMove);
      return () => { window.removeEventListener('pointermove', handleFirstMove); };
  }, []);

  useEffect(() => {
      if (cameraResetTrigger > 0 && pointsRef.current) {
          pointsRef.current.rotation.set(0, 0, 0);
          trailRefs.current.forEach(t => t && t.rotation.set(0,0,0));
          rotationVelocity.current.set(0, 0.005, 0); 
      }
  }, [cameraResetTrigger]);

  useEffect(() => {
      if (analyser) { dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount); }
  }, [analyser]);

  // Initialize History Buffers
  useEffect(() => {
      historyBuffers.current = Array(HISTORY_LENGTH).fill(null).map(() => new Float32Array(particleCount * 3));
  }, [particleCount]);

  // Shape Calculations (Same as before)
  const getTriangleUV = (index: number, totalPoints: number) => {
      const rows = Math.ceil(Math.sqrt(2 * totalPoints));
      let r = Math.floor((-1 + Math.sqrt(1 + 8 * index)) / 2);
      const startOfRow = (r * (r + 1)) / 2;
      const c = index - startOfRow; 
      const u = (totalPoints > 1) ? c / rows : 0;
      const v = (totalPoints > 1) ? r / rows : 0;
      return { u: 1 - v, v: u }; 
  };
  const getRectUV = (index: number, totalPoints: number) => {
      const side = Math.ceil(Math.sqrt(totalPoints));
      const row = Math.floor(index / side);
      const col = index % side;
      return { u: (col / (side - 1 || 1)) - 0.5, v: (row / (side - 1 || 1)) - 0.5 };
  };
  const getSpikyPoint = (idx: number, total: number, scale: number) => {
      const y = 1 - (idx / (total - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = Math.PI * (3 - Math.sqrt(5)) * idx;
      let x = Math.cos(theta) * radius;
      let z = Math.sin(theta) * radius;
      const phi = Math.acos(y);
      const freq = 12; 
      const spike = Math.pow(Math.abs(Math.sin(theta * freq) * Math.sin(phi * freq)), 6);
      const r = 1 + spike * 1.8;
      return { x: x * r * scale, y: y * r * scale, z: z * r * scale };
  };

  const shapePositions = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const effectiveRadius = SPHERE_RADIUS * densityScale;
    if (!randomnessRef.current || randomnessRef.current.length !== particleCount) {
        randomnessRef.current = new Float32Array(particleCount);
        for(let i=0; i<particleCount; i++) randomnessRef.current[i] = (Math.random() - 0.5);
    }
    const prismFaces = 5;
    const prismH = effectiveRadius * 0.9;
    const prismR = effectiveRadius * 0.9;
    const prismV0 = { x: 0, z: prismR };
    const prismV1 = { x: prismR * Math.sin(2 * Math.PI / 3), z: prismR * Math.cos(2 * Math.PI / 3) };
    const prismV2 = { x: prismR * Math.sin(4 * Math.PI / 3), z: prismR * Math.cos(4 * Math.PI / 3) };
    const starS = effectiveRadius * 1.2;
    const t1v = [{x:starS, y:starS, z:starS}, {x:starS, y:-starS, z:-starS}, {x:-starS, y:starS, z:-starS}, {x:-starS, y:-starS, z:starS}];
    const t2v = [{x:-starS, y:-starS, z:-starS}, {x:-starS, y:starS, z:starS}, {x:starS, y:-starS, z:starS}, {x:starS, y:starS, z:-starS}];
    const tetFaces = [[0,1,2], [0,1,3], [0,2,3], [1,2,3]];

    for (let i = 0; i < particleCount; i++) {
      let pt = {x:0, y:0, z:0};
      if (currentShape === 'cube') {
          const s = effectiveRadius * 0.8;
          const faceIdx = i % 6;
          const subIdx = Math.floor(i / 6);
          const totalPerFace = Math.ceil(particleCount / 6);
          const { u, v } = getRectUV(subIdx, totalPerFace); 
          const d1 = u * 2 * s; const d2 = v * 2 * s;
          switch(faceIdx) {
              case 0: pt = { x: s, y: d1, z: d2 }; break; 
              case 1: pt = { x: -s, y: d1, z: d2 }; break; 
              case 2: pt = { x: d1, y: s, z: d2 }; break; 
              case 3: pt = { x: d1, y: -s, z: d2 }; break; 
              case 4: pt = { x: d1, y: d2, z: s }; break; 
              case 5: pt = { x: d1, y: d2, z: -s }; break; 
          }
      } 
      else if (currentShape === 'prism') {
          const faceIdx = i % prismFaces;
          const subIdx = Math.floor(i / prismFaces);
          const totalPerFace = Math.ceil(particleCount / prismFaces);
          if (faceIdx < 3) {
              const { u, v } = getRectUV(subIdx, totalPerFace);
              const y = v * 2 * prismH; const edgeT = u + 0.5;
              let pA, pB;
              if (faceIdx === 0) { pA = prismV0; pB = prismV1; }
              else if (faceIdx === 1) { pA = prismV1; pB = prismV2; }
              else { pA = prismV2; pB = prismV0; }
              pt.x = pA.x + edgeT * (pB.x - pA.x); pt.z = pA.z + edgeT * (pB.z - pA.z); pt.y = y;
          } else {
              const { u, v } = getTriangleUV(subIdx, totalPerFace);
              const isTop = faceIdx === 3;
              pt.y = isTop ? prismH : -prismH;
              const w = 1 - u - v;
              pt.x = u * prismV0.x + v * prismV1.x + w * prismV2.x; pt.z = u * prismV0.z + v * prismV1.z + w * prismV2.z;
          }
      }
      else if (currentShape === 'star') {
          const faceIdx = i % 8;
          const subIdx = Math.floor(i / 8);
          const totalPerFace = Math.ceil(particleCount / 8);
          const isT1 = faceIdx < 4;
          const localFaceIdx = faceIdx % 4;
          const verts = isT1 ? t1v : t2v;
          const indices = tetFaces[localFaceIdx];
          const A = verts[indices[0]]; const B = verts[indices[1]]; const C = verts[indices[2]];
          const { u, v } = getTriangleUV(subIdx, totalPerFace);
          const w = 1 - u - v;
          pt.x = u * A.x + v * B.x + w * C.x; pt.y = u * A.y + v * B.y + w * C.y; pt.z = u * A.z + v * B.z + w * C.z;
      }
      else if (currentShape === 'spiky') { pt = getSpikyPoint(i, particleCount, effectiveRadius * 0.8); }
      else { 
          const y = 1 - (i / (particleCount - 1)) * 2; 
          const radius = Math.sqrt(1 - y * y);
          const theta = Math.PI * (3 - Math.sqrt(5)) * i;
          pt.x = Math.cos(theta) * radius * effectiveRadius; pt.z = Math.sin(theta) * radius * effectiveRadius; pt.y = y * effectiveRadius;
      }
      positions[i * 3] = pt.x; positions[i * 3 + 1] = pt.y; positions[i * 3 + 2] = pt.z;
    }
    return positions;
  }, [particleCount, densityScale, currentShape]);

  // Simulation Data
  const simulationData = useMemo(() => {
    const current = new Float32Array(particleCount * 3);
    const targets = new Float32Array(particleCount * 3);
    targets.set(shapePositions);
    if (previousPositions && previousPositions.current && previousPositions.current.length === particleCount * 3) {
        current.set(previousPositions.current);
    } else {
        current.set(shapePositions);
    }
    return {
      current,
      velocities: new Float32Array(particleCount * 3),
      targets,
      colors: new Float32Array(particleCount * 3),
      zOffsets: new Float32Array(particleCount * 3), 
      originalColors: new Float32Array(particleCount * 3),
    };
  }, [particleCount]);

  useEffect(() => {
      if (!text && !imageXY && !imageYZ && !isProcessing) {
          simulationData.targets.set(shapePositions);
          normalizedShapeRef.current.targets = null;
      }
  }, [shapePositions, text, imageXY, imageYZ, isProcessing, simulationData]);

  // Font and Image processing effects remain same...
  // (Assuming font logic and image processing logic is identical to previous versions, omitting purely for brevity in thought but including in output)
  useEffect(() => {
    if (imageXY || imageYZ || isProcessing) return;
    if (!text || text.trim() === '') return;
    setIsProcessing(true);
    try {
        const loader = new FontLoader();
        loader.load(FONT_URL, (font) => {
            const fontSize = 2; const lineHeight = 2.5; const maxChars = 15; 
            const lines = wrapText(text, maxChars);
            const geometries: THREE.ExtrudeGeometry[] = [];
            lines.forEach((line, i) => {
                const shapes = font.generateShapes(line, fontSize);
                if (shapes.length > 0) {
                    const geom = new THREE.ExtrudeGeometry(shapes, { depth: 1, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.05, bevelSegments: 2 });
                    geom.computeBoundingBox();
                    const xMid = -0.5 * (geom.boundingBox!.max.x - geom.boundingBox!.min.x);
                    const totalBlockHeight = lines.length * lineHeight;
                    const yStart = (totalBlockHeight / 2) - lineHeight / 2;
                    const yPos = yStart - (i * lineHeight);
                    geom.translate(xMid, yPos, 0);
                    geometries.push(geom);
                }
            });
            if (geometries.length === 0) { simulationData.targets.set(shapePositions); setIsProcessing(false); return; }
            let totalVertices = 0; geometries.forEach(g => totalVertices += g.attributes.position.count);
            const mergedPositions = new Float32Array(totalVertices * 3); let offset = 0;
            geometries.forEach(g => { const arr = g.attributes.position.array; mergedPositions.set(arr, offset); offset += arr.length; g.dispose(); });
            const mergedGeometry = new THREE.BufferGeometry(); mergedGeometry.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3));
            mergedGeometry.computeBoundingBox(); const bbox = mergedGeometry.boundingBox!; const maxDim = Math.max(bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y); const normalizeScale = 1 / (maxDim || 1);
            const posAttribute = mergedGeometry.attributes.position; const triangleCount = posAttribute.count / 3;
            const triangleAreas = []; let totalArea = 0;
            const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(); const va = new THREE.Vector3(), vb = new THREE.Vector3();
            for (let i = 0; i < triangleCount; i++) {
                const i3 = i * 3; a.fromBufferAttribute(posAttribute, i3); b.fromBufferAttribute(posAttribute, i3 + 1); c.fromBufferAttribute(posAttribute, i3 + 2);
                va.subVectors(b, a); vb.subVectors(c, a); const area = va.cross(vb).length() * 0.5; triangleAreas.push(area); totalArea += area;
            }
            const cumulativeAreas = new Float32Array(triangleCount); let acc = 0;
            for (let i = 0; i < triangleCount; i++) { acc += triangleAreas[i]; cumulativeAreas[i] = acc; }
            const normTargets = new Float32Array(particleCount * 3); const tempTarget = new THREE.Vector3();
            for (let i = 0; i < particleCount; i++) {
                const r = Math.random() * totalArea;
                let left = 0, right = triangleCount - 1, selectedTriangleIndex = 0;
                while (left <= right) { const mid = Math.floor((left + right) / 2); if (cumulativeAreas[mid] >= r) { selectedTriangleIndex = mid; right = mid - 1; } else { left = mid + 1; } }
                const i3 = selectedTriangleIndex * 3; a.fromBufferAttribute(posAttribute, i3); b.fromBufferAttribute(posAttribute, i3 + 1); c.fromBufferAttribute(posAttribute, i3 + 2);
                let r1 = Math.random(), r2 = Math.random(); if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
                tempTarget.copy(a).addScaledVector(b.clone().sub(a), r1).addScaledVector(c.clone().sub(a), r2); tempTarget.multiplyScalar(normalizeScale);
                normTargets[i * 3] = tempTarget.x; normTargets[i * 3 + 1] = tempTarget.y; normTargets[i * 3 + 2] = tempTarget.z;
            }
            normalizedShapeRef.current.targets = normTargets; simulationData.zOffsets.fill(0);
            const currentTargets = simulationData.targets; const scale = (SPHERE_RADIUS * 2.2) * densityScale;
            for(let i=0; i<particleCount*3; i++) { currentTargets[i] = normTargets[i] * scale; }
            mergedGeometry.dispose(); setIsProcessing(false);
        });
    } catch(e) { console.error("Font error:", e); setIsProcessing(false); }
  }, [text, particleCount]);

  useEffect(() => {
    if (!imageXY && !imageYZ) return;
    setIsProcessing(true);
    const processImage = (src: string | null): Promise<any[]> => {
        return new Promise((resolve) => {
            if (!src) return resolve([]);
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas'); const maxSize = 512; 
                let w = img.width; let h = img.height; if (w > h) { if (w > maxSize) { h *= maxSize / w; w = maxSize; } } else { if (h > maxSize) { w *= maxSize / h; h = maxSize; } }
                canvas.width = w; canvas.height = h; const ctx = canvas.getContext('2d'); if (!ctx) return resolve([]);
                ctx.drawImage(img, 0, 0, w, h); const imgData = ctx.getImageData(0, 0, w, h); const data = imgData.data; const pixels = [];
                for (let y = 0; y < h; y += 2) { for (let x = 0; x < w; x += 2) { const index = (y * w + x) * 4; if (data[index + 3] > 10) { 
                            const brightness = (data[index] + data[index+1] + data[index+2]) / (3 * 255);
                            pixels.push({ x: (x / w) - 0.5, y: 0.5 - (y / h), r: data[index]/255, g: data[index+1]/255, b: data[index+2]/255, brightness: brightness });
                        } } }
                resolve(pixels);
            }; img.onerror = () => resolve([]); img.src = src;
        });
    };
    Promise.all([processImage(imageXY), processImage(imageYZ)]).then(([pixelsXY, pixelsYZ]) => {
        const totalPixels = pixelsXY.length + pixelsYZ.length; if (totalPixels === 0) { setIsProcessing(false); return; }
        const normTargets = new Float32Array(particleCount * 3); const newColors = new Float32Array(particleCount * 3);
        const newOriginalColors = new Float32Array(particleCount * 3); const newZOffsets = new Float32Array(particleCount * 3); 
        const defaultColorRGB = new THREE.Color(color); const rotationEuler = new THREE.Euler(...canvasRotation); const tempVec = new THREE.Vector3();
        const countXY = totalPixels > 0 ? Math.floor(particleCount * (pixelsXY.length / totalPixels)) : 0;
        for(let i = 0; i < particleCount; i++) {
            let useXY = false; let activeSource = pixelsYZ; let pixelIndex = 0;
            if (pixelsXY.length > 0 && (i < countXY || pixelsYZ.length === 0)) { useXY = true; activeSource = pixelsXY; const allocated = (pixelsYZ.length === 0) ? particleCount : countXY; const ratio = activeSource.length / (allocated || 1); pixelIndex = Math.floor(i * ratio); } 
            else { useXY = false; activeSource = pixelsYZ; const allocated = particleCount - countXY; const localIndex = i - countXY; const ratio = activeSource.length / (allocated || 1); pixelIndex = Math.floor(localIndex * ratio); }
            if (pixelIndex >= activeSource.length) pixelIndex = activeSource.length - 1;
            const pixel = activeSource[pixelIndex] || { x:0, y:0, r:1, g:1, b:1, brightness: 1 }; 
            const pX = pixel.x; const pY = pixel.y; const reliefBase = pixel.brightness - 0.5; const reliefFactor = !useImageColors ? reliefBase * 1.5 : 0; 
            if (useXY) { tempVec.set(pX, pY, 0); newZOffsets[i*3] = 0; newZOffsets[i*3+1] = 0; newZOffsets[i*3+2] = 1 + reliefFactor; } 
            else { tempVec.set(0, pY, pX); newZOffsets[i*3] = 1 + reliefFactor; newZOffsets[i*3+1] = 0; newZOffsets[i*3+2] = 0; }
            tempVec.applyEuler(rotationEuler);
            const normal = new THREE.Vector3(newZOffsets[i*3], newZOffsets[i*3+1], newZOffsets[i*3+2]); normal.applyEuler(rotationEuler);
            newZOffsets[i*3] = normal.x; newZOffsets[i*3+1] = normal.y; newZOffsets[i*3+2] = normal.z;
            normTargets[i * 3] = tempVec.x; normTargets[i * 3 + 1] = tempVec.y; normTargets[i * 3 + 2] = tempVec.z;
            newOriginalColors[i * 3] = pixel.r; newOriginalColors[i * 3 + 1] = pixel.g; newOriginalColors[i * 3 + 2] = pixel.b;
            if (useImageColors) { newColors[i * 3] = pixel.r; newColors[i * 3 + 1] = pixel.g; newColors[i * 3 + 2] = pixel.b; } 
            else { const shade = Math.pow(pixel.brightness, 1.5); newColors[i * 3] = defaultColorRGB.r * shade; newColors[i * 3 + 1] = defaultColorRGB.g * shade; newColors[i * 3 + 2] = defaultColorRGB.b * shade; }
        }
        normalizedShapeRef.current.targets = normTargets; const currentTargets = simulationData.targets; const scale = (SPHERE_RADIUS * 2.0) * densityScale;
        for(let i=0; i<particleCount*3; i++) { currentTargets[i] = normTargets[i] * scale; }
        simulationData.colors.set(newColors); simulationData.zOffsets.set(newZOffsets); simulationData.originalColors.set(newOriginalColors);
        if (pointsRef.current) pointsRef.current.geometry.attributes.color.needsUpdate = true;
        setIsProcessing(false);
    });
  }, [imageXY, imageYZ, simulationData, particleCount, color, useImageColors, canvasRotation]);

  // Pointer Interaction setup (same as before)
  useEffect(() => {
    let clickStartX = 0; let clickStartY = 0; let clickStartTime = 0;
    const handlePointerDown = (e: PointerEvent) => {
      if (e.button === 2) { isRightClicking.current = true; }
      if (e.button === 0) { clickStartX = e.clientX; clickStartY = e.clientY; clickStartTime = Date.now(); if (onStopAutoRotation) { onStopAutoRotation(); } }
    };
    const handlePointerUp = (e: PointerEvent) => {
        isRightClicking.current = false;
        if (disableMouseRepulsion) return;
        if (e.button === 0) {
            const diffX = Math.abs(e.clientX - clickStartX); const diffY = Math.abs(e.clientY - clickStartY); const diffTime = Date.now() - clickStartTime;
            if (diffX < 5 && diffY < 5 && diffTime < 300) {
                const { velocities } = simulationData; const explodeForce = 3.0 + (repulsionStrength / 100) * 10.0;
                for (let i = 0; i < particleCount * 3; i++) {
                    let mod = 1.0; if (activePreset === 'water') mod = 0.5; if (activePreset === 'electric') mod = 1.5; if (activePreset === 'mercury') mod = 0.3; if (activePreset === 'disco') mod = 1.2;
                    velocities[i] += (Math.random() - 0.5) * explodeForce * mod; 
                }
            }
        }
    };
    gl.domElement.addEventListener('pointerdown', handlePointerDown); gl.domElement.addEventListener('pointerup', handlePointerUp);
    return () => { gl.domElement.removeEventListener('pointerdown', handlePointerDown); gl.domElement.removeEventListener('pointerup', handlePointerUp); };
  }, [gl.domElement, simulationData, disableMouseRepulsion, repulsionStrength, particleCount, activePreset, onStopAutoRotation]);

  // Color update logic
  useEffect(() => {
    const { colors, originalColors } = simulationData;
    if (activePreset === 'none') {
        if ((imageXY || imageYZ) && useImageColors) { colors.set(originalColors); } 
        else {
            const c = new THREE.Color(color);
            for(let i=0; i<particleCount; i++) {
              if (imageXY || imageYZ) {
                   const origR = originalColors[i*3]; const origG = originalColors[i*3+1]; const origB = originalColors[i*3+2];
                   const brightness = 0.299 * origR + 0.587 * origG + 0.114 * origB; const contrastFactor = Math.pow(brightness, 1.5); 
                   colors[i*3] = c.r * contrastFactor; colors[i*3+1] = c.g * contrastFactor; colors[i*3+2] = c.b * contrastFactor;
              } else {
                  const r = c.r; const g = c.g; const b = c.b;
                  colors[i*3] = r; colors[i*3+1] = g; colors[i*3+2] = b;
                  originalColors[i*3] = r; originalColors[i*3+1] = g; originalColors[i*3+2] = b;
              }
            }
        }
        if (pointsRef.current) { pointsRef.current.geometry.attributes.color.needsUpdate = true; }
    }
  }, [color, useImageColors, imageXY, imageYZ, simulationData, particleCount, activePreset]);

  // --- ANIMATION LOOP ---
  useFrame((state) => {
    if (isDrawing || !pointsRef.current) return;

    // Auto Rotation
    if (isAutoRotating) {
        if (state.clock.elapsedTime > nextRotationChange.current) {
            nextRotationChange.current = state.clock.elapsedTime + 3;
            rotationVelocity.current.set( (Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02 );
        }
        const rot = pointsRef.current.rotation;
        rot.x += rotationVelocity.current.x; rot.y += rotationVelocity.current.y; rot.z += rotationVelocity.current.z;
        
        // Sync Trail rotation
        trailRefs.current.forEach(t => { if(t) t.rotation.copy(rot); });
    }

    let isAudioActive = audioMode !== 'none';
    let avgVolume = 0;
    if (isAudioActive && isPlaying && analyser && dataArrayRef.current) {
        analyser.getByteFrequencyData(dataArrayRef.current);
        let sum = 0; const len = dataArrayRef.current.length; for(let k=0; k < len; k++) { sum += dataArrayRef.current[k]; }
        avgVolume = sum / len; if (avgVolume < 5) isAudioActive = false;
    } else { isAudioActive = false; }

    const targetVis = visible ? 0 : 1; 
    visibilityProgress.current += (targetVis - visibilityProgress.current) * 0.05;
    const transVal = visibilityProgress.current;

    const { current, targets, velocities, zOffsets, colors } = simulationData;
    const positionsAttribute = pointsRef.current.geometry.attributes.position;
    const colorsAttribute = pointsRef.current.geometry.attributes.color;
    
    // Pointer
    const pointer = state.pointer;
    const isInsideCanvas = Math.abs(pointer.x) <= 1.05 && Math.abs(pointer.y) <= 1.05;
    let hasInteractionTarget = false;
    const rayOrigin = new THREE.Vector3(); const rayDir = new THREE.Vector3();
    if (isInsideCanvas && !disableMouseRepulsion && !isRightClicking.current && repulsionStrength > 0 && hasUserInteracted.current) {
        state.raycaster.setFromCamera(pointer, camera);
        rayOrigin.copy(state.raycaster.ray.origin);
        rayDir.copy(state.raycaster.ray.direction).normalize();
        hasInteractionTarget = true;
    }

    let springStrength = 0.05; let friction = 0.94;
    if (imageXY || imageYZ) { springStrength = 0.03; }
    if (isAudioActive) { springStrength = 0.15; friction = 0.80; }
    if (activePreset === 'water') { springStrength = 0.02; friction = 0.96; } 
    if (activePreset === 'electric') { springStrength = 0.1; friction = 0.85; }

    const dynamicRepulsionRadius = 1.0 + (repulsionRadius / 100) * 5.0; 
    const repulsionForce = (repulsionStrength / 50.0);
    const time = state.clock.elapsedTime;
    const bufferLength = dataArrayRef.current ? dataArrayRef.current.length : 1;

    const p = new THREE.Vector3(); const vLine = new THREE.Vector3(); const projected = new THREE.Vector3(); const distVec = new THREE.Vector3();
    const isTextMode = !!text; const applyAudioReactivity = isAudioActive && (!isTextMode || enableAudioReactivity);

    // Capture history before update
    if (enableTrails) {
        const currentBufferIndex = historyIndex.current % HISTORY_LENGTH;
        historyBuffers.current[currentBufferIndex].set(current);
        historyIndex.current++;
    }

    for (let i = 0; i < particleCount; i++) {
      const ix = i * 3; const iy = i * 3 + 1; const iz = i * 3 + 2;
      let px = current[ix]; let py = current[iy]; let pz = current[iz];
      let vx = velocities[ix]; let vy = velocities[iy]; let vz = velocities[iz];
      let tx = targets[ix]; let ty = targets[iy]; let tz = targets[iz];

      // Shape Logic
      if (imageXY || imageYZ) {
          const nx = zOffsets[ix]; const ny = zOffsets[iy]; const nz = zOffsets[iz];
          const rnd = randomnessRef.current ? randomnessRef.current[i] : 0;
          const thickness = depthIntensity * 4.0; 
          tx += nx * rnd * thickness; ty += ny * rnd * thickness; tz += nz * rnd * thickness;
          if (applyAudioReactivity && dataArrayRef.current) {
              const binIndex = i % (bufferLength / 2);
              const rawVal = dataArrayRef.current[binIndex] / 255.0;
              const audioSpike = rawVal * 4.0;
              tx += nx * audioSpike; ty += ny * audioSpike; tz += nz * audioSpike;
          }
      } else if (applyAudioReactivity && dataArrayRef.current) {
         const binIndex = i % (bufferLength / 2);
         const rawVal = dataArrayRef.current[binIndex] / 255.0;
         const spike = rawVal * 3.0;
         const len = Math.sqrt(tx*tx + ty*ty + tz*tz) || 1;
         tx += (tx/len) * spike; ty += (ty/len) * spike; tz += (tz/len) * spike;
      }

      // Physics
      vx += (tx - px) * springStrength; vy += (ty - py) * springStrength; vz += (tz - pz) * springStrength;
      
      if (activePreset === 'fire') { const noise = Math.sin(px * 0.5 + time * 2) * Math.cos(pz * 0.5 + time); vy += 0.02 + noise * 0.01; if (py > 6) { current[iy] = -6; } }
      else if (activePreset === 'water') { vy += Math.sin(px + time) * 0.01; }
      else if (activePreset === 'electric') { vx += (Math.random() - 0.5) * 0.1; vy += (Math.random() - 0.5) * 0.1; vz += (Math.random() - 0.5) * 0.1; }

      if (hasInteractionTarget) {
        p.set(px, py, pz); vLine.subVectors(p, rayOrigin); const t = vLine.dot(rayDir); projected.copy(rayOrigin).addScaledVector(rayDir, t); distVec.subVectors(p, projected); const distSq = distVec.lengthSq(); const radiusSq = dynamicRepulsionRadius * dynamicRepulsionRadius;
        if (distSq < radiusSq) {
            const dist = Math.sqrt(distSq); const forceFactor = (1 - dist / dynamicRepulsionRadius) * repulsionForce;
            let nx = 0, ny = 0, nz = 0; if (dist > 0.0001) { nx = distVec.x / dist; ny = distVec.y / dist; nz = distVec.z / dist; } else { nx = Math.random() - 0.5; ny = Math.random() - 0.5; nz = Math.random() - 0.5; }
            vx += nx * forceFactor; vy += ny * forceFactor; vz += nz * forceFactor;
        }
      }

      vx *= friction; vy *= friction; vz *= friction;
      px += vx; py += vy; pz += vz;
      velocities[ix] = vx; velocities[iy] = vy; velocities[iz] = vz;
      current[ix] = px; current[iy] = py; current[iz] = pz;

      if (transVal > 0.001) {
          const explosionRadius = 50.0 * transVal * transVal; const len = Math.sqrt(px*px + py*py + pz*pz) || 1;
          const dirX = px / len; const dirY = py / len; const dirZ = pz / len; const rnd = randomnessRef.current ? randomnessRef.current[i] : 0;
          px += dirX * explosionRadius + (rnd * explosionRadius * 0.5); py += dirY * explosionRadius + (rnd * explosionRadius * 0.5); pz += dirZ * explosionRadius + (rnd * explosionRadius * 0.5);
      }

      positionsAttribute.setXYZ(i, px, py, pz);

      // Color Updates
       if (activePreset !== 'none' || applyAudioReactivity || transVal > 0.001) {
           let r=1, g=1, b=1;
           if (activePreset === 'none' && applyAudioReactivity) {
               let freqValue = 0; if (dataArrayRef.current) freqValue = dataArrayRef.current[i % bufferLength] / 255.0;
               let baseR = simulationData.originalColors[ix] || 1; let baseG = simulationData.originalColors[iy] || 1; let baseB = simulationData.originalColors[iz] || 1;
               const boost = 1.0 + freqValue * 1.5; r = baseR * boost; g = baseG * boost; b = baseB * boost;
           } else if (activePreset === 'fire') { r = 1.0; g = Math.random() * 0.5; b = 0.0; } 
           else if (activePreset === 'water') { r = 0.0; g = 0.5; b = 1.0; } 
           else if (activePreset === 'electric') { const flicker = Math.random() > 0.9 ? 1.0 : 0.7; r = 0.6 * flicker; g = 0.9 * flicker; b = 1.0 * flicker; } 
           else if (activePreset === 'mercury') { r = 0.7; g = 0.7; b = 0.8; } 
           else if (activePreset === 'disco') { const freq = 0.3; r = Math.sin(current[ix] * freq + time) * 0.5 + 0.5; g = Math.sin(current[iy] * freq + time + 2) * 0.5 + 0.5; b = Math.sin(current[iz] * freq + time + 4) * 0.5 + 0.5; } 
           else { r = simulationData.originalColors[ix]; g = simulationData.originalColors[iy]; b = simulationData.originalColors[iz]; }
           if (transVal > 0) { const fade = 1.0 - transVal; r *= fade; g *= fade; b *= fade; }
           colors[ix] = Math.min(1,r); colors[iy] = Math.min(1,g); colors[iz] = Math.min(1,b);
           colorsAttribute.setXYZ(i, colors[ix], colors[iy], colors[iz]);
       }
    }

    positionsAttribute.needsUpdate = true;
    if (activePreset !== 'none' || applyAudioReactivity || transVal > 0.001) { colorsAttribute.needsUpdate = true; }
    if (previousPositions) { previousPositions.current = current; }

    // --- GHOST TRAIL UPDATE ---
    if (enableTrails) {
        // Iterate over history echoes
        for (let t = 0; t < HISTORY_LENGTH; t++) {
            const trailPoints = trailRefs.current[t];
            if (trailPoints) {
                // Determine which history buffer to use for this trail
                // We go backwards: index - 1, index - 2...
                // Use modulo arithmetic to wrap around circular buffer
                let bufferIdx = (historyIndex.current - 1 - t) % HISTORY_LENGTH;
                if (bufferIdx < 0) bufferIdx += HISTORY_LENGTH;
                
                const historyPos = historyBuffers.current[bufferIdx];
                const trailPosAttr = trailPoints.geometry.attributes.position;
                
                // We update ALL positions for the trail mesh from the history buffer
                // This is fast (single set per frame for the whole attribute)
                (trailPosAttr.array as Float32Array).set(historyPos);
                trailPosAttr.needsUpdate = true;
                
                // Sync colors if needed (for now just use main colors)
                if (activePreset !== 'none' || applyAudioReactivity) {
                    const trailColAttr = trailPoints.geometry.attributes.color;
                    (trailColAttr.array as Float32Array).set(colors);
                    trailColAttr.needsUpdate = true;
                }
            }
        }
    }

  });
  
  if (isDrawing) return null;

  let computedSize = 0.01 + (particleSize / 100) * 0.2;
  if (activePreset === 'mercury') computedSize *= 1.5;

  return (
    <group>
        <points ref={pointsRef} key={particleCount}> 
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={particleCount} array={simulationData.current} itemSize={3} usage={THREE.DynamicDrawUsage} />
            <bufferAttribute attach="attributes-color" count={particleCount} array={simulationData.colors} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial color="#ffffff" vertexColors={true} size={activePreset === 'mercury' ? computedSize * 1.5 : computedSize} sizeAttenuation={true} transparent={true} opacity={activePreset === 'mercury' ? 1.0 : 0.9} blending={activePreset === 'fire' || activePreset === 'electric' || activePreset === 'disco' ? THREE.AdditiveBlending : THREE.NormalBlending} depthWrite={false} />
        </points>

        {/* GHOST TRAILS (ECHOES) */}
        {enableTrails && Array.from({ length: HISTORY_LENGTH }).map((_, i) => {
            const opacity = 0.4 * (1 - i / HISTORY_LENGTH); // Fade out: 0.4 -> 0
            const size = computedSize * (1 - i * 0.1); // Shrink slightly
            return (
                <points key={`trail-${i}`} ref={(el) => trailRefs.current[i] = el}>
                    <bufferGeometry>
                        <bufferAttribute attach="attributes-position" count={particleCount} array={new Float32Array(particleCount * 3)} itemSize={3} usage={THREE.DynamicDrawUsage} />
                        <bufferAttribute attach="attributes-color" count={particleCount} array={simulationData.colors} itemSize={3} usage={THREE.DynamicDrawUsage} />
                    </bufferGeometry>
                    <pointsMaterial 
                        color="#ffffff" 
                        vertexColors={true} 
                        size={size} 
                        sizeAttenuation={true} 
                        transparent={true} 
                        opacity={opacity} 
                        blending={THREE.AdditiveBlending} 
                        depthWrite={false} 
                    />
                </points>
            );
        })}
    </group>
  );
};
