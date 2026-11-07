import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sitemapXml, publicPaths } from "./src/siteNav.js";

function publicSeoPlugin() {
  return {
    name: "trooth-public-seo",
    async configureServer(server) {
      const { SPEAKERS, FORECASTS } = await import("./src/data.js");
      const xml = sitemapXml(publicPaths({
        speakerIds: SPEAKERS.map((s) => s.id),
        forecastIds: FORECASTS.map((f) => f.id),
      }));
      server.middlewares.use((req, res, next) => {
        const path = (req.url || "").split("?")[0];
        if (path !== "/sitemap.xml") return next();
        res.setHeader("content-type", "application/xml; charset=utf-8");
        res.end(xml);
      });
    },
    async generateBundle() {
      const { SPEAKERS, FORECASTS } = await import("./src/data.js");
      const xml = sitemapXml(publicPaths({
        speakerIds: SPEAKERS.map((s) => s.id),
        forecastIds: FORECASTS.map((f) => f.id),
      }));
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: xml });
    },
  };
}

export default defineConfig({
  plugins: [react(), publicSeoPlugin()],
  build: { outDir: "dist" },
});
