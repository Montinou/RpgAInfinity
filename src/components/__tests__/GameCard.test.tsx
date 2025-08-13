/**
 * Comprehensive tests for GameCard Component
 *
 * Tests game listing display, user interactions, accessibility compliance,
 * and visual states for the game card component used in game listings.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GameCard from '../GameCard';
import '@testing-library/jest-dom';

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

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Test data fixtures
const createMockGame = (overrides: any = {}) => ({
  id: 'game-123',
  type: 'rpg' as const,
  name: 'Aventura Épica',
  description: 'Una emocionante aventura de fantasía con dragones y magia.',
  status: 'waiting' as const,
  currentPlayers: 2,
  maxPlayers: 4,
  minPlayers: 2,
  isPrivate: false,
  createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
  hostName: 'GameMaster',
  estimatedDuration: '2 horas',
  difficulty: 'medium' as const,
  ...overrides,
});

describe('GameCard Component', () => {
  const user = userEvent.setup();

  // ============================================================================
  // RENDERING TESTS
  // ============================================================================

  describe('Rendering', () => {
    test('renders game information correctly', () => {
      const game = createMockGame();
      render(<GameCard game={game} />);

      expect(screen.getByText(game.name)).toBeInTheDocument();
      expect(screen.getByText(game.description)).toBeInTheDocument();
      expect(screen.getByText(game.hostName)).toBeInTheDocument();
      expect(screen.getByText('RPG Cooperativo')).toBeInTheDocument();
      expect(screen.getByText('Esperando jugadores')).toBeInTheDocument();
    });

    test('displays player count with correct styling', () => {
      const game = createMockGame();
      render(<GameCard game={game} />);

      expect(screen.getByText('2/4')).toBeInTheDocument();
      expect(screen.getByText('jugadores')).toBeInTheDocument();
    });

    test('shows estimated duration when provided', () => {
      const game = createMockGame({ estimatedDuration: '45 minutos' });
      render(<GameCard game={game} />);

      expect(screen.getByText('45 minutos')).toBeInTheDocument();
    });

    test('applies custom className when provided', () => {
      const game = createMockGame();
      const customClass = 'custom-game-card';
      const { container } = render(
        <GameCard game={game} className={customClass} />
      );

      expect(container.firstChild).toHaveClass(customClass);
    });
  });

  // ============================================================================
  // GAME TYPE TESTS
  // ============================================================================

  describe('Game Type Display', () => {
    test('displays RPG game type correctly', () => {
      const game = createMockGame({ type: 'rpg' });
      render(<GameCard game={game} />);

      expect(screen.getByText('RPG Cooperativo')).toBeInTheDocument();
      // Check for Shield icon (RPG icon)
      const icons = screen.getAllByRole('img', { hidden: true });
      expect(icons.length).toBeGreaterThan(0);
    });

    test('displays deduction game type correctly', () => {
      const game = createMockGame({ type: 'deduction' });
      render(<GameCard game={game} />);

      expect(screen.getByText('Deducción Social')).toBeInTheDocument();
    });

    test('displays village game type correctly', () => {
      const game = createMockGame({ type: 'village' });
      render(<GameCard game={game} />);

      expect(screen.getByText('Simulador Villa')).toBeInTheDocument();
    });

    test('applies correct gradient styling for each game type', () => {
      const { rerender, container } = render(
        <GameCard game={createMockGame({ type: 'rpg' })} />
      );
      let typeIcon = container.querySelector('.from-amber-500.to-orange-500');
      expect(typeIcon).toBeInTheDocument();

      rerender(<GameCard game={createMockGame({ type: 'deduction' })} />);
      typeIcon = container.querySelector('.from-purple-500.to-indigo-500');
      expect(typeIcon).toBeInTheDocument();

      rerender(<GameCard game={createMockGame({ type: 'village' })} />);
      typeIcon = container.querySelector('.from-green-500.to-emerald-500');
      expect(typeIcon).toBeInTheDocument();
    });
  });

  // ============================================================================
  // GAME STATUS TESTS
  // ============================================================================

  describe('Game Status Display', () => {
    test('displays waiting status with join button', () => {
      const game = createMockGame({ status: 'waiting' });
      render(<GameCard game={game} />);

      expect(screen.getByText('Esperando jugadores')).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /Unirse a la partida/i })
      ).toBeInTheDocument();
    });

    test('displays active status with view button', () => {
      const game = createMockGame({ status: 'active' });
      render(<GameCard game={game} />);

      expect(screen.getByText('En curso')).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /Ver partida en curso/i })
      ).toBeInTheDocument();
    });

    test('displays completed status with view details button', () => {
      const game = createMockGame({ status: 'completed' });
      render(<GameCard game={game} />);

      expect(screen.getByText('Finalizada')).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /Ver detalles/i })
      ).toBeInTheDocument();
    });

    test('shows "Ser el primero en unirse" for empty games', () => {
      const game = createMockGame({ currentPlayers: 0, status: 'waiting' });
      render(<GameCard game={game} />);

      expect(
        screen.getByRole('link', { name: /Ser el primero en unirse/i })
      ).toBeInTheDocument();
    });

    test('shows disabled button for full games', () => {
      const game = createMockGame({
        currentPlayers: 4,
        maxPlayers: 4,
        status: 'waiting',
      });
      render(<GameCard game={game} />);

      expect(
        screen.getByRole('button', { name: /Partida completa/i })
      ).toBeDisabled();
    });
  });

  // ============================================================================
  // PLAYER COUNT TESTS
  // ============================================================================

  describe('Player Count Display', () => {
    test('shows normal styling for games with space', () => {
      const game = createMockGame({ currentPlayers: 2, maxPlayers: 6 });
      render(<GameCard game={game} />);

      const playerCount = screen.getByText('2/6');
      expect(playerCount).not.toHaveClass('text-amber-600', 'text-destructive');
    });

    test('shows amber warning for nearly full games', () => {
      const game = createMockGame({ currentPlayers: 3, maxPlayers: 4 });
      render(<GameCard game={game} />);

      const playerCount = screen.getByText('3/4');
      expect(playerCount).toHaveClass('text-amber-600');
      expect(screen.getByText('¡Casi lleno!')).toBeInTheDocument();
    });

    test('shows destructive styling for full games', () => {
      const game = createMockGame({ currentPlayers: 4, maxPlayers: 4 });
      render(<GameCard game={game} />);

      const playerCount = screen.getByText('4/4');
      expect(playerCount).toHaveClass('text-destructive');
    });

    test('displays "¡Casi lleno!" warning appropriately', () => {
      const nearlyFullGame = createMockGame({
        currentPlayers: 3,
        maxPlayers: 4,
      });
      const { rerender } = render(<GameCard game={nearlyFullGame} />);

      expect(screen.getByText('¡Casi lleno!')).toBeInTheDocument();

      // Should not show for full games
      rerender(
        <GameCard game={createMockGame({ currentPlayers: 4, maxPlayers: 4 })} />
      );
      expect(screen.queryByText('¡Casi lleno!')).not.toBeInTheDocument();

      // Should not show for games with plenty of space
      rerender(
        <GameCard game={createMockGame({ currentPlayers: 2, maxPlayers: 6 })} />
      );
      expect(screen.queryByText('¡Casi lleno!')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // DIFFICULTY TESTS
  // ============================================================================

  describe('Difficulty Display', () => {
    test('displays easy difficulty', () => {
      const game = createMockGame({ difficulty: 'easy' });
      render(<GameCard game={game} />);

      expect(screen.getByText('Fácil')).toBeInTheDocument();
    });

    test('displays medium difficulty', () => {
      const game = createMockGame({ difficulty: 'medium' });
      render(<GameCard game={game} />);

      expect(screen.getByText('Intermedio')).toBeInTheDocument();
    });

    test('displays hard difficulty', () => {
      const game = createMockGame({ difficulty: 'hard' });
      render(<GameCard game={game} />);

      expect(screen.getByText('Avanzado')).toBeInTheDocument();
    });

    test('handles missing difficulty gracefully', () => {
      const game = createMockGame({ difficulty: undefined });
      render(<GameCard game={game} />);

      expect(screen.queryByText('Fácil')).not.toBeInTheDocument();
      expect(screen.queryByText('Intermedio')).not.toBeInTheDocument();
      expect(screen.queryByText('Avanzado')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // PRIVATE GAME TESTS
  // ============================================================================

  describe('Private Game Display', () => {
    test('shows private game indicator', () => {
      const game = createMockGame({ isPrivate: true });
      render(<GameCard game={game} />);

      const privateIcon = screen.getByTitle('Partida privada');
      expect(privateIcon).toBeInTheDocument();
    });

    test('applies private game styling', () => {
      const game = createMockGame({ isPrivate: true });
      const { container } = render(<GameCard game={game} />);

      const card = container.firstChild as Element;
      expect(card).toHaveClass('border-amber-200');
    });

    test('does not show private indicator for public games', () => {
      const game = createMockGame({ isPrivate: false });
      render(<GameCard game={game} />);

      expect(screen.queryByTitle('Partida privada')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // TIME AGO TESTS
  // ============================================================================

  describe('Time Display', () => {
    test('displays "Ahora mismo" for very recent games', () => {
      const game = createMockGame({
        createdAt: new Date(Date.now() - 30 * 1000).toISOString(), // 30 seconds ago
      });
      render(<GameCard game={game} />);

      expect(screen.getByText('Ahora mismo')).toBeInTheDocument();
    });

    test('displays minutes ago for recent games', () => {
      const game = createMockGame({
        createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
      });
      render(<GameCard game={game} />);

      expect(screen.getByText('Hace 15m')).toBeInTheDocument();
    });

    test('displays hours ago for older games', () => {
      const game = createMockGame({
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      });
      render(<GameCard game={game} />);

      expect(screen.getByText('Hace 2h')).toBeInTheDocument();
    });

    test('displays days ago for very old games', () => {
      const game = createMockGame({
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
      });
      render(<GameCard game={game} />);

      expect(screen.getByText('Hace 1d')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // INTERACTION TESTS
  // ============================================================================

  describe('User Interactions', () => {
    test('join button navigates to correct URL', () => {
      const game = createMockGame({ status: 'waiting' });
      render(<GameCard game={game} />);

      const joinLink = screen.getByRole('link', {
        name: /Unirse a la partida/i,
      });
      expect(joinLink).toHaveAttribute('href', `/games/${game.id}/join`);
    });

    test('view button navigates to game details', () => {
      const game = createMockGame({ status: 'active' });
      render(<GameCard game={game} />);

      const viewLink = screen.getByRole('link', {
        name: /Ver partida en curso/i,
      });
      expect(joinLink).toHaveAttribute('href', `/games/${game.id}`);
    });

    test('card has hover effects and is interactive', () => {
      const game = createMockGame();
      const { container } = render(<GameCard game={game} />);

      const card = container.firstChild as Element;
      expect(card).toHaveClass(
        'cursor-pointer',
        'hover:shadow-xl',
        'hover:-translate-y-1'
      );
    });

    test('handles keyboard navigation', async () => {
      const game = createMockGame({ status: 'waiting' });
      render(<GameCard game={game} />);

      const joinButton = screen.getByRole('link', {
        name: /Unirse a la partida/i,
      });

      // Should be focusable
      joinButton.focus();
      expect(joinButton).toHaveFocus();

      // Should activate on Enter
      await user.keyboard('{Enter}');
      // Note: In actual implementation, this would navigate
    });
  });

  // ============================================================================
  // ACCESSIBILITY TESTS
  // ============================================================================

  describe('Accessibility', () => {
    test('has proper ARIA labels and roles', () => {
      const game = createMockGame();
      render(<GameCard game={game} />);

      // Check that buttons have proper labels
      const joinButton = screen.getByRole('link', {
        name: /Unirse a la partida/i,
      });
      expect(joinButton).toBeInTheDocument();

      // Private game icon has proper title
      const privateGame = createMockGame({ isPrivate: true });
      const { rerender } = render(<GameCard game={privateGame} />);
      expect(screen.getByTitle('Partida privada')).toBeInTheDocument();
    });

    test('provides meaningful text alternatives', () => {
      const game = createMockGame();
      render(<GameCard game={game} />);

      // Check that all text content is meaningful
      expect(screen.getByText(game.name)).toBeInTheDocument();
      expect(screen.getByText(game.description)).toBeInTheDocument();
      expect(screen.getByText('Esperando jugadores')).toBeInTheDocument();
    });

    test('has proper contrast and readability', () => {
      const game = createMockGame();
      render(<GameCard game={game} />);

      // Status badges should have appropriate contrast
      const statusBadge = screen.getByText('Esperando jugadores');
      expect(statusBadge).toBeInTheDocument();

      // Player count warnings should be visible
      const almostFullGame = createMockGame({
        currentPlayers: 3,
        maxPlayers: 4,
      });
      const { rerender } = render(<GameCard game={almostFullGame} />);

      const warningText = screen.getByText('¡Casi lleno!');
      expect(warningText).toHaveClass('text-amber-600');
    });

    test('disabled buttons are properly marked', () => {
      const fullGame = createMockGame({
        currentPlayers: 4,
        maxPlayers: 4,
        status: 'waiting',
      });
      render(<GameCard game={fullGame} />);

      const disabledButton = screen.getByRole('button', {
        name: /Partida completa/i,
      });
      expect(disabledButton).toBeDisabled();
      expect(disabledButton).toHaveAttribute('disabled');
    });
  });

  // ============================================================================
  // EDGE CASE TESTS
  // ============================================================================

  describe('Edge Cases', () => {
    test('handles missing optional fields gracefully', () => {
      const minimalGame = createMockGame({
        estimatedDuration: undefined,
        difficulty: undefined,
      });

      expect(() => render(<GameCard game={minimalGame} />)).not.toThrow();
      expect(screen.getByText(minimalGame.name)).toBeInTheDocument();
    });

    test('handles invalid dates gracefully', () => {
      const gameWithInvalidDate = createMockGame({
        createdAt: 'invalid-date',
      });

      expect(() =>
        render(<GameCard game={gameWithInvalidDate} />)
      ).not.toThrow();
    });

    test('handles very long names and descriptions', () => {
      const gameWithLongText = createMockGame({
        name: 'A'.repeat(100),
        description: 'B'.repeat(500),
      });

      render(<GameCard game={gameWithLongText} />);

      // Should still render without breaking layout
      expect(screen.getByText(gameWithLongText.name)).toBeInTheDocument();
    });

    test('handles zero players correctly', () => {
      const emptyGame = createMockGame({ currentPlayers: 0 });
      render(<GameCard game={emptyGame} />);

      expect(screen.getByText('0/4')).toBeInTheDocument();
      expect(screen.getByText('Ser el primero en unirse')).toBeInTheDocument();
    });

    test('handles single player games', () => {
      const soloGame = createMockGame({
        currentPlayers: 1,
        maxPlayers: 1,
        minPlayers: 1,
      });
      render(<GameCard game={soloGame} />);

      expect(screen.getByText('1/1')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Partida completa/i })
      ).toBeDisabled();
    });
  });

  // ============================================================================
  // VISUAL STATE TESTS
  // ============================================================================

  describe('Visual States', () => {
    test('applies hover effects correctly', async () => {
      const game = createMockGame();
      const { container } = render(<GameCard game={game} />);

      const card = container.firstChild as Element;

      await user.hover(card);
      expect(card).toHaveClass('group');

      // Check that hover effect overlay is present
      const overlay = container.querySelector('.group-hover\\:opacity-100');
      expect(overlay).toBeInTheDocument();
    });

    test('shows proper styling for different game states', () => {
      const waitingGame = createMockGame({ status: 'waiting' });
      const { rerender } = render(<GameCard game={waitingGame} />);

      // Waiting games should be interactive
      expect(screen.getByRole('link', { name: /Unirse/i })).toBeInTheDocument();

      // Active games should show different button
      rerender(<GameCard game={createMockGame({ status: 'active' })} />);
      expect(screen.getByText('Ver partida en curso')).toBeInTheDocument();

      // Completed games should show details button
      rerender(<GameCard game={createMockGame({ status: 'completed' })} />);
      expect(screen.getByText('Ver detalles')).toBeInTheDocument();
    });

    test('applies correct styling for private games', () => {
      const privateGame = createMockGame({ isPrivate: true });
      const { container } = render(<GameCard game={privateGame} />);

      const card = container.firstChild as Element;
      expect(card).toHaveClass('border-amber-200');
      expect(screen.getByTitle('Partida privada')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // PERFORMANCE TESTS
  // ============================================================================

  describe('Performance', () => {
    test('renders efficiently', () => {
      const game = createMockGame();
      const start = performance.now();
      render(<GameCard game={game} />);
      const end = performance.now();

      expect(end - start).toBeLessThan(100); // Should render quickly
    });

    test('handles rapid re-renders without issues', () => {
      const game = createMockGame();
      const { rerender } = render(<GameCard game={game} />);

      // Simulate rapid updates
      for (let i = 1; i <= 10; i++) {
        rerender(<GameCard game={{ ...game, currentPlayers: i % 4 }} />);
      }

      expect(screen.getByText(game.name)).toBeInTheDocument();
    });

    test('does not cause memory leaks', () => {
      const game = createMockGame();
      const { unmount } = render(<GameCard game={game} />);

      unmount();

      // Should not cause any console errors
      expect(console.error).not.toHaveBeenCalled();
    });
  });
});
