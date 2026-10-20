const { test, expect } = require('@playwright/test');

async function openRewards(page, viewport = { width: 390, height: 844 }) {
  await page.setViewportSize(viewport);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#status-page')).toHaveClass(/active/);
  await page.locator('.nav-item[data-page="rewards"]').click();
  await expect(page.locator('#rewards-page')).toHaveClass(/active/);
  await expect(page.locator('#rewards-page .rp-hub')).toBeVisible();
}

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  expect(dimensions.document, `Document overflow: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.body, `Body overflow: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test.describe('Rewards Command Center', () => {
  test('search, status filters and empty-result feedback work together', async ({ page }) => {
    await openRewards(page, { width: 1280, height: 900 });
    const search = page.locator('[data-rp-search]');
    await search.fill('focus');
    await expect(page.locator('#reward-card-grid .reward-card:visible h3')).toHaveText(['Focus Bonus']);

    await search.fill('this reward does not exist');
    await expect(page.locator('#rewards-page .rp-empty')).toBeVisible();

    await search.fill('');
    await page.locator('[data-rp-status]').selectOption('locked');
    await expect(page.locator('#reward-card-grid .reward-card:visible h3')).toContainText('Focus Bonus');
    await expect(page.locator('#reward-card-grid .reward-card:visible h3')).toContainText('Quest Trio');
  });

  test('tabs expose the selected category and keyboard navigation', async ({ page }) => {
    await openRewards(page, { width: 1280, height: 900 });
    const daily = page.locator('#reward-tab-daily');
    const achievement = page.locator('#reward-tab-achievement');
    await expect(daily).toHaveAttribute('aria-selected', 'true');

    await daily.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#reward-tab-mission')).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.locator('#reward-tab-special')).toBeFocused();
    await expect(page.locator('#reward-tab-special')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#reward-card-grid')).toHaveAttribute('aria-labelledby', 'reward-tab-special');

    await achievement.click();
    await expect(achievement).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#reward-card-grid .reward-card:visible')).not.toHaveCount(0);
  });

  test('Collect All includes the daily login reward and writes a history receipt', async ({ page }) => {
    await openRewards(page, { width: 1280, height: 900 });
    const dailyClaim = page.locator('#daily-login-claim');
    await expect(dailyClaim).toBeEnabled();
    await page.locator('[data-rp="all"]').click();
    await expect(dailyClaim).toBeDisabled();

    await page.locator('.rp-log summary').click();
    await expect(page.locator('.rp-log-entry').first()).toContainText('Daily Login · Day 1');
  });


  test('reward favourites persist and can be filtered', async ({ page }) => {
    await openRewards(page, { width: 1280, height: 900 });
    await page.locator('#reward-tab-daily').click();
    const favorite = page.locator('#reward-card-grid .reward-card').filter({ hasText: 'Focus Bonus' }).locator('[data-ra-favorite]');
    await expect(favorite).toHaveAttribute('aria-pressed', 'false');
    await favorite.click();
    await expect(favorite).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-rp-status]').selectOption('saved');
    await expect(page.locator('#reward-card-grid .reward-card:visible h3')).toHaveText(['Focus Bonus']);
    await page.reload();
    await page.locator('.nav-item[data-page="rewards"]').click();
    await expect(page.locator('#reward-card-grid [data-ra-favorite][aria-pressed="true"]')).toHaveCount(1);
    await expect(page.locator('.ra-ascension')).toBeVisible();
  });

  test('milestone route opens the matching achievement card', async ({ page }) => {
    await openRewards(page, { width: 1280, height: 900 });
    await expect(page.locator('.ra-route-card')).toHaveCount(3);
    const levelRoute = page.locator('.ra-route-level');
    await expect(levelRoute).toContainText('Explorer');
    await levelRoute.getByRole('button', { name: 'Track milestone' }).click();
    await expect(page.locator('#reward-tab-achievement')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-rp-search]')).toHaveValue('Explorer');
    await expect(page.locator('#reward-card-grid .reward-card:visible h3')).toHaveText(['Explorer']);
  });

  test('vault protection meters are exposed and history exports as CSV', async ({ page }) => {
    await openRewards(page, { width: 1280, height: 900 });
    await expect(page.locator('.ra-pity-track[aria-label="Rare reward protection"]')).toHaveAttribute('aria-valuemax', '9');
    await expect(page.locator('.ra-pity-track[aria-label="Legendary reward protection"]')).toHaveAttribute('aria-valuemax', '39');
    await page.locator('[data-rp="all"]').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('[data-ra-export]').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^SYSTEM-reward-history-.*\.csv$/);
  });

  test('Rewards remains usable on mobile without horizontal overflow', async ({ page }) => {
    await openRewards(page, { width: 390, height: 844 });
    await expect(page.locator('.rp-stats')).toBeVisible();
    await expect(page.locator('.rp-controls')).toBeVisible();
    await expect(page.locator('#reward-card-grid .reward-card:visible')).not.toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
});
