import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Platform,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useSelector } from "react-redux";
import { selectLocalId } from "../../store/redux/userSlice";
import { getFirestore, collection, getDocs } from "firebase/firestore";

// Memoize the Firestore instance
const firestore = getFirestore();

const fetchUserPurchases = async (userId) => {
  try {
    const purchasesRef = collection(firestore, `customers/${userId}/purchases`);
    const querySnapshot = await getDocs(purchasesRef);

    // Include document ID with each purchase data
    const userPurchases = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return userPurchases;
  } catch (error) {
    console.error("Error fetching user purchases:", error);
    return [];
  }
};

const HistoryModal = () => {
  const userId = useSelector(selectLocalId);
  const [userPurchases, setUserPurchases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formattedOrders, setFormattedOrders] = useState([]);
  const { width: screenWidth } = useWindowDimensions();
  const responsivePadding = screenWidth < 350 ? 8 : 16;
  const itemPadding = screenWidth < 350 ? 8 : 14;

  const fetchPurchases = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      const purchases = await fetchUserPurchases(userId);
      
      // Process purchases into a consistent format (similar to web implementation)
      const formatted = purchases.map((purchase, index) => {
        // Handle both date formats
        let dateObj;
        try {
          const dateField = 
            purchase.dateTime || purchase.orderDate || purchase.createdAt;
          
          // Handle Firestore timestamp objects
          if (dateField && typeof dateField.toDate === "function") {
            dateObj = dateField.toDate();
          } else if (dateField) {
            dateObj = new Date(dateField);
          } else {
            dateObj = new Date();
          }
          
          // Verify it's a valid date
          if (isNaN(dateObj.getTime())) {
            dateObj = new Date();
          }
        } catch (e) {
          console.error("Error converting date field:", e);
          dateObj = new Date();
        }
        
        // Handle both cartItems (legacy) and items (new format)
        const itemsArray = purchase.cartItems || purchase.items || [];
        
        // Use order number if available, or fallback to ID
        const orderId = purchase.orderNumber || purchase.id || `ORDER-${index + 1}`;
        
        return {
          id: orderId,
          date: dateObj.toLocaleDateString(),
          dateObj: dateObj,
          timestamp: dateObj.getTime(),
          total: purchase.total || purchase.totalAmount 
            ? `$${typeof purchase.total === 'string' 
                ? purchase.total 
                : typeof purchase.totalAmount === 'string' 
                  ? purchase.totalAmount 
                  : parseFloat(purchase.total || purchase.totalAmount || 0).toFixed(2)}`
            : "N/A",
          status: purchase.status || "Completed",
          items: itemsArray.map((item, itemIdx) => ({
            id: `ITEM-${orderId}-${itemIdx}`,
            name: item.title,
            price: `$${parseFloat(item.price || 0).toFixed(2)}`,
            quantity: item.quantity || 1,
            image: item.productImageSrc || item.image || "",
            color: item.color,
            size: item.size,
          })),
        };
      });
      
      // Sort by timestamp (most recent first)
      const sortedOrders = [...formatted].sort((a, b) => b.timestamp - a.timestamp);
      
      setFormattedOrders(sortedOrders);
      setUserPurchases(purchases);
      setIsLoading(false);
    } catch (error) {
      console.error("Error: ", error);
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#ff3c00" />
        <Text style={styles.loadingText}>Loading your purchase history...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ alignItems: 'center' }}>
      <View style={[
        styles.contentContainer, 
        { 
          padding: responsivePadding,
          maxWidth: Math.min(600, screenWidth),
        }
      ]}>
        {formattedOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.headline}>No Purchase History</Text>
            <Text style={styles.emptyText}>You haven't made any purchases yet.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.headline}>Your Purchase History</Text>
            {formattedOrders.map((order) => (
              <View key={order.id} style={styles.purchaseContainer}>
                <View style={styles.orderHeader}>
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderNumber} numberOfLines={1} ellipsizeMode="tail">
                      Order #{order.id}
                    </Text>
                    <Text style={styles.orderDate}>{order.date}</Text>
                  </View>
                  <View style={styles.orderStatus}>
                    <Text style={styles.statusText} numberOfLines={1}>{order.status}</Text>
                    <Text style={styles.totalText} numberOfLines={1}>{order.total}</Text>
                  </View>
                </View>
                
                {order.items.map((item) => (
                  <View key={item.id} style={styles.cartItem}>
                    <View style={styles.imageContainer}>
                      {item.image ? (
                        <Image
                          source={{ uri: item.image }}
                          style={styles.productImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.productImage, styles.noImage]}>
                          <Text style={styles.noImageText}>No Image</Text>
                        </View>
                      )}
                    </View>
                    <View style={[styles.itemDetails, { padding: itemPadding }]}>
                      <Text style={styles.itemTitle} numberOfLines={2} ellipsizeMode="tail">
                        {item.name}
                      </Text>
                      <View style={styles.itemRow}>
                        <Text style={styles.itemText}>QTY: {item.quantity}</Text>
                        <Text style={styles.itemPrice}>{item.price}</Text>
                      </View>
                      {(item.color || item.size) && (
                        <View style={styles.itemRow}>
                          {item.color && (
                            <Text style={styles.itemText} numberOfLines={1}>
                              Color: {item.color}
                            </Text>
                          )}
                          {item.size && (
                            <Text style={styles.itemText} numberOfLines={1}>
                              Size: {item.size}
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
};

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    width: '100%',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  contentContainer: {
    paddingBottom: 40,
    width: '100%',
  },
  headline: {
    textAlign: "center",
    fontFamily,
    fontSize: 18,
    marginVertical: 20,
    color: "white",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginVertical: 20,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    backgroundColor: '#111',
    width: '100%',
  },
  emptyText: {
    fontFamily,
    color: '#aaa',
    textAlign: 'center',
    marginTop: 10,
    fontSize: 14,
  },
  loadingText: {
    fontFamily,
    color: '#ccc',
    marginTop: 16,
    fontSize: 14,
  },
  purchaseContainer: {
    marginBottom: 24,
    borderWidth: 1,
    padding: 14,
    borderRadius: 12, // Match border radius with MyEvents
    backgroundColor: "#111", // Match background color with MyEvents
    elevation: 3,
    borderColor: "#444", // Match border color with MyEvents
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    width: '100%',
  },
  orderHeader: {
    flexDirection: 'column',
    marginBottom: 16,
    width: "100%",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    paddingBottom: 10,
  },
  orderInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  orderStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    flexWrap: 'wrap',
  },
  orderNumber: {
    fontWeight: "bold",
    color: "white",
    fontFamily,
    fontSize: 15,
    flex: 1,
    marginRight: 8,
  },
  orderDate: {
    color: "#ccc",
    fontFamily,
    fontSize: 14,
    textAlign: 'right',
  },
  statusText: {
    color: '#4caf50',
    fontFamily,
    fontWeight: '500',
    flex: 1,
  },
  totalText: {
    color: '#ff3c00',
    fontFamily,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  cartItem: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: "#222",
    borderWidth: 1,
    borderColor: "#444",
    overflow: "hidden",
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 16/9, // Match the aspect ratio with MyEvents
    overflow: 'hidden',
  },
  itemDetails: {
    padding: 16, // Match padding with MyEvents
  },
  itemTitle: {
    fontFamily,
    fontSize: 16, // Match font size with MyEvents
    marginBottom: 8,
    textTransform: "uppercase",
    color: "white",
    fontWeight: "600",
    lineHeight: 22, // Match line height with MyEvents
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  itemText: {
    fontFamily,
    fontSize: 14,
    color: "#ccc",
    flex: 1,
    marginRight: 8,
  },
  itemPrice: {
    fontFamily,
    fontSize: 14,
    color: "#ccc",
    fontWeight: '500',
    textAlign: 'right',
  },
  productImage: {
    width: "100%",
    height: "100%",
    backgroundColor: '#222',
  },
  noImage: {
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    color: '#666',
    fontFamily,
  },
});

export default HistoryModal;
