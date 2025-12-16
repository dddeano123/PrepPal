import {
  users,
  recipes,
  ingredients,
  foods,
  shoppingLists,
  ingredientAliases,
  pantryStaples,
  krogerTokens,
  recipeTools,
  tools,
  type User,
  type UpsertUser,
  type Recipe,
  type InsertRecipe,
  type Ingredient,
  type InsertIngredient,
  type Food,
  type InsertFood,
  type ShoppingList,
  type InsertShoppingList,
  type IngredientAlias,
  type InsertIngredientAlias,
  type PantryStaple,
  type InsertPantryStaple,
  type KrogerTokens,
  type InsertKrogerTokens,
  type RecipeTool,
  type InsertRecipeTool,
  type Tool,
  type InsertTool,
  type RecipeWithIngredients,
  type IngredientWithFood,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, inArray, desc, or, ilike } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Recipe operations
  getRecipes(userId: string): Promise<RecipeWithIngredients[]>;
  getRecipe(id: number, userId: string): Promise<RecipeWithIngredients | undefined>;
  createRecipe(recipe: InsertRecipe, ingredientsData: InsertIngredient[]): Promise<Recipe>;
  updateRecipe(id: number, userId: string, recipe: Partial<InsertRecipe>, ingredientsData: InsertIngredient[]): Promise<Recipe | undefined>;
  deleteRecipe(id: number, userId: string): Promise<boolean>;
  duplicateRecipe(id: number, userId: string): Promise<Recipe | undefined>;
  updateRecipeEatingStatus(id: number, userId: string, isCurrentlyEating: boolean): Promise<Recipe | undefined>;

  // Ingredient operations
  getIngredients(recipeId: number): Promise<IngredientWithFood[]>;

  // Food operations
  getFoods(userId: string): Promise<Food[]>;
  getFood(id: number, userId: string): Promise<Food | undefined>;
  getFoodByKrogerProductId(userId: string, krogerProductId: string): Promise<Food | undefined>;
  searchFoods(userId: string, query: string): Promise<Food[]>;
  createFood(food: InsertFood): Promise<Food>;
  updateFood(id: number, userId: string, food: Partial<InsertFood>): Promise<Food | undefined>;
  deleteFood(id: number, userId: string): Promise<boolean>;

  // Shopping list operations
  getShoppingLists(userId: string): Promise<ShoppingList[]>;
  createShoppingList(list: InsertShoppingList): Promise<ShoppingList>;
  deleteShoppingList(id: number, userId: string): Promise<boolean>;

  // Ingredient alias operations
  getIngredientAliases(userId: string): Promise<IngredientAlias[]>;
  createIngredientAlias(alias: InsertIngredientAlias): Promise<IngredientAlias>;
  deleteIngredientAlias(id: number, userId: string): Promise<boolean>;
  getCanonicalName(userId: string, ingredientName: string): Promise<string>;

  // Pantry staples operations
  getPantryStaples(userId: string): Promise<PantryStaple[]>;
  createPantryStaple(staple: InsertPantryStaple): Promise<PantryStaple>;
  deletePantryStaple(id: number, userId: string): Promise<boolean>;
  isPantryStaple(userId: string, ingredientName: string): Promise<boolean>;

  // Kroger tokens operations
  getKrogerTokens(userId: string): Promise<KrogerTokens | undefined>;
  upsertKrogerTokens(tokens: InsertKrogerTokens): Promise<KrogerTokens>;
  updateKrogerLocation(userId: string, locationId: string): Promise<void>;
  deleteKrogerTokens(userId: string): Promise<boolean>;

  // Recipe tools operations
  getRecipeTools(recipeId: number): Promise<RecipeTool[]>;
  createRecipeTool(tool: InsertRecipeTool): Promise<RecipeTool>;
  updateRecipeTools(recipeId: number, toolsData: InsertRecipeTool[]): Promise<void>;
  deleteRecipeTool(id: number): Promise<boolean>;

  // Universal tools operations (user's kitchen tool inventory)
  getTools(userId: string): Promise<Tool[]>;
  getTool(id: number, userId: string): Promise<Tool | undefined>;
  searchTools(userId: string, query: string): Promise<Tool[]>;
  createTool(tool: InsertTool): Promise<Tool>;
  updateTool(id: number, userId: string, tool: Partial<InsertTool>): Promise<Tool | undefined>;
  deleteTool(id: number, userId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Recipe operations
  async getRecipes(userId: string): Promise<RecipeWithIngredients[]> {
    const allRecipes = await db
      .select()
      .from(recipes)
      .where(eq(recipes.userId, userId))
      .orderBy(desc(recipes.updatedAt));

    const recipesWithIngredients: RecipeWithIngredients[] = [];

    for (const recipe of allRecipes) {
      const recipeIngredients = await this.getIngredients(recipe.id);
      const tools = await this.getRecipeTools(recipe.id);
      recipesWithIngredients.push({
        ...recipe,
        ingredients: recipeIngredients,
        tools,
      });
    }

    return recipesWithIngredients;
  }

  async getRecipe(id: number, userId: string): Promise<RecipeWithIngredients | undefined> {
    const [recipe] = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, id), eq(recipes.userId, userId)));

    if (!recipe) return undefined;

    const recipeIngredients = await this.getIngredients(recipe.id);
    const tools = await this.getRecipeTools(recipe.id);
    return {
      ...recipe,
      ingredients: recipeIngredients,
      tools,
    };
  }

  async createRecipe(recipeData: InsertRecipe, ingredientsData: InsertIngredient[]): Promise<Recipe> {
    const [recipe] = await db
      .insert(recipes)
      .values(recipeData)
      .returning();

    if (ingredientsData.length > 0) {
      await db.insert(ingredients).values(
        ingredientsData.map((ing, index) => ({
          ...ing,
          recipeId: recipe.id,
          sortOrder: index,
        }))
      );
    }

    return recipe;
  }

  async updateRecipe(
    id: number,
    userId: string,
    recipeData: Partial<InsertRecipe>,
    ingredientsData: InsertIngredient[]
  ): Promise<Recipe | undefined> {
    const existing = await this.getRecipe(id, userId);
    if (!existing) return undefined;

    const [updated] = await db
      .update(recipes)
      .set({
        ...recipeData,
        updatedAt: new Date(),
      })
      .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
      .returning();

    // Delete existing ingredients and insert new ones
    await db.delete(ingredients).where(eq(ingredients.recipeId, id));

    if (ingredientsData.length > 0) {
      await db.insert(ingredients).values(
        ingredientsData.map((ing, index) => ({
          ...ing,
          recipeId: id,
          sortOrder: index,
        }))
      );
    }

    return updated;
  }

  async deleteRecipe(id: number, userId: string): Promise<boolean> {
    const result = await db
      .delete(recipes)
      .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async duplicateRecipe(id: number, userId: string): Promise<Recipe | undefined> {
    const original = await this.getRecipe(id, userId);
    if (!original) return undefined;

    const [duplicated] = await db
      .insert(recipes)
      .values({
        userId: original.userId,
        title: `${original.title} (Copy)`,
        description: original.description,
        servings: original.servings,
        tags: original.tags,
        instructions: original.instructions,
      })
      .returning();

    if (original.ingredients.length > 0) {
      await db.insert(ingredients).values(
        original.ingredients.map((ing, index) => ({
          recipeId: duplicated.id,
          foodId: ing.foodId,
          krogerProductId: ing.krogerProductId,
          krogerProductName: ing.krogerProductName,
          krogerProductImage: ing.krogerProductImage,
          displayName: ing.displayName,
          amount: ing.amount,
          unit: ing.unit,
          grams: ing.grams,
          sortOrder: index,
          category: ing.category,
          isPantryStaple: ing.isPantryStaple,
        }))
      );
    }

    // Copy tools as well
    if (original.tools && original.tools.length > 0) {
      await db.insert(recipeTools).values(
        original.tools.map((tool, index) => ({
          recipeId: duplicated.id,
          name: tool.name,
          notes: tool.notes,
          sortOrder: index,
        }))
      );
    }

    return duplicated;
  }

  async updateRecipeEatingStatus(id: number, userId: string, isCurrentlyEating: boolean): Promise<Recipe | undefined> {
    const [updated] = await db
      .update(recipes)
      .set({ isCurrentlyEating })
      .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
      .returning();
    return updated;
  }

  // Ingredient operations
  async getIngredients(recipeId: number): Promise<IngredientWithFood[]> {
    const recipeIngredients = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.recipeId, recipeId))
      .orderBy(ingredients.sortOrder);

    const ingredientsWithFood: IngredientWithFood[] = [];

    for (const ingredient of recipeIngredients) {
      let food: Food | null = null;
      if (ingredient.foodId) {
        const [foundFood] = await db
          .select()
          .from(foods)
          .where(eq(foods.id, ingredient.foodId));
        food = foundFood || null;
      }
      ingredientsWithFood.push({
        ...ingredient,
        food,
      });
    }

    return ingredientsWithFood;
  }

  // Food operations
  async getFoods(userId: string): Promise<Food[]> {
    return await db
      .select()
      .from(foods)
      .where(eq(foods.userId, userId))
      .orderBy(foods.name);
  }

  async getFood(id: number, userId: string): Promise<Food | undefined> {
    const [food] = await db
      .select()
      .from(foods)
      .where(and(eq(foods.id, id), eq(foods.userId, userId)));
    return food;
  }

  async createFood(foodData: InsertFood): Promise<Food> {
    const [food] = await db
      .insert(foods)
      .values(foodData)
      .returning();
    return food;
  }

  async getFoodByKrogerProductId(userId: string, krogerProductId: string): Promise<Food | undefined> {
    const [food] = await db
      .select()
      .from(foods)
      .where(and(eq(foods.userId, userId), eq(foods.krogerProductId, krogerProductId)));
    return food;
  }

  async searchFoods(userId: string, query: string): Promise<Food[]> {
    return await db
      .select()
      .from(foods)
      .where(and(eq(foods.userId, userId), ilike(foods.name, `%${query}%`)))
      .orderBy(foods.name)
      .limit(20);
  }

  async updateFood(id: number, userId: string, foodData: Partial<InsertFood>): Promise<Food | undefined> {
    const [updated] = await db
      .update(foods)
      .set(foodData)
      .where(and(eq(foods.id, id), eq(foods.userId, userId)))
      .returning();
    return updated;
  }

  async deleteFood(id: number, userId: string): Promise<boolean> {
    const result = await db
      .delete(foods)
      .where(and(eq(foods.id, id), eq(foods.userId, userId)))
      .returning();
    return result.length > 0;
  }

  // Shopping list operations
  async getShoppingLists(userId: string): Promise<ShoppingList[]> {
    return await db
      .select()
      .from(shoppingLists)
      .where(eq(shoppingLists.userId, userId))
      .orderBy(desc(shoppingLists.createdAt));
  }

  async createShoppingList(listData: InsertShoppingList): Promise<ShoppingList> {
    const [list] = await db
      .insert(shoppingLists)
      .values(listData)
      .returning();
    return list;
  }

  async deleteShoppingList(id: number, userId: string): Promise<boolean> {
    const result = await db
      .delete(shoppingLists)
      .where(and(eq(shoppingLists.id, id), eq(shoppingLists.userId, userId)))
      .returning();
    return result.length > 0;
  }

  // Ingredient alias operations
  async getIngredientAliases(userId: string): Promise<IngredientAlias[]> {
    return await db
      .select()
      .from(ingredientAliases)
      .where(eq(ingredientAliases.userId, userId))
      .orderBy(ingredientAliases.canonicalName);
  }

  async createIngredientAlias(aliasData: InsertIngredientAlias): Promise<IngredientAlias> {
    const [alias] = await db
      .insert(ingredientAliases)
      .values(aliasData)
      .returning();
    return alias;
  }

  async deleteIngredientAlias(id: number, userId: string): Promise<boolean> {
    const result = await db
      .delete(ingredientAliases)
      .where(and(eq(ingredientAliases.id, id), eq(ingredientAliases.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async getCanonicalName(userId: string, ingredientName: string): Promise<string> {
    // Normalize the input name (lowercase, trim)
    const normalizedName = ingredientName.toLowerCase().trim();
    
    // Look for an alias match
    const [alias] = await db
      .select()
      .from(ingredientAliases)
      .where(
        and(
          eq(ingredientAliases.userId, userId),
          ilike(ingredientAliases.aliasName, normalizedName)
        )
      );
    
    // Return canonical name if found, otherwise return original
    return alias ? alias.canonicalName : ingredientName;
  }

  // Pantry staples operations
  async getPantryStaples(userId: string): Promise<PantryStaple[]> {
    return await db
      .select()
      .from(pantryStaples)
      .where(eq(pantryStaples.userId, userId))
      .orderBy(pantryStaples.name);
  }

  async createPantryStaple(stapleData: InsertPantryStaple): Promise<PantryStaple> {
    const [staple] = await db
      .insert(pantryStaples)
      .values(stapleData)
      .returning();
    return staple;
  }

  async deletePantryStaple(id: number, userId: string): Promise<boolean> {
    const result = await db
      .delete(pantryStaples)
      .where(and(eq(pantryStaples.id, id), eq(pantryStaples.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async isPantryStaple(userId: string, ingredientName: string): Promise<boolean> {
    const normalizedName = ingredientName.toLowerCase().trim();
    const [match] = await db
      .select()
      .from(pantryStaples)
      .where(
        and(
          eq(pantryStaples.userId, userId),
          ilike(pantryStaples.name, normalizedName)
        )
      );
    return !!match;
  }

  // Kroger tokens operations
  async getKrogerTokens(userId: string): Promise<KrogerTokens | undefined> {
    const [tokens] = await db
      .select()
      .from(krogerTokens)
      .where(eq(krogerTokens.userId, userId));
    return tokens;
  }

  async upsertKrogerTokens(tokensData: InsertKrogerTokens): Promise<KrogerTokens> {
    const existing = await this.getKrogerTokens(tokensData.userId);
    
    if (existing) {
      const [updated] = await db
        .update(krogerTokens)
        .set({
          accessToken: tokensData.accessToken,
          refreshToken: tokensData.refreshToken,
          expiresAt: tokensData.expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(krogerTokens.userId, tokensData.userId))
        .returning();
      return updated;
    }
    
    const [created] = await db
      .insert(krogerTokens)
      .values(tokensData)
      .returning();
    return created;
  }

  async updateKrogerLocation(userId: string, locationId: string): Promise<void> {
    await db
      .update(krogerTokens)
      .set({ locationId, updatedAt: new Date() })
      .where(eq(krogerTokens.userId, userId));
  }

  async deleteKrogerTokens(userId: string): Promise<boolean> {
    const result = await db
      .delete(krogerTokens)
      .where(eq(krogerTokens.userId, userId))
      .returning();
    return result.length > 0;
  }

  // Recipe tools operations
  async getRecipeTools(recipeId: number): Promise<RecipeTool[]> {
    return await db
      .select()
      .from(recipeTools)
      .where(eq(recipeTools.recipeId, recipeId))
      .orderBy(recipeTools.sortOrder);
  }

  async createRecipeTool(toolData: InsertRecipeTool): Promise<RecipeTool> {
    const [tool] = await db
      .insert(recipeTools)
      .values(toolData)
      .returning();
    return tool;
  }

  async updateRecipeTools(recipeId: number, toolsData: InsertRecipeTool[]): Promise<void> {
    // Delete existing tools and insert new ones
    await db.delete(recipeTools).where(eq(recipeTools.recipeId, recipeId));
    
    if (toolsData.length > 0) {
      await db.insert(recipeTools).values(
        toolsData.map((tool, index) => ({
          ...tool,
          recipeId,
          sortOrder: index,
        }))
      );
    }
  }

  async deleteRecipeTool(id: number): Promise<boolean> {
    const result = await db
      .delete(recipeTools)
      .where(eq(recipeTools.id, id))
      .returning();
    return result.length > 0;
  }

  // Universal tools operations (user's kitchen tool inventory)
  async getTools(userId: string): Promise<Tool[]> {
    return await db
      .select()
      .from(tools)
      .where(eq(tools.userId, userId))
      .orderBy(tools.name);
  }

  async getTool(id: number, userId: string): Promise<Tool | undefined> {
    const [tool] = await db
      .select()
      .from(tools)
      .where(and(eq(tools.id, id), eq(tools.userId, userId)));
    return tool;
  }

  async searchTools(userId: string, query: string): Promise<Tool[]> {
    return await db
      .select()
      .from(tools)
      .where(and(eq(tools.userId, userId), ilike(tools.name, `%${query}%`)))
      .orderBy(tools.name);
  }

  async createTool(toolData: InsertTool): Promise<Tool> {
    const [tool] = await db
      .insert(tools)
      .values(toolData)
      .returning();
    return tool;
  }

  async updateTool(id: number, userId: string, toolData: Partial<InsertTool>): Promise<Tool | undefined> {
    const [tool] = await db
      .update(tools)
      .set(toolData)
      .where(and(eq(tools.id, id), eq(tools.userId, userId)))
      .returning();
    return tool;
  }

  async deleteTool(id: number, userId: string): Promise<boolean> {
    const result = await db
      .delete(tools)
      .where(and(eq(tools.id, id), eq(tools.userId, userId)))
      .returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
