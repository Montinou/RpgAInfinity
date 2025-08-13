/**
 * NarrativePanel Component - Story Display and Choice Interface
 *
 * Provides immersive storytelling with:
 * - Rich narrative text with AI-generated content
 * - Interactive dialogue trees
 * - Consequence-based choice system
 * - Character skill-based options
 * - Atmospheric presentation
 * - Branching storylines
 * - Location-based storytelling
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RPGGameState,
  Location,
  NPC,
  Character,
  NarrativeChoice,
  DialogueChoice,
  UUID,
} from '@/types/rpg';

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

interface NarrativePanelProps {
  gameState: RPGGameState;
  currentLocation: Location | null;
  onChoice: (choiceId: string, choiceData?: any) => void;
  onLocationChange: (locationId: UUID) => void;
  className?: string;
}

interface NarrativeContent {
  id: string;
  type: 'story' | 'dialogue' | 'discovery' | 'event' | 'description';
  title?: string;
  content: string;
  speaker?: string;
  mood:
    | 'epic'
    | 'dark'
    | 'humorous'
    | 'mysterious'
    | 'tense'
    | 'peaceful'
    | 'neutral';
  choices: NarrativeChoice[];
  timestamp: number;
  location?: UUID;
  character?: UUID;
}

interface ChoiceButtonProps {
  choice: NarrativeChoice;
  onSelect: () => void;
  isDisabled: boolean;
  disabilityReason?: string;
}

interface PresentationMode {
  showChoices: boolean;
  autoScroll: boolean;
  typewriterEffect: boolean;
  showSpeaker: boolean;
  backgroundDim: boolean;
}

// ============================================================================
// MAIN NARRATIVE PANEL COMPONENT
// ============================================================================

export default function NarrativePanel({
  gameState,
  currentLocation,
  onChoice,
  onLocationChange,
  className = '',
}: NarrativePanelProps) {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [narrativeHistory, setNarrativeHistory] = useState<NarrativeContent[]>(
    []
  );
  const [currentNarrative, setCurrentNarrative] =
    useState<NarrativeContent | null>(null);
  const [presentationMode, setPresentationMode] = useState<PresentationMode>({
    showChoices: true,
    autoScroll: true,
    typewriterEffect: false,
    showSpeaker: true,
    backgroundDim: false,
  });

  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [isProcessingChoice, setIsProcessingChoice] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const [textIndex, setTextIndex] = useState(0);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const locationNPCs = useMemo(() => {
    if (!currentLocation) return [];

    return gameState.data.world.npcs.filter(npc =>
      currentLocation.npcs.includes(npc.id)
    );
  }, [currentLocation, gameState.data.world.npcs]);

  const playerCharacters = useMemo(() => {
    return (
      gameState.players
        ?.filter(player => player.gameSpecificData?.character)
        .map(player => player.gameSpecificData!.character) || []
    );
  }, [gameState.players]);

  const locationFeatures = useMemo(() => {
    return currentLocation?.features || [];
  }, [currentLocation]);

  // Generate current narrative content based on game state
  const generatedNarrative = useMemo(() => {
    if (!currentLocation) return null;

    // TODO: This should integrate with AI narrative generation
    // For now, we'll create basic narrative content
    const narrative: NarrativeContent = {
      id: `narrative_${currentLocation.id}_${Date.now()}`,
      type: 'description',
      title: currentLocation.name,
      content: generateLocationNarrative(currentLocation, gameState),
      mood: determineMood(currentLocation, gameState),
      choices: generateNarrativeChoices(
        currentLocation,
        gameState,
        locationNPCs,
        playerCharacters
      ),
      timestamp: Date.now(),
      location: currentLocation.id,
    };

    return narrative;
  }, [currentLocation, gameState, locationNPCs, playerCharacters]);

  // ============================================================================
  // TYPEWRITER EFFECT
  // ============================================================================

  useEffect(() => {
    if (!generatedNarrative || !presentationMode.typewriterEffect) {
      setDisplayedText(generatedNarrative?.content || '');
      return;
    }

    const text = generatedNarrative.content;
    setDisplayedText('');
    setTextIndex(0);

    const interval = setInterval(() => {
      setTextIndex(prev => {
        if (prev >= text.length) {
          clearInterval(interval);
          return prev;
        }
        setDisplayedText(text.substring(0, prev + 1));
        return prev + 1;
      });
    }, 30); // Typing speed

    return () => clearInterval(interval);
  }, [generatedNarrative, presentationMode.typewriterEffect]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleChoiceSelect = useCallback(
    async (choice: NarrativeChoice) => {
      if (isProcessingChoice) return;

      setSelectedChoiceId(choice.id);
      setIsProcessingChoice(true);

      try {
        // Add choice to history
        const choiceNarrative: NarrativeContent = {
          id: `choice_${choice.id}_${Date.now()}`,
          type: 'event',
          content: `> ${choice.text}`,
          mood: 'neutral',
          choices: [],
          timestamp: Date.now(),
        };

        setNarrativeHistory(prev => [...prev, choiceNarrative]);

        // Process the choice
        await onChoice(choice.id, {
          skillRequirement: choice.skillRequirement,
          consequences: choice.consequences,
        });
      } catch (error) {
        console.error('Failed to process choice:', error);
      } finally {
        setIsProcessingChoice(false);
        setSelectedChoiceId(null);
      }
    },
    [isProcessingChoice, onChoice]
  );

  const handleLocationAction = useCallback(
    async (action: string, targetId?: UUID) => {
      if (action === 'move' && targetId) {
        await onLocationChange(targetId);
      } else if (action === 'examine' && targetId) {
        // TODO: Handle examination of features/NPCs
        console.log('Examining:', targetId);
      }
    },
    [onLocationChange]
  );

  const togglePresentationMode = useCallback((key: keyof PresentationMode) => {
    setPresentationMode(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  // ============================================================================
  // UPDATE EFFECTS
  // ============================================================================

  useEffect(() => {
    if (generatedNarrative && generatedNarrative.id !== currentNarrative?.id) {
      setCurrentNarrative(generatedNarrative);

      // Add to history if it's a new narrative
      if (
        narrativeHistory.length === 0 ||
        narrativeHistory[narrativeHistory.length - 1].id !==
          generatedNarrative.id
      ) {
        setNarrativeHistory(prev => [...prev, generatedNarrative].slice(-10)); // Keep last 10 entries
      }
    }
  }, [generatedNarrative, currentNarrative, narrativeHistory.length]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const getMoodColor = (mood: string) => {
    switch (mood) {
      case 'epic':
        return 'from-yellow-900/40 to-orange-900/40';
      case 'dark':
        return 'from-gray-900/40 to-black/40';
      case 'humorous':
        return 'from-green-900/40 to-emerald-900/40';
      case 'mysterious':
        return 'from-purple-900/40 to-indigo-900/40';
      case 'tense':
        return 'from-red-900/40 to-pink-900/40';
      case 'peaceful':
        return 'from-blue-900/40 to-cyan-900/40';
      default:
        return 'from-slate-900/40 to-gray-900/40';
    }
  };

  const getMoodIcon = (mood: string) => {
    switch (mood) {
      case 'epic':
        return '⚡';
      case 'dark':
        return '🌑';
      case 'humorous':
        return '😄';
      case 'mysterious':
        return '🔮';
      case 'tense':
        return '⚠️';
      case 'peaceful':
        return '🕊️';
      default:
        return '📖';
    }
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div
      className={`relative flex h-full flex-col bg-gradient-to-br ${
        currentNarrative
          ? getMoodColor(currentNarrative.mood)
          : 'from-slate-900/40 to-gray-900/40'
      } ${className}`}
    >
      {/* Presentation Controls */}
      <div className='absolute right-2 top-2 z-20 flex space-x-1'>
        <button
          onClick={() => togglePresentationMode('typewriterEffect')}
          className={`rounded p-1 text-xs transition-colors ${
            presentationMode.typewriterEffect
              ? 'bg-purple-600 text-white'
              : 'bg-white/10 text-purple-200 hover:bg-white/20'
          }`}
          title='Toggle typewriter effect'
        >
          ✏️
        </button>
        <button
          onClick={() => togglePresentationMode('backgroundDim')}
          className={`rounded p-1 text-xs transition-colors ${
            presentationMode.backgroundDim
              ? 'bg-purple-600 text-white'
              : 'bg-white/10 text-purple-200 hover:bg-white/20'
          }`}
          title='Toggle background dim'
        >
          🔅
        </button>
      </div>

      {/* Main Narrative Content */}
      <div className='flex-1 overflow-y-auto p-6'>
        <AnimatePresence>
          {currentNarrative && (
            <motion.div
              key={currentNarrative.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6 }}
              className='space-y-4'
            >
              {/* Narrative Header */}
              <div className='mb-4 flex items-center space-x-3'>
                <div className='text-2xl'>
                  {getMoodIcon(currentNarrative.mood)}
                </div>
                <div>
                  {currentNarrative.title && (
                    <h2 className='mb-1 text-xl font-bold text-white'>
                      {currentNarrative.title}
                    </h2>
                  )}
                  <div className='flex items-center space-x-2 text-sm text-purple-300'>
                    <span className='capitalize'>{currentNarrative.type}</span>
                    <span>•</span>
                    <span className='capitalize'>{currentNarrative.mood}</span>
                  </div>
                </div>
              </div>

              {/* Speaker Info */}
              {presentationMode.showSpeaker && currentNarrative.speaker && (
                <div className='mb-3 flex items-center space-x-2'>
                  <div className='flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-sm font-bold text-white'>
                    {currentNarrative.speaker.charAt(0)}
                  </div>
                  <span className='font-medium text-purple-200'>
                    {currentNarrative.speaker}
                  </span>
                </div>
              )}

              {/* Narrative Text */}
              <div className='prose prose-invert max-w-none'>
                <p className='text-lg leading-relaxed text-white'>
                  {presentationMode.typewriterEffect
                    ? displayedText
                    : currentNarrative.content}
                  {presentationMode.typewriterEffect &&
                    textIndex < currentNarrative.content.length && (
                      <span className='animate-pulse'>|</span>
                    )}
                </p>
              </div>

              {/* Location Details */}
              {currentLocation && (
                <div className='mt-6 rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-sm'>
                  <h3 className='mb-2 font-medium text-white'>
                    Current Environment
                  </h3>
                  <div className='grid grid-cols-1 gap-4 text-sm md:grid-cols-3'>
                    {/* NPCs Present */}
                    {locationNPCs.length > 0 && (
                      <div>
                        <h4 className='mb-1 font-medium text-purple-300'>
                          Characters Present
                        </h4>
                        <div className='space-y-1'>
                          {locationNPCs.slice(0, 3).map(npc => (
                            <button
                              key={npc.id}
                              onClick={() =>
                                handleLocationAction('examine', npc.id)
                              }
                              className='block text-purple-200 transition-colors hover:text-white'
                            >
                              {npc.name}
                            </button>
                          ))}
                          {locationNPCs.length > 3 && (
                            <div className='text-purple-400'>
                              +{locationNPCs.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Location Features */}
                    {locationFeatures.length > 0 && (
                      <div>
                        <h4 className='mb-1 font-medium text-blue-300'>
                          Points of Interest
                        </h4>
                        <div className='space-y-1'>
                          {locationFeatures.slice(0, 3).map(feature => (
                            <button
                              key={feature.id}
                              onClick={() =>
                                handleLocationAction('examine', feature.id)
                              }
                              className='block text-blue-200 transition-colors hover:text-white'
                            >
                              {feature.name}
                            </button>
                          ))}
                          {locationFeatures.length > 3 && (
                            <div className='text-blue-400'>
                              +{locationFeatures.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Exits */}
                    {currentLocation.connections.length > 0 && (
                      <div>
                        <h4 className='mb-1 font-medium text-green-300'>
                          Available Paths
                        </h4>
                        <div className='space-y-1'>
                          {currentLocation.connections
                            .slice(0, 3)
                            .map(connectionId => {
                              const connectedLocation =
                                gameState.data.world.locations.find(
                                  l => l.id === connectionId
                                );
                              return connectedLocation ? (
                                <button
                                  key={connectionId}
                                  onClick={() =>
                                    handleLocationAction('move', connectionId)
                                  }
                                  className='block text-green-200 transition-colors hover:text-white'
                                >
                                  To {connectedLocation.name}
                                </button>
                              ) : null;
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Choice Interface */}
      {presentationMode.showChoices && currentNarrative?.choices.length > 0 && (
        <div className='border-t border-white/10 bg-black/20 p-4 backdrop-blur-sm'>
          <h3 className='mb-3 flex items-center space-x-2 font-medium text-white'>
            <span>Choose your action:</span>
            {isProcessingChoice && (
              <div className='h-4 w-4 animate-spin rounded-full border-2 border-purple-500 border-t-transparent'></div>
            )}
          </h3>

          <div className='space-y-2'>
            <AnimatePresence>
              {currentNarrative.choices.map((choice, index) => (
                <ChoiceButton
                  key={choice.id}
                  choice={choice}
                  onSelect={() => handleChoiceSelect(choice)}
                  isDisabled={
                    isProcessingChoice || selectedChoiceId === choice.id
                  }
                  disabilityReason={getChoiceDisabilityReason(
                    choice,
                    playerCharacters
                  )}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Processing Overlay */}
      <AnimatePresence>
        {isProcessingChoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='absolute inset-0 z-30 flex items-center justify-center bg-black/30 backdrop-blur-sm'
          >
            <div className='flex items-center space-x-3 rounded-lg bg-black/60 p-4'>
              <div className='h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent'></div>
              <span className='text-white'>Processing your choice...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// CHOICE BUTTON COMPONENT
// ============================================================================

const ChoiceButton: React.FC<ChoiceButtonProps> = ({
  choice,
  onSelect,
  isDisabled,
  disabilityReason,
}) => {
  const skillRequirement = choice.skillRequirement;

  return (
    <motion.button
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      onClick={onSelect}
      disabled={isDisabled}
      className={`
        group w-full rounded-lg border p-3 text-left transition-all duration-200
        ${
          isDisabled
            ? 'cursor-not-allowed border-gray-600 bg-gray-700/50 text-gray-400'
            : 'cursor-pointer border-white/20 bg-white/5 text-white hover:border-purple-400 hover:bg-white/10'
        }
      `}
      title={disabilityReason}
    >
      <div className='flex items-start justify-between'>
        <div className='flex-1'>
          <p className='font-medium'>{choice.text}</p>

          {/* Skill Requirement */}
          {skillRequirement && (
            <div className='mt-1 text-xs text-purple-300'>
              Requires {skillRequirement.skill} ({skillRequirement.difficulty})
            </div>
          )}

          {/* Consequences Preview */}
          {choice.consequences.length > 0 && (
            <div className='mt-1 text-xs text-gray-400'>
              {choice.consequences[0]}
              {choice.consequences.length > 1 && ' ...'}
            </div>
          )}
        </div>

        {/* Choice Type Indicator */}
        <div className='ml-3 text-sm opacity-60 transition-opacity group-hover:opacity-100'>
          {skillRequirement ? '🎯' : '💭'}
        </div>
      </div>
    </motion.button>
  );
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateLocationNarrative(
  location: Location,
  gameState: RPGGameState
): string {
  // TODO: Integrate with AI narrative generation
  // This is a placeholder that creates basic narrative content

  const templates = [
    `You find yourself in ${location.name}. ${location.description}`,
    `As you enter ${location.name}, you notice ${location.description}`,
    `${location.name} stretches before you. ${location.description}`,
    `The area known as ${location.name} unfolds around you. ${location.description}`,
  ];

  const timeOfDay = gameState.data.timeOfDay;
  const timeDesc =
    timeOfDay < 6
      ? 'in the early morning darkness'
      : timeOfDay < 12
        ? 'in the bright morning light'
        : timeOfDay < 18
          ? 'under the afternoon sun'
          : 'in the gathering twilight';

  const weather = gameState.data.weather;
  const weatherDesc =
    weather.type !== 'clear'
      ? ` The ${weather.type} creates a ${weather.intensity} atmosphere around you.`
      : '';

  const template = templates[Math.floor(Math.random() * templates.length)];
  return `${template} You are here ${timeDesc}.${weatherDesc}`;
}

function determineMood(
  location: Location,
  gameState: RPGGameState
):
  | 'epic'
  | 'dark'
  | 'humorous'
  | 'mysterious'
  | 'tense'
  | 'peaceful'
  | 'neutral' {
  // TODO: Implement intelligent mood detection based on:
  // - Location type and features
  // - Recent events
  // - Party status
  // - Weather conditions
  // - Time of day

  const locationMoods: Record<string, string> = {
    dungeon: 'dark',
    cave: 'mysterious',
    temple: 'peaceful',
    ruins: 'mysterious',
    castle: 'epic',
    tavern: 'humorous',
    forest: 'peaceful',
    town: 'neutral',
  };

  return (locationMoods[location.type] || 'neutral') as any;
}

function generateNarrativeChoices(
  location: Location,
  gameState: RPGGameState,
  npcs: NPC[],
  characters: Character[]
): NarrativeChoice[] {
  const choices: NarrativeChoice[] = [];

  // Basic exploration choices
  if (location.features.length > 0) {
    choices.push({
      id: 'explore_features',
      text: 'Examine the interesting features of this area',
      consequences: ['You might discover something useful or encounter danger'],
    });
  }

  // NPC interaction choices
  if (npcs.length > 0) {
    choices.push({
      id: 'talk_to_npcs',
      text: `Approach the ${npcs[0].name} and start a conversation`,
      consequences: ['Social interaction might lead to information or quests'],
    });
  }

  // Movement choices
  if (location.connections.length > 0) {
    const connectedLocation = gameState.data.world.locations.find(
      l => l.id === location.connections[0]
    );
    if (connectedLocation) {
      choices.push({
        id: `move_to_${connectedLocation.id}`,
        text: `Travel to ${connectedLocation.name}`,
        consequences: [
          'Moving to a new location will take time and may involve encounters',
        ],
      });
    }
  }

  // Skill-based choices
  if (characters.length > 0) {
    const character = characters[0];

    if (character.skills.investigation > 5) {
      choices.push({
        id: 'investigate',
        text: 'Use your investigative skills to search for hidden details',
        consequences: ['Your keen eye might reveal secrets others would miss'],
        skillRequirement: {
          skill: 'investigation',
          difficulty: 8,
        },
      });
    }

    if (character.skills.magic > 3) {
      choices.push({
        id: 'detect_magic',
        text: 'Cast a spell to detect magical auras in the area',
        consequences: ['Magic might reveal hidden enchantments or dangers'],
        skillRequirement: {
          skill: 'magic',
          difficulty: 6,
        },
      });
    }
  }

  return choices;
}

function getChoiceDisabilityReason(
  choice: NarrativeChoice,
  characters: Character[]
): string | undefined {
  if (!choice.skillRequirement) return undefined;

  const requirement = choice.skillRequirement;
  const character = characters[0]; // TODO: Handle multiple characters

  if (!character) return 'No character available';

  const skillValue = character.skills[requirement.skill];
  if (skillValue < requirement.difficulty) {
    return `Requires ${requirement.skill} ${requirement.difficulty} (you have ${skillValue})`;
  }

  return undefined;
}
