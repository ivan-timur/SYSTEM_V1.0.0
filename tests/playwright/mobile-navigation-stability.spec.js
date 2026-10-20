const { test, expect } = require('@playwright/test');

const destinations = ['status', 'quest', 'rewards', 'ai', 'settings'];

async function openApp(page, width = 390, height = 844) {
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await expect(page.locator('#status-page')).toHaveClass(/active/);
}

async function getNavGeometry(page) {
  return page.locator('#system-app .sidebar-nav').evaluate((nav) => {
    const rect = nav.getBoundingClientRect();
    return {
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height,
      items: Array.from(nav.querySelectorAll('.nav-item')).map((item) => {
        const itemRect = item.getBoundingClientRect();
        const icon = item.querySelector('img, .nav-icon');
        const iconRect = icon ? icon.getBoundingClientRect() : null;
        return {
          page: item.dataset.page,
          left: itemRect.left,
          right: itemRect.right,
          top: itemRect.top,
          bottom: itemRect.bottom,
          width: itemRect.width,
          height: itemRect.height,
          iconTop: iconRect?.top ?? null,
          iconWidth: iconRect?.width ?? null,
          iconHeight: iconRect?.height ?? null
        };
      })
    };
  });
}

test.describe('Mobile navigation stability', () => {
  test('five navigation targets and icons remain anchored during vertical scrolling', async ({ page }) => {
    await openApp(page);
    const nav = page.locator('#system-app .sidebar-nav');
    await expect(nav.locator('.nav-item')).toHaveCount(5);
    const before = await getNavGeometry(page);
    expect(before.items.map((item) => item.page)).toEqual(destinations);
    expect(before.height).toBeGreaterThanOrEqual(56);
    for (const item of before.items) {
      expect(item.width).toBeGreaterThan(0);
      expect(item.height).toBeGreaterThanOrEqual(52);
      expect(item.iconWidth).toBeGreaterThan(0);
      expect(item.iconHeight).toBeGreaterThan(0);
      expect(item.iconTop).toBeGreaterThanOrEqual(item.top);
      expect(item.iconTop).toBeLessThan(item.bottom);
    }

    await page.evaluate(() => {
      const content = document.querySelector('#system-app .main-content');
      if (content) content.scrollTop = Math.max(content.scrollHeight, 1200);
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await page.waitForTimeout(100);
    const after = await getNavGeometry(page);
    expect(after.top).toBeCloseTo(before.top, 0);
    expect(after.bottom).toBeCloseTo(before.bottom, 0);
    for (let i = 0; i < before.items.length; i += 1) {
      expect(after.items[i].page).toBe(before.items[i].page);
      expect(after.items[i].iconWidth).toBeCloseTo(before.items[i].iconWidth, 0);
      expect(after.items[i].iconHeight).toBeCloseTo(before.items[i].iconHeight, 0);
      expect(after.items[i].top).toBeCloseTo(before.items[i].top, 0);
    }
  });

  test('each navigation destination remains clickable on a narrow 360px viewport', async ({ page }) => {
    await openApp(page, 360, 800);
    for (const destination of destinations) {
      const item = page.locator(`.nav-item[data-page="${destination}"]`);
      await expect(item).toBeVisible();
      const box = await item.boundingBox();
      expect(box).not.toBeNull();
      expect(box.width).toBeGreaterThanOrEqual(40);
      expect(box.height).toBeGreaterThanOrEqual(52);
      await item.click();
      await expect(page.locator(`#${destination}-page`)).toHaveClass(/active/);
    }
    const overflow = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth
    }));
    expect(overflow.document).toBeLessThanOrEqual(overflow.viewport + 1);
    expect(overflow.body).toBeLessThanOrEqual(overflow.viewport + 1);
  });
});
