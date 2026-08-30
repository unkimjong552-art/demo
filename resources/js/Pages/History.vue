<template>
    <PhysicalAssessmentLayout
        :current-page="currentPage"
        page-title="Riwayat Assessment"
        page-subtitle="Daftar semua assessment yang telah dilakukan"
        @navigate="handleNavigate"
    >
        <!-- Filters -->
        <div class="flex flex-wrap items-center gap-3 mb-6">
            <div class="flex items-center gap-2 px-3 py-2 bg-dark-800 border border-white/5 rounded-lg">
                <svg class="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input v-model="search" type="text" placeholder="Cari nama atlet atau tes..."
                       class="bg-transparent text-sm text-white placeholder-slate-600 outline-none w-52"/>
            </div>
            <select v-model="filterTest" class="px-3 py-2 bg-dark-800 border border-white/5 rounded-lg text-sm text-slate-400 outline-none">
                <option value="">Semua Tes</option>
                <option v-for="t in testOptions" :key="t" :value="t">{{ t }}</option>
            </select>
            <div class="ml-auto flex items-center gap-2">
                <span class="text-xs text-slate-500">{{ filteredHistory.length }} hasil</span>
                <button v-if="historyData.length > 0" @click="clearAllHistory"
                        class="flex items-center gap-2 px-4 py-2 bg-dark-800 border border-white/5 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:border-red-500/20 transition-colors">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                    Hapus Semua
                </button>
            </div>
        </div>

        <!-- Table -->
        <div class="card overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead>
                        <tr class="border-b border-white/5">
                            <th class="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Atlet</th>
                            <th class="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tes</th>
                            <th class="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Kategori</th>
                            <th class="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Hasil</th>
                            <th class="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Pencapaian</th>
                            <th class="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Tanggal</th>
                            <th class="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Aksi</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-white/3">
                        <tr v-if="filteredHistory.length === 0">
                            <td colspan="7" class="px-5 py-16 text-center">
                                <div class="flex flex-col items-center gap-3">
                                    <span class="text-4xl">📋</span>
                                    <p class="text-sm font-semibold text-white">
                                        {{ historyData.length === 0 ? 'Belum ada riwayat assessment' : 'Tidak ada hasil yang cocok' }}
                                    </p>
                                    <p class="text-xs text-slate-500 max-w-xs">
                                        {{ historyData.length === 0
                                            ? 'Lakukan assessment melalui menu Physical Assessment, lalu hasil akan muncul di sini.'
                                            : 'Coba ubah filter atau kata kunci pencarian.' }}
                                    </p>
                                </div>
                            </td>
                        </tr>
                        <tr v-for="row in filteredHistory" :key="row.id" class="hover:bg-white/2 transition-colors">
                            <td class="px-5 py-3.5">
                                <div class="flex items-center gap-2.5">
                                    <div class="w-7 h-7 rounded-full bg-primary-500/15 border border-primary-500/20 flex items-center justify-center text-primary-300 text-xs font-bold flex-shrink-0">
                                        {{ initials(row.name) }}
                                    </div>
                                    <span class="text-sm font-medium text-white whitespace-nowrap">{{ row.name }}</span>
                                </div>
                            </td>
                            <td class="px-5 py-3.5 text-sm text-slate-300">{{ row.test }}</td>
                            <td class="px-5 py-3.5 hidden md:table-cell">
                                <span :class="['text-xs px-2 py-0.5 rounded-full font-medium', categoryBadge(row.category)]">{{ row.category }}</span>
                            </td>
                            <td class="px-5 py-3.5 hidden lg:table-cell">
                                <div class="flex items-center gap-1.5">
                                    <span class="text-sm text-slate-400">{{ row.result }}</span>
                                    <span v-if="row.estimated" class="text-xs text-yellow-500 italic">(est.)</span>
                                </div>
                            </td>
                            <td class="px-5 py-3.5 hidden lg:table-cell">
                                <span v-if="row.achievement != null"
                                      :class="['text-sm font-bold font-mono', achievementColor(row.achievement)]">
                                    {{ row.achievement }}%
                                </span>
                                <span v-else class="text-xs text-slate-600 italic">—</span>
                            </td>
                            <td class="px-5 py-3.5 hidden sm:table-cell">
                                <div>
                                    <p class="text-sm text-slate-500">{{ row.date }}</p>
                                    <p v-if="row.time" class="text-xs text-slate-600">{{ row.time }}</p>
                                </div>
                            </td>
                            <td class="px-5 py-3.5">
                                <button @click="openDetail(row)"
                                        class="text-xs text-primary-400 hover:text-primary-300 font-semibold transition-colors whitespace-nowrap">
                                    Lihat Detail
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="flex items-center justify-between px-5 py-3.5 border-t border-white/5">
                <span class="text-xs text-slate-500">Menampilkan {{ filteredHistory.length }} dari {{ historyData.length }} hasil</span>
                <span class="text-xs text-slate-600 italic">Data disimpan lokal di browser ini</span>
            </div>
        </div>

        <!-- ── Detail Modal ──────────────────────────────────────────────── -->
        <transition name="modal-fade">
            <div v-if="detailRow" class="fixed inset-0 z-50 flex items-center justify-center p-4">
                <!-- Backdrop -->
                <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="closeDetail"></div>

                <!-- Modal panel -->
                <div id="detail-print-area"
                     class="relative w-full max-w-lg bg-dark-900 border border-white/10 rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh] z-10">

                    <!-- Header -->
                    <div class="flex items-center justify-between px-6 py-4 border-b border-white/5">
                        <h2 class="text-base font-bold text-white">Detail Assessment</h2>
                        <div class="flex items-center gap-2">
                            <button @click="printDetail"
                                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold transition-all duration-200">
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                                </svg>
                                Export PDF
                            </button>
                            <button @click="closeDetail"
                                    class="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all duration-200">
                                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                            </button>
                        </div>
                    </div>

                    <!-- Content -->
                    <div class="px-6 py-5 space-y-5">

                        <!-- Informasi Assessment -->
                        <div>
                            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Informasi Assessment</p>
                            <div class="space-y-2">
                                <div class="flex justify-between">
                                    <span class="text-xs text-slate-500">Atlet</span>
                                    <span class="text-sm font-semibold text-white">{{ detailRow.name }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-xs text-slate-500">Tes</span>
                                    <span class="text-sm text-white">{{ detailRow.test }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-xs text-slate-500">Kategori</span>
                                    <span :class="['text-xs px-2 py-0.5 rounded-full font-medium', categoryBadge(detailRow.category)]">{{ detailRow.category }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-xs text-slate-500">Tanggal</span>
                                    <span class="text-xs text-slate-300">{{ detailRow.date }} {{ detailRow.time }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-xs text-slate-500">Durasi Sesi</span>
                                    <span class="text-xs font-mono text-slate-300">{{ formatDuration(detailRow.durationSec) }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-xs text-slate-500">Status</span>
                                    <span class="text-xs font-semibold text-emerald-400">Selesai</span>
                                </div>
                            </div>
                        </div>

                        <!-- Summary: Hasil + Benchmark + Pencapaian -->
                        <div class="p-4 rounded-xl bg-dark-950 border border-white/5 space-y-3">
                            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hasil</p>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-500">Nilai</span>
                                <div class="text-right">
                                    <span class="text-2xl font-black font-mono text-emerald-400">{{ detailRow.result }}</span>
                                    <span v-if="detailRow.estimated" class="block text-xs text-yellow-500 italic">Estimasi — belum dikalibrasi</span>
                                </div>
                            </div>
                            <template v-if="detailRow.benchmarkSnapshot">
                                <div class="flex items-center justify-between pt-2 border-t border-white/5">
                                    <span class="text-xs text-slate-500">Benchmark</span>
                                    <span class="text-sm font-mono text-slate-300">
                                        {{ detailRow.benchmarkSnapshot.value }} {{ detailRow.benchmarkSnapshot.unit }}
                                    </span>
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="text-xs text-slate-500">Pencapaian</span>
                                    <span class="text-xl font-black font-mono"
                                          :class="achievementColor(detailRow.achievement)">
                                        {{ detailRow.achievement != null ? `${detailRow.achievement}%` : '—' }}
                                    </span>
                                </div>
                                <div class="w-full h-2 rounded-full bg-dark-800 overflow-hidden">
                                    <div class="h-full rounded-full"
                                         :class="{
                                             'bg-emerald-500': detailRow.achievement >= 80,
                                             'bg-yellow-500':  detailRow.achievement >= 50 && detailRow.achievement < 80,
                                             'bg-red-500':     detailRow.achievement != null && detailRow.achievement < 50,
                                         }"
                                         :style="{ width: `${detailRow.achievement ?? 0}%` }">
                                    </div>
                                </div>
                            </template>
                            <p v-else class="text-xs text-slate-600 italic pt-2 border-t border-white/5">
                                Benchmark tidak tersedia untuk assessment ini.
                            </p>
                        </div>

                        <!-- Analisis Gerakan -->
                        <div>
                            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Analisis Gerakan</p>
                            <p class="text-xs text-slate-600 italic">
                                Video analisis belum tersedia untuk assessment ini.
                            </p>
                        </div>

                        <!-- Trainer Info -->
                        <div class="pt-3 border-t border-white/5 flex items-center justify-between">
                            <span class="text-xs text-slate-600">Trainer</span>
                            <span class="text-xs text-slate-400">Admin — Physical Trainer</span>
                        </div>
                    </div>
                </div>
            </div>
        </transition>

    </PhysicalAssessmentLayout>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import PhysicalAssessmentLayout from '@/Layouts/PhysicalAssessmentLayout.vue';

const props = defineProps({
    currentPage: { type: String, default: 'history' },
});

const emit = defineEmits(['navigate']);
function handleNavigate(page) { emit('navigate', page); }

const search     = ref('');
const filterTest = ref('');
const detailRow  = ref(null);   // baris yang sedang dibuka di modal

const testOptions = ['Keseimbangan Statis','Elbow Plank','Wall Sit','Deep Squat','Squat Jump','Push Up','Sit Up','Sit and Reach'];

const HISTORY_KEY = 'physassess_assessment_history';
const historyData = ref([]);

function loadFromLocalStorage() {
    try {
        const raw    = localStorage.getItem(HISTORY_KEY);
        if (!raw) { historyData.value = []; return; }
        const parsed = JSON.parse(raw);
        historyData.value = Array.isArray(parsed)
            ? parsed.map(entry => ({
                // Display fields
                id:                entry.id,
                name:              entry.athleteName      || 'Atlet',
                test:              entry.testName         || '—',
                category:          entry.category         || '—',
                result:            entry.resultDisplay    || `${entry.resultValue ?? '—'} ${entry.unit ?? ''}`.trim(),
                date:              entry.date             || '—',
                time:              entry.time             || '',
                estimated:         entry.estimated        || false,
                durationSec:       entry.durationSec      || 0,
                // Benchmark + achievement (backward-compatible — old records won't have these)
                benchmarkSnapshot: entry.benchmarkSnapshot || null,
                achievement:       entry.achievement       ?? null,
            }))
            : [];
    } catch (e) {
        console.warn('[PhysAssess] localStorage read failed:', e);
        historyData.value = [];
    }
}

onMounted(loadFromLocalStorage);
watch(() => props.currentPage, (val) => { if (val === 'history') loadFromLocalStorage(); });

function clearAllHistory() {
    if (confirm('Hapus seluruh riwayat assessment?')) {
        localStorage.removeItem(HISTORY_KEY);
        historyData.value = [];
    }
}

const filteredHistory = computed(() =>
    historyData.value.filter(row => {
        const q = search.value.toLowerCase();
        const matchSearch = !search.value ||
            row.name.toLowerCase().includes(q) ||
            row.test.toLowerCase().includes(q);
        const matchTest = !filterTest.value || row.test === filterTest.value;
        return matchSearch && matchTest;
    })
);

// ── Detail modal ──────────────────────────────────────────────────────────
function openDetail(row)  { detailRow.value = row; }
function closeDetail()    { detailRow.value = null; }

const PREVIEW_KEY = 'physassess_report_preview';

function printDetail() {
    if (!detailRow.value) return;
    // Store full entry data (need raw entry not mapped row)
    // Re-read from localStorage to get full data with benchmarkSnapshot
    try {
        const raw     = localStorage.getItem(HISTORY_KEY);
        const all     = raw ? JSON.parse(raw) : [];
        const fullEntry = all.find(e => e.id === detailRow.value.id);
        const payload   = fullEntry || detailRow.value;
        localStorage.setItem(PREVIEW_KEY, JSON.stringify(payload));
    } catch (_) {
        localStorage.setItem(PREVIEW_KEY, JSON.stringify(detailRow.value));
    }
    window.open('/report', '_blank');
}

// ── Helpers ───────────────────────────────────────────────────────────────
function initials(name) {
    if (!name || name === 'Atlet') return 'AT';
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function achievementColor(val) {
    if (val == null) return 'text-slate-500';
    if (val >= 80)  return 'text-emerald-400';
    if (val >= 50)  return 'text-yellow-400';
    return 'text-red-400';
}

function formatDuration(sec) {
    if (!sec) return '—';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m} menit ${s} detik` : `${s} detik`;
}

function categoryBadge(cat) {
    const map = {
        Balance:     'bg-violet-500/10 text-violet-400',
        Endurance:   'bg-blue-500/10 text-blue-400',
        Strength:    'bg-emerald-500/10 text-emerald-400',
        Mobility:    'bg-cyan-500/10 text-cyan-400',
        Power:       'bg-yellow-500/10 text-yellow-400',
        Flexibility: 'bg-pink-500/10 text-pink-400',
    };
    return map[cat] ?? 'bg-slate-500/10 text-slate-400';
}
</script>

<style>
/* Modal transition */
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to       { opacity: 0; }
</style>