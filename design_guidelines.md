# Design Guidelines: Recipe-Centric Nutrition & Meal Prep App

## Design Approach

**Selected System**: Material Design principles combined with Linear's data-focused aesthetic

**Rationale**: This is a utility-focused, information-dense productivity application where accuracy and efficiency are paramount. The design must prioritize clarity, data visibility, and minimal friction over visual flair.

**Core Principles**:
- Data-first: Numbers and metrics take visual priority
- Instant feedback: Real-time macro calculations prominently displayed
- Clear states: Unmatched ingredients visually distinct from matched ones
- Minimal cognitive load: Single-purpose screens with focused actions
- Scannable layouts: Tables and grids for ingredient/recipe management

---

## Typography

**Font Stack**: 
- Primary: Inter (via Google Fonts CDN)
- Monospace: JetBrains Mono (for numerical data)

**Hierarchy**:
- Page Titles: text-3xl, font-semibold
- Section Headers: text-xl, font-semibold
- Card/Component Titles: text-lg, font-medium
- Body Text: text-base, font-normal
- Labels: text-sm, font-medium, uppercase tracking
- Numerical Data: text-lg or text-xl, font-mono, font-semibold
- Helper Text: text-sm, opacity-70

---

## Layout System

**Spacing Primitives**: Tailwind units of 2, 4, 6, 8, 12, 16, 24
- Component padding: p-4, p-6
- Card spacing: p-6, gap-6
- Section margins: mb-8, mb-12
- Form gaps: gap-4
- Tight groupings: gap-2

**Container Strategy**:
- Main layout: max-w-7xl mx-auto px-4 sm:px-6 lg:px-8
- Recipe detail view: max-w-5xl
- Forms: max-w-2xl
- Tables: full-width within container

---

## Component Library

### Navigation
- Top bar with app name, primary navigation links (Recipes, Shopping List)
- User menu in top-right corner
- Breadcrumbs for recipe detail pages
- Fixed position on scroll

### Recipe Cards
- Grid layout: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Card structure: rounded corners, subtle elevation
- Contents: Recipe title, serving count, total macros summary (4-column: Calories | Protein | Carbs | Fat)
- Macro display using monospace font in a compact grid
- Quick action buttons (Edit, Duplicate, Delete) revealed on hover/focus

### Recipe Detail View
- Two-column layout on desktop: Ingredients (left) | Instructions (right)
- Sticky macro summary card at top showing per-serving calculations
- Serving size adjuster with +/- buttons and direct input
- Real-time macro updates highlighted with subtle animation (fade-in only)

### Ingredient Table
- Table headers: Ingredient | Amount | Grams | Cal | Protein | Carbs | Fat | Actions
- Editable inline cells for amounts/grams
- Visual indicator for unmatched ingredients: Outlined row with warning icon, grayed-out macro cells showing "—"
- Search/match button for each unmatched ingredient
- Drag handles for reordering
- Footer row showing totals in bold

### Food Search Modal
- Full-screen overlay with centered search interface
- Search input with instant results
- Results table: Food Name | Source (USDA type) | Cal/100g | P/100g | C/100g | F/100g
- Select button for each result
- Recent/favorite foods section at top

### Forms
- Single-column layout with clear label-input pairing
- Labels above inputs: font-medium, text-sm
- Input fields: p-3, rounded, full-width
- Multi-step forms with progress indicator
- Required field indicators
- Inline validation messages
- Primary action button always bottom-right

### Shopping List
- Categorized sections (Produce, Meat, Dairy, Pantry, etc.)
- Checkboxes for each ingredient
- Quantity consolidation shown inline (e.g., "500g (from 2 recipes)")
- Pantry exclusions toggle at top
- Export/copy button in header
- Optional recipe source tags for each ingredient

### Macro Summary Card
- Four-column grid for the big four: Calories, Protein, Carbs, Fat
- Large monospace numerals
- Units below numbers in smaller text
- Per-serving context clearly stated
- Sticky positioning on recipe detail scroll

### Empty States
- Centered content with icon (from Heroicons)
- Descriptive text explaining what goes here
- Primary CTA button to create first recipe

### Buttons
- Primary: Solid fill, rounded, px-6 py-3
- Secondary: Outlined, same dimensions
- Icon buttons: p-2, rounded-full for compact actions
- Loading states: Spinner replaces text/icon

---

## Data Display Patterns

**Tables**: Striped rows for scannability, fixed header on scroll, right-aligned numbers

**Macro Grids**: 4-column responsive grid (stack on mobile), equal-width columns, centered text for numbers

**Status Badges**: Small rounded pills for tags, recipe status, etc.

---

## Icons

**Library**: Heroicons (via CDN)

**Usage**:
- Navigation icons (ChefHatIcon, ShoppingCartIcon, UserIcon)
- Action icons (PencilIcon, TrashIcon, PlusIcon)
- Status icons (CheckCircleIcon, ExclamationTriangleIcon)
- Size: w-5 h-5 for inline, w-6 h-6 for standalone

---

## Animations

**Minimal Use Only**:
- Macro value updates: 200ms fade transition
- Modal open/close: 150ms slide-up
- Loading states: Subtle spinner
- No scroll-triggered effects
- No decorative animations

---

## Accessibility

- All forms keyboard-navigable with visible focus states
- Focus ring: ring-2 ring-offset-2
- ARIA labels for icon-only buttons
- Skip-to-content link
- Semantic HTML throughout
- Error states announced to screen readers
- Sufficient contrast ratios (WCAG AA minimum)

---

## Key Screens Layout

**Recipes List**: Header with search + "New Recipe" button | Grid of recipe cards | Pagination if needed

**Recipe Detail**: Macro summary card (sticky) | Two-column: Ingredients table | Instructions (ordered list with step numbers)

**Shopping List**: Category filters/toggles | Grouped ingredient checklist | Footer with export options

**New/Edit Recipe**: Form with sections: Basic Info (title, servings, tags) | Ingredients (table with add row) | Instructions (ordered text areas with add step)

---

## Images

**No hero images required** - this is a utility application, not a marketing site.

**Potential image use**:
- Empty state illustrations (simple, functional graphics)
- Optional recipe thumbnails in cards (user-uploaded, not required)