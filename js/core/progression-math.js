/* Compatibility guard: all progression formulas are compiled from TypeScript. */
(function requireSYSTEMProgressionMath(root) {
    'use strict';
    const math = root.SYSTEMProgressionMath;
    if (!math || typeof math.getPlayerXPRequired !== 'function' || typeof math.advanceXPTrack !== 'function') {
        throw new Error('SYSTEM TypeScript progression runtime must load before the compatibility adapter.');
    }
})(typeof window !== 'undefined' ? window : globalThis);
