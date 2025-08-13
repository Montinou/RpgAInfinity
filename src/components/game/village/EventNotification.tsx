/**
 * Village Event Notification Component
 *
 * Displays event popup notifications with player choice systems
 * Integrates with the Village Events system for interactive storytelling
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Calendar,
  Clock,
  Users,
  Coins,
  Heart,
  Shield,
  Zap,
  Star,
  X,
  ChevronRight,
} from 'lucide-react';
import {
  GameEvent,
  PlayerChoice,
  EventSeverity,
  EventType,
} from '@/types/village';

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

interface EventNotificationProps {
  event: GameEvent;
  isVisible: boolean;
  onChoiceSelected: (choice: PlayerChoice) => Promise<void>;
  onDismiss: () => void;
  timeLimit?: number; // Seconds remaining to make choice
  village: {
    name: string;
    resources: Record<string, number>;
  };
}

interface ChoiceButtonProps {
  choice: PlayerChoice;
  isSelected: boolean;
  canAfford: boolean;
  onSelect: () => void;
  isLoading: boolean;
}

interface RequirementDisplayProps {
  requirements: Array<{ resource: string; amount: number }>;
  availableResources: Record<string, number>;
}

// ============================================================================
// SEVERITY AND TYPE STYLING
// ============================================================================

const SEVERITY_STYLES = {
  minor: {
    bg: 'bg-blue-50 border-blue-200',
    header: 'bg-blue-100 border-blue-200',
    icon: 'text-blue-600',
    accent: 'text-blue-800',
  },
  moderate: {
    bg: 'bg-yellow-50 border-yellow-200',
    header: 'bg-yellow-100 border-yellow-200',
    icon: 'text-yellow-600',
    accent: 'text-yellow-800',
  },
  major: {
    bg: 'bg-orange-50 border-orange-200',
    header: 'bg-orange-100 border-orange-200',
    icon: 'text-orange-600',
    accent: 'text-orange-800',
  },
  catastrophic: {
    bg: 'bg-red-50 border-red-200',
    header: 'bg-red-100 border-red-200',
    icon: 'text-red-600',
    accent: 'text-red-800',
  },
  beneficial: {
    bg: 'bg-green-50 border-green-200',
    header: 'bg-green-100 border-green-200',
    icon: 'text-green-600',
    accent: 'text-green-800',
  },
} as const;

const EVENT_ICONS = {
  natural: Calendar,
  social: Users,
  economic: Coins,
  military: Shield,
  technological: Zap,
  political: Star,
  cultural: Heart,
  supernatural: AlertTriangle,
} as const;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function EventNotification({
  event,
  isVisible,
  onChoiceSelected,
  onDismiss,
  timeLimit,
  village,
}: EventNotificationProps) {
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [remainingTime, setRemainingTime] = useState(timeLimit);

  // Timer countdown effect
  useEffect(() => {
    if (!timeLimit || !isVisible) return;

    const timer = setInterval(() => {
      setRemainingTime(prev => {
        if (prev && prev <= 1) {
          // Auto-dismiss when time runs out
          onDismiss();
          return 0;
        }
        return prev ? prev - 1 : 0;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLimit, isVisible, onDismiss]);

  // Handle choice selection
  const handleChoiceSelect = async (choice: PlayerChoice) => {
    if (isProcessing) return;

    setSelectedChoiceId(choice.id);
    setIsProcessing(true);

    try {
      await onChoiceSelected(choice);
    } catch (error) {
      console.error('Error processing choice:', error);
      // Reset selection on error
      setSelectedChoiceId(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Get event styling
  const severity = event.severity || 'moderate';
  const styles = SEVERITY_STYLES[severity];
  const EventIcon = EVENT_ICONS[event.type] || AlertTriangle;

  // Check if player can afford choice
  const canAffordChoice = (choice: PlayerChoice): boolean => {
    return choice.resourceCost.every(
      cost => (village.resources[cost.resource] || 0) >= cost.amount
    );
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'
            onClick={onDismiss}
          >
            {/* Event Modal */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`
                max-h-[80vh] w-full max-w-2xl overflow-auto
                rounded-lg border-2 shadow-lg
                ${styles.bg}
              `}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className={`
                flex items-center justify-between border-b-2 p-4
                ${styles.header}
              `}
              >
                <div className='flex items-center gap-3'>
                  <EventIcon className={`h-6 w-6 ${styles.icon}`} />
                  <div>
                    <h2 className={`text-lg font-bold ${styles.accent}`}>
                      {event.name}
                    </h2>
                    <p className='text-sm text-gray-600'>
                      {village.name} •{' '}
                      {event.type.charAt(0).toUpperCase() + event.type.slice(1)}{' '}
                      Event
                    </p>
                  </div>
                </div>

                <div className='flex items-center gap-2'>
                  {/* Timer */}
                  {remainingTime && (
                    <div className='flex items-center gap-1 font-mono text-sm'>
                      <Clock className='h-4 w-4' />
                      <span
                        className={
                          remainingTime < 30 ? 'text-red-600' : 'text-gray-600'
                        }
                      >
                        {Math.floor(remainingTime / 60)}:
                        {(remainingTime % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  )}

                  {/* Close button */}
                  <button
                    onClick={onDismiss}
                    className='rounded-full p-1 transition-colors hover:bg-white/50'
                    disabled={isProcessing}
                  >
                    <X className='h-5 w-5' />
                  </button>
                </div>
              </div>

              {/* Event Description */}
              <div className='p-6'>
                <div className='prose prose-sm mb-6 max-w-none'>
                  <p className='leading-relaxed text-gray-700'>
                    {event.description}
                  </p>

                  {/* Event Effects Preview */}
                  {event.effects && event.effects.length > 0 && (
                    <div className='mt-4 rounded-md border bg-white/50 p-3'>
                      <h4 className='mb-2 text-sm font-semibold'>
                        Current Effects:
                      </h4>
                      <ul className='space-y-1'>
                        {event.effects.map((effect, index) => (
                          <li
                            key={index}
                            className='flex items-center gap-2 text-sm'
                          >
                            <div
                              className={`h-2 w-2 rounded-full ${
                                effect.modifier > 0
                                  ? 'bg-green-400'
                                  : 'bg-red-400'
                              }`}
                            />
                            <span>{effect.description}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Player Choices */}
                {event.playerChoices && event.playerChoices.length > 0 && (
                  <div className='space-y-3'>
                    <h3 className='mb-3 font-semibold text-gray-800'>
                      How should the village respond?
                    </h3>

                    {event.playerChoices.map(choice => (
                      <ChoiceButton
                        key={choice.id}
                        choice={choice}
                        isSelected={selectedChoiceId === choice.id}
                        canAfford={canAffordChoice(choice)}
                        onSelect={() => handleChoiceSelect(choice)}
                        isLoading={
                          isProcessing && selectedChoiceId === choice.id
                        }
                      />
                    ))}

                    {/* No choice option */}
                    <ChoiceButton
                      choice={{
                        id: 'no_action',
                        name: 'Do Nothing',
                        description:
                          'Let events unfold naturally without intervention.',
                        requirements: [],
                        resourceCost: [],
                        immediateEffects: [],
                        delayedEffects: [],
                        chainEvents: [],
                        successChance: 100,
                        criticalSuccessChance: 0,
                        failureConsequences: [],
                        outcomeDescriptions: {
                          success: 'The village watches and waits.',
                          failure:
                            'Sometimes doing nothing is the wisest choice.',
                        },
                      }}
                      isSelected={selectedChoiceId === 'no_action'}
                      canAfford={true}
                      onSelect={() =>
                        handleChoiceSelect({
                          id: 'no_action',
                          name: 'Do Nothing',
                          description:
                            'Let events unfold naturally without intervention.',
                          requirements: [],
                          resourceCost: [],
                          immediateEffects: [],
                          delayedEffects: [],
                          chainEvents: [],
                          successChance: 100,
                          criticalSuccessChance: 0,
                          failureConsequences: [],
                          outcomeDescriptions: {
                            success: 'The village watches and waits.',
                            failure:
                              'Sometimes doing nothing is the wisest choice.',
                          },
                        })
                      }
                      isLoading={
                        isProcessing && selectedChoiceId === 'no_action'
                      }
                    />
                  </div>
                )}

                {/* No choices available */}
                {(!event.playerChoices || event.playerChoices.length === 0) && (
                  <div className='mt-6 rounded-md border bg-white/50 p-4 text-center'>
                    <p className='text-gray-600'>
                      This event unfolds automatically. The village adapts as
                      best it can.
                    </p>
                    <button
                      onClick={onDismiss}
                      className='mt-3 rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700'
                    >
                      Continue
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// CHOICE BUTTON COMPONENT
// ============================================================================

function ChoiceButton({
  choice,
  isSelected,
  canAfford,
  onSelect,
  isLoading,
}: ChoiceButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      disabled={!canAfford || isLoading}
      className={`
        w-full rounded-lg border-2 p-4 text-left transition-all duration-200
        ${
          isSelected
            ? 'border-blue-500 bg-blue-50'
            : canAfford
              ? 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
              : 'cursor-not-allowed border-red-200 bg-red-50 opacity-60'
        }
        ${isLoading ? 'cursor-wait opacity-50' : ''}
      `}
    >
      <div className='flex items-start justify-between'>
        <div className='flex-1'>
          <div className='mb-2 flex items-center gap-2'>
            <h4
              className={`font-semibold ${
                canAfford ? 'text-gray-800' : 'text-red-600'
              }`}
            >
              {choice.name}
            </h4>

            {/* Success chance indicator */}
            <div className='flex items-center gap-1 text-xs'>
              <Star className='h-3 w-3' />
              <span>{choice.successChance}%</span>
            </div>
          </div>

          <p className='mb-3 text-sm text-gray-600'>{choice.description}</p>

          {/* Requirements and costs */}
          {choice.resourceCost && choice.resourceCost.length > 0 && (
            <RequirementDisplay
              requirements={choice.resourceCost}
              availableResources={{}} // TODO: Pass actual village resources
            />
          )}

          {/* Time cost */}
          {choice.timeCost && choice.timeCost > 0 && (
            <div className='mt-2 flex items-center gap-1 text-xs text-gray-500'>
              <Clock className='h-3 w-3' />
              <span>
                Takes {choice.timeCost} day{choice.timeCost !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        <div className='ml-3 flex items-center'>
          {isLoading ? (
            <div className='h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent' />
          ) : (
            <ChevronRight
              className={`h-5 w-5 ${
                canAfford ? 'text-gray-400' : 'text-red-400'
              }`}
            />
          )}
        </div>
      </div>
    </motion.button>
  );
}

// ============================================================================
// REQUIREMENT DISPLAY COMPONENT
// ============================================================================

function RequirementDisplay({
  requirements,
  availableResources,
}: RequirementDisplayProps) {
  if (!requirements || requirements.length === 0) return null;

  return (
    <div className='mt-2 flex flex-wrap gap-2'>
      {requirements.map((req, index) => {
        const available = availableResources[req.resource] || 0;
        const canAfford = available >= req.amount;

        return (
          <div
            key={index}
            className={`
              flex items-center gap-1 rounded-full px-2 py-1 text-xs
              ${
                canAfford
                  ? 'border border-green-200 bg-green-100 text-green-700'
                  : 'border border-red-200 bg-red-100 text-red-700'
              }
            `}
          >
            <Coins className='h-3 w-3' />
            <span>
              {req.amount} {req.resource}
            </span>
            <span className='text-gray-500'>({available})</span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format time remaining for display
 */
export function formatTimeRemaining(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Get event urgency level based on time remaining
 */
export function getEventUrgency(
  timeRemaining?: number
): 'low' | 'medium' | 'high' | 'critical' {
  if (!timeRemaining) return 'low';

  if (timeRemaining < 30) return 'critical';
  if (timeRemaining < 120) return 'high';
  if (timeRemaining < 300) return 'medium';
  return 'low';
}

/**
 * Calculate choice recommendation score
 */
export function calculateChoiceScore(
  choice: PlayerChoice,
  villageResources: Record<string, number>
): number {
  let score = choice.successChance;

  // Penalty for unaffordable choices
  const canAfford = choice.resourceCost.every(
    cost => (villageResources[cost.resource] || 0) >= cost.amount
  );
  if (!canAfford) score -= 50;

  // Bonus for beneficial effects
  const beneficialEffects = choice.immediateEffects.filter(
    effect => effect.modifier > 0
  );
  score += beneficialEffects.length * 5;

  return Math.max(0, Math.min(100, score));
}
