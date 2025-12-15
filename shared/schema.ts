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

// Foods table - stores USDA food data locally
export const foods = pgTable("foods", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  fdcId: integer("fdc_id"), // USDA FoodData Central ID (null for custom foods)
  name: text("name").notNull(),
  description: text("description"),
  dataType: text("data_type"), // Foundation, SR Legacy, Branded, etc.
  caloriesPer100g: real("calories_per_100g").notNull(),
  proteinPer100g: real("protein_per_100g").notNull(),
  carbsPer100g: real("carbs_per_100g").notNull(),
  fatPer100g: real("fat_per_100g").notNull(),
  isCustom: boolean("is_custom").default(false),
  category: text("category"), // meat, dairy, produce, pantry, etc.
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const recipesRelations = relations(recipes, ({ one, many }) => ({
  user: one(users, {
    fields: [recipes.userId],
    references: [users.id],
  }),
  ingredients: many(ingredients),
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
  displayName: text("display_name").notNull(),
  amount: real("amount"), // Human readable amount
  unit: text("unit"), // Human readable unit (cups, tbsp, etc.)
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

// Extended types for frontend use
export type RecipeWithIngredients = Recipe & {
  ingredients: (Ingredient & { food: Food | null })[];
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
