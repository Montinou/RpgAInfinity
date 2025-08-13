'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Users,
  Clock,
  Shield,
  Search,
  Building,
  Play,
  Eye,
  Crown,
  Lock,
  AlertCircle,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { clsx } from 'clsx';

interface GameListing {
  id: string;
  type: 'rpg' | 'deduction' | 'village';
  name: string;
  description: string;
  status: 'waiting' | 'active' | 'completed';
  currentPlayers: number;
  maxPlayers: number;
  minPlayers: number;
  isPrivate: boolean;
  createdAt: string;
  hostName: string;
  estimatedDuration?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

interface GameCardProps {
  game: GameListing;
  className?: string;
}

const gameTypeConfig = {
  rpg: {
    icon: Shield,
    gradient: 'from-amber-500 to-orange-500',
    badge: 'rpg',
    label: 'RPG Cooperativo',
    description: 'Aventura épica',
  },
  deduction: {
    icon: Search,
    gradient: 'from-purple-500 to-indigo-500',
    badge: 'deduction',
    label: 'Deducción Social',
    description: 'Misterio y lógica',
  },
  village: {
    icon: Building,
    gradient: 'from-green-500 to-emerald-500',
    badge: 'village',
    label: 'Simulador Villa',
    description: 'Gestión estratégica',
  },
} as const;

const difficultyConfig = {
  easy: { label: 'Fácil', color: 'success' },
  medium: { label: 'Intermedio', color: 'warning' },
  hard: { label: 'Avanzado', color: 'destructive' },
} as const;

const statusConfig = {
  waiting: {
    label: 'Esperando jugadores',
    color: 'outline',
    icon: Users,
    canJoin: true,
    description: 'Partida abierta para nuevos jugadores',
  },
  active: {
    label: 'En curso',
    color: 'success',
    icon: Play,
    canJoin: false,
    description: 'Partida en progreso',
  },
  completed: {
    label: 'Finalizada',
    color: 'secondary',
    icon: Eye,
    canJoin: false,
    description: 'Partida completada',
  },
} as const;

export default function GameCard({ game, className }: GameCardProps) {
  const typeConfig = gameTypeConfig[game.type];
  const statusInfo = statusConfig[game.status];
  const difficultyInfo = game.difficulty
    ? difficultyConfig[game.difficulty]
    : null;
  const TypeIcon = typeConfig.icon;
  const StatusIcon = statusInfo.icon;

  const playersFull = game.currentPlayers >= game.maxPlayers;
  const playersNearFull = game.currentPlayers >= game.maxPlayers - 1;
  const canJoin = statusInfo.canJoin && !playersFull;

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 1) return 'Ahora mismo';
    if (diffInMinutes < 60) return `Hace ${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `Hace ${Math.floor(diffInMinutes / 60)}h`;
    return `Hace ${Math.floor(diffInMinutes / 1440)}d`;
  };

  return (
    <Card
      className={clsx(
        'hover:border-primary/20 group relative h-full cursor-pointer border-2 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl',
        game.isPrivate && 'border-amber-200 dark:border-amber-800',
        className
      )}
    >
      {/* Game Type Badge */}
      <div className='absolute left-4 top-4 z-10'>
        <div
          className={clsx(
            'flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br shadow-lg transition-transform duration-300 group-hover:scale-110',
            typeConfig.gradient
          )}
        >
          <TypeIcon className='h-6 w-6 text-white' />
        </div>
      </div>

      {/* Private Game Indicator */}
      {game.isPrivate && (
        <div className='absolute right-4 top-4 z-10'>
          <div
            className='rounded-full bg-amber-100 p-2 dark:bg-amber-900'
            title='Partida privada'
          >
            <Lock className='h-4 w-4 text-amber-600 dark:text-amber-400' />
          </div>
        </div>
      )}

      <CardHeader className='pb-3 pt-20'>
        <div className='mb-2 flex items-start justify-between gap-2'>
          <div className='flex-1'>
            <Badge
              variant={typeConfig.badge as any}
              className='mb-2 text-xs font-medium'
            >
              {typeConfig.label}
            </Badge>
            <CardTitle className='group-hover:text-primary text-xl leading-tight transition-colors'>
              {game.name}
            </CardTitle>
          </div>
          <Badge
            variant={statusInfo.color as any}
            className='flex shrink-0 items-center gap-1'
          >
            <StatusIcon className='h-3 w-3' />
            {statusInfo.label}
          </Badge>
        </div>

        <CardDescription className='line-clamp-2 text-sm leading-relaxed'>
          {game.description}
        </CardDescription>

        <div className='text-muted-foreground flex items-center justify-between pt-2 text-sm'>
          <div className='flex items-center gap-1'>
            <Crown className='h-3 w-3' />
            <span>{game.hostName}</span>
          </div>
          <span>{formatTimeAgo(game.createdAt)}</span>
        </div>
      </CardHeader>

      <CardContent className='space-y-4'>
        {/* Game Details */}
        <div className='grid grid-cols-2 gap-3 text-sm'>
          <div className='flex items-center gap-2'>
            <Users className='text-muted-foreground h-4 w-4' />
            <span
              className={clsx(
                'font-medium',
                playersNearFull && 'text-amber-600',
                playersFull && 'text-destructive'
              )}
            >
              {game.currentPlayers}/{game.maxPlayers}
            </span>
            <span className='text-muted-foreground'>jugadores</span>
          </div>

          {game.estimatedDuration && (
            <div className='flex items-center gap-2'>
              <Clock className='text-muted-foreground h-4 w-4' />
              <span>{game.estimatedDuration}</span>
            </div>
          )}
        </div>

        {/* Difficulty and Status Info */}
        <div className='flex items-center justify-between'>
          {difficultyInfo && (
            <Badge variant={difficultyInfo.color as any} className='text-xs'>
              {difficultyInfo.label}
            </Badge>
          )}

          {playersNearFull && !playersFull && (
            <div className='flex items-center gap-1 text-xs text-amber-600'>
              <AlertCircle className='h-3 w-3' />
              <span>¡Casi lleno!</span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className='pt-2'>
          {canJoin ? (
            <Button asChild className='w-full' variant='game'>
              <Link href={`/games/${game.id}/join`}>
                <Play className='mr-2 h-4 w-4' />
                {game.currentPlayers === 0
                  ? 'Ser el primero en unirse'
                  : 'Unirse a la partida'}
              </Link>
            </Button>
          ) : game.status === 'active' ? (
            <Button asChild className='w-full' variant='outline'>
              <Link href={`/games/${game.id}`}>
                <Eye className='mr-2 h-4 w-4' />
                Ver partida en curso
              </Link>
            </Button>
          ) : playersFull ? (
            <Button disabled className='w-full' variant='outline'>
              <Users className='mr-2 h-4 w-4' />
              Partida completa
            </Button>
          ) : (
            <Button asChild className='w-full' variant='outline'>
              <Link href={`/games/${game.id}`}>
                <Eye className='mr-2 h-4 w-4' />
                Ver detalles
              </Link>
            </Button>
          )}
        </div>
      </CardContent>

      {/* Hover Effect Overlay */}
      <div className='to-primary/5 pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-t from-transparent via-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100' />
    </Card>
  );
}

// TODO: Add quick preview modal on card hover with more details
// TODO: Implement "Add to Favorites" functionality
// TODO: Add player avatars display when available
// TODO: Show recent activity or last action in active games
// TODO: Add game tags/categories for better filtering
// TODO: Implement "Join as Spectator" option for full games
