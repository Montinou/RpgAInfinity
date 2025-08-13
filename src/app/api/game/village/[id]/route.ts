/**
 * Village Management API Endpoint
 * GET /api/game/village/[id] - Get village state
 * PUT /api/game/village/[id] - Update village
 * DELETE /api/game/village/[id] - Delete village
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { kvService } from '@/lib/database';
import { Village, VillageGameState } from '@/types/village';

// Validation schema for village updates
const UpdateVillageSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  happiness: z.number().min(0).max(100).optional(),
  stability: z.number().min(0).max(100).optional(),
  prosperity: z.number().min(0).max(100).optional(),
  defense: z.number().min(0).max(100).optional(),
  policies: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.enum([
          'tax',
          'trade',
          'labor',
          'resource',
          'military',
          'social',
        ]),
        isActive: z.boolean(),
      })
    )
    .optional(),
});

type UpdateVillageRequest = z.infer<typeof UpdateVillageSchema>;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const villageId = params.id;

    if (!villageId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Village ID is required',
        },
        { status: 400 }
      );
    }

    // Fetch village data
    const villageKey = `village:${villageId}`;
    const gameStateKey = `gamestate:${villageId}`;

    const [village, gameState] = await Promise.all([
      kvService.get(villageKey) as Promise<Village | null>,
      kvService.get(gameStateKey) as Promise<VillageGameState | null>,
    ]);

    if (!village) {
      return NextResponse.json(
        {
          success: false,
          error: 'Village not found',
        },
        { status: 404 }
      );
    }

    if (!gameState) {
      return NextResponse.json(
        {
          success: false,
          error: 'Village game state not found',
        },
        { status: 404 }
      );
    }

    // Calculate derived statistics
    const derivedStats = {
      // Resource efficiency
      resourceEfficiency: Math.floor(
        (village.resources.usedCapacity / village.resources.totalCapacity) * 100
      ),

      // Population growth rate (annual)
      populationGrowthRate:
        village.population.birthRate - village.population.deathRate,

      // Economic indicators
      economicTrend:
        village.economy.netProfit > 0
          ? 'positive'
          : village.economy.netProfit < 0
            ? 'negative'
            : 'stable',

      // Housing situation
      housingCoverage: Math.floor(
        (village.population.housedPopulation / village.population.total) * 100
      ),

      // Employment rate
      employmentRate: Math.floor(
        (village.population.employed /
          (village.population.employed + village.population.unemployed)) *
          100
      ),

      // Overall village health score
      overallHealth: Math.floor(
        (village.happiness +
          village.stability +
          village.prosperity +
          village.defense) /
          4
      ),

      // Active issues count
      activeIssuesCount: village.currentEvents.filter(
        event => event.severity === 'major' || event.severity === 'catastrophic'
      ).length,

      // Days since last major event
      daysSinceLastMajorEvent:
        village.eventHistory.length > 0
          ? Math.floor(
              (new Date().getTime() -
                new Date(
                  village.eventHistory[village.eventHistory.length - 1].date
                ).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : 0,
    };

    // Calculate resource alerts
    const resourceAlerts = [];
    for (const [resourceType, stock] of Object.entries(
      village.resources.resources
    )) {
      const utilizationRate = stock.current / stock.maximum;

      if (utilizationRate < 0.1) {
        resourceAlerts.push({
          resource: resourceType,
          type: 'shortage',
          severity: utilizationRate < 0.05 ? 'critical' : 'high',
          estimatedTimeToImpact: Math.floor(
            stock.current /
              Math.max(
                village.resources.dailyConsumption[
                  resourceType as keyof typeof village.resources.dailyConsumption
                ] || 1,
                1
              )
          ),
          recommendedActions: [
            `Increase ${resourceType} production`,
            `Trade for ${resourceType}`,
            `Reduce ${resourceType} consumption`,
          ],
        });
      } else if (utilizationRate > 0.95) {
        resourceAlerts.push({
          resource: resourceType,
          type: 'surplus',
          severity: 'medium',
          estimatedTimeToImpact: -1,
          recommendedActions: [
            `Trade excess ${resourceType}`,
            `Expand ${resourceType} storage`,
            `Use ${resourceType} for construction`,
          ],
        });
      }
    }

    return NextResponse.json({
      success: true,
      village,
      gameState,
      derivedStats,
      resourceAlerts,
      lastUpdated: village.updatedAt,
    });
  } catch (error) {
    console.error('Village retrieval error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const villageId = params.id;
    const body = await request.json();

    if (!villageId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Village ID is required',
        },
        { status: 400 }
      );
    }

    // Validate request data
    const validationResult = UpdateVillageSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid update data',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const updates = validationResult.data;

    // Fetch existing village
    const villageKey = `village:${villageId}`;
    const existingVillage = (await kvService.get(villageKey)) as Village | null;

    if (!existingVillage) {
      return NextResponse.json(
        {
          success: false,
          error: 'Village not found',
        },
        { status: 404 }
      );
    }

    // Apply updates
    const updatedVillage: Village = {
      ...existingVillage,
      ...updates,
      updatedAt: new Date(),
    };

    // If policies were updated, merge with existing policies
    if (updates.policies) {
      const existingPolicies = existingVillage.economy.policies || [];
      const updatedPolicyIds = new Set(updates.policies.map(p => p.id));

      // Keep existing policies not in update, add/update policies from request
      updatedVillage.economy.policies = [
        ...existingPolicies.filter(p => !updatedPolicyIds.has(p.id)),
        ...updates.policies.map(p => ({
          ...p,
          effects: [], // Default empty effects - would be populated by policy system
          cost: 0,
          duration: 30,
          popularity: 0,
        })),
      ];
    }

    // Store updated village
    await kvService.set(villageKey, updatedVillage);

    //TODO: Log village update event to history
    //TODO: Trigger AI evaluation of changes
    //TODO: Update related NPCs' opinions based on policy changes
    //TODO: Recalculate resource flows if policies affect economy

    return NextResponse.json({
      success: true,
      village: updatedVillage,
      message: 'Village updated successfully',
    });
  } catch (error) {
    console.error('Village update error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const villageId = params.id;

    if (!villageId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Village ID is required',
        },
        { status: 400 }
      );
    }

    // Check if village exists
    const villageKey = `village:${villageId}`;
    const village = (await kvService.get(villageKey)) as Village | null;

    if (!village) {
      return NextResponse.json(
        {
          success: false,
          error: 'Village not found',
        },
        { status: 404 }
      );
    }

    // Delete all related data
    const keysToDelete = [
      `village:${villageId}`,
      `gamestate:${villageId}`,
      `village_session:${village.sessionId}`,
      `village_resources:${villageId}`,
      `village_npcs:${villageId}`,
      `village_events:${villageId}`,
      `village_buildings:${villageId}`,
    ];

    await Promise.all(keysToDelete.map(key => kvService.delete(key)));

    //TODO: Archive village data for analytics before deletion
    //TODO: Notify any connected players of village deletion
    //TODO: Clean up any scheduled events or background processes

    return NextResponse.json({
      success: true,
      message: `Village "${village.name}" has been deleted`,
      deletedVillageId: villageId,
    });
  } catch (error) {
    console.error('Village deletion error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
