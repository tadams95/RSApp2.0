import { margin, padding } from "../../utils/spacing";

describe("Spacing utilities", () => {
  describe("margin", () => {
    it("should return correct horizontal margin", () => {
      expect(margin.horizontal(10)).toEqual({ marginHorizontal: 10 });
    });

    it("should return correct vertical margin", () => {
      expect(margin.vertical(15)).toEqual({ marginVertical: 15 });
    });
  });

  describe("padding", () => {
    it("should return correct horizontal padding", () => {
      expect(padding.horizontal(20)).toEqual({ paddingHorizontal: 20 });
    });

    it("should return correct vertical padding", () => {
      expect(padding.vertical(25)).toEqual({ paddingVertical: 25 });
    });
  });
});
