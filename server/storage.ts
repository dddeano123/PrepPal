import {
  users,
  recipes,
  ingredients,
  foods,
  shoppingLists,
  ingredientAliases,
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

  // Ingredient operations
  getIngredients(recipeId: number): Promise<IngredientWithFood[]>;

  // Food operations
  getFoods(userId: string): Promise<Food[]>;
  getFood(id: number, userId: string): Promise<Food | undefined>;
  createFood(food: InsertFood): Promise<Food>;
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
      recipesWithIngredients.push({
        ...recipe,
        ingredients: recipeIngredients,
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
    return {
      ...recipe,
      ingredients: recipeIngredients,
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

    return duplicated;
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
}

export const storage = new DatabaseStorage();
