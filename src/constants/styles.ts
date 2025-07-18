import { Dimensions } from "react-native";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export const GlobalStyles = {
  colors: {
    red0: "#FFEEEE",
    red1: "#FACDCD",
    red2: "#F29B9B",
    red3: "#E66A6A",
    red4: "#D64545",
    red5: "#BA2525",
    red6: "#A61B1B",
    red7: "#911111",
    red8: "#780A0A",
    red9: "#610404",
    redVivid0: "#FFE3E3",
    redVivid1: "#FFBDBD",
    redVivid2: "#FF9B9B",
    redVivid3: "#F86A6A",
    redVivid4: "#EF4E4E",
    redVivid5: "#E12D39",
    redVivid6: "#CF1124",
    redVivid7: "#AB091E",
    redVivid8: "#8A041A",
    redVivid9: "#610316",
    yellow0: "#FFFAEB",
    yellow1: "#FCEFC7",
    yellow2: "#F8E3A3",
    yellow3: "#F9DA8B",
    yellow4: "#F7D070",
    yellow5: "#E9B949",
    yellow: "#E9B949",
    yellow6: "#C99A2E",
    yellow7: "#A27C1A",
    yellow8: "#7C5E10",
    yellow9: "#513C06",
    grey0: "#F7F7F7",
    grey1: "#E1E1E1",
    grey2: "#CFCFCF",
    grey3: "#B1B1B1",
    grey4: "#9E9E9E",
    grey5: "#7E7E7E",
    grey6: "#626262",
    grey7: "#515151",
    grey8: "#3B3B3B",
    grey9: "#222222",
    warmGrey0: "#FAF9F7",
    warmGrey1: "#E8E6E1",
    warmGrey2: "#D3CEC4",
    warmGrey3: "#B8B2A7",
    warmGrey4: "#A39E93",
    warmGrey5: "#857F72",
    warmGrey6: "#625D52",
    warmGrey7: "#504A40",
    warmGrey8: "#423D33",
    warmGrey9: "#27241D",
    // App-specific brand colors
    primary: "#ff3c00",
    background: "#000",
    surface: "#222",
    text: "#fff",
    textSecondary: "#999",
    border: "#555",
    error: "#ef4444",
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    // Standardized values from app analysis
    flashListPadding: 10,
    buttonPadding: 14,
    modalPadding: 20,
    screenPadding: 15,
    tabButtonMargin: 12,
    contentPadding: 10,
  },

  typography: {
    fontFamily: "Arial", // Default font family
    sizes: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 20,
      xxl: 24,
      xxxl: 32,
    },
    weights: {
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
  },

  layout: {
    screenWidth,
    screenHeight,
    buttonHeight: 45,
    touchTarget: 44,
    borderRadius: 8,
    // Platform-specific spacing adjustments
    eventContentBottom: {
      ios: 165,
      android: 95,
    },
  },

  shadows: {
    sm: {
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.18,
      shadowRadius: 1.0,
      elevation: 1,
    },
    md: {
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 1.41,
      elevation: 2,
    },
    lg: {
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
  },
};
