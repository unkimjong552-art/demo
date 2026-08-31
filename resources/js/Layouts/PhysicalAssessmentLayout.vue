<template>
    <div class="min-h-screen bg-dark-950 flex overflow-x-hidden">

        <!-- ── Desktop sidebar (md+) ───────────────────────────────────────── -->
        <Sidebar
            v-show="isDesktop"
            :collapsed="sidebarCollapsed"
            :current-page="currentPage"
            @toggle-collapse="sidebarCollapsed = !sidebarCollapsed"
            @navigate="handleNavigate"
        />

        <!-- ── Mobile sidebar overlay ─────────────────────────────────────── -->
        <transition name="fade">
            <div
                v-if="!isDesktop && mobileSidebarOpen"
                class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                @click="mobileSidebarOpen = false"
            ></div>
        </transition>

        <!-- ── Mobile sidebar drawer ──────────────────────────────────────── -->
        <div
            v-show="!isDesktop"
            :class="[
                'fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300 ease-in-out',
                mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
            ]"
        >
            <Sidebar
                :collapsed="false"
                :mobile="true"
                :current-page="currentPage"
                @toggle-collapse="mobileSidebarOpen = false"
                @navigate="handleNavigate"
            />
        </div>

        <!-- ── Main content ────────────────────────────────────────────────── -->
        <div
            :style="isDesktop ? (sidebarCollapsed ? 'margin-left:4rem' : 'margin-left:16rem') : 'margin-left:0'"
            class="flex-1 flex flex-col min-w-0 transition-all duration-300 w-full overflow-x-hidden"
        >
            <!-- Header -->
            <Header
                :page-title="pageTitle"
                :page-subtitle="pageSubtitle"
                @toggle-sidebar="mobileSidebarOpen = !mobileSidebarOpen"
            />

            <!-- Page content -->
            <main class="flex-1 overflow-auto p-4 md:p-6">
                <slot />
            </main>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import Sidebar from '@/Components/Sidebar.vue';
import Header from '@/Components/Header.vue';

const props = defineProps({
    currentPage:   { type: String, default: 'dashboard' },
    pageTitle:     { type: String, default: 'Dashboard' },
    pageSubtitle:  { type: String, default: 'Physical Assessment System' },
});

const emit = defineEmits(['navigate']);

const sidebarCollapsed  = ref(false);
const mobileSidebarOpen = ref(false);
const isDesktop         = ref(true);

// ── Breakpoint check ──────────────────────────────────────────────────────
function checkDesktop() {
    isDesktop.value = window.innerWidth >= 768; // md breakpoint
    if (isDesktop.value) mobileSidebarOpen.value = false;
}

// ── Swipe-to-open/close sidebar on mobile ─────────────────────────────────
let swipeTouchStartX = 0;
let swipeTouchStartY = 0;
const SWIPE_THRESHOLD    = 60;   // px minimum horizontal movement
const SWIPE_EDGE_ZONE    = 32;   // px from left edge to trigger open swipe
const SWIPE_DIR_RATIO    = 1.5;  // horizontal must be 1.5x vertical

function onTouchStart(e) {
    if (isDesktop.value) return;
    swipeTouchStartX = e.touches[0].clientX;
    swipeTouchStartY = e.touches[0].clientY;
}

function onTouchEnd(e) {
    if (isDesktop.value) return;
    const dx = e.changedTouches[0].clientX - swipeTouchStartX;
    const dy = e.changedTouches[0].clientY - swipeTouchStartY;

    // Gesture must be more horizontal than vertical
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (Math.abs(dx) < Math.abs(dy) * SWIPE_DIR_RATIO) return;

    if (dx > 0 && swipeTouchStartX < SWIPE_EDGE_ZONE && !mobileSidebarOpen.value) {
        // Swipe right from left edge → open
        mobileSidebarOpen.value = true;
    } else if (dx < 0 && mobileSidebarOpen.value) {
        // Swipe left → close
        mobileSidebarOpen.value = false;
    }
}

onMounted(() => {
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend',   onTouchEnd,   { passive: true });
});

onUnmounted(() => {
    window.removeEventListener('resize', checkDesktop);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchend',   onTouchEnd);
});

function handleNavigate(page) {
    mobileSidebarOpen.value = false;
    emit('navigate', page);
}
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to       { opacity: 0; }
</style>
