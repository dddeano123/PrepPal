# PrepPal - Recipe-Centric Nutrition & Meal Prep App

## Overview

PrepPal is a recipe-centric web application designed for meal preppers who want accurate, stable nutrition tracking. Unlike traditional daily-log nutrition apps (e.g., MyFitnessPal), this app focuses on:

- **Recipe-based nutrition tracking** - Define meals once, reuse forever
- **Accurate macro calculation** - Uses USDA authoritative nutrition data with gram-based inputs
- **Shopping list generation** - Automatically consolidates ingredients from selected recipes
- **Minimal re-entry** - Optimized for people who eat the same meals repeatedly

The core workflow is: create recipes → match ingredients to USDA foods → calculate per-serving macros → generate shopping lists.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React 18 with TypeScript, using Vite as the build tool

**Routing**: Wouter (lightweight React router)

**State Management**: TanStack Query (React Query) for server state caching and synchronization

**UI Components**: shadcn/ui component library built on Radix UI primitives with Tailwind CSS styling

**Design System**: Material Design principles combined with Linear's data-focused aesthetic. The app prioritizes data visibility with monospace fonts for numerical values and clear visual states for matched vs unmatched ingredients.

**Key Frontend Patterns**:
- Form handling with react-hook-form and Zod validation
- Centralized API request handling through `queryClient.ts`
- Custom hooks for authentication (`useAuth`), theming (`useTheme`), and toast notifications
- Component composition with Layout wrapper and PageHeader for consistent page structure

### Backend Architecture

**Framework**: Express.js with TypeScript

**API Design**: RESTful JSON API with `/api` prefix for all endpoints

**Authentication**: Replit Auth via OpenID Connect with Passport.js, using express-session for session management

**Key Backend Patterns**:
- Storage abstraction layer (`storage.ts`) that wraps all database operations
- Centralized route registration in `routes.ts`
- Development mode uses Vite middleware for HMR; production serves static files

### Data Storage

**Database**: PostgreSQL with Drizzle ORM

**Schema Design**:
- `users` - User accounts (Replit Auth integration)
- `sessions` - Session storage for authentication
- `recipes` - User recipes with title, description, servings, tags
- `ingredients` - Recipe ingredients with grams, food linkage, category
- `foods` - Local cache of USDA food data plus custom user-defined foods
- `ingredientAliases` - Maps ingredient names to foods for auto-matching
- `pantryStaples` - Items to exclude from shopping lists
- `shoppingLists` - Persisted shopping list state

**Schema Validation**: Drizzle-zod for automatic Zod schema generation from database tables

### External Service Integrations

**USDA FoodData Central API**: Primary source for authoritative nutrition data. Searches Foundation and SR Legacy data types. Extracts calories, protein, carbs, and fat per 100g.

**Replit Auth**: OpenID Connect authentication provider for user login/signup.

**Kroger API**: Integration for adding shopping list items directly to user's Kroger cart.
- OAuth 2.0 flow for user authentication
- Product search by ingredient name
- Cart management (add items)
- Store location search by zip code
- Tokens stored in `kroger_tokens` table with automatic refresh

## External Dependencies

### Third-Party Services
- **USDA FoodData Central API** - Nutrition data source (requires `USDA_API_KEY` environment variable, defaults to `DEMO_KEY`)
- **Replit Auth** - Authentication via OpenID Connect (requires `ISSUER_URL`, `REPL_ID`, `SESSION_SECRET`)
- **Kroger API** - Shopping cart integration (requires `KROGER_CLIENT_ID`, `KROGER_CLIENT_SECRET`, `KROGER_REDIRECT_URI`)

### Database
- **PostgreSQL** - Primary data store (requires `DATABASE_URL` environment variable)
- **connect-pg-simple** - Session storage in PostgreSQL

### Key NPM Packages
- **drizzle-orm** / **drizzle-kit** - Database ORM and migrations
- **@tanstack/react-query** - Server state management
- **shadcn/ui components** - Built on Radix UI primitives
- **tailwindcss** - Utility-first CSS framework
- **zod** - Runtime type validation
- **wouter** - Client-side routing