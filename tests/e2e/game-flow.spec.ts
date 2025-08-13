/**
 * End-to-End Game Flow Tests
 * 
 * Comprehensive testing of complete user journeys through game creation,
 * joining, playing, and completion flows. Tests real user behavior patterns
 * and integration between frontend and backend systems.
 */

import { test, expect, Page } from '@playwright/test';

// Test utilities
const createUniqueGameName = () => `Test Game ${Date.now()}`;
const createUniquePlayerName = () => `Player${Math.floor(Math.random() * 10000)}`;

// Page Object Models
class GameLobbyPage {
  constructor(private page: Page) {}

  async navigateToGames() {
    await this.page.goto('/games');
    await this.page.waitForLoadState('networkidle');
  }

  async createGame(gameType: 'rpg' | 'deduction' | 'village', options: {
    name?: string;
    description?: string;
    maxPlayers?: number;
    isPrivate?: boolean;
  } = {}) {
    await this.page.click('[data-testid="create-game-button"]');
    
    // Select game type
    await this.page.click(`[data-testid="game-type-${gameType}"]`);
    
    // Fill game details
    if (options.name) {
      await this.page.fill('[data-testid="game-name-input"]', options.name);
    }
    
    if (options.description) {
      await this.page.fill('[data-testid="game-description-input"]', options.description);
    }
    
    if (options.maxPlayers) {
      await this.page.selectOption('[data-testid="max-players-select"]', options.maxPlayers.toString());
    }
    
    if (options.isPrivate) {
      await this.page.check('[data-testid="private-game-checkbox"]');
    }
    
    await this.page.click('[data-testid="create-game-submit"]');
    
    // Wait for game to be created and redirected
    await this.page.waitForURL(/\/games\/[a-f0-9-]+$/);
  }

  async joinGame(gameId: string, playerName: string) {
    await this.page.goto(`/games/${gameId}/join`);
    await this.page.fill('[data-testid="player-name-input"]', playerName);
    await this.page.click('[data-testid="join-game-button"]');
    
    // Wait for successful join
    await this.page.waitForSelector('[data-testid="game-lobby"]');
  }

  async startGame() {
    await this.page.click('[data-testid="start-game-button"]');
    await this.page.waitForSelector('[data-testid="game-interface"]');
  }

  async waitForPlayerCount(expectedCount: number) {
    await this.page.waitForFunction(
      count => document.querySelectorAll('[data-testid="player-item"]').length >= count,
      expectedCount
    );
  }
}

class RPGGamePage {
  constructor(private page: Page) {}

  async takeAction(actionType: 'move' | 'attack' | 'cast' | 'interact', target?: string) {
    await this.page.click(`[data-testid="action-${actionType}"]`);
    
    if (target) {
      await this.page.click(`[data-testid="target-${target}"]`);
    }
    
    await this.page.click('[data-testid="confirm-action"]');
    
    // Wait for action to be processed
    await this.page.waitForSelector('[data-testid="action-result"]');
  }

  async checkHealth() {
    const healthBar = await this.page.locator('[data-testid="player-health"]');
    const healthValue = await healthBar.getAttribute('data-health');
    return parseInt(healthValue || '0');
  }

  async openInventory() {
    await this.page.click('[data-testid="inventory-button"]');
    await this.page.waitForSelector('[data-testid="inventory-panel"]');
  }

  async useItem(itemName: string) {
    await this.openInventory();
    await this.page.click(`[data-testid="item-${itemName}"]`);
    await this.page.click('[data-testid="use-item-button"]');
  }
}

class DeductionGamePage {
  constructor(private page: Page) {}

  async sendMessage(message: string) {
    await this.page.fill('[data-testid="chat-input"]', message);
    await this.page.press('[data-testid="chat-input"]', 'Enter');
  }

  async voteForPlayer(playerId: string) {
    await this.page.click(`[data-testid="vote-${playerId}"]`);
    await this.page.click('[data-testid="confirm-vote"]');
  }

  async useAbility(abilityName: string, target?: string) {
    await this.page.click(`[data-testid="ability-${abilityName}"]`);
    
    if (target) {
      await this.page.click(`[data-testid="target-${target}"]`);
    }
    
    await this.page.click('[data-testid="use-ability"]');
  }

  async waitForPhaseChange(expectedPhase: string) {
    await this.page.waitForSelector(`[data-testid="phase-${expectedPhase}"]`);
  }
}

class VillageGamePage {
  constructor(private page: Page) {}

  async allocateResources(resource: string, amount: number) {
    await this.page.click('[data-testid="resource-management"]');
    await this.page.fill(`[data-testid="${resource}-allocation"]`, amount.toString());
    await this.page.click('[data-testid="apply-allocation"]');
  }

  async constructBuilding(buildingType: string) {
    await this.page.click('[data-testid="construction-menu"]');
    await this.page.click(`[data-testid="build-${buildingType}"]`);
    await this.page.click('[data-testid="confirm-construction"]');
  }

  async tradeWithNPC(npcId: string, offer: string, request: string) {
    await this.page.click(`[data-testid="npc-${npcId}"]`);
    await this.page.selectOption('[data-testid="trade-offer"]', offer);
    await this.page.selectOption('[data-testid="trade-request"]', request);
    await this.page.click('[data-testid="propose-trade"]');
  }

  async advanceSeason() {
    await this.page.click('[data-testid="advance-season"]');
    await this.page.waitForSelector('[data-testid="season-transition"]');
  }
}

// Test Suite
test.describe('Complete Game Flows', () => {
  let gameLobby: GameLobbyPage;

  test.beforeEach(async ({ page }) => {
    gameLobby = new GameLobbyPage(page);
  });

  // ============================================================================
  // RPG GAME FLOW TESTS
  // ============================================================================

  test.describe('RPG Game Flow', () => {
    test('complete RPG game creation and play session', async ({ page, context }) => {
      const gameName = createUniqueGameName();
      const playerName = createUniquePlayerName();

      // Create game
      await gameLobby.navigateToGames();
      await gameLobby.createGame('rpg', {
        name: gameName,
        description: 'Epic adventure awaits',
        maxPlayers: 2,
        isPrivate: false
      });

      // Verify game created
      await expect(page.locator('[data-testid="game-title"]')).toContainText(gameName);
      await expect(page.locator('[data-testid="game-status"]')).toContainText('Esperando jugadores');

      // Join as second player (simulate another user)
      const secondPage = await context.newPage();
      const secondLobby = new GameLobbyPage(secondPage);
      
      const gameId = page.url().split('/').pop();
      await secondLobby.joinGame(gameId!, 'SecondPlayer');

      // Wait for both players
      await gameLobby.waitForPlayerCount(2);

      // Start the game
      await gameLobby.startGame();
      
      // Verify game interface loads
      await expect(page.locator('[data-testid="rpg-game-board"]')).toBeVisible();
      await expect(page.locator('[data-testid="character-sheet"]')).toBeVisible();
      await expect(page.locator('[data-testid="action-panel"]')).toBeVisible();

      // Play some turns
      const rpgPage = new RPGGamePage(page);
      
      // Take movement action
      await rpgPage.takeAction('move', 'forest');
      await expect(page.locator('[data-testid="action-result"]')).toContainText('moved to forest');

      // Check inventory
      await rpgPage.openInventory();
      await expect(page.locator('[data-testid="inventory-panel"]')).toBeVisible();

      // Use starting item
      await rpgPage.useItem('health-potion');

      // Verify health increased
      const health = await rpgPage.checkHealth();
      expect(health).toBeGreaterThan(90);

      // Clean up
      await secondPage.close();
    });

    test('RPG combat system integration', async ({ page, context }) => {
      // Create and join game
      const gameName = createUniqueGameName();
      await gameLobby.navigateToGames();
      await gameLobby.createGame('rpg', { name: gameName, maxPlayers: 2 });

      // Add second player
      const secondPage = await context.newPage();
      const gameId = page.url().split('/').pop();
      await new GameLobbyPage(secondPage).joinGame(gameId!, 'CombatPartner');

      await gameLobby.waitForPlayerCount(2);
      await gameLobby.startGame();

      const rpgPage = new RPGGamePage(page);

      // Trigger combat encounter
      await rpgPage.takeAction('move', 'dangerous-area');
      
      // Verify combat interface appears
      await expect(page.locator('[data-testid="combat-interface"]')).toBeVisible();
      await expect(page.locator('[data-testid="initiative-tracker"]')).toBeVisible();

      // Perform combat actions
      await rpgPage.takeAction('attack', 'enemy-1');
      
      // Verify combat log updates
      await expect(page.locator('[data-testid="combat-log"]')).toContainText('attacked');

      await secondPage.close();
    });

    test('RPG character progression', async ({ page }) => {
      const gameName = createUniqueGameName();
      await gameLobby.navigateToGames();
      await gameLobby.createGame('rpg', { name: gameName, maxPlayers: 1 });

      await gameLobby.startGame();

      const rpgPage = new RPGGamePage(page);

      // Complete several actions to gain experience
      for (let i = 0; i < 5; i++) {
        await rpgPage.takeAction('interact', `location-${i}`);
        await page.waitForTimeout(1000); // Wait for action processing
      }

      // Check for level up
      const characterSheet = page.locator('[data-testid="character-sheet"]');
      await expect(characterSheet).toContainText('Level');
      
      // Verify experience points increased
      const expElement = page.locator('[data-testid="experience-points"]');
      const experience = await expElement.textContent();
      expect(parseInt(experience || '0')).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // DEDUCTION GAME FLOW TESTS
  // ============================================================================

  test.describe('Deduction Game Flow', () => {
    test('complete deduction game with voting and role reveals', async ({ page, context }) => {
      const gameName = createUniqueGameName();

      // Create deduction game
      await gameLobby.navigateToGames();
      await gameLobby.createGame('deduction', {
        name: gameName,
        maxPlayers: 4,
      });

      // Add multiple players
      const players = [];
      for (let i = 1; i < 4; i++) {
        const playerPage = await context.newPage();
        players.push(playerPage);
        
        const gameId = page.url().split('/').pop();
        await new GameLobbyPage(playerPage).joinGame(gameId!, `Player${i}`);
      }

      await gameLobby.waitForPlayerCount(4);
      await gameLobby.startGame();

      const deductionPage = new DeductionGamePage(page);

      // Verify roles are assigned
      await expect(page.locator('[data-testid="role-card"]')).toBeVisible();
      await expect(page.locator('[data-testid="role-description"]')).toBeVisible();

      // Discussion phase
      await deductionPage.waitForPhaseChange('discussion');
      await deductionPage.sendMessage('I think we should investigate the library first');

      // Verify message appears in chat
      await expect(page.locator('[data-testid="chat-messages"]')).toContainText('investigate the library');

      // Use role ability
      const roleAbilities = page.locator('[data-testid^="ability-"]');
      if (await roleAbilities.first().isVisible()) {
        await deductionPage.useAbility('investigate', 'Player1');
      }

      // Voting phase
      await deductionPage.waitForPhaseChange('voting');
      await deductionPage.voteForPlayer('Player2');

      // Verify vote was cast
      await expect(page.locator('[data-testid="vote-status"]')).toContainText('Vote cast');

      // Clean up
      for (const playerPage of players) {
        await playerPage.close();
      }
    });

    test('deduction game secret information handling', async ({ page, context }) => {
      const gameName = createUniqueGameName();

      await gameLobby.navigateToGames();
      await gameLobby.createGame('deduction', { name: gameName, maxPlayers: 3 });

      // Add players
      const secondPage = await context.newPage();
      const thirdPage = await context.newPage();
      
      const gameId = page.url().split('/').pop();
      await new GameLobbyPage(secondPage).joinGame(gameId!, 'Detective');
      await new GameLobbyPage(thirdPage).joinGame(gameId!, 'Suspect');

      await gameLobby.waitForPlayerCount(3);
      await gameLobby.startGame();

      // Verify each player sees different role information
      const roleText1 = await page.locator('[data-testid="role-description"]').textContent();
      const roleText2 = await secondPage.locator('[data-testid="role-description"]').textContent();
      const roleText3 = await thirdPage.locator('[data-testid="role-description"]').textContent();

      // Role descriptions should be different (secret information)
      expect(roleText1).not.toEqual(roleText2);
      expect(roleText2).not.toEqual(roleText3);

      // Verify secret abilities are only visible to appropriate players
      const secretAbilities1 = await page.locator('[data-testid="secret-abilities"]').count();
      const secretAbilities2 = await secondPage.locator('[data-testid="secret-abilities"]').count();

      // Each player should have their own unique secret abilities
      expect(secretAbilities1 + secretAbilities2).toBeGreaterThan(0);

      await secondPage.close();
      await thirdPage.close();
    });
  });

  // ============================================================================
  // VILLAGE GAME FLOW TESTS
  // ============================================================================

  test.describe('Village Game Flow', () => {
    test('complete village building and resource management', async ({ page }) => {
      const gameName = createUniqueGameName();

      await gameLobby.navigateToGames();
      await gameLobby.createGame('village', {
        name: gameName,
        maxPlayers: 2,
      });

      await gameLobby.startGame();

      const villagePage = new VillageGamePage(page);

      // Verify village interface
      await expect(page.locator('[data-testid="resource-panel"]')).toBeVisible();
      await expect(page.locator('[data-testid="building-grid"]')).toBeVisible();
      await expect(page.locator('[data-testid="season-indicator"]')).toBeVisible();

      // Allocate starting resources
      await villagePage.allocateResources('wood', 50);
      await villagePage.allocateResources('food', 30);

      // Construct first building
      await villagePage.constructBuilding('house');

      // Verify building appears
      await expect(page.locator('[data-testid="building-house"]')).toBeVisible();

      // Trade with NPC
      await villagePage.tradeWithNPC('merchant', 'wood', 'stone');

      // Verify resource changes
      const stoneCount = await page.locator('[data-testid="resource-stone"]').textContent();
      expect(parseInt(stoneCount || '0')).toBeGreaterThan(0);

      // Advance through a season
      await villagePage.advanceSeason();
      await expect(page.locator('[data-testid="season-summer"]')).toBeVisible();
    });

    test('village crisis management and events', async ({ page }) => {
      const gameName = createUniqueGameName();

      await gameLobby.navigateToGames();
      await gameLobby.createGame('village', { name: gameName, maxPlayers: 1 });

      await gameLobby.startGame();

      const villagePage = new VillageGamePage(page);

      // Build up village to trigger events
      await villagePage.constructBuilding('farm');
      await villagePage.constructBuilding('blacksmith');
      await villagePage.constructBuilding('house');

      // Advance several seasons to trigger crisis
      for (let i = 0; i < 3; i++) {
        await villagePage.advanceSeason();
        await page.waitForTimeout(2000);
      }

      // Check for crisis events
      const crisisPanel = page.locator('[data-testid="crisis-panel"]');
      if (await crisisPanel.isVisible()) {
        // Handle the crisis
        await page.click('[data-testid="crisis-option-1"]');
        
        // Verify crisis resolution
        await expect(page.locator('[data-testid="crisis-result"]')).toBeVisible();
      }

      // Verify village survived and continued functioning
      await expect(page.locator('[data-testid="village-status"]')).not.toContainText('destroyed');
    });
  });

  // ============================================================================
  // CROSS-GAME INTEGRATION TESTS
  // ============================================================================

  test.describe('Cross-Game Integration', () => {
    test('user can switch between different game types', async ({ page }) => {
      // Test navigation between different game types
      await gameLobby.navigateToGames();

      // Create RPG game
      const rpgGameName = createUniqueGameName() + '-RPG';
      await gameLobby.createGame('rpg', { name: rpgGameName, maxPlayers: 1 });
      await gameLobby.startGame();

      // Verify RPG interface
      await expect(page.locator('[data-testid="rpg-game-board"]')).toBeVisible();

      // Return to games lobby
      await page.goto('/games');

      // Create Deduction game
      const deductionGameName = createUniqueGameName() + '-Deduction';
      await gameLobby.createGame('deduction', { name: deductionGameName, maxPlayers: 3 });
      
      // Verify different interface
      await expect(page.locator('[data-testid="game-lobby"]')).toBeVisible();
      await expect(page.locator('[data-testid="waiting-for-players"]')).toBeVisible();

      // Return to games list and verify both games exist
      await page.goto('/games');
      await expect(page.locator('text=' + rpgGameName)).toBeVisible();
      await expect(page.locator('text=' + deductionGameName)).toBeVisible();
    });

    test('game list filtering and searching works correctly', async ({ page }) => {
      await gameLobby.navigateToGames();

      // Create games of different types
      await gameLobby.createGame('rpg', { name: 'RPG Adventure', maxPlayers: 4 });
      await page.goto('/games');

      await gameLobby.createGame('village', { name: 'Village Builder', maxPlayers: 2 });
      await page.goto('/games');

      // Test filtering by game type
      await page.click('[data-testid="filter-rpg"]');
      await expect(page.locator('text=RPG Adventure')).toBeVisible();
      await expect(page.locator('text=Village Builder')).not.toBeVisible();

      // Test search functionality
      await page.fill('[data-testid="search-games"]', 'Village');
      await page.click('[data-testid="filter-all"]');
      await expect(page.locator('text=Village Builder')).toBeVisible();
      await expect(page.locator('text=RPG Adventure')).not.toBeVisible();

      // Clear search
      await page.fill('[data-testid="search-games"]', '');
      await expect(page.locator('text=RPG Adventure')).toBeVisible();
      await expect(page.locator('text=Village Builder')).toBeVisible();
    });
  });

  // ============================================================================
  // ERROR HANDLING AND EDGE CASES
  // ============================================================================

  test.describe('Error Handling', () => {
    test('handles network failures gracefully', async ({ page, context }) => {
      const gameName = createUniqueGameName();
      
      await gameLobby.navigateToGames();
      await gameLobby.createGame('rpg', { name: gameName, maxPlayers: 2 });

      // Simulate network failure
      await context.setOffline(true);

      // Try to perform action that requires network
      await page.click('[data-testid="start-game-button"]').catch(() => {});

      // Verify error message appears
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('conexión');

      // Restore network
      await context.setOffline(false);

      // Verify recovery
      await page.reload();
      await expect(page.locator('[data-testid="game-lobby"]')).toBeVisible();
    });

    test('handles game state conflicts', async ({ page, context }) => {
      const gameName = createUniqueGameName();
      
      await gameLobby.navigateToGames();
      await gameLobby.createGame('deduction', { name: gameName, maxPlayers: 2 });

      // Add second player
      const secondPage = await context.newPage();
      const gameId = page.url().split('/').pop();
      await new GameLobbyPage(secondPage).joinGame(gameId!, 'ConflictPlayer');

      await gameLobby.waitForPlayerCount(2);
      await gameLobby.startGame();

      // Both players try to vote simultaneously
      const deductionPage1 = new DeductionGamePage(page);
      const deductionPage2 = new DeductionGamePage(secondPage);

      await deductionPage1.waitForPhaseChange('voting');
      await Promise.all([
        deductionPage1.voteForPlayer('ConflictPlayer'),
        deductionPage2.voteForPlayer('Player1')
      ]);

      // Verify both votes are handled correctly
      await expect(page.locator('[data-testid="vote-results"]')).toBeVisible();
      
      await secondPage.close();
    });

    test('validates user input and prevents exploitation', async ({ page }) => {
      await gameLobby.navigateToGames();

      // Try to create game with malicious input
      await page.click('[data-testid="create-game-button"]');
      await page.click('[data-testid="game-type-rpg"]');

      // Test XSS prevention
      await page.fill('[data-testid="game-name-input"]', '<script>alert("xss")</script>');
      await page.fill('[data-testid="game-description-input"]', 'javascript:alert("xss")');

      await page.click('[data-testid="create-game-submit"]');

      // Verify input is sanitized
      await expect(page.locator('[data-testid="game-title"]')).not.toContainText('<script>');
      
      // Test SQL injection prevention
      await page.goto('/games');
      await page.fill('[data-testid="search-games"]', "'; DROP TABLE games; --");
      
      // Should not cause error
      await expect(page.locator('[data-testid="games-list"]')).toBeVisible();
    });
  });

  // ============================================================================
  // PERFORMANCE AND LOAD TESTING
  // ============================================================================

  test.describe('Performance', () => {
    test('game creation and joining performs well', async ({ page }) => {
      const startTime = Date.now();
      
      await gameLobby.navigateToGames();
      await gameLobby.createGame('rpg', {
        name: createUniqueGameName(),
        maxPlayers: 4
      });

      const creationTime = Date.now() - startTime;
      expect(creationTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Test game loading performance
      const loadStartTime = Date.now();
      await gameLobby.startGame();
      
      const loadTime = Date.now() - loadStartTime;
      expect(loadTime).toBeLessThan(3000); // Game should load within 3 seconds
    });

    test('handles multiple rapid actions without degradation', async ({ page }) => {
      const gameName = createUniqueGameName();
      
      await gameLobby.navigateToGames();
      await gameLobby.createGame('rpg', { name: gameName, maxPlayers: 1 });
      await gameLobby.startGame();

      const rpgPage = new RPGGamePage(page);

      // Perform rapid actions
      const startTime = Date.now();
      for (let i = 0; i < 10; i++) {
        await rpgPage.takeAction('interact', `rapid-target-${i}`);
        // Small delay to prevent overwhelming the server
        await page.waitForTimeout(100);
      }
      
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(15000); // Should complete all actions within 15 seconds

      // Verify game state remains consistent
      await expect(page.locator('[data-testid="game-interface"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();
    });
  });
});