/**
 * usePoseValidation.js
 *
 * Composable untuk memvalidasi kualitas pose sebelum assessment dimulai.
 *
 * Status keluaran (4 level):
 *   NO_BODY          — tidak ada tubuh terdeteksi
 *   BODY_DETECTED    — tubuh terdeteksi, tapi validasi belum lengkap
 *   POSITION_INVALID — tubuh terdeteksi tapi posisi/kualitas tidak memenuhi syarat
 *   READY            — pose valid dan stabil, siap untuk assessment
 *
 * Semua threshold ada di bagian VALIDATION CONFIG di bawah.
 * Ubah nilai di sana jika perlu kalibrasi ulang.
 */

import { ref, computed } from 'vue';

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION CONFIG
// Semua nilai threshold dikumpulkan di sini agar mudah dikalibrasi.
// ─────────────────────────────────────────────────────────────────────────────

export const VALIDATION_CONFIG = {
    /**
     * Visibility minimum per landmark (0.0 – 1.0).
     * Landmark dengan visibility di bawah ini dianggap tidak terdeteksi.
     */
    MIN_VISIBILITY: 0.5,

    /**
     * Jumlah minimum landmark target yang harus terdeteksi
     * (dari 15 target: nose, shoulders, elbows, wrists, hips, knees, ankles, feet).
     * Posisi dianggap valid jika >= MIN_VALID_LANDMARKS landmark memenuhi MIN_VISIBILITY.
     */
    MIN_VALID_LANDMARKS: 10,

    /**
     * Rata-rata visibility minimum seluruh landmark target (0–100 dalam persen).
     * Di bawah nilai ini → POSITION_INVALID (tubuh terlalu jauh / buram).
     */
    MIN_AVG_VISIBILITY: 55,

    /**
     * Margin minimum dari tepi frame (dalam koordinat normalized 0.0–1.0).
     * Landmark penting tidak boleh lebih dekat dari nilai ini ke tepi.
     * Mencegah tubuh yang terpotong di luar frame.
     */
    FRAME_MARGIN: 0.05,

    /**
     * Ukuran tubuh minimum relatif terhadap frame (0.0–1.0).
     * Dihitung dari jarak vertikal bahu-ke-pinggul.
     * Jika terlalu kecil → user terlalu jauh dari kamera.
     */
    MIN_BODY_SIZE: 0.15,

    /**
     * Ukuran tubuh maksimum relatif terhadap frame (0.0–1.0).
     * Jika terlalu besar → user terlalu dekat, badan terpotong.
     */
    MAX_BODY_SIZE: 0.95,

    /**
     * Jumlah frame berturut-turut yang harus valid sebelum status naik ke READY.
     * Mencegah flickering saat landmark sesaat hilang.
     * ~30fps: 15 frame ≈ 0.5 detik
     */
    STABLE_FRAMES_REQUIRED: 15,

    /**
     * Jumlah frame berturut-turut yang invalid sebelum status turun dari READY.
     * Dinaikkan dari 10 ke 20 agar validation tidak jatuh saat user bergerak
     * melakukan gerakan fisik (landmark bergerak cepat sesaat).
     * ~8fps: 20 frame ≈ 2.5 detik toleransi sebelum READY dicabut.
     */
    UNSTABLE_FRAMES_REQUIRED: 20,

    /**
     * Landmark penting yang diprioritaskan untuk cek margin frame.
     * Indices MediaPipe Pose:
     * 11=left_shoulder, 12=right_shoulder, 23=left_hip, 24=right_hip
     */
    CORE_LANDMARK_INDICES: [11, 12, 23, 24],

    /**
     * Landmark minimal yang WAJIB ada (visibility > MIN_VISIBILITY).
     * Jika salah satu tidak ada → minimal BODY_DETECTED, bukan READY.
     * 0=nose, 11=left_shoulder, 12=right_shoulder, 23=left_hip, 24=right_hip
     */
    REQUIRED_LANDMARK_INDICES: [0, 11, 12, 23, 24],
};

// ─────────────────────────────────────────────────────────────────────────────
// STATUS CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const VALIDATION_STATUS = {
    NO_BODY:          'NO_BODY',
    BODY_DETECTED:    'BODY_DETECTED',
    POSITION_INVALID: 'POSITION_INVALID',
    READY:            'READY',
};

// ─────────────────────────────────────────────────────────────────────────────
// UI MESSAGES — pesan yang ditampilkan ke user per status
// ─────────────────────────────────────────────────────────────────────────────

export const VALIDATION_MESSAGES = {
    NO_BODY:          'Silakan masuk ke dalam kamera',
    BODY_DETECTED:    'Tubuh terdeteksi — sesuaikan posisi',
    POSITION_INVALID: 'Posisi tubuh belum sesuai',
    READY:            'Posisi siap — assessment dapat dimulai',
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSABLE
// ─────────────────────────────────────────────────────────────────────────────

export function usePoseValidation(config = {}) {
    // Merge config default dengan override dari caller
    const cfg = { ...VALIDATION_CONFIG, ...config };

    // ── Optional custom evaluator ─────────────────────────────────────────────
    // Jika disediakan, dipakai menggantikan evaluateFrame() bawaan.
    // Signature: (landmarks, detectedCount, avgVisibility) → { rawStatus, reason }
    // Digunakan oleh Push Up untuk single-side validation.
    // Tidak mempengaruhi behavior tes lain.
    let _customEvaluate = null;

    /**
     * Pasang custom evaluator (dipanggil dari AssessmentSession saat tes berubah).
     * Set null untuk kembali ke evaluasi default.
     */
    function setCustomEvaluate(fn) {
        _customEvaluate = typeof fn === 'function' ? fn : null;
    }

    // ── State ─────────────────────────────────────────────────────────────────
    const validationStatus = ref(VALIDATION_STATUS.NO_BODY);

    // Circular buffer untuk stabilisasi: berisi boolean valid/tidak per frame
    // true = frame ini valid (READY-worthy), false = tidak
    const frameHistory = [];

    // Counter untuk stabilisasi naik (menuju READY)
    let consecutiveValidFrames   = 0;
    // Counter untuk stabilisasi turun (keluar dari READY)
    let consecutiveInvalidFrames = 0;

    // Alasan terakhir mengapa posisi invalid (untuk debug/display)
    const invalidReason = ref('');

    // Counter berapa kali validation mencapai READY (untuk diagnostic upload video)
    const debugValidationReadyCount = ref(0);

    // ── Core validation logic ─────────────────────────────────────────────────

    /**
     * Evaluasi satu frame landmark.
     * Mengembalikan { rawStatus, reason } tanpa mempertimbangkan stabilisasi.
     *
     * @param {Array|null} landmarks — array 33 landmark dari MediaPipe
     * @param {number}     detectedCount — jumlah landmark target yang visible
     * @param {number}     avgVisibility — rata-rata visibility 0–100
     * @returns {{ rawStatus: string, reason: string }}
     */
    function evaluateFrame(landmarks, detectedCount, avgVisibility) {
        // 1. Tidak ada landmark sama sekali → NO_BODY
        if (!landmarks || landmarks.length === 0) {
            return { rawStatus: VALIDATION_STATUS.NO_BODY, reason: 'Tidak ada landmark terdeteksi' };
        }

        // 2. Cek landmark wajib (required) — jika salah satu tidak ada → NO_BODY
        const allRequiredPresent = cfg.REQUIRED_LANDMARK_INDICES.every((idx) => {
            const lm = landmarks[idx];
            return lm && (lm.visibility ?? 0) >= cfg.MIN_VISIBILITY;
        });

        if (!allRequiredPresent) {
            return { rawStatus: VALIDATION_STATUS.NO_BODY, reason: 'Landmark utama tidak terdeteksi' };
        }

        // 3. Jumlah landmark valid kurang dari minimum → BODY_DETECTED
        if (detectedCount < cfg.MIN_VALID_LANDMARKS) {
            return {
                rawStatus: VALIDATION_STATUS.BODY_DETECTED,
                reason:    `Hanya ${detectedCount}/${cfg.MIN_VALID_LANDMARKS} landmark terdeteksi`,
            };
        }

        // 4. Rata-rata visibility terlalu rendah → POSITION_INVALID
        if (avgVisibility < cfg.MIN_AVG_VISIBILITY) {
            return {
                rawStatus: VALIDATION_STATUS.POSITION_INVALID,
                reason:    `Confidence rendah (${avgVisibility}% < ${cfg.MIN_AVG_VISIBILITY}%)`,
            };
        }

        // 5. Cek margin frame: landmark core tidak boleh terlalu mepet tepi
        const marginViolation = cfg.CORE_LANDMARK_INDICES.some((idx) => {
            const lm = landmarks[idx];
            if (!lm || (lm.visibility ?? 0) < cfg.MIN_VISIBILITY) return false;
            return (
                lm.x < cfg.FRAME_MARGIN ||
                lm.x > (1 - cfg.FRAME_MARGIN) ||
                lm.y < cfg.FRAME_MARGIN ||
                lm.y > (1 - cfg.FRAME_MARGIN)
            );
        });

        if (marginViolation) {
            return {
                rawStatus: VALIDATION_STATUS.POSITION_INVALID,
                reason:    'Tubuh terlalu dekat tepi frame — mundur atau geser ke tengah',
            };
        }

        // 6. Cek ukuran tubuh (body size) via jarak vertikal bahu→pinggul
        const leftShoulder  = landmarks[11];
        const rightShoulder = landmarks[12];
        const leftHip       = landmarks[23];
        const rightHip      = landmarks[24];

        const shoulderY = ((leftShoulder?.y ?? 0) + (rightShoulder?.y ?? 0)) / 2;
        const hipY      = ((leftHip?.y ?? 0)      + (rightHip?.y ?? 0))      / 2;
        const bodySize  = Math.abs(hipY - shoulderY);

        if (bodySize < cfg.MIN_BODY_SIZE) {
            return {
                rawStatus: VALIDATION_STATUS.POSITION_INVALID,
                reason:    'Tubuh terlalu jauh dari kamera — maju lebih dekat',
            };
        }

        if (bodySize > cfg.MAX_BODY_SIZE) {
            return {
                rawStatus: VALIDATION_STATUS.POSITION_INVALID,
                reason:    'Tubuh terlalu dekat ke kamera — mundur sedikit',
            };
        }

        // 7. Semua cek lolos → kandidat READY
        return { rawStatus: VALIDATION_STATUS.READY, reason: '' };
    }

    /**
     * Fungsi utama yang dipanggil setiap kali ada pose-update dari PoseDetector.
     * Mengelola stabilisasi frame dan memperbarui validationStatus.
     *
     * @param {Object} poseData — { landmarks, detectedCount, totalTarget, visibility }
     */
    function processPoseFrame({ landmarks, detectedCount, totalTarget, visibility } = {}) {
        // Gunakan custom evaluator jika tersedia (misal: Push Up single-side mode)
        // Fallback ke evaluateFrame() default jika tidak ada
        const evaluator = _customEvaluate ?? evaluateFrame;

        const { rawStatus, reason } = evaluator(
            landmarks,
            detectedCount ?? 0,
            visibility    ?? 0,
        );

        const isFrameValid = rawStatus === VALIDATION_STATUS.READY;

        // ── Stabilisasi counter ──────────────────────────────────────────────
        if (isFrameValid) {
            consecutiveValidFrames++;
            consecutiveInvalidFrames = 0;
        } else {
            consecutiveInvalidFrames++;
            consecutiveValidFrames = 0;
        }

        // ── Transisi status dengan hysteresis ───────────────────────────────
        const currentStatus = validationStatus.value;

        if (
            currentStatus !== VALIDATION_STATUS.READY &&
            isFrameValid &&
            consecutiveValidFrames >= cfg.STABLE_FRAMES_REQUIRED
        ) {
            // Naik ke READY setelah cukup frame valid berturut-turut
            validationStatus.value = VALIDATION_STATUS.READY;
            invalidReason.value    = '';
            consecutiveValidFrames = 0;
            debugValidationReadyCount.value++;

        } else if (
            currentStatus === VALIDATION_STATUS.READY &&
            !isFrameValid &&
            consecutiveInvalidFrames >= cfg.UNSTABLE_FRAMES_REQUIRED
        ) {
            // Turun dari READY setelah cukup frame invalid berturut-turut
            validationStatus.value = rawStatus;
            invalidReason.value    = reason;
            consecutiveInvalidFrames = 0;

        } else if (currentStatus !== VALIDATION_STATUS.READY) {
            // Di luar READY: update status langsung (tanpa hysteresis ke bawah)
            // tapi rawStatus tidak boleh langsung ke READY — perlu akumulasi
            const targetStatus = isFrameValid
                ? (consecutiveValidFrames >= cfg.STABLE_FRAMES_REQUIRED
                    ? VALIDATION_STATUS.READY
                    : rawStatus === VALIDATION_STATUS.READY
                        ? VALIDATION_STATUS.BODY_DETECTED  // belum cukup frame
                        : rawStatus)
                : rawStatus;

            validationStatus.value = targetStatus;
            invalidReason.value    = reason;
        }
    }

    /**
     * Reset semua state (dipanggil saat assessment stop/restart).
     */
    function resetValidation() {
        validationStatus.value   = VALIDATION_STATUS.NO_BODY;
        invalidReason.value      = '';
        consecutiveValidFrames   = 0;
        consecutiveInvalidFrames = 0;
        frameHistory.length      = 0;
        debugValidationReadyCount.value = 0;
    }

    // ── Computed helpers untuk UI ─────────────────────────────────────────────

    const statusMessage = computed(() =>
        VALIDATION_MESSAGES[validationStatus.value] ?? ''
    );

    const isReady = computed(() =>
        validationStatus.value === VALIDATION_STATUS.READY
    );

    const statusColor = computed(() => {
        const map = {
            [VALIDATION_STATUS.NO_BODY]:          'text-slate-400',
            [VALIDATION_STATUS.BODY_DETECTED]:    'text-yellow-400',
            [VALIDATION_STATUS.POSITION_INVALID]: 'text-orange-400',
            [VALIDATION_STATUS.READY]:            'text-emerald-400',
        };
        return map[validationStatus.value] ?? 'text-slate-400';
    });

    const statusDotColor = computed(() => {
        const map = {
            [VALIDATION_STATUS.NO_BODY]:          'bg-slate-600',
            [VALIDATION_STATUS.BODY_DETECTED]:    'bg-yellow-500 animate-pulse',
            [VALIDATION_STATUS.POSITION_INVALID]: 'bg-orange-500 animate-pulse',
            [VALIDATION_STATUS.READY]:            'bg-emerald-500',
        };
        return map[validationStatus.value] ?? 'bg-slate-600';
    });

    const statusIcon = computed(() => {
        const map = {
            [VALIDATION_STATUS.NO_BODY]:          '👤',
            [VALIDATION_STATUS.BODY_DETECTED]:    '🔍',
            [VALIDATION_STATUS.POSITION_INVALID]: '⚠️',
            [VALIDATION_STATUS.READY]:            '✅',
        };
        return map[validationStatus.value] ?? '👤';
    });

    /**
     * Progress ke READY (0–100%) — berguna untuk progress bar stabilisasi.
     * Hanya bermakna saat status di bawah READY.
     */
    const stabilizationProgress = computed(() => {
        if (validationStatus.value === VALIDATION_STATUS.READY) return 100;
        return Math.min(
            Math.round((consecutiveValidFrames / cfg.STABLE_FRAMES_REQUIRED) * 100),
            99, // tidak pernah 100 sebelum benar-benar READY
        );
    });

    return {
        // State
        validationStatus,
        invalidReason,
        debugValidationReadyCount,

        // Actions
        processPoseFrame,
        resetValidation,
        setCustomEvaluate,

        // Computed UI helpers
        statusMessage,
        isReady,
        statusColor,
        statusDotColor,
        statusIcon,
        stabilizationProgress,

        // Config (exposed agar komponen bisa menampilkan threshold)
        config: cfg,
    };
}
