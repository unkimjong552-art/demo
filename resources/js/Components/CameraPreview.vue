<template>
    <div class="relative w-full flex flex-col items-center">

        <!-- Camera viewport -->
        <div class="relative w-full rounded-2xl overflow-hidden bg-dark-950 border border-white/10"
             :style="{ aspectRatio: '16/9' }">

            <!-- Video element -->
            <video
                ref="videoRef"
                class="w-full h-full object-cover"
                :class="{ 'opacity-0': !isStreaming }"
                autoplay
                playsinline
                muted
            ></video>

            <!-- Overlay: Idle state (before permission request) -->
            <div v-if="status === 'idle'"
                 class="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-dark-950">
                <div class="w-16 h-16 rounded-full bg-primary-500/10 border border-primary-500/20 flex items-center justify-center">
                    <svg class="w-8 h-8 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.362a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                    </svg>
                </div>
                <div class="text-center px-4">
                    <p class="text-white font-semibold text-sm mb-1">Kamera Belum Aktif</p>
                    <p class="text-slate-500 text-xs">Klik "Aktifkan Kamera" untuk memulai</p>
                </div>
            </div>

            <!-- Overlay: Requesting permission -->
            <div v-if="status === 'requesting'"
                 class="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-dark-950">
                <div class="w-16 h-16 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                    <svg class="w-8 h-8 text-yellow-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.362a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                    </svg>
                </div>
                <div class="text-center px-4">
                    <p class="text-white font-semibold text-sm mb-1">Meminta Izin Kamera...</p>
                    <p class="text-slate-500 text-xs">Izinkan browser mengakses kamera Anda</p>
                </div>
            </div>

            <!-- Overlay: Permission denied -->
            <div v-if="status === 'denied'"
                 class="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-dark-950 p-6">
                <div class="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <svg class="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                    </svg>
                </div>
                <div class="text-center">
                    <p class="text-red-400 font-semibold text-sm mb-2">Akses Kamera Ditolak</p>
                    <p class="text-slate-400 text-xs leading-relaxed max-w-xs">
                        Browser memblokir akses kamera. Buka pengaturan browser dan izinkan akses kamera untuk situs ini, lalu coba lagi.
                    </p>
                </div>
                <button @click="retryCamera"
                        class="mt-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-semibold transition-all duration-200">
                    Coba Lagi
                </button>
            </div>

            <!-- Overlay: Error state -->
            <div v-if="status === 'error'"
                 class="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-dark-950 p-6">
                <div class="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                    <svg class="w-8 h-8 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                </div>
                <div class="text-center">
                    <p class="text-orange-400 font-semibold text-sm mb-2">Kamera Tidak Tersedia</p>
                    <p class="text-slate-400 text-xs leading-relaxed max-w-xs">{{ errorMessage }}</p>
                </div>
                <button @click="retryCamera"
                        class="mt-2 px-4 py-2 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-400 text-xs font-semibold transition-all duration-200">
                    Coba Lagi
                </button>
            </div>

            <!-- Live indicator (shown when streaming) -->
            <div v-if="isStreaming"
                 class="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/10">
                <span class="relative flex h-2 w-2">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span class="text-white text-xs font-semibold tracking-wide">LIVE</span>
            </div>

            <!-- Camera info overlay (shown when streaming) -->
            <div v-if="isStreaming"
                 class="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/10">
                <span class="text-slate-300 text-xs font-medium">{{ cameraLabel }}</span>
            </div>

            <!-- Slot untuk overlay tambahan (PoseDetector canvas, dsb.) -->
            <slot name="overlay" />

            <!-- Assessment active overlay (shown when assessing) -->
            <div v-if="isAssessing"
                 class="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-primary-600/80 backdrop-blur-sm border border-primary-500/30">
                <span class="relative flex h-2 w-2">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                <span class="text-white text-xs font-bold tracking-wider uppercase">Assessment Berjalan</span>
                <span class="text-primary-200 text-xs font-mono font-bold">{{ elapsedFormatted }}</span>
            </div>
        </div>

        <!-- Status bar below camera -->
        <div class="w-full mt-3 flex items-center justify-between px-1">
            <!-- Left: status indicator -->
            <div class="flex items-center gap-2">
                <div :class="['w-2 h-2 rounded-full', statusDotColor]"></div>
                <span class="text-xs font-medium" :class="statusTextColor">{{ statusLabel }}</span>
            </div>

            <!-- Right: resolution info -->
            <span v-if="isStreaming" class="text-xs text-slate-600 font-mono">
                {{ videoWidth }}×{{ videoHeight }}
            </span>
        </div>

    </div>
</template>

<script setup>
import { ref, computed, onUnmounted, watch } from 'vue';

const props = defineProps({
    isAssessing: { type: Boolean, default: false },
    elapsedSeconds: { type: Number, default: 0 },
});

const emit = defineEmits([
    'camera-ready',    // stream berhasil dibuka
    'camera-stopped',  // stream dihentikan
    'camera-error',    // error saat akses kamera
]);

// Refs
const videoRef    = ref(null);
const status      = ref('idle');       // idle | requesting | streaming | denied | error
const errorMessage = ref('');
const cameraLabel = ref('Kamera');
const videoWidth  = ref(0);
const videoHeight = ref(0);

let mediaStream = null;
let elapsedTimer = null;

// Computed
const isStreaming = computed(() => status.value === 'streaming');

const statusLabel = computed(() => {
    const map = {
        idle:       'Kamera tidak aktif',
        requesting: 'Meminta izin...',
        streaming:  'Kamera aktif',
        denied:     'Izin ditolak',
        error:      'Kamera error',
    };
    return map[status.value] ?? '-';
});

const statusDotColor = computed(() => {
    const map = {
        idle:       'bg-slate-600',
        requesting: 'bg-yellow-500 animate-pulse',
        streaming:  'bg-emerald-500',
        denied:     'bg-red-500',
        error:      'bg-orange-500',
    };
    return map[status.value] ?? 'bg-slate-600';
});

const statusTextColor = computed(() => {
    const map = {
        idle:       'text-slate-500',
        requesting: 'text-yellow-400',
        streaming:  'text-emerald-400',
        denied:     'text-red-400',
        error:      'text-orange-400',
    };
    return map[status.value] ?? 'text-slate-500';
});

const elapsedFormatted = computed(() => {
    const s = props.elapsedSeconds;
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
});

// Methods
async function startCamera() {
    if (mediaStream) return; // already streaming

    status.value = 'requesting';
    errorMessage.value = '';

    try {
        const constraints = {
            video: {
                facingMode: 'user',       // kamera depan
                width:  { ideal: 1280 },
                height: { ideal: 720 },
            },
            audio: false,
        };

        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

        if (videoRef.value) {
            videoRef.value.srcObject = mediaStream;
            await videoRef.value.play();

            // get track info
            const track = mediaStream.getVideoTracks()[0];
            if (track) {
                const settings = track.getSettings();
                videoWidth.value  = settings.width  ?? 0;
                videoHeight.value = settings.height ?? 0;
                cameraLabel.value = track.label || 'Kamera';
            }
        }

        status.value = 'streaming';
        emit('camera-ready', mediaStream);

    } catch (err) {
        mediaStream = null;

        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            status.value = 'denied';
            errorMessage.value = 'Izin kamera ditolak oleh browser atau pengguna.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            status.value = 'error';
            errorMessage.value = 'Tidak ada kamera yang ditemukan pada perangkat ini.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            status.value = 'error';
            errorMessage.value = 'Kamera sedang digunakan oleh aplikasi lain.';
        } else {
            status.value = 'error';
            errorMessage.value = `Error: ${err.message || err.name}`;
        }

        emit('camera-error', { name: err.name, message: errorMessage.value });
    }
}

function stopCamera() {
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    if (videoRef.value) {
        videoRef.value.srcObject = null;
    }
    status.value  = 'idle';
    videoWidth.value  = 0;
    videoHeight.value = 0;
    cameraLabel.value = 'Kamera';
    emit('camera-stopped');
}

function retryCamera() {
    status.value = 'idle';
    errorMessage.value = '';
    startCamera();
}

// Cleanup on unmount — penting agar stream tidak bocor
onUnmounted(() => {
    stopCamera();
});

// Expose methods + videoRef agar parent bisa memanggil dan mengambil elemen video
defineExpose({ startCamera, stopCamera, isStreaming, videoRef });
</script>
