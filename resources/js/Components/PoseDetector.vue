<template>
    <!-- Canvas overlay yang ditumpuk tepat di atas video (display skeleton) -->
    <canvas
        ref="canvasRef"
        class="absolute inset-0 w-full h-full pointer-events-none"
        style="z-index: 10;"
    ></canvas>
</template>

<script setup>
/**
 * PoseDetector.vue  —  v3 (Tahap 8B: Deep Performance Diagnostic)
 *
 * Mengukur 6 komponen waktu secara terpisah per-frame:
 *
 *   T1. loopInterval     — interval total antar awal processFrame() ke awal berikutnya
 *                          (= 1/FPS loop aktual, mencakup semua idle time)
 *   T2. preprocessMs     — waktu drawImage() ke offscreen canvas (downscale)
 *   T3. sendMs           — waktu await poseInstance.send() selesai
 *                          (= waktu WASM inference sebenarnya)
 *   T4. drawMs           — waktu drawConnectors + drawLandmarks di canvas display
 *   T5. emitMs           — waktu emit pose-update (emit ke Vue parent)
 *   T6. idleMs           — total waktu loop TIDAK melakukan inference
 *                          (= loopInterval - sendMs, menunjukkan apakah rAF
 *                           membuat loop menunggu atau tidak)
 *
 * Diagnostic tambahan:
 *   - camera native FPS via video.getVideoPlaybackQuality() jika tersedia
 *   - dropped frames dari browser
 *   - devicePixelRatio
 *   - tab visibility state
 *   - video readyState per frame
 *
 * Perubahan behavior TIDAK ada — hanya instrumentasi.
 */

import { ref, watch, onUnmounted, onMounted } from 'vue';
import { Pose, POSE_CONNECTIONS } from '@mediapipe/pose';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG (tidak berubah dari Tahap 8A)
// ─────────────────────────────────────────────────────────────────────────────
const PERF_CONFIG = {
    INFERENCE_WIDTH:          640,
    INFERENCE_HEIGHT:         360,
    MODEL_COMPLEXITY:         0,
    MIN_DETECTION_CONFIDENCE: 0.5,
    MIN_TRACKING_CONFIDENCE:  0.4,
};

// ─── Props ───────────────────────────────────────────────────────────────────
const props = defineProps({
    videoElement: { type: Object, default: null },
    active:       { type: Boolean, default: false },
});

const emit = defineEmits(['pose-update', 'pose-status', 'perf-update']);

// ─── Refs ─────────────────────────────────────────────────────────────────────
const canvasRef = ref(null);

// ─── Internal state ───────────────────────────────────────────────────────────
let poseInstance      = null;
let animFrameId       = null;
let isRunning         = false;
let isInferenceActive = false;
let lastStatus        = null;

// Canvas dimensions cache
let canvasCachedW = 0;
let canvasCachedH = 0;

// Offscreen canvas
let offscreenCanvas = null;
let offscreenCtx    = null;

// Landmark target indices
const LANDMARK_NAMES = {
    0:'nose', 11:'l_shoulder',12:'r_shoulder',
    13:'l_elbow',14:'r_elbow',15:'l_wrist',16:'r_wrist',
    23:'l_hip',24:'r_hip',25:'l_knee',26:'r_knee',
    27:'l_ankle',28:'r_ankle',31:'l_foot',32:'r_foot',
};
const TARGET_INDICES = Object.keys(LANDMARK_NAMES).map(Number);

// ─────────────────────────────────────────────────────────────────────────────
// DEEP DIAGNOSTIC TIMERS
// Setiap komponen diukur dengan rolling average N=15 sampel terakhir.
// ─────────────────────────────────────────────────────────────────────────────
const N = 15; // rolling window size

// Helper: rolling stats accumulator
function makeStats() {
    return { buf: [], sum: 0, min: Infinity, max: 0 };
}
function statsAdd(s, v) {
    if (v <= 0 || v > 5000) return; // filter anomali
    s.buf.push(v);
    s.sum += v;
    if (s.buf.length > N) s.sum -= s.buf.shift();
    if (v < s.min) s.min = v;
    if (v > s.max) s.max = v;
}
function statsAvg(s) {
    return s.buf.length > 0 ? Math.round(s.sum / s.buf.length) : 0;
}
function statsMin(s) { return s.min === Infinity ? 0 : Math.round(s.min); }
function statsMax(s) { return Math.round(s.max); }

// T1 – total loop interval (awal frame ke awal frame berikutnya)
const stLoop       = makeStats();
// T2 – preprocessing drawImage()
const stPreprocess = makeStats();
// T3 – poseInstance.send() saja
const stSend       = makeStats();
// T4 – drawing (drawConnectors + drawLandmarks)
const stDraw       = makeStats();
// T5 – emit pose-update
const stEmit       = makeStats();
// T6 – idle = loopInterval - sendMs (rAF overhead + wait time)
const stIdle       = makeStats();

// Frame counters
let totalFrames   = 0;
let skippedFrames = 0;
let resultFrames  = 0; // berapa kali onPoseResults dipanggil

// Loop timing
let loopStartTime    = 0;  // awal processFrame() saat ini
let lastLoopStart    = 0;  // awal processFrame() sebelumnya (untuk T1)

// Inference timing — dipakai di processFrame() DAN onPoseResults()
// karena send() awaits sampai onResults callback selesai
let sendStartTime = 0;

// ─────────────────────────────────────────────────────────────────────────────
// EMIT PERF UPDATE (dipanggil setiap onPoseResults)
// ─────────────────────────────────────────────────────────────────────────────
function emitPerfUpdate() {
    const video = props.videoElement;

    // Loop FPS = 1000 / avgLoopInterval
    const avgLoop = statsAvg(stLoop);
    const loopFps = avgLoop > 0 ? Math.round(1000 / avgLoop) : 0;

    // Inference FPS = 1000 / avgSendMs (pure inference throughput)
    const avgSend = statsAvg(stSend);
    const inferenceFps = avgSend > 0 ? Math.round(1000 / avgSend) : 0;

    // Camera quality / dropped frames (Chrome/Edge only)
    let droppedFrames  = null;
    let totalVideoFrames = null;
    let corruptedFrames  = null;
    if (video && typeof video.getVideoPlaybackQuality === 'function') {
        try {
            const q = video.getVideoPlaybackQuality();
            droppedFrames    = q.droppedVideoFrames;
            totalVideoFrames = q.totalVideoFrames;
            corruptedFrames  = q.corruptedVideoFrames;
        } catch (_) { /* not supported */ }
    }

    emit('perf-update', {
        // ── FPS ──────────────────────────────────────────────────────
        loopFps,        // FPS aktual loop rAF (termasuk idle)
        inferenceFps,   // FPS jika hanya hitung inference time

        // ── T1: Loop interval ─────────────────────────────────────────
        loopAvgMs:  statsAvg(stLoop),
        loopMinMs:  statsMin(stLoop),
        loopMaxMs:  statsMax(stLoop),

        // ── T2: Preprocessing (downscale drawImage) ───────────────────
        preprocessAvgMs: statsAvg(stPreprocess),
        preprocessMinMs: statsMin(stPreprocess),
        preprocessMaxMs: statsMax(stPreprocess),

        // ── T3: pose.send() inference ─────────────────────────────────
        sendAvgMs: statsAvg(stSend),
        sendMinMs: statsMin(stSend),
        sendMaxMs: statsMax(stSend),

        // ── T4: Canvas drawing ────────────────────────────────────────
        drawAvgMs: statsAvg(stDraw),
        drawMinMs: statsMin(stDraw),
        drawMaxMs: statsMax(stDraw),

        // ── T5: Vue emit ──────────────────────────────────────────────
        emitAvgMs: statsAvg(stEmit),

        // ── T6: Idle time (loop - send) ───────────────────────────────
        idleAvgMs: statsAvg(stIdle),

        // ── Frame counters ────────────────────────────────────────────
        totalFrames,
        skippedFrames,
        resultFrames,

        // ── Video info ────────────────────────────────────────────────
        videoWidth:      video?.videoWidth  ?? 0,
        videoHeight:     video?.videoHeight ?? 0,
        videoReadyState: video?.readyState  ?? -1,
        inferenceWidth:  PERF_CONFIG.INFERENCE_WIDTH,
        inferenceHeight: PERF_CONFIG.INFERENCE_HEIGHT,

        // ── Browser info ──────────────────────────────────────────────
        devicePixelRatio:    window.devicePixelRatio ?? 1,
        tabVisible:          document.visibilityState === 'visible',
        droppedFrames,
        totalVideoFrames,
        corruptedFrames,
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// OFFSCREEN CANVAS
// ─────────────────────────────────────────────────────────────────────────────
function getOffscreenCanvas() {
    if (!offscreenCanvas) {
        offscreenCanvas         = document.createElement('canvas');
        offscreenCanvas.width   = PERF_CONFIG.INFERENCE_WIDTH;
        offscreenCanvas.height  = PERF_CONFIG.INFERENCE_HEIGHT;
        offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: false });
    }
    return { canvas: offscreenCanvas, ctx: offscreenCtx };
}

// ─── MediaPipe Init ───────────────────────────────────────────────────────────
function initPose() {
    if (poseInstance) return;

    poseInstance = new Pose({
        locateFile: (file) => `/mediapipe/pose/${file}`,
    });

    poseInstance.setOptions({
        modelComplexity:        PERF_CONFIG.MODEL_COMPLEXITY,
        smoothLandmarks:        true,
        enableSegmentation:     false,
        smoothSegmentation:     false,
        minDetectionConfidence: PERF_CONFIG.MIN_DETECTION_CONFIDENCE,
        minTrackingConfidence:  PERF_CONFIG.MIN_TRACKING_CONFIDENCE,
    });

    poseInstance.onResults(onPoseResults);
}

// ─── Destroy Pose ─────────────────────────────────────────────────────────────
async function destroyPose() {
    stopLoop();
    if (poseInstance) {
        try { await poseInstance.close(); } catch (_) {}
        poseInstance = null;
    }
    offscreenCanvas = null;
    offscreenCtx    = null;
    clearCanvas();
    emitStatus('searching');
}

// ─── Animation Loop ───────────────────────────────────────────────────────────
function startLoop() {
    if (isRunning) return;
    isRunning = true;
    scheduleFrame();
}

function stopLoop() {
    isRunning = false;
    if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
    }
    clearCanvas();
}

function scheduleFrame() {
    if (!isRunning) return;
    animFrameId = requestAnimationFrame(processFrame);
}

async function processFrame() {
    // ── T1: Catat loop interval dari awal frame ke awal frame ini ─────────
    loopStartTime = performance.now();
    if (lastLoopStart > 0) {
        statsAdd(stLoop, loopStartTime - lastLoopStart);
    }
    lastLoopStart = loopStartTime;

    // Guard: belum siap
    if (
        !isRunning          ||
        !poseInstance       ||
        !props.videoElement ||
        props.videoElement.readyState < 2 ||
        props.videoElement.paused         ||
        props.videoElement.ended
    ) {
        scheduleFrame();
        return;
    }

    // Guard: inference masih berjalan → skip
    if (isInferenceActive) {
        skippedFrames++;
        scheduleFrame();
        return;
    }

    totalFrames++;

    // ── T2: Preprocessing (downscale) ─────────────────────────────────────
    const t2Start = performance.now();
    const video   = props.videoElement;
    const { canvas: oc, ctx: octx } = getOffscreenCanvas();
    octx.drawImage(video, 0, 0, PERF_CONFIG.INFERENCE_WIDTH, PERF_CONFIG.INFERENCE_HEIGHT);
    statsAdd(stPreprocess, performance.now() - t2Start);

    // ── T3: pose.send() — WASM inference ──────────────────────────────────
    // PENTING: send() adalah Promise yang resolve SETELAH onPoseResults()
    // selesai dipanggil. Jadi T3 mencakup inference + drawing + emit.
    // T4 dan T5 diukur di dalam onPoseResults() untuk memisahkan komponen.
    isInferenceActive = true;
    sendStartTime     = performance.now();

    try {
        await poseInstance.send({ image: oc });
    } catch (_) {}

    // T3 selesai setelah await (yang berarti onPoseResults sudah selesai)
    statsAdd(stSend, performance.now() - sendStartTime);

    // T6: idle = loopInterval - sendTime (waktu yang tidak dipakai inference)
    const loopDuration = performance.now() - loopStartTime;
    const sendDuration = statsAvg(stSend);
    statsAdd(stIdle, Math.max(0, loopDuration - sendDuration));

    isInferenceActive = false;
    scheduleFrame();
}

// ─── Pose Results Handler ─────────────────────────────────────────────────────
function onPoseResults(results) {
    resultFrames++;

    if (!canvasRef.value) return;

    const canvas = canvasRef.value;
    const ctx    = canvas.getContext('2d');

    // Resize canvas hanya jika perlu
    const video   = props.videoElement;
    const targetW = video?.videoWidth  || video?.clientWidth  || 640;
    const targetH = video?.videoHeight || video?.clientHeight || 360;

    if (canvasCachedW !== targetW || canvasCachedH !== targetH) {
        canvas.width  = targetW;
        canvas.height = targetH;
        canvasCachedW = targetW;
        canvasCachedH = targetH;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!results.poseLandmarks) {
        emitStatus('lost');
        const t5s = performance.now();
        emit('pose-update', { landmarks: null, detectedCount: 0, visibility: 0 });
        statsAdd(stEmit, performance.now() - t5s);
        emitPerfUpdate();
        return;
    }

    const landmarks = results.poseLandmarks;

    // ── T4: Drawing ────────────────────────────────────────────────────────
    const t4Start = performance.now();

    drawConnectors(ctx, landmarks, POSE_CONNECTIONS, {
        color: 'rgba(6, 182, 212, 0.7)', lineWidth: 2,
    });
    drawLandmarks(ctx, landmarks, {
        color: 'rgba(16, 185, 129, 0.9)', fillColor: 'rgba(6, 182, 212, 0.6)',
        radius: 3, lineWidth: 1,
    });
    const targetLandmarks = TARGET_INDICES.map(i => landmarks[i]).filter(Boolean);
    drawLandmarks(ctx, targetLandmarks, {
        color: 'rgba(255, 255, 255, 0.95)', fillColor: 'rgba(16, 185, 129, 0.85)',
        radius: 5, lineWidth: 2,
    });

    statsAdd(stDraw, performance.now() - t4Start);

    // ── Hitung statistik landmark ──────────────────────────────────────────
    const detectedCount = TARGET_INDICES.reduce((count, i) => {
        const lm = landmarks[i];
        return count + (lm && lm.visibility > 0.5 ? 1 : 0);
    }, 0);

    const avgVisibility = TARGET_INDICES.reduce((sum, i) => {
        const lm = landmarks[i];
        return sum + (lm ? (lm.visibility ?? 0) : 0);
    }, 0) / TARGET_INDICES.length;

    // ── T5: Vue emit ───────────────────────────────────────────────────────
    emitStatus('detected');
    const t5Start = performance.now();
    emit('pose-update', {
        landmarks,
        detectedCount,
        totalTarget: TARGET_INDICES.length,
        visibility:  Math.round(avgVisibility * 100),
    });
    statsAdd(stEmit, performance.now() - t5Start);

    // Emit perf setelah semua komponen diukur
    emitPerfUpdate();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function clearCanvas() {
    if (canvasRef.value) {
        canvasRef.value.getContext('2d')
            .clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
    }
}

function emitStatus(status) {
    if (status !== lastStatus) {
        lastStatus = status;
        emit('pose-status', status);
    }
}

// ─── Watch ────────────────────────────────────────────────────────────────────
watch(() => props.active, async (isActive) => {
    if (isActive) { initPose(); startLoop(); emitStatus('searching'); }
    else { await destroyPose(); }
}, { immediate: false });

watch(() => props.videoElement, (newEl) => {
    if (props.active && newEl) startLoop();
});

onMounted(() => {
    if (props.active) { initPose(); startLoop(); emitStatus('searching'); }
});

onUnmounted(async () => {
    await destroyPose();
});
</script>
