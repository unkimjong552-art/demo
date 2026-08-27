<template>
    <div class="min-h-screen bg-dark-950 flex">
        <!-- Sidebar -->
        <Sidebar
            :collapsed="sidebarCollapsed"
            :current-page="currentPage"
            @toggle-collapse="sidebarCollapsed = !sidebarCollapsed"
            @navigate="handleNavigate"
            class="hidden lg:flex"
        />

        <!-- Mobile sidebar overlay -->
        <transition name="fade">
            <div
                v-if="mobileSidebarOpen"
                class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                @click="mobileSidebarOpen = false"
            ></div>
        </transition>

        <!-- Mobile sidebar -->
        <div
            :class="[
                'fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-300',
                mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
            ]"
        >
            <Sidebar
                :collapsed="false"
                :current-page="currentPage"
                @toggle-collapse="mobileSidebarOpen = false"
                @navigate="handleNavigate"
            />
        </div>

        <!-- Main content -->
        <div
            :class="[
                'flex-1 flex flex-col min-w-0 transition-all duration-300',
                sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
            ]"
        >
            <!-- Header -->
            <Header
                :page-title="pageTitle"
                :page-subtitle="pageSubtitle"
                @toggle-sidebar="mobileSidebarOpen = !mobileSidebarOpen"
            />

            <!-- Page content -->
            <main class="flex-1 overflow-auto p-6">
                <slot />
            </main>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import Sidebar from '@/Components/Sidebar.vue';
import Header from '@/Components/Header.vue';

const props = defineProps({
    currentPage: { type: String, default: 'dashboard' },
    pageTitle: { type: String, default: 'Dashboard' },
    pageSubtitle: { type: String, default: 'Physical Assessment System' },
});

const emit = defineEmits(['navigate']);

const sidebarCollapsed = ref(false);
const mobileSidebarOpen = ref(false);

function handleNavigate(page) {
    mobileSidebarOpen.value = false;
    emit('navigate', page);
}
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
