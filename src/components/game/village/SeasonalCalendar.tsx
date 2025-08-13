/**
 * Village Seasonal Calendar Component
 *
 * Displays scheduled events, seasonal patterns, and upcoming village activities
 * Integrates with the event scheduling system for time-based events
 */

'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Leaf,
  Sun,
  Cloud,
  Snowflake,
  Plus,
  ChevronLeft,
  ChevronRight,
  Star,
  Bell,
  Gift,
  Zap,
  Heart,
  Coins,
} from 'lucide-react';
import { ScheduledEvent, SeasonType, Village } from '@/types/village';

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

interface SeasonalCalendarProps {
  scheduledEvents: ScheduledEvent[];
  currentSeason: SeasonType;
  currentDay: number;
  village: Village;
  onEventSchedule: (eventData: Partial<ScheduledEvent>) => void;
  onEventCancel: (eventId: string) => void;
  className?: string;
}

interface CalendarDay {
  date: Date;
  dayNumber: number;
  isCurrentDay: boolean;
  isInCurrentSeason: boolean;
  events: ScheduledEvent[];
  seasonalBonus?: SeasonalBonus;
}

interface SeasonalBonus {
  type: 'productivity' | 'happiness' | 'trade' | 'growth';
  modifier: number;
  description: string;
}

interface SeasonalTheme {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}

// ============================================================================
// SEASONAL THEMES AND CONFIGURATIONS
// ============================================================================

const SEASONAL_THEMES: Record<SeasonType, SeasonalTheme> = {
  spring: {
    name: 'Spring',
    icon: Leaf,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    description: 'Season of growth and renewal',
  },
  summer: {
    name: 'Summer',
    icon: Sun,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    description: 'Season of abundance and activity',
  },
  autumn: {
    name: 'Autumn',
    icon: Cloud,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    description: 'Season of harvest and preparation',
  },
  winter: {
    name: 'Winter',
    icon: Snowflake,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    description: 'Season of reflection and endurance',
  },
};

const SEASONAL_EVENTS = {
  spring: [
    {
      name: 'Planting Festival',
      type: 'cultural',
      icon: Leaf,
      description: 'Celebrate the growing season',
    },
    {
      name: 'New Arrivals',
      type: 'social',
      icon: Users,
      description: 'Welcome new residents',
    },
    {
      name: 'Trade Routes Open',
      type: 'economic',
      icon: Coins,
      description: 'Resume spring commerce',
    },
  ],
  summer: [
    {
      name: 'Midsummer Celebration',
      type: 'cultural',
      icon: Sun,
      description: 'Height of the season festival',
    },
    {
      name: 'Harvest Preparation',
      type: 'economic',
      icon: Star,
      description: 'Prepare for autumn harvest',
    },
    {
      name: 'Community Projects',
      type: 'social',
      icon: Heart,
      description: 'Major construction season',
    },
  ],
  autumn: [
    {
      name: 'Harvest Festival',
      type: 'cultural',
      icon: Gift,
      description: "Celebrate the year's bounty",
    },
    {
      name: 'Winter Preparations',
      type: 'economic',
      icon: Cloud,
      description: 'Stock resources for winter',
    },
    {
      name: 'Elder Councils',
      type: 'social',
      icon: Users,
      description: 'Plan for the cold season',
    },
  ],
  winter: [
    {
      name: 'Solstice Gathering',
      type: 'cultural',
      icon: Snowflake,
      description: 'Light in the darkness',
    },
    {
      name: 'Storytelling Season',
      type: 'cultural',
      icon: Star,
      description: 'Share tales and legends',
    },
    {
      name: 'Resource Conservation',
      type: 'economic',
      icon: Bell,
      description: 'Manage winter supplies',
    },
  ],
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SeasonalCalendar({
  scheduledEvents,
  currentSeason,
  currentDay,
  village,
  onEventSchedule,
  onEventCancel,
  className = '',
}: SeasonalCalendarProps) {
  const [viewMode, setViewMode] = useState<'month' | 'season' | 'year'>(
    'season'
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedSeason, setSelectedSeason] =
    useState<SeasonType>(currentSeason);

  const currentTheme = SEASONAL_THEMES[currentSeason];
  const viewTheme = SEASONAL_THEMES[selectedSeason];

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const days: CalendarDay[] = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - currentDay + 1); // Start of current season

    // Generate 90 days (approximate season length)
    for (let i = 0; i < 90; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      const dayEvents = scheduledEvents.filter(
        event => event.scheduledDate.toDateString() === date.toDateString()
      );

      const isCurrentDay = i === currentDay - 1;

      days.push({
        date,
        dayNumber: i + 1,
        isCurrentDay,
        isInCurrentSeason: true, // Simplified for demo
        events: dayEvents,
        seasonalBonus: getSeasonalBonus(i + 1, currentSeason, village),
      });
    }

    return days;
  }, [scheduledEvents, currentDay, currentSeason, village]);

  // Filter days for current view
  const displayDays = useMemo(() => {
    switch (viewMode) {
      case 'month':
        // Show 30 days around current day
        const start = Math.max(0, currentDay - 15);
        return calendarDays.slice(start, start + 30);
      case 'season':
        // Show full season
        return calendarDays;
      case 'year':
        // Show key events throughout the year (simplified)
        return calendarDays.filter(day => day.events.length > 0);
      default:
        return calendarDays;
    }
  }, [calendarDays, viewMode, currentDay]);

  // Upcoming events (next 7 days)
  const upcomingEvents = useMemo(() => {
    const upcoming = calendarDays
      .slice(currentDay - 1, currentDay + 6)
      .flatMap(day => day.events.map(event => ({ ...event, date: day.date })))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    return upcoming;
  }, [calendarDays, currentDay]);

  const handleEventSchedule = (eventData: Partial<ScheduledEvent>) => {
    onEventSchedule({
      ...eventData,
      scheduledDate: selectedDate || new Date(),
    });
    setShowEventModal(false);
    setSelectedDate(null);
  };

  return (
    <div
      className={`overflow-hidden rounded-lg bg-white shadow-lg ${className}`}
    >
      {/* Calendar Header */}
      <div
        className={`p-4 ${currentTheme.bgColor} ${currentTheme.borderColor} border-b`}
      >
        <div className='mb-3 flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <currentTheme.icon className={`h-6 w-6 ${currentTheme.color}`} />
            <div>
              <h2 className={`text-lg font-bold ${currentTheme.color}`}>
                Village Calendar
              </h2>
              <p className='text-sm text-gray-600'>
                {currentTheme.name} • Day {currentDay} • {village.name}
              </p>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className='flex rounded-lg bg-white p-1 shadow-sm'>
            {(['month', 'season', 'year'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`
                  rounded-md px-3 py-1 text-sm font-medium capitalize transition-colors
                  ${
                    viewMode === mode
                      ? `${currentTheme.bgColor} ${currentTheme.color}`
                      : 'text-gray-500 hover:text-gray-700'
                  }
                `}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Season Navigation */}
        <div className='flex items-center justify-center gap-4'>
          <button
            onClick={() => {
              const seasons: SeasonType[] = [
                'spring',
                'summer',
                'autumn',
                'winter',
              ];
              const currentIndex = seasons.indexOf(selectedSeason);
              setSelectedSeason(seasons[(currentIndex - 1 + 4) % 4]);
            }}
            className='rounded-full p-1 transition-colors hover:bg-white/50'
          >
            <ChevronLeft className='h-5 w-5' />
          </button>

          <div className='flex gap-2'>
            {(Object.keys(SEASONAL_THEMES) as SeasonType[]).map(season => {
              const theme = SEASONAL_THEMES[season];
              const isActive = season === selectedSeason;
              const isCurrent = season === currentSeason;

              return (
                <button
                  key={season}
                  onClick={() => setSelectedSeason(season)}
                  className={`
                    flex items-center gap-2 rounded-lg px-3 py-2 transition-all
                    ${isActive ? 'bg-white shadow-sm' : 'hover:bg-white/50'}
                    ${isCurrent ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}
                  `}
                >
                  <theme.icon className={`h-4 w-4 ${theme.color}`} />
                  <span className={`text-sm font-medium ${theme.color}`}>
                    {theme.name}
                  </span>
                  {isCurrent && (
                    <div className='h-2 w-2 rounded-full bg-blue-500' />
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => {
              const seasons: SeasonType[] = [
                'spring',
                'summer',
                'autumn',
                'winter',
              ];
              const currentIndex = seasons.indexOf(selectedSeason);
              setSelectedSeason(seasons[(currentIndex + 1) % 4]);
            }}
            className='rounded-full p-1 transition-colors hover:bg-white/50'
          >
            <ChevronRight className='h-5 w-5' />
          </button>
        </div>
      </div>

      {/* Calendar Content */}
      <div className='flex'>
        {/* Main Calendar */}
        <div className='flex-1 p-4'>
          <div className='mb-4 grid grid-cols-7 gap-1'>
            {/* Day Headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div
                key={day}
                className='p-2 text-center text-sm font-medium text-gray-500'
              >
                {day}
              </div>
            ))}

            {/* Calendar Days */}
            {displayDays.map(day => (
              <CalendarDayCell
                key={day.dayNumber}
                day={day}
                theme={viewTheme}
                onClick={() => {
                  setSelectedDate(day.date);
                  if (day.events.length > 0) {
                    // Show event details if events exist
                  } else {
                    setShowEventModal(true);
                  }
                }}
              />
            ))}
          </div>

          {/* Seasonal Events Suggestions */}
          <div
            className={`p-4 ${viewTheme.bgColor} ${viewTheme.borderColor} rounded-lg border`}
          >
            <h3 className={`font-semibold ${viewTheme.color} mb-3`}>
              Traditional {viewTheme.name} Events
            </h3>
            <div className='grid grid-cols-1 gap-3 md:grid-cols-3'>
              {SEASONAL_EVENTS[selectedSeason].map(event => (
                <button
                  key={event.name}
                  onClick={() =>
                    handleEventSchedule({
                      name: event.name,
                      description: event.description,
                      eventType: 'cultural',
                      isRecurring: true,
                    })
                  }
                  className='flex items-center gap-2 rounded-md bg-white p-2 text-left transition-colors hover:bg-gray-50'
                >
                  <event.icon className='h-4 w-4 text-gray-500' />
                  <div className='min-w-0 flex-1'>
                    <div className='truncate text-sm font-medium text-gray-900'>
                      {event.name}
                    </div>
                    <div className='truncate text-xs text-gray-500'>
                      {event.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className='w-80 border-l border-gray-200 bg-gray-50'>
          {/* Current Season Info */}
          <div className='border-b border-gray-200 p-4'>
            <div
              className={`p-3 ${currentTheme.bgColor} ${currentTheme.borderColor} rounded-lg border`}
            >
              <div className='mb-2 flex items-center gap-2'>
                <currentTheme.icon
                  className={`h-5 w-5 ${currentTheme.color}`}
                />
                <h3 className={`font-semibold ${currentTheme.color}`}>
                  Current Season
                </h3>
              </div>
              <p className='mb-2 text-sm text-gray-600'>
                {currentTheme.description}
              </p>
              <div className='flex items-center gap-4 text-xs'>
                <div className='flex items-center gap-1'>
                  <Clock className='h-3 w-3' />
                  <span>Day {currentDay}/90</span>
                </div>
                <div className='flex items-center gap-1'>
                  <Zap className='h-3 w-3' />
                  <span>Active bonuses: 3</span>
                </div>
              </div>
            </div>
          </div>

          {/* Upcoming Events */}
          <div className='p-4'>
            <div className='mb-3 flex items-center justify-between'>
              <h3 className='font-semibold text-gray-800'>Upcoming Events</h3>
              <button
                onClick={() => setShowEventModal(true)}
                className='flex items-center gap-1 rounded-md px-2 py-1 text-sm text-blue-600 transition-colors hover:bg-blue-50'
              >
                <Plus className='h-3 w-3' />
                Add Event
              </button>
            </div>

            <div className='space-y-2'>
              {upcomingEvents.length > 0 ? (
                upcomingEvents.map(event => (
                  <div
                    key={event.eventId}
                    className='flex items-start gap-3 rounded-md border border-gray-100 bg-white p-2'
                  >
                    <div className='flex-shrink-0'>
                      <div className='mt-2 h-2 w-2 rounded-full bg-blue-500' />
                    </div>
                    <div className='min-w-0 flex-1'>
                      <div className='truncate text-sm font-medium text-gray-900'>
                        {event.name}
                      </div>
                      <div className='text-xs text-gray-500'>
                        {event.date.toLocaleDateString()} • {event.eventType}
                      </div>
                      <div className='mt-1 text-xs text-gray-600'>
                        {event.description}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className='py-4 text-center text-sm text-gray-500'>
                  No upcoming events scheduled
                </p>
              )}
            </div>
          </div>

          {/* Seasonal Bonuses */}
          <div className='border-t border-gray-200 p-4'>
            <h3 className='mb-3 font-semibold text-gray-800'>
              Seasonal Effects
            </h3>
            <div className='space-y-2'>
              {getSeasonalEffects(currentSeason, village).map(
                (effect, index) => (
                  <div key={index} className='flex items-center gap-2 text-sm'>
                    <div
                      className={`h-2 w-2 rounded-full ${
                        effect.modifier > 0 ? 'bg-green-400' : 'bg-red-400'
                      }`}
                    />
                    <span className='text-gray-700'>{effect.description}</span>
                    <span
                      className={`ml-auto font-mono ${
                        effect.modifier > 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {effect.modifier > 0 ? '+' : ''}
                      {effect.modifier}%
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Event Scheduling Modal */}
      <AnimatePresence>
        {showEventModal && (
          <EventSchedulingModal
            selectedDate={selectedDate}
            onSchedule={handleEventSchedule}
            onCancel={() => {
              setShowEventModal(false);
              setSelectedDate(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// CALENDAR DAY CELL COMPONENT
// ============================================================================

interface CalendarDayCell {
  day: CalendarDay;
  theme: SeasonalTheme;
  onClick: () => void;
}

function CalendarDayCell({ day, theme, onClick }: CalendarDayCell) {
  const hasEvents = day.events.length > 0;
  const hasBonus = day.seasonalBonus !== undefined;

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`
        relative min-h-16 cursor-pointer rounded-md border border-gray-200 p-2 transition-all
        ${
          day.isCurrentDay
            ? `${theme.bgColor} ${theme.borderColor} border-2`
            : hasEvents
              ? 'border-blue-200 bg-blue-50'
              : 'bg-white hover:bg-gray-50'
        }
      `}
    >
      {/* Day Number */}
      <div
        className={`text-sm font-medium ${
          day.isCurrentDay
            ? theme.color
            : hasEvents
              ? 'text-blue-700'
              : 'text-gray-700'
        }`}
      >
        {day.dayNumber}
      </div>

      {/* Event Indicators */}
      {hasEvents && (
        <div className='absolute right-1 top-1 flex gap-1'>
          {day.events.slice(0, 3).map((event, index) => (
            <div
              key={index}
              className='h-2 w-2 rounded-full bg-blue-500'
              title={event.name}
            />
          ))}
          {day.events.length > 3 && (
            <div className='text-xs text-gray-500'>
              +{day.events.length - 3}
            </div>
          )}
        </div>
      )}

      {/* Seasonal Bonus Indicator */}
      {hasBonus && (
        <div className='absolute bottom-1 left-1'>
          <Star className='h-3 w-3 text-yellow-500' />
        </div>
      )}

      {/* Event Names */}
      {hasEvents && (
        <div className='mt-1 space-y-0.5'>
          {day.events.slice(0, 2).map(event => (
            <div key={event.eventId} className='truncate text-xs text-blue-600'>
              {event.name}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ============================================================================
// EVENT SCHEDULING MODAL
// ============================================================================

interface EventSchedulingModalProps {
  selectedDate: Date | null;
  onSchedule: (eventData: Partial<ScheduledEvent>) => void;
  onCancel: () => void;
}

function EventSchedulingModal({
  selectedDate,
  onSchedule,
  onCancel,
}: EventSchedulingModalProps) {
  const [eventData, setEventData] = useState({
    name: '',
    description: '',
    eventType: 'cultural' as const,
    isRecurring: false,
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className='w-full max-w-md rounded-lg bg-white shadow-xl'
        onClick={e => e.stopPropagation()}
      >
        <div className='border-b border-gray-200 p-4'>
          <h2 className='text-lg font-bold text-gray-900'>Schedule Event</h2>
          <p className='text-sm text-gray-600'>
            {selectedDate ? selectedDate.toLocaleDateString() : 'Select a date'}
          </p>
        </div>

        <div className='space-y-4 p-4'>
          <div>
            <label className='mb-1 block text-sm font-medium text-gray-700'>
              Event Name
            </label>
            <input
              type='text'
              value={eventData.name}
              onChange={e =>
                setEventData(prev => ({ ...prev, name: e.target.value }))
              }
              className='w-full rounded-md border border-gray-200 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500'
              placeholder='Enter event name...'
            />
          </div>

          <div>
            <label className='mb-1 block text-sm font-medium text-gray-700'>
              Description
            </label>
            <textarea
              value={eventData.description}
              onChange={e =>
                setEventData(prev => ({ ...prev, description: e.target.value }))
              }
              className='w-full rounded-md border border-gray-200 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500'
              rows={3}
              placeholder='Describe the event...'
            />
          </div>

          <div>
            <label className='mb-1 block text-sm font-medium text-gray-700'>
              Event Type
            </label>
            <select
              value={eventData.eventType}
              onChange={e =>
                setEventData(prev => ({
                  ...prev,
                  eventType: e.target.value as any,
                }))
              }
              className='w-full rounded-md border border-gray-200 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500'
            >
              <option value='cultural'>Cultural</option>
              <option value='economic'>Economic</option>
              <option value='social'>Social</option>
              <option value='political'>Political</option>
            </select>
          </div>

          <div className='flex items-center gap-2'>
            <input
              type='checkbox'
              id='recurring'
              checked={eventData.isRecurring}
              onChange={e =>
                setEventData(prev => ({
                  ...prev,
                  isRecurring: e.target.checked,
                }))
              }
              className='h-4 w-4 text-blue-600'
            />
            <label htmlFor='recurring' className='text-sm text-gray-700'>
              Recurring event (repeat each season)
            </label>
          </div>
        </div>

        <div className='flex justify-end gap-3 border-t border-gray-200 p-4'>
          <button
            onClick={onCancel}
            className='px-4 py-2 text-gray-600 transition-colors hover:text-gray-800'
          >
            Cancel
          </button>
          <button
            onClick={() => onSchedule(eventData)}
            disabled={!eventData.name.trim()}
            className='rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'
          >
            Schedule Event
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getSeasonalBonus(
  day: number,
  season: SeasonType,
  village: Village
): SeasonalBonus | undefined {
  // Example seasonal bonuses based on day and village conditions
  switch (season) {
    case 'spring':
      if (day >= 15 && day <= 45) {
        return {
          type: 'growth',
          modifier: 25,
          description: 'Spring growth bonus',
        };
      }
      break;
    case 'summer':
      if (day >= 20 && day <= 50) {
        return {
          type: 'productivity',
          modifier: 20,
          description: 'Summer productivity bonus',
        };
      }
      break;
    case 'autumn':
      if (day >= 10 && day <= 40) {
        return {
          type: 'trade',
          modifier: 30,
          description: 'Harvest trade bonus',
        };
      }
      break;
    case 'winter':
      return {
        type: 'happiness',
        modifier: -10,
        description: 'Winter morale challenge',
      };
  }
  return undefined;
}

function getSeasonalEffects(season: SeasonType, village: Village) {
  const effects = [];

  switch (season) {
    case 'spring':
      effects.push(
        { modifier: 15, description: 'Population growth rate' },
        { modifier: 10, description: 'Food production' },
        { modifier: -5, description: 'Construction costs' }
      );
      break;
    case 'summer':
      effects.push(
        { modifier: 20, description: 'Overall productivity' },
        { modifier: 25, description: 'Trade opportunities' },
        { modifier: 5, description: 'Village happiness' }
      );
      break;
    case 'autumn':
      effects.push(
        { modifier: 30, description: 'Harvest yields' },
        { modifier: 15, description: 'Resource storage efficiency' },
        { modifier: -10, description: 'Construction speed' }
      );
      break;
    case 'winter':
      effects.push(
        { modifier: -15, description: 'Food consumption' },
        { modifier: -20, description: 'Building efficiency' },
        { modifier: 10, description: 'Community bonding' }
      );
      break;
  }

  return effects;
}
