'use client';

/**
 * PhaseIndicator Component for RpgAInfinity Deduction Game
 *
 * Visual game phase indicator featuring:
 * - Clear phase progression with visual timeline
 * - Phase-specific icons and color coding
 * - Round counter and progress tracking
 * - Smooth transitions with animations
 * - Phase descriptions and next phase preview
 */

import { useMemo, useEffect, useState } from 'react';
import { DeductionPhase } from '../../../types/deduction';

// ============================================================================
// COMPONENT TYPES & INTERFACES
// ============================================================================

export interface PhaseIndicatorProps {
  readonly currentPhase: DeductionPhase;
  readonly round: number;
  readonly isTransitioning?: boolean;
  readonly nextPhase?: DeductionPhase;
  readonly transitionProgress?: number; // 0-100
  readonly className?: string;
}

interface PhaseData {
  name: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  order: number;
}

interface PhaseIndicatorState {
  showTransition: boolean;
  animationClass: string;
}

// ============================================================================
// PHASE CONFIGURATION
// ============================================================================

const PHASE_DATA: Record<DeductionPhase, PhaseData> = {
  role_assignment: {
    name: 'Role Assignment',
    description: 'Players are receiving their secret roles and objectives',
    icon: '🎭',
    color: 'purple',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-300',
    textColor: 'text-purple-800',
    order: 1,
  },
  day_discussion: {
    name: 'Day Discussion',
    description:
      'Share information, discuss suspicions, and plan your strategy',
    icon: '☀️',
    color: 'yellow',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-300',
    textColor: 'text-yellow-800',
    order: 2,
  },
  day_voting: {
    name: 'Voting Phase',
    description: 'Cast your vote to eliminate a suspected player',
    icon: '🗳️',
    color: 'blue',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    textColor: 'text-blue-800',
    order: 3,
  },
  night_actions: {
    name: 'Night Actions',
    description: 'Use your role abilities while others sleep',
    icon: '🌙',
    color: 'indigo',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-300',
    textColor: 'text-indigo-800',
    order: 4,
  },
  game_over: {
    name: 'Game Over',
    description: 'The game has concluded with a winner',
    icon: '🏆',
    color: 'green',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-300',
    textColor: 'text-green-800',
    order: 5,
  },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function PhaseIndicator({
  currentPhase,
  round,
  isTransitioning = false,
  nextPhase,
  transitionProgress = 0,
  className = '',
}: PhaseIndicatorProps) {
  // State for animations
  const [indicatorState, setIndicatorState] = useState<PhaseIndicatorState>({
    showTransition: false,
    animationClass: '',
  });

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const currentPhaseData = PHASE_DATA[currentPhase];
  const nextPhaseData = nextPhase ? PHASE_DATA[nextPhase] : null;

  const phaseSequence = useMemo(() => {
    // Create the typical phase sequence for display
    return [
      PHASE_DATA.role_assignment,
      PHASE_DATA.day_discussion,
      PHASE_DATA.day_voting,
      PHASE_DATA.night_actions,
    ].filter(phase => phase.order <= 4); // Exclude game_over from sequence
  }, []);

  const currentPhaseIndex = useMemo(() => {
    return phaseSequence.findIndex(
      phase => phase.name === currentPhaseData.name
    );
  }, [phaseSequence, currentPhaseData]);

  const progressPercentage = useMemo(() => {
    if (currentPhase === 'game_over') return 100;
    if (currentPhaseIndex === -1) return 0;

    const baseProgress = (currentPhaseIndex / (phaseSequence.length - 1)) * 100;
    const phaseProgress = isTransitioning
      ? transitionProgress / phaseSequence.length
      : 0;

    return Math.min(100, baseProgress + phaseProgress);
  }, [
    currentPhaseIndex,
    phaseSequence.length,
    isTransitioning,
    transitionProgress,
    currentPhase,
  ]);

  // ============================================================================
  // EFFECT HOOKS
  // ============================================================================

  useEffect(() => {
    if (isTransitioning) {
      setIndicatorState(prev => ({
        ...prev,
        showTransition: true,
        animationClass: 'animate-pulse',
      }));

      const timer = setTimeout(() => {
        setIndicatorState(prev => ({
          ...prev,
          animationClass: 'animate-bounce',
        }));
      }, 1000);

      return () => clearTimeout(timer);
    } else {
      setIndicatorState({
        showTransition: false,
        animationClass: '',
      });
    }
  }, [isTransitioning]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderPhaseTimeline = () => (
    <div className='mb-4 flex items-center space-x-2'>
      {phaseSequence.map((phaseData, index) => {
        const isActive = phaseData.name === currentPhaseData.name;
        const isCompleted = index < currentPhaseIndex;
        const isNext = nextPhaseData && phaseData.name === nextPhaseData.name;

        return (
          <div key={phaseData.name} className='flex items-center'>
            {/* Phase Circle */}
            <div
              className={`relative flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                isActive
                  ? `${phaseData.borderColor} ${phaseData.bgColor} shadow-lg`
                  : isCompleted
                    ? 'border-green-400 bg-green-100'
                    : isNext && isTransitioning
                      ? `${phaseData.borderColor} ${phaseData.bgColor} opacity-50`
                      : 'border-gray-300 bg-gray-100'
              } ${isActive ? indicatorState.animationClass : ''}`}
              title={phaseData.name}
              role='img'
              aria-label={`Phase: ${phaseData.name}${isActive ? ' (current)' : ''}${isCompleted ? ' (completed)' : ''}`}
            >
              {isCompleted ? (
                <span className='text-sm text-green-600'>✓</span>
              ) : (
                <span
                  className={`text-sm ${isActive ? phaseData.textColor : 'text-gray-600'}`}
                >
                  {phaseData.icon}
                </span>
              )}

              {/* Active Phase Pulse */}
              {isActive && (
                <div
                  className={`absolute inset-0 rounded-full ${phaseData.borderColor} animate-ping opacity-25`}
                />
              )}
            </div>

            {/* Phase Name */}
            <span
              className={`ml-2 text-xs font-medium ${
                isActive ? phaseData.textColor : 'text-gray-600'
              }`}
            >
              {phaseData.name.split(' ')[0]}
            </span>

            {/* Connector Line */}
            {index < phaseSequence.length - 1 && (
              <div
                className={`mx-2 h-0.5 w-6 transition-colors ${
                  index < currentPhaseIndex ? 'bg-green-400' : 'bg-gray-300'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  const renderProgressBar = () => (
    <div className='mb-4'>
      <div className='mb-1 flex justify-between text-xs text-gray-600'>
        <span>Round {round} Progress</span>
        <span>{Math.round(progressPercentage)}%</span>
      </div>
      <div className='h-2 w-full overflow-hidden rounded-full bg-gray-200'>
        <div
          className={`h-full transition-all duration-500 ease-out ${
            currentPhase === 'game_over'
              ? 'bg-green-500'
              : `bg-${currentPhaseData.color}-500`
          }`}
          style={{ width: `${progressPercentage}%` }}
        />
        {/* Transition indicator */}
        {isTransitioning && (
          <div
            className={`absolute h-full bg-${currentPhaseData.color}-300 animate-pulse`}
            style={{
              width: '10%',
              left: `${progressPercentage - 5}%`,
            }}
          />
        )}
      </div>
    </div>
  );

  const renderCurrentPhaseCard = () => (
    <div
      className={`rounded-lg border-2 p-4 ${currentPhaseData.borderColor} ${currentPhaseData.bgColor}`}
    >
      <div className='flex items-start space-x-3'>
        <div
          className={`text-3xl ${indicatorState.animationClass}`}
          role='img'
          aria-label={currentPhaseData.name}
        >
          {currentPhaseData.icon}
        </div>

        <div className='flex-1'>
          <div className='mb-2 flex items-center justify-between'>
            <h2
              className={`text-lg font-semibold ${currentPhaseData.textColor}`}
            >
              {currentPhaseData.name}
            </h2>
            <span className='rounded-full bg-white bg-opacity-50 px-2 py-1 text-xs font-medium'>
              Round {round}
            </span>
          </div>

          <p className={`text-sm ${currentPhaseData.textColor} opacity-90`}>
            {currentPhaseData.description}
          </p>

          {/* Transition Information */}
          {isTransitioning && nextPhaseData && (
            <div className='mt-3 rounded border border-white border-opacity-40 bg-white bg-opacity-30 p-2'>
              <div className='flex items-center space-x-2'>
                <div className='h-3 w-3 animate-spin rounded-full border border-current border-t-transparent' />
                <span className='text-xs font-medium'>
                  Transitioning to {nextPhaseData.name}...
                </span>
              </div>
              {transitionProgress > 0 && (
                <div className='mt-1 h-1 w-full rounded-full bg-white bg-opacity-30'>
                  <div
                    className='h-1 rounded-full bg-white transition-all'
                    style={{ width: `${transitionProgress}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderPhaseInstructions = () => {
    if (currentPhase === 'game_over') return null;

    const instructions: Record<DeductionPhase, string[]> = {
      role_assignment: [
        'Review your role card and win condition',
        'Read any secret information carefully',
        'Plan your initial strategy',
      ],
      day_discussion: [
        'Share information and observations',
        'Ask questions to gather intelligence',
        'Build alliances and identify threats',
        'Use your abilities if available',
      ],
      day_voting: [
        'Select a player to vote for elimination',
        'Consider all available information',
        'Vote before time expires',
      ],
      night_actions: [
        'Use your night abilities if available',
        'Target other players strategically',
        'Wait for other players to complete their actions',
      ],
    };

    const currentInstructions = instructions[currentPhase];
    if (!currentInstructions) return null;

    return (
      <div className='mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3'>
        <h4 className='mb-2 text-sm font-semibold text-gray-900'>
          Phase Instructions:
        </h4>
        <ul className='space-y-1'>
          {currentInstructions.map((instruction, index) => (
            <li key={index} className='flex items-start text-sm text-gray-700'>
              <span className='mr-2 text-gray-400'>•</span>
              {instruction}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className={`${className}`}>
      {/* Phase Timeline */}
      {currentPhase !== 'game_over' && renderPhaseTimeline()}

      {/* Progress Bar */}
      {renderProgressBar()}

      {/* Current Phase Card */}
      {renderCurrentPhaseCard()}

      {/* Phase Instructions */}
      {renderPhaseInstructions()}

      {/* Accessibility Information */}
      <div className='sr-only' role='status' aria-live='polite'>
        Current game phase: {currentPhaseData.name}, Round {round}.
        {isTransitioning &&
          nextPhaseData &&
          ` Transitioning to ${nextPhaseData.name}.`}
        Phase description: {currentPhaseData.description}
        //TODO: Add more detailed screen reader support for phase changes
      </div>
    </div>
  );
}
