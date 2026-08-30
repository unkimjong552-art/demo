/**
 * useAssessmentSettings.js
 *
 * Composable untuk mengelola Settings dan Benchmark assessment.
 * Data disimpan ke localStorage agar persisten antar sesi.
 *
 * Keys:
 *   physassess_test_settings   — durasi + countdown per tes
 *   physassess_benchmarks      — benchmark target per tes
 */

import { reactive, watch } from 'vue';

const SETTINGS_KEY  = 'physassess_test_settings';
const BENCHMARK_KEY = 'physassess_benchmarks';

// ─── Default values ───────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
    'Keseimbangan Statis': { durationSec: 60, countdownSec: 3 },
    'Elbow Plank':         { durationSec: 60, countdownSec: 3 },
    'Wall Sit':            { durationSec: 60, countdownSec: 3 },
    'Deep Squat':          { durationSec: 60, countdownSec: 3 },
    'Squat Jump':          { durationSec: 60, countdownSec: 3 },
    'Push Up':             { durationSec: 60, countdownSec: 3 },
    'Sit Up':              { durationSec: 60, countdownSec: 3 },
    'Sit and Reach':       { durationSec: 30, countdownSec: 3 },
};

const DEFAULT_BENCHMARKS = {
    'Keseimbangan Statis': { value: 60,  unit: 'detik' },
    'Elbow Plank':         { value: 60,  unit: 'detik' },
    'Wall Sit':            { value: 60,  unit: 'detik' },
    'Deep Squat':          { value: 30,  unit: 'repetisi' },
    'Squat Jump':          { value: 30,  unit: 'repetisi' },
    'Push Up':             { value: 30,  unit: 'repetisi' },
    'Sit Up':              { value: 30,  unit: 'repetisi' },
    'Sit and Reach':       { value: 20,  unit: 'cm' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────

function loadFromStorage(key, defaults) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return { ...defaults };
        const parsed = JSON.parse(raw);
        // Merge dengan defaults agar tes baru tidak hilang
        const merged = { ...defaults };
        for (const [k, v] of Object.entries(parsed)) {
            if (k in merged) merged[k] = { ...merged[k], ...v };
        }
        return merged;
    } catch {
        return { ...defaults };
    }
}

function saveToStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn('[PhysAssess] Settings save failed:', e);
    }
}

// ─── Singleton state ──────────────────────────────────────────────────────
// Reactive agar Settings.vue dan AssessmentSession bisa share data yang sama
// tanpa harus reload.

const testSettings = reactive(loadFromStorage(SETTINGS_KEY,  DEFAULT_SETTINGS));
const benchmarks   = reactive(loadFromStorage(BENCHMARK_KEY, DEFAULT_BENCHMARKS));

// Auto-save saat berubah (watch deep)
watch(testSettings, (v) => saveToStorage(SETTINGS_KEY,  v), { deep: true });
watch(benchmarks,   (v) => saveToStorage(BENCHMARK_KEY, v), { deep: true });

// ─── Public API ───────────────────────────────────────────────────────────

export function useAssessmentSettings() {

    /** Dapatkan durasi tes (detik) untuk test name tertentu */
    function getDuration(testName) {
        return testSettings[testName]?.durationSec ?? 60;
    }

    /** Dapatkan countdown detik untuk test name tertentu */
    function getCountdown(testName) {
        return testSettings[testName]?.countdownSec ?? 3;
    }

    /** Dapatkan benchmark snapshot untuk saat ini — disimpan bersama result */
    function getBenchmarkSnapshot(testName) {
        const b = benchmarks[testName];
        if (!b) return null;
        return { value: b.value, unit: b.unit };
    }

    /**
     * Hitung achievement (%) dari result dan benchmark.
     * Returns null jika benchmark tidak valid atau 0.
     */
    function calculateAchievement(resultValue, benchmarkValue) {
        if (
            resultValue  == null || isNaN(resultValue)  ||
            benchmarkValue == null || isNaN(benchmarkValue) || benchmarkValue <= 0
        ) return null;
        return Math.min(Math.round((resultValue / benchmarkValue) * 10000) / 100, 100);
    }

    /** Reset settings ke default */
    function resetSettings() {
        Object.assign(testSettings, loadFromStorage(null, DEFAULT_SETTINGS));
        saveToStorage(SETTINGS_KEY, testSettings);
    }

    /** Reset benchmarks ke default */
    function resetBenchmarks() {
        Object.assign(benchmarks, loadFromStorage(null, DEFAULT_BENCHMARKS));
        saveToStorage(BENCHMARK_KEY, benchmarks);
    }

    return {
        testSettings,
        benchmarks,
        getDuration,
        getCountdown,
        getBenchmarkSnapshot,
        calculateAchievement,
        resetSettings,
        resetBenchmarks,
    };
}

// Named exports untuk Settings.vue
export { DEFAULT_SETTINGS, DEFAULT_BENCHMARKS };
