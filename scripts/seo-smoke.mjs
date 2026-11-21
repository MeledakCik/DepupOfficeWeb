import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = new URL(process.env.BASE_URL ?? "http://127.0.0.1:3000");
const origin = process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : undefined;
const browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL ?? "chrome" });
const page = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });
const local = (path) => new URL(path, base).href;
const meta = (key, value) => page.locator(`meta[${key}="${value}"]`).getAttribute("content");
const text = (selector) => page.locator(selector).textContent();

try {
  const sitemap = await page.request.get(local("/sitemap.xml"));
  assert.ok(sitemap.ok());
  assert.match(sitemap.headers()["content-type"], /xml/);
  const xml = await sitemap.text();
  const robots = await page.request.get(local("/robots.txt"));
  assert.ok(robots.ok());
  assert.match(await robots.text(), /Allow: \//);
  assert.equal((await page.request.get(local("/fitur/tidak-ada/"))).status(), 404);

  if (origin) {
    assert.ok((await robots.text()).includes(`Sitemap: ${origin}/sitemap.xml`));
    const entries = new Map(Array.from(xml.matchAll(/<url>([\s\S]*?)<\/url>/g), ([, content]) => {
      const [, address] = content.match(/<loc>(.*?)<\/loc>/);
      return [address, content];
    }));
    assert.ok(entries.size >= 14);
    assert.equal(entries.size % 2, 0);
    assert.ok(entries.has(`${origin}/`) && entries.has(`${origin}/en/`));
    assert.ok(!entries.has(`${origin}/office/`));
    const titles = new Set();
    const descriptions = new Set();

    for (const [address, entry] of entries) {
      const { pathname } = new URL(address);
      const response = await page.goto(local(pathname));
      assert.ok(response.ok(), pathname);
      const english = pathname.startsWith("/en/");
      assert.equal(await page.locator("html").getAttribute("lang"), english ? "en" : "id");
      assert.equal(await page.getByRole("heading", { level: 1 }).count(), 1);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), pathname);
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), address);
      assert.match(await meta("name", "robots"), /\bindex,\s*follow/);
      assert.equal(await meta("property", "og:url"), address);
      assert.equal(await meta("property", "og:locale"), english ? "en_US" : "id_ID");
      const title = await page.title();
      const description = await meta("name", "description");
      assert.ok(title && !titles.has(title), pathname);
      assert.ok(description && !descriptions.has(description), pathname);
      titles.add(title);
      descriptions.add(description);

      const alternates = {};
      for (const language of ["id-ID", "en", "x-default"]) {
        const href = await page.locator(`link[rel="alternate"][hreflang="${language}"]`).getAttribute("href");
        assert.ok(entries.has(href), pathname);
        assert.ok(entry.includes(`hreflang="${language}"`) && entry.includes(`href="${href}"`), pathname);
        alternates[language] = href;
      }
      assert.equal(alternates[english ? "en" : "id-ID"], address);
      assert.equal(alternates["x-default"], alternates.en);
      const alternatePage = alternates[english ? "id-ID" : "en"];
      assert.ok(entries.get(alternatePage).includes(`href="${address}"`), pathname);
      assert.equal(await page.locator(`header a[hreflang="${english ? "id" : "en"}"]`).getAttribute("href"), new URL(alternatePage).pathname);

      const schema = JSON.parse(await text('script[type="application/ld+json"]'));
      if (pathname === "/" || pathname === "/en/") {
        assert.ok(schema["@graph"].some((item) => item["@type"] === "WebApplication"));
        if (!english) assert.ok(schema["@graph"].some((item) => item["@type"] === "WebSite"));
        const image = new URL(await meta("property", "og:image"));
        assert.equal(image.origin, origin);
        const asset = await page.request.get(local(image.pathname));
        assert.ok(asset.ok());
        assert.match(asset.headers()["content-type"], /^image\/jpeg/);
      } else {
        assert.equal(schema["@type"], "BreadcrumbList");
        assert.equal(schema.itemListElement[1].item, address);
        assert.ok(await page.locator('article a[href^="/office/#"]').count());
      }
    }
    console.log(`SEO lulus untuk ${entries.size} URL Indonesia dan Inggris tanpa JavaScript.`);
  } else {
    assert.doesNotMatch(xml, /<loc>/);
    assert.doesNotMatch(await robots.text(), /^Sitemap:/m);
    for (const path of ["/", "/en/", "/fitur/gabung-pdf/", "/en/tools/merge-pdf/"]) {
      await page.goto(local(path));
      assert.match(await meta("name", "robots"), /noindex/);
      assert.equal(await page.locator('link[rel="canonical"]').count(), 0);
    }
    console.log("Build pratinjau tidak menyatakan URL kanonis dan memakai noindex.");
  }

  await page.goto(local("/office/"));
  assert.match(await meta("name", "robots"), /noindex/);
} finally {
  await browser.close();
}
