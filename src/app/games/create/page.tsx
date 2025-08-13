'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/shared/Navigation';
import GameSetup from '@/components/GameSetup';
import { GameLoading, SuccessState } from '@/components/shared/LoadingStates';

interface GameSetupConfig {
  type: 'rpg' | 'deduction' | 'village';
  name: string;
  description: string;
  maxPlayers: number;
  minPlayers: number;
  isPrivate: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedDuration: string;
  settings: Record<string, any>;
}

export default function CreateGamePage() {
  const router = useRouter();
  const [step, setStep] = React.useState<'setup' | 'creating' | 'success'>(
    'setup'
  );
  const [progress, setProgress] = React.useState(0);
  const [createdGameId, setCreatedGameId] = React.useState<string | null>(null);

  const handleGameCreate = async (config: GameSetupConfig) => {
    setStep('creating');

    try {
      // Simulate game creation process with progress
      const progressSteps = [
        { progress: 25, delay: 500 },
        { progress: 50, delay: 800 },
        { progress: 75, delay: 600 },
        { progress: 100, delay: 400 },
      ];

      for (const step of progressSteps) {
        await new Promise(resolve => setTimeout(resolve, step.delay));
        setProgress(step.progress);
      }

      // TODO: Replace with actual API call
      const response = await fetch('/api/games/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        const data = await response.json();
        setCreatedGameId(data.data.gameId);
        setStep('success');
      } else {
        throw new Error('Failed to create game');
      }
    } catch (error) {
      console.error('Error creating game:', error);
      // TODO: Handle error state
      setStep('setup');
    }
  };

  const handleCancel = () => {
    router.push('/games');
  };

  const handleContinueToLobby = () => {
    if (createdGameId) {
      router.push(`/games/${createdGameId}`);
    }
  };

  const handleBackToGames = () => {
    router.push('/games');
  };

  return (
    <div className='bg-background min-h-screen'>
      <Navigation />

      <main className='container mx-auto px-4 py-8'>
        {step === 'setup' && (
          <GameSetup onGameCreate={handleGameCreate} onCancel={handleCancel} />
        )}

        {step === 'creating' && (
          <GameLoading
            gameType='rpg' // TODO: Use actual game type from config
            progress={progress}
          />
        )}

        {step === 'success' && (
          <SuccessState
            title='¡Partida creada exitosamente!'
            message='Tu nueva aventura está lista. Ahora puedes invitar a otros jugadores o comenzar a configurar los detalles finales en el lobby.'
            onContinue={handleContinueToLobby}
            continueLabel='Ir al lobby'
          />
        )}
      </main>
    </div>
  );
}
