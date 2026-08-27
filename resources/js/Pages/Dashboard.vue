<template>
    <PhysicalAssessmentLayout
        :current-page="currentPage"
        page-title="Dashboard"
        page-subtitle="Selamat datang kembali, Admin"
        @navigate="handleNavigate"
    >
        <!-- Welcome banner -->
        <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-900/50 via-primary-800/30 to-dark-800 border border-primary-500/20 p-6 mb-6">
            <div class="absolute right-0 top-0 w-64 h-full opacity-10"
                 style="background: radial-gradient(circle at right, #0ea5e9 0%, transparent 70%);">
            </div>
            <div class="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <p class="text-xs font-semibold text-primary-400 uppercase tracking-widest mb-1">Physical Assessment System</p>
                    <h2 class="text-2xl font-display font-bold text-white mb-1">
                        Selamat Datang, <span class="text-primary-300">Admin! 👋</span>
                    </h2>
                    <p class="text-slate-400 text-sm max-w-lg">
                        Kelola dan pantau tes kebugaran fisik atlet menggunakan platform AI-based assessment.
                        {{ today }}
                    </p>
                </div>
                <button
                    @click="handleNavigate('assessment')"
                    class="flex-shrink-0 btn-primary shadow-lg shadow-primary-500/25"
                >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                    </svg>
                    Mulai Assessment
                </button>
            </div>
        </div>

        <!-- Stats grid -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
                v-for="stat in stats"
                :key="stat.label"
                :label="stat.label"
                :value="stat.value"
                :subtitle="stat.subtitle"
                :icon="stat.icon"
                :color="stat.color"
                :trend="stat.trend"
                :trend-positive="stat.trendPositive"
            />
        </div>

        <!-- Two column: Recent + Quick Start -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

            <!-- Recent Assessment (2/3) -->
            <div class="lg:col-span-2 card p-5">
                <div class="flex items-center justify-between mb-5">
                    <div>
                        <h3 class="text-base font-semibold text-white">Riwayat Assessment Terkini</h3>
                        <p class="text-xs text-slate-500 mt-0.5">10 assessment terakhir</p>
                    </div>
                    <button @click="handleNavigate('history')" class="text-xs font-medium text-primary-400 hover:text-primary-300 transition-colors">
                        Lihat semua →
                    </button>
                </div>

                <div class="space-y-1">
                    <RecentAssessmentRow
                        v-for="item in recentAssessments"
                        :key="item.id"
                        :item="item"
                    />
                </div>
            </div>

            <!-- Activity overview (1/3) -->
            <div class="card p-5">
                <h3 class="text-base font-semibold text-white mb-5">Aktivitas Minggu Ini</h3>

                <div class="space-y-4">
                    <div v-for="act in weeklyActivity" :key="act.day" class="flex items-center gap-3">
                        <span class="w-8 text-xs text-slate-500 font-medium">{{ act.day }}</span>
                        <div class="flex-1 bg-dark-950 rounded-full h-2 overflow-hidden">
                            <div
                                :class="['h-full rounded-full transition-all duration-500', act.count > 0 ? 'bg-primary-500' : 'bg-transparent']"
                                :style="{ width: `${(act.count / 12) * 100}%` }"
                            ></div>
                        </div>
                        <span class="w-5 text-right text-xs font-bold font-display" :class="act.count > 0 ? 'text-white' : 'text-slate-700'">
                            {{ act.count }}
                        </span>
                    </div>
                </div>

                <div class="mt-5 pt-4 border-t border-white/5">
                    <div class="flex items-center justify-between text-xs">
                        <span class="text-slate-500">Total minggu ini</span>
                        <span class="font-bold text-white font-display">47 assessment</span>
                    </div>
                    <div class="flex items-center justify-between text-xs mt-1">
                        <span class="text-slate-500">Rata-rata/hari</span>
                        <span class="font-bold text-emerald-400 font-display">6.7</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Physical Tests section -->
        <div class="mb-2 flex items-center justify-between">
            <div>
                <h3 class="text-base font-semibold text-white">Available Physical Tests</h3>
                <p class="text-xs text-slate-500 mt-0.5">8 tes kebugaran fisik tersedia</p>
            </div>
            <button @click="handleNavigate('assessment')" class="text-xs font-medium text-primary-400 hover:text-primary-300 transition-colors">
                Lihat semua →
            </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <PhysicalTestCard
                v-for="test in physicalTests"
                :key="test.id"
                :test="test"
                @start-test="handleStartTest"
            />
        </div>

    </PhysicalAssessmentLayout>
</template>

<script setup>
import { ref, computed } from 'vue';
import PhysicalAssessmentLayout from '@/Layouts/PhysicalAssessmentLayout.vue';
import StatCard from '@/Components/StatCard.vue';
import PhysicalTestCard from '@/Components/PhysicalTestCard.vue';
import RecentAssessmentRow from '@/Components/RecentAssessmentRow.vue';

const props = defineProps({
    currentPage: { type: String, default: 'dashboard' },
});

const emit = defineEmits(['navigate']);

function handleNavigate(page) {
    emit('navigate', page);
}

function handleStartTest(test) {
    alert(`Memulai tes: ${test.name}\n(Fitur AI akan diimplementasikan pada tahap berikutnya)`);
}

const today = computed(() => {
    return new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
});

const stats = [
    {
        label: 'Total Atlet',
        value: '128',
        subtitle: 'Atlet terdaftar',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>',
        color: 'blue',
        trend: 12,
        trendPositive: true,
    },
    {
        label: 'Total Assessment',
        value: '1,284',
        subtitle: 'Sepanjang waktu',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>',
        color: 'green',
        trend: 8,
        trendPositive: true,
    },
    {
        label: 'Assessment Hari Ini',
        value: '23',
        subtitle: 'Per hari ini',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>',
        color: 'orange',
        trend: 15,
        trendPositive: true,
    },
    {
        label: 'Rata-rata Skor',
        value: '74.2',
        subtitle: 'Skor rata-rata semua tes',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>',
        color: 'violet',
        trend: 3,
        trendPositive: true,
    },
];

const recentAssessments = [
    { id: 1, name: 'Budi Santoso',    test: 'Push Up',             score: '85', date: 'Hari ini',   status: 'completed' },
    { id: 2, name: 'Sari Dewi',       test: 'Sit and Reach',       score: '72', date: 'Hari ini',   status: 'completed' },
    { id: 3, name: 'Ahmad Fauzi',     test: 'Squat Jump',          score: '91', date: 'Hari ini',   status: 'completed' },
    { id: 4, name: 'Rina Maharani',   test: 'Elbow Plank',         score: '68', date: 'Kemarin',    status: 'completed' },
    { id: 5, name: 'Doni Prasetya',   test: 'Wall Sit',            score: '55', date: 'Kemarin',    status: 'completed' },
    { id: 6, name: 'Lestari Putri',   test: 'Keseimbangan Statis', score: '88', date: 'Kemarin',    status: 'completed' },
    { id: 7, name: 'Wahyu Setiawan',  test: 'Deep Squat',          score: '76', date: '2 hari lalu', status: 'completed' },
    { id: 8, name: 'Mega Anggraeni',  test: 'Sit Up',              score: '63', date: '2 hari lalu', status: 'completed' },
];

const weeklyActivity = [
    { day: 'Sen', count: 8 },
    { day: 'Sel', count: 12 },
    { day: 'Rab', count: 6 },
    { day: 'Kam', count: 9 },
    { day: 'Jum', count: 7 },
    { day: 'Sab', count: 3 },
    { day: 'Min', count: 2 },
];

const physicalTests = [
    { id: 1, number: 1, name: 'Keseimbangan Statis', icon: '🧍', category: 'Balance',     unit: 'Detik (s)',  duration: '2-3 menit', description: 'Mengukur kemampuan atlet mempertahankan posisi seimbang berdiri di atas satu kaki selama mungkin.' },
    { id: 2, number: 2, name: 'Elbow Plank',         icon: '💪', category: 'Endurance',   unit: 'Detik (s)',  duration: '3-5 menit', description: 'Mengukur kekuatan dan ketahanan otot inti (core) dengan posisi plank menggunakan siku.' },
    { id: 3, number: 3, name: 'Wall Sit',             icon: '🦵', category: 'Strength',    unit: 'Detik (s)',  duration: '2-4 menit', description: 'Mengukur kekuatan dan ketahanan otot quadriceps dengan posisi duduk bersandar dinding.' },
    { id: 4, number: 4, name: 'Deep Squat',           icon: '🏋️', category: 'Mobility',    unit: 'Repetisi',   duration: '3-5 menit', description: 'Menilai mobilitas pinggul, pergelangan kaki, dan tulang belakang melalui gerakan squat penuh.' },
    { id: 5, number: 5, name: 'Squat Jump',           icon: '⚡', category: 'Power',       unit: 'Repetisi',   duration: '3-5 menit', description: 'Mengukur daya ledak (explosive power) otot kaki melalui gerakan squat yang dilanjutkan dengan lompatan.' },
    { id: 6, number: 6, name: 'Push Up',              icon: '🤸', category: 'Strength',    unit: 'Repetisi',   duration: '3-5 menit', description: 'Mengukur kekuatan otot tubuh bagian atas, terutama dada, bahu, dan trisep melalui gerakan push up standar.' },
    { id: 7, number: 7, name: 'Sit Up',               icon: '🔄', category: 'Strength',    unit: 'Repetisi',   duration: '3-5 menit', description: 'Mengukur kekuatan dan ketahanan otot perut (abdominal) melalui gerakan sit up standar.' },
    { id: 8, number: 8, name: 'Sit and Reach',        icon: '🧘', category: 'Flexibility', unit: 'Sentimeter (cm)', duration: '2-3 menit', description: 'Mengukur fleksibilitas otot hamstring dan punggung bawah melalui gerakan meraih ujung kaki dari posisi duduk.' },
];
</script>
