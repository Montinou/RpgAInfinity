'use client';

/**
 * DiscussionBoard Component for RpgAInfinity Deduction Game
 *
 * Pre-vote discussion interface featuring:
 * - Real-time messaging during discussion phase
 * - Player accusations and defenses
 * - Message filtering and moderation
 * - Whisper and team communication
 * - Time-limited discussion periods
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Communication,
  CommunicationType,
  DeductionPlayer,
  VotingSession,
  UUID,
} from '../../../types';
import { EventSystem } from '../../../lib/game-engine/events';

// ============================================================================
// COMPONENT TYPES & INTERFACES
// ============================================================================

export interface DiscussionBoardProps {
  readonly session: VotingSession;
  readonly players: DeductionPlayer[];
  readonly currentPlayerId: UUID;
  readonly communications: Communication[];
  readonly onSendMessage?: (
    content: string,
    type: CommunicationType,
    recipient?: UUID
  ) => Promise<void>;
  readonly onError?: (error: string) => void;
  readonly disabled?: boolean;
  readonly className?: string;
}

interface MessageState {
  content: string;
  type: CommunicationType;
  recipient: UUID | 'all' | 'team';
  isSubmitting: boolean;
}

interface MessageFilter {
  type: 'all' | 'public' | 'whispers' | 'team' | 'own';
  player?: UUID;
}

interface DiscussionStats {
  totalMessages: number;
  participatingPlayers: number;
  averageMessageLength: number;
  mostActivePlayer: { id: UUID; name: string; messageCount: number } | null;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DiscussionBoard({
  session,
  players,
  currentPlayerId,
  communications,
  onSendMessage,
  onError,
  disabled = false,
  className = '',
}: DiscussionBoardProps) {
  // State management
  const [messageState, setMessageState] = useState<MessageState>({
    content: '',
    type: 'public_message',
    recipient: 'all',
    isSubmitting: false,
  });

  const [filter, setFilter] = useState<MessageFilter>({ type: 'all' });
  const [showMessageComposer, setShowMessageComposer] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(session.timeRemaining);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const eventSystem = useRef(EventSystem.getInstance());

  // ============================================================================
  // EFFECT HOOKS
  // ============================================================================

  // Subscribe to events and start timer
  useEffect(() => {
    const unsubscribe = eventSystem.current.subscribe(
      'system_info',
      handleDiscussionEvents
    );
    startTimerUpdates();

    return () => {
      unsubscribe();
    };
  }, [session.id]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [communications]);

  // Focus textarea when composer opens
  useEffect(() => {
    if (showMessageComposer && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [showMessageComposer]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleDiscussionEvents = useCallback(
    (event: any) => {
      if (event.data?.sessionId !== session.id) return;

      if (event.data?.timerUpdate) {
        setTimeRemaining(event.data.timeRemaining);
      }
    },
    [session.id]
  );

  const handleSendMessage = useCallback(async () => {
    if (
      !messageState.content.trim() ||
      messageState.isSubmitting ||
      !onSendMessage
    )
      return;

    setMessageState(prev => ({ ...prev, isSubmitting: true }));

    try {
      await onSendMessage(
        messageState.content.trim(),
        messageState.type,
        messageState.recipient !== 'all' && messageState.recipient !== 'team'
          ? messageState.recipient
          : undefined
      );

      // Reset message state
      setMessageState({
        content: '',
        type: 'public_message',
        recipient: 'all',
        isSubmitting: false,
      });

      setShowMessageComposer(false);
    } catch (error) {
      onError?.(
        error instanceof Error ? error.message : 'Failed to send message'
      );
      setMessageState(prev => ({ ...prev, isSubmitting: false }));
    }
  }, [messageState, onSendMessage, onError]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const startTimerUpdates = useCallback(() => {
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
      const remaining = Math.max(0, session.timeLimit - elapsed);
      setTimeRemaining(remaining);
    }, 1000);

    return () => clearInterval(timer);
  }, [session.startTime, session.timeLimit]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const getPlayerName = useCallback(
    (playerId: UUID): string => {
      const player = players.find(p => p.id === playerId);
      return player ? player.name : 'Unknown Player';
    },
    [players]
  );

  const formatTimeRemaining = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const filteredMessages = useCallback(() => {
    let filtered = communications.filter(comm => {
      // Filter by phase (only current round)
      if (comm.round !== session.round) return false;

      // Apply type filter
      switch (filter.type) {
        case 'public':
          return comm.isPublic;
        case 'whispers':
          return comm.type === 'whisper';
        case 'team':
          return comm.type === 'team_chat';
        case 'own':
          return comm.from === currentPlayerId;
        default:
          return true;
      }
    });

    // Filter by specific player if selected
    if (filter.player) {
      filtered = filtered.filter(
        comm => comm.from === filter.player || comm.to === filter.player
      );
    }

    // Sort by timestamp
    return filtered.sort((a, b) => a.timestamp - b.timestamp);
  }, [communications, filter, session.round, currentPlayerId]);

  const discussionStats = useCallback((): DiscussionStats => {
    const currentRoundMessages = communications.filter(
      comm => comm.round === session.round
    );
    const playerMessageCounts = new Map<UUID, number>();

    // Count messages per player
    for (const comm of currentRoundMessages) {
      const count = playerMessageCounts.get(comm.from) || 0;
      playerMessageCounts.set(comm.from, count + 1);
    }

    // Find most active player
    let mostActivePlayer: DiscussionStats['mostActivePlayer'] = null;
    let maxMessages = 0;

    for (const [playerId, count] of playerMessageCounts.entries()) {
      if (count > maxMessages) {
        maxMessages = count;
        const player = players.find(p => p.id === playerId);
        if (player) {
          mostActivePlayer = {
            id: playerId,
            name: player.name,
            messageCount: count,
          };
        }
      }
    }

    const totalLength = currentRoundMessages.reduce(
      (sum, comm) => sum + comm.content.length,
      0
    );
    const averageLength =
      currentRoundMessages.length > 0
        ? totalLength / currentRoundMessages.length
        : 0;

    return {
      totalMessages: currentRoundMessages.length,
      participatingPlayers: playerMessageCounts.size,
      averageMessageLength: Math.round(averageLength),
      mostActivePlayer,
    };
  }, [communications, session.round, players]);

  const canSendMessage = useCallback((): boolean => {
    if (disabled || timeRemaining <= 0) return false;
    if (session.phase !== 'discussion') return false;
    if (!session.participants.includes(currentPlayerId)) return false;

    // TODO: Check if player is silenced or has other restrictions
    return true;
  }, [
    disabled,
    timeRemaining,
    session.phase,
    session.participants,
    currentPlayerId,
  ]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderMessage = (communication: Communication) => {
    const isOwnMessage = communication.from === currentPlayerId;
    const senderName = getPlayerName(communication.from);
    const recipientName =
      communication.to === 'all'
        ? 'Everyone'
        : communication.to === 'team'
          ? 'Team'
          : getPlayerName(communication.to as UUID);

    const messageTime = new Date(communication.timestamp).toLocaleTimeString(
      [],
      {
        hour: '2-digit',
        minute: '2-digit',
      }
    );

    const getMessageStyle = () => {
      switch (communication.type) {
        case 'whisper':
          return 'bg-purple-50 border-l-4 border-purple-400';
        case 'team_chat':
          return 'bg-blue-50 border-l-4 border-blue-400';
        case 'vote_declaration':
          return 'bg-yellow-50 border-l-4 border-yellow-400';
        case 'last_words':
          return 'bg-red-50 border-l-4 border-red-400';
        default:
          return 'bg-gray-50 border-l-4 border-gray-300';
      }
    };

    const getMessageIcon = () => {
      switch (communication.type) {
        case 'whisper':
          return '🤫';
        case 'team_chat':
          return '👥';
        case 'vote_declaration':
          return '🗳️';
        case 'last_words':
          return '💀';
        default:
          return '💬';
      }
    };

    return (
      <div
        key={communication.id}
        className={`mb-3 rounded-lg p-3 ${getMessageStyle()}`}
      >
        <div className='mb-2 flex items-start justify-between'>
          <div className='flex items-center space-x-2'>
            <span className='text-sm'>{getMessageIcon()}</span>
            <span
              className={`text-sm font-medium ${
                isOwnMessage ? 'text-blue-700' : 'text-gray-900'
              }`}
            >
              {senderName}
            </span>
            {communication.type === 'whisper' && (
              <span className='text-xs text-purple-600'>
                whispers to {recipientName}
              </span>
            )}
            {communication.type === 'team_chat' && (
              <span className='text-xs text-blue-600'>to team</span>
            )}
          </div>
          <span className='text-xs text-gray-500'>{messageTime}</span>
        </div>

        <div className='text-sm leading-relaxed text-gray-800'>
          {communication.content}
        </div>

        {/* Show if message is not public */}
        {!communication.isPublic && (
          <div className='mt-2 text-xs italic text-gray-500'>
            Private message
          </div>
        )}
      </div>
    );
  };

  const renderMessageComposer = () => {
    if (!showMessageComposer) return null;

    const recipientOptions = [
      { value: 'all', label: 'Everyone (Public)' },
      { value: 'team', label: 'Team Members' },
      ...players
        .filter(
          p => p.id !== currentPlayerId && session.participants.includes(p.id)
        )
        .map(p => ({ value: p.id, label: `${p.name} (Whisper)` })),
    ];

    return (
      <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4'>
        <div className='w-full max-w-lg rounded-lg bg-white p-6 shadow-xl'>
          <h3 className='mb-4 text-lg font-semibold text-gray-900'>
            Send Message
          </h3>

          {/* Recipient Selection */}
          <div className='mb-4'>
            <label
              htmlFor='recipient'
              className='mb-2 block text-sm font-medium text-gray-700'
            >
              Send to:
            </label>
            <select
              id='recipient'
              value={messageState.recipient}
              onChange={e =>
                setMessageState(prev => ({
                  ...prev,
                  recipient: e.target.value as any,
                  type:
                    e.target.value === 'all'
                      ? 'public_message'
                      : e.target.value === 'team'
                        ? 'team_chat'
                        : 'whisper',
                }))
              }
              className='w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500'
            >
              {recipientOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Message Content */}
          <div className='mb-4'>
            <label
              htmlFor='message'
              className='mb-2 block text-sm font-medium text-gray-700'
            >
              Message:
            </label>
            <textarea
              ref={textareaRef}
              id='message'
              value={messageState.content}
              onChange={e =>
                setMessageState(prev => ({ ...prev, content: e.target.value }))
              }
              onKeyPress={handleKeyPress}
              placeholder='Type your message...'
              className='w-full rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500'
              rows={4}
              maxLength={1000}
              disabled={messageState.isSubmitting}
            />
            <div className='mt-1 text-xs text-gray-500'>
              {messageState.content.length}/1000 characters
            </div>
          </div>

          {/* Message Type Info */}
          {messageState.type === 'whisper' && (
            <div className='mb-4 rounded border border-purple-200 bg-purple-50 p-3'>
              <p className='text-sm text-purple-800'>
                <span className='font-medium'>Whisper:</span> Only you and the
                recipient will see this message.
              </p>
            </div>
          )}

          {messageState.type === 'team_chat' && (
            <div className='mb-4 rounded border border-blue-200 bg-blue-50 p-3'>
              <p className='text-sm text-blue-800'>
                <span className='font-medium'>Team Chat:</span> Only your team
                members will see this message.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className='flex space-x-3'>
            <button
              onClick={() => setShowMessageComposer(false)}
              disabled={messageState.isSubmitting}
              className='flex-1 rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50'
            >
              Cancel
            </button>
            <button
              onClick={handleSendMessage}
              disabled={
                !messageState.content.trim() || messageState.isSubmitting
              }
              className='flex flex-1 items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50'
            >
              {messageState.isSubmitting ? (
                <>
                  <div className='mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white'></div>
                  Sending...
                </>
              ) : (
                'Send Message'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderFilterBar = () => {
    const stats = discussionStats();

    return (
      <div className='mb-4 flex flex-wrap items-center justify-between gap-4 rounded-lg bg-gray-50 p-4'>
        {/* Filter Buttons */}
        <div className='flex flex-wrap gap-2'>
          {[
            { type: 'all', label: 'All', count: stats.totalMessages },
            {
              type: 'public',
              label: 'Public',
              count: filteredMessages().filter(m => m.isPublic).length,
            },
            {
              type: 'whispers',
              label: 'Whispers',
              count: filteredMessages().filter(m => m.type === 'whisper')
                .length,
            },
            {
              type: 'team',
              label: 'Team',
              count: filteredMessages().filter(m => m.type === 'team_chat')
                .length,
            },
            {
              type: 'own',
              label: 'My Messages',
              count: filteredMessages().filter(m => m.from === currentPlayerId)
                .length,
            },
          ].map(option => (
            <button
              key={option.type}
              onClick={() => setFilter({ type: option.type as any })}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                filter.type === option.type
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {option.label} ({option.count})
            </button>
          ))}
        </div>

        {/* Discussion Stats */}
        <div className='text-sm text-gray-600'>
          {stats.participatingPlayers} players participating
          {stats.mostActivePlayer && (
            <span className='ml-2'>
              • Most active: {stats.mostActivePlayer.name} (
              {stats.mostActivePlayer.messageCount} messages)
            </span>
          )}
        </div>
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  if (session.phase !== 'discussion') {
    return (
      <div
        className={`rounded-lg border border-gray-200 bg-gray-50 p-6 ${className}`}
      >
        <div className='text-center'>
          <h3 className='mb-2 text-lg font-semibold text-gray-900'>
            Discussion Phase Not Active
          </h3>
          <p className='text-gray-600'>
            Current phase: <span className='font-medium'>{session.phase}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className='rounded-lg border border-gray-200 bg-white p-6'>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='text-xl font-bold text-gray-900'>Discussion Phase</h2>
          <div
            className={`flex items-center space-x-2 text-sm ${
              timeRemaining <= 30 ? 'text-red-600' : 'text-gray-600'
            }`}
          >
            <div
              className={`h-2 w-2 rounded-full ${
                timeRemaining <= 30
                  ? 'animate-pulse bg-red-500'
                  : 'bg-green-500'
              }`}
            />
            <span className='font-mono'>
              {formatTimeRemaining(timeRemaining)} remaining
            </span>
          </div>
        </div>

        <div className='rounded border border-blue-200 bg-blue-50 p-3'>
          <p className='text-sm text-blue-800'>
            <span className='font-medium'>Discussion Time:</span> Share your
            thoughts, make accusations, and defend yourself before the voting
            phase begins. Use this time wisely to gather information and
            convince other players.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      {renderFilterBar()}

      {/* Messages Area */}
      <div className='rounded-lg border border-gray-200 bg-white'>
        <div className='h-96 overflow-y-auto p-4'>
          {filteredMessages().length === 0 ? (
            <div className='flex h-full items-center justify-center text-gray-500'>
              <div className='text-center'>
                <div className='mb-4 text-4xl'>💬</div>
                <p>No messages yet. Start the discussion!</p>
              </div>
            </div>
          ) : (
            <>
              {filteredMessages().map(renderMessage)}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Message Input */}
        <div className='border-t border-gray-200 p-4'>
          {canSendMessage() ? (
            <button
              onClick={() => setShowMessageComposer(true)}
              className='w-full rounded-lg border-2 border-dashed border-gray-300 p-3 text-gray-600 transition-colors hover:border-blue-400 hover:text-blue-600'
            >
              <div className='flex items-center justify-center space-x-2'>
                <span>💬</span>
                <span>Click to send a message...</span>
              </div>
            </button>
          ) : (
            <div className='rounded-lg bg-gray-50 p-3 text-center text-gray-500'>
              {timeRemaining <= 0
                ? 'Discussion time has ended'
                : session.phase !== 'discussion'
                  ? 'Discussion phase is not active'
                  : 'You cannot send messages at this time'}
            </div>
          )}
        </div>
      </div>

      {/* Message Composer Modal */}
      {renderMessageComposer()}
    </div>
  );
}
