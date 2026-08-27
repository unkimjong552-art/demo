<template>
    <PhysicalAssessmentLayout
        :current-page="currentPage"
        page-title="Athlete"
        page-subtitle="Manajemen data atlet"
        @navigate="handleNavigate"
    >
        <!-- Action bar -->
        <div class="flex flex-wrap items-center gap-3 mb-6">
            <div class="flex items-center gap-2 px-3 py-2 bg-dark-800 border border-white/5 rounded-lg">
                <svg class="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input
                    v-model="search"
                    type="text"
                    placeholder="Cari atlet..."
                    class="bg-transparent text-sm text-white placeholder-slate-600 outline-none w-48"
                />
            </div>

            <select v-model="filterCabor" class="px-3 py-2 bg-dark-800 border border-white/5 rounded-lg text-sm text-slate-400 outline-none">
                <option value="">Semua Cabor</option>
                <option v-for="c in caborOptions" :key="c" :value="c">{{ c }}</option>
            </select>

            <div class="ml-auto">
                <button class="btn-primary text-sm px-5 py-2.5">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                    </svg>
                    Tambah Atlet
                </button>
            </div>
        </div>

        <!-- Athlete grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div
                v-for="athlete in filteredAthletes"
                :key="athlete.id"
                class="card p-5 hover:border-white/10 transition-all duration-300 group"
            >
                <!-- Avatar + status -->
                <div class="flex items-start justify-between mb-4">
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500/20 to-primary-700/20 border border-primary-500/20 flex items-center justify-center text-primary-300 text-base font-bold">
                        {{ initials(athlete.name) }}
                    </div>
                    <span :class="['text-xs font-medium px-2.5 py-1 rounded-full', athlete.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-500']">
                        {{ athlete.active ? 'Aktif' : 'Tidak Aktif' }}
                    </span>
                </div>

                <!-- Info -->
                <h3 class="text-sm font-bold text-white mb-0.5 group-hover:text-primary-300 transition-colors">{{ athlete.name }}</h3>
                <p class="text-xs text-slate-500 mb-3">{{ athlete.cabor }}</p>

                <!-- Stats mini -->
                <div class="grid grid-cols-2 gap-2 mb-4">
                    <div class="bg-dark-950/50 rounded-lg p-2.5 text-center">
                        <p class="text-sm font-bold font-display text-white">{{ athlete.totalTests }}</p>
                        <p class="text-xs text-slate-600">Tes</p>
                    </div>
                    <div class="bg-dark-950/50 rounded-lg p-2.5 text-center">
                        <p class="text-sm font-bold font-display" :class="scoreColor(athlete.avgScore)">{{ athlete.avgScore }}</p>
                        <p class="text-xs text-slate-600">Avg Skor</p>
                    </div>
                </div>

                <!-- Actions -->
                <div class="flex gap-2">
                    <button class="flex-1 py-2 text-xs font-semibold rounded-lg bg-primary-600/15 hover:bg-primary-600/30 text-primary-400 transition-colors">
                        Detail
                    </button>
                    <button class="flex-1 py-2 text-xs font-semibold rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                        Tes Baru
                    </button>
                </div>
            </div>
        </div>

        <!-- Empty state -->
        <div v-if="filteredAthletes.length === 0" class="flex flex-col items-center justify-center py-20 text-center">
            <div class="text-5xl mb-4">🏃</div>
            <p class="text-lg font-semibold text-white mb-1">Tidak ada atlet ditemukan</p>
            <p class="text-sm text-slate-500">Coba ubah filter pencarian</p>
        </div>

    </PhysicalAssessmentLayout>
</template>

<script setup>
import { ref, computed } from 'vue';
import PhysicalAssessmentLayout from '@/Layouts/PhysicalAssessmentLayout.vue';

const props = defineProps({
    currentPage: { type: String, default: 'athlete' },
});

const emit = defineEmits(['navigate']);

function handleNavigate(page) {
    emit('navigate', page);
}

const search = ref('');
const filterCabor = ref('');

const caborOptions = ['Sepak Bola','Basket','Voli','Renang','Atletik','Badminton','Tinju','Bela Diri'];

const athletes = [
    { id:  1, name: 'Budi Santoso',    cabor: 'Sepak Bola',  totalTests: 12, avgScore: '82', active: true  },
    { id:  2, name: 'Sari Dewi',       cabor: 'Renang',      totalTests:  8, avgScore: '74', active: true  },
    { id:  3, name: 'Ahmad Fauzi',     cabor: 'Atletik',     totalTests: 15, avgScore: '91', active: true  },
    { id:  4, name: 'Rina Maharani',   cabor: 'Voli',        totalTests:  6, avgScore: '68', active: true  },
    { id:  5, name: 'Doni Prasetya',   cabor: 'Basket',      totalTests: 10, avgScore: '55', active: false },
    { id:  6, name: 'Lestari Putri',   cabor: 'Badminton',   totalTests:  9, avgScore: '88', active: true  },
    { id:  7, name: 'Wahyu Setiawan',  cabor: 'Tinju',       totalTests: 14, avgScore: '76', active: true  },
    { id:  8, name: 'Mega Anggraeni',  cabor: 'Bela Diri',   totalTests:  7, avgScore: '63', active: true  },
    { id:  9, name: 'Rizky Pratama',   cabor: 'Atletik',     totalTests: 18, avgScore: '95', active: true  },
    { id: 10, name: 'Dewi Kartika',    cabor: 'Renang',      totalTests: 11, avgScore: '80', active: true  },
    { id: 11, name: 'Hendra Wijaya',   cabor: 'Sepak Bola',  totalTests:  5, avgScore: '62', active: false },
    { id: 12, name: 'Nurul Fadillah',  cabor: 'Badminton',   totalTests: 13, avgScore: '92', active: true  },
];

const filteredAthletes = computed(() => {
    return athletes.filter(a => {
        const matchSearch = !search.value || a.name.toLowerCase().includes(search.value.toLowerCase());
        const matchCabor = !filterCabor.value || a.cabor === filterCabor.value;
        return matchSearch && matchCabor;
    });
});

function initials(name) {
    return name.split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase();
}

function scoreColor(score) {
    const n = parseInt(score);
    if (n >= 80) return 'text-emerald-400';
    if (n >= 60) return 'text-yellow-400';
    return 'text-red-400';
}
</script>
