import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Activity, ListChecks, Settings2, X, Footprints, Flower2, Wind, Moon } from 'lucide-react';

// --- १. ऑडिओ टोन फंक्शन्स ---
const playTone = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'sine'; 
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); 
    
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 1.5);
  } catch (e) {
    console.error("Audio not supported");
  }
};

const playEndTone = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'sine'; 
    osc.frequency.setValueAtTime(440, ctx.currentTime); 
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.5); 
    
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 3);
  } catch (e) {
    console.error("Audio not supported");
  }
};

const playMeditationBell = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContext();

    const ringBell = (startTime: number) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(432, startTime);
      
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.4, startTime + 1); 
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 7); 
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + 8);
    };

    ringBell(ctx.currentTime);
    ringBell(ctx.currentTime + 6);

  } catch (e) {
    console.error("Audio not supported");
  }
};

// --- २. कार्डिओ / रनिंग ट्रॅकर ---
function RunTracker() {
  const [time, setTime] = useState(0); // टोटल मिलिसेकंद
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState<number>(0);
  
  const [walkTime, setWalkTime] = useState({ m: 5, s: 0 });
  const [runTime, setRunTime] = useState({ m: 3, s: 0 });
  const [showSettings, setShowSettings] = useState(false);

  const [speedSamples, setSpeedSamples] = useState<number[]>([]);
  const [history, setHistory] = useState<{ id: number, round: number, phase: string, avgSpeed: string, duration: string }[]>([]);

  // रेकॉर्ड आणि टाइम ट्रॅकिंगसाठी Refs
  const startTimeRef = useRef<number>(0);
  const accumulatedTimeRef = useRef<number>(0);

  const walkDuration = (walkTime.m * 60 + walkTime.s) * 1000; 
  const runDuration = (runTime.m * 60 + runTime.s) * 1000;  
  const cycleDuration = walkDuration + runDuration; 

  const currentCycleTime = time % cycleDuration;
  const isWalkPhase = currentCycleTime < walkDuration;
  
  const currentPhaseName = isWalkPhase ? "Walking" : "Running";
  const phaseTimeRemaining = isWalkPhase ? walkDuration - currentCycleTime : cycleDuration - currentCycleTime;

  const prevPhaseRef = useRef(currentPhaseName);

  // अतिशय अचूक टायमर लॉजिक (Date.now() वापरून)
  useEffect(() => {
    let animationFrameId: number;
    
    const updateTime = () => {
      if (isRunning) {
        const now = Date.now();
        const newTime = accumulatedTimeRef.current + (now - startTimeRef.current);
        setTime(newTime);
        animationFrameId = requestAnimationFrame(updateTime);
      }
    };

    if (isRunning) {
      startTimeRef.current = Date.now();
      animationFrameId = requestAnimationFrame(updateTime);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isRunning]);

  // टप्पा बदलल्याचा ट्रॅकर आणि रेकॉर्ड
  useEffect(() => {
    if (time === 0) return; 
    
    if (prevPhaseRef.current !== currentPhaseName) {
       playTone(); 
       
       const roundNum = Math.floor((time - 1000) / cycleDuration) + 1; 
       const avg = speedSamples.length > 0 ? (speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length).toFixed(1) : "0.0";
       const phaseDurationStr = prevPhaseRef.current === "Walking" ? `${walkTime.m}m ${walkTime.s}s` : `${runTime.m}m ${runTime.s}s`;
       const newRecord = { id: Date.now(), round: roundNum, phase: prevPhaseRef.current, avgSpeed: avg, duration: phaseDurationStr };
       
       setHistory(prev => [newRecord, ...prev]);
       setSpeedSamples([]); 
       prevPhaseRef.current = currentPhaseName; 
    }
  }, [currentPhaseName, time, speedSamples, cycleDuration, walkTime, runTime]);

  useEffect(() => {
    let watchId: number;
    if (isRunning && 'geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const speedInKmh = position.coords.speed ? position.coords.speed * 3.6 : 0;
          setSpeed(speedInKmh);
          if (speedInKmh > 0.5) setSpeedSamples(prev => [...prev, speedInKmh]);
        },
        (error) => console.error("GPS Error: ", error),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );
    } else {
      setSpeed(0);
    }
    return () => { if (watchId) navigator.geolocation.clearWatch(watchId); };
  }, [isRunning]);

  const formatTimeWithMs = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const centiseconds = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  };

  const handleStartPause = () => { 
    if (!isRunning) playTone(); 
    if (isRunning) {
       accumulatedTimeRef.current = time; // थांबवल्यावर वेळ सेव्ह करा
    }
    setShowSettings(false); 
    setIsRunning(!isRunning); 
  };
  
  const handleReset = () => { 
    setIsRunning(false); 
    setTime(0); 
    accumulatedTimeRef.current = 0;
    setSpeed(0); 
    setSpeedSamples([]); 
    setHistory([]); 
    prevPhaseRef.current = "Walking"; 
  };
  
  const handleTimeChange = (type: 'walk' | 'run', field: 'm' | 's', value: string) => {
    let num = parseInt(value) || 0;
    if (field === 's' && num > 59) num = 59; 
    if (type === 'walk') setWalkTime(prev => ({ ...prev, [field]: num }));
    else setRunTime(prev => ({ ...prev, [field]: num }));
  };

  const currentRoundDisplay = Math.floor(time / cycleDuration) + 1;

  return (
    <div className="flex flex-col items-center w-full max-w-md pb-28 px-4 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8 w-full mt-4">
         <h1 className="text-white/80 font-bold tracking-[0.2em] text-sm uppercase drop-shadow-md">Rushi Tracker</h1>
         <span className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-4 py-1.5 rounded-full text-xs font-bold tracking-widest shadow-lg">
           ROUND {currentRoundDisplay}
         </span>
      </div>

      <div className="bg-white/5 backdrop-blur-xl w-full rounded-3xl p-5 mb-6 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/20 rounded-2xl border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
            <Activity className="text-blue-400" size={24} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">Live Speed</span>
            <span className="text-2xl font-black text-white tracking-tight">{speed.toFixed(1)} <span className="text-sm font-normal text-white/40">km/h</span></span>
          </div>
        </div>
        {!isRunning && time === 0 && (
          <button onClick={() => setShowSettings(!showSettings)} className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white transition-all">
            {showSettings ? <X size={20} /> : <Settings2 size={20} />}
          </button>
        )}
      </div>

      {showSettings && !isRunning && time === 0 && (
        <div className="bg-white/10 backdrop-blur-2xl w-full rounded-3xl p-6 mb-6 border border-white/20 shadow-2xl animate-in slide-in-from-top-4">
          <h3 className="text-xs text-white/60 font-bold uppercase tracking-widest mb-5 border-b border-white/10 pb-3">Interval Settings</h3>
          <div className="flex justify-between items-center mb-5">
            <span className="text-blue-400 font-bold tracking-wide flex items-center gap-2">🚶‍♂️ Walk</span>
            <div className="flex gap-2 items-center">
              <input type="number" value={walkTime.m} onChange={(e) => handleTimeChange('walk', 'm', e.target.value)} className="w-14 bg-black/30 border border-white/10 text-white p-2 rounded-xl text-center font-mono outline-none focus:border-blue-500 transition-colors" min="0" />
              <span className="text-white/40 text-xs font-bold">m</span>
              <input type="number" value={walkTime.s} onChange={(e) => handleTimeChange('walk', 's', e.target.value)} className="w-14 bg-black/30 border border-white/10 text-white p-2 rounded-xl text-center font-mono outline-none focus:border-blue-500 transition-colors" min="0" max="59" />
              <span className="text-white/40 text-xs font-bold">s</span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-orange-400 font-bold tracking-wide flex items-center gap-2">🏃‍♂️ Run</span>
            <div className="flex gap-2 items-center">
              <input type="number" value={runTime.m} onChange={(e) => handleTimeChange('run', 'm', e.target.value)} className="w-14 bg-black/30 border border-white/10 text-white p-2 rounded-xl text-center font-mono outline-none focus:border-orange-500 transition-colors" min="0" />
              <span className="text-white/40 text-xs font-bold">m</span>
              <input type="number" value={runTime.s} onChange={(e) => handleTimeChange('run', 's', e.target.value)} className="w-14 bg-black/30 border border-white/10 text-white p-2 rounded-xl text-center font-mono outline-none focus:border-orange-500 transition-colors" min="0" max="59" />
              <span className="text-white/40 text-xs font-bold">s</span>
            </div>
          </div>
        </div>
      )}

      <div className={`w-full rounded-3xl p-6 mb-8 flex items-center justify-between border backdrop-blur-xl shadow-2xl transition-all duration-700 ${isWalkPhase ? 'bg-blue-900/20 border-blue-500/40 shadow-[0_0_30px_rgba(59,130,246,0.15)]' : 'bg-orange-900/20 border-orange-500/40 shadow-[0_0_30px_rgba(249,115,22,0.15)]'}`}>
        <div className="flex flex-col gap-2">
          <span className="font-bold tracking-[0.2em] text-[10px] text-white/50 uppercase">Target</span>
          <span className={`text-2xl font-black flex items-center gap-2 ${isWalkPhase ? 'text-blue-400' : 'text-orange-400'}`}>
            {currentPhaseName}
          </span>
        </div>
        <div className="text-4xl font-mono font-light text-white tracking-tighter">
          {formatTimeWithMs(phaseTimeRemaining)}
        </div>
      </div>
      
      <div className="text-center mb-10 relative">
        <div className="absolute inset-0 bg-white/5 blur-3xl rounded-full"></div>
        <span className="relative text-[3.5rem] font-mono font-extralight tracking-tighter text-white drop-shadow-2xl">
          {formatTimeWithMs(time)}
        </span>
        <div className="text-white/40 text-[10px] mt-2 font-bold tracking-[0.3em] uppercase">Total Elapsed</div>
      </div>

      <div className="flex justify-center gap-6 mb-10 w-full px-4">
        <button onClick={handleReset} className="flex-1 py-5 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex justify-center items-center backdrop-blur-md shadow-lg">
          <RotateCcw size={26} className="text-white/70" />
        </button>
        <button onClick={handleStartPause} className={`flex-[2] py-5 rounded-3xl transition-all flex justify-center items-center shadow-[0_10px_30px_rgba(0,0,0,0.3)] border border-white/20 backdrop-blur-md ${isRunning ? 'bg-red-500/80 hover:bg-red-500' : 'bg-emerald-500/80 hover:bg-emerald-500'}`}>
          {isRunning ? <Pause size={32} className="text-white fill-current" /> : <Play size={32} className="text-white fill-current ml-2" />}
        </button>
      </div>

      {history.length > 0 && (
        <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 mb-6">
          <h2 className="text-white/60 text-xs mb-5 font-bold uppercase tracking-widest flex items-center gap-2"><ListChecks size={16} /> Workout Log</h2>
          <div className="max-h-56 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {history.map((record) => (
              <div key={record.id} className="flex justify-between items-center bg-black/20 p-4 rounded-2xl border border-white/5">
                <div className="flex flex-col">
                   <span className="text-[10px] text-white/40 font-bold tracking-widest uppercase mb-1">Round {record.round}</span>
                   <span className={`text-sm font-bold tracking-wide ${record.phase === 'Walking' ? 'text-blue-400' : 'text-orange-400'}`}>{record.phase} <span className="text-white/30 text-xs ml-1">({record.duration})</span></span>
                </div>
                <div className="text-right">
                   <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Avg</span>
                   <div className="text-lg font-mono font-medium text-white">{record.avgSpeed} <span className="text-xs font-sans text-white/30">km/h</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- ३. योगा / प्राणायाम ट्रॅकर कंपोनंट ---
function YogaTracker() {
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [targetCycles, setTargetCycles] = useState(11); 
  const [cycleCount, setCycleCount] = useState(0);

  const [phases, setPhases] = useState([4, 8, 8, 2]); 
  const phaseNames = ["पूरक (Inhale)", "कुंभक (Hold)", "रेचक (Exhale)", "बाह्य कुंभक (Hold Out)"];
  
  const phaseStyles = [
    { text: "text-cyan-400", border: "border-cyan-400/50", glow: "shadow-[0_0_60px_rgba(34,211,238,0.3)]", bg: "bg-cyan-950/30" }, 
    { text: "text-indigo-400", border: "border-indigo-400/50", glow: "shadow-[0_0_60px_rgba(129,140,248,0.3)]", bg: "bg-indigo-950/30" }, 
    { text: "text-emerald-400", border: "border-emerald-400/50", glow: "shadow-[0_0_60px_rgba(52,211,153,0.3)]", bg: "bg-emerald-950/30" }, 
    { text: "text-amber-400", border: "border-amber-400/50", glow: "shadow-[0_0_60px_rgba(251,191,36,0.3)]", bg: "bg-amber-950/30" } 
  ];
  
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(phases[0]);

  const phaseRef = useRef(currentPhaseIndex);
  const phasesRef = useRef(phases);
  const cycleCountRef = useRef(cycleCount);
  const targetCyclesRef = useRef(targetCycles);

  useEffect(() => { phaseRef.current = currentPhaseIndex; }, [currentPhaseIndex]);
  useEffect(() => { phasesRef.current = phases; }, [phases]);
  useEffect(() => { cycleCountRef.current = cycleCount; }, [cycleCount]);
  useEffect(() => { targetCyclesRef.current = targetCycles; }, [targetCycles]);

  const getNextPhaseIndex = (currentIndex: number, currentPhases: number[]) => {
    let next = (currentIndex + 1) % 4;
    let attempts = 0;
    while (currentPhases[next] <= 0 && attempts < 4) {
      next = (next + 1) % 4;
      attempts++;
    }
    return next;
  };

  useEffect(() => {
    let timer: number;
    if (isRunning) {
      timer = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            const nextIndex = getNextPhaseIndex(phaseRef.current, phasesRef.current);
            
            if (nextIndex <= phaseRef.current) {
               const nextCycleCount = cycleCountRef.current + 1;
               setCycleCount(nextCycleCount);
               
               if (targetCyclesRef.current > 0 && nextCycleCount >= targetCyclesRef.current) {
                  playEndTone(); 
                  setIsRunning(false); 
                  window.clearInterval(timer);
                  setCurrentPhaseIndex(0);
                  return phasesRef.current[0];
               }
            }
            playTone(); 
            setCurrentPhaseIndex(nextIndex);
            return phasesRef.current[nextIndex]; 
          }
          return prev - 1; 
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRunning]);

  const handleStartPause = () => {
    if (!isRunning) {
      if (targetCycles > 0 && cycleCount >= targetCycles) setCycleCount(0); 
      playTone(); 
    }
    setShowSettings(false); 
    setIsRunning(!isRunning);
  };
  
  const handleReset = () => { setIsRunning(false); setCurrentPhaseIndex(0); setTimeLeft(phases[0]); setCycleCount(0); };

  const handlePhaseChange = (index: number, value: string) => {
    let num = parseInt(value) || 0;
    const newPhases = [...phases];
    newPhases[index] = num;
    setPhases(newPhases);
    if (!isRunning && currentPhaseIndex === index) setTimeLeft(num);
  };

  const activeStyle = phaseStyles[currentPhaseIndex];

  return (
    <div className="flex flex-col items-center w-full max-w-md pb-28 px-4 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-6 w-full mt-4">
         <div className="flex items-center gap-2">
           <Wind className="text-white/70" size={20}/>
           <h1 className="text-white/80 font-bold tracking-[0.2em] text-sm uppercase">Pranayama</h1>
         </div>
         <span className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-4 py-1.5 rounded-full text-xs font-bold tracking-widest shadow-lg">
           CYCLE {cycleCount} / {targetCycles > 0 ? targetCycles : '∞'}
         </span>
      </div>

      <div className="w-full flex justify-end mb-8">
        {!isRunning && (
          <button onClick={() => setShowSettings(!showSettings)} className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white transition-all shadow-lg backdrop-blur-md">
            {showSettings ? <X size={20} /> : <Settings2 size={20} />}
          </button>
        )}
      </div>

      {showSettings && !isRunning && (
        <div className="bg-white/10 backdrop-blur-2xl w-full rounded-3xl p-6 mb-10 border border-white/20 shadow-2xl animate-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-6 pb-6 border-b border-white/10">
            <span className="font-bold tracking-wide text-white/80 flex items-center gap-2">🎯 Target Cycles</span>
            <div className="flex items-center gap-2 bg-black/20 p-1 rounded-xl border border-white/5">
              <input type="number" value={targetCycles} onChange={(e) => setTargetCycles(parseInt(e.target.value) || 0)} className="w-16 bg-transparent text-white p-2 rounded text-center font-mono outline-none" min="0" />
            </div>
          </div>
          <h3 className="text-xs text-white/60 font-bold uppercase tracking-widest mb-5 border-b border-white/10 pb-3">Breath Timings</h3>
          {phaseNames.map((name, idx) => (
            <div key={idx} className="flex justify-between items-center mb-4 last:mb-0">
              <span className={`font-bold tracking-wide ${phaseStyles[idx].text}`}>{name}</span>
              <div className="flex items-center gap-2 bg-black/20 p-1 rounded-xl border border-white/5">
                <input type="number" value={phases[idx]} onChange={(e) => handlePhaseChange(idx, e.target.value)} className="w-12 bg-transparent text-white p-1 rounded text-center font-mono outline-none" min="0" />
                <span className="text-white/30 text-[10px] font-bold uppercase pr-2">sec</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="relative flex items-center justify-center mb-16 mt-4">
         <div className={`absolute inset-0 rounded-full blur-2xl opacity-40 transition-all duration-1000 ${activeStyle.bg}`}></div>
         <div className={`absolute w-[280px] h-[280px] rounded-full border border-white/10 transition-all duration-1000`}></div>
         <div className={`relative z-10 w-64 h-64 rounded-full border-2 flex flex-col items-center justify-center transition-all duration-1000 backdrop-blur-md bg-black/40 ${activeStyle.border} ${activeStyle.glow}`}>
            <span className={`text-xs font-bold tracking-[0.2em] mb-4 uppercase text-center px-4 ${activeStyle.text} drop-shadow-md`}>
              {phaseNames[currentPhaseIndex]}
            </span>
            <span className="text-7xl font-mono font-extralight text-white drop-shadow-2xl">
              {timeLeft}
            </span>
         </div>
      </div>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 px-6 py-3 rounded-full mb-12 shadow-lg">
        <span className="text-white/40 text-[10px] tracking-[0.2em] uppercase font-bold mr-2">Next:</span>
        <span className="text-white/80 text-sm font-medium tracking-wider">{phaseNames[getNextPhaseIndex(currentPhaseIndex, phases)]}</span>
      </div>

      <div className="flex justify-center gap-6 w-full px-4">
        <button onClick={handleReset} className="flex-1 py-5 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex justify-center items-center backdrop-blur-md shadow-lg">
          <RotateCcw size={26} className="text-white/70" />
        </button>
        <button onClick={handleStartPause} className={`flex-[2] py-5 rounded-3xl transition-all flex justify-center items-center shadow-[0_10px_30px_rgba(0,0,0,0.3)] border border-white/20 backdrop-blur-md ${isRunning ? 'bg-red-500/80 hover:bg-red-500' : 'bg-emerald-500/80 hover:bg-emerald-500'}`}>
          {isRunning ? <Pause size={32} className="text-white fill-current" /> : <Play size={32} className="text-white fill-current ml-2" />}
        </button>
      </div>
    </div>
  );
}

// --- ४. मेडिटेशन ट्रॅकर कंपोनंट ---
function MeditationTracker() {
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const [meditationTime, setMeditationTime] = useState({ h: 0, m: 30 });
  const [timeLeft, setTimeLeft] = useState(meditationTime.h * 3600 + meditationTime.m * 60);

  useEffect(() => {
    let timer: number;
    if (isRunning) {
      if (timeLeft > 0) {
        timer = window.setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      } else {
        playMeditationBell();
        setIsRunning(false);
        setTimeLeft(meditationTime.h * 3600 + meditationTime.m * 60);
      }
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft, meditationTime]);

  const handleStartPause = () => { setShowSettings(false); setIsRunning(!isRunning); };
  const handleReset = () => { setIsRunning(false); setTimeLeft(meditationTime.h * 3600 + meditationTime.m * 60); };

  const handleTimeChange = (field: 'h' | 'm', value: string) => {
    let num = parseInt(value) || 0;
    if (field === 'm' && num > 59) num = 59;
    
    const newTime = { ...meditationTime, [field]: num };
    setMeditationTime(newTime);
    
    if (!isRunning) {
      setTimeLeft(newTime.h * 3600 + newTime.m * 60);
    }
  };

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;
  
  const displayTime = `${hours > 0 ? hours.toString().padStart(2, '0') + ':' : ''}${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="flex flex-col items-center w-full max-w-md pb-28 px-4 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-6 w-full mt-4">
         <div className="flex items-center gap-2">
           <Moon className="text-white/70" size={20}/>
           <h1 className="text-white/80 font-bold tracking-[0.2em] text-sm uppercase">Meditation</h1>
         </div>
      </div>

      <div className="w-full flex justify-end mb-8">
        {!isRunning && (
          <button onClick={() => setShowSettings(!showSettings)} className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white transition-all shadow-lg backdrop-blur-md">
            {showSettings ? <X size={20} /> : <Settings2 size={20} />}
          </button>
        )}
      </div>

      {showSettings && !isRunning && (
        <div className="bg-white/10 backdrop-blur-2xl w-full rounded-3xl p-6 mb-10 border border-white/20 shadow-2xl animate-in slide-in-from-top-4">
          <h3 className="text-xs text-white/60 font-bold uppercase tracking-widest mb-5 border-b border-white/10 pb-3">Set Duration</h3>
          <div className="flex justify-center items-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Hours</span>
              <input type="number" value={meditationTime.h} onChange={(e) => handleTimeChange('h', e.target.value)} className="w-20 bg-black/30 border border-white/10 text-white p-3 rounded-xl text-center font-mono text-xl outline-none focus:border-purple-500 transition-colors" min="0" />
            </div>
            <span className="text-white/20 text-3xl font-light mt-4">:</span>
            <div className="flex flex-col items-center gap-2">
              <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Minutes</span>
              <input type="number" value={meditationTime.m} onChange={(e) => handleTimeChange('m', e.target.value)} className="w-20 bg-black/30 border border-white/10 text-white p-3 rounded-xl text-center font-mono text-xl outline-none focus:border-purple-500 transition-colors" min="0" max="59" />
            </div>
          </div>
        </div>
      )}

      <div className="relative flex items-center justify-center mb-16 mt-4">
         <div className={`absolute inset-0 rounded-full blur-3xl opacity-30 transition-all duration-1000 bg-indigo-600 ${isRunning ? 'animate-pulse' : ''}`}></div>
         <div className={`absolute w-[300px] h-[300px] rounded-full border border-white/5 transition-all duration-1000`}></div>
         <div className={`relative z-10 w-72 h-72 rounded-full border border-indigo-500/30 flex flex-col items-center justify-center transition-all duration-1000 backdrop-blur-md bg-black/40 shadow-[0_0_80px_rgba(79,70,229,0.2)]`}>
            <span className="text-[10px] font-bold tracking-[0.3em] mb-6 uppercase text-indigo-300 drop-shadow-md">
              Deep Focus
            </span>
            <span className={`font-mono font-extralight text-white drop-shadow-2xl ${hours > 0 ? 'text-6xl' : 'text-7xl'}`}>
              {displayTime}
            </span>
         </div>
      </div>

      <div className="flex justify-center gap-6 w-full px-4 mt-8">
        <button onClick={handleReset} className="flex-1 py-5 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex justify-center items-center backdrop-blur-md shadow-lg">
          <RotateCcw size={26} className="text-white/70" />
        </button>
        <button onClick={handleStartPause} className={`flex-[2] py-5 rounded-3xl transition-all flex justify-center items-center shadow-[0_10px_30px_rgba(0,0,0,0.3)] border border-white/20 backdrop-blur-md ${isRunning ? 'bg-indigo-500/80 hover:bg-indigo-500' : 'bg-white/10 hover:bg-white/20'}`}>
          {isRunning ? <Pause size={32} className="text-white fill-current" /> : <Play size={32} className="text-white fill-current ml-2" />}
        </button>
      </div>
    </div>
  );
}

// --- ५. मुख्य ॲप ---
export default function App() {
  const [activeTab, setActiveTab] = useState<'run' | 'yoga' | 'meditation'>('run');

  return (
    <div className="min-h-screen bg-[#0a0a0a] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-[#0a0a0a] to-black flex flex-col items-center pt-2 relative overflow-hidden font-sans">
      
      {activeTab === 'run' && <RunTracker />}
      {activeTab === 'yoga' && <YogaTracker />}
      {activeTab === 'meditation' && <MeditationTracker />}

      <div className="fixed bottom-6 w-[90%] max-w-sm bg-white/5 backdrop-blur-2xl border border-white/10 flex justify-between p-2 rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.5)] z-50">
        <button onClick={() => setActiveTab('run')} className={`flex flex-col items-center justify-center w-1/3 py-3 rounded-2xl transition-all duration-300 ${activeTab === 'run' ? 'bg-white/10 shadow-inner' : 'hover:bg-white/5'}`}>
          <Footprints size={22} className={`mb-1.5 ${activeTab === 'run' ? 'text-blue-400' : 'text-white/40'}`} />
          <span className={`text-[10px] font-bold tracking-widest uppercase ${activeTab === 'run' ? 'text-blue-400' : 'text-white/40'}`}>Cardio</span>
        </button>
        <button onClick={() => setActiveTab('yoga')} className={`flex flex-col items-center justify-center w-1/3 py-3 rounded-2xl transition-all duration-300 ${activeTab === 'yoga' ? 'bg-white/10 shadow-inner' : 'hover:bg-white/5'}`}>
          <Flower2 size={22} className={`mb-1.5 ${activeTab === 'yoga' ? 'text-emerald-400' : 'text-white/40'}`} />
          <span className={`text-[10px] font-bold tracking-widest uppercase ${activeTab === 'yoga' ? 'text-emerald-400' : 'text-white/40'}`}>Yoga</span>
        </button>
        <button onClick={() => setActiveTab('meditation')} className={`flex flex-col items-center justify-center w-1/3 py-3 rounded-2xl transition-all duration-300 ${activeTab === 'meditation' ? 'bg-white/10 shadow-inner' : 'hover:bg-white/5'}`}>
          <Moon size={22} className={`mb-1.5 ${activeTab === 'meditation' ? 'text-indigo-400' : 'text-white/40'}`} />
          <span className={`text-[10px] font-bold tracking-widest uppercase ${activeTab === 'meditation' ? 'text-indigo-400' : 'text-white/40'}`}>Zen</span>
        </button>
      </div>
    </div>
  );
}