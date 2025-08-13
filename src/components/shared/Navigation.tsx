'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Gamepad2, Home, Users, Settings, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clsx } from 'clsx';

const navItems = [
  {
    href: '/',
    label: 'Inicio',
    icon: Home,
    description: 'Página principal',
  },
  {
    href: '/games',
    label: 'Juegos',
    icon: Gamepad2,
    description: 'Seleccionar juego',
  },
  {
    href: '/community',
    label: 'Comunidad',
    icon: Users,
    description: 'Salas activas',
  },
];

interface NavigationProps {
  className?: string;
}

export default function Navigation({ className }: NavigationProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  return (
    <header
      className={clsx(
        'bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur',
        className
      )}
    >
      <div className='container mx-auto flex h-16 items-center justify-between px-4'>
        {/* Logo */}
        <Link
          href='/'
          className='flex items-center space-x-3 transition-opacity hover:opacity-80'
          aria-label='RpgAInfinity - Inicio'
        >
          <div className='relative'>
            <Gamepad2 className='text-primary h-8 w-8' />
            <div className='bg-primary/20 absolute -inset-1 animate-pulse rounded-full blur-sm' />
          </div>
          <div className='flex flex-col'>
            <span className='from-primary to-primary/70 bg-gradient-to-r bg-clip-text text-xl font-bold text-transparent'>
              RpgAInfinity
            </span>
            <span className='text-muted-foreground hidden text-xs sm:block'>
              Aventuras infinitas con IA
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav
          className='hidden items-center space-x-1 md:flex'
          role='navigation'
          aria-label='Navegación principal'
        >
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'relative flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200',
                  'hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
                  isActive
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-current={isActive ? 'page' : undefined}
                title={item.description}
              >
                <Icon className='h-4 w-4' />
                <span>{item.label}</span>
                {isActive && (
                  <motion.div
                    className='bg-primary/10 absolute inset-0 rounded-lg'
                    layoutId='activeTab'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Mobile Menu Button */}
        <Button
          variant='ghost'
          size='icon'
          className='md:hidden'
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={isMenuOpen}
          aria-controls='mobile-menu'
        >
          {isMenuOpen ? (
            <X className='h-6 w-6' />
          ) : (
            <Menu className='h-6 w-6' />
          )}
        </Button>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <motion.div
          id='mobile-menu'
          className='bg-background border-t md:hidden'
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
        >
          <nav
            className='container mx-auto space-y-2 px-4 py-4'
            role='navigation'
            aria-label='Navegación móvil'
          >
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'flex items-center space-x-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors',
                    'hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
                    isActive
                      ? 'text-primary bg-primary/10 border-primary/20 border'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => setIsMenuOpen(false)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className='h-5 w-5' />
                  <div className='flex flex-col'>
                    <span>{item.label}</span>
                    <span className='text-muted-foreground text-xs'>
                      {item.description}
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </motion.div>
      )}
    </header>
  );
}

// TODO: Add user authentication menu when auth is implemented
// TODO: Add notifications dropdown for game invites and updates
// TODO: Add theme toggle (light/dark mode)
// TODO: Add internationalization support for Spanish/English toggle
