import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Loader2, Search, ShoppingCart, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface KrogerNutrient {
  code: string;
  description: string;
  displayName: string;
  quantity?: number;
  unitOfMeasure: { code: string; name: string; abbreviation?: string };
}

interface KrogerNutritionInfo {
  servingSize: {
    quantity: number;
    unitOfMeasure: { code: string; name: string; abbreviation?: string };
  };
  nutrients: KrogerNutrient[];
}

interface KrogerProduct {
  productId: string;
  upc: string;
  description: string;
  brand?: string;
  images?: { perspective: string; sizes: { size: string; url: string }[] }[];
  items?: { price?: { regular: number; promo?: number }; size?: string }[];
  nutritionInformation?: KrogerNutritionInfo[];
}

interface IngredientAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onProductSelect: (product: KrogerProduct) => void;
  placeholder?: string;
  className?: string;
  "data-testid"?: string;
}

export function IngredientAutocomplete({
  value,
  onChange,
  onProductSelect,
  placeholder = "Search ingredients...",
  className,
  "data-testid": testId,
}: IngredientAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Check if Kroger product search is available (works without user sign-in)
  const { data: krogerStatus } = useQuery<{ isConfigured: boolean; isConnected: boolean; canSearchProducts: boolean }>({
    queryKey: ["/api/kroger/status"],
  });

  const canSearchProducts = krogerStatus?.canSearchProducts;

  // Search Kroger products (works with app credentials, no user sign-in required)
  const { data: products, isLoading: isSearching } = useQuery<KrogerProduct[]>({
    queryKey: [`/api/kroger/products?term=${encodeURIComponent(searchTerm)}`],
    enabled: !!canSearchProducts && searchTerm.length >= 2,
    staleTime: 30000,
  });

  // Handle input change with debounce
  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      setSearchTerm(newValue.trim());
      if (newValue.trim().length >= 2 && canSearchProducts) {
        setIsOpen(true);
      }
    }, 300);
  };

  // Handle product selection
  const handleSelect = (product: KrogerProduct) => {
    onChange(product.description);
    onProductSelect(product);
    setIsOpen(false);
    setSearchTerm("");
  };

  // Handle keyboard events to prevent form submission
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Always prevent form submission from this input
      e.preventDefault();
      // If dropdown is open with products, select the first one
      if (isOpen && products && products.length > 0) {
        handleSelect(products[0]);
      } else {
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown' && isOpen) {
      e.preventDefault();
      // Focus first item in dropdown
      const firstButton = dropdownRef.current?.querySelector('button');
      firstButton?.focus();
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Get product image URL
  const getProductImage = (product: KrogerProduct): string | null => {
    if (!product.images || product.images.length === 0) return null;
    const frontImage = product.images.find((img) => img.perspective === "front");
    const image = frontImage || product.images[0];
    const smallSize = image.sizes.find((s) => s.size === "small" || s.size === "thumbnail");
    return smallSize?.url || image.sizes[0]?.url || null;
  };

  // Get product price
  const getProductPrice = (product: KrogerProduct): string | null => {
    if (!product.items || product.items.length === 0) return null;
    const price = product.items[0].price;
    if (!price) return null;
    return price.promo ? `$${price.promo.toFixed(2)}` : `$${price.regular.toFixed(2)}`;
  };

  const showDropdown = isOpen && (isSearching || (products && products.length > 0));

  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (searchTerm.length >= 2 && canSearchProducts) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn("pr-8", className)}
          data-testid={testId}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : canSearchProducts ? (
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Search className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-md border bg-popover shadow-lg"
        >
          {isSearching ? (
            <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching Kroger...
            </div>
          ) : products && products.length > 0 ? (
            <ul className="py-1">
              {products.map((product) => {
                const imageUrl = getProductImage(product);
                const price = getProductPrice(product);

                return (
                  <li key={product.productId}>
                    <button
                      type="button"
                      onClick={() => handleSelect(product)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover-elevate"
                      data-testid={`product-option-${product.productId}`}
                    >
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={product.description}
                          className="h-10 w-10 rounded object-cover bg-muted"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {product.description}
                        </div>
                        {product.brand && (
                          <div className="text-xs text-muted-foreground truncate">
                            {product.brand}
                          </div>
                        )}
                      </div>
                      {price && (
                        <span className="font-mono text-sm text-muted-foreground">
                          {price}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      )}

      {!canSearchProducts && value.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-3 shadow-lg">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>Connect Kroger in Shopping List for product suggestions</span>
          </div>
        </div>
      )}
    </div>
  );
}
