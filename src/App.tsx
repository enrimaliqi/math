/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Car, 
  Droplets, 
  Wrench, 
  Play, 
  Pause, 
  RotateCcw, 
  HelpCircle, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Layout,
  GraduationCap,
  Info,
  MessageSquare,
  Sparkles,
  Send,
  X,
  Bot
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import katex from 'katex';
import { askAI, analyzeState, AIContext } from './services/aiService';

// --- Types ---
type Section = 'theory' | 'car' | 'tank' | 'farm' | 'outcomes' | 'derivative_deep' | 'integral_deep' | 'exponential' | 'real_world';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

// --- Constants ---
const SPEED_LIMIT = 50; // km/h (equivalent units in the simulation)
const PRICE_PER_M2 = 2; // €

// --- Components ---

const Formula = ({ tex, className = "", inline = false }: { tex: string, className?: string, inline?: boolean }) => {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        // Enforce \displaystyle for better looking math even when inline, per user request for "textbook quality"
        const formula = inline ? `\\textstyle ${tex}` : `\\displaystyle ${tex}`;
        katex.render(formula, containerRef.current, {
          throwOnError: false,
          displayMode: !inline,
          output: 'html',
          strict: false,
          trust: true
        });
      } catch (e) {
        console.error("KaTeX rendering error:", e);
      }
    }
  }, [tex, inline]);

  const Tag = inline ? 'span' : 'div';
  return <Tag ref={containerRef as any} className={`${inline ? 'inline-formula px-1' : 'block-formula w-full my-6 flex justify-center py-4 bg-white/5 rounded-2xl overflow-x-auto custom-scrollbar'} ${className}`} style={{ fontSize: '1em' }} />;
};

const Graph = ({ 
  data, 
  width = 400, 
  height = 200, 
  xLabel = 't', 
  yLabel = 'y', 
  color = '#3b82f6',
  highlightX = null as number | null,
  highlightY = null as number | null,
  limitLine = null as number | null,
  isExceeding = false,
  tangent = null as { slope: number, intercept: number, x: number, y?: number, label?: string } | null,
  showArea = false,
  peakPoint = null as { x: number, y: number } | null,
  strokeWidth = 2,
  pulse = false
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number, y: number, screenX: number, screenY: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const padding = 30;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;

  const minX = 0;
  const maxX = 10;
  const minY = Math.min(0, ...data.map(d => d.y));
  const dataMaxY = Math.max(...data.map(d => d.y));
  const maxY = Math.max(minY + 2, dataMaxY * 1.15); // Dynamic scaling with minimum headroom

  const toX = (val: number) => padding + (val / maxX) * graphWidth;
  const toY = (val: number) => height - padding - ((val - minY) / (maxY - minY)) * graphHeight;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || data.length === 0) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (width / rect.width);
    
    const xVal = ((mouseX - padding) / graphWidth) * maxX;
    
    const nearest = data.reduce((prev, curr) => {
      return (Math.abs(curr.x - xVal) < Math.abs(prev.x - xVal) ? curr : prev);
    });
    
    if (Math.abs(toX(nearest.x) - mouseX) < 20) {
      setHoveredPoint({
        ...nearest,
        screenX: toX(nearest.x),
        screenY: toY(nearest.y)
      });
    } else {
      setHoveredPoint(null);
    }
  };

  const points = data.map(d => `${toX(d.x)},${toY(d.y)}`).join(' ');

  // Create area path for integral visualization
  const areaData = data.filter(d => d.x <= (highlightX || 0));
  const areaPoints = areaData.length > 0 
    ? [
        `${toX(0)},${toY(0)}`,
        ...areaData.map(d => `${toX(d.x)},${toY(d.y)}`),
        `${toX(areaData[areaData.length - 1].x)},${toY(0)}`
      ].join(' ')
    : "";

  return (
    <div className="relative bg-[#F9FAFB] rounded-xl border border-border-main flex-grow overflow-hidden p-2 group">
      <svg 
        ref={svgRef}
        width="100%" 
        height={height} 
        viewBox={`0 0 ${width} ${height}`} 
        className="overflow-visible cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredPoint(null)}
      >
        {/* Grid lines */}
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#D1D5DB" strokeWidth="1" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#D1D5DB" strokeWidth="1" />
        
        {/* Integral Area Shading */}
        {showArea && areaPoints && (
          <polyline
            fill={color}
            fillOpacity="0.1"
            points={areaPoints}
          />
        )}
        <polyline
          fill="none"
          stroke={isExceeding ? "#ef4444" : color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          points={points}
          className="transition-colors duration-300"
        />

        {/* Limit Line */}
        {limitLine !== null && (
          <line 
            x1={padding} 
            y1={toY(limitLine)} 
            x2={width - padding} 
            y2={toY(limitLine)} 
            stroke="#ef4444" 
            strokeWidth="2" 
            strokeDasharray="4 4" 
          />
        )}

        {/* Tangent Line */}
        {tangent && (
          <g>
            {/* The Tangent Line */}
            <motion.line 
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: 1,
                strokeWidth: pulse ? 4 : 2.5
              }}
              x1={toX(Math.max(0, tangent.x - 3))} 
              y1={toY(tangent.slope * (Math.max(0, tangent.x - 3)) + tangent.intercept)}
              x2={toX(Math.min(maxX, tangent.x + 3))} 
              y2={toY(tangent.slope * (Math.min(maxX, tangent.x + 3)) + tangent.intercept)}
              stroke="#10b981"
              strokeLinecap="round"
              className={pulse ? "animate-pulse" : ""}
            />
            {/* Slope Indicator (Rise/Run visualization) */}
            <path 
              d={`M ${toX(tangent.x)} ${toY(tangent.y ?? (tangent.slope * tangent.x + tangent.intercept))} 
                 L ${toX(tangent.x + 1)} ${toY(tangent.slope * tangent.x + tangent.intercept)} 
                 L ${toX(tangent.x + 1)} ${toY(tangent.slope * (tangent.x + 1) + tangent.intercept)}`}
              fill="none"
              stroke="#10b981"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              opacity="0.6"
            />
            <text 
              x={toX(tangent.x > maxX - 2 ? tangent.x - 3.5 : tangent.x + 0.5)} 
              y={toY(tangent.slope * (tangent.x > maxX - 2 ? tangent.x - 3.5 : tangent.x + 0.5) + tangent.intercept) - 12} 
              fontSize="10" 
              fontWeight="900"
              fill="#059669"
              className="uppercase tracking-tighter drop-shadow-md"
            >
              {tangent.label || 'pjerrësia'}
            </text>
          </g>
        )}

        {/* Highlight Point */}
        {highlightX !== null && highlightY !== null && (
          <g>
            {pulse && (
              <motion.circle 
                cx={toX(highlightX)} 
                cy={toY(highlightY)} 
                r="12" 
                fill={color}
                initial={{ scale: 0.5, opacity: 0.5 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              />
            )}
            <circle cx={toX(highlightX)} cy={toY(highlightY)} r="5" fill={color} />
            <line x1={toX(highlightX)} y1={height - padding} x2={toX(highlightX)} y2={toY(highlightY)} stroke={color} strokeDasharray="2 2" />
            <line x1={padding} y1={toY(highlightY)} x2={toX(highlightX)} y2={toY(highlightY)} stroke={color} strokeDasharray="2 2" />
          </g>
        )}

        {/* Peak Point */}
        {peakPoint && (
          <g>
            <circle cx={toX(peakPoint.x)} cy={toY(peakPoint.y)} r="6" fill="#10b981" fillOpacity="0.2" />
            <circle cx={toX(peakPoint.x)} cy={toY(peakPoint.y)} r="3" fill="#059669" />
            <text x={toX(peakPoint.x)} y={toY(peakPoint.y) - 12} fontSize="9" fontWeight="black" fill="#059669" textAnchor="middle" className="uppercase">Maksimumi</text>
          </g>
        )}

        {/* Labels */}
        <text x={width - 20} y={height - padding + 18} fontSize="12" fontWeight="bold" fill="#6B7280" textAnchor="middle">{xLabel}</text>
        <text x={padding - 18} y={padding - 8} fontSize="12" fontWeight="bold" fill="#6B7280" textAnchor="start">{yLabel}</text>

        {/* Interactive Tooltip and Hover Indicator */}
        <AnimatePresence>
          {hoveredPoint && (
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              {/* Crosshair Lines */}
              <line 
                x1={hoveredPoint.screenX} 
                y1={padding} 
                x2={hoveredPoint.screenX} 
                y2={height - padding} 
                stroke={color} 
                strokeWidth="1" 
                strokeDasharray="4 2" 
                opacity="0.3"
              />
              <line 
                x1={padding} 
                y1={hoveredPoint.screenY} 
                x2={width - padding} 
                y2={hoveredPoint.screenY} 
                stroke={color} 
                strokeWidth="1" 
                strokeDasharray="4 2" 
                opacity="0.3"
              />
              
              {/* Intersection circle */}
              <motion.circle 
                cx={hoveredPoint.screenX} 
                cy={hoveredPoint.screenY} 
                r="5" 
                fill="white" 
                stroke={color} 
                strokeWidth="2.5" 
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
              />

              {/* Tooltip background with shadow and better styling */}
              <g transform={`translate(${hoveredPoint.screenX > width / 2 ? hoveredPoint.screenX - 95 : hoveredPoint.screenX + 15}, ${hoveredPoint.screenY - 50})`}>
                <rect
                  width="80"
                  height="40"
                  rx="10"
                  fill="#ffffff"
                  stroke={color}
                  strokeWidth="1.5"
                  className="shadow-2xl"
                  filter="drop-shadow(0 4px 6px rgba(0,0,0,0.1))"
                />
                <text
                  x="40"
                  y="16"
                  fill={color}
                  fontSize="9"
                  fontWeight="900"
                  textAnchor="middle"
                  className="font-mono uppercase tracking-tighter"
                >
                  {xLabel}: {hoveredPoint.x.toFixed(2)}
                </text>
                <text
                  x="40"
                  y="30"
                  fill="#1e293b"
                  fontSize="11"
                  fontWeight="900"
                  textAnchor="middle"
                  className="font-mono"
                >
                  {yLabel}: {hoveredPoint.y.toFixed(2)}
                </text>
              </g>
            </motion.g>
          )}
        </AnimatePresence>
      </svg>
    </div>
  );
};

const SectionHeader = ({ index, title, subtitle, colorClass }: { index: string, title: string, subtitle: string, colorClass: string }) => (
  <div className="mb-6">
    <h2 className={`text-xs font-bold uppercase tracking-widest ${colorClass} mb-1`}>{index}. {subtitle}</h2>
    <h3 className="text-2xl font-serif italic text-gray-900">{title}</h3>
  </div>
);

const SimpleExplanation = ({ content }: { content: string }) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.95 }}
    className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100 shadow-sm"
  >
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
        <Info className="w-4 h-4 text-white" />
      </div>
      <div className="text-sm text-blue-900 leading-relaxed markdown-content">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm, remarkMath]} 
          rehypePlugins={[rehypeKatex]}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  </motion.div>
);

export default function App() {
  const [activeSection, setActiveSection] = useState<Section>('theory');
  const [time, setTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isPresenting, setIsPresenting] = useState(false);
  
  // AI States
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Përshëndetje! Jam Profesori yt i AI. Mund të shpjegoj Derivatet, Integralet, Optimizimin dhe çdo gjë tjetër që të intereson rreth Kalkulusit. Pyetmë çfarëdo gjëje!' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isAIAsking, setIsAIAsking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isChatOpen]);

  const currentAIContext: AIContext = useMemo(() => {
    if (activeSection === 'car') return 'CAR';
    if (activeSection === 'tank') return 'TANK';
    if (activeSection === 'farm') return 'FARM';
    if (activeSection === 'exponential') return 'EXP';
    return 'GENERAL';
  }, [activeSection]);
  
  // Animation Loop
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setTime(prev => {
          if (prev >= 10) return 0;
          return +(prev + 0.05).toFixed(2);
        });
      }, 50);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // --- Logic for Car ---
  const s = (t: number) => 0.1 * t ** 3 + 0.5 * t ** 2 + 5 * t; // Position
  const v = (t: number) => 0.3 * t ** 2 + 1.0 * t + 5;        // First derivative: velocity
  const acc = (t: number) => 0.6 * t + 1.0;                    // Second derivative: acceleration
  const carDataS = useMemo(() => Array.from({ length: 101 }, (_, i) => ({ x: i / 10, y: s(i / 10) })), []);
  const carDataV = useMemo(() => Array.from({ length: 101 }, (_, i) => ({ x: i / 10, y: v(i / 10) })), []);
  const carDataA = useMemo(() => Array.from({ length: 101 }, (_, i) => ({ x: i / 10, y: acc(i / 10) })), []);
  const currentS = s(time);
  const currentV = v(time);
  const currentA = acc(time);
  const isSpeeding = currentV > SPEED_LIMIT;
  
  // Tangent for Car
  const tangentLine = {
    slope: currentV,
    intercept: currentS - currentV * time,
    x: time,
    y: currentS,
    label: 'pjerrësia = shpejtësia'
  };

  const tangentLineV = {
    slope: currentA,
    intercept: currentV - currentA * time,
    x: time,
    y: currentV,
    label: 'pjerrësia = nxitimi'
  };

  // --- Logic for Water Tank ---
  const flowRate = (t: number) => 5 + 3 * Math.sin(t);
  const tankFlowData = useMemo(() => Array.from({ length: 101 }, (_, i) => ({ x: i / 10, y: flowRate(i / 10) })), []);
  
  // Volume is integral of flowRate: 5t - 3cos(t) + 3 (so V(0) = 0)
  const volume = (t: number) => 5 * t - 3 * Math.cos(t) + 3;
  const tankVolumeData = useMemo(() => Array.from({ length: 101 }, (_, i) => ({ x: i / 10, y: volume(i / 10) })), []);
  const currentVolume = volume(time);
  const maxVolume = volume(10);
  const tankPercent = Math.round((currentVolume / maxVolume) * 100);

  // --- Logic for Farm ---
  const perimeter = 40;
  const [xVal, setXVal] = useState(10);
  const area = (x: number) => x * (perimeter / 2 - x);
  const optimalX = perimeter / 4;
  const currentArea = area(xVal);
  const currentProfit = currentArea * PRICE_PER_M2;
  const farmData = useMemo(() => Array.from({ length: 101 }, (_, i) => ({ x: (i / 100) * (perimeter / 2), y: area((i / 100) * (perimeter / 2)) })), [perimeter]);

  // --- Logic for Exponential & Logarithmic ---
  const [growthRate, setGrowthRate] = useState(0.4);
  const initialPop = 1;
  const expFn = (t: number) => initialPop * Math.pow(Math.E, growthRate * t);
  const expDeriv = (t: number) => growthRate * expFn(t);
  const expData = useMemo(() => Array.from({ length: 101 }, (_, i) => ({ x: i / 10, y: expFn(i / 10) })), [growthRate]);
  const currentExp = expFn(time);
  
  const logFn = (x: number) => x > 0 ? Math.log(x) : -5;
  const logDeriv = (x: number) => x > 0 ? 1 / x : 0;
  const logData = useMemo(() => Array.from({ length: 101 }, (_, i) => ({ x: (i + 1) / 10, y: logFn((i + 1) / 10) })), []);
  const currentLog = logFn(time + 0.1);

  const tangentExp = {
    slope: expDeriv(time),
    intercept: expFn(time) - expDeriv(time) * time,
    x: time,
    y: expFn(time),
    label: `pjerrësia = ${growthRate} * f(t)`
  };

  const handleAskAI = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isAIAsking) return;

    const userMsg = chatInput;
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsAIAsking(true);

    try {
      const response = await askAI(
        userMsg, 
        currentAIContext, 
        messages.map(m => ({ role: m.role, text: m.text })),
        {
          time,
          currentValue: activeSection === 'car' ? { s: currentS, v: currentV } : 
                        activeSection === 'tank' ? { volume: currentVolume } : 
                        activeSection === 'farm' ? { x: xVal, area: currentArea } : 
                        activeSection === 'exponential' ? { population: currentExp, rate: growthRate } : {}
        }
      );

      setMessages(prev => [...prev, { role: 'model', text: response || 'Ndonjë pyetje tjetër?' }]);
    } catch (err) {
      console.error("AI Error:", err);
      setMessages(prev => [...prev, { 
        role: 'model', 
        text: "Ndodhi një gabim gjatë përpunimit të kërkesës tuaj. Ju lutem provoni përsëri ose riformuloni pyetjen tuaj rreth kalkulusit." 
      }]);
    } finally {
      setIsAIAsking(false);
    }
  };

  const handleAIExplain = async () => {
    setIsAIAsking(true);
    setIsChatOpen(true);
    try {
      const analysis = await analyzeState({
        context: currentAIContext,
        time,
        currentValue: activeSection === 'car' ? { s: currentS, v: currentV } : 
                      activeSection === 'tank' ? { volume: currentVolume } : 
                      activeSection === 'farm' ? { x: xVal, area: currentArea } : 
                      activeSection === 'exponential' ? { population: currentExp, rate: growthRate } : {}
      });
      setMessages(prev => [...prev, { role: 'model', text: analysis || 'Nuk mund ta analizoja këtë moment.' }]);
    } catch (err) {
      console.error("AI Analysis Error:", err);
      setMessages(prev => [...prev, { 
        role: 'model', 
        text: "Pati një problem gjatë analizimit të situatës aktuale. Provoni të ndryshoni parametrat e simulimit dhe kërkoni përsëri shpjegim." 
      }]);
    } finally {
      setIsAIAsking(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface text-text-main font-sans flex flex-col overflow-hidden select-none">
      {/* Top Header Navigation */}
      <header className="h-16 border-b border-border-main bg-white flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand rounded flex items-center justify-center text-white font-bold">Σ</div>
          <div className="flex flex-col">
            <h1 className="font-bold text-sm tracking-tight text-[#111827] leading-none uppercase">
              Gjimnazi "Partizani"
            </h1>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
              Lënda: Matematike | Klasa XII
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <nav className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
            {(['theory', 'derivative_deep', 'integral_deep', 'car', 'tank', 'exponential', 'farm', 'real_world', 'outcomes'] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setActiveSection(s); setTime(0); setIsPlaying(false); setShowExplanation(false); }}
                className={`px-3 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all ${
                  activeSection === s 
                  ? 'bg-brand text-white shadow-sm' 
                  : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {s === 'theory' ? 'Teoria' : s === 'derivative_deep' ? 'Derivatet' : s === 'exponential' ? 'Eksponencialet' : s === 'car' ? 'Makina' : s === 'integral_deep' ? 'Integralet' : s === 'tank' ? 'Rezervuari' : s === 'farm' ? 'Ferma' : s === 'real_world' ? 'Probleme' : 'Rezultatet'}
              </button>
            ))}
          </nav>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden md:block text-[10px] font-mono bg-gray-100 px-3 py-1 rounded border border-gray-200 uppercase text-gray-500 tracking-tighter">
            Viti: 2025-2026
          </div>
        </div>
      </header>

      <main className={`flex-grow flex flex-col md:flex-row gap-px bg-border-main overflow-hidden ${isPresenting ? 'text-lg' : ''}`}>
        {/* Main Workspace Area */}
        <div className={`flex-grow bg-white overflow-y-auto custom-scrollbar ${isPresenting ? 'p-12' : 'p-6'}`}>
          <AnimatePresence mode="wait">
            {activeSection === 'theory' && (
              <motion.div 
                key="theory"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-5xl mx-auto space-y-12 pb-20"
              >
                <div className="text-center space-y-4 mb-16">
                  <h2 className="text-4xl font-serif italic text-gray-900">Teoria Bazë</h2>
                  <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Bazat e Kalkulusit dhe Rregullat Kryesore</p>
                </div>

                <div className="grid grid-cols-1 gap-12">
                  {/* Card: Derivati Deep */}
                  <div className="bg-blue-900 p-8 rounded-3xl border border-blue-800 shadow-xl overflow-hidden relative group">
                    <div className="absolute inset-0 bg-blue-500 opacity-5 group-hover:opacity-10 transition-opacity" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                          <TrendingUp className="w-6 h-6 text-blue-300" />
                        </div>
                        <h4 className="text-xl font-black text-white">Derivati (ndryshimi)</h4>
                      </div>
                      
                      <div className="space-y-4 text-blue-100 text-sm leading-relaxed mb-8">
                        <div>
                          Derivati mat shkallën e ndryshimit të një funksioni në një pikë të caktuar. Nëse keni një grafik, derivati është <strong>pjerrësia</strong> e vijës tangjente në atë pikë.
                        </div>
                        
                        <div className="bg-blue-950/40 p-5 rounded-xl border border-blue-400/20 shadow-inner">
                          <h5 className="text-xs uppercase font-black text-blue-400 mb-3 tracking-wider px-1">Rregulla e Fuqisë:</h5>
                          <div className="font-serif text-2xl text-white">
                            <Formula tex="\frac{d}{dx} \left( x^n \right) = n \cdot x^{n-1}, \quad n \in \mathbb{R}" />
                          </div>
                        </div>

                        <ul className="space-y-3">
                          <li className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-1.5 shrink-0" />
                            <span><strong>Pikat e Kthesës:</strong> Kur derivati <Formula tex="f'(x) = 0" inline />, kemi një ekstremum lokal (pjerrësia është <Formula tex="0" inline />).</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-1.5 shrink-0" />
                            <span><strong>Nxitimi:</strong> Derivati i dytë <Formula tex="f''(x) = \frac{d^2y}{dx^2}" inline /> tregon shkallën e ndryshimit të pjerrësisë.</span>
                          </li>
                        </ul>
                      </div>

                      <div className="bg-blue-950/50 p-8 rounded-2xl border border-blue-400/30 flex flex-col items-center gap-4 shadow-xl">
                        <div className="font-serif text-3xl text-blue-300 w-full overflow-x-auto text-center py-2">
                          <Formula tex="f'(x) = \lim_{\Delta x \to 0} \frac{f(x+\Delta x) - f(x)}{\Delta x}" />
                        </div>
                        <p className="text-xs text-blue-400/80 font-bold uppercase tracking-widest text-center">Përkufizimi formal përmes limitit</p>
                      </div>
                    </div>
                  </div>

                  {/* Card: Integrali Deep */}
                  <div className="bg-cyan-900 p-8 rounded-3xl border border-cyan-800 shadow-xl overflow-hidden relative group">
                    <div className="absolute inset-0 bg-cyan-500 opacity-5 group-hover:opacity-10 transition-opacity" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center">
                          <Droplets className="w-6 h-6 text-cyan-300" />
                        </div>
                        <h4 className="text-xl font-black text-white">Integrali (Akumulimi)</h4>
                      </div>

                      <div className="space-y-4 text-cyan-100 text-sm leading-relaxed mb-8">
                        <div>
                          Integrali është mbledhja e pafundme e pjesëve të vogla. Ai shërben për të gjetur <strong>sipërfaqen</strong> nën një kurbë ose totalin e akumuluar.
                        </div>

                        <div className="bg-cyan-950/40 p-5 rounded-xl border border-cyan-400/20 shadow-inner">
                          <h5 className="text-xs uppercase font-black text-cyan-400 mb-3 tracking-wider px-1">Integrali i Fuqisë:</h5>
                          <div className="font-serif text-2xl text-white">
                            <Formula tex="\int x^n \, dx = \frac{x^{n+1}}{n+1} + C, \quad n \neq -1" />
                          </div>
                        </div>

                        <ul className="space-y-3">
                          <li className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full mt-1.5 shrink-0" />
                            <span><strong>I Pacaktuar:</strong> <Formula tex="\int f(x) \, dx = F(x) + C" inline /> llogarit funksionin bazë plus një konstante.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full mt-1.5 shrink-0" />
                            <span><strong>I Caktuar:</strong> <Formula tex="\int_{a}^{b} f(x) \, dx" inline /> llogarit vlerën e saktë midis dy kufijve realë.</span>
                          </li>
                        </ul>
                      </div>

                      <div className="bg-cyan-950/50 p-8 rounded-2xl border border-cyan-400/30 flex flex-col items-center gap-4 shadow-xl">
                        <div className="font-serif text-3xl text-cyan-300 w-full text-center py-2">
                          <Formula tex="\mathcal{A} = \int_{a}^{b} f(x) \, dx" />
                        </div>
                        <p className="text-xs text-cyan-400/80 font-bold uppercase tracking-widest text-center">Sipërfaqja midis kufijve $a$ dhe $b$</p>
                      </div>
                    </div>
                  </div>
                </div>


                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   {/* Card: Funksionet Eksponenciale & Logaritmike - EXPANDED */}
                  <div className="bg-purple-900 p-8 rounded-3xl border border-purple-800 shadow-xl overflow-hidden relative group md:col-span-2">
                    <div className="absolute inset-0 bg-purple-500 opacity-5 group-hover:opacity-10 transition-opacity" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                          <Sparkles className="w-6 h-6 text-purple-300" />
                        </div>
                        <h4 className="text-xl font-black text-white uppercase tracking-tighter">Eksponencialet, Logaritmet dhe Numri $e$</h4>
                      </div>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                        <div className="space-y-6">
                          <div className="bg-purple-950/40 p-5 rounded-2xl border border-purple-400/20">
                            <h5 className="text-xs font-bold text-purple-300 uppercase mb-3 px-1">Gjuha e Natyrës: Numri e</h5>
                            <div className="text-purple-100 text-base leading-relaxed mb-4">
                              Konstantja e Eulerit <Formula tex="\mathbf{e} \approx 2.71828" inline /> është baza e rritjes "natyrale". Funksioni <Formula tex="f(x) = e^x" inline /> ka veçantinë ku shkalla e ndryshimit është saktësisht sa vlera e tij.
                            </div>
                            <div className="font-serif text-2xl text-center text-white bg-purple-950/50 p-4 rounded-xl border border-purple-400/20 shadow-lg my-4">
                              <Formula tex="\frac{d}{dx} \left( e^x \right) = e^x" />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-start gap-3">
                              <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-1.5 shrink-0" />
                              <div className="text-purple-100 text-sm">
                                <strong>Logaritmi Natyror (<Formula tex="\ln(x)" inline />):</strong> Inversi i <Formula tex="e^x" inline />. Derivati i tij është <Formula tex="\frac{d}{dx}\ln(x) = \frac{1}{x}" inline />, duke lidhur fuqitë me thyesat.
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-1.5 shrink-0" />
                              <div className="text-purple-100 text-sm">
                                <strong>Rritja dhe Zbuerja:</strong> Përdoret për të modeluar fenomene proporcionale: nga popullsia (<Formula tex="P(t) = P_0 \cdot e^{rt}" inline />) te ftohja.
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div className="bg-white/5 p-6 rounded-2xl border border-white/10 shadow-inner">
                            <h5 className="text-[10px] font-black text-purple-300 uppercase tracking-widest mb-4">Aplikimet në Jetën Reale</h5>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-purple-950/30 p-3 rounded-xl border border-purple-400/10">
                                <span className="block text-[10px] font-bold text-purple-400 uppercase mb-1">Rritja</span>
                                <span className="text-[11px] text-purple-100 italic">Interesi bankar, përhapja e viruseve, bakteret.</span>
                              </div>
                              <div className="bg-purple-950/30 p-3 rounded-xl border border-purple-400/10">
                                <span className="block text-[10px] font-bold text-purple-400 uppercase mb-1">Zbehja</span>
                                <span className="text-[11px] text-purple-100 italic">Radioaktiviteti, rënia e vlerës, shuarja e zërit.</span>
                              </div>
                            </div>
                          </div>

                          <div className="bg-purple-950/60 p-8 rounded-3xl border border-purple-400/30 flex flex-col items-center gap-6 shadow-2xl transition-all hover:border-purple-400/50">
                            <div className="font-serif text-3xl text-purple-300 flex flex-col gap-6 items-center w-full">
                              <div className="flex justify-between w-full px-6 items-center bg-white/5 py-4 rounded-xl">
                                <span className="text-[10px] opacity-70 font-sans font-black tracking-[0.2em] uppercase">Derivati</span>
                                <Formula tex="\frac{d}{dx} \ln(x) = \frac{1}{x}" inline className="text-lg" />
                              </div>
                              <div className="flex justify-between w-full px-6 items-center bg-white/5 py-4 rounded-xl">
                                <span className="text-[10px] opacity-70 font-sans font-black tracking-[0.2em] uppercase">Integrali</span>
                                <Formula tex="\int \frac{1}{x} \, dx = \ln|x| + C" inline className="text-lg" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-900 p-10 rounded-3xl text-white relative overflow-hidden text-center border-b-4 border-brand">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 opacity-30" />
                  <p className="text-gray-300 leading-relaxed text-xl font-serif italic mb-6">
                    "Kalkulusi nuk është thjesht matematikë; është gjuha e ndryshimit dhe lëvizjes. Përmes tij, ne mund të parashikojmë të ardhmen dhe të kuptojmë pafundësinë."
                  </p>
                  <div className="inline-flex items-center gap-4">
                    <div className="h-px w-8 bg-gray-700" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Isaac Newton & Gottfried Leibniz</span>
                    <div className="h-px w-8 bg-gray-700" />
                  </div>
                </div>
              </motion.div>
            )}

            {activeSection === 'derivative_deep' && (
              <motion.div 
                key="derivative_deep"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-5xl mx-auto space-y-8"
              >
                 <SectionHeader 
                  index="01"
                  title="Thellim në Derivate" 
                  subtitle="TEORIA DHE EKSTREMUMET"
                  colorClass="text-brand"
                />
                
                <div className="grid grid-cols-1 gap-12">
                  <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-border-main">
                      <h4 className="font-bold text-gray-900 mb-4">Njehsimi me Përkufizim</h4>
                      <div className="text-sm text-gray-600 leading-relaxed">
                        Nxënësi duhet të jetë në gjendje të njehsojë derivatin e një funksioni (p.sh. <Formula tex="f(x)=x^2" inline />) duke përdorur limitin formal:
                        <br/><br/>
                        <Formula tex="f'(x) = \lim_{h \to 0} \frac{(x+h)^2 - x^2}{h} = \lim_{h \to 0} \frac{2xh + h^2}{h} = 2x" />
                      </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-border-main">
                      <h4 className="font-bold text-gray-900 mb-4">Ekstremumet e Funksionit</h4>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        Pikat ku derivati i parë është zero (<Formula tex="f'(x)=0" inline />) quhen pika stacionare. Këto pika na ndihmojnë të gjejmë:
                      </p>
                      <ul className="mt-4 space-y-2 text-xs font-bold text-brand">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" /> Maksimumin Lokal
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" /> Minimumin Lokal
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div className="bg-blue-50 p-8 rounded-3xl border border-blue-100 flex flex-col justify-center text-center">
                    <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4">Aplikimi</h4>
                    <p className="text-blue-900 font-serif italic text-lg leading-relaxed">
                      "Derivati është çelësi për optimizimin. Pa të, nuk do të mund të gjenim rrugën më të shkurtër apo fitimin më të lartë."
                    </p>
                    <button 
                      onClick={() => setActiveSection('car')}
                      className="mt-8 self-center px-6 py-2 bg-brand text-white rounded-xl text-xs font-bold uppercase tracking-widest"
                    >
                      Shih Simulimin (Makina)
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeSection === 'integral_deep' && (
              <motion.div 
                key="integral_deep"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-5xl mx-auto space-y-8"
              >
                 <SectionHeader 
                  index="02"
                  title="Thellim në Integrale" 
                  subtitle="SIPËRFAQJA DHE VËLLIMI"
                  colorClass="text-cyan-accent"
                />
                
                <div className="grid grid-cols-1 gap-12">
                  <div className="bg-cyan-50 p-8 rounded-3xl border border-cyan-100 flex flex-col justify-center text-center">
                    <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-4">Koncepti Gjeometrik</h4>
                    <p className="text-cyan-900 font-serif italic text-lg leading-relaxed">
                      "Integrali i caktuar përfaqëson 'shumën e pafundme' të elementeve të vogla drejtkëndore nën një kurbë."
                    </p>
                    <button 
                      onClick={() => setActiveSection('tank')}
                      className="mt-8 self-center px-6 py-2 bg-cyan-accent text-white rounded-xl text-xs font-bold uppercase tracking-widest"
                    >
                      Shih Simulimin (Rezervuari)
                    </button>
                  </div>
                  <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-border-main">
                      <h4 className="font-bold text-gray-900 mb-4">Njehsimi i Syprinës</h4>
                      <div className="text-sm text-gray-600 leading-relaxed">
                        Syprina e kufizuar nga vija <Formula tex="x=a" inline />, <Formula tex="x=b" inline /> dhe funksioni <Formula tex="f(x)" inline /> llogaritet përmes Newton-Leibniz:
                        <br/><br/>
                        <Formula tex="S = \int_{a}^{b} f(x) \, dx = F(b) - F(a)" />
                      </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-border-main">
                      <h4 className="font-bold text-gray-900 mb-4">Vëllimi i Trupit Rrotullues</h4>
                      <div className="text-sm text-gray-600 leading-relaxed">
                        Vëllimi i një trupi që krijohet nga rrotullimi i kurbës <Formula tex="f(x)" inline /> rreth boshtit <Formula tex="Ox" inline />, midis kufijve <Formula tex="x=a" inline /> dhe <Formula tex="x=b" inline />, njehsohet si:
                        <br/><br/>
                        <Formula tex="V = \pi \int_{a}^{b} [f(x)]^2 \, dx" />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeSection === 'car' && (
              <motion.div 
                key="car"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col h-full"
              >
                <div className="flex justify-between items-start mb-6">
                  <SectionHeader 
                    index="01"
                    title="Lëvizja e Makinës" 
                    subtitle="KINEMATIKA"
                    colorClass="text-brand"
                  />
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100"
                      >
                        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1 fill-current" />}
                      </button>
                      <button 
                         onClick={handleAIExplain}
                         className="px-4 py-1 text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full font-bold uppercase flex items-center gap-2 hover:bg-indigo-100 transition-colors"
                      >
                         <Sparkles className="w-3 h-3" /> Shpjego me AI
                      </button>
                      <button 
                        onClick={() => {
                          if (!showExplanation) {
                            setTime(0);
                            setIsPlaying(true);
                          }
                          setShowExplanation(!showExplanation);
                        }}
                        className="px-4 py-1 text-[10px] bg-blue-50 text-blue-700 border border-blue-100 rounded-full font-bold uppercase"
                      >
                        SHPJEGO MË THJESHTË
                      </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <h4 className="text-[10px] font-bold text-blue-600 uppercase mb-3 px-2">Çfarë mësojmë këtu?</h4>
                    <ul className="text-xs space-y-2 text-gray-600 list-disc pl-5">
                      <li>Derivati i parë i pozicionit <Formula tex="s(t)" inline /> na jep shpejtësinë <Formula tex="v(t)" inline />.</li>
                      <li>Nxitimi <Formula tex="a(t)" inline /> është derivati i dytë i pozicionit <Formula tex="s''(t)" inline /> dhe tregon shkallën e ndryshimit të shpejtësisë.</li>
                      <li>Pjerrësia e tangjentes në një pikë të <Formula tex="s(t)" inline /> është saktësisht shpejtësia korente.</li>
                      <li>Kur shpejtësia rritet në mënyrë lineare, nxitimi është konstant (përshpejtim i njëtrajtshëm).</li>
                    </ul>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <h4 className="text-[10px] font-bold text-green-600 uppercase mb-3 px-2">Interpretimi Real</h4>
                    <p className="text-xs text-gray-600 italic">
                      "Monitorimi i nxitimit (derivati i dytë) është kritik për sigurinë; ai na tregon sa shpejt rritet shpejtësia. Nëse nxitimi është i lartë, makina do të arrijë limitin prej {SPEED_LIMIT} km/h shumë shpejt, duke kërkuar vëmendje të shtuar."
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="space-y-2 relative">
                    {showExplanation && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[8px] font-bold px-2 py-0.5 rounded-full z-10 whitespace-nowrap"
                      >
                        Ndyshimi i Pozicionit
                      </motion.div>
                    )}
                    <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Pozicioni s(t) [m]</span>
                    <div className="relative group">
                      <Graph 
                        data={carDataS} 
                        highlightX={time} 
                        highlightY={currentS} 
                        tangent={tangentLine}
                        color="#3B82F6" 
                        strokeWidth={showExplanation ? 4 : 2}
                        pulse={showExplanation}
                      />
                      {showExplanation && (
                        <div className="absolute top-2 right-2 bg-amber-50 border border-amber-200 px-2 py-1 rounded shadow-sm">
                          <p className="text-[8px] font-bold text-amber-700 uppercase">Pjerrësia këtu:</p>
                          <p className="text-[10px] font-serif italic text-amber-900">{currentV.toFixed(1)} m/s</p>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-gray-400">
                      <span className="text-[#F59E0B]">pjerrësia = shpejtësia</span>
                      <span>{currentS.toFixed(2)} m</span>
                    </div>
                  </div>
                  <div className="space-y-2 relative">
                    {showExplanation && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute -top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white text-[8px] font-bold px-2 py-0.5 rounded-full z-10 whitespace-nowrap"
                      >
                        Derivati i Parë
                      </motion.div>
                    )}
                    <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Shpejtësia v(t) [m/s]</span>
                    <div className="relative">
                      <Graph 
                        data={carDataV} 
                        highlightX={time} 
                        highlightY={currentV} 
                        limitLine={SPEED_LIMIT}
                        isExceeding={isSpeeding}
                        tangent={tangentLineV}
                        color="#10B981" 
                        strokeWidth={showExplanation ? 4 : 2}
                        pulse={showExplanation}
                      />
                      {showExplanation && (
                        <div className="absolute top-2 right-2 bg-blue-50 border border-blue-200 px-2 py-1 rounded shadow-sm">
                          <p className="text-[8px] font-bold text-blue-700 uppercase">Lartësia këtu:</p>
                          <p className="text-[10px] font-serif italic text-blue-900">{currentV.toFixed(1)} m/s</p>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-gray-400">
                      <Formula tex="v(t) = \frac{ds}{dt}" inline />
                      <span className={isSpeeding ? "text-red-500 font-bold" : ""}>{currentV.toFixed(2)} m/s</span>
                    </div>
                  </div>
                  <div className="space-y-2 relative">
                    {showExplanation && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute -top-4 left-1/2 -translate-x-1/2 bg-orange-600 text-white text-[8px] font-bold px-2 py-0.5 rounded-full z-10 whitespace-nowrap"
                      >
                        Derivati i Dytë
                      </motion.div>
                    )}
                    <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Nxitimi a(t) [m/s²]</span>
                    <Graph 
                      data={carDataA} 
                      highlightX={time} 
                      highlightY={currentA} 
                      color="#EA580C" 
                      strokeWidth={showExplanation ? 4 : 2}
                      pulse={showExplanation}
                    />
                    {showExplanation && (
                      <div className="absolute top-2 right-2 bg-orange-50 border border-orange-200 px-2 py-1 rounded shadow-sm">
                        <p className="text-[8px] font-bold text-orange-700 uppercase">Derivati i v(t):</p>
                        <p className="text-[10px] font-serif italic text-orange-900">{currentA.toFixed(1)} m/s²</p>
                      </div>
                    )}
                    <div className="flex justify-between text-[10px] font-mono text-gray-400">
                      <Formula tex="a(t) = v'(t) = \frac{d^2s}{dt^2}" inline />
                      <span>{currentA.toFixed(2)} m/s²</span>
                    </div>
                  </div>
                </div>

                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 mb-8">
                      <div className="text-sm text-orange-800 font-medium flex items-center gap-2">
                        <Info className="w-5 h-5 flex-shrink-0" />
                        <span><strong>Rregulla e Artë:</strong> Nxitimi <Formula tex="a(t)" inline /> është derivati i shpejtësisë <Formula tex="v'(t)" inline />. Nëse shpejtësia ndryshon, nxitimi nuk është zero!</span>
                      </div>
                    </div>

                {isSpeeding && (
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute top-24 right-8 bg-red-50 border border-red-200 text-red-600 p-3 rounded text-xs font-bold animate-pulse z-20 shadow-sm"
                  >
                    ⚠️ PO TEJKALON SHPEJTËSINË!
                  </motion.div>
                )}

                <div className="mt-auto bg-white p-6 border border-gray-100 rounded-xl shadow-sm">
                  <div className="flex justify-between items-end mb-3">
                    <label className="text-[10px] font-mono text-gray-500 uppercase">Koha (t)</label>
                    <span className="text-sm font-mono font-bold text-brand">{time.toFixed(1)}s</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="10" 
                    step="0.1" 
                    value={time} 
                    onChange={(e) => setTime(parseFloat(e.target.value))}
                    className="w-full h-1 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-brand"
                  />
                  <AnimatePresence>
                    {showExplanation && (
                      <SimpleExplanation content={`**Zinxhiri i derivateve** na tregon historinë e plotë të lëvizjes. Pjerrësia e kurbës së parë të pozicionit $s(t)$ në çdo pikë është saktësisht lartësia e kurbës së dytë të shpejtësisë $v(t)$. 

Në kohën $t = ${time.toFixed(1)}\text{s}$, shpejtësia është ${currentV.toFixed(1)}\text{ m/s}$. Më tej, pjerrësia e kurbës së shpejtësisë na jep nxitimin $a(t)$, i cili në këtë moment është ${currentA.toFixed(1)}\text{ m/s}^2$. Kjo do të thotë që shpejtësia po rritet me një ritëm prej ${currentA.toFixed(1)}\text{ m/s}$ çdo sekondë. Ky është zbatimi i drejtpërdrejtë i konceptit të derivatit si **shkallë e ndryshimit të menjëhershëm**.`} />
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {activeSection === 'tank' && (
              <motion.div 
                key="tank"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col h-full bg-[#F9FAFB] -m-6 p-6"
              >
                <div className="flex justify-between items-start mb-6">
                  <SectionHeader 
                    index="02"
                    title="Rrjedhja e Ujit" 
                    subtitle="ANALIZA"
                    colorClass="text-cyan-accent"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setIsPlaying(!isPlaying)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-50">
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1 fill-current" />}
                    </button>
                    <button 
                       onClick={handleAIExplain}
                       className="px-4 py-1 text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full font-bold uppercase flex items-center gap-2 hover:bg-indigo-100 transition-colors"
                    >
                       <Sparkles className="w-3 h-3" /> Shpjego me AI
                    </button>
                    <button onClick={() => setShowExplanation(!showExplanation)} className="px-4 py-1 text-[10px] bg-cyan-50 text-cyan-700 border border-cyan-100 rounded-full font-bold uppercase">
                      SHPJEGO MË THJESHTË
                    </button>
                  </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 flex-grow">
                  <div className="lg:w-1/3 bg-white border border-border-main rounded-xl relative p-6 flex items-center justify-center shadow-sm">
                    <svg viewBox="0 0 100 150" className="w-full h-full max-h-[300px]">
                      <rect x="25" y="10" width="50" height="130" fill="none" stroke="#D1D5DB" strokeWidth="1" rx="4" />
                      <motion.rect 
                        animate={{ height: `${tankPercent * 1.3}px`, y: 140 - tankPercent * 1.3 }}
                        initial={{ height: 0, y: 140 }}
                        x="26" width="48" fill="#06B6D4" fillOpacity="0.3" rx="3" 
                      />
                      <motion.line 
                        animate={{ y1: 140 - tankPercent * 1.3, y2: 140 - tankPercent * 1.3 }}
                        x1="20" x2="80" stroke="#06B6D4" strokeWidth="2" 
                      />
                      <text x="50" y="85" fontSize="8" textAnchor="middle" fill="#0891B2" fontWeight="bold">{tankPercent}% PLOT</text>
                    </svg>
                  </div>

                    <div className="lg:w-2/3 space-y-6">
                      <div className="bg-brand/5 p-4 rounded-xl border border-brand/10">
                        <h4 className="text-[10px] font-bold text-brand uppercase mb-2">Kurrikula: Integrali i Caktuar</h4>
                        <div className="text-xs text-brand/80">
                          Sipërfaqja nën kurbën e rrjedhjes <Formula tex="f(t)" inline /> (e mbushur me ngjyrë të hapur) tregon sasinë totale të ujit që ka mbërritur në rezervuar. 
                          <strong> Integrali = Vëllimi Total.</strong>
                        </div>
                      </div>

                    <div className="bg-white p-4 border border-border-main rounded-xl shadow-sm">
                      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2 block">Rrjedhja f(t) [L/s]</span>
                      <Graph data={tankFlowData} highlightX={time} color="#06B6D4" height={120} showArea={true} />
                    </div>
                    <div className="bg-white p-4 border border-border-main rounded-xl shadow-sm pt-4">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-[10px] font-mono text-gray-400 uppercase">Vëllimi i Mbledhur V(t)</span>
                        <div className="text-xl font-mono font-bold text-cyan-accent">{currentVolume.toFixed(1)} L</div>
                      </div>
                      <Graph data={tankVolumeData} highlightX={time} color="#3B82F6" height={120} />
                    </div>
                  </div>
                </div>

                <div className="mt-8 bg-white p-6 border border-gray-100 rounded-xl shadow-sm">
                  <div className="flex justify-between items-end mb-3">
                    <label className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Kontrolli i Kohës</label>
                    <span className="text-sm font-mono font-bold text-cyan-accent">{time.toFixed(1)} min</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="10" 
                    step="0.1" 
                    value={time} 
                    onChange={(e) => setTime(parseFloat(e.target.value))}
                    className="w-full h-1 bg-cyan-100 rounded-lg appearance-none cursor-pointer accent-cyan-accent"
                  />
                  <AnimatePresence>
                    {showExplanation && (
                      <SimpleExplanation content={`Përmes **integralit të caktuar**, ne llogarisim akumulimin total të një sasie. Shiko sipërfaqen e hijezuar nën grafikun e rrjedhjes $f(t)$ - ajo përfaqëson sasinë e ujit që ka kaluar nëpër tubacion deri në kohën $t = ${time.toFixed(1)}$ min. 

Inxhinierët e përdorin këtë parim për të dizajnuar sisteme furnizimi dhe për të parashikuar konsumin. Matematikisht, vëllimi $V(t)$ është antiderivati i funksionit të rrjedhjes, i vlerësuar nga koha zero:
$$V(t) = \int_{0}^{t} f(\tau) \, d\tau = ${currentVolume.toFixed(1)} \text{ Litra}$$`} />
                    )}
                  </AnimatePresence>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 border border-border-main rounded-xl shadow-sm">
                    <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-cyan-600" />
                      Koncepti i Integralit të Caktuar
                    </h4>
                    <p className="text-xs text-gray-600 leading-relaxed mb-4">
                      Integrali i caktuar mat akumulimin total të një sasie gjatë një intervali kohor. Gjeometrikisht, kjo korrespondon me <strong>sipërfaqen nën grafikun</strong> e funksionit f(x) midis pikave a dhe b.
                    </p>
                    <div className="bg-cyan-900 p-4 rounded-lg text-center font-serif text-3xl text-cyan-100 border border-cyan-800 shadow-inner">
                      <Formula tex="\int_{a}^{b} f(x) \, dx" />
                    </div>
                  </div>

                  <div className="bg-cyan-900 p-6 border border-cyan-800 rounded-xl shadow-xl text-white flex flex-col justify-center relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                       <RotateCcw className="w-12 h-12" />
                    </div>
                    <h4 className="text-sm font-black mb-3 flex items-center gap-2 text-cyan-100">
                      <TrendingUp className="w-4 h-4" />
                      Integrali = Vëllimi Total
                    </h4>
                    <p className="text-xs text-cyan-100/80 leading-relaxed mb-4">
                      Sipërfaqja e hijezuar në grafikun e rrjedhjes saktësisht përfaqëson litrat që janë mbledhur. Çdo 'pjesë' e vogël e syprinës shton vëllim në rezervuar.
                    </p>
                    
                    <div className="bg-white/10 p-3 rounded-lg border border-white/20 mb-3">
                      <div className="flex justify-between items-center text-[10px] uppercase font-bold text-cyan-200 mb-2">
                        <span>Llogaritja e Akumulimit:</span>
                        <span>t = {time.toFixed(1)} min</span>
                      </div>
                      <div className="text-lg font-mono font-bold text-center py-2">
                         <Formula tex={`V(t) = \int_{0}^{${time.toFixed(1)}} f(\tau) \, d\tau = ${currentVolume.toFixed(2)} \, \text{L}`} />
                      </div>
                    </div>
 
                    <div className="flex items-center justify-between bg-white/10 p-3 rounded-lg border border-white/20">
                      <div className="text-[10px] font-bold opacity-60">FORMULA:</div>
                      <div className="font-serif italic text-sm">
                        <Formula tex="V(t) = \int f(t) \, dt" inline />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 border border-border-main rounded-xl shadow-sm">
                    <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-cyan-600" />
                      Aplikimi: Vëllimi i Ujit
                    </h4>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Në këtë simulim, ne integrojmë <strong>shpejtësinë e rrjedhjes</strong> (litra/minutë) për të gjetur <strong>vëllimin total</strong>.
                    </p>
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-[10px] items-center py-1 border-b border-gray-50">
                        <span className="text-gray-500">Shpejtësia (Flow):</span>
                        <span className="font-mono font-bold">f(t)</span>
                      </div>
                      <div className="flex justify-between text-[10px] items-center py-1 border-b border-gray-50">
                        <span className="text-gray-500">Vëllimi Total:</span>
                        <span className="font-mono font-bold text-cyan-600 uppercase"><Formula tex="V = \int f(t) \, dt" inline /></span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeSection === 'farm' && (
              <motion.div 
                key="farm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col h-full"
              >
                <div className="flex justify-between items-start mb-6">
                  <SectionHeader 
                    index="06"
                    title="Hapësira e Fermës" 
                    subtitle="OPTIMIZIMI"
                    colorClass="text-green-accent"
                  />
                  <div className="flex gap-2">
                    <button 
                       onClick={handleAIExplain}
                       className="px-4 py-1 text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full font-bold uppercase flex items-center gap-2 hover:bg-indigo-100 transition-colors"
                    >
                       <Sparkles className="w-3 h-3" /> Shpjego me AI
                    </button>
                    <button onClick={() => setShowExplanation(!showExplanation)} className="px-4 py-1 text-[10px] bg-green-50 text-green-700 border border-green-100 rounded-full font-bold uppercase">
                      SHPJEGO MË THJESHTË
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 flex-grow">
                  <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl flex flex-col items-center justify-center p-8 shadow-inner">
                    <div className="w-full aspect-square border-2 border-dashed border-gray-200 rounded-lg relative flex items-center justify-center">
                      <motion.div 
                        animate={{ 
                          width: `${xVal * 8}px`, 
                           height: `${(perimeter / 2 - xVal) * 8}px`,
                           backgroundColor: Math.abs(xVal - 10) < 0.2 ? "rgba(34, 197, 94, 0.2)" : "rgba(34, 197, 94, 0.1)"
                        }}
                        className="border-2 border-green-500 rounded flex items-center justify-center shadow-lg transition-all"
                      >
                         <span className="text-[10px] font-bold text-green-800 uppercase tracking-tighter">Sipërfaqja</span>
                      </motion.div>
                      {Math.abs(xVal - 10) < 0.2 && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="absolute -top-12 left-1/2 -translate-x-1/2 bg-green-600 text-white text-[9px] px-3 py-1 rounded-full font-bold shadow-xl whitespace-nowrap z-10"
                        >
                          Ky është dizajni më efikas për sipërfaqen maksimale.
                        </motion.div>
                      )}
                      <div className="absolute bottom-6 right-6 text-right">
                        <div className="text-[10px] text-gray-400 font-mono">PROFIT_EST</div>
                        <div className="text-3xl font-black text-green-accent">{currentProfit.toFixed(1)} €</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                      <h4 className="text-[10px] font-bold text-green-700 uppercase mb-2">Çfarë mësojmë këtu?</h4>
                      <ul className="text-xs text-green-800 space-y-2">
                        <li>1. Funksioni i sipërfaqes: <Formula tex="A(x) = x \cdot (20 - x)" inline /></li>
                        <li>2. Derivati: <Formula tex="A'(x) = 20 - 2x" inline /></li>
                        <li>3. Zgjidhim <Formula tex="A'(x) = 0 \implies x = 10 \text{m}" inline />. <strong>Maksimumi!</strong></li>
                        <li className="mt-2 pt-2 border-t border-green-200/50"><strong>Optimizimi:</strong> Derivatet përdoren për të gjetur vlerat maksimale dhe minimale në probleme reale. Në këtë rast, gjetja e sipërfaqes maksimale siguron profitin më të lartë për fermën.</li>
                      </ul>
                    </div>
                    <div className="bg-white p-4 border border-border-main rounded-xl shadow-sm">
                      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest block mb-4">Funksioni A(x)</span>
                      <Graph 
                        data={farmData} 
                        highlightX={xVal} 
                        highlightY={currentArea} 
                        color="#10B981" 
                        height={200}
                        peakPoint={{ x: 10, y: 100 }}
                        showArea={Math.abs(xVal - 10) < 0.5}
                      />
                    </div>
                    
                    <div className="bg-green-50 border border-green-100 p-5 rounded-xl">
                      <h4 className="text-xs font-bold text-green-900 mb-2 uppercase tracking-wide">Analiza e Sipërfaqes</h4>
                      <p className="text-xs text-green-800 leading-relaxed mb-3">
                        Kur x = {optimalX}m, pjerrësia e grafikut bëhet saktësisht 0. Ky është pika ku ferma juaj është më produktive.
                      </p>
                      <div className="bg-white/50 p-3 rounded-lg border border-green-200/50 flex gap-3 items-start">
                        <Info className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-green-700 leading-normal">
                          Derivati i funksionit të Sipërfaqes <strong>A'(x)</strong> tregon se si ndryshon sipërfaqja ndërsa gjerësia 'x' ndryshon. 
                          Sipërfaqja maksimale arrihet saktësisht aty ku kjo shkallë ndryshimi është <strong>zero</strong>.
                        </p>
                      </div>
                      <button 
                         onClick={() => {
                          setXVal(optimalX);
                        }}
                        className="mt-4 w-full bg-green-600 text-white text-[10px] px-4 py-2 rounded-lg font-bold uppercase tracking-widest hover:bg-green-700 transition shadow-sm mb-2"
                      >
                        Gjej vlerën optimale automatikisht
                      </button>
                      <button 
                         onClick={handleAIExplain}
                         className="w-full bg-indigo-600 text-white text-[10px] px-4 py-2 rounded-lg font-bold uppercase tracking-widest hover:bg-indigo-700 transition shadow-sm flex items-center justify-center gap-2"
                      >
                        <Bot className="w-3 h-3" /> Analizo me AI
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 border border-gray-100 rounded-xl shadow-sm">
                  <div className="flex justify-between items-end mb-3">
                    <span className="text-[10px] font-mono text-gray-400 font-bold uppercase">Gjerësia (X)</span>
                    <span className="text-sm font-mono font-bold text-green-accent">{xVal.toFixed(1)}m</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="19" 
                    step="0.1" 
                    value={xVal} 
                    onChange={(e) => setXVal(parseFloat(e.target.value))}
                    className="w-full h-1 bg-green-100 rounded-lg appearance-none cursor-pointer accent-green-accent"
                  />
                  <AnimatePresence>
                    {showExplanation && (
                      <SimpleExplanation content={`Ky është një problem klasik **Optimizimi**. Duke ndryshuar gjerësinë $x$, ne shohim se si ndryshon sipërfaqja $A(x) = x(20-x)$. 

Në pikat ku pjerrësia (derivati $A'(x)$) është pozitive, sipërfaqja rritet. Magjia ndodh saktësisht kur $A'(x) = 0$, që korrespondon me $x=10\text{m}$. Këtu arrijmë sipërfaqen maksimale prej $100\text{ m}^2$. Ky parim përdoret në ekonomi për të maksimizuar fitimet dhe inxhinieri për të gjetur pikat e ekuilibrit më efikas.`} />
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {activeSection === 'exponential' && (
              <motion.div 
                key="exponential"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-6xl mx-auto space-y-12"
              >
                <SectionHeader 
                  index="05"
                  title="Funksionet Eksponenciale & Logaritmike" 
                  subtitle="Rritja dhe Derivatet Speciale"
                  colorClass="text-purple-600"
                />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                   {/* Exponential Section */}
                  <div className="space-y-8">
                    <div className="bg-purple-900 p-8 rounded-3xl text-white relative overflow-hidden shadow-2xl">
                      <div className="absolute top-0 right-0 p-6 opacity-20"><TrendingUp size={120} /></div>
                      <h4 className="text-xl font-black mb-4 uppercase tracking-tighter">1. Rritja Eksponenciale</h4>
                        <div className="text-purple-100 text-sm leading-relaxed mb-6">
                          Në natyrë, shumë rritje janë proporcionale me sasinë ekzistuese (p.sh. popullsia, interesi bankar).
                          Formula: <Formula tex="P(t) = P_0 \cdot e^{rt}" inline />. Magjia: <strong>Derivati i saj është proporcional me vetë funksionin!</strong>
                        </div>

                      <div className="bg-purple-950/50 p-6 rounded-2xl border border-purple-400/20 mb-6">
                        <div className="text-xs font-bold text-purple-300 uppercase mb-2">Simulimi i Popullsisë</div>
                        <div className="flex justify-between text-2xl font-mono font-black text-purple-accent">
                           <div className="flex items-center gap-1">
                             <span className="text-xs opacity-50">t =</span>
                             <span className="text-xl">{time.toFixed(1)} s</span>
                           </div>
                           <div className="flex items-center gap-1">
                             <span className="text-xs opacity-50">P(t) =</span>
                             <span className="text-xl text-purple-300">{currentExp.toFixed(2)}</span>
                           </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] uppercase font-black text-purple-300 tracking-widest block">Shkalla e Rritjes (r): {growthRate.toFixed(2)}</label>
                        <input 
                          type="range" min="0.1" max="1" step="0.1" 
                          value={growthRate} 
                          onChange={(e) => setGrowthRate(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-purple-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
                        />
                      </div>
                    </div>

                    <div className="bg-white p-6 border border-border-main rounded-2xl shadow-sm">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
                          Grafiku <Formula tex={`f(t) = e^{${growthRate}t}`} inline />
                        </span>
                        <div className="flex items-center gap-2">
                           <button onClick={() => setIsPlaying(!isPlaying)} className="p-2 bg-purple-100 rounded-full text-purple-600 hover:bg-purple-200 transition">
                             {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                           </button>
                        </div>
                      </div>
                      <Graph 
                        data={expData} 
                        highlightX={time} 
                        highlightY={currentExp} 
                        tangent={tangentExp}
                        color="#A855F7" 
                        height={250}
                        pulse={showExplanation}
                      />
                    </div>
                  </div>

                  {/* Logarithmic Section */}
                  <div className="space-y-8">
                    <div className="bg-indigo-900 p-8 rounded-3xl text-white relative overflow-hidden shadow-2xl">
                      <h4 className="text-xl font-black mb-4 uppercase tracking-tighter">2. Funksioni Logaritmik</h4>
                      <div className="text-indigo-100 text-sm leading-relaxed mb-6">
                        Logaritmi është inversi i eksponencialit. Ai rritet shumë ngadalë ndërsa vlerat e x rriten.
                        Formula: <Formula tex="g(x) = \ln(x)" inline />. Derivati: <strong><Formula tex="g'(x) = \frac{1}{x}" inline /></strong>.
                      </div>

                      <div className="bg-indigo-950/50 p-6 rounded-2xl border border-indigo-400/20 mb-6">
                        <div className="text-xs font-bold text-indigo-300 uppercase mb-2">Vlera në momentin t</div>
                        <div className="flex justify-between text-2xl font-mono font-black text-indigo-accent">
                           <span>x = {(time + 0.1).toFixed(1)}</span>
                           <span className="text-indigo-300">\ln(x) = {currentLog.toFixed(2)}</span>
                        </div>
                      </div>
                      
                      <div className="bg-indigo-800/30 p-4 rounded-xl border border-indigo-400/10">
                        <p className="text-[10px] text-indigo-200 italic leading-relaxed">
                          Vini re se kur x rritet, pjerrësia (1/x) fillon të zvogëlohet. Kjo do të thotë se grafiku 
                          përkulet poshtë, duke u bërë më i 'sheshtë' me kalimin e kohës.
                        </p>
                      </div>
                    </div>

                    <div className="bg-white p-6 border border-border-main rounded-2xl shadow-sm">
                       <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest block mb-4">Grafiku g(x) = ln(x)</span>
                       <Graph 
                        data={logData} 
                        highlightX={time + 0.1} 
                        highlightY={currentLog} 
                        color="#6366F1" 
                        height={250}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 border border-purple-100 p-8 rounded-3xl flex flex-col md:flex-row gap-8 items-center">
                  <div className="flex-grow space-y-4">
                     <h5 className="font-bold text-purple-900 uppercase text-xs tracking-widest">Inxhinieria dhe Natyra</h5>
                     <p className="text-sm text-purple-800 leading-relaxed">
                        Përse janë kaq të rëndësishëm? Funksioni e është i vetmi funksion që është i barabartë me derivatin e tij (kur k=1). 
                        Kjo e bën atë gjuhën natyrore të çdo sistemi që ndryshon vazhdimisht. 
                        Nga algoritmet e kërkimit te përhapja e viruseve, gjithçka bazohet në këto parime.
                     </p>
                  </div>
                   <button 
                      onClick={handleAIExplain}
                      className="bg-purple-600 text-white px-8 py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-purple-700 transition shadow-lg flex items-center gap-3 whitespace-nowrap"
                    >
                      <Bot className="w-5 h-5" /> Shpjego rritjen
                    </button>
                </div>
              </motion.div>
            )}

            {activeSection === 'real_world' && (
              <motion.div 
                key="real_world"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-6xl mx-auto space-y-12"
              >
                <SectionHeader 
                  index="07"
                  title="Problema nga Jeta Reale" 
                  subtitle="ZBATIME PRAKTIKE"
                  colorClass="text-brand"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {/* Problem 1: Transporti */}
                  <div className="bg-white p-6 rounded-3xl border border-border-main shadow-sm flex flex-col h-full">
                    <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mb-6">
                      <Car className="w-6 h-6" />
                    </div>
                    <h4 className="text-lg font-black text-gray-900 mb-4 uppercase tracking-tighter">1. Kontrolli i Shpejtësisë</h4>
                    <div className="text-sm text-gray-600 leading-relaxed mb-6 flex-grow">
                      Një makinë lëviz sipas funksionit të pozicionit <Formula tex="s(t) = 0.1t^3 + 0.5t^2 + 5t" inline />. 
                      Policia ka vendosur një limit shpejtësie prej 50 njësi. 
                      Pas sa sekondash makina do ta tejkalojë këtë limit?
                    </div>
                    <div className="mt-auto space-y-4">
                      <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 italic text-[10px] text-blue-800">
                        Ndihmë: Gjeni derivatin e parë <Formula tex="v(t) = s'(t)" inline /> dhe zgjidhni ekuacionin <Formula tex="v(t) = 50" inline />.
                      </div>
                      <button 
                        onClick={() => setActiveSection('car')}
                        className="w-full py-3 bg-brand text-white rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg hover:bg-brand-dark transition-colors"
                      >
                        Përdor Simulatorin e Makinës
                      </button>
                    </div>
                  </div>

                  {/* Problem 2: Inxhinieria Hidrike */}
                  <div className="bg-white p-6 rounded-3xl border border-border-main shadow-sm flex flex-col h-full">
                    <div className="w-12 h-12 bg-cyan-100 rounded-2xl flex items-center justify-center text-cyan-600 mb-6">
                      <Droplets className="w-6 h-6" />
                    </div>
                    <h4 className="text-lg font-black text-gray-900 mb-4 uppercase tracking-tighter">2. Akumulimi i Rezervave</h4>
                    <div className="text-sm text-gray-600 leading-relaxed mb-6 flex-grow">
                      Shpejtësia e rrjedhjes së ujit në një rezervuar është <Formula tex="f(t) = 5 + 3\sin(t)" inline /> litra në minutë. 
                      Sa litra ujë do të jenë mbledhur në rezervuar pas 10 minutash, duke supozuar se në fillim ishte i zbrazët?
                    </div>
                    <div className="mt-auto space-y-4">
                      <div className="p-4 bg-cyan-50 rounded-xl border border-cyan-100 italic text-[10px] text-cyan-800">
                        Ndihmë: Llogaritni integralin e caktuar të <Formula tex="f(t)" inline /> nga 0 deri në 10.
                      </div>
                      <button 
                        onClick={() => setActiveSection('tank')}
                        className="w-full py-3 bg-cyan-600 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg hover:bg-cyan-700 transition-colors"
                      >
                        Përdor Simulatorin e Ujit
                      </button>
                    </div>
                  </div>

                  {/* Problem 3: Planifikimi Urban */}
                  <div className="bg-white p-6 rounded-3xl border border-border-main shadow-sm flex flex-col h-full">
                    <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center text-green-600 mb-6">
                      <Wrench className="w-6 h-6" />
                    </div>
                    <h4 className="text-lg font-black text-gray-900 mb-4 uppercase tracking-tighter">3. Rrethimi Maksimal</h4>
                    <div className="text-sm text-gray-600 leading-relaxed mb-6 flex-grow">
                      Një pronar ferre ka 40 metra material rrethues. Ai dëshiron të ndajë një zonë drejtkëndore për kafshët. 
                      Cilat duhet të jenë përmasat (gjerësia <Formula tex="x" inline />) që sipërfaqja e rrethuar të jetë maksimale?
                    </div>
                    <div className="mt-auto space-y-4">
                      <div className="p-4 bg-green-50 rounded-xl border border-green-100 italic text-[10px] text-green-800">
                        Ndihmë: Formoni funksionin <Formula tex="A(x) = x(20-x)" inline /> dhe gjeni ku derivati <Formula tex="A'(x)" inline /> është zero.
                      </div>
                      <button 
                        onClick={() => setActiveSection('farm')}
                        className="w-full py-3 bg-green-600 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg hover:bg-green-700 transition-colors"
                      >
                        Përdor Simulatorin e Fermës
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-900 p-12 rounded-3xl text-white relative overflow-hidden shadow-2xl">
                   <div className="absolute top-0 right-0 p-8 opacity-10"><GraduationCap size={160} /></div>
                   <div className="relative z-10 max-w-2xl">
                     <h4 className="text-2xl font-black mb-4 uppercase tracking-tighter">Sfidë për Shkencëtarët e Rinj</h4>
                     <p className="text-indigo-100 leading-relaxed mb-8">
                       Kalkulusi nuk është vetëm lëndë shkollore; ai është gjuha me të cilën inxhinierët ndërtojnë ura, 
                       ekonomistët parashikojnë tregjet dhe mjekët analizojnë përhapjen e viruseve. 
                       Zgjidhja e këtyre problemeve ju jep fuqinë për të modeluar të ardhmen.
                     </p>
                     <div className="flex gap-4">
                        <button 
                           onClick={handleAIExplain}
                           className="bg-white text-indigo-900 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-50 transition-colors flex items-center gap-2"
                        >
                          <Bot className="w-4 h-4" /> Kërko një problem të ri nga AI
                        </button>
                     </div>
                   </div>
                </div>
              </motion.div>
            )}

            {activeSection === 'outcomes' && (
              <motion.div 
                key="outcomes"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                 <SectionHeader 
                  index="07"
                  title="Rezultatet e të Nxënit" 
                  subtitle="KONKLUZIONET"
                  colorClass="text-gray-900"
                />

                <div className="bg-white p-8 rounded-3xl border border-border-main shadow-sm">
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-8">Në fund të këtij projekti, nxënësi:</h4>
                  <div className="grid grid-cols-1 gap-4">
                    {[
                      "Përkufizon derivatin e një funksioni.",
                      "Njehson derivatin e një funksioni nëpërmjet përkufizimit.",
                      "Përdor derivatin e funksionit për të përcaktuar ekstremumet.",
                      "Vlerëson dhe interpreton problema ku gjen zbatim derivati i parë i funksionit.",
                      "Njehson syprinën dhe vëllimin e trupave gjeometrike duke përdorur integralin e caktuar.",
                      "Zgjidh problemat e ndryshme me situata reale ku përdoret njehsimi i derivatit dhe integralit për gjetjen e vlerës më të madhe dhe vlerës më të vogël të funksioneve."
                    ].map((outcome, i) => (
                      <div key={i} className="flex items-start gap-4 p-4 hover:bg-gray-50 rounded-2xl transition-colors border border-transparent hover:border-gray-100">
                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                           <CheckCircle2 className="w-4 h-4 text-green-600" />
                        </div>
                        <p className="text-gray-700 font-medium">{outcome}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="p-8 bg-brand rounded-3xl text-white">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2">Përmbledhje</h4>
                      <p className="text-xl font-serif italic">
                        Matematika XII nuk është vetëm teori, është mjeti me të cilin ne modelojmë dhe përmirësojmë jetën tonë kudo.
                      </p>
                   </div>
                   <div className="p-8 bg-gray-50 rounded-3xl border border-border-main flex flex-col justify-center">
                      <span className="text-[10px] font-bold text-gray-400 uppercase mb-2">Viti Shkollor</span>
                      <p className="text-2xl font-black text-gray-900">2025 - 2026</p>
                      <p className="text-sm text-gray-500">Gjimnazi "Partizani", Tiranë</p>
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Description Panel removed */}
      </main>

      {/* Footer Status Bar */}
      <footer className={`h-10 bg-white border-t border-border-main flex items-center justify-between px-8 flex-shrink-0 ${isPresenting ? 'hidden' : ''}`}>

        {/* Floating Chat Button */}
        {!isChatOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={() => setIsChatOpen(true)}
            className="fixed bottom-6 right-6 w-14 h-14 bg-brand text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform z-50 group"
          >
            <MessageSquare className="w-6 h-6" />
            <span className="absolute -top-10 right-0 bg-gray-900 text-white text-[10px] font-bold px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Pyet AI Ndihmësin
            </span>
          </motion.button>
        )}

        {/* AI Chat Panel */}
        <AnimatePresence>
          {isChatOpen && (
            <motion.div
              initial={{ y: 100, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 100, opacity: 0, scale: 0.9 }}
              className="fixed bottom-6 right-6 w-80 sm:w-96 h-[500px] bg-white rounded-3xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden z-50"
            >
              <div className="p-4 bg-brand text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-tight">AI Ndihmës</h4>
                    <p className="text-[10px] opacity-70">Konteksti: {currentAIContext}</p>
                  </div>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="hover:bg-white/10 p-1 rounded-md transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div ref={scrollRef} className="flex-grow overflow-y-auto p-4 space-y-4 custom-scrollbar scroll-smooth">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-2xl text-xs leading-relaxed ${
                      msg.role === 'user' 
                      ? 'bg-brand text-white rounded-tr-none shadow-md' 
                      : 'bg-gray-100 text-gray-800 rounded-tl-none border border-gray-200'
                    }`}>
                      {msg.role === 'user' ? (
                        msg.text
                      ) : (
                        <div className="markdown-content prose prose-sm max-w-none">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm, remarkMath]} 
                            rehypePlugins={[rehypeKatex]}
                          >
                            {msg.text}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isAIAsking && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 p-3 rounded-2xl animate-pulse flex gap-1">
                      <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" />
                      <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleAskAI} className="p-4 border-t border-gray-100 flex gap-2 shrink-0 bg-gray-50/50">
                <input
                  type="text"
                  placeholder="Ask a question..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-grow bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-brand focus:border-transparent outline-none shadow-sm"
                />
                <button 
                  type="submit" 
                  disabled={isAIAsking}
                  className="w-10 h-10 bg-brand text-white rounded-xl flex items-center justify-center hover:bg-brand-dark transition-colors shadow-lg disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-8 text-[10px] font-bold text-gray-400 uppercase">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span> 
            Sistemet Online
          </span>
          <span className="hidden sm:inline">ALGORITMI: AKTIV</span>
          <span className="hidden sm:inline">MODELIMI: PRECIZ</span>
        </div>
        <div className="text-[10px] font-mono text-gray-400 tracking-tighter">
          UI_THEME: GEOMETRIC_BALANCE // PERSPECTIVE_V2
        </div>
      </footer>
    </div>
  );
}
