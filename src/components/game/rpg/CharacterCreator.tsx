'use client';

/**
 * RPG Character Creator Component
 *
 * Comprehensive character creation wizard interface for RpgAInfinity RPG module.
 * Provides step-by-step character creation with stat allocation, skill selection,
 * background choice, and visual customization with real-time validation.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Character,
  CharacterStats,
  CharacterSkills,
  CharacterRace,
  CharacterClass,
  CharacterBackground,
  CharacterTrait,
} from '@/types/rpg';
import { UUID, GameError, ErrorCode } from '@/types/core';
import { characterManager, CharacterData } from '@/lib/games/rpg/character';

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

interface CharacterCreatorProps {
  readonly playerId: UUID;
  readonly onComplete: (character: Character) => void;
  readonly onCancel?: () => void;
  readonly initialData?: Partial<CharacterData>;
}

interface CreationStep {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly isComplete: boolean;
  readonly canProceed: boolean;
}

interface CreationState {
  readonly currentStep: number;
  readonly characterData: Partial<CharacterData>;
  readonly errors: string[];
  readonly warnings: string[];
  readonly isCreating: boolean;
}

// ============================================================================
// SAMPLE DATA (In real implementation, this would come from game data)
// ============================================================================

const SAMPLE_RACES: CharacterRace[] = [
  {
    name: 'Human',
    description: 'Versatile and adaptable, humans excel in all areas.',
    statModifiers: { strength: 1, dexterity: 1, intelligence: 1, charisma: 1 },
    abilities: [
      {
        name: 'Adaptable',
        description: 'Gain +1 skill point per level',
        type: 'passive',
        effects: { skillPoints: 1 },
      },
    ],
    restrictions: [],
  },
  {
    name: 'Elf',
    description: 'Graceful and wise, elves have natural magical affinity.',
    statModifiers: { dexterity: 2, intelligence: 2, wisdom: 1, strength: -1 },
    abilities: [
      {
        name: 'Keen Senses',
        description: 'Enhanced perception and investigation abilities',
        type: 'passive',
        effects: { investigation: 5 },
      },
    ],
    restrictions: ['No Heavy Armor'],
  },
  {
    name: 'Dwarf',
    description: 'Hardy and resilient, dwarves are master craftsmen.',
    statModifiers: {
      strength: 2,
      constitution: 3,
      dexterity: -1,
      charisma: -1,
    },
    abilities: [
      {
        name: 'Master Craftsman',
        description: 'Bonus to crafting and related skills',
        type: 'passive',
        effects: { crafting: 10 },
      },
    ],
    restrictions: [],
  },
];

const SAMPLE_CLASSES: CharacterClass[] = [
  {
    name: 'Warrior',
    description: 'Master of weapons and combat tactics.',
    primaryStat: 'strength',
    skillAffinities: ['combat', 'survival'],
    abilities: [
      {
        name: 'Weapon Mastery',
        description: 'Proficiency with all weapon types',
        levelRequired: 1,
        type: 'passive',
        effects: { combat: 5 },
      },
    ],
    equipment: ['Sword', 'Shield', 'Leather Armor'],
  },
  {
    name: 'Mage',
    description: 'Wielder of arcane magic and ancient knowledge.',
    primaryStat: 'intelligence',
    skillAffinities: ['magic', 'lore'],
    abilities: [
      {
        name: 'Arcane Focus',
        description: 'Enhanced spellcasting ability',
        levelRequired: 1,
        type: 'passive',
        effects: { magic: 5 },
      },
    ],
    equipment: ['Staff', 'Robes', 'Spellbook'],
  },
  {
    name: 'Rogue',
    description: 'Master of stealth, cunning, and precision.',
    primaryStat: 'dexterity',
    skillAffinities: ['stealth', 'investigation'],
    abilities: [
      {
        name: 'Sneak Attack',
        description: 'Deal extra damage from stealth',
        levelRequired: 1,
        type: 'active',
        effects: { stealth: 5 },
      },
    ],
    equipment: ['Dagger', 'Lockpicks', 'Dark Cloak'],
  },
];

const SAMPLE_BACKGROUNDS: CharacterBackground[] = [
  {
    name: 'Noble',
    description: 'Born into wealth and privilege with court connections.',
    skillBonuses: { diplomacy: 10, lore: 5 },
    startingEquipment: ['Fine Clothes', 'Signet Ring', '50 Gold'],
    connections: ['Royal Court', 'Merchant Guilds'],
  },
  {
    name: 'Soldier',
    description: 'Trained military veteran with combat experience.',
    skillBonuses: { combat: 10, survival: 5 },
    startingEquipment: ['Military Pack', 'Weapon Kit', 'Rations'],
    connections: ['Military Officers', 'Veterans'],
  },
  {
    name: 'Scholar',
    description: 'Learned academic with extensive knowledge.',
    skillBonuses: { lore: 10, investigation: 5, magic: 3 },
    startingEquipment: ['Books', 'Research Tools', 'Scholar Robes'],
    connections: ['Libraries', 'Academic Circles'],
  },
];

// ============================================================================
// CHARACTER CREATOR COMPONENT
// ============================================================================

export default function CharacterCreator({
  playerId,
  onComplete,
  onCancel,
  initialData,
}: CharacterCreatorProps) {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [state, setState] = useState<CreationState>({
    currentStep: 0,
    characterData: {
      name: initialData?.name || '',
      stats: initialData?.stats || {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
        luck: 10,
      },
      race: initialData?.race || undefined,
      class: initialData?.class || undefined,
      background: initialData?.background || undefined,
      traits: initialData?.traits || [],
    },
    errors: [],
    warnings: [],
    isCreating: false,
  });

  // ============================================================================
  // CREATION STEPS CONFIGURATION
  // ============================================================================

  const steps: CreationStep[] = [
    {
      id: 'basic',
      title: 'Basic Information',
      description: 'Choose your character name and appearance',
      isComplete: Boolean(
        state.characterData.name && state.characterData.name.length >= 2
      ),
      canProceed: Boolean(
        state.characterData.name && state.characterData.name.length >= 2
      ),
    },
    {
      id: 'race',
      title: 'Race Selection',
      description: 'Select your character race and racial abilities',
      isComplete: Boolean(state.characterData.race),
      canProceed: Boolean(state.characterData.race),
    },
    {
      id: 'class',
      title: 'Class Selection',
      description: 'Choose your character class and starting abilities',
      isComplete: Boolean(state.characterData.class),
      canProceed: Boolean(state.characterData.class),
    },
    {
      id: 'background',
      title: 'Background',
      description: 'Select your character background and history',
      isComplete: Boolean(state.characterData.background),
      canProceed: Boolean(state.characterData.background),
    },
    {
      id: 'stats',
      title: 'Attribute Allocation',
      description: 'Distribute your attribute points',
      isComplete: true, // Stats always have default values
      canProceed: true,
    },
    {
      id: 'review',
      title: 'Review & Create',
      description: 'Review your character and finalize creation',
      isComplete: false,
      canProceed: steps.slice(0, 4).every(step => step.isComplete),
    },
  ];

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const updateCharacterData = useCallback((updates: Partial<CharacterData>) => {
    setState(prev => ({
      ...prev,
      characterData: { ...prev.characterData, ...updates },
      errors: [],
    }));
  }, []);

  const validateCurrentStep = useCallback((): boolean => {
    const errors: string[] = [];
    const currentStepData = steps[state.currentStep];

    switch (currentStepData.id) {
      case 'basic':
        if (!state.characterData.name || state.characterData.name.length < 2) {
          errors.push('Character name must be at least 2 characters long');
        }
        if (state.characterData.name && state.characterData.name.length > 50) {
          errors.push('Character name must be less than 50 characters');
        }
        break;

      case 'race':
        if (!state.characterData.race) {
          errors.push('Please select a race');
        }
        break;

      case 'class':
        if (!state.characterData.class) {
          errors.push('Please select a class');
        }
        break;

      case 'background':
        if (!state.characterData.background) {
          errors.push('Please select a background');
        }
        break;

      case 'stats':
        if (state.characterData.stats) {
          const totalStats = Object.values(state.characterData.stats).reduce(
            (sum, val) => sum + val,
            0
          );
          if (totalStats > 84) {
            // 7 stats * 12 average = reasonable limit
            errors.push('Total attribute points exceed maximum allowed');
          }
        }
        break;
    }

    setState(prev => ({ ...prev, errors }));
    return errors.length === 0;
  }, [state.currentStep, state.characterData]);

  const handleNextStep = useCallback(() => {
    if (validateCurrentStep() && state.currentStep < steps.length - 1) {
      setState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
    }
  }, [validateCurrentStep, state.currentStep, steps.length]);

  const handlePreviousStep = useCallback(() => {
    if (state.currentStep > 0) {
      setState(prev => ({ ...prev, currentStep: prev.currentStep - 1 }));
    }
  }, [state.currentStep]);

  const handleCreateCharacter = useCallback(async () => {
    if (!validateCurrentStep()) return;

    setState(prev => ({ ...prev, isCreating: true }));

    try {
      // Validate all required data is present
      if (
        !state.characterData.name ||
        !state.characterData.race ||
        !state.characterData.class ||
        !state.characterData.background ||
        !state.characterData.stats
      ) {
        throw new GameError(
          'Missing required character data',
          ErrorCode.VALIDATION_FAILED
        );
      }

      // Create the character
      const character = await characterManager.createCharacter(playerId, {
        name: state.characterData.name,
        race: state.characterData.race,
        class: state.characterData.class,
        background: state.characterData.background,
        stats: state.characterData.stats,
        traits: state.characterData.traits,
      });

      // Call completion handler
      onComplete(character);
    } catch (error) {
      const errorMessage =
        error instanceof GameError
          ? error.message
          : 'An unexpected error occurred during character creation';

      setState(prev => ({
        ...prev,
        errors: [errorMessage],
        isCreating: false,
      }));
    }
  }, [playerId, state.characterData, validateCurrentStep, onComplete]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderBasicInfoStep = () => (
    <div className='space-y-6'>
      <div>
        <label
          htmlFor='characterName'
          className='mb-2 block text-sm font-medium text-gray-700'
        >
          Character Name
        </label>
        <input
          id='characterName'
          type='text'
          value={state.characterData.name || ''}
          onChange={e => updateCharacterData({ name: e.target.value })}
          className='w-full rounded-md border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500'
          placeholder="Enter your character's name"
          maxLength={50}
        />
        <p className='mt-1 text-sm text-gray-500'>
          Choose a memorable name for your character (2-50 characters)
        </p>
      </div>

      {/* TODO: Add visual customization options when avatar system is implemented */}
      <div className='rounded-md bg-gray-50 p-4'>
        <h4 className='mb-2 font-medium text-gray-700'>Visual Customization</h4>
        <p className='text-sm text-gray-500'>
          Avatar customization will be available in a future update.
        </p>
      </div>
    </div>
  );

  const renderRaceSelection = () => (
    <div className='space-y-4'>
      <h3 className='mb-4 text-lg font-medium'>Choose Your Race</h3>
      {SAMPLE_RACES.map(race => (
        <div
          key={race.name}
          className={`cursor-pointer rounded-lg border p-4 transition-colors ${
            state.characterData.race?.name === race.name
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onClick={() => updateCharacterData({ race })}
        >
          <div className='mb-2 flex items-start justify-between'>
            <h4 className='text-lg font-medium'>{race.name}</h4>
            {state.characterData.race?.name === race.name && (
              <div className='flex h-5 w-5 items-center justify-center rounded-full bg-blue-500'>
                <svg
                  className='h-3 w-3 text-white'
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
            )}
          </div>
          <p className='mb-3 text-gray-600'>{race.description}</p>

          {/* Stat Modifiers */}
          <div className='mb-3'>
            <h5 className='mb-1 text-sm font-medium text-gray-700'>
              Stat Modifiers:
            </h5>
            <div className='flex flex-wrap gap-2'>
              {Object.entries(race.statModifiers).map(([stat, modifier]) => (
                <span
                  key={stat}
                  className={`rounded px-2 py-1 text-xs ${
                    modifier > 0
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {stat.charAt(0).toUpperCase() + stat.slice(1)}{' '}
                  {modifier > 0 ? '+' : ''}
                  {modifier}
                </span>
              ))}
            </div>
          </div>

          {/* Racial Abilities */}
          <div>
            <h5 className='mb-1 text-sm font-medium text-gray-700'>
              Racial Abilities:
            </h5>
            {race.abilities.map((ability, index) => (
              <p key={index} className='text-sm text-gray-600'>
                <span className='font-medium'>{ability.name}:</span>{' '}
                {ability.description}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderClassSelection = () => (
    <div className='space-y-4'>
      <h3 className='mb-4 text-lg font-medium'>Choose Your Class</h3>
      {SAMPLE_CLASSES.map(characterClass => (
        <div
          key={characterClass.name}
          className={`cursor-pointer rounded-lg border p-4 transition-colors ${
            state.characterData.class?.name === characterClass.name
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onClick={() => updateCharacterData({ class: characterClass })}
        >
          <div className='mb-2 flex items-start justify-between'>
            <h4 className='text-lg font-medium'>{characterClass.name}</h4>
            {state.characterData.class?.name === characterClass.name && (
              <div className='flex h-5 w-5 items-center justify-center rounded-full bg-blue-500'>
                <svg
                  className='h-3 w-3 text-white'
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
            )}
          </div>
          <p className='mb-3 text-gray-600'>{characterClass.description}</p>

          <div className='grid grid-cols-1 gap-4 text-sm md:grid-cols-2'>
            <div>
              <span className='font-medium text-gray-700'>Primary Stat:</span>
              <span className='ml-2 capitalize'>
                {characterClass.primaryStat}
              </span>
            </div>
            <div>
              <span className='font-medium text-gray-700'>
                Skill Affinities:
              </span>
              <span className='ml-2'>
                {characterClass.skillAffinities.join(', ')}
              </span>
            </div>
          </div>

          <div className='mt-3'>
            <span className='text-sm font-medium text-gray-700'>
              Starting Equipment:
            </span>
            <span className='ml-2 text-sm text-gray-600'>
              {characterClass.equipment.join(', ')}
            </span>
          </div>
        </div>
      ))}
    </div>
  );

  const renderBackgroundSelection = () => (
    <div className='space-y-4'>
      <h3 className='mb-4 text-lg font-medium'>Choose Your Background</h3>
      {SAMPLE_BACKGROUNDS.map(background => (
        <div
          key={background.name}
          className={`cursor-pointer rounded-lg border p-4 transition-colors ${
            state.characterData.background?.name === background.name
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onClick={() => updateCharacterData({ background })}
        >
          <div className='mb-2 flex items-start justify-between'>
            <h4 className='text-lg font-medium'>{background.name}</h4>
            {state.characterData.background?.name === background.name && (
              <div className='flex h-5 w-5 items-center justify-center rounded-full bg-blue-500'>
                <svg
                  className='h-3 w-3 text-white'
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
            )}
          </div>
          <p className='mb-3 text-gray-600'>{background.description}</p>

          {/* Skill Bonuses */}
          <div className='mb-3'>
            <h5 className='mb-1 text-sm font-medium text-gray-700'>
              Skill Bonuses:
            </h5>
            <div className='flex flex-wrap gap-2'>
              {Object.entries(background.skillBonuses).map(([skill, bonus]) => (
                <span
                  key={skill}
                  className='rounded bg-blue-100 px-2 py-1 text-xs text-blue-800'
                >
                  {skill.charAt(0).toUpperCase() + skill.slice(1)} +{bonus}
                </span>
              ))}
            </div>
          </div>

          <div className='grid grid-cols-1 gap-4 text-sm md:grid-cols-2'>
            <div>
              <span className='font-medium text-gray-700'>
                Starting Equipment:
              </span>
              <span className='ml-2 text-gray-600'>
                {background.startingEquipment.join(', ')}
              </span>
            </div>
            <div>
              <span className='font-medium text-gray-700'>Connections:</span>
              <span className='ml-2 text-gray-600'>
                {background.connections.join(', ')}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderStatAllocation = () => {
    const stats = state.characterData.stats!;
    const totalStats = Object.values(stats).reduce((sum, val) => sum + val, 0);
    const maxTotal = 84; // Reasonable limit for total stats

    const updateStat = (stat: keyof CharacterStats, value: number) => {
      const newValue = Math.max(1, Math.min(20, value)); // Clamp between 1-20
      updateCharacterData({
        stats: { ...stats, [stat]: newValue },
      });
    };

    return (
      <div className='space-y-6'>
        <div>
          <h3 className='mb-2 text-lg font-medium'>Attribute Allocation</h3>
          <p className='mb-4 text-gray-600'>
            Distribute your attribute points. Total: {totalStats}/{maxTotal}
          </p>
        </div>

        <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
          {Object.entries(stats).map(([stat, value]) => (
            <div key={stat} className='space-y-2'>
              <label className='block text-sm font-medium capitalize text-gray-700'>
                {stat}
              </label>
              <div className='flex items-center space-x-3'>
                <button
                  onClick={() =>
                    updateStat(stat as keyof CharacterStats, value - 1)
                  }
                  disabled={value <= 1}
                  className='flex h-8 w-8 items-center justify-center rounded border border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'
                >
                  -
                </button>
                <div className='w-16 text-center'>
                  <input
                    type='number'
                    min='1'
                    max='20'
                    value={value}
                    onChange={e =>
                      updateStat(
                        stat as keyof CharacterStats,
                        parseInt(e.target.value) || 1
                      )
                    }
                    className='w-full rounded border border-gray-300 px-2 py-1 text-center'
                  />
                </div>
                <button
                  onClick={() =>
                    updateStat(stat as keyof CharacterStats, value + 1)
                  }
                  disabled={value >= 20 || totalStats >= maxTotal}
                  className='flex h-8 w-8 items-center justify-center rounded border border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'
                >
                  +
                </button>
                <span className='w-8 text-sm text-gray-500'>
                  {value >= 10
                    ? `+${Math.floor((value - 10) / 2)}`
                    : `${Math.floor((value - 10) / 2)}`}
                </span>
              </div>
            </div>
          ))}
        </div>

        {totalStats > maxTotal && (
          <div className='rounded border border-red-200 bg-red-50 p-3'>
            <p className='text-sm text-red-700'>
              Total attribute points exceed maximum. Please reduce some
              attributes.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderReviewStep = () => (
    <div className='space-y-6'>
      <h3 className='mb-4 text-lg font-medium'>Review Your Character</h3>

      <div className='space-y-4 rounded-lg bg-gray-50 p-6'>
        <div>
          <h4 className='font-medium text-gray-700'>Name</h4>
          <p className='text-lg'>{state.characterData.name}</p>
        </div>

        <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
          <div>
            <h4 className='font-medium text-gray-700'>Race</h4>
            <p>{state.characterData.race?.name}</p>
          </div>
          <div>
            <h4 className='font-medium text-gray-700'>Class</h4>
            <p>{state.characterData.class?.name}</p>
          </div>
          <div>
            <h4 className='font-medium text-gray-700'>Background</h4>
            <p>{state.characterData.background?.name}</p>
          </div>
        </div>

        <div>
          <h4 className='mb-2 font-medium text-gray-700'>Attributes</h4>
          <div className='grid grid-cols-2 gap-2 text-sm md:grid-cols-4'>
            {Object.entries(state.characterData.stats!).map(([stat, value]) => (
              <div key={stat} className='flex justify-between'>
                <span className='capitalize'>{stat}:</span>
                <span className='font-medium'>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* TODO: Add trait selection when trait system is expanded */}
        <div>
          <h4 className='font-medium text-gray-700'>Traits</h4>
          <p className='text-sm text-gray-500'>
            {state.characterData.traits && state.characterData.traits.length > 0
              ? state.characterData.traits.map(t => t.name).join(', ')
              : 'No special traits selected'}
          </p>
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // RENDER STEP CONTENT
  // ============================================================================

  const renderCurrentStep = () => {
    const currentStepData = steps[state.currentStep];

    switch (currentStepData.id) {
      case 'basic':
        return renderBasicInfoStep();
      case 'race':
        return renderRaceSelection();
      case 'class':
        return renderClassSelection();
      case 'background':
        return renderBackgroundSelection();
      case 'stats':
        return renderStatAllocation();
      case 'review':
        return renderReviewStep();
      default:
        return <div>Unknown step</div>;
    }
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className='mx-auto max-w-4xl p-6'>
      {/* Header */}
      <div className='mb-8'>
        <h1 className='mb-2 text-3xl font-bold text-gray-900'>
          Create Your Character
        </h1>
        <p className='text-gray-600'>
          Design your unique RPG character with our step-by-step creation
          wizard.
        </p>
      </div>

      {/* Progress Steps */}
      <div className='mb-8'>
        <div className='flex items-center justify-between'>
          {steps.map((step, index) => (
            <div key={step.id} className='flex items-center'>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium ${
                  index <= state.currentStep
                    ? 'bg-blue-600 text-white'
                    : step.isComplete
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-300 text-gray-500'
                }`}
              >
                {step.isComplete && index !== state.currentStep ? (
                  <svg
                    className='h-5 w-5'
                    fill='currentColor'
                    viewBox='0 0 20 20'
                  >
                    <path
                      fillRule='evenodd'
                      d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                      clipRule='evenodd'
                    />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`mx-2 h-1 w-12 ${
                    index < state.currentStep ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className='mt-4'>
          <h2 className='text-xl font-semibold text-gray-900'>
            {steps[state.currentStep].title}
          </h2>
          <p className='mt-1 text-gray-600'>
            {steps[state.currentStep].description}
          </p>
        </div>
      </div>

      {/* Error Display */}
      {state.errors.length > 0 && (
        <div className='mb-6 rounded-lg border border-red-200 bg-red-50 p-4'>
          <div className='flex'>
            <div className='flex-shrink-0'>
              <svg
                className='h-5 w-5 text-red-400'
                viewBox='0 0 20 20'
                fill='currentColor'
              >
                <path
                  fillRule='evenodd'
                  d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                  clipRule='evenodd'
                />
              </svg>
            </div>
            <div className='ml-3'>
              <h3 className='text-sm font-medium text-red-800'>
                Please correct the following errors:
              </h3>
              <ul className='mt-2 text-sm text-red-700'>
                {state.errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className='mb-8'>{renderCurrentStep()}</div>

      {/* Navigation Buttons */}
      <div className='flex justify-between'>
        <div>
          {state.currentStep > 0 && (
            <button
              onClick={handlePreviousStep}
              disabled={state.isCreating}
              className='rounded-md border border-gray-300 px-6 py-2 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'
            >
              Previous
            </button>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={state.isCreating}
              className='ml-3 rounded-md border border-gray-300 px-6 py-2 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'
            >
              Cancel
            </button>
          )}
        </div>

        <div>
          {state.currentStep < steps.length - 1 ? (
            <button
              onClick={handleNextStep}
              disabled={
                !steps[state.currentStep].canProceed || state.isCreating
              }
              className='rounded-md bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleCreateCharacter}
              disabled={
                state.isCreating || !steps[state.currentStep].canProceed
              }
              className='rounded-md bg-green-600 px-8 py-2 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50'
            >
              {state.isCreating ? 'Creating...' : 'Create Character'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
