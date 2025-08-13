'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Gamepad2,
  Users,
  Sparkles,
  ArrowRight,
  Shield,
  Building,
  Search,
  Star,
  Clock,
  Heart,
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
import Navigation from '@/components/shared/Navigation';

const gameTypes = [
  {
    id: 'rpg',
    title: 'RPG Cooperativo',
    description:
      'Embárcate en aventuras épicas con tu familia. Crea personajes, explora mundos fantásticos y vive historias únicas generadas por IA.',
    icon: Shield,
    color: 'from-amber-500 to-orange-500',
    features: [
      'Aventuras generadas por IA',
      'Personajes personalizables',
      'Cooperación familiar',
    ],
    difficulty: 'Fácil - Intermedio',
    duration: '30-120 min',
    players: '2-6 jugadores',
  },
  {
    id: 'deduction',
    title: 'Deducción Social',
    description:
      'Resuelve misterios y desentraña secretos en juegos de deducción donde cada pista cuenta y la comunicación es clave.',
    icon: Search,
    color: 'from-purple-500 to-indigo-500',
    features: ['Misterios únicos', 'Roles secretos', 'Deducción lógica'],
    difficulty: 'Intermedio - Avanzado',
    duration: '20-60 min',
    players: '3-8 jugadores',
  },
  {
    id: 'village',
    title: 'Simulador Villa',
    description:
      'Construye y gestiona tu propia aldea medieval. Toma decisiones estratégicas y ve cómo tu comunidad prospera a través de las estaciones.',
    icon: Building,
    color: 'from-green-500 to-emerald-500',
    features: [
      'Gestión de recursos',
      'Decisiones estratégicas',
      'Simulación realista',
    ],
    difficulty: 'Fácil - Intermedio',
    duration: '45-90 min',
    players: '2-4 jugadores',
  },
];

const features = [
  {
    icon: Sparkles,
    title: 'IA Generativa',
    description:
      'Cada partida es única gracias a nuestra avanzada inteligencia artificial que crea contenido dinámico.',
  },
  {
    icon: Users,
    title: 'Para toda la familia',
    description:
      'Diseñado para que padres e hijos disfruten juntos, con mecánicas accesibles para todas las edades.',
  },
  {
    icon: Heart,
    title: 'Experiencias memorables',
    description:
      'Crea recuerdos únicos con historias que solo tu familia vivirá, generadas especialmente para vosotros.',
  },
];

export default function HomePage() {
  return (
    <div className='bg-background min-h-screen'>
      <Navigation />

      <main className='relative'>
        {/* Hero Section */}
        <section className='from-background via-background to-primary/5 relative overflow-hidden bg-gradient-to-br'>
          {/* Background Effects */}
          <div className='absolute inset-0'>
            <div className='bg-primary/10 absolute left-10 top-20 h-72 w-72 animate-pulse rounded-full mix-blend-multiply blur-xl filter' />
            <div className='animation-delay-2000 absolute right-10 top-40 h-72 w-72 animate-pulse rounded-full bg-purple-300/10 mix-blend-multiply blur-xl filter' />
            <div className='animation-delay-4000 absolute -bottom-8 left-20 h-72 w-72 animate-pulse rounded-full bg-orange-300/10 mix-blend-multiply blur-xl filter' />
          </div>

          <div className='container relative mx-auto px-4 py-20 lg:py-32'>
            <div className='mx-auto max-w-4xl text-center'>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className='mb-8'
              >
                <Badge
                  variant='outline'
                  className='mb-6 px-4 py-2 text-sm font-medium'
                >
                  🚀 Bienvenidos a la nueva era de los juegos familiares
                </Badge>

                <h1 className='from-primary via-primary to-primary/70 bg-gradient-to-r bg-clip-text text-4xl font-bold leading-tight text-transparent md:text-6xl lg:text-7xl'>
                  Aventuras infinitas
                  <br />
                  <span className='text-foreground'>para toda la familia</span>
                </h1>
              </motion.div>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className='text-muted-foreground mb-8 text-xl leading-relaxed md:text-2xl'
              >
                Descubre un mundo de juegos de mesa digitales potenciados por IA
                que crean experiencias únicas cada vez que juegas.
                <span className='text-foreground font-medium'>
                  {' '}
                  RPG cooperativos, misterios de deducción y simuladores de
                  aldeas
                </span>{' '}
                esperan a tu familia.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className='flex flex-col items-center justify-center gap-4 sm:flex-row'
              >
                <Button asChild size='xl' variant='game' className='group'>
                  <Link href='/games'>
                    <Gamepad2 className='mr-2 h-5 w-5' />
                    Comenzar a Jugar
                    <ArrowRight className='ml-2 h-4 w-4 transition-transform group-hover:translate-x-1' />
                  </Link>
                </Button>

                <Button asChild size='xl' variant='outline'>
                  <Link href='#game-types'>Explorar Juegos</Link>
                </Button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className='text-muted-foreground mt-12 flex items-center justify-center space-x-6 text-sm'
              >
                <div className='flex items-center space-x-2'>
                  <Star className='h-4 w-4 text-yellow-500' />
                  <span>Creado por familias, para familias</span>
                </div>
                <div className='flex items-center space-x-2'>
                  <Users className='h-4 w-4 text-blue-500' />
                  <span>2-8 jugadores</span>
                </div>
                <div className='flex items-center space-x-2'>
                  <Clock className='h-4 w-4 text-green-500' />
                  <span>20-120 minutos</span>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className='bg-muted/20 py-20'>
          <div className='container mx-auto px-4'>
            <div className='mb-16 text-center'>
              <h2 className='mb-4 text-3xl font-bold md:text-4xl'>
                ¿Por qué elegir RpgAInfinity?
              </h2>
              <p className='text-muted-foreground mx-auto max-w-2xl text-xl'>
                Combinamos la magia de los juegos de mesa tradicionales con el
                poder de la inteligencia artificial moderna.
              </p>
            </div>

            <div className='mx-auto grid max-w-4xl gap-8 md:grid-cols-3'>
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.2 }}
                >
                  <Card className='h-full text-center transition-shadow duration-300 hover:shadow-lg'>
                    <CardHeader>
                      <div className='bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full'>
                        <feature.icon className='text-primary h-8 w-8' />
                      </div>
                      <CardTitle className='text-xl'>{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className='text-base leading-relaxed'>
                        {feature.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Game Types Section */}
        <section id='game-types' className='py-20'>
          <div className='container mx-auto px-4'>
            <div className='mb-16 text-center'>
              <h2 className='mb-4 text-3xl font-bold md:text-4xl'>
                Tres mundos de aventuras esperan
              </h2>
              <p className='text-muted-foreground mx-auto max-w-2xl text-xl'>
                Cada tipo de juego ofrece una experiencia completamente
                diferente, diseñada para crear momentos únicos en familia.
              </p>
            </div>

            <div className='grid gap-8 lg:grid-cols-3'>
              {gameTypes.map((game, index) => (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.2 }}
                >
                  <Card className='hover:border-primary/20 group h-full cursor-pointer border-2 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl'>
                    <CardHeader>
                      <div
                        className={`h-16 w-16 rounded-xl bg-gradient-to-br ${game.color} mb-4 flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}
                      >
                        <game.icon className='h-8 w-8 text-white' />
                      </div>
                      <div className='mb-2 flex items-center justify-between'>
                        <CardTitle className='text-2xl'>{game.title}</CardTitle>
                        <Badge variant='outline'>{game.difficulty}</Badge>
                      </div>
                      <div className='text-muted-foreground mb-4 flex items-center space-x-4 text-sm'>
                        <div className='flex items-center space-x-1'>
                          <Users className='h-4 w-4' />
                          <span>{game.players}</span>
                        </div>
                        <div className='flex items-center space-x-1'>
                          <Clock className='h-4 w-4' />
                          <span>{game.duration}</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                      <CardDescription className='text-base leading-relaxed'>
                        {game.description}
                      </CardDescription>

                      <div className='space-y-2'>
                        <h4 className='text-sm font-semibold'>
                          Características destacadas:
                        </h4>
                        <ul className='space-y-1'>
                          {game.features.map(feature => (
                            <li
                              key={feature}
                              className='flex items-center space-x-2 text-sm'
                            >
                              <div className='bg-primary h-1.5 w-1.5 rounded-full' />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            <div className='mt-12 text-center'>
              <Button asChild size='lg' variant='game'>
                <Link href='/games'>
                  <Gamepad2 className='mr-2 h-5 w-5' />
                  Explorar todos los juegos
                  <ArrowRight className='ml-2 h-4 w-4' />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className='from-primary/10 to-primary/10 bg-gradient-to-r via-purple-500/10 py-20'>
          <div className='container mx-auto px-4 text-center'>
            <h2 className='mb-6 text-3xl font-bold md:text-4xl'>
              ¿Listos para la aventura?
            </h2>
            <p className='text-muted-foreground mx-auto mb-8 max-w-2xl text-xl'>
              Únete a miles de familias que ya están creando recuerdos únicos
              con RpgAInfinity. Tu próxima gran aventura está a solo un clic de
              distancia.
            </p>
            <Button asChild size='xl' variant='game' className='group'>
              <Link href='/games'>
                <Sparkles className='mr-2 h-5 w-5' />
                Comenzar ahora - ¡Es gratis!
                <ArrowRight className='ml-2 h-4 w-4 transition-transform group-hover:translate-x-1' />
              </Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}

// TODO: Add testimonials section with family reviews
// TODO: Implement analytics tracking for CTA button clicks
// TODO: Add FAQ section for common questions
// TODO: Add social proof section (number of active families/games played)
// TODO: Implement SEO optimization with proper meta tags
// TODO: Add newsletter signup for game updates and new features
