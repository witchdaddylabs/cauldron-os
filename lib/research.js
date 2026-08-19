/**
 * research.js
 *
 * Consolidated URL research module for Cauldron OS (Phase 1).
 *
 * Provides both "fast" (lightweight HTTP + regex) and "deep" (Playwright rendered analysis + screenshot) modes.
 * Removes the previous duplication that existed in server.js after the unification merge.
 */

const { chromium } = require('playwright');

// ─── Shared browser singleton — reused across deep-research requests ────────
let _browser = null;
async function getBrowser() {
  if (_browser && _browser.isConnected()) return _browser;
  _browser = await chromium.launch({ headless: true });
  return _browser;
}
process.on('exit', () => {
  if (_browser) {
    try {
      _browser.close();
    } catch {}
  }
});
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const net = require('net');
const {
  validateHttpUrl,
  resolveRedirectUrl,
  assertSafeResearchUrl,
  createPinnedLookup,
} = require('./url-safety');

const MAX_RESEARCH_REDIRECTS = 5;
const MAX_RESEARCH_BODY_BYTES = 2 * 1024 * 1024;
const RESEARCH_TIMEOUT_MS = 30000;
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function researchHttpOptions(target, extra = {}) {
  const parsed = target.parsed;
  const defaultPort = parsed.protocol === 'https:' ? 443 : 80;
  const headers = { ...(extra.headers || {}) };
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === 'host' || key.toLowerCase() === 'accept-encoding') {
      delete headers[key];
    }
  }
  const options = {
    protocol: parsed.protocol,
    hostname: target.hostname,
    port: parsed.port ? Number(parsed.port) : defaultPort,
    path: `${parsed.pathname}${parsed.search}`,
    method: extra.method || 'GET',
    headers,
    lookup: createPinnedLookup(target.address, target.family),
  };
  if (parsed.protocol === 'https:' && !net.isIP(target.hostname)) {
    options.servername = target.hostname;
  }
  return options;
}

function flattenResponseHeaders(headers = {}) {
  const out = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value == null || HOP_BY_HOP_HEADERS.has(key.toLowerCase())) continue;
    out[key] = Array.isArray(value) ? value.join(', ') : String(value);
  }
  return out;
}

function fetchPinned(target, extra = {}) {
  const protocol = target.parsed.protocol === 'https:' ? https : http;
  const options = researchHttpOptions(target, extra);
  return new Promise((resolve, reject) => {
    const request = protocol.request(options, (res) => {
      const chunks = [];
      let bytes = 0;
      res.on('data', (chunk) => {
        bytes += chunk.length;
        if (bytes > MAX_RESEARCH_BODY_BYTES) {
          request.destroy();
          return reject(new Error('Research response exceeded size limit'));
        }
        chunks.push(chunk);
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks),
        });
      });
    });
    request.setTimeout(RESEARCH_TIMEOUT_MS, () => {
      request.destroy();
      reject(new Error('Research request timed out'));
    });
    request.on('error', reject);
    if (extra.body) request.write(extra.body);
    request.end();
  });
}

async function scrapeURLFast(targetUrl, redirectCount = 0) {
  if (redirectCount > MAX_RESEARCH_REDIRECTS) {
    throw new Error('Too many redirects');
  }

  const target = await assertSafeResearchUrl(targetUrl);
  const response = await fetchPinned(target);
  if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
    const nextUrl = resolveRedirectUrl(target.parsed.href, response.headers.location);
    return scrapeURLFast(nextUrl, redirectCount + 1);
  }

  return analyseHTMLFast(response.body.toString('utf8'), target.parsed.href);
}

function rgbToHex(value) {
  const match = String(value || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return value;
  return `#${[match[1], match[2], match[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
}

function researchAssetPaths(targetUrl, dataDir) {
  const hash = crypto
    .createHash('sha1')
    .update(`${targetUrl}-${Date.now()}`)
    .digest('hex')
    .slice(0, 16);
  const dir = path.join(dataDir, 'research', 'screenshots');
  fs.mkdirSync(dir, { recursive: true });
  return {
    screenshotPath: path.join(dir, `${hash}.png`),
    screenshotUrl: `/research-assets/screenshots/${hash}.png`,
  };
}

async function analyseHTMLFast(html, baseUrl) {
  const findings = {
    mode: 'fast',
    url: baseUrl,
    fonts: [],
    colors: [],
    cssVars: {},
    structureNotes: [],
  };

  const fontLinks = html.match(/fonts\.googleapis\.com[^"'>]*/g) || [];
  findings.fonts = fontLinks
    .map((link) => {
      const match = link.match(/family=([^:&]+)/);
      return match ? match[1] : null;
    })
    .filter(Boolean);

  const customProps = html.match(/--[\w-]+\s*:\s*[^;]+/g) || [];
  customProps.forEach((prop) => {
    const [name, value] = prop.split(':').map((s) => s.trim());
    if (name && value) findings.cssVars[name] = value;
  });

  const colors = html.match(/#[0-9A-Fa-f]{3,6}|rgb\([^)]+\)|hsl\([^)]+\)/g) || [];
  findings.colors = [...new Set(colors)].slice(0, 20);

  if (html.includes('class="container"') || html.includes('class="wrapper"')) {
    findings.structureNotes.push('Uses container/wrapper layout');
  }
  if (html.includes('flex') || html.includes('grid')) {
    findings.structureNotes.push('Uses modern CSS layout (flex/grid)');
  }
  if (html.includes('border-radius')) {
    findings.structureNotes.push('Rounded corners present');
  }
  if (html.includes('box-shadow')) {
    findings.structureNotes.push('Applies drop shadows');
  }

  return findings;
}

async function scrapeRenderedURL(targetUrl, dataDir) {
  const target = await assertSafeResearchUrl(targetUrl);
  const { screenshotPath, screenshotUrl } = researchAssetPaths(target.parsed.href, dataDir);
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
    deviceScaleFactor: 1,
  });
  let page;
  try {
    page = await context.newPage();
    await page.route('**/*', async (route) => {
      const requestUrl = route.request().url();
      if (/^(data|blob|about):/i.test(requestUrl)) return route.continue();
      try {
        const reqTarget = await assertSafeResearchUrl(requestUrl);
        const request = route.request();
        const response = await fetchPinned(reqTarget, {
          method: request.method(),
          headers: request.headers(),
          body: request.postDataBuffer() || undefined,
        });
        return route.fulfill({
          status: response.statusCode,
          headers: flattenResponseHeaders(response.headers),
          body: response.body,
        });
      } catch {
        return route.abort('blockedbyclient');
      }
    });
    await page.goto(target.parsed.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const rendered = await page.evaluate(() => {
      const visible = Array.from(document.querySelectorAll('body *'))
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none'
          );
        })
        .slice(0, 160);
      const pick = (property) =>
        [
          ...new Set(visible.map((el) => window.getComputedStyle(el)[property]).filter(Boolean)),
        ].slice(0, 30);
      const rootStyle = window.getComputedStyle(document.documentElement);
      const cssVars = {};
      for (const name of rootStyle) {
        if (name.startsWith('--')) cssVars[name] = rootStyle.getPropertyValue(name).trim();
      }
      const structureNotes = [];
      const bodyText = document.body?.innerText || '';
      if (document.querySelector('header, nav'))
        structureNotes.push('Rendered header/navigation present');
      if (document.querySelector('main')) structureNotes.push('Uses semantic main content area');
      if (
        visible.some((el) => ['grid', 'inline-grid'].includes(window.getComputedStyle(el).display))
      )
        structureNotes.push('Rendered grid layout detected');
      if (visible.some((el) => window.getComputedStyle(el).display.includes('flex')))
        structureNotes.push('Rendered flex layout detected');
      if (visible.some((el) => window.getComputedStyle(el).boxShadow !== 'none'))
        structureNotes.push('Rendered shadows present');
      if (visible.some((el) => parseFloat(window.getComputedStyle(el).borderRadius) > 0))
        structureNotes.push('Rendered rounded corners present');
      return {
        title: document.title || '',
        fonts: pick('fontFamily'),
        textColors: pick('color'),
        backgroundColors: pick('backgroundColor').filter(
          (color) => !['rgba(0, 0, 0, 0)', 'transparent'].includes(color)
        ),
        borderColors: pick('borderColor'),
        radii: pick('borderRadius'),
        shadows: pick('boxShadow').filter((value) => value !== 'none'),
        fontSizes: pick('fontSize'),
        cssVars,
        structureNotes,
        htmlStructure: Array.from(document.body?.children || [])
          .slice(0, 16)
          .map(
            (el) =>
              el.tagName.toLowerCase() +
              (el.id ? `#${el.id}` : '') +
              (el.className
                ? `.${String(el.className).trim().split(/\s+/).slice(0, 3).join('.')}`
                : '')
          ),
        textSample: bodyText.slice(0, 500),
      };
    });

    const colors = [
      ...new Set(
        [
          ...rendered.textColors,
          ...rendered.backgroundColors,
          ...rendered.borderColors,
          ...Object.values(rendered.cssVars).filter((value) => /^#|rgb|hsl/i.test(value)),
        ].map(rgbToHex)
      ),
    ].slice(0, 32);

    return {
      mode: 'deep',
      url: target.parsed.href,
      title: rendered.title,
      fonts: rendered.fonts,
      colors,
      cssVars: rendered.cssVars,
      structureNotes: rendered.structureNotes,
      htmlStructure: rendered.htmlStructure,
      textSample: rendered.textSample,
      screenshotPath,
      screenshotUrl,
      viewport: { width: 1440, height: 1200 },
      computedStyles: {
        fonts: rendered.fonts,
        colors,
        radii: rendered.radii,
        shadows: rendered.shadows,
        fontSizes: rendered.fontSizes,
      },
    };
  } finally {
    if (page) await page.close().catch(() => {});
    await context.close().catch(() => {});
  }
}

function formatResearchForPrompt(findings) {
  if (!findings) return '';

  const summary = [];
  summary.push(`## Research Findings from ${findings.url}`);

  if (findings.fonts && findings.fonts.length) {
    summary.push(`\n**Typography:** ${findings.fonts.join(', ')}`);
  }

  if (findings.cssVars && Object.keys(findings.cssVars).length) {
    summary.push('\n**CSS Variables:**');
    Object.entries(findings.cssVars).forEach(([k, v]) => {
      summary.push(`  - ${k}: ${v}`);
    });
  }

  if (findings.colors && findings.colors.length) {
    summary.push(`\n**Color Palette:** ${findings.colors.join(', ')}`);
  }

  if (findings.structureNotes && findings.structureNotes.length) {
    summary.push(`\n**Layout Patterns:** ${findings.structureNotes.join('; ')}`);
  }

  if (findings.mode === 'deep') {
    if (findings.screenshotUrl) summary.push(`\n**Screenshot:** ${findings.screenshotUrl}`);
    if (findings.computedStyles?.radii?.length)
      summary.push(`\n**Rendered Radii:** ${findings.computedStyles.radii.slice(0, 8).join(', ')}`);
    if (findings.computedStyles?.shadows?.length)
      summary.push(
        `\n**Rendered Shadows:** ${findings.computedStyles.shadows.slice(0, 4).join(' | ')}`
      );
    if (findings.htmlStructure?.length)
      summary.push(`\n**Rendered Structure:** ${findings.htmlStructure.join(' → ')}`);
  }

  return summary.join('\n');
}

module.exports = {
  rgbToHex,
  researchAssetPaths,
  validateHttpUrl,
  scrapeURLFast,
  analyseHTMLFast,
  scrapeRenderedURL,
  formatResearchForPrompt,
};
