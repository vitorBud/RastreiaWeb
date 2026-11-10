import { chromium } from 'playwright';

export type ResponsiveViewportName = 'desktop' | 'mobile' | 'tablet';

export interface ResponsiveStylesheet {
  content: string;
  sourceUrl: string;
}

export interface ResponsiveOverflowElement {
  element: string;
  overflowPixels: number;
  selector: string;
}

export interface ResponsiveViewportResult {
  documentWidth: number;
  height: number;
  horizontalOverflow: boolean;
  name: ResponsiveViewportName;
  overflowingElements: ResponsiveOverflowElement[];
  width: number;
}

export interface ResponsiveLayoutResult {
  message: string;
  status: 'completed' | 'unavailable';
  viewports: ResponsiveViewportResult[];
}

interface ResponsiveViewport {
  height: number;
  name: ResponsiveViewportName;
  width: number;
}

const viewports: ResponsiveViewport[] = [
  { height: 900, name: 'desktop', width: 1440 },
  { height: 1024, name: 'tablet', width: 768 },
  { height: 844, name: 'mobile', width: 390 },
];

export async function analyzeResponsiveLayout(
  html: string,
  pageUrl: string,
  stylesheets: ResponsiveStylesheet[] = [],
  onViewportComplete?: (completed: number, total: number) => void,
): Promise<ResponsiveLayoutResult> {
  const browser = await chromium.launch({
    headless: true,
    timeout: 10_000,
  });

  try {
    const results: ResponsiveViewportResult[] = [];

    for (const [index, viewport] of viewports.entries()) {
      const context = await browser.newContext({
        javaScriptEnabled: false,
        serviceWorkers: 'block',
        viewport: { height: viewport.height, width: viewport.width },
      });

      try {
        const page = await context.newPage();

        page.setDefaultNavigationTimeout(5_000);
        page.setDefaultTimeout(5_000);
        await page.route('**/*', (route) => route.abort('blockedbyclient'));
        await page.setContent(html, {
          timeout: 5_000,
          waitUntil: 'domcontentloaded',
        });

        await page.evaluate((stylesheetContents) => {
          document.querySelectorAll('noscript').forEach((element) => element.remove());
          document.documentElement.classList.remove('no-js');

          for (const content of stylesheetContents) {
            const style = document.createElement('style');
            style.dataset.rastreiaweb = 'responsive-audit';
            style.textContent = content.replace(/@import\s+[^;]+;/gi, '');
            document.head.append(style);
          }
        }, stylesheets.map((stylesheet) => stylesheet.content));

        const measurement = await page.evaluate(({ fallbackUrl, viewportWidth }) => {
          const ignoredTags = new Set([
            'BODY',
            'HEAD',
            'HTML',
            'LINK',
            'META',
            'SCRIPT',
            'STYLE',
          ]);
          const htmlPreview = (element: Element) => element.outerHTML.slice(0, 300);
          const selectorFor = (element: Element) => {
            if (element.id) {
              return `#${CSS.escape(element.id)}`;
            }

            const parts: string[] = [];
            let current: Element | null = element;

            while (current && current !== document.body && parts.length < 4) {
              let part = current.tagName.toLowerCase();
              const className = Array.from(current.classList).slice(0, 2);

              if (className.length > 0) {
                part += `.${className.map((item) => CSS.escape(item)).join('.')}`;
              } else if (current.parentElement) {
                const siblings = Array.from(current.parentElement.children)
                  .filter((item) => item.tagName === current!.tagName);

                if (siblings.length > 1) {
                  part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
                }
              }

              parts.unshift(part);
              current = current.parentElement;
            }

            return parts.join(' > ');
          };
          const isInsideIntentionalScroller = (element: Element) => {
            let parent = element.parentElement;

            while (parent && parent !== document.body) {
              const style = getComputedStyle(parent);
              const scrollable = ['auto', 'scroll'].includes(style.overflowX) &&
                parent.scrollWidth > parent.clientWidth + 1;

              if (scrollable) {
                return true;
              }

              parent = parent.parentElement;
            }

            return false;
          };
          const documentWidth = Math.max(
            document.documentElement.scrollWidth,
            document.body?.scrollWidth ?? 0,
          );
          const overflowingElements = Array.from(document.body?.querySelectorAll('*') ?? [])
            .filter((element) => !ignoredTags.has(element.tagName))
            .flatMap((element) => {
              const style = getComputedStyle(element);
              const rect = element.getBoundingClientRect();

              if (
                style.display === 'none' ||
                style.visibility === 'hidden' ||
                element.getAttribute('aria-hidden') === 'true' ||
                rect.width <= 0 ||
                rect.height <= 0 ||
                isInsideIntentionalScroller(element)
              ) {
                return [];
              }

              const overflowPixels = Math.ceil(Math.max(
                0,
                rect.right - viewportWidth,
                -rect.left,
              ));

              if (overflowPixels <= 1) {
                return [];
              }

              return [{
                element: htmlPreview(element),
                overflowPixels,
                selector: selectorFor(element),
              }];
            })
            .sort((first, second) => second.overflowPixels - first.overflowPixels)
            .slice(0, 8);

          return {
            documentWidth,
            fallbackUrl,
            horizontalOverflow: documentWidth > viewportWidth + 1,
            overflowingElements,
          };
        }, { fallbackUrl: pageUrl, viewportWidth: viewport.width });
        results.push({
          documentWidth: measurement.documentWidth,
          height: viewport.height,
          horizontalOverflow: measurement.horizontalOverflow ||
            measurement.overflowingElements.length > 0,
          name: viewport.name,
          overflowingElements: measurement.overflowingElements,
          width: viewport.width,
        });
      } finally {
        await context.close();
      }

      onViewportComplete?.(index + 1, viewports.length);
    }

    return {
      message: 'Layout medido em três resoluções com scripts e rede do navegador bloqueados.',
      status: 'completed',
      viewports: results,
    };
  } finally {
    await browser.close();
  }
}
