/**
 * useWallSitDetection.js
 *
 * Composable untuk mendeteksi dan mengukur durasi Wall Sit menggunakan
 * landmark MediaPipe Pose.
 *
 * Assessment ini adalah DURATION measurement — bukan repetition counting.
 * Mengukur berapa lama atlet dapat mempertahankan posisi Wall Sit.
 *
 * Algoritma:
 *   1. Hitung knee angle (hip → knee → ankle) dari sisi yang valid
 *   2. Jika knee angle masuk zona Wall Sit (KNEE_MIN–KNEE_MAX) selama
 *      HOLD_CONFIRM_MS → masuk fase HOLDING
 *   3. Timer berjalan selama knee angle konsisten di zona
 *   4. Jika keluar zona selama EXIT_CONFIRM_MS → timer berhenti
 *
 * State Machine:
 *   WAITING  — landmark belum cukup / pose belum valid
 *   READY    — pose valid, menunggu user masuk posisi Wall Sit
 *   HOLDING  — knee angle di zona Wall Sit dikonfirmasi, timer berjalan
 *   COMPLETE — assessment dihentikan (manual stop)
 *
 * Landmark MediaPipe yang digunakan:
 *   23 = left_hip     24 = right_hip
 *   25 = left_knee    26 = right_knee
 *   27 = left_ankle   28 = right_ankle
 *   (11, 12 = shoulder untuk validasi tubuh terlihat)
 *
 * CATATAN PENTING:
 *   Semua threshold di WALLSIT_CONFIG adalah PROVISIONAL.
 *   Harus divalidasi oleh trainer/client sebelum digunakan sebagai standar.
 */

import { ref, computed } from 'vue';

// ─────────────────────────────────────────────────────────────────────────────
// DEBUG FLAG
// ─────────────────────────────────────────────────────────────────────────────

export const WALLSIT_DEBUG = true;

// ─────────────────────────────────────────────────────────────────────────────
// WALLSIT CONFIG
// SEMUA NILAI DI BAWAH INI ADALAH PROVISIONAL.
// Harus divalidasi oleh trainer/client sebelum deployment.
// ─────────────────────────────────────────────────────────────────────────────

export const WALLSIT_CONFIG = {
    // ── Knee angle zone ──────────────────────────────────────────────────────

    /**
     * Batas bawah sudut lutut untuk dianggap posisi Wall Sit.
     * hip → knee → ankle ≥ nilai ini → masuk zona bawah.
     * Nilai 80°: lutut cukup menekuk, bukan squat terlalu dalam.
     *
     * !! PROVISIONAL — perlu kalibrasi dari data nyata !!
     * Jika false positive (squat biasa) → naikkan (misal 85°)
     * Jika terlalu sulit dikonfirmasi → turunkan (misal 70°)
     */
    KNEE_ANGLE_MIN: 80,

    /**
     * Batas atas sudut lutut untuk dianggap posisi Wall Sit.
     * hip → knee → ankle ≤ nilai ini → masuk zona atas.
     * Nilai 100°: lutut tidak terlalu lurus, masih dalam posisi duduk.
     *
     * !! PROVISIONAL — perlu kalibrasi dari data nyata !!
     * Jika terlalu ketat → naikkan (misal 110°)
     */
    KNEE_ANGLE_MAX: 100,

    // ── Timing ───────────────────────────────────────────────────────────────

    /**
     * Durasi minimum (ms) knee angle harus berada di zona Wall Sit
     * sebelum HOLDING dikonfirmasi.
     * 300ms = ~4 frame @13fps — cukup untuk membedakan transisi sesaat.
     *
     * !! PROVISIONAL !!
     */
    HOLD_CONFIRM_MS: 300,

    /**
     * Durasi minimum (ms) knee angle keluar zona sebelum HOLDING dihentikan.
     * Toleransi noise/gerakan kecil selama holding.
     * 200ms = ~2-3 frame @13fps.
     *
     * !! PROVISIONAL !!
     */
    EXIT_CONFIRM_MS: 200,

    /**
     * Durasi maksimum (ms) landmark boleh hilang saat HOLDING
     * sebelum timer dihentikan.
     */
    LANDMARK_LOST_TIMEOUT_MS: 500,

    // ── Visibility ───────────────────────────────────────────────────────────

    /** Visibility minimum per landmark (0.0–1.0). */
    MIN_VISIBILITY: 0.5,

    /**
     * Jumlah sisi minimum yang harus punya hip+knee+ankle valid.
     * 1 = single-side (cukup untuk kamera lateral/sedikit miring).
     *
     * !! PROVISIONAL — pertimbangkan naikkan ke 2 setelah UAT !!
     */
    MIN_VALID_SIDES: 1,
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const WALLSIT_PHASE = {
    WAITING:  'WAITING',  // landmark belum cukup / pose belum valid
    READY:    'READY',    // pose valid, menunggu posisi Wall Sit
    HOLDING:  'HOLDING',  // knee di zona, timer berjalan
    COMPLETE: 'COMPLETE', // assessment selesai
};

// ─────────────────────────────────────────────────────────────────────────────
// MATH UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hitung sudut (derajat) di titik B dari tiga titik A–B–C.
 * @returns {number} sudut 0–180, atau 0 jika tidak bisa dihitung
 */
function calculateAngle(a, b, c) {
    if (!a || !b || !c) return 0;
    const BAx = a.x - b.x, BAy = a.y - b.y;
    const BCx = c.x - b.x, BCy = c.y - b.y;
    const magBA = Math.sqrt(BAx * BAx + BAy * BAy);
    const magBC = Math.sqrt(BCx * BCx + BCy * BCy);
    if (magBA < 0.001 || magBC < 0.001) return 0;
    const cos   = Math.max(-1, Math.min(1, (BAx * BCx + BAy * BCy) / (magBA * magBC)));
    const angle = Math.acos(cos) * (180 / Math.PI);
    return isNaN(angle) ? 0 : Math.round(angle);
}

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

const WALLSIT_DIAGNOSTIC_LANDMARKS = [
    { name: 'L. Shoulder', index: 11 },
    { name: 'R. Shoulder', index: 12 },
    { name: 'L. Hip',      index: 23 },
    { name: 'R. Hip',      index: 24 },
    { name: 'L. Knee',     index: 25 },
    { name: 'R. Knee',     index: 26 },
    { name: 'L. Ankle',    index: 27 },
    { name: 'R. Ankle',    index: 28 },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSABLE
// ─────────────────────────────────────────────────────────────────────────────

export function useWallSitDetection(config = {}) {
    const cfg = { ...WALLSIT_CONFIG, ...config };

    // ── Reactive state ────────────────────────────────────────────────────────
    const currentPhase    = ref(WALLSIT_PHASE.WAITING);
    const holdDuration    = ref(0);   // durasi hold terakhir (detik, float)
    const bestDuration    = ref(0);   // durasi hold TERPANJANG dalam sesi
    const totalDuration   = ref(0);   // total akumulasi semua hold dalam sesi
    const kneeAngle       = ref(0);   // sudut lutut sisi yang valid (derajat)
    const countingSide    = ref('—'); // 'LEFT' | 'RIGHT' | 'BOTH' | '—'
    const feedback        = ref('');
    const isHolding       = ref(false);

    // ── Debug / FPS ───────────────────────────────────────────────────────────
    const debugFps           = ref(0);
    const debugFrameCount    = ref(0);
    const debugLastFrameTime = ref(0);
    const FPS_SAMPLE_SIZE    = 10;
    const fpsBuffer          = [];

    // ── Debug: per-landmark visibility ────────────────────────────────────────
    const debugLandmarkReport = ref([]);

    // ── Debug: knee detail per-frame ──────────────────────────────────────────
    const debugKneeDetail = ref({
        leftKneeAngle:  0,
        rightKneeAngle: 0,
        leftKneeVis:    0,   // visibility 0–100
        rightKneeVis:   0,
        leftHipVis:     0,
        rightHipVis:    0,
        leftAnkleVis:   0,
        rightAnkleVis:  0,
        leftSideValid:  false,
        rightSideValid: false,
        inZone:         false,  // apakah angle di zona Wall Sit
    });

    // ── Debug: counting pipeline per-frame ────────────────────────────────────
    const debugCountingPipeline = ref({
        validationReady:  false,
        kneeAngle:        0,
        inWallSitZone:    false,   // KNEE_MIN <= angle <= KNEE_MAX
        holdAccumMs:      0,       // akumulasi menuju HOLDING
        holdConfirmed:    false,   // fase HOLDING aktif
        inExitZone:       false,   // keluar dari zona Wall Sit
        exitAccumMs:      0,
        holdingDuration:  0,       // ms sejak HOLDING dikonfirmasi
        blockReason:      '—',
    });

    // ── Debug: cumulative counters ────────────────────────────────────────────
    const debugPipelineCumulative = ref({
        validationReadyFrames:  0,
        kneeAngleSamples:       0,
        zoneFrames:             0,   // frames di zona Wall Sit sebelum confirmed
        holdConfirmedCount:     0,   // berapa kali HOLDING dikonfirmasi
        maxHoldDurationMs:      0,   // durasi hold terlama dalam sesi
        falsePositiveGuardCount:0,
        landmarkBlockedCount:   0,
        validationBlockedCount: 0,
        lastBlockReason:        '—',
    });
    let _cumul = {
        validationReadyFrames:   0,
        kneeAngleSamples:        0,
        zoneFrames:              0,
        holdConfirmedCount:      0,
        maxHoldDurationMs:       0,
        falsePositiveGuardCount: 0,
        landmarkBlockedCount:    0,
        validationBlockedCount:  0,
        lastBlockReason:         '—',
    };

    // ── Debug: state machine diagnostics ─────────────────────────────────────
    const debugStateMachine = ref({
        prevPhase:          WALLSIT_PHASE.WAITING,
        minKneeAngleSeen:   999,
        maxKneeAngleSeen:   0,
        framesInZone:       0,
        framesOutOfZone:    0,
        holdingEverStarted: false,
        blockedByValidation:0,
        blockedByLandmark:  0,
        lastBlockReason:    '—',
        validationDropCount:0,
    });
    let _sm = {
        prevPhase:           WALLSIT_PHASE.WAITING,
        minKneeAngleSeen:    999,
        maxKneeAngleSeen:    0,
        framesInZone:        0,
        framesOutOfZone:     0,
        holdingEverStarted:  false,
        blockedByValidation: 0,
        blockedByLandmark:   0,
        lastBlockReason:     '—',
        validationDropCount: 0,
        lastValidationStatus:'READY',
    };

    // ── Debug: frame history (rolling 25) ─────────────────────────────────────
    const DEBUG_HISTORY_SIZE = 25;
    const debugFrameHistory  = ref([]);

    // ── Debug: hold event log (rolling 10) ────────────────────────────────────
    const DEBUG_EVENT_LOG_SIZE = 10;
    const debugHoldEvents      = ref([]);

    // ── Non-reactive timers ───────────────────────────────────────────────────
    let holdStartTime     = null; // timestamp saat knee pertama masuk zona
    let exitStartTime     = null; // timestamp saat knee pertama keluar zona
    let holdConfirmedTime = null; // timestamp saat HOLDING dikonfirmasi
    let landmarkLostTime  = null;

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
        if (!WALLSIT_DEBUG) return;
        const minVis = cfg.MIN_VISIBILITY;
        const report = WALLSIT_DIAGNOSTIC_LANDMARKS.map(({ name, index }) => {
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

    // ── Debug: state machine ──────────────────────────────────────────────────
    function updateStateMachineDiagnostics({ validationStatus, currentKnee, currentPhaseBefore, landmarkAvailable }) {
        if (!WALLSIT_DEBUG) return;

        if (_sm.lastValidationStatus === 'READY' && validationStatus !== 'READY') {
            _sm.validationDropCount++;
        }
        _sm.lastValidationStatus = validationStatus;

        if (validationStatus !== 'READY') {
            _sm.blockedByValidation++;
            _sm.lastBlockReason = `Validation bukan READY (${validationStatus})`;
        } else if (!landmarkAvailable) {
            _sm.blockedByLandmark++;
            _sm.lastBlockReason = 'Landmark tidak cukup (hip+knee+ankle)';
        }

        if (currentKnee > 0) {
            if (currentKnee < _sm.minKneeAngleSeen) _sm.minKneeAngleSeen = currentKnee;
            if (currentKnee > _sm.maxKneeAngleSeen) _sm.maxKneeAngleSeen = currentKnee;
        }
        const inZ = currentKnee >= cfg.KNEE_ANGLE_MIN && currentKnee <= cfg.KNEE_ANGLE_MAX;
        if (inZ)  _sm.framesInZone++;
        if (currentKnee > 0 && !inZ) _sm.framesOutOfZone++;
        if (currentPhase.value === WALLSIT_PHASE.HOLDING) _sm.holdingEverStarted = true;

        const nowPhase = currentPhase.value;
        if (nowPhase !== currentPhaseBefore) _sm.prevPhase = currentPhaseBefore;

        debugStateMachine.value = {
            prevPhase:           _sm.prevPhase,
            minKneeAngleSeen:    _sm.minKneeAngleSeen === 999 ? 0 : _sm.minKneeAngleSeen,
            maxKneeAngleSeen:    _sm.maxKneeAngleSeen,
            framesInZone:        _sm.framesInZone,
            framesOutOfZone:     _sm.framesOutOfZone,
            holdingEverStarted:  _sm.holdingEverStarted,
            blockedByValidation: _sm.blockedByValidation,
            blockedByLandmark:   _sm.blockedByLandmark,
            lastBlockReason:     _sm.lastBlockReason,
            validationDropCount: _sm.validationDropCount,
        };
    }

    // ── Debug: frame history ──────────────────────────────────────────────────
    function pushFrameHistory(validationStatus, currentKnee) {
        if (!WALLSIT_DEBUG) return;
        const entry = {
            ts:    Math.round(performance.now() / 100) / 10,
            fps:   debugFps.value,
            valid: validationStatus,
            knee:  currentKnee,
            phase: currentPhase.value,
            dur:   holdDuration.value > 0 ? holdDuration.value.toFixed(1) : '—',
            side:  countingSide.value,
        };
        const h = debugFrameHistory.value;
        debugFrameHistory.value = h.length >= DEBUG_HISTORY_SIZE
            ? [...h.slice(1), entry]
            : [...h, entry];
    }

    // ── Debug: hold event log ─────────────────────────────────────────────────
    function pushHoldEvent(startMs, endMs, reason) {
        if (!WALLSIT_DEBUG) return;
        const durationMs  = Math.round(endMs - startMs);
        const durationSec = parseFloat((durationMs / 1000).toFixed(2));
        const entry = { startMs: Math.round(startMs), endMs: Math.round(endMs), durationMs, durationSec, endReason: reason };
        const log = debugHoldEvents.value;
        debugHoldEvents.value = log.length >= DEBUG_EVENT_LOG_SIZE
            ? [...log.slice(1), entry]
            : [...log, entry];
        if (durationMs > _cumul.maxHoldDurationMs) _cumul.maxHoldDurationMs = durationMs;
    }

    // ── Landmark extraction ───────────────────────────────────────────────────

    /**
     * Ekstrak landmark Wall Sit dari array MediaPipe.
     * Landmark wajib per sisi: hip + knee + ankle.
     * Returns null jika tidak ada satu sisi pun yang valid.
     */
    function extractLandmarks(landmarks) {
        if (!landmarks || landmarks.length < 33) return null;

        const lm     = (idx) => landmarks[idx];
        const minVis = cfg.MIN_VISIBILITY;

        const leftHip    = lm(23);
        const rightHip   = lm(24);
        const leftKnee   = lm(25);
        const rightKnee  = lm(26);
        const leftAnkle  = lm(27);
        const rightAnkle = lm(28);

        const leftValid = (
            isLandmarkValid(leftHip,   minVis) &&
            isLandmarkValid(leftKnee,  minVis) &&
            isLandmarkValid(leftAnkle, minVis)
        );
        const rightValid = (
            isLandmarkValid(rightHip,   minVis) &&
            isLandmarkValid(rightKnee,  minVis) &&
            isLandmarkValid(rightAnkle, minVis)
        );

        const validSides = (leftValid ? 1 : 0) + (rightValid ? 1 : 0);
        if (validSides < cfg.MIN_VALID_SIDES) return null;

        return {
            leftHip, rightHip,
            leftKnee, rightKnee,
            leftAnkle, rightAnkle,
            leftValid, rightValid,
        };
    }

    /**
     * Hitung knee angle dari sisi yang valid.
     * Angle: hip → knee → ankle
     * Returns: { angle, side, leftAngle, rightAngle }
     */
    function computeKneeAngle(lms) {
        const angles = [];
        let leftAngle  = 0;
        let rightAngle = 0;

        if (lms.leftValid) {
            const a = calculateAngle(lms.leftHip, lms.leftKnee, lms.leftAnkle);
            leftAngle = a;
            if (a > 0) angles.push({ angle: a, side: 'LEFT' });
        }
        if (lms.rightValid) {
            const a = calculateAngle(lms.rightHip, lms.rightKnee, lms.rightAnkle);
            rightAngle = a;
            if (a > 0) angles.push({ angle: a, side: 'RIGHT' });
        }

        if (angles.length === 0) return { angle: 0, side: '—', leftAngle, rightAngle };
        if (angles.length === 1) return { ...angles[0], leftAngle, rightAngle };

        // Keduanya valid → rata-rata
        const avg = Math.round((angles[0].angle + angles[1].angle) / 2);
        return { angle: avg, side: 'BOTH', leftAngle, rightAngle };
    }

    /**
     * Hentikan HOLDING dan simpan ke event log.
     */
    function _stopHolding(nowMs, reason) {
        if (holdConfirmedTime !== null) {
            const durationMs  = nowMs - holdConfirmedTime;
            const durationSec = durationMs / 1000;
            holdDuration.value  = parseFloat(durationSec.toFixed(2));
            totalDuration.value = parseFloat((totalDuration.value + durationSec).toFixed(2));
            // Track best hold
            if (holdDuration.value > bestDuration.value) {
                bestDuration.value = holdDuration.value;
            }
            if (WALLSIT_DEBUG) pushHoldEvent(holdConfirmedTime, nowMs, reason);
        }
        currentPhase.value  = WALLSIT_PHASE.READY;
        isHolding.value     = false;
        holdConfirmedTime   = null;
        holdStartTime       = null;
        exitStartTime       = null;
        if (reason === 'KNEE_OUT') {
            feedback.value = `Berhenti — durasi: ${holdDuration.value.toFixed(1)}s`;
        }
    }

    /**
     * Fungsi utama — dipanggil setiap frame dari onPoseUpdate.
     */
    function processWallSitFrame({ landmarks, validationStatus } = {}) {
        updateFps();
        const now         = performance.now();
        const phaseBefore = currentPhase.value;

        // ── Guard: pose belum READY ───────────────────────────────────────────
        if (validationStatus !== 'READY') {
            feedback.value  = 'Tunggu posisi tubuh valid terlebih dahulu';
            isHolding.value = false;

            if (currentPhase.value === WALLSIT_PHASE.HOLDING) {
                _stopHolding(now, 'VALIDATION_LOST');
            } else {
                currentPhase.value = WALLSIT_PHASE.WAITING;
            }

            holdStartTime    = null;
            landmarkLostTime = null;

            if (WALLSIT_DEBUG) {
                _cumul.validationBlockedCount++;
                _cumul.lastBlockReason = `Validation: ${validationStatus}`;
                debugCountingPipeline.value = {
                    ...debugCountingPipeline.value,
                    validationReady: false,
                    blockReason: `Validation: ${validationStatus}`,
                };
                updateDebugDiagnostics(landmarks);
                updateStateMachineDiagnostics({ validationStatus, currentKnee: 0, currentPhaseBefore: phaseBefore, landmarkAvailable: false });
                pushFrameHistory(validationStatus, 0);
                debugPipelineCumulative.value = { ..._cumul };
            }
            return;
        }

        // ── Ekstrak landmark ──────────────────────────────────────────────────
        const lms = extractLandmarks(landmarks);
        if (WALLSIT_DEBUG) updateDebugDiagnostics(landmarks);

        if (!lms) {
            feedback.value = 'Pastikan kaki (pinggul, lutut, pergelangan) terlihat';

            if (currentPhase.value === WALLSIT_PHASE.HOLDING) {
                if (landmarkLostTime === null) landmarkLostTime = now;
                if (now - landmarkLostTime > cfg.LANDMARK_LOST_TIMEOUT_MS) {
                    _stopHolding(now, 'LANDMARK_LOST');
                    landmarkLostTime = null;
                }
            } else {
                currentPhase.value = WALLSIT_PHASE.WAITING;
                holdStartTime      = null;
                exitStartTime      = null;
                landmarkLostTime   = null;
            }

            if (WALLSIT_DEBUG) {
                _cumul.landmarkBlockedCount++;
                _cumul.lastBlockReason = 'Landmark tidak cukup (hip+knee+ankle)';
                debugCountingPipeline.value = {
                    ...debugCountingPipeline.value,
                    validationReady: true,
                    blockReason: 'Landmark tidak cukup',
                };
                updateStateMachineDiagnostics({ validationStatus, currentKnee: 0, currentPhaseBefore: phaseBefore, landmarkAvailable: false });
                pushFrameHistory(validationStatus, 0);
                debugPipelineCumulative.value = { ..._cumul };
            }
            return;
        }

        // Landmark ada → reset lost timer
        landmarkLostTime = null;

        // ── Hitung knee angle ─────────────────────────────────────────────────
        const { angle: currentKnee, side, leftAngle, rightAngle } = computeKneeAngle(lms);
        kneeAngle.value    = currentKnee;
        countingSide.value = side;

        // ── Update knee detail diagnostic ─────────────────────────────────────
        if (WALLSIT_DEBUG) {
            const minVis = cfg.MIN_VISIBILITY;
            debugKneeDetail.value = {
                leftKneeAngle:  leftAngle,
                rightKneeAngle: rightAngle,
                leftKneeVis:    lms.leftKnee  ? Math.round((lms.leftKnee.visibility  ?? 0) * 100) : 0,
                rightKneeVis:   lms.rightKnee ? Math.round((lms.rightKnee.visibility ?? 0) * 100) : 0,
                leftHipVis:     lms.leftHip   ? Math.round((lms.leftHip.visibility   ?? 0) * 100) : 0,
                rightHipVis:    lms.rightHip  ? Math.round((lms.rightHip.visibility  ?? 0) * 100) : 0,
                leftAnkleVis:   lms.leftAnkle ? Math.round((lms.leftAnkle.visibility ?? 0) * 100) : 0,
                rightAnkleVis:  lms.rightAnkle? Math.round((lms.rightAnkle.visibility?? 0) * 100) : 0,
                leftSideValid:  lms.leftValid,
                rightSideValid: lms.rightValid,
                inZone:         currentKnee >= cfg.KNEE_ANGLE_MIN && currentKnee <= cfg.KNEE_ANGLE_MAX,
            };
        }

        // ── Zone check ────────────────────────────────────────────────────────
        const inWallSitZone = currentKnee > 0 &&
                              currentKnee >= cfg.KNEE_ANGLE_MIN &&
                              currentKnee <= cfg.KNEE_ANGLE_MAX;

        // ── State machine ─────────────────────────────────────────────────────
        const phase = currentPhase.value;

        // Pastikan masuk READY dulu
        if (phase === WALLSIT_PHASE.WAITING) {
            currentPhase.value = WALLSIT_PHASE.READY;
        }

        let _pipelineBlock = '—';

        if (phase === WALLSIT_PHASE.READY || phase === WALLSIT_PHASE.WAITING) {
            // ── Menunggu user masuk posisi Wall Sit ─────────────────────────
            if (inWallSitZone) {
                if (holdStartTime === null) holdStartTime = now;
                exitStartTime = null;

                const holdElapsed = now - holdStartTime;
                if (holdElapsed >= cfg.HOLD_CONFIRM_MS) {
                    // Konfirmasi: HOLDING dimulai
                    currentPhase.value = WALLSIT_PHASE.HOLDING;
                    holdConfirmedTime  = now;  // mulai dari SEKARANG (bukan retroaktif)
                    isHolding.value    = true;
                    feedback.value     = 'Bagus! Pertahankan posisi';
                    if (WALLSIT_DEBUG) _cumul.holdConfirmedCount++;
                } else {
                    const pct = Math.round((holdElapsed / cfg.HOLD_CONFIRM_MS) * 100);
                    feedback.value = `Tahan posisi... (${pct}%)`;
                    _pipelineBlock = `Hold akumulasi: ${Math.round(holdElapsed)}ms/${cfg.HOLD_CONFIRM_MS}ms`;
                }
            } else {
                holdStartTime  = null;
                feedback.value = currentKnee > 0
                    ? `Tekuk lutut ke ~90° (sekarang ${currentKnee}°)`
                    : 'Masuk posisi Wall Sit untuk memulai';
                if (currentKnee > 0) {
                    _pipelineBlock = `Knee ${currentKnee}° di luar zona ${cfg.KNEE_ANGLE_MIN}°–${cfg.KNEE_ANGLE_MAX}°`;
                }
            }

        } else if (phase === WALLSIT_PHASE.HOLDING) {
            // ── Sedang holding — update durasi setiap frame ──────────────────
            if (holdConfirmedTime !== null) {
                const elapsedMs = now - holdConfirmedTime;
                holdDuration.value = parseFloat((elapsedMs / 1000).toFixed(2));
            }

            if (!inWallSitZone) {
                // Keluar zona — akumulasi exit
                if (exitStartTime === null) exitStartTime = now;
                const exitElapsed = now - exitStartTime;

                if (exitElapsed >= cfg.EXIT_CONFIRM_MS) {
                    _stopHolding(now, 'KNEE_OUT');
                    holdStartTime = null;
                    exitStartTime = null;
                } else {
                    const pct = Math.round((exitElapsed / cfg.EXIT_CONFIRM_MS) * 100);
                    feedback.value = `Kembali ke posisi... (${pct}%)`;
                    _pipelineBlock = `Exit akumulasi: ${Math.round(exitElapsed)}ms/${cfg.EXIT_CONFIRM_MS}ms`;
                }
            } else {
                // Masih di zona → reset exit timer
                exitStartTime  = null;
                feedback.value = `Wall Sit: ${holdDuration.value.toFixed(1)}s`;
            }

        } else if (phase === WALLSIT_PHASE.COMPLETE) {
            feedback.value = `Selesai — durasi: ${holdDuration.value.toFixed(1)}s`;
        }

        // ── Update debug diagnostics ──────────────────────────────────────────
        if (WALLSIT_DEBUG) {
            _cumul.validationReadyFrames++;
            if (currentKnee > 0) _cumul.kneeAngleSamples++;
            if (inWallSitZone)   _cumul.zoneFrames++;

            const holdElapsed = holdStartTime    !== null ? Math.round(now - holdStartTime)    : 0;
            const exitElapsed = exitStartTime    !== null ? Math.round(now - exitStartTime)    : 0;
            const holdingMs   = holdConfirmedTime !== null && phase === WALLSIT_PHASE.HOLDING
                ? Math.round(now - holdConfirmedTime) : 0;

            debugCountingPipeline.value = {
                validationReady: true,
                kneeAngle:       currentKnee,
                inWallSitZone,
                holdAccumMs:     holdElapsed,
                holdConfirmed:   phase === WALLSIT_PHASE.HOLDING,
                inExitZone:      !inWallSitZone && phase === WALLSIT_PHASE.HOLDING,
                exitAccumMs:     exitElapsed,
                holdingDuration: holdingMs,
                blockReason:     _pipelineBlock,
            };

            if (!inWallSitZone && _pipelineBlock !== '—') _cumul.lastBlockReason = _pipelineBlock;
            debugPipelineCumulative.value = { ..._cumul };

            updateStateMachineDiagnostics({ validationStatus, currentKnee, currentPhaseBefore: phaseBefore, landmarkAvailable: true });
            pushFrameHistory(validationStatus, currentKnee);
        }
    }

    /**
     * Reset seluruh state Wall Sit.
     */
    function resetWallSit() {
        currentPhase.value  = WALLSIT_PHASE.WAITING;
        holdDuration.value  = 0;
        bestDuration.value  = 0;
        totalDuration.value = 0;
        kneeAngle.value     = 0;
        countingSide.value  = '—';
        feedback.value      = '';
        isHolding.value     = false;

        holdStartTime     = null;
        exitStartTime     = null;
        holdConfirmedTime = null;
        landmarkLostTime  = null;

        fpsBuffer.length         = 0;
        debugFps.value           = 0;
        debugFrameCount.value    = 0;
        debugLastFrameTime.value = 0;

        debugLandmarkReport.value = [];
        debugFrameHistory.value   = [];
        debugHoldEvents.value     = [];
        debugKneeDetail.value = {
            leftKneeAngle: 0, rightKneeAngle: 0,
            leftKneeVis: 0, rightKneeVis: 0,
            leftHipVis: 0, rightHipVis: 0,
            leftAnkleVis: 0, rightAnkleVis: 0,
            leftSideValid: false, rightSideValid: false, inZone: false,
        };
        debugCountingPipeline.value = {
            validationReady: false, kneeAngle: 0,
            inWallSitZone: false, holdAccumMs: 0,
            holdConfirmed: false, inExitZone: false, exitAccumMs: 0,
            holdingDuration: 0, blockReason: '—',
        };
        debugPipelineCumulative.value = {
            validationReadyFrames: 0, kneeAngleSamples: 0, zoneFrames: 0,
            holdConfirmedCount: 0, maxHoldDurationMs: 0, falsePositiveGuardCount: 0,
            landmarkBlockedCount: 0, validationBlockedCount: 0, lastBlockReason: '—',
        };
        debugStateMachine.value = {
            prevPhase: WALLSIT_PHASE.WAITING, minKneeAngleSeen: 0, maxKneeAngleSeen: 0,
            framesInZone: 0, framesOutOfZone: 0, holdingEverStarted: false,
            blockedByValidation: 0, blockedByLandmark: 0,
            lastBlockReason: '—', validationDropCount: 0,
        };
        _sm = {
            prevPhase: WALLSIT_PHASE.WAITING, minKneeAngleSeen: 999, maxKneeAngleSeen: 0,
            framesInZone: 0, framesOutOfZone: 0, holdingEverStarted: false,
            blockedByValidation: 0, blockedByLandmark: 0,
            lastBlockReason: '—', validationDropCount: 0, lastValidationStatus: 'READY',
        };
        _cumul = {
            validationReadyFrames: 0, kneeAngleSamples: 0, zoneFrames: 0,
            holdConfirmedCount: 0, maxHoldDurationMs: 0, falsePositiveGuardCount: 0,
            landmarkBlockedCount: 0, validationBlockedCount: 0, lastBlockReason: '—',
        };
    }

    // ── Computed UI helpers ───────────────────────────────────────────────────

    const phaseLabel = computed(() => {
        const map = {
            [WALLSIT_PHASE.WAITING]:  'WAITING',
            [WALLSIT_PHASE.READY]:    'READY',
            [WALLSIT_PHASE.HOLDING]:  'HOLDING ⏱',
            [WALLSIT_PHASE.COMPLETE]: 'COMPLETE',
        };
        return map[currentPhase.value] ?? '—';
    });

    const phaseColor = computed(() => {
        const map = {
            [WALLSIT_PHASE.WAITING]:  'text-slate-500',
            [WALLSIT_PHASE.READY]:    'text-slate-400',
            [WALLSIT_PHASE.HOLDING]:  'text-emerald-400',
            [WALLSIT_PHASE.COMPLETE]: 'text-primary-400',
        };
        return map[currentPhase.value] ?? 'text-slate-500';
    });

    const holdDurationFormatted = computed(() => {
        const d = holdDuration.value;
        if (d <= 0) return '0.0s';
        return `${d.toFixed(1)}s`;
    });

    return {
        // State
        currentPhase,
        holdDuration,
        bestDuration,
        totalDuration,
        kneeAngle,
        countingSide,
        feedback,
        isHolding,

        // Debug
        debugFps,
        debugFrameCount,
        debugLandmarkReport,
        debugKneeDetail,
        debugCountingPipeline,
        debugPipelineCumulative,
        debugStateMachine,
        debugFrameHistory,
        debugHoldEvents,

        // Actions
        processWallSitFrame,
        resetWallSit,

        // UI helpers
        phaseLabel,
        phaseColor,
        holdDurationFormatted,

        // Config
        config: cfg,
    };
}
