<template>
    <aside
        :class="[
            'flex flex-col bg-dark-900 border-r border-white/5 transition-all duration-300',
            mobile
                ? 'relative h-full w-64'
                : 'fixed inset-y-0 left-0 z-50',
            !mobile && (collapsed ? 'w-16' : 'w-64')
        ]"
    >
        <!-- Logo -->
        <div class="flex items-center gap-3 px-4 py-5 border-b border-white/5 min-h-[72px]">
            <div class="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/30">
                <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
            </div>
            <transition name="fade">
                <div v-if="!collapsed" class="overflow-hidden flex-1">
                    <span class="block font-display font-bold text-sm tracking-wider text-white uppercase leading-tight">PhysAssess</span>
                    <span class="block text-xs text-slate-500 font-medium">v1.0 Beta</span>
                </div>
            </transition>
            <!-- Close button on mobile -->
            <button
                v-if="mobile"
                @click="$emit('toggle-collapse')"
                class="ml-auto p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all duration-200"
            >
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        </div>

        <!-- Navigation -->
        <nav class="flex-1 px-2 py-4 space-y-1 overflow-y-auto scrollbar-thin">
            <div v-if="!collapsed" class="px-3 pb-2">
                <span class="text-xs font-semibold text-slate-600 uppercase tracking-widest">Main</span>
            </div>

            <NavItem
                v-for="item in mainNav"
                :key="item.name"
                :item="item"
                :collapsed="collapsed"
                :active="currentPage === item.page"
                @navigate="$emit('navigate', item.page)"
            />

            <div v-if="!collapsed" class="px-3 pt-4 pb-2">
                <span class="text-xs font-semibold text-slate-600 uppercase tracking-widest">System</span>
            </div>
            <div v-else class="my-3 border-t border-white/5"></div>

            <NavItem
                v-for="item in systemNav"
                :key="item.name"
                :item="item"
                :collapsed="collapsed"
                :active="currentPage === item.page"
                @navigate="$emit('navigate', item.page)"
            />
        </nav>

        <!-- Collapse toggle — hanya di desktop -->
        <div v-if="!mobile" class="px-2 py-4 border-t border-white/5">
            <button
                @click="$emit('toggle-collapse')"
                class="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all duration-200 group"
            >
                <svg
                    :class="['w-4 h-4 transition-transform duration-300', collapsed ? 'rotate-180' : '']"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
                >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/>
                </svg>
                <transition name="fade">
                    <span v-if="!collapsed" class="text-xs font-medium">Collapse</span>
                </transition>
            </button>
        </div>
    </aside>
</template>

<script setup>
import NavItem from './NavItem.vue';

const props = defineProps({
    collapsed: { type: Boolean, default: false },
    currentPage: { type: String, default: 'dashboard' },
    mobile: { type: Boolean, default: false },
});

defineEmits(['toggle-collapse', 'navigate']);

const mainNav = [
    {
        name: 'Dashboard',
        page: 'dashboard',
        icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>`,
    },
    {
        name: 'Physical Assessment',
        page: 'assessment',
        icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>`,
    },
    {
        name: 'Riwayat Assessment',
        page: 'history',
        icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>`,
    },
    {
        name: 'Athlete',
        page: 'athlete',
        icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>`,
    },
];

const systemNav = [
    {
        name: 'Settings',
        page: 'settings',
        icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>`,
    },
];
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.scrollbar-thin::-webkit-scrollbar { width: 3px; }
.scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
.scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
</style>
