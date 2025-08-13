/**
 * Village Game Components Export Index
 *
 * Centralizes exports for all Village Simulator UI components
 * Provides clean imports for event management interfaces
 */

// Event Management Components
export { default as EventNotification } from './EventNotification';
export { default as EventLog } from './EventLog';
export { default as CrisisManager } from './CrisisManager';
export { default as SeasonalCalendar } from './SeasonalCalendar';

// Re-export utility functions for component integration
export {
  formatTimeRemaining,
  getEventUrgency,
  calculateChoiceScore,
} from './EventNotification';

// Export types for component props (if needed by other components)
export type {} from // Add component prop types here if they need to be imported elsewhere
'./EventNotification';

/**
 * Default event management component bundle
 * Use this for complete village event system integration
 */
export const VillageEventComponents = {
  EventNotification,
  EventLog,
  CrisisManager,
  SeasonalCalendar,
} as const;

/**
 * Component usage examples and integration notes
 *
 * @example Basic Event System Integration
 * ```tsx
 * import {
 *   EventNotification,
 *   EventLog,
 *   CrisisManager,
 *   SeasonalCalendar
 * } from '@/components/game/village';
 *
 * function VillageManagementInterface() {
 *   return (
 *     <div>
 *       <EventNotification
 *         event={currentEvent}
 *         isVisible={showEvent}
 *         onChoiceSelected={handleChoice}
 *         onDismiss={() => setShowEvent(false)}
 *         village={village}
 *       />
 *
 *       <CrisisManager
 *         activeEvents={crisisEvents}
 *         village={village}
 *         onEmergencyResponse={handleEmergencyResponse}
 *       />
 *
 *       <EventLog
 *         events={eventHistory}
 *         villageName={village.name}
 *         onEventSelect={handleEventDetails}
 *       />
 *
 *       <SeasonalCalendar
 *         scheduledEvents={upcomingEvents}
 *         currentSeason={village.season.current}
 *         currentDay={village.age}
 *         village={village}
 *         onEventSchedule={handleEventSchedule}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */

//TODO: Add village-specific hooks for event state management
//TODO: Create event notification queue manager for multiple simultaneous events
//TODO: Implement event sound effects and visual feedback system
//TODO: Add accessibility features for screen readers and keyboard navigation
//TODO: Create event template system for community-generated content
