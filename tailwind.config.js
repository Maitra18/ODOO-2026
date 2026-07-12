/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          500: "#2f5fdb",
          600: "#254bb0",
          700: "#1c3a8a",
          900: "#101f4a",
        },
      },
    },
  },
  plugins: [],
}
