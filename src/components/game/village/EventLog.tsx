/**
 * Village Event Log Component
 *
 * Displays historical event tracking and impact analysis
 * Provides detailed view of past events and their consequences
 */

'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  Users,
  Coins,
  Heart,
  Shield,
  TrendingUp,
  TrendingDown,
  Filter,
  Search,
  Eye,
  BarChart3,
  Archive,
  Scroll,
  AlertTriangle,
  Star,
} from 'lucide-react';
import {
  HistoricalEvent,
  EventType,
  EventSeverity,
  ImpactAssessment,
} from '@/types/village';

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

interface EventLogProps {
  events: HistoricalEvent[];
  villageName: string;
  onEventSelect?: (event: HistoricalEvent) => void;
  className?: string;
}

interface EventFilterState {
  type: EventType | 'all';
  severity: EventSeverity | 'all';
  timeframe: 'week' | 'month' | 'season' | 'year' | 'all';
  searchTerm: string;
  sortBy: 'date' | 'impact' | 'name';
  sortOrder: 'asc' | 'desc';
}

interface EventListItemProps {
  event: HistoricalEvent;
  onClick: () => void;
  isSelected: boolean;
}

interface EventDetailsProps {
  event: HistoricalEvent;
  onClose: () => void;
}

interface ImpactVisualizationProps {
  impact: ImpactAssessment;
  title: string;
  className?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function EventLog({
  events,
  villageName,
  onEventSelect,
  className = '',
}: EventLogProps) {
  const [filters, setFilters] = useState<EventFilterState>({
    type: 'all',
    severity: 'all',
    timeframe: 'all',
    searchTerm: '',
    sortBy: 'date',
    sortOrder: 'desc',
  });

  const [selectedEvent, setSelectedEvent] = useState<HistoricalEvent | null>(
    null
  );
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'timeline' | 'stats'>(
    'list'
  );

  // Filter and sort events
  const filteredEvents = useMemo(() => {
    let filtered = [...events];

    // Apply filters
    if (filters.type !== 'all') {
      filtered = filtered.filter(event => event.type === filters.type);
    }

    if (filters.severity !== 'all') {
      // Note: This assumes severity is available in historical events
      // TODO: Add severity field to HistoricalEvent type
      filtered = filtered.filter(
        event => (event as any).severity === filters.severity
      );
    }

    if (filters.timeframe !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();

      switch (filters.timeframe) {
        case 'week':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
        case 'season':
          cutoffDate.setMonth(now.getMonth() - 3);
          break;
        case 'year':
          cutoffDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      filtered = filtered.filter(event => event.date >= cutoffDate);
    }

    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(
        event =>
          event.name.toLowerCase().includes(term) ||
          event.consequences.some(c => c.toLowerCase().includes(term))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (filters.sortBy) {
        case 'date':
          comparison = a.date.getTime() - b.date.getTime();
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'impact':
          // Calculate total impact score
          const impactA =
            Math.abs(a.shortTermImpact.economic) +
            Math.abs(a.shortTermImpact.social) +
            Math.abs(a.shortTermImpact.political);
          const impactB =
            Math.abs(b.shortTermImpact.economic) +
            Math.abs(b.shortTermImpact.social) +
            Math.abs(b.shortTermImpact.political);
          comparison = impactA - impactB;
          break;
      }

      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [events, filters]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalEvents = events.length;
    const successfulEvents = events.filter(e => e.outcome.success).length;
    const avgEconomicImpact =
      events.reduce((sum, e) => sum + e.shortTermImpact.economic, 0) /
      totalEvents;
    const avgSocialImpact =
      events.reduce((sum, e) => sum + e.shortTermImpact.social, 0) /
      totalEvents;

    return {
      totalEvents,
      successfulEvents,
      successRate: totalEvents > 0 ? (successfulEvents / totalEvents) * 100 : 0,
      avgEconomicImpact,
      avgSocialImpact,
    };
  }, [events]);

  const handleEventSelect = (event: HistoricalEvent) => {
    setSelectedEvent(event);
    onEventSelect?.(event);
  };

  return (
    <div className={`rounded-lg bg-white shadow-lg ${className}`}>
      {/* Header */}
      <div className='border-b border-gray-200 p-4'>
        <div className='mb-3 flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <Scroll className='h-6 w-6 text-amber-600' />
            <div>
              <h2 className='text-lg font-bold text-gray-800'>
                Village Chronicle
              </h2>
              <p className='text-sm text-gray-600'>
                {villageName} • {events.length} recorded events
              </p>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className='flex items-center gap-2'>
            <div className='flex rounded-lg bg-gray-100 p-1'>
              {(['list', 'timeline', 'stats'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`
                    rounded-md px-3 py-1 text-sm font-medium transition-colors
                    ${
                      viewMode === mode
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }
                  `}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className='flex flex-wrap gap-3'>
          <div className='min-w-64 flex-1'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400' />
              <input
                type='text'
                placeholder='Search events...'
                value={filters.searchTerm}
                onChange={e =>
                  setFilters(prev => ({ ...prev, searchTerm: e.target.value }))
                }
                className='w-full rounded-md border border-gray-200 py-2 pl-10 pr-4 focus:border-transparent focus:ring-2 focus:ring-blue-500'
              />
            </div>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`
              flex items-center gap-2 rounded-md border px-4 py-2 transition-colors
              ${
                showFilters
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }
            `}
          >
            <Filter className='h-4 w-4' />
            Filters
          </button>
        </div>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className='mt-3 rounded-lg border bg-gray-50 p-4'
            >
              <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
                <div>
                  <label className='mb-1 block text-sm font-medium text-gray-700'>
                    Type
                  </label>
                  <select
                    value={filters.type}
                    onChange={e =>
                      setFilters(prev => ({
                        ...prev,
                        type: e.target.value as EventType | 'all',
                      }))
                    }
                    className='w-full rounded-md border border-gray-200 px-3 py-2 text-sm'
                  >
                    <option value='all'>All Types</option>
                    <option value='natural'>Natural</option>
                    <option value='social'>Social</option>
                    <option value='economic'>Economic</option>
                    <option value='military'>Military</option>
                    <option value='cultural'>Cultural</option>
                    <option value='political'>Political</option>
                  </select>
                </div>

                <div>
                  <label className='mb-1 block text-sm font-medium text-gray-700'>
                    Timeframe
                  </label>
                  <select
                    value={filters.timeframe}
                    onChange={e =>
                      setFilters(prev => ({
                        ...prev,
                        timeframe: e.target.value as any,
                      }))
                    }
                    className='w-full rounded-md border border-gray-200 px-3 py-2 text-sm'
                  >
                    <option value='all'>All Time</option>
                    <option value='week'>Past Week</option>
                    <option value='month'>Past Month</option>
                    <option value='season'>Past Season</option>
                    <option value='year'>Past Year</option>
                  </select>
                </div>

                <div>
                  <label className='mb-1 block text-sm font-medium text-gray-700'>
                    Sort By
                  </label>
                  <select
                    value={filters.sortBy}
                    onChange={e =>
                      setFilters(prev => ({
                        ...prev,
                        sortBy: e.target.value as any,
                      }))
                    }
                    className='w-full rounded-md border border-gray-200 px-3 py-2 text-sm'
                  >
                    <option value='date'>Date</option>
                    <option value='name'>Name</option>
                    <option value='impact'>Impact</option>
                  </select>
                </div>

                <div>
                  <label className='mb-1 block text-sm font-medium text-gray-700'>
                    Order
                  </label>
                  <select
                    value={filters.sortOrder}
                    onChange={e =>
                      setFilters(prev => ({
                        ...prev,
                        sortOrder: e.target.value as 'asc' | 'desc',
                      }))
                    }
                    className='w-full rounded-md border border-gray-200 px-3 py-2 text-sm'
                  >
                    <option value='desc'>Newest First</option>
                    <option value='asc'>Oldest First</option>
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content */}
      <div className='flex-1'>
        {viewMode === 'stats' && (
          <div className='p-6'>
            <EventStatistics stats={stats} events={events} />
          </div>
        )}

        {viewMode === 'list' && (
          <div className='max-h-96 overflow-y-auto'>
            {filteredEvents.length > 0 ? (
              <div className='divide-y divide-gray-100'>
                {filteredEvents.map(event => (
                  <EventListItem
                    key={event.eventId}
                    event={event}
                    onClick={() => handleEventSelect(event)}
                    isSelected={selectedEvent?.eventId === event.eventId}
                  />
                ))}
              </div>
            ) : (
              <div className='p-8 text-center text-gray-500'>
                <Archive className='mx-auto mb-3 h-12 w-12 text-gray-300' />
                <p>No events match your current filters.</p>
                <p className='text-sm'>Try adjusting your search criteria.</p>
              </div>
            )}
          </div>
        )}

        {viewMode === 'timeline' && (
          <div className='p-6'>
            <EventTimeline
              events={filteredEvents}
              onEventSelect={handleEventSelect}
            />
          </div>
        )}
      </div>

      {/* Event Details Modal */}
      <AnimatePresence>
        {selectedEvent && (
          <EventDetails
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// EVENT LIST ITEM COMPONENT
// ============================================================================

function EventListItem({ event, onClick, isSelected }: EventListItemProps) {
  const getEventIcon = (type: EventType) => {
    const icons = {
      natural: Calendar,
      social: Users,
      economic: Coins,
      military: Shield,
      cultural: Heart,
      political: Star,
      technological: TrendingUp,
      supernatural: AlertTriangle,
    };
    return icons[type] || Calendar;
  };

  const Icon = getEventIcon(event.type);
  const isPositive = event.outcome.success;
  const totalImpact =
    Math.abs(event.shortTermImpact.economic) +
    Math.abs(event.shortTermImpact.social) +
    Math.abs(event.shortTermImpact.political);

  return (
    <motion.div
      whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
      onClick={onClick}
      className={`
        cursor-pointer p-4 transition-all duration-200
        ${isSelected ? 'border-r-4 border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}
      `}
    >
      <div className='flex items-start gap-3'>
        <div
          className={`
          rounded-full p-2
          ${isPositive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}
        `}
        >
          <Icon className='h-4 w-4' />
        </div>

        <div className='min-w-0 flex-1'>
          <div className='mb-1 flex items-center justify-between'>
            <h4 className='truncate font-medium text-gray-900'>{event.name}</h4>
            <span className='ml-2 text-xs text-gray-500'>
              {event.date.toLocaleDateString()}
            </span>
          </div>

          <p className='mb-2 line-clamp-2 text-sm text-gray-600'>
            {event.outcome.description}
          </p>

          <div className='flex items-center gap-4 text-xs'>
            <div className='flex items-center gap-1'>
              <Clock className='h-3 w-3' />
              <span>
                {event.duration} day{event.duration !== 1 ? 's' : ''}
              </span>
            </div>

            {totalImpact > 0 && (
              <div className='flex items-center gap-1'>
                <BarChart3 className='h-3 w-3' />
                <span>Impact: {totalImpact.toFixed(1)}</span>
              </div>
            )}

            {event.commemorated && (
              <div className='flex items-center gap-1 text-amber-600'>
                <Star className='h-3 w-3' />
                <span>Commemorated</span>
              </div>
            )}
          </div>
        </div>

        <div className='flex items-center'>
          <Eye className='h-4 w-4 text-gray-400' />
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// EVENT DETAILS MODAL
// ============================================================================

function EventDetails({ event, onClose }: EventDetailsProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className='max-h-[80vh] w-full max-w-2xl overflow-auto rounded-lg bg-white shadow-xl'
        onClick={e => e.stopPropagation()}
      >
        <div className='p-6'>
          <div className='mb-4 flex items-center justify-between'>
            <h2 className='text-xl font-bold text-gray-900'>{event.name}</h2>
            <button
              onClick={onClose}
              className='rounded-full p-2 hover:bg-gray-100'
            >
              <X className='h-5 w-5' />
            </button>
          </div>

          <div className='space-y-6'>
            {/* Event Summary */}
            <div>
              <h3 className='mb-2 font-semibold text-gray-800'>
                Event Summary
              </h3>
              <div className='grid grid-cols-2 gap-4 text-sm'>
                <div>
                  <span className='text-gray-600'>Type:</span>{' '}
                  <span className='font-medium'>{event.type}</span>
                </div>
                <div>
                  <span className='text-gray-600'>Date:</span>{' '}
                  <span className='font-medium'>
                    {event.date.toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className='text-gray-600'>Duration:</span>{' '}
                  <span className='font-medium'>{event.duration} days</span>
                </div>
                <div>
                  <span className='text-gray-600'>Outcome:</span>{' '}
                  <span
                    className={`font-medium ${
                      event.outcome.success ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {event.outcome.success ? 'Success' : 'Failure'}
                  </span>
                </div>
              </div>
            </div>

            {/* Outcome Description */}
            <div>
              <h3 className='mb-2 font-semibold text-gray-800'>
                What Happened
              </h3>
              <p className='text-gray-700'>{event.outcome.description}</p>
            </div>

            {/* Consequences */}
            {event.consequences.length > 0 && (
              <div>
                <h3 className='mb-2 font-semibold text-gray-800'>
                  Consequences
                </h3>
                <ul className='space-y-1'>
                  {event.consequences.map((consequence, index) => (
                    <li key={index} className='flex items-start gap-2 text-sm'>
                      <div className='mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-gray-400' />
                      <span className='text-gray-700'>{consequence}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Impact Analysis */}
            <div className='grid gap-4 md:grid-cols-2'>
              <ImpactVisualization
                impact={event.shortTermImpact}
                title='Short-term Impact'
              />
              <ImpactVisualization
                impact={event.longTermImpact}
                title='Long-term Impact'
              />
            </div>

            {/* Lessons Learned */}
            {event.lessonsLearned.length > 0 && (
              <div>
                <h3 className='mb-2 font-semibold text-gray-800'>
                  Lessons Learned
                </h3>
                <ul className='space-y-1'>
                  {event.lessonsLearned.map((lesson, index) => (
                    <li key={index} className='flex items-start gap-2 text-sm'>
                      <Star className='mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500' />
                      <span className='text-gray-700'>{lesson}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// IMPACT VISUALIZATION COMPONENT
// ============================================================================

function ImpactVisualization({
  impact,
  title,
  className = '',
}: ImpactVisualizationProps) {
  const impacts = [
    { label: 'Economic', value: impact.economic, color: 'bg-green-500' },
    { label: 'Social', value: impact.social, color: 'bg-blue-500' },
    { label: 'Political', value: impact.political, color: 'bg-purple-500' },
    { label: 'Cultural', value: impact.cultural, color: 'bg-orange-500' },
  ];

  return (
    <div className={`rounded-lg bg-gray-50 p-4 ${className}`}>
      <h4 className='mb-3 font-medium text-gray-800'>{title}</h4>
      <div className='space-y-2'>
        {impacts.map(item => (
          <div key={item.label} className='flex items-center gap-3'>
            <span className='w-16 text-sm text-gray-600'>{item.label}</span>
            <div className='relative h-2 flex-1 rounded-full bg-gray-200'>
              <div
                className={`h-2 rounded-full ${item.color} ${
                  item.value < 0 ? 'opacity-60' : ''
                }`}
                style={{
                  width: `${Math.min(100, Math.abs(item.value))}%`,
                }}
              />
              {item.value < 0 && (
                <TrendingDown className='absolute right-1 top-0.5 h-3 w-3 text-red-500' />
              )}
              {item.value > 0 && (
                <TrendingUp className='absolute right-1 top-0.5 h-3 w-3 text-green-500' />
              )}
            </div>
            <span className='w-8 text-right font-mono text-sm'>
              {item.value > 0 ? '+' : ''}
              {item.value}
            </span>
          </div>
        ))}
      </div>
      <p className='mt-2 text-xs text-gray-600'>{impact.description}</p>
    </div>
  );
}

// ============================================================================
// STATISTICS COMPONENT
// ============================================================================

function EventStatistics({
  stats,
  events,
}: {
  stats: any;
  events: HistoricalEvent[];
}) {
  return (
    <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-4'>
      <div className='rounded-lg border border-blue-200 bg-blue-50 p-4'>
        <div className='mb-2 flex items-center gap-3'>
          <Archive className='h-5 w-5 text-blue-600' />
          <span className='font-medium text-blue-800'>Total Events</span>
        </div>
        <div className='text-2xl font-bold text-blue-900'>
          {stats.totalEvents}
        </div>
      </div>

      <div className='rounded-lg border border-green-200 bg-green-50 p-4'>
        <div className='mb-2 flex items-center gap-3'>
          <TrendingUp className='h-5 w-5 text-green-600' />
          <span className='font-medium text-green-800'>Success Rate</span>
        </div>
        <div className='text-2xl font-bold text-green-900'>
          {stats.successRate.toFixed(1)}%
        </div>
      </div>

      <div className='rounded-lg border border-amber-200 bg-amber-50 p-4'>
        <div className='mb-2 flex items-center gap-3'>
          <Coins className='h-5 w-5 text-amber-600' />
          <span className='font-medium text-amber-800'>
            Avg Economic Impact
          </span>
        </div>
        <div className='text-2xl font-bold text-amber-900'>
          {stats.avgEconomicImpact > 0 ? '+' : ''}
          {stats.avgEconomicImpact.toFixed(1)}
        </div>
      </div>

      <div className='rounded-lg border border-purple-200 bg-purple-50 p-4'>
        <div className='mb-2 flex items-center gap-3'>
          <Heart className='h-5 w-5 text-purple-600' />
          <span className='font-medium text-purple-800'>Avg Social Impact</span>
        </div>
        <div className='text-2xl font-bold text-purple-900'>
          {stats.avgSocialImpact > 0 ? '+' : ''}
          {stats.avgSocialImpact.toFixed(1)}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TIMELINE COMPONENT
// ============================================================================

function EventTimeline({
  events,
  onEventSelect,
}: {
  events: HistoricalEvent[];
  onEventSelect: (event: HistoricalEvent) => void;
}) {
  // TODO: Implement timeline visualization
  return (
    <div className='py-8 text-center'>
      <Calendar className='mx-auto mb-3 h-12 w-12 text-gray-300' />
      <p className='text-gray-500'>Timeline view coming soon...</p>
    </div>
  );
}
