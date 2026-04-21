import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

const isProduction = process.env.NODE_ENV === "production";

export default defineConfig({
  plugins: [pluginReact()],
  html: {
    template: "./public/index.html",
  },
  entry: {
    index: "./src/index.jsx",
  },
  output: {
    filename: "[name].bundle.js",
    distPath: {
      root: "build",
    },
    sourceMap: {
      js: isProduction ? "source-map" : "eval-source-map",
    },
  },
  devtool: isProduction ? "source-map" : "eval-source-map",
  source: {
    tsconfigPath: "./jsconfig.json",
  },
  server: {
    port: 3002,
    proxy: {
      "/api": "http://localhost:3000",
      "/uploads": "http://localhost:3000",
    },
  },
});
