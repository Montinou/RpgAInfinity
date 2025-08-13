'use client';

/**
 * RoleCard Component for RpgAInfinity Deduction Game
 *
 * Displays player's secret role information with secure visibility controls:
 * - Role identity and alignment (hidden from other players)
 * - Available abilities with usage tracking
 * - Win conditions and objectives
 * - Secret information and teammate identification
 * - Role-specific action buttons
 */

import { useState, useCallback, useMemo } from 'react';
import {
  AssignedRole,
  ScenarioData,
  RoleAbility,
  ActiveAbility,
  RoleAlignment,
  UUID,
} from '../../../types/deduction';

// ============================================================================
// COMPONENT TYPES & INTERFACES
// ============================================================================

export interface RoleCardProps {
  readonly role: AssignedRole;
  readonly scenario?: ScenarioData;
  readonly canRevealInfo?: boolean;
  readonly onActionUse?: (action: RoleActionData) => void;
  readonly className?: string;
}

interface RoleActionData {
  type: 'use_ability' | 'reveal_info' | 'contact_team';
  abilityName?: string;
  targetId?: UUID;
  message?: string;
}

interface RoleCardState {
  isExpanded: boolean;
  selectedAbility: ActiveAbility | null;
  showTeammates: boolean;
  revealedSecrets: Set<string>;
  isUsingAbility: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function RoleCard({
  role,
  scenario,
  canRevealInfo = false,
  onActionUse,
  className = '',
}: RoleCardProps) {
  // State management
  const [cardState, setCardState] = useState<RoleCardState>({
    isExpanded: false,
    selectedAbility: null,
    showTeammates: false,
    revealedSecrets: new Set(),
    isUsingAbility: false,
  });

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const alignmentColor = useMemo(() => {
    const colors: Record<RoleAlignment, string> = {
      town: 'blue',
      mafia: 'red',
      neutral: 'yellow',
      survivor: 'green',
    };
    return colors[role.definition.alignment];
  }, [role.definition.alignment]);

  const alignmentIcon = useMemo(() => {
    const icons: Record<RoleAlignment, string> = {
      town: '🏛️',
      mafia: '🎭',
      neutral: '⚖️',
      survivor: '🛡️',
    };
    return icons[role.definition.alignment];
  }, [role.definition.alignment]);

  const availableAbilities = useMemo(() => {
    return role.abilities.filter(
      ability => ability.remainingUses > 0 && !ability.isBlocked
    );
  }, [role.abilities]);

  const hasTeammates = useMemo(() => {
    return role.teammates && role.teammates.length > 0;
  }, [role.teammates]);

  const completedObjectives = useMemo(() => {
    return role.objectives.filter(obj => obj.isCompleted);
  }, [role.objectives]);

  const pendingObjectives = useMemo(() => {
    return role.objectives.filter(obj => !obj.isCompleted);
  }, [role.objectives]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleAbilitySelect = useCallback((ability: ActiveAbility) => {
    setCardState(prev => ({
      ...prev,
      selectedAbility: ability,
      isExpanded: true,
    }));
  }, []);

  const handleAbilityUse = useCallback(
    (ability: ActiveAbility, targetId?: UUID) => {
      if (!onActionUse) return;

      setCardState(prev => ({ ...prev, isUsingAbility: true }));

      onActionUse({
        type: 'use_ability',
        abilityName: ability.ability.name,
        targetId,
      });

      // Reset state after action
      setTimeout(() => {
        setCardState(prev => ({
          ...prev,
          isUsingAbility: false,
          selectedAbility: null,
        }));
      }, 1000);
    },
    [onActionUse]
  );

  const handleSecretReveal = useCallback(
    (secretIndex: number) => {
      if (!canRevealInfo) return;

      setCardState(prev => ({
        ...prev,
        revealedSecrets: new Set([
          ...prev.revealedSecrets,
          secretIndex.toString(),
        ]),
      }));

      onActionUse?.({
        type: 'reveal_info',
        message: role.secretInfo[secretIndex],
      });
    },
    [canRevealInfo, role.secretInfo, onActionUse]
  );

  const handleTeammateContact = useCallback(() => {
    if (!hasTeammates) return;

    setCardState(prev => ({ ...prev, showTeammates: !prev.showTeammates }));

    onActionUse?.({
      type: 'contact_team',
    });
  }, [hasTeammates, onActionUse]);

  const toggleExpanded = useCallback(() => {
    setCardState(prev => ({ ...prev, isExpanded: !prev.isExpanded }));
  }, []);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderRoleHeader = () => (
    <div
      className={`rounded-t-lg border-l-4 p-4 border-${alignmentColor}-500 bg-gradient-to-r from-${alignmentColor}-50 to-transparent`}
    >
      <div className='flex items-center justify-between'>
        <div className='flex items-center space-x-3'>
          <span
            className='text-2xl'
            role='img'
            aria-label={role.definition.alignment}
          >
            {alignmentIcon}
          </span>
          <div>
            <h3 className='text-lg font-semibold text-gray-900'>
              {role.definition.name}
            </h3>
            <p
              className={`text-sm font-medium text-${alignmentColor}-700 capitalize`}
            >
              {role.definition.alignment} • {role.definition.type}
            </p>
          </div>
        </div>

        <button
          onClick={toggleExpanded}
          className={`rounded-full p-2 hover:bg-${alignmentColor}-100 transition-colors`}
          aria-label={
            cardState.isExpanded
              ? 'Collapse role details'
              : 'Expand role details'
          }
          //TODO: Add keyboard accessibility for expand/collapse
        >
          <svg
            className={`h-5 w-5 text-${alignmentColor}-600 transition-transform ${
              cardState.isExpanded ? 'rotate-180' : ''
            }`}
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M19 9l-7 7-7-7'
            />
          </svg>
        </button>
      </div>

      <div className='mt-2'>
        <p className='text-sm text-gray-700'>{role.definition.description}</p>
        {role.definition.flavorText && (
          <p className='mt-1 text-xs italic text-gray-600'>
            "{role.definition.flavorText}"
          </p>
        )}
      </div>
    </div>
  );

  const renderWinCondition = () => (
    <div className='border-b border-gray-200 bg-gray-50 p-3'>
      <h4 className='mb-1 text-sm font-semibold text-gray-900'>
        Win Condition:
      </h4>
      <p className='text-sm text-gray-700'>{role.definition.winCondition}</p>
    </div>
  );

  const renderObjectives = () => {
    if (role.objectives.length === 0) return null;

    return (
      <div className='border-b border-gray-200 p-3'>
        <h4 className='mb-2 text-sm font-semibold text-gray-900'>
          Objectives:
        </h4>
        <div className='space-y-2'>
          {pendingObjectives.map(objective => (
            <div key={objective.id} className='flex items-start space-x-2'>
              <div className='mt-0.5 h-4 w-4 rounded border border-gray-300 bg-white'></div>
              <div className='flex-1 text-sm'>
                <p className='text-gray-700'>{objective.description}</p>
                <span className='text-xs text-gray-500'>
                  Points: {objective.points}
                </span>
              </div>
            </div>
          ))}
          {completedObjectives.map(objective => (
            <div
              key={objective.id}
              className='flex items-start space-x-2 opacity-75'
            >
              <div className='mt-0.5 flex h-4 w-4 items-center justify-center rounded bg-green-500'>
                <svg
                  className='h-2 w-2 text-white'
                  fill='currentColor'
                  viewBox='0 0 20 20'
                >
                  <path
                    fillRule='evenodd'
                    d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                    clipRule='evenodd'
                  />
                </svg>
              </div>
              <div className='flex-1 text-sm'>
                <p className='text-gray-600 line-through'>
                  {objective.description}
                </p>
                <span className='text-xs text-green-600'>
                  Completed • {objective.points} points
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderAbilities = () => {
    if (role.abilities.length === 0) return null;

    return (
      <div className='border-b border-gray-200 p-3'>
        <h4 className='mb-2 text-sm font-semibold text-gray-900'>Abilities:</h4>
        <div className='space-y-2'>
          {role.abilities.map(activeAbility => {
            const ability = activeAbility.ability;
            const isAvailable =
              activeAbility.remainingUses > 0 && !activeAbility.isBlocked;
            const isSelected =
              cardState.selectedAbility?.ability.name === ability.name;

            return (
              <div
                key={ability.name}
                className={`rounded-lg border p-3 transition-all ${
                  isSelected
                    ? `border-${alignmentColor}-300 bg-${alignmentColor}-50`
                    : isAvailable
                      ? 'border-gray-200 bg-white hover:border-gray-300'
                      : 'border-gray-200 bg-gray-50 opacity-60'
                }`}
              >
                <div className='flex items-center justify-between'>
                  <div className='flex-1'>
                    <h5 className='text-sm font-medium text-gray-900'>
                      {ability.name}
                      {ability.type === 'passive' && (
                        <span className='ml-2 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600'>
                          Passive
                        </span>
                      )}
                    </h5>
                    <p className='mt-1 text-xs text-gray-600'>
                      {ability.description}
                    </p>
                    <div className='mt-2 flex items-center space-x-4 text-xs text-gray-500'>
                      <span>
                        Usage: {ability.usageLimit.type}
                        {activeAbility.remainingUses < Infinity &&
                          ` (${activeAbility.remainingUses} left)`}
                      </span>
                      <span>Timing: {ability.timing}</span>
                      <span>Target: {ability.target.replace('_', ' ')}</span>
                    </div>
                  </div>

                  {isAvailable && ability.type !== 'passive' && (
                    <button
                      onClick={() => handleAbilitySelect(activeAbility)}
                      disabled={cardState.isUsingAbility}
                      className={`ml-3 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                        cardState.isUsingAbility
                          ? 'cursor-not-allowed bg-gray-200 text-gray-500'
                          : `bg-${alignmentColor}-600 text-white hover:bg-${alignmentColor}-700 focus:outline-none focus:ring-2 focus:ring-${alignmentColor}-500`
                      }`}
                      //TODO: Add ability usage confirmation dialog
                    >
                      {cardState.isUsingAbility ? 'Using...' : 'Use'}
                    </button>
                  )}
                </div>

                {activeAbility.isBlocked && (
                  <div className='mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800'>
                    ⚠️ This ability is currently blocked
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSecretInformation = () => {
    if (!role.secretInfo || role.secretInfo.length === 0) return null;

    return (
      <div className='border-b border-gray-200 p-3'>
        <h4 className='mb-2 text-sm font-semibold text-gray-900'>
          Secret Information:
        </h4>
        <div className='space-y-2'>
          {role.secretInfo.map((secret, index) => {
            const isRevealed = cardState.revealedSecrets.has(index.toString());

            return (
              <div
                key={index}
                className={`rounded border p-2 ${
                  isRevealed
                    ? 'border-green-200 bg-green-50'
                    : 'border-yellow-200 bg-yellow-50'
                }`}
              >
                <div className='flex items-start justify-between'>
                  <p className='flex-1 text-sm text-gray-800'>
                    {isRevealed ? (
                      <>
                        <span className='font-medium text-green-600'>
                          Revealed:
                        </span>{' '}
                        {secret}
                      </>
                    ) : (
                      <>
                        <span className='font-medium text-yellow-600'>
                          Hidden:
                        </span>{' '}
                        <span className='select-none blur-sm'>{secret}</span>
                      </>
                    )}
                  </p>
                  {!isRevealed && canRevealInfo && (
                    <button
                      onClick={() => handleSecretReveal(index)}
                      className='ml-2 rounded bg-yellow-600 px-2 py-1 text-xs text-white hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500'
                      //TODO: Add confirmation dialog for secret revelation
                    >
                      Reveal
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTeammates = () => {
    if (!hasTeammates) return null;

    return (
      <div className='p-3'>
        <div className='mb-2 flex items-center justify-between'>
          <h4 className='text-sm font-semibold text-gray-900'>Teammates:</h4>
          <button
            onClick={handleTeammateContact}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              cardState.showTeammates
                ? `bg-${alignmentColor}-600 text-white`
                : `text-${alignmentColor}-600 hover:bg-${alignmentColor}-50 border border-${alignmentColor}-300`
            }`}
            //TODO: Add team chat functionality
          >
            {cardState.showTeammates ? 'Hide' : 'Contact'}
          </button>
        </div>

        {cardState.showTeammates && (
          <div className='space-y-1'>
            {role.teammates?.map(teammateId => (
              <div
                key={teammateId}
                className={`rounded p-2 bg-${alignmentColor}-50 border border-${alignmentColor}-200`}
              >
                <p className='text-sm text-gray-800'>
                  Player ID: {teammateId}
                  {/* TODO: Replace with actual player name from game state */}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white shadow-sm ${className}`}
    >
      {renderRoleHeader()}

      {cardState.isExpanded && (
        <div>
          {renderWinCondition()}
          {renderObjectives()}
          {renderAbilities()}
          {renderSecretInformation()}
          {renderTeammates()}
        </div>
      )}

      {/* Quick Actions Bar */}
      {!cardState.isExpanded && availableAbilities.length > 0 && (
        <div className='rounded-b-lg border-t border-gray-200 bg-gray-50 p-2'>
          <div className='flex items-center space-x-2'>
            <span className='text-xs text-gray-600'>Quick Actions:</span>
            {availableAbilities.slice(0, 2).map(activeAbility => (
              <button
                key={activeAbility.ability.name}
                onClick={() => handleAbilitySelect(activeAbility)}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors bg-${alignmentColor}-600 text-white hover:bg-${alignmentColor}-700 focus:outline-none focus:ring-2 focus:ring-${alignmentColor}-500`}
              >
                {activeAbility.ability.name}
              </button>
            ))}
            {availableAbilities.length > 2 && (
              <span className='text-xs text-gray-500'>
                +{availableAbilities.length - 2} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
