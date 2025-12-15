import type { Food, MacroTotals } from "@shared/schema";

// A minimal ingredient type for macro calculation - only needs grams and food
export interface IngredientForMacros {
  grams: number;
  food: Food | null;
}

export function calculateIngredientMacros(
  grams: number,
  caloriesPer100g: number,
  proteinPer100g: number,
  carbsPer100g: number,
  fatPer100g: number
): MacroTotals {
  const multiplier = grams / 100;
  return {
    calories: Math.round(caloriesPer100g * multiplier * 10) / 10,
    protein: Math.round(proteinPer100g * multiplier * 10) / 10,
    carbs: Math.round(carbsPer100g * multiplier * 10) / 10,
    fat: Math.round(fatPer100g * multiplier * 10) / 10,
  };
}

export function calculateRecipeTotals(ingredients: IngredientForMacros[]): MacroTotals {
  return ingredients.reduce(
    (totals, ingredient) => {
      if (!ingredient.food) return totals;
      const macros = calculateIngredientMacros(
        ingredient.grams,
        ingredient.food.caloriesPer100g,
        ingredient.food.proteinPer100g,
        ingredient.food.carbsPer100g,
        ingredient.food.fatPer100g
      );
      return {
        calories: totals.calories + macros.calories,
        protein: totals.protein + macros.protein,
        carbs: totals.carbs + macros.carbs,
        fat: totals.fat + macros.fat,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export function calculatePerServingMacros(
  totals: MacroTotals,
  servings: number
): MacroTotals {
  if (servings <= 0) return totals;
  return {
    calories: Math.round((totals.calories / servings) * 10) / 10,
    protein: Math.round((totals.protein / servings) * 10) / 10,
    carbs: Math.round((totals.carbs / servings) * 10) / 10,
    fat: Math.round((totals.fat / servings) * 10) / 10,
  };
}

export function formatMacro(value: number, decimals: number = 1): string {
  return value.toFixed(decimals);
}
