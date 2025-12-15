import type { USDAFoodSearchResult } from "@shared/schema";

const USDA_API_KEY = process.env.USDA_API_KEY || "DEMO_KEY";
const USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1";

export interface USDASearchResponse {
  foods: USDAFoodItem[];
  totalHits: number;
  currentPage: number;
  totalPages: number;
}

export interface USDAFoodItem {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner?: string;
  ingredients?: string;
  foodNutrients: {
    nutrientId: number;
    nutrientName: string;
    nutrientNumber?: string;
    value: number;
    unitName: string;
  }[];
}

// USDA Nutrient IDs
const NUTRIENT_IDS = {
  CALORIES: 1008,  // Energy (kcal)
  PROTEIN: 1003,   // Protein
  CARBS: 1005,     // Carbohydrate
  FAT: 1004,       // Total lipid (fat)
};

export async function searchUSDAFoods(query: string, pageSize: number = 25): Promise<USDAFoodSearchResult[]> {
  try {
    const response = await fetch(
      `${USDA_BASE_URL}/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(query)}&pageSize=${pageSize}&dataType=Foundation,SR%20Legacy`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      console.error(`USDA API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data: USDASearchResponse = await response.json();

    return data.foods.map((food) => ({
      fdcId: food.fdcId,
      description: food.description,
      dataType: food.dataType,
      foodNutrients: food.foodNutrients
        .filter((n) =>
          [NUTRIENT_IDS.CALORIES, NUTRIENT_IDS.PROTEIN, NUTRIENT_IDS.CARBS, NUTRIENT_IDS.FAT].includes(n.nutrientId)
        )
        .map((n) => ({
          nutrientId: n.nutrientId,
          nutrientName: n.nutrientName,
          value: n.value,
          unitName: n.unitName,
        })),
    }));
  } catch (error) {
    console.error("Error searching USDA foods:", error);
    return [];
  }
}

export async function getUSDAFood(fdcId: number): Promise<USDAFoodItem | null> {
  try {
    const response = await fetch(
      `${USDA_BASE_URL}/food/${fdcId}?api_key=${USDA_API_KEY}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      console.error(`USDA API error: ${response.status} ${response.statusText}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching USDA food:", error);
    return null;
  }
}
