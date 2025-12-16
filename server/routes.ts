import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { searchUSDAFoods } from "./usda";
import { krogerService } from "./kroger";
import { searchOpenFoodFacts, getProductByBarcode } from "./openFoodFacts";
import { generateCookingInstructions } from "./openai";
import {
  insertRecipeSchema,
  insertFoodSchema,
  insertIngredientAliasSchema,
  insertPantryStapleSchema,
  UNIT_CONVERSIONS,
  UNIT_LABELS,
  UNIT_CATEGORIES
} from "@shared/schema";
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
      const { ingredients: ingredientsData, tools: toolsData, ...recipeData } = req.body;

      const validatedRecipe = insertRecipeSchema.parse({
        ...recipeData,
        userId,
      });

      const recipe = await storage.createRecipe(validatedRecipe, ingredientsData || []);

      // Save tools if provided
      if (toolsData && toolsData.length > 0) {
        await storage.updateRecipeTools(recipe.id, toolsData);
      }

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
      const { ingredients: ingredientsData, tools: toolsData, ...recipeData } = req.body;

      const recipe = await storage.updateRecipe(recipeId, userId, recipeData, ingredientsData || []);

      if (!recipe) {
        return res.status(404).json({ message: "Recipe not found" });
      }

      // Update tools
      if (toolsData !== undefined) {
        await storage.updateRecipeTools(recipeId, toolsData || []);
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

  app.patch("/api/recipes/:id/eating-status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recipeId = parseInt(req.params.id);
      const { isCurrentlyEating } = req.body;

      if (typeof isCurrentlyEating !== "boolean") {
        return res.status(400).json({ message: "isCurrentlyEating must be a boolean" });
      }

      const updated = await storage.updateRecipeEatingStatus(recipeId, userId, isCurrentlyEating);

      if (!updated) {
        return res.status(404).json({ message: "Recipe not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating eating status:", error);
      res.status(500).json({ message: "Failed to update eating status" });
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
        offProductCode: req.body.offProductCode || null,
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

  app.get("/api/foods/search", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const query = req.query.q as string;

      if (!query || query.length < 2) {
        return res.json([]);
      }

      const foods = await storage.searchFoods(userId, query);
      res.json(foods);
    } catch (error) {
      console.error("Error searching foods:", error);
      res.status(500).json({ message: "Failed to search foods" });
    }
  });

  app.get("/api/foods/by-kroger-product/:productId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const productId = req.params.productId;

      const food = await storage.getFoodByKrogerProductId(userId, productId);
      res.json(food || null);
    } catch (error) {
      console.error("Error fetching food by Kroger product:", error);
      res.status(500).json({ message: "Failed to fetch food" });
    }
  });

  app.put("/api/foods/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const foodId = parseInt(req.params.id);

      const updated = await storage.updateFood(foodId, userId, req.body);

      if (!updated) {
        return res.status(404).json({ message: "Food not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating food:", error);
      res.status(500).json({ message: "Failed to update food" });
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

  // Open Food Facts API routes
  app.get("/api/openfoodfacts/search", isAuthenticated, async (req: any, res) => {
    try {
      const query = req.query.q as string;

      if (!query || query.length < 2) {
        return res.json([]);
      }

      const results = await searchOpenFoodFacts(query, 20);
      res.json(results);
    } catch (error) {
      console.error("Error searching Open Food Facts:", error);
      res.status(500).json({ message: "Failed to search Open Food Facts database" });
    }
  });

  app.get("/api/openfoodfacts/product/:barcode", isAuthenticated, async (req: any, res) => {
    try {
      const barcode = req.params.barcode;
      const product = await getProductByBarcode(barcode);

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      res.json(product);
    } catch (error) {
      console.error("Error fetching product from Open Food Facts:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  // Toggle recipe eating status
  app.patch("/api/recipes/:id/eating-status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recipeId = parseInt(req.params.id);
      const { isCurrentlyEating } = req.body;

      const updated = await storage.updateRecipeEatingStatus(recipeId, userId, isCurrentlyEating);

      if (!updated) {
        return res.status(404).json({ message: "Recipe not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating recipe eating status:", error);
      res.status(500).json({ message: "Failed to update eating status" });
    }
  });

  // Units metadata route
  app.get("/api/units", (req, res) => {
    res.json({
      conversions: UNIT_CONVERSIONS,
      labels: UNIT_LABELS,
      categories: UNIT_CATEGORIES,
    });
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

  // ==================== AI Instructions Route ====================

  app.post("/api/generate-instructions", isAuthenticated, async (req: any, res) => {
    try {
      const { title, description, ingredients, tools } = req.body;

      if (!title) {
        return res.status(400).json({ message: "Recipe title is required" });
      }

      if (!ingredients || ingredients.length === 0) {
        return res.status(400).json({ message: "At least one ingredient is required" });
      }

      const instructions = await generateCookingInstructions(
        title,
        description || null,
        ingredients,
        tools || []
      );
      res.json({ instructions });
    } catch (error) {
      console.error("Error generating instructions:", error);
      res.status(500).json({ message: "Failed to generate instructions" });
    }
  });

  // ==================== Kitchen Tools Routes ====================

  // Get all user's kitchen tools
  app.get("/api/tools", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userTools = await storage.getTools(userId);
      res.json(userTools);
    } catch (error) {
      console.error("Error fetching tools:", error);
      res.status(500).json({ message: "Failed to fetch tools" });
    }
  });

  // Search tools for autocomplete
  app.get("/api/tools/search", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const query = req.query.q as string || "";

      const matchingTools = await storage.searchTools(userId, query);
      res.json(matchingTools);
    } catch (error) {
      console.error("Error searching tools:", error);
      res.status(500).json({ message: "Failed to search tools" });
    }
  });

  // Create a new kitchen tool
  app.post("/api/tools", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const name = (req.body.name || "").trim();

      if (!name) {
        return res.status(400).json({ message: "Tool name is required" });
      }

      // Check for duplicates
      const existingTools = await storage.getTools(userId);
      const isDuplicate = existingTools.some(
        t => t.name.toLowerCase() === name.toLowerCase()
      );

      if (isDuplicate) {
        return res.status(400).json({ message: "This tool already exists" });
      }

      const tool = await storage.createTool({
        userId,
        name,
        notes: req.body.notes || null,
      });

      res.status(201).json(tool);
    } catch (error) {
      console.error("Error creating tool:", error);
      res.status(500).json({ message: "Failed to create tool" });
    }
  });

  // Update a kitchen tool
  app.patch("/api/tools/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const toolId = parseInt(req.params.id);

      const tool = await storage.updateTool(toolId, userId, req.body);

      if (!tool) {
        return res.status(404).json({ message: "Tool not found" });
      }

      res.json(tool);
    } catch (error) {
      console.error("Error updating tool:", error);
      res.status(500).json({ message: "Failed to update tool" });
    }
  });

  // Delete a kitchen tool
  app.delete("/api/tools/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const toolId = parseInt(req.params.id);

      const deleted = await storage.deleteTool(toolId, userId);

      if (!deleted) {
        return res.status(404).json({ message: "Tool not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting tool:", error);
      res.status(500).json({ message: "Failed to delete tool" });
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

      const userId = req.user.claims.sub;

      // Generate state for CSRF protection
      const state = crypto.randomBytes(16).toString("hex");

      // Store state in session for verification (namespaced by userId)
      if (!(req.session as any).krogerOAuthStates) {
        (req.session as any).krogerOAuthStates = {};
      }
      (req.session as any).krogerOAuthStates[userId] = state;

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
      const { code, state, error } = req.query;
      const userId = req.user.claims.sub;

      // Handle Kroger-side errors (user denied, etc.)
      if (error || !code || !state) {
        console.error("Kroger callback error:", error || "Missing code/state");
        return res.redirect("/shopping-list?error=kroger_auth_failed");
      }

      // Verify state to prevent CSRF (namespaced by userId)
      const krogerStates = (req.session as any).krogerOAuthStates || {};
      const savedState = krogerStates[userId];
      if (!savedState || savedState !== state) {
        console.error("State mismatch - expected:", savedState, "got:", state);
        return res.redirect("/shopping-list?error=invalid_state");
      }

      // Clear the saved state for this user
      delete krogerStates[userId];
      (req.session as any).krogerOAuthStates = krogerStates;

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

  // Helper to force refresh token (used when API returns 401)
  async function forceRefreshKrogerToken(userId: string): Promise<string | null> {
    const tokens = await storage.getKrogerTokens(userId);
    if (!tokens) return null;

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
      console.error("Failed to force refresh Kroger token:", error);
      await storage.deleteKrogerTokens(userId);
      return null;
    }
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

      let accessToken = await getValidKrogerToken(userId);
      if (!accessToken) {
        return res.status(401).json({ message: "Kroger not connected", reconnect: true });
      }

      const tokens = await storage.getKrogerTokens(userId);
      let result = await krogerService.searchProducts(
        accessToken,
        term,
        tokens?.locationId || undefined
      );

      // Retry once if we get a 401/403 (token may have been revoked)
      if (result.status === 401 || result.status === 403) {
        accessToken = await forceRefreshKrogerToken(userId);
        if (!accessToken) {
          return res.status(401).json({ message: "Kroger session expired. Please reconnect.", reconnect: true });
        }
        result = await krogerService.searchProducts(
          accessToken,
          term,
          tokens?.locationId || undefined
        );
        if (result.status === 401 || result.status === 403) {
          await storage.deleteKrogerTokens(userId);
          return res.status(401).json({ message: "Kroger session expired. Please reconnect.", reconnect: true });
        }
      }

      res.json(result.products);
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

      let accessToken = await getValidKrogerToken(userId);
      if (!accessToken) {
        return res.status(401).json({ message: "Kroger not connected", reconnect: true });
      }

      let result = await krogerService.addToCart(accessToken, items);

      // Retry once if we get a 401/403 (token may have been revoked)
      if (result.status === 401 || result.status === 403) {
        accessToken = await forceRefreshKrogerToken(userId);
        if (!accessToken) {
          return res.status(401).json({ message: "Kroger session expired. Please reconnect.", reconnect: true });
        }
        result = await krogerService.addToCart(accessToken, items);
        if (result.status === 401 || result.status === 403) {
          await storage.deleteKrogerTokens(userId);
          return res.status(401).json({ message: "Kroger session expired. Please reconnect.", reconnect: true });
        }
      }

      if (!result.success) {
        // Return structured error for client errors
        if (result.status >= 400 && result.status < 500) {
          return res.status(result.status).json({
            message: "Could not add items to cart. Some products may be unavailable.",
            error: result.error
          });
        }
        return res.status(500).json({ message: "Failed to add items to cart" });
      }

      res.json({ success: true, itemCount: items.length });
    } catch (error) {
      console.error("Error adding to Kroger cart:", error);
      res.status(500).json({ message: "Failed to add items to cart" });
    }
  });

  return httpServer;
}