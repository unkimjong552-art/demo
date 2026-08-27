<template>
    <div class="card p-5 relative overflow-hidden group hover:border-white/10 transition-all duration-300">
        <!-- Background glow -->
        <div
            :class="['absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 blur-xl transition-opacity duration-300 group-hover:opacity-20', glowColor]"
        ></div>

        <div class="relative z-10">
            <div class="flex items-start justify-between mb-4">
                <!-- Icon -->
                <div :class="['w-10 h-10 rounded-xl flex items-center justify-center', iconBg]">
                    <svg class="w-5 h-5" :class="iconColor" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
                         v-html="icon">
                    </svg>
                </div>

                <!-- Trend badge -->
                <div v-if="trend !== null" :class="['flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold', trendPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400']">
                    <svg class="w-3 h-3" :class="trendPositive ? 'rotate-0' : 'rotate-180'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18"/>
                    </svg>
                    {{ Math.abs(trend) }}%
                </div>
            </div>

            <div>
                <p class="text-3xl font-bold font-display text-white mb-1">{{ value }}</p>
                <p class="text-sm font-medium text-slate-400">{{ label }}</p>
                <p v-if="subtitle" class="text-xs text-slate-600 mt-0.5">{{ subtitle }}</p>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
    label: { type: String, required: true },
    value: { type: [String, Number], required: true },
    subtitle: { type: String, default: '' },
    icon: { type: String, required: true },
    color: { type: String, default: 'blue' }, // blue | green | orange | violet
    trend: { type: Number, default: null },
    trendPositive: { type: Boolean, default: true },
});

const colorMap = {
    blue:   { iconBg: 'bg-primary-500/10',  iconColor: 'text-primary-400',  glowColor: 'bg-primary-500' },
    green:  { iconBg: 'bg-emerald-500/10',  iconColor: 'text-emerald-400',  glowColor: 'bg-emerald-500' },
    orange: { iconBg: 'bg-accent-500/10',   iconColor: 'text-accent-400',   glowColor: 'bg-accent-500' },
    violet: { iconBg: 'bg-violet-500/10',   iconColor: 'text-violet-400',   glowColor: 'bg-violet-500' },
};

const iconBg    = computed(() => colorMap[props.color]?.iconBg    ?? colorMap.blue.iconBg);
const iconColor = computed(() => colorMap[props.color]?.iconColor ?? colorMap.blue.iconColor);
const glowColor = computed(() => colorMap[props.color]?.glowColor ?? colorMap.blue.glowColor);
</script>
