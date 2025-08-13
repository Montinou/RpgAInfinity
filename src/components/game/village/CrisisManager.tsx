/**
 * Village Crisis Manager Component
 *
 * Handles emergency event management and crisis response coordination
 * Provides urgent decision-making interface for catastrophic events
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Shield,
  Users,
  Clock,
  Zap,
  Heart,
  ArrowRight,
  CheckCircle,
  XCircle,
  Timer,
  Flame,
  Cloud,
  Swords,
  Skull,
  Home,
} from 'lucide-react';
import {
  GameEvent,
  PlayerChoice,
  EventSeverity,
  Village,
} from '@/types/village';
import {
  getEmergencyResponseOptions,
  calculateCrisisLevel,
} from '@/lib/games/village/events';

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

interface CrisisManagerProps {
  activeEvents: GameEvent[];
  village: Village;
  onEmergencyResponse: (eventId: string, choice: PlayerChoice) => Promise<void>;
  onEvacuationOrder: (buildingIds: string[]) => Promise<void>;
  onResourceReallocation: (allocation: ResourceAllocation) => Promise<void>;
  className?: string;
}

interface CrisisEvent {
  event: GameEvent;
  urgencyLevel: 1 | 2 | 3 | 4 | 5; // 1 = low, 5 = catastrophic
  timeRemaining?: number; // Seconds until auto-resolution
  affectedPopulation: number;
  requiredResponse: 'immediate' | 'urgent' | 'planned';
}

interface ResourceAllocation {
  source: 'treasury' | 'reserves' | 'buildings';
  target: 'emergency_fund' | 'evacuation' | 'reconstruction';
  amount: number;
  resourceType: string;
}

interface EmergencyAction {
  id: string;
  name: string;
  description: string;
  cost: Array<{ resource: string; amount: number }>;
  effectiveness: number; // 0-100
  timeRequired: number; // Hours
  prerequisites: string[];
  consequences: Array<{ type: string; description: string; severity: number }>;
}

// ============================================================================
// CRISIS SEVERITY AND TYPES
// ============================================================================

const CRISIS_TYPES = {
  natural_disaster: {
    icon: Cloud,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    name: 'Natural Disaster',
  },
  military_attack: {
    icon: Swords,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    name: 'Military Attack',
  },
  plague_outbreak: {
    icon: Skull,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    name: 'Plague Outbreak',
  },
  resource_shortage: {
    icon: AlertTriangle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    name: 'Critical Shortage',
  },
  infrastructure_failure: {
    icon: Home,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    name: 'Infrastructure Failure',
  },
  social_unrest: {
    icon: Users,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    name: 'Social Unrest',
  },
};

const URGENCY_LEVELS = {
  1: { label: 'Low', color: 'text-green-600', bgColor: 'bg-green-100' },
  2: { label: 'Moderate', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  3: { label: 'High', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  4: { label: 'Critical', color: 'text-red-600', bgColor: 'bg-red-100' },
  5: { label: 'Catastrophic', color: 'text-red-800', bgColor: 'bg-red-200' },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CrisisManager({
  activeEvents,
  village,
  onEmergencyResponse,
  onEvacuationOrder,
  onResourceReallocation,
  className = '',
}: CrisisManagerProps) {
  const [selectedCrisis, setSelectedCrisis] = useState<CrisisEvent | null>(
    null
  );
  const [isProcessingResponse, setIsProcessingResponse] = useState(false);
  const [evacuationMode, setEvacuationMode] = useState(false);
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);

  // Classify events as crises
  const crisisEvents = useMemo(() => {
    return activeEvents
      .filter(event => ['major', 'catastrophic'].includes(event.severity))
      .map(event => classifyAsCrisis(event, village))
      .sort((a, b) => b.urgencyLevel - a.urgencyLevel);
  }, [activeEvents, village]);

  // Calculate overall crisis level
  const overallCrisisLevel = useMemo(() => {
    return calculateCrisisLevel(activeEvents);
  }, [activeEvents]);

  // Handle emergency response
  const handleEmergencyResponse = async (
    crisis: CrisisEvent,
    choice: PlayerChoice
  ) => {
    if (isProcessingResponse) return;

    setIsProcessingResponse(true);

    try {
      await onEmergencyResponse(crisis.event.id, choice);
      setSelectedCrisis(null);
    } catch (error) {
      console.error('Emergency response failed:', error);
    } finally {
      setIsProcessingResponse(false);
    }
  };

  // Handle evacuation
  const handleEvacuation = async () => {
    if (selectedBuildings.length === 0) return;

    try {
      await onEvacuationOrder(selectedBuildings);
      setEvacuationMode(false);
      setSelectedBuildings([]);
    } catch (error) {
      console.error('Evacuation failed:', error);
    }
  };

  if (crisisEvents.length === 0) {
    return (
      <div
        className={`rounded-lg border border-green-200 bg-green-50 p-6 text-center ${className}`}
      >
        <CheckCircle className='mx-auto mb-3 h-12 w-12 text-green-500' />
        <h3 className='mb-2 text-lg font-semibold text-green-800'>All Clear</h3>
        <p className='text-green-600'>
          No active crises require immediate attention.
        </p>
        <p className='mt-2 text-sm text-green-500'>
          Village stability: {village.stability}%
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border-2 border-red-200 bg-white shadow-lg ${className}`}
    >
      {/* Crisis Header */}
      <div className='border-b-2 border-red-200 bg-red-50 p-4'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <div className='relative'>
              <AlertTriangle className='h-6 w-6 text-red-600' />
              {overallCrisisLevel > 50 && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className='absolute -right-1 -top-1 h-3 w-3 rounded-full bg-red-500'
                />
              )}
            </div>
            <div>
              <h2 className='text-lg font-bold text-red-800'>
                Crisis Management
              </h2>
              <p className='text-sm text-red-600'>
                {crisisEvents.length} active crisis
                {crisisEvents.length !== 1 ? 'es' : ''} • Crisis Level:{' '}
                {overallCrisisLevel}%
              </p>
            </div>
          </div>

          {/* Crisis Level Indicator */}
          <div className='flex items-center gap-2'>
            <div className='h-2 w-32 rounded-full bg-gray-200'>
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  overallCrisisLevel > 75
                    ? 'bg-red-600'
                    : overallCrisisLevel > 50
                      ? 'bg-orange-500'
                      : overallCrisisLevel > 25
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, overallCrisisLevel)}%` }}
              />
            </div>
            <span className='font-mono text-sm text-gray-600'>
              {overallCrisisLevel.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Emergency Actions */}
        <div className='mt-4 flex flex-wrap gap-2'>
          <button
            onClick={() => setEvacuationMode(true)}
            className='flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-200'
          >
            <Users className='h-4 w-4' />
            Emergency Evacuation
          </button>

          <button
            onClick={() =>
              onResourceReallocation({
                source: 'treasury',
                target: 'emergency_fund',
                amount: Math.floor((village.economy?.treasury || 0) * 0.2),
                resourceType: 'gold',
              })
            }
            className='flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-200'
          >
            <Shield className='h-4 w-4' />
            Emergency Funding
          </button>
        </div>
      </div>

      {/* Crisis List */}
      <div className='max-h-96 overflow-y-auto'>
        {crisisEvents.map(crisis => (
          <CrisisEventCard
            key={crisis.event.id}
            crisis={crisis}
            village={village}
            onSelect={() => setSelectedCrisis(crisis)}
            isSelected={selectedCrisis?.event.id === crisis.event.id}
          />
        ))}
      </div>

      {/* Crisis Response Modal */}
      <AnimatePresence>
        {selectedCrisis && (
          <CrisisResponseModal
            crisis={selectedCrisis}
            village={village}
            onResponse={choice =>
              handleEmergencyResponse(selectedCrisis, choice)
            }
            onClose={() => setSelectedCrisis(null)}
            isProcessing={isProcessingResponse}
          />
        )}
      </AnimatePresence>

      {/* Evacuation Modal */}
      <AnimatePresence>
        {evacuationMode && (
          <EvacuationModal
            village={village}
            selectedBuildings={selectedBuildings}
            onBuildingToggle={buildingId => {
              setSelectedBuildings(prev =>
                prev.includes(buildingId)
                  ? prev.filter(id => id !== buildingId)
                  : [...prev, buildingId]
              );
            }}
            onConfirm={handleEvacuation}
            onCancel={() => {
              setEvacuationMode(false);
              setSelectedBuildings([]);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// CRISIS EVENT CARD COMPONENT
// ============================================================================

interface CrisisEventCardProps {
  crisis: CrisisEvent;
  village: Village;
  onSelect: () => void;
  isSelected: boolean;
}

function CrisisEventCard({
  crisis,
  village,
  onSelect,
  isSelected,
}: CrisisEventCardProps) {
  const [timeRemaining, setTimeRemaining] = useState(crisis.timeRemaining);

  const crisisType = determineCrisisType(crisis.event);
  const typeConfig = CRISIS_TYPES[crisisType] || CRISIS_TYPES.natural_disaster;
  const urgencyConfig = URGENCY_LEVELS[crisis.urgencyLevel];
  const Icon = typeConfig.icon;

  // Countdown timer
  useEffect(() => {
    if (!crisis.timeRemaining) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => (prev ? Math.max(0, prev - 1) : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [crisis.timeRemaining]);

  return (
    <motion.div
      whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
      onClick={onSelect}
      className={`
        cursor-pointer border-b border-gray-100 p-4 transition-all duration-200
        ${isSelected ? 'border-r-4 border-red-500 bg-red-50' : 'hover:bg-gray-50'}
      `}
    >
      <div className='flex items-start gap-4'>
        <div
          className={`
          rounded-full p-3 ${typeConfig.bgColor} ${typeConfig.borderColor} border-2
        `}
        >
          <Icon className={`h-5 w-5 ${typeConfig.color}`} />
        </div>

        <div className='min-w-0 flex-1'>
          <div className='mb-2 flex items-center justify-between'>
            <h3 className='truncate font-semibold text-gray-900'>
              {crisis.event.name}
            </h3>

            <div className='ml-3 flex items-center gap-2'>
              {/* Urgency Badge */}
              <span
                className={`
                rounded-full px-2 py-1 text-xs font-medium
                ${urgencyConfig.color} ${urgencyConfig.bgColor}
              `}
              >
                {urgencyConfig.label}
              </span>

              {/* Timer */}
              {timeRemaining && timeRemaining > 0 && (
                <div
                  className={`
                  flex items-center gap-1 rounded-full px-2 py-1 font-mono text-xs
                  ${timeRemaining < 300 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}
                `}
                >
                  <Timer className='h-3 w-3' />
                  <span>
                    {Math.floor(timeRemaining / 60)}:
                    {(timeRemaining % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              )}
            </div>
          </div>

          <p className='mb-3 line-clamp-2 text-sm text-gray-600'>
            {crisis.event.description}
          </p>

          {/* Crisis Stats */}
          <div className='flex flex-wrap gap-3 text-xs'>
            <div className='flex items-center gap-1'>
              <Users className='h-3 w-3' />
              <span>{crisis.affectedPopulation} affected</span>
            </div>

            <div className='flex items-center gap-1'>
              <Clock className='h-3 w-3' />
              <span
                className={
                  crisis.requiredResponse === 'immediate'
                    ? 'font-medium text-red-600'
                    : crisis.requiredResponse === 'urgent'
                      ? 'text-orange-600'
                      : 'text-gray-600'
                }
              >
                {crisis.requiredResponse} response
              </span>
            </div>

            <div className='flex items-center gap-1'>
              <Shield className='h-3 w-3' />
              <span>Level {crisis.urgencyLevel} crisis</span>
            </div>
          </div>
        </div>

        <div className='flex items-center'>
          <ArrowRight className='h-4 w-4 text-gray-400' />
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// CRISIS RESPONSE MODAL
// ============================================================================

interface CrisisResponseModalProps {
  crisis: CrisisEvent;
  village: Village;
  onResponse: (choice: PlayerChoice) => void;
  onClose: () => void;
  isProcessing: boolean;
}

function CrisisResponseModal({
  crisis,
  village,
  onResponse,
  onClose,
  isProcessing,
}: CrisisResponseModalProps) {
  const emergencyOptions = useMemo(() => {
    return getEmergencyResponseOptions(crisis.event, village);
  }, [crisis.event, village]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className='max-h-[80vh] w-full max-w-2xl overflow-auto rounded-lg border-2 border-red-200 bg-white shadow-xl'
        onClick={e => e.stopPropagation()}
      >
        <div className='border-b border-red-200 bg-red-50 p-4'>
          <div className='flex items-center gap-3'>
            <AlertTriangle className='h-6 w-6 text-red-600' />
            <div>
              <h2 className='text-xl font-bold text-red-800'>
                Emergency Response Required
              </h2>
              <p className='text-red-600'>{crisis.event.name}</p>
            </div>
          </div>
        </div>

        <div className='p-6'>
          <div className='mb-6'>
            <h3 className='mb-2 font-semibold text-gray-800'>Crisis Details</h3>
            <p className='mb-4 text-gray-700'>{crisis.event.description}</p>

            <div className='grid grid-cols-2 gap-4 rounded-md bg-gray-50 p-3 text-sm'>
              <div>
                <span className='font-medium'>Affected Population:</span>{' '}
                {crisis.affectedPopulation}
              </div>
              <div>
                <span className='font-medium'>Urgency Level:</span>{' '}
                {crisis.urgencyLevel}/5
              </div>
              <div>
                <span className='font-medium'>Required Response:</span>{' '}
                {crisis.requiredResponse}
              </div>
              <div>
                <span className='font-medium'>Village Stability:</span>{' '}
                {village.stability}%
              </div>
            </div>
          </div>

          <div className='space-y-3'>
            <h3 className='font-semibold text-gray-800'>
              Emergency Response Options
            </h3>

            {emergencyOptions.map(option => (
              <button
                key={option.id}
                onClick={() => onResponse(option)}
                disabled={isProcessing}
                className={`
                  w-full rounded-lg border-2 p-4 text-left transition-all duration-200
                  ${
                    isProcessing
                      ? 'cursor-not-allowed opacity-50'
                      : 'hover:border-red-300 hover:bg-red-50'
                  }
                  border-gray-200 bg-white
                `}
              >
                <div className='mb-2 flex items-center justify-between'>
                  <h4 className='font-semibold text-gray-900'>{option.name}</h4>
                  <div className='flex items-center gap-1'>
                    <Zap className='h-4 w-4 text-green-500' />
                    <span className='text-sm'>{option.successChance}%</span>
                  </div>
                </div>

                <p className='mb-3 text-sm text-gray-600'>
                  {option.description}
                </p>

                {option.resourceCost.length > 0 && (
                  <div className='flex flex-wrap gap-2'>
                    {option.resourceCost.map((cost, index) => (
                      <span
                        key={index}
                        className='rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700'
                      >
                        {cost.amount} {cost.resource}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className='mt-6 flex justify-end gap-3'>
            <button
              onClick={onClose}
              disabled={isProcessing}
              className='px-4 py-2 text-gray-600 transition-colors hover:text-gray-800'
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// EVACUATION MODAL
// ============================================================================

interface EvacuationModalProps {
  village: Village;
  selectedBuildings: string[];
  onBuildingToggle: (buildingId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function EvacuationModal({
  village,
  selectedBuildings,
  onBuildingToggle,
  onConfirm,
  onCancel,
}: EvacuationModalProps) {
  const affectedPopulation = selectedBuildings.length * 10; // Simplified calculation

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className='w-full max-w-lg rounded-lg bg-white shadow-xl'
        onClick={e => e.stopPropagation()}
      >
        <div className='border-b border-orange-200 bg-orange-50 p-4'>
          <div className='flex items-center gap-3'>
            <Users className='h-6 w-6 text-orange-600' />
            <h2 className='text-xl font-bold text-orange-800'>
              Emergency Evacuation
            </h2>
          </div>
        </div>

        <div className='p-6'>
          <p className='mb-4 text-gray-700'>
            Select buildings to evacuate. This will move residents to safety but
            may disrupt village operations.
          </p>

          <div className='mb-4 max-h-48 space-y-2 overflow-y-auto'>
            {village.buildings.map(building => (
              <label
                key={building.id}
                className='flex cursor-pointer items-center gap-3 rounded p-2 hover:bg-gray-50'
              >
                <input
                  type='checkbox'
                  checked={selectedBuildings.includes(building.id)}
                  onChange={() => onBuildingToggle(building.id)}
                  className='h-4 w-4 text-orange-600'
                />
                <div className='flex-1'>
                  <span className='font-medium'>{building.name}</span>
                  <span className='ml-2 text-sm text-gray-500'>
                    ({building.workers?.length || 0} residents)
                  </span>
                </div>
              </label>
            ))}
          </div>

          {selectedBuildings.length > 0 && (
            <div className='mb-4 rounded-md bg-gray-50 p-3'>
              <p className='text-sm'>
                <strong>Evacuation Impact:</strong> ~{affectedPopulation} people
                will be relocated
              </p>
            </div>
          )}

          <div className='flex justify-end gap-3'>
            <button
              onClick={onCancel}
              className='px-4 py-2 text-gray-600 transition-colors hover:text-gray-800'
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={selectedBuildings.length === 0}
              className='rounded-md bg-orange-600 px-4 py-2 text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50'
            >
              Begin Evacuation
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function classifyAsCrisis(event: GameEvent, village: Village): CrisisEvent {
  // Calculate urgency based on event severity and village state
  let urgencyLevel: 1 | 2 | 3 | 4 | 5 = 3;

  switch (event.severity) {
    case 'catastrophic':
      urgencyLevel = 5;
      break;
    case 'major':
      urgencyLevel = 4;
      break;
    case 'moderate':
      urgencyLevel = 3;
      break;
    case 'minor':
      urgencyLevel = 2;
      break;
    case 'beneficial':
      urgencyLevel = 1;
      break;
  }

  // Adjust based on village stability
  if (village.stability < 30)
    urgencyLevel = Math.min(5, urgencyLevel + 1) as 1 | 2 | 3 | 4 | 5;

  // Calculate affected population (simplified)
  const affectedPopulation = Math.floor(
    village.population.total * (urgencyLevel / 10)
  );

  // Determine required response type
  const requiredResponse: 'immediate' | 'urgent' | 'planned' =
    urgencyLevel >= 4 ? 'immediate' : urgencyLevel >= 3 ? 'urgent' : 'planned';

  return {
    event,
    urgencyLevel,
    timeRemaining: event.timeLimit,
    affectedPopulation,
    requiredResponse,
  };
}

function determineCrisisType(event: GameEvent): keyof typeof CRISIS_TYPES {
  // Map event types to crisis types
  switch (event.type) {
    case 'natural':
      return 'natural_disaster';
    case 'military':
      return 'military_attack';
    case 'social':
      return 'social_unrest';
    case 'economic':
      return 'resource_shortage';
    default:
      return 'natural_disaster';
  }
}
