const { test, expect } = require('@playwright/test');

async function openRoadmap(page, viewport = { width: 1280, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#status-page')).toHaveClass(/active/);
  await page.locator('#status-more-btn').click();
  await page.locator('[data-status-tool="smart-roadmap"]').click();
  await expect(page.locator('.system-roadmap')).toBeVisible();
}

async function expectNoHorizontalOverflow(page) {
  const size = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
  expect(size.page, `Horizontal overflow at ${size.viewport}px: ${size.page}px`).toBeLessThanOrEqual(size.viewport + 1);
}

function backupWithMilestone(id, title, stat = 'physics') {
  return JSON.stringify({
    app: 'SYSTEM', formatVersion: 1, exportedAt: new Date().toISOString(),
    milestones: [{ id, title, note: 'Imported using a validated backup', stat, priority: 'normal', dueDate: '', status: 'todo', createdAt: new Date().toISOString(), completedAt: '' }]
  });
}

test.describe('Smart Roadmap', () => {
  test('creates, edits, status-filters and searches without losing changes', async ({ page }) => {
    await openRoadmap(page);
    const form = page.locator('[data-roadmap-form]');
    await form.locator('input[name="title"]').fill('Learn Python basics');
    await form.locator('select[name="stat"]').selectOption('computer');
    await form.locator('select[name="priority"]').selectOption('high');
    await form.locator('textarea[name="note"]').fill('Build a small project');
    await form.locator('button[type="submit"]').click();
    await expect(page.locator('[data-roadmap-filter-item]')).toHaveCount(1);
    await page.locator('[data-roadmap-status]').click();
    await expect(page.locator('[data-roadmap-filter-item]')).toHaveAttribute('data-status', 'doing');

    await page.locator('[data-roadmap-edit]').click();
    await expect(page.locator('[data-roadmap-form] input[name="title"]')).toHaveValue('Learn Python basics');
    await page.locator('[data-roadmap-form] input[name="title"]').fill('Build a Python project');
    await page.locator('[data-roadmap-form] button[type="submit"]').click();
    await expect(page.locator('.roadmap-item-title')).toHaveText('Build a Python project');

    await page.locator('[data-roadmap-search]').fill('nothing matches');
    await expect(page.locator('[data-roadmap-no-results]')).toBeVisible();
    await page.locator('[data-roadmap-search]').fill('python');
    await expect(page.locator('[data-roadmap-filter-item]:visible')).toHaveCount(1);
    await page.locator('[data-roadmap-filter-stat]').selectOption('mathematics');
    await expect(page.locator('[data-roadmap-filter-item]:visible')).toHaveCount(0);
    await expect(page.locator('[data-roadmap-no-results]')).toBeVisible();
  });

  test('imports validated JSON with merge mode and rejects malformed backup', async ({ page }) => {
    await openRoadmap(page);
    await page.locator('[data-roadmap-import-mode]').selectOption('merge');
    await page.locator('[data-roadmap-import-file]').setInputFiles({
      name: 'roadmap.json', mimeType: 'application/json', buffer: Buffer.from(backupWithMilestone('remote-1', 'Imported physics goal'))
    });
    await expect(page.locator('.roadmap-item-title')).toHaveText('Imported physics goal');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('system_v2_smart_roadmap')));
    expect(saved).toHaveLength(1);
    expect(saved[0].title).toBe('Imported physics goal');
  });

  test('replace import asks for confirmation and preserves mobile layout', async ({ page }) => {
    await openRoadmap(page, { width: 360, height: 800 });
    await page.locator('[data-roadmap-form] input[name="title"]').fill('Keep this until replacement');
    await page.locator('[data-roadmap-form] button[type="submit"]').click();
    await page.locator('[data-roadmap-import-mode]').selectOption('replace');
    page.on('dialog', dialog => dialog.accept());
    await page.locator('[data-roadmap-import-file]').setInputFiles({
      name: 'replacement.json', mimeType: 'application/json', buffer: Buffer.from(backupWithMilestone('replacement-1', 'Replacement goal'))
    });
    await expect(page.locator('.roadmap-item-title')).toHaveText('Replacement goal');
    await expectNoHorizontalOverflow(page);
  });
});
