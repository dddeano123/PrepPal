const FATSECRET_API_BASE = "https://platform.fatsecret.com/rest/server.api";
const FATSECRET_TOKEN_URL = "https://oauth.fatsecret.com/connect/token";
const CLIENT_ID = process.env.FATSECRET_CLIENT_ID || "";
const CLIENT_SECRET = process.env.FATSECRET_CLIENT_SECRET || "";

let cachedToken: { token: string; expiresAt: number } | null = null;

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

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

  const response = await fetch(FATSECRET_TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=basic",
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("FatSecret token error:", response.status, errorText);
    throw new Error(`FatSecret token error: ${response.status}`);
  }

  const data = await response.json();
  
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  console.log("FatSecret: Obtained new access token");
  return cachedToken.token;
}

async function makeRequest(params: Record<string, string>): Promise<any> {
  const token = await getAccessToken();

  const queryParams = new URLSearchParams({ ...params, format: "json" });

  const response = await fetch(`${FATSECRET_API_BASE}?${queryParams.toString()}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("FatSecret API error:", response.status, errorText);
    throw new Error(`FatSecret API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    console.error("FatSecret API returned error:", data.error);
    throw new Error(`FatSecret API error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  return data;
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
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

export async function searchFoods(query: string, maxResults: number = 20): Promise<FatSecretSearchResult[]> {
  if (!isConfigured()) {
    console.warn("FatSecret API not configured");
    return [];
  }

  try {
    console.log(`FatSecret: Searching for "${query}"`);
    
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

    console.log(`FatSecret search response keys:`, Object.keys(data));

    if (!data.foods_search || !data.foods_search.results) {
      console.log("FatSecret: No results found");
      return [];
    }

    const foods = data.foods_search.results.food;
    if (!foods) return [];

    const foodArray = Array.isArray(foods) ? foods : [foods];
    console.log(`FatSecret: Found ${foodArray.length} results`);

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
