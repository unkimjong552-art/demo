<template>
    <div class="card p-5 flex flex-col group hover:border-primary-500/20 hover:shadow-lg hover:shadow-primary-500/5 transition-all duration-300 cursor-default">

        <!-- Top row: icon + category badge -->
        <div class="flex items-start justify-between mb-4">
            <div class="text-3xl select-none">{{ test.icon }}</div>
            <span :class="['text-xs font-semibold px-2.5 py-1 rounded-full', categoryStyle.badge]">
                {{ test.category }}
            </span>
        </div>

        <!-- Test number + name -->
        <div class="mb-3">
            <span class="text-xs font-bold text-slate-600 font-display tracking-wider">
                TES #{{ String(test.number).padStart(2, '0') }}
            </span>
            <h3 class="text-base font-bold text-white mt-0.5 group-hover:text-primary-300 transition-colors leading-snug">
                {{ test.name }}
            </h3>
        </div>

        <!-- Description -->
        <p class="text-xs text-slate-500 leading-relaxed flex-1 mb-4">
            {{ test.description }}
        </p>

        <!-- Meta row: unit + duration -->
        <div class="flex items-center gap-3 mb-4">
            <div class="flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                </svg>
                <span class="text-xs text-slate-500">{{ test.unit }}</span>
            </div>
            <div class="flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span class="text-xs text-slate-500">{{ test.duration }}</span>
            </div>
        </div>

        <!-- CTA Button -->
        <button
            @click="$emit('start-test', test)"
            class="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200
                   bg-primary-600/20 hover:bg-primary-600 text-primary-300 hover:text-white
                   border border-primary-500/20 hover:border-primary-500 hover:shadow-md hover:shadow-primary-500/20"
        >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Mulai Tes
        </button>
    </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
    test: { type: Object, required: true },
});

defineEmits(['start-test']);

const categoryStyles = {
    'Balance':     { badge: 'bg-violet-500/10 text-violet-400 border border-violet-500/20' },
    'Endurance':   { badge: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
    'Strength':    { badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
    'Mobility':    { badge: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' },
    'Power':       { badge: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' },
    'Flexibility': { badge: 'bg-pink-500/10 text-pink-400 border border-pink-500/20' },
};

const categoryStyle = computed(() =>
    categoryStyles[props.test.category] ?? { badge: 'bg-slate-500/10 text-slate-400 border border-slate-500/20' }
);
</script>
