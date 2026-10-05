// Test helper: bundle one component (and its real imports) with esbuild and render it to static HTML.
// Hover.jsx is stubbed as a plain element; Vite's import.meta.glob in loadChangelog.js is replaced by
// static imports of the shipped day files, so tests render exactly what the site ships.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(SRC, "../node_modules/.cache/render-tests");

const stubs = {
  name: "render-stubs",
  setup(build) {
    build.onResolve({ filter: /\/Hover\.jsx$/ }, () => ({ path: "hover", namespace: "stub" }));
    build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
      contents:
        'import React from "react"; export default function Hover({ as = "div", style, hover, children, ...rest }) { return React.createElement(as, rest, children); }',
      loader: "js",
      resolveDir: SRC,
    }));
    // Vite "?raw" imports (e.g. the /method copy) load the file as a string, as on the site.
    build.onResolve({ filter: /\?raw$/ }, (args) => ({ path: join(args.resolveDir, args.path.replace(/\?raw$/, "")), namespace: "raw" }));
    build.onLoad({ filter: /.*/, namespace: "raw" }, (args) => ({ contents: `export default ${JSON.stringify(readFileSync(args.path, "utf8"))};`, loader: "js" }));
    build.onLoad({ filter: /loadChangelog\.js$/ }, (args) => {
      const dir = join(dirname(args.path), "changelog");
      const files = readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
      const imports = files.map((f, i) => `import __day${i} from "./changelog/${f}";`).join("\n");
      const glob = "{" + files.map((f, i) => `"./changelog/${f}": { default: __day${i} }`).join(",") + "}";
      const src = readFileSync(args.path, "utf8").replace(/import\.meta\.glob\([^)]*\)/, glob);
      return { contents: imports + "\n" + src, loader: "js", resolveDir: dirname(args.path) };
    });
  },
};

let seq = 0;
/** Import a component module (path relative to src/) with its dependencies bundled. */
export async function loadComponent(rel) {
  const { build } = await import("esbuild");
  const res = await build({
    entryPoints: [join(SRC, rel)],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    jsx: "automatic",
    external: ["react", "react-dom", "react/jsx-runtime", "react-dom/server"],
    plugins: [stubs],
    logLevel: "silent",
  });
  mkdirSync(OUT, { recursive: true });
  const file = join(OUT, `${rel.replace(/[^\w]/g, "_")}-${process.pid}-${seq++}.mjs`);
  writeFileSync(file, res.outputFiles[0].text);
  return import(pathToFileURL(file).href);
}

export async function renderHtml(Component, props) {
  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  return renderToStaticMarkup(React.createElement(Component, props));
}
