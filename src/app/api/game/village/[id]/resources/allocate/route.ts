/**
 * Village Resource Allocation API Endpoint
 * POST /api/game/village/[id]/resources/allocate
 *
 * Manages resource allocation for construction, maintenance, emergency response,
 * and strategic reserves. Handles resource reservations and priority systems.
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
} from '@/types/village';

// Validation schema for resource allocation requests
const AllocationRequestSchema = z.object({
  allocationType: z.enum([
    'construction',
    'maintenance',
    'emergency',
    'reserve',
    'project',
  ]),
  targetId: z.string().optional(), // Building ID, project ID, etc.
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  resources: z.array(
    z.object({
      resource: z.string(),
      amount: z.number().positive(),
      minQuality: z.number().min(0).max(100).default(50),
      maxPrice: z.number().positive().optional(), // Max gold per unit if purchasing needed
    })
  ),
  duration: z.number().positive().optional(), // Days the allocation will last
  autoRelease: z.boolean().default(true), // Auto-release if target completed/cancelled
  notes: z.string().max(500).optional(),
});

type AllocationRequest = z.infer<typeof AllocationRequestSchema>;

interface ResourceAllocation {
  id: string;
  type: AllocationRequest['allocationType'];
  targetId?: string;
  priority: AllocationRequest['priority'];
  resources: Array<{
    resource: ResourceType;
    allocated: number;
    reserved: number;
    quality: number;
  }>;
  status: 'active' | 'completed' | 'cancelled' | 'partial';
  createdAt: Date;
  expiresAt?: Date;
  notes?: string;
}

/**
 * Calculate allocation priority score for resource conflicts
 */
function getPriorityScore(
  priority: AllocationRequest['priority'],
  type: AllocationRequest['allocationType']
): number {
  const priorityScores = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };

  const typeMultipliers = {
    emergency: 2.0,
    maintenance: 1.5,
    construction: 1.2,
    project: 1.0,
    reserve: 0.8,
  };

  return priorityScores[priority] * typeMultipliers[type];
}

/**
 * Check resource availability considering existing allocations
 */
function checkResourceAvailability(
  village: Village,
  requestedResources: AllocationRequest['resources'],
  excludeAllocationId?: string
): {
  available: boolean;
  conflicts: Array<{ resource: string; requested: number; available: number }>;
} {
  const conflicts: Array<{
    resource: string;
    requested: number;
    available: number;
  }> = [];

  for (const request of requestedResources) {
    const resourceType = request.resource as ResourceType;
    const stock = village.resources.resources[resourceType];

    if (!stock) {
      conflicts.push({
        resource: request.resource,
        requested: request.amount,
        available: 0,
      });
      continue;
    }

    const availableAmount = stock.current - stock.reserved;

    if (availableAmount < request.amount) {
      conflicts.push({
        resource: request.resource,
        requested: request.amount,
        available: availableAmount,
      });
    }
  }

  return {
    available: conflicts.length === 0,
    conflicts,
  };
}

/**
 * Reserve resources for allocation
 */
function reserveResources(
  village: Village,
  resources: AllocationRequest['resources']
): { success: boolean; reservedAmounts: Record<string, number> } {
  const reservedAmounts: Record<string, number> = {};

  for (const request of resources) {
    const resourceType = request.resource as ResourceType;
    const stock = village.resources.resources[resourceType];

    if (stock) {
      const availableAmount = stock.current - stock.reserved;
      const reserveAmount = Math.min(availableAmount, request.amount);

      stock.reserved += reserveAmount;
      reservedAmounts[request.resource] = reserveAmount;
    } else {
      reservedAmounts[request.resource] = 0;
    }
  }

  return {
    success: Object.values(reservedAmounts).every(
      (amount, index) => amount === resources[index].amount
    ),
    reservedAmounts,
  };
}

/**
 * Generate resource allocation suggestions
 */
function generateAllocationSuggestions(
  village: Village,
  conflicts: Array<{ resource: string; requested: number; available: number }>
): Array<{
  type: string;
  description: string;
  estimatedCost?: number;
  timeToImplement?: number;
}> {
  const suggestions: Array<{
    type: string;
    description: string;
    estimatedCost?: number;
    timeToImplement?: number;
  }> = [];

  for (const conflict of conflicts) {
    const shortage = conflict.requested - conflict.available;

    // Suggest increasing production
    suggestions.push({
      type: 'production',
      description: `Increase ${conflict.resource} production by building or upgrading production facilities`,
      estimatedCost: shortage * 10,
      timeToImplement: 7,
    });

    // Suggest trading for resources
    suggestions.push({
      type: 'trade',
      description: `Trade for ${shortage} units of ${conflict.resource}`,
      estimatedCost: shortage * 5,
      timeToImplement: 1,
    });

    // Suggest reducing other allocations
    suggestions.push({
      type: 'reallocation',
      description: `Reduce lower priority allocations to free up ${conflict.resource}`,
      timeToImplement: 0,
    });

    // Suggest alternative resources if applicable
    if (conflict.resource === 'wood' || conflict.resource === 'lumber') {
      suggestions.push({
        type: 'alternative',
        description:
          'Consider using stone or metal as alternative building materials',
        timeToImplement: 0,
      });
    }
  }

  return suggestions;
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
    const validationResult = AllocationRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid allocation request data',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const allocationRequest = validationResult.data;

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

    // Check resource availability
    const availabilityCheck = checkResourceAvailability(
      village,
      allocationRequest.resources
    );

    if (!availabilityCheck.available) {
      const suggestions = generateAllocationSuggestions(
        village,
        availabilityCheck.conflicts
      );

      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient resources for allocation',
          conflicts: availabilityCheck.conflicts,
          suggestions,
          currentResources: Object.fromEntries(
            availabilityCheck.conflicts.map(conflict => [
              conflict.resource,
              {
                current:
                  village.resources.resources[conflict.resource as ResourceType]
                    ?.current || 0,
                reserved:
                  village.resources.resources[conflict.resource as ResourceType]
                    ?.reserved || 0,
                available: conflict.available,
              },
            ])
          ),
        },
        { status: 409 }
      );
    }

    // Reserve resources
    const reservationResult = reserveResources(
      village,
      allocationRequest.resources
    );

    if (!reservationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to reserve requested resources',
          details: reservationResult.reservedAmounts,
        },
        { status: 409 }
      );
    }

    // Create allocation record
    const allocation: ResourceAllocation = {
      id: nanoid(),
      type: allocationRequest.allocationType,
      targetId: allocationRequest.targetId,
      priority: allocationRequest.priority,
      resources: allocationRequest.resources.map(req => ({
        resource: req.resource as ResourceType,
        allocated: reservationResult.reservedAmounts[req.resource],
        reserved: reservationResult.reservedAmounts[req.resource],
        quality: req.minQuality,
      })),
      status: 'active',
      createdAt: new Date(),
      expiresAt: allocationRequest.duration
        ? new Date(
            Date.now() + allocationRequest.duration * 24 * 60 * 60 * 1000
          )
        : undefined,
      notes: allocationRequest.notes,
    };

    // Update village resources with reservations
    const updatedVillage: Village = {
      ...village,
      resources: {
        ...village.resources,
        updatedAt: new Date(),
      },
      updatedAt: new Date(),
    };

    // Store allocation and updated village
    const allocationKey = `allocation:${allocation.id}`;
    const villageAllocationsKey = `allocations:${villageId}`;

    // Get existing allocations
    const existingAllocations =
      ((await kvService.get(villageAllocationsKey)) as ResourceAllocation[]) ||
      [];
    const updatedAllocations = [...existingAllocations, allocation];

    await Promise.all([
      kvService.set(allocationKey, allocation),
      kvService.set(villageAllocationsKey, updatedAllocations),
      kvService.set(villageKey, updatedVillage),
    ]);

    //TODO: Set up automatic allocation monitoring and alerts
    //TODO: Implement allocation conflict resolution system
    //TODO: Add allocation usage tracking and efficiency metrics
    //TODO: Create allocation history and analytics

    return NextResponse.json({
      success: true,
      allocation: {
        id: allocation.id,
        type: allocation.type,
        priority: allocation.priority,
        status: allocation.status,
        createdAt: allocation.createdAt,
        expiresAt: allocation.expiresAt,
      },
      reservedResources: allocation.resources.map(res => ({
        resource: res.resource,
        amount: res.allocated,
        quality: res.quality,
      })),
      remainingResources: Object.fromEntries(
        Object.entries(updatedVillage.resources.resources).map(
          ([resource, stock]) => [
            resource,
            {
              current: stock.current,
              reserved: stock.reserved,
              available: stock.current - stock.reserved,
            },
          ]
        )
      ),
      message: `Successfully allocated resources for ${allocation.type}${allocation.targetId ? ` (${allocation.targetId})` : ''}`,
      priorityScore: getPriorityScore(allocation.priority, allocation.type),
    });
  } catch (error) {
    console.error('Resource allocation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error during resource allocation',
      },
      { status: 500 }
    );
  }
}
