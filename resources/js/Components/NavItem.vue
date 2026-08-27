<template>
    <button
        @click="$emit('navigate')"
        :class="[
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative',
            active
                ? 'bg-primary-500/15 text-primary-400 border border-primary-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
        ]"
    >
        <!-- Active indicator -->
        <div v-if="active" class="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary-400 rounded-r-full"></div>

        <!-- Icon -->
        <svg
            :class="['flex-shrink-0 w-5 h-5', active ? 'text-primary-400' : 'text-slate-500 group-hover:text-white']"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"
            v-html="item.icon"
        ></svg>

        <!-- Label -->
        <transition name="slide-fade">
            <span v-if="!collapsed" class="whitespace-nowrap overflow-hidden text-ellipsis">{{ item.name }}</span>
        </transition>

        <!-- Tooltip when collapsed -->
        <div
            v-if="collapsed"
            class="absolute left-full ml-3 px-2 py-1 bg-dark-800 border border-white/10 text-white text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 shadow-xl z-50"
        >
            {{ item.name }}
        </div>
    </button>
</template>

<script setup>
defineProps({
    item: Object,
    collapsed: Boolean,
    active: Boolean,
});
defineEmits(['navigate']);
</script>

<style scoped>
.slide-fade-enter-active { transition: all 0.2s ease; }
.slide-fade-leave-active { transition: all 0.15s ease; }
.slide-fade-enter-from { opacity: 0; transform: translateX(-8px); }
.slide-fade-leave-to { opacity: 0; }
</style>
