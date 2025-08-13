'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner, GameLoading } from '@/components/shared/LoadingStates';
import Navigation from '@/components/shared/Navigation';
import GameCard from '@/components/GameCard';

// Test data
const mockGame = {
  id: '1',
  type: 'rpg' as const,
  name: 'Test Adventure',
  description: 'A test RPG adventure',
  status: 'waiting' as const,
  currentPlayers: 2,
  maxPlayers: 4,
  minPlayers: 2,
  isPrivate: false,
  createdAt: new Date().toISOString(),
  hostName: 'Test User',
  estimatedDuration: '60 min',
  difficulty: 'easy' as const,
};

export default function TestUIPage() {
  return (
    <div className='bg-background min-h-screen'>
      <Navigation />

      <main className='container mx-auto space-y-8 px-4 py-8'>
        <h1 className='text-3xl font-bold'>UI Components Test</h1>

        {/* Button Tests */}
        <Card>
          <CardHeader>
            <CardTitle>Buttons</CardTitle>
          </CardHeader>
          <CardContent className='flex flex-wrap gap-4'>
            <Button>Default</Button>
            <Button variant='game'>Game</Button>
            <Button variant='outline'>Outline</Button>
            <Button variant='destructive'>Destructive</Button>
          </CardContent>
        </Card>

        {/* Badge Tests */}
        <Card>
          <CardHeader>
            <CardTitle>Badges</CardTitle>
          </CardHeader>
          <CardContent className='flex flex-wrap gap-4'>
            <Badge>Default</Badge>
            <Badge variant='rpg'>RPG</Badge>
            <Badge variant='deduction'>Deduction</Badge>
            <Badge variant='village'>Village</Badge>
          </CardContent>
        </Card>

        {/* Loading Tests */}
        <Card>
          <CardHeader>
            <CardTitle>Loading States</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <LoadingSpinner label='Testing spinner...' />
            <GameLoading gameType='rpg' />
          </CardContent>
        </Card>

        {/* GameCard Test */}
        <Card>
          <CardHeader>
            <CardTitle>Game Card</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='max-w-sm'>
              <GameCard game={mockGame} />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
