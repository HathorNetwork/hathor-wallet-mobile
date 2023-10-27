/**
 * Represents an HSL color with properties for hue, saturation, and lightness.
 *
 * @class HslColor
 * @example
 * const baseColor = new HslColor('hsl(120, 50%, 60%)');
 * const lighterColor = baseColor.addLightness(70);
 * const desaturatedColor = baseColor.addSaturation(20);
 *
 * console.log(baseColor.toString());          // 'hsl(120, 50%, 60%)'
 * console.log(lighterColor.toString());       // 'hsl(120, 50%, 70%)'
 * console.log(desaturatedColor.toString());   // 'hsl(120, 70%, 60%)'
 */
export class HslColor {
  /**
   * Initialize an HSL color instance.
   * @param {string} hslString - A valid HSL color string (e.g., 'hsl(120, 50%, 60%)').
   */
  constructor(hslString) {
    /**
     * The original HSL color string provided during initialization.
     * @type {string}
     */
    this.originalHsl = hslString;
    const [h, s, l] = hslString.match(/\d+/g).map(Number);

    /**
     * The hue component of the HSL color.
     * @type {number}
     */
    this.hue = h;

    /**
     * The saturation component of the HSL color (0-100).
     * @type {number}
     */
    this.saturation = s;

    /**
     * The lightness component of the HSL color (0-100).
     * @type {number}
     */
    this.lightness = l;
  }

  /**
   * Create a new HslColor instance with the saturation modified.
   * @param {number} increment - The amount by which to increment the saturation value.
   * @returns {HslColor} - A new HslColor instance with the modified saturation.
   */
  addSaturation(increment) {
    const newSaturation = Math.min(100, Math.max(0, this.saturation + increment));
    return new HslColor(`hsl(${this.hue}, ${newSaturation}%, ${this.lightness}%)`);
  }

  /**
   * Create a new HslColor instance with the lighness modified.
   * @param {number} increment - The amount by which to increment the lighness value.
   * @returns {HslColor} - A new HslColor instance with the modified lighness.
   */
  addLightness(increment) {
    const newLightness = Math.min(100, Math.max(0, this.lightness + increment));
    return new HslColor(`hsl(${this.hue}, ${this.saturation}%, ${newLightness}%)`);
  }

  /**
   * Get a string representation of the HSL color.
   * @returns {string} - A valid HSL color string.
   */
  toString() {
    return this.originalHsl;
  }
}
