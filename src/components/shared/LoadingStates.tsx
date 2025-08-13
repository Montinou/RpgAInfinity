'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Loader2,
  Gamepad2,
  Shield,
  Search,
  Building,
  RefreshCw,
  AlertCircle,
  WifiOff,
  XCircle,
  CheckCircle,
  Info,
  Home,
  ArrowLeft,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { clsx } from 'clsx';

// Generic Loading Spinner
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  label?: string;
}

export function LoadingSpinner({
  size = 'md',
  className,
  label,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12',
  };

  return (
    <div className={clsx('flex flex-col items-center gap-2', className)}>
      <Loader2
        className={clsx('text-primary animate-spin', sizeClasses[size])}
      />
      {label && <span className='text-muted-foreground text-sm'>{label}</span>}
    </div>
  );
}

// Game Type Loading Animation
interface GameLoadingProps {
  gameType: 'rpg' | 'deduction' | 'village';
  message?: string;
  progress?: number;
  className?: string;
}

const gameLoadingConfig = {
  rpg: {
    icon: Shield,
    gradient: 'from-amber-500 to-orange-500',
    messages: [
      'Forjando espadas legendarias...',
      'Generando mundos fantásticos...',
      'Despertando dragones antiguos...',
      'Preparando tu aventura épica...',
    ],
  },
  deduction: {
    icon: Search,
    gradient: 'from-purple-500 to-indigo-500',
    messages: [
      'Ocultando pistas misteriosas...',
      'Generando roles secretos...',
      'Preparando el escenario del crimen...',
      'Tejiendo la red de mentiras...',
    ],
  },
  village: {
    icon: Building,
    gradient: 'from-green-500 to-emerald-500',
    messages: [
      'Plantando campos de cultivo...',
      'Construyendo tu aldea...',
      'Generando NPCs únicos...',
      'Preparando las estaciones...',
    ],
  },
};

export function GameLoading({
  gameType,
  message,
  progress,
  className,
}: GameLoadingProps) {
  const config = gameLoadingConfig[gameType];
  const [currentMessage, setCurrentMessage] = React.useState(
    message || config.messages[0]
  );
  const Icon = config.icon;

  React.useEffect(() => {
    if (message) return;

    const interval = setInterval(() => {
      setCurrentMessage(prev => {
        const currentIndex = config.messages.indexOf(prev);
        const nextIndex = (currentIndex + 1) % config.messages.length;
        return config.messages[nextIndex];
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [message, config.messages]);

  return (
    <div className={clsx('py-12 text-center', className)}>
      <div className='mb-6'>
        <div
          className={clsx(
            'mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br',
            config.gradient
          )}
        >
          <motion.div
            animate={{
              rotate: 360,
              scale: [1, 1.1, 1],
            }}
            transition={{
              rotate: { duration: 2, repeat: Infinity, ease: 'linear' },
              scale: { duration: 1, repeat: Infinity },
            }}
          >
            <Icon className='h-10 w-10 text-white' />
          </motion.div>
        </div>
      </div>

      <motion.h3
        className='mb-2 text-xl font-semibold'
        key={currentMessage}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {currentMessage}
      </motion.h3>

      {progress !== undefined && (
        <div className='mx-auto mb-4 max-w-xs'>
          <div className='bg-muted h-2 w-full rounded-full'>
            <motion.div
              className={clsx(
                'h-2 rounded-full bg-gradient-to-r',
                config.gradient
              )}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <p className='text-muted-foreground mt-2 text-sm'>
            {Math.round(progress)}% completado
          </p>
        </div>
      )}

      <p className='text-muted-foreground'>
        Tu experiencia única se está generando...
      </p>
    </div>
  );
}

// Page Loading Skeleton
interface PageLoadingProps {
  type?: 'games' | 'lobby' | 'game' | 'generic';
  className?: string;
}

export function PageLoading({ type = 'generic', className }: PageLoadingProps) {
  if (type === 'games') {
    return (
      <div className={clsx('space-y-8', className)}>
        {/* Header Skeleton */}
        <div className='space-y-4'>
          <Skeleton className='h-10 w-96' />
          <Skeleton className='h-5 w-64' />
        </div>

        {/* Filters Skeleton */}
        <div className='flex gap-2'>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className='h-8 w-24' />
          ))}
        </div>

        {/* Games Grid Skeleton */}
        <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
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
                  <Skeleton className='h-10 w-full' />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'lobby') {
    return (
      <div className={clsx('space-y-6', className)}>
        {/* Lobby Header Skeleton */}
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
        </Card>

        {/* Players Grid Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className='h-6 w-32' />
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className='h-20 w-full' />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={clsx('space-y-4', className)}>
      <Skeleton className='h-8 w-3/4' />
      <Skeleton className='h-4 w-1/2' />
      <div className='space-y-2'>
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-2/3' />
      </div>
    </div>
  );
}

// Error States
interface ErrorStateProps {
  type?: 'generic' | 'network' | 'game-not-found' | 'forbidden' | 'maintenance';
  title?: string;
  message?: string;
  onRetry?: () => void;
  onGoHome?: () => void;
  className?: string;
}

const errorConfigs = {
  generic: {
    icon: AlertCircle,
    title: 'Algo salió mal',
    message: 'Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo.',
    color: 'text-destructive',
  },
  network: {
    icon: WifiOff,
    title: 'Sin conexión',
    message:
      'No hay conexión a internet. Verifica tu conexión y vuelve a intentarlo.',
    color: 'text-orange-500',
  },
  'game-not-found': {
    icon: XCircle,
    title: 'Partida no encontrada',
    message: 'La partida que buscas no existe o ha sido eliminada.',
    color: 'text-destructive',
  },
  forbidden: {
    icon: XCircle,
    title: 'Acceso denegado',
    message: 'No tienes permisos para acceder a esta partida.',
    color: 'text-destructive',
  },
  maintenance: {
    icon: Info,
    title: 'Mantenimiento programado',
    message:
      'El servicio está temporalmente no disponible por mantenimiento. Volveremos pronto.',
    color: 'text-blue-500',
  },
};

export function ErrorState({
  type = 'generic',
  title,
  message,
  onRetry,
  onGoHome,
  className,
}: ErrorStateProps) {
  const config = errorConfigs[type];
  const Icon = config.icon;

  return (
    <div className={clsx('py-16 text-center', className)}>
      <div className='mx-auto max-w-md'>
        <div className='mb-6'>
          <div className='bg-muted mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full'>
            <Icon className={clsx('h-10 w-10', config.color)} />
          </div>
        </div>

        <h3 className='mb-3 text-2xl font-bold'>{title || config.title}</h3>

        <p className='text-muted-foreground mb-8 leading-relaxed'>
          {message || config.message}
        </p>

        <div className='flex flex-col justify-center gap-3 sm:flex-row'>
          {onRetry && (
            <Button onClick={onRetry} className='flex items-center gap-2'>
              <RotateCcw className='h-4 w-4' />
              Intentar de nuevo
            </Button>
          )}

          {onGoHome && (
            <Button
              variant='outline'
              onClick={onGoHome}
              className='flex items-center gap-2'
            >
              <Home className='h-4 w-4' />
              Ir al inicio
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Success State
interface SuccessStateProps {
  title: string;
  message?: string;
  onContinue?: () => void;
  continueLabel?: string;
  className?: string;
}

export function SuccessState({
  title,
  message,
  onContinue,
  continueLabel = 'Continuar',
  className,
}: SuccessStateProps) {
  return (
    <div className={clsx('py-16 text-center', className)}>
      <div className='mx-auto max-w-md'>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            type: 'spring',
            stiffness: 260,
            damping: 20,
          }}
          className='mb-6'
        >
          <div className='mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900'>
            <CheckCircle className='h-10 w-10 text-green-600 dark:text-green-400' />
          </div>
        </motion.div>

        <h3 className='mb-3 text-2xl font-bold'>{title}</h3>

        {message && (
          <p className='text-muted-foreground mb-8 leading-relaxed'>
            {message}
          </p>
        )}

        {onContinue && (
          <Button onClick={onContinue} variant='game'>
            {continueLabel}
            <ArrowLeft className='ml-2 h-4 w-4 rotate-180' />
          </Button>
        )}
      </div>
    </div>
  );
}

// Empty State
interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon = Gamepad2,
  title,
  message,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={clsx('py-16 text-center', className)}>
      <div className='mx-auto max-w-md'>
        <div className='mb-6'>
          <div className='bg-muted mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full'>
            <Icon className='text-muted-foreground h-10 w-10' />
          </div>
        </div>

        <h3 className='mb-3 text-2xl font-bold'>{title}</h3>

        {message && (
          <p className='text-muted-foreground mb-8 leading-relaxed'>
            {message}
          </p>
        )}

        {onAction && actionLabel && (
          <Button onClick={onAction} variant='game'>
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

// Connection Status Indicator
interface ConnectionStatusProps {
  isConnected: boolean;
  isConnecting?: boolean;
  onRetry?: () => void;
  className?: string;
}

export function ConnectionStatus({
  isConnected,
  isConnecting = false,
  onRetry,
  className,
}: ConnectionStatusProps) {
  if (isConnected) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'bg-destructive text-destructive-foreground fixed left-1/2 top-4 z-50 -translate-x-1/2 transform rounded-lg px-4 py-2 shadow-lg',
        className
      )}
    >
      <div className='flex items-center gap-3'>
        {isConnecting ? (
          <Loader2 className='h-4 w-4 animate-spin' />
        ) : (
          <WifiOff className='h-4 w-4' />
        )}
        <span className='text-sm font-medium'>
          {isConnecting ? 'Reconectando...' : 'Sin conexión'}
        </span>
        {!isConnecting && onRetry && (
          <Button
            size='sm'
            variant='outline'
            onClick={onRetry}
            className='h-6 border-white/20 bg-white/10 px-2 text-xs hover:bg-white/20'
          >
            Reintentar
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// TODO: Add progress indicators for long-running operations
// TODO: Implement toast notifications for real-time updates
// TODO: Add offline state handling with service worker
// TODO: Create animated loading transitions between states
// TODO: Add loading state for voice/video features when implemented
// TODO: Implement retry logic with exponential backoff
