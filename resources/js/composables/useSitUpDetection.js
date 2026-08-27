/**
 * useSitUpDetection.js
 *
 * Composable untuk mendeteksi dan menghitung repetisi Sit-Up secara realtime
 * menggunakan landmark MediaPipe Pose.
 *
 * Algoritma:
 *   1. Hitung sudut pinggul (shoulder → hip → knee) dari sisi yang valid
 *   2. State machine: READY → SIT → FLAT → count++ → kembali ke READY
 *   3. Stabilisasi BERBASIS WAKTU (ms), konsisten di semua FPS
 *   4. Repetisi hanya dihitung jika minimal satu sisi shoulder+hip+knee valid
 *
 * Fase gerakan Sit Up:
 *   READY — posisi awal (berbaring), hip angle ≥ FLAT_HIP_ANGLE
 *   SIT   — hip angle turun ke ≤ SIT_HIP_ANGLE (posisi duduk penuh)
 *   FLAT  — hip angle kembali naik ke ≥ FLAT_HIP_ANGLE (berbaring) → rep++
 *
 * Landmark MediaPipe yang digunakan:
 *   11 = left_shoulder    12 = right_shoulder
 *   23 = left_hip         24 = right_hip
 *   25 = left_knee        26 = right_knee
 */

import { ref, computed } from 'vue';

// ─────────────────────────────────────────────────────────────────────────────
// DEBUG FLAG
// ─────────────────────────────────────────────────────────────────────────────

export const SITUP_DEBUG = true;

// ─────────────────────────────────────────────────────────────────────────────
// SITUP CONFIG
// ─────────────────────────────────────────────────────────────────────────────

export const SITUP_CONFIG = {
    /**
     * Sudut pinggul maksimum (derajat) untuk dianggap posisi SIT (duduk penuh).
     * shoulder→hip→knee ≤ nilai ini → akumulasi SIT dimulai.
     * Nilai 90°: tubuh tegak lurus dari pinggul. Range realistis: 70–100°.
     */
    SIT_HIP_ANGLE: 90,

    /**
     * Sudut pinggul minimum (derajat) untuk dianggap posisi FLAT (berbaring).
     * shoulder→hip→knee ≥ nilai ini → akumulasi FLAT dimulai → rep dihitung.
     * Nilai 140°: tubuh hampir lurus. Range realistis: 130–160°.
     */
    FLAT_HIP_ANGLE: 140,

    /**
     * Durasi minimum (ms) di zona SIT sebelum transisi dikonfirmasi.
     * 50ms < 1 frame @13 FPS (77ms) — satu frame di zona sudah cukup.
     */
    SIT_STABLE_DURATION_MS: 50,

    /**
     * Durasi minimum (ms) di zona FLAT sebelum rep dihitung.
     * 50ms < 1 frame @13 FPS — satu frame di zona sudah cukup.
     */
    FLAT_STABLE_DURATION_MS: 50,

    /**
     * Durasi maksimum (ms) landmark boleh hilang sebelum state machine direset.
     */
    LANDMARK_LOST_TIMEOUT_MS: 500,

    /**
     * Visibility minimum per landmark (0.0–1.0).
     */
    MIN_VISIBILITY: 0.5,

    /**
     * Jumlah sisi minimum yang harus valid untuk counting.
     * 1 = single-side (lateral view), 2 = both sides.
     */
    MIN_VALID_SIDES: 1,
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const SITUP_PHASE = {
    READY: 'READY',  // posisi awal/berbaring — menunggu gerakan duduk
    SIT:   'SIT',    // hip angle sudah kecil (duduk) — menunggu kembali berbaring
    FLAT:  'FLAT',   // hip angle kembali besar (berbaring) → rep dihitung
};

// ─────────────────────────────────────────────────────────────────────────────
// FORM STATUS CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const SITUP_FORM = {
    GOOD_FORM:       'GOOD_FORM',
    ADJUST_POSITION: 'ADJUST_POSITION',  // posisi belum siap
    NO_DATA:         'NO_DATA',          // landmark tidak cukup / belum READY
};

// ─────────────────────────────────────────────────────────────────────────────
// MATH UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hitung sudut (derajat) di titik B dari tiga titik A–B–C.
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b  — vertex
 * @param {{ x: number, y: number }} c
 * @returns {number} sudut 0–180, atau 0 jika tidak bisa dihitung
 */
function calculateAngle(a, b, c) {
    if (!a || !b || !c) return 0;
    const BAx = a.x - b.x, BAy = a.y - b.y;
    const BCx = c.x - b.x, BCy = c.y - b.y;
    const magBA = Math.sqrt(BAx * BAx + BAy * BAy);
    const magBC = Math.sqrt(BCx * BCx + BCy * BCy);
    if (magBA < 0.001 || magBC < 0.001) return 0;
    const cosAngle = Math.max(-1, Math.min(1, (BAx * BCx + BAy * BCy) / (magBA * magBC)));
    const angle = Math.acos(cosAngle) * (180 / Math.PI);
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

const SITUP_DIAGNOSTIC_LANDMARKS = [
    { name: 'Nose',        index: 0  },
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

export function useSitUpDetection(config = {}) {
    const cfg = { ...SITUP_CONFIG, ...config };

    // ── Reactive state ────────────────────────────────────────────────────────
    const repetitionCount = ref(0);
    const currentPhase    = ref(SITUP_PHASE.READY);
    const formStatus      = ref(SITUP_FORM.NO_DATA);
    const hipAngle        = ref(0);    // sudut hip sisi yang valid (derajat)
    const feedback        = ref('');
    const isValidRep      = ref(false);
    const countingSide    = ref('—');  // 'LEFT' | 'RIGHT' | 'BOTH' | '—'

    // ── Debug / FPS ───────────────────────────────────────────────────────────
    const debugFps           = ref(0);
    const debugFrameCount    = ref(0);
    const debugLastFrameTime = ref(0);
    const FPS_SAMPLE_SIZE    = 10;
    const fpsBuffer          = [];

    // ── Debug: per-landmark visibility report ─────────────────────────────────
    const debugLandmarkReport = ref([]);

    // ── Debug: counting landmark breakdown ────────────────────────────────────
    const debugCountingLmReport = ref({
        countingValid:       0,
        countingTotal:       6,  // 2 shoulder + 2 hip + 2 knee
        countingMissing:     [],
        blockedByCountingLm: false,
    });

    // ── Debug: counting pipeline per-frame snapshot ───────────────────────────
    const debugCountingPipeline = ref({
        validationReady: false,
        hipAngle:        0,
        inSitZone:       false,
        sitConfirmed:    false,
        inFlatZone:      false,
        flatConfirmed:   false,
        repIncremented:  false,
        blockReason:     '—',
        sitAccumMs:      0,
        flatAccumMs:     0,
    });

    // ── Debug: cumulative counters ────────────────────────────────────────────
    const debugPipelineCumulative = ref({
        validationReadyFrames: 0,
        hipAngleSamples:       0,
        sitZoneFrames:         0,
        sitTimerMaxMs:         0,
        sitConfirmedCount:     0,
        flatZoneFrames:        0,
        flatTimerMaxMs:        0,
        flatConfirmedCount:    0,
        repIncrementCount:     0,
        lastBlockReason:       '—',
    });
    let _cumul = {
        validationReadyFrames: 0,
        hipAngleSamples: 0,
        sitZoneFrames: 0,
        sitTimerMaxMs: 0,
        sitConfirmedCount: 0,
        flatZoneFrames: 0,
        flatTimerMaxMs: 0,
        flatConfirmedCount: 0,
        repIncrementCount: 0,
        lastBlockReason: '—',
        prevPhaseForCumul: SITUP_PHASE.READY,
    };

    // ── Debug: state machine diagnostics ─────────────────────────────────────
    const debugStateMachine = ref({
        prevPhase:           SITUP_PHASE.READY,
        minHipSeen:          999,
        maxHipSeen:          0,
        framesHipBelowSit:   0,
        framesHipAboveFlat:  0,
        sitEverReached:      false,
        flatAfterSitReached: false,
        blockedByValidation: 0,
        blockedByLandmark:   0,
        lastBlockReason:     '—',
        validationDropCount: 0,
    });
    let _sm = {
        prevPhase:           SITUP_PHASE.READY,
        minHipSeen:          999,
        maxHipSeen:          0,
        framesHipBelowSit:   0,
        framesHipAboveFlat:  0,
        sitEverReached:      false,
        flatAfterSitReached: false,
        blockedByValidation: 0,
        blockedByLandmark:   0,
        lastBlockReason:     '—',
        validationDropCount: 0,
        lastValidationStatus: 'READY',
    };

    // ── Debug: frame history (rolling 25 sampel) ──────────────────────────────
    const DEBUG_HISTORY_SIZE = 25;
    const debugFrameHistory  = ref([]);

    // ── Debug: repetition cycle diagnostics ──────────────────────────────────
    const debugRepCycle = ref({
        cycleNumber:       0,
        currentCycleState: 'IDLE',
        sitDetected:       false,
        sitConfirmed:      false,
        flatDetected:      false,
        flatConfirmed:     false,
        counted:           false,
        resetReason:       '—',
        validationDrops:   0,
        landmarkBlocks:    0,
    });
    const DEBUG_CYCLE_HISTORY_SIZE = 10;
    const debugRepCycleHistory = ref([]);

    let _cycle = {
        cycleNumber:      0,
        cycleState:       'IDLE',
        startedAt:        0,
        sitDetected:      false,
        sitConfirmed:     false,
        flatDetected:     false,
        flatConfirmed:    false,
        counted:          false,
        resetReason:      '—',
        sitEnteredAt:     0,
        validationDrops:  0,
        landmarkBlocks:   0,
        prevRepCount:     0,
    };

    // ── Time-based stabilization (non-reactive) ───────────────────────────────
    let sitStartTime     = null;  // timestamp masuk zona SIT
    let flatStartTime    = null;  // timestamp masuk zona FLAT
    let landmarkLostTime = null;
    let frameStartTime   = 0;

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
        if (!SITUP_DEBUG) return;

        const minVis = cfg.MIN_VISIBILITY;

        // Per-landmark visibility
        const report = SITUP_DIAGNOSTIC_LANDMARKS.map(({ name, index }) => {
            const lm  = landmarks?.[index];
            const vis = lm != null ? Math.round((lm.visibility ?? 0) * 100) : null;
            let status;
            if (lm == null || vis === null)      status = 'MISSING';
            else if ((lm.visibility ?? 0) >= minVis) status = 'VISIBLE';
            else                                 status = 'LOW';
            return { name, index, vis, status };
        });
        debugLandmarkReport.value = report;

        // Counting landmark breakdown (shoulder+hip+knee)
        const COUNTING_INDICES = [11, 12, 23, 24, 25, 26];
        const countingValid = COUNTING_INDICES.filter(i => {
            const lm = landmarks?.[i];
            return lm != null && (lm.visibility ?? 0) >= minVis;
        });
        const countingMissing = COUNTING_INDICES.filter(i => {
            const lm = landmarks?.[i];
            return !lm || (lm.visibility ?? 0) < minVis;
        }).map(i => {
            const names = {
                11: 'L.Shoulder', 12: 'R.Shoulder',
                23: 'L.Hip',      24: 'R.Hip',
                25: 'L.Knee',     26: 'R.Knee',
            };
            return names[i] ?? `idx${i}`;
        });

        const leftOk  = [11, 23, 25].every(i => {
            const lm = landmarks?.[i];
            return lm != null && (lm.visibility ?? 0) >= minVis;
        });
        const rightOk = [12, 24, 26].every(i => {
            const lm = landmarks?.[i];
            return lm != null && (lm.visibility ?? 0) >= minVis;
        });

        debugCountingLmReport.value = {
            countingValid:       countingValid.length,
            countingTotal:       COUNTING_INDICES.length,
            countingMissing,
            blockedByCountingLm: !leftOk && !rightOk,
        };
    }

    // ── Debug: state machine diagnostics ─────────────────────────────────────
    function updateStateMachineDiagnostics({ validationStatus, currentHip, currentPhaseBefore, landmarkAvailable }) {
        if (!SITUP_DEBUG) return;

        if (_sm.lastValidationStatus === 'READY' && validationStatus !== 'READY') {
            _sm.validationDropCount++;
        }
        _sm.lastValidationStatus = validationStatus;

        if (validationStatus !== 'READY') {
            _sm.blockedByValidation++;
            _sm.lastBlockReason = `Validation bukan READY (${validationStatus})`;
        } else if (!landmarkAvailable) {
            _sm.blockedByLandmark++;
            _sm.lastBlockReason = 'Landmark tidak cukup';
        }

        if (currentHip > 0) {
            if (currentHip < _sm.minHipSeen) _sm.minHipSeen = currentHip;
            if (currentHip > _sm.maxHipSeen) _sm.maxHipSeen = currentHip;
        }
        if (currentHip > 0 && currentHip <= cfg.SIT_HIP_ANGLE)  _sm.framesHipBelowSit++;
        if (currentHip > 0 && currentHip >= cfg.FLAT_HIP_ANGLE) _sm.framesHipAboveFlat++;

        const nowPhase = currentPhase.value;
        if (nowPhase !== currentPhaseBefore) _sm.prevPhase = currentPhaseBefore;
        if (nowPhase === SITUP_PHASE.SIT)  _sm.sitEverReached = true;
        if (nowPhase === SITUP_PHASE.FLAT && _sm.sitEverReached) _sm.flatAfterSitReached = true;

        debugStateMachine.value = {
            prevPhase:           _sm.prevPhase,
            minHipSeen:          _sm.minHipSeen === 999 ? 0 : _sm.minHipSeen,
            maxHipSeen:          _sm.maxHipSeen,
            framesHipBelowSit:   _sm.framesHipBelowSit,
            framesHipAboveFlat:  _sm.framesHipAboveFlat,
            sitEverReached:      _sm.sitEverReached,
            flatAfterSitReached: _sm.flatAfterSitReached,
            blockedByValidation: _sm.blockedByValidation,
            blockedByLandmark:   _sm.blockedByLandmark,
            lastBlockReason:     _sm.lastBlockReason,
            validationDropCount: _sm.validationDropCount,
        };
    }

    // ── Debug: frame history ──────────────────────────────────────────────────
    function pushFrameHistory(validationStatus, currentHip, formSt) {
        if (!SITUP_DEBUG) return;
        const entry = {
            ts:    Math.round(performance.now() / 100) / 10,
            fps:   debugFps.value,
            valid: validationStatus,
            hip:   currentHip,
            phase: currentPhase.value,
            form:  formSt,
        };
        const history = debugFrameHistory.value;
        debugFrameHistory.value = history.length >= DEBUG_HISTORY_SIZE
            ? [...history.slice(1), entry]
            : [...history, entry];
    }

    // ── Debug: rep cycle observer ─────────────────────────────────────────────
    function updateRepCycleDiagnostics({ validationStatus, currentHip, landmarkAvail, phaseBefore }) {
        if (!SITUP_DEBUG) return;

        const now        = performance.now();
        const phaseAfter = currentPhase.value;
        const repCount   = repetitionCount.value;

        if (validationStatus !== 'READY')                     _cycle.validationDrops++;
        if (!landmarkAvail && validationStatus === 'READY')   _cycle.landmarkBlocks++;

        // Inisialisasi siklus baru
        if (_cycle.cycleState === 'IDLE' || _cycle.cycleState === 'COUNTED' || _cycle.cycleState === 'BLOCKED') {
            if (phaseAfter === SITUP_PHASE.READY && validationStatus === 'READY') {
                _cycle.cycleNumber++;
                _cycle.cycleState     = 'WAITING_SIT';
                _cycle.startedAt      = now;
                _cycle.sitDetected    = false;
                _cycle.sitConfirmed   = false;
                _cycle.flatDetected   = false;
                _cycle.flatConfirmed  = false;
                _cycle.counted        = false;
                _cycle.resetReason    = '—';
                _cycle.sitEnteredAt   = 0;
                _cycle.validationDrops = 0;
                _cycle.landmarkBlocks  = 0;
                _cycle.prevRepCount    = repCount;
            }
        }

        // Track transisi phase
        if (phaseAfter !== phaseBefore) {
            if (phaseAfter === SITUP_PHASE.SIT) {
                _cycle.sitConfirmed = true;
                _cycle.sitEnteredAt = now;
                _cycle.cycleState   = 'SIT_CONFIRMED';
            }
            if (phaseAfter === SITUP_PHASE.FLAT && phaseBefore === SITUP_PHASE.SIT) {
                _cycle.flatConfirmed = true;
                _cycle.cycleState    = 'FLAT_CONFIRMED';
            }
        }

        // Track hip masuk zona
        if (_cycle.cycleState === 'WAITING_SIT' || _cycle.cycleState === 'SIT_DETECTED') {
            if (currentHip > 0 && currentHip <= cfg.SIT_HIP_ANGLE) {
                _cycle.sitDetected = true;
                _cycle.cycleState  = 'SIT_DETECTED';
            }
        }
        if (_cycle.cycleState === 'SIT_CONFIRMED' || _cycle.cycleState === 'WAITING_FLAT') {
            if (phaseAfter === SITUP_PHASE.SIT) _cycle.cycleState = 'WAITING_FLAT';
            if (currentHip > 0 && currentHip >= cfg.FLAT_HIP_ANGLE) {
                _cycle.flatDetected = true;
                if (_cycle.cycleState === 'WAITING_FLAT') _cycle.cycleState = 'FLAT_DETECTED';
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

        // Deteksi reset siklus saat validation drop
        if ((_cycle.cycleState === 'SIT_CONFIRMED' || _cycle.cycleState === 'WAITING_FLAT') && validationStatus !== 'READY') {
            _cycle.resetReason = 'VALIDATION_LOST';
            _cycle.cycleState  = 'BLOCKED';
            _pushCycleToHistory({ ...(_cycle) });
            _cycle.cycleState  = 'IDLE';
        }

        debugRepCycle.value = {
            cycleNumber:       _cycle.cycleNumber,
            currentCycleState: _cycle.cycleState,
            sitDetected:       _cycle.sitDetected,
            sitConfirmed:      _cycle.sitConfirmed,
            flatDetected:      _cycle.flatDetected,
            flatConfirmed:     _cycle.flatConfirmed,
            counted:           _cycle.counted,
            resetReason:       _cycle.resetReason,
            validationDrops:   _cycle.validationDrops,
            landmarkBlocks:    _cycle.landmarkBlocks,
        };
    }

    function _pushCycleToHistory(snap) {
        const entry = {
            cycleNumber:  snap.cycleNumber,
            sitDetected:  snap.sitDetected,
            sitConfirmed: snap.sitConfirmed,
            flatDetected: snap.flatDetected,
            flatConfirmed:snap.flatConfirmed,
            counted:      snap.counted,
            resetReason:  snap.resetReason,
        };
        const hist = debugRepCycleHistory.value;
        debugRepCycleHistory.value = hist.length >= DEBUG_CYCLE_HISTORY_SIZE
            ? [...hist.slice(1), entry]
            : [...hist, entry];
    }

    // ── Landmark extraction ───────────────────────────────────────────────────

    /**
     * Ekstrak landmark sit-up dari array MediaPipe.
     * Landmark wajib: shoulder + hip + knee (minimal 1 sisi valid).
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
        const leftKnee      = lm(25);
        const rightKnee     = lm(26);

        const leftValid = (
            isLandmarkValid(leftShoulder, minVis) &&
            isLandmarkValid(leftHip,      minVis) &&
            isLandmarkValid(leftKnee,     minVis)
        );
        const rightValid = (
            isLandmarkValid(rightShoulder, minVis) &&
            isLandmarkValid(rightHip,      minVis) &&
            isLandmarkValid(rightKnee,     minVis)
        );

        const validSides = (leftValid ? 1 : 0) + (rightValid ? 1 : 0);
        if (validSides < cfg.MIN_VALID_SIDES) return null;

        return {
            leftShoulder,  rightShoulder,
            leftHip,       rightHip,
            leftKnee,      rightKnee,
            leftValid,
            rightValid,
        };
    }

    /**
     * Hitung hip angle dari sisi yang valid.
     * Gunakan sisi dengan confidence lebih tinggi jika keduanya valid.
     * Returns: { angle, side }
     */
    function computeHipAngle(lms) {
        const angles = [];

        if (lms.leftValid) {
            const a = calculateAngle(lms.leftShoulder, lms.leftHip, lms.leftKnee);
            if (a > 0) angles.push({ angle: a, side: 'LEFT' });
        }
        if (lms.rightValid) {
            const a = calculateAngle(lms.rightShoulder, lms.rightHip, lms.rightKnee);
            if (a > 0) angles.push({ angle: a, side: 'RIGHT' });
        }

        if (angles.length === 0) return { angle: 0, side: '—' };
        if (angles.length === 1) return angles[0];

        // Kedua sisi valid → rata-rata angle, tandai sebagai BOTH
        const avg = Math.round((angles[0].angle + angles[1].angle) / 2);
        return { angle: avg, side: 'BOTH' };
    }

    /**
     * Handle kondisi landmark hilang sementara.
     */
    function handleLandmarkLost() {
        const now = performance.now();
        if (landmarkLostTime === null) landmarkLostTime = now;
        const lostDuration = now - landmarkLostTime;

        feedback.value   = 'Pastikan seluruh tubuh terlihat kamera';
        formStatus.value = SITUP_FORM.NO_DATA;
        isValidRep.value = false;

        // Hanya reset timer jika bukan di fase SIT (mirip Push Up DOWN handling)
        if (currentPhase.value !== SITUP_PHASE.SIT) {
            sitStartTime  = null;
            flatStartTime = null;
        }

        if (currentPhase.value === SITUP_PHASE.SIT && lostDuration > cfg.LANDMARK_LOST_TIMEOUT_MS) {
            // Landmark hilang terlalu lama saat SIT → reset phase
            currentPhase.value = SITUP_PHASE.READY;
            sitStartTime       = null;
            flatStartTime      = null;
            feedback.value     = 'Posisi hilang — ulangi gerakan';
        }

        return false;
    }

    /**
     * Fungsi utama — dipanggil setiap frame dari onPoseUpdate.
     */
    function processSitUpFrame({ landmarks, validationStatus } = {}) {
        updateFps();
        frameStartTime = SITUP_DEBUG ? performance.now() : 0;
        const phaseBefore = currentPhase.value;

        // ── Guard: pose belum READY ───────────────────────────────────────────
        if (validationStatus !== 'READY') {
            feedback.value   = 'Tunggu posisi tubuh valid terlebih dahulu';
            formStatus.value = SITUP_FORM.NO_DATA;
            isValidRep.value = false;
            landmarkLostTime = null;
            if (SITUP_DEBUG) {
                debugCountingPipeline.value = {
                    ...debugCountingPipeline.value,
                    validationReady: false,
                    repIncremented:  false,
                    blockReason:     `Validation tidak READY: ${validationStatus}`,
                };
                updateDebugDiagnostics(landmarks);
                updateStateMachineDiagnostics({ validationStatus, currentHip: 0, currentPhaseBefore: phaseBefore, landmarkAvailable: false });
                updateRepCycleDiagnostics({ validationStatus, currentHip: 0, landmarkAvail: false, phaseBefore });
                pushFrameHistory(validationStatus, 0, SITUP_FORM.NO_DATA);
            }
            return;
        }

        // ── Ekstrak landmark ──────────────────────────────────────────────────
        const lms = extractLandmarks(landmarks);
        if (SITUP_DEBUG) updateDebugDiagnostics(landmarks);

        if (!lms) {
            handleLandmarkLost();
            if (SITUP_DEBUG) {
                debugCountingPipeline.value = {
                    ...debugCountingPipeline.value,
                    validationReady: true,
                    repIncremented:  false,
                    blockReason:     'Landmark tidak cukup (shoulder+hip+knee tidak valid)',
                };
                updateStateMachineDiagnostics({ validationStatus, currentHip: 0, currentPhaseBefore: phaseBefore, landmarkAvailable: false });
                updateRepCycleDiagnostics({ validationStatus, currentHip: 0, landmarkAvail: false, phaseBefore });
                pushFrameHistory(validationStatus, 0, SITUP_FORM.NO_DATA);
            }
            return;
        }

        // Landmark ada → reset lost timer
        landmarkLostTime = null;

        // ── Hitung hip angle ──────────────────────────────────────────────────
        const { angle: currentHip, side } = computeHipAngle(lms);
        hipAngle.value     = currentHip;
        countingSide.value = side;

        // ── Evaluasi form dasar ───────────────────────────────────────────────
        // Sit Up tidak memiliki body alignment check seperti Push Up.
        // Form dianggap valid selama landmark cukup.
        // Di fase READY: hip harus ≥ FLAT_HIP_ANGLE sebelum mulai gerakan.
        let fStatus   = SITUP_FORM.GOOD_FORM;
        let fMessage  = 'Lakukan gerakan sit up';

        if (currentPhase.value === SITUP_PHASE.READY && currentHip > 0 && currentHip < cfg.FLAT_HIP_ANGLE) {
            fStatus  = SITUP_FORM.ADJUST_POSITION;
            fMessage = `Luruskan posisi berbaring (hip ${currentHip}° < ${cfg.FLAT_HIP_ANGLE}°)`;
        }

        formStatus.value = fStatus;

        // ── State machine berbasis WAKTU ──────────────────────────────────────
        const now   = performance.now();
        const phase = currentPhase.value;

        let _pipelineBlock  = '—';
        let _repIncremented = false;

        if (phase === SITUP_PHASE.READY || phase === SITUP_PHASE.FLAT) {
            // ── Menunggu gerakan duduk (hip angle turun) ────────────────────
            if (currentHip > 0 && currentHip <= cfg.SIT_HIP_ANGLE) {
                if (sitStartTime === null) sitStartTime = now;
                flatStartTime = null;

                const elapsed = now - sitStartTime;
                if (elapsed >= cfg.SIT_STABLE_DURATION_MS) {
                    // Konfirmasi: fase SIT
                    currentPhase.value = SITUP_PHASE.SIT;
                    sitStartTime       = null;
                    feedback.value     = 'Bagus! Kembali ke posisi berbaring';
                    isValidRep.value   = false;
                } else {
                    feedback.value = `Duduk lebih tinggi... (${Math.round((elapsed / cfg.SIT_STABLE_DURATION_MS) * 100)}%)`;
                    _pipelineBlock = `SIT akumulasi: ${Math.round(elapsed)}ms/${cfg.SIT_STABLE_DURATION_MS}ms`;
                }
            } else {
                sitStartTime = null;
                feedback.value = fStatus === SITUP_FORM.ADJUST_POSITION
                    ? fMessage
                    : 'Mulai duduk tegak';
                _pipelineBlock = `Hip ${currentHip}° belum <= ${cfg.SIT_HIP_ANGLE}° (SIT zone)`;
            }

        } else if (phase === SITUP_PHASE.SIT) {
            // ── Sudah duduk, menunggu kembali berbaring ─────────────────────
            if (currentHip > 0 && currentHip >= cfg.FLAT_HIP_ANGLE) {
                if (flatStartTime === null) flatStartTime = now;
                sitStartTime = null;

                const elapsed = now - flatStartTime;
                if (elapsed >= cfg.FLAT_STABLE_DURATION_MS) {
                    // Konfirmasi: kembali FLAT → hitung repetisi
                    currentPhase.value = SITUP_PHASE.FLAT;
                    flatStartTime      = null;
                    repetitionCount.value++;
                    isValidRep.value   = true;
                    feedback.value     = `Bagus! ${repetitionCount.value} repetisi`;
                    _repIncremented    = true;
                } else {
                    feedback.value = `Hampir! Luruskan tubuh... (${Math.round((elapsed / cfg.FLAT_STABLE_DURATION_MS) * 100)}%)`;
                    _pipelineBlock = `FLAT akumulasi: ${Math.round(elapsed)}ms/${cfg.FLAT_STABLE_DURATION_MS}ms`;
                }
            } else {
                flatStartTime  = null;
                feedback.value = 'Berbaring kembali ke posisi awal';
                _pipelineBlock = `Hip ${currentHip}° belum >= ${cfg.FLAT_HIP_ANGLE}° (FLAT zone)`;
            }

        } else if (phase === SITUP_PHASE.FLAT) {
            // FLAT phase — menunggu siklus berikutnya dimulai
            // Setelah rep dihitung, tunggu hip turun lagi ke SIT zone
            if (currentHip > 0 && currentHip <= cfg.SIT_HIP_ANGLE) {
                if (sitStartTime === null) sitStartTime = now;
                flatStartTime = null;
                const elapsed = now - sitStartTime;
                if (elapsed >= cfg.SIT_STABLE_DURATION_MS) {
                    currentPhase.value = SITUP_PHASE.SIT;
                    sitStartTime       = null;
                    feedback.value     = 'Bagus! Kembali ke posisi berbaring';
                    isValidRep.value   = false;
                } else {
                    feedback.value = `Duduk lebih tinggi... (${Math.round((elapsed / cfg.SIT_STABLE_DURATION_MS) * 100)}%)`;
                    _pipelineBlock = `SIT akumulasi: ${Math.round(elapsed)}ms/${cfg.SIT_STABLE_DURATION_MS}ms`;
                }
            } else {
                sitStartTime = null;
                feedback.value = 'Siap untuk repetisi berikutnya';
                _pipelineBlock = `Hip ${currentHip}° belum <= ${cfg.SIT_HIP_ANGLE}° (SIT zone)`;
            }
        }

        // ── Update counting pipeline diagnostic ───────────────────────────────
        if (SITUP_DEBUG) {
            debugCountingPipeline.value = {
                validationReady: true,
                hipAngle:        currentHip,
                inSitZone:       currentHip > 0 && currentHip <= cfg.SIT_HIP_ANGLE,
                sitConfirmed:    currentPhase.value === SITUP_PHASE.SIT || phase === SITUP_PHASE.SIT,
                inFlatZone:      currentHip > 0 && currentHip >= cfg.FLAT_HIP_ANGLE,
                flatConfirmed:   _repIncremented,
                repIncremented:  _repIncremented,
                blockReason:     _repIncremented ? '—' : _pipelineBlock,
                sitAccumMs:      sitStartTime  !== null ? Math.round(now - sitStartTime)  : 0,
                flatAccumMs:     flatStartTime !== null ? Math.round(now - flatStartTime) : 0,
            };

            _cumul.validationReadyFrames++;
            if (currentHip > 0) _cumul.hipAngleSamples++;
            if (currentHip > 0 && currentHip <= cfg.SIT_HIP_ANGLE)  _cumul.sitZoneFrames++;
            if (sitStartTime !== null) {
                const acc = Math.round(now - sitStartTime);
                if (acc > _cumul.sitTimerMaxMs) _cumul.sitTimerMaxMs = acc;
            }
            if (currentHip > 0 && currentHip >= cfg.FLAT_HIP_ANGLE) _cumul.flatZoneFrames++;
            if (flatStartTime !== null) {
                const acc = Math.round(now - flatStartTime);
                if (acc > _cumul.flatTimerMaxMs) _cumul.flatTimerMaxMs = acc;
            }
            if (currentPhase.value === SITUP_PHASE.SIT && _cumul.prevPhaseForCumul !== SITUP_PHASE.SIT) {
                _cumul.sitConfirmedCount++;
            }
            if (_repIncremented) {
                _cumul.flatConfirmedCount++;
                _cumul.repIncrementCount++;
            }
            if (!_repIncremented && _pipelineBlock !== '—') _cumul.lastBlockReason = _pipelineBlock;
            _cumul.prevPhaseForCumul = currentPhase.value;

            debugPipelineCumulative.value = { ..._cumul };

            updateStateMachineDiagnostics({ validationStatus, currentHip, currentPhaseBefore: phaseBefore, landmarkAvailable: true });
            updateRepCycleDiagnostics({ validationStatus, currentHip, landmarkAvail: true, phaseBefore });
            pushFrameHistory(validationStatus, currentHip, fStatus);
        }
    }

    /**
     * Reset seluruh state sit-up.
     */
    function resetSitUp() {
        repetitionCount.value = 0;
        currentPhase.value    = SITUP_PHASE.READY;
        formStatus.value      = SITUP_FORM.NO_DATA;
        hipAngle.value        = 0;
        feedback.value        = '';
        isValidRep.value      = false;
        countingSide.value    = '—';
        sitStartTime          = null;
        flatStartTime         = null;
        landmarkLostTime      = null;
        frameStartTime        = 0;
        fpsBuffer.length      = 0;
        debugFps.value        = 0;
        debugFrameCount.value = 0;
        debugLastFrameTime.value = 0;

        debugLandmarkReport.value    = [];
        debugCountingLmReport.value  = {
            countingValid: 0, countingTotal: 6,
            countingMissing: [], blockedByCountingLm: false,
        };
        debugFrameHistory.value      = [];
        debugRepCycle.value = {
            cycleNumber: 0, currentCycleState: 'IDLE',
            sitDetected: false, sitConfirmed: false,
            flatDetected: false, flatConfirmed: false,
            counted: false, resetReason: '—',
            validationDrops: 0, landmarkBlocks: 0,
        };
        debugRepCycleHistory.value   = [];
        debugCountingPipeline.value  = {
            validationReady: false, hipAngle: 0,
            inSitZone: false, sitConfirmed: false,
            inFlatZone: false, flatConfirmed: false,
            repIncremented: false, blockReason: '—',
            sitAccumMs: 0, flatAccumMs: 0,
        };
        debugPipelineCumulative.value = {
            validationReadyFrames: 0, hipAngleSamples: 0,
            sitZoneFrames: 0, sitTimerMaxMs: 0, sitConfirmedCount: 0,
            flatZoneFrames: 0, flatTimerMaxMs: 0, flatConfirmedCount: 0,
            repIncrementCount: 0, lastBlockReason: '—',
        };
        debugStateMachine.value = {
            prevPhase: SITUP_PHASE.READY, minHipSeen: 0, maxHipSeen: 0,
            framesHipBelowSit: 0, framesHipAboveFlat: 0,
            sitEverReached: false, flatAfterSitReached: false,
            blockedByValidation: 0, blockedByLandmark: 0,
            lastBlockReason: '—', validationDropCount: 0,
        };
        _sm = {
            prevPhase: SITUP_PHASE.READY, minHipSeen: 999, maxHipSeen: 0,
            framesHipBelowSit: 0, framesHipAboveFlat: 0,
            sitEverReached: false, flatAfterSitReached: false,
            blockedByValidation: 0, blockedByLandmark: 0,
            lastBlockReason: '—', validationDropCount: 0, lastValidationStatus: 'READY',
        };
        _cumul = {
            validationReadyFrames: 0, hipAngleSamples: 0,
            sitZoneFrames: 0, sitTimerMaxMs: 0, sitConfirmedCount: 0,
            flatZoneFrames: 0, flatTimerMaxMs: 0, flatConfirmedCount: 0,
            repIncrementCount: 0, lastBlockReason: '—',
            prevPhaseForCumul: SITUP_PHASE.READY,
        };
        _cycle = {
            cycleNumber: 0, cycleState: 'IDLE', startedAt: 0,
            sitDetected: false, sitConfirmed: false,
            flatDetected: false, flatConfirmed: false,
            counted: false, resetReason: '—', sitEnteredAt: 0,
            validationDrops: 0, landmarkBlocks: 0, prevRepCount: 0,
        };
    }

    // ── Computed UI helpers ───────────────────────────────────────────────────

    const phaseLabel = computed(() => {
        const map = {
            [SITUP_PHASE.READY]: 'READY',
            [SITUP_PHASE.SIT]:   'SIT ↑',
            [SITUP_PHASE.FLAT]:  'FLAT ↓',
        };
        return map[currentPhase.value] ?? '—';
    });

    const phaseColor = computed(() => {
        const map = {
            [SITUP_PHASE.READY]: 'text-slate-400',
            [SITUP_PHASE.SIT]:   'text-orange-400',
            [SITUP_PHASE.FLAT]:  'text-emerald-400',
        };
        return map[currentPhase.value] ?? 'text-slate-400';
    });

    const formStatusBadge = computed(() => {
        const map = {
            [SITUP_FORM.GOOD_FORM]:       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            [SITUP_FORM.ADJUST_POSITION]: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
            [SITUP_FORM.NO_DATA]:         'bg-slate-800 text-slate-500 border-white/5',
        };
        return map[formStatus.value] ?? 'bg-slate-800 text-slate-500 border-white/5';
    });

    return {
        // State
        repetitionCount,
        currentPhase,
        formStatus,
        hipAngle,
        feedback,
        isValidRep,
        countingSide,

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
        processSitUpFrame,
        resetSitUp,

        // UI helpers
        phaseLabel,
        phaseColor,
        formStatusBadge,

        // Config
        config: cfg,
    };
}
