// shopifyService.js
import Client from "shopify-buy";

const client = Client.buildClient({
    domain: "ragestate.myshopify.com",
    storefrontAccessToken: "e4803750ab24a8c8b98cc614e0f34d98",
  });

const fetchShopifyProducts = async () => {
  try {
    const products = await client.product.fetchAll();
    return products;
  } catch (error) {
    console.error('Error fetching Shopify products:', error);
    throw error;
  }
};

export default fetchShopifyProducts;
