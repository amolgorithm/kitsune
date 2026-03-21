// Import logo so Vite handles the path correctly in dev + prod builds
// Place your logo.png in src/renderer/assets/logo.png
// (copy from root assets/logo.png)
const logo = new URL('./logo.png', import.meta.url).href
export default logo
