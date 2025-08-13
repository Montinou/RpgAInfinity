'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Plus,
  Filter,
  Search,
  SlidersHorizontal,
  RefreshCw,
  Gamepad2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Navigation from '@/components/shared/Navigation';
import GameCard from '@/components/GameCard';

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

// TODO: Replace with actual API calls
const mockGames: GameListing[] = [
  {
    id: '1',
    type: 'rpg',
    name: 'La Búsqueda del Cristal Perdido',
    description:
      'Una épica aventura en un reino fantástico donde los héroes deben recuperar un cristal mágico para salvar el mundo.',
    status: 'waiting',
    currentPlayers: 2,
    maxPlayers: 4,
    minPlayers: 2,
    isPrivate: false,
    createdAt: new Date().toISOString(),
    hostName: 'Familia García',
    estimatedDuration: '60-90 min',
    difficulty: 'medium',
  },
  {
    id: '2',
    type: 'deduction',
    name: 'El Misterio de la Mansión Oscura',
    description:
      'Resuelve el crimen en una misteriosa mansión victoriana donde cada habitante guarda secretos.',
    status: 'waiting',
    currentPlayers: 4,
    maxPlayers: 6,
    minPlayers: 3,
    isPrivate: false,
    createdAt: new Date().toISOString(),
    hostName: 'Los Detectives',
    estimatedDuration: '30-45 min',
    difficulty: 'hard',
  },
  {
    id: '3',
    type: 'village',
    name: 'Villa Esperanza',
    description:
      'Gestiona recursos y toma decisiones para hacer prosperar tu aldea medieval a través de las estaciones.',
    status: 'active',
    currentPlayers: 3,
    maxPlayers: 4,
    minPlayers: 2,
    isPrivate: false,
    createdAt: new Date().toISOString(),
    hostName: 'Los Constructores',
    estimatedDuration: '45-75 min',
    difficulty: 'easy',
  },
];

const gameTypeFilters = [
  { id: 'all', label: 'Todos', count: 12 },
  { id: 'rpg', label: 'RPG Cooperativo', count: 5 },
  { id: 'deduction', label: 'Deducción Social', count: 4 },
  { id: 'village', label: 'Simulador Villa', count: 3 },
];

export default function GamesPage() {
  const [selectedFilter, setSelectedFilter] = React.useState('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);
  const [games, setGames] = React.useState<GameListing[]>([]);

  // TODO: Replace with actual API calls
  React.useEffect(() => {
    const fetchGames = async () => {
      setIsLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setGames(mockGames);
      setIsLoading(false);
    };

    fetchGames();
  }, []);

  const filteredGames = games.filter(game => {
    const matchesFilter =
      selectedFilter === 'all' || game.type === selectedFilter;
    const matchesSearch =
      game.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.hostName.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const handleRefresh = () => {
    setIsLoading(true);
    // TODO: Implement refresh logic
    setTimeout(() => setIsLoading(false), 1000);
  };

  return (
    <div className='bg-background min-h-screen'>
      <Navigation />

      <main className='container mx-auto px-4 py-8'>
        {/* Header */}
        <div className='mb-8 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <h1 className='mb-2 text-3xl font-bold md:text-4xl'>
              Selecciona tu aventura
            </h1>
            <p className='text-muted-foreground text-lg'>
              Únete a una partida existente o crea tu propia aventura familiar
            </p>
          </div>

          <div className='flex items-center gap-3'>
            <Button
              variant='outline'
              size='sm'
              onClick={handleRefresh}
              disabled={isLoading}
              className='flex items-center gap-2'
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
              />
              Actualizar
            </Button>

            <Button asChild size='lg' variant='game'>
              <Link href='/games/create'>
                <Plus className='mr-2 h-4 w-4' />
                Crear Nueva Partida
              </Link>
            </Button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className='mb-8 flex flex-col gap-4 lg:flex-row'>
          {/* Game Type Filters */}
          <div className='flex flex-wrap gap-2'>
            {gameTypeFilters.map(filter => (
              <Button
                key={filter.id}
                variant={selectedFilter === filter.id ? 'default' : 'outline'}
                size='sm'
                onClick={() => setSelectedFilter(filter.id)}
                className='flex items-center gap-2'
              >
                <span>{filter.label}</span>
                <Badge variant='secondary' className='ml-1 text-xs'>
                  {filter.count}
                </Badge>
              </Button>
            ))}
          </div>

          {/* Search Bar */}
          <div className='flex-1 lg:max-w-md'>
            <div className='relative'>
              <Search className='text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform' />
              <input
                type='text'
                placeholder='Buscar por nombre, descripción o anfitrión...'
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className='border-input bg-background focus:ring-ring w-full rounded-md border py-2 pl-10 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2'
              />
            </div>
          </div>

          {/* Advanced Filters - TODO: Implement */}
          <Button
            variant='outline'
            size='sm'
            className='flex items-center gap-2'
          >
            <SlidersHorizontal className='h-4 w-4' />
            Filtros
          </Button>
        </div>

        {/* Game Grid */}
        <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
          {isLoading ? (
            // Loading Skeletons
            Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className='h-80'>
                <CardContent className='p-6'>
                  <div className='space-y-4'>
                    <div className='flex items-center justify-between'>
                      <Skeleton className='h-6 w-24' />
                      <Skeleton className='h-4 w-16' />
                    </div>
                    <Skeleton className='h-6 w-3/4' />
                    <Skeleton className='h-16 w-full' />
                    <div className='flex justify-between'>
                      <Skeleton className='h-4 w-20' />
                      <Skeleton className='h-4 w-24' />
                    </div>
                    <div className='flex gap-2'>
                      <Skeleton className='h-8 w-16' />
                      <Skeleton className='h-8 w-16' />
                    </div>
                    <Skeleton className='h-10 w-full' />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : filteredGames.length > 0 ? (
            // Game Cards
            filteredGames.map((game, index) => (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <GameCard game={game} />
              </motion.div>
            ))
          ) : (
            // Empty State
            <div className='col-span-full py-16 text-center'>
              <div className='bg-muted mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full'>
                <Gamepad2 className='text-muted-foreground h-12 w-12' />
              </div>
              <h3 className='mb-2 text-2xl font-semibold'>
                No se encontraron partidas
              </h3>
              <p className='text-muted-foreground mx-auto mb-6 max-w-md'>
                {searchQuery || selectedFilter !== 'all'
                  ? 'Prueba a cambiar los filtros o términos de búsqueda'
                  : 'Sé el primero en crear una nueva aventura para tu familia'}
              </p>
              <div className='flex flex-col justify-center gap-3 sm:flex-row'>
                <Button asChild variant='game'>
                  <Link href='/games/create'>
                    <Plus className='mr-2 h-4 w-4' />
                    Crear Nueva Partida
                  </Link>
                </Button>
                {(searchQuery || selectedFilter !== 'all') && (
                  <Button
                    variant='outline'
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedFilter('all');
                    }}
                  >
                    Limpiar Filtros
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Load More - TODO: Implement pagination */}
        {!isLoading && filteredGames.length > 0 && (
          <div className='mt-12 text-center'>
            <Button variant='outline' size='lg'>
              Cargar más partidas
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

// TODO: Implement real-time updates for game status changes
// TODO: Add sorting options (newest, most players, starting soon)
// TODO: Implement game favorites/bookmarking
// TODO: Add quick join functionality for compatible games
// TODO: Implement game recommendations based on player preferences
// TODO: Add game history and "play again" functionality
