import {
  createStorefrontApiClient,
  StorefrontApiClient,
} from "@shopify/storefront-api-client";

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
 * @returns {Promise<any>} A promise that resolves to the product data.
 * @throws {Error} If there is an error fetching the product.
 */
const fetchProductByHandle = async (handle: string): Promise<any> => {
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
    throw error;
  }
};

/**
 * Fetches all products from Shopify using the Storefront API client.
 *
 * @returns {Promise<any[]>} A promise that resolves to an array of products.
 * @throws {Error} If there is an error fetching the products.
 */
const fetchShopifyProducts = async (): Promise<any[]> => {
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
};

// Export both functions
export { fetchProductByHandle };
export default fetchShopifyProducts;
