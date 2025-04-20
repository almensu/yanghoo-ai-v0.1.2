/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./pages/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',    // 主色调: 蓝色系
        accent: '#8b5cf6',     // 强调色: 紫色系
        neutral: '#e5e7eb',    // 中性色: 灰色系
        'base-text': '#1f2937', // 文本色: 深灰
        'base-bg': '#f9fafb',  // 背景色: 浅灰
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        light: {
          "primary": "#3b82f6",
          "secondary": "#8b5cf6",
          "accent": "#0ea5e9",
          "neutral": "#e5e7eb",
          "base-100": "#f9fafb",
          "info": "#93c5fd",
          "success": "#10b981",
          "warning": "#f59e0b",
          "error": "#ef4444",
        },
        dark: {
          "primary": "#3b82f6",
          "secondary": "#8b5cf6",
          "accent": "#0ea5e9",
          "neutral": "#374151",
          "base-100": "#1f2937",
          "info": "#2563eb",
          "success": "#10b981",
          "warning": "#f59e0b",
          "error": "#ef4444",
        },
      },
    ],
  },
} 