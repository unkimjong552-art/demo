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
                <input
                    v-model="search"
                    type="text"
                    placeholder="Cari nama atlet atau tes..."
                    class="bg-transparent text-sm text-white placeholder-slate-600 outline-none w-52"
                />
            </div>

            <select v-model="filterTest" class="px-3 py-2 bg-dark-800 border border-white/5 rounded-lg text-sm text-slate-400 outline-none">
                <option value="">Semua Tes</option>
                <option v-for="t in testOptions" :key="t" :value="t">{{ t }}</option>
            </select>

            <div class="ml-auto flex items-center gap-2">
                <span class="text-xs text-slate-500">{{ filteredHistory.length }} hasil</span>
                <button class="flex items-center gap-2 px-4 py-2 bg-dark-800 border border-white/5 rounded-lg text-sm text-slate-400 hover:text-white transition-colors">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                    </svg>
                    Export
                </button>
            </div>
        </div>

        <!-- Table card -->
        <div class="card overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead>
                        <tr class="border-b border-white/5">
                            <th class="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Atlet</th>
                            <th class="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tes</th>
                            <th class="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Kategori</th>
                            <th class="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Hasil</th>
                            <th class="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Skor</th>
                            <th class="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Tanggal</th>
                            <th class="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-white/3">
                        <tr
                            v-for="row in filteredHistory"
                            :key="row.id"
                            class="hover:bg-white/2 transition-colors"
                        >
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
                            <td class="px-5 py-3.5 text-sm text-slate-400 hidden lg:table-cell">{{ row.result }}</td>
                            <td class="px-5 py-3.5">
                                <span :class="['text-sm font-bold font-display px-2 py-0.5 rounded', scoreBadge(row.score)]">{{ row.score }}</span>
                            </td>
                            <td class="px-5 py-3.5 text-sm text-slate-500 hidden sm:table-cell">{{ row.date }}</td>
                            <td class="px-5 py-3.5">
                                <span class="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    Selesai
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Pagination dummy -->
            <div class="flex items-center justify-between px-5 py-3.5 border-t border-white/5">
                <span class="text-xs text-slate-500">Menampilkan 1–{{ filteredHistory.length }} dari {{ historyData.length }}</span>
                <div class="flex items-center gap-1">
                    <button class="w-8 h-8 rounded-lg bg-dark-950 border border-white/5 text-slate-500 text-xs flex items-center justify-center hover:text-white transition-colors">‹</button>
                    <button class="w-8 h-8 rounded-lg bg-primary-600 text-white text-xs flex items-center justify-center font-bold">1</button>
                    <button class="w-8 h-8 rounded-lg bg-dark-950 border border-white/5 text-slate-500 text-xs flex items-center justify-center hover:text-white transition-colors">2</button>
                    <button class="w-8 h-8 rounded-lg bg-dark-950 border border-white/5 text-slate-500 text-xs flex items-center justify-center hover:text-white transition-colors">›</button>
                </div>
            </div>
        </div>

    </PhysicalAssessmentLayout>
</template>

<script setup>
import { ref, computed } from 'vue';
import PhysicalAssessmentLayout from '@/Layouts/PhysicalAssessmentLayout.vue';

const props = defineProps({
    currentPage: { type: String, default: 'history' },
});

const emit = defineEmits(['navigate']);

function handleNavigate(page) {
    emit('navigate', page);
}

const search = ref('');
const filterTest = ref('');

const testOptions = ['Keseimbangan Statis','Elbow Plank','Wall Sit','Deep Squat','Squat Jump','Push Up','Sit Up','Sit and Reach'];

const historyData = [
    { id:  1, name: 'Budi Santoso',   test: 'Push Up',              category: 'Strength',    result: '42 rep',    score: '85', date: '23 Agu 2026' },
    { id:  2, name: 'Sari Dewi',      test: 'Sit and Reach',        category: 'Flexibility', result: '28 cm',     score: '72', date: '23 Agu 2026' },
    { id:  3, name: 'Ahmad Fauzi',    test: 'Squat Jump',           category: 'Power',       result: '38 rep',    score: '91', date: '23 Agu 2026' },
    { id:  4, name: 'Rina Maharani',  test: 'Elbow Plank',         category: 'Endurance',   result: '68 detik',  score: '68', date: '22 Agu 2026' },
    { id:  5, name: 'Doni Prasetya',  test: 'Wall Sit',            category: 'Strength',    result: '55 detik',  score: '55', date: '22 Agu 2026' },
    { id:  6, name: 'Lestari Putri',  test: 'Keseimbangan Statis', category: 'Balance',     result: '88 detik',  score: '88', date: '22 Agu 2026' },
    { id:  7, name: 'Wahyu Setiawan', test: 'Deep Squat',          category: 'Mobility',    result: '30 rep',    score: '76', date: '21 Agu 2026' },
    { id:  8, name: 'Mega Anggraeni', test: 'Sit Up',              category: 'Strength',    result: '32 rep',    score: '63', date: '21 Agu 2026' },
    { id:  9, name: 'Rizky Pratama',  test: 'Push Up',             category: 'Strength',    result: '50 rep',    score: '95', date: '20 Agu 2026' },
    { id: 10, name: 'Dewi Kartika',   test: 'Sit and Reach',       category: 'Flexibility', result: '32 cm',     score: '80', date: '20 Agu 2026' },
    { id: 11, name: 'Hendra Wijaya',  test: 'Squat Jump',          category: 'Power',       result: '25 rep',    score: '62', date: '19 Agu 2026' },
    { id: 12, name: 'Nurul Fadillah', test: 'Elbow Plank',        category: 'Endurance',   result: '120 detik', score: '92', date: '19 Agu 2026' },
];

const filteredHistory = computed(() => {
    return historyData.filter(row => {
        const matchSearch = !search.value || row.name.toLowerCase().includes(search.value.toLowerCase()) || row.test.toLowerCase().includes(search.value.toLowerCase());
        const matchTest = !filterTest.value || row.test === filterTest.value;
        return matchSearch && matchTest;
    });
});

function initials(name) {
    return name.split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase();
}

function scoreBadge(score) {
    const n = parseInt(score);
    if (n >= 80) return 'bg-emerald-500/15 text-emerald-400';
    if (n >= 60) return 'bg-yellow-500/15 text-yellow-400';
    return 'bg-red-500/15 text-red-400';
}

function categoryBadge(cat) {
    const map = {
        Balance: 'bg-violet-500/10 text-violet-400',
        Endurance: 'bg-blue-500/10 text-blue-400',
        Strength: 'bg-emerald-500/10 text-emerald-400',
        Mobility: 'bg-cyan-500/10 text-cyan-400',
        Power: 'bg-yellow-500/10 text-yellow-400',
        Flexibility: 'bg-pink-500/10 text-pink-400',
    };
    return map[cat] ?? 'bg-slate-500/10 text-slate-400';
}
</script>
