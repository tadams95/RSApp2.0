import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Platform,
  Dimensions,
  ScrollView,
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

    // Use map to transform the query snapshot into an array
    const userPurchases = querySnapshot.docs.map((doc) => doc.data());

    return userPurchases;
  } catch (error) {
    console.error("Error fetching user purchases:", error);
    return [];
  }
};

const HistoryModal = () => {
  const userId = useSelector(selectLocalId);
  const [userPurchases, setUserPurchases] = useState([]);

  const fetchPurchases = useCallback(async () => {
    try {
      const userPurchases = await fetchUserPurchases(userId);
      setUserPurchases(userPurchases);
    } catch (error) {
      console.error("Error: ", error);
    }
  }, [userId]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  const purchaseHistory = useMemo(() => {
    return (
      <>
        <Text style={styles.headline}>Your Purchase History</Text>
        {userPurchases.map((purchase, index) => (
          <View key={index} style={styles.purchaseContainer}>
            <View style={styles.dateContainer}>
              <Text style={styles.purchaseDate}>
                Purchase Date: {purchase.dateTime.toDate().toLocaleDateString()}
              </Text>
            </View>
            {purchase.cartItems.map((item, itemIndex) => (
              <View key={itemIndex} style={styles.cartItem}>
                <Image
                  source={{ uri: item.productImageSrc }}
                  style={styles.productImage}
                />
                <View style={styles.itemDetails}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemText}>QTY: {item.quantity}</Text>
                  <Text style={styles.itemText}>Price: ${item.price}</Text>
                  {item.color && (
                    <Text style={styles.itemText}>Color: {item.color}</Text>
                  )}
                  {item.size && (
                    <Text style={styles.itemText}>Size: {item.size}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        ))}
      </>
    );
  }, [userPurchases]);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.contentContainer}>
        {userPurchases.length === 0 ? (
          <Text style={styles.headline}>No Purchase History</Text>
        ) : (
          purchaseHistory
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
  },
  contentContainer: {
    padding: 16,
  },
  headline: {
    textAlign: "center",
    fontFamily,
    fontSize: 16,
    marginBottom: 20,
    color: "white",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  purchaseContainer: {
    marginBottom: 24,
    borderWidth: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#111",
    elevation: 3,
    borderColor: "#555",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dateContainer: {
    alignItems: "center",
    marginBottom: 14,
    width: "100%",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    paddingBottom: 8,
  },
  purchaseDate: {
    fontWeight: "bold",
    textAlign: "center",
    textTransform: "uppercase",
    color: "white",
    fontFamily,
  },
  cartItem: {
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: "#222",
    borderWidth: 1,
    borderColor: "#444",
    overflow: "hidden",
  },
  itemDetails: {
    padding: 12,
  },
  itemTitle: {
    fontFamily,
    fontSize: 14,
    marginBottom: 6,
    textTransform: "uppercase",
    color: "white",
    fontWeight: "600",
  },
  itemText: {
    fontFamily,
    fontSize: 14,
    marginBottom: 4,
    color: "#ccc",
  },
  productImage: {
    width: "100%",
    height: Dimensions.get("window").width * 0.5,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
});

export default HistoryModal;
