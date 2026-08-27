/**
 * usePushUpDetection.js
 *
 * Composable untuk mendeteksi dan menghitung repetisi Push-Up secara realtime
 * menggunakan landmark MediaPipe Pose.
 *
 * Algoritma:
 *   1. Hitung sudut siku kiri dan kanan (shoulder→elbow→wrist)
 *   2. Hitung sudut alignment tubuh (shoulder→hip→ankle)
 *   3. State machine: READY → DOWN → UP → count++ → kembali ke READY
 *   4. Stabilisasi BERBASIS WAKTU (ms), bukan frame count, agar konsisten di semua FPS
 *   5. Repetisi hanya dihitung jika form valid dan pose validation === READY
 *
 * Stabilisasi berbasis waktu:
 *   Frame-count stabilization tidak reliable karena MediaPipe berjalan async.
 *   FPS aktual tergantung inference time (~15–30 fps di hardware berbeda).
 *   Time-based stabilization (ms) menghasilkan perilaku identik di semua device.
 *
 * Landmark MediaPipe yang digunakan:
 *   11 = left_shoulder    12 = right_shoulder
 *   13 = left_elbow       14 = right_elbow
 *   15 = left_wrist       16 = right_wrist
 *   23 = left_hip         24 = right_hip
 *   27 = left_ankle       28 = right_ankle
 */

import { ref, computed } from 'vue';

// ─────────────────────────────────────────────────────────────────────────────
// DEBUG FLAG
// Set PUSHUP_DEBUG = true untuk menampilkan panel debug di UI.
// Set false untuk production / saat tidak dibutuhkan.
// ─────────────────────────────────────────────────────────────────────────────

export const PUSHUP_DEBUG = true;

// ─────────────────────────────────────────────────────────────────────────────
// PUSHUP CONFIG
// Semua threshold dikumpulkan di sini — ubah di satu tempat untuk kalibrasi.
// ─────────────────────────────────────────────────────────────────────────────

export const PUSHUP_CONFIG = {
    // ── Angle thresholds ────────────────────────────────────────────────────

    /**
     * Sudut siku maksimum (derajat) untuk dianggap posisi DOWN (bawah).
     * Ketika siku menekuk ≤ nilai ini → mulai akumulasi DOWN.
     * Nilai ~90°: lengan atas sejajar lantai. Range realistis: 70–100°.
     * KALIBRASI FRONTAL VIEW: Dari frontal view sudut siku terlihat lebih besar
     * daripada lateral view — elbow min yang terukur dari video frontal = 88°,
     * dinaikkan ke 100° agar zona DOWN lebih mudah dicapai dari frontal angle.
     */
    DOWN_ELBOW_ANGLE: 100,

    /**
     * Sudut siku minimum (derajat) untuk dianggap posisi UP (ekstensi penuh).
     * Ketika siku ≥ nilai ini → mulai akumulasi UP.
     * Nilai ~160°: lengan hampir lurus. Range realistis: 150–170°.
     */
    UP_ELBOW_ANGLE: 160,

    /**
     * Sudut alignment tubuh minimum (derajat) — shoulder→hip→ankle.
     * Di bawah nilai ini → tubuh terlalu menekuk (bokong naik).
     * KALIBRASI FRONTAL VIEW: Dari frontal view, shoulder→hip→ankle diukur
     * secara proyeksi 2D sehingga hasilnya lebih kecil dari sudut nyata.
     * Data runtime frontal view menunjukkan body angle 148–155° saat posisi
     * push up yang benar → threshold diturunkan ke 140° untuk frontal view.
     */
    MIN_BODY_ALIGNMENT_ANGLE: 140,

    /**
     * Sudut alignment tubuh maksimum.
     * Di atas 200° praktis tidak pernah terjadi → tidak ada batas atas.
     */
    MAX_BODY_ALIGNMENT_ANGLE: 200,

    // ── Time-based stabilization ─────────────────────────────────────────────

    /**
     * Durasi minimum (ms) siku harus berada di zona DOWN sebelum transisi.
     * Mencegah false positive dari noise sesaat.
     * KALIBRASI 13 FPS: Satu frame ≈ 77ms. Nilai 80ms masih terlalu ketat
     * karena timer mencapai 77ms tapi tidak pernah ≥ 80ms dalam 1 frame.
     * Diturunkan ke 50ms — lebih kecil dari 1 frame interval, sehingga
     * 1 frame berturut-turut di zona DOWN sudah cukup untuk konfirmasi.
     */
    DOWN_STABLE_DURATION_MS: 50,

    /**
     * Durasi minimum (ms) siku harus berada di zona UP sebelum transisi.
     * KALIBRASI 13 FPS: Sama seperti DOWN — diturunkan ke 50ms.
     */
    UP_STABLE_DURATION_MS: 50,

    /**
     * Durasi maksimum (ms) landmark boleh hilang sebelum state machine direset.
     * Jika landmark hilang > nilai ini di fase DOWN → rep dibatalkan.
     * 500ms = toleransi oklusi wajar (misalnya tangan terhalang sesaat).
     */
    LANDMARK_LOST_TIMEOUT_MS: 500,

    // ── Visibility & landmark ────────────────────────────────────────────────

    /**
     * Visibility minimum per landmark (0.0–1.0).
     * Landmark dengan visibility di bawah ini tidak dipercaya.
     */
    MIN_VISIBILITY: 0.5,

    /**
     * Jumlah sisi (kiri/kanan) minimum yang harus punya landmark valid.
     * 1 = toleran (satu sisi cukup) — cocok untuk frontal view.
     * 2 = ketat (kedua sisi harus valid) — cocok untuk lateral view.
     * REKOMENDASI AWAL: 1 (toleran) sampai ada data kalibrasi nyata.
     */
    MIN_VALID_SIDES: 1,
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const PUSHUP_PHASE = {
    READY: 'READY',  // posisi awal, menunggu gerakan turun
    DOWN:  'DOWN',   // siku sudah di bawah threshold, menunggu naik
    UP:    'UP',     // siku kembali ke atas threshold → rep dihitung
};

// ─────────────────────────────────────────────────────────────────────────────
// FORM STATUS CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const PUSHUP_FORM = {
    GOOD_FORM:       'GOOD_FORM',
    BAD_FORM:        'BAD_FORM',        // tubuh tidak lurus
    ADJUST_POSITION: 'ADJUST_POSITION', // lengan belum lurus di posisi READY
    NO_DATA:         'NO_DATA',         // landmark tidak cukup / belum READY
};

// ─────────────────────────────────────────────────────────────────────────────
// MATH UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hitung sudut (derajat) di titik B dari tiga titik A–B–C.
 * Menggunakan dot product dari vektor BA dan BC.
 *
 * Guard:
 * - Mengembalikan 0 jika titik-titik berimpit (magBA atau magBC === 0)
 * - Clamp cosAngle ke [-1, 1] agar Math.acos tidak menghasilkan NaN
 *
 * @param {{ x: number, y: number }} a — titik awal
 * @param {{ x: number, y: number }} b — titik sudut (vertex)
 * @param {{ x: number, y: number }} c — titik akhir
 * @returns {number} sudut dalam derajat (0–180), atau 0 jika tidak bisa dihitung
 */
function calculateAngle(a, b, c) {
    // Guard: null/undefined
    if (!a || !b || !c) return 0;

    const BAx = a.x - b.x;
    const BAy = a.y - b.y;
    const BCx = c.x - b.x;
    const BCy = c.y - b.y;

    const magBA = Math.sqrt(BAx * BAx + BAy * BAy);
    const magBC = Math.sqrt(BCx * BCx + BCy * BCy);

    // Guard: titik terlalu dekat (jarak < 0.001 dalam koordinat normalized)
    // Ini bisa terjadi saat landmark overlap di kamera
    if (magBA < 0.001 || magBC < 0.001) return 0;

    const dot      = BAx * BCx + BAy * BCy;
    // Clamp ke [-1, 1] untuk mencegah domain error pada Math.acos
    const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
    const angle    = Math.acos(cosAngle) * (180 / Math.PI);

    // Guard: NaN (tidak seharusnya terjadi setelah clamp, tapi defensive)
    if (isNaN(angle)) return 0;

    return Math.round(angle);
}

/**
 * Cek apakah landmark valid (ada dan visibility cukup).
 *
 * @param {Object|undefined} lm — landmark dari array MediaPipe
 * @param {number} minVisibility — threshold visibility
 * @returns {boolean}
 */
function isLandmarkValid(lm, minVisibility) {
    return lm != null &&
           typeof lm.x === 'number' &&
           typeof lm.y === 'number' &&
           (lm.visibility ?? 0) >= minVisibility;
}

// ─────────────────────────────────────────────────────────────────────────────
// DIAGNOSTIC DEFINITIONS
// Landmark yang dilaporkan di debug panel, dengan nama dan index MediaPipe.
// ─────────────────────────────────────────────────────────────────────────────

const DIAGNOSTIC_LANDMARKS = [
    { name: 'Nose',            index: 0  },
    { name: 'L. Shoulder',     index: 11 },
    { name: 'R. Shoulder',     index: 12 },
    { name: 'L. Elbow',        index: 13 },
    { name: 'R. Elbow',        index: 14 },
    { name: 'L. Wrist',        index: 15 },
    { name: 'R. Wrist',        index: 16 },
    { name: 'L. Hip',          index: 23 },
    { name: 'R. Hip',          index: 24 },
    { name: 'L. Knee',         index: 25 },
    { name: 'R. Knee',         index: 26 },
    { name: 'L. Ankle',        index: 27 },
    { name: 'R. Ankle',        index: 28 },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSABLE
// ─────────────────────────────────────────────────────────────────────────────

export function usePushUpDetection(config = {}) {
    const cfg = { ...PUSHUP_CONFIG, ...config };

    // ── Reactive state (ditampilkan di UI) ────────────────────────────────────
    const repetitionCount = ref(0);
    const currentPhase    = ref(PUSHUP_PHASE.READY);
    const formStatus      = ref(PUSHUP_FORM.NO_DATA);
    const elbowAngle      = ref(0);    // rata-rata sudut siku L+R (derajat)
    const bodyAngle       = ref(0);    // rata-rata alignment tubuh (derajat)
    const feedback        = ref('');
    const isValidRep      = ref(false);

    // ── Debug / FPS state (hanya update jika PUSHUP_DEBUG = true) ────────────
    const debugFps            = ref(0);    // FPS yang terukur dari pose results
    const debugFrameCount     = ref(0);    // total frame diproses sejak start
    const debugLastFrameTime  = ref(0);    // timestamp frame terakhir (ms)

    // ── Debug: per-landmark visibility report ────────────────────────────────
    // Array of { name, index, visibility, status: 'VISIBLE'|'LOW'|'MISSING' }
    // Hanya diupdate saat PUSHUP_DEBUG = true untuk tidak membuang resource
    const debugLandmarkReport = ref([]);

    // ── Debug: counting pipeline state (per-frame snapshot) ─────────────────
    // Menjawab: di mana EXACT tepatnya repetitionCount++ diblokir setiap frame
    const debugCountingPipeline = ref({
        validationReady:  false,
        elbowAngle:       0,
        inDownZone:       false,
        downConfirmed:    false,
        inUpZone:         false,
        upConfirmed:      false,
        repIncremented:   false,
        blockReason:      '—',
        downAccumMs:      0,
        upAccumMs:        0,
    });

    // ── Debug: cumulative pipeline counters ───────────────────────────────────
    // Counter kumulatif sejak sesi dimulai — tidak di-reset setiap frame
    // Menjawab: "pernah" terjadi atau tidak sama sekali
    const debugPipelineCumulative = ref({
        validationReadyFrames: 0,  // total frame di mana validation === READY
        elbowSamples:          0,  // total frame di mana elbow angle > 0
        downZoneFrames:        0,  // total frame di mana elbow <= DOWN threshold
        downTimerStarted:      0,  // berapa kali downStartTime di-set (bukan null)
        downTimerMaxMs:        0,  // nilai tertinggi downAccumMs yang pernah tercapai
        downConfirmedCount:    0,  // berapa kali phase benar-benar masuk DOWN
        upZoneFrames:          0,  // total frame di mana elbow >= UP threshold
        upTimerStarted:        0,  // berapa kali upStartTime di-set
        upTimerMaxMs:          0,  // nilai tertinggi upAccumMs yang pernah tercapai
        upConfirmedCount:      0,  // berapa kali phase masuk UP setelah DOWN
        repIncrementCount:     0,  // berapa kali repetitionCount++ dieksekusi
        lastBlockReason:       '—',
    });
    let _cumul = {
        validationReadyFrames: 0,
        elbowSamples: 0,
        downZoneFrames: 0,
        downTimerStarted: 0,
        downTimerMaxMs: 0,
        downConfirmedCount: 0,
        upZoneFrames: 0,
        upTimerStarted: 0,
        upTimerMaxMs: 0,
        upConfirmedCount: 0,
        repIncrementCount: 0,
        lastBlockReason: '—',
        prevPhaseForCumul: 'READY',  // untuk deteksi transisi phase
    };
    const debugCountingLmReport = ref({
        countingValid:       0,
        countingTotal:       6,   // 2 shoulder + 2 elbow + 2 wrist
        countingMissing:     [],
        optionalMissing:     [],
        blockedByCountingLm: false,
    });

    // ── Debug: counting landmark breakdown ───────────────────────────────────
    // Memisahkan landmark wajib untuk counting vs landmark optional (ankle/knee)
    // Menjelaskan mengapa body angle bisa '—' (= 0)
    const debugBodyAlignmentReport = ref({
        leftBodyValid:  false,
        rightBodyValid: false,
        leftShoulder:   null,
        leftHip:        null,
        leftAnkle:      null,
        rightShoulder:  null,
        rightHip:       null,
        rightAnkle:     null,
        reason:         'Belum ada data',
    });

    // ── Debug: inference time stats ──────────────────────────────────────────
    const debugInferenceStats = ref({
        avgMs:   0,
        minMs:   Infinity,
        maxMs:   0,
        samples: 0,
    });
    // Non-reactive accumulator untuk inference time
    let inferenceAccum = 0;
    let inferenceCount = 0;
    let inferenceMin   = Infinity;
    let inferenceMax   = 0;
    // Timestamp mulai frame saat ini (untuk mengukur inference time)
    let frameStartTime = 0;

    // ── Debug: state machine diagnostics ─────────────────────────────────────
    // Melacak KENAPA transisi DOWN→UP tidak terjadi.
    // Semua counter ini non-reactive di dalam, di-flush ke reactive ref
    // setiap frame agar tidak terlalu sering trigger re-render.
    const debugStateMachine = ref({
        prevPhase:              'READY', // phase sebelum yang sekarang
        minElbowSeen:           999,     // sudut siku terkecil selama sesi
        maxElbowSeen:           0,       // sudut siku terbesar selama sesi
        framesElbowBelowDown:   0,       // frame elbow <= DOWN_ELBOW_ANGLE
        framesElbowAboveUp:     0,       // frame elbow >= UP_ELBOW_ANGLE
        downEverReached:        false,   // apakah fase DOWN pernah tercapai
        upAfterDownReached:     false,   // apakah UP pernah tercapai setelah DOWN
        blockedByValidation:    0,       // berapa kali diblokir validasi != READY
        blockedByLandmark:      0,       // berapa kali diblokir landmark hilang
        blockedByBadForm:       0,       // berapa kali diblokir BAD_FORM
        lastBlockReason:        '—',     // alasan terakhir rep tidak dihitung
        validationDropCount:    0,       // berapa kali validation turun dari READY
    });
    // Non-reactive shadow untuk akumulasi sebelum flush ke ref
    let _sm = {
        prevPhase:            'READY',
        minElbowSeen:         999,
        maxElbowSeen:         0,
        framesElbowBelowDown: 0,
        framesElbowAboveUp:   0,
        downEverReached:      false,
        upAfterDownReached:   false,
        blockedByValidation:  0,
        blockedByLandmark:    0,
        blockedByBadForm:     0,
        lastBlockReason:      '—',
        validationDropCount:  0,
        lastValidationStatus: 'READY', // track untuk mendeteksi drop
    };

    // ── Debug: frame history (rolling 25 sampel terakhir) ────────────────────
    // Setiap entry: { ts, fps, validStatus, elbow, body, phase, form }
    const DEBUG_HISTORY_SIZE = 25;
    const debugFrameHistory  = ref([]); // array of sample objects

    // ── Debug: repetition cycle diagnostics ──────────────────────────────────
    // Mengamati setiap siklus READY/UP→DOWN→UP→counted sebagai observer murni.
    // TIDAK mengubah logic counting — hanya mencatat apa yang terjadi.
    //
    // Cycle state:
    //   IDLE         — sebelum ada gerakan
    //   WAITING_DOWN — phase READY/UP, menunggu elbow turun ke zona DOWN
    //   DOWN_DETECTED — elbow sudah di zona DOWN, menunggu konfirmasi 150ms
    //   DOWN_CONFIRMED — fase DOWN dikonfirmasi (phase === 'DOWN')
    //   WAITING_UP   — di fase DOWN, menunggu elbow naik ke zona UP
    //   UP_DETECTED  — elbow sudah di zona UP, menunggu konfirmasi 150ms
    //   COUNTED      — repetitionCount bertambah
    //   BLOCKED      — siklus gagal karena alasan tertentu

    const REP_CYCLE_RESET_REASONS = {
        VALIDATION_LOST:  'VALIDATION_LOST',
        LANDMARK_LOST:    'LANDMARK_LOST',
        BAD_FORM:         'BAD_FORM',
        DOWN_NOT_REACHED: 'DOWN_NOT_REACHED',
        DOWN_NOT_STABLE:  'DOWN_NOT_STABLE',
        UP_NOT_REACHED:   'UP_NOT_REACHED',
        UP_NOT_STABLE:    'UP_NOT_STABLE',
        UNKNOWN:          'UNKNOWN',
    };

    const debugRepCycle = ref({
        cycleNumber:          0,
        currentCycleState:    'IDLE',
        startedAt:            0,
        upDetected:           false,
        downDetected:         false,   // elbow masuk zona DOWN
        downConfirmed:        false,   // phase benar-benar = DOWN
        upAfterDownDetected:  false,   // elbow masuk zona UP setelah DOWN
        counted:              false,
        resetReason:          '—',
        downDurationMs:       0,
        validationDrops:      0,
        landmarkBlocks:       0,
        badFormBlocks:        0,
    });

    const DEBUG_CYCLE_HISTORY_SIZE = 10;
    const debugRepCycleHistory = ref([]); // array of completed cycle entries

    // Non-reactive shadow untuk akumulasi siklus
    let _cycle = {
        cycleNumber:         0,
        cycleState:          'IDLE',  // IDLE | WAITING_DOWN | DOWN_DETECTED | DOWN_CONFIRMED | WAITING_UP | UP_DETECTED | COUNTED | BLOCKED
        startedAt:           0,
        upDetected:          false,
        downDetected:        false,
        downConfirmed:       false,
        upAfterDownDetected: false,
        counted:             false,
        resetReason:         '—',
        downEnteredAt:       0,      // saat phase DOWN dikonfirmasi
        validationDrops:     0,
        landmarkBlocks:      0,
        badFormBlocks:       0,
        prevRepCount:        0,      // untuk mendeteksi repetitionCount bertambah
        prevPhase:           'READY',
    };

    // ── Time-based stabilization (non-reactive) ───────────────────────────────
    // Menyimpan timestamp performance.now() saat kondisi pertama kali dipenuhi.
    // null = kondisi belum terpenuhi.
    let downStartTime    = null;  // kapan elbow pertama kali masuk zona DOWN
    let upStartTime      = null;  // kapan elbow pertama kali masuk zona UP
    let repBlockedByForm = false; // flag: rep ini dibatalkan karena BAD_FORM
    let landmarkLostTime = null;  // timestamp kapan landmark pertama kali hilang

    // ── FPS measurement ───────────────────────────────────────────────────────
    // Menggunakan rolling average sederhana dari interval antar frame.
    const FPS_SAMPLE_SIZE = 10;
    const fpsBuffer = [];  // circular buffer interval antar frame (ms)

    /**
     * Update FPS measurement. Dipanggil setiap kali frame diproses.
     */
    function updateFps() {
        const now = performance.now();

        if (debugLastFrameTime.value > 0) {
            const interval = now - debugLastFrameTime.value;

            // Hanya catat interval yang wajar (5ms–500ms = 2fps–200fps)
            if (interval >= 5 && interval <= 500) {
                fpsBuffer.push(interval);
                if (fpsBuffer.length > FPS_SAMPLE_SIZE) {
                    fpsBuffer.shift();
                }

                // Hitung rata-rata interval → konversi ke FPS
                const avgInterval = fpsBuffer.reduce((a, b) => a + b, 0) / fpsBuffer.length;
                debugFps.value = Math.round(1000 / avgInterval);
            }
        }

        debugLastFrameTime.value = now;
        debugFrameCount.value++;
    }

    /**
     * Bangun laporan per-landmark dari array landmarks mentah.
     * Hanya dipanggil saat PUSHUP_DEBUG = true.
     * Status: VISIBLE (≥ minVis), LOW (ada tapi < minVis), MISSING (null/undefined)
     *
     * @param {Array|null} landmarks
     */
    function updateDebugDiagnostics(landmarks) {
        if (!PUSHUP_DEBUG) return;

        const minVis = cfg.MIN_VISIBILITY;

        // ── Per-landmark report ────────────────────────────────────────────
        const report = DIAGNOSTIC_LANDMARKS.map(({ name, index }) => {
            const lm  = landmarks?.[index];
            const vis = lm != null ? Math.round((lm.visibility ?? 0) * 100) : null;

            let status;
            if (lm == null || vis === null) {
                status = 'MISSING';
            } else if ((lm.visibility ?? 0) >= minVis) {
                status = 'VISIBLE';
            } else {
                status = 'LOW';
            }

            return { name, index, vis, status };
        });

        debugLandmarkReport.value = report;

        // ── Counting landmark breakdown ────────────────────────────────────
        // Landmark WAJIB untuk counting (shoulder+elbow+wrist)
        const COUNTING_INDICES = [11, 12, 13, 14, 15, 16]; // shoulders, elbows, wrists
        const OPTIONAL_INDICES = [23, 24, 27, 28, 25, 26]; // hips, ankles, knees

        const countingValid   = COUNTING_INDICES.filter(i => {
            const lm = landmarks?.[i];
            return lm != null && (lm.visibility ?? 0) >= minVis;
        });
        const countingMissing = COUNTING_INDICES.filter(i => {
            const lm = landmarks?.[i];
            return !lm || (lm.visibility ?? 0) < minVis;
        }).map(i => {
            const names = { 11:'L.Shoulder',12:'R.Shoulder',13:'L.Elbow',14:'R.Elbow',15:'L.Wrist',16:'R.Wrist' };
            return names[i] ?? `idx${i}`;
        });

        const optionalMissing = OPTIONAL_INDICES.filter(i => {
            const lm = landmarks?.[i];
            return !lm || (lm.visibility ?? 0) < minVis;
        }).map(i => {
            const names = { 23:'L.Hip',24:'R.Hip',27:'L.Ankle',28:'R.Ankle',25:'L.Knee',26:'R.Knee' };
            return names[i] ?? `idx${i}`;
        });

        debugLandmarkReport._countingValid   = countingValid.length;
        debugLandmarkReport._countingTotal   = COUNTING_INDICES.length;
        debugLandmarkReport._countingMissing = countingMissing;
        debugLandmarkReport._optionalMissing = optionalMissing;
        // Cycle diblokir karena counting landmark (bukan hanya optional)?
        // extractLandmarks() return null hanya jika MIN_VALID_SIDES tidak terpenuhi
        // = kedua sisi elbow (shoulder+elbow+wrist) tidak valid
        const leftElbowOk = [11,13,15].every(i => {
            const lm = landmarks?.[i];
            return lm != null && (lm.visibility ?? 0) >= minVis;
        });
        const rightElbowOk = [12,14,16].every(i => {
            const lm = landmarks?.[i];
            return lm != null && (lm.visibility ?? 0) >= minVis;
        });
        debugLandmarkReport._blockedByCountingLm = !leftElbowOk && !rightElbowOk;

        // Expose ke reactive (buat objek terpisah agar Vue reaktif)
        // Kita update via property tambahan pada ref array — tidak ideal tapi cukup untuk debug
        // Gunakan approach sederhana: simpan di reactive ref terpisah
        debugCountingLmReport.value = {
            countingValid:      countingValid.length,
            countingTotal:      COUNTING_INDICES.length,
            countingMissing,
            optionalMissing,
            blockedByCountingLm: !leftElbowOk && !rightElbowOk,
        };

        // ── Body alignment detail report ────────────────────────────────────
        const lm = (idx) => landmarks?.[idx] ?? null;

        const ls = lm(11); // left_shoulder
        const rs = lm(12); // right_shoulder
        const lh = lm(23); // left_hip
        const rh = lm(24); // right_hip
        const la = lm(27); // left_ankle
        const ra = lm(28); // right_ankle

        const lsOk = isLandmarkValid(ls, minVis);
        const rsOk = isLandmarkValid(rs, minVis);
        const lhOk = isLandmarkValid(lh, minVis);
        const rhOk = isLandmarkValid(rh, minVis);
        const laOk = isLandmarkValid(la, minVis);
        const raOk = isLandmarkValid(ra, minVis);

        const leftBodyValid  = lsOk && lhOk && laOk;
        const rightBodyValid = rsOk && rhOk && raOk;

        // Tentukan alasan body angle = 0
        let reason = '';
        if (!leftBodyValid && !rightBodyValid) {
            const missing = [];
            if (!lsOk) missing.push(`L.Shoulder(${ls ? Math.round((ls.visibility ?? 0)*100)+'%' : 'null'})`);
            if (!rsOk) missing.push(`R.Shoulder(${rs ? Math.round((rs.visibility ?? 0)*100)+'%' : 'null'})`);
            if (!lhOk) missing.push(`L.Hip(${lh ? Math.round((lh.visibility ?? 0)*100)+'%' : 'null'})`);
            if (!rhOk) missing.push(`R.Hip(${rh ? Math.round((rh.visibility ?? 0)*100)+'%' : 'null'})`);
            if (!laOk) missing.push(`L.Ankle(${la ? Math.round((la.visibility ?? 0)*100)+'%' : 'null'})`);
            if (!raOk) missing.push(`R.Ankle(${ra ? Math.round((ra.visibility ?? 0)*100)+'%' : 'null'})`);
            reason = `Kedua sisi gagal. Missing/LOW: ${missing.join(', ')}`;
        } else {
            reason = `OK — ${leftBodyValid ? 'L✓' : 'L✗'} ${rightBodyValid ? 'R✓' : 'R✗'}`;
        }

        debugBodyAlignmentReport.value = {
            leftBodyValid,
            rightBodyValid,
            lShoulder: ls ? Math.round((ls.visibility ?? 0) * 100) : null,
            lHip:      lh ? Math.round((lh.visibility ?? 0) * 100) : null,
            lAnkle:    la ? Math.round((la.visibility ?? 0) * 100) : null,
            rShoulder: rs ? Math.round((rs.visibility ?? 0) * 100) : null,
            rHip:      rh ? Math.round((rh.visibility ?? 0) * 100) : null,
            rAnkle:    ra ? Math.round((ra.visibility ?? 0) * 100) : null,
            reason,
        };
    }

    /**
     * Catat inference time satu frame dan perbarui statistik.
     * Hanya dipanggil saat PUSHUP_DEBUG = true.
     *
     * @param {number} startTs — timestamp performance.now() sebelum frame diproses
     */
    function updateInferenceStats(startTs) {
        if (!PUSHUP_DEBUG) return;

        const elapsed = performance.now() - startTs;
        if (elapsed <= 0 || elapsed > 2000) return; // skip anomali

        inferenceAccum += elapsed;
        inferenceCount++;
        if (elapsed < inferenceMin) inferenceMin = elapsed;
        if (elapsed > inferenceMax) inferenceMax = elapsed;

        debugInferenceStats.value = {
            avgMs:   Math.round(inferenceAccum / inferenceCount),
            minMs:   Math.round(inferenceMin),
            maxMs:   Math.round(inferenceMax),
            samples: inferenceCount,
        };
    }

    /**
     * Update state machine diagnostics.
     * Dipanggil setiap frame, hanya saat PUSHUP_DEBUG = true.
     *
     * @param {object} params
     * @param {string}  params.validationStatus  — status dari usePoseValidation
     * @param {number}  params.currentElbow       — sudut siku frame ini (0 jika no data)
     * @param {string}  params.currentPhaseBefore — phase SEBELUM state machine dijalankan
     * @param {boolean} params.landmarkAvailable  — apakah landmark berhasil diekstrak
     * @param {string}  params.formSt             — form status frame ini
     */
    function updateStateMachineDiagnostics({ validationStatus, currentElbow, currentPhaseBefore, landmarkAvailable, formSt }) {
        if (!PUSHUP_DEBUG) return;

        // ── Deteksi validation drop ─────────────────────────────────────────
        if (_sm.lastValidationStatus === 'READY' && validationStatus !== 'READY') {
            _sm.validationDropCount++;
        }
        _sm.lastValidationStatus = validationStatus;

        // ── Hitung block reason ──────────────────────────────────────────────
        if (validationStatus !== 'READY') {
            _sm.blockedByValidation++;
            _sm.lastBlockReason = `Validation bukan READY (${validationStatus})`;
        } else if (!landmarkAvailable) {
            _sm.blockedByLandmark++;
            _sm.lastBlockReason = 'Landmark tidak cukup (extractLandmarks = null)';
        } else if (formSt === PUSHUP_FORM.BAD_FORM) {
            _sm.blockedByBadForm++;
            _sm.lastBlockReason = 'BAD_FORM: tubuh tidak lurus';
        }

        // ── Track elbow min/max ──────────────────────────────────────────────
        if (currentElbow > 0) {
            if (currentElbow < _sm.minElbowSeen) _sm.minElbowSeen = currentElbow;
            if (currentElbow > _sm.maxElbowSeen) _sm.maxElbowSeen = currentElbow;
        }

        // ── Counter elbow zona ───────────────────────────────────────────────
        if (currentElbow > 0 && currentElbow <= cfg.DOWN_ELBOW_ANGLE) {
            _sm.framesElbowBelowDown++;
        }
        if (currentElbow > 0 && currentElbow >= cfg.UP_ELBOW_ANGLE) {
            _sm.framesElbowAboveUp++;
        }

        // ── Track phase transitions ──────────────────────────────────────────
        const nowPhase = currentPhase.value;
        if (nowPhase !== currentPhaseBefore) {
            _sm.prevPhase = currentPhaseBefore;
        }
        if (nowPhase === PUSHUP_PHASE.DOWN) {
            _sm.downEverReached = true;
        }
        if (nowPhase === PUSHUP_PHASE.UP && _sm.downEverReached) {
            _sm.upAfterDownReached = true;
        }

        // ── Flush ke reactive ref (throttle: setiap frame, tapi objek baru) ─
        debugStateMachine.value = {
            prevPhase:            _sm.prevPhase,
            minElbowSeen:         _sm.minElbowSeen === 999 ? 0 : _sm.minElbowSeen,
            maxElbowSeen:         _sm.maxElbowSeen,
            framesElbowBelowDown: _sm.framesElbowBelowDown,
            framesElbowAboveUp:   _sm.framesElbowAboveUp,
            downEverReached:      _sm.downEverReached,
            upAfterDownReached:   _sm.upAfterDownReached,
            blockedByValidation:  _sm.blockedByValidation,
            blockedByLandmark:    _sm.blockedByLandmark,
            blockedByBadForm:     _sm.blockedByBadForm,
            lastBlockReason:      _sm.lastBlockReason,
            validationDropCount:  _sm.validationDropCount,
        };
    }

    /**
     * Tambahkan satu sampel ke frame history (rolling 25 terakhir).
     * Hanya saat PUSHUP_DEBUG = true.
     */
    function pushFrameHistory(validationStatus, currentElbow, currentBody, formSt) {
        if (!PUSHUP_DEBUG) return;

        const entry = {
            ts:         Math.round(performance.now() / 100) / 10, // detik 1 desimal
            fps:        debugFps.value,
            valid:      validationStatus,
            elbow:      currentElbow,
            body:       currentBody,
            phase:      currentPhase.value,
            form:       formSt,
        };

        const history = debugFrameHistory.value;
        if (history.length >= DEBUG_HISTORY_SIZE) {
            // Buat array baru tanpa elemen pertama — lebih performant dari splice di ref
            debugFrameHistory.value = [...history.slice(1), entry];
        } else {
            debugFrameHistory.value = [...history, entry];
        }
    }

    /**
     * Observer murni untuk repetition cycle diagnostic.
     * Dipanggil SETELAH state machine selesai dijalankan setiap frame.
     * Tidak mengubah behavior counting sama sekali.
     *
     * @param {object} p
     * @param {string}  p.validationStatus  — status dari usePoseValidation
     * @param {number}  p.currentElbow      — sudut siku frame ini
     * @param {string}  p.formSt            — form status
     * @param {boolean} p.landmarkAvail     — apakah landmark tersedia
     * @param {string}  p.phaseBefore       — phase SEBELUM frame ini diproses
     */
    function updateRepCycleDiagnostics({ validationStatus, currentElbow, formSt, landmarkAvail, phaseBefore }) {
        if (!PUSHUP_DEBUG) return;

        const now        = performance.now();
        const phaseAfter = currentPhase.value;
        const repCount   = repetitionCount.value;

        // ── Deteksi blok per-frame ───────────────────────────────────────────
        if (validationStatus !== 'READY') {
            _cycle.validationDrops++;
        }
        if (!landmarkAvail && validationStatus === 'READY') {
            _cycle.landmarkBlocks++;
        }
        if (formSt === PUSHUP_FORM.BAD_FORM) {
            _cycle.badFormBlocks++;
        }

        // ── Inisialisasi siklus baru ─────────────────────────────────────────
        if (_cycle.cycleState === 'IDLE' || _cycle.cycleState === 'COUNTED' || _cycle.cycleState === 'BLOCKED') {
            // Mulai siklus baru saat phase READY atau UP dan ada data
            if ((phaseAfter === PUSHUP_PHASE.READY || phaseAfter === PUSHUP_PHASE.UP) && validationStatus === 'READY') {
                _cycle.cycleNumber++;
                _cycle.cycleState          = 'WAITING_DOWN';
                _cycle.startedAt           = now;
                _cycle.upDetected          = (phaseAfter === PUSHUP_PHASE.UP);
                _cycle.downDetected        = false;
                _cycle.downConfirmed       = false;
                _cycle.upAfterDownDetected = false;
                _cycle.counted             = false;
                _cycle.resetReason         = '—';
                _cycle.downEnteredAt       = 0;
                _cycle.validationDrops     = 0;
                _cycle.landmarkBlocks      = 0;
                _cycle.badFormBlocks       = 0;
                _cycle.prevRepCount        = repCount;
            }
        }

        // ── Track transisi phase ─────────────────────────────────────────────
        if (phaseAfter !== phaseBefore) {
            // Transisi READY/UP → DOWN dikonfirmasi
            if (phaseAfter === PUSHUP_PHASE.DOWN) {
                _cycle.downConfirmed  = true;
                _cycle.downEnteredAt  = now;
                _cycle.cycleState     = 'DOWN_CONFIRMED';
            }
            // Transisi DOWN → UP (rep berhasil atau tidak)
            if (phaseAfter === PUSHUP_PHASE.UP && phaseBefore === PUSHUP_PHASE.DOWN) {
                _cycle.upAfterDownDetected = true;
                _cycle.cycleState          = 'UP_DETECTED';
            }
        }

        // ── Track elbow masuk zona (bisa sebelum phase berubah) ──────────────
        if (_cycle.cycleState === 'WAITING_DOWN' || _cycle.cycleState === 'DOWN_DETECTED') {
            if (currentElbow > 0 && currentElbow <= cfg.DOWN_ELBOW_ANGLE) {
                _cycle.downDetected = true;
                _cycle.cycleState   = 'DOWN_DETECTED';
            }
        }
        if (_cycle.cycleState === 'DOWN_CONFIRMED' || _cycle.cycleState === 'WAITING_UP') {
            if (phaseAfter === PUSHUP_PHASE.DOWN) {
                _cycle.cycleState = 'WAITING_UP';
            }
            if (currentElbow > 0 && currentElbow >= cfg.UP_ELBOW_ANGLE) {
                _cycle.upAfterDownDetected = true;
                if (_cycle.cycleState === 'WAITING_UP') _cycle.cycleState = 'UP_DETECTED';
            }
        }

        // ── Deteksi rep dihitung ─────────────────────────────────────────────
        if (repCount > _cycle.prevRepCount) {
            _cycle.counted      = true;
            _cycle.cycleState   = 'COUNTED';
            _cycle.prevRepCount = repCount;

            // Simpan ke history
            _pushCycleToHistory({ ...(_cycle) });

            // Reset untuk siklus berikutnya
            _cycle.cycleState          = 'IDLE';
        }

        // ── Deteksi reset siklus (validation drop saat DOWN) ─────────────────
        if (
            (_cycle.cycleState === 'DOWN_CONFIRMED' || _cycle.cycleState === 'WAITING_UP') &&
            validationStatus !== 'READY'
        ) {
            _cycle.resetReason = REP_CYCLE_RESET_REASONS.VALIDATION_LOST;
            _cycle.cycleState  = 'BLOCKED';
            _pushCycleToHistory({ ...(_cycle) });
            _cycle.cycleState = 'IDLE';
        }

        if (
            (_cycle.cycleState === 'DOWN_CONFIRMED' || _cycle.cycleState === 'WAITING_UP') &&
            !landmarkAvail && validationStatus === 'READY'
        ) {
            _cycle.resetReason = REP_CYCLE_RESET_REASONS.LANDMARK_LOST;
            _cycle.cycleState  = 'BLOCKED';
            _pushCycleToHistory({ ...(_cycle) });
            _cycle.cycleState = 'IDLE';
        }

        if (
            (_cycle.cycleState === 'DOWN_CONFIRMED' || _cycle.cycleState === 'WAITING_UP') &&
            formSt === PUSHUP_FORM.BAD_FORM
        ) {
            _cycle.resetReason = REP_CYCLE_RESET_REASONS.BAD_FORM;
            _cycle.cycleState  = 'BLOCKED';
            _pushCycleToHistory({ ...(_cycle) });
            _cycle.cycleState = 'IDLE';
        }

        // ── Hitung downDurationMs ────────────────────────────────────────────
        const downDur = _cycle.downConfirmed && _cycle.downEnteredAt > 0
            ? Math.round(now - _cycle.downEnteredAt)
            : 0;

        // ── Flush ke reactive ref ────────────────────────────────────────────
        debugRepCycle.value = {
            cycleNumber:         _cycle.cycleNumber,
            currentCycleState:   _cycle.cycleState,
            startedAt:           _cycle.startedAt,
            upDetected:          _cycle.upDetected,
            downDetected:        _cycle.downDetected,
            downConfirmed:       _cycle.downConfirmed,
            upAfterDownDetected: _cycle.upAfterDownDetected,
            counted:             _cycle.counted,
            resetReason:         _cycle.resetReason,
            downDurationMs:      downDur,
            validationDrops:     _cycle.validationDrops,
            landmarkBlocks:      _cycle.landmarkBlocks,
            badFormBlocks:       _cycle.badFormBlocks,
        };
    }

    /**
     * Simpan snapshot siklus ke history (rolling 10 terakhir).
     */
    function _pushCycleToHistory(snap) {
        const entry = {
            cycleNumber:         snap.cycleNumber,
            upDetected:          snap.upDetected,
            downDetected:        snap.downDetected,
            downConfirmed:       snap.downConfirmed,
            upAfterDownDetected: snap.upAfterDownDetected,
            counted:             snap.counted,
            downDurationMs:      snap.downEnteredAt > 0 ? Math.round(performance.now() - snap.downEnteredAt) : 0,
            validationDrops:     snap.validationDrops,
            landmarkBlocks:      snap.landmarkBlocks,
            badFormBlocks:       snap.badFormBlocks,
            resetReason:         snap.resetReason,
        };
        const hist = debugRepCycleHistory.value;
        debugRepCycleHistory.value = hist.length >= DEBUG_CYCLE_HISTORY_SIZE
            ? [...hist.slice(1), entry]
            : [...hist, entry];
    }

    // ── Core processing ───────────────────────────────────────────────────────

    /**
     * Ekstrak dan validasi semua landmark push-up dari array MediaPipe.
     * Mengembalikan null jika landmark tidak cukup.
     */
    function extractLandmarks(landmarks) {
        if (!landmarks || landmarks.length < 33) return null;

        const lm     = (idx) => landmarks[idx];
        const minVis = cfg.MIN_VISIBILITY;

        const leftShoulder  = lm(11);
        const rightShoulder = lm(12);
        const leftElbow     = lm(13);
        const rightElbow    = lm(14);
        const leftWrist     = lm(15);
        const rightWrist    = lm(16);
        const leftHip       = lm(23);
        const rightHip      = lm(24);
        const leftAnkle     = lm(27);
        const rightAnkle    = lm(28);

        const leftElbowValid = (
            isLandmarkValid(leftShoulder, minVis) &&
            isLandmarkValid(leftElbow,    minVis) &&
            isLandmarkValid(leftWrist,    minVis)
        );

        const rightElbowValid = (
            isLandmarkValid(rightShoulder, minVis) &&
            isLandmarkValid(rightElbow,    minVis) &&
            isLandmarkValid(rightWrist,    minVis)
        );

        const validSides = (leftElbowValid ? 1 : 0) + (rightElbowValid ? 1 : 0);
        if (validSides < cfg.MIN_VALID_SIDES) return null;

        const leftBodyValid = (
            isLandmarkValid(leftShoulder, minVis) &&
            isLandmarkValid(leftHip,      minVis) &&
            isLandmarkValid(leftAnkle,    minVis)
        );
        const rightBodyValid = (
            isLandmarkValid(rightShoulder, minVis) &&
            isLandmarkValid(rightHip,      minVis) &&
            isLandmarkValid(rightAnkle,    minVis)
        );

        return {
            leftShoulder,  rightShoulder,
            leftElbow,     rightElbow,
            leftWrist,     rightWrist,
            leftHip,       rightHip,
            leftAnkle,     rightAnkle,
            leftElbowValid,
            rightElbowValid,
            leftBodyValid,
            rightBodyValid,
        };
    }

    /**
     * Hitung sudut siku rata-rata dari sisi yang valid.
     */
    function computeElbowAngle(lms) {
        const angles = [];

        if (lms.leftElbowValid) {
            const a = calculateAngle(lms.leftShoulder, lms.leftElbow, lms.leftWrist);
            if (a > 0) angles.push(a);
        }
        if (lms.rightElbowValid) {
            const a = calculateAngle(lms.rightShoulder, lms.rightElbow, lms.rightWrist);
            if (a > 0) angles.push(a);
        }

        if (angles.length === 0) return 0;
        return Math.round(angles.reduce((sum, v) => sum + v, 0) / angles.length);
    }

    /**
     * Hitung sudut alignment tubuh rata-rata (shoulder→hip→ankle).
     */
    function computeBodyAngle(lms) {
        const angles = [];

        if (lms.leftBodyValid) {
            const a = calculateAngle(lms.leftShoulder, lms.leftHip, lms.leftAnkle);
            if (a > 0) angles.push(a);
        }
        if (lms.rightBodyValid) {
            const a = calculateAngle(lms.rightShoulder, lms.rightHip, lms.rightAnkle);
            if (a > 0) angles.push(a);
        }

        if (angles.length === 0) return 0;
        return Math.round(angles.reduce((sum, v) => sum + v, 0) / angles.length);
    }

    /**
     * Evaluasi form (kualitas gerakan).
     * Mengembalikan { status, message }.
     */
    function evaluateForm(currentBodyAngle, currentElbowAngle) {
        // Body angle 0 berarti tidak bisa dihitung → jangan paksa BAD_FORM
        if (
            currentBodyAngle > 0 &&
            (currentBodyAngle < cfg.MIN_BODY_ALIGNMENT_ANGLE ||
             currentBodyAngle > cfg.MAX_BODY_ALIGNMENT_ANGLE)
        ) {
            return {
                status:  PUSHUP_FORM.BAD_FORM,
                message: 'Posisikan tubuh lebih lurus',
            };
        }

        // Di fase READY: lengan harus sudah lurus sebelum mulai turun
        if (
            currentPhase.value === PUSHUP_PHASE.READY &&
            currentElbowAngle > 0 &&
            currentElbowAngle < cfg.UP_ELBOW_ANGLE
        ) {
            return {
                status:  PUSHUP_FORM.ADJUST_POSITION,
                message: 'Luruskan lengan ke posisi awal',
            };
        }

        return {
            status:  PUSHUP_FORM.GOOD_FORM,
            message: 'Posisi sudah benar',
        };
    }

    /**
     * Handle kondisi landmark hilang sementara.
     * Saat phase READY/UP: reset KEDUA timer (wajar, belum mulai gerakan)
     * Saat phase DOWN: jangan reset upStartTime (mungkin sedang naik)
     *                  dan jangan reset downStartTime sampai timeout
     */
    function handleLandmarkLost() {
        const now = performance.now();

        if (landmarkLostTime === null) {
            landmarkLostTime = now;
        }

        const lostDuration = now - landmarkLostTime;

        feedback.value   = 'Pastikan kedua tangan dan tubuh terlihat';
        formStatus.value = PUSHUP_FORM.NO_DATA;
        isValidRep.value = false;

        if (
            currentPhase.value === PUSHUP_PHASE.DOWN &&
            lostDuration > cfg.LANDMARK_LOST_TIMEOUT_MS
        ) {
            // Landmark hilang > 500ms saat DOWN → batalkan rep ini
            repBlockedByForm = true;
            feedback.value   = 'Posisi hilang — ulangi gerakan';
        }

        // Jika BUKAN di fase DOWN: reset kedua timer (aman, belum gerakan)
        // Jika di fase DOWN: JANGAN reset downStartTime maupun upStartTime
        // karena bisa jadi landmark hanya sesaat hilang 1 frame
        // sementara siku masih di zona yang benar
        if (currentPhase.value !== PUSHUP_PHASE.DOWN) {
            downStartTime = null;
            upStartTime   = null;
        }
        // Saat phase DOWN dan landmark hilang < timeout: biarkan kedua timer
        // terus berjalan. Jika landmark kembali ada di zona yang benar,
        // akumulasi lanjut tanpa harus mulai dari 0.
        return false;
    }

    /**
     * Fungsi utama — dipanggil setiap frame dari onPoseUpdate.
     *
     * @param {Object} params
     * @param {Array|null} params.landmarks        — array 33 landmark MediaPipe
     * @param {string}     params.validationStatus — status dari usePoseValidation
     */
    function processPushUpFrame({ landmarks, validationStatus } = {}) {
        // Update FPS setiap frame masuk
        updateFps();
        // Catat waktu awal frame untuk inference time measurement
        frameStartTime = PUSHUP_DEBUG ? performance.now() : 0;
        // Simpan phase sebelum state machine dijalankan (untuk diagnostic)
        const phaseBefore = currentPhase.value;

        // ── Guard: pose belum READY ───────────────────────────────────────────
        if (validationStatus !== 'READY') {
            feedback.value   = 'Tunggu posisi tubuh valid terlebih dahulu';
            formStatus.value = PUSHUP_FORM.NO_DATA;
            isValidRep.value = false;
            // PENTING: TIDAK reset downStartTime/upStartTime di sini.
            landmarkLostTime = null;
            if (PUSHUP_DEBUG) {
                debugCountingPipeline.value = {
                    ...debugCountingPipeline.value,
                    validationReady: false,
                    repIncremented: false,
                    blockReason: `Validation tidak READY: ${validationStatus}`,
                };
            }
            if (PUSHUP_DEBUG) updateDebugDiagnostics(landmarks);
            if (PUSHUP_DEBUG) updateStateMachineDiagnostics({ validationStatus, currentElbow: 0, currentPhaseBefore: phaseBefore, landmarkAvailable: false, formSt: PUSHUP_FORM.NO_DATA });
            if (PUSHUP_DEBUG) updateRepCycleDiagnostics({ validationStatus, currentElbow: 0, formSt: PUSHUP_FORM.NO_DATA, landmarkAvail: false, phaseBefore });
            if (PUSHUP_DEBUG) pushFrameHistory(validationStatus, 0, 0, PUSHUP_FORM.NO_DATA);
            if (PUSHUP_DEBUG) updateInferenceStats(frameStartTime);
            return;
        }

        // ── Ekstrak landmark ──────────────────────────────────────────────────
        const lms = extractLandmarks(landmarks);

        // Update diagnostik SEBELUM return agar bisa lihat landmark saat lost
        if (PUSHUP_DEBUG) updateDebugDiagnostics(landmarks);

        if (!lms) {
            handleLandmarkLost();
            if (PUSHUP_DEBUG) {
                debugCountingPipeline.value = {
                    ...debugCountingPipeline.value,
                    validationReady: true,
                    repIncremented: false,
                    blockReason: 'Landmark tidak cukup (extractLandmarks=null)',
                };
            }
            if (PUSHUP_DEBUG) updateStateMachineDiagnostics({ validationStatus, currentElbow: 0, currentPhaseBefore: phaseBefore, landmarkAvailable: false, formSt: PUSHUP_FORM.NO_DATA });
            if (PUSHUP_DEBUG) updateRepCycleDiagnostics({ validationStatus, currentElbow: 0, formSt: PUSHUP_FORM.NO_DATA, landmarkAvail: false, phaseBefore });
            if (PUSHUP_DEBUG) pushFrameHistory(validationStatus, 0, 0, PUSHUP_FORM.NO_DATA);
            if (PUSHUP_DEBUG) updateInferenceStats(frameStartTime);
            return;
        }

        // Landmark kembali ada → reset lost timer
        landmarkLostTime = null;

        // ── Hitung sudut ──────────────────────────────────────────────────────
        const currentElbow = computeElbowAngle(lms);
        const currentBody  = computeBodyAngle(lms);

        elbowAngle.value = currentElbow;
        bodyAngle.value  = currentBody;

        // ── Guard: hip/ankle tidak terlihat → pose bukan push-up horizontal ──
        // Jika KEDUA sisi tidak memiliki shoulder+hip+ankle valid, body angle
        // tidak bisa diukur dan kita tidak bisa memastikan pose horizontal.
        // Ini terjadi saat orang berdiri di depan kamera (hip/ankle tidak terlihat)
        // tetapi elbow bisa menekuk secara natural → false positive.
        // Upload video tidak terdampak karena rightBodyValid = true (hip 100%, ankle 95%).
        if (!lms.leftBodyValid && !lms.rightBodyValid) {
            formStatus.value = PUSHUP_FORM.ADJUST_POSITION;
            feedback.value   = 'Pastikan seluruh tubuh (pinggul & kaki) terlihat kamera';
            isValidRep.value = false;

            // Reset timer DOWN/UP (sama seperti BAD_FORM path) kecuali saat fase DOWN
            if (currentPhase.value !== PUSHUP_PHASE.DOWN) {
                downStartTime = null;
                upStartTime   = null;
            }

            if (PUSHUP_DEBUG) {
                debugCountingPipeline.value = {
                    ...debugCountingPipeline.value,
                    validationReady: true,
                    elbowAngle: currentElbow,
                    repIncremented: false,
                    blockReason: `No body valid: hip/ankle tidak terlihat (L:${lms.leftBodyValid} R:${lms.rightBodyValid})`,
                };
            }
            if (PUSHUP_DEBUG) updateStateMachineDiagnostics({ validationStatus, currentElbow, currentPhaseBefore: phaseBefore, landmarkAvailable: true, formSt: PUSHUP_FORM.ADJUST_POSITION });
            if (PUSHUP_DEBUG) updateRepCycleDiagnostics({ validationStatus, currentElbow, formSt: PUSHUP_FORM.ADJUST_POSITION, landmarkAvail: true, phaseBefore });
            if (PUSHUP_DEBUG) pushFrameHistory(validationStatus, currentElbow, currentBody, PUSHUP_FORM.ADJUST_POSITION);
            if (PUSHUP_DEBUG) updateInferenceStats(frameStartTime);
            return;
        }

        // ── Evaluasi form ─────────────────────────────────────────────────────
        const { status: fStatus, message: fMessage } = evaluateForm(currentBody, currentElbow);
        formStatus.value = fStatus;

        if (fStatus === PUSHUP_FORM.BAD_FORM) {
            feedback.value   = fMessage;
            isValidRep.value = false;
            repBlockedByForm = true;

            if (currentPhase.value !== PUSHUP_PHASE.DOWN) {
                downStartTime = null;
                upStartTime   = null;
            }
            if (PUSHUP_DEBUG) {
                debugCountingPipeline.value = {
                    ...debugCountingPipeline.value,
                    validationReady: true,
                    elbowAngle: currentElbow,
                    repIncremented: false,
                    blockReason: `BAD_FORM: body angle ${currentBody}° < ${cfg.MIN_BODY_ALIGNMENT_ANGLE}°`,
                };
            }
            if (PUSHUP_DEBUG) updateStateMachineDiagnostics({ validationStatus, currentElbow, currentPhaseBefore: phaseBefore, landmarkAvailable: true, formSt: fStatus });
            if (PUSHUP_DEBUG) updateRepCycleDiagnostics({ validationStatus, currentElbow, formSt: fStatus, landmarkAvail: true, phaseBefore });
            if (PUSHUP_DEBUG) pushFrameHistory(validationStatus, currentElbow, currentBody, fStatus);
            if (PUSHUP_DEBUG) updateInferenceStats(frameStartTime);
            return;
        }

        // ── State machine berbasis WAKTU ──────────────────────────────────────
        const now   = performance.now();
        const phase = currentPhase.value;

        // Pipeline diagnostic state untuk frame ini
        let _pipelineBlock = '—';
        let _repIncremented = false;

        if (phase === PUSHUP_PHASE.READY || phase === PUSHUP_PHASE.UP) {
            // ── Menunggu gerakan turun ──────────────────────────────────────
            if (currentElbow > 0 && currentElbow <= cfg.DOWN_ELBOW_ANGLE) {
                // Mulai atau lanjutkan akumulasi DOWN
                if (downStartTime === null) {
                    downStartTime = now;
                }
                upStartTime = null;

                const elapsed = now - downStartTime;

                if (elapsed >= cfg.DOWN_STABLE_DURATION_MS) {
                    // Konfirmasi: fase DOWN
                    currentPhase.value = PUSHUP_PHASE.DOWN;
                    downStartTime      = null;
                    repBlockedByForm   = false;
                    feedback.value     = 'Bagus! Angkat tubuh kembali';
                    isValidRep.value   = false;
                } else {
                    // Sedang akumulasi — progress ke DOWN
                    const pct = Math.round((elapsed / cfg.DOWN_STABLE_DURATION_MS) * 100);
                    feedback.value = `Turunkan lebih rendah... (${pct}%)`;
                    _pipelineBlock = `DOWN akumulasi: ${Math.round(elapsed)}ms/${cfg.DOWN_STABLE_DURATION_MS}ms`;
                }
            } else {
                // Elbow tidak di zona DOWN → reset akumulasi
                downStartTime = null;
                feedback.value = fStatus === PUSHUP_FORM.ADJUST_POSITION
                    ? fMessage
                    : 'Mulai turunkan tubuh';
                _pipelineBlock = `Elbow ${currentElbow}° belum <= ${cfg.DOWN_ELBOW_ANGLE}° (DOWN zone)`;
            }

        } else if (phase === PUSHUP_PHASE.DOWN) {
            // ── Sudah di bawah, menunggu gerakan naik ─────────────────────
            if (currentElbow > 0 && currentElbow >= cfg.UP_ELBOW_ANGLE) {
                // Mulai atau lanjutkan akumulasi UP
                if (upStartTime === null) {
                    upStartTime = now;
                }
                downStartTime = null;

                const elapsed = now - upStartTime;

                if (elapsed >= cfg.UP_STABLE_DURATION_MS) {
                    // Konfirmasi: fase UP → hitung repetisi
                    currentPhase.value = PUSHUP_PHASE.UP;
                    upStartTime        = null;

                    if (!repBlockedByForm) {
                        repetitionCount.value++;
                        isValidRep.value = true;
                        feedback.value   = `Bagus! ${repetitionCount.value} repetisi`;
                        _repIncremented  = true;
                    } else {
                        isValidRep.value = false;
                        feedback.value   = 'Repetisi tidak dihitung — perbaiki form';
                        repBlockedByForm = false;
                        _pipelineBlock   = 'repBlockedByForm=true (BAD_FORM sebelumnya)';
                    }
                } else {
                    const pct = Math.round((elapsed / cfg.UP_STABLE_DURATION_MS) * 100);
                    feedback.value = `Hampir! Angkat lebih tinggi... (${pct}%)`;
                    _pipelineBlock = `UP akumulasi: ${Math.round(elapsed)}ms/${cfg.UP_STABLE_DURATION_MS}ms`;
                }
            } else {
                // Belum kembali ke atas → reset akumulasi UP
                upStartTime    = null;
                feedback.value = 'Angkat tubuh kembali ke posisi awal';
                _pipelineBlock = `Elbow ${currentElbow}° belum >= ${cfg.UP_ELBOW_ANGLE}° (UP zone)`;
            }
        }

        // ── Update counting pipeline diagnostic ───────────────────────────────
        if (PUSHUP_DEBUG) {
            // ── Per-frame snapshot ──────────────────────────────────────────
            debugCountingPipeline.value = {
                validationReady: validationStatus === 'READY',
                elbowAngle:      currentElbow,
                inDownZone:      currentElbow > 0 && currentElbow <= cfg.DOWN_ELBOW_ANGLE,
                downConfirmed:   currentPhase.value === PUSHUP_PHASE.DOWN || phase === PUSHUP_PHASE.DOWN,
                inUpZone:        currentElbow > 0 && currentElbow >= cfg.UP_ELBOW_ANGLE,
                upConfirmed:     currentPhase.value === PUSHUP_PHASE.UP && phase === PUSHUP_PHASE.DOWN,
                repIncremented:  _repIncremented,
                blockReason:     _repIncremented ? '—' : _pipelineBlock,
                downAccumMs:     downStartTime !== null ? Math.round(now - downStartTime) : 0,
                upAccumMs:       upStartTime   !== null ? Math.round(now - upStartTime)   : 0,
            };

            // ── Kumulatif counters ──────────────────────────────────────────
            _cumul.validationReadyFrames++;

            if (currentElbow > 0) _cumul.elbowSamples++;

            if (currentElbow > 0 && currentElbow <= cfg.DOWN_ELBOW_ANGLE) {
                _cumul.downZoneFrames++;
            }
            if (downStartTime !== null) {
                _cumul.downTimerStarted++;
                const acc = Math.round(now - downStartTime);
                if (acc > _cumul.downTimerMaxMs) _cumul.downTimerMaxMs = acc;
            }
            if (currentElbow > 0 && currentElbow >= cfg.UP_ELBOW_ANGLE) {
                _cumul.upZoneFrames++;
            }
            if (upStartTime !== null) {
                _cumul.upTimerStarted++;
                const acc = Math.round(now - upStartTime);
                if (acc > _cumul.upTimerMaxMs) _cumul.upTimerMaxMs = acc;
            }
            // Deteksi transisi ke DOWN
            if (currentPhase.value === PUSHUP_PHASE.DOWN && _cumul.prevPhaseForCumul !== 'DOWN') {
                _cumul.downConfirmedCount++;
            }
            // Deteksi transisi ke UP setelah DOWN
            if (currentPhase.value === PUSHUP_PHASE.UP && _cumul.prevPhaseForCumul === 'DOWN') {
                _cumul.upConfirmedCount++;
            }
            _cumul.prevPhaseForCumul = currentPhase.value;

            if (_repIncremented) _cumul.repIncrementCount++;
            if (!_repIncremented && _pipelineBlock !== '—') _cumul.lastBlockReason = _pipelineBlock;

            debugPipelineCumulative.value = { ..._cumul };
        }

        // Catat diagnostic di akhir frame (setelah state machine selesai)
        if (PUSHUP_DEBUG) updateStateMachineDiagnostics({ validationStatus, currentElbow, currentPhaseBefore: phaseBefore, landmarkAvailable: true, formSt: fStatus });
        if (PUSHUP_DEBUG) updateRepCycleDiagnostics({ validationStatus, currentElbow, formSt: fStatus, landmarkAvail: true, phaseBefore });
        if (PUSHUP_DEBUG) pushFrameHistory(validationStatus, currentElbow, currentBody, fStatus);
        if (PUSHUP_DEBUG) updateInferenceStats(frameStartTime);
    }

    /**
     * Reset seluruh state push-up.
     * Dipanggil saat assessment stop atau restart.
     */
    function resetPushUp() {
        repetitionCount.value = 0;
        currentPhase.value    = PUSHUP_PHASE.READY;
        formStatus.value      = PUSHUP_FORM.NO_DATA;
        elbowAngle.value      = 0;
        bodyAngle.value       = 0;
        feedback.value        = '';
        isValidRep.value      = false;
        downStartTime         = null;
        upStartTime           = null;
        repBlockedByForm      = false;
        landmarkLostTime      = null;
        frameStartTime        = 0;
        // Reset FPS buffer
        fpsBuffer.length      = 0;
        debugFps.value        = 0;
        debugFrameCount.value = 0;
        debugLastFrameTime.value = 0;
        // Reset diagnostic state
        debugLandmarkReport.value       = [];
        debugBodyAlignmentReport.value  = { leftBodyValid: false, rightBodyValid: false, reason: 'Reset' };
        debugInferenceStats.value       = { avgMs: 0, minMs: Infinity, maxMs: 0, samples: 0 };
        inferenceAccum = 0;
        inferenceCount = 0;
        inferenceMin   = Infinity;
        inferenceMax   = 0;
        // Reset state machine diagnostics
        debugStateMachine.value = {
            prevPhase: 'READY', minElbowSeen: 0, maxElbowSeen: 0,
            framesElbowBelowDown: 0, framesElbowAboveUp: 0,
            downEverReached: false, upAfterDownReached: false,
            blockedByValidation: 0, blockedByLandmark: 0, blockedByBadForm: 0,
            lastBlockReason: '—', validationDropCount: 0,
        };
        _sm = {
            prevPhase: 'READY', minElbowSeen: 999, maxElbowSeen: 0,
            framesElbowBelowDown: 0, framesElbowAboveUp: 0,
            downEverReached: false, upAfterDownReached: false,
            blockedByValidation: 0, blockedByLandmark: 0, blockedByBadForm: 0,
            lastBlockReason: '—', validationDropCount: 0, lastValidationStatus: 'READY',
        };
        debugFrameHistory.value = [];
        // Reset rep cycle diagnostics
        debugRepCycle.value = {
            cycleNumber: 0, currentCycleState: 'IDLE', startedAt: 0,
            upDetected: false, downDetected: false, downConfirmed: false,
            upAfterDownDetected: false, counted: false, resetReason: '—',
            downDurationMs: 0, validationDrops: 0, landmarkBlocks: 0, badFormBlocks: 0,
        };
        debugRepCycleHistory.value = [];
        debugCountingLmReport.value = {
            countingValid: 0, countingTotal: 6,
            countingMissing: [], optionalMissing: [], blockedByCountingLm: false,
        };
        debugCountingPipeline.value = {
            validationReady: false, elbowAngle: 0,
            inDownZone: false, downConfirmed: false,
            inUpZone: false, upConfirmed: false,
            repIncremented: false, blockReason: '—',
            downAccumMs: 0, upAccumMs: 0,
        };
        debugPipelineCumulative.value = {
            validationReadyFrames: 0, elbowSamples: 0,
            downZoneFrames: 0, downTimerStarted: 0, downTimerMaxMs: 0, downConfirmedCount: 0,
            upZoneFrames: 0, upTimerStarted: 0, upTimerMaxMs: 0, upConfirmedCount: 0,
            repIncrementCount: 0, lastBlockReason: '—',
        };
        _cumul = {
            validationReadyFrames: 0, elbowSamples: 0,
            downZoneFrames: 0, downTimerStarted: 0, downTimerMaxMs: 0, downConfirmedCount: 0,
            upZoneFrames: 0, upTimerStarted: 0, upTimerMaxMs: 0, upConfirmedCount: 0,
            repIncrementCount: 0, lastBlockReason: '—', prevPhaseForCumul: 'READY',
        };
        _cycle = {
            cycleNumber: 0, cycleState: 'IDLE', startedAt: 0,
            upDetected: false, downDetected: false, downConfirmed: false,
            upAfterDownDetected: false, counted: false, resetReason: '—',
            downEnteredAt: 0, validationDrops: 0, landmarkBlocks: 0, badFormBlocks: 0,
            prevRepCount: 0, prevPhase: 'READY',
        };
    }

    // ── Computed UI helpers ───────────────────────────────────────────────────

    const formStatusLabel = computed(() => {
        const map = {
            [PUSHUP_FORM.GOOD_FORM]:       'GOOD FORM',
            [PUSHUP_FORM.BAD_FORM]:        'BAD FORM',
            [PUSHUP_FORM.ADJUST_POSITION]: 'ADJUST',
            [PUSHUP_FORM.NO_DATA]:         '—',
        };
        return map[formStatus.value] ?? '—';
    });

    const formStatusColor = computed(() => {
        const map = {
            [PUSHUP_FORM.GOOD_FORM]:       'text-emerald-400',
            [PUSHUP_FORM.BAD_FORM]:        'text-red-400',
            [PUSHUP_FORM.ADJUST_POSITION]: 'text-yellow-400',
            [PUSHUP_FORM.NO_DATA]:         'text-slate-500',
        };
        return map[formStatus.value] ?? 'text-slate-500';
    });

    const formStatusBadge = computed(() => {
        const map = {
            [PUSHUP_FORM.GOOD_FORM]:       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            [PUSHUP_FORM.BAD_FORM]:        'bg-red-500/10 text-red-400 border-red-500/20',
            [PUSHUP_FORM.ADJUST_POSITION]: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
            [PUSHUP_FORM.NO_DATA]:         'bg-slate-800 text-slate-500 border-white/5',
        };
        return map[formStatus.value] ?? 'bg-slate-800 text-slate-500 border-white/5';
    });

    const phaseLabel = computed(() => {
        const map = {
            [PUSHUP_PHASE.READY]: 'READY',
            [PUSHUP_PHASE.DOWN]:  'DOWN ↓',
            [PUSHUP_PHASE.UP]:    'UP ↑',
        };
        return map[currentPhase.value] ?? '—';
    });

    const phaseColor = computed(() => {
        const map = {
            [PUSHUP_PHASE.READY]: 'text-slate-400',
            [PUSHUP_PHASE.DOWN]:  'text-orange-400',
            [PUSHUP_PHASE.UP]:    'text-emerald-400',
        };
        return map[currentPhase.value] ?? 'text-slate-400';
    });

    return {
        // State (reactive)
        repetitionCount,
        currentPhase,
        formStatus,
        elbowAngle,
        bodyAngle,
        feedback,
        isValidRep,

        // Debug state (reactive, hanya berguna saat PUSHUP_DEBUG = true)
        debugFps,
        debugFrameCount,
        debugLandmarkReport,
        debugBodyAlignmentReport,
        debugInferenceStats,
        debugStateMachine,
        debugFrameHistory,
        debugRepCycle,
        debugRepCycleHistory,
        debugCountingLmReport,
        debugCountingPipeline,
        debugPipelineCumulative,

        // Actions
        processPushUpFrame,
        resetPushUp,

        // UI helpers
        formStatusLabel,
        formStatusColor,
        formStatusBadge,
        phaseLabel,
        phaseColor,

        // Config (exposed untuk display/debugging)
        config: cfg,
    };
}
