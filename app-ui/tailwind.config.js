/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // Main src dir
    "../features/**/*.{js,ts,jsx,tsx}", // Include features UI
    "../shared/ui/**/*.{js,ts,jsx,tsx}", // Include shared UI
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
