// app-ui/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  // --- ADD THIS LINE ---
  darkMode: 'media',
  // ---

  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../features/**/*.{js,ts,jsx,tsx}", // Ensure these paths are correct
    "../shared/ui/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}", // Add components dir if used directly
    "./src/pages/**/*.{js,ts,jsx,tsx}", // Add pages dir
    "./src/lib/**/*.{js,ts,jsx,tsx}", // Add lib dir
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}