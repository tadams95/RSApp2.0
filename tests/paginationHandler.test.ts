/**
 * Tests for the pagination handler utility functions
 */

import {
  fetchNextPage,
  fetchPaginatedData,
  fetchPrevPage,
  PAGINATION_ERRORS,
  PaginationState,
} from "../src/utils/paginationHandler";

// Mock Firestore
jest.mock("firebase/firestore", () => {
  const originalModule = jest.requireActual("firebase/firestore");

  // Mock documents for testing
  const mockDocs = Array(20)
    .fill(null)
    .map((_, i) => ({
      id: `doc-${i + 1}`,
      data: () => ({
        id: `doc-${i + 1}`,
        name: `Test Document ${i + 1}`,
        createdAt: {
          seconds: Date.now() / 1000 - i * 3600,
          toDate: () => new Date(Date.now() - i * 3600 * 1000),
        },
      }),
      exists: () => true,
    }));

  return {
    ...originalModule,
    collection: jest.fn(() => ({ path: "testCollection" })),
    query: jest.fn((...args) => args),
    getDocs: jest.fn(async (query) => {
      // Extract pagination info from the query
      const limitValue =
        query.find((arg) => arg && arg.type === "limit")?.value || 10;
      const startAfterDoc = query.find(
        (arg) => arg && arg.type === "startAfter"
      )?.value;

      let startIndex = 0;

      // If using startAfter, find the corresponding index
      if (startAfterDoc) {
        const startAfterId = startAfterDoc.id;
        const foundIndex = mockDocs.findIndex((doc) => doc.id === startAfterId);
        if (foundIndex !== -1) {
          startIndex = foundIndex + 1;
        } else {
          // Simulate cursor error
          throw new Error("Invalid cursor");
        }
      }

      // Get the subset of documents based on pagination
      const subset = mockDocs.slice(startIndex, startIndex + limitValue);

      return {
        docs: subset,
        empty: subset.length === 0,
        size: subset.length,
      };
    }),
    limit: jest.fn((value) => ({ type: "limit", value })),
    orderBy: jest.fn((field, direction) => ({
      type: "orderBy",
      field,
      direction,
    })),
    startAfter: jest.fn((doc) => ({ type: "startAfter", value: doc })),
    where: jest.fn((field, op, value) => ({ type: "where", field, op, value })),
  };
});

// Mock local storage for persistence tests
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => {
      return store[key] || null;
    }),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock the database
(window as any).db = {};

describe("Pagination Handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  describe("fetchPaginatedData", () => {
    it("should fetch the first page of data correctly", async () => {
      const result = await fetchPaginatedData("testCollection", {
        pageSize: 5,
      });

      expect(result.data.length).toBe(5);
      expect(result.data[0].id).toBe("doc-1");
      expect(result.paginationState.currentPage).toBe(1);
      expect(result.paginationState.hasNextPage).toBe(true);
      expect(result.paginationState.hasPrevPage).toBe(false);
      expect(result.error).toBeNull();
    });

    it("should handle empty results correctly", async () => {
      // Mock getDocs to return empty results
      require("firebase/firestore").getDocs.mockImplementationOnce(
        async () => ({
          docs: [],
          empty: true,
          size: 0,
        })
      );

      const result = await fetchPaginatedData("emptyCollection");

      expect(result.data.length).toBe(0);
      expect(result.paginationState.hasNextPage).toBe(false);
      expect(result.error).toBeNull();
    });

    it("should handle cursor errors and reset pagination", async () => {
      // First create a state with an invalid cursor
      const invalidState: PaginationState = {
        currentPage: 2,
        hasNextPage: true,
        hasPrevPage: true,
        pageSize: 5,
        lastVisibleId: "non-existent",
        timestamp: Date.now(),
      };

      // Mock getDocs to throw a cursor error
      require("firebase/firestore").getDocs.mockImplementationOnce(async () => {
        throw new Error("Invalid cursor");
      });

      const result = await fetchPaginatedData(
        "testCollection",
        { pageSize: 5 },
        invalidState
      );

      expect(result.error).toBe(PAGINATION_ERRORS.INVALID_CURSOR);
      expect(result.data.length).toBe(0);
      expect(result.paginationState.currentPage).toBe(1);
    });

    it("should handle out of bounds pagination requests", async () => {
      // Create a state requesting a page beyond available data
      const outOfBoundsState: PaginationState = {
        currentPage: 10,
        hasNextPage: false,
        hasPrevPage: true,
        pageSize: 5,
        lastVisibleId: "doc-45", // Doesn't exist
        timestamp: Date.now(),
      };

      // Mock getDocs twice - first to return empty for the too-far page, then to return first page
      const getDocs = require("firebase/firestore").getDocs;
      getDocs
        .mockImplementationOnce(async () => ({
          docs: [],
          empty: true,
          size: 0,
        }))
        .mockImplementationOnce(async () => ({
          docs: Array(5)
            .fill(null)
            .map((_, i) => ({
              id: `doc-${i + 1}`,
              data: () => ({
                id: `doc-${i + 1}`,
                name: `Test Document ${i + 1}`,
                createdAt: { seconds: Date.now() / 1000 - i * 3600 },
              }),
              exists: () => true,
            })),
          empty: false,
          size: 5,
        }));

      const result = await fetchPaginatedData(
        "testCollection",
        { pageSize: 5 },
        outOfBoundsState
      );

      expect(result.error).toBe(PAGINATION_ERRORS.OUT_OF_BOUNDS);
      expect(result.data.length).toBe(5);
      expect(result.paginationState.currentPage).toBe(1);
    });

    it("should handle general errors during fetch", async () => {
      // Mock getDocs to throw a general error
      require("firebase/firestore").getDocs.mockImplementationOnce(async () => {
        throw new Error("Network error");
      });

      const result = await fetchPaginatedData("testCollection");

      expect(result.error).toBe(PAGINATION_ERRORS.GENERAL_ERROR);
      expect(result.data.length).toBe(0);
    });
  });

  describe("fetchNextPage", () => {
    it("should fetch the next page correctly", async () => {
      // First fetch page 1
      const page1 = await fetchPaginatedData("testCollection", { pageSize: 3 });

      // Then fetch page 2
      const page2 = await fetchNextPage(
        "testCollection",
        page1.paginationState,
        { pageSize: 3 }
      );

      expect(page2.data.length).toBe(3);
      expect(page2.data[0].id).toBe("doc-4");
      expect(page2.paginationState.currentPage).toBe(2);
      expect(page2.paginationState.hasPrevPage).toBe(true);
    });

    it("should not fetch next page if hasNextPage is false", async () => {
      const state: PaginationState = {
        currentPage: 1,
        hasNextPage: false,
        hasPrevPage: false,
        pageSize: 10,
        timestamp: Date.now(),
      };

      const result = await fetchNextPage("testCollection", state);

      // Should not make any Firestore calls
      expect(require("firebase/firestore").getDocs).not.toHaveBeenCalled();
      expect(result.data.length).toBe(0);
      expect(result.error).toBeNull();
    });
  });

  describe("fetchPrevPage", () => {
    it("should go back to first page when on page 2", async () => {
      // Create a state on page 2
      const state: PaginationState = {
        currentPage: 2,
        hasNextPage: true,
        hasPrevPage: true,
        pageSize: 5,
        timestamp: Date.now(),
      };

      const result = await fetchPrevPage("testCollection", state);

      expect(result.paginationState.currentPage).toBe(1);
      expect(result.paginationState.hasPrevPage).toBe(false);
    });

    it("should not fetch prev page if already on first page", async () => {
      const state: PaginationState = {
        currentPage: 1,
        hasNextPage: true,
        hasPrevPage: false,
        pageSize: 5,
        timestamp: Date.now(),
      };

      const result = await fetchPrevPage("testCollection", state);

      // Should not make any Firestore calls
      expect(result.data.length).toBe(0);
      expect(result.error).toBeNull();
      expect(result.paginationState.currentPage).toBe(1);
    });
  });
});
