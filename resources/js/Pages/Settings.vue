<template>
    <PhysicalAssessmentLayout
        :current-page="currentPage"
        page-title="Settings"
        page-subtitle="Konfigurasi sistem Physical Assessment"
        @navigate="handleNavigate"
    >
        <div class="max-w-3xl space-y-6">

            <!-- Profile section -->
            <div class="card p-6">
                <h3 class="text-base font-semibold text-white mb-5 flex items-center gap-2">
                    <svg class="w-5 h-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                    </svg>
                    Profil Pengguna
                </h3>
                <div class="flex items-center gap-5 mb-5">
                    <div class="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-primary-500/25">AD</div>
                    <div>
                        <p class="text-sm font-bold text-white">Admin</p>
                        <p class="text-xs text-slate-500">Physical Trainer • admin@physassess.com</p>
                        <button class="mt-1.5 text-xs text-primary-400 hover:text-primary-300 transition-colors">Ubah foto profil</button>
                    </div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 mb-1.5">Nama</label>
                        <input value="Admin" type="text" class="w-full px-3 py-2.5 bg-dark-950 border border-white/10 rounded-lg text-sm text-white outline-none focus:border-primary-500/50 transition-colors"/>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 mb-1.5">Email</label>
                        <input value="admin@physassess.com" type="email" class="w-full px-3 py-2.5 bg-dark-950 border border-white/10 rounded-lg text-sm text-white outline-none focus:border-primary-500/50 transition-colors"/>
                    </div>
                </div>
            </div>

            <!-- System section -->
            <div class="card p-6">
                <h3 class="text-base font-semibold text-white mb-5 flex items-center gap-2">
                    <svg class="w-5 h-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2"/>
                    </svg>
                    Pengaturan Sistem
                </h3>
                <div class="space-y-4">
                    <div v-for="setting in systemSettings" :key="setting.key" class="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                        <div>
                            <p class="text-sm font-medium text-white">{{ setting.label }}</p>
                            <p class="text-xs text-slate-500 mt-0.5">{{ setting.description }}</p>
                        </div>
                        <button
                            @click="setting.value = !setting.value"
                            :class="['relative w-11 h-6 rounded-full transition-colors duration-200', setting.value ? 'bg-primary-600' : 'bg-dark-800 border border-white/10']"
                        >
                            <span :class="['absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200', setting.value ? 'translate-x-5' : 'translate-x-0']"></span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- About -->
            <div class="card p-6">
                <h3 class="text-base font-semibold text-white mb-4 flex items-center gap-2">
                    <svg class="w-5 h-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Tentang Aplikasi
                </h3>
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div><p class="text-slate-500 text-xs mb-0.5">Nama Aplikasi</p><p class="text-white font-medium">Physical Assessment</p></div>
                    <div><p class="text-slate-500 text-xs mb-0.5">Versi</p><p class="text-white font-medium">v1.0.0 Beta</p></div>
                    <div><p class="text-slate-500 text-xs mb-0.5">Framework</p><p class="text-white font-medium">Laravel 12 + Vue 3</p></div>
                    <div><p class="text-slate-500 text-xs mb-0.5">AI Engine</p><p class="text-yellow-400 font-medium">Coming Soon</p></div>
                </div>
            </div>

            <!-- Save button -->
            <div class="flex justify-end gap-3">
                <button class="btn-secondary px-6 py-2.5 text-sm">Reset</button>
                <button class="btn-primary px-6 py-2.5 text-sm">Simpan Perubahan</button>
            </div>

        </div>
    </PhysicalAssessmentLayout>
</template>

<script setup>
import { reactive } from 'vue';
import PhysicalAssessmentLayout from '@/Layouts/PhysicalAssessmentLayout.vue';

const props = defineProps({
    currentPage: { type: String, default: 'settings' },
});

const emit = defineEmits(['navigate']);

function handleNavigate(page) {
    emit('navigate', page);
}

const systemSettings = reactive([
    { key: 'notifications', label: 'Notifikasi', description: 'Aktifkan notifikasi sistem', value: true },
    { key: 'darkMode', label: 'Dark Mode', description: 'Tampilan gelap (aktif secara default)', value: true },
    { key: 'autoSave', label: 'Auto-Save', description: 'Simpan hasil assessment secara otomatis', value: true },
    { key: 'aiPose', label: 'AI Pose Detection', description: 'Aktifkan MediaPipe Pose Estimation (Coming Soon)', value: false },
    { key: 'webcam', label: 'Webcam Auto-Start', description: 'Otomatis aktifkan kamera saat memulai tes (Coming Soon)', value: false },
]);
</script>
