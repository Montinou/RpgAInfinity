'use client';

/**
 * GameTimer Component for RpgAInfinity Deduction Game
 *
 * Tension-building timer system featuring:
 * - Phase-specific countdown with visual progression
 * - Color-coded urgency indicators (green -> yellow -> red)
 * - Smooth animations and pulsing effects
 * - Audio notifications and haptic feedback
 * - Pause/resume functionality for game management
 * - Visual warnings at critical time thresholds
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { DeductionPhase } from '../../../types/deduction';

// ============================================================================
// COMPONENT TYPES & INTERFACES
// ============================================================================

export interface GameTimerProps {
  readonly phase: DeductionPhase;
  readonly timeRemaining: number; // seconds
  readonly totalTime: number; // seconds
  readonly isPaused?: boolean;
  readonly showMilliseconds?: boolean;
  readonly onTimeUp?: () => void;
  readonly onWarning?: (timeLeft: number) => void;
  readonly className?: string;
}

interface TimerState {
  displayTime: number;
  urgencyLevel: 'safe' | 'warning' | 'danger' | 'critical';
  isAnimating: boolean;
  warningsTriggered: Set<number>;
  lastTick: number;
}

interface PhaseTimerConfig {
  name: string;
  color: string;
  bgColor: string;
  icon: string;
  warningThresholds: number[]; // seconds that trigger warnings
  description: string;
}

// ============================================================================
// PHASE TIMER CONFIGURATION
// ============================================================================

const PHASE_TIMER_CONFIG: Record<DeductionPhase, PhaseTimerConfig> = {
  role_assignment: {
    name: 'Role Assignment',
    color: 'purple',
    bgColor: 'bg-purple-50',
    icon: '🎭',
    warningThresholds: [30, 10],
    description: 'Time to review your role',
  },
  day_discussion: {
    name: 'Discussion Time',
    color: 'blue',
    bgColor: 'bg-blue-50',
    icon: '💬',
    warningThresholds: [120, 60, 30],
    description: 'Share information and discuss',
  },
  day_voting: {
    name: 'Voting Phase',
    color: 'orange',
    bgColor: 'bg-orange-50',
    icon: '🗳️',
    warningThresholds: [60, 30, 10],
    description: 'Cast your votes',
  },
  night_actions: {
    name: 'Night Actions',
    color: 'indigo',
    bgColor: 'bg-indigo-50',
    icon: '🌙',
    warningThresholds: [90, 30, 10],
    description: 'Use your night abilities',
  },
  game_over: {
    name: 'Game Complete',
    color: 'green',
    bgColor: 'bg-green-50',
    icon: '🏆',
    warningThresholds: [],
    description: 'Game has ended',
  },
};

const URGENCY_CONFIG = {
  safe: {
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    borderColor: 'border-green-300',
    threshold: 0.5, // > 50% time remaining
  },
  warning: {
    color: 'yellow',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
    borderColor: 'border-yellow-300',
    threshold: 0.25, // 25-50% time remaining
  },
  danger: {
    color: 'red',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
    borderColor: 'border-red-300',
    threshold: 0.1, // 10-25% time remaining
  },
  critical: {
    color: 'red',
    bgColor: 'bg-red-200',
    textColor: 'text-red-900',
    borderColor: 'border-red-400',
    threshold: 0, // < 10% time remaining
  },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function GameTimer({
  phase,
  timeRemaining,
  totalTime,
  isPaused = false,
  showMilliseconds = false,
  onTimeUp,
  onWarning,
  className = '',
}: GameTimerProps) {
  // Refs for audio and animations
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number | null>(null);

  // State management
  const [timerState, setTimerState] = useState<TimerState>({
    displayTime: timeRemaining,
    urgencyLevel: 'safe',
    isAnimating: false,
    warningsTriggered: new Set(),
    lastTick: Date.now(),
  });

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const phaseConfig = PHASE_TIMER_CONFIG[phase];
  const timePercentage = totalTime > 0 ? (timeRemaining / totalTime) * 100 : 0;

  const urgencyLevel = useMemo((): typeof timerState.urgencyLevel => {
    const percentage = timeRemaining / totalTime;

    if (percentage > URGENCY_CONFIG.safe.threshold) return 'safe';
    if (percentage > URGENCY_CONFIG.warning.threshold) return 'warning';
    if (percentage > URGENCY_CONFIG.danger.threshold) return 'danger';
    return 'critical';
  }, [timeRemaining, totalTime]);

  const urgencyConfig = URGENCY_CONFIG[urgencyLevel];

  const formattedTime = useMemo(() => {
    const time = Math.max(0, timerState.displayTime);
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const milliseconds = Math.floor((time % 1) * 100);

    if (showMilliseconds && time < 10) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
    }

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [timerState.displayTime, showMilliseconds]);

  // ============================================================================
  // EFFECT HOOKS
  // ============================================================================

  // Update display time and handle warnings
  useEffect(() => {
    setTimerState(prev => ({
      ...prev,
      displayTime: timeRemaining,
      urgencyLevel,
      lastTick: Date.now(),
    }));

    // Check for warning thresholds
    phaseConfig.warningThresholds.forEach(threshold => {
      if (
        timeRemaining <= threshold &&
        !timerState.warningsTriggered.has(threshold)
      ) {
        setTimerState(prev => ({
          ...prev,
          warningsTriggered: new Set([...prev.warningsTriggered, threshold]),
        }));

        onWarning?.(threshold);
        playWarningSound(threshold);
        triggerHapticFeedback();
      }
    });

    // Handle time up
    if (timeRemaining <= 0 && timerState.displayTime > 0) {
      onTimeUp?.();
      playTimeUpSound();
      triggerHapticFeedback('strong');
    }
  }, [
    timeRemaining,
    urgencyLevel,
    phaseConfig.warningThresholds,
    timerState.warningsTriggered,
    timerState.displayTime,
    onTimeUp,
    onWarning,
  ]);

  // Animate timer when in critical state
  useEffect(() => {
    if (urgencyLevel === 'critical' && !isPaused) {
      setTimerState(prev => ({ ...prev, isAnimating: true }));

      const animate = () => {
        if (animationRef.current) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    } else {
      setTimerState(prev => ({ ...prev, isAnimating: false }));
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [urgencyLevel, isPaused]);

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const playWarningSound = useCallback((threshold: number) => {
    if (typeof window === 'undefined' || !('Audio' in window)) return;

    try {
      // Different sounds for different warning levels
      const soundMap: Record<number, string> = {
        120: '/sounds/timer-warning-2min.mp3',
        60: '/sounds/timer-warning-1min.mp3',
        30: '/sounds/timer-warning-30sec.mp3',
        10: '/sounds/timer-warning-10sec.mp3',
      };

      const soundFile =
        soundMap[threshold] || '/sounds/timer-warning-generic.mp3';
      const audio = new Audio(soundFile);
      audio.volume = 0.4;
      audio.play().catch(() => {
        // Ignore audio play errors
      });
    } catch (error) {
      console.debug('Timer warning sound not played:', threshold);
    }
  }, []);

  const playTimeUpSound = useCallback(() => {
    if (typeof window === 'undefined' || !('Audio' in window)) return;

    try {
      const audio = new Audio('/sounds/timer-time-up.mp3');
      audio.volume = 0.6;
      audio.play().catch(() => {
        // Ignore audio play errors
      });
    } catch (error) {
      console.debug('Time up sound not played');
    }
  }, []);

  const triggerHapticFeedback = useCallback(
    (intensity: 'light' | 'strong' = 'light') => {
      if (
        typeof window !== 'undefined' &&
        'navigator' in window &&
        'vibrate' in navigator
      ) {
        try {
          const patterns = {
            light: [50],
            strong: [100, 50, 100],
          };

          navigator.vibrate(patterns[intensity]);
        } catch (error) {
          console.debug('Haptic feedback not available');
        }
      }
    },
    []
  );

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderProgressRing = () => {
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset =
      circumference - (timePercentage / 100) * circumference;

    return (
      <div className='relative h-32 w-32'>
        <svg className='h-32 w-32 -rotate-90 transform' viewBox='0 0 100 100'>
          {/* Background circle */}
          <circle
            cx='50'
            cy='50'
            r={radius}
            stroke='currentColor'
            strokeWidth='8'
            fill='none'
            className='text-gray-200'
          />

          {/* Progress circle */}
          <circle
            cx='50'
            cy='50'
            r={radius}
            stroke='currentColor'
            strokeWidth='8'
            fill='none'
            className={`text-${urgencyConfig.color}-500 transition-all duration-300 ${
              timerState.isAnimating ? 'animate-pulse' : ''
            }`}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset,
              strokeLinecap: 'round',
            }}
          />
        </svg>

        {/* Center content */}
        <div className='absolute inset-0 flex flex-col items-center justify-center'>
          <div
            className={`font-mono text-2xl font-bold ${urgencyConfig.textColor} ${
              timerState.isAnimating ? 'animate-bounce' : ''
            }`}
          >
            {formattedTime}
          </div>
          <div className='mt-1 text-xs text-gray-600'>
            {Math.round(timePercentage)}%
          </div>
        </div>
      </div>
    );
  };

  const renderPhaseInfo = () => (
    <div
      className={`rounded-lg border-2 p-4 ${urgencyConfig.borderColor} ${urgencyConfig.bgColor}`}
    >
      <div className='mb-2 flex items-center space-x-3'>
        <span className='text-2xl' role='img' aria-label={phaseConfig.name}>
          {phaseConfig.icon}
        </span>
        <div>
          <h3 className={`font-semibold ${urgencyConfig.textColor}`}>
            {phaseConfig.name}
          </h3>
          <p className='text-sm text-gray-600'>{phaseConfig.description}</p>
        </div>
      </div>

      {/* Status indicators */}
      <div className='flex items-center justify-between text-sm'>
        <div
          className={`flex items-center space-x-2 ${urgencyConfig.textColor}`}
        >
          <div
            className={`h-2 w-2 rounded-full bg-${urgencyConfig.color}-500 ${
              !isPaused && urgencyLevel === 'critical' ? 'animate-ping' : ''
            }`}
          />
          <span className='font-medium capitalize'>
            {urgencyLevel === 'critical'
              ? 'Time Critical!'
              : urgencyLevel === 'danger'
                ? 'Hurry Up!'
                : urgencyLevel === 'warning'
                  ? 'Time Running Low'
                  : 'Time Remaining'}
          </span>
        </div>

        {isPaused && (
          <div className='flex items-center space-x-1 text-gray-500'>
            <svg className='h-4 w-4' fill='currentColor' viewBox='0 0 20 20'>
              <path
                fillRule='evenodd'
                d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z'
                clipRule='evenodd'
              />
            </svg>
            <span className='text-xs'>Paused</span>
          </div>
        )}
      </div>
    </div>
  );

  const renderWarningBanner = () => {
    if (urgencyLevel === 'safe') return null;

    const messages = {
      warning: '⚠️ Time is running out! Prepare to make your decision.',
      danger: '🚨 Less than 25% time remaining! Act quickly!',
      critical: '🔥 CRITICAL: Time almost up! Make your move now!',
    };

    const message = messages[urgencyLevel as keyof typeof messages];

    return (
      <div
        className={`rounded-lg border-l-4 p-3 ${urgencyConfig.borderColor} ${urgencyConfig.bgColor} ${
          timerState.isAnimating ? 'animate-pulse' : ''
        }`}
      >
        <p className={`text-sm font-medium ${urgencyConfig.textColor}`}>
          {message}
        </p>
      </div>
    );
  };

  const renderTimeBreakdown = () => {
    if (phase === 'game_over') return null;

    const minutes = Math.floor(timeRemaining / 60);
    const seconds = Math.floor(timeRemaining % 60);

    return (
      <div className='grid grid-cols-2 gap-4 text-center'>
        <div className={`rounded-lg p-3 ${urgencyConfig.bgColor}`}>
          <div className={`text-2xl font-bold ${urgencyConfig.textColor}`}>
            {minutes}
          </div>
          <div className='text-xs uppercase tracking-wide text-gray-600'>
            Minutes
          </div>
        </div>
        <div className={`rounded-lg p-3 ${urgencyConfig.bgColor}`}>
          <div className={`text-2xl font-bold ${urgencyConfig.textColor}`}>
            {seconds}
          </div>
          <div className='text-xs uppercase tracking-wide text-gray-600'>
            Seconds
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  if (phase === 'game_over') {
    return (
      <div className={`text-center ${className}`}>
        <div className='mb-2 text-4xl'>{phaseConfig.icon}</div>
        <h3 className='text-lg font-semibold text-gray-900'>
          {phaseConfig.name}
        </h3>
        <p className='text-sm text-gray-600'>{phaseConfig.description}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Warning Banner */}
      {renderWarningBanner()}

      {/* Main Timer Display */}
      <div className='flex items-center justify-center space-x-6'>
        {/* Progress Ring */}
        {renderProgressRing()}

        {/* Phase Information */}
        <div className='flex-1'>{renderPhaseInfo()}</div>
      </div>

      {/* Time Breakdown */}
      {renderTimeBreakdown()}

      {/* Debug Info (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className='rounded bg-gray-50 p-2 text-xs text-gray-500'>
          Debug: {timeRemaining}s / {totalTime}s • {timePercentage.toFixed(1)}%
          • {urgencyLevel}
        </div>
      )}

      {/* Accessibility Information */}
      <div
        className='sr-only'
        role='timer'
        aria-live='polite'
        aria-atomic='true'
      >
        {phaseConfig.name}: {formattedTime} remaining.
        {urgencyLevel === 'critical' && ' Time is critical!'}
        {isPaused && ' Timer is paused.'}
        //TODO: Add more detailed screen reader announcements for timer state
        changes
      </div>
    </div>
  );
}
