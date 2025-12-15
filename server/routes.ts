import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { searchUSDAFoods } from "./usda";
import { insertRecipeSchema, insertFoodSchema, insertIngredientAliasSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Recipe routes
  app.get("/api/recipes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recipes = await storage.getRecipes(userId);
      res.json(recipes);
    } catch (error) {
      console.error("Error fetching recipes:", error);
      res.status(500).json({ message: "Failed to fetch recipes" });
    }
  });

  app.get("/api/recipes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recipeId = parseInt(req.params.id);
      const recipe = await storage.getRecipe(recipeId, userId);
      
      if (!recipe) {
        return res.status(404).json({ message: "Recipe not found" });
      }
      
      res.json(recipe);
    } catch (error) {
      console.error("Error fetching recipe:", error);
      res.status(500).json({ message: "Failed to fetch recipe" });
    }
  });

  app.post("/api/recipes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { ingredients: ingredientsData, ...recipeData } = req.body;

      const validatedRecipe = insertRecipeSchema.parse({
        ...recipeData,
        userId,
      });

      const recipe = await storage.createRecipe(validatedRecipe, ingredientsData || []);
      res.status(201).json(recipe);
    } catch (error) {
      console.error("Error creating recipe:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid recipe data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create recipe" });
    }
  });

  app.put("/api/recipes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recipeId = parseInt(req.params.id);
      const { ingredients: ingredientsData, ...recipeData } = req.body;

      const recipe = await storage.updateRecipe(recipeId, userId, recipeData, ingredientsData || []);
      
      if (!recipe) {
        return res.status(404).json({ message: "Recipe not found" });
      }
      
      res.json(recipe);
    } catch (error) {
      console.error("Error updating recipe:", error);
      res.status(500).json({ message: "Failed to update recipe" });
    }
  });

  app.delete("/api/recipes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recipeId = parseInt(req.params.id);
      
      const deleted = await storage.deleteRecipe(recipeId, userId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Recipe not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting recipe:", error);
      res.status(500).json({ message: "Failed to delete recipe" });
    }
  });

  app.post("/api/recipes/:id/duplicate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recipeId = parseInt(req.params.id);
      
      const duplicated = await storage.duplicateRecipe(recipeId, userId);
      
      if (!duplicated) {
        return res.status(404).json({ message: "Recipe not found" });
      }
      
      res.status(201).json(duplicated);
    } catch (error) {
      console.error("Error duplicating recipe:", error);
      res.status(500).json({ message: "Failed to duplicate recipe" });
    }
  });

  // Food routes
  app.get("/api/foods", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const foods = await storage.getFoods(userId);
      res.json(foods);
    } catch (error) {
      console.error("Error fetching foods:", error);
      res.status(500).json({ message: "Failed to fetch foods" });
    }
  });

  app.post("/api/foods", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const validatedFood = insertFoodSchema.parse({
        ...req.body,
        userId,
      });

      const food = await storage.createFood(validatedFood);
      res.status(201).json(food);
    } catch (error) {
      console.error("Error creating food:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid food data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create food" });
    }
  });

  app.delete("/api/foods/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const foodId = parseInt(req.params.id);
      
      const deleted = await storage.deleteFood(foodId, userId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Food not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting food:", error);
      res.status(500).json({ message: "Failed to delete food" });
    }
  });

  // USDA API routes
  app.get("/api/usda/search", isAuthenticated, async (req: any, res) => {
    try {
      const query = req.query.q || req.query["0"];
      
      if (!query || typeof query !== "string" || query.length < 2) {
        return res.json([]);
      }

      const results = await searchUSDAFoods(query);
      res.json(results);
    } catch (error) {
      console.error("Error searching USDA:", error);
      res.status(500).json({ message: "Failed to search USDA database" });
    }
  });

  // Shopping list routes
  app.get("/api/shopping-lists", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const lists = await storage.getShoppingLists(userId);
      res.json(lists);
    } catch (error) {
      console.error("Error fetching shopping lists:", error);
      res.status(500).json({ message: "Failed to fetch shopping lists" });
    }
  });

  app.post("/api/shopping-lists", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const list = await storage.createShoppingList({
        ...req.body,
        userId,
      });
      
      res.status(201).json(list);
    } catch (error) {
      console.error("Error creating shopping list:", error);
      res.status(500).json({ message: "Failed to create shopping list" });
    }
  });

  app.delete("/api/shopping-lists/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const listId = parseInt(req.params.id);
      
      const deleted = await storage.deleteShoppingList(listId, userId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Shopping list not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting shopping list:", error);
      res.status(500).json({ message: "Failed to delete shopping list" });
    }
  });

  // Ingredient alias routes
  app.get("/api/ingredient-aliases", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const aliases = await storage.getIngredientAliases(userId);
      res.json(aliases);
    } catch (error) {
      console.error("Error fetching ingredient aliases:", error);
      res.status(500).json({ message: "Failed to fetch ingredient aliases" });
    }
  });

  app.post("/api/ingredient-aliases", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Normalize names: lowercase and trim
      const canonicalName = (req.body.canonicalName || "").toLowerCase().trim();
      const aliasName = (req.body.aliasName || "").toLowerCase().trim();
      
      if (!canonicalName || !aliasName) {
        return res.status(400).json({ message: "Both canonical name and alias name are required" });
      }
      
      if (canonicalName === aliasName) {
        return res.status(400).json({ message: "Alias cannot be the same as the canonical name" });
      }
      
      // Check for duplicates
      const existingAliases = await storage.getIngredientAliases(userId);
      const isDuplicate = existingAliases.some(
        a => a.aliasName.toLowerCase().trim() === aliasName
      );
      
      if (isDuplicate) {
        return res.status(400).json({ message: "This alias already exists" });
      }
      
      const validatedAlias = insertIngredientAliasSchema.parse({
        userId,
        canonicalName,
        aliasName,
      });

      const alias = await storage.createIngredientAlias(validatedAlias);
      res.status(201).json(alias);
    } catch (error) {
      console.error("Error creating ingredient alias:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid alias data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create ingredient alias" });
    }
  });

  app.delete("/api/ingredient-aliases/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const aliasId = parseInt(req.params.id);
      
      const deleted = await storage.deleteIngredientAlias(aliasId, userId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Ingredient alias not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting ingredient alias:", error);
      res.status(500).json({ message: "Failed to delete ingredient alias" });
    }
  });

  // Get canonical name for an ingredient
  app.get("/api/ingredient-aliases/canonical", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const name = req.query.name as string;
      
      if (!name) {
        return res.status(400).json({ message: "Name query parameter required" });
      }
      
      const canonicalName = await storage.getCanonicalName(userId, name);
      res.json({ canonicalName });
    } catch (error) {
      console.error("Error getting canonical name:", error);
      res.status(500).json({ message: "Failed to get canonical name" });
    }
  });

  return httpServer;
}
