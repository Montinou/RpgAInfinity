/**
 * Village Resource Optimization API Endpoint
 * GET /api/game/village/[id]/resources/optimize
 *
 * Provides AI-powered resource optimization suggestions including production
 * efficiency improvements, storage optimization, and strategic recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import { kvService } from '@/lib/database';
import { generateVillageContent } from '@/lib/ai';
import {
  Village,
  VillageGameState,
  ResourceType,
  Building,
} from '@/types/village';

interface OptimizationRecommendation {
  id: string;
  type:
    | 'production'
    | 'storage'
    | 'trade'
    | 'construction'
    | 'policy'
    | 'allocation';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  expectedBenefit: string;
  implementationCost: Array<{ resource: ResourceType; amount: number }>;
  timeToImplement: number; // days
  confidenceScore: number; // 0-100
  prerequisites: string[];
  potentialRisks: string[];
}

interface EfficiencyAnalysis {
  resourceType: ResourceType;
  currentEfficiency: number; // 0-100
  maxPossibleEfficiency: number;
  bottlenecks: string[];
  improvementPotential: number;
  suggestedActions: string[];
}

/**
 * Analyze production efficiency for each resource
 */
function analyzeProductionEfficiency(village: Village): EfficiencyAnalysis[] {
  const analyses: EfficiencyAnalysis[] = [];

  // Analyze each resource type
  for (const [resourceType, stock] of Object.entries(
    village.resources.resources
  )) {
    const resource = resourceType as ResourceType;
    const production = village.resources.dailyProduction[resource] || 0;
    const consumption = village.resources.dailyConsumption[resource] || 0;

    // Calculate current efficiency based on production vs consumption ratio
    const efficiencyRatio =
      consumption > 0 ? production / consumption : production > 0 ? 1 : 0;
    const currentEfficiency = Math.min(100, efficiencyRatio * 100);

    // Calculate maximum possible efficiency based on buildings and population
    const productionBuildings = village.buildings.filter(b =>
      b.produces.some(p => p.resource === resource)
    );

    const maxProduction = productionBuildings.reduce((sum, building) => {
      const resourceProd = building.produces.find(p => p.resource === resource);
      if (resourceProd) {
        // Calculate max if building was at perfect condition with full workers
        const maxEfficiency =
          building.maxWorkers > 0
            ? building.workers.length / building.maxWorkers
            : 1;
        const conditionMultiplier =
          building.condition === 'perfect'
            ? 1.0
            : building.condition === 'good'
              ? 0.9
              : building.condition === 'fair'
                ? 0.8
                : building.condition === 'poor'
                  ? 0.6
                  : 0.3;

        return (
          sum + resourceProd.amountPerDay * maxEfficiency * conditionMultiplier
        );
      }
      return sum;
    }, 0);

    const maxEfficiencyRatio =
      consumption > 0 ? maxProduction / consumption : maxProduction > 0 ? 1 : 0;
    const maxPossibleEfficiency = Math.min(100, maxEfficiencyRatio * 100);

    // Identify bottlenecks
    const bottlenecks: string[] = [];
    const suggestedActions: string[] = [];

    if (production < consumption) {
      bottlenecks.push('Production deficit');
      suggestedActions.push(`Increase ${resource} production capacity`);
    }

    if (productionBuildings.some(b => b.condition !== 'perfect')) {
      bottlenecks.push('Poor building condition');
      suggestedActions.push('Repair and maintain production buildings');
    }

    if (productionBuildings.some(b => b.workers.length < b.maxWorkers)) {
      bottlenecks.push('Understaffed production');
      suggestedActions.push('Hire more workers for production buildings');
    }

    if (stock.current / stock.maximum > 0.9) {
      bottlenecks.push('Storage capacity limitation');
      suggestedActions.push(`Expand ${resource} storage capacity`);
    }

    if (stock.quality < 70) {
      bottlenecks.push('Poor resource quality');
      suggestedActions.push('Improve storage and production methods');
    }

    analyses.push({
      resourceType: resource,
      currentEfficiency: Math.round(currentEfficiency),
      maxPossibleEfficiency: Math.round(maxPossibleEfficiency),
      bottlenecks,
      improvementPotential: Math.round(
        maxPossibleEfficiency - currentEfficiency
      ),
      suggestedActions,
    });
  }

  return analyses.sort(
    (a, b) => b.improvementPotential - a.improvementPotential
  );
}

/**
 * Generate specific optimization recommendations
 */
async function generateOptimizationRecommendations(
  village: Village,
  efficiencyAnalyses: EfficiencyAnalysis[]
): Promise<OptimizationRecommendation[]> {
  const recommendations: OptimizationRecommendation[] = [];
  let recommendationId = 1;

  // Production optimization recommendations
  for (const analysis of efficiencyAnalyses.slice(0, 5)) {
    // Top 5 improvement opportunities
    if (analysis.improvementPotential > 20) {
      recommendations.push({
        id: `prod-${recommendationId++}`,
        type: 'production',
        priority:
          analysis.improvementPotential > 50
            ? 'high'
            : analysis.improvementPotential > 30
              ? 'medium'
              : 'low',
        title: `Optimize ${analysis.resourceType} Production`,
        description: `Improve ${analysis.resourceType} production efficiency from ${analysis.currentEfficiency}% to ${analysis.maxPossibleEfficiency}%`,
        expectedBenefit: `+${analysis.improvementPotential}% production efficiency, +${Math.round(analysis.improvementPotential * 0.5)} daily ${analysis.resourceType}`,
        implementationCost: [
          {
            resource: 'gold',
            amount: Math.round(analysis.improvementPotential * 10),
          },
          {
            resource: 'tools',
            amount: Math.round(analysis.improvementPotential * 0.2),
          },
        ],
        timeToImplement: Math.ceil(analysis.improvementPotential / 10),
        confidenceScore: 85,
        prerequisites: analysis.suggestedActions.slice(0, 2),
        potentialRisks: ['Temporary production disruption during upgrades'],
      });
    }
  }

  // Storage optimization recommendations
  const storageUtilization =
    village.resources.usedCapacity / village.resources.totalCapacity;
  if (storageUtilization > 0.8) {
    recommendations.push({
      id: `storage-${recommendationId++}`,
      type: 'storage',
      priority: storageUtilization > 0.95 ? 'critical' : 'high',
      title: 'Expand Storage Capacity',
      description: `Current storage utilization is ${Math.round(storageUtilization * 100)}%. Expand capacity to prevent resource bottlenecks.`,
      expectedBenefit: '+50% storage capacity, reduced resource waste',
      implementationCost: [
        { resource: 'wood', amount: 200 },
        { resource: 'stone', amount: 100 },
        { resource: 'gold', amount: 500 },
      ],
      timeToImplement: 14,
      confidenceScore: 90,
      prerequisites: ['Available construction workers', 'Clear building space'],
      potentialRisks: ['High upfront cost', 'Construction time delays'],
    });
  }

  // Trade optimization recommendations
  const surplusResources = Object.entries(village.resources.netFlow)
    .filter(([_, flow]) => flow > 10)
    .map(([resource, flow]) => ({ resource, surplus: flow }));

  const deficitResources = Object.entries(village.resources.netFlow)
    .filter(([_, flow]) => flow < -5)
    .map(([resource, flow]) => ({ resource, deficit: Math.abs(flow) }));

  if (surplusResources.length > 0 && deficitResources.length > 0) {
    recommendations.push({
      id: `trade-${recommendationId++}`,
      type: 'trade',
      priority: 'medium',
      title: 'Establish Strategic Trade Routes',
      description: `Trade surplus ${surplusResources[0].resource} for needed ${deficitResources[0].resource}`,
      expectedBenefit: `Convert daily surplus into needed resources, improve resource balance`,
      implementationCost: [
        { resource: 'gold', amount: 300 },
        { resource: 'influence', amount: 10 },
      ],
      timeToImplement: 7,
      confidenceScore: 75,
      prerequisites: ['Available trade partners', 'Trade route security'],
      potentialRisks: ['Trade route disruptions', 'Price volatility'],
    });
  }

  // Construction optimization recommendations
  const deterioratingBuildings = village.buildings.filter(
    b => b.condition === 'poor' || b.condition === 'dilapidated'
  );

  if (deterioratingBuildings.length > 0) {
    recommendations.push({
      id: `construction-${recommendationId++}`,
      type: 'construction',
      priority: deterioratingBuildings.some(b => b.condition === 'dilapidated')
        ? 'high'
        : 'medium',
      title: 'Repair Deteriorating Buildings',
      description: `${deterioratingBuildings.length} buildings need repair to maintain production efficiency`,
      expectedBenefit: `Restore ${deterioratingBuildings.length * 15}% average production efficiency`,
      implementationCost: [
        { resource: 'wood', amount: deterioratingBuildings.length * 50 },
        { resource: 'tools', amount: deterioratingBuildings.length * 10 },
        { resource: 'gold', amount: deterioratingBuildings.length * 100 },
      ],
      timeToImplement: deterioratingBuildings.length * 3,
      confidenceScore: 95,
      prerequisites: [
        'Available construction workers',
        'Construction materials',
      ],
      potentialRisks: ['Temporary building shutdown during repairs'],
    });
  }

  // AI-generated advanced recommendations
  try {
    const aiContext = {
      village: {
        name: village.name,
        size: village.size,
        population: village.population.total,
        happiness: village.happiness,
        prosperity: village.prosperity,
        season: village.season.current,
      },
      resourceSituation: {
        criticalShortages: efficiencyAnalyses
          .filter(a => a.currentEfficiency < 30)
          .map(a => a.resourceType),
        majorSurplus: surplusResources.slice(0, 3),
        efficiencyIssues: efficiencyAnalyses
          .filter(a => a.improvementPotential > 25)
          .slice(0, 3),
      },
    };

    const aiRecommendations = await generateVillageContent(
      'optimization',
      `Based on village analysis, generate 2-3 advanced strategic recommendations for resource optimization. Context: ${JSON.stringify(aiContext)}`,
      aiContext
    );

    // Parse and add AI recommendations (simplified parsing)
    if (aiRecommendations && typeof aiRecommendations === 'string') {
      recommendations.push({
        id: `ai-strategic-${recommendationId++}`,
        type: 'policy',
        priority: 'medium',
        title: 'AI Strategic Recommendation',
        description: aiRecommendations.substring(0, 200),
        expectedBenefit: 'Strategic long-term village optimization',
        implementationCost: [{ resource: 'gold', amount: 200 }],
        timeToImplement: 30,
        confidenceScore: 70,
        prerequisites: ['Council approval', 'Resource availability'],
        potentialRisks: ['Uncertain outcomes', 'Adaptation period required'],
      });
    }
  } catch (error) {
    console.warn('AI recommendation generation failed:', error);
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}

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

    // Analyze current efficiency
    const efficiencyAnalyses = analyzeProductionEfficiency(village);

    // Generate optimization recommendations
    const recommendations = await generateOptimizationRecommendations(
      village,
      efficiencyAnalyses
    );

    // Calculate overall optimization potential
    const overallEfficiency =
      efficiencyAnalyses.reduce(
        (sum, analysis) => sum + analysis.currentEfficiency,
        0
      ) / efficiencyAnalyses.length;

    const maxPossibleEfficiency =
      efficiencyAnalyses.reduce(
        (sum, analysis) => sum + analysis.maxPossibleEfficiency,
        0
      ) / efficiencyAnalyses.length;

    const totalImprovementPotential = maxPossibleEfficiency - overallEfficiency;

    // Identify quick wins (high benefit, low cost, short time)
    const quickWins = recommendations.filter(
      rec =>
        rec.timeToImplement <= 7 &&
        rec.implementationCost.reduce((sum, cost) => sum + cost.amount, 0) <
          500 &&
        rec.confidenceScore > 80
    );

    // Identify strategic investments (high benefit, longer term)
    const strategicInvestments = recommendations.filter(
      rec =>
        rec.priority === 'high' ||
        (rec.priority === 'critical' && rec.timeToImplement > 7)
    );

    //TODO: Implement machine learning for optimization pattern recognition
    //TODO: Add seasonal optimization recommendations
    //TODO: Include population growth impact in optimization calculations
    //TODO: Implement optimization success tracking and learning

    return NextResponse.json({
      success: true,
      optimization: {
        overallEfficiency: Math.round(overallEfficiency),
        maxPossibleEfficiency: Math.round(maxPossibleEfficiency),
        improvementPotential: Math.round(totalImprovementPotential),
        optimizationGrade:
          overallEfficiency > 80
            ? 'A'
            : overallEfficiency > 70
              ? 'B'
              : overallEfficiency > 60
                ? 'C'
                : overallEfficiency > 50
                  ? 'D'
                  : 'F',
      },
      analyses: efficiencyAnalyses,
      recommendations: {
        all: recommendations,
        quickWins,
        strategicInvestments,
        highestPriority: recommendations.slice(0, 3),
      },
      summary: {
        totalRecommendations: recommendations.length,
        criticalIssues: recommendations.filter(r => r.priority === 'critical')
          .length,
        estimatedBenefit: `+${Math.round(totalImprovementPotential)}% average efficiency`,
        implementationTimeframe: `${Math.min(...recommendations.map(r => r.timeToImplement))}-${Math.max(...recommendations.map(r => r.timeToImplement))} days`,
      },
      lastAnalyzed: new Date(),
    });
  } catch (error) {
    console.error('Resource optimization analysis error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error during optimization analysis',
      },
      { status: 500 }
    );
  }
}
