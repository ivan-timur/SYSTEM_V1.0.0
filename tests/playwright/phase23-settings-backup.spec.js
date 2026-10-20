const { test, expect } = require('@playwright/test');

async function openSettings(page, viewport = { width: 390, height: 844 }) {
  await page.setViewportSize(viewport);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#status-page')).toHaveClass(/active/);
  await page.locator('.nav-item[data-page="settings"]').click();
  await expect(page.locator('#settings-page')).toHaveClass(/active/);
}

async function expectNoHorizontalOverflow(page) {
  const size = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  expect(size.document, `Document overflow: ${JSON.stringify(size)}`).toBeLessThanOrEqual(size.viewport + 1);
  expect(size.body, `Body overflow: ${JSON.stringify(size)}`).toBeLessThanOrEqual(size.viewport + 1);
}

test.describe('Phase 23 — Settings, Backup, and mobile E2E', () => {
  test('Settings navigation and language control remain reachable', async ({ page }) => {
    await openSettings(page);
    await expect(page.locator('#system-language-setting')).toBeVisible();
    const language = page.locator('#system-language-setting #system-language-toggle');
    await expect(language).toBeVisible();
    await language.click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expectNoHorizontalOverflow(page);
  });

  test('Data Backup opens a dialog, runs storage health check, and exports JSON', async ({ page }) => {
    await openSettings(page, { width: 1280, height: 900 });
    const row = page.locator('#settings-page .settings-row').filter({ hasText: 'Data Backup' });
    await expect(row).toBeVisible();
    await row.getByRole('button').click();
    const dialog = page.locator('dialog[open]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Data Backup & Restore');
    await expect(dialog.locator('#system-backup-status')).toBeVisible();
    await dialog.locator('#system-run-health').click();
    await expect(dialog.locator('#system-backup-status')).not.toHaveText('');
    const downloadPromise = page.waitForEvent('download');
    await dialog.locator('#system-export-backup').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^system-backup-\d{4}-\d{2}-\d{2}\.json$/);
  });

  test('Backup restore input accepts JSON only and mobile Settings does not overflow', async ({ page }) => {
    await openSettings(page, { width: 360, height: 800 });
    const row = page.locator('#settings-page .settings-row').filter({ hasText: 'Data Backup' });
    await row.getByRole('button').click();
    const input = page.locator('#system-import-backup');
    await expect(input).toHaveAttribute('accept', '.json,application/json');
    await expect(page.locator('dialog[open]')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('Core navigation pages are reachable on a narrow mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    for (const name of ['quest', 'rewards', 'ai', 'settings', 'status']) {
      await page.locator(`.nav-item[data-page="${name}"]`).click();
      await expect(page.locator(`#${name === 'ai' ? 'ai' : name}-page`)).toHaveClass(/active/);
      await expectNoHorizontalOverflow(page);
    }
  });
});
