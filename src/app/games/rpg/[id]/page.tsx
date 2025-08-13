/**
 * RPG Game Page - Main interface for RPG game sessions
 *
 * This page provides the complete RPG game experience with:
 * - World exploration and map navigation
 * - Character management and progression
 * - Narrative presentation with choices
 * - Turn-based combat interface
 * - Inventory and equipment management
 * - Quest tracking and completion
 * - Multi-player party coordination
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RPGGameState,
  Character,
  Inventory,
  Quest,
  CombatSession,
  Location,
  NPC,
  UUID,
} from '@/types/rpg';

// Component imports
import GameBoard from '@/components/game/rpg/GameBoard';
import CharacterSheet from '@/components/game/rpg/CharacterSheet';
import NarrativePanel from '@/components/game/rpg/NarrativePanel';
import CombatInterface from '@/components/game/rpg/CombatInterface';
import InventoryPanel from '@/components/game/rpg/InventoryPanel';
import QuestTracker from '@/components/game/rpg/QuestTracker';
import PartyManager from '@/components/game/rpg/PartyManager';

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

interface GameViewState {
  activePanel:
    | 'world'
    | 'character'
    | 'inventory'
    | 'quests'
    | 'party'
    | 'combat';
  selectedCharacter: UUID | null;
  selectedLocation: UUID | null;
  selectedQuest: UUID | null;
  showSidePanels: boolean;
  isFullscreen: boolean;
}

interface LoadingState {
  isLoading: boolean;
  loadingStep: string;
  progress: number;
}

// ============================================================================
// MAIN RPG GAME PAGE COMPONENT
// ============================================================================

export default function RPGGamePage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.id as UUID;

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [gameState, setGameState] = useState<RPGGameState | null>(null);
  const [viewState, setViewState] = useState<GameViewState>({
    activePanel: 'world',
    selectedCharacter: null,
    selectedLocation: null,
    selectedQuest: null,
    showSidePanels: true,
    isFullscreen: false,
  });
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: true,
    loadingStep: 'Connecting to game...',
    progress: 0,
  });
  const [error, setError] = useState<string>('');
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const currentLocation = useMemo(() => {
    if (!gameState?.data.world.locations || !gameState.data.currentLocation)
      return null;
    return (
      gameState.data.world.locations.find(
        loc => loc.id === gameState.data.currentLocation
      ) || null
    );
  }, [gameState]);

  const playerCharacters = useMemo(() => {
    if (!gameState?.players) return [];
    return gameState.players
      .filter(player => player.gameSpecificData?.character)
      .map(player => player.gameSpecificData!.character);
  }, [gameState]);

  const activeQuests = useMemo(() => {
    if (!gameState?.players) return [];
    const allQuests = gameState.players.flatMap(
      player => player.gameSpecificData?.questLog || []
    );
    return allQuests.filter(quest => quest.status === 'active');
  }, [gameState]);

  const currentCombat = useMemo(() => {
    return gameState?.data.activeCombat || null;
  }, [gameState]);

  // ============================================================================
  // API FUNCTIONS
  // ============================================================================

  const loadGameState = useCallback(async () => {
    try {
      setLoadingState(prev => ({
        ...prev,
        loadingStep: 'Loading game state...',
        progress: 20,
      }));

      const response = await fetch(`/api/game/rpg/${gameId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Failed to load game (${response.status})`
        );
      }

      const data = await response.json();
      setGameState(data.state);
      setLastUpdate(Date.now());

      setLoadingState(prev => ({
        ...prev,
        loadingStep: 'Game loaded!',
        progress: 100,
      }));

      // Clear loading after a brief delay
      setTimeout(() => {
        setLoadingState(prev => ({ ...prev, isLoading: false }));
      }, 500);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load game';
      setError(message);
      setLoadingState(prev => ({ ...prev, isLoading: false }));
    }
  }, [gameId]);

  const performGameAction = useCallback(
    async (actionType: string, actionData: any) => {
      try {
        const response = await fetch(`/api/game/rpg/${gameId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: actionType,
            data: actionData,
            timestamp: Date.now(),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to perform action');
        }

        const result = await response.json();

        // Update game state with new data
        if (result.newState) {
          setGameState(result.newState);
          setLastUpdate(Date.now());
        }

        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Action failed';
        setError(message);
        throw error;
      }
    },
    [gameId]
  );

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handlePanelChange = useCallback(
    (panel: GameViewState['activePanel']) => {
      setViewState(prev => ({ ...prev, activePanel: panel }));
    },
    []
  );

  const handleLocationSelect = useCallback(
    async (locationId: UUID) => {
      try {
        await performGameAction('move', { locationId });
        setViewState(prev => ({ ...prev, selectedLocation: locationId }));
      } catch (error) {
        // Error already handled in performGameAction
      }
    },
    [performGameAction]
  );

  const handleCharacterSelect = useCallback((characterId: UUID) => {
    setViewState(prev => ({ ...prev, selectedCharacter: characterId }));
  }, []);

  const handleQuestSelect = useCallback((questId: UUID) => {
    setViewState(prev => ({
      ...prev,
      selectedQuest: questId,
      activePanel: 'quests',
    }));
  }, []);

  const handleNarrativeChoice = useCallback(
    async (choiceId: string, choiceData?: any) => {
      try {
        await performGameAction('narrative_choice', {
          choiceId,
          data: choiceData,
        });
      } catch (error) {
        // Error already handled in performGameAction
      }
    },
    [performGameAction]
  );

  const handleCombatAction = useCallback(
    async (actionType: string, actionData: any) => {
      try {
        await performGameAction('combat_action', { actionType, ...actionData });
      } catch (error) {
        // Error already handled in performGameAction
      }
    },
    [performGameAction]
  );

  const toggleSidePanels = useCallback(() => {
    setViewState(prev => ({ ...prev, showSidePanels: !prev.showSidePanels }));
  }, []);

  const toggleFullscreen = useCallback(() => {
    setViewState(prev => ({ ...prev, isFullscreen: !prev.isFullscreen }));
  }, []);

  // ============================================================================
  // LIFECYCLE EFFECTS
  // ============================================================================

  useEffect(() => {
    if (gameId) {
      loadGameState();
    }
  }, [gameId, loadGameState]);

  // Auto-refresh game state every 30 seconds
  useEffect(() => {
    if (!gameState || loadingState.isLoading) return;

    const interval = setInterval(() => {
      loadGameState();
    }, 30000);

    return () => clearInterval(interval);
  }, [gameState, loadingState.isLoading, loadGameState]);

  // ============================================================================
  // LOADING STATE RENDER
  // ============================================================================

  if (loadingState.isLoading) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900'>
        <div className='mx-4 w-full max-w-md rounded-lg bg-black/20 p-8 backdrop-blur-sm'>
          <div className='mb-6 text-center'>
            <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-blue-500'>
              <div className='h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white'></div>
            </div>
            <h2 className='mb-2 text-xl font-bold text-white'>
              Loading RPG Adventure
            </h2>
            <p className='text-purple-200'>{loadingState.loadingStep}</p>
          </div>

          <div className='mb-4 h-2 w-full rounded-full bg-white/10'>
            <motion.div
              className='h-2 rounded-full bg-gradient-to-r from-purple-500 to-blue-500'
              animate={{ width: `${loadingState.progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <div className='text-center text-sm text-purple-300'>
            {loadingState.progress}% Complete
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // ERROR STATE RENDER
  // ============================================================================

  if (error && !gameState) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-gradient-to-br from-red-900 via-purple-900 to-indigo-900'>
        <div className='mx-4 w-full max-w-md rounded-lg bg-black/20 p-8 backdrop-blur-sm'>
          <div className='text-center'>
            <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20'>
              <svg
                className='h-8 w-8 text-red-400'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z'
                />
              </svg>
            </div>
            <h2 className='mb-2 text-xl font-bold text-white'>
              Game Loading Failed
            </h2>
            <p className='mb-6 text-red-200'>{error}</p>
            <div className='space-y-3'>
              <button
                onClick={() => {
                  setError('');
                  setLoadingState({
                    isLoading: true,
                    loadingStep: 'Retrying...',
                    progress: 0,
                  });
                  loadGameState();
                }}
                className='w-full rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700'
              >
                Try Again
              </button>
              <button
                onClick={() => router.push('/games')}
                className='w-full rounded-lg bg-white/10 px-4 py-2 font-medium text-white transition-colors hover:bg-white/20'
              >
                Back to Games
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return null;
  }

  // ============================================================================
  // MAIN GAME INTERFACE RENDER
  // ============================================================================

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 ${
        viewState.isFullscreen ? 'fixed inset-0 z-50' : ''
      }`}
    >
      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className='fixed right-4 top-4 z-50 max-w-sm rounded-lg bg-red-500/90 px-4 py-3 text-white shadow-lg backdrop-blur-sm'
          >
            <div className='flex items-center justify-between'>
              <div className='flex items-center space-x-2'>
                <svg
                  className='h-5 w-5 text-red-200'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                  />
                </svg>
                <span className='text-sm'>{error}</span>
              </div>
              <button
                onClick={() => setError('')}
                className='text-red-200 hover:text-white'
              >
                <svg
                  className='h-4 w-4'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Header */}
      <div className='border-b border-white/10 bg-black/20 px-4 py-3 backdrop-blur-sm'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center space-x-4'>
            <h1 className='text-xl font-bold text-white'>
              {gameState.data.world.name}
            </h1>
            <div className='flex items-center space-x-2 text-sm text-purple-200'>
              <span>Phase: {gameState.phase}</span>
              <span>•</span>
              <span>Day {gameState.data.dayCount}</span>
              <span>•</span>
              <span>{gameState.data.timeOfDay}:00</span>
            </div>
          </div>

          <div className='flex items-center space-x-2'>
            {/* Panel Toggle Buttons */}
            <div className='flex rounded-lg bg-white/10 p-1'>
              {[
                { id: 'world', icon: '🗺️', label: 'World' },
                { id: 'character', icon: '👤', label: 'Character' },
                { id: 'inventory', icon: '🎒', label: 'Inventory' },
                { id: 'quests', icon: '📜', label: 'Quests' },
                { id: 'party', icon: '👥', label: 'Party' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() =>
                    handlePanelChange(tab.id as GameViewState['activePanel'])
                  }
                  className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                    viewState.activePanel === tab.id
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-purple-200 hover:bg-white/10 hover:text-white'
                  }`}
                  title={tab.label}
                >
                  <span className='mr-1'>{tab.icon}</span>
                  <span className='hidden sm:inline'>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* View Controls */}
            <div className='flex items-center space-x-1'>
              <button
                onClick={toggleSidePanels}
                className='rounded-lg p-2 text-purple-200 transition-colors hover:bg-white/10 hover:text-white'
                title={viewState.showSidePanels ? 'Hide Panels' : 'Show Panels'}
              >
                <svg
                  className='h-5 w-5'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d={
                      viewState.showSidePanels
                        ? 'M9 5l7 7-7 7'
                        : 'M15 19l-7-7 7-7'
                    }
                  />
                </svg>
              </button>

              <button
                onClick={toggleFullscreen}
                className='rounded-lg p-2 text-purple-200 transition-colors hover:bg-white/10 hover:text-white'
                title={
                  viewState.isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'
                }
              >
                <svg
                  className='h-5 w-5'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d={
                      viewState.isFullscreen
                        ? 'M9 9l6 6m0-6l-6 6m6-6v6a2 2 0 01-2 2H9'
                        : 'M4 8V4a2 2 0 012-2h4M4 16v4a2 2 0 002 2h4m8-16h4a2 2 0 012 2v4m-4 12h4a2 2 0 002-2v-4'
                    }
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Game Content */}
      <div className='flex h-[calc(100vh-80px)]'>
        {/* Primary Content Area */}
        <div
          className={`relative flex-1 ${viewState.showSidePanels ? 'mr-80' : ''} transition-all duration-300`}
        >
          {/* Combat Mode - Takes Priority */}
          {currentCombat && (
            <div className='absolute inset-0 z-20 bg-black/50 backdrop-blur-sm'>
              <CombatInterface
                session={currentCombat}
                playerCharacters={playerCharacters}
                onCombatAction={handleCombatAction}
                onExitCombat={() =>
                  setViewState(prev => ({ ...prev, activePanel: 'world' }))
                }
              />
            </div>
          )}

          {/* World Exploration View */}
          {viewState.activePanel === 'world' && (
            <div className='flex h-full flex-col'>
              {/* Narrative Panel - Top Section */}
              <div className='h-1/3 border-b border-white/10'>
                <NarrativePanel
                  gameState={gameState}
                  currentLocation={currentLocation}
                  onChoice={handleNarrativeChoice}
                  onLocationChange={handleLocationSelect}
                />
              </div>

              {/* Game Board - Bottom Section */}
              <div className='flex-1'>
                <GameBoard
                  gameState={gameState}
                  currentLocation={currentLocation}
                  onLocationSelect={handleLocationSelect}
                  onCharacterSelect={handleCharacterSelect}
                />
              </div>
            </div>
          )}

          {/* Character Management View */}
          {viewState.activePanel === 'character' &&
            viewState.selectedCharacter && (
              <div className='h-full overflow-auto p-6'>
                <CharacterSheet
                  character={
                    playerCharacters.find(
                      c => c.id === viewState.selectedCharacter
                    )!
                  }
                  inventory={
                    gameState.players.find(
                      p =>
                        p.gameSpecificData?.character.id ===
                        viewState.selectedCharacter
                    )?.gameSpecificData?.inventory || {
                      capacity: 0,
                      items: [],
                      equipment: { accessories: [] },
                      currency: 0,
                    }
                  }
                  equipment={
                    gameState.players.find(
                      p =>
                        p.gameSpecificData?.character.id ===
                        viewState.selectedCharacter
                    )?.gameSpecificData?.inventory.equipment || {
                      accessories: [],
                    }
                  }
                  skillProgression={{
                    availablePoints: 0,
                    totalPointsSpent: 0,
                    learnedSkills: new Map(),
                  }}
                  playerId={
                    gameState.players.find(
                      p =>
                        p.gameSpecificData?.character.id ===
                        viewState.selectedCharacter
                    )?.id || ''
                  }
                  isEditable={true}
                />
              </div>
            )}

          {/* Other Views */}
          {viewState.activePanel === 'inventory' && (
            <div className='h-full'>
              <InventoryPanel
                gameState={gameState}
                playerCharacters={playerCharacters}
                onItemAction={async (action, itemId, data) => {
                  await performGameAction('item_action', {
                    action,
                    itemId,
                    ...data,
                  });
                }}
              />
            </div>
          )}

          {viewState.activePanel === 'quests' && (
            <div className='h-full'>
              <QuestTracker
                quests={activeQuests}
                selectedQuestId={viewState.selectedQuest}
                onQuestSelect={handleQuestSelect}
                onQuestAction={async (action, questId, data) => {
                  await performGameAction('quest_action', {
                    action,
                    questId,
                    ...data,
                  });
                }}
              />
            </div>
          )}

          {viewState.activePanel === 'party' && (
            <div className='h-full'>
              <PartyManager
                gameState={gameState}
                playerCharacters={playerCharacters}
                onPartyAction={async (action, data) => {
                  await performGameAction('party_action', { action, ...data });
                }}
              />
            </div>
          )}
        </div>

        {/* Side Panels */}
        <AnimatePresence>
          {viewState.showSidePanels && (
            <motion.div
              initial={{ x: 320 }}
              animate={{ x: 0 }}
              exit={{ x: 320 }}
              transition={{ duration: 0.3 }}
              className='fixed bottom-0 right-0 top-[80px] w-80 overflow-hidden border-l border-white/10 bg-black/20 backdrop-blur-sm'
            >
              <div className='flex h-full flex-col'>
                {/* Quick Status Panel */}
                <div className='border-b border-white/10 p-4'>
                  <h3 className='mb-3 text-lg font-semibold text-white'>
                    Quick Status
                  </h3>
                  <div className='space-y-2 text-sm'>
                    <div className='flex justify-between text-purple-200'>
                      <span>Location:</span>
                      <span className='text-white'>
                        {currentLocation?.name || 'Unknown'}
                      </span>
                    </div>
                    <div className='flex justify-between text-purple-200'>
                      <span>Active Quests:</span>
                      <span className='text-white'>{activeQuests.length}</span>
                    </div>
                    <div className='flex justify-between text-purple-200'>
                      <span>Party Members:</span>
                      <span className='text-white'>
                        {playerCharacters.length}
                      </span>
                    </div>
                    {currentCombat && (
                      <div className='flex justify-between text-red-300'>
                        <span>Combat:</span>
                        <span className='font-semibold text-red-400'>
                          ACTIVE
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dynamic Content Based on Active Panel */}
                <div className='flex-1 overflow-auto'>
                  {/* TODO: Add contextual side panel content based on active panel */}
                  <div className='p-4'>
                    <div className='text-sm text-purple-300'>
                      Side panel content for {viewState.activePanel} view
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Last Updated Indicator */}
      <div className='fixed bottom-4 left-4 rounded bg-black/20 px-2 py-1 text-xs text-purple-300 backdrop-blur-sm'>
        Last updated: {new Date(lastUpdate).toLocaleTimeString()}
      </div>
    </div>
  );
}
