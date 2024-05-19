/**
 * Convert hex color to rgba
 * @param hex The hex color code (example: #000000)
 * @param opacity The opacity of the color (example: 0.5)
 * @returns The rgba color code (example: rgba(0, 0, 0, 0.5))
 */
export const convertHexToRGBA = (hex: string, opacity?: number) => {
    const hexWithoutHash = hex.replace('#', '');
    const r = parseInt(hexWithoutHash.substring(0, 2), 16);
    const g = parseInt(hexWithoutHash.substring(2, 4), 16);
    const b = parseInt(hexWithoutHash.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity ?? 1})`;
};

/**
 * Convert rgba color to hex
 * @param rgba The rgba color code (example: rgba(0, 0, 0, 0.5))
 * @returns The hex color code (example: #000000)
 */
export const convertRGBAToHex = (rgba: string): string => {
    const [r, g, b] = rgba.match(/\d+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
    const toHex = (value: number) => value.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};


/**
 * Helper function to blend two hex colors
 * @param color1 The first hex color code (example: #ff0000)
 * @param color2 The second hex color code (example: #0000ff)
 * @returns The blended hex color code
 */
export const blendHexColors = (color1: string | undefined, color2: string | undefined): string | undefined => {
    if (!color1 || !color2) {
        return undefined;
    }
    const rgba1 = convertHexToRGBA(color1);
    const rgba2 = convertHexToRGBA(color2);
  
    const [r1, g1, b1] = rgba1.match(/\d+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
    const [r2, g2, b2] = rgba2.match(/\d+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
  
    const blendedColor = {
      r: Math.round((r1 + r2) / 2),
      g: Math.round((g1 + g2) / 2),
      b: Math.round((b1 + b2) / 2),
    };
  
    return convertRGBAToHex(`rgba(${blendedColor.r}, ${blendedColor.g}, ${blendedColor.b}, 1)`);
};
  