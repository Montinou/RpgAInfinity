'use client';

/**
 * ChatSystem Component for RpgAInfinity Deduction Game
 *
 * Secure communication system featuring:
 * - Public chat with role-appropriate visibility
 * - Private whisper system for direct communication
 * - Team chat for aligned players (mafia, etc.)
 * - Message filtering and moderation
 * - Real-time updates with typing indicators
 * - @mention system with autocomplete
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  DeductionPlayer,
  Communication,
  CommunicationType,
  DeductionPhase,
  UUID,
} from '../../../types/deduction';

// ============================================================================
// COMPONENT TYPES & INTERFACES
// ============================================================================

export interface ChatSystemProps {
  readonly gameId: UUID;
  readonly currentPlayer: DeductionPlayer;
  readonly allPlayers: DeductionPlayer[];
  readonly gamePhase: DeductionPhase;
  readonly allowedCommunications: CommunicationType[];
  readonly onMessageSent?: (message: MessageData) => void;
  readonly className?: string;
}

interface MessageData {
  recipient: UUID | 'all' | 'team';
  message: string;
  communicationType: CommunicationType;
}

interface ChatSystemState {
  messages: Communication[];
  currentMessage: string;
  selectedRecipient: UUID | 'all' | 'team';
  messageType: CommunicationType;
  isTyping: boolean;
  typingUsers: Set<UUID>;
  showEmojiPicker: boolean;
  mentionSuggestions: DeductionPlayer[];
  mentionQuery: string;
  filterBy: 'all' | 'public' | 'private' | 'team';
  autoScroll: boolean;
}

interface MessageDisplay {
  communication: Communication;
  isVisible: boolean;
  isFromCurrentPlayer: boolean;
  playerName: string;
  formattedTime: string;
  mentionedPlayers: UUID[];
  isSystemMessage: boolean;
}

// ============================================================================
// MESSAGE CONFIGURATION
// ============================================================================

const COMMUNICATION_CONFIG: Record<
  CommunicationType,
  {
    name: string;
    icon: string;
    color: string;
    description: string;
    allowsRecipient: boolean;
  }
> = {
  public_message: {
    name: 'Public',
    icon: '💬',
    color: 'blue',
    description: 'Visible to all players',
    allowsRecipient: false,
  },
  whisper: {
    name: 'Whisper',
    icon: '🤫',
    color: 'purple',
    description: 'Private message to one player',
    allowsRecipient: true,
  },
  team_chat: {
    name: 'Team',
    icon: '👥',
    color: 'green',
    description: 'Only your team can see this',
    allowsRecipient: false,
  },
  last_words: {
    name: 'Last Words',
    icon: '💀',
    color: 'red',
    description: 'Final message before elimination',
    allowsRecipient: false,
  },
  vote_declaration: {
    name: 'Vote Declaration',
    icon: '🗳️',
    color: 'orange',
    description: 'Announce your vote publicly',
    allowsRecipient: false,
  },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ChatSystem({
  gameId,
  currentPlayer,
  allPlayers,
  gamePhase,
  allowedCommunications,
  onMessageSent,
  className = '',
}: ChatSystemProps) {
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // State management
  const [chatState, setChatState] = useState<ChatSystemState>({
    messages: [],
    currentMessage: '',
    selectedRecipient: 'all',
    messageType: 'public_message',
    isTyping: false,
    typingUsers: new Set(),
    showEmojiPicker: false,
    mentionSuggestions: [],
    mentionQuery: '',
    filterBy: 'all',
    autoScroll: true,
  });

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const teammates = useMemo(() => {
    const currentPlayerTeammates =
      currentPlayer.gameSpecificData.role.teammates;
    if (!currentPlayerTeammates) return [];

    return allPlayers.filter(
      player =>
        currentPlayerTeammates.includes(player.id) &&
        player.id !== currentPlayer.id
    );
  }, [currentPlayer, allPlayers]);

  const canUseTeamChat = useMemo(() => {
    return allowedCommunications.includes('team_chat') && teammates.length > 0;
  }, [allowedCommunications, teammates]);

  const recipientOptions = useMemo(() => {
    const options: Array<{
      id: UUID | 'all' | 'team';
      name: string;
      type: 'system' | 'player';
    }> = [];

    // Add system recipients
    options.push({ id: 'all', name: 'Everyone', type: 'system' });

    if (canUseTeamChat) {
      options.push({ id: 'team', name: 'Team', type: 'system' });
    }

    // Add individual players (for whispers)
    if (allowedCommunications.includes('whisper')) {
      allPlayers
        .filter(player => player.id !== currentPlayer.id)
        .forEach(player => {
          options.push({ id: player.id, name: player.name, type: 'player' });
        });
    }

    return options;
  }, [allPlayers, currentPlayer.id, allowedCommunications, canUseTeamChat]);

  const messageDisplays = useMemo((): MessageDisplay[] => {
    return chatState.messages
      .map((communication): MessageDisplay => {
        const isFromCurrentPlayer = communication.from === currentPlayer.id;
        const fromPlayer = allPlayers.find(p => p.id === communication.from);
        const playerName = fromPlayer?.name || 'Unknown Player';

        // Determine visibility based on message type and current player's role
        let isVisible = true;

        if (communication.type === 'whisper') {
          isVisible =
            communication.from === currentPlayer.id ||
            communication.to === currentPlayer.id;
        } else if (communication.type === 'team_chat') {
          isVisible =
            communication.from === currentPlayer.id ||
            (teammates.some(t => t.id === communication.from) &&
              (communication.to === 'team' ||
                communication.to === currentPlayer.id));
        }

        const mentionedPlayers = extractMentions(communication.content);

        return {
          communication,
          isVisible,
          isFromCurrentPlayer,
          playerName,
          formattedTime: new Date(communication.timestamp).toLocaleTimeString(),
          mentionedPlayers,
          isSystemMessage: false,
        };
      })
      .filter(display => {
        // Apply visibility filter
        if (!display.isVisible) return false;

        // Apply user filter
        switch (chatState.filterBy) {
          case 'public':
            return display.communication.isPublic;
          case 'private':
            return !display.communication.isPublic;
          case 'team':
            return display.communication.type === 'team_chat';
          default:
            return true;
        }
      });
  }, [
    chatState.messages,
    currentPlayer.id,
    allPlayers,
    teammates,
    chatState.filterBy,
  ]);

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const extractMentions = useCallback(
    (message: string): UUID[] => {
      const mentions: UUID[] = [];
      const mentionRegex = /@(\w+)/g;
      let match;

      while ((match = mentionRegex.exec(message)) !== null) {
        const mentionedName = match[1];
        const mentionedPlayer = allPlayers.find(
          p => p.name.toLowerCase() === mentionedName.toLowerCase()
        );
        if (mentionedPlayer) {
          mentions.push(mentionedPlayer.id);
        }
      }

      return mentions;
    },
    [allPlayers]
  );

  const getMessageTypeFromRecipient = useCallback(
    (recipient: UUID | 'all' | 'team'): CommunicationType => {
      if (recipient === 'all') return 'public_message';
      if (recipient === 'team') return 'team_chat';
      return 'whisper';
    },
    []
  );

  const checkMentions = useCallback(
    (message: string): DeductionPlayer[] => {
      const lastAtIndex = message.lastIndexOf('@');
      if (lastAtIndex === -1) return [];

      const query = message.slice(lastAtIndex + 1).toLowerCase();
      if (query.length < 1) return [];

      return allPlayers
        .filter(
          player =>
            player.id !== currentPlayer.id &&
            player.name.toLowerCase().startsWith(query)
        )
        .slice(0, 5); // Limit to 5 suggestions
    },
    [allPlayers, currentPlayer.id]
  );

  // ============================================================================
  // EFFECT HOOKS
  // ============================================================================

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (chatState.autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatState.messages, chatState.autoScroll]);

  useEffect(() => {
    // Update mention suggestions based on current message
    const suggestions = checkMentions(chatState.currentMessage);
    setChatState(prev => ({ ...prev, mentionSuggestions: suggestions }));
  }, [chatState.currentMessage, checkMentions]);

  useEffect(() => {
    // Handle typing indicator timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (chatState.isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        setChatState(prev => ({ ...prev, isTyping: false }));
      }, 2000);
    }

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [chatState.isTyping]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleMessageChange = useCallback((message: string) => {
    setChatState(prev => ({
      ...prev,
      currentMessage: message,
      isTyping: message.length > 0,
    }));
  }, []);

  const handleRecipientChange = useCallback(
    (recipient: UUID | 'all' | 'team') => {
      const messageType = getMessageTypeFromRecipient(recipient);
      setChatState(prev => ({
        ...prev,
        selectedRecipient: recipient,
        messageType,
      }));
    },
    [getMessageTypeFromRecipient]
  );

  const handleMentionSelect = useCallback(
    (player: DeductionPlayer) => {
      const lastAtIndex = chatState.currentMessage.lastIndexOf('@');
      if (lastAtIndex === -1) return;

      const beforeMention = chatState.currentMessage.slice(0, lastAtIndex);
      const afterMention = chatState.currentMessage
        .slice(lastAtIndex)
        .replace(/@\w*/, `@${player.name} `);

      const newMessage = beforeMention + afterMention;
      setChatState(prev => ({
        ...prev,
        currentMessage: newMessage,
        mentionSuggestions: [],
      }));

      inputRef.current?.focus();
    },
    [chatState.currentMessage]
  );

  const handleSendMessage = useCallback(() => {
    const message = chatState.currentMessage.trim();
    if (!message || !onMessageSent) return;

    const messageData: MessageData = {
      recipient: chatState.selectedRecipient,
      message,
      communicationType: chatState.messageType,
    };

    onMessageSent(messageData);

    // Clear message and reset state
    setChatState(prev => ({
      ...prev,
      currentMessage: '',
      isTyping: false,
      mentionSuggestions: [],
    }));

    inputRef.current?.focus();
  }, [
    chatState.currentMessage,
    chatState.selectedRecipient,
    chatState.messageType,
    onMessageSent,
  ]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      } else if (e.key === 'Tab' && chatState.mentionSuggestions.length > 0) {
        e.preventDefault();
        handleMentionSelect(chatState.mentionSuggestions[0]);
      }
    },
    [handleSendMessage, chatState.mentionSuggestions, handleMentionSelect]
  );

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderChatControls = () => (
    <div className='flex items-center justify-between border-b border-gray-200 bg-gray-50 p-3'>
      <div className='flex items-center space-x-4'>
        {/* Message Type Selector */}
        <div className='flex items-center space-x-2'>
          <label className='text-sm font-medium text-gray-700'>Mode:</label>
          <select
            value={chatState.messageType}
            onChange={e => {
              const type = e.target.value as CommunicationType;
              const recipient =
                type === 'public_message'
                  ? 'all'
                  : type === 'team_chat'
                    ? 'team'
                    : allPlayers.find(p => p.id !== currentPlayer.id)?.id ||
                      'all';
              setChatState(prev => ({
                ...prev,
                messageType: type,
                selectedRecipient: recipient,
              }));
            }}
            className='rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500'
            //TODO: Add accessibility labels for screen readers
          >
            {allowedCommunications.map(type => {
              const config = COMMUNICATION_CONFIG[type];
              return (
                <option key={type} value={type}>
                  {config.icon} {config.name}
                </option>
              );
            })}
          </select>
        </div>

        {/* Recipient Selector (for whispers) */}
        {COMMUNICATION_CONFIG[chatState.messageType].allowsRecipient && (
          <div className='flex items-center space-x-2'>
            <label className='text-sm font-medium text-gray-700'>To:</label>
            <select
              value={chatState.selectedRecipient}
              onChange={e =>
                handleRecipientChange(e.target.value as UUID | 'all' | 'team')
              }
              className='rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500'
            >
              {recipientOptions.map(option => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Filter Controls */}
        <div className='flex items-center space-x-2'>
          <label className='text-sm font-medium text-gray-700'>Show:</label>
          <select
            value={chatState.filterBy}
            onChange={e =>
              setChatState(prev => ({
                ...prev,
                filterBy: e.target.value as typeof prev.filterBy,
              }))
            }
            className='rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500'
          >
            <option value='all'>All Messages</option>
            <option value='public'>Public Only</option>
            <option value='private'>Private Only</option>
            {canUseTeamChat && <option value='team'>Team Only</option>}
          </select>
        </div>
      </div>

      {/* Status Indicators */}
      <div className='flex items-center space-x-2 text-sm text-gray-600'>
        {chatState.typingUsers.size > 0 && (
          <div className='flex items-center space-x-1'>
            <div className='flex space-x-1'>
              <div className='h-1 w-1 animate-bounce rounded-full bg-blue-500'></div>
              <div
                className='h-1 w-1 animate-bounce rounded-full bg-blue-500'
                style={{ animationDelay: '0.1s' }}
              ></div>
              <div
                className='h-1 w-1 animate-bounce rounded-full bg-blue-500'
                style={{ animationDelay: '0.2s' }}
              ></div>
            </div>
            <span>{chatState.typingUsers.size} typing...</span>
          </div>
        )}

        <button
          onClick={() =>
            setChatState(prev => ({ ...prev, autoScroll: !prev.autoScroll }))
          }
          className={`rounded px-2 py-1 text-xs transition-colors ${
            chatState.autoScroll
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
          }`}
        >
          Auto-scroll: {chatState.autoScroll ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );

  const renderMessage = (display: MessageDisplay) => {
    const {
      communication,
      isFromCurrentPlayer,
      playerName,
      formattedTime,
      mentionedPlayers,
    } = display;
    const config = COMMUNICATION_CONFIG[communication.type];
    const isMentioned = mentionedPlayers.includes(currentPlayer.id);

    return (
      <div
        key={communication.id}
        className={`border-l-4 p-3 ${
          isMentioned
            ? 'border-yellow-400 bg-yellow-50'
            : isFromCurrentPlayer
              ? `border-${config.color}-400 bg-${config.color}-50`
              : communication.isPublic
                ? 'border-gray-200 bg-white'
                : 'border-purple-200 bg-purple-50'
        }`}
      >
        <div className='mb-2 flex items-start justify-between'>
          <div className='flex items-center space-x-2'>
            <span
              className={`font-medium ${
                isFromCurrentPlayer ? 'text-blue-600' : 'text-gray-900'
              }`}
            >
              {playerName}
              {isFromCurrentPlayer && (
                <span className='ml-1 text-xs text-gray-500'>(You)</span>
              )}
            </span>

            <span className='text-xs text-gray-500' title={config.description}>
              {config.icon} {config.name}
            </span>

            {!communication.isPublic && communication.to !== 'all' && (
              <span className='text-xs text-gray-500'>
                →{' '}
                {communication.to === 'team'
                  ? 'Team'
                  : allPlayers.find(p => p.id === communication.to)?.name ||
                    'Unknown'}
              </span>
            )}
          </div>

          <span className='text-xs text-gray-500'>{formattedTime}</span>
        </div>

        <div className='whitespace-pre-wrap text-sm text-gray-800'>
          {formatMessageContent(communication.content, allPlayers)}
        </div>

        {/* Mention Highlight */}
        {isMentioned && (
          <div className='mt-2 text-xs font-medium text-yellow-800'>
            📢 You were mentioned in this message
          </div>
        )}
      </div>
    );
  };

  const renderMentionSuggestions = () => {
    if (chatState.mentionSuggestions.length === 0) return null;

    return (
      <div className='absolute bottom-full left-0 right-0 z-10 mb-2 max-h-32 overflow-y-auto rounded border border-gray-300 bg-white shadow-lg'>
        {chatState.mentionSuggestions.map(player => (
          <button
            key={player.id}
            onClick={() => handleMentionSelect(player)}
            className='flex w-full items-center space-x-2 p-2 text-left text-sm hover:bg-blue-50 focus:bg-blue-50'
          >
            <div className='flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold'>
              {player.name.charAt(0).toUpperCase()}
            </div>
            <span>{player.name}</span>
          </button>
        ))}
        <div className='border-t border-gray-200 p-2 text-xs text-gray-500'>
          Press Tab to select first suggestion
        </div>
      </div>
    );
  };

  const renderMessageInput = () => (
    <div className='relative border-t border-gray-200 bg-white p-3'>
      {/* Mention Suggestions */}
      {renderMentionSuggestions()}

      <div className='flex items-end space-x-2'>
        <div className='relative flex-1'>
          <textarea
            ref={inputRef}
            value={chatState.currentMessage}
            onChange={e => handleMessageChange(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={`Type a ${COMMUNICATION_CONFIG[chatState.messageType].name.toLowerCase()} message...`}
            className='w-full resize-none rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500'
            rows={2}
            maxLength={1000}
            disabled={!allowedCommunications.includes(chatState.messageType)}
            //TODO: Add emoji picker integration
          />

          {/* Character Count */}
          <div className='absolute bottom-2 right-2 text-xs text-gray-400'>
            {chatState.currentMessage.length}/1000
          </div>
        </div>

        <button
          onClick={handleSendMessage}
          disabled={
            !chatState.currentMessage.trim() ||
            !allowedCommunications.includes(chatState.messageType)
          }
          className='rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50'
        >
          Send
        </button>
      </div>

      {/* Help Text */}
      <div className='mt-2 text-xs text-gray-500'>
        Use @playername to mention someone • Press Enter to send, Shift+Enter
        for new line
        {gamePhase === 'night_actions' &&
          ' • Night phase: only whispers allowed'}
      </div>
    </div>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div
      className={`flex flex-col rounded-lg border border-gray-200 bg-white shadow-sm ${className}`}
    >
      {/* Header */}
      <div className='border-b border-gray-200 p-4'>
        <h3 className='text-lg font-semibold text-gray-900'>Chat System</h3>
        <p className='mt-1 text-sm text-gray-600'>
          {COMMUNICATION_CONFIG[chatState.messageType].description}
        </p>
      </div>

      {/* Controls */}
      {renderChatControls()}

      {/* Message History */}
      <div className='max-h-96 min-h-64 flex-1 overflow-y-auto'>
        <div className='space-y-2 p-2'>
          {messageDisplays.map(renderMessage)}
          <div ref={messagesEndRef} />
        </div>

        {/* Empty State */}
        {messageDisplays.length === 0 && (
          <div className='flex h-32 items-center justify-center text-gray-500'>
            <div className='text-center'>
              <div className='mb-2 text-2xl'>💭</div>
              <p className='text-sm'>No messages yet</p>
              <p className='text-xs'>Start the conversation!</p>
            </div>
          </div>
        )}
      </div>

      {/* Message Input */}
      {renderMessageInput()}

      {/* Accessibility Information */}
      <div className='sr-only'>
        Chat system for{' '}
        {COMMUNICATION_CONFIG[chatState.messageType].name.toLowerCase()}{' '}
        messages. Use the controls to select message type and recipient. Type
        your message and press Enter to send. Use @ followed by a player name to
        mention them. //TODO: Add more detailed accessibility instructions
      </div>
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatMessageContent(
  content: string,
  players: DeductionPlayer[]
): React.ReactNode {
  // Simple mention highlighting - in a real implementation, this would be more sophisticated
  let formattedContent = content;

  // Replace @mentions with highlighted spans
  players.forEach(player => {
    const mentionRegex = new RegExp(`@${player.name}\\b`, 'gi');
    formattedContent = formattedContent.replace(
      mentionRegex,
      `<span class="bg-blue-100 text-blue-800 px-1 rounded">@${player.name}</span>`
    );
  });

  return <div dangerouslySetInnerHTML={{ __html: formattedContent }} />;
}
