/**
 * useSquatJumpDetection.js
 *
 * Composable untuk mendeteksi dan menghitung repetisi Squat Jump menggunakan
 * landmark MediaPipe Pose.
 *
 * Assessment ini adalah REPETITION COUNTING.
 * Mengukur jumlah squat jump yang berhasil diselesaikan.
 *
 * Satu repetisi VALID harus memiliki urutan penuh:
 *   SQUAT_CONFIRMED → JUMP_DETECTED → LANDING_CONFIRMED → REP++
 *
 * Tanpa urutan ini, tidak ada repetisi yang dihitung.
 *
 * Algoritma:
 *   1. Hitung knee angle (hip → knee → ankle) — metrik utama
 *   2. Deteksi fase SQUAT: knee angle ≤ SQUAT_ANGLE selama SQUAT_STABLE_MS
 *   3. Deteksi fase JUMP: dari SQUAT, knee angle naik cepat ke zona tinggi
 *      DAN hip Y position bergerak ke atas (hip.y berkurang = naik di layar)
 *   4. Deteksi LANDING: setelah JUMP, knee angle turun ke zona mid dan
 *      kemudian kembali naik ke UP zone selama LANDING_STABLE_MS
 *   5. REP++ hanya setelah LANDING_CONFIRMED
 *
 * Jump detection approach:
 *   Dari kamera 2D (frontal view), lompat terdeteksi dari:
 *   a) Kecepatan naik knee angle setelah squat (lebih cepat dari deep squat biasa)
 *   b) Perubahan posisi vertikal hip (hip.y berkurang = naik)
 *   c) Kombinasi keduanya selama minimal JUMP_DETECT_MS
 *
 * Hysteresis:
 *   SQUAT zone: knee ≤ SQUAT_ANGLE (misal 110°)
 *   MID zone:   110° < knee < UP_ANGLE (misal 150°) — transisi / landing
 *   UP zone:    knee ≥ UP_ANGLE — berdiri / selesai landing
 *
 * Landmark:
 *   23 = left_hip   24 = right_hip
 *   25 = left_knee  26 = right_knee
 *   27 = left_ankle 28 = right_ankle
 *
 * CATATAN:
 *   Semua threshold adalah PROVISIONAL. Harus divalidasi trainer/client.
 *   Jump detection dari kamera 2D inherently tidak sempurna —
 *   kalibrasi berdasarkan data nyata sangat diperlukan.
 */

import { ref, computed } from 'vue';

// ─────────────────────────────────────────────────────────────────────────────
// DEBUG FLAG
// ─────────────────────────────────────────────────────────────────────────────

export const SQUATJUMP_DEBUG = true;

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

export const SQUATJUMP_CONFIG = {
    // ── Knee angle zones ─────────────────────────────────────────────────────

    /**
     * Knee angle maksimum untuk dianggap posisi SQUAT.
     * hip→knee→ankle ≤ nilai ini → zona squat.
     * Deep squat = ~70–90°. Frontal view bisa lebih tinggi.
     *
     * !! PROVISIONAL !!
     */
    SQUAT_ANGLE: 110,

    /**
     * Knee angle minimum untuk dianggap posisi berdiri / selesai landing.
     * Hysteresis: UP_ANGLE > SQUAT_ANGLE mencegah flicker.
     *
     * !! PROVISIONAL !!
     */
    UP_ANGLE: 150,

    // ── Stabilization durations ───────────────────────────────────────────────

    /**
     * Durasi minimum (ms) di zona squat sebelum SQUAT dikonfirmasi.
     * Mencegah false detection dari gerakan sesaat.
     * 80ms ≈ 1 frame @13fps.
     *
     * !! PROVISIONAL !!
     */
    SQUAT_STABLE_MS: 80,

    /**
     * Durasi minimum (ms) di zona UP setelah landing sebelum REP dihitung.
     * Memastikan user benar-benar kembali ke posisi berdiri stabil.
     * 80ms ≈ 1 frame @13fps.
     *
     * !! PROVISIONAL !!
     */
    LANDING_STABLE_MS: 80,

    /**
     * Durasi minimum (ms) fase mid/naik harus berlangsung untuk dianggap
     * ada upward movement (bukan sekadar noise). Ini membantu membedakan
     * Squat Jump (naik cepat) dari Deep Squat (naik pelan-pelan).
     *
     * !! PROVISIONAL — kalibrasi sangat diperlukan !!
     */
    JUMP_DETECT_MS: 50,

    /**
     * Perubahan minimum hip Y (normalized) yang dianggap indikasi lompat ke atas.
     * Ketika melompat, hip.y berkurang (bergerak ke atas di layar).
     * Negatif berarti hip bergerak ke atas.
     *
     * 0.02 = 2% tinggi frame — sangat konservatif karena MediaPipe smoothing.
     * Dari kamera jauh mungkin perlu dikecilkan.
     *
     * !! PROVISIONAL — nilai paling tidak pasti, perlu data nyata !!
     */
    HIP_LIFT_THRESHOLD: 0.02,

    /**
     * Durasi maksimum (ms) landmark boleh hilang saat SQUAT atau JUMP
     * sebelum siklus di-reset.
     */
    LANDMARK_LOST_TIMEOUT_MS: 500,

    /** Visibility minimum per landmark (0.0–1.0). */
    MIN_VISIBILITY: 0.5,

    /**
     * Jumlah sisi minimum yang harus punya hip+knee+ankle valid.
     * 1 = single-side OK.
     *
     * !! PROVISIONAL !!
     */
    MIN_VALID_SIDES: 1,
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const SQUATJUMP_PHASE = {
    READY:    'READY',    // berdiri, menunggu mulai squat
    SQUAT:    'SQUAT',    // squat terkonfirmasi, menunggu lompat
    JUMP:     'JUMP',     // fase naik / melayang, menunggu landing
    LANDING:  'LANDING',  // turun kembali, menunggu stabilisasi
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

const SQUATJUMP_DIAGNOSTIC_LANDMARKS = [
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

export function useSquatJumpDetection(config = {}) {
    const cfg = { ...SQUATJUMP_CONFIG, ...config };

    // ── Reactive state ────────────────────────────────────────────────────────
    const repetitionCount = ref(0);
    const currentPhase    = ref(SQUATJUMP_PHASE.READY);
    const kneeAngle       = ref(0);
    const countingSide    = ref('—');
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

    // ── Debug: jump detail per-frame ──────────────────────────────────────────
    const debugJumpDetail = ref({
        leftKneeAngle:   0,
        rightKneeAngle:  0,
        hipYCurrent:     0,   // posisi Y hip saat ini (sisi yang valid)
        hipYAtSquat:     0,   // posisi Y hip saat squat dikonfirmasi
        hipLift:         0,   // hipYAtSquat - hipYCurrent (positif = naik ke atas)
        hipLiftDetected: false,
        inSquatZone:     false,
        inUpZone:        false,
    });

    // ── Debug: counting pipeline per-frame ────────────────────────────────────
    const debugCountingPipeline = ref({
        validationReady:    false,
        kneeAngle:          0,
        inSquatZone:        false,
        squatAccumMs:       0,
        squatConfirmed:     false,
        hipLift:            0,
        jumpDetected:       false,
        jumpAccumMs:        0,
        inUpZoneAfterJump:  false,
        landingAccumMs:     0,
        landingConfirmed:   false,
        repIncremented:     false,
        blockReason:        '—',
    });

    // ── Debug: cumulative counters ────────────────────────────────────────────
    const debugPipelineCumulative = ref({
        validationReadyFrames: 0,
        kneeAngleSamples:      0,
        squatZoneFrames:       0,
        squatTimerMaxMs:       0,
        squatConfirmedCount:   0,
        jumpDetectedCount:     0,
        landingFrames:         0,
        landingTimerMaxMs:     0,
        repIncrementCount:     0,
        landmarkBlockedCount:  0,
        validationBlockedCount:0,
        lastBlockReason:       '—',
    });
    let _cumul = {
        validationReadyFrames: 0,
        kneeAngleSamples:      0,
        squatZoneFrames:       0,
        squatTimerMaxMs:       0,
        squatConfirmedCount:   0,
        jumpDetectedCount:     0,
        landingFrames:         0,
        landingTimerMaxMs:     0,
        repIncrementCount:     0,
        landmarkBlockedCount:  0,
        validationBlockedCount:0,
        lastBlockReason:       '—',
    };

    // ── Debug: state machine diagnostics ─────────────────────────────────────
    const debugStateMachine = ref({
        prevPhase:            SQUATJUMP_PHASE.READY,
        minKneeAngleSeen:     999,
        maxKneeAngleSeen:     0,
        maxHipLiftSeen:       0,
        squatEverReached:     false,
        jumpEverDetected:     false,
        landingEverConfirmed: false,
        blockedByValidation:  0,
        blockedByLandmark:    0,
        lastBlockReason:      '—',
        validationDropCount:  0,
    });
    let _sm = {
        prevPhase:            SQUATJUMP_PHASE.READY,
        minKneeAngleSeen:     999,
        maxKneeAngleSeen:     0,
        maxHipLiftSeen:       0,
        squatEverReached:     false,
        jumpEverDetected:     false,
        landingEverConfirmed: false,
        blockedByValidation:  0,
        blockedByLandmark:    0,
        lastBlockReason:      '—',
        validationDropCount:  0,
        lastValidationStatus: 'READY',
    };

    // ── Debug: frame history (rolling 25) ─────────────────────────────────────
    const DEBUG_HISTORY_SIZE = 25;
    const debugFrameHistory  = ref([]);

    // ── Debug: rep cycle history ──────────────────────────────────────────────
    const DEBUG_CYCLE_HISTORY_SIZE = 10;
    const debugRepCycleHistory     = ref([]);
    const debugRepCycle = ref({
        cycleNumber:      0,
        cycleState:       'IDLE',
        squatDetected:    false,
        squatConfirmed:   false,
        jumpDetected:     false,
        landingConfirmed: false,
        counted:          false,
        resetReason:      '—',
    });

    let _cycle = {
        cycleNumber:      0,
        cycleState:       'IDLE',
        startedAt:        0,
        squatDetected:    false,
        squatConfirmed:   false,
        jumpDetected:     false,
        landingConfirmed: false,
        counted:          false,
        resetReason:      '—',
        prevRepCount:     0,
    };

    // ── Non-reactive timers ───────────────────────────────────────────────────
    let squatStartTime   = null; // timestamp knee pertama masuk squat zone
    let jumpStartTime    = null; // timestamp deteksi awal fase naik setelah squat
    let landingStartTime = null; // timestamp knee masuk UP zone setelah jump
    let landmarkLostTime = null;

    // Simpan posisi hip saat squat dikonfirmasi (untuk deteksi hip lift)
    let hipYAtSquatConfirm = null;

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
        if (!SQUATJUMP_DEBUG) return;
        const minVis = cfg.MIN_VISIBILITY;
        debugLandmarkReport.value = SQUATJUMP_DIAGNOSTIC_LANDMARKS.map(({ name, index }) => {
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
    function updateStateMachineDiagnostics({ validationStatus, currentKnee, hipLift, phaseBefore, landmarkAvailable }) {
        if (!SQUATJUMP_DEBUG) return;

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
        if (hipLift > _sm.maxHipLiftSeen) _sm.maxHipLiftSeen = parseFloat(hipLift.toFixed(3));

        const nowPhase = currentPhase.value;
        if (nowPhase !== phaseBefore) _sm.prevPhase = phaseBefore;
        if (nowPhase === SQUATJUMP_PHASE.SQUAT)   _sm.squatEverReached     = true;
        if (nowPhase === SQUATJUMP_PHASE.JUMP)     _sm.jumpEverDetected     = true;
        if (nowPhase === SQUATJUMP_PHASE.READY && _sm.jumpEverDetected &&
            phaseBefore === SQUATJUMP_PHASE.LANDING) _sm.landingEverConfirmed = true;

        debugStateMachine.value = {
            prevPhase:            _sm.prevPhase,
            minKneeAngleSeen:     _sm.minKneeAngleSeen === 999 ? 0 : _sm.minKneeAngleSeen,
            maxKneeAngleSeen:     _sm.maxKneeAngleSeen,
            maxHipLiftSeen:       _sm.maxHipLiftSeen,
            squatEverReached:     _sm.squatEverReached,
            jumpEverDetected:     _sm.jumpEverDetected,
            landingEverConfirmed: _sm.landingEverConfirmed,
            blockedByValidation:  _sm.blockedByValidation,
            blockedByLandmark:    _sm.blockedByLandmark,
            lastBlockReason:      _sm.lastBlockReason,
            validationDropCount:  _sm.validationDropCount,
        };
    }

    // ── Debug: frame history ──────────────────────────────────────────────────
    function pushFrameHistory(validationStatus, currentKnee, hipLift) {
        if (!SQUATJUMP_DEBUG) return;
        const entry = {
            ts:      Math.round(performance.now() / 100) / 10,
            fps:     debugFps.value,
            valid:   validationStatus,
            knee:    currentKnee,
            hipLift: parseFloat(hipLift.toFixed(3)),
            phase:   currentPhase.value,
            rep:     repetitionCount.value,
        };
        const h = debugFrameHistory.value;
        debugFrameHistory.value = h.length >= DEBUG_HISTORY_SIZE
            ? [...h.slice(1), entry]
            : [...h, entry];
    }

    // ── Debug: rep cycle ──────────────────────────────────────────────────────
    function updateRepCycleDiagnostics({ validationStatus, phaseBefore }) {
        if (!SQUATJUMP_DEBUG) return;

        const phaseAfter = currentPhase.value;
        const repCount   = repetitionCount.value;

        // Inisialisasi siklus baru
        if (_cycle.cycleState === 'IDLE' || _cycle.cycleState === 'COUNTED' || _cycle.cycleState === 'BLOCKED') {
            if (phaseAfter === SQUATJUMP_PHASE.READY && validationStatus === 'READY') {
                _cycle.cycleNumber++;
                _cycle.cycleState       = 'WAITING_SQUAT';
                _cycle.startedAt        = performance.now();
                _cycle.squatDetected    = false;
                _cycle.squatConfirmed   = false;
                _cycle.jumpDetected     = false;
                _cycle.landingConfirmed = false;
                _cycle.counted          = false;
                _cycle.resetReason      = '—';
                _cycle.prevRepCount     = repCount;
            }
        }

        // Track transisi
        if (phaseAfter !== phaseBefore) {
            if (phaseAfter === SQUATJUMP_PHASE.SQUAT) {
                _cycle.squatConfirmed = true;
                _cycle.squatDetected  = true;
                _cycle.cycleState     = 'SQUAT_CONFIRMED';
            }
            if (phaseAfter === SQUATJUMP_PHASE.JUMP) {
                _cycle.jumpDetected = true;
                _cycle.cycleState   = 'JUMP_DETECTED';
            }
            if (phaseAfter === SQUATJUMP_PHASE.LANDING) {
                _cycle.cycleState = 'LANDING';
            }
        }

        // Deteksi rep dihitung
        if (repCount > _cycle.prevRepCount) {
            _cycle.counted          = true;
            _cycle.landingConfirmed = true;
            _cycle.cycleState       = 'COUNTED';
            _cycle.prevRepCount     = repCount;
            _pushCycleToHistory({ ...(_cycle) });
            _cycle.cycleState = 'IDLE';
        }

        // Reset saat validation lost di fase aktif
        if ((_cycle.cycleState === 'SQUAT_CONFIRMED' || _cycle.cycleState === 'JUMP_DETECTED' || _cycle.cycleState === 'LANDING') &&
            validationStatus !== 'READY') {
            _cycle.resetReason = 'VALIDATION_LOST';
            _cycle.cycleState  = 'BLOCKED';
            _pushCycleToHistory({ ...(_cycle) });
            _cycle.cycleState  = 'IDLE';
        }

        debugRepCycle.value = {
            cycleNumber:      _cycle.cycleNumber,
            cycleState:       _cycle.cycleState,
            squatDetected:    _cycle.squatDetected,
            squatConfirmed:   _cycle.squatConfirmed,
            jumpDetected:     _cycle.jumpDetected,
            landingConfirmed: _cycle.landingConfirmed,
            counted:          _cycle.counted,
            resetReason:      _cycle.resetReason,
        };
    }

    function _pushCycleToHistory(snap) {
        const entry = {
            cycleNumber:      snap.cycleNumber,
            squatDetected:    snap.squatDetected,
            squatConfirmed:   snap.squatConfirmed,
            jumpDetected:     snap.jumpDetected,
            landingConfirmed: snap.landingConfirmed,
            counted:          snap.counted,
            resetReason:      snap.resetReason,
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
     * Returns: { angle, side, leftAngle, rightAngle, hipY }
     * hipY = posisi Y hip dari sisi yang valid (untuk jump detection)
     */
    function computeKneeAngle(lms) {
        const angles = [];
        let leftAngle  = 0;
        let rightAngle = 0;
        let hipY       = 0;

        if (lms.leftValid) {
            const a = calculateAngle(lms.leftHip, lms.leftKnee, lms.leftAnkle);
            leftAngle = a;
            if (a > 0) angles.push({ angle: a, side: 'LEFT', hipY: lms.leftHip?.y ?? 0 });
        }
        if (lms.rightValid) {
            const a = calculateAngle(lms.rightHip, lms.rightKnee, lms.rightAnkle);
            rightAngle = a;
            if (a > 0) angles.push({ angle: a, side: 'RIGHT', hipY: lms.rightHip?.y ?? 0 });
        }

        if (angles.length === 0) return { angle: 0, side: '—', leftAngle, rightAngle, hipY: 0 };
        if (angles.length === 1) return { ...angles[0], leftAngle, rightAngle };

        const avg  = Math.round((angles[0].angle + angles[1].angle) / 2);
        hipY = (angles[0].hipY + angles[1].hipY) / 2;
        return { angle: avg, side: 'BOTH', leftAngle, rightAngle, hipY };
    }

    /**
     * Fungsi utama — dipanggil setiap frame dari onPoseUpdate.
     */
    function processSquatJumpFrame({ landmarks, validationStatus } = {}) {
        updateFps();
        const now         = performance.now();
        const phaseBefore = currentPhase.value;

        // ── Guard: pose belum READY ───────────────────────────────────────────
        if (validationStatus !== 'READY') {
            feedback.value    = 'Tunggu posisi tubuh valid terlebih dahulu';
            isValidRep.value  = false;
            landmarkLostTime  = null;
            squatStartTime    = null;

            // Reset fase aktif ke READY
            if (currentPhase.value !== SQUATJUMP_PHASE.READY) {
                currentPhase.value   = SQUATJUMP_PHASE.READY;
                hipYAtSquatConfirm   = null;
                jumpStartTime        = null;
                landingStartTime     = null;
            }

            if (SQUATJUMP_DEBUG) {
                _cumul.validationBlockedCount++;
                _cumul.lastBlockReason = `Validation: ${validationStatus}`;
                debugCountingPipeline.value = {
                    ...debugCountingPipeline.value,
                    validationReady: false,
                    blockReason: `Validation tidak READY: ${validationStatus}`,
                };
                updateDebugDiagnostics(landmarks);
                updateStateMachineDiagnostics({ validationStatus, currentKnee: 0, hipLift: 0, phaseBefore, landmarkAvailable: false });
                updateRepCycleDiagnostics({ validationStatus, phaseBefore });
                pushFrameHistory(validationStatus, 0, 0);
                debugPipelineCumulative.value = { ..._cumul };
            }
            return;
        }

        // ── Ekstrak landmark ──────────────────────────────────────────────────
        const lms = extractLandmarks(landmarks);
        if (SQUATJUMP_DEBUG) updateDebugDiagnostics(landmarks);

        if (!lms) {
            feedback.value = 'Pastikan kaki (pinggul, lutut, pergelangan) terlihat';

            // Toleransi landmark lost sesuai fase
            if (currentPhase.value !== SQUATJUMP_PHASE.READY) {
                if (landmarkLostTime === null) landmarkLostTime = now;
                if (now - landmarkLostTime > cfg.LANDMARK_LOST_TIMEOUT_MS) {
                    currentPhase.value   = SQUATJUMP_PHASE.READY;
                    squatStartTime       = null;
                    jumpStartTime        = null;
                    landingStartTime     = null;
                    hipYAtSquatConfirm   = null;
                    landmarkLostTime     = null;
                }
            } else {
                squatStartTime   = null;
                jumpStartTime    = null;
                landingStartTime = null;
                landmarkLostTime = null;
            }

            if (SQUATJUMP_DEBUG) {
                _cumul.landmarkBlockedCount++;
                _cumul.lastBlockReason = 'Landmark tidak cukup';
                debugCountingPipeline.value = {
                    ...debugCountingPipeline.value,
                    validationReady: true,
                    blockReason: 'Landmark tidak cukup (hip+knee+ankle)',
                };
                updateStateMachineDiagnostics({ validationStatus, currentKnee: 0, hipLift: 0, phaseBefore, landmarkAvailable: false });
                updateRepCycleDiagnostics({ validationStatus, phaseBefore });
                pushFrameHistory(validationStatus, 0, 0);
                debugPipelineCumulative.value = { ..._cumul };
            }
            return;
        }

        // Landmark ada → reset lost timer
        landmarkLostTime = null;

        // ── Hitung knee angle + hip Y ─────────────────────────────────────────
        const { angle: currentKnee, side, leftAngle, rightAngle, hipY } = computeKneeAngle(lms);
        kneeAngle.value    = currentKnee;
        countingSide.value = side;

        // Hitung hip lift (positif = hip naik ke atas = potensi lompat)
        // hipY di MediaPipe: 0=atas, 1=bawah — jadi naik = hipY berkurang
        const hipLift = hipYAtSquatConfirm !== null
            ? parseFloat((hipYAtSquatConfirm - hipY).toFixed(3))
            : 0;

        const inSquatZone = currentKnee > 0 && currentKnee <= cfg.SQUAT_ANGLE;
        const inUpZone    = currentKnee > 0 && currentKnee >= cfg.UP_ANGLE;
        const hipLiftDetected = hipLift >= cfg.HIP_LIFT_THRESHOLD;

        // ── Update jump detail diagnostic ─────────────────────────────────────
        if (SQUATJUMP_DEBUG) {
            debugJumpDetail.value = {
                leftKneeAngle:   leftAngle,
                rightKneeAngle:  rightAngle,
                hipYCurrent:     parseFloat(hipY.toFixed(3)),
                hipYAtSquat:     hipYAtSquatConfirm != null ? parseFloat(hipYAtSquatConfirm.toFixed(3)) : 0,
                hipLift:         hipLift,
                hipLiftDetected,
                inSquatZone,
                inUpZone,
            };
        }

        // ── State machine ─────────────────────────────────────────────────────
        const phase         = currentPhase.value;
        let _pipelineBlock  = '—';
        let _repIncremented = false;

        if (phase === SQUATJUMP_PHASE.READY) {
            // ── Menunggu gerakan squat ──────────────────────────────────────
            if (inSquatZone) {
                if (squatStartTime === null) squatStartTime = now;
                const elapsed = now - squatStartTime;

                if (elapsed >= cfg.SQUAT_STABLE_MS) {
                    // SQUAT dikonfirmasi
                    currentPhase.value   = SQUATJUMP_PHASE.SQUAT;
                    squatStartTime       = null;
                    hipYAtSquatConfirm   = hipY; // simpan posisi hip sebagai baseline
                    jumpStartTime        = null;
                    feedback.value       = 'Squat! Sekarang lompat!';
                    if (SQUATJUMP_DEBUG) _cumul.squatConfirmedCount++;
                } else {
                    const pct = Math.round((elapsed / cfg.SQUAT_STABLE_MS) * 100);
                    feedback.value = `Squat lebih dalam... (${pct}%)`;
                    _pipelineBlock = `Squat akumulasi: ${Math.round(elapsed)}ms/${cfg.SQUAT_STABLE_MS}ms`;
                }
            } else {
                squatStartTime = null;
                feedback.value = currentKnee > 0
                    ? `Lakukan squat (knee ${currentKnee}° > ${cfg.SQUAT_ANGLE}°)`
                    : 'Mulai squat untuk memulai';
                if (currentKnee > 0) _pipelineBlock = `Knee ${currentKnee}° belum <= ${cfg.SQUAT_ANGLE}° (squat zone)`;
            }

        } else if (phase === SQUATJUMP_PHASE.SQUAT) {
            // ── Squat terkonfirmasi — menunggu gerakan lompat ───────────────
            // Jump terjadi ketika DARI posisi squat, knee angle naik (lebih besar)
            // DAN ada indikasi hip terangkat
            // Deteksi: knee keluar dari squat zone DAN hip lift terdeteksi

            const kneeRisingFromSquat = currentKnee > cfg.SQUAT_ANGLE; // keluar squat zone = naik

            if (kneeRisingFromSquat) {
                // Knee mulai naik dari squat
                if (jumpStartTime === null) jumpStartTime = now;
                const jumpElapsed = now - jumpStartTime;

                if (jumpElapsed >= cfg.JUMP_DETECT_MS || hipLiftDetected) {
                    // Jump dikonfirmasi — masuk fase JUMP
                    currentPhase.value = SQUATJUMP_PHASE.JUMP;
                    landingStartTime   = null;
                    feedback.value     = 'Bagus! Mendarat...';
                    if (SQUATJUMP_DEBUG) _cumul.jumpDetectedCount++;
                } else {
                    const pct = Math.round((jumpElapsed / cfg.JUMP_DETECT_MS) * 100);
                    feedback.value = `Lompat! (${pct}%)`;
                    _pipelineBlock = `Jump akumulasi: ${Math.round(jumpElapsed)}ms/${cfg.JUMP_DETECT_MS}ms`;
                }
            } else {
                // Masih di squat zone — belum naik, tunggu
                jumpStartTime  = null;
                feedback.value = 'Sekarang lompat dari posisi squat!';
                _pipelineBlock = `Masih di squat zone (${currentKnee}°) — butuh naik untuk jump`;
            }

        } else if (phase === SQUATJUMP_PHASE.JUMP) {
            // ── Fase jump — menunggu landing ────────────────────────────────
            // Landing: knee kembali ke mid zone atau squat zone, lalu naik ke UP zone
            // Kita deteksi landing saat knee mencapai UP zone setelah jump

            if (inUpZone) {
                // Knee sudah kembali ke UP zone — ini landing/berdiri kembali
                if (landingStartTime === null) landingStartTime = now;
                currentPhase.value = SQUATJUMP_PHASE.LANDING;
                feedback.value     = 'Mendarat...';
            } else {
                landingStartTime = null;
                // Masih dalam fase melayang / penurunan
                feedback.value = 'Mendarat...';
                _pipelineBlock = `Menunggu landing (knee: ${currentKnee}°)`;
            }

        } else if (phase === SQUATJUMP_PHASE.LANDING) {
            // ── Fase landing — stabilisasi sebelum REP++ ────────────────────
            if (inUpZone) {
                // Masih di UP zone — akumulasi landing stabilization
                if (landingStartTime === null) landingStartTime = now;
                const elapsed = now - landingStartTime;

                if (SQUATJUMP_DEBUG) _cumul.landingFrames++;

                if (elapsed >= cfg.LANDING_STABLE_MS) {
                    // Landing terkonfirmasi → REP++
                    currentPhase.value   = SQUATJUMP_PHASE.READY;
                    landingStartTime     = null;
                    squatStartTime       = null;
                    jumpStartTime        = null;
                    hipYAtSquatConfirm   = null;
                    repetitionCount.value++;
                    isValidRep.value     = true;
                    feedback.value       = `Bagus! ${repetitionCount.value} repetisi`;
                    _repIncremented      = true;
                } else {
                    const pct = Math.round((elapsed / cfg.LANDING_STABLE_MS) * 100);
                    feedback.value = `Mendarat stabil... (${pct}%)`;
                    _pipelineBlock = `Landing akumulasi: ${Math.round(elapsed)}ms/${cfg.LANDING_STABLE_MS}ms`;
                }
            } else {
                // Keluar dari UP zone saat landing (bouncing/tidak stabil)
                // Kembali ke JUMP phase untuk menunggu stabilisasi
                landingStartTime   = null;
                currentPhase.value = SQUATJUMP_PHASE.JUMP;
                feedback.value     = 'Stabilkan pendaratan...';
                _pipelineBlock     = `Landing tidak stabil (knee: ${currentKnee}°), kembali ke JUMP`;
            }
        }

        // ── Update debug diagnostics ──────────────────────────────────────────
        if (SQUATJUMP_DEBUG) {
            _cumul.validationReadyFrames++;
            if (currentKnee > 0) _cumul.kneeAngleSamples++;
            if (inSquatZone)     _cumul.squatZoneFrames++;
            if (squatStartTime !== null) {
                const acc = Math.round(now - squatStartTime);
                if (acc > _cumul.squatTimerMaxMs) _cumul.squatTimerMaxMs = acc;
            }
            if (landingStartTime !== null) {
                const acc = Math.round(now - landingStartTime);
                if (acc > _cumul.landingTimerMaxMs) _cumul.landingTimerMaxMs = acc;
            }
            if (_repIncremented) _cumul.repIncrementCount++;
            if (!_repIncremented && _pipelineBlock !== '—') _cumul.lastBlockReason = _pipelineBlock;

            debugCountingPipeline.value = {
                validationReady:   true,
                kneeAngle:         currentKnee,
                inSquatZone,
                squatAccumMs:      squatStartTime  !== null ? Math.round(now - squatStartTime)   : 0,
                squatConfirmed:    phase === SQUATJUMP_PHASE.SQUAT || phase === SQUATJUMP_PHASE.JUMP || phase === SQUATJUMP_PHASE.LANDING,
                hipLift:           hipLift,
                jumpDetected:      phase === SQUATJUMP_PHASE.JUMP || phase === SQUATJUMP_PHASE.LANDING,
                jumpAccumMs:       jumpStartTime   !== null ? Math.round(now - jumpStartTime)    : 0,
                inUpZoneAfterJump: inUpZone && (phase === SQUATJUMP_PHASE.LANDING),
                landingAccumMs:    landingStartTime!== null ? Math.round(now - landingStartTime) : 0,
                landingConfirmed:  false, // set true hanya saat _repIncremented
                repIncremented:    _repIncremented,
                blockReason:       _repIncremented ? '—' : _pipelineBlock,
            };

            debugPipelineCumulative.value = { ..._cumul };
            updateStateMachineDiagnostics({ validationStatus, currentKnee, hipLift, phaseBefore, landmarkAvailable: true });
            updateRepCycleDiagnostics({ validationStatus, phaseBefore });
            pushFrameHistory(validationStatus, currentKnee, hipLift);
        }
    }

    /**
     * Reset seluruh state Squat Jump.
     */
    function resetSquatJump() {
        repetitionCount.value = 0;
        currentPhase.value    = SQUATJUMP_PHASE.READY;
        kneeAngle.value       = 0;
        countingSide.value    = '—';
        feedback.value        = '';
        isValidRep.value      = false;

        squatStartTime     = null;
        jumpStartTime      = null;
        landingStartTime   = null;
        landmarkLostTime   = null;
        hipYAtSquatConfirm = null;

        fpsBuffer.length         = 0;
        debugFps.value           = 0;
        debugFrameCount.value    = 0;
        debugLastFrameTime.value = 0;

        debugLandmarkReport.value = [];
        debugFrameHistory.value   = [];
        debugRepCycleHistory.value= [];
        debugRepCycle.value = {
            cycleNumber: 0, cycleState: 'IDLE',
            squatDetected: false, squatConfirmed: false,
            jumpDetected: false, landingConfirmed: false,
            counted: false, resetReason: '—',
        };
        debugJumpDetail.value = {
            leftKneeAngle: 0, rightKneeAngle: 0,
            hipYCurrent: 0, hipYAtSquat: 0, hipLift: 0,
            hipLiftDetected: false, inSquatZone: false, inUpZone: false,
        };
        debugCountingPipeline.value = {
            validationReady: false, kneeAngle: 0, inSquatZone: false,
            squatAccumMs: 0, squatConfirmed: false,
            hipLift: 0, jumpDetected: false, jumpAccumMs: 0,
            inUpZoneAfterJump: false, landingAccumMs: 0,
            landingConfirmed: false, repIncremented: false, blockReason: '—',
        };
        debugPipelineCumulative.value = {
            validationReadyFrames: 0, kneeAngleSamples: 0,
            squatZoneFrames: 0, squatTimerMaxMs: 0, squatConfirmedCount: 0,
            jumpDetectedCount: 0, landingFrames: 0, landingTimerMaxMs: 0,
            repIncrementCount: 0, landmarkBlockedCount: 0,
            validationBlockedCount: 0, lastBlockReason: '—',
        };
        debugStateMachine.value = {
            prevPhase: SQUATJUMP_PHASE.READY, minKneeAngleSeen: 0, maxKneeAngleSeen: 0,
            maxHipLiftSeen: 0, squatEverReached: false, jumpEverDetected: false,
            landingEverConfirmed: false, blockedByValidation: 0, blockedByLandmark: 0,
            lastBlockReason: '—', validationDropCount: 0,
        };
        _sm = {
            prevPhase: SQUATJUMP_PHASE.READY, minKneeAngleSeen: 999, maxKneeAngleSeen: 0,
            maxHipLiftSeen: 0, squatEverReached: false, jumpEverDetected: false,
            landingEverConfirmed: false, blockedByValidation: 0, blockedByLandmark: 0,
            lastBlockReason: '—', validationDropCount: 0, lastValidationStatus: 'READY',
        };
        _cumul = {
            validationReadyFrames: 0, kneeAngleSamples: 0,
            squatZoneFrames: 0, squatTimerMaxMs: 0, squatConfirmedCount: 0,
            jumpDetectedCount: 0, landingFrames: 0, landingTimerMaxMs: 0,
            repIncrementCount: 0, landmarkBlockedCount: 0,
            validationBlockedCount: 0, lastBlockReason: '—',
        };
        _cycle = {
            cycleNumber: 0, cycleState: 'IDLE', startedAt: 0,
            squatDetected: false, squatConfirmed: false,
            jumpDetected: false, landingConfirmed: false,
            counted: false, resetReason: '—', prevRepCount: 0,
        };
    }

    // ── Computed UI helpers ───────────────────────────────────────────────────

    const phaseLabel = computed(() => ({
        [SQUATJUMP_PHASE.READY]:   'READY',
        [SQUATJUMP_PHASE.SQUAT]:   'SQUAT ↓',
        [SQUATJUMP_PHASE.JUMP]:    'JUMP ↑',
        [SQUATJUMP_PHASE.LANDING]: 'LANDING ↓',
    }[currentPhase.value] ?? '—'));

    const phaseColor = computed(() => ({
        [SQUATJUMP_PHASE.READY]:   'text-slate-400',
        [SQUATJUMP_PHASE.SQUAT]:   'text-orange-400',
        [SQUATJUMP_PHASE.JUMP]:    'text-emerald-400',
        [SQUATJUMP_PHASE.LANDING]: 'text-cyan-400',
    }[currentPhase.value] ?? 'text-slate-400'));

    return {
        // State
        repetitionCount, currentPhase, kneeAngle,
        countingSide, feedback, isValidRep,

        // Debug
        debugFps, debugFrameCount, debugLandmarkReport,
        debugJumpDetail, debugCountingPipeline,
        debugPipelineCumulative, debugStateMachine,
        debugFrameHistory, debugRepCycle, debugRepCycleHistory,

        // Actions
        processSquatJumpFrame, resetSquatJump,

        // UI helpers
        phaseLabel, phaseColor,

        // Config
        config: cfg,
    };
}
