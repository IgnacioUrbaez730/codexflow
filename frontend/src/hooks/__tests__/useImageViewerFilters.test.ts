import { buildCSSFilterString, ImageFilterState, initialFilterState } from "../useImageViewerFilters";

describe("useImageViewerFilters & buildCSSFilterString", () => {
  it("generates correct filter string for default values", () => {
    const filters: ImageFilterState = { ...initialFilterState };
    const result = buildCSSFilterString(filters);
    expect(result).toBe("brightness(100%) contrast(100%)");
  });

  it("calculates contrast boost when sharpness is applied", () => {
    const filters: ImageFilterState = {
      ...initialFilterState,
      brightness: 120,
      contrast: 150,
      sharpness: 50,
    };
    // effectiveContrast = 150 * (1 + 50 / 200) = 150 * 1.25 = 187.5%
    const result = buildCSSFilterString(filters);
    expect(result).toBe("brightness(120%) contrast(187.5%)");
  });

  it("adds grayscale and invert filters when toggled", () => {
    const filters: ImageFilterState = {
      ...initialFilterState,
      grayscale: true,
      invert: true,
    };
    const result = buildCSSFilterString(filters);
    expect(result).toBe("brightness(100%) contrast(100%) grayscale(100%) invert(100%)");
  });

  it("generates high contrast binarized preset", () => {
    const filters: ImageFilterState = {
      ...initialFilterState,
      binarized: true,
      brightness: 100,
    };
    const result = buildCSSFilterString(filters);
    expect(result).toBe("contrast(200%) grayscale(100%) brightness(110%)");
  });

  it("applies invert on top of binarized mode", () => {
    const filters: ImageFilterState = {
      ...initialFilterState,
      binarized: true,
      brightness: 100,
      invert: true,
    };
    const result = buildCSSFilterString(filters);
    expect(result).toBe("contrast(200%) grayscale(100%) brightness(110%) invert(100%)");
  });
});
