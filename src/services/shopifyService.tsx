import {
  createStorefrontApiClient,
  StorefrontApiClient,
} from "@shopify/storefront-api-client";
import { formatApiErrorMessage } from "../hooks/useErrorHandler";
import { retryWithBackoff } from "../utils/cart/networkErrorDetection";

// Define types for Shopify products
export interface ShopifyProductImage {
  url: string;
  src?: string; // Used in some responses
  altText?: string;
}

export interface ShopifyProductVariant {
  id: string;
  title?: string;
  price: {
    amount: string;
    currencyCode: string;
  };
  availableForSale: boolean;
  available?: boolean; // Used for compatibility
  selectedOptions?: Array<{
    name: string;
    value: string;
  }>;
}

export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  descriptionHtml?: string;
  description?: string; // For compatibility
  images: ShopifyProductImage[];
  variants: ShopifyProductVariant[];
}

export interface PaginationInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}

// Define pagination parameters
export interface ShopifyPaginationParams {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
  cursor?: string;
  direction?: "forward" | "backward";
}

// Define the client configuration
const clientConfig = {
  storeDomain: "ragestate.myshopify.com", // Corrected from domain to storeDomain
  apiVersion: "2024-10", // Updated to supported API version
  publicAccessToken: "e4803750ab24a8c8b98cc614e0f34d98", // Corrected from storefrontAccessToken to publicAccessToken
};

const client: StorefrontApiClient = createStorefrontApiClient(clientConfig);

/**
 * Fetches a single product by its handle from Shopify using the Storefront API client.
 *
 * @param {string} handle - The handle of the product to fetch.
 * @returns {Promise<ShopifyProduct|null>} A promise that resolves to the product data.
 * @throws {Error} If there is an error fetching the product.
 */
const fetchProductByHandle = async (
  handle: string
): Promise<ShopifyProduct | null> => {
  return await retryWithBackoff(async () => {
    try {
      const query = `#graphql
        query getProductByHandle($handle: String!) {
          productByHandle(handle: $handle) {
            id
            title
            handle
            descriptionHtml
            images(first: 5) {
              edges {
                node {
                  url
                  altText
                }
              }
            }
            variants(first: 25) {
              edges {
                node {
                  id
                  title
                  availableForSale
                  price {
                    amount
                    currencyCode
                  }
                  selectedOptions {
                    name
                    value
                  }
                }
              }
            }
          }
        }
      `;

      const response: any = await client.request(query, {
        variables: { handle },
      });

      // Transform the response to match our expected format
      const productData = response.data?.productByHandle;

      if (!productData) return null;

      // Transform the nested structure to a flatter one for easier consumption
      return {
        id: productData.id,
        title: productData.title,
        handle: productData.handle,
        descriptionHtml: productData.descriptionHtml,
        images: productData.images.edges.map((edge: any) => ({
          url: edge.node.url,
          altText: edge.node.altText,
        })),
        variants: productData.variants.edges.map((edge: any) => ({
          id: edge.node.id,
          title: edge.node.title,
          availableForSale: edge.node.availableForSale,
          price: edge.node.price,
          selectedOptions: edge.node.selectedOptions,
        })),
      };
    } catch (error: any) {
      console.error(`Error fetching product by handle ${handle}:`, error);

      // Handle specific error cases
      if (error.message?.includes("timeout")) {
        throw new Error(
          "The request to fetch product details timed out. Please try again."
        );
      }

      if (
        error.message?.includes("Network request failed") ||
        error.message?.includes("network")
      ) {
        throw new Error(
          "Network error while fetching product. Please check your internet connection."
        );
      }

      if (error.response?.status === 404 || error.message?.includes("404")) {
        throw new Error(`Product with handle '${handle}' not found.`);
      }

      if (
        error.response?.status === 429 ||
        error.message?.includes("rate limit") ||
        error.message?.includes("429")
      ) {
        throw new Error("Too many requests. Please try again in a moment.");
      }

      // Format error for user-friendly display
      const userMessage = formatApiErrorMessage(error);
      throw new Error(userMessage);
    }
  });
};

/**
 * Fetches all products from Shopify using the Storefront API client.
 *
 * @returns {Promise<any[]>} A promise that resolves to an array of products.
 * @throws {Error} If there is an error fetching the products.
 */
const fetchShopifyProducts = async (): Promise<ShopifyProduct[]> => {
  return await retryWithBackoff(async () => {
    try {
      const query = `#graphql
        query getProducts {
          products(first: 10) { # Adjust count as needed
            edges {
              node {
                id
                title
                handle
                descriptionHtml
                images(first: 5) {
                  edges {
                    node {
                      url
                      altText
                    }
                  }
                }
                variants(first: 10) {
                  edges {
                    node {
                      id
                      title
                      availableForSale
                      price {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;
      // The actual response type will be more specific based on your query
      const response: any = await client.request(query);

      // Transform the response to match expected interface
      return (
        response.data?.products.edges.map((edge: any) => {
          const product = edge.node;
          return {
            id: product.id,
            title: product.title,
            handle: product.handle,
            descriptionHtml: product.descriptionHtml,
            description: product.descriptionHtml, // Adding description for compatibility
            // Transform images
            images: product.images.edges.map((imgEdge: any) => ({
              src: imgEdge.node.url,
              altText: imgEdge.node.altText,
            })),
            // Transform variants
            variants: product.variants.edges.map((varEdge: any) => ({
              id: varEdge.node.id,
              title: varEdge.node.title || "Default",
              price: varEdge.node.price,
              available: varEdge.node.availableForSale, // Use the availableForSale field from the query
            })),
          };
        }) || []
      );
    } catch (error: any) {
      console.error("Error fetching Shopify products:", error);
      throw error;
    }
  });
};

/**
 * Fetches paginated products from Shopify using the Storefront API client
 *
 * @param {ShopifyPaginationParams} paginationParams - Parameters for pagination
 * @returns {Promise<{products: ShopifyProduct[], pageInfo: PaginationInfo}>} Products and pagination info
 * @throws {Error} If there is an error fetching the products
 */
export const fetchPaginatedProducts = async (
  paginationParams: ShopifyPaginationParams = { first: 10 }
): Promise<{ products: ShopifyProduct[]; pageInfo: PaginationInfo }> => {
  return await retryWithBackoff(async () => {
    try {
      const { first = 10, after, last, before } = paginationParams;

      // Build the query parameters based on pagination direction
      let paginationQuery = "";
      if (after) {
        paginationQuery = `first: ${first}, after: "${after}"`;
      } else if (before) {
        paginationQuery = `last: ${last || first}, before: "${before}"`;
      } else {
        paginationQuery = `first: ${first}`;
      }

      const query = `#graphql
        query getProducts {
          products(${paginationQuery}) {
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
            edges {
              node {
                id
                title
                handle
                descriptionHtml
                images(first: 5) {
                  edges {
                    node {
                      url
                      altText
                    }
                  }
                }
                variants(first: 10) {
                  edges {
                    node {
                      id
                      title
                      availableForSale
                      price {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      // Execute the query
      const response: any = await client.request(query);

      // Extract and transform the data
      const productsData = response.data?.products;
      const pageInfo: PaginationInfo = productsData?.pageInfo || {
        hasNextPage: false,
        hasPreviousPage: false,
      };

      // Transform products to match our interface
      const products: ShopifyProduct[] =
        productsData?.edges.map((edge: any) => {
          const product = edge.node;
          return {
            id: product.id,
            title: product.title,
            handle: product.handle,
            descriptionHtml: product.descriptionHtml,
            description: product.descriptionHtml, // For compatibility
            images: product.images.edges.map((imgEdge: any) => ({
              url: imgEdge.node.url,
              src: imgEdge.node.url, // For compatibility
              altText: imgEdge.node.altText,
            })),
            variants: product.variants.edges.map((varEdge: any) => ({
              id: varEdge.node.id,
              title: varEdge.node.title || "Default",
              price: varEdge.node.price,
              availableForSale: varEdge.node.availableForSale,
              available: varEdge.node.availableForSale, // For compatibility
            })),
          };
        }) || [];

      return { products, pageInfo };
    } catch (error: any) {
      console.error("Error fetching paginated products:", error);

      // Enhanced error handling with more specific messages
      if (error.message?.includes("timeout")) {
        throw new Error(
          "The request to fetch products timed out. Please try again."
        );
      }

      if (
        error.message?.includes("Network request failed") ||
        error.message?.includes("network")
      ) {
        throw new Error(
          "Network error while fetching products. Please check your internet connection."
        );
      }

      if (
        error.response?.status === 429 ||
        error.message?.includes("rate limit") ||
        error.message?.includes("429")
      ) {
        throw new Error("Too many requests. Please try again in a moment.");
      }

      // Format error for user-friendly display
      const userMessage = formatApiErrorMessage(error);
      throw new Error(userMessage);
    }
  });
};

// Export functions
export { fetchProductByHandle };
export default fetchShopifyProducts;
