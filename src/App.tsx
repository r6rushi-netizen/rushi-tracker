import { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, RotateCcw, Activity, ListChecks, Settings2, X, Footprints, Flower2, Wind, Moon, Bell } from 'lucide-react';

// ============================================================
// 🔊 AUDIO ENGINE
// ============================================================
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
  } catch (e) {}
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
  } catch (e) {}
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
  } catch (e) {}
};

// ============================================================
// 📳 HAPTICS
// ============================================================
const vibrate = (pattern: number | number[]) => {
  try { if ('vibrate' in navigator) navigator.vibrate(pattern); } catch (e) {}
};

// ============================================================
// 🔒 WAKE LOCK HOOK
// ============================================================
function useWakeLock(isActive: boolean) {
  const wakeLockRef = useRef<any>(null);
  useEffect(() => {
    const acquire = async () => {
      try {
        if ('wakeLock' in navigator && !wakeLockRef.current) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch (e) {}
    };
    const release = () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
    if (isActive) acquire();
    else release();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isActive) acquire();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (!isActive) release();
    };
  }, [isActive]);
}

// ============================================================
// 🔔 NOTIFICATION SERVICE WORKER HOOK
// ============================================================
function useTimerNotifications() {
  const swRef = useRef<ServiceWorkerRegistration | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifStatus, setNotifStatus] = useState<'idle' | 'granted' | 'denied' | 'unsupported'>('idle');

  useEffect(() => {
    if (!('Notification' in window)) {
      setNotifStatus('unsupported');
      return;
    }
    if (Notification.permission === 'granted') {
      setNotifStatus('granted');
      registerSW();
    } else if (Notification.permission === 'denied') {
      setNotifStatus('denied');
    }
  }, []);

  const registerSW = async () => {
    if (!('serviceWorker' in navigator)) return false;
    try {
      const reg = await navigator.serviceWorker.register('/timer-sw.js');
      await navigator.serviceWorker.ready;
      swRef.current = reg;
      setNotifEnabled(true);
      return true;
    } catch (e) {
      return false;
    }
  };

  const requestPermission = async () => {
    if (!('Notification' in window)) return false;
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotifStatus('granted');
        const ok = await registerSW();
        if (ok) {
          // Test notification
          swRef.current?.active?.postMessage({
            type: 'SHOW_NOW',
            payload: {
              title: '🔔 Rushi Tracker',
              body: 'Phase change notifications enabled!'
            }
          });
        }
        return ok;
      } else {
        setNotifStatus('denied');
        return false;
      }
    } catch (e) {
      return false;
    }
  };

  const schedulePhaseNotifications = (
    currentTimeMs: number,
    walkDurationMs: number,
    runDurationMs: number,
    walkTimeConfig: { m: number; s: number },
    runTimeConfig: { m: number; s: number }
  ) => {
    const sw = swRef.current;
    if (!sw || !notifEnabled) return;

    const cycleDuration = walkDurationMs + runDurationMs;
    const events: { triggerAt: number; title: string; body: string }[] = [];

    let simTime = currentTimeMs;
    const now = Date.now();

    // Generate next 20 phase changes
    for (let i = 0; i < 20; i++) {
      const cycleTime = simTime % cycleDuration;
      const isWalk = cycleTime < walkDurationMs;
      const timeToNext = isWalk
        ? walkDurationMs - cycleTime
        : cycleDuration - cycleTime;

      const triggerAt = now + timeToNext;
      const nextIsWalk = !isWalk;

      events.push({
        triggerAt,
        title: nextIsWalk ? '🚶 Walking Phase' : '🏃 Running Phase!',
        body: nextIsWalk
          ? `Walk for ${walkTimeConfig.m}m ${walkTimeConfig.s > 0 ? walkTimeConfig.s + 's' : ''}`
          : `Run for ${runTimeConfig.m}m ${runTimeConfig.s > 0 ? runTimeConfig.s + 's' : ''}`,
      });

      simTime += timeToNext;
    }

    // Send to service worker
    const sendMessage = (reg: ServiceWorkerRegistration) => {
      const target = reg.active || reg.installing || reg.waiting;
      target?.postMessage({ type: 'SCHEDULE_NOTIFICATIONS', payload: { events } });
    };

    if (sw.active) {
      sendMessage(sw);
    } else {
      navigator.serviceWorker.ready.then(reg => sendMessage(reg));
    }
  };

  const cancelNotifications = () => {
    const sw = swRef.current;
    if (!sw) return;
    const target = sw.active || sw.installing || sw.waiting;
    target?.postMessage({ type: 'CANCEL_NOTIFICATIONS' });
  };

  return { notifEnabled, notifStatus, requestPermission, schedulePhaseNotifications, cancelNotifications };
}

// ============================================================
// 🔵 SVG PROGRESS RING
// ============================================================
function ProgressRing({
  progress, size, strokeWidth = 4, color = '#3B82F6', glowColor
}: {
  progress: number; size: number; strokeWidth?: number; color?: string; glowColor?: string;
}) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, progress)) / 100);
  return (
    <svg width={size} height={size} className="absolute top-0 left-0 pointer-events-none"
      style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{
          transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)',
          filter: glowColor ? `drop-shadow(0 0 6px ${glowColor})` : undefined
        }} />
    </svg>
  );
}

// ============================================================
// 🏃 CARDIO / RUN TRACKER — With Background Notifications
// ============================================================
function RunTracker() {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [walkTime, setWalkTime] = useState({ m: 5, s: 0 });
  const [runTime, setRunTime] = useState({ m: 3, s: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [speedSamples, setSpeedSamples] = useState<number[]>([]);
  const [history, setHistory] = useState<{
    id: number; round: number; phase: string; avgSpeed: string; duration: string;
  }[]>([]);

  const startTimeRef = useRef(0);
  const accumulatedTimeRef = useRef(0);
  const prevPhaseRef = useRef('Walking');

  useWakeLock(isRunning);
  const { notifEnabled, notifStatus, requestPermission, schedulePhaseNotifications, cancelNotifications } = useTimerNotifications();

  const walkDuration = (walkTime.m * 60 + walkTime.s) * 1000;
  const runDuration = (runTime.m * 60 + runTime.s) * 1000;
  const cycleDuration = walkDuration + runDuration;

  const currentCycleTime = time % cycleDuration;
  const isWalkPhase = currentCycleTime < walkDuration;
  const currentPhaseName = isWalkPhase ? 'Walking' : 'Running';
  const phaseTimeRemaining = isWalkPhase ? walkDuration - currentCycleTime : cycleDuration - currentCycleTime;
  const phaseTotal = isWalkPhase ? walkDuration : runDuration;
  const phaseProgress = ((phaseTotal - phaseTimeRemaining) / phaseTotal) * 100;
  const currentRoundDisplay = Math.floor(time / cycleDuration) + 1;

  // ✅ Background-safe timer
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    if (isRunning) {
      startTimeRef.current = Date.now();
      intervalId = setInterval(() => {
        setTime(accumulatedTimeRef.current + (Date.now() - startTimeRef.current));
      }, 100);
    }
    return () => clearInterval(intervalId);
  }, [isRunning]);

  // ✅ Page Visibility — reschedule notifications on resume
  useEffect(() => {
    const handle = () => {
      if (!document.hidden && isRunning) {
        const currentTime = accumulatedTimeRef.current + (Date.now() - startTimeRef.current);
        schedulePhaseNotifications(currentTime, walkDuration, runDuration, walkTime, runTime);
      }
    };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [isRunning, walkDuration, runDuration, walkTime, runTime]);

  // Phase change detection
  useEffect(() => {
    if (time === 0) return;
    if (prevPhaseRef.current !== currentPhaseName) {
      playTone();
      vibrate([50, 30, 50]);
      const roundNum = Math.floor((time - 1000) / cycleDuration) + 1;
      const avg = speedSamples.length > 0
        ? (speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length).toFixed(1) : '0.0';
      const dur = prevPhaseRef.current === 'Walking'
        ? `${walkTime.m}m ${walkTime.s}s` : `${runTime.m}m ${runTime.s}s`;
      setHistory(prev => [{ id: Date.now(), round: roundNum, phase: prevPhaseRef.current, avgSpeed: avg, duration: dur }, ...prev]);
      setSpeedSamples([]);
      prevPhaseRef.current = currentPhaseName;
    }
  }, [currentPhaseName, time]);

  // GPS tracking
  useEffect(() => {
    let watchId: number;
    if (isRunning && 'geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        pos => {
          const spd = pos.coords.speed ? pos.coords.speed * 3.6 : 0;
          setSpeed(spd);
          if (spd > 0.5) setSpeedSamples(prev => [...prev, spd]);
        },
        e => console.error('GPS:', e),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );
    } else { setSpeed(0); }
    return () => { if (watchId) navigator.geolocation.clearWatch(watchId); };
  }, [isRunning]);

  const formatTime = (ms: number) => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const cs = Math.floor((ms % 1000) / 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
  };

  const handleStartPause = () => {
    if (!isRunning) {
      playTone();
      vibrate([50, 30, 80]);
      // Schedule background notifications
      schedulePhaseNotifications(time, walkDuration, runDuration, walkTime, runTime);
    } else {
      accumulatedTimeRef.current = time;
      vibrate([30]);
      cancelNotifications();
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
    prevPhaseRef.current = 'Walking';
    vibrate([30]);
    cancelNotifications();
  };

  const handleTimeChange = (type: 'walk' | 'run', field: 'm' | 's', value: string) => {
    let num = parseInt(value) || 0;
    if (field === 's' && num > 59) num = 59;
    if (type === 'walk') setWalkTime(prev => ({ ...prev, [field]: num }));
    else setRunTime(prev => ({ ...prev, [field]: num }));
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md pb-32 px-4 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 w-full mt-4">
        <h1 className="text-white/60 font-bold tracking-[0.2em] text-xs uppercase">Rushi Tracker</h1>
        <span className="bg-white/8 border border-white/12 text-white/70 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-widest">
          ROUND {currentRoundDisplay}
        </span>
      </div>

      {/* 🔔 Notification Permission Banner */}
      {notifStatus !== 'granted' && notifStatus !== 'unsupported' && (
        <button onClick={requestPermission}
          className="w-full mb-4 bg-orange-500/15 border border-orange-500/30 rounded-2xl p-3 flex items-center gap-3 active:scale-95 transition-all">
          <Bell size={16} className="text-orange-400 shrink-0" />
          <div className="text-left">
            <p className="text-orange-300 text-xs font-bold">Enable Background Notifications</p>
            <p className="text-orange-300/50 text-[10px]">Phase change alerts when app is minimized</p>
          </div>
          <span className="ml-auto text-orange-400 text-[10px] font-bold">TAP</span>
        </button>
      )}

      {/* Notification Enabled Badge */}
      {notifEnabled && (
        <div className="w-full mb-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-2.5 flex items-center gap-2">
          <Bell size={14} className="text-emerald-400" />
          <p className="text-emerald-400 text-[10px] font-bold">Background notifications active ✓</p>
        </div>
      )}

      {/* Speed Card */}
      <div className="bg-white/4 backdrop-blur-xl w-full rounded-2xl p-4 mb-4 border border-white/8 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/12 rounded-xl border border-blue-500/20">
            <Activity className="text-blue-400" size={20} />
          </div>
          <div>
            <p className="text-[9px] text-white/35 uppercase tracking-widest font-bold">Live Speed</p>
            <p className="text-2xl font-black text-white">
              {speed.toFixed(1)} <span className="text-xs font-normal text-white/25">km/h</span>
            </p>
          </div>
        </div>
        {!isRunning && time === 0 && (
          <button onClick={() => setShowSettings(!showSettings)}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/8 rounded-xl text-white/40 transition-all active:scale-95">
            {showSettings ? <X size={18} /> : <Settings2 size={18} />}
          </button>
        )}
      </div>

      {/* Settings */}
      {showSettings && !isRunning && time === 0 && (
        <div className="bg-white/6 backdrop-blur-2xl w-full rounded-2xl p-5 mb-4 border border-white/12 animate-in slide-in-from-top-2 duration-200">
          <p className="text-[9px] text-white/35 uppercase tracking-widest font-bold mb-4">Interval Settings</p>
          {[
            { label: '🚶 Walk', color: 'text-blue-400', t: walkTime, type: 'walk' as const },
            { label: '🏃 Run', color: 'text-orange-400', t: runTime, type: 'run' as const },
          ].map(({ label, color, t, type }) => (
            <div key={type} className="flex justify-between items-center mb-3 last:mb-0">
              <span className={`font-bold text-sm ${color}`}>{label}</span>
              <div className="flex gap-2 items-center">
                {(['m', 's'] as const).map(field => (
                  <div key={field} className="flex items-center gap-1">
                    <input type="number" value={t[field]}
                      onChange={e => handleTimeChange(type, field, e.target.value)}
                      className="w-12 bg-black/30 border border-white/10 text-white p-2 rounded-lg text-center font-mono text-sm outline-none"
                      min="0" max={field === 's' ? '59' : undefined} />
                    <span className="text-white/25 text-[10px]">{field}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Phase Card */}
      <div className={`w-full rounded-2xl p-5 mb-6 border backdrop-blur-xl transition-all duration-700 ${
        isWalkPhase
          ? 'bg-blue-950/25 border-blue-500/20'
          : 'bg-orange-950/25 border-orange-500/20'
      }`}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-[9px] text-white/35 uppercase tracking-widest font-bold mb-1.5">Target Phase</p>
            <p className={`text-xl font-black ${isWalkPhase ? 'text-blue-400' : 'text-orange-400'}`}>
              {currentPhaseName}
            </p>
          </div>
          <p className="text-3xl font-mono font-light text-white tracking-tight">
            {formatTime(phaseTimeRemaining)}
          </p>
        </div>
        <div className="w-full h-0.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${isWalkPhase ? 'bg-blue-500' : 'bg-orange-500'}`}
            style={{ width: `${phaseProgress}%` }} />
        </div>
      </div>

      {/* Main Timer */}
      <div className="text-center mb-8">
        <p className="text-[3.2rem] font-mono font-extralight tracking-tighter text-white">
          {formatTime(time)}
        </p>
        <p className="text-white/25 text-[9px] mt-1 font-bold tracking-[0.3em] uppercase">Total Elapsed</p>
      </div>

      {/* Controls */}
      <div className="flex gap-4 mb-6 w-full">
        <button onClick={handleReset}
          className="flex-1 py-4 rounded-2xl bg-white/4 border border-white/8 hover:bg-white/8 transition-all flex justify-center items-center active:scale-95">
          <RotateCcw size={22} className="text-white/40" />
        </button>
        <button onClick={handleStartPause}
          className={`flex-[2.5] py-4 rounded-2xl transition-all flex justify-center items-center border border-white/12 shadow-lg active:scale-95 ${
            isRunning ? 'bg-red-500/70 hover:bg-red-500/90' : 'bg-emerald-500/70 hover:bg-emerald-500/90'
          }`}>
          {isRunning
            ? <Pause size={28} className="text-white fill-current" />
            : <Play size={28} className="text-white fill-current ml-1" />}
        </button>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="w-full bg-white/4 backdrop-blur-xl border border-white/8 rounded-2xl p-4">
          <button onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 w-full text-white/40 text-[9px] uppercase tracking-widest font-bold">
            <ListChecks size={13} />
            Workout Log ({history.length})
            <span className="ml-auto">{showHistory ? '▲' : '▼'}</span>
          </button>
          {showHistory && (
            <div className="max-h-48 overflow-y-auto mt-3 space-y-2">
              {history.map(r => (
                <div key={r.id} className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-white/5">
                  <div>
                    <p className="text-[9px] text-white/25 uppercase tracking-widest">Round {r.round}</p>
                    <p className={`text-sm font-bold ${r.phase === 'Walking' ? 'text-blue-400' : 'text-orange-400'}`}>
                      {r.phase} <span className="text-white/20 text-xs">({r.duration})</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-white/25 uppercase">Avg</p>
                    <p className="text-base font-mono text-white">{r.avgSpeed} <span className="text-xs text-white/25">km/h</span></p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 🧘 YOGA — Fully Timestamp-Based
// ============================================================
function computeYogaState(elapsedMs: number, phases: number[], targetCycles: number) {
  const active = phases.map((d, i) => ({ d, i })).filter(p => p.d > 0);
  if (active.length === 0) return { phaseIndex: 0, timeLeft: 0, cycleCount: 0, progress: 0, completed: false };
  const cycleDuration = active.reduce((s, p) => s + p.d, 0);
  const elapsedSec = elapsedMs / 1000;
  const cycleCount = Math.floor(elapsedSec / cycleDuration);
  if (targetCycles > 0 && cycleCount >= targetCycles) {
    return { phaseIndex: 0, timeLeft: 0, cycleCount, progress: 100, completed: true };
  }
  const timeInCycle = elapsedSec % cycleDuration;
  let accumulated = 0;
  for (const phase of active) {
    if (timeInCycle < accumulated + phase.d) {
      const timeLeft = Math.ceil(phase.d - (timeInCycle - accumulated));
      const progress = ((timeInCycle - accumulated) / phase.d) * 100;
      return { phaseIndex: phase.i, timeLeft, cycleCount, progress, completed: false };
    }
    accumulated += phase.d;
  }
  return { phaseIndex: active[active.length - 1].i, timeLeft: 0, cycleCount, progress: 100, completed: false };
}

function YogaTracker() {
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [targetCycles, setTargetCycles] = useState(11);
  const [phases, setPhases] = useState([4, 8, 8, 2]);
  const [elapsedMs, setElapsedMs] = useState(0);

  const startTimeRef = useRef(0);
  const accumulatedRef = useRef(0);
  const prevPhaseRef = useRef(-1);
  const prevCycleRef = useRef(0);

  const phaseNames = ['पूरक (Inhale)', 'कुंभक (Hold)', 'रेचक (Exhale)', 'बाह्य (Hold Out)'];
  const phaseColors = [
    { text: 'text-cyan-400', border: 'border-cyan-400/35', hex: '#22D3EE', bg: 'bg-cyan-950/20' },
    { text: 'text-indigo-400', border: 'border-indigo-400/35', hex: '#818CF8', bg: 'bg-indigo-950/20' },
    { text: 'text-emerald-400', border: 'border-emerald-400/35', hex: '#34D399', bg: 'bg-emerald-950/20' },
    { text: 'text-amber-400', border: 'border-amber-400/35', hex: '#FCD34D', bg: 'bg-amber-950/20' },
  ];

  useWakeLock(isRunning);

  const yogaState = useMemo(
    () => computeYogaState(elapsedMs, phases, targetCycles),
    [elapsedMs, phases, targetCycles]
  );

  const active = phases.map((d, i) => ({ d, i })).filter(p => p.d > 0);
  const currentActiveIdx = active.findIndex(p => p.i === yogaState.phaseIndex);
  const nextPhaseIndex = active.length > 0 ? active[(currentActiveIdx + 1) % active.length].i : 0;

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRunning) {
      startTimeRef.current = Date.now();
      interval = setInterval(() => {
        setElapsedMs(accumulatedRef.current + (Date.now() - startTimeRef.current));
      }, 200);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning || elapsedMs === 0) return;
    if (yogaState.phaseIndex !== prevPhaseRef.current) {
      if (prevPhaseRef.current !== -1) { playTone(); vibrate([50, 30, 50]); }
      prevPhaseRef.current = yogaState.phaseIndex;
    }
    if (yogaState.cycleCount > prevCycleRef.current) prevCycleRef.current = yogaState.cycleCount;
    if (yogaState.completed) {
      playEndTone(); vibrate([100, 50, 100, 50, 200]);
      accumulatedRef.current = elapsedMs; setIsRunning(false);
    }
  }, [yogaState, isRunning, elapsedMs]);

  const handleStartPause = () => {
    if (!isRunning) {
      if (yogaState.completed) {
        accumulatedRef.current = 0; setElapsedMs(0);
        prevPhaseRef.current = -1; prevCycleRef.current = 0;
      }
      playTone(); vibrate([50, 30, 80]);
    } else { accumulatedRef.current = elapsedMs; vibrate([30]); }
    setShowSettings(false); setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false); setElapsedMs(0); accumulatedRef.current = 0;
    prevPhaseRef.current = -1; prevCycleRef.current = 0; vibrate([30]);
  };

  const activeStyle = phaseColors[yogaState.phaseIndex] ?? phaseColors[0];
  const ringSize = 280;

  return (
    <div className="flex flex-col items-center w-full max-w-md pb-32 px-4 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-6 w-full mt-4">
        <div className="flex items-center gap-2">
          <Wind className="text-white/40" size={16} />
          <h1 className="text-white/60 font-bold tracking-[0.2em] text-xs uppercase">Pranayama</h1>
        </div>
        <span className="bg-white/6 border border-white/12 text-white/60 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-widest">
          {yogaState.cycleCount} / {targetCycles > 0 ? targetCycles : '∞'}
        </span>
      </div>

      <div className="w-full flex justify-end mb-4">
        {!isRunning && (
          <button onClick={() => setShowSettings(!showSettings)}
            className="p-2.5 bg-white/4 hover:bg-white/8 border border-white/8 rounded-xl text-white/40 transition-all active:scale-95">
            {showSettings ? <X size={18} /> : <Settings2 size={18} />}
          </button>
        )}
      </div>

      {showSettings && !isRunning && (
        <div className="bg-white/6 backdrop-blur-2xl w-full rounded-2xl p-5 mb-6 border border-white/12 animate-in slide-in-from-top-2 duration-200">
          <div className="flex justify-between items-center mb-5 pb-4 border-b border-white/8">
            <span className="text-white/60 font-bold text-sm">🎯 Target Cycles</span>
            <input type="number" value={targetCycles}
              onChange={e => setTargetCycles(parseInt(e.target.value) || 0)}
              className="w-16 bg-black/30 border border-white/10 text-white p-2 rounded-lg text-center font-mono outline-none" min="0" />
          </div>
          <p className="text-[9px] text-white/35 uppercase tracking-widest font-bold mb-4">Breath Timings</p>
          {phaseNames.map((name, idx) => (
            <div key={idx} className="flex justify-between items-center mb-3 last:mb-0">
              <span className={`text-sm font-bold ${phaseColors[idx].text}`}>{name}</span>
              <div className="flex items-center gap-2">
                <input type="number" value={phases[idx]}
                  onChange={e => {
                    const newPhases = [...phases];
                    newPhases[idx] = parseInt(e.target.value) || 0;
                    setPhases(newPhases);
                  }}
                  className="w-12 bg-black/30 border border-white/10 text-white p-2 rounded-lg text-center font-mono outline-none" min="0" />
                <span className="text-white/25 text-[10px]">sec</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="relative flex items-center justify-center mb-8 mt-2">
        <div className={`absolute rounded-full blur-3xl opacity-15 transition-all duration-1000 ${activeStyle.bg}`}
          style={{ width: ringSize, height: ringSize }} />
        <div className="relative" style={{ width: ringSize, height: ringSize }}>
          <ProgressRing progress={yogaState.progress} size={ringSize} strokeWidth={4}
            color={activeStyle.hex} glowColor={activeStyle.hex} />
          <div className={`w-full h-full rounded-full border-2 flex flex-col items-center justify-center backdrop-blur-md bg-black/40 transition-all duration-700 ${activeStyle.border}`}
            style={{ boxShadow: `0 0 50px ${activeStyle.hex}15` }}>
            <p className={`text-[9px] font-bold tracking-[0.2em] uppercase mb-4 text-center px-6 ${activeStyle.text}`}>
              {phaseNames[yogaState.phaseIndex]}
            </p>
            <p className="text-7xl font-mono font-extralight text-white">{yogaState.timeLeft}</p>
          </div>
        </div>
      </div>

      <div className="bg-white/4 backdrop-blur-xl border border-white/8 px-5 py-2.5 rounded-full mb-8">
        <span className="text-white/25 text-[9px] tracking-widest uppercase font-bold mr-2">Next:</span>
        <span className={`text-sm font-medium ${phaseColors[nextPhaseIndex].text}`}>{phaseNames[nextPhaseIndex]}</span>
      </div>

      <div className="flex gap-4 w-full">
        <button onClick={handleReset}
          className="flex-1 py-4 rounded-2xl bg-white/4 border border-white/8 hover:bg-white/8 transition-all flex justify-center items-center active:scale-95">
          <RotateCcw size={22} className="text-white/40" />
        </button>
        <button onClick={handleStartPause}
          className={`flex-[2.5] py-4 rounded-2xl transition-all flex justify-center items-center border border-white/12 shadow-lg active:scale-95 ${
            isRunning ? 'bg-red-500/70 hover:bg-red-500/90' : 'bg-emerald-500/70 hover:bg-emerald-500/90'
          }`}>
          {isRunning ? <Pause size={28} className="text-white fill-current" /> : <Play size={28} className="text-white fill-current ml-1" />}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// 🌙 MEDITATION TRACKER
// ============================================================
function MeditationTracker() {
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [meditationTime, setMeditationTime] = useState({ h: 0, m: 30 });
  const [elapsedMs, setElapsedMs] = useState(0);

  const startTimeRef = useRef(0);
  const accumulatedRef = useRef(0);
  const totalMs = (meditationTime.h * 3600 + meditationTime.m * 60) * 1000;

  useWakeLock(isRunning);

  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const progress = totalMs > 0 ? Math.min(100, (elapsedMs / totalMs) * 100) : 0;
  const completed = remainingMs === 0 && elapsedMs > 0 && totalMs > 0;

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRunning) {
      startTimeRef.current = Date.now();
      interval = setInterval(() => {
        const newElapsed = accumulatedRef.current + (Date.now() - startTimeRef.current);
        if (newElapsed >= totalMs) {
          setElapsedMs(totalMs); setIsRunning(false);
          playMeditationBell(); vibrate([200, 100, 200, 100, 500]);
        } else { setElapsedMs(newElapsed); }
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isRunning, totalMs]);

  const handleStartPause = () => {
    if (completed) { setElapsedMs(0); accumulatedRef.current = 0; }
    if (!isRunning) vibrate([50, 30, 80]);
    else { accumulatedRef.current = elapsedMs; vibrate([30]); }
    setShowSettings(false); setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false); setElapsedMs(0); accumulatedRef.current = 0; vibrate([30]);
  };

  const handleTimeChange = (field: 'h' | 'm', value: string) => {
    let num = parseInt(value) || 0;
    if (field === 'm' && num > 59) num = 59;
    if (!isRunning) { setElapsedMs(0); accumulatedRef.current = 0; }
    setMeditationTime(prev => ({ ...prev, [field]: num }));
  };

  const formatRemaining = (ms: number) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    if (h > 0) return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  const ringSize = 300;

  return (
    <div className="flex flex-col items-center w-full max-w-md pb-32 px-4 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-6 w-full mt-4">
        <div className="flex items-center gap-2">
          <Moon className="text-white/40" size={16} />
          <h1 className="text-white/60 font-bold tracking-[0.2em] text-xs uppercase">Meditation</h1>
        </div>
        {isRunning && (
          <span className="text-indigo-400/60 text-[10px] font-bold tracking-widest animate-pulse">
            {Math.floor(elapsedMs / 60000)}m elapsed
          </span>
        )}
      </div>

      <div className="w-full flex justify-end mb-4">
        {!isRunning && (
          <button onClick={() => setShowSettings(!showSettings)}
            className="p-2.5 bg-white/4 hover:bg-white/8 border border-white/8 rounded-xl text-white/40 transition-all active:scale-95">
            {showSettings ? <X size={18} /> : <Settings2 size={18} />}
          </button>
        )}
      </div>

      {showSettings && !isRunning && (
        <div className="bg-white/6 backdrop-blur-2xl w-full rounded-2xl p-5 mb-6 border border-white/12 animate-in slide-in-from-top-2 duration-200">
          <p className="text-[9px] text-white/35 uppercase tracking-widest font-bold mb-4">Duration</p>
          <div className="flex justify-center items-center gap-5">
            {(['h', 'm'] as const).map(field => (
              <div key={field} className="flex flex-col items-center gap-2">
                <p className="text-[9px] text-white/30 uppercase tracking-widest">{field === 'h' ? 'Hours' : 'Minutes'}</p>
                <input type="number" value={meditationTime[field]}
                  onChange={e => handleTimeChange(field, e.target.value)}
                  className="w-20 bg-black/30 border border-white/10 text-white p-3 rounded-xl text-center font-mono text-xl outline-none"
                  min="0" max={field === 'm' ? '59' : undefined} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative flex items-center justify-center mb-8 mt-2">
        <div className="absolute rounded-full blur-3xl opacity-10 bg-indigo-600"
          style={{ width: ringSize, height: ringSize }} />
        <div className="relative" style={{ width: ringSize, height: ringSize }}>
          <ProgressRing progress={progress} size={ringSize} strokeWidth={4} color="#6366F1" glowColor="#6366F1" />
          <div className="w-full h-full rounded-full border border-indigo-500/20 flex flex-col items-center justify-center backdrop-blur-md bg-black/40 shadow-[0_0_60px_rgba(99,102,241,0.1)]">
            {completed ? (
              <>
                <p className="text-3xl mb-3">🙏</p>
                <p className="text-indigo-300 text-sm font-bold tracking-[0.2em] uppercase">Complete</p>
              </>
            ) : (
              <>
                <p className="text-[9px] font-bold tracking-[0.3em] mb-5 uppercase text-indigo-300/70">Deep Focus</p>
                <p className={`font-mono font-extralight text-white ${meditationTime.h > 0 ? 'text-5xl' : 'text-6xl'}`}>
                  {formatRemaining(remainingMs)}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-4 w-full mt-4">
        <button onClick={handleReset}
          className="flex-1 py-4 rounded-2xl bg-white/4 border border-white/8 hover:bg-white/8 transition-all flex justify-center items-center active:scale-95">
          <RotateCcw size={22} className="text-white/40" />
        </button>
        <button onClick={handleStartPause}
          className={`flex-[2.5] py-4 rounded-2xl transition-all flex justify-center items-center border border-white/12 shadow-lg active:scale-95 ${
            isRunning ? 'bg-indigo-500/70 hover:bg-indigo-500/90' : 'bg-white/8 hover:bg-white/12'
          }`}>
          {isRunning ? <Pause size={28} className="text-white fill-current" /> : <Play size={28} className="text-white fill-current ml-1" />}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// 🚀 MAIN APP
// ============================================================
export default function App() {
  const [activeTab, setActiveTab] = useState<'run' | 'yoga' | 'meditation'>('run');
  const tabs = [
    { id: 'run' as const, icon: Footprints, label: 'Cardio', color: 'text-blue-400' },
    { id: 'yoga' as const, icon: Flower2, label: 'Yoga', color: 'text-emerald-400' },
    { id: 'meditation' as const, icon: Moon, label: 'Zen', color: 'text-indigo-400' },
  ];

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col items-center pt-2 relative overflow-hidden font-sans">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute -top-32 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full blur-3xl opacity-5 transition-all duration-1000 ${
          activeTab === 'run' ? 'bg-blue-600' : activeTab === 'yoga' ? 'bg-emerald-600' : 'bg-indigo-600'
        }`} />
      </div>

      {activeTab === 'run' && <RunTracker />}
      {activeTab === 'yoga' && <YogaTracker />}
      {activeTab === 'meditation' && <MeditationTracker />}

      <div className="fixed bottom-5 w-[85%] max-w-xs bg-white/5 backdrop-blur-2xl border border-white/8 flex justify-between p-1.5 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.6)] z-50">
        {tabs.map(({ id, icon: Icon, label, color }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex flex-col items-center justify-center flex-1 py-2.5 rounded-xl transition-all duration-300 active:scale-95 ${
              activeTab === id ? 'bg-white/10' : 'hover:bg-white/5'
            }`}>
            <Icon size={20} className={`mb-1 transition-colors ${activeTab === id ? color : 'text-white/25'}`} />
            <span className={`text-[9px] font-bold tracking-widest uppercase transition-colors ${
              activeTab === id ? color : 'text-white/25'
            }`}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
