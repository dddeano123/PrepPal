import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { searchUSDAFoods } from "./usda";
import { krogerService } from "./kroger";
import { insertRecipeSchema, insertFoodSchema, insertIngredientAliasSchema, insertPantryStapleSchema } from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";

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

  // Pantry staples routes
  app.get("/api/pantry-staples", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const staples = await storage.getPantryStaples(userId);
      res.json(staples);
    } catch (error) {
      console.error("Error fetching pantry staples:", error);
      res.status(500).json({ message: "Failed to fetch pantry staples" });
    }
  });

  app.post("/api/pantry-staples", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Normalize name: lowercase and trim
      const name = (req.body.name || "").toLowerCase().trim();
      
      if (!name) {
        return res.status(400).json({ message: "Staple name is required" });
      }
      
      // Check for duplicates
      const existingStaples = await storage.getPantryStaples(userId);
      const isDuplicate = existingStaples.some(
        s => s.name.toLowerCase().trim() === name
      );
      
      if (isDuplicate) {
        return res.status(400).json({ message: "This pantry staple already exists" });
      }
      
      const validatedStaple = insertPantryStapleSchema.parse({
        userId,
        name,
        ...(req.body.category ? { category: req.body.category } : {}),
      });

      const staple = await storage.createPantryStaple(validatedStaple);
      res.status(201).json(staple);
    } catch (error) {
      console.error("Error creating pantry staple:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid staple data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create pantry staple" });
    }
  });

  app.delete("/api/pantry-staples/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stapleId = parseInt(req.params.id);
      
      const deleted = await storage.deletePantryStaple(stapleId, userId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Pantry staple not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting pantry staple:", error);
      res.status(500).json({ message: "Failed to delete pantry staple" });
    }
  });

  // Check if ingredient is a pantry staple
  app.get("/api/pantry-staples/check", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const name = req.query.name as string;
      
      if (!name) {
        return res.status(400).json({ message: "Name query parameter required" });
      }
      
      const isPantryStaple = await storage.isPantryStaple(userId, name);
      res.json({ isPantryStaple });
    } catch (error) {
      console.error("Error checking pantry staple:", error);
      res.status(500).json({ message: "Failed to check pantry staple" });
    }
  });

  // ==================== Kroger Integration Routes ====================

  // Check if Kroger API is configured
  app.get("/api/kroger/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const isConfigured = krogerService.isConfigured();
      const tokens = await storage.getKrogerTokens(userId);
      const isConnected = !!(tokens && tokens.expiresAt > new Date());
      
      res.json({
        isConfigured,
        isConnected,
        locationId: tokens?.locationId || null,
      });
    } catch (error) {
      console.error("Error checking Kroger status:", error);
      res.status(500).json({ message: "Failed to check Kroger status" });
    }
  });

  // Get Kroger authorization URL
  app.get("/api/kroger/auth-url", isAuthenticated, async (req: any, res) => {
    try {
      if (!krogerService.isConfigured()) {
        return res.status(400).json({ message: "Kroger API not configured" });
      }
      
      // Generate state for CSRF protection
      const state = crypto.randomBytes(16).toString("hex");
      
      // Store state in session for verification
      (req.session as any).krogerOAuthState = state;
      
      const authUrl = krogerService.getAuthorizationUrl(state);
      res.json({ authUrl });
    } catch (error) {
      console.error("Error generating Kroger auth URL:", error);
      res.status(500).json({ message: "Failed to generate auth URL" });
    }
  });

  // Kroger OAuth callback
  app.get("/api/kroger/callback", isAuthenticated, async (req: any, res) => {
    try {
      const { code, state } = req.query;
      const userId = req.user.claims.sub;
      
      // Verify state to prevent CSRF
      const savedState = (req.session as any).krogerOAuthState;
      if (!savedState || savedState !== state) {
        return res.redirect("/?error=invalid_state");
      }
      
      // Clear the saved state
      delete (req.session as any).krogerOAuthState;
      
      // Exchange code for tokens
      const tokens = await krogerService.exchangeCodeForTokens(code as string);
      
      // Calculate expiration time
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
      
      // Store tokens in database
      await storage.upsertKrogerTokens({
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
      });
      
      // Redirect to shopping list with success message
      res.redirect("/shopping-list?kroger=connected");
    } catch (error) {
      console.error("Error handling Kroger callback:", error);
      res.redirect("/shopping-list?error=kroger_auth_failed");
    }
  });

  // Disconnect Kroger account
  app.delete("/api/kroger/disconnect", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.deleteKrogerTokens(userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error disconnecting Kroger:", error);
      res.status(500).json({ message: "Failed to disconnect Kroger" });
    }
  });

  // Helper to get valid access token (refreshes if needed)
  async function getValidKrogerToken(userId: string): Promise<string | null> {
    const tokens = await storage.getKrogerTokens(userId);
    if (!tokens) return null;
    
    // Check if token is expired or about to expire (5 min buffer)
    const bufferMs = 5 * 60 * 1000;
    if (tokens.expiresAt.getTime() - Date.now() < bufferMs) {
      try {
        const newTokens = await krogerService.refreshAccessToken(tokens.refreshToken);
        const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
        
        await storage.upsertKrogerTokens({
          userId,
          accessToken: newTokens.access_token,
          refreshToken: newTokens.refresh_token,
          expiresAt,
        });
        
        return newTokens.access_token;
      } catch (error) {
        console.error("Failed to refresh Kroger token:", error);
        await storage.deleteKrogerTokens(userId);
        return null;
      }
    }
    
    return tokens.accessToken;
  }

  // Search Kroger locations by zip code
  app.get("/api/kroger/locations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const zipCode = req.query.zipCode as string;
      
      if (!zipCode) {
        return res.status(400).json({ message: "Zip code is required" });
      }
      
      const accessToken = await getValidKrogerToken(userId);
      if (!accessToken) {
        return res.status(401).json({ message: "Kroger not connected" });
      }
      
      const locations = await krogerService.searchLocations(accessToken, zipCode);
      res.json(locations);
    } catch (error) {
      console.error("Error searching Kroger locations:", error);
      res.status(500).json({ message: "Failed to search locations" });
    }
  });

  // Set preferred Kroger location
  app.put("/api/kroger/location", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { locationId } = req.body;
      
      if (!locationId) {
        return res.status(400).json({ message: "Location ID is required" });
      }
      
      await storage.updateKrogerLocation(userId, locationId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error setting Kroger location:", error);
      res.status(500).json({ message: "Failed to set location" });
    }
  });

  // Search Kroger products
  app.get("/api/kroger/products", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const term = req.query.term as string;
      
      if (!term) {
        return res.status(400).json({ message: "Search term is required" });
      }
      
      const accessToken = await getValidKrogerToken(userId);
      if (!accessToken) {
        return res.status(401).json({ message: "Kroger not connected" });
      }
      
      const tokens = await storage.getKrogerTokens(userId);
      const products = await krogerService.searchProducts(
        accessToken,
        term,
        tokens?.locationId || undefined
      );
      
      res.json(products);
    } catch (error) {
      console.error("Error searching Kroger products:", error);
      res.status(500).json({ message: "Failed to search products" });
    }
  });

  // Add items to Kroger cart
  app.post("/api/kroger/cart", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { items } = req.body;
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "Items array is required" });
      }
      
      const accessToken = await getValidKrogerToken(userId);
      if (!accessToken) {
        return res.status(401).json({ message: "Kroger not connected" });
      }
      
      await krogerService.addToCart(accessToken, items);
      res.json({ success: true, itemCount: items.length });
    } catch (error) {
      console.error("Error adding to Kroger cart:", error);
      res.status(500).json({ message: "Failed to add items to cart" });
    }
  });

  return httpServer;
}
