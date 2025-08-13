'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Crown,
  Settings,
  Play,
  Copy,
  Check,
  UserPlus,
  MessageCircle,
  Shield,
  Search,
  Building,
  Clock,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { clsx } from 'clsx';

interface Player {
  id: string;
  name: string;
  role: 'host' | 'player' | 'spectator';
  isReady: boolean;
  isConnected: boolean;
  joinedAt: string;
  avatar?: string;
  status?: string;
}

interface GameLobby {
  id: string;
  name: string;
  type: 'rpg' | 'deduction' | 'village';
  status: 'waiting' | 'starting' | 'active';
  players: Player[];
  maxPlayers: number;
  minPlayers: number;
  isPrivate: boolean;
  hostId: string;
  shareCode?: string;
  estimatedDuration?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  settings?: Record<string, any>;
}

interface PlayerLobbyProps {
  gameId: string;
  currentPlayerId: string;
  onStartGame: () => void;
  onLeaveGame: () => void;
  onUpdateSettings?: (settings: Record<string, any>) => void;
  onKickPlayer?: (playerId: string) => void;
  className?: string;
}

const gameTypeConfig = {
  rpg: {
    icon: Shield,
    gradient: 'from-amber-500 to-orange-500',
    label: 'RPG Cooperativo',
    readyText: '¡Listo para la aventura!',
  },
  deduction: {
    icon: Search,
    gradient: 'from-purple-500 to-indigo-500',
    label: 'Deducción Social',
    readyText: '¡Listo para el misterio!',
  },
  village: {
    icon: Building,
    gradient: 'from-green-500 to-emerald-500',
    label: 'Simulador Villa',
    readyText: '¡Listo para construir!',
  },
};

// TODO: Replace with actual API calls
const mockLobbyData: GameLobby = {
  id: '1',
  name: 'La Búsqueda del Cristal Perdido',
  type: 'rpg',
  status: 'waiting',
  maxPlayers: 4,
  minPlayers: 2,
  isPrivate: false,
  hostId: 'host-1',
  shareCode: 'CRYSTAL2024',
  estimatedDuration: '60-90 min',
  difficulty: 'medium',
  players: [
    {
      id: 'host-1',
      name: 'Familia García',
      role: 'host',
      isReady: true,
      isConnected: true,
      joinedAt: new Date().toISOString(),
      status: '¡Esperando a más aventureros!',
    },
    {
      id: 'player-2',
      name: 'Los Aventureros',
      role: 'player',
      isReady: true,
      isConnected: true,
      joinedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      status: 'Leyendo las reglas...',
    },
    {
      id: 'player-3',
      name: 'Familia López',
      role: 'player',
      isReady: false,
      isConnected: true,
      joinedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    },
  ],
};

export default function PlayerLobby({
  gameId,
  currentPlayerId,
  onStartGame,
  onLeaveGame,
  onUpdateSettings,
  onKickPlayer,
  className,
}: PlayerLobbyProps) {
  const [lobby, setLobby] = React.useState<GameLobby | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isConnected, setIsConnected] = React.useState(true);
  const [shareCodeCopied, setShareCodeCopied] = React.useState(false);
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [showSettings, setShowSettings] = React.useState(false);

  // TODO: Replace with real API calls and WebSocket connections
  React.useEffect(() => {
    const fetchLobbyData = async () => {
      setIsLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setLobby(mockLobbyData);
      setIsLoading(false);
    };

    fetchLobbyData();

    // TODO: Setup WebSocket for real-time updates
    const interval = setInterval(() => {
      // Simulate real-time updates
      if (Math.random() > 0.8) {
        setLobby(prev =>
          prev
            ? {
                ...prev,
                players: prev.players.map(player => ({
                  ...player,
                  isConnected: Math.random() > 0.1,
                })),
              }
            : null
        );
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [gameId]);

  const currentPlayer = lobby?.players.find(p => p.id === currentPlayerId);
  const isHost = currentPlayer?.role === 'host';
  const canStart =
    lobby &&
    lobby.players.length >= lobby.minPlayers &&
    lobby.players
      .filter(p => p.role === 'player' || p.role === 'host')
      .every(p => p.isReady);
  const gameTypeInfo = lobby ? gameTypeConfig[lobby.type] : null;

  const handleCopyShareCode = async () => {
    if (lobby?.shareCode) {
      try {
        await navigator.clipboard.writeText(lobby.shareCode);
        setShareCodeCopied(true);
        setTimeout(() => setShareCodeCopied(false), 2000);
      } catch (error) {
        console.error('Failed to copy share code:', error);
      }
    }
  };

  const handleToggleReady = () => {
    if (!currentPlayer || currentPlayer.role === 'host') return;

    // TODO: Call API to toggle ready status
    setLobby(prev =>
      prev
        ? {
            ...prev,
            players: prev.players.map(player =>
              player.id === currentPlayerId
                ? { ...player, isReady: !player.isReady }
                : player
            ),
          }
        : null
    );
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 1) return 'Ahora';
    if (diffInMinutes < 60) return `Hace ${diffInMinutes}m`;
    return `Hace ${Math.floor(diffInMinutes / 60)}h`;
  };

  if (isLoading || !lobby || !gameTypeInfo) {
    return (
      <div className={clsx('mx-auto max-w-4xl', className)}>
        <Card>
          <CardHeader>
            <div className='flex items-center gap-4'>
              <Skeleton className='h-16 w-16 rounded-xl' />
              <div className='space-y-2'>
                <Skeleton className='h-6 w-48' />
                <Skeleton className='h-4 w-32' />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              <Skeleton className='h-32 w-full' />
              <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className='h-20 w-full' />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const TypeIcon = gameTypeInfo.icon;

  return (
    <div className={clsx('mx-auto max-w-4xl space-y-6', className)}>
      {/* Connection Status */}
      <AnimatePresence>
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className='bg-destructive/10 border-destructive/20 rounded-lg border p-4'
          >
            <div className='flex items-center gap-3'>
              <WifiOff className='text-destructive h-5 w-5' />
              <div className='flex-1'>
                <p className='text-destructive font-medium'>Conexión perdida</p>
                <p className='text-muted-foreground text-sm'>
                  Reintentando conectar...
                </p>
              </div>
              <Button
                size='sm'
                variant='outline'
                onClick={() => setIsConnected(true)}
              >
                <RotateCcw className='mr-2 h-4 w-4' />
                Reintentar
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lobby Header */}
      <Card>
        <CardHeader>
          <div className='flex items-start justify-between'>
            <div className='flex items-center gap-4'>
              <div
                className={clsx(
                  'flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br',
                  gameTypeInfo.gradient
                )}
              >
                <TypeIcon className='h-8 w-8 text-white' />
              </div>
              <div>
                <div className='mb-1 flex items-center gap-2'>
                  <CardTitle className='text-2xl'>{lobby.name}</CardTitle>
                  {lobby.isPrivate && (
                    <Badge variant='outline' className='text-xs'>
                      Privada
                    </Badge>
                  )}
                </div>
                <div className='text-muted-foreground flex items-center gap-4 text-sm'>
                  <span>{gameTypeInfo.label}</span>
                  {lobby.estimatedDuration && (
                    <>
                      <span>•</span>
                      <div className='flex items-center gap-1'>
                        <Clock className='h-4 w-4' />
                        <span>{lobby.estimatedDuration}</span>
                      </div>
                    </>
                  )}
                  {lobby.difficulty && (
                    <>
                      <span>•</span>
                      <Badge variant='outline' className='text-xs capitalize'>
                        {lobby.difficulty === 'easy'
                          ? 'Fácil'
                          : lobby.difficulty === 'medium'
                            ? 'Intermedio'
                            : 'Avanzado'}
                      </Badge>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className='flex items-center gap-2'>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={
                  soundEnabled
                    ? 'Silenciar notificaciones'
                    : 'Activar notificaciones'
                }
              >
                {soundEnabled ? (
                  <Volume2 className='h-4 w-4' />
                ) : (
                  <VolumeX className='h-4 w-4' />
                )}
              </Button>

              {isHost && (
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => setShowSettings(!showSettings)}
                  title='Configuración de partida'
                >
                  <Settings className='h-4 w-4' />
                </Button>
              )}
            </div>
          </div>

          {/* Share Code */}
          {lobby.shareCode && (
            <div className='bg-muted mt-4 flex items-center gap-2 rounded-lg p-3'>
              <div className='flex-1'>
                <p className='text-sm font-medium'>Código para unirse</p>
                <p className='font-mono text-2xl font-bold tracking-wider'>
                  {lobby.shareCode}
                </p>
              </div>
              <Button
                variant='outline'
                size='sm'
                onClick={handleCopyShareCode}
                className='shrink-0'
              >
                {shareCodeCopied ? (
                  <>
                    <Check className='mr-2 h-4 w-4' />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className='mr-2 h-4 w-4' />
                    Copiar
                  </>
                )}
              </Button>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Players Grid */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <CardTitle className='flex items-center gap-2'>
              <Users className='h-5 w-5' />
              Jugadores ({lobby.players.length}/{lobby.maxPlayers})
            </CardTitle>
            <Badge variant='outline' className='text-xs'>
              {lobby.players.filter(p => p.role !== 'spectator').length}{' '}
              jugadores,{' '}
              {lobby.players.filter(p => p.role === 'spectator').length}{' '}
              espectadores
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
            {lobby.players.map((player, index) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className={clsx(
                  'relative rounded-lg border-2 p-4 transition-all duration-200',
                  player.isReady
                    ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
                    : 'border-border bg-card',
                  !player.isConnected && 'opacity-60'
                )}
              >
                <div className='mb-3 flex items-start justify-between'>
                  <div className='flex-1'>
                    <div className='mb-1 flex items-center gap-2'>
                      <span className='font-medium'>{player.name}</span>
                      {player.role === 'host' && (
                        <Crown
                          className='h-4 w-4 text-yellow-500'
                          title='Anfitrión'
                        />
                      )}
                      {!player.isConnected && (
                        <WifiOff
                          className='text-muted-foreground h-4 w-4'
                          title='Desconectado'
                        />
                      )}
                    </div>
                    <div className='text-muted-foreground flex items-center gap-2 text-xs'>
                      <span
                        className={clsx(
                          'h-2 w-2 rounded-full',
                          player.isConnected ? 'bg-green-500' : 'bg-gray-400'
                        )}
                      />
                      <span>{formatTimeAgo(player.joinedAt)}</span>
                    </div>
                  </div>

                  {isHost && player.id !== currentPlayerId && (
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => onKickPlayer?.(player.id)}
                      className='text-destructive hover:text-destructive opacity-0 transition-opacity group-hover:opacity-100'
                      title={`Expulsar a ${player.name}`}
                    >
                      ×
                    </Button>
                  )}
                </div>

                {player.status && (
                  <p className='text-muted-foreground mb-2 text-xs italic'>
                    "{player.status}"
                  </p>
                )}

                <div className='flex items-center justify-between'>
                  <Badge
                    variant={
                      player.role === 'host'
                        ? 'default'
                        : player.role === 'spectator'
                          ? 'outline'
                          : 'secondary'
                    }
                    className='text-xs capitalize'
                  >
                    {player.role === 'host'
                      ? 'Anfitrión'
                      : player.role === 'spectator'
                        ? 'Espectador'
                        : 'Jugador'}
                  </Badge>

                  {player.isReady ? (
                    <div className='flex items-center gap-1 text-xs text-green-600'>
                      <Check className='h-3 w-3' />
                      <span>Listo</span>
                    </div>
                  ) : (
                    player.role !== 'host' &&
                    player.role !== 'spectator' && (
                      <span className='text-muted-foreground text-xs'>
                        Esperando...
                      </span>
                    )
                  )}
                </div>
              </motion.div>
            ))}

            {/* Empty Slots */}
            {Array.from({
              length: lobby.maxPlayers - lobby.players.length,
            }).map((_, index) => (
              <div
                key={`empty-${index}`}
                className='border-muted-foreground/20 bg-muted/10 flex items-center justify-center rounded-lg border-2 border-dashed p-4'
              >
                <div className='text-muted-foreground text-center'>
                  <UserPlus className='mx-auto mb-2 h-6 w-6' />
                  <p className='text-sm'>Esperando jugador</p>
                </div>
              </div>
            ))}
          </div>

          {/* Ready Status */}
          {lobby.players.length >= lobby.minPlayers && (
            <div className='bg-muted/50 mt-6 rounded-lg p-4'>
              <div className='mb-2 flex items-center gap-3'>
                <AlertCircle className='text-muted-foreground h-5 w-5' />
                <span className='font-medium'>Estado de preparación</span>
              </div>
              <div className='text-muted-foreground text-sm'>
                {canStart ? (
                  <span className='text-green-600'>
                    ¡Todos los jugadores están listos! El anfitrión puede
                    iniciar la partida.
                  </span>
                ) : (
                  <span>
                    Esperando a que{' '}
                    {
                      lobby.players.filter(
                        p => !p.isReady && p.role !== 'spectator'
                      ).length
                    }{' '}
                    jugador(es) estén listos.
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className='flex gap-3'>
        <Button variant='outline' onClick={onLeaveGame} className='flex-1'>
          Salir de la partida
        </Button>

        {currentPlayer?.role === 'player' && (
          <Button
            onClick={handleToggleReady}
            variant={currentPlayer.isReady ? 'outline' : 'default'}
            className='flex-1'
          >
            {currentPlayer.isReady ? 'No estoy listo' : gameTypeInfo.readyText}
          </Button>
        )}

        {isHost && (
          <Button
            onClick={onStartGame}
            disabled={!canStart || lobby.status === 'starting'}
            variant='game'
            className='flex-1'
          >
            <Play className='mr-2 h-4 w-4' />
            {lobby.status === 'starting' ? 'Iniciando...' : 'Iniciar Partida'}
          </Button>
        )}
      </div>
    </div>
  );
}

// TODO: Implement WebSocket connection for real-time updates
// TODO: Add voice chat integration
// TODO: Add player kick/ban functionality
// TODO: Implement game settings modification in lobby
// TODO: Add player profile quick view on hover
// TODO: Add lobby chat functionality
// TODO: Implement rejoining after disconnect
// TODO: Add game start countdown timer
