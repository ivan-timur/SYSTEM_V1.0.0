/** Pure bilingual AI-quest text parsing helpers extracted from app-controller.js. */
(() => {
    function inferQuestStat(missionText) {
        const text = String(missionText || "").toLowerCase();
        // English and Dari/Persian keyword matching keeps AI-created tasks connected to the six SYSTEM stats.
        if (/\b(math|mathematics|algebra|calculus|geometry|equation|integral|derivative|trigonometry)\b/.test(text) || /ریاضی|ریاضیات|الجبر|هندسه|معادله|حسابان/.test(text)) return "mathematics";
        if (/\b(physics|mechanics|force|energy|electricity|magnetism|motion|thermodynamics|wave)\b/.test(text) || /فزیک|فیزیک|میکانیک|قوه|نیرو|انرژی|حرکت|برق|مغناطیس|موج/.test(text)) return "physics";
        if (/\b(python|coding|code|programming|computer science|algorithm|software|debug|html|css|javascript)\b/.test(text) || /پایتون|کدنویسی|کد نویسی|برنامه.?نویسی|کمپیوتر|کامپیوتر|الگوریتم|نرم.?افزار/.test(text)) return "computer";
        if (/\b(english|vocabulary|words|speaking|communication|language|pronunciation|writing practice)\b/.test(text) || /انگلیسی|واژگان|لغات|سخنرانی|صحبت|زبان|تلفظ|نوشتن/.test(text)) return "global-skills";
        if (/\b(business|entrepreneur|startup|marketing|sales|customer|company|revenue|product idea)\b/.test(text) || /تجارت|کارآفرینی|استارت.?آپ|بازاریابی|فروش|مشتری|شرکت|درآمد/.test(text)) return "entrepreneurship";
        if (/\b(read|reading|book|research|first principles|analy[sz]e|reasoning|patterns|critical thinking)\b/.test(text) || /مطالعه|کتاب|تحقیق|پژوهش|تفکر انتقادی|تحلیل|استدلال|الگو/.test(text)) return "unique-thinking";
        return null;
    }

    function stripAIQuestFormatting(value) {
        return String(value || "")
            .replace(/^\s*>\s?/, "")
            .replace(/\*\*(.*?)\*\*/g, "$1")
            .replace(/__(.*?)__/g, "$1")
            .replace(/`([^`]*)`/g, "$1")
            .replace(/\s+#+\s*$/, "")
            .trim();
    }

    function isAIQuestMetaLine(line) {
        const value = stripAIQuestFormatting(line).replace(/^#{1,6}\s*/, "").trim();
        return !value ||
            /^#{1,6}\s/.test(String(line || "")) ||
            /^(?:sure\b|here (?:are|is)\b|below (?:are|is)\b|these (?:are|missions)\b|you can use\b|your daily plan\b)/i.test(value) ||
            /^(?:(?:daily\s+)?(?:quests?|missions?|tasks?))(?:\s+(?:for|to|today|below|list).*)?\s*:?[.!]?$/i.test(value) ||
            /^(?:مأموریت(?:‌های|های)?|وظایف|کارها|برنامه(?:‌ی|ی)? روزانه)(?:\s+.*)?\s*[:：.!]?$/i.test(value);
    }

    function expandInlineNumberedLine(line) {
        const expression = /(?:^|\s)(\d{1,3})[.)]\s+/g;
        const matches = Array.from(String(line || "").matchAll(expression));
        if (matches.length < 2 || String(line).slice(0, matches[0].index).trim()) return [line];
        return matches.map((match, index) => {
            const contentStart = match.index + match[0].length;
            const contentEnd = index + 1 < matches.length ? matches[index + 1].index : line.length;
            return `${match[1]}. ${line.slice(contentStart, contentEnd).trim()}`;
        });
    }

    function getNumberedQuestContent(line) {
        const match = stripAIQuestFormatting(line).match(/^(?:(?:mission|quest|task)\s*#?\s*)?(\d{1,3})\s*[.)、:-]\s*(.*)$/i);
        return match ? match[2].trim() : null;
    }

    function getBulletQuestContent(line) {
        const clean = stripAIQuestFormatting(line);
        const match = clean.match(/^(?:[-*•▪‣]|\[\s?[xX]?\s?\])\s+(.*)$/);
        return match ? match[1].trim() : null;
    }

    function parseAIQuestText(rawText) {
        const normalizeDigits = value => String(value || "").replace(/[۰-۹٠-٩]/g, digit => {
            const code = digit.charCodeAt(0);
            return String(code >= 0x06F0 && code <= 0x06F9 ? code - 0x06F0 : code - 0x0660);
        });
        const source = normalizeDigits(rawText)
            .replace(/```[a-z0-9_-]*\s*/gi, "")
            .replace(/```/g, "")
            .replace(/\r/g, "")
            .trim();
        if (!source) return [];

        const lines = source.split("\n").flatMap(line => expandInlineNumberedLine(line.trim())).map(stripAIQuestFormatting);
        const hasNumberedItems = lines.some(line => getNumberedQuestContent(line) !== null);
        const results = [];
        let current = "";

        if (hasNumberedItems) {
            lines.forEach(line => {
                if (!line || isAIQuestMetaLine(line)) return;
                const numberedContent = getNumberedQuestContent(line);
                if (numberedContent !== null) {
                    if (current) results.push(current);
                    current = numberedContent;
                } else if (current) {
                    // Wrapped descriptions remain part of the preceding numbered mission.
                    current = `${current} ${line}`.trim();
                }
            });
            if (current) results.push(current);
        } else {
            const hasBullets = lines.some(line => getBulletQuestContent(line) !== null);
            if (hasBullets) {
                lines.forEach(line => {
                    if (!line || isAIQuestMetaLine(line)) return;
                    const bulletContent = getBulletQuestContent(line);
                    if (bulletContent !== null) {
                        if (current) results.push(current);
                        current = bulletContent;
                    } else if (current) {
                        current = `${current} ${line}`.trim();
                    }
                });
                if (current) results.push(current);
            } else {
                // Fallback: allow one mission per non-empty line when the source is unnumbered.
                lines.forEach(line => {
                    const clean = stripAIQuestFormatting(line);
                    if (clean && !isAIQuestMetaLine(clean)) results.push(clean);
                });
            }
        }

        const seen = new Set();
        return results
            .map(item => item.replace(/^[\s:;—–-]+/, "").replace(/[\s;]+$/, "").trim())
            .filter(item => item.length >= 2 && item.length <= 500)
            .filter(item => {
                const key = item.toLocaleLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
    }

    // Keep a deliberately small public API; parser internals remain private.
    window.SYSTEMAIQuestParser = Object.freeze({
        inferQuestStat,
        parseAIQuestText,
        stripAIQuestFormatting
    });
})();
