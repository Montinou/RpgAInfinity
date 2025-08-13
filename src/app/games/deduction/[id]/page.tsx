'use client';

/**
 * Deduction Game Interface - Main Game Page
 *
 * Social deduction game interface featuring:
 * - Real-time player status and voting
 * - Role-based information management
 * - Phase-driven gameplay with timers
 * - Secure communication systems
 * - Progressive clue revelation
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  DeductionPlayer,
  DeductionGameState,
  DeductionPhase,
  ClueCard,
  Communication,
  UUID,
} from '../../../../types/deduction';
import { EventSystem } from '../../../../lib/game-engine/events';

// Component imports
import { RoleCard } from '../../../../components/game/deduction/RoleCard';
import { PlayerGrid } from '../../../../components/game/deduction/PlayerGrid';
import { PhaseIndicator } from '../../../../components/game/deduction/PhaseIndicator';
import { VotingInterface } from '../../../../components/game/deduction/VotingInterface';
import { ClueTracker } from '../../../../components/game/deduction/ClueTracker';
import { ChatSystem } from '../../../../components/game/deduction/ChatSystem';
import { GameTimer } from '../../../../components/game/deduction/GameTimer';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface GameError {
  message: string;
  code?: string;
  timestamp: number;
}

interface GameNotification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  timestamp: number;
  autoHide?: boolean;
}

interface DeductionGamePageState {
  gameState: DeductionGameState | null;
  currentPlayer: DeductionPlayer | null;
  isLoading: boolean;
  error: GameError | null;
  notifications: GameNotification[];
  isReconnecting: boolean;
  lastUpdate: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DeductionGamePage() {
  const params = useParams();
  const gameId = params.id as UUID;

  // State management
  const [pageState, setPageState] = useState<DeductionGamePageState>({
    gameState: null,
    currentPlayer: null,
    isLoading: true,
    error: null,
    notifications: [],
    isReconnecting: false,
    lastUpdate: Date.now(),
  });

  // ============================================================================
  // GAME STATE MANAGEMENT
  // ============================================================================

  const fetchGameState = useCallback(async () => {
    try {
      const response = await fetch(`/api/game/deduction/${gameId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch game: ${response.status}`);
      }

      const gameData = await response.json();
      const currentUserId = getCurrentUserId(); // TODO: Get from auth context
      const currentPlayer = gameData.players?.find(
        (p: DeductionPlayer) => p.id === currentUserId
      );

      setPageState(prev => ({
        ...prev,
        gameState: gameData,
        currentPlayer,
        isLoading: false,
        error: null,
        lastUpdate: Date.now(),
      }));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      setPageState(prev => ({
        ...prev,
        error: { message: errorMessage, timestamp: Date.now() },
        isLoading: false,
      }));
    }
  }, [gameId]);

  const subscribeToGameEvents = useCallback(() => {
    const eventSystem = EventSystem.getInstance();

    const handleGameUpdate = (event: any) => {
      if (event.gameId === gameId) {
        setPageState(prev => ({
          ...prev,
          gameState: event.gameState,
          lastUpdate: Date.now(),
        }));
      }
    };

    const handlePlayerUpdate = (event: any) => {
      if (event.gameId === gameId) {
        // Update current player data
        const currentUserId = getCurrentUserId();
        const updatedPlayer = event.players?.find(
          (p: DeductionPlayer) => p.id === currentUserId
        );

        setPageState(prev => ({
          ...prev,
          currentPlayer: updatedPlayer || prev.currentPlayer,
          lastUpdate: Date.now(),
        }));
      }
    };

    const handlePhaseChange = (event: any) => {
      if (event.gameId === gameId) {
        addNotification({
          type: 'info',
          title: 'Phase Change',
          message: `Entering ${event.newPhase.replace('_', ' ')} phase`,
          autoHide: true,
        });
      }
    };

    // Subscribe to events
    const unsubscribeGameUpdate = eventSystem.subscribe(
      'game_updated',
      handleGameUpdate
    );
    const unsubscribePlayerUpdate = eventSystem.subscribe(
      'player_updated',
      handlePlayerUpdate
    );
    const unsubscribePhaseChange = eventSystem.subscribe(
      'phase_changed',
      handlePhaseChange
    );

    return () => {
      unsubscribeGameUpdate();
      unsubscribePlayerUpdate();
      unsubscribePhaseChange();
    };
  }, [gameId]);

  // ============================================================================
  // EFFECT HOOKS
  // ============================================================================

  useEffect(() => {
    fetchGameState();
    const unsubscribeEvents = subscribeToGameEvents();

    // Set up periodic state refresh
    const refreshInterval = setInterval(fetchGameState, 30000); // 30 second refresh

    return () => {
      unsubscribeEvents();
      clearInterval(refreshInterval);
    };
  }, [fetchGameState, subscribeToGameEvents]);

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const getCurrentUserId = (): UUID => {
    // TODO: Get from auth context or session
    return 'current-user-id' as UUID;
  };

  const addNotification = (
    notification: Omit<GameNotification, 'id' | 'timestamp'>
  ) => {
    const newNotification: GameNotification = {
      id: `notification-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      ...notification,
    };

    setPageState(prev => ({
      ...prev,
      notifications: [...prev.notifications, newNotification],
    }));

    // Auto-hide notifications after 5 seconds
    if (notification.autoHide !== false) {
      setTimeout(() => {
        dismissNotification(newNotification.id);
      }, 5000);
    }
  };

  const dismissNotification = (notificationId: string) => {
    setPageState(prev => ({
      ...prev,
      notifications: prev.notifications.filter(n => n.id !== notificationId),
    }));
  };

  const handleGameAction = async (action: any) => {
    try {
      const response = await fetch(`/api/game/deduction/${gameId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      });

      if (!response.ok) {
        throw new Error(`Action failed: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        addNotification({
          type: 'success',
          title: 'Action Complete',
          message: result.message || 'Action completed successfully',
          autoHide: true,
        });

        // Refresh game state
        fetchGameState();
      } else {
        throw new Error(result.error || 'Action failed');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      addNotification({
        type: 'error',
        title: 'Action Failed',
        message: errorMessage,
        autoHide: true,
      });
    }
  };

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const gamePhase = pageState.gameState?.phase || 'role_assignment';
  const isGameActive = pageState.gameState?.status === 'active';
  const canInteract =
    isGameActive && pageState.currentPlayer && !pageState.isLoading;

  const votingSession = useMemo(() => {
    if (gamePhase !== 'day_voting' || !pageState.gameState) return null;

    // TODO: Extract voting session from game state
    return {
      id: `voting-${pageState.gameState.data.round}` as UUID,
      phase: 'voting' as const,
      round: pageState.gameState.data.round,
      timeRemaining: pageState.gameState.data.timeRemaining,
      participants: pageState.gameState.data.alivePlayers,
      votes: [], // TODO: Get from game state
      mode: 'majority' as const,
      isAnonymous: false,
      allowsVoteChanging: true,
      startTime: Date.now() - 60000, // TODO: Get actual start time
      timeLimit: 300, // 5 minutes
    };
  }, [gamePhase, pageState.gameState]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderNotifications = () => (
    <div className='fixed right-4 top-4 z-50 space-y-2'>
      {pageState.notifications.map(notification => (
        <div
          key={notification.id}
          className={`max-w-sm rounded-lg border-l-4 p-4 shadow-lg ${
            notification.type === 'error'
              ? 'border-red-500 bg-red-50 text-red-800'
              : notification.type === 'warning'
                ? 'border-yellow-500 bg-yellow-50 text-yellow-800'
                : notification.type === 'success'
                  ? 'border-green-500 bg-green-50 text-green-800'
                  : 'border-blue-500 bg-blue-50 text-blue-800'
          }`}
        >
          <div className='flex items-start justify-between'>
            <div>
              <h4 className='font-medium'>{notification.title}</h4>
              <p className='mt-1 text-sm'>{notification.message}</p>
            </div>
            <button
              onClick={() => dismissNotification(notification.id)}
              className='ml-4 text-gray-400 hover:text-gray-600'
              aria-label='Dismiss notification'
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const renderLoadingState = () => (
    <div className='flex min-h-screen items-center justify-center bg-gray-50'>
      <div className='text-center'>
        <div className='mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600'></div>
        <h2 className='mb-2 text-xl font-semibold text-gray-900'>
          Loading Game...
        </h2>
        <p className='text-gray-600'>Connecting to the deduction game</p>
      </div>
    </div>
  );

  const renderErrorState = () => (
    <div className='flex min-h-screen items-center justify-center bg-gray-50'>
      <div className='max-w-md text-center'>
        <div className='mb-4 text-6xl text-red-500'>⚠️</div>
        <h2 className='mb-2 text-xl font-semibold text-gray-900'>Game Error</h2>
        <p className='mb-4 text-gray-600'>{pageState.error?.message}</p>
        <button
          onClick={fetchGameState}
          className='rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700'
        >
          Retry Connection
        </button>
      </div>
    </div>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  if (pageState.isLoading) {
    return renderLoadingState();
  }

  if (pageState.error || !pageState.gameState || !pageState.currentPlayer) {
    return renderErrorState();
  }

  const { gameState, currentPlayer } = pageState;

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Notifications */}
      {renderNotifications()}

      {/* Main Game Interface */}
      <div className='container mx-auto px-4 py-6'>
        {/* Game Header */}
        <div className='mb-6'>
          <div className='mb-4 flex items-center justify-between'>
            <h1 className='text-2xl font-bold text-gray-900'>
              Deduction Game - {gameState.data.scenario?.name}
            </h1>
            <div className='flex items-center space-x-4'>
              <GameTimer
                phase={gamePhase}
                timeRemaining={gameState.data.timeRemaining}
                totalTime={300} // TODO: Get from game config
                onTimeUp={() =>
                  addNotification({
                    type: 'warning',
                    title: "Time's Up!",
                    message: 'The current phase has ended',
                  })
                }
              />
            </div>
          </div>

          <PhaseIndicator
            currentPhase={gamePhase}
            round={gameState.data.round}
            className='mb-4'
          />
        </div>

        {/* Game Content Grid */}
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
          {/* Left Column - Player Info & Role */}
          <div className='space-y-6'>
            <RoleCard
              role={currentPlayer.gameSpecificData.role}
              scenario={gameState.data.scenario}
              canRevealInfo={gamePhase === 'day_discussion'}
              onActionUse={action => handleGameAction(action)}
              //TODO: Add proper accessibility labels for screen readers
            />

            <ClueTracker
              availableClues={gameState.data.cluesAvailable}
              playerClues={currentPlayer.gameSpecificData.clues}
              canRevealClues={gamePhase === 'day_discussion'}
              onClueReveal={clueId =>
                handleGameAction({
                  type: 'reveal_clue',
                  data: { clueId },
                })
              }
              //TODO: Add keyboard navigation for clue cards
            />
          </div>

          {/* Center Column - Main Game Area */}
          <div className='space-y-6'>
            <PlayerGrid
              players={gameState.players as DeductionPlayer[]}
              currentPlayerId={currentPlayer.id}
              gamePhase={gamePhase}
              alivePlayers={gameState.data.alivePlayers}
              onPlayerSelect={playerId => {
                // Handle player selection for abilities or voting
                console.log('Player selected:', playerId);
              }}
              //TODO: Implement player right-click context menu for abilities
            />

            {/* Voting Interface - Show during voting phase */}
            {gamePhase === 'day_voting' && votingSession && (
              <VotingInterface
                session={votingSession}
                players={gameState.players as DeductionPlayer[]}
                currentPlayerId={currentPlayer.id}
                onVotecast={result => {
                  addNotification({
                    type: 'success',
                    title: 'Vote Cast',
                    message: `Your vote has been recorded`,
                    autoHide: true,
                  });
                }}
                onError={error => {
                  addNotification({
                    type: 'error',
                    title: 'Voting Error',
                    message: error,
                  });
                }}
                //TODO: Add vote confirmation sounds and haptic feedback
              />
            )}
          </div>

          {/* Right Column - Communication */}
          <div className='space-y-6'>
            <ChatSystem
              gameId={gameId}
              currentPlayer={currentPlayer}
              allPlayers={gameState.players as DeductionPlayer[]}
              gamePhase={gamePhase}
              allowedCommunications={['public_message', 'whisper']} // TODO: Get from role
              onMessageSent={message =>
                handleGameAction({
                  type: 'send_message',
                  data: message,
                })
              }
              //TODO: Add message filtering and moderation
              //TODO: Implement @mentions with autocomplete
            />
          </div>
        </div>

        {/* Game Events Log */}
        <div className='mt-6'>
          <div className='rounded-lg border border-gray-200 bg-white p-6'>
            <h3 className='mb-4 text-lg font-semibold text-gray-900'>
              Game Events
            </h3>
            <div className='max-h-64 space-y-2 overflow-y-auto'>
              {gameState.data.events.map(event => (
                <div
                  key={event.id}
                  className={`rounded-lg p-3 text-sm ${
                    event.isPublic
                      ? 'border border-blue-200 bg-blue-50 text-blue-800'
                      : 'border border-gray-200 bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className='flex items-start justify-between'>
                    <div>
                      <p>{event.description}</p>
                      {event.flavorText && (
                        <p className='mt-1 text-xs italic opacity-75'>
                          {event.flavorText}
                        </p>
                      )}
                    </div>
                    <span className='text-xs opacity-60'>
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
