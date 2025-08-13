/**
 * GameBoard Component - World Map and Exploration Interface
 *
 * Provides an interactive world map showing:
 * - Connected locations with travel paths
 * - Current player position
 * - Location discovery status
 * - Interactive elements and points of interest
 * - Weather and environmental conditions
 * - Distance and travel time calculations
 */

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RPGGameState,
  Location,
  LocationFeature,
  Character,
  NPC,
  WeatherCondition,
  UUID,
} from '@/types/rpg';

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

interface GameBoardProps {
  gameState: RPGGameState;
  currentLocation: Location | null;
  onLocationSelect: (locationId: UUID) => void;
  onCharacterSelect: (characterId: UUID) => void;
  className?: string;
}

interface LocationNodeProps {
  location: Location;
  isCurrentLocation: boolean;
  isAccessible: boolean;
  isDiscovered: boolean;
  distanceFromCurrent: number;
  onSelect: () => void;
}

interface MapConnection {
  from: UUID;
  to: UUID;
  isAccessible: boolean;
  travelTime: number;
  difficulty: 'easy' | 'moderate' | 'hard' | 'extreme';
}

interface MapViewState {
  zoom: number;
  centerX: number;
  centerY: number;
  selectedLocation: UUID | null;
  showConnections: boolean;
  showWeather: boolean;
  showPaths: boolean;
}

// ============================================================================
// MAIN GAMEBOARD COMPONENT
// ============================================================================

export default function GameBoard({
  gameState,
  currentLocation,
  onLocationSelect,
  onCharacterSelect,
  className = '',
}: GameBoardProps) {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [mapView, setMapView] = useState<MapViewState>({
    zoom: 1.0,
    centerX: 0,
    centerY: 0,
    selectedLocation: currentLocation?.id || null,
    showConnections: true,
    showWeather: true,
    showPaths: true,
  });

  const [hoveredLocation, setHoveredLocation] = useState<UUID | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  // Generate map layout positions for locations
  const locationPositions = useMemo(() => {
    const positions = new Map<UUID, { x: number; y: number }>();
    const locations = gameState.data.world.locations;

    if (locations.length === 0) return positions;

    // Simple grid layout for now - TODO: Implement proper graph layout algorithm
    const gridSize = Math.ceil(Math.sqrt(locations.length));
    const cellWidth = 800 / gridSize;
    const cellHeight = 600 / gridSize;

    locations.forEach((location, index) => {
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;

      positions.set(location.id, {
        x: col * cellWidth + cellWidth / 2,
        y: row * cellHeight + cellHeight / 2,
      });
    });

    return positions;
  }, [gameState.data.world.locations]);

  // Calculate connections between locations
  const mapConnections = useMemo(() => {
    const connections: MapConnection[] = [];
    const locations = gameState.data.world.locations;

    locations.forEach(location => {
      location.connections.forEach(connectionId => {
        const targetLocation = locations.find(loc => loc.id === connectionId);
        if (targetLocation) {
          connections.push({
            from: location.id,
            to: connectionId,
            isAccessible: true, // TODO: Check accessibility conditions
            travelTime: calculateTravelTime(location, targetLocation),
            difficulty: determineTravelDifficulty(location, targetLocation),
          });
        }
      });
    });

    return connections;
  }, [gameState.data.world.locations]);

  // Get discovered locations
  const discoveredLocations = useMemo(() => {
    return new Set(
      gameState.data.world.locations
        .filter(loc => loc.isDiscovered)
        .map(loc => loc.id)
    );
  }, [gameState.data.world.locations]);

  // Get accessible locations from current position
  const accessibleLocations = useMemo(() => {
    if (!currentLocation) return new Set<UUID>();

    const accessible = new Set<UUID>([currentLocation.id]);

    // Add directly connected locations
    currentLocation.connections.forEach(connectionId => {
      accessible.add(connectionId);
    });

    return accessible;
  }, [currentLocation]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleLocationClick = useCallback(
    (locationId: UUID) => {
      if (!accessibleLocations.has(locationId)) {
        // TODO: Show path finding or travel requirements
        return;
      }

      setIsAnimating(true);
      onLocationSelect(locationId);
      setMapView(prev => ({ ...prev, selectedLocation: locationId }));

      // Reset animation state
      setTimeout(() => setIsAnimating(false), 500);
    },
    [accessibleLocations, onLocationSelect]
  );

  const handleMapPan = useCallback((deltaX: number, deltaY: number) => {
    setMapView(prev => ({
      ...prev,
      centerX: prev.centerX + deltaX,
      centerY: prev.centerY + deltaY,
    }));
  }, []);

  const handleZoom = useCallback((delta: number) => {
    setMapView(prev => ({
      ...prev,
      zoom: Math.max(0.5, Math.min(3.0, prev.zoom + delta)),
    }));
  }, []);

  const centerOnLocation = useCallback(
    (locationId: UUID) => {
      const position = locationPositions.get(locationId);
      if (position) {
        setMapView(prev => ({
          ...prev,
          centerX: -position.x + 400, // Center of 800px width
          centerY: -position.y + 300, // Center of 600px height
        }));
      }
    },
    [locationPositions]
  );

  // ============================================================================
  // LIFECYCLE EFFECTS
  // ============================================================================

  // Center on current location when it changes
  useEffect(() => {
    if (currentLocation) {
      centerOnLocation(currentLocation.id);
    }
  }, [currentLocation?.id, centerOnLocation]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderWeatherOverlay = () => {
    if (!mapView.showWeather || !gameState.data.weather) return null;

    const weather = gameState.data.weather;
    return (
      <div className='pointer-events-none absolute inset-0'>
        {weather.type === 'rain' && (
          <div className='absolute inset-0 bg-blue-500/10'>
            {/* Rain effect */}
            <div className='rain-animation'></div>
          </div>
        )}
        {weather.type === 'fog' && (
          <div className='absolute inset-0 bg-gray-500/20 backdrop-blur-sm'></div>
        )}
        {weather.type === 'storm' && (
          <div className='absolute inset-0 bg-purple-900/20'>
            {/* Storm effect */}
            <div className='lightning-flash'></div>
          </div>
        )}
      </div>
    );
  };

  const renderConnections = () => {
    if (!mapView.showConnections) return null;

    return (
      <svg className='pointer-events-none absolute inset-0 h-full w-full'>
        {mapConnections.map((connection, index) => {
          const fromPos = locationPositions.get(connection.from);
          const toPos = locationPositions.get(connection.to);

          if (!fromPos || !toPos) return null;

          const adjustedFromX = fromPos.x + mapView.centerX;
          const adjustedFromY = fromPos.y + mapView.centerY;
          const adjustedToX = toPos.x + mapView.centerX;
          const adjustedToY = toPos.y + mapView.centerY;

          return (
            <line
              key={`${connection.from}-${connection.to}-${index}`}
              x1={adjustedFromX}
              y1={adjustedFromY}
              x2={adjustedToX}
              y2={adjustedToY}
              stroke={connection.isAccessible ? '#8b5cf6' : '#6b7280'}
              strokeWidth={connection.isAccessible ? 2 : 1}
              strokeOpacity={connection.isAccessible ? 0.6 : 0.3}
              strokeDasharray={connection.isAccessible ? '0' : '5,5'}
            />
          );
        })}
      </svg>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div
      className={`relative h-full w-full overflow-hidden bg-gradient-to-br from-green-900/20 via-blue-900/20 to-purple-900/20 ${className}`}
    >
      {/* Map Controls */}
      <div className='absolute right-4 top-4 z-20 flex flex-col space-y-2'>
        <div className='rounded-lg bg-black/20 p-2 backdrop-blur-sm'>
          {/* Zoom Controls */}
          <div className='flex flex-col space-y-1'>
            <button
              onClick={() => handleZoom(0.2)}
              className='rounded p-1 text-white transition-colors hover:bg-white/20'
              title='Zoom In'
            >
              <svg
                className='h-4 w-4'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 4v16m8-8H4'
                />
              </svg>
            </button>
            <div className='text-center text-xs text-white'>
              {Math.round(mapView.zoom * 100)}%
            </div>
            <button
              onClick={() => handleZoom(-0.2)}
              className='rounded p-1 text-white transition-colors hover:bg-white/20'
              title='Zoom Out'
            >
              <svg
                className='h-4 w-4'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M20 12H4'
                />
              </svg>
            </button>
          </div>
        </div>

        {/* View Options */}
        <div className='space-y-1 rounded-lg bg-black/20 p-2 backdrop-blur-sm'>
          <button
            onClick={() =>
              setMapView(prev => ({
                ...prev,
                showConnections: !prev.showConnections,
              }))
            }
            className={`w-full rounded p-1 text-xs transition-colors ${
              mapView.showConnections
                ? 'bg-purple-600 text-white'
                : 'text-purple-200 hover:bg-white/20'
            }`}
          >
            Paths
          </button>
          <button
            onClick={() =>
              setMapView(prev => ({ ...prev, showWeather: !prev.showWeather }))
            }
            className={`w-full rounded p-1 text-xs transition-colors ${
              mapView.showWeather
                ? 'bg-blue-600 text-white'
                : 'text-blue-200 hover:bg-white/20'
            }`}
          >
            Weather
          </button>
        </div>
      </div>

      {/* Current Location Info */}
      <div className='absolute left-4 top-4 z-20 max-w-xs rounded-lg bg-black/20 p-3 backdrop-blur-sm'>
        <div className='text-white'>
          <h3 className='text-lg font-semibold'>
            {currentLocation?.name || 'Unknown Location'}
          </h3>
          <p className='mt-1 text-sm text-purple-200'>
            {currentLocation?.description || 'No description available'}
          </p>
          <div className='mt-2 flex items-center space-x-4 text-xs text-purple-300'>
            <span>Type: {currentLocation?.type || 'unknown'}</span>
            <span>•</span>
            <span>Time: {gameState.data.timeOfDay}:00</span>
          </div>
        </div>
      </div>

      {/* Weather Status */}
      {mapView.showWeather && gameState.data.weather && (
        <div className='absolute left-1/2 top-4 z-20 -translate-x-1/2 transform rounded-lg bg-black/20 px-3 py-2 backdrop-blur-sm'>
          <div className='flex items-center space-x-2 text-sm text-white'>
            <span className='capitalize'>{gameState.data.weather.type}</span>
            <span>•</span>
            <span className='capitalize'>
              {gameState.data.weather.intensity}
            </span>
            <div className='ml-2'>
              {gameState.data.weather.type === 'rain'
                ? '🌧️'
                : gameState.data.weather.type === 'storm'
                  ? '⛈️'
                  : gameState.data.weather.type === 'snow'
                    ? '❄️'
                    : gameState.data.weather.type === 'fog'
                      ? '🌫️'
                      : gameState.data.weather.type === 'cloudy'
                        ? '☁️'
                        : '☀️'}
            </div>
          </div>
        </div>
      )}

      {/* Map Container */}
      <div
        className='absolute inset-0 cursor-move'
        style={{
          transform: `scale(${mapView.zoom})`,
          transformOrigin: 'center',
        }}
      >
        {/* Weather Overlay */}
        {renderWeatherOverlay()}

        {/* Connection Lines */}
        {renderConnections()}

        {/* Location Nodes */}
        {gameState.data.world.locations.map(location => {
          const position = locationPositions.get(location.id);
          if (!position) return null;

          return (
            <LocationNode
              key={location.id}
              location={location}
              isCurrentLocation={currentLocation?.id === location.id}
              isAccessible={accessibleLocations.has(location.id)}
              isDiscovered={discoveredLocations.has(location.id)}
              distanceFromCurrent={0} // TODO: Calculate actual distance
              onSelect={() => handleLocationClick(location.id)}
              style={{
                position: 'absolute',
                left: position.x + mapView.centerX,
                top: position.y + mapView.centerY,
                transform: 'translate(-50%, -50%)',
              }}
              onMouseEnter={() => setHoveredLocation(location.id)}
              onMouseLeave={() => setHoveredLocation(null)}
            />
          );
        })}
      </div>

      {/* Location Details Tooltip */}
      <AnimatePresence>
        {hoveredLocation && (
          <LocationTooltip
            location={
              gameState.data.world.locations.find(
                l => l.id === hoveredLocation
              )!
            }
            isAccessible={accessibleLocations.has(hoveredLocation)}
            currentLocation={currentLocation}
          />
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className='absolute bottom-4 left-4 z-20 rounded-lg bg-black/20 p-3 backdrop-blur-sm'>
        <h4 className='mb-2 text-sm font-medium text-white'>Legend</h4>
        <div className='space-y-1 text-xs'>
          <div className='flex items-center space-x-2'>
            <div className='h-3 w-3 rounded-full bg-green-500'></div>
            <span className='text-green-200'>Current Location</span>
          </div>
          <div className='flex items-center space-x-2'>
            <div className='h-3 w-3 rounded-full bg-blue-500'></div>
            <span className='text-blue-200'>Accessible</span>
          </div>
          <div className='flex items-center space-x-2'>
            <div className='h-3 w-3 rounded-full bg-gray-500'></div>
            <span className='text-gray-300'>Undiscovered</span>
          </div>
          <div className='flex items-center space-x-2'>
            <div className='h-0.5 w-3 bg-purple-500'></div>
            <span className='text-purple-200'>Travel Path</span>
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {isAnimating && (
        <div className='absolute inset-0 z-30 flex items-center justify-center bg-black/20 backdrop-blur-sm'>
          <div className='flex items-center space-x-3 rounded-lg bg-black/40 p-4'>
            <div className='h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent'></div>
            <span className='text-white'>Traveling...</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// LOCATION NODE COMPONENT
// ============================================================================

interface LocationNodeProps extends React.HTMLAttributes<HTMLDivElement> {
  location: Location;
  isCurrentLocation: boolean;
  isAccessible: boolean;
  isDiscovered: boolean;
  distanceFromCurrent: number;
  onSelect: () => void;
}

const LocationNode: React.FC<LocationNodeProps> = ({
  location,
  isCurrentLocation,
  isAccessible,
  isDiscovered,
  distanceFromCurrent,
  onSelect,
  ...props
}) => {
  const getLocationIcon = () => {
    switch (location.type) {
      case 'town':
        return '🏘️';
      case 'castle':
        return '🏰';
      case 'dungeon':
        return '🗿';
      case 'forest':
        return '🌲';
      case 'mountain':
        return '⛰️';
      case 'cave':
        return '🕳️';
      case 'temple':
        return '⛩️';
      case 'ruins':
        return '🏛️';
      case 'tavern':
        return '🍺';
      case 'shop':
        return '🏪';
      default:
        return '📍';
    }
  };

  const getNodeColor = () => {
    if (isCurrentLocation) return 'bg-green-500 border-green-300';
    if (!isDiscovered) return 'bg-gray-600 border-gray-500';
    if (isAccessible) return 'bg-blue-500 border-blue-300';
    return 'bg-purple-500 border-purple-300';
  };

  return (
    <motion.div
      {...props}
      onClick={onSelect}
      className={`
        relative cursor-pointer select-none
        ${isAccessible ? 'hover:scale-110' : 'cursor-not-allowed'}
      `}
      whileHover={isAccessible ? { scale: 1.1 } : {}}
      whileTap={isAccessible ? { scale: 0.95 } : {}}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay: Math.random() * 0.5 }}
    >
      {/* Location Circle */}
      <div
        className={`
        flex h-10 w-10 items-center justify-center rounded-full border-2 shadow-lg
        ${getNodeColor()}
        ${isCurrentLocation ? 'animate-pulse' : ''}
        transition-all duration-300
      `}
      >
        <span className='text-lg'>{getLocationIcon()}</span>
      </div>

      {/* Location Name */}
      <div className='absolute -bottom-6 left-1/2 -translate-x-1/2 transform whitespace-nowrap'>
        <div className='rounded bg-black/60 px-2 py-1 text-xs text-white backdrop-blur-sm'>
          {isDiscovered ? location.name : '???'}
        </div>
      </div>

      {/* Features Indicator */}
      {location.features.length > 0 && isDiscovered && (
        <div className='absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500'>
          <span className='text-xs'>!</span>
        </div>
      )}

      {/* NPCs Indicator */}
      {location.npcs.length > 0 && isDiscovered && (
        <div className='absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-purple-500'>
          <span className='text-xs text-white'>{location.npcs.length}</span>
        </div>
      )}
    </motion.div>
  );
};

// ============================================================================
// LOCATION TOOLTIP COMPONENT
// ============================================================================

interface LocationTooltipProps {
  location: Location;
  isAccessible: boolean;
  currentLocation: Location | null;
}

const LocationTooltip: React.FC<LocationTooltipProps> = ({
  location,
  isAccessible,
  currentLocation,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className='pointer-events-none fixed bottom-20 left-1/2 z-30 max-w-sm -translate-x-1/2 transform rounded-lg bg-black/80 p-4 backdrop-blur-sm'
    >
      <div className='text-white'>
        <h4 className='flex items-center space-x-2 text-lg font-semibold'>
          <span>{location.name}</span>
          <span className='text-2xl'>
            {location.type === 'town'
              ? '🏘️'
              : location.type === 'castle'
                ? '🏰'
                : location.type === 'dungeon'
                  ? '🗿'
                  : location.type === 'forest'
                    ? '🌲'
                    : '📍'}
          </span>
        </h4>

        <p className='mt-1 text-sm text-purple-200'>{location.description}</p>

        <div className='mt-3 space-y-1 text-xs'>
          <div className='flex justify-between'>
            <span className='text-gray-300'>Type:</span>
            <span className='capitalize text-white'>{location.type}</span>
          </div>

          {location.isDiscovered && (
            <>
              {location.features.length > 0 && (
                <div className='flex justify-between'>
                  <span className='text-gray-300'>Features:</span>
                  <span className='text-yellow-300'>
                    {location.features.length}
                  </span>
                </div>
              )}

              {location.npcs.length > 0 && (
                <div className='flex justify-between'>
                  <span className='text-gray-300'>NPCs:</span>
                  <span className='text-purple-300'>
                    {location.npcs.length}
                  </span>
                </div>
              )}
            </>
          )}

          <div className='flex justify-between'>
            <span className='text-gray-300'>Status:</span>
            <span
              className={`${
                !location.isDiscovered
                  ? 'text-gray-400'
                  : isAccessible
                    ? 'text-green-400'
                    : 'text-red-400'
              }`}
            >
              {!location.isDiscovered
                ? 'Undiscovered'
                : isAccessible
                  ? 'Accessible'
                  : 'Blocked'}
            </span>
          </div>
        </div>

        {!isAccessible && location.isDiscovered && (
          <div className='mt-2 rounded bg-red-900/20 p-2 text-xs text-red-300'>
            This location is not currently accessible. You may need to complete
            certain requirements or find an alternative path.
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function calculateTravelTime(from: Location, to: Location): number {
  // TODO: Implement proper travel time calculation based on:
  // - Distance between locations
  // - Terrain difficulty
  // - Weather conditions
  // - Party movement speed
  // - Available transportation

  return Math.floor(Math.random() * 60) + 15; // 15-75 minutes placeholder
}

function determineTravelDifficulty(
  from: Location,
  to: Location
): 'easy' | 'moderate' | 'hard' | 'extreme' {
  // TODO: Implement difficulty calculation based on:
  // - Location types
  // - Environmental hazards
  // - Monster presence
  // - Required skills or items

  const difficulties: ('easy' | 'moderate' | 'hard' | 'extreme')[] = [
    'easy',
    'moderate',
    'hard',
    'extreme',
  ];
  return difficulties[Math.floor(Math.random() * difficulties.length)];
}
