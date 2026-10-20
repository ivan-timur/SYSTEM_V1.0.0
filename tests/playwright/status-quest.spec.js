const { test, expect } = require('@playwright/test');

async function resetApp(page, viewport = { width: 390, height: 844 }) {
  await page.setViewportSize(viewport);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#status-page')).toHaveClass(/active/);
  await expect(page.locator('#system-language-toggle')).toHaveCount(1);
  await expect(page.locator('#system-language-toggle')).toBeHidden();
}

async function switchLanguageFromSettings(page) {
  await page.locator('.nav-item[data-page="settings"]').click();
  await expect(page.locator('#settings-page')).toHaveClass(/active/);
  await expect(page.locator('#system-language-toggle')).toBeVisible();
  await page.locator('#system-language-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.locator('.nav-item[data-page="status"]').click();
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

test('Language selector is available inside Settings, not as a floating overlay', async ({ page }) => {
  await resetApp(page);
  await expect(page.locator('#system-language-toggle')).toBeHidden();
  await page.locator('.nav-item[data-page="settings"]').click();
  await expect(page.locator('#settings-page #system-language-setting')).toBeVisible();
  await expect(page.locator('#system-language-setting #system-language-toggle')).toBeVisible();
  await expect(page.locator('#system-language-toggle')).toContainText('فارسی');
  await page.locator('#system-language-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#system-language-toggle')).toContainText('English');
});

test.describe('Status and Quest — mobile RTL', () => {
  test('Status keeps primary panels visible and avoids horizontal overflow', async ({ page }) => {
    await resetApp(page);
    await switchLanguageFromSettings(page);
    await expect(page.locator('#status-page .level-panel')).toBeVisible();
    await expect(page.locator('#status-page .xp-panel')).toBeVisible();
    await expect(page.locator('#status-page .rank-panel')).toBeVisible();
    await expect(page.locator('#status-page .stats-grid')).toBeVisible();
    const boxes = await Promise.all(['.level-panel', '.xp-panel', '.rank-panel'].map((selector) =>
      page.locator(`#status-page ${selector}`).boundingBox()));
    for (const box of boxes) {
      expect(box).not.toBeNull();
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThan(0);
    }
    await expectNoHorizontalOverflow(page);
  });

  test('Quest is reachable and remains readable in RTL on a narrow phone', async ({ page }) => {
    await resetApp(page, { width: 360, height: 800 });
    await switchLanguageFromSettings(page);
    await page.locator('.nav-item[data-page="quest"]').click();
    await expect(page.locator('#quest-page')).toHaveClass(/active/);
    await expect(page.locator('#quest-page')).toBeVisible();
    await expect(page.locator('#quest-page .quest-layout')).toBeVisible();
    const questBox = await page.locator('#quest-page .quest-layout').boundingBox();
    expect(questBox).not.toBeNull();
    expect(questBox.width).toBeGreaterThan(0);
    await expectNoHorizontalOverflow(page);
  });

  test('CSP blocks inline JavaScript and app still initializes', async ({ page }) => {
    await resetApp(page);
    const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(policy).toContain("script-src 'self'");
    expect(policy).not.toMatch(/script-src[^;]*unsafe-inline/);
    await expect(page.locator('#status-page')).toHaveClass(/active/);
    await expect(page.locator('[data-ai-view="chat"]')).toBeAttached();
  });
});


test('Skill Tree supports search, status filters, and live English/Dari switching', async ({ page }) => {
  await resetApp(page, { width: 1280, height: 900 });
  await page.locator('.stat-card[data-stat="global-skills"]').click();
  await expect(page.locator('#skill-tree-panel')).toBeVisible();
  await expect(page.locator('.skill-node-wrapper')).toHaveCount(20);
  await expect(page.locator('.skill-tree-progress-track')).toBeVisible();

  await page.locator('[data-skill-search]').fill('Speaking Practice');
  await expect(page.locator('.skill-node-wrapper:not(.is-filtered-out)')).toHaveCount(1);
  await expect(page.locator('.skill-node-wrapper:not(.is-filtered-out) h3')).toContainText('Speaking Practice');
  await page.locator('[data-skill-search]').fill('');
  await page.locator('[data-skill-filter="locked"]').click();
  await expect(page.locator('[data-skill-filter="locked"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.skill-node-wrapper[data-skill-state="locked"]:not(.is-filtered-out)')).toHaveCount(19);

  await switchLanguageFromSettings(page);
  await expect(page.locator('.skill-node-info h3').filter({ hasText: 'تمرین گفتار' })).toBeVisible();
  await expect(page.locator('[data-skill-search]')).toHaveAttribute('placeholder', 'جست‌وجوی مهارت‌ها...');
  await expectNoHorizontalOverflow(page);
});

test('Detailed Mathematics curriculum exposes Algebra I, Algebra II, and topic-level XP', async ({ page }) => {
  await resetApp(page, { width: 390, height: 844 });
  await page.locator('.stat-card[data-stat="mathematics"]').click();
  await expect(page.locator('.skill-node-wrapper')).toHaveCount(20);
  await page.locator('[data-skill-search]').fill('Algebra II');
  await expect(page.locator('.skill-node-wrapper:not(.is-filtered-out)')).toHaveCount(1);
  await expect(page.locator('[data-skill-node-id="math-algebra-ii"]')).toBeVisible();
  await expect(page.locator('[data-skill-node-id="math-a2-quadratics"]')).toBeVisible();
  await expect(page.locator('[data-skill-node-id="math-a2-exponential-log"]')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('Recorded activity awards XP to a matching skill path and survives reload', async ({ page }) => {
  await resetApp(page, { width: 1280, height: 900 });
  await page.evaluate(() => window.runSystemTransaction('skill-progression-test', () => window.applyProgressionReward({
    type: 'skill-progression-test',
    title: 'Algebra II quadratic equations practice',
    stat: 'mathematics',
    xp: 100,
    coins: 0
  }))); 
  const firstSave = await page.evaluate(() => JSON.parse(localStorage.getItem('system_v2_save')));
  expect(firstSave.schemaVersion).toBe(3);
  expect(firstSave.skillProgress['mathematics-02'].totalXp).toBe(50);
  expect(firstSave.skillProgress['math-algebra-ii'].totalXp).toBe(50);
  expect(firstSave.skillProgress['math-a2-quadratics'].totalXp).toBe(50);

  await page.reload();
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('system_v2_save')));
  expect(restored.skillProgress['math-a2-quadratics'].totalXp).toBe(50);
  await page.locator('.stat-card[data-stat="mathematics"]').click();
  await page.locator('[data-skill-search]').fill('Algebra II');
  await expect(page.locator('[data-skill-node-id="math-a2-quadratics"] .skill-subnode-xp-row')).toContainText('50');
  await expectNoHorizontalOverflow(page);
});


test('AI tools use a compact composer dock and Study Desk opens only on demand', async ({ page }) => {
  await resetApp(page, { width: 390, height: 844 });
  await page.locator('.nav-item[data-page="ai"]').click();
  await expect(page.locator('#ai-chat-view')).toBeVisible();
  await expect(page.locator('#ai-chat-view .ai-tools-panel')).toHaveCount(0);
  await expect(page.locator('#ai-chat-view .ai-composer-tools')).toBeVisible();
  await expect(page.locator('#grok-study-modal')).toBeAttached();
  await expect(page.locator('#grok-study-modal')).toBeHidden();

  await page.locator('.ai-tool-chip[data-ai-prompt="Math Solver"]').click();
  await expect(page.locator('#ai-chat-view .chat-input input')).toHaveValue('Help me solve this mathematics problem step by step: ');

  await page.locator('[data-open-study]').click();
  await expect(page.locator('#grok-study-modal')).toBeVisible();
  await expect(page.locator('#grok-study-suite')).toHaveAttribute('aria-modal', 'true');
  await page.locator('#grok-study-suite .grok-study-close').click();
  await expect(page.locator('#grok-study-modal')).toBeHidden();
  await expectNoHorizontalOverflow(page);
});

test('Status Command Deck replaces the three-dot trigger and exposes tools in an accessible sheet', async ({ page }) => {
  await resetApp(page, { width: 390, height: 844 });
  const command = page.locator('#status-more-btn');
  await expect(command).toContainText('COMMAND DECK');
  await command.click();
  const sheet = page.locator('#status-more-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute('aria-modal', 'true');
  const mastery = sheet.locator('[data-status-tool="skill-review"]');
  await mastery.click();
  await expect(mastery).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#status-tool-panel .system-skill-review')).toBeVisible();
  await page.locator('#status-more-close').click();
  await expect(sheet).toBeHidden();
  await expect(command).toBeFocused();
  await expectNoHorizontalOverflow(page);
});
