<template>
    <div class="flex items-center gap-4 py-3 px-4 rounded-lg hover:bg-white/3 transition-colors duration-150 group">
        <!-- Avatar -->
        <div class="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-primary-500/30 to-primary-700/30 border border-primary-500/20 flex items-center justify-center text-primary-300 text-xs font-bold">
            {{ initials(item.name) }}
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-white truncate">{{ item.name }}</p>
            <p class="text-xs text-slate-500 truncate">{{ item.test }}</p>
        </div>

        <!-- Score badge -->
        <div :class="['flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold font-display', scoreBadge(item.score)]">
            {{ item.score }}
        </div>

        <!-- Date -->
        <div class="flex-shrink-0 text-xs text-slate-600 hidden sm:block">{{ item.date }}</div>

        <!-- Status -->
        <div :class="['flex-shrink-0 w-2 h-2 rounded-full', item.status === 'completed' ? 'bg-emerald-500' : 'bg-yellow-500']"></div>
    </div>
</template>

<script setup>
const props = defineProps({
    item: { type: Object, required: true },
});

function initials(name) {
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function scoreBadge(score) {
    const n = parseInt(score);
    if (n >= 80) return 'bg-emerald-500/15 text-emerald-400';
    if (n >= 60) return 'bg-yellow-500/15 text-yellow-400';
    return 'bg-red-500/15 text-red-400';
}
</script>
