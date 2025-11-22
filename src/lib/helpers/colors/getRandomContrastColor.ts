import { ColorHexadecimal } from "@/interfaces/Colors";

/**
 * Generates a random color with high contrast relative to the base color
 * @param baseColor - Base color in hexadecimal format
 * @param contrastRatio - Minimum desired contrast ratio (default 4.5, WCAG AA standard)
 * @returns A hexadecimal color with high contrast
 */
export function getRandomContrastColor(
  baseColor: ColorHexadecimal,
  contrastRatio: number = 4.5
): ColorHexadecimal {
  // Convert hex to RGB
  const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    const cleanHex = hex.replace("#", "");
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 2), 16) || r;
    const b = parseInt(cleanHex.substring(4, 2), 16) || r;
    return { r, g, b };
  };

  // Convert RGB to linear values (for luminance calculation)
  const toLinear = (channel: number): number => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  // Calculate luminance according to WCAG
  const getLuminance = (color: string): number => {
    const rgb = hexToRgb(color);
    const r = toLinear(rgb.r);
    const g = toLinear(rgb.g);
    const b = toLinear(rgb.b);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  // Calculate contrast ratio between two colors
  const calculateContrastRatio = (color1: string, color2: string): number => {
    const lum1 = getLuminance(color1);
    const lum2 = getLuminance(color2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
  };

  // Generate a random RGB color
  const getRandomColor = (): string => {
    const randomChannel = () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, "0");
    return `#${randomChannel()}${randomChannel()}${randomChannel()}`;
  };

  // Base color luminance
  const baseLuminance = getLuminance(baseColor);

  // Determine if we need a lighter or darker color
  const needsDarker = baseLuminance > 0.5;

  // Try to find a color with the right contrast
  let attempts = 0;
  let candidateColor: string = "";
  let currentContrast = 0;

  // Generate up to 50 random attempts
  while (attempts < 50 && currentContrast < contrastRatio) {
    candidateColor = getRandomColor();

    // If we need a darker color and the candidate is lighter (or vice versa),
    // we adjust the candidate
    const candidateLuminance = getLuminance(candidateColor);

    if (
      (needsDarker && candidateLuminance > baseLuminance) ||
      (!needsDarker && candidateLuminance < baseLuminance)
    ) {
      const rgb = hexToRgb(candidateColor);
      // Invert the color to ensure it goes in the right direction
      const invertedR = Math.abs(255 - rgb.r);
      const invertedG = Math.abs(255 - rgb.g);
      const invertedB = Math.abs(255 - rgb.b);

      candidateColor = `#${invertedR.toString(16).padStart(2, "0")}${invertedG
        .toString(16)
        .padStart(2, "0")}${invertedB.toString(16).padStart(2, "0")}`;
    }

    currentContrast = calculateContrastRatio(baseColor, candidateColor);
    attempts++;
  }

  // If we don't find a color with enough contrast, generate a guaranteed one
  if (currentContrast < contrastRatio) {
    // Generate a color at the opposite end of the luminance spectrum
    if (needsDarker) {
      // If the base is light, generate a dark one
      const darkness = Math.floor(Math.random() * 64); // 0-63 to make it really dark
      const r = darkness.toString(16).padStart(2, "0");
      const g = darkness.toString(16).padStart(2, "0");
      const b = darkness.toString(16).padStart(2, "0");
      candidateColor = `#${r}${g}${b}`;
    } else {
      // If the base is dark, generate a light one
      const lightness = 192 + Math.floor(Math.random() * 64); // 192-255 to make it really light
      const r = lightness.toString(16).padStart(2, "0");
      const g = lightness.toString(16).padStart(2, "0");
      const b = lightness.toString(16).padStart(2, "0");
      candidateColor = `#${r}${g}${b}`;
    }
  }

  return candidateColor as ColorHexadecimal;
}

/**
 * Generates multiple random contrast colors
 * @param baseColor - Base color
 * @param count - Number of colors to generate
 * @param contrastRatio - Minimum contrast ratio
 * @returns Array of hexadecimal colors with high contrast
 */
export function getMultipleContrastColors(
  baseColor: ColorHexadecimal,
  count: number = 5,
  contrastRatio: number = 4.5
): ColorHexadecimal[] {
  const colors: ColorHexadecimal[] = [];

  for (let i = 0; i < count; i++) {
    colors.push(getRandomContrastColor(baseColor, contrastRatio));
  }

  return colors;
}
