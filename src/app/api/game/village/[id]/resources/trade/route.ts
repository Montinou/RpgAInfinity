/**
 * Village Resource Trading API Endpoint
 * POST /api/game/village/[id]/resources/trade
 *
 * Executes resource trading operations including internal trades,
 * external trade routes, and emergency resource acquisition
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { kvService } from '@/lib/database';
import {
  Village,
  VillageGameState,
  ResourceType,
  ResourceCost,
  TradeRoute,
  TradeGood,
} from '@/types/village';

// Validation schema for trade operations
const TradeRequestSchema = z.object({
  type: z.enum(['internal', 'external', 'emergency']),
  tradeId: z.string().optional(), // For external trades via established routes
  offer: z.array(
    z.object({
      resource: z.string(),
      amount: z.number().positive(),
      maxQuality: z.number().min(0).max(100).optional(),
    })
  ),
  request: z.array(
    z.object({
      resource: z.string(),
      amount: z.number().positive(),
      minQuality: z.number().min(0).max(100).optional(),
    })
  ),
  maxTotalCost: z.number().optional(), // Maximum gold cost for trade
  urgency: z.enum(['low', 'normal', 'high', 'emergency']).default('normal'),
});

type TradeRequest = z.infer<typeof TradeRequestSchema>;

/**
 * Calculate base trade value for resources
 */
function getResourceBaseValue(resource: ResourceType): number {
  const baseValues: Record<ResourceType, number> = {
    // Basic resources
    food: 2,
    wood: 1,
    stone: 1,
    iron: 5,
    gold: 1, // Gold is the base currency
    water: 1,

    // Processed materials
    lumber: 3,
    tools: 8,
    weapons: 15,
    cloth: 6,
    pottery: 4,
    books: 12,

    // Luxury goods
    spices: 20,
    jewelry: 50,
    art: 30,
    wine: 10,
    silk: 25,

    // Abstract resources
    knowledge: 15,
    culture: 10,
    faith: 8,
    influence: 12,
  };

  return baseValues[resource] || 1;
}

/**
 * Calculate trade value considering quality, supply/demand, and market conditions
 */
function calculateTradeValue(
  resource: ResourceType,
  amount: number,
  quality: number,
  village: Village,
  isOffering: boolean
): number {
  const baseValue = getResourceBaseValue(resource);
  let adjustedValue = baseValue;

  // Quality modifier
  const qualityMultiplier = 0.5 + quality / 100;
  adjustedValue *= qualityMultiplier;

  // Supply and demand effects
  const currentStock = village.resources.resources[resource];
  const utilizationRate = currentStock
    ? currentStock.current / currentStock.maximum
    : 0;

  if (isOffering) {
    // Offering: more valuable when we have surplus
    if (utilizationRate > 0.8) {
      adjustedValue *= 0.9; // Slight discount for surplus
    } else if (utilizationRate < 0.3) {
      adjustedValue *= 1.3; // Premium when scarce
    }
  } else {
    // Requesting: more expensive when we're low
    if (utilizationRate < 0.3) {
      adjustedValue *= 1.4; // More expensive when we need it
    } else if (utilizationRate > 0.8) {
      adjustedValue *= 0.8; // Cheaper when we have enough
    }
  }

  // Season effects
  const seasonMultipliers: Record<
    string,
    Partial<Record<ResourceType, number>>
  > = {
    spring: { food: 1.1, wood: 0.9 },
    summer: { food: 0.8, wood: 1.2 },
    autumn: { food: 0.9, wood: 1.1 },
    winter: { food: 1.3, wood: 0.8 },
  };

  const seasonMod =
    seasonMultipliers[village.season.current]?.[resource] || 1.0;
  adjustedValue *= seasonMod;

  return Math.round(adjustedValue * amount);
}

/**
 * Execute internal resource reallocation
 */
async function executeInternalTrade(
  village: Village,
  offer: TradeRequest['offer'],
  request: TradeRequest['request']
): Promise<{ success: boolean; cost: number; message: string }> {
  // Check if we have enough resources to offer
  for (const item of offer) {
    const stock = village.resources.resources[item.resource as ResourceType];
    if (!stock || stock.current < item.amount) {
      return {
        success: false,
        cost: 0,
        message: `Insufficient ${item.resource}: need ${item.amount}, have ${stock?.current || 0}`,
      };
    }
  }

  // Internal trades are essentially free resource conversion with some loss
  const conversionEfficiency = 0.95; // 5% loss in internal trades
  const totalCost = 10; // Small administrative cost

  return {
    success: true,
    cost: totalCost,
    message: 'Internal resource reallocation completed',
  };
}

/**
 * Execute external trade via established routes
 */
async function executeExternalTrade(
  village: Village,
  tradeRoute: TradeRoute,
  offer: TradeRequest['offer'],
  request: TradeRequest['request']
): Promise<{
  success: boolean;
  cost: number;
  message: string;
  deliveryTime: number;
}> {
  let totalCost = tradeRoute.cost; // Base route cost

  // Calculate trade values
  for (const item of offer) {
    const stock = village.resources.resources[item.resource as ResourceType];
    if (!stock || stock.current < item.amount) {
      return {
        success: false,
        cost: 0,
        message: `Insufficient ${item.resource} for trade`,
        deliveryTime: 0,
      };
    }
  }

  for (const item of request) {
    const value = calculateTradeValue(
      item.resource as ResourceType,
      item.amount,
      75,
      village,
      false
    );
    totalCost += value;
  }

  // Apply trade route reliability and safety factors
  const riskMultiplier = 1 + (100 - tradeRoute.safety) * 0.01;
  const reliabilityMultiplier = 1 + (100 - tradeRoute.reliability) * 0.005;

  totalCost = Math.round(totalCost * riskMultiplier * reliabilityMultiplier);

  return {
    success: true,
    cost: totalCost,
    message: `Trade executed via ${tradeRoute.destination}`,
    deliveryTime: tradeRoute.travelTime,
  };
}

/**
 * Execute emergency resource acquisition
 */
async function executeEmergencyTrade(
  village: Village,
  request: TradeRequest['request']
): Promise<{ success: boolean; cost: number; message: string }> {
  let totalCost = 0;

  // Emergency trades have high markup but guaranteed availability
  const emergencyMarkup = 2.5;

  for (const item of request) {
    const baseCost = calculateTradeValue(
      item.resource as ResourceType,
      item.amount,
      60,
      village,
      false
    );
    totalCost += Math.round(baseCost * emergencyMarkup);
  }

  // Add emergency service fee
  totalCost += Math.round(totalCost * 0.2);

  return {
    success: true,
    cost: totalCost,
    message: 'Emergency resources acquired via mercenary traders',
  };
}

export async function POST(
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
    const validationResult = TradeRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid trade request data',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const tradeRequest = validationResult.data;

    // Fetch village data
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

    // Check if village has enough gold for trade
    const currentGold = village.resources.resources.gold?.current || 0;

    let tradeResult;
    let deliveryTime = 0;

    // Execute trade based on type
    switch (tradeRequest.type) {
      case 'internal':
        tradeResult = await executeInternalTrade(
          village,
          tradeRequest.offer,
          tradeRequest.request
        );
        break;

      case 'external':
        if (!tradeRequest.tradeId) {
          return NextResponse.json(
            {
              success: false,
              error: 'Trade route ID required for external trades',
            },
            { status: 400 }
          );
        }

        const tradeRoute = village.resources.tradeRoutes.find(
          route => route.id === tradeRequest.tradeId
        );
        if (!tradeRoute) {
          return NextResponse.json(
            {
              success: false,
              error: 'Trade route not found',
            },
            { status: 404 }
          );
        }

        const externalResult = await executeExternalTrade(
          village,
          tradeRoute,
          tradeRequest.offer,
          tradeRequest.request
        );
        tradeResult = externalResult;
        deliveryTime = externalResult.deliveryTime;
        break;

      case 'emergency':
        tradeResult = await executeEmergencyTrade(
          village,
          tradeRequest.request
        );
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid trade type',
          },
          { status: 400 }
        );
    }

    if (!tradeResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: tradeResult.message,
        },
        { status: 400 }
      );
    }

    // Check if village can afford the trade
    if (
      tradeRequest.maxTotalCost &&
      tradeResult.cost > tradeRequest.maxTotalCost
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Trade cost (${tradeResult.cost} gold) exceeds maximum budget (${tradeRequest.maxTotalCost} gold)`,
        },
        { status: 400 }
      );
    }

    if (currentGold < tradeResult.cost) {
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient gold: need ${tradeResult.cost}, have ${currentGold}`,
        },
        { status: 400 }
      );
    }

    // Apply resource changes
    const updatedResources = { ...village.resources };

    // Deduct offered resources
    for (const item of tradeRequest.offer) {
      const resourceType = item.resource as ResourceType;
      const stock = updatedResources.resources[resourceType];
      if (stock) {
        updatedResources.resources[resourceType] = {
          ...stock,
          current: stock.current - item.amount,
          lastUpdated: new Date(),
        };
      }
    }

    // Add requested resources (if not delivery trade)
    if (deliveryTime === 0) {
      for (const item of tradeRequest.request) {
        const resourceType = item.resource as ResourceType;
        const stock = updatedResources.resources[resourceType];
        if (stock) {
          updatedResources.resources[resourceType] = {
            ...stock,
            current: Math.min(stock.maximum, stock.current + item.amount),
            quality: Math.max(stock.quality, item.minQuality || 60),
            lastUpdated: new Date(),
          };
        }
      }
    }

    // Deduct gold cost
    updatedResources.resources.gold = {
      ...updatedResources.resources.gold,
      current: updatedResources.resources.gold.current - tradeResult.cost,
      lastUpdated: new Date(),
    };

    // Update village economy
    const updatedEconomy = {
      ...village.economy,
      monthlyExpenses: village.economy.monthlyExpenses + tradeResult.cost,
      treasury: village.economy.treasury - tradeResult.cost,
    };

    // Create trade transaction record
    const transaction = {
      id: nanoid(),
      type: 'trade' as const,
      resources: [
        ...tradeRequest.offer.map(item => ({
          resource: item.resource as ResourceType,
          amount: -item.amount, // negative for offered
        })),
        ...tradeRequest.request.map(item => ({
          resource: item.resource as ResourceType,
          amount: item.amount, // positive for received
        })),
        { resource: 'gold' as ResourceType, amount: -tradeResult.cost },
      ],
      timestamp: new Date(),
      description: `${tradeRequest.type} trade: ${tradeResult.message}`,
      source: villageId,
      target: tradeRequest.tradeId || 'internal',
    };

    // Update village
    const updatedVillage: Village = {
      ...village,
      resources: {
        ...updatedResources,
        updatedAt: new Date(),
      },
      economy: updatedEconomy,
      updatedAt: new Date(),
    };

    // Store updated village
    await kvService.set(villageKey, updatedVillage);

    //TODO: Store transaction in trade history
    //TODO: Update trade route statistics and relationships
    //TODO: Generate NPC reactions to successful/failed trades
    //TODO: Schedule resource delivery for external trades with delivery time

    const response: any = {
      success: true,
      trade: {
        id: transaction.id,
        type: tradeRequest.type,
        cost: tradeResult.cost,
        message: tradeResult.message,
        executedAt: new Date(),
      },
      resourceChanges: transaction.resources,
      newTreasury: updatedVillage.economy.treasury,
      deliveryTime,
    };

    if (deliveryTime > 0) {
      response.deliveryScheduled = {
        estimatedArrival: new Date(
          Date.now() + deliveryTime * 24 * 60 * 60 * 1000
        ),
        resources: tradeRequest.request,
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Trade execution error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error during trade execution',
      },
      { status: 500 }
    );
  }
}
