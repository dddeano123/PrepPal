import { db } from "./db";

const KROGER_API_BASE = "https://api.kroger.com/v1";
const KROGER_AUTH_URL = "https://api.kroger.com/v1/connect/oauth2";

interface KrogerTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface KrogerNutrient {
  code: string;
  description: string;
  displayName: string;
  quantity?: number;
  percentDailyIntake?: number;
  precision?: Record<string, unknown>;
  unitOfMeasure: { code: string; name: string; abbreviation?: string };
}

interface KrogerNutritionInfo {
  ingredientStatement?: string;
  dailyValueIntakeReference?: string;
  servingSize: {
    quantity: number;
    unitOfMeasure: { code: string; name: string; abbreviation?: string };
  };
  nutrients: KrogerNutrient[];
  preparationState?: { code: string; name: string };
  servingsPerPackage?: { description: string; value: number };
  nutritionalRating?: string;
}

interface KrogerProduct {
  productId: string;
  upc: string;
  description: string;
  brand?: string;
  images?: { perspective: string; sizes: { size: string; url: string }[] }[];
  items?: { price?: { regular: number; promo?: number }; size?: string }[];
  aisleLocations?: { bayNumber?: string; description?: string; number?: string }[];
  nutritionInformation?: KrogerNutritionInfo[];
}

interface KrogerLocation {
  locationId: string;
  chain: string;
  name: string;
  address: {
    addressLine1: string;
    city: string;
    state: string;
    zipCode: string;
  };
  geolocation?: {
    latitude: number;
    longitude: number;
  };
}

export class KrogerService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.KROGER_CLIENT_ID || "";
    this.clientSecret = process.env.KROGER_CLIENT_SECRET || "";
    this.redirectUri = process.env.KROGER_REDIRECT_URI || "";
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  getAuthorizationUrl(state: string): string {
    const scopes = "product.compact cart.basic:write";
    const params = new URLSearchParams({
      scope: scopes,
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state,
    });
    return `${KROGER_AUTH_URL}/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<KrogerTokens> {
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    
    const response = await fetch(`${KROGER_AUTH_URL}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code for tokens: ${error}`);
    }

    return await response.json();
  }

  async refreshAccessToken(refreshToken: string): Promise<KrogerTokens> {
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    
    const response = await fetch(`${KROGER_AUTH_URL}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh token: ${error}`);
    }

    return await response.json();
  }

  async getClientCredentialsToken(): Promise<string> {
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    
    const response = await fetch(`${KROGER_AUTH_URL}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope: "product.compact",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get client credentials token: ${error}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  async searchProducts(
    accessToken: string,
    term: string,
    locationId?: string,
    limit: number = 10
  ): Promise<{ products: KrogerProduct[]; status: number }> {
    const params = new URLSearchParams({
      "filter.term": term,
      "filter.limit": limit.toString(),
    });
    
    if (locationId) {
      params.append("filter.locationId", locationId);
    }

    const response = await fetch(`${KROGER_API_BASE}/products?${params.toString()}`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      return { products: [], status: response.status };
    }

    const data = await response.json();
    return { products: data.data || [], status: response.status };
  }

  async searchLocations(
    accessToken: string,
    zipCode: string,
    radiusMiles: number = 10,
    limit: number = 10
  ): Promise<KrogerLocation[]> {
    const params = new URLSearchParams({
      "filter.zipCode.near": zipCode,
      "filter.radiusInMiles": radiusMiles.toString(),
      "filter.limit": limit.toString(),
    });

    const response = await fetch(`${KROGER_API_BASE}/locations?${params.toString()}`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to search locations: ${error}`);
    }

    const data = await response.json();
    return data.data || [];
  }

  async addToCart(
    accessToken: string,
    items: { upc: string; quantity: number }[]
  ): Promise<{ success: boolean; status: number; error?: string }> {
    const response = await fetch(`${KROGER_API_BASE}/cart/add`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        items: items.map((item) => ({
          upc: item.upc,
          quantity: item.quantity,
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, status: response.status, error };
    }

    return { success: true, status: response.status };
  }
}

export const krogerService = new KrogerService();
