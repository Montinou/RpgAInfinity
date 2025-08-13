# 🤝 Guía de Contribución - RpgAInfinity

¡Gracias por tu interés en contribuir a RpgAInfinity! Este documento te guiará sobre cómo puedes ayudar a mejorar el proyecto.

## 📋 Tabla de Contenidos

- [Código de Conducta](#código-de-conducta)
- [Cómo Contribuir](#cómo-contribuir)
- [Reportar Bugs](#reportar-bugs)
- [Sugerir Features](#sugerir-features)
- [Pull Requests](#pull-requests)
- [Estándares de Código](#estándares-de-código)
- [Configuración del Entorno](#configuración-del-entorno)
- [Testing](#testing)
- [Documentación](#documentación)

## 📜 Código de Conducta

### Nuestros Principios

- **Respeto**: Trata a todos con respeto y consideración
- **Inclusividad**: Bienvenidos contribuidores de todos los backgrounds
- **Colaboración**: Trabajamos juntos hacia objetivos comunes
- **Transparencia**: Comunicación abierta y honesta
- **Excelencia**: Buscamos la calidad en todo lo que hacemos

### Comportamiento Inaceptable

- Lenguaje o imágenes ofensivas
- Acoso de cualquier tipo
- Trolling o comentarios insultantes
- Publicación de información privada sin consentimiento
- Conducta no profesional

## 🎯 Cómo Contribuir

### 1. Fork y Clone

```bash
# Fork el repo en GitHub, luego:
git clone https://github.com/TU_USUARIO/RpgAInfinity.git
cd RpgAInfinity
git remote add upstream https://github.com/Montinou/RpgAInfinity.git
```

### 2. Crear Branch

```bash
# Actualizar main
git checkout main
git pull upstream main

# Crear feature branch
git checkout -b feature/nombre-descriptivo
# O para bugs:
git checkout -b fix/descripcion-del-bug
```

### 3. Hacer Cambios

```bash
# Hacer cambios
npm run dev

# Verificar cambios
npm run lint
npm run type-check
npm test
```

### 4. Commit

```bash
# Commits semánticos
git add .
git commit -m "tipo: descripción breve"

# Tipos:
# feat: Nueva feature
# fix: Bug fix
# docs: Documentación
# style: Formato (no afecta lógica)
# refactor: Refactoring
# test: Tests
# chore: Mantenimiento
```

### 5. Push y PR

```bash
git push origin feature/nombre-descriptivo
```

Luego crear Pull Request en GitHub.

## 🐛 Reportar Bugs

### Antes de Reportar

1. **Buscar issues existentes**: Puede que ya esté reportado
2. **Verificar versión**: Asegúrate de usar la última versión
3. **Reproducir**: Confirma que puedes reproducir el bug

### Crear Issue

Usa nuestra [plantilla de bug report](.github/ISSUE_TEMPLATE/bug_report.md):

```markdown
## Descripción
Descripción clara y concisa del bug.

## Pasos para Reproducir
1. Ir a '...'
2. Hacer click en '...'
3. Ver error

## Comportamiento Esperado
Qué debería pasar.

## Comportamiento Actual
Qué está pasando.

## Screenshots
Si aplica.

## Entorno
- OS: [e.g. macOS 14.0]
- Browser: [e.g. Chrome 120]
- Node: [e.g. 18.17.0]
- Version: [e.g. 1.0.0]

## Contexto Adicional
Cualquier otra información relevante.
```

## 💡 Sugerir Features

### Proceso

1. **Verificar roadmap**: Revisa [ROADMAP.md](ROADMAP.md)
2. **Buscar discusiones**: Puede que ya se haya propuesto
3. **Crear propuesta**: Usa la plantilla de feature request

### Plantilla Feature Request

```markdown
## Problema
¿Qué problema resuelve esta feature?

## Solución Propuesta
Describe cómo funcionaría.

## Alternativas Consideradas
¿Qué otras soluciones consideraste?

## Mockups/Ejemplos
Si tienes diseños o ejemplos.

## Impacto
- Usuarios afectados:
- Prioridad:
- Complejidad estimada:
```

## 🔄 Pull Requests

### Checklist PR

- [ ] Código sigue los estándares del proyecto
- [ ] Tests agregados/actualizados
- [ ] Documentación actualizada
- [ ] Changelog actualizado
- [ ] Sin conflictos con main
- [ ] PR tiene descripción clara
- [ ] Screenshots si hay cambios UI

### Proceso de Review

1. **Automated checks**: Linting, tests, build
2. **Code review**: Al menos 1 aprobación requerida
3. **Testing**: QA en ambiente de staging
4. **Merge**: Squash and merge a main

### Plantilla PR

```markdown
## Descripción
Breve descripción de los cambios.

## Tipo de Cambio
- [ ] Bug fix
- [ ] Nueva feature
- [ ] Breaking change
- [ ] Documentación

## Cómo se ha Testeado
- [ ] Tests unitarios
- [ ] Tests integración
- [ ] Tests manuales

## Screenshots
(si aplica)

## Checklist
- [ ] Mi código sigue los estándares
- [ ] He hecho self-review
- [ ] He comentado código complejo
- [ ] He actualizado la documentación
- [ ] Mis cambios no generan warnings
- [ ] He agregado tests
- [ ] Tests pasan localmente
```

## 📐 Estándares de Código

### TypeScript/JavaScript

```typescript
// ✅ Bueno
interface GameConfig {
  players: Player[];
  settings: Settings;
}

function createGame(config: GameConfig): Game {
  // Validación clara
  if (!config.players.length) {
    throw new Error('Game requires at least one player');
  }
  
  // Lógica separada en funciones pequeñas
  const world = generateWorld(config.settings);
  const characters = createCharacters(config.players);
  
  return new Game(world, characters);
}

// ❌ Malo
function makeGame(c) {
  if(!c.p.length) throw 'bad';
  return new Game(genW(c.s), mkChars(c.p));
}
```

### React Components

```tsx
// ✅ Bueno
interface ButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  children: React.ReactNode;
}

export function Button({ 
  variant = 'primary',
  size = 'md',
  onClick,
  children 
}: ButtonProps) {
  return (
    <button
      className={cn(
        'btn',
        `btn-${variant}`,
        `btn-${size}`
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// ❌ Malo
export const Btn = (props) => (
  <button className={`btn ${props.v} ${props.s}`} onClick={props.oc}>
    {props.ch}
  </button>
);
```

### Estilos (Tailwind)

```tsx
// ✅ Bueno - Usar clsx/cn para clases condicionales
import { cn } from '@/lib/utils';

<div className={cn(
  'base-class',
  isActive && 'active-class',
  isDisabled && 'disabled-class'
)} />

// ❌ Malo - String concatenation
<div className={`base-class ${isActive ? 'active' : ''}`} />
```

### Naming Conventions

```typescript
// Archivos
ComponentName.tsx       // React components
useSomething.ts        // Custom hooks
utils.ts              // Utilities
types.ts             // Type definitions

// Variables
const MAX_PLAYERS = 8;           // Constants
let playerCount = 0;             // Variables
function calculateScore() {}    // Functions
class GameEngine {}             // Classes
interface PlayerData {}         // Interfaces
type GameState = 'playing';    // Types
enum Direction { UP, DOWN }    // Enums
```

## 🧪 Testing

### Estructura de Tests

```typescript
// game.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createGame } from './game';

describe('Game Engine', () => {
  let game: Game;
  
  beforeEach(() => {
    game = createGame(defaultConfig);
  });
  
  describe('initialization', () => {
    it('should create game with correct players', () => {
      expect(game.players).toHaveLength(4);
    });
    
    it('should generate unique world', () => {
      const game2 = createGame(defaultConfig);
      expect(game.world.id).not.toBe(game2.world.id);
    });
  });
  
  describe('gameplay', () => {
    it('should process player actions', async () => {
      const result = await game.processAction({
        playerId: '1',
        action: 'explore'
      });
      
      expect(result.success).toBe(true);
      expect(result.narrative).toBeDefined();
    });
  });
});
```

### Ejecutar Tests

```bash
# Todos los tests
npm test

# Con coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Tests específicos
npm test -- game.test.ts

# E2E tests
npm run test:e2e
```

## 📖 Documentación

### Comentarios de Código

```typescript
/**
 * Genera un mundo único basado en el tema proporcionado.
 * @param theme - El tema del mundo (fantasy, scifi, etc.)
 * @param options - Opciones adicionales de generación
 * @returns El mundo generado con todas sus propiedades
 * @throws {InvalidThemeError} Si el tema no es válido
 * @example
 * const world = await generateWorld('fantasy', {
 *   complexity: 'high',
 *   size: 'large'
 * });
 */
export async function generateWorld(
  theme: Theme,
  options?: WorldOptions
): Promise<World> {
  // Implementación...
}
```

### README Updates

Cuando agregues features, actualiza:
- Lista de features en README
- Instrucciones de instalación si cambian
- Ejemplos de uso
- Badges si aplica

## 🛠️ Configuración del Entorno

### Prerequisites

```bash
# Verificar versiones
node --version  # >= 18.0.0
npm --version   # >= 9.0.0
git --version   # >= 2.0.0
```

### Setup Local

```bash
# Instalar dependencias
npm install

# Copiar env
cp .env.example .env.local
# Editar .env.local con tus keys

# Iniciar desarrollo
npm run dev
```

### VS Code Settings

`.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "tailwindCSS.experimental.classRegex": [
    ["cn\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ]
}
```

### Extensiones Recomendadas

- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript Vue Plugin
- GitLens
- Error Lens

## 🎨 Diseño y UX

### Principios de Diseño

1. **Accesibilidad**: WCAG 2.1 AA compliance
2. **Responsive**: Mobile-first
3. **Performance**: < 3s load time
4. **Consistencia**: Design system
5. **Feedback**: Estados claros de UI

### Componentes UI

Usa componentes del sistema de diseño:

```tsx
import { Button, Card, Input } from '@/components/ui';

// No reinventes la rueda
<Button variant="primary" size="lg">
  Click Me
</Button>
```

## 🚀 Deployment

### Preview Deployments

Cada PR obtiene un preview deployment automático en Vercel.

### Production Deploy

Solo maintainers pueden deployar a producción:

```bash
# Desde main branch
git checkout main
git pull upstream main
npm run deploy:prod
```

## 📊 Prioridades

### Alta Prioridad
- 🔴 Bugs críticos
- 🔴 Vulnerabilidades de seguridad
- 🔴 Breaking changes

### Media Prioridad
- 🟡 Features del roadmap
- 🟡 Mejoras de performance
- 🟡 Refactoring importante

### Baja Prioridad
- 🟢 Nice-to-have features
- 🟢 Mejoras cosméticas
- 🟢 Documentación menor

## 🎯 Areas donde Necesitamos Ayuda

- **Testing**: Aumentar coverage a 90%+
- **Documentación**: Traducciones, tutoriales
- **Diseño**: Iconos, ilustraciones, animaciones
- **Performance**: Optimizaciones, caching
- **Accesibilidad**: Screen readers, keyboard nav
- **Features**: Ver [ROADMAP.md](ROADMAP.md)

## 💬 Comunicación

### Canales

- **GitHub Issues**: Bugs y features
- **GitHub Discussions**: Preguntas y ideas
- **Discord**: Chat en tiempo real (próximamente)
- **Twitter**: @RpgAInfinity (próximamente)

### Respuesta Esperada

- Issues: 48 horas
- PRs: 72 horas
- Security: 24 horas

## 🏆 Reconocimiento

Contribuidores destacados serán:
- Listados en README
- Mencionados en release notes
- Invitados como collaborators
- Recibir swag exclusivo (futuro)

## 📝 Licencia

Al contribuir, aceptas que tus contribuciones serán licenciadas bajo MIT.

## ❓ Preguntas

¿Dudas? Abre una [Discussion](https://github.com/Montinou/RpgAInfinity/discussions) o contacta a [@Montinou](https://github.com/Montinou).

---

**¡Gracias por hacer RpgAInfinity mejor! 🎮✨**