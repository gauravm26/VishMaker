// app-ui/vite.config.ts
import { defineConfig } from 'vite';
// --- CHANGE THIS IMPORT ---
// import react from '@vitejs/plugin-react' // Remove or comment out this line
import react from '@vitejs/plugin-react-swc'; // <-- Use this import instead
// --- END CHANGE ---
import tsconfigPaths from 'vite-tsconfig-paths';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(), // This instance now comes from plugin-react-swc
        tsconfigPaths()
    ],
});
