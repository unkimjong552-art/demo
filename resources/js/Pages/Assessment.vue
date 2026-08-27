<template>
    <!-- Test selection view -->
    <PhysicalAssessmentLayout
        v-if="!activeTest"
        :current-page="currentPage"
        page-title="Physical Assessment"
        page-subtitle="Pilih tes kebugaran fisik yang ingin dilakukan"
        @navigate="handleNavigate"
    >
        <!-- Filter bar -->
        <div class="flex flex-wrap items-center gap-3 mb-6">
            <button
                v-for="filter in filters"
                :key="filter"
                @click="activeFilter = filter"
                :class="[
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    activeFilter === filter
                        ? 'bg-primary-600 text-white shadow-md shadow-primary-500/25'
                        : 'bg-dark-800 text-slate-400 hover:text-white border border-white/5 hover:border-white/10'
                ]"
            >
                {{ filter }}
            </button>

            <div class="ml-auto flex items-center gap-2 px-3 py-2 bg-dark-800 border border-white/5 rounded-lg">
                <svg class="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input
                    v-model="searchQuery"
                    type="text"
                    placeholder="Cari tes..."
                    class="bg-transparent text-sm text-white placeholder-slate-600 outline-none w-40"
                />
            </div>
        </div>

        <!-- Stats quick view -->
        <div class="grid grid-cols-3 gap-4 mb-6">
            <div class="card p-4 text-center">
                <p class="text-2xl font-bold font-display text-white">8</p>
                <p class="text-xs text-slate-500 mt-1">Total Tes</p>
            </div>
            <div class="card p-4 text-center">
                <p class="text-2xl font-bold font-display text-primary-400">{{ filteredTests.length }}</p>
                <p class="text-xs text-slate-500 mt-1">Ditampilkan</p>
            </div>
            <div class="card p-4 text-center">
                <p class="text-2xl font-bold font-display text-emerald-400">6</p>
                <p class="text-xs text-slate-500 mt-1">Kategori</p>
            </div>
        </div>

        <!-- Tests grid -->
        <div v-if="filteredTests.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <PhysicalTestCard
                v-for="test in filteredTests"
                :key="test.id"
                :test="test"
                @start-test="handleStartTest"
            />
        </div>

        <!-- Empty state -->
        <div v-else class="flex flex-col items-center justify-center py-20 text-center">
            <div class="text-5xl mb-4">🔍</div>
            <p class="text-lg font-semibold text-white mb-1">Tidak ada tes ditemukan</p>
            <p class="text-sm text-slate-500">Coba ubah filter atau kata kunci pencarian</p>
            <button @click="resetFilter" class="mt-4 btn-secondary text-sm px-5 py-2">
                Reset Filter
            </button>
        </div>

    </PhysicalAssessmentLayout>

    <!-- Camera session view (mounted in-place, no separate route) -->
    <AssessmentSession
        v-else
        :current-page="currentPage"
        :test="activeTest"
        @back="activeTest = null"
        @navigate="handleNavigate"
    />
</template>

<script setup>
import { ref, computed } from 'vue';
import PhysicalAssessmentLayout from '@/Layouts/PhysicalAssessmentLayout.vue';
import PhysicalTestCard from '@/Components/PhysicalTestCard.vue';
import AssessmentSession from '@/Pages/AssessmentSession.vue';

const props = defineProps({
    currentPage: { type: String, default: 'assessment' },
});

const emit = defineEmits(['navigate']);

const activeFilter = ref('Semua');
const searchQuery  = ref('');
const activeTest   = ref(null);     // null = pilih tes, Object = session aktif

const filters = ['Semua', 'Balance', 'Endurance', 'Strength', 'Mobility', 'Power', 'Flexibility'];

const physicalTests = [
    { id: 1, number: 1, name: 'Keseimbangan Statis', icon: '🧍', category: 'Balance',     unit: 'Detik (s)',       duration: '2-3 menit', description: 'Mengukur kemampuan atlet mempertahankan posisi seimbang berdiri di atas satu kaki selama mungkin.' },
    { id: 2, number: 2, name: 'Elbow Plank',         icon: '💪', category: 'Endurance',   unit: 'Detik (s)',       duration: '3-5 menit', description: 'Mengukur kekuatan dan ketahanan otot inti (core) dengan posisi plank menggunakan siku.' },
    { id: 3, number: 3, name: 'Wall Sit',             icon: '🦵', category: 'Strength',    unit: 'Detik (s)',       duration: '2-4 menit', description: 'Mengukur kekuatan dan ketahanan otot quadriceps dengan posisi duduk bersandar dinding.' },
    { id: 4, number: 4, name: 'Deep Squat',           icon: '🏋️', category: 'Mobility',    unit: 'Repetisi',        duration: '3-5 menit', description: 'Menilai mobilitas pinggul, pergelangan kaki, dan tulang belakang melalui gerakan squat penuh.' },
    { id: 5, number: 5, name: 'Squat Jump',           icon: '⚡', category: 'Power',       unit: 'Repetisi',        duration: '3-5 menit', description: 'Mengukur daya ledak (explosive power) otot kaki melalui gerakan squat yang dilanjutkan lompatan.' },
    { id: 6, number: 6, name: 'Push Up',              icon: '🤸', category: 'Strength',    unit: 'Repetisi',        duration: '3-5 menit', description: 'Mengukur kekuatan otot tubuh bagian atas, terutama dada, bahu, dan trisep melalui gerakan push up.' },
    { id: 7, number: 7, name: 'Sit Up',               icon: '🔄', category: 'Strength',    unit: 'Repetisi',        duration: '3-5 menit', description: 'Mengukur kekuatan dan ketahanan otot perut (abdominal) melalui gerakan sit up standar.' },
    { id: 8, number: 8, name: 'Sit and Reach',        icon: '🧘', category: 'Flexibility', unit: 'Sentimeter (cm)', duration: '2-3 menit', description: 'Mengukur fleksibilitas otot hamstring dan punggung bawah melalui gerakan meraih ujung kaki.' },
];

const filteredTests = computed(() => {
    let list = physicalTests;
    if (activeFilter.value !== 'Semua') {
        list = list.filter(t => t.category === activeFilter.value);
    }
    if (searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase();
        list = list.filter(t => t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
    }
    return list;
});

function handleStartTest(test) {
    activeTest.value = test;
}

function handleNavigate(page) {
    activeTest.value = null;    // reset session saat navigasi keluar
    emit('navigate', page);
}

function resetFilter() {
    activeFilter.value = 'Semua';
    searchQuery.value  = '';
}
</script>
