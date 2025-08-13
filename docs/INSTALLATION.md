# 📋 Guía de Instalación - RpgAInfinity

## 🔧 Requisitos Previos

### Software Necesario
- **Node.js**: v18.0.0 o superior ([Descargar](https://nodejs.org/))
- **npm**: v9.0.0 o superior (incluido con Node.js)
- **Git**: v2.0.0 o superior ([Descargar](https://git-scm.com/))
- **Vercel CLI** (opcional): `npm i -g vercel`

### Cuentas Requeridas
- **GitHub**: Para clonar el repositorio
- **Anthropic**: Para obtener API key de Claude ([Obtener API Key](https://console.anthropic.com/))
- **Vercel**: Para hosting (gratuito) ([Crear cuenta](https://vercel.com/signup))

## 🚀 Instalación Local

### Paso 1: Clonar el Repositorio

```bash
# Clonar via HTTPS
git clone https://github.com/Montinou/RpgAInfinity.git

# O via SSH (si tienes configurado)
git clone git@github.com:Montinou/RpgAInfinity.git

# Entrar al directorio
cd RpgAInfinity
```

### Paso 2: Instalar Dependencias

```bash
# Instalar todas las dependencias
npm install

# O con yarn
yarn install

# O con pnpm
pnpm install
```

### Paso 3: Configurar Variables de Entorno

```bash
# Copiar archivo de ejemplo
cp .env.example .env.local
```

Editar `.env.local` con tus credenciales:

```env
# REQUERIDO: Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxx

# OPCIONAL: Vercel KV (para persistencia)
KV_URL=redis://default:xxx@xxx.kv.vercel-storage.com:xxxxx
KV_REST_API_URL=https://xxx.kv.vercel-storage.com
KV_REST_API_TOKEN=xxxxxxxxxxxxx

# OPCIONAL: Vercel Blob (para archivos)
BLOB_READ_WRITE_TOKEN=vercel_blob_xxx

# Configuración de la aplicación
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=RpgAInfinity
NODE_ENV=development
```

### Paso 4: Verificar Instalación

```bash
# Verificar versiones
node --version  # Debe ser >= 18.0.0
npm --version   # Debe ser >= 9.0.0

# Verificar dependencias
npm list

# Ejecutar tests
npm test
```

### Paso 5: Iniciar Servidor de Desarrollo

```bash
# Iniciar en modo desarrollo
npm run dev

# La aplicación estará disponible en:
# http://localhost:3000
```

## 🌐 Despliegue en Vercel

### Opción A: Deploy con Vercel CLI

```bash
# Instalar Vercel CLI globalmente
npm i -g vercel

# Login en Vercel
vercel login

# Deploy
vercel

# Seguir los prompts:
# - Set up and deploy: Y
# - Which scope: Tu cuenta
# - Link to existing project: N
# - Project name: rpgainfinity
# - Directory: ./
# - Override settings: N
```

### Opción B: Deploy desde GitHub

1. **Fork el repositorio** en tu GitHub
2. **Ir a Vercel Dashboard**: https://vercel.com/dashboard
3. **Click en "New Project"**
4. **Importar desde GitHub**
5. **Configurar variables de entorno**:
   ```
   ANTHROPIC_API_KEY = tu_api_key_aqui
   ```
6. **Click en "Deploy"**

### Opción C: Deploy con un Click

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Montinou/RpgAInfinity&env=ANTHROPIC_API_KEY&envDescription=API%20Key%20de%20Anthropic%20Claude&project-name=rpgainfinity&repository-name=rpgainfinity)

## 📦 Estructura del Proyecto

```
RpgAInfinity/
├── .env.local          # Variables de entorno (no commitear)
├── .env.example        # Ejemplo de variables
├── package.json        # Dependencias y scripts
├── next.config.js      # Configuración de Next.js
├── tsconfig.json       # Configuración TypeScript
├── tailwind.config.js  # Configuración Tailwind CSS
├── vercel.json         # Configuración de Vercel
└── src/
    ├── app/           # Next.js App Router
    ├── components/    # Componentes React
    ├── lib/          # Utilidades y lógica
    └── styles/       # Estilos globales
```

## 🔑 Configuración de API Keys

### Obtener API Key de Anthropic

1. Ir a https://console.anthropic.com/
2. Crear cuenta o iniciar sesión
3. Ir a "API Keys"
4. Click en "Create Key"
5. Copiar la key (comienza con `sk-ant-`)
6. Agregar a `.env.local`

### Configurar Vercel KV (Opcional)

1. En Vercel Dashboard, ir a "Storage"
2. Crear nueva base de datos KV
3. Copiar las credenciales
4. Agregar a variables de entorno

## 📝 Scripts Disponibles

```json
{
  "scripts": {
    "dev": "next dev",                    // Desarrollo local
    "build": "next build",                // Build producción
    "start": "next start",                // Iniciar producción
    "lint": "next lint",                  // Verificar código
    "test": "jest",                       // Ejecutar tests
    "test:watch": "jest --watch",        // Tests en modo watch
    "type-check": "tsc --noEmit",        // Verificar tipos
    "format": "prettier --write .",      // Formatear código
    "analyze": "ANALYZE=true next build" // Analizar bundle
  }
}
```

## 🛠️ Configuración Avanzada

### Configuración de Next.js

`next.config.js`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['vercel.app'],
  },
  experimental: {
    serverActions: true,
  },
  env: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  },
}

module.exports = nextConfig
```

### Configuración de Vercel

`vercel.json`:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["iad1"],
  "functions": {
    "src/app/api/ai/generate.ts": {
      "maxDuration": 30
    }
  }
}
```

### Configuración de TypeScript

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

## 🐛 Solución de Problemas

### Error: "Cannot find module"
```bash
# Limpiar cache y reinstalar
rm -rf node_modules package-lock.json
npm install
```

### Error: "ANTHROPIC_API_KEY is not defined"
```bash
# Verificar que .env.local existe y tiene la key
cat .env.local

# En Vercel, agregar en Settings > Environment Variables
```

### Error: "Port 3000 already in use"
```bash
# Cambiar puerto
PORT=3001 npm run dev

# O matar proceso en puerto 3000
lsof -ti:3000 | xargs kill
```

### Build falla en Vercel
```bash
# Verificar logs en Vercel Dashboard
# Común: falta variable de entorno
# Solución: agregar en Vercel Settings
```

## 🔄 Actualización

### Actualizar desde GitHub
```bash
# Obtener últimos cambios
git pull origin main

# Actualizar dependencias
npm install

# Reconstruir
npm run build
```

### Actualizar dependencias
```bash
# Ver dependencias desactualizadas
npm outdated

# Actualizar todas (cuidado)
npm update

# Actualizar específica
npm install package@latest
```

## 🧪 Testing

### Ejecutar tests
```bash
# Todos los tests
npm test

# Con coverage
npm run test:coverage

# Tests específicos
npm test -- GameEngine

# En modo watch
npm run test:watch
```

### Tests E2E con Playwright
```bash
# Instalar Playwright
npx playwright install

# Ejecutar tests E2E
npm run test:e2e
```

## 📊 Monitoreo

### Vercel Analytics
1. En Vercel Dashboard, ir a Analytics
2. Habilitar Web Analytics
3. Ver métricas en tiempo real

### Performance
```bash
# Analizar bundle size
npm run analyze

# Lighthouse CI
npm run lighthouse
```

## 🆘 Soporte

### Documentación
- [Next.js Docs](https://nextjs.org/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Anthropic Docs](https://docs.anthropic.com/)

### Comunidad
- [GitHub Issues](https://github.com/Montinou/RpgAInfinity/issues)
- [Discussions](https://github.com/Montinou/RpgAInfinity/discussions)

### Contacto
- GitHub: [@Montinou](https://github.com/Montinou)
- Email: Ver perfil de GitHub

---

*¿Problemas? Abre un [issue](https://github.com/Montinou/RpgAInfinity/issues/new)*