import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Platform,
  Dimensions,
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
                <Text style={styles.itemTitle}> {item.title}</Text>
                <Text style={styles.itemText}>QTY: {item.quantity}</Text>
                <Text style={styles.itemText}>Price: ${item.price}</Text>
                {item.color && (
                  <Text style={styles.itemText}>Color: {item.color}</Text>
                )}
                {item.size && (
                  <Text style={styles.itemText}>Size: {item.size}</Text>
                )}
              </View>
            ))}
          </View>
        ))}
      </>
    );
  }, [userPurchases]);

  return (
    <View style={styles.container}>
      <View>
        {userPurchases.length === 0 ? (
          <Text style={styles.headline}>No Purchase History</Text>
        ) : (
          purchaseHistory
        )}
      </View>
    </View>
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
    padding: 20,
    backgroundColor: "#000",
  },
  headline: {
    backgroundColor: "#000",
    textAlign: "center",
    fontFamily,
    fontSize: 14,
    marginBottom: 10,
    color: "white",
    fontWeight: "500",
    textTransform: "uppercase",
  },
  purchaseContainer: {
    marginBottom: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    borderWidth: 2,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "black",
    elevation: 3,
    // color: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    borderColor: "white",
  },
  dateContainer: {
    // Added
    alignItems: "center", // Added
    marginBottom: 10, // Adjust as needed
    width: "100%", // Added
  }, // Added
  purchaseDate: {
    fontWeight: "bold",
    textAlign: "center",
    textTransform: "uppercase",
    color: "white",
  },
  cartItem: {
    width: "48%", // Adjust as needed for spacing
    marginBottom: 10,
    borderRadius: 8,
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: "white",
  },
  itemTitle: {
    fontFamily,
    fontSize: 14,
    padding: 5,
    textTransform: "uppercase",
    textAlign: "center",
    color: "white",
  },
  itemText: {
    fontFamily,
    fontSize: 14,
    padding: 5,
    textTransform: "uppercase",
    color: "white",
  },
  productImage: {
    width: "100%",
    height: Dimensions.get("window").width * 0.42,
    borderRadius: 8,
  },
});

export default HistoryModal;
