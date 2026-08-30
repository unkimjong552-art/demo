/**
 * useSitAndReachDetection.js
 *
 * Composable untuk mendeteksi gerakan Sit and Reach menggunakan landmark
 * MediaPipe Pose.
 *
 * Assessment ini adalah SINGLE MEASUREMENT — bukan repetisi maupun durasi.
 * Mengukur jarak reach terbaik (wrist → foot index) selama sesi.
 *
 * Algoritma:
 *   1. Validasi posisi duduk: hip harus lebih rendah dari bahu (Y lebih besar)
 *   2. Validasi kaki relatif lurus: knee angle besar (hip→knee→ankle)
 *   3. Hitung jarak wrist → foot index (normalized)
 *   4. Track best reach (jarak terkecil = reach terjauh)
 *   5. Konversi ke estimasi cm menggunakan faktor kalibrasi
 *
 * PERINGATAN PENTING tentang konversi cm:
 *   Koordinat MediaPipe adalah normalized (0.0–1.0), bukan satuan fisik.
 *   Konversi ke cm menggunakan CM_PER_NORMALIZED_UNIT adalah ESTIMASI KASAR.
 *   Nilai cm yang ditampilkan BUKAN pengukuran akurat — hanya indikasi relatif.
 *   Kalibrasi per-user (berdasarkan tinggi badan) diperlukan untuk hasil akurat.
 *
 * State Machine:
 *   WAITING   — landmark tidak cukup / pose belum valid
 *   READY     — pose valid (duduk, kaki lurus), siap reach
 *   REACHING  — wrist bergerak mendekati foot, tracking aktif
 *   BEST_REACH— reach terbaik tercapai dan stabil
 *
 * Landmark yang digunakan:
 *   11/12 = shoulder   23/24 = hip
 *   25/26 = knee       27/28 = ankle
 *   15/16 = wrist      31/32 = foot_index
 *
 * SEMUA THRESHOLD PROVISIONAL — harus dikalibrasi dengan trainer/client.
 */

import { ref, computed } from 'vue';

// ─────────────────────────────────────────────────────────────────────────────
// DEBUG FLAG
// ─────────────────────────────────────────────────────────────────────────────

export const SITANDREACH_DEBUG = true;

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

export const SITANDREACH_CONFIG = {
    // ── Visibility ───────────────────────────────────────────────────────────

    /** Visibility minimum per landmark (0.0–1.0). */
    MIN_VISIBILITY: 0.5,

    // ── Pose validation ───────────────────────────────────────────────────────

    /**
     * Perbedaan Y minimum antara hip dan shoulder untuk dianggap posisi duduk.
     * Saat duduk: hip.y > shoulder.y (hip lebih bawah, Y lebih besar).
     * Nilai 0.0 = shoulder dan hip sejajar (berdiri miring).
     * Nilai 0.05 = hip minimal 5% lebih rendah dari shoulder.
     *
     * !! PROVISIONAL !!
     */
    SITTING_HIP_SHOULDER_DIFF: 0.0,

    /**
     * Knee angle minimum (hip→knee→ankle) untuk dianggap kaki relatif lurus.
     * Kaki lurus = angle besar (~150–180°).
     * Dari frontal view bisa lebih kecil karena proyeksi 2D.
     *
     * !! PROVISIONAL — frontal view vs lateral view sangat berbeda !!
     */
    LEG_STRAIGHT_ANGLE_MIN: 140,

    // ── Reach detection ───────────────────────────────────────────────────────

    /**
     * Jarak normalized maksimum antara wrist dan foot index untuk dianggap
     * sedang reaching. Lebih kecil = lebih dekat ke kaki.
     * 1.0 = seluruh lebar frame — threshold awal yang longgar.
     *
     * !! PROVISIONAL !!
     */
    REACH_ACTIVE_THRESHOLD: 0.6,

    /**
     * Jumlah frame berturut-turut yang dibutuhkan untuk mengkonfirmasi
     * best reach (agar noise tidak menjadi best reach).
     *
     * !! PROVISIONAL !!
     */
    BEST_REACH_STABLE_FRAMES: 3,

    // ── CM conversion ─────────────────────────────────────────────────────────

    /**
     * Faktor konversi dari jarak normalized ke estimasi cm.
     * Ini BUKAN nilai akurat — hanya estimasi kasar untuk demo.
     *
     * Asumsi: frame kira-kira setinggi 170cm seseorang.
     * Jarak normalized 1.0 ≈ tinggi seluruh frame ≈ ~170cm.
     * Jadi 1 unit normalized ≈ 170cm.
     *
     * PERINGATAN: Nilai ini sangat bergantung pada jarak kamera, sudut,
     * dan tinggi badan user. Harus dikalibrasi per-setup.
     *
     * !! PROVISIONAL — jangan dianggap akurat !!
     */
    CM_PER_NORMALIZED_UNIT: 170,

    /**
     * Offset cm yang ditambahkan ke hasil.
     * Misalnya: jika reach melewati foot → nilai positif.
     * Bisa disesuaikan untuk kalibrasi kasar.
     *
     * !! PROVISIONAL !!
     */
    REACH_CM_OFFSET: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const SITANDREACH_PHASE = {
    WAITING:    'WAITING',    // landmark tidak cukup / pose belum valid
    READY:      'READY',      // duduk, kaki lurus, siap reach
    REACHING:   'REACHING',   // wrist mendekati foot, tracking aktif
    BEST_REACH: 'BEST_REACH', // best reach terkonfirmasi stabil
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

function distance2D(a, b) {
    if (!a || !b) return 999;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function isLandmarkValid(lm, minVis) {
    return lm != null &&
           typeof lm.x === 'number' &&
           typeof lm.y === 'number' &&
           (lm.visibility ?? 0) >= minVis;
}

// ─────────────────────────────────────────────────────────────────────────────
// DIAGNOSTIC LANDMARKS
// ─────────────────────────────────────────────────────────────────────────────

const SITANDREACH_DIAGNOSTIC_LANDMARKS = [
    { name: 'L. Shoulder', index: 11 },
    { name: 'R. Shoulder', index: 12 },
    { name: 'L. Wrist',    index: 15 },
    { name: 'R. Wrist',    index: 16 },
    { name: 'L. Hip',      index: 23 },
    { name: 'R. Hip',      index: 24 },
    { name: 'L. Knee',     index: 25 },
    { name: 'R. Knee',     index: 26 },
    { name: 'L. Ankle',    index: 27 },
    { name: 'R. Ankle',    index: 28 },
    { name: 'L. Foot',     index: 31 },
    { name: 'R. Foot',     index: 32 },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSABLE
// ─────────────────────────────────────────────────────────────────────────────

export function useSitAndReachDetection(config = {}) {
    const cfg = { ...SITANDREACH_CONFIG, ...config };

    // ── Reactive state ────────────────────────────────────────────────────────
    const currentPhase      = ref(SITANDREACH_PHASE.WAITING);
    const reachDistance     = ref(999);   // jarak wrist→foot saat ini (normalized)
    const bestReachDistance = ref(999);   // jarak terbaik sesi ini (normalized, terkecil)
    const reachCm           = ref(0);     // estimasi cm dari jarak saat ini
    const bestReachCm       = ref(0);     // estimasi cm dari best reach
    const countingSide      = ref('—');   // 'LEFT' | 'RIGHT' | 'BOTH' | '—'
    const feedback          = ref('');
    const isReaching        = ref(false);
    const sittingValid      = ref(false);
    const legStraightValid  = ref(false);

    // ── Debug / FPS ───────────────────────────────────────────────────────────
    const debugFps           = ref(0);
    const debugFrameCount    = ref(0);
    const debugLastFrameTime = ref(0);
    const FPS_SAMPLE_SIZE    = 10;
    const fpsBuffer          = [];

    // ── Debug: per-landmark visibility ────────────────────────────────────────
    const debugLandmarkReport = ref([]);

    // ── Debug: reach detail per-frame ─────────────────────────────────────────
    const debugReachDetail = ref({
        leftReachDist:    999,
        rightReachDist:   999,
        leftKneeAngle:    0,
        rightKneeAngle:   0,
        leftHipY:         0,
        leftShoulderY:    0,
        rightHipY:        0,
        rightShoulderY:   0,
        hipShoulderDiff:  0,   // hip.y - shoulder.y (positif = duduk)
        sittingValid:     false,
        legStraightValid: false,
        reachActive:      false,
        leftWristVis:     0,
        rightWristVis:    0,
        leftFootVis:      0,
        rightFootVis:     0,
    });

    // ── Debug: counting pipeline per-frame ────────────────────────────────────
    const debugCountingPipeline = ref({
        validationReady:  false,
        sittingValid:     false,
        legStraightValid: false,
        reachDist:        999,
        reachActive:      false,
        stableFrames:     0,
        bestReachUpdated: false,
        blockReason:      '—',
    });

    // ── Debug: cumulative counters ────────────────────────────────────────────
    const debugPipelineCumulative = ref({
        validationReadyFrames:  0,
        sittingValidFrames:     0,
        reachingFrames:         0,
        bestReachUpdatedCount:  0,
        landmarkBlockedCount:   0,
        validationBlockedCount: 0,
        lastBlockReason:        '—',
    });
    let _cumul = {
        validationReadyFrames:  0,
        sittingValidFrames:     0,
        reachingFrames:         0,
        bestReachUpdatedCount:  0,
        landmarkBlockedCount:   0,
        validationBlockedCount: 0,
        lastBlockReason:        '—',
    };

    // ── Debug: state machine diagnostics ─────────────────────────────────────
    const debugStateMachine = ref({
        prevPhase:              SITANDREACH_PHASE.WAITING,
        minReachSeen:           999,
        maxReachSeen:           0,
        reachingEverStarted:    false,
        bestReachEverRecorded:  false,
        blockedByValidation:    0,
        blockedByLandmark:      0,
        blockedBySitting:       0,
        blockedByLegStraight:   0,
        lastBlockReason:        '—',
        validationDropCount:    0,
    });
    let _sm = {
        prevPhase:              SITANDREACH_PHASE.WAITING,
        minReachSeen:           999,
        maxReachSeen:           0,
        reachingEverStarted:    false,
        bestReachEverRecorded:  false,
        blockedByValidation:    0,
        blockedByLandmark:      0,
        blockedBySitting:       0,
        blockedByLegStraight:   0,
        lastBlockReason:        '—',
        validationDropCount:    0,
        lastValidationStatus:   'READY',
    };

    // ── Debug: frame history (rolling 25) ─────────────────────────────────────
    const DEBUG_HISTORY_SIZE = 25;
    const debugFrameHistory  = ref([]);

    // ── Debug: best reach history ──────────────────────────────────────────────
    const DEBUG_BEST_HISTORY_SIZE = 10;
    const debugBestReachHistory   = ref([]);

    // ── Non-reactive: best reach tracking ────────────────────────────────────
    let _bestReachNorm       = 999;   // normalized, terkecil = terbaik
    let _stableFrames        = 0;     // counter frame stabil di reach terbaik
    let _stableBestCandidate = 999;   // kandidat best reach yang sedang diakumulasi
    let _sessionStartTime    = 0;     // performance.now() saat resetSitAndReach dipanggil

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

    // ── Utility: konversi normalized distance ke cm (estimasi kasar) ─────────
    function normToCm(normDist) {
        // Jarak wrist → foot: semakin kecil = semakin jauh reach
        // cm positif = reach melewati kaki
        // cm negatif = belum mencapai kaki
        const raw = (cfg.REACH_ACTIVE_THRESHOLD - normDist) * cfg.CM_PER_NORMALIZED_UNIT;
        return parseFloat((raw + cfg.REACH_CM_OFFSET).toFixed(1));
    }

    // ── Debug: per-landmark report ────────────────────────────────────────────
    function updateDebugDiagnostics(landmarks) {
        if (!SITANDREACH_DEBUG) return;
        const minVis = cfg.MIN_VISIBILITY;
        debugLandmarkReport.value = SITANDREACH_DIAGNOSTIC_LANDMARKS.map(({ name, index }) => {
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
    function updateStateMachineDiagnostics({ validationStatus, currentReach, phaseBefore, landmarkAvailable, sitOk, legOk }) {
        if (!SITANDREACH_DEBUG) return;

        if (_sm.lastValidationStatus === 'READY' && validationStatus !== 'READY') _sm.validationDropCount++;
        _sm.lastValidationStatus = validationStatus;

        if (validationStatus !== 'READY') {
            _sm.blockedByValidation++;
            _sm.lastBlockReason = `Validation bukan READY (${validationStatus})`;
        } else if (!landmarkAvailable) {
            _sm.blockedByLandmark++;
            _sm.lastBlockReason = 'Landmark tidak cukup';
        } else if (!sitOk) {
            _sm.blockedBySitting++;
            _sm.lastBlockReason = 'Pose bukan duduk';
        } else if (!legOk) {
            _sm.blockedByLegStraight++;
            _sm.lastBlockReason = 'Kaki tidak cukup lurus';
        }

        if (currentReach < 999) {
            if (currentReach < _sm.minReachSeen) _sm.minReachSeen = currentReach;
            if (currentReach > _sm.maxReachSeen && currentReach < 999) _sm.maxReachSeen = currentReach;
        }
        if (currentPhase.value === SITANDREACH_PHASE.REACHING) _sm.reachingEverStarted = true;
        if (currentPhase.value === SITANDREACH_PHASE.BEST_REACH) _sm.bestReachEverRecorded = true;
        if (currentPhase.value !== phaseBefore) _sm.prevPhase = phaseBefore;

        debugStateMachine.value = {
            prevPhase:             _sm.prevPhase,
            minReachSeen:          _sm.minReachSeen === 999 ? '—' : parseFloat(_sm.minReachSeen.toFixed(3)),
            maxReachSeen:          _sm.maxReachSeen === 0   ? '—' : parseFloat(_sm.maxReachSeen.toFixed(3)),
            reachingEverStarted:   _sm.reachingEverStarted,
            bestReachEverRecorded: _sm.bestReachEverRecorded,
            blockedByValidation:   _sm.blockedByValidation,
            blockedByLandmark:     _sm.blockedByLandmark,
            blockedBySitting:      _sm.blockedBySitting,
            blockedByLegStraight:  _sm.blockedByLegStraight,
            lastBlockReason:       _sm.lastBlockReason,
            validationDropCount:   _sm.validationDropCount,
        };
    }

    // ── Debug: frame history ──────────────────────────────────────────────────
    function pushFrameHistory(validationStatus, reachDist, sitOk, legOk) {
        if (!SITANDREACH_DEBUG) return;
        // Waktu relatif dari awal sesi (bukan performance.now() absolut)
        const relSec = _sessionStartTime > 0
            ? Math.round((performance.now() - _sessionStartTime) / 100) / 10
            : 0;
        const entry = {
            ts:      relSec,
            fps:     debugFps.value,
            valid:   validationStatus,
            reach:   reachDist < 999 ? parseFloat(reachDist.toFixed(3)) : '—',
            sit:     sitOk,
            leg:     legOk,
            phase:   currentPhase.value,
            bestCm:  bestReachCm.value,
        };
        const h = debugFrameHistory.value;
        debugFrameHistory.value = h.length >= DEBUG_HISTORY_SIZE
            ? [...h.slice(1), entry]
            : [...h, entry];
    }

    // ── Debug: best reach event ───────────────────────────────────────────────
    function pushBestReachEvent(normDist, cmVal, side) {
        if (!SITANDREACH_DEBUG) return;
        // Waktu relatif dari awal sesi
        const relSec = _sessionStartTime > 0
            ? Math.round((performance.now() - _sessionStartTime) / 100) / 10
            : 0;
        const entry = {
            ts:       relSec,
            normDist: parseFloat(normDist.toFixed(3)),
            cmEst:    cmVal,
            side,
        };
        const hist = debugBestReachHistory.value;
        debugBestReachHistory.value = hist.length >= DEBUG_BEST_HISTORY_SIZE
            ? [...hist.slice(1), entry]
            : [...hist, entry];
    }

    // ── Landmark extraction ───────────────────────────────────────────────────

    function extractLandmarks(landmarks) {
        if (!landmarks || landmarks.length < 33) return null;
        const lm     = (idx) => landmarks[idx];
        const minVis = cfg.MIN_VISIBILITY;

        const leftShoulder  = lm(11);
        const rightShoulder = lm(12);
        const leftWrist     = lm(15);
        const rightWrist    = lm(16);
        const leftHip       = lm(23);
        const rightHip      = lm(24);
        const leftKnee      = lm(25);
        const rightKnee     = lm(26);
        const leftAnkle     = lm(27);
        const rightAnkle    = lm(28);
        const leftFoot      = lm(31);
        const rightFoot     = lm(32);

        // Sisi valid untuk pose validation (shoulder + hip + knee wajib)
        const leftPoseOk = (
            isLandmarkValid(leftShoulder, minVis) &&
            isLandmarkValid(leftHip,      minVis) &&
            isLandmarkValid(leftKnee,     minVis)
        );
        const rightPoseOk = (
            isLandmarkValid(rightShoulder, minVis) &&
            isLandmarkValid(rightHip,      minVis) &&
            isLandmarkValid(rightKnee,     minVis)
        );

        if (!leftPoseOk && !rightPoseOk) return null;

        // Sisi valid untuk reach measurement (wrist + foot)
        const leftReachOk  = isLandmarkValid(leftWrist, minVis) && isLandmarkValid(leftFoot, minVis);
        const rightReachOk = isLandmarkValid(rightWrist, minVis) && isLandmarkValid(rightFoot, minVis);

        return {
            leftShoulder, rightShoulder,
            leftWrist,    rightWrist,
            leftHip,      rightHip,
            leftKnee,     rightKnee,
            leftAnkle,    rightAnkle,
            leftFoot,     rightFoot,
            leftPoseOk,   rightPoseOk,
            leftReachOk,  rightReachOk,
        };
    }

    /**
     * Validasi pose duduk.
     * Saat duduk: hip.y > shoulder.y (hip lebih bawah di layar).
     * Returns: { sitOk, hipShoulderDiff }
     */
    function validateSittingPose(lms) {
        const samples = [];

        if (lms.leftPoseOk) {
            const diff = (lms.leftHip?.y ?? 0) - (lms.leftShoulder?.y ?? 0);
            samples.push(diff);
        }
        if (lms.rightPoseOk) {
            const diff = (lms.rightHip?.y ?? 0) - (lms.rightShoulder?.y ?? 0);
            samples.push(diff);
        }

        if (samples.length === 0) return { sitOk: false, hipShoulderDiff: 0 };

        const avgDiff = samples.reduce((a, b) => a + b, 0) / samples.length;
        const sitOk   = avgDiff >= cfg.SITTING_HIP_SHOULDER_DIFF;

        return { sitOk, hipShoulderDiff: parseFloat(avgDiff.toFixed(3)) };
    }

    /**
     * Validasi kaki relatif lurus.
     * knee angle (hip→knee→ankle) harus ≥ LEG_STRAIGHT_ANGLE_MIN.
     * Returns: { legOk, leftKneeAngle, rightKneeAngle }
     */
    function validateLegStraight(lms) {
        let leftKneeAngle  = 0;
        let rightKneeAngle = 0;
        const angles       = [];

        if (lms.leftPoseOk && isLandmarkValid(lms.leftAnkle, cfg.MIN_VISIBILITY)) {
            leftKneeAngle = calculateAngle(lms.leftHip, lms.leftKnee, lms.leftAnkle);
            if (leftKneeAngle > 0) angles.push(leftKneeAngle);
        }
        if (lms.rightPoseOk && isLandmarkValid(lms.rightAnkle, cfg.MIN_VISIBILITY)) {
            rightKneeAngle = calculateAngle(lms.rightHip, lms.rightKnee, lms.rightAnkle);
            if (rightKneeAngle > 0) angles.push(rightKneeAngle);
        }

        // Setidaknya satu kaki harus cukup lurus
        const legOk = angles.some(a => a >= cfg.LEG_STRAIGHT_ANGLE_MIN);

        return { legOk, leftKneeAngle, rightKneeAngle };
    }

    /**
     * Hitung jarak wrist → foot dari sisi yang valid.
     * Returns: { dist, side, leftDist, rightDist }
     * dist = terkecil dari kiri dan kanan (reach terbaik saat ini)
     */
    function computeReachDistance(lms) {
        let leftDist  = 999;
        let rightDist = 999;

        if (lms.leftReachOk) {
            leftDist = parseFloat(distance2D(lms.leftWrist, lms.leftFoot).toFixed(3));
        }
        if (lms.rightReachOk) {
            rightDist = parseFloat(distance2D(lms.rightWrist, lms.rightFoot).toFixed(3));
        }

        let dist = 999;
        let side = '—';

        if (leftDist < 999 && rightDist < 999) {
            dist = Math.min(leftDist, rightDist);
            side = leftDist <= rightDist ? 'LEFT' : 'RIGHT';
        } else if (leftDist < 999) {
            dist = leftDist;
            side = 'LEFT';
        } else if (rightDist < 999) {
            dist = rightDist;
            side = 'RIGHT';
        }

        return { dist, side, leftDist, rightDist };
    }

    /**
     * Fungsi utama — dipanggil setiap frame dari onPoseUpdate.
     */
    function processSitAndReachFrame({ landmarks, validationStatus } = {}) {
        updateFps();
        const phaseBefore = currentPhase.value;

        // ── Guard: pose belum READY ───────────────────────────────────────────
        if (validationStatus !== 'READY') {
            feedback.value         = 'Tunggu posisi tubuh valid terlebih dahulu';
            isReaching.value       = false;
            sittingValid.value     = false;
            legStraightValid.value = false;
            currentPhase.value     = SITANDREACH_PHASE.WAITING;
            // Reset transient reach state — jangan biarkan kandidat stale
            _stableFrames          = 0;
            _stableBestCandidate   = 999;

            if (SITANDREACH_DEBUG) {
                _cumul.validationBlockedCount++;
                _cumul.lastBlockReason = `Validation: ${validationStatus}`;
                debugCountingPipeline.value = {
                    ...debugCountingPipeline.value,
                    validationReady: false,
                    blockReason: `Validation tidak READY: ${validationStatus}`,
                };
                updateDebugDiagnostics(landmarks);
                updateStateMachineDiagnostics({ validationStatus, currentReach: 999, phaseBefore, landmarkAvailable: false, sitOk: false, legOk: false });
                pushFrameHistory(validationStatus, 999, false, false);
                debugPipelineCumulative.value = { ..._cumul };
            }
            return;
        }

        // ── Ekstrak landmark ──────────────────────────────────────────────────
        const lms = extractLandmarks(landmarks);
        if (SITANDREACH_DEBUG) updateDebugDiagnostics(landmarks);

        if (!lms) {
            feedback.value     = 'Pastikan seluruh tubuh terlihat kamera';
            isReaching.value   = false;
            currentPhase.value = SITANDREACH_PHASE.WAITING;
            _stableFrames      = 0;

            if (SITANDREACH_DEBUG) {
                _cumul.landmarkBlockedCount++;
                _cumul.lastBlockReason = 'Landmark tidak cukup';
                debugCountingPipeline.value = {
                    ...debugCountingPipeline.value,
                    validationReady: true,
                    blockReason: 'Landmark tidak cukup',
                };
                updateStateMachineDiagnostics({ validationStatus, currentReach: 999, phaseBefore, landmarkAvailable: false, sitOk: false, legOk: false });
                pushFrameHistory(validationStatus, 999, false, false);
                debugPipelineCumulative.value = { ..._cumul };
            }
            return;
        }

        // ── Validasi pose duduk ───────────────────────────────────────────────
        const { sitOk, hipShoulderDiff } = validateSittingPose(lms);
        const { legOk, leftKneeAngle, rightKneeAngle } = validateLegStraight(lms);

        sittingValid.value    = sitOk;
        legStraightValid.value = legOk;

        if (!sitOk) {
            feedback.value     = 'Duduk dengan kaki lurus ke depan';
            currentPhase.value = SITANDREACH_PHASE.WAITING;
            isReaching.value   = false;
            _stableFrames      = 0;

            if (SITANDREACH_DEBUG) {
                _cumul.lastBlockReason = 'Pose bukan duduk';
                debugCountingPipeline.value = {
                    validationReady: true, sittingValid: false, legStraightValid: legOk,
                    reachDist: 999, reachActive: false, stableFrames: 0,
                    bestReachUpdated: false, blockReason: 'Pose bukan duduk',
                };
                updateStateMachineDiagnostics({ validationStatus, currentReach: 999, phaseBefore, landmarkAvailable: true, sitOk: false, legOk });
                pushFrameHistory(validationStatus, 999, false, legOk);
                debugPipelineCumulative.value = { ..._cumul };
            }
            return;
        }

        if (!legOk) {
            feedback.value     = 'Luruskan kaki ke depan';
            currentPhase.value = SITANDREACH_PHASE.WAITING;
            isReaching.value   = false;
            _stableFrames      = 0;

            if (SITANDREACH_DEBUG) {
                _cumul.lastBlockReason = `Kaki tidak lurus (knee: L${leftKneeAngle}° R${rightKneeAngle}° < ${cfg.LEG_STRAIGHT_ANGLE_MIN}°)`;
                debugCountingPipeline.value = {
                    validationReady: true, sittingValid: true, legStraightValid: false,
                    reachDist: 999, reachActive: false, stableFrames: 0,
                    bestReachUpdated: false, blockReason: `Knee L${leftKneeAngle}°/R${rightKneeAngle}° < ${cfg.LEG_STRAIGHT_ANGLE_MIN}°`,
                };
                updateStateMachineDiagnostics({ validationStatus, currentReach: 999, phaseBefore, landmarkAvailable: true, sitOk: true, legOk: false });
                pushFrameHistory(validationStatus, 999, true, false);
                debugPipelineCumulative.value = { ..._cumul };
            }
            return;
        }

        // ── Pose duduk dan kaki lurus — masuk READY ───────────────────────────
        if (currentPhase.value === SITANDREACH_PHASE.WAITING) {
            currentPhase.value = SITANDREACH_PHASE.READY;
        }

        // ── Hitung reach distance ─────────────────────────────────────────────
        const { dist: currentDist, side, leftDist, rightDist } = computeReachDistance(lms);
        reachDistance.value = currentDist < 999 ? parseFloat(currentDist.toFixed(3)) : 999;
        countingSide.value  = side;

        if (currentDist < 999) {
            reachCm.value = normToCm(currentDist);
        }

        // ── Update reach detail diagnostic ────────────────────────────────────
        if (SITANDREACH_DEBUG) {
            _cumul.sittingValidFrames++;
            debugReachDetail.value = {
                leftReachDist:    leftDist  < 999 ? parseFloat(leftDist.toFixed(3))  : 999,
                rightReachDist:   rightDist < 999 ? parseFloat(rightDist.toFixed(3)) : 999,
                leftKneeAngle,
                rightKneeAngle,
                leftHipY:         parseFloat((lms.leftHip?.y  ?? 0).toFixed(3)),
                leftShoulderY:    parseFloat((lms.leftShoulder?.y  ?? 0).toFixed(3)),
                rightHipY:        parseFloat((lms.rightHip?.y ?? 0).toFixed(3)),
                rightShoulderY:   parseFloat((lms.rightShoulder?.y ?? 0).toFixed(3)),
                hipShoulderDiff,
                sittingValid:     sitOk,
                legStraightValid: legOk,
                reachActive:      currentDist < cfg.REACH_ACTIVE_THRESHOLD,
                leftWristVis:     lms.leftWrist  ? Math.round((lms.leftWrist.visibility  ?? 0) * 100) : 0,
                rightWristVis:    lms.rightWrist ? Math.round((lms.rightWrist.visibility ?? 0) * 100) : 0,
                leftFootVis:      lms.leftFoot   ? Math.round((lms.leftFoot.visibility   ?? 0) * 100) : 0,
                rightFootVis:     lms.rightFoot  ? Math.round((lms.rightFoot.visibility  ?? 0) * 100) : 0,
            };
        }

        // ── Deteksi dan track reach ───────────────────────────────────────────
        const reachActive = currentDist < cfg.REACH_ACTIVE_THRESHOLD;
        let bestReachUpdated = false;

        if (reachActive && currentDist < 999) {
            isReaching.value = true;
            currentPhase.value = SITANDREACH_PHASE.REACHING;

            // Track best reach dengan stabilization
            if (currentDist < _stableBestCandidate) {
                _stableBestCandidate = currentDist;
                _stableFrames        = 1;
            } else if (currentDist <= _stableBestCandidate + 0.01) {
                // Dalam range ±0.01 dari kandidat terbaik → akumulasi
                _stableFrames++;
            } else {
                // Reach memburuk (wrist menjauh) → reset kandidat
                _stableBestCandidate = currentDist;
                _stableFrames        = 1;
            }

            // Konfirmasi best reach setelah cukup frame stabil
            if (_stableFrames >= cfg.BEST_REACH_STABLE_FRAMES && _stableBestCandidate < _bestReachNorm) {
                _bestReachNorm          = _stableBestCandidate;
                bestReachDistance.value = parseFloat(_bestReachNorm.toFixed(3));
                bestReachCm.value       = normToCm(_bestReachNorm);
                currentPhase.value      = SITANDREACH_PHASE.BEST_REACH;
                bestReachUpdated        = true;
                feedback.value          = `Best reach: ${bestReachCm.value > 0 ? '+' : ''}${bestReachCm.value} cm (est.)`;

                if (SITANDREACH_DEBUG) {
                    _cumul.bestReachUpdatedCount++;
                    pushBestReachEvent(_bestReachNorm, bestReachCm.value, side);
                }
            } else {
                feedback.value = `Reach: ${reachCm.value > 0 ? '+' : ''}${reachCm.value} cm (est.) — terus dorong!`;
            }
        } else {
            // Tidak dalam range reach aktif
            isReaching.value   = false;
            _stableFrames      = 0;
            _stableBestCandidate = 999;

            if (currentPhase.value === SITANDREACH_PHASE.REACHING || currentPhase.value === SITANDREACH_PHASE.BEST_REACH) {
                // Kembali ke READY — best reach sudah tersimpan
                currentPhase.value = SITANDREACH_PHASE.READY;
            }

            if (_bestReachNorm < 999) {
                feedback.value = `Best: ${bestReachCm.value > 0 ? '+' : ''}${bestReachCm.value} cm — ulang reach untuk perbaiki`;
            } else {
                feedback.value = 'Raih kaki dengan kedua tangan';
            }
        }

        // ── Update debug ──────────────────────────────────────────────────────
        if (SITANDREACH_DEBUG) {
            if (reachActive) _cumul.reachingFrames++;

            debugCountingPipeline.value = {
                validationReady:  true,
                sittingValid:     sitOk,
                legStraightValid: legOk,
                reachDist:        currentDist < 999 ? parseFloat(currentDist.toFixed(3)) : 999,
                reachActive,
                stableFrames:     _stableFrames,
                bestReachUpdated,
                blockReason:      '—',
            };

            if (!reachActive) _cumul.lastBlockReason = `Reach dist ${currentDist < 999 ? currentDist.toFixed(3) : '—'} > threshold ${cfg.REACH_ACTIVE_THRESHOLD}`;
            debugPipelineCumulative.value = { ..._cumul };

            updateStateMachineDiagnostics({ validationStatus, currentReach: currentDist, phaseBefore, landmarkAvailable: true, sitOk, legOk });
            pushFrameHistory(validationStatus, currentDist, sitOk, legOk);
        }
    }

    /**
     * Reset seluruh state Sit and Reach.
     */
    function resetSitAndReach() {
        currentPhase.value       = SITANDREACH_PHASE.WAITING;
        reachDistance.value      = 999;
        bestReachDistance.value  = 999;
        reachCm.value            = 0;
        bestReachCm.value        = 0;
        countingSide.value       = '—';
        feedback.value           = '';
        isReaching.value         = false;
        sittingValid.value       = false;
        legStraightValid.value   = false;

        _bestReachNorm       = 999;
        _stableFrames        = 0;
        _stableBestCandidate = 999;
        _sessionStartTime    = performance.now(); // catat awal sesi untuk timestamp relatif

        fpsBuffer.length         = 0;
        debugFps.value           = 0;
        debugFrameCount.value    = 0;
        debugLastFrameTime.value = 0;

        debugLandmarkReport.value = [];
        debugFrameHistory.value   = [];
        debugBestReachHistory.value = [];
        debugReachDetail.value = {
            leftReachDist: 999, rightReachDist: 999,
            leftKneeAngle: 0,   rightKneeAngle: 0,
            leftHipY: 0,   leftShoulderY: 0,
            rightHipY: 0,  rightShoulderY: 0,
            hipShoulderDiff: 0,
            sittingValid: false, legStraightValid: false, reachActive: false,
            leftWristVis: 0, rightWristVis: 0, leftFootVis: 0, rightFootVis: 0,
        };
        debugCountingPipeline.value = {
            validationReady: false, sittingValid: false, legStraightValid: false,
            reachDist: 999, reachActive: false, stableFrames: 0,
            bestReachUpdated: false, blockReason: '—',
        };
        debugPipelineCumulative.value = {
            validationReadyFrames: 0, sittingValidFrames: 0, reachingFrames: 0,
            bestReachUpdatedCount: 0, landmarkBlockedCount: 0,
            validationBlockedCount: 0, lastBlockReason: '—',
        };
        debugStateMachine.value = {
            prevPhase: SITANDREACH_PHASE.WAITING, minReachSeen: '—', maxReachSeen: '—',
            reachingEverStarted: false, bestReachEverRecorded: false,
            blockedByValidation: 0, blockedByLandmark: 0,
            blockedBySitting: 0, blockedByLegStraight: 0,
            lastBlockReason: '—', validationDropCount: 0,
        };
        _sm = {
            prevPhase: SITANDREACH_PHASE.WAITING, minReachSeen: 999, maxReachSeen: 0,
            reachingEverStarted: false, bestReachEverRecorded: false,
            blockedByValidation: 0, blockedByLandmark: 0,
            blockedBySitting: 0, blockedByLegStraight: 0,
            lastBlockReason: '—', validationDropCount: 0, lastValidationStatus: 'READY',
        };
        _cumul = {
            validationReadyFrames: 0, sittingValidFrames: 0, reachingFrames: 0,
            bestReachUpdatedCount: 0, landmarkBlockedCount: 0,
            validationBlockedCount: 0, lastBlockReason: '—',
        };
    }

    // ── Computed UI helpers ───────────────────────────────────────────────────

    const phaseLabel = computed(() => ({
        [SITANDREACH_PHASE.WAITING]:    'WAITING',
        [SITANDREACH_PHASE.READY]:      'READY',
        [SITANDREACH_PHASE.REACHING]:   'REACHING →',
        [SITANDREACH_PHASE.BEST_REACH]: 'BEST REACH ★',
    }[currentPhase.value] ?? '—'));

    const phaseColor = computed(() => ({
        [SITANDREACH_PHASE.WAITING]:    'text-slate-500',
        [SITANDREACH_PHASE.READY]:      'text-slate-400',
        [SITANDREACH_PHASE.REACHING]:   'text-orange-400',
        [SITANDREACH_PHASE.BEST_REACH]: 'text-emerald-400',
    }[currentPhase.value] ?? 'text-slate-500'));

    const bestReachLabel = computed(() => {
        if (bestReachCm.value === 0 && _bestReachNorm >= 999) return '— cm (belum ada reach)';
        const sign = bestReachCm.value >= 0 ? '+' : '';
        return `${sign}${bestReachCm.value} cm (est. PROVISIONAL)`;
    });

    return {
        // State
        currentPhase, reachDistance, bestReachDistance,
        reachCm, bestReachCm, countingSide, feedback,
        isReaching, sittingValid, legStraightValid,

        // Debug
        debugFps, debugFrameCount, debugLandmarkReport,
        debugReachDetail, debugCountingPipeline,
        debugPipelineCumulative, debugStateMachine,
        debugFrameHistory, debugBestReachHistory,

        // Actions
        processSitAndReachFrame, resetSitAndReach,

        // UI helpers
        phaseLabel, phaseColor, bestReachLabel,

        // Config
        config: cfg,
    };
}
