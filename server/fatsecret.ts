import crypto from "crypto";

const FATSECRET_API_BASE = "https://platform.fatsecret.com/rest/server.api";
const CONSUMER_KEY = process.env.FATSECRET_CONSUMER_KEY || "";
const CONSUMER_SECRET = process.env.FATSECRET_CONSUMER_SECRET || "";

export interface FatSecretFood {
  food_id: string;
  food_name: string;
  food_type: string;
  food_description: string;
  food_url?: string;
  brand_name?: string;
}

export interface FatSecretServing {
  serving_id: string;
  serving_description: string;
  metric_serving_amount?: string;
  metric_serving_unit?: string;
  calories?: string;
  protein?: string;
  carbohydrate?: string;
  fat?: string;
  fiber?: string;
  sugar?: string;
  sodium?: string;
}

export interface FatSecretFoodDetail {
  food_id: string;
  food_name: string;
  food_type: string;
  food_url?: string;
  brand_name?: string;
  servings: {
    serving: FatSecretServing | FatSecretServing[];
  };
}

export interface FatSecretSearchResult {
  foodId: string;
  foodName: string;
  brandName: string | null;
  foodType: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  description: string;
}

function generateOAuthParams(): Record<string, string> {
  return {
    oauth_consumer_key: CONSUMER_KEY,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_version: "1.0",
  };
}

function generateSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string = ""
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join("&");

  const baseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join("&");

  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

  return crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
}

async function makeRequest(params: Record<string, string>): Promise<any> {
  const oauthParams = generateOAuthParams();
  const allParams: Record<string, string> = { ...oauthParams, ...params, format: "json" };

  allParams.oauth_signature = generateSignature("POST", FATSECRET_API_BASE, allParams, CONSUMER_SECRET);

  const queryString = Object.keys(allParams)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`)
    .join("&");

  const response = await fetch(`${FATSECRET_API_BASE}?${queryString}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("FatSecret API error:", response.status, errorText);
    throw new Error(`FatSecret API error: ${response.status}`);
  }

  return response.json();
}

function parseNutritionDescription(description: string): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingInfo: string;
} {
  const result = { calories: 0, protein: 0, carbs: 0, fat: 0, servingInfo: "" };

  const caloriesMatch = description.match(/Calories:\s*([\d.]+)/i);
  const fatMatch = description.match(/Fat:\s*([\d.]+)g/i);
  const carbsMatch = description.match(/Carbs:\s*([\d.]+)g/i);
  const proteinMatch = description.match(/Protein:\s*([\d.]+)g/i);
  const servingMatch = description.match(/^Per\s+([^-]+)\s*-/i);

  if (caloriesMatch) result.calories = parseFloat(caloriesMatch[1]);
  if (fatMatch) result.fat = parseFloat(fatMatch[1]);
  if (carbsMatch) result.carbs = parseFloat(carbsMatch[1]);
  if (proteinMatch) result.protein = parseFloat(proteinMatch[1]);
  if (servingMatch) result.servingInfo = servingMatch[1].trim();

  return result;
}

function convertToPer100g(
  value: number,
  servingAmount: number,
  servingUnit: string
): number {
  if (servingUnit === "g" || servingUnit === "gram" || servingUnit === "grams") {
    return (value / servingAmount) * 100;
  }
  if (servingUnit === "ml" || servingUnit === "milliliter" || servingUnit === "milliliters") {
    return (value / servingAmount) * 100;
  }
  return value;
}

export function isConfigured(): boolean {
  return Boolean(CONSUMER_KEY && CONSUMER_SECRET);
}

export async function searchFoods(query: string, maxResults: number = 20): Promise<FatSecretSearchResult[]> {
  if (!isConfigured()) {
    console.warn("FatSecret API not configured");
    return [];
  }

  try {
    const data = await makeRequest({
      method: "foods.search.v3",
      search_expression: query,
      max_results: String(maxResults),
      page_number: "0",
      include_food_images: "false",
      flag_default_serving: "true",
      region: "US",
      language: "en",
    });

    if (!data.foods_search || !data.foods_search.results) {
      return [];
    }

    const foods = data.foods_search.results.food;
    if (!foods) return [];

    const foodArray = Array.isArray(foods) ? foods : [foods];

    return foodArray.map((food: any) => {
      const servings = food.servings?.serving;
      let serving = Array.isArray(servings) ? servings[0] : servings;

      let caloriesPer100g = 0;
      let proteinPer100g = 0;
      let carbsPer100g = 0;
      let fatPer100g = 0;

      if (serving) {
        const metricAmount = parseFloat(serving.metric_serving_amount || "100");
        const metricUnit = serving.metric_serving_unit || "g";

        const calories = parseFloat(serving.calories || "0");
        const protein = parseFloat(serving.protein || "0");
        const carbs = parseFloat(serving.carbohydrate || "0");
        const fat = parseFloat(serving.fat || "0");

        caloriesPer100g = convertToPer100g(calories, metricAmount, metricUnit);
        proteinPer100g = convertToPer100g(protein, metricAmount, metricUnit);
        carbsPer100g = convertToPer100g(carbs, metricAmount, metricUnit);
        fatPer100g = convertToPer100g(fat, metricAmount, metricUnit);
      }

      return {
        foodId: food.food_id,
        foodName: food.food_name,
        brandName: food.brand_name || null,
        foodType: food.food_type,
        caloriesPer100g: Math.round(caloriesPer100g * 10) / 10,
        proteinPer100g: Math.round(proteinPer100g * 10) / 10,
        carbsPer100g: Math.round(carbsPer100g * 10) / 10,
        fatPer100g: Math.round(fatPer100g * 10) / 10,
        description: food.food_description || "",
      };
    });
  } catch (error) {
    console.error("Error searching FatSecret:", error);
    return [];
  }
}

export async function getFoodById(foodId: string): Promise<FatSecretSearchResult | null> {
  if (!isConfigured()) {
    console.warn("FatSecret API not configured");
    return null;
  }

  try {
    const data = await makeRequest({
      method: "food.get.v4",
      food_id: foodId,
      include_food_images: "false",
      region: "US",
      language: "en",
    });

    if (!data.food) {
      return null;
    }

    const food = data.food;
    const servings = food.servings?.serving;
    let serving = Array.isArray(servings) ? servings[0] : servings;

    let caloriesPer100g = 0;
    let proteinPer100g = 0;
    let carbsPer100g = 0;
    let fatPer100g = 0;

    if (serving) {
      const metricAmount = parseFloat(serving.metric_serving_amount || "100");
      const metricUnit = serving.metric_serving_unit || "g";

      const calories = parseFloat(serving.calories || "0");
      const protein = parseFloat(serving.protein || "0");
      const carbs = parseFloat(serving.carbohydrate || "0");
      const fat = parseFloat(serving.fat || "0");

      caloriesPer100g = convertToPer100g(calories, metricAmount, metricUnit);
      proteinPer100g = convertToPer100g(protein, metricAmount, metricUnit);
      carbsPer100g = convertToPer100g(carbs, metricAmount, metricUnit);
      fatPer100g = convertToPer100g(fat, metricAmount, metricUnit);
    }

    return {
      foodId: food.food_id,
      foodName: food.food_name,
      brandName: food.brand_name || null,
      foodType: food.food_type,
      caloriesPer100g: Math.round(caloriesPer100g * 10) / 10,
      proteinPer100g: Math.round(proteinPer100g * 10) / 10,
      carbsPer100g: Math.round(carbsPer100g * 10) / 10,
      fatPer100g: Math.round(fatPer100g * 10) / 10,
      description: food.food_description || "",
    };
  } catch (error) {
    console.error("Error getting food from FatSecret:", error);
    return null;
  }
}

export async function findFoodByBarcode(barcode: string): Promise<FatSecretSearchResult | null> {
  if (!isConfigured()) {
    console.warn("FatSecret API not configured");
    return null;
  }

  try {
    console.log(`FatSecret: Looking up barcode ${barcode}`);
    
    const data = await makeRequest({
      method: "food.find_id_for_barcode",
      barcode: barcode,
      region: "US",
    });

    console.log(`FatSecret barcode response:`, JSON.stringify(data).slice(0, 500));

    if (!data.food_id) {
      console.log(`FatSecret: No food_id found for barcode ${barcode}`);
      return null;
    }

    const foodId = data.food_id.value || data.food_id;
    console.log(`FatSecret: Found food_id ${foodId} for barcode ${barcode}`);
    
    return getFoodById(String(foodId));
  } catch (error) {
    console.error(`Error finding food by barcode ${barcode}:`, error);
    return null;
  }
}

export const fatSecretService = {
  isConfigured,
  searchFoods,
  getFoodById,
  findFoodByBarcode,
};
