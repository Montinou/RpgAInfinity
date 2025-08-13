/**
 * Village NPC Management API Endpoint
 * GET /api/game/village/[id]/npcs - Get all NPCs with their current state
 *
 * Provides comprehensive NPC information including current activities,
 * relationships, mood, and AI-driven behavior patterns
 */

import { NextRequest, NextResponse } from 'next/server';
import { kvService } from '@/lib/database';
import { NPCBehaviorSystem } from '@/lib/games/village/npcs';
import {
  Village,
  VillageGameState,
  NPC,
  Resident,
  SocialRelation,
} from '@/types/village';

interface NPCStatus {
  id: string;
  name: string;
  age: number;
  profession: string;
  currentActivity: {
    action: string;
    location?: string;
    duration: number;
    progress: number;
  };
  mood: {
    current: 'happy' | 'neutral' | 'sad' | 'angry' | 'excited' | 'worried';
    factors: string[];
    stability: number;
  };
  relationships: Array<{
    targetId: string;
    targetName: string;
    type: 'friend' | 'family' | 'rival' | 'romantic' | 'professional';
    strength: number;
    recentChanges: number;
  }>;
  skills: Array<{
    skill: string;
    level: number;
    experience: number;
    recentGrowth: number;
  }>;
  needs: {
    basic: { food: number; shelter: number; safety: number };
    social: { companionship: number; respect: number; purpose: number };
    urgent: string[];
  };
  contribution: {
    productivity: number;
    economicImpact: number;
    socialInfluence: number;
    recentAchievements: string[];
  };
  aiPersonality?: {
    traits: Record<string, number>;
    decisionTendencies: string[];
    quirks: string[];
  };
}

/**
 * Convert Resident to NPCStatus with current activity analysis
 */
function analyzeNPCStatus(
  resident: Resident,
  village: Village,
  gameState: VillageGameState
): NPCStatus {
  // Determine current activity based on time of day and profession
  const currentHour = new Date().getHours();
  let currentActivity = {
    action: 'sleeping',
    duration: 8,
    progress: 0,
  };

  if (currentHour >= 6 && currentHour < 18) {
    currentActivity = {
      action: resident.employment ? 'working' : 'idle',
      location: resident.employment?.buildingId,
      duration: resident.employment?.workHours || 8,
      progress: Math.round(((currentHour - 8) / 8) * 100),
    };
  } else if (currentHour >= 18 && currentHour < 22) {
    currentActivity = {
      action: 'socializing',
      duration: 4,
      progress: Math.round(((currentHour - 18) / 4) * 100),
    };
  }

  // Analyze mood based on needs and recent events
  let mood: 'happy' | 'neutral' | 'sad' | 'angry' | 'excited' | 'worried' =
    'neutral';
  const moodFactors: string[] = [];

  if (resident.happiness > 80) {
    mood = 'happy';
    moodFactors.push('High overall satisfaction');
  } else if (resident.happiness < 30) {
    mood = 'sad';
    moodFactors.push('Low overall satisfaction');
  }

  if (resident.needs.urgentNeeds.length > 0) {
    mood = 'worried';
    moodFactors.push(
      `Urgent needs: ${resident.needs.urgentNeeds.map(n => n.type).join(', ')}`
    );
  }

  if (resident.health < 50) {
    mood = mood === 'happy' ? 'neutral' : 'worried';
    moodFactors.push('Poor health');
  }

  if (
    village.currentEvents.some(
      e => e.severity === 'major' || e.severity === 'catastrophic'
    )
  ) {
    mood = mood === 'happy' ? 'worried' : mood;
    moodFactors.push('Village crisis affecting mood');
  }

  // Calculate relationships with other residents
  const relationships = resident.friends.map(friend => ({
    targetId: friend.residentId,
    targetName:
      village.residents.find(r => r.id === friend.residentId)?.name ||
      'Unknown',
    type: friend.relationship,
    strength: friend.strength,
    recentChanges: 0, // Would track recent relationship changes
  }));

  // Add family relationships
  resident.family.forEach(familyMember => {
    const familyResident = village.residents.find(
      r => r.id === familyMember.residentId
    );
    if (familyResident) {
      relationships.push({
        targetId: familyMember.residentId,
        targetName: familyResident.name,
        type: 'family' as const,
        strength: familyMember.closeness,
        recentChanges: 0,
      });
    }
  });

  // Analyze skills and recent growth
  const skills = resident.skills.map(skill => ({
    skill: skill.skill,
    level: skill.level,
    experience: skill.experience,
    recentGrowth: 0, // Would track recent skill improvements
  }));

  // Calculate contribution metrics
  const productivity = resident.employment
    ? (resident.employment.performance * resident.employment.satisfaction) / 100
    : 0;

  const economicImpact = resident.employment
    ? resident.employment.salary * (productivity / 100)
    : 0;

  const socialInfluence =
    resident.reputation > 0
      ? Math.min(100, resident.reputation + relationships.length * 5)
      : 0;

  return {
    id: resident.id,
    name: resident.name,
    age: resident.age,
    profession: resident.profession.name,
    currentActivity,
    mood: {
      current: mood,
      factors: moodFactors,
      stability: Math.max(0, 100 - resident.needs.urgentNeeds.length * 20),
    },
    relationships: relationships.slice(0, 10), // Limit to top 10 relationships
    skills,
    needs: {
      basic: {
        food: resident.needs.food,
        shelter: resident.needs.shelter,
        safety: resident.needs.safety,
      },
      social: {
        companionship: resident.needs.social,
        respect: Math.min(100, resident.reputation + 50),
        purpose: resident.needs.purpose,
      },
      urgent: resident.needs.urgentNeeds.map(need => need.description),
    },
    contribution: {
      productivity: Math.round(productivity),
      economicImpact: Math.round(economicImpact),
      socialInfluence: Math.round(socialInfluence),
      recentAchievements: [], // Would track recent achievements
    },
    aiPersonality: resident.aiPersonality
      ? {
          traits: resident.aiPersonality.traits,
          decisionTendencies: resident.aiPersonality.decisionTendencies.map(
            dt => dt.situation
          ),
          quirks: resident.aiPersonality.quirks,
        }
      : undefined,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const villageId = params.id;
    const { searchParams } = new URL(request.url);

    // Query parameters for filtering and pagination
    const profession = searchParams.get('profession');
    const mood = searchParams.get('mood');
    const minAge = searchParams.get('minAge')
      ? parseInt(searchParams.get('minAge')!)
      : undefined;
    const maxAge = searchParams.get('maxAge')
      ? parseInt(searchParams.get('maxAge')!)
      : undefined;
    const sortBy = searchParams.get('sortBy') || 'name';
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!)
      : undefined;
    const includeAI = searchParams.get('includeAI') === 'true';

    if (!villageId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Village ID is required',
        },
        { status: 400 }
      );
    }

    // Fetch village and game state
    const villageKey = `village:${villageId}`;
    const gameStateKey = `gamestate:${villageId}`;

    const [village, gameState] = await Promise.all([
      kvService.get(villageKey) as Promise<Village | null>,
      kvService.get(gameStateKey) as Promise<VillageGameState | null>,
    ]);

    if (!village || !gameState) {
      return NextResponse.json(
        {
          success: false,
          error: 'Village not found',
        },
        { status: 404 }
      );
    }

    // Initialize NPC behavior system if AI analysis requested
    let behaviorSystem: NPCBehaviorSystem | null = null;
    if (includeAI) {
      behaviorSystem = new NPCBehaviorSystem();
    }

    // Filter residents based on query parameters
    let filteredResidents = village.residents;

    if (profession) {
      filteredResidents = filteredResidents.filter(r =>
        r.profession.category.toLowerCase().includes(profession.toLowerCase())
      );
    }

    if (minAge !== undefined) {
      filteredResidents = filteredResidents.filter(r => r.age >= minAge);
    }

    if (maxAge !== undefined) {
      filteredResidents = filteredResidents.filter(r => r.age <= maxAge);
    }

    // Analyze NPC status for all residents
    let npcStatuses = filteredResidents.map(resident =>
      analyzeNPCStatus(resident, village, gameState)
    );

    // Filter by mood if specified
    if (mood) {
      npcStatuses = npcStatuses.filter(
        npc => npc.mood.current.toLowerCase() === mood.toLowerCase()
      );
    }

    // Sort NPCs
    npcStatuses.sort((a, b) => {
      switch (sortBy) {
        case 'age':
          return a.age - b.age;
        case 'profession':
          return a.profession.localeCompare(b.profession);
        case 'happiness':
          return b.mood.stability - a.mood.stability;
        case 'productivity':
          return b.contribution.productivity - a.contribution.productivity;
        case 'influence':
          return (
            b.contribution.socialInfluence - a.contribution.socialInfluence
          );
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    // Apply limit if specified
    if (limit) {
      npcStatuses = npcStatuses.slice(0, limit);
    }

    // Calculate village-wide NPC statistics
    const npcAnalytics = {
      totalNPCs: village.residents.length,
      averageAge: Math.round(
        village.residents.reduce((sum, r) => sum + r.age, 0) /
          village.residents.length
      ),
      averageHappiness: Math.round(
        village.residents.reduce((sum, r) => sum + r.happiness, 0) /
          village.residents.length
      ),
      averageHealth: Math.round(
        village.residents.reduce((sum, r) => sum + r.health, 0) /
          village.residents.length
      ),

      professionDistribution: village.residents.reduce(
        (dist, resident) => {
          const category = resident.profession.category;
          dist[category] = (dist[category] || 0) + 1;
          return dist;
        },
        {} as Record<string, number>
      ),

      moodDistribution: npcStatuses.reduce(
        (dist, npc) => {
          dist[npc.mood.current] = (dist[npc.mood.current] || 0) + 1;
          return dist;
        },
        {} as Record<string, number>
      ),

      skillLevels: {
        highlySkilled: village.residents.filter(r =>
          r.skills.some(s => s.level > 80)
        ).length,
        skilled: village.residents.filter(r =>
          r.skills.some(s => s.level > 60 && s.level <= 80)
        ).length,
        unskilled: village.residents.filter(
          r => !r.skills.some(s => s.level > 60)
        ).length,
      },

      socialNetwork: {
        averageConnections: Math.round(
          village.residents.reduce(
            (sum, r) => sum + r.friends.length + r.family.length,
            0
          ) / village.residents.length
        ),
        mostConnectedNPCs: npcStatuses
          .sort((a, b) => b.relationships.length - a.relationships.length)
          .slice(0, 3)
          .map(npc => ({
            name: npc.name,
            connections: npc.relationships.length,
          })),
      },

      productivity: {
        highPerformers: npcStatuses.filter(
          npc => npc.contribution.productivity > 80
        ).length,
        averageProductivity: Math.round(
          npcStatuses.reduce(
            (sum, npc) => sum + npc.contribution.productivity,
            0
          ) / npcStatuses.length
        ),
        totalEconomicImpact: Math.round(
          npcStatuses.reduce(
            (sum, npc) => sum + npc.contribution.economicImpact,
            0
          )
        ),
      },
    };

    // Identify NPCs needing attention
    const npcAlerts = {
      urgent: npcStatuses.filter(npc => npc.needs.urgent.length > 0),
      unhappy: npcStatuses.filter(
        npc => npc.mood.current === 'sad' || npc.mood.current === 'angry'
      ),
      unproductive: npcStatuses.filter(
        npc => npc.contribution.productivity < 30
      ),
      isolated: npcStatuses.filter(npc => npc.relationships.length < 2),
      skillGrowthNeeded: npcStatuses
        .filter(npc => !npc.skills.some(skill => skill.recentGrowth > 0))
        .slice(0, 5), // Limit to avoid overwhelming
    };

    //TODO: Implement NPC behavior prediction based on current trends
    //TODO: Add NPC interaction history and social event tracking
    //TODO: Create NPC development and training recommendations
    //TODO: Implement NPC crisis response and emergency behavior patterns

    return NextResponse.json({
      success: true,
      npcs: npcStatuses,
      analytics: npcAnalytics,
      alerts: npcAlerts,
      filters: {
        applied: {
          profession,
          mood,
          ageRange: minAge || maxAge ? { min: minAge, max: maxAge } : null,
          sortBy,
          limit,
        },
        totalBeforeFilter: village.residents.length,
        totalAfterFilter: npcStatuses.length,
      },
      lastUpdated: new Date(),
    });
  } catch (error) {
    console.error('NPC retrieval error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
