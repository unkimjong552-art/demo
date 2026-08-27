<template>
    <header class="sticky top-0 z-40 flex items-center justify-between px-6 py-4 bg-dark-950/80 backdrop-blur-xl border-b border-white/5">

        <!-- Left: Breadcrumb / Page title -->
        <div class="flex items-center gap-3">
            <button
                @click="$emit('toggle-sidebar')"
                class="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all duration-200 lg:hidden"
            >
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
            </button>

            <div>
                <h1 class="text-lg font-semibold text-white leading-tight">{{ pageTitle }}</h1>
                <p class="text-xs text-slate-500">{{ pageSubtitle }}</p>
            </div>
        </div>

        <!-- Right: Actions + Profile -->
        <div class="flex items-center gap-3">

            <!-- Date -->
            <div class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
                <svg class="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                <span class="text-xs text-slate-400 font-medium">{{ currentDate }}</span>
            </div>

            <!-- Notification bell -->
            <button class="relative p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all duration-200">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                </svg>
                <span class="absolute top-1.5 right-1.5 w-2 h-2 bg-accent-500 rounded-full ring-2 ring-dark-950"></span>
            </button>

            <!-- Divider -->
            <div class="w-px h-6 bg-white/10"></div>

            <!-- User profile -->
            <div class="flex items-center gap-2.5 cursor-pointer group">
                <div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-bold shadow-md">
                    AD
                </div>
                <div class="hidden md:block">
                    <p class="text-sm font-semibold text-white leading-tight">Admin</p>
                    <p class="text-xs text-slate-500">Physical Trainer</p>
                </div>
                <svg class="w-4 h-4 text-slate-600 hidden md:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
            </div>
        </div>
    </header>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
    pageTitle: { type: String, default: 'Dashboard' },
    pageSubtitle: { type: String, default: 'Physical Assessment System' },
});

defineEmits(['toggle-sidebar']);

const currentDate = computed(() => {
    return new Date().toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
});
</script>
