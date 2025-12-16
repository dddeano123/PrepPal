// Open Food Facts API integration
// Free, open database with over 3 million food products

const OFF_API_BASE = "https://world.openfoodfacts.org";
const USER_AGENT = "PrepPal/1.0 (contact@preppal.app)";

export interface OFFProduct {
  code: string;
  product_name?: string;
  brands?: string;
  nutriments?: {
    "energy-kcal_100g"?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
    fiber_100g?: number;
    sugars_100g?: number;
    sodium_100g?: number;
    salt_100g?: number;
  };
  serving_size?: string;
  serving_quantity?: number;
  image_url?: string;
  image_small_url?: string;
  categories_tags_en?: string[];
}

export interface OFFSearchResult {
  code: string;
  productName: string;
  brand: string | null;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  servingSize: string | null;
  imageUrl: string | null;
}

// Search Open Food Facts database
export async function searchOpenFoodFacts(query: string, limit: number = 20): Promise<OFFSearchResult[]> {
  try {
    const url = new URL("/cgi/search.pl", OFF_API_BASE);
    url.searchParams.set("search_terms", query);
    url.searchParams.set("search_simple", "1");
    url.searchParams.set("action", "process");
    url.searchParams.set("json", "1");
    url.searchParams.set("page_size", String(limit));
    url.searchParams.set("fields", "code,product_name,brands,nutriments,serving_size,serving_quantity,image_url,image_small_url");

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": USER_AGENT,
      },
    });

    if (!response.ok) {
      console.error("Open Food Facts API error:", response.status);
      return [];
    }

    const data = await response.json();
    const products: OFFProduct[] = data.products || [];

    return products
      .filter((p) => p.product_name && p.nutriments)
      .map((product) => ({
        code: product.code,
        productName: product.product_name || "Unknown",
        brand: product.brands || null,
        caloriesPer100g: product.nutriments?.["energy-kcal_100g"] || 0,
        proteinPer100g: product.nutriments?.proteins_100g || 0,
        carbsPer100g: product.nutriments?.carbohydrates_100g || 0,
        fatPer100g: product.nutriments?.fat_100g || 0,
        servingSize: product.serving_size || null,
        imageUrl: product.image_small_url || product.image_url || null,
      }));
  } catch (error) {
    console.error("Error searching Open Food Facts:", error);
    return [];
  }
}

// Get a specific product by barcode
export async function getProductByBarcode(barcode: string): Promise<OFFSearchResult | null> {
  try {
    const url = `${OFF_API_BASE}/api/v2/product/${barcode}`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    if (data.status !== 1 || !data.product) {
      return null;
    }

    const product = data.product as OFFProduct;

    return {
      code: product.code,
      productName: product.product_name || "Unknown",
      brand: product.brands || null,
      caloriesPer100g: product.nutriments?.["energy-kcal_100g"] || 0,
      proteinPer100g: product.nutriments?.proteins_100g || 0,
      carbsPer100g: product.nutriments?.carbohydrates_100g || 0,
      fatPer100g: product.nutriments?.fat_100g || 0,
      servingSize: product.serving_size || null,
      imageUrl: product.image_small_url || product.image_url || null,
    };
  } catch (error) {
    console.error("Error fetching product from Open Food Facts:", error);
    return null;
  }
}
