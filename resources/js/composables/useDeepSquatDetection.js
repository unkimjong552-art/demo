/**
 * useDeepSquatDetection.js
 *
 * Composable untuk mendeteksi dan menghitung repetisi Deep Squat secara
 * realtime menggunakan landmark MediaPipe Pose.
 *
 * Assessment ini adalah REPETITION COUNTING — bukan duration.
 * Mengukur jumlah repetisi squat penuh yang berhasil dilakukan.
 *
 * Algoritma:
 *   1. Hitung knee angle (hip → knee → ankle) dari sisi yang valid
 *   2. State machine: READY → DOWN_DETECTED → DOWN_CONFIRMED → UP_DETECTED → REP++
 *   3. Stabilisasi BERBASIS WAKTU (ms), konsisten di semua FPS
 *   4. Hysteresis antara DOWN/UP threshold mencegah double counting
 *
 * Fase gerakan Deep Squat:
 *   READY         — posisi berdiri, menunggu gerakan squat
 *   DOWN_DETECTED — knee angle masuk zona squat, menunggu konfirmasi
 *   DOWN_CONFIRMED— squat penuh terkonfirmasi (phase DOWN)
 *   UP_DETECTED   — knee angle kembali ke zona berdiri, menunggu konfirmasi
 *   REP++         — repetisi dihitung saat UP dikonfirmasi
 *
 * Hysteresis:
 *   DOWN zone: knee angle ≤ SQUAT_DOWN_ANGLE (contoh 110°)
 *   UP zone:   knee angle ≥ SQUAT_UP_ANGLE   (contoh 150°)
 *   Dead zone: 110° < angle < 150° — tidak trigger transisi
 *   Ini mencegah flicker di sekitar threshold tunggal.
 *
 * Landmark MediaPipe yang digunakan:
 *   23 = left_hip     24 = right_hip
 *   25 = left_knee    26 = right_knee
 *   27 = left_ankle   28 = right_ankle
 *
 * CATATAN PENTING:
 *   Semua threshold di DEEPSQUAT_CONFIG adalah PROVISIONAL.
 *   Harus divalidasi oleh trainer/client sebelum deployment.
 */

import { ref, computed } from 'vue';

// ─────────────────────────────────────────────────────────────────────────────
// DEBUG FLAG
// ─────────────────────────────────────────────────────────────────────────────

export const DEEPSQUAT_DEBUG = true;

// ─────────────────────────────────────────────────────────────────────────────
// DEEPSQUAT CONFIG
// SEMUA NILAI DI BAWAH INI ADALAH PROVISIONAL.
// ─────────────────────────────────────────────────────────────────────────────

export const DEEPSQUAT_CONFIG = {
    // ── Angle thresholds (hysteresis) ────────────────────────────────────────

    /**
     * Knee angle maksimum untuk dianggap posisi DOWN (squat penuh).
     * hip→knee→ankle ≤ nilai ini → akumulasi DOWN dimulai.
     * Deep squat penuh: ~70–90°. Dari frontal view bisa lebih besar.
     * Nilai 110° adalah toleransi awal.
     *
     * !! PROVISIONAL — naikkan jika squat tidak terdeteksi !!
     * !! Turunkan jika berdiri sedikit menekuk memicu false positive !!
     */
    SQUAT_DOWN_ANGLE: 110,

    /**
     * Knee angle minimum untuk dianggap posisi UP (berdiri kembali).
     * hip→knee→ankle ≥ nilai ini → akumulasi UP dimulai → REP++.
     * Berdiri tegak: ~160–175°.
     *
     * HYSTERESIS: UP_ANGLE harus LEBIH BESAR dari DOWN_ANGLE untuk
     * mencegah double counting. Dead zone = DOWN_ANGLE < angle < UP_ANGLE.
     *
     * !! PROVISIONAL !!
     */
    SQUAT_UP_ANGLE: 150,

    // ── Stabilization timing ─────────────────────────────────────────────────

    /**
     * Durasi minimum (ms) knee angle harus di zona DOWN sebelum dikonfirmasi.
     * Mencegah false positive dari gerakan sesaat.
     * 50ms < 1 frame @13fps (77ms) — satu frame cukup.
     *
     * !! PROVISIONAL !!
     */
    DOWN_STABLE_DURATION_MS: 50,

    /**
     * Durasi minimum (ms) knee angle harus di zona UP sebelum REP dihitung.
     * 50ms < 1 frame @13fps.
     *
     * !! PROVISIONAL !!
     */
    UP_STABLE_DURATION_MS: 50,

    /**
     * Durasi maksimum (ms) landmark boleh hilang saat DOWN sebelum
     * repetisi dibatalkan.
     */
    LANDMARK_LOST_TIMEOUT_MS: 500,

    // ── Visibility ───────────────────────────────────────────────────────────

    /** Visibility minimum per landmark (0.0–1.0). */
    MIN_VISIBILITY: 0.5,

    /**
     * Jumlah sisi minimum yang harus punya hip+knee+ankle valid.
     * 1 = single-side — cukup untuk frontal view.
     *
     * !! PROVISIONAL !!
     */
    MIN_VALID_SIDES: 1,
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const DEEPSQUAT_PHASE = {
    READY:  'READY',   // berdiri, menunggu gerakan turun
    DOWN:   'DOWN',    // squat terkonfirmasi, menunggu naik
};

// ─────────────────────────────────────────────────────────────────────────────
// MATH UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

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

function isLandmarkValid(lm, minVisibility) {
    return lm != null &&
           typeof lm.x === 'number' &&
           typeof lm.y === 'number' &&
           (lm.visibility ?? 0) >= minVisibility;
}

// ─────────────────────────────────────────────────────────────────────────────
// DIAGNOSTIC LANDMARKS
// ─────────────────────────────────────────────────────────────────────────────

const DEEPSQUAT_DIAGNOSTIC_LANDMARKS = [
    { name: 'L. Hip',   index: 23 },
    { name: 'R. Hip',   index: 24 },
    { name: 'L. Knee',  index: 25 },
    { name: 'R. Knee',  index: 26 },
    { name: 'L. Ankle', index: 27 },
    { name: 'R. Ankle', index: 28 },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSABLE
// ─────────────────────────────────────────────────────────────────────────────

export function useDeepSquatDetection(config = {}) {
    const cfg = { ...DEEPSQUAT_CONFIG, ...config };

    // ── Reactive state ────────────────────────────────────────────────────────
    const repetitionCount = ref(0);
    const currentPhase    = ref(DEEPSQUAT_PHASE.READY);
    const kneeAngle       = ref(0);
    const countingSide    = ref('—'); // 'LEFT' | 'RIGHT' | 'BOTH' | '—'
    const feedback        = ref('');
    const isValidRep      = ref(false);

    // ── Debug / FPS ───────────────────────────────────────────────────────────
    const debugFps           = ref(0);
    const debugFrameCount    = ref(0);
    const debugLastFrameTime = ref(0);
    const FPS_SAMPLE_SIZE    = 10;
    const fpsBuffer          = [];

    // ── Debug: per-landmark visibility ────────────────────────────────────────
    const debugLandmarkReport = ref([]);

    // ── Debug: counting landmark breakdown ────────────────────────────────────
    const debugCountingLmReport = ref({
        countingValid:       0,
        countingTotal:       6,  // 2 hip + 2 knee + 2 ankle
        countingMissing:     [],
        blockedByCountingLm: false,
    });

    // ── Debug: counting pipeline per-frame ────────────────────────────────────
    const debugCountingPipeline = ref({
        validationReady:   false,
        kneeAngle:         0,
        leftKneeAngle:     0,
        rightKneeAngle:    0,
        inDownZone:        false,
        downAccumMs:       0,
        downConfirmed:     false,
        inUpZone:          false,
        upAccumMs:         0,
        repIncremented:    false,
        blockReason:       '—',
    });

    // ── Debug: cumulative counters ────────────────────────────────────────────
    const debugPipelineCumulative = ref({
        validationReadyFrames: 0,
        kneeAngleSamples:      0,
        downZoneFrames:        0,
        downTimerMaxMs:        0,
        downConfirmedCount:    0,
        upZoneFrames:          0,
        upTimerMaxMs:          0,
        upConfirmedCount:      0,
        repIncrementCount:     0,
        landmarkBlockedCount:  0,
        validationBlockedCount:0,
        lastBlockReason:       '—',
    });
    let _cumul = {
        validationReadyFrames: 0,
        kneeAngleSamples:      0,
        downZoneFrames:        0,
        downTimerMaxMs:        0,
        downConfirmedCount:    0,
        upZoneFrames:          0,
        upTimerMaxMs:          0,
        upConfirmedCount:      0,
        repIncrementCount:     0,
        landmarkBlockedCount:  0,
        validationBlockedCount:0,
        lastBlockReason:       '—',
        prevPhaseForCumul:     DEEPSQUAT_PHASE.READY,
    };

    // ── Debug: state machine diagnostics ─────────────────────────────────────
    const debugStateMachine = ref({
        prevPhase:          DEEPSQUAT_PHASE.READY,
        minKneeAngleSeen:   999,
        maxKneeAngleSeen:   0,
        framesInDownZone:   0,
        framesInUpZone:     0,
        downEverReached:    false,
        upAfterDownReached: false,
        blockedByValidation:0,
        blockedByLandmark:  0,
        lastBlockReason:    '—',
        validationDropCount:0,
    });
    let _sm = {
        prevPhase:           DEEPSQUAT_PHASE.READY,
        minKneeAngleSeen:    999,
        maxKneeAngleSeen:    0,
        framesInDownZone:    0,
        framesInUpZone:      0,
        downEverReached:     false,
        upAfterDownReached:  false,
        blockedByValidation: 0,
        blockedByLandmark:   0,
        lastBlockReason:     '—',
        validationDropCount: 0,
        lastValidationStatus:'READY',
    };

    // ── Debug: frame history (rolling 25) ─────────────────────────────────────
    const DEBUG_HISTORY_SIZE = 25;
    const debugFrameHistory  = ref([]);

    // ── Debug: rep cycle diagnostics ──────────────────────────────────────────
    const debugRepCycle = ref({
        cycleNumber:    0,
        cycleState:     'IDLE',
        downDetected:   false,
        downConfirmed:  false,
        upDetected:     false,
        counted:        false,
        resetReason:    '—',
    });
    const DEBUG_CYCLE_HISTORY_SIZE = 10;
    const debugRepCycleHistory = ref([]);
    let _cycle = {
        cycleNumber:     0,
        cycleState:      'IDLE',
        startedAt:       0,
        downDetected:    false,
        downConfirmed:   false,
        upDetected:      false,
        counted:         false,
        resetReason:     '—',
        prevRepCount:    0,
        validationDrops: 0,
        landmarkBlocks:  0,
    };

    // ── Time-based stabilization (non-reactive) ───────────────────────────────
    let downStartTime    = null; // timestamp saat knee pertama masuk zona DOWN
    let upStartTime      = null; // timestamp saat knee pertama masuk zona UP
    let landmarkLostTime = null;

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
        if (!DEEPSQUAT_DEBUG) return;
        const minVis = cfg.MIN_VISIBILITY;

        debugLandmarkReport.value = DEEPSQUAT_DIAGNOSTIC_LANDMARKS.map(({ name, index }) => {
            const lm  = landmarks?.[index];
            const vis = lm != null ? Math.round((lm.visibility ?? 0) * 100) : null;
            let status;
            if (lm == null || vis === null)          status = 'MISSING';
            else if ((lm.visibility ?? 0) >= minVis) status = 'VISIBLE';
            else                                     status = 'LOW';
            return { name, index, vis, status };
        });

        const COUNTING_INDICES = [23, 24, 25, 26, 27, 28];
        const countingValid = COUNTING_INDICES.filter(i => {
            const lm = landmarks?.[i];
            return lm != null && (lm.visibility ?? 0) >= minVis;
        });
        const countingMissing = COUNTING_INDICES.filter(i => {
            const lm = landmarks?.[i];
            return !lm || (lm.visibility ?? 0) < minVis;
        }).map(i => ({ 23:'L.Hip',24:'R.Hip',25:'L.Knee',26:'R.Knee',27:'L.Ankle',28:'R.Ankle' }[i] ?? `idx${i}`));

        const leftOk  = [23, 25, 27].every(i => { const lm = landmarks?.[i]; return lm != null && (lm.visibility ?? 0) >= minVis; });
        const rightOk = [24, 26, 28].every(i => { const lm = landmarks?.[i]; return lm != null && (lm.visibility ?? 0) >= minVis; });
        debugCountingLmReport.value = {
            countingValid:      countingValid.length,
            countingTotal:      COUNTING_INDICES.length,
            countingMissing,
            blockedByCountingLm: !leftOk && !rightOk,
        };
    }

    // ── Debug: state machine ──────────────────────────────────────────────────
    function updateStateMachineDiagnostics({ validationStatus, currentKnee, phaseBefore, landmarkAvailable }) {
        if (!DEEPSQUAT_DEBUG) return;

        if (_sm.lastValidationStatus === 'READY' && validationStatus !== 'READY') _sm.validationDropCount++;
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
        if (currentKnee > 0 && currentKnee <= cfg.SQUAT_DOWN_ANGLE)  _sm.framesInDownZone++;
        if (currentKnee > 0 && currentKnee >= cfg.SQUAT_UP_ANGLE)    _sm.framesInUpZone++;

        const nowPhase = currentPhase.value;
        if (nowPhase !== phaseBefore) _sm.prevPhase = phaseBefore;
        if (nowPhase === DEEPSQUAT_PHASE.DOWN) _sm.downEverReached = true;
        if (nowPhase === DEEPSQUAT_PHASE.READY && _sm.downEverReached && phaseBefore === DEEPSQUAT_PHASE.DOWN) {
            _sm.upAfterDownReached = true;
        }

        debugStateMachine.value = {
            prevPhase:           _sm.prevPhase,
            minKneeAngleSeen:    _sm.minKneeAngleSeen === 999 ? 0 : _sm.minKneeAngleSeen,
            maxKneeAngleSeen:    _sm.maxKneeAngleSeen,
            framesInDownZone:    _sm.framesInDownZone,
            framesInUpZone:      _sm.framesInUpZone,
            downEverReached:     _sm.downEverReached,
            upAfterDownReached:  _sm.upAfterDownReached,
            blockedByValidation: _sm.blockedByValidation,
            blockedByLandmark:   _sm.blockedByLandmark,
            lastBlockReason:     _sm.lastBlockReason,
            validationDropCount: _sm.validationDropCount,
        };
    }

    // ── Debug: frame history ──────────────────────────────────────────────────
    function pushFrameHistory(validationStatus, currentKnee) {
        if (!DEEPSQUAT_DEBUG) return;
        const entry = {
            ts:    Math.round(performance.now() / 100) / 10,
            fps:   debugFps.value,
            valid: validationStatus,
            knee:  currentKnee,
            phase: currentPhase.value,
            rep:   repetitionCount.value,
        };
        const h = debugFrameHistory.value;
        debugFrameHistory.value = h.length >= DEBUG_HISTORY_SIZE
            ? [...h.slice(1), entry]
            : [...h, entry];
    }

    // ── Debug: rep cycle ──────────────────────────────────────────────────────
    function updateRepCycleDiagnostics({ validationStatus, currentKnee, phaseBefore, landmarkAvail }) {
        if (!DEEPSQUAT_DEBUG) return;

        const phaseAfter = currentPhase.value;
        const repCount   = repetitionCount.value;

        if (validationStatus !== 'READY') _cycle.validationDrops++;
        if (!landmarkAvail && validationStatus === 'READY') _cycle.landmarkBlocks++;

        // Inisialisasi siklus baru
        if (_cycle.cycleState === 'IDLE' || _cycle.cycleState === 'COUNTED' || _cycle.cycleState === 'BLOCKED') {
            if (phaseAfter === DEEPSQUAT_PHASE.READY && validationStatus === 'READY') {
                _cycle.cycleNumber++;
                _cycle.cycleState    = 'WAITING_DOWN';
                _cycle.startedAt     = performance.now();
                _cycle.downDetected  = false;
                _cycle.downConfirmed = false;
                _cycle.upDetected    = false;
                _cycle.counted       = false;
                _cycle.resetReason   = '—';
                _cycle.validationDrops = 0;
                _cycle.landmarkBlocks  = 0;
                _cycle.prevRepCount    = repCount;
            }
        }

        // Track DOWN zone entry
        if ((_cycle.cycleState === 'WAITING_DOWN' || _cycle.cycleState === 'DOWN_DETECTED') &&
            currentKnee > 0 && currentKnee <= cfg.SQUAT_DOWN_ANGLE) {
            _cycle.downDetected = true;
            _cycle.cycleState = 'DOWN_DETECTED';
        }
        // Track DOWN confirmed (phase changed to DOWN)
        if (phaseAfter === DEEPSQUAT_PHASE.DOWN && phaseBefore !== DEEPSQUAT_PHASE.DOWN) {
            _cycle.downConfirmed = true;
            _cycle.cycleState    = 'DOWN_CONFIRMED';
        }
        // Track UP zone entry after DOWN
        if ((_cycle.cycleState === 'DOWN_CONFIRMED' || _cycle.cycleState === 'WAITING_UP') &&
            phaseAfter === DEEPSQUAT_PHASE.DOWN) {
            _cycle.cycleState = 'WAITING_UP';
            if (currentKnee > 0 && currentKnee >= cfg.SQUAT_UP_ANGLE) {
                _cycle.upDetected = true;
                _cycle.cycleState = 'UP_DETECTED';
            }
        }

        // Deteksi rep dihitung
        if (repCount > _cycle.prevRepCount) {
            _cycle.counted      = true;
            _cycle.cycleState   = 'COUNTED';
            _cycle.prevRepCount = repCount;
            _pushCycleToHistory({ ...(_cycle) });
            _cycle.cycleState = 'IDLE';
        }

        // Deteksi validation lost saat DOWN
        if ((_cycle.cycleState === 'DOWN_CONFIRMED' || _cycle.cycleState === 'WAITING_UP') &&
            validationStatus !== 'READY') {
            _cycle.resetReason = 'VALIDATION_LOST';
            _cycle.cycleState  = 'BLOCKED';
            _pushCycleToHistory({ ...(_cycle) });
            _cycle.cycleState  = 'IDLE';
        }

        debugRepCycle.value = {
            cycleNumber:    _cycle.cycleNumber,
            cycleState:     _cycle.cycleState,
            downDetected:   _cycle.downDetected,
            downConfirmed:  _cycle.downConfirmed,
            upDetected:     _cycle.upDetected,
            counted:        _cycle.counted,
            resetReason:    _cycle.resetReason,
        };
    }

    function _pushCycleToHistory(snap) {
        const entry = {
            cycleNumber:  snap.cycleNumber,
            downDetected: snap.downDetected,
            downConfirmed:snap.downConfirmed,
            upDetected:   snap.upDetected,
            counted:      snap.counted,
            resetReason:  snap.resetReason,
        };
        const hist = debugRepCycleHistory.value;
        debugRepCycleHistory.value = hist.length >= DEBUG_CYCLE_HISTORY_SIZE
            ? [...hist.slice(1), entry]
            : [...hist, entry];
    }

    // ── Landmark extraction ───────────────────────────────────────────────────

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

        return { leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle, leftValid, rightValid };
    }

    /**
     * Hitung knee angle dari sisi yang valid.
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

        // Keduanya valid → rata-rata, gunakan sisi dengan visibility lebih tinggi sebagai primary
        const avg = Math.round((angles[0].angle + angles[1].angle) / 2);
        return { angle: avg, side: 'BOTH', leftAngle, rightAngle };
    }

    /**
     * Fungsi utama — dipanggil setiap frame dari onPoseUpdate.
     */
    function processDeepSquatFrame({ landmarks, validationStatus } = {}) {
        updateFps();
        const now         = performance.now();
        const phaseBefore = currentPhase.value;

        // ── Guard: pose belum READY ───────────────────────────────────────────
        if (validationStatus !== 'READY') {
            feedback.value    = 'Tunggu posisi tubuh valid terlebih dahulu';
            isValidRep.value  = false;
            landmarkLostTime  = null;
            downStartTime     = null;

            if (DEEPSQUAT_DEBUG) {
                _cumul.validationBlockedCount++;
                _cumul.lastBlockReason = `Validation: ${validationStatus}`;
                debugCountingPipeline.value = {
                    ...debugCountingPipeline.value,
                    validationReady: false,
                    repIncremented:  false,
                    blockReason:     `Validation tidak READY: ${validationStatus}`,
                };
                updateDebugDiagnostics(landmarks);
                updateStateMachineDiagnostics({ validationStatus, currentKnee: 0, phaseBefore, landmarkAvailable: false });
                updateRepCycleDiagnostics({ validationStatus, currentKnee: 0, phaseBefore, landmarkAvail: false });
                pushFrameHistory(validationStatus, 0);
                debugPipelineCumulative.value = { ..._cumul };
            }
            return;
        }

        // ── Ekstrak landmark ──────────────────────────────────────────────────
        const lms = extractLandmarks(landmarks);
        if (DEEPSQUAT_DEBUG) updateDebugDiagnostics(landmarks);

        if (!lms) {
            feedback.value = 'Pastikan kaki (pinggul, lutut, pergelangan) terlihat';

            if (currentPhase.value === DEEPSQUAT_PHASE.DOWN) {
                // Landmark hilang saat DOWN — toleransi timeout
                if (landmarkLostTime === null) landmarkLostTime = now;
                if (now - landmarkLostTime > cfg.LANDMARK_LOST_TIMEOUT_MS) {
                    currentPhase.value = DEEPSQUAT_PHASE.READY;
                    downStartTime      = null;
                    upStartTime        = null;
                    landmarkLostTime   = null;
                }
            } else {
                downStartTime    = null;
                upStartTime      = null;
                landmarkLostTime = null;
            }

            if (DEEPSQUAT_DEBUG) {
                _cumul.landmarkBlockedCount++;
                _cumul.lastBlockReason = 'Landmark tidak cukup';
                debugCountingPipeline.value = {
                    ...debugCountingPipeline.value,
                    validationReady: true,
                    blockReason: 'Landmark tidak cukup (hip+knee+ankle)',
                };
                updateStateMachineDiagnostics({ validationStatus, currentKnee: 0, phaseBefore, landmarkAvailable: false });
                updateRepCycleDiagnostics({ validationStatus, currentKnee: 0, phaseBefore, landmarkAvail: false });
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

        // ── State machine dengan hysteresis ───────────────────────────────────
        const phase = currentPhase.value;
        let _pipelineBlock  = '—';
        let _repIncremented = false;

        if (phase === DEEPSQUAT_PHASE.READY) {
            // ── Menunggu gerakan turun ke zona squat ────────────────────────
            if (currentKnee > 0 && currentKnee <= cfg.SQUAT_DOWN_ANGLE) {
                // Masuk zona DOWN — akumulasi
                if (downStartTime === null) downStartTime = now;
                upStartTime = null;

                const elapsed = now - downStartTime;
                if (elapsed >= cfg.DOWN_STABLE_DURATION_MS) {
                    // Konfirmasi DOWN
                    currentPhase.value = DEEPSQUAT_PHASE.DOWN;
                    downStartTime      = null;
                    isValidRep.value   = false;
                    feedback.value     = 'Bagus! Kembali berdiri untuk hitung repetisi';
                } else {
                    feedback.value = `Squat lebih dalam... (${Math.round((elapsed / cfg.DOWN_STABLE_DURATION_MS) * 100)}%)`;
                    _pipelineBlock = `DOWN akumulasi: ${Math.round(elapsed)}ms/${cfg.DOWN_STABLE_DURATION_MS}ms`;
                }
            } else {
                // Di luar zona DOWN → reset akumulasi
                // Hysteresis: hanya reset jika sudah melewati dead zone
                // (tidak perlu cek UP angle di READY — cukup reset down timer)
                downStartTime = null;
                if (currentKnee > 0) {
                    feedback.value = `Lakukan squat (knee ${currentKnee}° > ${cfg.SQUAT_DOWN_ANGLE}°)`;
                    _pipelineBlock = `Knee ${currentKnee}° belum <= ${cfg.SQUAT_DOWN_ANGLE}° (DOWN zone)`;
                } else {
                    feedback.value = 'Mulai lakukan squat';
                }
            }

        } else if (phase === DEEPSQUAT_PHASE.DOWN) {
            // ── Sudah squat, menunggu kembali berdiri ───────────────────────
            if (currentKnee > 0 && currentKnee >= cfg.SQUAT_UP_ANGLE) {
                // Masuk zona UP — akumulasi (hysteresis: UP_ANGLE > DOWN_ANGLE)
                if (upStartTime === null) upStartTime = now;
                downStartTime = null;

                const elapsed = now - upStartTime;
                if (elapsed >= cfg.UP_STABLE_DURATION_MS) {
                    // Konfirmasi UP → hitung repetisi
                    currentPhase.value = DEEPSQUAT_PHASE.READY;
                    upStartTime        = null;
                    repetitionCount.value++;
                    isValidRep.value   = true;
                    feedback.value     = `Bagus! ${repetitionCount.value} repetisi`;
                    _repIncremented    = true;
                } else {
                    feedback.value = `Hampir! Berdiri lebih tegak... (${Math.round((elapsed / cfg.UP_STABLE_DURATION_MS) * 100)}%)`;
                    _pipelineBlock = `UP akumulasi: ${Math.round(elapsed)}ms/${cfg.UP_STABLE_DURATION_MS}ms`;
                }
            } else {
                // Belum kembali ke zona UP — reset akumulasi UP
                // Hysteresis: di dead zone (DOWN_ANGLE < knee < UP_ANGLE) → tidak trigger apapun
                upStartTime    = null;
                feedback.value = `Berdiri kembali (knee ${currentKnee}° < ${cfg.SQUAT_UP_ANGLE}°)`;
                _pipelineBlock = `Knee ${currentKnee}° belum >= ${cfg.SQUAT_UP_ANGLE}° (UP zone)`;
            }
        }

        // ── Update debug diagnostics ──────────────────────────────────────────
        if (DEEPSQUAT_DEBUG) {
            _cumul.validationReadyFrames++;
            if (currentKnee > 0)                                     _cumul.kneeAngleSamples++;
            if (currentKnee > 0 && currentKnee <= cfg.SQUAT_DOWN_ANGLE) _cumul.downZoneFrames++;
            if (currentKnee > 0 && currentKnee >= cfg.SQUAT_UP_ANGLE)   _cumul.upZoneFrames++;
            if (downStartTime !== null) {
                const acc = Math.round(now - downStartTime);
                if (acc > _cumul.downTimerMaxMs) _cumul.downTimerMaxMs = acc;
            }
            if (upStartTime !== null) {
                const acc = Math.round(now - upStartTime);
                if (acc > _cumul.upTimerMaxMs) _cumul.upTimerMaxMs = acc;
            }
            if (currentPhase.value === DEEPSQUAT_PHASE.DOWN && _cumul.prevPhaseForCumul !== DEEPSQUAT_PHASE.DOWN) {
                _cumul.downConfirmedCount++;
            }
            if (_repIncremented) {
                _cumul.upConfirmedCount++;
                _cumul.repIncrementCount++;
            }
            if (!_repIncremented && _pipelineBlock !== '—') _cumul.lastBlockReason = _pipelineBlock;
            _cumul.prevPhaseForCumul = currentPhase.value;

            debugCountingPipeline.value = {
                validationReady: true,
                kneeAngle:       currentKnee,
                leftKneeAngle:   leftAngle,
                rightKneeAngle:  rightAngle,
                inDownZone:      currentKnee > 0 && currentKnee <= cfg.SQUAT_DOWN_ANGLE,
                downAccumMs:     downStartTime !== null ? Math.round(now - downStartTime) : 0,
                downConfirmed:   currentPhase.value === DEEPSQUAT_PHASE.DOWN,
                inUpZone:        currentKnee > 0 && currentKnee >= cfg.SQUAT_UP_ANGLE,
                upAccumMs:       upStartTime !== null ? Math.round(now - upStartTime) : 0,
                repIncremented:  _repIncremented,
                blockReason:     _repIncremented ? '—' : _pipelineBlock,
            };

            debugPipelineCumulative.value = { ..._cumul };
            updateStateMachineDiagnostics({ validationStatus, currentKnee, phaseBefore, landmarkAvailable: true });
            updateRepCycleDiagnostics({ validationStatus, currentKnee, phaseBefore, landmarkAvail: true });
            pushFrameHistory(validationStatus, currentKnee);
        }
    }

    /**
     * Reset seluruh state Deep Squat.
     */
    function resetDeepSquat() {
        repetitionCount.value = 0;
        currentPhase.value    = DEEPSQUAT_PHASE.READY;
        kneeAngle.value       = 0;
        countingSide.value    = '—';
        feedback.value        = '';
        isValidRep.value      = false;

        downStartTime    = null;
        upStartTime      = null;
        landmarkLostTime = null;

        fpsBuffer.length         = 0;
        debugFps.value           = 0;
        debugFrameCount.value    = 0;
        debugLastFrameTime.value = 0;

        debugLandmarkReport.value   = [];
        debugFrameHistory.value     = [];
        debugRepCycle.value = {
            cycleNumber: 0, cycleState: 'IDLE',
            downDetected: false, downConfirmed: false,
            upDetected: false, counted: false, resetReason: '—',
        };
        debugRepCycleHistory.value = [];
        debugCountingLmReport.value = {
            countingValid: 0, countingTotal: 6,
            countingMissing: [], blockedByCountingLm: false,
        };
        debugCountingPipeline.value = {
            validationReady: false, kneeAngle: 0, leftKneeAngle: 0, rightKneeAngle: 0,
            inDownZone: false, downAccumMs: 0, downConfirmed: false,
            inUpZone: false, upAccumMs: 0, repIncremented: false, blockReason: '—',
        };
        debugPipelineCumulative.value = {
            validationReadyFrames: 0, kneeAngleSamples: 0,
            downZoneFrames: 0, downTimerMaxMs: 0, downConfirmedCount: 0,
            upZoneFrames: 0, upTimerMaxMs: 0, upConfirmedCount: 0,
            repIncrementCount: 0, landmarkBlockedCount: 0,
            validationBlockedCount: 0, lastBlockReason: '—',
        };
        debugStateMachine.value = {
            prevPhase: DEEPSQUAT_PHASE.READY, minKneeAngleSeen: 0, maxKneeAngleSeen: 0,
            framesInDownZone: 0, framesInUpZone: 0,
            downEverReached: false, upAfterDownReached: false,
            blockedByValidation: 0, blockedByLandmark: 0,
            lastBlockReason: '—', validationDropCount: 0,
        };
        _sm = {
            prevPhase: DEEPSQUAT_PHASE.READY, minKneeAngleSeen: 999, maxKneeAngleSeen: 0,
            framesInDownZone: 0, framesInUpZone: 0,
            downEverReached: false, upAfterDownReached: false,
            blockedByValidation: 0, blockedByLandmark: 0,
            lastBlockReason: '—', validationDropCount: 0, lastValidationStatus: 'READY',
        };
        _cumul = {
            validationReadyFrames: 0, kneeAngleSamples: 0,
            downZoneFrames: 0, downTimerMaxMs: 0, downConfirmedCount: 0,
            upZoneFrames: 0, upTimerMaxMs: 0, upConfirmedCount: 0,
            repIncrementCount: 0, landmarkBlockedCount: 0,
            validationBlockedCount: 0, lastBlockReason: '—',
            prevPhaseForCumul: DEEPSQUAT_PHASE.READY,
        };
        _cycle = {
            cycleNumber: 0, cycleState: 'IDLE', startedAt: 0,
            downDetected: false, downConfirmed: false,
            upDetected: false, counted: false, resetReason: '—',
            prevRepCount: 0, validationDrops: 0, landmarkBlocks: 0,
        };
    }

    // ── Computed UI helpers ───────────────────────────────────────────────────

    const phaseLabel = computed(() => ({
        [DEEPSQUAT_PHASE.READY]: 'READY',
        [DEEPSQUAT_PHASE.DOWN]:  'DOWN ↓ (squat)',
    }[currentPhase.value] ?? '—'));

    const phaseColor = computed(() => ({
        [DEEPSQUAT_PHASE.READY]: 'text-slate-400',
        [DEEPSQUAT_PHASE.DOWN]:  'text-orange-400',
    }[currentPhase.value] ?? 'text-slate-400'));

    return {
        // State
        repetitionCount,
        currentPhase,
        kneeAngle,
        countingSide,
        feedback,
        isValidRep,

        // Debug
        debugFps,
        debugFrameCount,
        debugLandmarkReport,
        debugCountingLmReport,
        debugCountingPipeline,
        debugPipelineCumulative,
        debugStateMachine,
        debugFrameHistory,
        debugRepCycle,
        debugRepCycleHistory,

        // Actions
        processDeepSquatFrame,
        resetDeepSquat,

        // UI helpers
        phaseLabel,
        phaseColor,

        // Config
        config: cfg,
    };
}
