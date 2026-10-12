/** Strip the framework bootstrapping from the read-only design review, not business pages. */
export function stripPreviewRuntime(html, css) {
  const document = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<link\b[^>]*>/gi, tag => /rel="(?:stylesheet|modulepreload|preload)"/.test(tag) ? "" : tag);
  return document.replace("</head>", `<style>${css.replace(/<\/style/gi, "<\\/style")}</style></head>`);
}
