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
async function closeBrowser() {
  if (_browser) { await _browser.close().catch(() => {}); _browser = null; }
}
process.on('exit', () => { if (_browser) { try { _browser.close(); } catch {} } });
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function rgbToHex(value) {
  const match = String(value || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return value;
  return `#${[match[1], match[2], match[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('')}`;
}

function researchAssetPaths(targetUrl, dataDir) {
  const hash = crypto.createHash('sha1').update(`${targetUrl}-${Date.now()}`).digest('hex').slice(0, 16);
  const dir = path.join(dataDir, 'research', 'screenshots');
  fs.mkdirSync(dir, { recursive: true });
  return {
    screenshotPath: path.join(dir, `${hash}.png`),
    screenshotUrl: `/research-assets/screenshots/${hash}.png`,
  };
}

function validateHttpUrl(targetUrl) {
  const parsed = new URL(targetUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only http/https URLs are supported');
  return parsed;
}

function scrapeURLFast(targetUrl) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = validateHttpUrl(targetUrl);
    } catch {
      return reject(new Error('Invalid URL'));
    }

    const protocol = parsed.protocol === 'https:' ? https : http;

    protocol.get(targetUrl, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return scrapeURLFast(res.headers.location).then(resolve).catch(reject);
      }
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', async () => {
        try {
          const findings = await analyseHTMLFast(raw, targetUrl);
          resolve(findings);
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

async function analyseHTMLFast(html, baseUrl) {
  const findings = {
    mode: 'fast',
    url: baseUrl,
    fonts: [],
    colors: [],
    cssVars: {},
    structureNotes: []
  };

  const fontLinks = html.match(/fonts\.googleapis\.com[^"'>]*/g) || [];
  findings.fonts = fontLinks.map(link => {
    const match = link.match(/family=([^:&]+)/);
    return match ? match[1] : null;
  }).filter(Boolean);

  const customProps = html.match(/--[\w-]+\s*:\s*[^;]+/g) || [];
  customProps.forEach(prop => {
    const [name, value] = prop.split(':').map(s => s.trim());
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
  validateHttpUrl(targetUrl);
  const { screenshotPath, screenshotUrl } = researchAssetPaths(targetUrl, dataDir);
  const browser = await getBrowser();
  let page;
  try {
    page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1 });
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const rendered = await page.evaluate(() => {
      const visible = Array.from(document.querySelectorAll('body *')).filter(el => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      }).slice(0, 160);
      const pick = (property) => [...new Set(visible.map(el => window.getComputedStyle(el)[property]).filter(Boolean))].slice(0, 30);
      const rootStyle = window.getComputedStyle(document.documentElement);
      const cssVars = {};
      for (const name of rootStyle) {
        if (name.startsWith('--')) cssVars[name] = rootStyle.getPropertyValue(name).trim();
      }
      const structureNotes = [];
      const bodyText = document.body?.innerText || '';
      if (document.querySelector('header, nav')) structureNotes.push('Rendered header/navigation present');
      if (document.querySelector('main')) structureNotes.push('Uses semantic main content area');
      if (visible.some(el => ['grid', 'inline-grid'].includes(window.getComputedStyle(el).display))) structureNotes.push('Rendered grid layout detected');
      if (visible.some(el => window.getComputedStyle(el).display.includes('flex'))) structureNotes.push('Rendered flex layout detected');
      if (visible.some(el => window.getComputedStyle(el).boxShadow !== 'none')) structureNotes.push('Rendered shadows present');
      if (visible.some(el => parseFloat(window.getComputedStyle(el).borderRadius) > 0)) structureNotes.push('Rendered rounded corners present');
      return {
        title: document.title || '',
        fonts: pick('fontFamily'),
        textColors: pick('color'),
        backgroundColors: pick('backgroundColor').filter(color => !['rgba(0, 0, 0, 0)', 'transparent'].includes(color)),
        borderColors: pick('borderColor'),
        radii: pick('borderRadius'),
        shadows: pick('boxShadow').filter(value => value !== 'none'),
        fontSizes: pick('fontSize'),
        cssVars,
        structureNotes,
        htmlStructure: Array.from(document.body?.children || []).slice(0, 16).map(el => el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (el.className ? `.${String(el.className).trim().split(/\s+/).slice(0, 3).join('.')}` : '')),
        textSample: bodyText.slice(0, 500),
      };
    });

    const colors = [...new Set([
      ...rendered.textColors,
      ...rendered.backgroundColors,
      ...rendered.borderColors,
      ...Object.values(rendered.cssVars).filter(value => /^#|rgb|hsl/i.test(value)),
    ].map(rgbToHex))].slice(0, 32);

    return {
      mode: 'deep',
      url: targetUrl,
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
    if (findings.computedStyles?.radii?.length) summary.push(`\n**Rendered Radii:** ${findings.computedStyles.radii.slice(0, 8).join(', ')}`);
    if (findings.computedStyles?.shadows?.length) summary.push(`\n**Rendered Shadows:** ${findings.computedStyles.shadows.slice(0, 4).join(' | ')}`);
    if (findings.htmlStructure?.length) summary.push(`\n**Rendered Structure:** ${findings.htmlStructure.join(' → ')}`);
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
