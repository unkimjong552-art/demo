<!--
  AssessmentReport.vue
  Halaman report profesional yang dibuka di window baru.
  Dibaca dari localStorage key: physassess_report_preview
  Dioptimalkan untuk print / Save as PDF (A4 portrait).
-->
<template>
  <div class="report-shell">

    <!-- ── Web Preview Wrapper ── -->
    <div class="report-paper">

      <!-- ══ HEADER ══════════════════════════════════════════════════════ -->
      <header class="rp-header">
        <div class="rp-header-brand">
          <div class="rp-logo-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
          <div>
            <div class="rp-brand-name">PHYSASSESS</div>
            <div class="rp-brand-sub">Physical Assessment System</div>
          </div>
        </div>
        <div class="rp-header-right">
          <div class="rp-report-title">ASSESSMENT REPORT</div>
          <div class="rp-report-meta">
            <span>ID: {{ shortId }}</span>
            <span>{{ data.date }} {{ data.time }}</span>
          </div>
        </div>
      </header>

      <!-- ══ NOT FOUND ═══════════════════════════════════════════════════ -->
      <div v-if="!data" class="rp-notfound">
        <div class="rp-notfound-icon">📋</div>
        <h2>Assessment Tidak Ditemukan</h2>
        <p>Assessment yang diminta tidak tersedia atau data sudah kadaluarsa.</p>
        <button @click="window.close()" class="rp-btn-back">Tutup</button>
      </div>

      <template v-else>

        <!-- ══ ATHLETE INFORMATION ══════════════════════════════════════ -->
        <section class="rp-section">
          <h2 class="rp-section-title">ATHLETE INFORMATION</h2>
          <div class="rp-info-grid">
            <div class="rp-info-item">
              <span class="rp-info-label">Nama Atlet</span>
              <span class="rp-info-value rp-highlight">{{ data.athleteName || '—' }}</span>
            </div>
            <div class="rp-info-item">
              <span class="rp-info-label">Jenis Tes</span>
              <span class="rp-info-value">{{ data.testName || '—' }}</span>
            </div>
            <div class="rp-info-item">
              <span class="rp-info-label">Kategori</span>
              <span class="rp-info-value">
                <span :class="['rp-badge', categoryClass(data.category)]">{{ data.category || '—' }}</span>
              </span>
            </div>
            <div class="rp-info-item">
              <span class="rp-info-label">Tanggal</span>
              <span class="rp-info-value">{{ data.date || '—' }}</span>
            </div>
            <div class="rp-info-item">
              <span class="rp-info-label">Waktu</span>
              <span class="rp-info-value">{{ data.time || '—' }}</span>
            </div>
            <div class="rp-info-item">
              <span class="rp-info-label">Durasi Sesi</span>
              <span class="rp-info-value">{{ formatDuration(data.durationSec) }}</span>
            </div>
            <div class="rp-info-item">
              <span class="rp-info-label">Status</span>
              <span class="rp-info-value rp-status-done">Selesai ✓</span>
            </div>
          </div>
        </section>

        <!-- ══ RESULT SUMMARY ═══════════════════════════════════════════ -->
        <section class="rp-section">
          <h2 class="rp-section-title">RESULT SUMMARY</h2>
          <div class="rp-cards-3">

            <!-- HASIL -->
            <div class="rp-card rp-card-result">
              <div class="rp-card-label">HASIL</div>
              <div class="rp-card-value">{{ data.resultDisplay || '—' }}</div>
              <div v-if="data.estimated" class="rp-card-note">Estimasi</div>
            </div>

            <!-- BENCHMARK -->
            <div class="rp-card rp-card-benchmark">
              <div class="rp-card-label">BENCHMARK</div>
              <div v-if="data.benchmarkSnapshot" class="rp-card-value">
                {{ data.benchmarkSnapshot.value }} {{ data.benchmarkSnapshot.unit }}
              </div>
              <div v-else class="rp-card-empty">Belum dikonfigurasi</div>
            </div>

            <!-- PENCAPAIAN -->
            <div class="rp-card rp-card-achievement"
                 :class="{
                   'rp-card-ach-high':   data.achievement >= 80,
                   'rp-card-ach-mid':    data.achievement >= 50 && data.achievement < 80,
                   'rp-card-ach-low':    data.achievement != null && data.achievement < 50,
                 }">
              <div class="rp-card-label">PENCAPAIAN</div>
              <div v-if="data.achievement != null" class="rp-card-value rp-card-value-big">
                {{ formatPct(data.achievement) }}%
              </div>
              <div v-else class="rp-card-empty">—</div>
            </div>

          </div>
        </section>

        <!-- ══ PERFORMANCE ══════════════════════════════════════════════ -->
        <section class="rp-section" v-if="data.achievement != null">
          <h2 class="rp-section-title">PERFORMANCE</h2>
          <div class="rp-perf-box">
            <div class="rp-perf-header">
              <span class="rp-perf-pct"
                    :class="{
                      'rp-pct-high': data.achievement >= 80,
                      'rp-pct-mid':  data.achievement >= 50,
                      'rp-pct-low':  data.achievement < 50,
                    }">
                {{ formatPct(data.achievement) }}%
              </span>
              <span class="rp-perf-desc">dari benchmark {{ data.benchmarkSnapshot?.value }} {{ data.benchmarkSnapshot?.unit }}</span>
            </div>
            <!-- Progress bar -->
            <div class="rp-bar-track">
              <div class="rp-bar-fill"
                   :class="{
                     'rp-bar-high': data.achievement >= 80,
                     'rp-bar-mid':  data.achievement >= 50 && data.achievement < 80,
                     'rp-bar-low':  data.achievement < 50,
                   }"
                   :style="{ width: data.achievement + '%' }">
              </div>
            </div>
            <div class="rp-bar-labels">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>

            <!-- Level badge -->
            <div class="rp-level-row">
              <span class="rp-level-badge"
                    :class="{
                      'rp-level-excellent': data.achievement >= 80,
                      'rp-level-good':      data.achievement >= 60 && data.achievement < 80,
                      'rp-level-fair':      data.achievement >= 40 && data.achievement < 60,
                      'rp-level-low':       data.achievement < 40,
                    }">
                {{ performanceLevel(data.achievement) }}
              </span>
            </div>
          </div>
        </section>

        <!-- ══ MOVEMENT ANALYSIS ════════════════════════════════════════ -->
        <section class="rp-section">
          <h2 class="rp-section-title">MOVEMENT ANALYSIS</h2>
          <div class="rp-analysis-box">
            <p class="rp-analysis-note">Detail analisis belum tersedia.</p>
            <p class="rp-analysis-sub">Data analisis gerakan secara real-time tersedia selama sesi assessment. Untuk laporan lengkap dengan data sensor pose, lihat Debug Panel di aplikasi.</p>
          </div>
        </section>

        <!-- ══ VIDEO ANALYSIS ═══════════════════════════════════════════ -->
        <section class="rp-section">
          <h2 class="rp-section-title">VIDEO ANALYSIS</h2>
          <div class="rp-video-box">
            <svg class="rp-video-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.362a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
            </svg>
            <p class="rp-video-note">Video analisis tidak tersedia untuk assessment ini.</p>
          </div>
        </section>

      </template>

      <!-- ══ FOOTER ═══════════════════════════════════════════════════════ -->
      <footer class="rp-footer">
        <div class="rp-footer-left">
          <span>Assessment ID: {{ shortId }}</span>
        </div>
        <div class="rp-footer-center">
          <span>Generated: {{ generatedDate }}</span>
        </div>
        <div class="rp-footer-right">
          <span>Trainer: Admin</span>
        </div>
      </footer>

    </div><!-- /report-paper -->

    <!-- ── Print Button (hidden when printing) ── -->
    <div class="rp-actions no-print">
      <button @click="doPrint" class="rp-btn-print">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
        </svg>
        Print / Save as PDF
      </button>
      <button @click="window.close()" class="rp-btn-close">
        Tutup
      </button>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

const PREVIEW_KEY = 'physassess_report_preview';

const data = ref(null);

onMounted(() => {
    try {
        const raw = localStorage.getItem(PREVIEW_KEY);
        if (raw) {
            data.value = JSON.parse(raw);
            // Clean up after read so it doesn't linger
            // Keep for a short time in case user refreshes
        }
    } catch (e) {
        data.value = null;
    }
});

const shortId = computed(() => {
    if (!data.value?.id) return '—';
    // Take first 8 chars of timestamp-based id
    return '#' + data.value.id.slice(0, 8);
});

const generatedDate = computed(() => {
    return new Date().toLocaleDateString('id-ID', {
        day: '2-digit', month: 'long', year: 'numeric'
    });
});

function formatDuration(sec) {
    if (!sec) return '—';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m} menit ${s} detik` : `${s} detik`;
}

function formatPct(val) {
    if (val == null) return '—';
    // Format with Indonesian locale (comma decimal)
    return val.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

function performanceLevel(val) {
    if (val == null) return '—';
    if (val >= 80) return 'Sangat Baik';
    if (val >= 60) return 'Baik';
    if (val >= 40) return 'Cukup';
    return 'Perlu Peningkatan';
}

function categoryClass(cat) {
    const map = {
        Balance:     'rp-cat-balance',
        Endurance:   'rp-cat-endurance',
        Strength:    'rp-cat-strength',
        Mobility:    'rp-cat-mobility',
        Power:       'rp-cat-power',
        Flexibility: 'rp-cat-flexibility',
    };
    return map[cat] ?? '';
}

function doPrint() {
    window.print();
}
</script>

<style>
/* ══════════════════════════════════════════════════════════════════════════
   CSS Variables
═══════════════════════════════════════════════════════════════════════════ */
:root {
  --rp-accent:    #6366f1;
  --rp-text:      #1e293b;
  --rp-muted:     #64748b;
  --rp-border:    #e2e8f0;
  --rp-bg-card:   #f8fafc;
  --rp-white:     #ffffff;
  --rp-high:      #059669;
  --rp-mid:       #d97706;
  --rp-low:       #dc2626;
}

/* ── Shell (web preview background) ── */
body { margin: 0; padding: 0; background: #f1f5f9; font-family: 'Inter', system-ui, sans-serif; }

.report-shell {
  min-height: 100vh;
  padding: 32px 16px 80px;
  background: #f1f5f9;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* ── Paper (the report itself) ── */
.report-paper {
  width: 100%;
  max-width: 794px;    /* A4 width at 96dpi */
  background: var(--rp-white);
  box-shadow: 0 4px 32px rgba(0,0,0,0.12);
  border-radius: 8px;
  overflow: hidden;
  padding: 48px 56px;
  box-sizing: border-box;
}

/* ══ HEADER ════════════════════════════════════════════════════════════ */
.rp-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 24px;
  border-bottom: 2px solid var(--rp-accent);
  margin-bottom: 32px;
}

.rp-header-brand { display: flex; align-items: center; gap: 12px; }

.rp-logo-mark {
  width: 44px; height: 44px;
  background: var(--rp-accent);
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  color: white;
  flex-shrink: 0;
}
.rp-logo-mark svg { width: 24px; height: 24px; }

.rp-brand-name {
  font-size: 16px; font-weight: 800; color: var(--rp-text);
  letter-spacing: 0.08em;
}
.rp-brand-sub { font-size: 11px; color: var(--rp-muted); margin-top: 1px; }

.rp-header-right { text-align: right; }
.rp-report-title {
  font-size: 14px; font-weight: 700; color: var(--rp-accent);
  letter-spacing: 0.12em; text-transform: uppercase;
}
.rp-report-meta {
  font-size: 11px; color: var(--rp-muted);
  display: flex; gap: 12px; justify-content: flex-end; margin-top: 4px;
}

/* ══ SECTIONS ════════════════════════════════════════════════════════ */
.rp-section { margin-bottom: 28px; }

.rp-section-title {
  font-size: 10px; font-weight: 700; color: var(--rp-muted);
  letter-spacing: 0.15em; text-transform: uppercase;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--rp-border);
  margin-bottom: 16px;
}

/* ══ ATHLETE INFO ════════════════════════════════════════════════════ */
.rp-info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px 24px;
}
.rp-info-item {
  display: flex; flex-direction: column; gap: 2px;
  padding: 10px 12px;
  background: var(--rp-bg-card);
  border-radius: 6px;
  border: 1px solid var(--rp-border);
}
.rp-info-label { font-size: 10px; color: var(--rp-muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; }
.rp-info-value { font-size: 14px; color: var(--rp-text); font-weight: 600; }
.rp-highlight   { color: var(--rp-accent) !important; }
.rp-status-done { color: var(--rp-high) !important; }

/* Badges */
.rp-badge {
  display: inline-block; padding: 2px 8px; border-radius: 999px;
  font-size: 11px; font-weight: 600;
}
.rp-cat-balance     { background: #ede9fe; color: #6d28d9; }
.rp-cat-endurance   { background: #dbeafe; color: #1d4ed8; }
.rp-cat-strength    { background: #d1fae5; color: #065f46; }
.rp-cat-mobility    { background: #cffafe; color: #0e7490; }
.rp-cat-power       { background: #fef9c3; color: #92400e; }
.rp-cat-flexibility { background: #fce7f3; color: #9d174d; }

/* ══ RESULT CARDS ════════════════════════════════════════════════════ */
.rp-cards-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.rp-card {
  padding: 20px 16px 18px;
  border-radius: 8px;
  border: 1px solid var(--rp-border);
  background: var(--rp-bg-card);
  display: flex; flex-direction: column; gap: 6px;
}
.rp-card-label {
  font-size: 9px; font-weight: 700; color: var(--rp-muted);
  letter-spacing: 0.15em; text-transform: uppercase;
}
.rp-card-value { font-size: 22px; font-weight: 800; color: var(--rp-text); line-height: 1.1; }
.rp-card-value-big { font-size: 28px; }
.rp-card-note  { font-size: 10px; color: var(--rp-mid); font-style: italic; }
.rp-card-empty { font-size: 13px; color: var(--rp-muted); font-style: italic; }

.rp-card-result     { border-top: 3px solid var(--rp-accent); }
.rp-card-benchmark  { border-top: 3px solid #94a3b8; }
.rp-card-achievement { border-top: 3px solid var(--rp-text); }
.rp-card-ach-high   { border-top-color: var(--rp-high) !important; }
.rp-card-ach-mid    { border-top-color: var(--rp-mid) !important; }
.rp-card-ach-low    { border-top-color: var(--rp-low) !important; }

/* ══ PERFORMANCE ═════════════════════════════════════════════════════ */
.rp-perf-box {
  background: var(--rp-bg-card);
  border: 1px solid var(--rp-border);
  border-radius: 8px;
  padding: 20px 24px;
}
.rp-perf-header {
  display: flex; align-items: baseline; gap: 10px; margin-bottom: 14px;
}
.rp-perf-pct {
  font-size: 36px; font-weight: 900; line-height: 1;
}
.rp-pct-high { color: var(--rp-high); }
.rp-pct-mid  { color: var(--rp-mid);  }
.rp-pct-low  { color: var(--rp-low);  }
.rp-perf-desc { font-size: 12px; color: var(--rp-muted); }

.rp-bar-track {
  width: 100%; height: 12px; background: #e2e8f0;
  border-radius: 999px; overflow: hidden; margin-bottom: 6px;
}
.rp-bar-fill {
  height: 100%; border-radius: 999px;
  transition: width 0.8s ease;
}
.rp-bar-high { background: var(--rp-high); }
.rp-bar-mid  { background: var(--rp-mid);  }
.rp-bar-low  { background: var(--rp-low);  }

.rp-bar-labels {
  display: flex; justify-content: space-between;
  font-size: 10px; color: var(--rp-muted); margin-bottom: 14px;
}

.rp-level-row { margin-top: 8px; }
.rp-level-badge {
  display: inline-block; padding: 4px 14px; border-radius: 999px;
  font-size: 12px; font-weight: 700;
}
.rp-level-excellent { background: #d1fae5; color: #065f46; }
.rp-level-good      { background: #dbeafe; color: #1d4ed8; }
.rp-level-fair      { background: #fef9c3; color: #92400e; }
.rp-level-low       { background: #fee2e2; color: #991b1b; }

/* ══ ANALYSIS / VIDEO ════════════════════════════════════════════════ */
.rp-analysis-box {
  background: var(--rp-bg-card); border: 1px solid var(--rp-border);
  border-radius: 8px; padding: 20px 24px;
}
.rp-analysis-note { font-size: 13px; color: var(--rp-muted); margin: 0 0 6px; }
.rp-analysis-sub  { font-size: 11px; color: #94a3b8; margin: 0; line-height: 1.5; }

.rp-video-box {
  background: var(--rp-bg-card); border: 1px dashed var(--rp-border);
  border-radius: 8px; padding: 32px 24px;
  display: flex; flex-direction: column; align-items: center; gap: 10px;
}
.rp-video-icon { width: 40px; height: 40px; color: #cbd5e1; }
.rp-video-note { font-size: 12px; color: var(--rp-muted); text-align: center; margin: 0; }

/* ══ FOOTER ══════════════════════════════════════════════════════════ */
.rp-footer {
  margin-top: 36px;
  padding-top: 16px;
  border-top: 1px solid var(--rp-border);
  display: flex; justify-content: space-between;
  font-size: 10px; color: #94a3b8;
}

/* ══ NOT FOUND ═══════════════════════════════════════════════════════ */
.rp-notfound {
  text-align: center; padding: 64px 32px;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
}
.rp-notfound-icon { font-size: 48px; }
.rp-notfound h2 { font-size: 20px; color: var(--rp-text); margin: 0; }
.rp-notfound p  { font-size: 13px; color: var(--rp-muted); margin: 0; }
.rp-btn-back {
  margin-top: 8px; padding: 8px 20px;
  background: var(--rp-accent); color: white;
  border: none; border-radius: 6px; cursor: pointer;
  font-size: 13px; font-weight: 600;
}

/* ══ ACTION BUTTONS ══════════════════════════════════════════════════ */
.rp-actions {
  margin-top: 24px;
  display: flex; gap: 12px;
}
.rp-btn-print {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 24px;
  background: var(--rp-accent); color: white;
  border: none; border-radius: 8px; cursor: pointer;
  font-size: 14px; font-weight: 600;
  transition: opacity 0.15s;
}
.rp-btn-print:hover { opacity: 0.9; }
.rp-btn-close {
  padding: 10px 24px;
  background: transparent; color: var(--rp-muted);
  border: 1px solid var(--rp-border); border-radius: 8px; cursor: pointer;
  font-size: 14px; font-weight: 500;
}
.rp-btn-close:hover { background: var(--rp-bg-card); }

/* ══ PRINT STYLES ════════════════════════════════════════════════════ */
@media print {
  @page {
    size: A4 portrait;
    margin: 10mm 12mm;
  }

  /* Hide the Vue mount point children we don't need,
     but NOT #report-app itself — it contains .report-shell */
  body               { background: white !important; }
  body > *           { display: none !important; }

  /* Re-show the Vue root and the shell inside it */
  body > #report-app { display: block !important; }
  .report-shell      { display: block !important; padding: 0 !important; background: white !important; }
  .report-paper      {
    display: block !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
    max-width: 100% !important;
    width: 100% !important;
  }

  /* Hide non-print elements */
  .no-print          { display: none !important; }

  /* Prevent card breaking across pages */
  .rp-card, .rp-info-item, .rp-perf-box, .rp-analysis-box, .rp-video-box {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* Section headers */
  .rp-section {
    break-inside: avoid;
  }

  /* Force black text for readability */
  .rp-card-value, .rp-info-value, .rp-perf-pct { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .rp-bar-fill, .rp-level-badge, .rp-badge { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
