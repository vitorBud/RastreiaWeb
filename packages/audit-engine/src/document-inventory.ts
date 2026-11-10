import { chromium } from 'playwright';

export interface DocumentLink {
  element: string;
  targetUrl: string;
  text: string;
}

export interface DocumentImage {
  alt: string | null;
  element: string;
  targetUrl: string;
}

export interface DocumentResource {
  element: string;
  kind: 'script' | 'stylesheet';
  targetUrl: string;
}

export interface DocumentInventory {
  images: DocumentImage[];
  links: DocumentLink[];
  resources: DocumentResource[];
  title: string;
}

function uniqueByTarget<T extends { targetUrl: string }>(items: T[]): T[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.targetUrl)) {
      return false;
    }

    seen.add(item.targetUrl);
    return true;
  });
}

export async function createDocumentInventory(
  html: string,
  pageUrl: string,
): Promise<DocumentInventory> {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      serviceWorkers: 'block',
    });
    const page = await context.newPage();

    await page.route('**/*', (route) => route.abort('blockedbyclient'));
    await page.setContent(html, {
      timeout: 5_000,
      waitUntil: 'domcontentloaded',
    });

    const inventory = await page.evaluate((fallbackUrl) => {
      const htmlPreview = (element: Element) => element.outerHTML.slice(0, 300);
      const declaredBase = document.querySelector('base[href]')?.getAttribute('href');
      let baseUrl = fallbackUrl;

      if (declaredBase) {
        try {
          baseUrl = new URL(declaredBase, fallbackUrl).toString();
        } catch {
          baseUrl = fallbackUrl;
        }
      }

      const toPublicHttpUrl = (value: string | null): string | null => {
        if (!value) {
          return null;
        }

        try {
          const url = new URL(value, baseUrl);
          url.hash = '';
          return url.protocol === 'http:' || url.protocol === 'https:'
            ? url.toString()
            : null;
        } catch {
          return null;
        }
      };

      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
        .map((element) => ({
          element: htmlPreview(element),
          targetUrl: toPublicHttpUrl(element.getAttribute('href')),
          text: element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 160) ?? '',
        }))
        .filter((item): item is { element: string; targetUrl: string; text: string } =>
          item.targetUrl !== null,
        );

      const images = Array.from(document.querySelectorAll<HTMLImageElement>('img[src]'))
        .map((element) => ({
          alt: element.hasAttribute('alt') ? element.getAttribute('alt') : null,
          element: htmlPreview(element),
          targetUrl: toPublicHttpUrl(element.getAttribute('src')),
        }))
        .filter((item): item is { alt: string | null; element: string; targetUrl: string } =>
          item.targetUrl !== null,
        );

      const stylesheets = Array.from(
        document.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"][href]'),
      ).map((element) => ({
        element: htmlPreview(element),
        kind: 'stylesheet' as const,
        targetUrl: toPublicHttpUrl(element.getAttribute('href')),
      }));

      const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]'))
        .map((element) => ({
          element: htmlPreview(element),
          kind: 'script' as const,
          targetUrl: toPublicHttpUrl(element.getAttribute('src')),
        }));

      const resources = [...stylesheets, ...scripts]
        .filter((item): item is {
          element: string;
          kind: 'script' | 'stylesheet';
          targetUrl: string;
        } => item.targetUrl !== null);

      return {
        images,
        links,
        resources,
        title: document.title.trim().slice(0, 200),
      };
    }, pageUrl);

    return {
      ...inventory,
      // O texto alternativo pertence a cada elemento, não ao arquivo da imagem.
      // Preservamos ocorrências repetidas para não esconder um <img> sem alt.
      images: inventory.images,
      links: uniqueByTarget(inventory.links),
      resources: uniqueByTarget(inventory.resources),
    };
  } finally {
    await browser.close();
  }
}
