// Example: How to use Analytics in your components

// 1. Basic screen tracking (add to any screen component)
import { useScreenTracking } from "../hooks/useScreenTracking";

export default function SomeScreen() {
// Automatically track screen views
useScreenTracking();

return (
// your component JSX
);
}

// 2. Manual event tracking
import { useAnalytics } from "../analytics/AnalyticsProvider";

export default function ProductScreen() {
const { logEvent, logAddToCart } = useAnalytics();

const handleProductView = (productId: string) => {
logEvent("product_view", { product_id: productId });
};

const handleAddToCart = (product: any) => {
logAddToCart({
itemId: product.id,
itemName: product.title,
itemCategory: product.category,
price: product.price,
});
};

return (
// your component JSX
);
}

// 3. Authentication events  
import { useAnalytics } from "../analytics/AnalyticsProvider";

export default function LoginScreen() {
const { logEvent, setUserId } = useAnalytics();

const handleLogin = async (user: any) => {
try {
// Your existing login logic

      // Track successful login
      await logEvent("login", { method: "email" });
      await setUserId(user.uid);

    } catch (error) {
      // Track login failure
      await logEvent("login_error", { error: error.message });
    }

};
}
