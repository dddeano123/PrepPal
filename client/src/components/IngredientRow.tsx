import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IngredientAutocomplete } from "@/components/IngredientAutocomplete";
import { GripVertical, Search, Trash2, AlertTriangle, Link2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMacro, calculateIngredientMacros } from "@/lib/macros";
import type { Food } from "@shared/schema";
import { UNIT_CONVERSIONS, UNIT_LABELS, UNIT_CATEGORIES } from "@shared/schema";

interface KrogerProduct {
  productId: string;
  upc: string;
  description: string;
  brand?: string;
  images?: { perspective: string; sizes: { size: string; url: string }[] }[];
  items?: { price?: { regular: number; promo?: number }; size?: string }[];
}

// Flexible ingredient type for the row - works for both new/edit and display
export interface EditableIngredient {
  displayName: string;
  amount: number | null;
  unit: string | null;
  grams: number;
  foodId: number | null;
  food: Food | null;
  category: string | null;
  isPantryStaple: boolean | null;
  krogerProductId?: string | null;
}

interface IngredientRowProps {
  ingredient: EditableIngredient;
  index: number;
  onUpdate: (updates: Partial<EditableIngredient>) => void;
  onDelete: () => void;
  onMatchFood: () => void;
  onKrogerProductSelect?: (product: KrogerProduct) => void;
  isAutoMatching?: boolean;
  isDragging?: boolean;
}

const CATEGORIES = [
  { value: "produce", label: "Produce" },
  { value: "meat", label: "Meat" },
  { value: "seafood", label: "Seafood" },
  { value: "dairy", label: "Dairy" },
  { value: "pantry", label: "Pantry" },
  { value: "frozen", label: "Frozen" },
  { value: "bakery", label: "Bakery" },
  { value: "beverages", label: "Beverages" },
  { value: "condiments", label: "Condiments" },
  { value: "spices", label: "Spices" },
  { value: "other", label: "Other" },
];

export function IngredientRow({
  ingredient,
  index,
  onUpdate,
  onDelete,
  onMatchFood,
  onKrogerProductSelect,
  isAutoMatching,
  isDragging,
}: IngredientRowProps) {
  const isMatched = !!ingredient.food;
  const macros = isMatched
    ? calculateIngredientMacros(
        ingredient.grams,
        ingredient.food!.caloriesPer100g,
        ingredient.food!.proteinPer100g,
        ingredient.food!.carbsPer100g,
        ingredient.food!.fatPer100g
      )
    : null;

  return (
    <div
      className={cn(
        "grid grid-cols-12 gap-2 items-center p-3 rounded-md border transition-all overflow-visible",
        !isMatched && !isAutoMatching && "border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/20",
        isAutoMatching && "border-blue-300 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-950/20",
        isMatched && "border-border bg-card",
        isDragging && "opacity-50"
      )}
      data-testid={`ingredient-row-${index}`}
    >
      <div className="col-span-1 flex items-center justify-center">
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
      </div>

      <div className="col-span-3 overflow-visible">
        {onKrogerProductSelect ? (
          <IngredientAutocomplete
            value={ingredient.displayName}
            onChange={(value) => onUpdate({ displayName: value })}
            onProductSelect={onKrogerProductSelect}
            placeholder="Search ingredients..."
            className="h-9"
            data-testid={`input-ingredient-name-${index}`}
          />
        ) : (
          <Input
            value={ingredient.displayName}
            onChange={(e) => onUpdate({ displayName: e.target.value })}
            placeholder="Ingredient name"
            className="h-9"
            data-testid={`input-ingredient-name-${index}`}
          />
        )}
      </div>

      <div className="col-span-1">
        <Input
          type="number"
          value={ingredient.amount || ""}
          onChange={(e) => {
            const newAmount = parseFloat(e.target.value) || 0;
            const conversionFactor = ingredient.unit ? UNIT_CONVERSIONS[ingredient.unit as keyof typeof UNIT_CONVERSIONS] : 1;
            // Only auto-calculate grams if conversion factor exists and is > 0
            if (conversionFactor && conversionFactor > 0) {
              onUpdate({ 
                amount: newAmount,
                grams: Math.round(newAmount * conversionFactor * 100) / 100
              });
            } else {
              // For count-based units (piece, slice, etc), preserve existing grams
              onUpdate({ amount: newAmount });
            }
          }}
          placeholder="Amt"
          className="h-9 text-center"
          data-testid={`input-ingredient-amount-${index}`}
        />
      </div>

      <div className="col-span-1">
        <Select
          value={ingredient.unit || "g"}
          onValueChange={(value) => {
            const conversionFactor = UNIT_CONVERSIONS[value as keyof typeof UNIT_CONVERSIONS];
            // Only auto-calculate grams if conversion factor exists and is > 0
            if (conversionFactor && conversionFactor > 0) {
              const newGrams = (ingredient.amount || 0) * conversionFactor;
              onUpdate({ 
                unit: value,
                grams: Math.round(newGrams * 100) / 100
              });
            } else {
              // For count-based units, just update unit and keep existing grams
              onUpdate({ unit: value });
            }
          }}
        >
          <SelectTrigger className="h-9" data-testid={`select-ingredient-unit-${index}`}>
            <SelectValue placeholder="Unit" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(UNIT_CATEGORIES).map(([category, units]) => (
              <div key={category}>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {category}
                </div>
                {units.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {UNIT_LABELS[unit as keyof typeof UNIT_LABELS]}
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="col-span-1">
        <Input
          type="number"
          value={ingredient.grams}
          onChange={(e) => onUpdate({ grams: parseFloat(e.target.value) || 0 })}
          placeholder="g"
          className="h-9 text-center font-mono"
          data-testid={`input-ingredient-grams-${index}`}
        />
      </div>

      <div className="col-span-3 grid grid-cols-4 gap-1 text-center">
        {isAutoMatching ? (
          <div className="col-span-4 flex items-center justify-center gap-1">
            <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
            <span className="text-xs text-blue-600 dark:text-blue-400">Matching...</span>
          </div>
        ) : isMatched ? (
          <>
            <span className="font-mono text-sm" data-testid={`text-ingredient-cal-${index}`}>
              {formatMacro(macros!.calories, 0)}
            </span>
            <span className="font-mono text-sm" data-testid={`text-ingredient-protein-${index}`}>
              {formatMacro(macros!.protein)}
            </span>
            <span className="font-mono text-sm" data-testid={`text-ingredient-carbs-${index}`}>
              {formatMacro(macros!.carbs)}
            </span>
            <span className="font-mono text-sm" data-testid={`text-ingredient-fat-${index}`}>
              {formatMacro(macros!.fat)}
            </span>
          </>
        ) : (
          <div className="col-span-4 flex items-center justify-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs text-amber-600 dark:text-amber-400">Unmatched</span>
          </div>
        )}
      </div>

      <div className="col-span-2 flex items-center justify-end gap-1">
        <Button
          type="button"
          variant={isMatched ? "ghost" : "outline"}
          size="icon"
          onClick={onMatchFood}
          className={cn(
            !isMatched && "border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400"
          )}
          data-testid={`button-match-food-${index}`}
          aria-label="Match to food"
        >
          {isMatched ? <Link2 className="h-4 w-4" /> : <Search className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDelete}
          data-testid={`button-delete-ingredient-${index}`}
          aria-label="Delete ingredient"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function IngredientTableHeader() {
  return (
    <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b">
      <div className="col-span-1"></div>
      <div className="col-span-3">Ingredient</div>
      <div className="col-span-1 text-center">Amount</div>
      <div className="col-span-1 text-center">Unit</div>
      <div className="col-span-1 text-center">Grams</div>
      <div className="col-span-3 grid grid-cols-4 gap-1 text-center">
        <span>Cal</span>
        <span>P</span>
        <span>C</span>
        <span>F</span>
      </div>
      <div className="col-span-2"></div>
    </div>
  );
}

export function IngredientTotalsRow({ totals }: { totals: { calories: number; protein: number; carbs: number; fat: number } }) {
  return (
    <div className="grid grid-cols-12 gap-2 px-3 py-3 border-t bg-muted/30 rounded-b-md">
      <div className="col-span-1"></div>
      <div className="col-span-3 font-semibold">Total</div>
      <div className="col-span-1"></div>
      <div className="col-span-1"></div>
      <div className="col-span-1"></div>
      <div className="col-span-3 grid grid-cols-4 gap-1 text-center font-mono font-semibold">
        <span data-testid="text-total-calories">{formatMacro(totals.calories, 0)}</span>
        <span data-testid="text-total-protein">{formatMacro(totals.protein)}</span>
        <span data-testid="text-total-carbs">{formatMacro(totals.carbs)}</span>
        <span data-testid="text-total-fat">{formatMacro(totals.fat)}</span>
      </div>
      <div className="col-span-2"></div>
    </div>
  );
}
