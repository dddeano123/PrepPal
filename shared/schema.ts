import { sql, relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  real,
  boolean,
  serial,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Standardized units with gram conversions
export const UNIT_CONVERSIONS: Record<string, number> = {
  // Weight units (exact conversions)
  'g': 1,
  'kg': 1000,
  'oz': 28.3495,
  'lb': 453.592,
  // Volume units (approximate for water-like density, user can adjust)
  'ml': 1,
  'l': 1000,
  'tsp': 5,
  'tbsp': 15,
  'cup': 240,
  'fl oz': 30,
  'pint': 473,
  'quart': 946,
  // Count units (will need density/weight per item)
  'piece': 0, // Requires manual gram entry
  'slice': 0,
  'whole': 0,
};

export const UNIT_LABELS: Record<string, string> = {
  'g': 'grams (g)',
  'kg': 'kilograms (kg)',
  'oz': 'ounces (oz)',
  'lb': 'pounds (lb)',
  'ml': 'milliliters (ml)',
  'l': 'liters (l)',
  'tsp': 'teaspoon (tsp)',
  'tbsp': 'tablespoon (tbsp)',
  'cup': 'cups',
  'fl oz': 'fluid ounces (fl oz)',
  'pint': 'pints',
  'quart': 'quarts',
  'piece': 'piece(s)',
  'slice': 'slice(s)',
  'whole': 'whole',
};

export const UNIT_CATEGORIES = {
  weight: ['g', 'kg', 'oz', 'lb'],
  volume: ['ml', 'l', 'tsp', 'tbsp', 'cup', 'fl oz', 'pint', 'quart'],
  count: ['piece', 'slice', 'whole'],
};

// Helper function to convert amount + unit to grams
export function convertToGrams(amount: number, unit: string, gramsPerUnit?: number): number {
  const conversion = UNIT_CONVERSIONS[unit];
  if (conversion === 0 && gramsPerUnit) {
    // Count-based unit with custom density
    return amount * gramsPerUnit;
  }
  if (conversion > 0) {
    return amount * conversion;
  }
  // Fallback: assume the amount is already in grams
  return amount;
}

// Foods table - stores USDA food data locally OR custom user-defined nutrition
export const foods = pgTable("foods", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  fdcId: integer("fdc_id"), // USDA FoodData Central ID (null for custom foods)
  krogerProductId: text("kroger_product_id"), // Kroger product UPC for cart integration
  krogerProductName: text("kroger_product_name"), // Display name from Kroger
  krogerProductImage: text("kroger_product_image"), // Product image URL
  name: text("name").notNull(),
  description: text("description"),
  dataType: text("data_type"), // Foundation, SR Legacy, Branded, Custom
  caloriesPer100g: real("calories_per_100g").notNull(),
  proteinPer100g: real("protein_per_100g").notNull(),
  carbsPer100g: real("carbs_per_100g").notNull(),
  fatPer100g: real("fat_per_100g").notNull(),
  isCustom: boolean("is_custom").default(false),
  category: text("category"), // meat, dairy, produce, pantry, etc.
  defaultUnit: text("default_unit"), // Preferred unit for this food
  gramsPerUnit: real("grams_per_unit"), // For count-based units (e.g., 1 egg = 50g)
  createdAt: timestamp("created_at").defaultNow(),
});

export const foodsRelations = relations(foods, ({ one }) => ({
  user: one(users, {
    fields: [foods.userId],
    references: [users.id],
  }),
}));

export const insertFoodSchema = createInsertSchema(foods).omit({
  id: true,
  createdAt: true,
});

export type InsertFood = z.infer<typeof insertFoodSchema>;
export type Food = typeof foods.$inferSelect;

// Recipes table
export const recipes = pgTable("recipes", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  servings: integer("servings").notNull().default(1),
  tags: text("tags").array(),
  instructions: text("instructions").array(), // Ordered steps
  isCurrentlyEating: boolean("is_currently_eating").default(false), // Meal planning status
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const recipesRelations = relations(recipes, ({ one, many }) => ({
  user: one(users, {
    fields: [recipes.userId],
    references: [users.id],
  }),
  ingredients: many(ingredients),
  tools: many(recipeTools),
}));

export const insertRecipeSchema = createInsertSchema(recipes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type Recipe = typeof recipes.$inferSelect;

// Ingredients table - links recipes to foods with amounts
export const ingredients = pgTable("ingredients", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  foodId: integer("food_id").references(() => foods.id), // null if unmatched
  krogerProductId: text("kroger_product_id"), // Direct Kroger product link for cart
  krogerProductName: text("kroger_product_name"), // Display name from Kroger
  krogerProductImage: text("kroger_product_image"), // Product image URL
  displayName: text("display_name").notNull(),
  amount: real("amount"), // Human readable amount
  unit: text("unit"), // Standardized unit from UNIT_CONVERSIONS
  grams: real("grams").notNull(), // Authoritative for macro calculation
  sortOrder: integer("sort_order").default(0),
  category: text("category"), // For shopping list grouping
  isPantryStaple: boolean("is_pantry_staple").default(false),
});

export const ingredientsRelations = relations(ingredients, ({ one }) => ({
  recipe: one(recipes, {
    fields: [ingredients.recipeId],
    references: [recipes.id],
  }),
  food: one(foods, {
    fields: [ingredients.foodId],
    references: [foods.id],
  }),
}));

export const insertIngredientSchema = createInsertSchema(ingredients).omit({
  id: true,
});

export type InsertIngredient = z.infer<typeof insertIngredientSchema>;
export type Ingredient = typeof ingredients.$inferSelect;

// Shopping lists table
export const shoppingLists = pgTable("shopping_lists", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  recipeIds: integer("recipe_ids").array(), // Recipes included
  excludePantryStaples: boolean("exclude_pantry_staples").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const shoppingListsRelations = relations(shoppingLists, ({ one }) => ({
  user: one(users, {
    fields: [shoppingLists.userId],
    references: [users.id],
  }),
}));

export const insertShoppingListSchema = createInsertSchema(shoppingLists).omit({
  id: true,
  createdAt: true,
});

export type InsertShoppingList = z.infer<typeof insertShoppingListSchema>;
export type ShoppingList = typeof shoppingLists.$inferSelect;

// Ingredient aliases table - for smarter shopping list consolidation
export const ingredientAliases = pgTable("ingredient_aliases", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  canonicalName: text("canonical_name").notNull(), // The primary/standard name
  aliasName: text("alias_name").notNull(), // Variant name that maps to canonical
  createdAt: timestamp("created_at").defaultNow(),
});

export const ingredientAliasesRelations = relations(ingredientAliases, ({ one }) => ({
  user: one(users, {
    fields: [ingredientAliases.userId],
    references: [users.id],
  }),
}));

export const insertIngredientAliasSchema = createInsertSchema(ingredientAliases).omit({
  id: true,
  createdAt: true,
});

export type InsertIngredientAlias = z.infer<typeof insertIngredientAliasSchema>;
export type IngredientAlias = typeof ingredientAliases.$inferSelect;

// Pantry staples table - user-defined items they always have on hand
export const pantryStaples = pgTable("pantry_staples", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(), // Ingredient name pattern (case-insensitive match)
  category: text("category"), // Optional category for organization
  createdAt: timestamp("created_at").defaultNow(),
});

export const pantryStaplesRelations = relations(pantryStaples, ({ one }) => ({
  user: one(users, {
    fields: [pantryStaples.userId],
    references: [users.id],
  }),
}));

export const insertPantryStapleSchema = createInsertSchema(pantryStaples).omit({
  id: true,
  createdAt: true,
});

export type InsertPantryStaple = z.infer<typeof insertPantryStapleSchema>;
export type PantryStaple = typeof pantryStaples.$inferSelect;

// Kroger integration - stores user's Kroger OAuth tokens
export const krogerTokens = pgTable("kroger_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  locationId: varchar("location_id"), // User's preferred store
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const krogerTokensRelations = relations(krogerTokens, ({ one }) => ({
  user: one(users, {
    fields: [krogerTokens.userId],
    references: [users.id],
  }),
}));

export const insertKrogerTokensSchema = createInsertSchema(krogerTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertKrogerTokens = z.infer<typeof insertKrogerTokensSchema>;
export type KrogerTokens = typeof krogerTokens.$inferSelect;

// Recipe tools table - cooking equipment needed for recipes
export const recipeTools = pgTable("recipe_tools", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g., "Rice Cooker", "Slow Cooker", "Cast Iron Pan"
  notes: text("notes"), // Optional notes like "6 quart" or "medium heat"
  sortOrder: integer("sort_order").default(0),
});

export const recipeToolsRelations = relations(recipeTools, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeTools.recipeId],
    references: [recipes.id],
  }),
}));

export const insertRecipeToolSchema = createInsertSchema(recipeTools).omit({
  id: true,
});

export type InsertRecipeTool = z.infer<typeof insertRecipeToolSchema>;
export type RecipeTool = typeof recipeTools.$inferSelect;

// Extended types for frontend use
export type RecipeWithIngredients = Recipe & {
  ingredients: (Ingredient & { food: Food | null })[];
  tools?: RecipeTool[];
};

export type IngredientWithFood = Ingredient & {
  food: Food | null;
};

// Macro calculation types
export type MacroTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

// USDA API response types
export type USDAFoodSearchResult = {
  fdcId: number;
  description: string;
  dataType: string;
  foodNutrients: {
    nutrientId: number;
    nutrientName: string;
    value: number;
    unitName: string;
  }[];
};

// Shopping list item type for frontend
export type ShoppingListItem = {
  displayName: string;
  totalGrams: number;
  category: string;
  isPantryStaple: boolean;
  recipeNames: string[];
  amounts: { amount: number; unit: string; recipeName: string }[];
};
