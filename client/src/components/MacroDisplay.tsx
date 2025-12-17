import { cn } from "@/lib/utils";
import type { MacroTotals } from "@shared/schema";
import { formatMacro } from "@/lib/macros";

interface MacroDisplayProps {
  macros: MacroTotals;
  size?: "sm" | "md" | "lg";
  showLabels?: boolean;
  className?: string;
  perServing?: boolean;
}

export function MacroDisplay({
  macros,
  size = "md",
  showLabels = true,
  className,
  perServing = false,
}: MacroDisplayProps) {
  const sizeClasses = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-2xl",
  };

  const labelClasses = {
    sm: "text-xs",
    md: "text-xs",
    lg: "text-sm",
  };

  return (
    <div
      className={cn(
        "grid grid-cols-4 gap-4 text-center",
        className
      )}
      data-testid="macro-display"
    >
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "font-mono font-semibold tabular-nums",
            sizeClasses[size]
          )}
          data-testid="text-calories"
        >
          {formatMacro(macros.calories, 0)}
        </span>
        {showLabels && (
          <span className={cn("text-muted-foreground uppercase tracking-wide", labelClasses[size])}>
            {perServing ? "Cal/srv" : "Cal"}
          </span>
        )}
      </div>
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "font-mono font-semibold tabular-nums",
            sizeClasses[size]
          )}
          data-testid="text-protein"
        >
          {formatMacro(macros.protein)}g
        </span>
        {showLabels && (
          <span className={cn("text-muted-foreground uppercase tracking-wide", labelClasses[size])}>
            Protein
          </span>
        )}
      </div>
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "font-mono font-semibold tabular-nums",
            sizeClasses[size]
          )}
          data-testid="text-carbs"
        >
          {formatMacro(macros.carbs)}g
        </span>
        {showLabels && (
          <span className={cn("text-muted-foreground uppercase tracking-wide", labelClasses[size])}>
            Carbs
          </span>
        )}
      </div>
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "font-mono font-semibold tabular-nums",
            sizeClasses[size]
          )}
          data-testid="text-fat"
        >
          {formatMacro(macros.fat)}g
        </span>
        {showLabels && (
          <span className={cn("text-muted-foreground uppercase tracking-wide", labelClasses[size])}>
            Fat
          </span>
        )}
      </div>
    </div>
  );
}

interface MacroSummaryCardProps {
  macros: MacroTotals;
  servings: number;
  className?: string;
}

export function MacroSummaryCard({ macros, servings, className }: MacroSummaryCardProps) {
  const perServing = {
    calories: macros.calories / servings,
    protein: macros.protein / servings,
    carbs: macros.carbs / servings,
    fat: macros.fat / servings,
  };

  return (
    <div
      className={cn(
        "bg-card border border-card-border rounded-md p-6",
        className
      )}
      data-testid="macro-summary-card"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Per Serving</h3>
        <span className="text-sm text-muted-foreground">
          {servings} {servings === 1 ? "serving" : "servings"}
        </span>
      </div>
      <MacroDisplay macros={perServing} size="lg" perServing />
      <FatSecretAttribution className="mt-4" />
    </div>
  );
}

export function FatSecretAttribution({ className }: { className?: string }) {
  return (
    <div className={cn("flex justify-center", className)}>
      <a 
        href="https://www.fatsecret.com" 
        target="_blank" 
        rel="noopener noreferrer"
        className="opacity-60 hover:opacity-100 transition-opacity"
        data-testid="link-fatsecret-attribution"
      >
        <img 
          src="https://platform.fatsecret.com/api/static/images/powered_by_fatsecret.svg" 
          alt="Powered by FatSecret"
          className="h-5"
        />
      </a>
    </div>
  );
}
