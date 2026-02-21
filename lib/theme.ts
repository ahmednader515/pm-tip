/**
 * Theme Configuration
 * 
 * Centralized theme colors for the application.
 * Change the brand color here to update the entire website theme.
 */

export const theme = {
  // Main brand color - change this to update the entire theme
  brand: "#1581BF",
  
  // Brand color variations (automatically generated from brand color)
  brandLight: "#1581BF", // Lighter variant (can be adjusted)
  brandDark: "#1581BF",  // Darker variant (can be adjusted)
  
  // Legacy green colors (for reference, will be replaced)
  // green: "#10B981",
  // greenAlt: "#27c08d",
} as const;

// Helper function to get brand color with opacity
export const getBrandColor = (opacity: number = 1) => {
  if (opacity === 1) return theme.brand;
  // Convert hex to rgba
  const hex = theme.brand.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// Export for use in Tailwind config
export default theme;

