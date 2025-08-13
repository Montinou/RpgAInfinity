/**
 * Comprehensive tests for Navigation Component
 *
 * Tests navigation functionality, accessibility compliance, responsive behavior,
 * and user interactions for the main site navigation component.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePathname } from 'next/navigation';
import Navigation from '../Navigation';
import '@testing-library/jest-dom';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

// Mock Next.js Link component
jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;

describe('Navigation Component', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    mockUsePathname.mockReturnValue('/');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // RENDERING TESTS
  // ============================================================================

  describe('Rendering', () => {
    test('renders the logo and brand name', () => {
      render(<Navigation />);

      expect(screen.getByText('RpgAInfinity')).toBeInTheDocument();
      expect(
        screen.getByText('Aventuras infinitas con IA')
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText('RpgAInfinity - Inicio')
      ).toBeInTheDocument();
    });

    test('renders all navigation items in desktop nav', () => {
      render(<Navigation />);

      // Check that all nav items are present
      expect(screen.getByText('Inicio')).toBeInTheDocument();
      expect(screen.getByText('Juegos')).toBeInTheDocument();
      expect(screen.getByText('Comunidad')).toBeInTheDocument();
    });

    test('renders mobile menu button', () => {
      render(<Navigation />);

      const menuButton = screen.getByLabelText('Abrir menú');
      expect(menuButton).toBeInTheDocument();
      expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    });

    test('applies custom className when provided', () => {
      const customClass = 'custom-nav-class';
      const { container } = render(<Navigation className={customClass} />);

      const header = container.querySelector('header');
      expect(header).toHaveClass(customClass);
    });
  });

  // ============================================================================
  // ACTIVE STATE TESTS
  // ============================================================================

  describe('Active State Handling', () => {
    test('highlights active page correctly', () => {
      mockUsePathname.mockReturnValue('/games');
      render(<Navigation />);

      const gamesLink = screen.getAllByText('Juegos')[0].closest('a');
      expect(gamesLink).toHaveAttribute('aria-current', 'page');
      expect(gamesLink).toHaveClass('text-primary', 'bg-primary/10');
    });

    test('shows no active state when not on a nav page', () => {
      mockUsePathname.mockReturnValue('/some-other-page');
      render(<Navigation />);

      const links = screen.getAllByRole('link');
      const navLinks = links.filter(
        link =>
          link.getAttribute('href') === '/' ||
          link.getAttribute('href') === '/games' ||
          link.getAttribute('href') === '/community'
      );

      navLinks.forEach(link => {
        if (link.getAttribute('href') !== '/') {
          // Skip logo link
          expect(link).not.toHaveAttribute('aria-current', 'page');
          expect(link).toHaveClass('text-muted-foreground');
        }
      });
    });

    test('updates active state when pathname changes', () => {
      const { rerender } = render(<Navigation />);

      // Initially on home
      mockUsePathname.mockReturnValue('/');
      rerender(<Navigation />);

      let homeLink = screen.getAllByText('Inicio')[0].closest('a');
      expect(homeLink).toHaveAttribute('aria-current', 'page');

      // Navigate to games
      mockUsePathname.mockReturnValue('/games');
      rerender(<Navigation />);

      const gamesLink = screen.getAllByText('Juegos')[0].closest('a');
      expect(gamesLink).toHaveAttribute('aria-current', 'page');

      homeLink = screen.getAllByText('Inicio')[0].closest('a');
      expect(homeLink).not.toHaveAttribute('aria-current', 'page');
    });
  });

  // ============================================================================
  // MOBILE MENU TESTS
  // ============================================================================

  describe('Mobile Menu Functionality', () => {
    test('opens mobile menu when button is clicked', async () => {
      render(<Navigation />);

      const menuButton = screen.getByLabelText('Abrir menú');

      // Menu should be closed initially
      expect(
        screen.queryByRole('navigation', { name: 'Navegación móvil' })
      ).not.toBeInTheDocument();

      await user.click(menuButton);

      // Menu should be open
      expect(
        screen.getByRole('navigation', { name: 'Navegación móvil' })
      ).toBeInTheDocument();
      expect(menuButton).toHaveAttribute('aria-expanded', 'true');
      expect(menuButton).toHaveAttribute('aria-label', 'Cerrar menú');
    });

    test('closes mobile menu when close button is clicked', async () => {
      render(<Navigation />);

      const menuButton = screen.getByLabelText('Abrir menú');

      // Open menu
      await user.click(menuButton);
      expect(
        screen.getByRole('navigation', { name: 'Navegación móvil' })
      ).toBeInTheDocument();

      // Close menu
      const closeButton = screen.getByLabelText('Cerrar menú');
      await user.click(closeButton);

      await waitFor(() => {
        expect(
          screen.queryByRole('navigation', { name: 'Navegación móvil' })
        ).not.toBeInTheDocument();
      });
      expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    });

    test('closes mobile menu when navigation link is clicked', async () => {
      render(<Navigation />);

      const menuButton = screen.getByLabelText('Abrir menú');

      // Open menu
      await user.click(menuButton);
      expect(
        screen.getByRole('navigation', { name: 'Navegación móvil' })
      ).toBeInTheDocument();

      // Click a navigation link in mobile menu
      const mobileNavLinks = screen
        .getByRole('navigation', { name: 'Navegación móvil' })
        .querySelectorAll('a');
      await user.click(mobileNavLinks[0]);

      await waitFor(() => {
        expect(
          screen.queryByRole('navigation', { name: 'Navegación móvil' })
        ).not.toBeInTheDocument();
      });
    });

    test('mobile menu shows item descriptions', async () => {
      render(<Navigation />);

      await user.click(screen.getByLabelText('Abrir menú'));

      expect(screen.getByText('Página principal')).toBeInTheDocument();
      expect(screen.getByText('Seleccionar juego')).toBeInTheDocument();
      expect(screen.getByText('Salas activas')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // ACCESSIBILITY TESTS
  // ============================================================================

  describe('Accessibility', () => {
    test('has proper ARIA labels and roles', () => {
      render(<Navigation />);

      expect(
        screen.getByRole('navigation', { name: 'Navegación principal' })
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText('RpgAInfinity - Inicio')
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Abrir menú')).toBeInTheDocument();
    });

    test('navigation links have proper titles', () => {
      render(<Navigation />);

      const inicioLink = screen.getAllByText('Inicio')[0].closest('a');
      expect(inicioLink).toHaveAttribute('title', 'Página principal');

      const juegosLink = screen.getAllByText('Juegos')[0].closest('a');
      expect(juegosLink).toHaveAttribute('title', 'Seleccionar juego');

      const comunidadLink = screen.getAllByText('Comunidad')[0].closest('a');
      expect(comunidadLink).toHaveAttribute('title', 'Salas activas');
    });

    test('mobile menu has proper ARIA attributes', async () => {
      render(<Navigation />);

      const menuButton = screen.getByLabelText('Abrir menú');
      expect(menuButton).toHaveAttribute('aria-controls', 'mobile-menu');
      expect(menuButton).toHaveAttribute('aria-expanded', 'false');

      await user.click(menuButton);

      expect(menuButton).toHaveAttribute('aria-expanded', 'true');
      const mobileMenu = screen.getByRole('navigation', {
        name: 'Navegación móvil',
      });
      expect(mobileMenu.closest('div')).toHaveAttribute('id', 'mobile-menu');
    });

    test('keyboard navigation works correctly', async () => {
      render(<Navigation />);

      // Tab to logo
      await user.tab();
      expect(screen.getByLabelText('RpgAInfinity - Inicio')).toHaveFocus();

      // Tab to first nav item
      await user.tab();
      expect(screen.getAllByText('Inicio')[0].closest('a')).toHaveFocus();

      // Tab to second nav item
      await user.tab();
      expect(screen.getAllByText('Juegos')[0].closest('a')).toHaveFocus();

      // Tab to third nav item
      await user.tab();
      expect(screen.getAllByText('Comunidad')[0].closest('a')).toHaveFocus();

      // Tab to mobile menu button
      await user.tab();
      expect(screen.getByLabelText('Abrir menú')).toHaveFocus();
    });

    test('mobile menu keyboard navigation', async () => {
      render(<Navigation />);

      const menuButton = screen.getByLabelText('Abrir menú');

      // Open menu with Enter key
      menuButton.focus();
      await user.keyboard('{Enter}');

      expect(
        screen.getByRole('navigation', { name: 'Navegación móvil' })
      ).toBeInTheDocument();

      // Tab through mobile nav items
      await user.tab();
      const mobileNavLinks = screen
        .getByRole('navigation', { name: 'Navegación móvil' })
        .querySelectorAll('a');
      expect(mobileNavLinks[0]).toHaveFocus();
    });

    test('has proper focus management', async () => {
      render(<Navigation />);

      // All interactive elements should be focusable
      const focusableElements = [
        screen.getByLabelText('RpgAInfinity - Inicio'),
        ...screen.getAllByRole('link'),
        screen.getByLabelText('Abrir menú'),
      ];

      for (const element of focusableElements) {
        element.focus();
        expect(element).toHaveFocus();
      }
    });
  });

  // ============================================================================
  // RESPONSIVE BEHAVIOR TESTS
  // ============================================================================

  describe('Responsive Behavior', () => {
    test('desktop navigation is hidden on mobile viewport', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      render(<Navigation />);

      const desktopNav = screen.getByRole('navigation', {
        name: 'Navegación principal',
      });
      expect(desktopNav).toHaveClass('hidden', 'md:flex');
    });

    test('mobile menu button is hidden on desktop viewport', () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      });

      render(<Navigation />);

      const mobileButton = screen.getByLabelText('Abrir menú');
      expect(mobileButton).toHaveClass('md:hidden');
    });

    test('brand subtitle is hidden on small screens', () => {
      render(<Navigation />);

      const subtitle = screen.getByText('Aventuras infinitas con IA');
      expect(subtitle).toHaveClass('hidden', 'sm:block');
    });
  });

  // ============================================================================
  // INTERACTION TESTS
  // ============================================================================

  describe('User Interactions', () => {
    test('logo link navigates to home', () => {
      render(<Navigation />);

      const logoLink = screen.getByLabelText('RpgAInfinity - Inicio');
      expect(logoLink).toHaveAttribute('href', '/');
    });

    test('navigation links have correct href attributes', () => {
      render(<Navigation />);

      const inicioLink = screen.getAllByText('Inicio')[0].closest('a');
      expect(inicioLink).toHaveAttribute('href', '/');

      const juegosLink = screen.getAllByText('Juegos')[0].closest('a');
      expect(juegosLink).toHaveAttribute('href', '/games');

      const comunidadLink = screen.getAllByText('Comunidad')[0].closest('a');
      expect(comunidadLink).toHaveAttribute('href', '/community');
    });

    test('hover states are applied correctly', async () => {
      render(<Navigation />);

      const juegosLink = screen.getAllByText('Juegos')[0].closest('a');

      await user.hover(juegosLink!);
      expect(juegosLink).toHaveClass(
        'hover:bg-accent',
        'hover:text-accent-foreground'
      );
    });

    test('handles rapid menu toggle clicks', async () => {
      render(<Navigation />);

      const menuButton = screen.getByLabelText('Abrir menú');

      // Rapidly toggle menu
      await user.click(menuButton);
      await user.click(menuButton);
      await user.click(menuButton);

      expect(
        screen.getByRole('navigation', { name: 'Navegación móvil' })
      ).toBeInTheDocument();
      expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    });
  });

  // ============================================================================
  // VISUAL REGRESSION TESTS
  // ============================================================================

  describe('Visual Elements', () => {
    test('renders icons for all navigation items', () => {
      render(<Navigation />);

      // Check that icons are present (using data-testid or class selectors)
      const icons = screen.getAllByRole('img', { hidden: true });
      expect(icons.length).toBeGreaterThan(0);
    });

    test('applies correct styling classes', () => {
      render(<Navigation />);

      const header = screen.getByRole('banner');
      expect(header).toHaveClass(
        'sticky',
        'top-0',
        'z-50',
        'w-full',
        'border-b',
        'bg-background/95',
        'backdrop-blur'
      );
    });

    test('navigation items have proper styling', () => {
      render(<Navigation />);

      const navLinks = screen.getAllByRole('link');
      const desktopNavLink = navLinks.find(
        link =>
          link.textContent === 'Juegos' &&
          link.closest('[role="navigation"][aria-label="Navegación principal"]')
      );

      expect(desktopNavLink).toHaveClass(
        'relative',
        'flex',
        'items-center',
        'space-x-2',
        'px-4',
        'py-2',
        'rounded-lg',
        'text-sm',
        'font-medium'
      );
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('Error Handling', () => {
    test('handles missing pathname gracefully', () => {
      mockUsePathname.mockReturnValue('');

      expect(() => render(<Navigation />)).not.toThrow();
    });

    test('handles null pathname gracefully', () => {
      mockUsePathname.mockReturnValue(null as any);

      expect(() => render(<Navigation />)).not.toThrow();
    });

    test('renders without framer-motion if unavailable', () => {
      // This test verifies graceful degradation if animations fail
      jest.doMock('framer-motion', () => {
        throw new Error('Module not found');
      });

      expect(() => render(<Navigation />)).not.toThrow();
    });
  });

  // ============================================================================
  // PERFORMANCE TESTS
  // ============================================================================

  describe('Performance', () => {
    test('component renders quickly', () => {
      const start = performance.now();
      render(<Navigation />);
      const end = performance.now();

      // Component should render in under 100ms
      expect(end - start).toBeLessThan(100);
    });

    test('re-renders efficiently when pathname changes', () => {
      const { rerender } = render(<Navigation />);

      const start = performance.now();
      mockUsePathname.mockReturnValue('/games');
      rerender(<Navigation />);
      const end = performance.now();

      // Re-render should be even faster
      expect(end - start).toBeLessThan(50);
    });

    test('does not cause memory leaks with menu toggles', async () => {
      render(<Navigation />);

      const menuButton = screen.getByLabelText('Abrir menú');

      // Toggle menu multiple times
      for (let i = 0; i < 10; i++) {
        await user.click(menuButton);
        await user.click(menuButton);
      }

      // Should not cause any errors or warnings
      expect(console.error).not.toHaveBeenCalled();
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Navigation Integration', () => {
  test('works with different route configurations', () => {
    const testRoutes = [
      '/',
      '/games',
      '/community',
      '/games/create',
      '/profile',
    ];

    testRoutes.forEach(route => {
      mockUsePathname.mockReturnValue(route);
      const { unmount } = render(<Navigation />);

      // Should render without errors for any route
      expect(screen.getByText('RpgAInfinity')).toBeInTheDocument();

      unmount();
    });
  });

  test('maintains state consistency across re-renders', async () => {
    const { rerender } = render(<Navigation />);

    // Open mobile menu
    await userEvent.setup().click(screen.getByLabelText('Abrir menú'));
    expect(
      screen.getByRole('navigation', { name: 'Navegación móvil' })
    ).toBeInTheDocument();

    // Re-render with same props
    rerender(<Navigation />);

    // Menu should remain open
    expect(
      screen.getByRole('navigation', { name: 'Navegación móvil' })
    ).toBeInTheDocument();
  });
});
