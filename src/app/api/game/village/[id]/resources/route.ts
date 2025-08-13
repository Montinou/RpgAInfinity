/**
 * Village Resource Management API Endpoint
 * GET /api/game/village/[id]/resources - Get complete resource state
 *
 * Provides comprehensive resource information including current stocks,
 * production rates, consumption patterns, and optimization recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import { kvService } from '@/lib/database';
import { ResourceManager } from '@/lib/games/village/resources';
import {
  Village,
  VillageGameState,
  ResourceType,
  ResourceAlert,
} from '@/types/village';

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

    // Initialize resource manager
    const resourceManager = new ResourceManager(village);

    // Calculate resource analytics
    const resourceAnalytics = {
      // Current state summary
      totalResources: Object.values(village.resources.resources).reduce(
        (sum, stock) => sum + stock.current,
        0
      ),
      storageUtilization: Math.round(
        (village.resources.usedCapacity / village.resources.totalCapacity) * 100
      ),

      // Production efficiency
      productionEfficiency:
        (Object.entries(village.resources.dailyProduction).reduce(
          (avg, [_, amount]) => {
            return avg + (amount > 0 ? 1 : 0);
          },
          0
        ) /
          Object.keys(village.resources.dailyProduction).length) *
        100,

      // Net resource flows
      resourceBalance: Object.entries(village.resources.netFlow).reduce(
        (balance, [resource, flow]) => {
          balance[resource] = {
            flow,
            status: flow > 0 ? 'surplus' : flow < 0 ? 'deficit' : 'balanced',
            daysUntilEmpty:
              flow < 0
                ? Math.floor(
                    village.resources.resources[resource as ResourceType]
                      .current / Math.abs(flow)
                  )
                : -1,
          };
          return balance;
        },
        {} as Record<string, any>
      ),

      // Critical resources (below 20% capacity)
      criticalResources: Object.entries(village.resources.resources)
        .filter(([_, stock]) => stock.current / stock.maximum < 0.2)
        .map(([resource, stock]) => ({
          resource,
          current: stock.current,
          maximum: stock.maximum,
          percentage: Math.round((stock.current / stock.maximum) * 100),
          quality: stock.quality,
        })),

      // Resource quality distribution
      qualityDistribution: Object.entries(village.resources.resources).reduce(
        (dist, [resource, stock]) => {
          const qualityTier =
            stock.quality > 80
              ? 'excellent'
              : stock.quality > 60
                ? 'good'
                : stock.quality > 40
                  ? 'fair'
                  : 'poor';
          dist[qualityTier] = (dist[qualityTier] || 0) + 1;
          return dist;
        },
        {} as Record<string, number>
      ),
    };

    // Calculate resource projections (7 days ahead)
    const resourceProjections = Object.entries(
      village.resources.netFlow
    ).reduce(
      (projections, [resource, dailyFlow]) => {
        const currentAmount =
          village.resources.resources[resource as ResourceType].current;
        const projectedAmounts = [];

        for (let day = 1; day <= 7; day++) {
          const projected = Math.max(0, currentAmount + dailyFlow * day);
          projectedAmounts.push({
            day,
            amount: projected,
            status:
              projected === 0
                ? 'depleted'
                : projected < currentAmount * 0.2
                  ? 'critical'
                  : projected < currentAmount * 0.5
                    ? 'low'
                    : 'stable',
          });
        }

        projections[resource] = projectedAmounts;
        return projections;
      },
      {} as Record<string, any[]>
    );

    // Generate resource alerts
    const resourceAlerts: ResourceAlert[] = [];

    Object.entries(village.resources.resources).forEach(
      ([resourceType, stock]) => {
        const utilizationRate = stock.current / stock.maximum;
        const dailyConsumption =
          village.resources.dailyConsumption[resourceType as ResourceType] || 0;
        const dailyProduction =
          village.resources.dailyProduction[resourceType as ResourceType] || 0;
        const netFlow = dailyProduction - dailyConsumption;

        // Shortage alerts
        if (utilizationRate < 0.2) {
          const daysRemaining =
            dailyConsumption > 0
              ? Math.floor(stock.current / dailyConsumption)
              : -1;

          resourceAlerts.push({
            resource: resourceType as ResourceType,
            type: utilizationRate < 0.05 ? 'shortage' : 'shortage',
            severity:
              utilizationRate < 0.05
                ? 'critical'
                : utilizationRate < 0.1
                  ? 'high'
                  : 'medium',
            estimatedTimeToImpact: daysRemaining,
            recommendedActions: [
              `Increase ${resourceType} production`,
              `Reduce ${resourceType} consumption`,
              `Establish trade routes for ${resourceType}`,
              `Build more ${resourceType} production buildings`,
            ],
          });
        }

        // Surplus alerts
        if (utilizationRate > 0.95) {
          resourceAlerts.push({
            resource: resourceType as ResourceType,
            type: 'surplus',
            severity: 'low',
            estimatedTimeToImpact: -1,
            recommendedActions: [
              `Trade excess ${resourceType} for other resources`,
              `Build additional ${resourceType} storage`,
              `Use ${resourceType} for construction or upgrades`,
            ],
          });
        }

        // Quality degradation alerts
        if (stock.quality < 40) {
          resourceAlerts.push({
            resource: resourceType as ResourceType,
            type: 'quality_drop',
            severity: stock.quality < 20 ? 'high' : 'medium',
            estimatedTimeToImpact: -1,
            recommendedActions: [
              `Improve ${resourceType} storage conditions`,
              `Use low-quality ${resourceType} before it degrades further`,
              `Invest in better preservation methods`,
            ],
          });
        }

        // Spoilage alerts for perishables
        if (stock.spoilageRate > 0 && stock.current > 0) {
          const dailySpoilage = stock.current * stock.spoilageRate;
          if (dailySpoilage > dailyConsumption * 0.1) {
            // More than 10% waste
            resourceAlerts.push({
              resource: resourceType as ResourceType,
              type: 'spoilage',
              severity:
                dailySpoilage > dailyConsumption * 0.3 ? 'high' : 'medium',
              estimatedTimeToImpact: Math.floor(stock.current / dailySpoilage),
              recommendedActions: [
                `Consume ${resourceType} faster`,
                `Trade ${resourceType} before spoilage`,
                `Improve preservation methods`,
                `Build better storage facilities`,
              ],
            });
          }
        }
      }
    );

    // Sort alerts by severity
    resourceAlerts.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });

    //TODO: Implement resource optimization suggestions using AI
    //TODO: Add seasonal resource planning predictions
    //TODO: Calculate resource efficiency scores per building
    //TODO: Implement resource trade opportunity detection

    return NextResponse.json({
      success: true,
      resources: village.resources,
      analytics: resourceAnalytics,
      projections: resourceProjections,
      alerts: resourceAlerts,
      recommendations: {
        priority: 'high',
        actions: resourceAlerts
          .slice(0, 5)
          .map(alert => alert.recommendedActions[0]),
      },
      lastUpdated: village.resources.updatedAt,
    });
  } catch (error) {
    console.error('Resource state retrieval error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
