/**
 * useElbowPlankDetection.js
 *
 * Composable untuk mendeteksi dan mengukur durasi Elbow Plank menggunakan
 * landmark MediaPipe Pose.
 *
 * Assessment ini adalah DURATION measurement — bukan repetition counting.
 * Mengukur berapa lama atlet dapat mempertahankan posisi plank.
 *
 * Algoritma:
 *   1. Hitung body alignment angle (shoulder → hip → ankle)
 *   2. Hitung orientation — rasio horizontal/vertical span shoulder→ankle
 *   3. KEDUA kondisi harus terpenuhi:
 *      - body angle >= BODY_ANGLE_MIN (tubuh cukup lurus)
 *      - orientationRatio >= ORIENTATION_RATIO_MIN (tubuh horizontal, bukan berdiri)
 *      - verticalSpan <= MAX_VERTICAL_SPAN (konfirmasi posisi horizontal)
 *   4. Jika valid selama HOLD_CONFIRM_MS → HOLDING, timer mulai
 *   5. Jika keluar dari kondisi valid selama EXIT_CONFIRM_MS → kembali READY
 *
 * False-positive protection terhadap posisi berdiri:
 *   Standing:  verticalSpan ~0.7, orientationRatio ~0.14 → DITOLAK
 *   Plank:     verticalSpan ~0.1, orientationRatio ~5–8  → DITERIMA
 *   Body angle saja TIDAK cukup — keduanya wajib pass.
 *
 * State Machine:
 *   WAITING  — landmark belum cukup / pose belum valid
 *   READY    — pose valid, menunggu posisi plank
 *   HOLDING  — posisi plank valid dikonfirmasi, timer berjalan
 *   COMPLETE — assessment dihentikan (manual stop)
 *
 * Landmark MediaPipe yang digunakan:
 *   11 = left_shoulder   12 = right_shoulder
 *   23 = left_hip        24 = right_hip
 *   27 = left_ankle      28 = right_ankle
 *
 * CATATAN PENTING:
 *   Semua threshold di PLANK_CONFIG adalah PROVISIONAL.
 *   Harus divalidasi oleh trainer/client sebelum digunakan sebagai standar.
 */

import { ref, computed } from 'vue';

// ─────────────────────────────────────────────────────────────────────────────
// DEBUG FLAG
// ─────────────────────────────────────────────────────────────────────────────

export const PLANK_DEBUG = true;

// ─────────────────────────────────────────────────────────────────────────────
// PLANK CONFIG
// SEMUA NILAI DI BAWAH INI ADALAH PROVISIONAL.
// Harus divalidasi oleh trainer/client sebelum deployment.
// ─────────────────────────────────────────────────────────────────────────────

export const PLANK_CONFIG = {
    // ── Body alignment angle ─────────────────────────────────────────────────

    /**
     * Sudut minimum shoulder→hip→ankle untuk dianggap tubuh cukup lurus.
     * 160° = hampir lurus, sedikit toleransi lengkung punggung.
     * Plank sempurna ≈ 175–180°.
     *
     * !! PROVISIONAL — perlu kalibrasi. Dari frontal view angle bisa lebih kecil. !!
     * Jika terlalu banyak false positive → naikkan (misal 165°)
     * Jika terlalu sulit dikonfirmasi → turunkan (misal 155°)
     */
    BODY_ANGLE_MIN: 160,

    // ── Orientation / plank vs standing guard ────────────────────────────────

    /**
     * Rasio minimum horizontalSpan/verticalSpan antara shoulder dan ankle.
     * Plank: body horizontal → ratio besar (4–8+)
     * Standing: body vertikal → ratio kecil (~0.1)
     *
     * Threshold 1.5 = body minimal 1.5x lebih horizontal dari vertical.
     *
     * !! PROVISIONAL — nilai paling kritis untuk false-positive prevention !!
     * Naikkan jika standing masih lolos (misal 2.0)
     * Turunkan jika plank susah terkonfirmasi (misal 1.0)
     */
    ORIENTATION_RATIO_MIN: 1.5,

    /**
     * Batas maksimum vertical span (koordinat Y normalized) antara
     * shoulder dan ankle. Jika > nilai ini → tubuh terlalu tegak → bukan plank.
     * Standing: ~0.6–0.8 | Plank: ~0.05–0.20
     *
     * !! PROVISIONAL !!
     * Turunkan jika standing masih lolos (misal 0.25)
     * Naikkan jika plank yang sah tertolak (misal 0.40)
     */
    MAX_VERTICAL_SPAN: 0.35,

    // ── Timing ───────────────────────────────────────────────────────────────

    /**
     * Durasi minimum (ms) posisi plank valid sebelum HOLDING dikonfirmasi.
     * 300ms = ~4 frame @13fps.
     *
     * !! PROVISIONAL !!
     */
    HOLD_CONFIRM_MS: 300,

    /**
     * Durasi minimum (ms) posisi tidak valid sebelum HOLDING dihentikan.
     * Toleransi noise/gerakan kecil selama holding.
     * 200ms = ~2-3 frame @13fps.
     *
     * !! PROVISIONAL !!
     */
    EXIT_CONFIRM_MS: 200,

    /**
     * Durasi maksimum (ms) landmark boleh hilang saat HOLDING.
     */
    LANDMARK_LOST_TIMEOUT_MS: 500,

    // ── Visibility ───────────────────────────────────────────────────────────

    /** Visibility minimum per landmark (0.0–1.0). */
    MIN_VISIBILITY: 0.5,

    /**
     * Jumlah sisi minimum yang harus punya shoulder+hip+ankle valid.
     * 1 = single-side (lateral view cukup).
     *
     * !! PROVISIONAL !!
     */
    MIN_VALID_SIDES: 1,
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const PLANK_PHASE = {
    WAITING:  'WAITING',  // landmark belum cukup / pose belum valid
    READY:    'READY',    // pose valid, menunggu posisi plank
    HOLDING:  'HOLDING',  // posisi plank valid, timer berjalan
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

const PLANK_DIAGNOSTIC_LANDMARKS = [
    { name: 'L. Shoulder', index: 11 },
    { name: 'R. Shoulder', index: 12 },
    { name: 'L. Elbow',    index: 13 },
    { name: 'R. Elbow',    index: 14 },
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

export function useElbowPlankDetection(config = {}) {
    const cfg = { ...PLANK_CONFIG, ...config };

    // ── Reactive state ────────────────────────────────────────────────────────
    const currentPhase   = ref(PLANK_PHASE.WAITING);
    const holdDuration   = ref(0);    // durasi hold terakhir (detik, float)
    const bestDuration   = ref(0);    // durasi hold TERPANJANG dalam sesi
    const totalDuration  = ref(0);    // total akumulasi semua hold sesi ini
    const bodyAngle      = ref(0);    // sudut body alignment sisi valid (derajat)
    const countingSide   = ref('—'); // 'LEFT' | 'RIGHT' | 'BOTH' | '—'
    const feedback       = ref('');
    const isHolding      = ref(false);

    // ── Debug / FPS ───────────────────────────────────────────────────────────
    const debugFps           = ref(0);
    const debugFrameCount    = ref(0);
    const debugLastFrameTime = ref(0);
    const FPS_SAMPLE_SIZE    = 10;
    const fpsBuffer          = [];

    // ── Debug: per-landmark visibility ────────────────────────────────────────
    const debugLandmarkReport = ref([]);

    // ── Debug: alignment detail per-frame ─────────────────────────────────────
    const debugAlignmentDetail = ref({
        leftBodyAngle:      0,
        rightBodyAngle:     0,
        // Shoulder landmark yang digunakan (sisi yang valid)
        shoulderVis:        0,
        hipVis:             0,
        ankleVis:           0,
        // Orientation metrics (dari sisi yang valid atau avg kedua sisi)
        horizontalSpan:     0,   // |shoulder.x - ankle.x|
        verticalSpan:       0,   // |shoulder.y - ankle.y|
        orientationRatio:   0,   // horizontalSpan / (verticalSpan + 0.001)
        // Guard results
        angleValid:         false,   // bodyAngle >= BODY_ANGLE_MIN
        orientationValid:   false,   // ratio >= ORIENTATION_RATIO_MIN
        verticalSpanValid:  false,   // verticalSpan <= MAX_VERTICAL_SPAN
        plankValid:         false,   // semua guard pass
        leftSideValid:      false,
        rightSideValid:     false,
    });

    // ── Debug: pipeline per-frame ──────────────────────────────────────────────
    const debugCountingPipeline = ref({
        validationReady:    false,
        bodyAngle:          0,
        angleValid:         false,
        orientationValid:   false,
        verticalSpanValid:  false,
        plankValid:         false,
        holdAccumMs:        0,
        holdConfirmed:      false,
        inExitZone:         false,
        exitAccumMs:        0,
        holdingDuration:    0,
        blockReason:        '—',
    });

    // ── Debug: cumulative counters ────────────────────────────────────────────
    const debugPipelineCumulative = ref({
        validationReadyFrames:   0,
        bodyAngleSamples:        0,
        plankValidFrames:        0,
        holdConfirmedCount:      0,
        maxHoldDurationMs:       0,
        blockedByAngle:          0,
        blockedByOrientation:    0,
        blockedByVerticalSpan:   0,
        landmarkBlockedCount:    0,
        validationBlockedCount:  0,
        lastBlockReason:         '—',
    });
    let _cumul = {
        validationReadyFrames:   0,
        bodyAngleSamples:        0,
        plankValidFrames:        0,
        holdConfirmedCount:      0,
        maxHoldDurationMs:       0,
        blockedByAngle:          0,
        blockedByOrientation:    0,
        blockedByVerticalSpan:   0,
        landmarkBlockedCount:    0,
        validationBlockedCount:  0,
        lastBlockReason:         '—',
    };

    // ── Debug: state machine diagnostics ─────────────────────────────────────
    const debugStateMachine = ref({
        prevPhase:           PLANK_PHASE.WAITING,
        minBodyAngleSeen:    999,
        maxBodyAngleSeen:    0,
        minRatioSeen:        999,
        maxRatioSeen:        0,
        framesPlankValid:    0,
        holdingEverStarted:  false,
        blockedByValidation: 0,
        blockedByLandmark:   0,
        lastBlockReason:     '—',
        validationDropCount: 0,
    });
    let _sm = {
        prevPhase:           PLANK_PHASE.WAITING,
        minBodyAngleSeen:    999,
        maxBodyAngleSeen:    0,
        minRatioSeen:        999,
        maxRatioSeen:        0,
        framesPlankValid:    0,
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
    let holdStartTime     = null; // timestamp saat plank pertama valid
    let exitStartTime     = null; // timestamp saat plank pertama tidak valid
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
        if (!PLANK_DEBUG) return;
        const minVis = cfg.MIN_VISIBILITY;
        debugLandmarkReport.value = PLANK_DIAGNOSTIC_LANDMARKS.map(({ name, index }) => {
            const lm  = landmarks?.[index];
            const vis = lm != null ? Math.round((lm.visibility ?? 0) * 100) : null;
            let status;
            if (lm == null || vis === null)          status = 'MISSING';
            else if ((lm.visibility ?? 0) >= minVis) status = 'VISIBLE';
            else                                     status = 'LOW';
            return { name, index, vis, status };
        });
    }

    // ── Debug: state machine ──────────────────────────────────────────────────
    function updateStateMachineDiagnostics({ validationStatus, currentAngle, currentRatio, phaseBefore, landmarkAvailable }) {
        if (!PLANK_DEBUG) return;

        if (_sm.lastValidationStatus === 'READY' && validationStatus !== 'READY') _sm.validationDropCount++;
        _sm.lastValidationStatus = validationStatus;

        if (validationStatus !== 'READY') {
            _sm.blockedByValidation++;
            _sm.lastBlockReason = `Validation bukan READY (${validationStatus})`;
        } else if (!landmarkAvailable) {
            _sm.blockedByLandmark++;
            _sm.lastBlockReason = 'Landmark tidak cukup (shoulder+hip+ankle)';
        }

        if (currentAngle > 0) {
            if (currentAngle < _sm.minBodyAngleSeen) _sm.minBodyAngleSeen = currentAngle;
            if (currentAngle > _sm.maxBodyAngleSeen) _sm.maxBodyAngleSeen = currentAngle;
        }
        if (currentRatio > 0) {
            if (currentRatio < _sm.minRatioSeen) _sm.minRatioSeen = currentRatio;
            if (currentRatio > _sm.maxRatioSeen) _sm.maxRatioSeen = currentRatio;
        }
        if (currentPhase.value === PLANK_PHASE.HOLDING) _sm.holdingEverStarted = true;
        if (currentPhase.value !== phaseBefore) _sm.prevPhase = phaseBefore;

        debugStateMachine.value = {
            prevPhase:           _sm.prevPhase,
            minBodyAngleSeen:    _sm.minBodyAngleSeen === 999 ? 0 : _sm.minBodyAngleSeen,
            maxBodyAngleSeen:    _sm.maxBodyAngleSeen,
            minRatioSeen:        _sm.minRatioSeen === 999 ? 0 : parseFloat(_sm.minRatioSeen.toFixed(2)),
            maxRatioSeen:        parseFloat(_sm.maxRatioSeen.toFixed(2)),
            framesPlankValid:    _sm.framesPlankValid,
            holdingEverStarted:  _sm.holdingEverStarted,
            blockedByValidation: _sm.blockedByValidation,
            blockedByLandmark:   _sm.blockedByLandmark,
            lastBlockReason:     _sm.lastBlockReason,
            validationDropCount: _sm.validationDropCount,
        };
    }

    // ── Debug: frame history ──────────────────────────────────────────────────
    function pushFrameHistory(validationStatus, angle, ratio, plankValid) {
        if (!PLANK_DEBUG) return;
        const entry = {
            ts:         Math.round(performance.now() / 100) / 10,
            fps:        debugFps.value,
            valid:      validationStatus,
            angle,
            ratio:      parseFloat(ratio.toFixed(2)),
            plank:      plankValid,
            phase:      currentPhase.value,
            dur:        holdDuration.value > 0 ? holdDuration.value.toFixed(1) : '—',
        };
        const h = debugFrameHistory.value;
        debugFrameHistory.value = h.length >= DEBUG_HISTORY_SIZE
            ? [...h.slice(1), entry]
            : [...h, entry];
    }

    // ── Debug: hold event log ─────────────────────────────────────────────────
    function pushHoldEvent(startMs, endMs, reason) {
        if (!PLANK_DEBUG) return;
        const durationMs  = Math.round(endMs - startMs);
        const entry = {
            startMs: Math.round(startMs), endMs: Math.round(endMs),
            durationMs, durationSec: parseFloat((durationMs / 1000).toFixed(2)),
            endReason: reason,
        };
        const log = debugHoldEvents.value;
        debugHoldEvents.value = log.length >= DEBUG_EVENT_LOG_SIZE
            ? [...log.slice(1), entry]
            : [...log, entry];
        if (durationMs > _cumul.maxHoldDurationMs) _cumul.maxHoldDurationMs = durationMs;
    }

    // ── Landmark extraction ───────────────────────────────────────────────────

    /**
     * Ekstrak landmark Elbow Plank dari array MediaPipe.
     * Wajib per sisi: shoulder + hip + ankle.
     * Returns null jika tidak ada satu sisi pun yang valid.
     */
    function extractLandmarks(landmarks) {
        if (!landmarks || landmarks.length < 33) return null;

        const lm     = (idx) => landmarks[idx];
        const minVis = cfg.MIN_VISIBILITY;

        const leftShoulder  = lm(11);
        const rightShoulder = lm(12);
        const leftHip       = lm(23);
        const rightHip      = lm(24);
        const leftAnkle     = lm(27);
        const rightAnkle    = lm(28);

        const leftValid = (
            isLandmarkValid(leftShoulder,  minVis) &&
            isLandmarkValid(leftHip,       minVis) &&
            isLandmarkValid(leftAnkle,     minVis)
        );
        const rightValid = (
            isLandmarkValid(rightShoulder, minVis) &&
            isLandmarkValid(rightHip,      minVis) &&
            isLandmarkValid(rightAnkle,    minVis)
        );

        const validSides = (leftValid ? 1 : 0) + (rightValid ? 1 : 0);
        if (validSides < cfg.MIN_VALID_SIDES) return null;

        return {
            leftShoulder, rightShoulder,
            leftHip,      rightHip,
            leftAnkle,    rightAnkle,
            leftValid, rightValid,
        };
    }

    /**
     * Hitung body alignment angle (shoulder→hip→ankle) dan orientation metrics.
     *
     * Orientation guard:
     *   horizontalSpan = |shoulder.x - ankle.x|
     *   verticalSpan   = |shoulder.y - ankle.y|
     *   ratio          = horizontalSpan / (verticalSpan + 0.001)
     *
     *   Standing:  verticalSpan ~0.7, ratio ~0.14 → DITOLAK
     *   Plank:     verticalSpan ~0.1, ratio ~5–8  → DITERIMA
     *
     * Returns:
     *   { angle, side, leftAngle, rightAngle,
     *     horizontalSpan, verticalSpan, orientationRatio,
     *     shoulderVis, hipVis, ankleVis }
     */
    function computeAlignmentAndOrientation(lms) {
        const angles = [];
        let leftAngle  = 0;
        let rightAngle = 0;

        // Hitung angle dari sisi yang valid
        if (lms.leftValid) {
            const a = calculateAngle(lms.leftShoulder, lms.leftHip, lms.leftAnkle);
            leftAngle = a;
            if (a > 0) angles.push({ angle: a, side: 'LEFT',
                shoulder: lms.leftShoulder, ankle: lms.leftAnkle,
                shoulderVis: Math.round((lms.leftShoulder?.visibility ?? 0) * 100),
                hipVis:      Math.round((lms.leftHip?.visibility      ?? 0) * 100),
                ankleVis:    Math.round((lms.leftAnkle?.visibility     ?? 0) * 100),
            });
        }
        if (lms.rightValid) {
            const a = calculateAngle(lms.rightShoulder, lms.rightHip, lms.rightAnkle);
            rightAngle = a;
            if (a > 0) angles.push({ angle: a, side: 'RIGHT',
                shoulder: lms.rightShoulder, ankle: lms.rightAnkle,
                shoulderVis: Math.round((lms.rightShoulder?.visibility ?? 0) * 100),
                hipVis:      Math.round((lms.rightHip?.visibility       ?? 0) * 100),
                ankleVis:    Math.round((lms.rightAnkle?.visibility      ?? 0) * 100),
            });
        }

        if (angles.length === 0) {
            return { angle: 0, side: '—', leftAngle, rightAngle,
                     horizontalSpan: 0, verticalSpan: 0, orientationRatio: 0,
                     shoulderVis: 0, hipVis: 0, ankleVis: 0 };
        }

        // Pilih sisi utama: jika keduanya valid, gunakan rata-rata angle
        // tapi orientation dihitung dari sisi dengan visibility lebih tinggi
        let primary = angles[0];
        let avgAngle = angles[0].angle;
        let side = angles[0].side;

        if (angles.length === 2) {
            avgAngle = Math.round((angles[0].angle + angles[1].angle) / 2);
            side = 'BOTH';
            // Pilih sisi dengan shoulder visibility tertinggi untuk orientation
            primary = angles[0].shoulderVis >= angles[1].shoulderVis ? angles[0] : angles[1];
        }

        // Hitung orientation dari landmark sisi primary
        const sh = primary.shoulder;
        const an = primary.ankle;
        const horizontalSpan  = parseFloat(Math.abs((sh?.x ?? 0) - (an?.x ?? 0)).toFixed(3));
        const verticalSpan    = parseFloat(Math.abs((sh?.y ?? 0) - (an?.y ?? 0)).toFixed(3));
        const orientationRatio = parseFloat((horizontalSpan / (verticalSpan + 0.001)).toFixed(2));

        return {
            angle: avgAngle, side, leftAngle, rightAngle,
            horizontalSpan, verticalSpan, orientationRatio,
            shoulderVis: primary.shoulderVis,
            hipVis:      primary.hipVis,
            ankleVis:    primary.ankleVis,
        };
    }

    /**
     * Evaluasi apakah kondisi plank terpenuhi berdasarkan angle + orientation.
     * Semua guard harus pass.
     */
    function isPlankValid(angle, orientationRatio, verticalSpan) {
        const angleOk    = angle >= cfg.BODY_ANGLE_MIN;
        const ratioOk    = orientationRatio >= cfg.ORIENTATION_RATIO_MIN;
        const vSpanOk    = verticalSpan <= cfg.MAX_VERTICAL_SPAN;
        return { angleOk, ratioOk, vSpanOk, allOk: angleOk && ratioOk && vSpanOk };
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
            if (PLANK_DEBUG) pushHoldEvent(holdConfirmedTime, nowMs, reason);
        }
        currentPhase.value = PLANK_PHASE.READY;
        isHolding.value    = false;
        holdConfirmedTime  = null;
        holdStartTime      = null;
        exitStartTime      = null;
        if (reason === 'PLANK_LOST') {
            feedback.value = `Berhenti — durasi: ${holdDuration.value.toFixed(1)}s`;
        }
    }

    /**
     * Fungsi utama — dipanggil setiap frame dari onPoseUpdate.
     */
    function processPlankFrame({ landmarks, validationStatus } = {}) {
        updateFps();
        const now         = performance.now();
        const phaseBefore = currentPhase.value;

        // ── Guard: pose belum READY ───────────────────────────────────────────
        if (validationStatus !== 'READY') {
            feedback.value  = 'Tunggu posisi tubuh valid terlebih dahulu';
            isHolding.value = false;

            if (currentPhase.value === PLANK_PHASE.HOLDING) {
                _stopHolding(now, 'VALIDATION_LOST');
            } else {
                currentPhase.value = PLANK_PHASE.WAITING;
            }

            holdStartTime    = null;
            landmarkLostTime = null;

            if (PLANK_DEBUG) {
                _cumul.validationBlockedCount++;
                _cumul.lastBlockReason = `Validation: ${validationStatus}`;
                debugCountingPipeline.value = {
                    ...debugCountingPipeline.value,
                    validationReady: false,
                    blockReason: `Validation: ${validationStatus}`,
                };
                updateDebugDiagnostics(landmarks);
                updateStateMachineDiagnostics({
                    validationStatus, currentAngle: 0, currentRatio: 0,
                    phaseBefore, landmarkAvailable: false,
                });
                pushFrameHistory(validationStatus, 0, 0, false);
                debugPipelineCumulative.value = { ..._cumul };
            }
            return;
        }

        // ── Ekstrak landmark ──────────────────────────────────────────────────
        const lms = extractLandmarks(landmarks);
        if (PLANK_DEBUG) updateDebugDiagnostics(landmarks);

        if (!lms) {
            feedback.value = 'Pastikan bahu, pinggul, dan pergelangan kaki terlihat';

            if (currentPhase.value === PLANK_PHASE.HOLDING) {
                if (landmarkLostTime === null) landmarkLostTime = now;
                if (now - landmarkLostTime > cfg.LANDMARK_LOST_TIMEOUT_MS) {
                    _stopHolding(now, 'LANDMARK_LOST');
                    landmarkLostTime = null;
                }
            } else {
                currentPhase.value = PLANK_PHASE.WAITING;
                holdStartTime      = null;
                exitStartTime      = null;
                landmarkLostTime   = null;
            }

            if (PLANK_DEBUG) {
                _cumul.landmarkBlockedCount++;
                _cumul.lastBlockReason = 'Landmark tidak cukup';
                debugCountingPipeline.value = {
                    ...debugCountingPipeline.value,
                    validationReady: true,
                    blockReason: 'Landmark tidak cukup (shoulder+hip+ankle)',
                };
                updateStateMachineDiagnostics({
                    validationStatus, currentAngle: 0, currentRatio: 0,
                    phaseBefore, landmarkAvailable: false,
                });
                pushFrameHistory(validationStatus, 0, 0, false);
                debugPipelineCumulative.value = { ..._cumul };
            }
            return;
        }

        // Landmark ada → reset lost timer
        landmarkLostTime = null;

        // ── Hitung angle + orientation ────────────────────────────────────────
        const {
            angle: currentAngle, side,
            leftAngle, rightAngle,
            horizontalSpan, verticalSpan, orientationRatio,
            shoulderVis, hipVis, ankleVis,
        } = computeAlignmentAndOrientation(lms);

        bodyAngle.value    = currentAngle;
        countingSide.value = side;

        // ── Evaluasi plank validity ───────────────────────────────────────────
        const { angleOk, ratioOk, vSpanOk, allOk: plankOk } =
            isPlankValid(currentAngle, orientationRatio, verticalSpan);

        // ── Update alignment detail diagnostic ────────────────────────────────
        if (PLANK_DEBUG) {
            debugAlignmentDetail.value = {
                leftBodyAngle:     leftAngle,
                rightBodyAngle:    rightAngle,
                shoulderVis, hipVis, ankleVis,
                horizontalSpan,
                verticalSpan,
                orientationRatio,
                angleValid:        angleOk,
                orientationValid:  ratioOk,
                verticalSpanValid: vSpanOk,
                plankValid:        plankOk,
                leftSideValid:     lms.leftValid,
                rightSideValid:    lms.rightValid,
            };
        }

        // ── State machine ─────────────────────────────────────────────────────
        const phase = currentPhase.value;
        if (phase === PLANK_PHASE.WAITING) currentPhase.value = PLANK_PHASE.READY;

        let _pipelineBlock = '—';

        if (phase === PLANK_PHASE.READY || phase === PLANK_PHASE.WAITING) {
            if (plankOk) {
                // Akumulasi menuju HOLDING
                if (holdStartTime === null) holdStartTime = now;
                exitStartTime = null;

                const holdElapsed = now - holdStartTime;
                if (holdElapsed >= cfg.HOLD_CONFIRM_MS) {
                    currentPhase.value = PLANK_PHASE.HOLDING;
                    holdConfirmedTime  = now;  // mulai dari SEKARANG (bukan retroaktif)
                    isHolding.value    = true;
                    feedback.value     = 'Bagus! Pertahankan posisi plank';
                    if (PLANK_DEBUG) _cumul.holdConfirmedCount++;
                } else {
                    const pct = Math.round((holdElapsed / cfg.HOLD_CONFIRM_MS) * 100);
                    feedback.value = `Tahan posisi plank... (${pct}%)`;
                    _pipelineBlock = `Hold akumulasi: ${Math.round(holdElapsed)}ms/${cfg.HOLD_CONFIRM_MS}ms`;
                }
            } else {
                holdStartTime = null;
                // Feedback spesifik berdasarkan guard mana yang gagal
                if (!vSpanOk) {
                    feedback.value = `Berbaring/tidur untuk mulai plank (vertical span terlalu besar: ${verticalSpan.toFixed(2)})`;
                    _pipelineBlock = `Vertical span ${verticalSpan.toFixed(2)} > ${cfg.MAX_VERTICAL_SPAN} (berdiri terdeteksi)`;
                } else if (!ratioOk) {
                    feedback.value = `Posisikan tubuh horizontal (ratio: ${orientationRatio.toFixed(1)}, min: ${cfg.ORIENTATION_RATIO_MIN})`;
                    _pipelineBlock = `Orientation ratio ${orientationRatio.toFixed(2)} < ${cfg.ORIENTATION_RATIO_MIN}`;
                } else if (!angleOk) {
                    feedback.value = `Luruskan tubuh lebih (${currentAngle}° < ${cfg.BODY_ANGLE_MIN}°)`;
                    _pipelineBlock = `Body angle ${currentAngle}° < ${cfg.BODY_ANGLE_MIN}° (BODY_ANGLE_MIN)`;
                } else {
                    feedback.value = 'Masuk posisi plank untuk memulai';
                }
            }

        } else if (phase === PLANK_PHASE.HOLDING) {
            // Update durasi setiap frame
            if (holdConfirmedTime !== null) {
                holdDuration.value = parseFloat(((now - holdConfirmedTime) / 1000).toFixed(2));
            }

            if (!plankOk) {
                // Akumulasi keluar zona
                if (exitStartTime === null) exitStartTime = now;
                const exitElapsed = now - exitStartTime;

                if (exitElapsed >= cfg.EXIT_CONFIRM_MS) {
                    _stopHolding(now, 'PLANK_LOST');
                    holdStartTime = null;
                    exitStartTime = null;
                } else {
                    const pct = Math.round((exitElapsed / cfg.EXIT_CONFIRM_MS) * 100);
                    feedback.value = `Kembali ke posisi... (${pct}%)`;
                    _pipelineBlock = `Exit akumulasi: ${Math.round(exitElapsed)}ms/${cfg.EXIT_CONFIRM_MS}ms`;
                }
            } else {
                exitStartTime  = null;
                feedback.value = `Plank: ${holdDuration.value.toFixed(1)}s`;
            }

        } else if (phase === PLANK_PHASE.COMPLETE) {
            feedback.value = `Selesai — durasi: ${holdDuration.value.toFixed(1)}s`;
        }

        // ── Update debug diagnostics ──────────────────────────────────────────
        if (PLANK_DEBUG) {
            _cumul.validationReadyFrames++;
            if (currentAngle > 0) _cumul.bodyAngleSamples++;
            if (plankOk)          _cumul.plankValidFrames++;
            if (!angleOk && currentAngle > 0)  _cumul.blockedByAngle++;
            if (!ratioOk && currentAngle > 0)  _cumul.blockedByOrientation++;
            if (!vSpanOk && currentAngle > 0)  _cumul.blockedByVerticalSpan++;
            if (plankOk) _sm.framesPlankValid++;

            const holdElapsed = holdStartTime    !== null ? Math.round(now - holdStartTime)    : 0;
            const exitElapsed = exitStartTime    !== null ? Math.round(now - exitStartTime)    : 0;
            const holdingMs   = holdConfirmedTime !== null && phase === PLANK_PHASE.HOLDING
                ? Math.round(now - holdConfirmedTime) : 0;

            debugCountingPipeline.value = {
                validationReady:   true,
                bodyAngle:         currentAngle,
                angleValid:        angleOk,
                orientationValid:  ratioOk,
                verticalSpanValid: vSpanOk,
                plankValid:        plankOk,
                holdAccumMs:       holdElapsed,
                holdConfirmed:     phase === PLANK_PHASE.HOLDING,
                inExitZone:        !plankOk && phase === PLANK_PHASE.HOLDING,
                exitAccumMs:       exitElapsed,
                holdingDuration:   holdingMs,
                blockReason:       _pipelineBlock,
            };

            if (!plankOk && _pipelineBlock !== '—') _cumul.lastBlockReason = _pipelineBlock;
            debugPipelineCumulative.value = { ..._cumul };

            updateStateMachineDiagnostics({
                validationStatus, currentAngle, currentRatio: orientationRatio,
                phaseBefore, landmarkAvailable: true,
            });
            pushFrameHistory(validationStatus, currentAngle, orientationRatio, plankOk);
        }
    }

    /**
     * Reset seluruh state Elbow Plank.
     */
    function resetPlank() {
        currentPhase.value  = PLANK_PHASE.WAITING;
        holdDuration.value  = 0;
        bestDuration.value  = 0;
        totalDuration.value = 0;
        bodyAngle.value     = 0;
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

        debugAlignmentDetail.value = {
            leftBodyAngle: 0, rightBodyAngle: 0,
            shoulderVis: 0, hipVis: 0, ankleVis: 0,
            horizontalSpan: 0, verticalSpan: 0, orientationRatio: 0,
            angleValid: false, orientationValid: false, verticalSpanValid: false,
            plankValid: false, leftSideValid: false, rightSideValid: false,
        };
        debugCountingPipeline.value = {
            validationReady: false, bodyAngle: 0,
            angleValid: false, orientationValid: false, verticalSpanValid: false,
            plankValid: false, holdAccumMs: 0, holdConfirmed: false,
            inExitZone: false, exitAccumMs: 0, holdingDuration: 0, blockReason: '—',
        };
        debugPipelineCumulative.value = {
            validationReadyFrames: 0, bodyAngleSamples: 0, plankValidFrames: 0,
            holdConfirmedCount: 0, maxHoldDurationMs: 0,
            blockedByAngle: 0, blockedByOrientation: 0, blockedByVerticalSpan: 0,
            landmarkBlockedCount: 0, validationBlockedCount: 0, lastBlockReason: '—',
        };
        debugStateMachine.value = {
            prevPhase: PLANK_PHASE.WAITING, minBodyAngleSeen: 0, maxBodyAngleSeen: 0,
            minRatioSeen: 0, maxRatioSeen: 0, framesPlankValid: 0,
            holdingEverStarted: false, blockedByValidation: 0, blockedByLandmark: 0,
            lastBlockReason: '—', validationDropCount: 0,
        };
        _sm = {
            prevPhase: PLANK_PHASE.WAITING, minBodyAngleSeen: 999, maxBodyAngleSeen: 0,
            minRatioSeen: 999, maxRatioSeen: 0, framesPlankValid: 0,
            holdingEverStarted: false, blockedByValidation: 0, blockedByLandmark: 0,
            lastBlockReason: '—', validationDropCount: 0, lastValidationStatus: 'READY',
        };
        _cumul = {
            validationReadyFrames: 0, bodyAngleSamples: 0, plankValidFrames: 0,
            holdConfirmedCount: 0, maxHoldDurationMs: 0,
            blockedByAngle: 0, blockedByOrientation: 0, blockedByVerticalSpan: 0,
            landmarkBlockedCount: 0, validationBlockedCount: 0, lastBlockReason: '—',
        };
    }

    // ── Computed UI helpers ───────────────────────────────────────────────────

    const phaseLabel = computed(() => ({
        [PLANK_PHASE.WAITING]:  'WAITING',
        [PLANK_PHASE.READY]:    'READY',
        [PLANK_PHASE.HOLDING]:  'HOLDING ⏱',
        [PLANK_PHASE.COMPLETE]: 'COMPLETE',
    }[currentPhase.value] ?? '—'));

    const phaseColor = computed(() => ({
        [PLANK_PHASE.WAITING]:  'text-slate-500',
        [PLANK_PHASE.READY]:    'text-slate-400',
        [PLANK_PHASE.HOLDING]:  'text-emerald-400',
        [PLANK_PHASE.COMPLETE]: 'text-primary-400',
    }[currentPhase.value] ?? 'text-slate-500'));

    const holdDurationFormatted = computed(() => {
        const d = holdDuration.value;
        return d <= 0 ? '0.0s' : `${d.toFixed(1)}s`;
    });

    return {
        // State
        currentPhase, holdDuration, bestDuration, totalDuration,
        bodyAngle, countingSide, feedback, isHolding,

        // Debug
        debugFps, debugFrameCount, debugLandmarkReport,
        debugAlignmentDetail, debugCountingPipeline,
        debugPipelineCumulative, debugStateMachine,
        debugFrameHistory, debugHoldEvents,

        // Actions
        processPlankFrame, resetPlank,

        // UI helpers
        phaseLabel, phaseColor, holdDurationFormatted,

        // Config
        config: cfg,
    };
}
