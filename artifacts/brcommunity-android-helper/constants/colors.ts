/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#f5f7fb',
    tint: '#5eead4',
    background: '#08111f',
    foreground: '#f5f7fb',
    card: '#101d2f',
    cardForeground: '#f5f7fb',
    primary: '#5eead4',
    primaryForeground: '#ffffff',
    secondary: '#17283c',
    secondaryForeground: '#d9e3f1',
    muted: '#142238',
    mutedForeground: '#8ea2b8',
    accent: '#ef9d53',
    accentForeground: '#24160c',
    destructive: '#f06d7a',
    destructiveForeground: '#ffffff',
    border: '#233a54',
    input: '#203752',
  },
  dark: {
    text: '#f5f7fb',
    tint: '#5eead4',
    background: '#08111f',
    foreground: '#f5f7fb',
    card: '#101d2f',
    cardForeground: '#f5f7fb',
    primary: '#5eead4',
    primaryForeground: '#07151b',
    secondary: '#17283c',
    secondaryForeground: '#d9e3f1',
    muted: '#142238',
    mutedForeground: '#8ea2b8',
    accent: '#ef9d53',
    accentForeground: '#24160c',
    destructive: '#f06d7a',
    destructiveForeground: '#ffffff',
    border: '#233a54',
    input: '#203752',
  },
  radius: 16,
};

export default colors;
