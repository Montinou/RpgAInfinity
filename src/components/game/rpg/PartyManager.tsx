/**
 * PartyManager Component - Multi-Player Coordination System
 *
 * Comprehensive party management featuring:
 * - Real-time player status and activity monitoring
 * - Group decision making and voting systems
 * - Party composition and role management
 * - Resource sharing and trade coordination
 * - Formation and tactical positioning
 * - Communication and chat integration
 * - Party leader delegation and permissions
 * - Shared experience and loot distribution
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RPGGameState, Character, Player, Inventory, UUID } from '@/types/rpg';

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

interface PartyManagerProps {
  gameState: RPGGameState;
  playerCharacters: Character[];
  onPartyAction: (action: string, data?: any) => Promise<void>;
  className?: string;
}

interface PartyMember {
  playerId: UUID;
  character: Character;
  isOnline: boolean;
  lastActivity: number;
  role: PartyRole;
  permissions: PartyPermissions;
  status: 'ready' | 'busy' | 'away' | 'combat';
  location: string;
}

interface PartyRole {
  name: 'leader' | 'officer' | 'member';
  canInvite: boolean;
  canKick: boolean;
  canManageRoles: boolean;
  canStartVotes: boolean;
  canDistributeLoot: boolean;
}

interface PartyPermissions {
  canUsePartyInventory: boolean;
  canInitiateTrade: boolean;
  canChangeFormation: boolean;
  canMakeDecisions: boolean;
}

interface PartyVote {
  id: UUID;
  type:
    | 'kick_member'
    | 'change_leader'
    | 'major_decision'
    | 'loot_distribution';
  title: string;
  description: string;
  options: VoteOption[];
  votes: Record<UUID, string>;
  startedBy: UUID;
  startedAt: number;
  expiresAt: number;
  requiredParticipation: number; // Percentage of party needed to vote
}

interface VoteOption {
  id: string;
  text: string;
  consequences?: string[];
}

interface PartyFormation {
  name: string;
  positions: Record<
    UUID,
    { x: number; y: number; role: 'tank' | 'dps' | 'healer' | 'support' }
  >;
  description: string;
}

// ============================================================================
// MAIN PARTY MANAGER COMPONENT
// ============================================================================

export default function PartyManager({
  gameState,
  playerCharacters,
  onPartyAction,
  className = '',
}: PartyManagerProps) {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [activeTab, setActiveTab] = useState<
    'members' | 'formation' | 'voting' | 'chat' | 'settings'
  >('members');
  const [selectedMember, setSelectedMember] = useState<UUID | null>(null);
  const [activeVotes, setActiveVotes] = useState<PartyVote[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastAction, setLastAction] = useState<string>('');

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const partyMembers = useMemo<PartyMember[]>(() => {
    return (
      gameState.players?.map(player => ({
        playerId: player.id,
        character: player.gameSpecificData!.character,
        isOnline: true, // TODO: Implement real online status
        lastActivity: Date.now(),
        role: determinePlayerRole(player.id, gameState),
        permissions: getPlayerPermissions(player.id, gameState),
        status: determinePlayerStatus(player.id, gameState),
        location: getCurrentLocationName(player.id, gameState),
      })) || []
    );
  }, [gameState]);

  const currentPlayer = useMemo(() => {
    // TODO: Get actual current player ID
    return partyMembers[0];
  }, [partyMembers]);

  const partyStats = useMemo(() => {
    const onlineCount = partyMembers.filter(m => m.isOnline).length;
    const readyCount = partyMembers.filter(m => m.status === 'ready').length;
    const averageLevel = Math.round(
      partyMembers.reduce((sum, m) => sum + m.character.level, 0) /
        partyMembers.length
    );

    return {
      totalMembers: partyMembers.length,
      onlineMembers: onlineCount,
      readyMembers: readyCount,
      averageLevel,
      partyHealth: calculatePartyHealth(partyMembers),
      partyResources: calculatePartyResources(gameState),
    };
  }, [partyMembers, gameState]);

  const formations = useMemo<PartyFormation[]>(() => {
    // TODO: Load saved formations or create defaults
    return [
      {
        name: 'Standard Formation',
        description: 'Balanced formation with tanks in front',
        positions: generateStandardFormation(partyMembers),
      },
      {
        name: 'Defensive Formation',
        description: 'Maximum protection with healers in back',
        positions: generateDefensiveFormation(partyMembers),
      },
      {
        name: 'Aggressive Formation',
        description: 'Heavy offense with DPS forward',
        positions: generateAggressiveFormation(partyMembers),
      },
    ];
  }, [partyMembers]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handlePartyAction = useCallback(
    async (action: string, data?: any) => {
      setIsProcessing(true);
      setLastAction(`${action}...`);

      try {
        await onPartyAction(action, data);
        setLastAction(`${action} successful`);
      } catch (error) {
        console.error('Party action failed:', error);
        setLastAction(`Failed to ${action}`);
      } finally {
        setIsProcessing(false);
        setTimeout(() => setLastAction(''), 3000);
      }
    },
    [onPartyAction]
  );

  const handleMemberAction = useCallback(
    async (memberId: UUID, action: string) => {
      await handlePartyAction('member_action', { memberId, action });
    },
    [handlePartyAction]
  );

  const handleVoteStart = useCallback(
    async (voteType: string, options: any) => {
      await handlePartyAction('start_vote', { type: voteType, ...options });
    },
    [handlePartyAction]
  );

  const handleVoteCast = useCallback(
    async (voteId: UUID, optionId: string) => {
      await handlePartyAction('cast_vote', { voteId, optionId });
    },
    [handlePartyAction]
  );

  const handleFormationChange = useCallback(
    async (formationName: string) => {
      await handlePartyAction('change_formation', { formation: formationName });
    },
    [handlePartyAction]
  );

  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim()) return;

    const message = {
      id: Date.now().toString(),
      playerId: currentPlayer?.playerId,
      playerName: currentPlayer?.character.name,
      content: newMessage,
      timestamp: Date.now(),
      type: 'text',
    };

    setChatMessages(prev => [...prev, message]);
    setNewMessage('');

    await handlePartyAction('send_message', message);
  }, [newMessage, currentPlayer, handlePartyAction]);

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div
      className={`h-full bg-gradient-to-br from-green-900/20 via-emerald-900/20 to-teal-900/20 ${className}`}
    >
      {/* Header */}
      <div className='border-b border-green-500/30 bg-black/20 p-4 backdrop-blur-sm'>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='flex items-center space-x-2 text-xl font-bold text-white'>
            <span>👥</span>
            <span>Party Manager</span>
          </h2>

          {/* Processing Indicator */}
          {isProcessing && (
            <div className='flex items-center space-x-2 text-green-300'>
              <div className='h-4 w-4 animate-spin rounded-full border-2 border-green-500 border-t-transparent'></div>
              <span className='text-sm'>{lastAction}</span>
            </div>
          )}
        </div>

        {/* Party Stats */}
        <div className='grid grid-cols-2 gap-3 md:grid-cols-5'>
          <div className='text-center'>
            <div className='text-lg font-bold text-white'>
              {partyStats.totalMembers}
            </div>
            <div className='text-xs text-gray-400'>Members</div>
          </div>
          <div className='text-center'>
            <div className='text-lg font-bold text-green-400'>
              {partyStats.onlineMembers}
            </div>
            <div className='text-xs text-green-500'>Online</div>
          </div>
          <div className='text-center'>
            <div className='text-lg font-bold text-blue-400'>
              {partyStats.readyMembers}
            </div>
            <div className='text-xs text-blue-500'>Ready</div>
          </div>
          <div className='text-center'>
            <div className='text-lg font-bold text-purple-400'>
              {partyStats.averageLevel}
            </div>
            <div className='text-xs text-purple-500'>Avg Level</div>
          </div>
          <div className='text-center'>
            <div className='text-lg font-bold text-yellow-400'>
              {partyStats.partyHealth}%
            </div>
            <div className='text-xs text-yellow-500'>Party Health</div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className='border-b border-green-500/20 bg-black/10'>
        <nav className='flex'>
          {[
            { id: 'members', label: 'Members', icon: '👤' },
            { id: 'formation', label: 'Formation', icon: '🎯' },
            {
              id: 'voting',
              label: 'Voting',
              icon: '🗳️',
              badge: activeVotes.length,
            },
            { id: 'chat', label: 'Chat', icon: '💬' },
            { id: 'settings', label: 'Settings', icon: '⚙️' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                relative flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors
                ${
                  activeTab === tab.id
                    ? 'border-b-2 border-green-400 bg-green-600 text-white'
                    : 'text-green-200 hover:bg-white/10 hover:text-white'
                }
              `}
            >
              <span>{tab.icon}</span>
              <span className='hidden md:inline'>{tab.label}</span>
              {tab.badge && tab.badge > 0 && (
                <span className='absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white'>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className='flex-1 overflow-auto'>
        {/* Members Tab */}
        {activeTab === 'members' && (
          <MembersTab
            members={partyMembers}
            selectedMember={selectedMember}
            currentPlayer={currentPlayer}
            onMemberSelect={setSelectedMember}
            onMemberAction={handleMemberAction}
          />
        )}

        {/* Formation Tab */}
        {activeTab === 'formation' && (
          <FormationTab
            formations={formations}
            members={partyMembers}
            onFormationChange={handleFormationChange}
          />
        )}

        {/* Voting Tab */}
        {activeTab === 'voting' && (
          <VotingTab
            votes={activeVotes}
            currentPlayer={currentPlayer}
            onStartVote={handleVoteStart}
            onCastVote={handleVoteCast}
          />
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <ChatTab
            messages={chatMessages}
            currentPlayer={currentPlayer}
            newMessage={newMessage}
            onMessageChange={setNewMessage}
            onSendMessage={handleSendMessage}
          />
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <SettingsTab
            currentPlayer={currentPlayer}
            onSettingChange={(key, value) =>
              handlePartyAction('change_setting', { key, value })
            }
          />
        )}
      </div>

      {/* Action Result Toast */}
      <AnimatePresence>
        {lastAction && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className='fixed bottom-4 right-4 z-50 rounded-lg bg-black/80 px-4 py-2 text-white backdrop-blur-sm'
          >
            {lastAction}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// MEMBERS TAB COMPONENT
// ============================================================================

interface MembersTabProps {
  members: PartyMember[];
  selectedMember: UUID | null;
  currentPlayer: PartyMember;
  onMemberSelect: (memberId: UUID) => void;
  onMemberAction: (memberId: UUID, action: string) => void;
}

const MembersTab: React.FC<MembersTabProps> = ({
  members,
  selectedMember,
  currentPlayer,
  onMemberSelect,
  onMemberAction,
}) => {
  return (
    <div className='space-y-4 p-4'>
      {members.map(member => (
        <motion.div
          key={member.playerId}
          className={`
            cursor-pointer rounded-lg border p-4 transition-all
            ${
              selectedMember === member.playerId
                ? 'border-green-400 bg-green-400/10 ring-2 ring-green-400/30'
                : 'border-white/20 bg-white/5 hover:border-green-500/50'
            }
          `}
          onClick={() => onMemberSelect(member.playerId)}
          layout
        >
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-4'>
              {/* Avatar */}
              <div
                className={`
                flex h-12 w-12 items-center justify-center rounded-full font-bold text-white
                ${member.isOnline ? 'bg-green-500' : 'bg-gray-500'}
                relative
              `}
              >
                {member.character.name.charAt(0)}

                {/* Status Indicator */}
                <div
                  className={`
                  absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-gray-800
                  ${
                    member.status === 'ready'
                      ? 'bg-green-400'
                      : member.status === 'busy'
                        ? 'bg-yellow-400'
                        : member.status === 'combat'
                          ? 'bg-red-400'
                          : 'bg-gray-400'
                  }
                `}
                />
              </div>

              {/* Member Info */}
              <div>
                <div className='flex items-center space-x-2'>
                  <h3 className='font-semibold text-white'>
                    {member.character.name}
                  </h3>
                  <span
                    className={`
                    rounded px-2 py-1 text-xs font-medium
                    ${
                      member.role.name === 'leader'
                        ? 'bg-yellow-600 text-white'
                        : member.role.name === 'officer'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-600 text-white'
                    }
                  `}
                  >
                    {member.role.name}
                  </span>
                </div>
                <div className='text-sm text-gray-300'>
                  Level {member.character.level} {member.character.race.name}{' '}
                  {member.character.class.name}
                </div>
                <div className='text-xs text-gray-400'>
                  {member.location} • {member.isOnline ? 'Online' : 'Offline'}
                </div>
              </div>
            </div>

            {/* Health Bar */}
            <div className='text-right'>
              <div className='mb-1 text-sm text-white'>
                {member.character.currentHealth} / {member.character.maxHealth}{' '}
                HP
              </div>
              <div className='h-2 w-20 rounded-full bg-gray-700'>
                <div
                  className='h-2 rounded-full bg-red-500'
                  style={{
                    width: `${(member.character.currentHealth / member.character.maxHealth) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Expanded Member Details */}
          <AnimatePresence>
            {selectedMember === member.playerId && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className='mt-4 overflow-hidden border-t border-white/10 pt-4'
              >
                <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                  {/* Stats */}
                  <div>
                    <h4 className='mb-2 font-medium text-white'>Stats</h4>
                    <div className='space-y-1 text-sm'>
                      <div className='flex justify-between text-gray-300'>
                        <span>Strength:</span>
                        <span>{member.character.stats.strength}</span>
                      </div>
                      <div className='flex justify-between text-gray-300'>
                        <span>Dexterity:</span>
                        <span>{member.character.stats.dexterity}</span>
                      </div>
                      <div className='flex justify-between text-gray-300'>
                        <span>Constitution:</span>
                        <span>{member.character.stats.constitution}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {currentPlayer.role.canManageRoles &&
                    member.playerId !== currentPlayer.playerId && (
                      <div>
                        <h4 className='mb-2 font-medium text-white'>Actions</h4>
                        <div className='space-y-2'>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              onMemberAction(member.playerId, 'promote');
                            }}
                            className='w-full rounded bg-blue-600/80 px-3 py-2 text-sm text-white transition-colors hover:bg-blue-600'
                          >
                            {member.role.name === 'member'
                              ? 'Promote to Officer'
                              : 'Demote'}
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              onMemberAction(member.playerId, 'kick');
                            }}
                            className='w-full rounded bg-red-600/80 px-3 py-2 text-sm text-white transition-colors hover:bg-red-600'
                          >
                            Remove from Party
                          </button>
                        </div>
                      </div>
                    )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}
    </div>
  );
};

// ============================================================================
// PLACEHOLDER COMPONENTS (Implementation abbreviated for space)
// ============================================================================

const FormationTab: React.FC<{
  formations: PartyFormation[];
  members: PartyMember[];
  onFormationChange: (formation: string) => void;
}> = ({ formations, members, onFormationChange }) => (
  <div className='p-4'>
    <h3 className='mb-4 font-semibold text-white'>Party Formations</h3>
    <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
      {formations.map((formation, index) => (
        <div
          key={index}
          className='rounded-lg border border-white/20 bg-white/5 p-4'
        >
          <h4 className='mb-2 font-medium text-white'>{formation.name}</h4>
          <p className='mb-3 text-sm text-gray-300'>{formation.description}</p>
          <button
            onClick={() => onFormationChange(formation.name)}
            className='w-full rounded bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700'
          >
            Apply Formation
          </button>
        </div>
      ))}
    </div>
  </div>
);

const VotingTab: React.FC<{
  votes: PartyVote[];
  currentPlayer: PartyMember;
  onStartVote: (type: string, options: any) => void;
  onCastVote: (voteId: UUID, optionId: string) => void;
}> = ({ votes, currentPlayer, onStartVote, onCastVote }) => (
  <div className='p-4'>
    <div className='mb-4 flex items-center justify-between'>
      <h3 className='font-semibold text-white'>Active Votes</h3>
      {currentPlayer.role.canStartVotes && (
        <button
          onClick={() => onStartVote('general', { title: 'General Vote' })}
          className='rounded bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700'
        >
          Start Vote
        </button>
      )}
    </div>

    {votes.length > 0 ? (
      <div className='space-y-4'>
        {votes.map(vote => (
          <div
            key={vote.id}
            className='rounded-lg border border-white/20 bg-white/5 p-4'
          >
            <h4 className='mb-2 font-medium text-white'>{vote.title}</h4>
            <p className='mb-4 text-sm text-gray-300'>{vote.description}</p>
            <div className='space-y-2'>
              {vote.options.map(option => (
                <button
                  key={option.id}
                  onClick={() => onCastVote(vote.id, option.id)}
                  className='w-full rounded bg-white/10 px-3 py-2 text-left text-white transition-colors hover:bg-white/20'
                >
                  {option.text}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className='py-8 text-center text-gray-400'>
        <div className='mb-2 text-4xl'>🗳️</div>
        <p>No active votes</p>
      </div>
    )}
  </div>
);

const ChatTab: React.FC<{
  messages: any[];
  currentPlayer: PartyMember;
  newMessage: string;
  onMessageChange: (message: string) => void;
  onSendMessage: () => void;
}> = ({
  messages,
  currentPlayer,
  newMessage,
  onMessageChange,
  onSendMessage,
}) => (
  <div className='flex h-full flex-col'>
    <div className='flex-1 overflow-auto p-4'>
      {messages.map(message => (
        <div key={message.id} className='mb-3'>
          <div className='text-xs text-gray-400'>{message.playerName}</div>
          <div className='text-white'>{message.content}</div>
        </div>
      ))}
    </div>
    <div className='border-t border-white/10 p-4'>
      <div className='flex space-x-2'>
        <input
          type='text'
          value={newMessage}
          onChange={e => onMessageChange(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && onSendMessage()}
          placeholder='Type a message...'
          className='flex-1 rounded border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-gray-400'
        />
        <button
          onClick={onSendMessage}
          className='rounded bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700'
        >
          Send
        </button>
      </div>
    </div>
  </div>
);

const SettingsTab: React.FC<{
  currentPlayer: PartyMember;
  onSettingChange: (key: string, value: any) => void;
}> = ({ currentPlayer, onSettingChange }) => (
  <div className='p-4'>
    <h3 className='mb-4 font-semibold text-white'>Party Settings</h3>
    <div className='space-y-4'>
      <div className='rounded-lg border border-white/20 bg-white/5 p-4'>
        <h4 className='mb-2 font-medium text-white'>General Settings</h4>
        <div className='space-y-3'>
          <label className='flex items-center justify-between'>
            <span className='text-gray-300'>Auto-share experience</span>
            <input type='checkbox' className='rounded' />
          </label>
          <label className='flex items-center justify-between'>
            <span className='text-gray-300'>Auto-distribute loot</span>
            <input type='checkbox' className='rounded' />
          </label>
          <label className='flex items-center justify-between'>
            <span className='text-gray-300'>Allow party inventory access</span>
            <input type='checkbox' className='rounded' />
          </label>
        </div>
      </div>
    </div>
  </div>
);

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function determinePlayerRole(
  playerId: UUID,
  gameState: RPGGameState
): PartyRole {
  // TODO: Implement proper role determination
  return {
    name: 'leader', // Placeholder
    canInvite: true,
    canKick: true,
    canManageRoles: true,
    canStartVotes: true,
    canDistributeLoot: true,
  };
}

function getPlayerPermissions(
  playerId: UUID,
  gameState: RPGGameState
): PartyPermissions {
  // TODO: Implement proper permission calculation
  return {
    canUsePartyInventory: true,
    canInitiateTrade: true,
    canChangeFormation: true,
    canMakeDecisions: true,
  };
}

function determinePlayerStatus(
  playerId: UUID,
  gameState: RPGGameState
): 'ready' | 'busy' | 'away' | 'combat' {
  // TODO: Implement proper status determination
  if (gameState.data.activeCombat) return 'combat';
  return 'ready';
}

function getCurrentLocationName(
  playerId: UUID,
  gameState: RPGGameState
): string {
  const location = gameState.data.world.locations.find(
    l => l.id === gameState.data.currentLocation
  );
  return location?.name || 'Unknown Location';
}

function calculatePartyHealth(members: PartyMember[]): number {
  if (members.length === 0) return 0;

  const totalHealth = members.reduce(
    (sum, member) =>
      sum + member.character.currentHealth / member.character.maxHealth,
    0
  );

  return Math.round((totalHealth / members.length) * 100);
}

function calculatePartyResources(gameState: RPGGameState): any {
  // TODO: Calculate party resources
  return {};
}

function generateStandardFormation(
  members: PartyMember[]
): Record<
  UUID,
  { x: number; y: number; role: 'tank' | 'dps' | 'healer' | 'support' }
> {
  // TODO: Generate formation positions
  return {};
}

function generateDefensiveFormation(
  members: PartyMember[]
): Record<
  UUID,
  { x: number; y: number; role: 'tank' | 'dps' | 'healer' | 'support' }
> {
  // TODO: Generate formation positions
  return {};
}

function generateAggressiveFormation(
  members: PartyMember[]
): Record<
  UUID,
  { x: number; y: number; role: 'tank' | 'dps' | 'healer' | 'support' }
> {
  // TODO: Generate formation positions
  return {};
}
