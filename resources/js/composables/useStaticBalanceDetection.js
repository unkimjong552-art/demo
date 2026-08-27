/**
 * useStaticBalanceDetection.js
 *
 * Composable untuk mendeteksi dan mengukur durasi Static Balance (Keseimbangan Statis)
 * menggunakan landmark MediaPipe Pose.
 *
 * Assessment ini berbeda dari Push Up / Sit Up:
 *   - Bukan repetition counting — ini adalah DURATION measurement.
 *   - Mengukur berapa lama atlet dapat bertahan berdiri satu kaki.
 *   - Output utama: balanceDuration (detik, float berbasis performance.now()).
 *
 * Algoritma:
 *   1. Deteksi posisi kedua ankle menggunakan landmark MediaPipe
 *   2. Hitung selisih Y antara ankle kiri dan kanan (diffY)
 *   3. Jika diffY >= ANKLE_DIFF_THRESHOLD selama LIFT_CONFIRM_MS → kaki terangkat
 *   4. Timer berjalan selama kaki terangkat (BALANCING phase)
 *   5. Jika kaki turun kembali (diffY < threshold) selama DROP_CONFIRM_MS → berhenti
 *
 * State Machine:
 *   WAITING   — belum ada pose/landmark cukup atau belum READY dari validation
 *   READY     — pose valid, kedua kaki di lantai, siap memulai balance
 *   BALANCING — satu kaki terangkat dikonfirmasi, timer berjalan
 *   COMPLETE  — assessment dihentikan (manual atau via stopAssessment)
 *
 * Landmark MediaPipe yang digunakan:
 *    0 = nose
 *   11 = left_shoulder    12 = right_shoulder
 *   23 = left_hip         24 = right_hip
 *   25 = left_knee        26 = right_knee
 *   27 = left_ankle       28 = right_ankle
 *   31 = left_foot_index  32 = right_foot_index
 *
 * CATATAN PENTING:
 *   Semua threshold di BALANCE_CONFIG adalah PROVISIONAL dan belum divalidasi.
 *   Jangan mengubah nilai tanpa data runtime dari trainer/client.
 */

import { ref, computed } from 'vue';

// ─────────────────────────────────────────────────────────────────────────────
// DEBUG FLAG
// ─────────────────────────────────────────────────────────────────────────────

export const BALANCE_DEBUG = true;

// ─────────────────────────────────────────────────────────────────────────────
// BALANCE CONFIG
// SEMUA NILAI DI BAWAH INI ADALAH PROVISIONAL.
// Harus divalidasi oleh trainer/client sebelum deployment.
// ─────────────────────────────────────────────────────────────────────────────

export const BALANCE_CONFIG = {
    // ── Foot lift detection ──────────────────────────────────────────────────

    /**
     * Selisih Y ankle minimum (koordinat normalized 0.0–1.0) untuk dianggap
     * satu kaki terangkat. Nilai lebih besar = kaki lebih tinggi terangkat.
     * 0.08 ≈ 8% tinggi frame ≈ angkat kaki setinggi ~10–15 cm.
     *
     * !! PROVISIONAL — perlu kalibrasi dari data nyata !!
     * Jika terlalu banyak false positive → naikkan (misal 0.12)
     * Jika terlalu sulit dideteksi → turunkan (misal 0.05)
     */
    ANKLE_DIFF_THRESHOLD: 0.08,

    /**
     * Durasi minimum (ms) kaki harus terangkat sebelum BALANCING dikonfirmasi.
     * Mencegah false positive dari melangkah sebentar.
     * 300ms = ~4 frame @13fps.
     *
     * !! PROVISIONAL — perlu kalibrasi dari data nyata !!
     */
    LIFT_CONFIRM_MS: 300,

    /**
     * Durasi minimum (ms) kaki kembali ke bawah sebelum BALANCING dihentikan.
     * Toleransi noise sesaat saat kaki hampir turun.
     * 200ms = ~2-3 frame @13fps.
     *
     * !! PROVISIONAL — perlu kalibrasi dari data nyata !!
     */
    DROP_CONFIRM_MS: 200,

    // ── Visibility ───────────────────────────────────────────────────────────

    /**
     * Visibility minimum per landmark (0.0–1.0).
     */
    MIN_VISIBILITY: 0.5,

    /**
     * Jumlah minimal ankle yang harus visible untuk dapat memulai deteksi.
     * 1 = minimal satu ankle terlihat.
     * Jika tidak ada ankle visible → jangan mulai timer.
     *
     * !! PROVISIONAL — kemungkinan harus dinaikkan ke 2 setelah UAT !!
     */
    MIN_ANKLE_VISIBLE: 1,

    // ── Timing ───────────────────────────────────────────────────────────────

    /**
     * Durasi maksimum (ms) landmark boleh hilang saat BALANCING sebelum
     * timer dihentikan. Toleransi oklusi sesaat.
     */
    LANDMARK_LOST_TIMEOUT_MS: 500,
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const BALANCE_PHASE = {
    WAITING:   'WAITING',   // landmark belum cukup / pose belum valid
    READY:     'READY',     // pose valid, kedua kaki di lantai
    BALANCING: 'BALANCING', // satu kaki terangkat, timer berjalan
    COMPLETE:  'COMPLETE',  // assessment selesai (manual stop)
};

// ─────────────────────────────────────────────────────────────────────────────
// STANDING LEG CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const STANDING_LEG = {
    UNKNOWN: 'UNKNOWN',
    LEFT:    'LEFT',   // kanan terangkat, kiri sebagai tumpuan
    RIGHT:   'RIGHT',  // kiri terangkat, kanan sebagai tumpuan
    BOTH:    'BOTH',   // kedua kaki di lantai (bukan balance)
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cek apakah landmark valid (ada dan visibility cukup).
 */
function isLandmarkValid(lm, minVisibility) {
    return lm != null &&
           typeof lm.x === 'number' &&
           typeof lm.y === 'number' &&
           (lm.visibility ?? 0) >= minVisibility;
}

// ─────────────────────────────────────────────────────────────────────────────
// DIAGNOSTIC LANDMARK DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

const BALANCE_DIAGNOSTIC_LANDMARKS = [
    { name: 'Nose',          index: 0  },
    { name: 'L. Shoulder',   index: 11 },
    { name: 'R. Shoulder',   index: 12 },
    { name: 'L. Hip',        index: 23 },
    { name: 'R. Hip',        index: 24 },
    { name: 'L. Knee',       index: 25 },
    { name: 'R. Knee',       index: 26 },
    { name: 'L. Ankle',      index: 27 },
    { name: 'R. Ankle',      index: 28 },
    { name: 'L. Foot',       index: 31 },
    { name: 'R. Foot',       index: 32 },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSABLE
// ─────────────────────────────────────────────────────────────────────────────

export function useStaticBalanceDetection(config = {}) {
    const cfg = { ...BALANCE_CONFIG, ...config };

    // ── Reactive state ────────────────────────────────────────────────────────
    const currentPhase     = ref(BALANCE_PHASE.WAITING);
    const balanceDuration  = ref(0);      // durasi balance terakhir (detik, float)
    const totalDuration    = ref(0);      // total akumulasi semua balance dalam sesi
    const standingLeg      = ref(STANDING_LEG.UNKNOWN);
    const ankleDiff        = ref(0);      // diffY terakhir (0.0–1.0)
    const feedback         = ref('');
    const isBalancing      = ref(false);  // shortcut: apakah sedang BALANCING

    // ── Debug / FPS ───────────────────────────────────────────────────────────
    const debugFps           = ref(0);
    const debugFrameCount    = ref(0);
    const debugLastFrameTime = ref(0);
    const FPS_SAMPLE_SIZE    = 10;
    const fpsBuffer          = [];

    // ── Debug: per-landmark report ─────────────────────────────────────────────
    const debugLandmarkReport = ref([]);

    // ── Debug: ankle detail per-frame ────────────────────────────────────────
    const debugAnkleDetail = ref({
        leftAnkleVis:   0,      // visibility 0–100
        rightAnkleVis:  0,
        leftAnkleY:     0,      // koordinat Y normalized 0.0–1.0
        rightAnkleY:    0,
        leftFootVis:    0,
        rightFootVis:   0,
        diffY:          0,      // |leftY - rightY|
        bothAnkleVisible: false,
        oneAnkleVisible:  false,
        liftCandidateSide: '—', // 'LEFT_LIFTED' | 'RIGHT_LIFTED' | '—'
    });

    // ── Debug: counting pipeline per-frame ────────────────────────────────────
    const debugCountingPipeline = ref({
        validationReady:    false,
        ankleVisible:       false,
        diffY:              0,
        inLiftZone:         false,   // diffY >= threshold
        liftAccumMs:        0,       // akumulasi menuju BALANCING
        liftConfirmed:      false,   // fase BALANCING aktif
        inDropZone:         false,   // diffY < threshold (kaki mau turun)
        dropAccumMs:        0,
        balancingDuration:  0,       // ms sejak liftConfirmed
        blockReason:        '—',
    });

    // ── Debug: cumulative counters ────────────────────────────────────────────
    const debugPipelineCumulative = ref({
        validationReadyFrames:   0,
        ankleVisibleFrames:      0,
        liftCandidateFrames:     0,   // frames di lift zone sebelum confirmed
        liftConfirmedCount:      0,   // berapa kali BALANCING dikonfirmasi
        maxBalanceDurationMs:    0,   // rekor terlama dalam sesi
        falsePositiveGuardCount: 0,   // berapa kali diblokir false-positive guard
        landmarkBlockedCount:    0,
        validationBlockedCount:  0,
        lastBlockReason:         '—',
    });
    let _cumul = {
        validationReadyFrames:   0,
        ankleVisibleFrames:      0,
        liftCandidateFrames:     0,
        liftConfirmedCount:      0,
        maxBalanceDurationMs:    0,
        falsePositiveGuardCount: 0,
        landmarkBlockedCount:    0,
        validationBlockedCount:  0,
        lastBlockReason:         '—',
    };

    // ── Debug: state machine diagnostics ─────────────────────────────────────
    const debugStateMachine = ref({
        prevPhase:           BALANCE_PHASE.WAITING,
        minDiffYSeen:        999,    // diffY terkecil yang pernah diukur
        maxDiffYSeen:        0,      // diffY terbesar yang pernah diukur
        framesInLiftZone:    0,
        framesInDropZone:    0,
        balancingEverStarted: false,
        blockedByValidation: 0,
        blockedByLandmark:   0,
        blockedByFpGuard:    0,
        lastBlockReason:     '—',
        validationDropCount: 0,
    });
    let _sm = {
        prevPhase:           BALANCE_PHASE.WAITING,
        minDiffYSeen:        999,
        maxDiffYSeen:        0,
        framesInLiftZone:    0,
        framesInDropZone:    0,
        balancingEverStarted: false,
        blockedByValidation: 0,
        blockedByLandmark:   0,
        blockedByFpGuard:    0,
        lastBlockReason:     '—',
        validationDropCount: 0,
        lastValidationStatus: 'READY',
    };

    // ── Debug: frame history (rolling 25 sampel) ──────────────────────────────
    const DEBUG_HISTORY_SIZE = 25;
    const debugFrameHistory  = ref([]);

    // ── Debug: balance event log ──────────────────────────────────────────────
    // Mencatat setiap kali BALANCING dimulai dan dihentikan
    const DEBUG_EVENT_LOG_SIZE = 10;
    const debugBalanceEvents   = ref([]); // { startMs, endMs, durationMs, standingLeg, reason }

    // ── Non-reactive timers ───────────────────────────────────────────────────
    let liftStartTime        = null;  // performance.now() saat diffY pertama >= threshold
    let dropStartTime        = null;  // performance.now() saat diffY pertama < threshold
    let balanceStartTime     = null;  // performance.now() saat BALANCING dikonfirmasi
    let landmarkLostTime     = null;  // performance.now() saat landmark pertama hilang
    let _currentEventStart   = null;  // untuk event log
    let _currentStandingLeg  = STANDING_LEG.UNKNOWN;

    // ── FPS measurement ───────────────────────────────────────────────────────
    function updateFps() {
        const now = performance.now();
        if (debugLastFrameTime.value > 0) {
            const interval = now - debugLastFrameTime.value;
            if (interval >= 5 && interval <= 500) {
                fpsBuffer.push(interval);
                if (fpsBuffer.length > FPS_SAMPLE_SIZE) fpsBuffer.shift();
                const avg = fpsBuffer.reduce((a, b) => a + b, 0) / fpsBuffer.length;
                debugFps.value = Math.round(1000 / avg);
            }
        }
        debugLastFrameTime.value = now;
        debugFrameCount.value++;
    }

    // ── Debug: per-landmark report ────────────────────────────────────────────
    function updateDebugDiagnostics(landmarks) {
        if (!BALANCE_DEBUG) return;

        const minVis = cfg.MIN_VISIBILITY;
        const report = BALANCE_DIAGNOSTIC_LANDMARKS.map(({ name, index }) => {
            const lm  = landmarks?.[index];
            const vis = lm != null ? Math.round((lm.visibility ?? 0) * 100) : null;
            let status;
            if (lm == null || vis === null)          status = 'MISSING';
            else if ((lm.visibility ?? 0) >= minVis) status = 'VISIBLE';
            else                                     status = 'LOW';
            return { name, index, vis, status };
        });
        debugLandmarkReport.value = report;
    }

    // ── Debug: state machine diagnostics ─────────────────────────────────────
    function updateStateMachineDiagnostics({ validationStatus, currentDiffY, currentPhaseBefore, landmarkAvailable }) {
        if (!BALANCE_DEBUG) return;

        if (_sm.lastValidationStatus === 'READY' && validationStatus !== 'READY') {
            _sm.validationDropCount++;
        }
        _sm.lastValidationStatus = validationStatus;

        if (validationStatus !== 'READY') {
            _sm.blockedByValidation++;
            _sm.lastBlockReason = `Validation bukan READY (${validationStatus})`;
        } else if (!landmarkAvailable) {
            _sm.blockedByLandmark++;
            _sm.lastBlockReason = 'Ankle tidak terlihat';
        }

        if (currentDiffY > 0) {
            if (currentDiffY < _sm.minDiffYSeen) _sm.minDiffYSeen = currentDiffY;
            if (currentDiffY > _sm.maxDiffYSeen) _sm.maxDiffYSeen = currentDiffY;
        }
        if (currentDiffY >= cfg.ANKLE_DIFF_THRESHOLD) _sm.framesInLiftZone++;
        if (currentDiffY > 0 && currentDiffY < cfg.ANKLE_DIFF_THRESHOLD) _sm.framesInDropZone++;

        if (currentPhase.value === BALANCE_PHASE.BALANCING) _sm.balancingEverStarted = true;

        const nowPhase = currentPhase.value;
        if (nowPhase !== currentPhaseBefore) _sm.prevPhase = currentPhaseBefore;

        debugStateMachine.value = {
            prevPhase:            _sm.prevPhase,
            minDiffYSeen:         _sm.minDiffYSeen === 999 ? 0 : parseFloat(_sm.minDiffYSeen.toFixed(3)),
            maxDiffYSeen:         parseFloat(_sm.maxDiffYSeen.toFixed(3)),
            framesInLiftZone:     _sm.framesInLiftZone,
            framesInDropZone:     _sm.framesInDropZone,
            balancingEverStarted: _sm.balancingEverStarted,
            blockedByValidation:  _sm.blockedByValidation,
            blockedByLandmark:    _sm.blockedByLandmark,
            blockedByFpGuard:     _sm.blockedByFpGuard,
            lastBlockReason:      _sm.lastBlockReason,
            validationDropCount:  _sm.validationDropCount,
        };
    }

    // ── Debug: frame history ──────────────────────────────────────────────────
    function pushFrameHistory(validationStatus, diffY, formSt) {
        if (!BALANCE_DEBUG) return;
        const now = performance.now();
        const entry = {
            ts:       Math.round(now / 100) / 10,
            fps:      debugFps.value,
            valid:    validationStatus,
            diffY:    parseFloat(diffY.toFixed(3)),
            phase:    currentPhase.value,
            dur:      balanceDuration.value > 0 ? balanceDuration.value.toFixed(1) : '—',
            standing: standingLeg.value,
        };
        const history = debugFrameHistory.value;
        debugFrameHistory.value = history.length >= DEBUG_HISTORY_SIZE
            ? [...history.slice(1), entry]
            : [...history, entry];
    }

    // ── Debug: balance event log ──────────────────────────────────────────────
    function pushBalanceEvent(startMs, endMs, leg, reason) {
        if (!BALANCE_DEBUG) return;
        const entry = {
            startMs:     Math.round(startMs),
            endMs:       Math.round(endMs),
            durationMs:  Math.round(endMs - startMs),
            durationSec: parseFloat(((endMs - startMs) / 1000).toFixed(2)),
            standingLeg: leg,
            endReason:   reason,
        };
        const log = debugBalanceEvents.value;
        debugBalanceEvents.value = log.length >= DEBUG_EVENT_LOG_SIZE
            ? [...log.slice(1), entry]
            : [...log, entry];

        // Update cumulative max
        if (entry.durationMs > _cumul.maxBalanceDurationMs) {
            _cumul.maxBalanceDurationMs = entry.durationMs;
        }
    }

    // ── Landmark extraction ───────────────────────────────────────────────────

    /**
     * Ekstrak landmark yang diperlukan untuk Static Balance.
     * Returns null jika ankle tidak ada sama sekali.
     *
     * Guard utama: minimal cfg.MIN_ANKLE_VISIBLE ankle harus terlihat.
     * Ini mencegah false positive saat user hanya terlihat dari pinggang ke atas.
     */
    function extractLandmarks(landmarks) {
        if (!landmarks || landmarks.length < 33) return null;

        const lm     = (idx) => landmarks[idx];
        const minVis = cfg.MIN_VISIBILITY;

        const nose          = lm(0);
        const leftShoulder  = lm(11);
        const rightShoulder = lm(12);
        const leftHip       = lm(23);
        const rightHip      = lm(24);
        const leftKnee      = lm(25);
        const rightKnee     = lm(26);
        const leftAnkle     = lm(27);
        const rightAnkle    = lm(28);
        const leftFoot      = lm(31);
        const rightFoot     = lm(32);

        const leftAnkleOk  = isLandmarkValid(leftAnkle,  minVis);
        const rightAnkleOk = isLandmarkValid(rightAnkle, minVis);
        const ankleCount   = (leftAnkleOk ? 1 : 0) + (rightAnkleOk ? 1 : 0);

        // Guard: tidak ada ankle visible → tidak bisa detect balance
        if (ankleCount < cfg.MIN_ANKLE_VISIBLE) return null;

        return {
            nose,
            leftShoulder, rightShoulder,
            leftHip,      rightHip,
            leftKnee,     rightKnee,
            leftAnkle,    rightAnkle,
            leftFoot,     rightFoot,
            leftAnkleOk,
            rightAnkleOk,
            ankleCount,
            bothAnkleVisible: leftAnkleOk && rightAnkleOk,
        };
    }

    /**
     * Hitung selisih Y antara kedua ankle.
     *
     * Koordinat Y MediaPipe: 0.0 = atas frame, 1.0 = bawah frame.
     * Kaki yang diangkat memiliki ankle.y LEBIH KECIL (lebih tinggi di layar).
     *
     * Returns:
     *   { diffY, liftedSide, standingSide }
     *
     * Jika hanya satu ankle visible, tidak bisa menghitung diffY secara akurat
     * → kembalikan diffY = 0 dan tandai sebagai tidak dapat dikonfirmasi.
     */
    function computeAnkleDiff(lms) {
        if (!lms.bothAnkleVisible) {
            // Hanya satu ankle — tidak bisa konfirmasi kaki terangkat
            // Jangan false-positive: kembalikan 0
            return { diffY: 0, liftedSide: '—', standingSide: STANDING_LEG.UNKNOWN, canDetect: false };
        }

        const leftY  = lms.leftAnkle?.y  ?? 0;
        const rightY = lms.rightAnkle?.y ?? 0;
        const diffY  = Math.abs(leftY - rightY);

        // Kaki yang lebih tinggi (Y lebih kecil) adalah kaki yang terangkat
        let liftedSide    = '—';
        let standingSide  = STANDING_LEG.UNKNOWN;

        if (diffY >= cfg.ANKLE_DIFF_THRESHOLD) {
            if (leftY < rightY) {
                // Kaki kiri lebih tinggi → kiri diangkat → kanan sebagai tumpuan
                liftedSide   = 'LEFT_LIFTED';
                standingSide = STANDING_LEG.RIGHT;
            } else {
                // Kaki kanan lebih tinggi → kanan diangkat → kiri sebagai tumpuan
                liftedSide   = 'RIGHT_LIFTED';
                standingSide = STANDING_LEG.LEFT;
            }
        } else {
            standingSide = STANDING_LEG.BOTH;
        }

        return { diffY, liftedSide, standingSide, canDetect: true };
    }

    /**
     * Fungsi utama — dipanggil setiap frame dari onPoseUpdate.
     */
    function processBalanceFrame({ landmarks, validationStatus } = {}) {
        updateFps();
        const now         = performance.now();
        const phaseBefore = currentPhase.value;

        // ── Guard: pose belum READY ───────────────────────────────────────────
        if (validationStatus !== 'READY') {
            feedback.value  = 'Tunggu posisi tubuh valid terlebih dahulu';
            isBalancing.value = false;

            if (currentPhase.value === BALANCE_PHASE.BALANCING) {
                // Validation drop saat sedang balance → hentikan timer
                _stopBalancing(now, 'VALIDATION_LOST');
            } else {
                currentPhase.value = BALANCE_PHASE.WAITING;
            }

            // Reset lift timer (bukan drop timer — validation drop != kaki turun)
            liftStartTime = null;
            landmarkLostTime = null;

            if (BALANCE_DEBUG) {
                _cumul.validationBlockedCount++;
                _cumul.lastBlockReason = `Validation: ${validationStatus}`;
                debugCountingPipeline.value = {
                    ...debugCountingPipeline.value,
                    validationReady: false,
                    blockReason: `Validation: ${validationStatus}`,
                };
                updateDebugDiagnostics(landmarks);
                updateStateMachineDiagnostics({ validationStatus, currentDiffY: 0, currentPhaseBefore: phaseBefore, landmarkAvailable: false });
                pushFrameHistory(validationStatus, 0, 'NO_DATA');
                debugPipelineCumulative.value = { ..._cumul };
            }
            return;
        }

        // ── Ekstrak landmark ──────────────────────────────────────────────────
        const lms = extractLandmarks(landmarks);
        if (BALANCE_DEBUG) updateDebugDiagnostics(landmarks);

        if (!lms) {
            // Tidak ada ankle yang visible
            feedback.value = 'Pastikan seluruh tubuh (kaki) terlihat kamera';

            if (currentPhase.value === BALANCE_PHASE.BALANCING) {
                // Landmark hilang saat balance — toleransi LANDMARK_LOST_TIMEOUT
                if (landmarkLostTime === null) landmarkLostTime = now;
                const lostMs = now - landmarkLostTime;

                if (lostMs > cfg.LANDMARK_LOST_TIMEOUT_MS) {
                    _stopBalancing(now, 'LANDMARK_LOST');
                    liftStartTime    = null;
                    dropStartTime    = null;
                    landmarkLostTime = null;
                }
                // Jika belum timeout: biarkan balance terus — ankle mungkin sesaat hilang
            } else {
                currentPhase.value = BALANCE_PHASE.WAITING;
                liftStartTime      = null;
                dropStartTime      = null;
                landmarkLostTime   = null;
            }

            if (BALANCE_DEBUG) {
                _cumul.landmarkBlockedCount++;
                _cumul.lastBlockReason = 'Ankle tidak terlihat';
                debugCountingPipeline.value = {
                    ...debugCountingPipeline.value,
                    validationReady: true,
                    ankleVisible:    false,
                    blockReason:     'Ankle tidak terlihat (extractLandmarks=null)',
                };
                updateStateMachineDiagnostics({ validationStatus, currentDiffY: 0, currentPhaseBefore: phaseBefore, landmarkAvailable: false });
                pushFrameHistory(validationStatus, 0, 'NO_ANKLE');
                debugPipelineCumulative.value = { ..._cumul };
            }
            return;
        }

        // Landmark ada → reset lost timer
        landmarkLostTime = null;

        // ── Hitung ankle diff ─────────────────────────────────────────────────
        const { diffY, liftedSide, standingSide, canDetect } = computeAnkleDiff(lms);
        ankleDiff.value    = parseFloat(diffY.toFixed(3));
        standingLeg.value  = standingSide;

        // ── Update ankle detail diagnostic ────────────────────────────────────
        if (BALANCE_DEBUG) {
            const minVis = cfg.MIN_VISIBILITY;
            debugAnkleDetail.value = {
                leftAnkleVis:      lms.leftAnkle  ? Math.round((lms.leftAnkle.visibility  ?? 0) * 100) : 0,
                rightAnkleVis:     lms.rightAnkle ? Math.round((lms.rightAnkle.visibility ?? 0) * 100) : 0,
                leftAnkleY:        parseFloat((lms.leftAnkle?.y  ?? 0).toFixed(3)),
                rightAnkleY:       parseFloat((lms.rightAnkle?.y ?? 0).toFixed(3)),
                leftFootVis:       lms.leftFoot  ? Math.round((lms.leftFoot.visibility  ?? 0) * 100) : 0,
                rightFootVis:      lms.rightFoot ? Math.round((lms.rightFoot.visibility ?? 0) * 100) : 0,
                diffY:             parseFloat(diffY.toFixed(3)),
                bothAnkleVisible:  lms.bothAnkleVisible,
                oneAnkleVisible:   lms.ankleCount === 1,
                liftCandidateSide: liftedSide,
            };
        }

        // ── False-positive guard ──────────────────────────────────────────────
        // Kondisi yang tidak boleh memulai balance:
        // 1. Kedua ankle terlihat tapi diffY kecil → berdiri biasa
        // 2. Hanya satu ankle visible → tidak bisa konfirmasi
        // 3. canDetect = false → tidak punya cukup data

        const inLiftZone = canDetect && diffY >= cfg.ANKLE_DIFF_THRESHOLD;

        if (!canDetect && currentPhase.value !== BALANCE_PHASE.BALANCING) {
            // Hanya satu ankle → tidak bisa konfirmasi kaki terangkat
            // Tapi jangan interrupt balance yang sudah berjalan
            feedback.value = 'Pastikan kedua kaki terlihat kamera';
            if (currentPhase.value !== BALANCE_PHASE.BALANCING) {
                currentPhase.value = BALANCE_PHASE.READY; // sudah punya ankle, bukan WAITING
            }
            liftStartTime = null; // reset kandidat

            if (BALANCE_DEBUG) {
                _cumul.falsePositiveGuardCount++;
                _sm.blockedByFpGuard++;
                _cumul.lastBlockReason = 'Single ankle — tidak bisa konfirmasi lift';
                debugCountingPipeline.value = {
                    validationReady: true,
                    ankleVisible:    true,
                    diffY:           0,
                    inLiftZone:      false,
                    liftAccumMs:     0,
                    liftConfirmed:   currentPhase.value === BALANCE_PHASE.BALANCING,
                    inDropZone:      false,
                    dropAccumMs:     0,
                    balancingDuration: balanceDuration.value,
                    blockReason:     'Single ankle — tidak bisa konfirmasi lift',
                };
                updateStateMachineDiagnostics({ validationStatus, currentDiffY: 0, currentPhaseBefore: phaseBefore, landmarkAvailable: true });
                pushFrameHistory(validationStatus, 0, 'SINGLE_ANKLE');
                debugPipelineCumulative.value = { ..._cumul };
            }
            return;
        }

        // ── State machine ─────────────────────────────────────────────────────
        const phase = currentPhase.value;

        // Pastikan masuk READY dulu sebelum bisa BALANCING
        if (phase === BALANCE_PHASE.WAITING) {
            currentPhase.value = BALANCE_PHASE.READY;
        }

        let _pipelineBlock = '—';

        if (phase === BALANCE_PHASE.READY || phase === BALANCE_PHASE.WAITING) {
            // ── Menunggu kaki terangkat ─────────────────────────────────────
            if (inLiftZone) {
                if (liftStartTime === null) liftStartTime = now;
                dropStartTime = null;

                const liftElapsed = now - liftStartTime;
                if (liftElapsed >= cfg.LIFT_CONFIRM_MS) {
                    // Konfirmasi: BALANCING dimulai
                    currentPhase.value   = BALANCE_PHASE.BALANCING;
                    balanceStartTime     = now - liftElapsed; // retroaktif dari awal lift
                    isBalancing.value    = true;
                    _currentEventStart   = balanceStartTime;
                    _currentStandingLeg  = standingSide;
                    feedback.value       = `Bagus! Pertahankan posisi`;

                    if (BALANCE_DEBUG) {
                        _cumul.liftConfirmedCount++;
                    }
                } else {
                    const pct = Math.round((liftElapsed / cfg.LIFT_CONFIRM_MS) * 100);
                    feedback.value = `Tahan... (${pct}%)`;
                    _pipelineBlock = `Lift akumulasi: ${Math.round(liftElapsed)}ms/${cfg.LIFT_CONFIRM_MS}ms`;
                }
            } else {
                // Kaki belum terangkat / kembali ke bawah
                liftStartTime  = null;
                feedback.value = inLiftZone ? '' : 'Angkat satu kaki untuk memulai';
                if (!inLiftZone) _pipelineBlock = `diffY ${diffY.toFixed(3)} < ${cfg.ANKLE_DIFF_THRESHOLD} (lift threshold)`;
            }

        } else if (phase === BALANCE_PHASE.BALANCING) {
            // ── Sedang balance — update durasi ───────────────────────────────
            if (balanceStartTime !== null) {
                const elapsedMs = now - balanceStartTime;
                balanceDuration.value = parseFloat((elapsedMs / 1000).toFixed(2));
            }

            if (!inLiftZone) {
                // Kaki mulai turun — akumulasi drop
                if (dropStartTime === null) dropStartTime = now;
                const dropElapsed = now - dropStartTime;

                if (dropElapsed >= cfg.DROP_CONFIRM_MS) {
                    // Konfirmasi kaki turun → hentikan BALANCING
                    _stopBalancing(now, 'FOOT_DOWN');
                    liftStartTime = null;
                    dropStartTime = null;
                } else {
                    const pct = Math.round((dropElapsed / cfg.DROP_CONFIRM_MS) * 100);
                    feedback.value = `Hampir selesai... (turun ${pct}%)`;
                    _pipelineBlock = `Drop akumulasi: ${Math.round(dropElapsed)}ms/${cfg.DROP_CONFIRM_MS}ms`;
                }
            } else {
                // Masih balance — reset drop timer
                dropStartTime  = null;
                feedback.value = `Balance: ${balanceDuration.value.toFixed(1)}s`;
                _currentStandingLeg = standingSide; // update sisi tumpuan
            }

        } else if (phase === BALANCE_PHASE.FLAT || phase === BALANCE_PHASE.COMPLETE) {
            // COMPLETE — tidak ada aksi, tinggal menunggu assessment di-stop
            feedback.value = `Selesai — durasi: ${balanceDuration.value.toFixed(1)}s`;
        }

        // ── Update debug diagnostics ──────────────────────────────────────────
        if (BALANCE_DEBUG) {
            _cumul.validationReadyFrames++;
            if (lms.ankleCount > 0) _cumul.ankleVisibleFrames++;
            if (inLiftZone) _cumul.liftCandidateFrames++;

            const liftElapsed  = liftStartTime  !== null ? Math.round(now - liftStartTime)  : 0;
            const dropElapsed  = dropStartTime  !== null ? Math.round(now - dropStartTime)  : 0;
            const balanceMs    = balanceStartTime !== null && phase === BALANCE_PHASE.BALANCING
                ? Math.round(now - balanceStartTime) : 0;

            debugCountingPipeline.value = {
                validationReady:    true,
                ankleVisible:       lms.ankleCount > 0,
                diffY:              parseFloat(diffY.toFixed(3)),
                inLiftZone,
                liftAccumMs:        liftElapsed,
                liftConfirmed:      phase === BALANCE_PHASE.BALANCING,
                inDropZone:         !inLiftZone && phase === BALANCE_PHASE.BALANCING,
                dropAccumMs:        dropElapsed,
                balancingDuration:  balanceMs,
                blockReason:        _pipelineBlock,
            };

            if (!inLiftZone && _pipelineBlock !== '—') _cumul.lastBlockReason = _pipelineBlock;
            debugPipelineCumulative.value = { ..._cumul };

            updateStateMachineDiagnostics({ validationStatus, currentDiffY: diffY, currentPhaseBefore: phaseBefore, landmarkAvailable: true });
            pushFrameHistory(validationStatus, diffY, 'OK');
        }
    }

    /**
     * Hentikan BALANCING dan simpan hasil ke event log.
     *
     * @param {number} nowMs       — performance.now() saat ini
     * @param {string} reason      — alasan berhenti
     */
    function _stopBalancing(nowMs, reason) {
        if (balanceStartTime !== null) {
            const durationMs   = nowMs - balanceStartTime;
            const durationSec  = durationMs / 1000;
            balanceDuration.value = parseFloat(durationSec.toFixed(2));
            totalDuration.value   = parseFloat((totalDuration.value + durationSec).toFixed(2));

            if (BALANCE_DEBUG) {
                pushBalanceEvent(
                    _currentEventStart ?? balanceStartTime,
                    nowMs,
                    _currentStandingLeg,
                    reason,
                );
                if (durationMs > _cumul.maxBalanceDurationMs) {
                    _cumul.maxBalanceDurationMs = durationMs;
                }
            }
        }

        currentPhase.value    = BALANCE_PHASE.READY; // kembali ke READY untuk potensi balance berikutnya
        isBalancing.value     = false;
        balanceStartTime      = null;
        _currentEventStart    = null;
        _currentStandingLeg   = STANDING_LEG.UNKNOWN;
        liftStartTime         = null;
        dropStartTime         = null;

        if (reason === 'FOOT_DOWN') {
            feedback.value = `Kaki turun — durasi: ${balanceDuration.value.toFixed(1)}s`;
        }
    }

    /**
     * Reset seluruh state balance.
     * Dipanggil saat assessment stop atau restart.
     */
    function resetBalance() {
        currentPhase.value    = BALANCE_PHASE.WAITING;
        balanceDuration.value = 0;
        totalDuration.value   = 0;
        standingLeg.value     = STANDING_LEG.UNKNOWN;
        ankleDiff.value       = 0;
        feedback.value        = '';
        isBalancing.value     = false;

        liftStartTime     = null;
        dropStartTime     = null;
        balanceStartTime  = null;
        landmarkLostTime  = null;
        _currentEventStart  = null;
        _currentStandingLeg = STANDING_LEG.UNKNOWN;

        fpsBuffer.length         = 0;
        debugFps.value           = 0;
        debugFrameCount.value    = 0;
        debugLastFrameTime.value = 0;

        debugLandmarkReport.value  = [];
        debugFrameHistory.value    = [];
        debugBalanceEvents.value   = [];
        debugAnkleDetail.value     = {
            leftAnkleVis: 0, rightAnkleVis: 0,
            leftAnkleY: 0, rightAnkleY: 0,
            leftFootVis: 0, rightFootVis: 0,
            diffY: 0, bothAnkleVisible: false,
            oneAnkleVisible: false, liftCandidateSide: '—',
        };
        debugCountingPipeline.value = {
            validationReady: false, ankleVisible: false,
            diffY: 0, inLiftZone: false, liftAccumMs: 0,
            liftConfirmed: false, inDropZone: false, dropAccumMs: 0,
            balancingDuration: 0, blockReason: '—',
        };
        debugPipelineCumulative.value = {
            validationReadyFrames: 0, ankleVisibleFrames: 0,
            liftCandidateFrames: 0, liftConfirmedCount: 0,
            maxBalanceDurationMs: 0, falsePositiveGuardCount: 0,
            landmarkBlockedCount: 0, validationBlockedCount: 0,
            lastBlockReason: '—',
        };
        debugStateMachine.value = {
            prevPhase: BALANCE_PHASE.WAITING, minDiffYSeen: 0, maxDiffYSeen: 0,
            framesInLiftZone: 0, framesInDropZone: 0, balancingEverStarted: false,
            blockedByValidation: 0, blockedByLandmark: 0, blockedByFpGuard: 0,
            lastBlockReason: '—', validationDropCount: 0,
        };
        _sm = {
            prevPhase: BALANCE_PHASE.WAITING, minDiffYSeen: 999, maxDiffYSeen: 0,
            framesInLiftZone: 0, framesInDropZone: 0, balancingEverStarted: false,
            blockedByValidation: 0, blockedByLandmark: 0, blockedByFpGuard: 0,
            lastBlockReason: '—', validationDropCount: 0, lastValidationStatus: 'READY',
        };
        _cumul = {
            validationReadyFrames: 0, ankleVisibleFrames: 0,
            liftCandidateFrames: 0, liftConfirmedCount: 0,
            maxBalanceDurationMs: 0, falsePositiveGuardCount: 0,
            landmarkBlockedCount: 0, validationBlockedCount: 0,
            lastBlockReason: '—',
        };
    }

    // ── Computed UI helpers ───────────────────────────────────────────────────

    const phaseLabel = computed(() => {
        const map = {
            [BALANCE_PHASE.WAITING]:   'WAITING',
            [BALANCE_PHASE.READY]:     'READY',
            [BALANCE_PHASE.BALANCING]: 'BALANCING ⚖',
            [BALANCE_PHASE.COMPLETE]:  'COMPLETE',
        };
        return map[currentPhase.value] ?? '—';
    });

    const phaseColor = computed(() => {
        const map = {
            [BALANCE_PHASE.WAITING]:   'text-slate-500',
            [BALANCE_PHASE.READY]:     'text-slate-400',
            [BALANCE_PHASE.BALANCING]: 'text-emerald-400',
            [BALANCE_PHASE.COMPLETE]:  'text-primary-400',
        };
        return map[currentPhase.value] ?? 'text-slate-500';
    });

    const standingLegLabel = computed(() => {
        const map = {
            [STANDING_LEG.UNKNOWN]: 'UNKNOWN',
            [STANDING_LEG.LEFT]:    'LEFT (kanan terangkat)',
            [STANDING_LEG.RIGHT]:   'RIGHT (kiri terangkat)',
            [STANDING_LEG.BOTH]:    'BOTH (kedua di lantai)',
        };
        return map[standingLeg.value] ?? '—';
    });

    const balanceDurationFormatted = computed(() => {
        const d = balanceDuration.value;
        if (d <= 0) return '0.0s';
        return `${d.toFixed(1)}s`;
    });

    return {
        // State
        currentPhase,
        balanceDuration,
        totalDuration,
        standingLeg,
        ankleDiff,
        feedback,
        isBalancing,

        // Debug
        debugFps,
        debugFrameCount,
        debugLandmarkReport,
        debugAnkleDetail,
        debugCountingPipeline,
        debugPipelineCumulative,
        debugStateMachine,
        debugFrameHistory,
        debugBalanceEvents,

        // Actions
        processBalanceFrame,
        resetBalance,

        // UI helpers
        phaseLabel,
        phaseColor,
        standingLegLabel,
        balanceDurationFormatted,

        // Config
        config: cfg,
    };
}
