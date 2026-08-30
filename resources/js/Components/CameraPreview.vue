<template>
    <div class="relative w-full flex flex-col items-center">

        <!-- Camera viewport -->
        <div
            ref="cameraContainerRef"
            class="relative w-full rounded-2xl overflow-hidden bg-dark-950 border border-white/10 touch-none"
            :style="{ aspectRatio: '16/9' }"
        >
            <!-- Video element -->
            <video
                ref="videoRef"
                class="w-full h-full object-cover"
                :class="{ 'opacity-0': !isStreaming }"
                autoplay
                playsinline
                muted
            ></video>

            <!-- Overlay: Idle state -->
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

            <!-- Overlay: Requesting -->
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
                        Buka pengaturan browser dan izinkan akses kamera untuk situs ini, lalu coba lagi.
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

            <!-- Live indicator -->
            <div v-if="isStreaming"
                 class="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/10">
                <span class="relative flex h-2 w-2">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span class="text-white text-xs font-semibold tracking-wide">LIVE</span>
            </div>

            <!-- Camera label + flip button row (top right) -->
            <div v-if="isStreaming" class="absolute top-3 right-3 flex items-center gap-2">
                <!-- Camera facing label -->
                <div class="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/10">
                    <span class="text-slate-300 text-xs font-medium">
                        {{ facingMode === 'environment' ? '📷 Belakang' : '🤳 Depan' }}
                    </span>
                </div>
                <!-- Flip camera button — only when multiple cameras available -->
                <button
                    v-if="hasMutipleCamera && !isSwitching"
                    @click="flipCamera"
                    title="Ganti Kamera"
                    class="p-1.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 text-white hover:bg-black/70 transition-all duration-200 active:scale-95"
                >
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                        <circle cx="12" cy="12" r="3" stroke="none" fill="currentColor"/>
                    </svg>
                </button>
                <!-- Switching indicator -->
                <div v-if="isSwitching"
                     class="p-1.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 text-yellow-400">
                    <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                    </svg>
                </div>
            </div>

            <!-- Swipe hint — mobile only, shown briefly then fades -->
            <div v-if="isStreaming && showSwipeHint && hasMutipleCamera"
                 class="absolute bottom-12 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 pointer-events-none">
                <span class="text-slate-300 text-xs">↔ Geser untuk ganti kamera</span>
            </div>

            <!-- Assessment active overlay -->
            <div v-if="isAssessing"
                 class="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-primary-600/80 backdrop-blur-sm border border-primary-500/30">
                <span class="relative flex h-2 w-2">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                <span class="text-white text-xs font-bold tracking-wider uppercase">Assessment Berjalan</span>
                <span class="text-primary-200 text-xs font-mono font-bold">{{ elapsedFormatted }}</span>
            </div>

            <!-- Camera flip error toast -->
            <transition name="toast">
                <div v-if="flipError"
                     class="absolute bottom-3 left-3 right-3 px-3 py-2 rounded-xl bg-orange-500/90 backdrop-blur-sm text-white text-xs font-medium text-center">
                    {{ flipError }}
                </div>
            </transition>

            <!-- Overlay slot (PoseDetector canvas) -->
            <slot name="overlay" />
        </div>

        <!-- Status bar below camera -->
        <div class="w-full mt-3 flex items-center justify-between px-1">
            <div class="flex items-center gap-2">
                <div :class="['w-2 h-2 rounded-full', statusDotColor]"></div>
                <span class="text-xs font-medium" :class="statusTextColor">{{ statusLabel }}</span>
            </div>
            <span v-if="isStreaming" class="text-xs text-slate-600 font-mono">
                {{ videoWidth }}×{{ videoHeight }}
            </span>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onUnmounted, watch } from 'vue';

const props = defineProps({
    isAssessing:    { type: Boolean, default: false },
    elapsedSeconds: { type: Number,  default: 0 },
});

const emit = defineEmits(['camera-ready', 'camera-stopped', 'camera-error']);

// ── Refs ──────────────────────────────────────────────────────────────────
const videoRef           = ref(null);
const cameraContainerRef = ref(null);
const status             = ref('idle');
const errorMessage       = ref('');
const cameraLabel        = ref('Kamera');
const videoWidth         = ref(0);
const videoHeight        = ref(0);
const facingMode         = ref('environment'); // default: back camera
const hasMutipleCamera   = ref(false);
const isSwitching        = ref(false);
const flipError          = ref('');
const showSwipeHint      = ref(false);

let mediaStream        = null;
let swipeTouchStartX   = 0;
let swipeTouchStartY   = 0;
let swipeHintTimer     = null;
let flipErrorTimer     = null;

const SWIPE_THRESHOLD  = 70;
const SWIPE_DIR_RATIO  = 1.5;

// ── Computed ──────────────────────────────────────────────────────────────
const isStreaming = computed(() => status.value === 'streaming');

const statusLabel = computed(() => ({
    idle:       'Kamera tidak aktif',
    requesting: 'Meminta izin...',
    streaming:  'Kamera aktif',
    denied:     'Izin ditolak',
    error:      'Kamera error',
}[status.value] ?? '-'));

const statusDotColor = computed(() => ({
    idle:       'bg-slate-600',
    requesting: 'bg-yellow-500 animate-pulse',
    streaming:  'bg-emerald-500',
    denied:     'bg-red-500',
    error:      'bg-orange-500',
}[status.value] ?? 'bg-slate-600'));

const statusTextColor = computed(() => ({
    idle:       'text-slate-500',
    requesting: 'text-yellow-400',
    streaming:  'text-emerald-400',
    denied:     'text-red-400',
    error:      'text-orange-400',
}[status.value] ?? 'text-slate-500'));

const elapsedFormatted = computed(() => {
    const s = props.elapsedSeconds;
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
});

// ── Camera helpers ────────────────────────────────────────────────────────
async function detectMultipleCameras() {
    try {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams    = devices.filter(d => d.kind === 'videoinput');
        hasMutipleCamera.value = cams.length > 1;
    } catch (_) {
        hasMutipleCamera.value = false;
    }
}

function stopCurrentStream() {
    if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
    }
    if (videoRef.value) videoRef.value.srcObject = null;
}

function showFlipError(msg) {
    flipError.value = msg;
    clearTimeout(flipErrorTimer);
    flipErrorTimer = setTimeout(() => { flipError.value = ''; }, 3500);
}

// ── Start camera ──────────────────────────────────────────────────────────
async function startCamera(requestedFacing = 'environment') {
    if (mediaStream) return; // already streaming
    status.value       = 'requesting';
    errorMessage.value = '';

    const constraints = {
        video: {
            facingMode: { ideal: requestedFacing },
            width:      { ideal: 1280 },
            height:     { ideal: 720 },
        },
        audio: false,
    };

    try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        await _applyStream(mediaStream, requestedFacing);
        await detectMultipleCameras();
        _showSwipeHintBriefly();
    } catch (err) {
        // If back camera unavailable, try front
        if (requestedFacing === 'environment') {
            try {
                const fallbackConstraints = { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false };
                mediaStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
                await _applyStream(mediaStream, 'user');
                await detectMultipleCameras();
                return;
            } catch (_) { /* fall through to error handler */ }
        }
        _handleCameraError(err);
    }
}

async function _applyStream(stream, facing) {
    if (!videoRef.value) return;
    videoRef.value.srcObject = stream;
    await videoRef.value.play();
    const track    = stream.getVideoTracks()[0];
    const settings = track?.getSettings() ?? {};
    videoWidth.value  = settings.width  ?? 0;
    videoHeight.value = settings.height ?? 0;
    cameraLabel.value = track?.label ?? 'Kamera';
    facingMode.value  = facing;
    status.value      = 'streaming';
    emit('camera-ready', stream);
}

function _handleCameraError(err) {
    stopCurrentStream();
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        status.value       = 'denied';
        errorMessage.value = 'Izin kamera ditolak oleh browser atau pengguna.';
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        status.value       = 'error';
        errorMessage.value = 'Tidak ada kamera yang ditemukan pada perangkat ini.';
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        status.value       = 'error';
        errorMessage.value = 'Kamera sedang digunakan oleh aplikasi lain.';
    } else {
        status.value       = 'error';
        errorMessage.value = `Kamera tidak dapat diakses. (${err.name ?? 'Unknown error'})`;
    }
    emit('camera-error', { name: err.name, message: errorMessage.value });
}

// ── Flip camera (safe — does NOT reset assessment state) ──────────────────
async function flipCamera() {
    if (!isStreaming.value || isSwitching.value) return;
    isSwitching.value = true;
    flipError.value   = '';

    const nextFacing = facingMode.value === 'environment' ? 'user' : 'environment';

    try {
        const constraints = {
            video: { facingMode: { ideal: nextFacing }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
        };
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);

        // Stop old stream ONLY after new stream is obtained
        stopCurrentStream();
        mediaStream = newStream;
        await _applyStream(newStream, nextFacing);
        _showSwipeHintBriefly();
    } catch (err) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            showFlipError('Tidak dapat mengganti kamera. Pastikan izin kamera sudah diberikan.');
        } else if (err.name === 'NotFoundError') {
            showFlipError(`Kamera ${nextFacing === 'environment' ? 'belakang' : 'depan'} tidak tersedia.`);
        } else {
            showFlipError('Tidak dapat mengganti kamera saat ini. Coba lagi.');
        }
    } finally {
        isSwitching.value = false;
    }
}

// ── Stop camera ───────────────────────────────────────────────────────────
function stopCamera() {
    stopCurrentStream();
    status.value      = 'idle';
    videoWidth.value  = 0;
    videoHeight.value = 0;
    cameraLabel.value = 'Kamera';
    emit('camera-stopped');
}

function retryCamera() {
    status.value       = 'idle';
    errorMessage.value = '';
    startCamera(facingMode.value);
}

// ── Swipe gesture on camera area ──────────────────────────────────────────
function onCameraTouchStart(e) {
    swipeTouchStartX = e.touches[0].clientX;
    swipeTouchStartY = e.touches[0].clientY;
}

function onCameraTouchEnd(e) {
    if (!isStreaming.value || !hasMutipleCamera.value || isSwitching.value) return;
    const dx = e.changedTouches[0].clientX - swipeTouchStartX;
    const dy = e.changedTouches[0].clientY - swipeTouchStartY;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (Math.abs(dx) < Math.abs(dy) * SWIPE_DIR_RATIO) return;
    flipCamera();
}

function _showSwipeHintBriefly() {
    if (!hasMutipleCamera.value) return;
    showSwipeHint.value = true;
    clearTimeout(swipeHintTimer);
    swipeHintTimer = setTimeout(() => { showSwipeHint.value = false; }, 3000);
}

// Attach swipe events to camera container via Vue template touch handlers
// (done in template via @touchstart / @touchend on cameraContainerRef)
// We expose via watch for when the ref is set
watch(cameraContainerRef, (el) => {
    if (!el) return;
    el.addEventListener('touchstart', onCameraTouchStart, { passive: true });
    el.addEventListener('touchend',   onCameraTouchEnd,   { passive: true });
});

onUnmounted(() => {
    stopCamera();
    clearTimeout(swipeHintTimer);
    clearTimeout(flipErrorTimer);
    if (cameraContainerRef.value) {
        cameraContainerRef.value.removeEventListener('touchstart', onCameraTouchStart);
        cameraContainerRef.value.removeEventListener('touchend',   onCameraTouchEnd);
    }
});

defineExpose({ startCamera, stopCamera, isStreaming, videoRef, flipCamera });
</script>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.toast-enter-from, .toast-leave-to       { opacity: 0; transform: translateY(8px); }
</style>
