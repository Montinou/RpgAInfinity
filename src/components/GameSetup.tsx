'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  Search,
  Building,
  Users,
  Clock,
  Settings,
  Lock,
  Unlock,
  Info,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { clsx } from 'clsx';

type GameType = 'rpg' | 'deduction' | 'village';

interface GameSetupConfig {
  type: GameType;
  name: string;
  description: string;
  maxPlayers: number;
  minPlayers: number;
  isPrivate: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedDuration: string;
  settings: Record<string, any>;
}

interface GameSetupProps {
  onGameCreate: (config: GameSetupConfig) => void;
  onCancel: () => void;
  className?: string;
}

const gameTypes = {
  rpg: {
    icon: Shield,
    gradient: 'from-amber-500 to-orange-500',
    label: 'RPG Cooperativo',
    description: 'Aventuras épicas con personajes personalizables',
    minPlayers: 2,
    maxPlayers: 6,
    defaultDuration: '60-90 min',
    features: [
      'Personajes únicos generados por IA',
      'Narrativa adaptativa',
      'Sistema de combate cooperativo',
      'Exploración de mundos fantásticos',
    ],
    settings: {
      worldTheme: {
        label: 'Ambientación',
        options: [
          'Fantasía Medieval',
          'Sci-Fi Espacial',
          'Moderno Urbano',
          'Steampunk',
        ],
        default: 'Fantasía Medieval',
      },
      combatComplexity: {
        label: 'Complejidad del combate',
        options: ['Simple', 'Intermedio', 'Avanzado'],
        default: 'Simple',
      },
      narrativeStyle: {
        label: 'Estilo narrativo',
        options: ['Familiar', 'Épico', 'Misterioso', 'Cómico'],
        default: 'Familiar',
      },
    },
  },
  deduction: {
    icon: Search,
    gradient: 'from-purple-500 to-indigo-500',
    label: 'Deducción Social',
    description: 'Misterios y secretos por descubrir',
    minPlayers: 3,
    maxPlayers: 8,
    defaultDuration: '30-45 min',
    features: [
      'Roles secretos únicos',
      'Pistas generadas dinámicamente',
      'Sistema de votación estratégica',
      'Múltiples finales posibles',
    ],
    settings: {
      mysteryTheme: {
        label: 'Temática del misterio',
        options: [
          'Mansión Victoriana',
          'Nave Espacial',
          'Escuela Mágica',
          'Oeste Americano',
        ],
        default: 'Mansión Victoriana',
      },
      complexity: {
        label: 'Complejidad de pistas',
        options: ['Básica', 'Intermedia', 'Avanzada'],
        default: 'Básica',
      },
      discussion: {
        label: 'Tiempo de discusión',
        options: ['Corto (3min)', 'Medio (5min)', 'Largo (8min)'],
        default: 'Medio (5min)',
      },
    },
  },
  village: {
    icon: Building,
    gradient: 'from-green-500 to-emerald-500',
    label: 'Simulador Villa',
    description: 'Gestión estratégica de recursos',
    minPlayers: 2,
    maxPlayers: 4,
    defaultDuration: '45-75 min',
    features: [
      'Gestión de recursos realista',
      'Eventos estacionales dinámicos',
      'NPCs con personalidades únicas',
      'Múltiples rutas de desarrollo',
    ],
    settings: {
      startingSeason: {
        label: 'Estación inicial',
        options: ['Primavera', 'Verano', 'Otoño', 'Invierno'],
        default: 'Primavera',
      },
      difficulty: {
        label: 'Dificultad económica',
        options: ['Abundante', 'Equilibrada', 'Desafiante'],
        default: 'Equilibrada',
      },
      events: {
        label: 'Frecuencia de eventos',
        options: ['Baja', 'Media', 'Alta'],
        default: 'Media',
      },
    },
  },
};

export default function GameSetup({
  onGameCreate,
  onCancel,
  className,
}: GameSetupProps) {
  const [selectedType, setSelectedType] = React.useState<GameType | null>(null);
  const [config, setConfig] = React.useState<Partial<GameSetupConfig>>({
    name: '',
    description: '',
    isPrivate: false,
    difficulty: 'easy',
  });
  const [expandedSettings, setExpandedSettings] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState<
    'select' | 'configure' | 'confirm'
  >('select');

  const selectedGameType = selectedType ? gameTypes[selectedType] : null;

  const handleTypeSelect = (type: GameType) => {
    setSelectedType(type);
    const gameType = gameTypes[type];
    setConfig(prev => ({
      ...prev,
      type,
      maxPlayers: gameType.maxPlayers,
      minPlayers: gameType.minPlayers,
      estimatedDuration: gameType.defaultDuration,
      settings: Object.entries(gameType.settings).reduce(
        (acc, [key, setting]) => ({
          ...acc,
          [key]: setting.default,
        }),
        {}
      ),
    }));
    setCurrentStep('configure');
  };

  const handleSettingChange = (key: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        [key]: value,
      },
    }));
  };

  const handleCreateGame = () => {
    if (selectedType && config.name) {
      onGameCreate({
        ...config,
        type: selectedType,
        name: config.name!,
        description:
          config.description ||
          `Una nueva partida de ${selectedGameType?.label}`,
        maxPlayers: config.maxPlayers!,
        minPlayers: config.minPlayers!,
        isPrivate: config.isPrivate!,
        difficulty: config.difficulty!,
        estimatedDuration: config.estimatedDuration!,
        settings: config.settings || {},
      });
    }
  };

  const isConfigValid = selectedType && config.name && config.name.length >= 3;

  if (currentStep === 'select') {
    return (
      <div className={clsx('mx-auto max-w-4xl', className)}>
        <div className='mb-8 text-center'>
          <h2 className='mb-3 text-3xl font-bold'>Elige tu tipo de aventura</h2>
          <p className='text-muted-foreground text-lg'>
            Cada tipo de juego ofrece una experiencia única para disfrutar en
            familia
          </p>
        </div>

        <div className='grid gap-6 md:grid-cols-3'>
          {Object.entries(gameTypes).map(([type, config], index) => {
            const Icon = config.icon;
            return (
              <motion.div
                key={type}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Card
                  className='hover:border-primary/20 group h-full cursor-pointer border-2 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl'
                  onClick={() => handleTypeSelect(type as GameType)}
                >
                  <CardHeader className='pb-4 text-center'>
                    <div
                      className={clsx(
                        'mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br transition-transform duration-300 group-hover:scale-110',
                        config.gradient
                      )}
                    >
                      <Icon className='h-10 w-10 text-white' />
                    </div>
                    <CardTitle className='group-hover:text-primary text-xl transition-colors'>
                      {config.label}
                    </CardTitle>
                    <CardDescription>{config.description}</CardDescription>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    <div className='flex items-center justify-between text-sm'>
                      <div className='flex items-center gap-2'>
                        <Users className='text-muted-foreground h-4 w-4' />
                        <span>
                          {config.minPlayers}-{config.maxPlayers} jugadores
                        </span>
                      </div>
                      <div className='flex items-center gap-2'>
                        <Clock className='text-muted-foreground h-4 w-4' />
                        <span>{config.defaultDuration}</span>
                      </div>
                    </div>

                    <div className='space-y-2'>
                      <h4 className='text-sm font-medium'>Características:</h4>
                      <ul className='space-y-1'>
                        {config.features.slice(0, 3).map(feature => (
                          <li
                            key={feature}
                            className='text-muted-foreground flex items-center gap-2 text-sm'
                          >
                            <div className='bg-primary h-1.5 w-1.5 shrink-0 rounded-full' />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Button className='group-hover:bg-primary group-hover:text-primary-foreground w-full transition-colors'>
                      Seleccionar
                      <ArrowRight className='ml-2 h-4 w-4' />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  if (currentStep === 'configure' && selectedGameType) {
    return (
      <motion.div
        className={clsx('mx-auto max-w-2xl', className)}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className='mb-6'>
          <div className='mb-3 flex items-center gap-3'>
            <div
              className={clsx(
                'flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br',
                selectedGameType.gradient
              )}
            >
              <selectedGameType.icon className='h-6 w-6 text-white' />
            </div>
            <div>
              <h2 className='text-2xl font-bold'>{selectedGameType.label}</h2>
              <p className='text-muted-foreground'>Configura tu partida</p>
            </div>
          </div>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => setCurrentStep('select')}
            className='text-muted-foreground hover:text-foreground'
          >
            ← Cambiar tipo de juego
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configuración básica</CardTitle>
          </CardHeader>
          <CardContent className='space-y-6'>
            {/* Game Name */}
            <div className='space-y-2'>
              <label className='text-sm font-medium'>
                Nombre de la partida *
              </label>
              <input
                type='text'
                value={config.name || ''}
                onChange={e =>
                  setConfig(prev => ({ ...prev, name: e.target.value }))
                }
                placeholder={`Mi aventura de ${selectedGameType.label}`}
                className='border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2'
                maxLength={100}
              />
              {config.name && config.name.length < 3 && (
                <p className='text-muted-foreground text-sm'>
                  El nombre debe tener al menos 3 caracteres
                </p>
              )}
            </div>

            {/* Description */}
            <div className='space-y-2'>
              <label className='text-sm font-medium'>
                Descripción (opcional)
              </label>
              <textarea
                value={config.description || ''}
                onChange={e =>
                  setConfig(prev => ({ ...prev, description: e.target.value }))
                }
                placeholder='Describe tu partida para atraer a otros jugadores...'
                className='border-input bg-background focus:ring-ring w-full resize-none rounded-md border px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2'
                rows={3}
                maxLength={500}
              />
            </div>

            {/* Players */}
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <label className='text-sm font-medium'>Jugadores mínimos</label>
                <select
                  value={config.minPlayers || selectedGameType.minPlayers}
                  onChange={e =>
                    setConfig(prev => ({
                      ...prev,
                      minPlayers: parseInt(e.target.value),
                    }))
                  }
                  className='border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2'
                >
                  {Array.from(
                    {
                      length:
                        selectedGameType.maxPlayers -
                        selectedGameType.minPlayers +
                        1,
                    },
                    (_, i) => {
                      const value = selectedGameType.minPlayers + i;
                      return (
                        <option key={value} value={value}>
                          {value} jugador{value !== 1 ? 'es' : ''}
                        </option>
                      );
                    }
                  )}
                </select>
              </div>
              <div className='space-y-2'>
                <label className='text-sm font-medium'>Jugadores máximos</label>
                <select
                  value={config.maxPlayers || selectedGameType.maxPlayers}
                  onChange={e =>
                    setConfig(prev => ({
                      ...prev,
                      maxPlayers: parseInt(e.target.value),
                    }))
                  }
                  className='border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2'
                >
                  {Array.from(
                    {
                      length:
                        selectedGameType.maxPlayers -
                        selectedGameType.minPlayers +
                        1,
                    },
                    (_, i) => {
                      const value = selectedGameType.minPlayers + i;
                      return value >=
                        (config.minPlayers || selectedGameType.minPlayers) ? (
                        <option key={value} value={value}>
                          {value} jugador{value !== 1 ? 'es' : ''}
                        </option>
                      ) : null;
                    }
                  )}
                </select>
              </div>
            </div>

            {/* Privacy and Difficulty */}
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <label className='text-sm font-medium'>Privacidad</label>
                <Button
                  variant={config.isPrivate ? 'default' : 'outline'}
                  onClick={() =>
                    setConfig(prev => ({ ...prev, isPrivate: !prev.isPrivate }))
                  }
                  className='w-full justify-start'
                >
                  {config.isPrivate ? (
                    <Lock className='mr-2 h-4 w-4' />
                  ) : (
                    <Unlock className='mr-2 h-4 w-4' />
                  )}
                  {config.isPrivate ? 'Privada' : 'Pública'}
                </Button>
              </div>
              <div className='space-y-2'>
                <label className='text-sm font-medium'>Dificultad</label>
                <select
                  value={config.difficulty || 'easy'}
                  onChange={e =>
                    setConfig(prev => ({
                      ...prev,
                      difficulty: e.target.value as any,
                    }))
                  }
                  className='border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2'
                >
                  <option value='easy'>Fácil</option>
                  <option value='medium'>Intermedio</option>
                  <option value='hard'>Avanzado</option>
                </select>
              </div>
            </div>

            {/* Advanced Settings */}
            <div className='border-t pt-4'>
              <Button
                variant='ghost'
                onClick={() => setExpandedSettings(!expandedSettings)}
                className='h-auto w-full justify-between p-0 font-medium'
              >
                <div className='flex items-center gap-2'>
                  <Settings className='h-4 w-4' />
                  <span>Configuración avanzada</span>
                </div>
                {expandedSettings ? (
                  <ChevronUp className='h-4 w-4' />
                ) : (
                  <ChevronDown className='h-4 w-4' />
                )}
              </Button>

              {expandedSettings && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className='mt-4 space-y-4'
                >
                  {Object.entries(selectedGameType.settings).map(
                    ([key, setting]) => (
                      <div key={key} className='space-y-2'>
                        <label className='text-sm font-medium'>
                          {setting.label}
                        </label>
                        <select
                          value={config.settings?.[key] || setting.default}
                          onChange={e =>
                            handleSettingChange(key, e.target.value)
                          }
                          className='border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2'
                        >
                          {setting.options.map((option: string) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    )
                  )}
                </motion.div>
              )}
            </div>

            {/* Actions */}
            <div className='flex gap-3 border-t pt-4'>
              <Button variant='outline' onClick={onCancel} className='flex-1'>
                Cancelar
              </Button>
              <Button
                onClick={handleCreateGame}
                disabled={!isConfigValid}
                variant='game'
                className='flex-1'
              >
                <Sparkles className='mr-2 h-4 w-4' />
                Crear Partida
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return null;
}

// TODO: Add game templates/presets for quick setup
// TODO: Implement real-time validation with API
// TODO: Add preview of generated content based on settings
// TODO: Implement save draft functionality
// TODO: Add estimated player time commitment calculator
// TODO: Integrate with calendar for scheduled games
