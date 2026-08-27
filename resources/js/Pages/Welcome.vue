<template>
    <div class="min-h-screen bg-dark-950 flex flex-col">

        <!-- Animated background grid -->
        <div class="fixed inset-0 z-0 opacity-20"
             style="background-image: linear-gradient(rgba(14,165,233,0.15) 1px, transparent 1px),
                                     linear-gradient(90deg, rgba(14,165,233,0.15) 1px, transparent 1px);
                    background-size: 60px 60px;">
        </div>

        <!-- Glow orbs -->
        <div class="fixed top-0 left-1/4 w-96 h-96 rounded-full z-0 pointer-events-none"
             style="background: radial-gradient(circle, rgba(14,165,233,0.12) 0%, transparent 70%); filter: blur(40px);">
        </div>
        <div class="fixed bottom-0 right-1/4 w-96 h-96 rounded-full z-0 pointer-events-none"
             style="background: radial-gradient(circle, rgba(249,115,22,0.1) 0%, transparent 70%); filter: blur(40px);">
        </div>

        <!-- Header / Nav -->
        <header class="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/5">
            <div class="flex items-center gap-3">
                <!-- Logo mark -->
                <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/30">
                    <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round"
                              d="M13 10V3L4 14h7v7l9-11h-7z"/>
                    </svg>
                </div>
                <span class="font-display font-bold text-lg tracking-wider text-white uppercase">
                    PhysAssess
                </span>
            </div>
            <div class="flex items-center gap-2">
                <span class="px-3 py-1 rounded-full text-xs font-semibold bg-primary-500/10 text-primary-400 border border-primary-500/20">
                    v1.0 Beta
                </span>
            </div>
        </header>

        <!-- Hero Section -->
        <main class="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">

            <!-- Badge -->
            <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-sm font-medium mb-8">
                <span class="relative flex h-2 w-2">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
                </span>
                AI-Powered Physical Assessment Platform
            </div>

            <!-- Main title -->
            <h1 class="font-display font-bold text-6xl md:text-7xl lg:text-8xl tracking-wide uppercase mb-4 leading-none">
                <span class="text-white">Physical</span><br>
                <span class="bg-gradient-to-r from-primary-400 via-primary-300 to-accent-400 bg-clip-text text-transparent">
                    Assessment
                </span>
            </h1>

            <!-- Subtitle -->
            <p class="text-xl md:text-2xl text-slate-400 font-light mt-6 mb-4 max-w-2xl leading-relaxed">
                AI-Based Physical Fitness Assessment
            </p>
            <p class="text-base text-slate-500 max-w-xl leading-relaxed mb-12">
                Platform penilaian kebugaran fisik berbasis kecerdasan buatan dengan analisis pose real-time
                untuk mengukur performa atlet secara akurat dan objektif.
            </p>

            <!-- CTA Buttons -->
            <div class="flex flex-col sm:flex-row items-center gap-4 mb-16">
                <button class="btn-primary text-base px-8 py-4 shadow-lg shadow-primary-500/25">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Mulai Assessment
                </button>
                <button class="btn-secondary text-base px-8 py-4">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Lihat Demo
                </button>
            </div>

            <!-- Stats row -->
            <div class="flex flex-wrap justify-center gap-8 mb-20">
                <div v-for="stat in stats" :key="stat.label" class="text-center">
                    <div class="text-3xl font-display font-bold text-white mb-1">{{ stat.value }}</div>
                    <div class="text-sm text-slate-500">{{ stat.label }}</div>
                </div>
            </div>

            <!-- Test cards grid -->
            <div class="w-full max-w-5xl">
                <h2 class="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-6">
                    8 Tes Kebugaran Fisik
                </h2>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div
                        v-for="(test, index) in tests"
                        :key="test.name"
                        class="card p-5 group cursor-pointer hover:border-primary-500/30 hover:bg-dark-800/80 transition-all duration-300"
                    >
                        <!-- Number badge -->
                        <div class="flex items-start justify-between mb-4">
                            <span class="w-8 h-8 rounded-lg bg-primary-500/10 text-primary-400 text-sm font-bold font-display flex items-center justify-center">
                                {{ String(index + 1).padStart(2, '0') }}
                            </span>
                            <span :class="test.categoryColor" class="text-xs font-medium px-2 py-0.5 rounded-full">
                                {{ test.category }}
                            </span>
                        </div>

                        <!-- Icon -->
                        <div class="text-3xl mb-3">{{ test.icon }}</div>

                        <!-- Name -->
                        <h3 class="text-sm font-semibold text-white group-hover:text-primary-300 transition-colors leading-snug">
                            {{ test.name }}
                        </h3>
                        <p class="text-xs text-slate-500 mt-1">{{ test.target }}</p>
                    </div>
                </div>
            </div>
        </main>

        <!-- Footer -->
        <footer class="relative z-10 border-t border-white/5 px-8 py-5 flex items-center justify-between text-sm text-slate-600">
            <span>© 2026 Physical Assessment Platform</span>
            <span class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                System Ready
            </span>
        </footer>

    </div>
</template>

<script setup>
const stats = [
    { value: '8', label: 'Tes Fisik' },
    { value: 'AI', label: 'Pose Detection' },
    { value: 'Real-time', label: 'Analisis' },
    { value: '360°', label: 'Evaluasi' },
];

const tests = [
    {
        name: 'Keseimbangan Statis',
        icon: '🧍',
        target: 'Keseimbangan & Postur',
        category: 'Balance',
        categoryColor: 'bg-violet-500/10 text-violet-400',
    },
    {
        name: 'Elbow Plank',
        icon: '💪',
        target: 'Core Stability',
        category: 'Endurance',
        categoryColor: 'bg-blue-500/10 text-blue-400',
    },
    {
        name: 'Wall Sit',
        icon: '🦵',
        target: 'Kekuatan Kaki',
        category: 'Strength',
        categoryColor: 'bg-emerald-500/10 text-emerald-400',
    },
    {
        name: 'Deep Squat',
        icon: '🏋️',
        target: 'Fleksibilitas & Kekuatan',
        category: 'Mobility',
        categoryColor: 'bg-cyan-500/10 text-cyan-400',
    },
    {
        name: 'Squat Jump',
        icon: '⚡',
        target: 'Power Eksplosif',
        category: 'Power',
        categoryColor: 'bg-yellow-500/10 text-yellow-400',
    },
    {
        name: 'Push Up',
        icon: '🤸',
        target: 'Kekuatan Tubuh Atas',
        category: 'Strength',
        categoryColor: 'bg-emerald-500/10 text-emerald-400',
    },
    {
        name: 'Sit Up',
        icon: '🔄',
        target: 'Core Strength',
        category: 'Strength',
        categoryColor: 'bg-emerald-500/10 text-emerald-400',
    },
    {
        name: 'Sit and Reach',
        icon: '🧘',
        target: 'Fleksibilitas',
        category: 'Flexibility',
        categoryColor: 'bg-pink-500/10 text-pink-400',
    },
];
</script>
