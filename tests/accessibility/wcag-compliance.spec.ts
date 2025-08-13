/**
 * WCAG 2.1 AA Compliance Tests
 * 
 * Comprehensive accessibility testing to ensure the application meets
 * Web Content Accessibility Guidelines (WCAG) 2.1 Level AA standards.
 * Tests keyboard navigation, screen reader compatibility, and inclusive design.
 */

import { test, expect, Page } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

// Accessibility test utilities
class AccessibilityTestHelper {
  constructor(private page: Page) {}

  async runAxeCheck(tags: string[] = ['wcag2a', 'wcag2aa']) {
    await injectAxe(this.page);
    await checkA11y(this.page, null, {
      tags,
      rules: {
        // Configure specific rules for our application
        'color-contrast': { enabled: true },
        'keyboard-accessible': { enabled: true },
        'focus-management': { enabled: true },
        'aria-labels': { enabled: true },
        'semantic-structure': { enabled: true },
      }
    });
  }

  async testKeyboardNavigation() {
    // Test Tab navigation
    let focusableElements = await this.page.locator('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])').all();
    
    for (let i = 0; i < focusableElements.length; i++) {
      await this.page.keyboard.press('Tab');
      
      const focused = await this.page.evaluate(() => document.activeElement?.tagName);
      expect(focused).toBeTruthy();
    }
  }

  async testScreenReaderCompatibility() {
    // Check for proper ARIA labels and roles
    const elementsWithRoles = await this.page.locator('[role]').all();
    for (const element of elementsWithRoles) {
      const role = await element.getAttribute('role');
      expect(role).toBeTruthy();
    }

    // Check for alt text on images
    const images = await this.page.locator('img').all();
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      const ariaLabel = await img.getAttribute('aria-label');
      const ariaLabelledBy = await img.getAttribute('aria-labelledby');
      
      // Images should have alt text or appropriate ARIA labels
      expect(alt || ariaLabel || ariaLabelledBy).toBeTruthy();
    }
  }

  async testColorContrast() {
    // This will be handled by axe-core, but we can do additional checks
    const textElements = await this.page.locator('p, h1, h2, h3, h4, h5, h6, span, label, button').all();
    
    for (const element of textElements.slice(0, 10)) { // Sample check
      const styles = await element.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          color: computed.color,
          backgroundColor: computed.backgroundColor,
          fontSize: computed.fontSize,
        };
      });
      
      // Ensure text is not invisible (same color as background)
      expect(styles.color).not.toBe(styles.backgroundColor);
    }
  }

  async testFocusManagement() {
    // Test focus indicators are visible
    const interactiveElements = await this.page.locator('button, a, input, select').all();
    
    for (const element of interactiveElements.slice(0, 5)) {
      await element.focus();
      
      // Check if focus is visible (focus-within or custom focus styles)
      const focusStyles = await element.evaluate((el) => {
        const computed = window.getComputedStyle(el, ':focus');
        return {
          outline: computed.outline,
          boxShadow: computed.boxShadow,
          border: computed.border,
        };
      });
      
      // Should have some form of focus indication
      const hasFocusIndicator = focusStyles.outline !== 'none' || 
                                focusStyles.boxShadow !== 'none' ||
                                focusStyles.border !== 'none';
      
      if (!hasFocusIndicator) {
        console.warn(`Element may lack focus indicator:`, await element.getAttribute('class'));
      }
    }
  }
}

test.describe('WCAG 2.1 AA Compliance', () => {
  let a11yHelper: AccessibilityTestHelper;

  test.beforeEach(async ({ page }) => {
    a11yHelper = new AccessibilityTestHelper(page);
  });

  // ============================================================================
  // HOME PAGE ACCESSIBILITY
  // ============================================================================

  test('home page meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Run axe accessibility scan
    await a11yHelper.runAxeCheck();

    // Test keyboard navigation
    await a11yHelper.testKeyboardNavigation();

    // Test screen reader compatibility
    await a11yHelper.testScreenReaderCompatibility();

    // Test focus management
    await a11yHelper.testFocusManagement();

    // Verify page structure
    await expect(page.locator('h1')).toBeVisible(); // Should have main heading
    await expect(page.locator('main')).toBeVisible(); // Should have main landmark
    await expect(page.locator('nav')).toBeVisible(); // Should have navigation landmark
  });

  test('navigation component accessibility', async ({ page }) => {
    await page.goto('/');

    // Test navigation landmark
    const nav = page.locator('nav[role="navigation"]');
    await expect(nav).toBeVisible();

    // Test navigation items have proper labels
    const navLinks = page.locator('nav[role="navigation"] a');
    const linkCount = await navLinks.count();
    
    for (let i = 0; i < linkCount; i++) {
      const link = navLinks.nth(i);
      const text = await link.textContent();
      const ariaLabel = await link.getAttribute('aria-label');
      const title = await link.getAttribute('title');
      
      // Links should have accessible names
      expect(text || ariaLabel || title).toBeTruthy();
    }

    // Test mobile menu accessibility
    const mobileMenuButton = page.locator('[aria-label*="menú"], [aria-label*="menu"]');
    if (await mobileMenuButton.isVisible()) {
      await expect(mobileMenuButton).toHaveAttribute('aria-expanded');
      await expect(mobileMenuButton).toHaveAttribute('aria-controls');
    }
  });

  // ============================================================================
  // GAME LISTING PAGE ACCESSIBILITY
  // ============================================================================

  test('games listing page meets accessibility standards', async ({ page }) => {
    await page.goto('/games');
    await page.waitForLoadState('networkidle');

    // Run axe scan
    await a11yHelper.runAxeCheck();

    // Test game cards accessibility
    const gameCards = page.locator('[data-testid="game-card"]');
    if (await gameCards.count() > 0) {
      const firstCard = gameCards.first();
      
      // Cards should have proper headings
      await expect(firstCard.locator('h2, h3, h4')).toBeVisible();
      
      // Action buttons should be accessible
      const actionButton = firstCard.locator('button, a[role="button"]').first();
      if (await actionButton.isVisible()) {
        const buttonText = await actionButton.textContent();
        const ariaLabel = await actionButton.getAttribute('aria-label');
        expect(buttonText || ariaLabel).toBeTruthy();
      }
    }

    // Test search and filter accessibility
    const searchInput = page.locator('input[type="search"], input[placeholder*="buscar"]');
    if (await searchInput.isVisible()) {
      await expect(searchInput).toHaveAttribute('aria-label');
    }

    // Test filter buttons
    const filterButtons = page.locator('[role="button"][aria-pressed], button[aria-pressed]');
    const filterCount = await filterButtons.count();
    
    for (let i = 0; i < filterCount; i++) {
      const button = filterButtons.nth(i);
      await expect(button).toHaveAttribute('aria-pressed');
    }
  });

  // ============================================================================
  // GAME CREATION FORM ACCESSIBILITY
  // ============================================================================

  test('game creation form is accessible', async ({ page }) => {
    await page.goto('/games/create');
    await page.waitForLoadState('networkidle');

    // Run axe scan
    await a11yHelper.runAxeCheck();

    // Test form structure
    const form = page.locator('form');
    await expect(form).toBeVisible();

    // Test form labels
    const inputs = page.locator('input, select, textarea');
    const inputCount = await inputs.count();

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      
      if (id) {
        // Should have associated label
        const label = page.locator(`label[for="${id}"]`);
        const hasLabel = await label.count() > 0;
        const hasAriaLabel = ariaLabel || ariaLabelledBy;
        
        expect(hasLabel || hasAriaLabel).toBeTruthy();
      }
    }

    // Test required field indicators
    const requiredInputs = page.locator('input[required], select[required]');
    const requiredCount = await requiredInputs.count();

    for (let i = 0; i < requiredCount; i++) {
      const input = requiredInputs.nth(i);
      const ariaRequired = await input.getAttribute('aria-required');
      const hasAsterisk = await page.locator(`label[for="${await input.getAttribute('id')}"] *`).filter({ hasText: '*' }).count() > 0;
      
      expect(ariaRequired === 'true' || hasAsterisk).toBeTruthy();
    }

    // Test error messages
    const errorMessages = page.locator('[role="alert"], .error, [aria-live="polite"]');
    if (await errorMessages.count() > 0) {
      const firstError = errorMessages.first();
      await expect(firstError).toHaveAttribute('role', 'alert');
    }
  });

  // ============================================================================
  // GAME INTERFACE ACCESSIBILITY
  // ============================================================================

  test('RPG game interface accessibility', async ({ page }) => {
    // Create a test game first (assuming test data exists)
    await page.goto('/games/test-rpg-game');
    await page.waitForLoadState('networkidle');

    // Run axe scan
    await a11yHelper.runAxeCheck();

    // Test game board accessibility
    const gameBoard = page.locator('[data-testid="game-board"], [role="application"]');
    if (await gameBoard.isVisible()) {
      await expect(gameBoard).toHaveAttribute('role', 'application');
      await expect(gameBoard).toHaveAttribute('aria-label');
    }

    // Test action buttons
    const actionButtons = page.locator('[data-testid*="action-"], button[aria-label*="action"]');
    const buttonCount = await actionButtons.count();

    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const button = actionButtons.nth(i);
      const ariaLabel = await button.getAttribute('aria-label');
      const text = await button.textContent();
      
      expect(ariaLabel || text).toBeTruthy();
    }

    // Test status indicators
    const statusElements = page.locator('[data-testid*="status"], [role="status"]');
    if (await statusElements.count() > 0) {
      const firstStatus = statusElements.first();
      const role = await firstStatus.getAttribute('role');
      expect(role === 'status' || role === 'alert').toBeTruthy();
    }
  });

  test('deduction game chat accessibility', async ({ page }) => {
    await page.goto('/games/test-deduction-game');
    await page.waitForLoadState('networkidle');

    // Test chat interface
    const chatInput = page.locator('[data-testid="chat-input"], input[placeholder*="mensaje"]');
    if (await chatInput.isVisible()) {
      await expect(chatInput).toHaveAttribute('aria-label');
      
      // Test chat history
      const chatHistory = page.locator('[data-testid="chat-history"], [role="log"]');
      if (await chatHistory.isVisible()) {
        await expect(chatHistory).toHaveAttribute('role', 'log');
        await expect(chatHistory).toHaveAttribute('aria-live', 'polite');
      }
    }

    // Test voting interface
    const voteButtons = page.locator('[data-testid*="vote-"], button[aria-label*="votar"]');
    const voteCount = await voteButtons.count();

    for (let i = 0; i < voteCount; i++) {
      const button = voteButtons.nth(i);
      const ariaLabel = await button.getAttribute('aria-label');
      const text = await button.textContent();
      
      expect(ariaLabel || text).toBeTruthy();
    }
  });

  // ============================================================================
  // KEYBOARD NAVIGATION TESTS
  // ============================================================================

  test('complete keyboard navigation flow', async ({ page }) => {
    await page.goto('/');

    // Test tab order on home page
    await page.keyboard.press('Tab'); // Skip to main content link
    await page.keyboard.press('Tab'); // Logo/home link
    await page.keyboard.press('Tab'); // First nav item

    let activeElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(activeElement).toBe('A'); // Should be on a link

    // Navigate to games page using keyboard
    await page.keyboard.press('ArrowRight'); // Navigate to next nav item
    await page.keyboard.press('Enter'); // Should activate games link

    await page.waitForURL('**/games');
    
    // Test keyboard navigation on games page
    await page.keyboard.press('Tab'); // Focus on first interactive element
    
    // Test escape key functionality (if modal/dropdown is open)
    await page.keyboard.press('Escape');
    
    // Verify no modal/dropdown is open after Escape
    const modal = page.locator('[role="dialog"], .modal, [data-testid="modal"]');
    await expect(modal).not.toBeVisible();
  });

  test('keyboard shortcuts and access keys', async ({ page }) => {
    await page.goto('/');

    // Test skip to main content link
    await page.keyboard.press('Tab');
    const skipLink = page.locator('a[href="#main"], a:has-text("Saltar al contenido")');
    if (await skipLink.isVisible()) {
      await skipLink.press('Enter');
      
      const mainElement = page.locator('main, #main');
      await expect(mainElement).toBeFocused();
    }

    // Test other access keys if implemented
    const elementsWithAccessKeys = page.locator('[accesskey]');
    const accessKeyCount = await elementsWithAccessKeys.count();

    for (let i = 0; i < accessKeyCount; i++) {
      const element = elementsWithAccessKeys.nth(i);
      const accessKey = await element.getAttribute('accesskey');
      
      // Access keys should be single characters
      expect(accessKey?.length).toBe(1);
    }
  });

  // ============================================================================
  // SCREEN READER COMPATIBILITY TESTS
  // ============================================================================

  test('screen reader landmarks and structure', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Test HTML5 semantic structure
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('nav')).toBeVisible();

    // Test heading hierarchy
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const headingCount = await headings.count();
    
    expect(headingCount).toBeGreaterThan(0);
    
    // Should have exactly one h1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);

    // Test ARIA landmarks
    const landmarks = page.locator('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"]');
    const landmarkCount = await landmarks.count();
    expect(landmarkCount).toBeGreaterThan(0);
  });

  test('dynamic content announcements', async ({ page }) => {
    await page.goto('/games');

    // Test live regions for dynamic content
    const liveRegions = page.locator('[aria-live], [role="status"], [role="alert"]');
    const liveCount = await liveRegions.count();

    if (liveCount > 0) {
      for (let i = 0; i < liveCount; i++) {
        const region = liveRegions.nth(i);
        const ariaLive = await region.getAttribute('aria-live');
        const role = await region.getAttribute('role');
        
        // Should have appropriate aria-live or role
        expect(ariaLive === 'polite' || ariaLive === 'assertive' || role === 'status' || role === 'alert').toBeTruthy();
      }
    }
  });

  // ============================================================================
  // MOBILE ACCESSIBILITY TESTS
  // ============================================================================

  test('mobile accessibility compliance', async ({ page, browserName }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Run axe scan on mobile
    await a11yHelper.runAxeCheck();

    // Test mobile navigation
    const mobileMenuButton = page.locator('[aria-label*="menú"], [data-testid="mobile-menu-button"]');
    if (await mobileMenuButton.isVisible()) {
      await mobileMenuButton.click();
      
      const mobileMenu = page.locator('[data-testid="mobile-menu"], [role="navigation"][aria-expanded="true"]');
      await expect(mobileMenu).toBeVisible();
      
      // Test mobile menu keyboard navigation
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
    }

    // Test touch target sizes
    const buttons = page.locator('button, a, input[type="button"], input[type="submit"]');
    const buttonCount = await buttons.count();

    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = buttons.nth(i);
      const boundingBox = await button.boundingBox();
      
      if (boundingBox) {
        // Touch targets should be at least 44x44px (WCAG AAA) or 48x48px (Material Design)
        expect(boundingBox.width >= 44 && boundingBox.height >= 44).toBeTruthy();
      }
    }
  });

  // ============================================================================
  // COLOR AND CONTRAST TESTS
  // ============================================================================

  test('color contrast compliance', async ({ page }) => {
    await page.goto('/');

    // This will be primarily handled by axe-core, but we can do some manual checks
    await a11yHelper.testColorContrast();

    // Test that information is not conveyed by color alone
    const colorOnlyElements = page.locator('.text-red-500, .text-green-500, .bg-red-100');
    const colorCount = await colorOnlyElements.count();

    for (let i = 0; i < colorCount; i++) {
      const element = colorOnlyElements.nth(i);
      
      // Elements using color should also have text, icons, or other indicators
      const hasText = (await element.textContent())?.trim().length > 0;
      const hasIcon = await element.locator('svg, img, .icon').count() > 0;
      const hasAriaLabel = await element.getAttribute('aria-label');
      
      expect(hasText || hasIcon || hasAriaLabel).toBeTruthy();
    }
  });

  test('dark mode accessibility', async ({ page }) => {
    await page.goto('/');

    // Toggle dark mode if available
    const darkModeToggle = page.locator('[data-testid="theme-toggle"], button:has-text("Dark"), button:has-text("Oscuro")');
    if (await darkModeToggle.isVisible()) {
      await darkModeToggle.click();
      
      // Wait for theme change
      await page.waitForTimeout(500);
      
      // Run accessibility scan in dark mode
      await a11yHelper.runAxeCheck();
      
      // Test that dark mode maintains contrast ratios
      await a11yHelper.testColorContrast();
    }
  });

  // ============================================================================
  // FORM ACCESSIBILITY TESTS
  // ============================================================================

  test('form validation accessibility', async ({ page }) => {
    await page.goto('/games/create');

    // Try to submit form without required fields
    const submitButton = page.locator('button[type="submit"], input[type="submit"]');
    if (await submitButton.isVisible()) {
      await submitButton.click();
      
      // Check for accessible error messages
      const errorMessages = page.locator('[role="alert"], .error, [aria-invalid="true"] + .error-message');
      if (await errorMessages.count() > 0) {
        const firstError = errorMessages.first();
        
        // Error should be announced to screen readers
        const role = await firstError.getAttribute('role');
        const ariaLive = await firstError.getAttribute('aria-live');
        
        expect(role === 'alert' || ariaLive === 'assertive').toBeTruthy();
      }

      // Check that invalid fields are properly marked
      const invalidInputs = page.locator('[aria-invalid="true"]');
      const invalidCount = await invalidInputs.count();

      for (let i = 0; i < invalidCount; i++) {
        const input = invalidInputs.nth(i);
        const ariaDescribedBy = await input.getAttribute('aria-describedby');
        
        if (ariaDescribedBy) {
          const errorElement = page.locator(`#${ariaDescribedBy}`);
          await expect(errorElement).toBeVisible();
        }
      }
    }
  });
});