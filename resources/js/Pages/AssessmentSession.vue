<template>
    <PhysicalAssessmentLayout
        :current-page="currentPage"
        :page-title="`Tes: ${test.name}`"
        page-subtitle="Camera Assessment Session"
        @navigate="handleNavigate"
    >
        <!-- Back button + Test info bar -->
        <div class="flex items-center gap-4 mb-6">
            <button
                @click="handleBack"
                class="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-800 border border-white/5 text-slate-400 hover:text-white hover:border-white/10 transition-all duration-200 text-sm font-medium"
            >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                </svg>
                Kembali
            </button>

            <div class="flex items-center gap-3">
                <span class="text-2xl">{{ test.icon }}</span>
                <div>
                    <h2 class="text-base font-bold text-white leading-tight">{{ test.name }}</h2>
                    <div class="flex items-center gap-2 mt-0.5">
                        <span :class="['text-xs font-semibold px-2 py-0.5 rounded-full', categoryBadge]">
                            {{ test.category }}
                        </span>
                        <span class="text-xs text-slate-500">{{ test.unit }}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Main layout: Camera (left) + Controls (right) -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">


            <!-- Camera area (2/3 width) -->
            <div class="lg:col-span-2">

                <!-- ── MODE: REALTIME CAMERA ── -->
                <template v-if="assessmentMode === 'camera'">
                <div class="relative">
                <CameraPreview
                    ref="cameraRef"
                    :is-assessing="sessionState === 'assessing' && !isCountingDown"
                    :elapsed-seconds="elapsedSeconds"
                    @camera-ready="onCameraReady"
                    @camera-stopped="onCameraStopped"
                    @camera-error="onCameraError"
                >
                    <!-- Slot overlay: PoseDetector canvas ditumpuk di atas video -->
                    <template #overlay>
                        <PoseDetector
                            :video-element="activeVideoElement"
                            :active="sessionState === 'assessing' && !isCountingDown"
                            @pose-status="onPoseStatus"
                            @pose-update="onPoseUpdate"
                            @perf-update="onPerfUpdate"
                        />
                    </template>
                </CameraPreview>

                <!-- Countdown overlay -->
                <transition name="countdown-fade">
                    <div v-if="isCountingDown"
                         class="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm z-20 pointer-events-none">
                        <span class="text-8xl font-black text-white tabular-nums leading-none drop-shadow-2xl" style="text-shadow:0 0 40px rgba(99,102,241,0.8)">
                            {{ countdownValue }}
                        </span>
                        <p class="text-slate-300 text-sm font-semibold mt-3 tracking-widest uppercase">Bersiap...</p>
                    </div>
                </transition>

                <!-- Timer countdown bar (saat assessing) -->
                <div v-if="sessionState === 'assessing' && !isCountingDown" class="mt-2">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-xs text-slate-500">Sisa Waktu</span>
                        <span class="text-sm font-mono font-bold"
                              :class="remainingSeconds <= 10 ? 'text-red-400 animate-pulse' : remainingSeconds <= 20 ? 'text-yellow-400' : 'text-emerald-400'">
                            {{ remainingFormatted }}
                        </span>
                    </div>
                    <div class="w-full h-1.5 rounded-full bg-dark-800 overflow-hidden">
                        <div class="h-full rounded-full transition-all duration-1000"
                             :class="remainingSeconds <= 10 ? 'bg-red-500' : remainingSeconds <= 20 ? 'bg-yellow-500' : 'bg-emerald-500'"
                             :style="{ width: `${assessmentDurationSec > 0 ? (remainingSeconds / assessmentDurationSec) * 100 : 0}%` }">
                        </div>
                    </div>
                </div>
                </div>

                <!-- Camera control buttons -->
                <div class="flex items-center gap-3 mt-4">
                    <!-- Activate camera -->
                    <button
                        v-if="sessionState === 'idle'"
                        @click="activateCamera"
                        class="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl
                               bg-primary-600 hover:bg-primary-500 text-white font-semibold text-sm
                               transition-all duration-200 shadow-lg shadow-primary-500/25"
                    >
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.362a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                        </svg>
                        Aktifkan Kamera
                    </button>

                    <!-- Camera ready: Start Assessment -->
                    <template v-if="sessionState === 'cameraReady'">
                        <button
                            @click="startAssessment"
                            class="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl
                                   bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm
                                   transition-all duration-200 shadow-lg shadow-emerald-500/25"
                        >
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                                <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            Mulai Assessment
                        </button>
                        <button
                            @click="deactivateCamera"
                            class="px-4 py-3 rounded-xl bg-dark-800 hover:bg-dark-800/70 border border-white/5
                                   text-slate-400 hover:text-white transition-all duration-200 text-sm font-medium"
                        >
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                            </svg>
                        </button>
                    </template>

                    <!-- Assessment running: Stop -->
                    <template v-if="sessionState === 'assessing'">
                        <button
                            @click="stopAssessment"
                            class="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl
                                   bg-red-600 hover:bg-red-500 text-white font-bold text-sm
                                   transition-all duration-200 shadow-lg shadow-red-500/25 animate-pulse"
                        >
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                <path stroke-linecap="round" stroke-linejoin="round" d="M9 10h6v4H9z"/>
                            </svg>
                            Stop Assessment
                        </button>
                    </template>

                    <!-- Stopped / finished -->
                    <template v-if="sessionState === 'stopped'">
                        <button
                            @click="restartSession"
                            class="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl
                                   bg-primary-600 hover:bg-primary-500 text-white font-semibold text-sm
                                   transition-all duration-200"
                        >
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                            </svg>
                            Ulangi Tes
                        </button>
                        <button
                            @click="handleBack"
                            class="px-4 py-3 rounded-xl bg-dark-800 border border-white/5 text-slate-400 hover:text-white transition-all duration-200 text-sm font-medium"
                        >
                            Selesai
                        </button>
                    </template>
                </div>
                </template>
                <!-- ── END MODE: REALTIME CAMERA ── -->

            </div>

            <!-- Right panel: Info & Status -->
            <div class="flex flex-col gap-4">

                <!-- Session status card -->
                <div class="card p-5">
                    <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Status Sesi</h3>

                    <div class="space-y-3">
                        <!-- Session state -->
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Status</span>
                            <span :class="['text-xs font-bold px-2.5 py-1 rounded-full', sessionStateBadge.class]">
                                {{ sessionStateBadge.label }}
                            </span>
                        </div>

                        <!-- Duration -->
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Durasi</span>
                            <span class="text-xs font-mono font-bold text-white">{{ elapsedFormatted }}</span>
                        </div>

                        <!-- Camera status -->
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Kamera</span>
                            <div class="flex items-center gap-1.5">
                                <div :class="['w-1.5 h-1.5 rounded-full', cameraActive ? 'bg-emerald-500' : 'bg-slate-600']"></div>
                                <span class="text-xs font-medium" :class="cameraActive ? 'text-emerald-400' : 'text-slate-600'">
                                    {{ cameraActive ? 'Aktif' : 'Tidak Aktif' }}
                                </span>
                            </div>
                        </div>

                        <!-- Divider -->
                        <div class="border-t border-white/5 pt-3">
                            <!-- Pose detection status -->
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-xs text-slate-500">AI Pose</span>
                                <div class="flex items-center gap-1.5">
                                    <div :class="['w-1.5 h-1.5 rounded-full transition-colors duration-300', poseStatusDot]"></div>
                                    <span class="text-xs font-medium" :class="poseStatusTextColor">
                                        {{ poseStatusLabel }}
                                    </span>
                                </div>
                            </div>

                            <!-- Landmark counter (hanya tampil saat assessing) -->
                            <template v-if="sessionState === 'assessing'">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-xs text-slate-600">Landmark</span>
                                    <span class="text-xs font-mono font-bold" :class="poseDetected ? 'text-emerald-400' : 'text-slate-500'">
                                        {{ poseDetectedCount }}/{{ poseTotalTarget }}
                                    </span>
                                </div>

                                <!-- Landmark progress bar -->
                                <div class="w-full h-1.5 rounded-full bg-dark-800 overflow-hidden">
                                    <div
                                        class="h-full rounded-full transition-all duration-300"
                                        :class="poseDetected ? 'bg-emerald-500' : 'bg-slate-700'"
                                        :style="{ width: `${poseTotalTarget > 0 ? (poseDetectedCount / poseTotalTarget) * 100 : 0}%` }"
                                    ></div>
                                </div>

                                <!-- Visibility/Confidence -->
                                <div class="flex items-center justify-between mt-2">
                                    <span class="text-xs text-slate-600">Confidence</span>
                                    <span class="text-xs font-mono font-bold" :class="poseDetected ? 'text-cyan-400' : 'text-slate-500'">
                                        {{ poseVisibility }}%
                                    </span>
                                </div>
                            </template>

                            <!-- Tidak assessing: info singkat -->
                            <template v-else>
                                <p class="text-xs text-slate-600 mt-1">
                                    Mulai assessment untuk mengaktifkan deteksi pose.
                                </p>
                            </template>
                        </div>
                    </div>
                </div>

                <!-- Pose Validation card (tampil hanya saat assessing) -->
                <div v-if="sessionState === 'assessing'" class="card p-5">
                    <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Validasi Posisi</h3>

                    <!-- Status utama -->
                    <div class="flex items-center gap-3 mb-4 p-3 rounded-xl bg-dark-900/60 border border-white/5">
                        <span class="text-xl leading-none">{{ poseValidationIcon }}</span>
                        <div class="flex-1 min-w-0">
                            <p class="text-xs font-bold" :class="poseValidationColor">
                                {{ poseValidationMessage }}
                            </p>
                            <p v-if="invalidReason" class="text-xs text-slate-500 mt-0.5 leading-relaxed truncate" :title="invalidReason">
                                {{ invalidReason }}
                            </p>
                        </div>
                        <div :class="['w-2 h-2 rounded-full flex-shrink-0', poseValidationDot]"></div>
                    </div>

                    <!-- Status badge -->
                    <div class="flex items-center justify-between mb-3">
                        <span class="text-xs text-slate-600">Status</span>
                        <span class="text-xs font-mono font-bold px-2 py-0.5 rounded"
                              :class="{
                                  'bg-slate-800 text-slate-400':   validationStatus === 'NO_BODY',
                                  'bg-yellow-500/10 text-yellow-400': validationStatus === 'BODY_DETECTED',
                                  'bg-orange-500/10 text-orange-400': validationStatus === 'POSITION_INVALID',
                                  'bg-emerald-500/10 text-emerald-400': validationStatus === 'READY',
                              }">
                            {{ validationStatus }}
                        </span>
                    </div>

                    <!-- Progress bar stabilisasi (hanya tampil saat menuju READY) -->
                    <template v-if="validationStatus !== 'NO_BODY' && !poseIsReady">
                        <div class="flex items-center justify-between mb-1.5">
                            <span class="text-xs text-slate-600">Stabilisasi</span>
                            <span class="text-xs font-mono text-slate-500">{{ stabilizationProgress }}%</span>
                        </div>
                        <div class="w-full h-1.5 rounded-full bg-dark-800 overflow-hidden">
                            <div
                                class="h-full rounded-full transition-all duration-200 bg-emerald-500/60"
                                :style="{ width: `${stabilizationProgress}%` }"
                            ></div>
                        </div>
                        <p class="text-xs text-slate-600 mt-2">
                            Tahan posisi beberapa detik agar sistem stabil
                        </p>
                    </template>

                    <!-- READY state indicator -->
                    <template v-if="poseIsReady">
                        <div class="flex items-center gap-2 mt-1 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                            <span class="relative flex h-2 w-2">
                                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span class="text-xs font-semibold text-emerald-400">Posisi terkunci — sistem berjalan</span>
                        </div>
                    </template>
                </div>

                <!-- Movement Status card (tampil hanya saat assessing) -->
                <div v-if="sessionState === 'assessing'" class="card p-5">
                    <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Movement Status</h3>

                    <!-- Push Up detection -->
                    <template v-if="isPushUpTest">

                        <!-- Repetisi — angka besar di tengah -->
                        <div class="flex items-center justify-between mb-4">
                            <span class="text-xs text-slate-500">Repetisi</span>
                            <span class="text-3xl font-black text-white font-mono leading-none">
                                {{ pushUpCount }}
                            </span>
                        </div>

                        <!-- Phase -->
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-slate-600">Phase</span>
                            <span class="text-xs font-bold font-mono" :class="pushUpPhaseColor">
                                {{ pushUpPhaseLabel }}
                            </span>
                        </div>

                        <!-- Form -->
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-slate-600">Form</span>
                            <span :class="['text-xs font-bold px-2 py-0.5 rounded border', pushUpFormBadge]">
                                {{ pushUpFormLabel }}
                            </span>
                        </div>

                        <!-- Elbow Angle -->
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-slate-600">Elbow Angle</span>
                            <span class="text-xs font-mono font-bold text-cyan-400">
                                {{ pushUpElbowAngle > 0 ? `${pushUpElbowAngle}°` : '—' }}
                            </span>
                        </div>

                        <!-- Body Alignment -->
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-xs text-slate-600">Body Alignment</span>
                            <span class="text-xs font-mono font-bold text-cyan-400">
                                {{ pushUpBodyAngle > 0 ? `${pushUpBodyAngle}°` : '—' }}
                            </span>
                        </div>

                        <!-- Feedback -->
                        <div class="p-2.5 rounded-lg bg-dark-900/60 border border-white/5 min-h-[40px]">
                            <p v-if="pushUpFeedback" class="text-xs leading-relaxed"
                               :class="{
                                   'text-emerald-400': pushUpFormStatus === 'GOOD_FORM',
                                   'text-red-400':     pushUpFormStatus === 'BAD_FORM',
                                   'text-yellow-400':  pushUpFormStatus === 'ADJUST_POSITION',
                                   'text-slate-400':   pushUpFormStatus === 'NO_DATA',
                               }">
                                {{ pushUpFeedback }}
                            </p>
                            <p v-else class="text-xs text-slate-600">Menunggu gerakan...</p>
                        </div>

                    </template>

                    <!-- Sit Up detection -->
                    <template v-else-if="isSitUpTest">

                        <!-- Repetisi -->
                        <div class="flex items-center justify-between mb-4">
                            <span class="text-xs text-slate-500">Repetisi</span>
                            <span class="text-3xl font-black text-white font-mono leading-none">
                                {{ sitUpCount }}
                            </span>
                        </div>

                        <!-- Phase -->
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-slate-600">Phase</span>
                            <span class="text-xs font-bold font-mono" :class="sitUpPhaseColor">
                                {{ sitUpPhaseLabel }}
                            </span>
                        </div>

                        <!-- Form -->
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-slate-600">Form</span>
                            <span :class="['text-xs font-bold px-2 py-0.5 rounded border', sitUpFormBadge]">
                                {{ sitUpFormStatus }}
                            </span>
                        </div>

                        <!-- Hip Angle -->
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-slate-600">Hip Angle</span>
                            <span class="text-xs font-mono font-bold text-cyan-400">
                                {{ sitUpHipAngle > 0 ? `${sitUpHipAngle}°` : '—' }}
                            </span>
                        </div>

                        <!-- Counting Side -->
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-xs text-slate-600">Counting Side</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="{
                                      'text-emerald-400': sitUpCountingSide === 'BOTH',
                                      'text-cyan-400':    sitUpCountingSide === 'LEFT' || sitUpCountingSide === 'RIGHT',
                                      'text-slate-500':   sitUpCountingSide === '—',
                                  }">
                                {{ sitUpCountingSide }}
                            </span>
                        </div>

                        <!-- Feedback -->
                        <div class="p-2.5 rounded-lg bg-dark-900/60 border border-white/5 min-h-[40px]">
                            <p v-if="sitUpFeedback" class="text-xs leading-relaxed text-slate-300">{{ sitUpFeedback }}</p>
                            <p v-else class="text-xs text-slate-600">Menunggu gerakan...</p>
                        </div>

                    </template>

                    <!-- Elbow Plank detection -->
                    <template v-else-if="isElbowPlankTest">

                        <!-- Hold Duration -->
                        <div class="flex items-center justify-between mb-4">
                            <span class="text-xs text-slate-500">Durasi Plank</span>
                            <span class="text-3xl font-black font-mono leading-none"
                                  :class="plankIsHolding ? 'text-emerald-400' : 'text-white'">
                                {{ plankHoldDurationFormatted }}
                            </span>
                        </div>

                        <!-- Phase -->
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-slate-600">Status</span>
                            <span class="text-xs font-bold font-mono" :class="plankPhaseColor">
                                {{ plankPhaseLabel }}
                            </span>
                        </div>

                        <!-- Body Angle -->
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-slate-600">Body Angle</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="plankBodyAngle >= 160 ? 'text-emerald-400' : 'text-cyan-400'">
                                {{ plankBodyAngle > 0 ? `${plankBodyAngle}°` : '—' }}
                            </span>
                        </div>

                        <!-- Orientation -->
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-xs text-slate-600">Orientasi</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="plankDebugAlignment?.plankValid ? 'text-emerald-400' : 'text-red-400'">
                                {{ plankDebugAlignment?.plankValid ? 'PLANK ✓' : 'NOT PLANK ✗' }}
                            </span>
                        </div>

                        <!-- Feedback -->
                        <div class="p-2.5 rounded-lg bg-dark-900/60 border border-white/5 min-h-[40px]">
                            <p v-if="plankFeedback" class="text-xs leading-relaxed text-slate-300">
                                {{ plankFeedback }}
                            </p>
                            <p v-else class="text-xs text-slate-600">Ambil posisi plank untuk memulai...</p>
                        </div>

                        <!-- Total sesi -->
                        <div v-if="plankTotalDuration > 0" class="mt-3 flex items-center justify-between">
                            <span class="text-xs text-slate-600">Total sesi</span>
                            <span class="text-xs font-mono text-slate-400">{{ plankTotalDuration.toFixed(1) }}s</span>
                        </div>

                    </template>

                    <!-- Sit and Reach detection -->
                    <template v-else-if="isSitAndReachTest">

                        <!-- Best Reach — angka utama -->
                        <div class="flex items-center justify-between mb-4">
                            <span class="text-xs text-slate-500">Best Reach</span>
                            <span class="text-2xl font-black font-mono leading-none"
                                  :class="sitReachBestCm > 0 ? 'text-emerald-400' : sitReachBestCm < 0 ? 'text-yellow-400' : 'text-white'">
                                {{ sitReachBestCm !== 0 || sitReachBestDist < 999
                                    ? `${sitReachBestCm >= 0 ? '+' : ''}${sitReachBestCm} cm`
                                    : '—' }}
                            </span>
                        </div>

                        <!-- PROVISIONAL warning -->
                        <div class="text-xs text-slate-600 -mt-2 mb-3 italic">
                            ⚠ Estimasi kasar — belum dikalibrasi
                        </div>

                        <!-- Phase / Status -->
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-slate-600">Status</span>
                            <span class="text-xs font-bold font-mono" :class="sitReachPhaseColor">
                                {{ sitReachPhaseLabel }}
                            </span>
                        </div>

                        <!-- Reach saat ini -->
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-slate-600">Reach Sekarang</span>
                            <span class="text-xs font-mono text-cyan-400">
                                {{ sitReachDistance < 999 ? `${sitReachDistance.toFixed(3)} (norm)` : '—' }}
                            </span>
                        </div>

                        <!-- Sisi -->
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-slate-600">Sisi Valid</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="{
                                      'text-emerald-400': sitReachCountingSide === 'BOTH',
                                      'text-cyan-400':    sitReachCountingSide === 'LEFT' || sitReachCountingSide === 'RIGHT',
                                      'text-slate-500':   sitReachCountingSide === '—',
                                  }">
                                {{ sitReachCountingSide }}
                            </span>
                        </div>

                        <!-- Pose check -->
                        <div class="flex items-center gap-2 mb-3">
                            <span class="text-xs font-mono px-1.5 py-0.5 rounded"
                                  :class="sitReachSittingValid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'">
                                {{ sitReachSittingValid ? 'Duduk ✓' : 'Duduk ✗' }}
                            </span>
                            <span class="text-xs font-mono px-1.5 py-0.5 rounded"
                                  :class="sitReachLegStraightValid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'">
                                {{ sitReachLegStraightValid ? 'Kaki lurus ✓' : 'Kaki lurus ✗' }}
                            </span>
                        </div>

                        <!-- Feedback -->
                        <div class="p-2.5 rounded-lg bg-dark-900/60 border border-white/5 min-h-[40px]">
                            <p v-if="sitReachFeedback" class="text-xs leading-relaxed text-slate-300">
                                {{ sitReachFeedback }}
                            </p>
                            <p v-else class="text-xs text-slate-600">Duduk, luruskan kaki, lalu raih ujung kaki...</p>
                        </div>

                    </template>

                    <!-- Squat Jump detection -->
                    <template v-else-if="isSquatJumpTest">

                        <!-- Repetisi -->
                        <div class="flex items-center justify-between mb-4">
                            <span class="text-xs text-slate-500">Repetisi</span>
                            <span class="text-3xl font-black text-white font-mono leading-none">
                                {{ squatJumpCount }}
                            </span>
                        </div>

                        <!-- Phase -->
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-slate-600">Phase</span>
                            <span class="text-xs font-bold font-mono" :class="squatJumpPhaseColor">
                                {{ squatJumpPhaseLabel }}
                            </span>
                        </div>

                        <!-- Knee Angle -->
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-slate-600">Knee Angle</span>
                            <span class="text-xs font-mono font-bold text-cyan-400">
                                {{ squatJumpKneeAngle > 0 ? `${squatJumpKneeAngle}°` : '—' }}
                            </span>
                        </div>

                        <!-- Counting Side -->
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-xs text-slate-600">Sisi Valid</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="{
                                      'text-emerald-400': squatJumpCountingSide === 'BOTH',
                                      'text-cyan-400':    squatJumpCountingSide === 'LEFT' || squatJumpCountingSide === 'RIGHT',
                                      'text-slate-500':   squatJumpCountingSide === '—',
                                  }">
                                {{ squatJumpCountingSide }}
                            </span>
                        </div>

                        <!-- Feedback -->
                        <div class="p-2.5 rounded-lg bg-dark-900/60 border border-white/5 min-h-[40px]">
                            <p v-if="squatJumpFeedback" class="text-xs leading-relaxed text-slate-300">
                                {{ squatJumpFeedback }}
                            </p>
                            <p v-else class="text-xs text-slate-600">Lakukan squat lalu lompat...</p>
                        </div>

                    </template>

                    <!-- Deep Squat detection -->
                    <template v-else-if="isDeepSquatTest">

                        <!-- Repetisi -->
                        <div class="flex items-center justify-between mb-4">
                            <span class="text-xs text-slate-500">Repetisi</span>
                            <span class="text-3xl font-black text-white font-mono leading-none">
                                {{ deepSquatCount }}
                            </span>
                        </div>

                        <!-- Phase -->
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-slate-600">Phase</span>
                            <span class="text-xs font-bold font-mono" :class="deepSquatPhaseColor">
                                {{ deepSquatPhaseLabel }}
                            </span>
                        </div>

                        <!-- Knee Angle -->
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-slate-600">Knee Angle</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="deepSquatKneeAngle <= 110 && deepSquatKneeAngle > 0 ? 'text-orange-400' : 'text-cyan-400'">
                                {{ deepSquatKneeAngle > 0 ? `${deepSquatKneeAngle}°` : '—' }}
                            </span>
                        </div>

                        <!-- Counting Side -->
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-xs text-slate-600">Sisi Valid</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="{
                                      'text-emerald-400': deepSquatCountingSide === 'BOTH',
                                      'text-cyan-400':    deepSquatCountingSide === 'LEFT' || deepSquatCountingSide === 'RIGHT',
                                      'text-slate-500':   deepSquatCountingSide === '—',
                                  }">
                                {{ deepSquatCountingSide }}
                            </span>
                        </div>

                        <!-- Feedback -->
                        <div class="p-2.5 rounded-lg bg-dark-900/60 border border-white/5 min-h-[40px]">
                            <p v-if="deepSquatFeedback" class="text-xs leading-relaxed text-slate-300">
                                {{ deepSquatFeedback }}
                            </p>
                            <p v-else class="text-xs text-slate-600">Lakukan gerakan squat untuk memulai...</p>
                        </div>

                    </template>

                    <!-- Wall Sit detection -->
                    <template v-else-if="isWallSitTest">

                        <!-- Hold Duration -->
                        <div class="flex items-center justify-between mb-4">
                            <span class="text-xs text-slate-500">Durasi Hold</span>
                            <span class="text-3xl font-black font-mono leading-none"
                                  :class="isHolding ? 'text-emerald-400' : 'text-white'">
                                {{ holdDurationFormatted }}
                            </span>
                        </div>

                        <!-- Phase -->
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-slate-600">Status</span>
                            <span class="text-xs font-bold font-mono" :class="wallSitPhaseColor">
                                {{ wallSitPhaseLabel }}
                            </span>
                        </div>

                        <!-- Knee Angle -->
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-slate-600">Knee Angle</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="kneeAngle >= 80 && kneeAngle <= 100 ? 'text-emerald-400' : 'text-cyan-400'">
                                {{ kneeAngle > 0 ? `${kneeAngle}°` : '—' }}
                            </span>
                        </div>

                        <!-- Counting Side -->
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-xs text-slate-600">Sisi Valid</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="{
                                      'text-emerald-400': wallSitCountingSide === 'BOTH',
                                      'text-cyan-400':    wallSitCountingSide === 'LEFT' || wallSitCountingSide === 'RIGHT',
                                      'text-slate-500':   wallSitCountingSide === '—',
                                  }">
                                {{ wallSitCountingSide }}
                            </span>
                        </div>

                        <!-- Feedback -->
                        <div class="p-2.5 rounded-lg bg-dark-900/60 border border-white/5 min-h-[40px]">
                            <p v-if="wallSitFeedback" class="text-xs leading-relaxed text-slate-300">
                                {{ wallSitFeedback }}
                            </p>
                            <p v-else class="text-xs text-slate-600">Masuk posisi Wall Sit untuk memulai...</p>
                        </div>

                        <!-- Total sesi -->
                        <div v-if="wallSitTotalDuration > 0" class="mt-3 flex items-center justify-between">
                            <span class="text-xs text-slate-600">Total sesi</span>
                            <span class="text-xs font-mono text-slate-400">{{ wallSitTotalDuration.toFixed(1) }}s</span>
                        </div>

                    </template>

                    <!-- Static Balance detection -->
                    <template v-else-if="isStaticBalanceTest">

                        <!-- Duration — angka besar -->
                        <div class="flex items-center justify-between mb-4">
                            <span class="text-xs text-slate-500">Durasi Balance</span>
                            <span class="text-3xl font-black font-mono leading-none"
                                  :class="isBalancing ? 'text-emerald-400' : 'text-white'">
                                {{ balanceDurationFormatted }}
                            </span>
                        </div>

                        <!-- Phase -->
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-slate-600">Status</span>
                            <span class="text-xs font-bold font-mono" :class="balancePhaseColor">
                                {{ balancePhaseLabel }}
                            </span>
                        </div>

                        <!-- Standing Leg -->
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-slate-600">Kaki Tumpuan</span>
                            <span class="text-xs font-mono font-bold text-cyan-400">
                                {{ standingLeg }}
                            </span>
                        </div>

                        <!-- Ankle Diff -->
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-xs text-slate-600">Ankle Diff Y</span>
                            <span class="text-xs font-mono"
                                  :class="ankleDiff >= 0.08 ? 'text-emerald-400' : 'text-slate-400'">
                                {{ ankleDiff.toFixed(3) }}
                            </span>
                        </div>

                        <!-- Feedback -->
                        <div class="p-2.5 rounded-lg bg-dark-900/60 border border-white/5 min-h-[40px]">
                            <p v-if="balanceFeedback" class="text-xs leading-relaxed text-slate-300">
                                {{ balanceFeedback }}
                            </p>
                            <p v-else class="text-xs text-slate-600">Angkat satu kaki untuk memulai...</p>
                        </div>

                        <!-- Total durasi sesi -->
                        <div v-if="balanceTotalDuration > 0" class="mt-3 flex items-center justify-between">
                            <span class="text-xs text-slate-600">Total sesi</span>
                            <span class="text-xs font-mono text-slate-400">{{ balanceTotalDuration.toFixed(1) }}s</span>
                        </div>

                    </template>

                    <!-- Test lain belum didukung -->
                    <template v-else>
                        <div class="flex flex-col items-center gap-2 py-4 text-center">
                            <span class="text-2xl">🚧</span>
                            <p class="text-xs text-slate-500 leading-relaxed">
                                Movement detection belum tersedia untuk test ini.
                            </p>
                        </div>
                    </template>
                </div>


                <!-- Input Source indicator di debug panel (append ke Section 2) -->

                <!-- DEBUG PANEL — hanya tampil saat PUSHUP_DEBUG = true & Push Up assessing -->
                <div v-if="PUSHUP_DEBUG && isPushUpTest && sessionState === 'assessing'"
                     class="card p-4 border-violet-500/20 bg-violet-500/5">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-xs font-semibold text-violet-400 uppercase tracking-wider">Debug Info</h3>
                        <span class="text-xs font-mono bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded">DEV</span>
                    </div>

                    <!-- ── Section 1: Performance ──────────────────────────── -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 mt-1">Performance</p>
                    <div class="space-y-1.5 mb-3">

                        <!-- FPS -->
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Loop FPS (rAF)</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="perfData.loopFps >= 15 ? 'text-emerald-400' : perfData.loopFps >= 10 ? 'text-yellow-400' : 'text-red-400'">
                                {{ perfData.loopFps > 0 ? `${perfData.loopFps} fps` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Inference FPS (pure)</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="perfData.inferenceFps >= 15 ? 'text-emerald-400' : perfData.inferenceFps >= 10 ? 'text-yellow-400' : 'text-red-400'">
                                {{ perfData.inferenceFps > 0 ? `${perfData.inferenceFps} fps` : '—' }}
                            </span>
                        </div>

                        <!-- T1: Loop interval -->
                        <div class="border-t border-white/5 pt-1.5 mt-1">
                            <p class="text-xs text-slate-600 mb-1">T1 — Loop interval (rAF)</p>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-600">avg / min / max</span>
                                <span class="text-xs font-mono text-slate-400">
                                    {{ perfData.loopAvgMs }}ms / {{ perfData.loopMinMs }}ms / {{ perfData.loopMaxMs }}ms
                                </span>
                            </div>
                        </div>

                        <!-- T2: Preprocessing -->
                        <div class="border-t border-white/5 pt-1.5 mt-1">
                            <p class="text-xs text-slate-600 mb-1">T2 — Preprocess (drawImage downscale)</p>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-600">avg / min / max</span>
                                <span class="text-xs font-mono text-cyan-400">
                                    {{ perfData.preprocessAvgMs }}ms / {{ perfData.preprocessMinMs }}ms / {{ perfData.preprocessMaxMs }}ms
                                </span>
                            </div>
                        </div>

                        <!-- T3: pose.send() -->
                        <div class="border-t border-white/5 pt-1.5 mt-1">
                            <p class="text-xs text-slate-600 mb-1">T3 — pose.send() WASM inference</p>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-600">avg / min / max</span>
                                <span class="text-xs font-mono"
                                      :class="perfData.sendAvgMs > 100 ? 'text-red-400' : perfData.sendAvgMs > 60 ? 'text-yellow-400' : 'text-emerald-400'">
                                    {{ perfData.sendAvgMs }}ms / {{ perfData.sendMinMs }}ms / {{ perfData.sendMaxMs }}ms
                                </span>
                            </div>
                        </div>

                        <!-- T4: Drawing -->
                        <div class="border-t border-white/5 pt-1.5 mt-1">
                            <p class="text-xs text-slate-600 mb-1">T4 — Canvas drawing (skeleton)</p>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-600">avg / min / max</span>
                                <span class="text-xs font-mono text-slate-400">
                                    {{ perfData.drawAvgMs }}ms / {{ perfData.drawMinMs }}ms / {{ perfData.drawMaxMs }}ms
                                </span>
                            </div>
                        </div>

                        <!-- T5: Emit -->
                        <div class="border-t border-white/5 pt-1.5 mt-1">
                            <p class="text-xs text-slate-600 mb-1">T5 — Vue emit overhead</p>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-600">avg</span>
                                <span class="text-xs font-mono text-slate-400">{{ perfData.emitAvgMs }}ms</span>
                            </div>
                        </div>

                        <!-- T6: Idle -->
                        <div class="border-t border-white/5 pt-1.5 mt-1">
                            <p class="text-xs text-slate-600 mb-1">T6 — Idle (loop - inference)</p>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-600">avg</span>
                                <span class="text-xs font-mono text-slate-400">{{ perfData.idleAvgMs }}ms</span>
                            </div>
                        </div>

                        <!-- Frame counters -->
                        <div class="border-t border-white/5 pt-1.5 mt-1">
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-500">Frames (loop/result/skip)</span>
                                <span class="text-xs font-mono text-slate-400">
                                    {{ perfData.totalFrames }} /
                                    <span class="text-emerald-400">{{ perfData.resultFrames }}</span> /
                                    <span class="text-yellow-400">{{ perfData.skippedFrames }}</span>
                                </span>
                            </div>
                        </div>

                        <!-- Video info -->
                        <div class="border-t border-white/5 pt-1.5 mt-1">
                            <div class="flex items-center justify-between mb-1">
                                <span class="text-xs text-slate-500">Video Input</span>
                                <span class="text-xs font-mono text-slate-400">
                                    {{ perfData.videoWidth > 0 ? `${perfData.videoWidth}×${perfData.videoHeight}` : '—' }}
                                </span>
                            </div>
                            <div class="flex items-center justify-between mb-1">
                                <span class="text-xs text-slate-500">Inference Input</span>
                                <span class="text-xs font-mono text-cyan-400">
                                    {{ perfData.inferenceWidth > 0 ? `${perfData.inferenceWidth}×${perfData.inferenceHeight}` : '—' }}
                                </span>
                            </div>
                            <div class="flex items-center justify-between mb-1">
                                <span class="text-xs text-slate-500">Video ReadyState</span>
                                <span class="text-xs font-mono"
                                      :class="perfData.videoReadyState >= 4 ? 'text-emerald-400' : 'text-yellow-400'">
                                    {{ perfData.videoReadyState }}
                                    <span class="text-slate-600">
                                        ({{ ['HAVE_NOTHING','HAVE_METADATA','HAVE_CURRENT','HAVE_FUTURE','HAVE_ENOUGH'][perfData.videoReadyState] ?? '?' }})
                                    </span>
                                </span>
                            </div>
                            <div class="flex items-center justify-between mb-1">
                                <span class="text-xs text-slate-500">devicePixelRatio</span>
                                <span class="text-xs font-mono text-slate-400">{{ perfData.devicePixelRatio ?? '—' }}×</span>
                            </div>
                            <div class="flex items-center justify-between mb-1">
                                <span class="text-xs text-slate-500">Tab visible</span>
                                <span class="text-xs font-mono"
                                      :class="perfData.tabVisible ? 'text-emerald-400' : 'text-red-400'">
                                    {{ perfData.tabVisible ? 'YES' : 'NO (throttled!)' }}
                                </span>
                            </div>
                            <div class="flex items-center justify-between" v-if="perfData.droppedFrames != null">
                                <span class="text-xs text-slate-500">Dropped / Total frames</span>
                                <span class="text-xs font-mono"
                                      :class="perfData.droppedFrames > 0 ? 'text-red-400' : 'text-slate-400'">
                                    {{ perfData.droppedFrames }} / {{ perfData.totalVideoFrames }}
                                </span>
                            </div>
                            <div v-else class="flex items-center justify-between">
                                <span class="text-xs text-slate-500">getVideoPlaybackQuality</span>
                                <span class="text-xs font-mono text-slate-600">not supported</span>
                            </div>
                        </div>
                    </div>

                    <!-- ── Section 2: Current State ───────────────────────── -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">State</p>
                    <div class="space-y-1.5 mb-3">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Phase</span>
                            <span class="text-xs font-mono font-bold" :class="pushUpPhaseColor">{{ pushUpPhaseLabel }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Form</span>
                            <span class="text-xs font-mono font-bold" :class="{
                                'text-emerald-400': pushUpFormStatus === 'GOOD_FORM',
                                'text-red-400':     pushUpFormStatus === 'BAD_FORM',
                                'text-yellow-400':  pushUpFormStatus === 'ADJUST_POSITION',
                                'text-slate-500':   pushUpFormStatus === 'NO_DATA',
                            }">{{ pushUpFormStatus }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Elbow Angle</span>
                            <span class="text-xs font-mono text-cyan-400">{{ pushUpElbowAngle > 0 ? `${pushUpElbowAngle}°` : '—' }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Body Angle</span>
                            <span class="text-xs font-mono text-cyan-400">{{ pushUpBodyAngle > 0 ? `${pushUpBodyAngle}°` : '—' }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Pose Valid</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="validationStatus === 'READY' ? 'text-emerald-400' : 'text-slate-500'">
                                {{ validationStatus }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">READY reached (total)</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="debugValidationReadyCount > 0 ? 'text-emerald-400' : 'text-red-400'">
                                {{ debugValidationReadyCount }}x
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Repetisi</span>
                            <span class="text-xs font-mono font-bold text-white">{{ pushUpCount }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Input Source</span>
                            <span class="text-xs font-mono font-bold text-cyan-400">📷 Realtime Camera</span>
                        </div>
                        <!-- Push Up Validation Mode -->
                        <div class="border-t border-white/5 pt-2 mt-1 space-y-1.5">
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-500">Validation Mode</span>
                                <span class="text-xs font-mono font-bold text-violet-400">SINGLE-SIDE</span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-500">Counting Side</span>
                                <span class="text-xs font-mono font-bold"
                                      :class="{
                                          'text-emerald-400': pushUpCountingSide === 'BOTH',
                                          'text-cyan-400':    pushUpCountingSide === 'RIGHT' || pushUpCountingSide === 'LEFT',
                                          'text-red-400':     pushUpCountingSide === 'NONE',
                                          'text-slate-500':   pushUpCountingSide === '—',
                                      }">
                                    {{ pushUpCountingSide }}
                                </span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-500">Left Counting LM</span>
                                <span class="text-xs font-mono font-bold"
                                      :class="pushUpCountingSide === 'LEFT' || pushUpCountingSide === 'BOTH' ? 'text-emerald-400' : 'text-red-400'">
                                    {{ pushUpCountingSide === 'LEFT' || pushUpCountingSide === 'BOTH' ? 'VALID ✓' : 'INVALID ✗' }}
                                </span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-500">Right Counting LM</span>
                                <span class="text-xs font-mono font-bold"
                                      :class="pushUpCountingSide === 'RIGHT' || pushUpCountingSide === 'BOTH' ? 'text-emerald-400' : 'text-red-400'">
                                    {{ pushUpCountingSide === 'RIGHT' || pushUpCountingSide === 'BOTH' ? 'VALID ✓' : 'INVALID ✗' }}
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- ── Section 2.1: Evaluator Trace ──────────────────── -->
                    <p class="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Evaluator Trace (Runtime)</p>
                    <div class="space-y-1.5 mb-3">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Custom Evaluator Called</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="pushUpEvalDiag.evaluatorCalled ? 'text-emerald-400' : 'text-red-400 animate-pulse'">
                                {{ pushUpEvalDiag.evaluatorCalled ? `YES ✓ (${pushUpEvalDiag.callCount}x)` : 'NO ✗ — BELUM DIPANGGIL' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Last Raw Status</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="{
                                      'text-emerald-400': pushUpEvalDiag.lastRawStatus === 'READY',
                                      'text-red-400':     pushUpEvalDiag.lastRawStatus === 'POSITION_INVALID',
                                      'text-yellow-400':  pushUpEvalDiag.lastRawStatus === 'BODY_DETECTED',
                                      'text-slate-500':   pushUpEvalDiag.lastRawStatus === 'NO_BODY' || pushUpEvalDiag.lastRawStatus === '—',
                                  }">
                                {{ pushUpEvalDiag.lastRawStatus }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Last Reason</span>
                            <span class="text-xs font-mono text-slate-400 text-right max-w-[160px] leading-tight">{{ pushUpEvalDiag.lastReason }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Left OK / Right OK</span>
                            <span class="text-xs font-mono font-bold">
                                <span :class="pushUpEvalDiag.lastLeftOk ? 'text-emerald-400' : 'text-red-400'">L:{{ pushUpEvalDiag.lastLeftOk ? '✓' : '✗' }}</span>
                                <span class="text-slate-600 mx-1">/</span>
                                <span :class="pushUpEvalDiag.lastRightOk ? 'text-emerald-400' : 'text-red-400'">R:{{ pushUpEvalDiag.lastRightOk ? '✓' : '✗' }}</span>
                            </span>
                        </div>
                        <!-- Visibility snapshot per landmark dari evaluator -->
                        <div class="border-t border-white/5 pt-1.5 mt-1">
                            <p class="text-xs text-slate-600 mb-1">Visibility @ evaluator (last frame)</p>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-600">R.Shoulder / R.Elbow / R.Wrist</span>
                                <span class="text-xs font-mono"
                                      :class="pushUpEvalDiag.lastRightOk ? 'text-emerald-400' : 'text-red-400'">
                                    {{ pushUpEvalDiag.rShoulder }}% / {{ pushUpEvalDiag.rElbow }}% / {{ pushUpEvalDiag.rWrist }}%
                                </span>
                            </div>
                            <div class="flex items-center justify-between mt-0.5">
                                <span class="text-xs text-slate-600">L.Shoulder / L.Elbow / L.Wrist</span>
                                <span class="text-xs font-mono"
                                      :class="pushUpEvalDiag.lastLeftOk ? 'text-emerald-400' : 'text-red-400'">
                                    {{ pushUpEvalDiag.lShoulder }}% / {{ pushUpEvalDiag.lElbow }}% / {{ pushUpEvalDiag.lWrist }}%
                                </span>
                            </div>
                        </div>
                        <!-- Counter per rawStatus -->
                        <div class="border-t border-white/5 pt-1.5 mt-1">
                            <p class="text-xs text-slate-600 mb-1">Cumulative rawStatus distribution</p>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-600">READY frames</span>
                                <span class="text-xs font-mono font-bold"
                                      :class="pushUpEvalDiag.readyCount > 0 ? 'text-emerald-400' : 'text-red-400'">
                                    {{ pushUpEvalDiag.readyCount }}
                                </span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-600">POSITION_INVALID frames</span>
                                <span class="text-xs font-mono"
                                      :class="pushUpEvalDiag.posInvalidCount > 0 ? 'text-orange-400' : 'text-slate-600'">
                                    {{ pushUpEvalDiag.posInvalidCount }}
                                </span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-600">NO_BODY frames</span>
                                <span class="text-xs font-mono text-slate-500">{{ pushUpEvalDiag.noBodyCount }}</span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-600">BODY_DETECTED frames</span>
                                <span class="text-xs font-mono text-yellow-600">{{ pushUpEvalDiag.bodyDetectedCount }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- ── Section 2.5: Counting Pipeline ────────────────── -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Counting Pipeline</p>
                    <div class="space-y-1.5 mb-3" v-if="pushUpDebugPipeline">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Validation READY</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="pushUpDebugPipeline.validationReady ? 'text-emerald-400' : 'text-red-400'">
                                {{ pushUpDebugPipeline.validationReady ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Elbow Angle</span>
                            <span class="text-xs font-mono text-cyan-400">
                                {{ pushUpDebugPipeline.elbowAngle > 0 ? `${pushUpDebugPipeline.elbowAngle}°` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">DOWN Zone (≤100°)</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="pushUpDebugPipeline.inDownZone ? 'text-orange-400' : 'text-slate-600'">
                                {{ pushUpDebugPipeline.inDownZone ? 'YES ✓' : 'NO' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">DOWN Accumulate</span>
                            <span class="text-xs font-mono"
                                  :class="pushUpDebugPipeline.downAccumMs > 0 ? 'text-orange-400' : 'text-slate-600'">
                                {{ pushUpDebugPipeline.downAccumMs > 0 ? `${pushUpDebugPipeline.downAccumMs}ms / 150ms` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">DOWN Confirmed</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="pushUpDebugPipeline.downConfirmed ? 'text-orange-400' : 'text-slate-600'">
                                {{ pushUpDebugPipeline.downConfirmed ? 'YES ✓' : 'NO' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">UP Zone (≥160°)</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="pushUpDebugPipeline.inUpZone ? 'text-emerald-400' : 'text-slate-600'">
                                {{ pushUpDebugPipeline.inUpZone ? 'YES ✓' : 'NO' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">UP Accumulate</span>
                            <span class="text-xs font-mono"
                                  :class="pushUpDebugPipeline.upAccumMs > 0 ? 'text-emerald-400' : 'text-slate-600'">
                                {{ pushUpDebugPipeline.upAccumMs > 0 ? `${pushUpDebugPipeline.upAccumMs}ms / 150ms` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">UP Confirmed</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="pushUpDebugPipeline.upConfirmed ? 'text-emerald-400' : 'text-slate-600'">
                                {{ pushUpDebugPipeline.upConfirmed ? 'YES ✓' : 'NO' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Rep Increment</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="pushUpDebugPipeline.repIncremented ? 'text-emerald-400' : 'text-red-400'">
                                {{ pushUpDebugPipeline.repIncremented ? 'YES ✓✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="p-1.5 bg-dark-900/60 rounded mt-1">
                            <p class="text-xs text-slate-500 mb-0.5">Block reason:</p>
                            <p class="text-xs font-mono"
                               :class="pushUpDebugPipeline.blockReason !== '—' ? 'text-yellow-300' : 'text-slate-600'"
                               style="word-break:break-all;">
                                {{ pushUpDebugPipeline.blockReason }}
                            </p>
                        </div>
                    </div>

                    <!-- ── Section 2.6: Cumulative Pipeline Counters ─────── -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Cumulative Counters (total sesi)</p>
                    <div class="space-y-1.5 mb-3" v-if="pushUpDebugCumul">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Validation READY frames</span>
                            <span class="text-xs font-mono"
                                  :class="pushUpDebugCumul.validationReadyFrames > 0 ? 'text-emerald-400' : 'text-red-400'">
                                {{ pushUpDebugCumul.validationReadyFrames }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Elbow angle samples</span>
                            <span class="text-xs font-mono"
                                  :class="pushUpDebugCumul.elbowSamples > 0 ? 'text-cyan-400' : 'text-red-400'">
                                {{ pushUpDebugCumul.elbowSamples }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">DOWN zone frames</span>
                            <span class="text-xs font-mono"
                                  :class="pushUpDebugCumul.downZoneFrames > 0 ? 'text-orange-400' : 'text-slate-500'">
                                {{ pushUpDebugCumul.downZoneFrames }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">DOWN timer max reached</span>
                            <span class="text-xs font-mono"
                                  :class="pushUpDebugCumul.downTimerMaxMs >= 50 ? 'text-emerald-400' : pushUpDebugCumul.downTimerMaxMs > 0 ? 'text-yellow-400' : 'text-red-400'">
                                {{ pushUpDebugCumul.downTimerMaxMs > 0 ? `${pushUpDebugCumul.downTimerMaxMs}ms` : '0ms' }}
                                <span class="text-slate-600 text-xs">(need ≥50ms)</span>
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">DOWN confirmed count</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="pushUpDebugCumul.downConfirmedCount > 0 ? 'text-orange-400' : 'text-red-400'">
                                {{ pushUpDebugCumul.downConfirmedCount }}x
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">UP zone frames</span>
                            <span class="text-xs font-mono"
                                  :class="pushUpDebugCumul.upZoneFrames > 0 ? 'text-emerald-400' : 'text-slate-500'">
                                {{ pushUpDebugCumul.upZoneFrames }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">UP timer max reached</span>
                            <span class="text-xs font-mono"
                                  :class="pushUpDebugCumul.upTimerMaxMs >= 50 ? 'text-emerald-400' : pushUpDebugCumul.upTimerMaxMs > 0 ? 'text-yellow-400' : 'text-red-400'">
                                {{ pushUpDebugCumul.upTimerMaxMs > 0 ? `${pushUpDebugCumul.upTimerMaxMs}ms` : '0ms' }}
                                <span class="text-slate-600 text-xs">(need ≥50ms)</span>
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">UP confirmed count</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="pushUpDebugCumul.upConfirmedCount > 0 ? 'text-emerald-400' : 'text-slate-500'">
                                {{ pushUpDebugCumul.upConfirmedCount }}x
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Rep increment count</span>
                            <span class="text-xs font-mono font-bold text-2xl"
                                  :class="pushUpDebugCumul.repIncrementCount > 0 ? 'text-emerald-400' : 'text-red-400'">
                                {{ pushUpDebugCumul.repIncrementCount }}
                            </span>
                        </div>
                        <div class="p-1.5 bg-dark-900/60 rounded mt-1" v-if="pushUpDebugCumul.lastBlockReason !== '—'">
                            <p class="text-xs text-slate-500 mb-0.5">Last cumulative block reason:</p>
                            <p class="text-xs font-mono text-yellow-300 leading-relaxed" style="word-break:break-all;">
                                {{ pushUpDebugCumul.lastBlockReason }}
                            </p>
                        </div>
                    </div>

                    <!-- ── Section 3: Body Alignment Diagnosis ────────────── -->                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Body Alignment Diagnosis</p>
                    <div class="space-y-1.5 mb-3" v-if="pushUpDebugBodyAlign">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Left Side</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="pushUpDebugBodyAlign.leftBodyValid ? 'text-emerald-400' : 'text-red-400'">
                                {{ pushUpDebugBodyAlign.leftBodyValid ? 'VALID ✓' : 'INVALID ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Right Side</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="pushUpDebugBodyAlign.rightBodyValid ? 'text-emerald-400' : 'text-red-400'">
                                {{ pushUpDebugBodyAlign.rightBodyValid ? 'VALID ✓' : 'INVALID ✗' }}
                            </span>
                        </div>
                        <!-- Per-landmark visibility untuk body alignment -->
                        <div class="grid grid-cols-3 gap-1 text-xs font-mono mt-1">
                            <div class="text-slate-600 text-center">Landmark</div>
                            <div class="text-slate-600 text-center">L%</div>
                            <div class="text-slate-600 text-center">R%</div>
                            <div class="text-slate-500">Shoulder</div>
                            <div class="text-center" :class="(pushUpDebugBodyAlign.lShoulder ?? 0) >= 50 ? 'text-emerald-400' : 'text-red-400'">
                                {{ pushUpDebugBodyAlign.lShoulder != null ? pushUpDebugBodyAlign.lShoulder + '%' : 'null' }}
                            </div>
                            <div class="text-center" :class="(pushUpDebugBodyAlign.rShoulder ?? 0) >= 50 ? 'text-emerald-400' : 'text-red-400'">
                                {{ pushUpDebugBodyAlign.rShoulder != null ? pushUpDebugBodyAlign.rShoulder + '%' : 'null' }}
                            </div>
                            <div class="text-slate-500">Hip</div>
                            <div class="text-center" :class="(pushUpDebugBodyAlign.lHip ?? 0) >= 50 ? 'text-emerald-400' : 'text-red-400'">
                                {{ pushUpDebugBodyAlign.lHip != null ? pushUpDebugBodyAlign.lHip + '%' : 'null' }}
                            </div>
                            <div class="text-center" :class="(pushUpDebugBodyAlign.rHip ?? 0) >= 50 ? 'text-emerald-400' : 'text-red-400'">
                                {{ pushUpDebugBodyAlign.rHip != null ? pushUpDebugBodyAlign.rHip + '%' : 'null' }}
                            </div>
                            <div class="text-slate-500">Ankle</div>
                            <div class="text-center" :class="(pushUpDebugBodyAlign.lAnkle ?? 0) >= 50 ? 'text-emerald-400' : 'text-red-400'">
                                {{ pushUpDebugBodyAlign.lAnkle != null ? pushUpDebugBodyAlign.lAnkle + '%' : 'null' }}
                            </div>
                            <div class="text-center" :class="(pushUpDebugBodyAlign.rAnkle ?? 0) >= 50 ? 'text-emerald-400' : 'text-red-400'">
                                {{ pushUpDebugBodyAlign.rAnkle != null ? pushUpDebugBodyAlign.rAnkle + '%' : 'null' }}
                            </div>
                        </div>
                        <!-- Reason -->
                        <div class="text-xs text-slate-500 mt-1 p-1.5 bg-dark-900/60 rounded leading-relaxed break-all">
                            {{ pushUpDebugBodyAlign.reason }}
                        </div>
                    </div>

                    <!-- ── Section 4: Per-Landmark Visibility ─────────────── -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Landmark Visibility</p>
                    <div class="space-y-1" v-if="pushUpDebugLandmarks.length">
                        <div v-for="lm in pushUpDebugLandmarks" :key="lm.index"
                             class="flex items-center justify-between">
                            <span class="text-xs text-slate-500 w-24 flex-shrink-0">{{ lm.name }}</span>
                            <div class="flex items-center gap-2">
                                <span class="text-xs font-mono text-slate-400 w-8 text-right">
                                    {{ lm.vis != null ? lm.vis + '%' : '—' }}
                                </span>
                                <span class="text-xs font-bold font-mono w-16 text-right"
                                      :class="{
                                          'text-emerald-400': lm.status === 'VISIBLE',
                                          'text-yellow-400':  lm.status === 'LOW',
                                          'text-red-400':     lm.status === 'MISSING',
                                      }">
                                    {{ lm.status }}
                                </span>
                            </div>
                        </div>
                    </div>
                    <p v-else class="text-xs text-slate-600">Menunggu data landmark...</p>

                    <!-- ── Section 5: Landmark Stats ──────────────────────── -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2 mt-2">Landmark Stats</p>
                    <div class="space-y-1.5 mb-3">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Valid Count</span>
                            <span class="text-xs font-mono" :class="poseDetectedCount >= 10 ? 'text-emerald-400' : 'text-yellow-400'">
                                {{ poseDetectedCount }}/{{ poseTotalTarget }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Avg Visibility</span>
                            <span class="text-xs font-mono text-slate-400">{{ poseVisibility }}%</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">LOW/MISSING</span>
                            <span class="text-xs font-mono text-red-400">
                                {{ pushUpDebugLandmarks.filter(l => l.status !== 'VISIBLE').length }}/{{ pushUpDebugLandmarks.length }}
                            </span>
                        </div>
                    </div>

                    <!-- ── Section 5.5: Counting vs Optional Landmarks ────── -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2 mt-2">Counting Landmarks</p>
                    <div class="space-y-1.5 mb-3" v-if="pushUpDebugCountingLm">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Required valid</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="pushUpDebugCountingLm.countingValid >= 4 ? 'text-emerald-400' : 'text-red-400'">
                                {{ pushUpDebugCountingLm.countingValid }}/{{ pushUpDebugCountingLm.countingTotal }}
                                <span class="text-slate-500 font-normal">(shld+elbow+wrist)</span>
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Blocked by counting lm</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="pushUpDebugCountingLm.blockedByCountingLm ? 'text-red-400' : 'text-emerald-400'">
                                {{ pushUpDebugCountingLm.blockedByCountingLm ? 'YES — cannot count' : 'NO — counting ok' }}
                            </span>
                        </div>
                        <div v-if="pushUpDebugCountingLm.countingMissing.length > 0" class="p-1.5 bg-red-500/5 rounded">
                            <p class="text-xs text-slate-500 mb-0.5">Missing counting:</p>
                            <p class="text-xs font-mono text-red-400 break-all">{{ pushUpDebugCountingLm.countingMissing.join(', ') }}</p>
                        </div>
                        <div v-if="pushUpDebugCountingLm.optionalMissing.length > 0" class="p-1.5 bg-slate-800/60 rounded">
                            <p class="text-xs text-slate-500 mb-0.5">Missing optional (ok to count):</p>
                            <p class="text-xs font-mono text-slate-500 break-all">{{ pushUpDebugCountingLm.optionalMissing.join(', ') }}</p>
                        </div>
                    </div>

                    <!-- ── Section 6: State Machine Diagnostics ───────────── -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2 mt-2">State Machine Diagnostics</p>
                    <div class="space-y-1.5 mb-3" v-if="pushUpDebugSM">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Current Phase</span>
                            <span class="text-xs font-mono font-bold" :class="pushUpPhaseColor">{{ pushUpPhaseLabel }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Prev Phase</span>
                            <span class="text-xs font-mono text-slate-400">{{ pushUpDebugSM.prevPhase }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Elbow Min/Max</span>
                            <span class="text-xs font-mono text-cyan-400">
                                {{ pushUpDebugSM.minElbowSeen > 0 ? pushUpDebugSM.minElbowSeen + '°' : '—' }}
                                /
                                {{ pushUpDebugSM.maxElbowSeen > 0 ? pushUpDebugSM.maxElbowSeen + '°' : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Frames ≤ 100° (DOWN)</span>
                            <span class="text-xs font-mono"
                                  :class="pushUpDebugSM.framesElbowBelowDown > 0 ? 'text-orange-400' : 'text-slate-500'">
                                {{ pushUpDebugSM.framesElbowBelowDown }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Frames ≥ 160° (UP)</span>
                            <span class="text-xs font-mono"
                                  :class="pushUpDebugSM.framesElbowAboveUp > 0 ? 'text-emerald-400' : 'text-slate-500'">
                                {{ pushUpDebugSM.framesElbowAboveUp }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">DOWN reached</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="pushUpDebugSM.downEverReached ? 'text-emerald-400' : 'text-red-400'">
                                {{ pushUpDebugSM.downEverReached ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">UP after DOWN</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="pushUpDebugSM.upAfterDownReached ? 'text-emerald-400' : 'text-red-400'">
                                {{ pushUpDebugSM.upAfterDownReached ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Blocked: Validation</span>
                            <span class="text-xs font-mono text-red-400">{{ pushUpDebugSM.blockedByValidation }}x</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Blocked: Landmark</span>
                            <span class="text-xs font-mono text-red-400">{{ pushUpDebugSM.blockedByLandmark }}x</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Blocked: BadForm</span>
                            <span class="text-xs font-mono text-red-400">{{ pushUpDebugSM.blockedByBadForm }}x</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Val. Drops</span>
                            <span class="text-xs font-mono text-yellow-400">{{ pushUpDebugSM.validationDropCount }}x</span>
                        </div>
                        <!-- Last block reason -->
                        <div class="p-1.5 bg-dark-900/60 rounded mt-1">
                            <p class="text-xs text-slate-500 mb-0.5">Last block reason:</p>
                            <p class="text-xs font-mono text-yellow-300 leading-relaxed break-all">{{ pushUpDebugSM.lastBlockReason }}</p>
                        </div>
                    </div>

                    <!-- ── Section 7: Frame History (25 sampel terakhir) ───── -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2 mt-2">Frame History ({{ pushUpDebugHistory.length }} sampel)</p>
                    <div class="overflow-x-auto">
                        <table class="w-full text-xs font-mono" v-if="pushUpDebugHistory.length > 0">
                            <thead>
                                <tr class="text-slate-600 border-b border-white/5">
                                    <th class="text-left py-0.5 pr-1 font-normal">t(s)</th>
                                    <th class="text-left py-0.5 pr-1 font-normal">fps</th>
                                    <th class="text-left py-0.5 pr-1 font-normal">val</th>
                                    <th class="text-left py-0.5 pr-1 font-normal">elbow</th>
                                    <th class="text-left py-0.5 pr-1 font-normal">body</th>
                                    <th class="text-left py-0.5 pr-1 font-normal">phase</th>
                                    <th class="text-left py-0.5 font-normal">form</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(h, i) in [...pushUpDebugHistory].reverse().slice(0, 15)"
                                    :key="i"
                                    :class="[
                                        'border-b border-white/3',
                                        h.phase === 'DOWN' ? 'text-orange-400' : h.phase === 'UP' ? 'text-emerald-400' : 'text-slate-400',
                                        h.valid !== 'READY' ? 'opacity-50' : '',
                                    ]">
                                    <td class="py-0.5 pr-1 text-slate-600">{{ h.ts }}</td>
                                    <td class="py-0.5 pr-1">{{ h.fps }}</td>
                                    <td class="py-0.5 pr-1 text-xs"
                                        :class="h.valid === 'READY' ? 'text-emerald-400' : 'text-red-400'">
                                        {{ h.valid === 'READY' ? 'RDY' : h.valid.substring(0,4) }}
                                    </td>
                                    <td class="py-0.5 pr-1">{{ h.elbow > 0 ? h.elbow + '°' : '—' }}</td>
                                    <td class="py-0.5 pr-1">{{ h.body > 0 ? h.body + '°' : '—' }}</td>
                                    <td class="py-0.5 pr-1">{{ h.phase }}</td>
                                    <td class="py-0.5 text-xs">{{ h.form === 'GOOD_FORM' ? 'OK' : h.form === 'BAD_FORM' ? 'BAD' : h.form === 'ADJUST_POSITION' ? 'ADJ' : '—' }}</td>
                                </tr>
                            </tbody>
                        </table>
                        <p v-else class="text-xs text-slate-600">Menunggu data frame...</p>
                    </div>

                    <!-- ── Section 8: Repetition Cycle Diagnostics ────────── -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2 mt-2">Repetition Cycle Diagnostics</p>
                    <div class="space-y-1.5 mb-3" v-if="pushUpDebugRepCycle">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Current Cycle #</span>
                            <span class="text-xs font-mono font-bold text-white">{{ pushUpDebugRepCycle.cycleNumber }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Cycle State</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="{
                                      'text-emerald-400': pushUpDebugRepCycle.currentCycleState === 'COUNTED',
                                      'text-red-400':     pushUpDebugRepCycle.currentCycleState === 'BLOCKED',
                                      'text-orange-400':  pushUpDebugRepCycle.currentCycleState === 'DOWN_CONFIRMED' || pushUpDebugRepCycle.currentCycleState === 'WAITING_UP',
                                      'text-cyan-400':    pushUpDebugRepCycle.currentCycleState === 'UP_DETECTED',
                                      'text-slate-400':   pushUpDebugRepCycle.currentCycleState === 'IDLE' || pushUpDebugRepCycle.currentCycleState === 'WAITING_DOWN',
                                  }">
                                {{ pushUpDebugRepCycle.currentCycleState }}
                            </span>
                        </div>
                        <!-- Status flags dengan ✓/✗/— -->
                        <div class="grid grid-cols-2 gap-x-2 gap-y-1 mt-1">
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-600">UP detected</span>
                                <span class="text-xs font-mono font-bold"
                                      :class="pushUpDebugRepCycle.upDetected ? 'text-emerald-400' : 'text-slate-600'">
                                    {{ pushUpDebugRepCycle.upDetected ? '✓' : '—' }}
                                </span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-600">DOWN detected</span>
                                <span class="text-xs font-mono font-bold"
                                      :class="pushUpDebugRepCycle.downDetected ? 'text-orange-400' : 'text-slate-600'">
                                    {{ pushUpDebugRepCycle.downDetected ? '✓' : '—' }}
                                </span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-600">DOWN confirmed</span>
                                <span class="text-xs font-mono font-bold"
                                      :class="pushUpDebugRepCycle.downConfirmed ? 'text-orange-400' : 'text-slate-600'">
                                    {{ pushUpDebugRepCycle.downConfirmed ? '✓' : '✗' }}
                                </span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-600">UP after DOWN</span>
                                <span class="text-xs font-mono font-bold"
                                      :class="pushUpDebugRepCycle.upAfterDownDetected ? 'text-emerald-400' : 'text-slate-600'">
                                    {{ pushUpDebugRepCycle.upAfterDownDetected ? '✓' : '—' }}
                                </span>
                            </div>
                        </div>
                        <!-- Counted -->
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Counted</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="pushUpDebugRepCycle.counted ? 'text-emerald-400' : 'text-red-400'">
                                {{ pushUpDebugRepCycle.counted ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <!-- Timing & counters -->
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">DOWN duration</span>
                            <span class="text-xs font-mono text-slate-400">
                                {{ pushUpDebugRepCycle.downDurationMs > 0 ? `${pushUpDebugRepCycle.downDurationMs} ms` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">Val.drops / Lm.blocks / BadForm</span>
                            <span class="text-xs font-mono">
                                <span :class="pushUpDebugRepCycle.validationDrops > 0 ? 'text-red-400' : 'text-slate-500'">{{ pushUpDebugRepCycle.validationDrops }}</span>
                                <span class="text-slate-600"> / </span>
                                <span :class="pushUpDebugRepCycle.landmarkBlocks > 0 ? 'text-red-400' : 'text-slate-500'">{{ pushUpDebugRepCycle.landmarkBlocks }}</span>
                                <span class="text-slate-600"> / </span>
                                <span :class="pushUpDebugRepCycle.badFormBlocks > 0 ? 'text-red-400' : 'text-slate-500'">{{ pushUpDebugRepCycle.badFormBlocks }}</span>
                            </span>
                        </div>
                        <!-- Reset reason -->
                        <div class="p-1.5 bg-dark-900/60 rounded">
                            <p class="text-xs text-slate-500 mb-0.5">Reset reason:</p>
                            <p class="text-xs font-mono font-bold"
                               :class="pushUpDebugRepCycle.resetReason !== '—' ? 'text-red-400' : 'text-slate-600'">
                                {{ pushUpDebugRepCycle.resetReason }}
                            </p>
                        </div>
                    </div>

                    <!-- ── Section 9: Repetition History ──────────────────── -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2 mt-2">
                        Repetition History ({{ pushUpDebugRepHistory.length }} siklus)
                    </p>
                    <div class="overflow-x-auto mb-3" v-if="pushUpDebugRepHistory.length > 0">
                        <table class="w-full text-xs font-mono">
                            <thead>
                                <tr class="text-slate-600 border-b border-white/5">
                                    <th class="text-left py-0.5 pr-1 font-normal">#</th>
                                    <th class="text-center py-0.5 pr-1 font-normal">UP</th>
                                    <th class="text-center py-0.5 pr-1 font-normal">DN</th>
                                    <th class="text-center py-0.5 pr-1 font-normal">DN✓</th>
                                    <th class="text-center py-0.5 pr-1 font-normal">UP✓</th>
                                    <th class="text-center py-0.5 pr-1 font-normal">Rep</th>
                                    <th class="text-right py-0.5 pr-1 font-normal">ms</th>
                                    <th class="text-right py-0.5 font-normal">Reason</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(c, i) in [...pushUpDebugRepHistory].reverse()"
                                    :key="i"
                                    :class="[
                                        'border-b border-white/3',
                                        c.counted ? 'text-emerald-400' : c.resetReason !== '—' ? 'text-red-400' : 'text-slate-400',
                                    ]">
                                    <td class="py-0.5 pr-1 text-slate-500">{{ c.cycleNumber }}</td>
                                    <td class="py-0.5 pr-1 text-center">{{ c.upDetected ? '✓' : '—' }}</td>
                                    <td class="py-0.5 pr-1 text-center">{{ c.downDetected ? '✓' : '—' }}</td>
                                    <td class="py-0.5 pr-1 text-center">{{ c.downConfirmed ? '✓' : '✗' }}</td>
                                    <td class="py-0.5 pr-1 text-center">{{ c.upAfterDownDetected ? '✓' : '—' }}</td>
                                    <td class="py-0.5 pr-1 text-center font-bold">{{ c.counted ? '✓' : '✗' }}</td>
                                    <td class="py-0.5 pr-1 text-right text-slate-500">{{ c.downDurationMs > 0 ? c.downDurationMs : '—' }}</td>
                                    <td class="py-0.5 text-right text-xs" style="max-width:80px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"
                                        :title="c.resetReason">
                                        {{ c.resetReason === '—' ? '—' : c.resetReason.replace('_', ' ') }}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <p v-else class="text-xs text-slate-600 mb-3">Belum ada siklus selesai.</p>

                    <!-- ── Section 10: Threshold Reference ────────────────── -->
                    <div class="border-t border-white/5 pt-2 mt-1 space-y-1">
                        <p class="text-xs text-slate-600">Thresholds aktif:</p>
                        <p class="text-xs font-mono text-slate-600">DOWN ≤ 100° | UP ≥ 160°</p>
                        <p class="text-xs font-mono text-slate-600">Body ≥ 140° | Stab: 50ms</p>
                        <p class="text-xs font-mono text-slate-600">MIN_VISIBILITY: 0.5 (50%)</p>
                    </div>
                </div>

                <!-- DEBUG PANEL — Sit Up -->
                <div v-if="SITUP_DEBUG && isSitUpTest && sessionState === 'assessing'"
                     class="card p-4 border-cyan-500/20 bg-cyan-500/5">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Sit Up Debug</h3>
                        <span class="text-xs font-mono bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded">DEV</span>
                    </div>

                    <!-- State -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">State</p>
                    <div class="space-y-1.5 mb-3">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Phase</span>
                            <span class="text-xs font-mono font-bold" :class="sitUpPhaseColor">{{ sitUpPhaseLabel }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Hip Angle</span>
                            <span class="text-xs font-mono text-cyan-400">{{ sitUpHipAngle > 0 ? `${sitUpHipAngle}°` : '—' }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Counting Side</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="{
                                      'text-emerald-400': sitUpCountingSide === 'BOTH',
                                      'text-cyan-400':    sitUpCountingSide === 'LEFT' || sitUpCountingSide === 'RIGHT',
                                      'text-slate-500':   sitUpCountingSide === '—',
                                  }">
                                {{ sitUpCountingSide }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Pose Valid</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="validationStatus === 'READY' ? 'text-emerald-400' : 'text-slate-500'">
                                {{ validationStatus }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Repetisi</span>
                            <span class="text-xs font-mono font-bold text-white">{{ sitUpCount }}</span>
                        </div>
                    </div>

                    <!-- Counting Pipeline -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Counting Pipeline</p>
                    <div class="space-y-1.5 mb-3" v-if="sitUpDebugPipeline">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Validation READY</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="sitUpDebugPipeline.validationReady ? 'text-emerald-400' : 'text-red-400'">
                                {{ sitUpDebugPipeline.validationReady ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Hip Angle</span>
                            <span class="text-xs font-mono text-cyan-400">
                                {{ sitUpDebugPipeline.hipAngle > 0 ? `${sitUpDebugPipeline.hipAngle}°` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">SIT Zone (≤90°)</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="sitUpDebugPipeline.inSitZone ? 'text-orange-400' : 'text-slate-600'">
                                {{ sitUpDebugPipeline.inSitZone ? 'YES ✓' : 'NO' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">SIT Accumulate</span>
                            <span class="text-xs font-mono"
                                  :class="sitUpDebugPipeline.sitAccumMs > 0 ? 'text-orange-400' : 'text-slate-600'">
                                {{ sitUpDebugPipeline.sitAccumMs > 0 ? `${sitUpDebugPipeline.sitAccumMs}ms / 50ms` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">SIT Confirmed</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="sitUpDebugPipeline.sitConfirmed ? 'text-orange-400' : 'text-slate-600'">
                                {{ sitUpDebugPipeline.sitConfirmed ? 'YES ✓' : 'NO' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">FLAT Zone (≥140°)</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="sitUpDebugPipeline.inFlatZone ? 'text-emerald-400' : 'text-slate-600'">
                                {{ sitUpDebugPipeline.inFlatZone ? 'YES ✓' : 'NO' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">FLAT Accumulate</span>
                            <span class="text-xs font-mono"
                                  :class="sitUpDebugPipeline.flatAccumMs > 0 ? 'text-emerald-400' : 'text-slate-600'">
                                {{ sitUpDebugPipeline.flatAccumMs > 0 ? `${sitUpDebugPipeline.flatAccumMs}ms / 50ms` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Rep Increment</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="sitUpDebugPipeline.repIncremented ? 'text-emerald-400' : 'text-slate-600'">
                                {{ sitUpDebugPipeline.repIncremented ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between" v-if="sitUpDebugPipeline.blockReason !== '—'">
                            <span class="text-xs text-slate-600">Block reason</span>
                            <span class="text-xs font-mono text-slate-500 text-right max-w-[160px] leading-tight">{{ sitUpDebugPipeline.blockReason }}</span>
                        </div>
                    </div>

                    <!-- Cumulative Counters -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Cumulative Counters</p>
                    <div class="space-y-1.5 mb-3" v-if="sitUpDebugCumul">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Validation READY frames</span>
                            <span class="text-xs font-mono text-slate-400">{{ sitUpDebugCumul.validationReadyFrames }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Hip angle samples</span>
                            <span class="text-xs font-mono text-slate-400">{{ sitUpDebugCumul.hipAngleSamples }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">SIT zone frames</span>
                            <span class="text-xs font-mono"
                                  :class="sitUpDebugCumul.sitZoneFrames > 0 ? 'text-orange-400' : 'text-slate-500'">
                                {{ sitUpDebugCumul.sitZoneFrames }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">SIT timer max</span>
                            <span class="text-xs font-mono"
                                  :class="sitUpDebugCumul.sitTimerMaxMs >= 50 ? 'text-emerald-400' : sitUpDebugCumul.sitTimerMaxMs > 0 ? 'text-yellow-400' : 'text-red-400'">
                                {{ sitUpDebugCumul.sitTimerMaxMs }}ms
                                <span class="text-slate-600 text-xs">(need ≥50ms)</span>
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">SIT confirmed count</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="sitUpDebugCumul.sitConfirmedCount > 0 ? 'text-orange-400' : 'text-red-400'">
                                {{ sitUpDebugCumul.sitConfirmedCount }}x
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">FLAT zone frames</span>
                            <span class="text-xs font-mono"
                                  :class="sitUpDebugCumul.flatZoneFrames > 0 ? 'text-emerald-400' : 'text-slate-500'">
                                {{ sitUpDebugCumul.flatZoneFrames }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">FLAT timer max</span>
                            <span class="text-xs font-mono"
                                  :class="sitUpDebugCumul.flatTimerMaxMs >= 50 ? 'text-emerald-400' : sitUpDebugCumul.flatTimerMaxMs > 0 ? 'text-yellow-400' : 'text-red-400'">
                                {{ sitUpDebugCumul.flatTimerMaxMs }}ms
                                <span class="text-slate-600 text-xs">(need ≥50ms)</span>
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">FLAT confirmed count</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="sitUpDebugCumul.flatConfirmedCount > 0 ? 'text-emerald-400' : 'text-slate-500'">
                                {{ sitUpDebugCumul.flatConfirmedCount }}x
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Rep increment count</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="sitUpDebugCumul.repIncrementCount > 0 ? 'text-emerald-400 text-base' : 'text-red-400'">
                                {{ sitUpDebugCumul.repIncrementCount }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between" v-if="sitUpDebugCumul.lastBlockReason !== '—'">
                            <span class="text-xs text-slate-600">Last block reason</span>
                            <span class="text-xs font-mono text-slate-500 text-right max-w-[160px]">{{ sitUpDebugCumul.lastBlockReason }}</span>
                        </div>
                    </div>

                    <!-- Landmark Visibility -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Landmark Visibility</p>
                    <div class="space-y-1 mb-3" v-if="sitUpDebugLandmarks.length">
                        <div v-for="lm in sitUpDebugLandmarks" :key="lm.index"
                             class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">{{ lm.name }}</span>
                            <span class="text-xs font-mono"
                                  :class="{
                                      'text-emerald-400': lm.status === 'VISIBLE',
                                      'text-yellow-400':  lm.status === 'LOW',
                                      'text-slate-600':   lm.status === 'MISSING',
                                  }">
                                {{ lm.vis !== null ? `${lm.vis}%` : '—' }}
                                <span class="text-slate-600 ml-1">{{ lm.status }}</span>
                            </span>
                        </div>
                    </div>

                    <!-- Counting Landmarks -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Counting Landmarks</p>
                    <div class="space-y-1.5 mb-3" v-if="sitUpDebugCountingLm">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Required valid</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="sitUpDebugCountingLm.countingValid >= 2 ? 'text-emerald-400' : 'text-red-400'">
                                {{ sitUpDebugCountingLm.countingValid }}/{{ sitUpDebugCountingLm.countingTotal }}
                                <span class="text-slate-500">(shld+hip+knee)</span>
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Blocked by counting lm</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="sitUpDebugCountingLm.blockedByCountingLm ? 'text-red-400' : 'text-emerald-400'">
                                {{ sitUpDebugCountingLm.blockedByCountingLm ? 'YES ✗' : 'NO — counting ok' }}
                            </span>
                        </div>
                        <div v-if="sitUpDebugCountingLm.countingMissing?.length">
                            <span class="text-xs text-slate-600">Missing counting:</span>
                            <span class="text-xs font-mono text-red-400 ml-1">{{ sitUpDebugCountingLm.countingMissing.join(', ') }}</span>
                        </div>
                    </div>

                    <!-- State Machine Diagnostics -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">State Machine</p>
                    <div class="space-y-1.5 mb-3" v-if="sitUpDebugSM">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Current Phase</span>
                            <span class="text-xs font-mono font-bold" :class="sitUpPhaseColor">{{ sitUpPhaseLabel }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Hip Min/Max</span>
                            <span class="text-xs font-mono text-cyan-400">{{ sitUpDebugSM.minHipSeen }}° / {{ sitUpDebugSM.maxHipSeen }}°</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Frames ≤ 90° (SIT)</span>
                            <span class="text-xs font-mono"
                                  :class="sitUpDebugSM.framesHipBelowSit > 0 ? 'text-orange-400' : 'text-slate-500'">
                                {{ sitUpDebugSM.framesHipBelowSit }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Frames ≥ 140° (FLAT)</span>
                            <span class="text-xs font-mono"
                                  :class="sitUpDebugSM.framesHipAboveFlat > 0 ? 'text-emerald-400' : 'text-slate-500'">
                                {{ sitUpDebugSM.framesHipAboveFlat }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">SIT reached</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="sitUpDebugSM.sitEverReached ? 'text-orange-400' : 'text-red-400'">
                                {{ sitUpDebugSM.sitEverReached ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">FLAT after SIT</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="sitUpDebugSM.flatAfterSitReached ? 'text-emerald-400' : 'text-red-400'">
                                {{ sitUpDebugSM.flatAfterSitReached ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Blocked: Validation</span>
                            <span class="text-xs font-mono text-slate-500">{{ sitUpDebugSM.blockedByValidation }}x</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Blocked: Landmark</span>
                            <span class="text-xs font-mono text-slate-500">{{ sitUpDebugSM.blockedByLandmark }}x</span>
                        </div>
                        <div class="flex items-center justify-between" v-if="sitUpDebugSM.lastBlockReason !== '—'">
                            <span class="text-xs text-slate-600">Last block reason</span>
                            <span class="text-xs font-mono text-slate-500 text-right max-w-[180px]">{{ sitUpDebugSM.lastBlockReason }}</span>
                        </div>
                    </div>

                    <!-- Frame History -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Frame History (25 sampel)</p>
                    <div class="overflow-x-auto mb-3" v-if="sitUpDebugHistory.length">
                        <table class="w-full text-xs font-mono">
                            <thead>
                                <tr class="text-slate-600">
                                <th class="text-left pr-2">t(s)</th>
                                <th class="text-left pr-2">fps</th>
                                <th class="text-left pr-2">val</th>
                                <th class="text-left pr-2">hip</th>
                                <th class="text-left pr-2">phase</th>
                                <th class="text-left">form</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(row, i) in [...sitUpDebugHistory].reverse().slice(0, 15)" :key="i"
                                    class="border-t border-white/5">
                                    <td class="pr-2 text-slate-500">{{ row.ts }}</td>
                                    <td class="pr-2 text-slate-500">{{ row.fps }}</td>
                                    <td class="pr-2" :class="row.valid === 'READY' ? 'text-emerald-400' : 'text-slate-500'">
                                        {{ row.valid === 'READY' ? 'RDY' : row.valid?.slice(0,3) ?? '—' }}
                                    </td>
                                    <td class="pr-2 text-cyan-400">{{ row.hip > 0 ? `${row.hip}°` : '—' }}</td>
                                    <td class="pr-2" :class="{
                                        'text-slate-400':  row.phase === 'READY',
                                        'text-orange-400': row.phase === 'SIT',
                                        'text-emerald-400':row.phase === 'FLAT',
                                    }">{{ row.phase }}</td>
                                    <td :class="{
                                        'text-emerald-400': row.form === 'GOOD_FORM',
                                        'text-yellow-400':  row.form === 'ADJUST_POSITION',
                                        'text-slate-500':   row.form === 'NO_DATA',
                                    }">{{ row.form === 'GOOD_FORM' ? 'OK' : row.form === 'ADJUST_POSITION' ? 'ADJ' : '—' }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Rep History -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">
                        Repetition History ({{ sitUpDebugRepHistory.length }} siklus)
                    </p>
                    <div v-if="sitUpDebugRepHistory.length" class="overflow-x-auto mb-3">
                        <table class="w-full text-xs font-mono">
                            <thead>
                                <tr class="text-slate-600">
                                <th class="text-left pr-1">#</th>
                                <th class="text-left pr-1">SIT</th>
                                <th class="text-left pr-1">SIT&#x2713;</th>
                                <th class="text-left pr-1">FLAT</th>
                                <th class="text-left pr-1">FLAT&#x2713;</th>
                                <th class="text-left pr-1">Rep</th>
                                <th class="text-left">Reason</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="c in [...sitUpDebugRepHistory].reverse()" :key="c.cycleNumber"
                                    class="border-t border-white/5">
                                    <td class="pr-1 text-slate-500">{{ c.cycleNumber }}</td>
                                    <td class="pr-1" :class="c.sitDetected ? 'text-orange-400' : 'text-slate-600'">{{ c.sitDetected ? 'Y' : '-' }}</td>
                                    <td class="pr-1" :class="c.sitConfirmed ? 'text-orange-400' : 'text-slate-600'">{{ c.sitConfirmed ? 'Y' : 'N' }}</td>
                                    <td class="pr-1" :class="c.flatDetected ? 'text-emerald-400' : 'text-slate-600'">{{ c.flatDetected ? 'Y' : '-' }}</td>
                                    <td class="pr-1" :class="c.flatConfirmed ? 'text-emerald-400' : 'text-slate-600'">{{ c.flatConfirmed ? 'Y' : 'N' }}</td>
                                    <td class="pr-1" :class="c.counted ? 'text-emerald-400' : 'text-red-400'">{{ c.counted ? 'Y' : 'N' }}</td>
                                    <td class="text-slate-500 text-xs">{{ c.resetReason !== '—' ? c.resetReason : '' }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div v-else class="text-xs text-slate-600 mb-3">Belum ada siklus selesai.</div>

                    <!-- Thresholds -->
                    <div class="border-t border-white/5 pt-2 mt-1 space-y-1">
                        <p class="text-xs text-slate-600">Thresholds aktif:</p>
                        <p class="text-xs font-mono text-slate-600">SIT ≤ 90° | FLAT ≥ 140°</p>
                        <p class="text-xs font-mono text-slate-600">Stab: 50ms | MIN_VIS: 0.5</p>
                    </div>
                </div>

                <!-- DEBUG PANEL — Static Balance -->
                <div v-if="BALANCE_DEBUG && isStaticBalanceTest && sessionState === 'assessing'"
                     class="card p-4 border-emerald-500/20 bg-emerald-500/5">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Balance Debug</h3>
                        <span class="text-xs font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">DEV</span>
                    </div>

                    <!-- State -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">State</p>
                    <div class="space-y-1.5 mb-3">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Phase</span>
                            <span class="text-xs font-mono font-bold" :class="balancePhaseColor">{{ balancePhaseLabel }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Pose Valid</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="validationStatus === 'READY' ? 'text-emerald-400' : 'text-slate-500'">
                                {{ validationStatus }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Balance Duration</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="isBalancing ? 'text-emerald-400' : 'text-white'">
                                {{ balanceDurationFormatted }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Total Sesi</span>
                            <span class="text-xs font-mono text-slate-400">{{ balanceTotalDuration.toFixed(1) }}s</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Standing Leg</span>
                            <span class="text-xs font-mono font-bold text-cyan-400">{{ standingLeg }}</span>
                        </div>
                    </div>

                    <!-- Ankle Detail -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Ankle Detail</p>
                    <div class="space-y-1.5 mb-3" v-if="balanceDebugAnkle">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Ankle Diff Y</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="balanceDebugAnkle.diffY >= 0.08 ? 'text-emerald-400' : 'text-slate-400'">
                                {{ balanceDebugAnkle.diffY.toFixed(3) }}
                                <span class="text-slate-600">(threshold: 0.08)</span>
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">L.Ankle vis / Y</span>
                            <span class="text-xs font-mono"
                                  :class="balanceDebugAnkle.leftAnkleVis >= 50 ? 'text-emerald-400' : 'text-red-400'">
                                {{ balanceDebugAnkle.leftAnkleVis }}% / {{ balanceDebugAnkle.leftAnkleY.toFixed(3) }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">R.Ankle vis / Y</span>
                            <span class="text-xs font-mono"
                                  :class="balanceDebugAnkle.rightAnkleVis >= 50 ? 'text-emerald-400' : 'text-red-400'">
                                {{ balanceDebugAnkle.rightAnkleVis }}% / {{ balanceDebugAnkle.rightAnkleY.toFixed(3) }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">L.Foot / R.Foot vis</span>
                            <span class="text-xs font-mono text-slate-400">
                                {{ balanceDebugAnkle.leftFootVis }}% / {{ balanceDebugAnkle.rightFootVis }}%
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">Both Ankle Visible</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="balanceDebugAnkle.bothAnkleVisible ? 'text-emerald-400' : 'text-yellow-400'">
                                {{ balanceDebugAnkle.bothAnkleVisible ? 'YES ✓' : 'NO — single ankle' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">Lift Candidate Side</span>
                            <span class="text-xs font-mono"
                                  :class="balanceDebugAnkle.liftCandidateSide !== '—' ? 'text-orange-400' : 'text-slate-600'">
                                {{ balanceDebugAnkle.liftCandidateSide }}
                            </span>
                        </div>
                    </div>

                    <!-- Counting Pipeline -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Pipeline</p>
                    <div class="space-y-1.5 mb-3" v-if="balanceDebugPipeline">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Validation READY</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="balanceDebugPipeline.validationReady ? 'text-emerald-400' : 'text-red-400'">
                                {{ balanceDebugPipeline.validationReady ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Ankle Visible</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="balanceDebugPipeline.ankleVisible ? 'text-emerald-400' : 'text-red-400'">
                                {{ balanceDebugPipeline.ankleVisible ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Diff Y</span>
                            <span class="text-xs font-mono"
                                  :class="balanceDebugPipeline.diffY >= 0.08 ? 'text-orange-400' : 'text-slate-400'">
                                {{ balanceDebugPipeline.diffY.toFixed(3) }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">In Lift Zone (>=0.08)</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="balanceDebugPipeline.inLiftZone ? 'text-orange-400' : 'text-slate-600'">
                                {{ balanceDebugPipeline.inLiftZone ? 'YES ✓' : 'NO' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Lift Accumulate</span>
                            <span class="text-xs font-mono"
                                  :class="balanceDebugPipeline.liftAccumMs > 0 ? 'text-orange-400' : 'text-slate-600'">
                                {{ balanceDebugPipeline.liftAccumMs > 0 ? `${balanceDebugPipeline.liftAccumMs}ms / 300ms` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Lift Confirmed</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="balanceDebugPipeline.liftConfirmed ? 'text-emerald-400' : 'text-slate-600'">
                                {{ balanceDebugPipeline.liftConfirmed ? 'YES ✓ (BALANCING)' : 'NO' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">In Drop Zone</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="balanceDebugPipeline.inDropZone ? 'text-yellow-400' : 'text-slate-600'">
                                {{ balanceDebugPipeline.inDropZone ? 'YES (kaki mau turun)' : 'NO' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Drop Accumulate</span>
                            <span class="text-xs font-mono"
                                  :class="balanceDebugPipeline.dropAccumMs > 0 ? 'text-yellow-400' : 'text-slate-600'">
                                {{ balanceDebugPipeline.dropAccumMs > 0 ? `${balanceDebugPipeline.dropAccumMs}ms / 200ms` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Balancing Duration</span>
                            <span class="text-xs font-mono"
                                  :class="balanceDebugPipeline.balancingDuration > 0 ? 'text-emerald-400' : 'text-slate-600'">
                                {{ balanceDebugPipeline.balancingDuration > 0 ? `${(balanceDebugPipeline.balancingDuration/1000).toFixed(1)}s` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between" v-if="balanceDebugPipeline.blockReason !== '—'">
                            <span class="text-xs text-slate-600">Block reason</span>
                            <span class="text-xs font-mono text-slate-500 text-right max-w-[160px] leading-tight">
                                {{ balanceDebugPipeline.blockReason }}
                            </span>
                        </div>
                    </div>

                    <!-- Cumulative Counters -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Cumulative</p>
                    <div class="space-y-1.5 mb-3" v-if="balanceDebugCumul">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">READY frames</span>
                            <span class="text-xs font-mono text-slate-400">{{ balanceDebugCumul.validationReadyFrames }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Ankle visible frames</span>
                            <span class="text-xs font-mono text-slate-400">{{ balanceDebugCumul.ankleVisibleFrames }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Lift candidate frames</span>
                            <span class="text-xs font-mono"
                                  :class="balanceDebugCumul.liftCandidateFrames > 0 ? 'text-orange-400' : 'text-slate-500'">
                                {{ balanceDebugCumul.liftCandidateFrames }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">BALANCING confirmed</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="balanceDebugCumul.liftConfirmedCount > 0 ? 'text-emerald-400' : 'text-red-400'">
                                {{ balanceDebugCumul.liftConfirmedCount }}x
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Max duration</span>
                            <span class="text-xs font-mono"
                                  :class="balanceDebugCumul.maxBalanceDurationMs > 0 ? 'text-emerald-400' : 'text-slate-500'">
                                {{ balanceDebugCumul.maxBalanceDurationMs > 0 ? `${(balanceDebugCumul.maxBalanceDurationMs/1000).toFixed(1)}s` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">FP guard blocked</span>
                            <span class="text-xs font-mono text-slate-500">{{ balanceDebugCumul.falsePositiveGuardCount }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Landmark blocked</span>
                            <span class="text-xs font-mono text-slate-500">{{ balanceDebugCumul.landmarkBlockedCount }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Validation blocked</span>
                            <span class="text-xs font-mono text-slate-500">{{ balanceDebugCumul.validationBlockedCount }}</span>
                        </div>
                        <div class="flex items-center justify-between" v-if="balanceDebugCumul.lastBlockReason !== '—'">
                            <span class="text-xs text-slate-600">Last block reason</span>
                            <span class="text-xs font-mono text-slate-500 text-right max-w-[160px]">{{ balanceDebugCumul.lastBlockReason }}</span>
                        </div>
                    </div>

                    <!-- Landmark Visibility -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Landmark Visibility</p>
                    <div class="space-y-1 mb-3" v-if="balanceDebugLandmarks.length">
                        <div v-for="lm in balanceDebugLandmarks" :key="lm.index"
                             class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">{{ lm.name }}</span>
                            <span class="text-xs font-mono"
                                  :class="{
                                      'text-emerald-400': lm.status === 'VISIBLE',
                                      'text-yellow-400':  lm.status === 'LOW',
                                      'text-slate-600':   lm.status === 'MISSING',
                                  }">
                                {{ lm.vis !== null ? `${lm.vis}%` : '—' }}
                                <span class="text-slate-600 ml-1">{{ lm.status }}</span>
                            </span>
                        </div>
                    </div>

                    <!-- State Machine Diagnostics -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">State Machine</p>
                    <div class="space-y-1.5 mb-3" v-if="balanceDebugSM">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Current Phase</span>
                            <span class="text-xs font-mono font-bold" :class="balancePhaseColor">{{ balancePhaseLabel }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">DiffY Min/Max seen</span>
                            <span class="text-xs font-mono text-cyan-400">
                                {{ balanceDebugSM.minDiffYSeen.toFixed(3) }} / {{ balanceDebugSM.maxDiffYSeen.toFixed(3) }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Frames in Lift Zone</span>
                            <span class="text-xs font-mono"
                                  :class="balanceDebugSM.framesInLiftZone > 0 ? 'text-orange-400' : 'text-slate-500'">
                                {{ balanceDebugSM.framesInLiftZone }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Frames in Drop Zone</span>
                            <span class="text-xs font-mono text-slate-500">{{ balanceDebugSM.framesInDropZone }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Balancing ever started</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="balanceDebugSM.balancingEverStarted ? 'text-emerald-400' : 'text-red-400'">
                                {{ balanceDebugSM.balancingEverStarted ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Val. Drops</span>
                            <span class="text-xs font-mono text-slate-500">{{ balanceDebugSM.validationDropCount }}x</span>
                        </div>
                        <div class="flex items-center justify-between" v-if="balanceDebugSM.lastBlockReason !== '—'">
                            <span class="text-xs text-slate-600">Last block reason</span>
                            <span class="text-xs font-mono text-slate-500 text-right max-w-[180px]">{{ balanceDebugSM.lastBlockReason }}</span>
                        </div>
                    </div>

                    <!-- Frame History -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Frame History</p>
                    <div class="overflow-x-auto mb-3" v-if="balanceDebugHistory.length">
                        <table class="w-full text-xs font-mono">
                            <thead>
                                <tr class="text-slate-600">
                                <th class="text-left pr-2">t(s)</th>
                                <th class="text-left pr-2">fps</th>
                                <th class="text-left pr-2">val</th>
                                <th class="text-left pr-2">diffY</th>
                                <th class="text-left pr-2">phase</th>
                                <th class="text-left">dur</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(row, i) in [...balanceDebugHistory].reverse().slice(0, 15)" :key="i"
                                    class="border-t border-white/5">
                                    <td class="pr-2 text-slate-500">{{ row.ts }}</td>
                                    <td class="pr-2 text-slate-500">{{ row.fps }}</td>
                                    <td class="pr-2" :class="row.valid === 'READY' ? 'text-emerald-400' : 'text-slate-500'">
                                        {{ row.valid === 'READY' ? 'RDY' : 'NO' }}
                                    </td>
                                    <td class="pr-2"
                                        :class="row.diffY >= 0.08 ? 'text-orange-400' : 'text-slate-400'">
                                        {{ row.diffY.toFixed(3) }}
                                    </td>
                                    <td class="pr-2"
                                        :class="{
                                            'text-slate-400':   row.phase === 'WAITING',
                                            'text-slate-300':   row.phase === 'READY',
                                            'text-emerald-400': row.phase === 'BALANCING',
                                            'text-primary-400': row.phase === 'COMPLETE',
                                        }">
                                        {{ row.phase }}
                                    </td>
                                    <td class="text-cyan-400">{{ row.dur }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Balance Event Log -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">
                        Balance Events ({{ balanceDebugEvents.length }})
                    </p>
                    <div v-if="balanceDebugEvents.length" class="space-y-1.5 mb-3">
                        <div v-for="(ev, i) in [...balanceDebugEvents].reverse()" :key="i"
                             class="flex items-center justify-between text-xs font-mono border-t border-white/5 pt-1">
                            <span class="text-slate-500">{{ ev.durationSec }}s</span>
                            <span class="text-cyan-400">{{ ev.standingLeg }}</span>
                            <span class="text-slate-500">{{ ev.endReason }}</span>
                        </div>
                    </div>
                    <div v-else class="text-xs text-slate-600 mb-3">Belum ada balance event.</div>

                    <!-- Thresholds -->
                    <div class="border-t border-white/5 pt-2 mt-1 space-y-1">
                        <p class="text-xs text-slate-600">Thresholds (PROVISIONAL):</p>
                        <p class="text-xs font-mono text-slate-600">Lift >= 0.08 | Confirm: 300ms</p>
                        <p class="text-xs font-mono text-slate-600">Drop: 200ms | MIN_VIS: 0.5</p>
                    </div>
                </div>

                <!-- DEBUG PANEL — Elbow Plank -->
                <div v-if="PLANK_DEBUG && isElbowPlankTest && sessionState === 'assessing'"
                     class="card p-4 border-orange-500/20 bg-orange-500/5">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-xs font-semibold text-orange-400 uppercase tracking-wider">Elbow Plank Debug</h3>
                        <span class="text-xs font-mono bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded">DEV</span>
                    </div>

                    <!-- State -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">State</p>
                    <div class="space-y-1.5 mb-3">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Phase</span>
                            <span class="text-xs font-mono font-bold" :class="plankPhaseColor">{{ plankPhaseLabel }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Pose Valid</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="validationStatus === 'READY' ? 'text-emerald-400' : 'text-slate-500'">
                                {{ validationStatus }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Hold Duration</span>
                            <span class="text-xs font-mono font-bold" :class="plankIsHolding ? 'text-emerald-400' : 'text-white'">
                                {{ plankHoldDurationFormatted }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Total Sesi</span>
                            <span class="text-xs font-mono text-slate-400">{{ plankTotalDuration.toFixed(1) }}s</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Counting Side</span>
                            <span class="text-xs font-mono font-bold text-cyan-400">{{ plankCountingSide }}</span>
                        </div>
                    </div>

                    <!-- Alignment -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Alignment</p>
                    <div class="space-y-1.5 mb-3" v-if="plankDebugAlignment">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">L.Body Angle</span>
                            <span class="text-xs font-mono"
                                  :class="plankDebugAlignment.leftBodyAngle >= 160 ? 'text-emerald-400' : 'text-slate-400'">
                                {{ plankDebugAlignment.leftBodyAngle > 0 ? `${plankDebugAlignment.leftBodyAngle}°` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">R.Body Angle</span>
                            <span class="text-xs font-mono"
                                  :class="plankDebugAlignment.rightBodyAngle >= 160 ? 'text-emerald-400' : 'text-slate-400'">
                                {{ plankDebugAlignment.rightBodyAngle > 0 ? `${plankDebugAlignment.rightBodyAngle}°` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">Shoulder / Hip / Ankle vis</span>
                            <span class="text-xs font-mono text-slate-400">
                                {{ plankDebugAlignment.shoulderVis }}% / {{ plankDebugAlignment.hipVis }}% / {{ plankDebugAlignment.ankleVis }}%
                            </span>
                        </div>
                        <div class="border-t border-white/5 pt-1.5 mt-1">
                            <p class="text-xs text-slate-600 mb-1">Orientation Guard</p>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-600">Horizontal Span</span>
                                <span class="text-xs font-mono text-slate-400">{{ plankDebugAlignment.horizontalSpan.toFixed(3) }}</span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-600">Vertical Span</span>
                                <span class="text-xs font-mono"
                                      :class="plankDebugAlignment.verticalSpan <= 0.35 ? 'text-emerald-400' : 'text-red-400'">
                                    {{ plankDebugAlignment.verticalSpan.toFixed(3) }}
                                    <span class="text-slate-600">(max 0.35)</span>
                                </span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-600">Orientation Ratio</span>
                                <span class="text-xs font-mono"
                                      :class="plankDebugAlignment.orientationRatio >= 1.5 ? 'text-emerald-400' : 'text-red-400'">
                                    {{ plankDebugAlignment.orientationRatio.toFixed(2) }}
                                    <span class="text-slate-600">(min 1.5)</span>
                                </span>
                            </div>
                        </div>
                        <div class="border-t border-white/5 pt-1.5 mt-1 space-y-1">
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-600">Angle valid (>=160°)</span>
                                <span class="text-xs font-mono font-bold"
                                      :class="plankDebugAlignment.angleValid ? 'text-emerald-400' : 'text-red-400'">
                                    {{ plankDebugAlignment.angleValid ? 'YES' : 'NO' }}
                                </span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-600">Orientation valid</span>
                                <span class="text-xs font-mono font-bold"
                                      :class="plankDebugAlignment.orientationValid ? 'text-emerald-400' : 'text-red-400'">
                                    {{ plankDebugAlignment.orientationValid ? 'YES' : 'NO' }}
                                </span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-600">V.Span valid (<=0.35)</span>
                                <span class="text-xs font-mono font-bold"
                                      :class="plankDebugAlignment.verticalSpanValid ? 'text-emerald-400' : 'text-red-400'">
                                    {{ plankDebugAlignment.verticalSpanValid ? 'YES' : 'NO' }}
                                </span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-600 font-semibold">Plank Valid (ALL)</span>
                                <span class="text-xs font-mono font-bold text-base"
                                      :class="plankDebugAlignment.plankValid ? 'text-emerald-400' : 'text-red-400'">
                                    {{ plankDebugAlignment.plankValid ? 'YES ✓' : 'NO ✗' }}
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Pipeline -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Pipeline</p>
                    <div class="space-y-1.5 mb-3" v-if="plankDebugPipeline">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Validation READY</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="plankDebugPipeline.validationReady ? 'text-emerald-400' : 'text-red-400'">
                                {{ plankDebugPipeline.validationReady ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Plank Valid (all guards)</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="plankDebugPipeline.plankValid ? 'text-emerald-400' : 'text-red-400'">
                                {{ plankDebugPipeline.plankValid ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Hold Accumulate</span>
                            <span class="text-xs font-mono"
                                  :class="plankDebugPipeline.holdAccumMs > 0 ? 'text-orange-400' : 'text-slate-600'">
                                {{ plankDebugPipeline.holdAccumMs > 0 ? `${plankDebugPipeline.holdAccumMs}ms / 300ms` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">HOLDING Confirmed</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="plankDebugPipeline.holdConfirmed ? 'text-emerald-400' : 'text-slate-600'">
                                {{ plankDebugPipeline.holdConfirmed ? 'YES ✓' : 'NO' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">In Exit Zone</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="plankDebugPipeline.inExitZone ? 'text-yellow-400' : 'text-slate-600'">
                                {{ plankDebugPipeline.inExitZone ? 'YES (plank hilang)' : 'NO' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Exit Accumulate</span>
                            <span class="text-xs font-mono"
                                  :class="plankDebugPipeline.exitAccumMs > 0 ? 'text-yellow-400' : 'text-slate-600'">
                                {{ plankDebugPipeline.exitAccumMs > 0 ? `${plankDebugPipeline.exitAccumMs}ms / 200ms` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Holding Duration</span>
                            <span class="text-xs font-mono"
                                  :class="plankDebugPipeline.holdingDuration > 0 ? 'text-emerald-400' : 'text-slate-600'">
                                {{ plankDebugPipeline.holdingDuration > 0 ? `${(plankDebugPipeline.holdingDuration/1000).toFixed(1)}s` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between" v-if="plankDebugPipeline.blockReason !== '—'">
                            <span class="text-xs text-slate-600">Block reason</span>
                            <span class="text-xs font-mono text-slate-500 text-right max-w-[160px] leading-tight">
                                {{ plankDebugPipeline.blockReason }}
                            </span>
                        </div>
                    </div>

                    <!-- Cumulative -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Cumulative</p>
                    <div class="space-y-1.5 mb-3" v-if="plankDebugCumul">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">READY frames</span>
                            <span class="text-xs font-mono text-slate-400">{{ plankDebugCumul.validationReadyFrames }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Plank valid frames</span>
                            <span class="text-xs font-mono"
                                  :class="plankDebugCumul.plankValidFrames > 0 ? 'text-orange-400' : 'text-slate-500'">
                                {{ plankDebugCumul.plankValidFrames }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">HOLDING confirmed</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="plankDebugCumul.holdConfirmedCount > 0 ? 'text-emerald-400' : 'text-red-400'">
                                {{ plankDebugCumul.holdConfirmedCount }}x
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Max duration</span>
                            <span class="text-xs font-mono"
                                  :class="plankDebugCumul.maxHoldDurationMs > 0 ? 'text-emerald-400' : 'text-slate-500'">
                                {{ plankDebugCumul.maxHoldDurationMs > 0 ? `${(plankDebugCumul.maxHoldDurationMs/1000).toFixed(1)}s` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Blocked: angle</span>
                            <span class="text-xs font-mono" :class="plankDebugCumul.blockedByAngle > 0 ? 'text-red-400' : 'text-slate-500'">
                                {{ plankDebugCumul.blockedByAngle }}x
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Blocked: orientation</span>
                            <span class="text-xs font-mono" :class="plankDebugCumul.blockedByOrientation > 0 ? 'text-red-400' : 'text-slate-500'">
                                {{ plankDebugCumul.blockedByOrientation }}x
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Blocked: vertical span</span>
                            <span class="text-xs font-mono" :class="plankDebugCumul.blockedByVerticalSpan > 0 ? 'text-red-400' : 'text-slate-500'">
                                {{ plankDebugCumul.blockedByVerticalSpan }}x
                            </span>
                        </div>
                        <div class="flex items-center justify-between" v-if="plankDebugCumul.lastBlockReason !== '—'">
                            <span class="text-xs text-slate-600">Last block reason</span>
                            <span class="text-xs font-mono text-slate-500 text-right max-w-[160px]">{{ plankDebugCumul.lastBlockReason }}</span>
                        </div>
                    </div>

                    <!-- Landmark Visibility -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Landmark Visibility</p>
                    <div class="space-y-1 mb-3" v-if="plankDebugLandmarks.length">
                        <div v-for="lm in plankDebugLandmarks" :key="lm.index"
                             class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">{{ lm.name }}</span>
                            <span class="text-xs font-mono"
                                  :class="{
                                      'text-emerald-400': lm.status === 'VISIBLE',
                                      'text-yellow-400':  lm.status === 'LOW',
                                      'text-slate-600':   lm.status === 'MISSING',
                                  }">
                                {{ lm.vis !== null ? `${lm.vis}%` : '—' }}
                                <span class="text-slate-600 ml-1">{{ lm.status }}</span>
                            </span>
                        </div>
                    </div>

                    <!-- State Machine -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">State Machine</p>
                    <div class="space-y-1.5 mb-3" v-if="plankDebugSM">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Body Angle Min/Max</span>
                            <span class="text-xs font-mono text-cyan-400">
                                {{ plankDebugSM.minBodyAngleSeen }}° / {{ plankDebugSM.maxBodyAngleSeen }}°
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Ratio Min/Max</span>
                            <span class="text-xs font-mono text-cyan-400">
                                {{ plankDebugSM.minRatioSeen }} / {{ plankDebugSM.maxRatioSeen }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Frames plank valid</span>
                            <span class="text-xs font-mono"
                                  :class="plankDebugSM.framesPlankValid > 0 ? 'text-orange-400' : 'text-slate-500'">
                                {{ plankDebugSM.framesPlankValid }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">HOLDING ever started</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="plankDebugSM.holdingEverStarted ? 'text-emerald-400' : 'text-red-400'">
                                {{ plankDebugSM.holdingEverStarted ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Val. Drops</span>
                            <span class="text-xs font-mono text-slate-500">{{ plankDebugSM.validationDropCount }}x</span>
                        </div>
                        <div class="flex items-center justify-between" v-if="plankDebugSM.lastBlockReason !== '—'">
                            <span class="text-xs text-slate-600">Last block reason</span>
                            <span class="text-xs font-mono text-slate-500 text-right max-w-[180px]">{{ plankDebugSM.lastBlockReason }}</span>
                        </div>
                    </div>

                    <!-- Frame History -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Frame History</p>
                    <div class="overflow-x-auto mb-3" v-if="plankDebugHistory.length">
                        <table class="w-full text-xs font-mono">
                            <thead>
                                <tr class="text-slate-600">
                                <th class="text-left pr-2">t(s)</th>
                                <th class="text-left pr-2">fps</th>
                                <th class="text-left pr-2">ang</th>
                                <th class="text-left pr-2">ratio</th>
                                <th class="text-left pr-2">plank</th>
                                <th class="text-left">phase</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(row, i) in [...plankDebugHistory].reverse().slice(0, 15)" :key="i"
                                    class="border-t border-white/5">
                                    <td class="pr-2 text-slate-500">{{ row.ts }}</td>
                                    <td class="pr-2 text-slate-500">{{ row.fps }}</td>
                                    <td class="pr-2" :class="row.angle >= 160 ? 'text-emerald-400' : 'text-slate-400'">
                                        {{ row.angle > 0 ? `${row.angle}°` : '—' }}
                                    </td>
                                    <td class="pr-2" :class="row.ratio >= 1.5 ? 'text-emerald-400' : 'text-red-400'">
                                        {{ row.ratio }}
                                    </td>
                                    <td class="pr-2" :class="row.plank ? 'text-emerald-400' : 'text-red-400'">
                                        {{ row.plank ? 'Y' : 'N' }}
                                    </td>
                                    <td :class="{
                                        'text-slate-400':   row.phase === 'WAITING',
                                        'text-slate-300':   row.phase === 'READY',
                                        'text-emerald-400': row.phase === 'HOLDING',
                                        'text-primary-400': row.phase === 'COMPLETE',
                                    }">{{ row.phase }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Hold Events -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">
                        Hold Events ({{ plankDebugEvents.length }})
                    </p>
                    <div v-if="plankDebugEvents.length" class="space-y-1.5 mb-3">
                        <div v-for="(ev, i) in [...plankDebugEvents].reverse()" :key="i"
                             class="flex items-center justify-between text-xs font-mono border-t border-white/5 pt-1">
                            <span class="text-slate-500">{{ ev.durationSec }}s</span>
                            <span class="text-slate-500">{{ ev.endReason }}</span>
                        </div>
                    </div>
                    <div v-else class="text-xs text-slate-600 mb-3">Belum ada hold event.</div>

                    <!-- Thresholds -->
                    <div class="border-t border-white/5 pt-2 mt-1 space-y-1">
                        <p class="text-xs text-slate-600">Thresholds (PROVISIONAL):</p>
                        <p class="text-xs font-mono text-slate-600">Angle >= 160° | Ratio >= 1.5</p>
                        <p class="text-xs font-mono text-slate-600">V.Span <= 0.35 | Confirm: 300ms</p>
                        <p class="text-xs font-mono text-slate-600">Exit: 200ms | MIN_VIS: 0.5</p>
                    </div>
                </div>

                <!-- DEBUG PANEL — Sit and Reach -->
                <div v-if="SITANDREACH_DEBUG && isSitAndReachTest && sessionState === 'assessing'"
                     class="card p-4 border-teal-500/20 bg-teal-500/5">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-xs font-semibold text-teal-400 uppercase tracking-wider">Sit & Reach Debug</h3>
                        <span class="text-xs font-mono bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded">DEV</span>
                    </div>

                    <!-- State -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">State</p>
                    <div class="space-y-1.5 mb-3">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Phase</span>
                            <span class="text-xs font-mono font-bold" :class="sitReachPhaseColor">{{ sitReachPhaseLabel }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Pose Valid</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="validationStatus === 'READY' ? 'text-emerald-400' : 'text-slate-500'">
                                {{ validationStatus }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Sitting Valid</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="sitReachSittingValid ? 'text-emerald-400' : 'text-red-400'">
                                {{ sitReachSittingValid ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Leg Straight</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="sitReachLegStraightValid ? 'text-emerald-400' : 'text-red-400'">
                                {{ sitReachLegStraightValid ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Counting Side</span>
                            <span class="text-xs font-mono font-bold text-cyan-400">{{ sitReachCountingSide }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Best Reach</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="sitReachBestCm > 0 ? 'text-emerald-400' : 'text-slate-400'">
                                {{ sitReachBestLabel }}
                            </span>
                        </div>
                    </div>

                    <!-- Reach Detail -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Reach Detail</p>
                    <div class="space-y-1.5 mb-3" v-if="sitReachDebugDetail">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">L.Reach dist</span>
                            <span class="text-xs font-mono"
                                  :class="sitReachDebugDetail.leftReachDist < 0.6 ? 'text-orange-400' : 'text-slate-400'">
                                {{ sitReachDebugDetail.leftReachDist < 999 ? sitReachDebugDetail.leftReachDist : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">R.Reach dist</span>
                            <span class="text-xs font-mono"
                                  :class="sitReachDebugDetail.rightReachDist < 0.6 ? 'text-orange-400' : 'text-slate-400'">
                                {{ sitReachDebugDetail.rightReachDist < 999 ? sitReachDebugDetail.rightReachDist : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">L.Knee / R.Knee angle</span>
                            <span class="text-xs font-mono"
                                  :class="sitReachDebugDetail.leftKneeAngle >= 140 || sitReachDebugDetail.rightKneeAngle >= 140 ? 'text-emerald-400' : 'text-red-400'">
                                {{ sitReachDebugDetail.leftKneeAngle > 0 ? `${sitReachDebugDetail.leftKneeAngle}°` : '—' }} /
                                {{ sitReachDebugDetail.rightKneeAngle > 0 ? `${sitReachDebugDetail.rightKneeAngle}°` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">Hip–Shoulder diff Y</span>
                            <span class="text-xs font-mono"
                                  :class="sitReachDebugDetail.hipShoulderDiff >= 0 ? 'text-emerald-400' : 'text-red-400'">
                                {{ sitReachDebugDetail.hipShoulderDiff.toFixed(3) }}
                                <span class="text-slate-600">(≥0 = duduk)</span>
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">Wrist vis L/R</span>
                            <span class="text-xs font-mono text-slate-400">
                                {{ sitReachDebugDetail.leftWristVis }}% / {{ sitReachDebugDetail.rightWristVis }}%
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">Foot vis L/R</span>
                            <span class="text-xs font-mono text-slate-400">
                                {{ sitReachDebugDetail.leftFootVis }}% / {{ sitReachDebugDetail.rightFootVis }}%
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">Reach Active (&lt;0.6)</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="sitReachDebugDetail.reachActive ? 'text-orange-400' : 'text-slate-500'">
                                {{ sitReachDebugDetail.reachActive ? 'YES ✓' : 'NO' }}
                            </span>
                        </div>
                    </div>

                    <!-- Pipeline -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Pipeline</p>
                    <div class="space-y-1.5 mb-3" v-if="sitReachDebugPipeline">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Validation READY</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="sitReachDebugPipeline.validationReady ? 'text-emerald-400' : 'text-red-400'">
                                {{ sitReachDebugPipeline.validationReady ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Sitting Valid</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="sitReachDebugPipeline.sittingValid ? 'text-emerald-400' : 'text-red-400'">
                                {{ sitReachDebugPipeline.sittingValid ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Leg Straight Valid</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="sitReachDebugPipeline.legStraightValid ? 'text-emerald-400' : 'text-red-400'">
                                {{ sitReachDebugPipeline.legStraightValid ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Reach Distance</span>
                            <span class="text-xs font-mono"
                                  :class="sitReachDebugPipeline.reachDist < 0.6 ? 'text-orange-400' : 'text-slate-400'">
                                {{ sitReachDebugPipeline.reachDist < 999 ? sitReachDebugPipeline.reachDist : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Reach Active</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="sitReachDebugPipeline.reachActive ? 'text-orange-400' : 'text-slate-600'">
                                {{ sitReachDebugPipeline.reachActive ? 'YES ✓' : 'NO' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Stable Frames</span>
                            <span class="text-xs font-mono"
                                  :class="sitReachDebugPipeline.stableFrames >= 3 ? 'text-emerald-400' : 'text-slate-400'">
                                {{ sitReachDebugPipeline.stableFrames }} / 3
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Best Reach Updated</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="sitReachDebugPipeline.bestReachUpdated ? 'text-emerald-400' : 'text-slate-600'">
                                {{ sitReachDebugPipeline.bestReachUpdated ? 'YES ★' : 'NO' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between" v-if="sitReachDebugPipeline.blockReason !== '—'">
                            <span class="text-xs text-slate-600">Block reason</span>
                            <span class="text-xs font-mono text-slate-500 text-right max-w-[160px] leading-tight">
                                {{ sitReachDebugPipeline.blockReason }}
                            </span>
                        </div>
                    </div>

                    <!-- Cumulative -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Cumulative</p>
                    <div class="space-y-1.5 mb-3" v-if="sitReachDebugCumul">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">READY frames</span>
                            <span class="text-xs font-mono text-slate-400">{{ sitReachDebugCumul.validationReadyFrames }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Sitting valid frames</span>
                            <span class="text-xs font-mono"
                                  :class="sitReachDebugCumul.sittingValidFrames > 0 ? 'text-emerald-400' : 'text-slate-500'">
                                {{ sitReachDebugCumul.sittingValidFrames }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Reaching frames</span>
                            <span class="text-xs font-mono"
                                  :class="sitReachDebugCumul.reachingFrames > 0 ? 'text-orange-400' : 'text-slate-500'">
                                {{ sitReachDebugCumul.reachingFrames }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Best reach updates</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="sitReachDebugCumul.bestReachUpdatedCount > 0 ? 'text-emerald-400' : 'text-slate-500'">
                                {{ sitReachDebugCumul.bestReachUpdatedCount }}x
                            </span>
                        </div>
                        <div class="flex items-center justify-between" v-if="sitReachDebugCumul.lastBlockReason !== '—'">
                            <span class="text-xs text-slate-600">Last block reason</span>
                            <span class="text-xs font-mono text-slate-500 text-right max-w-[160px]">{{ sitReachDebugCumul.lastBlockReason }}</span>
                        </div>
                    </div>

                    <!-- Landmark Visibility -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Landmark Visibility</p>
                    <div class="space-y-1 mb-3" v-if="sitReachDebugLandmarks.length">
                        <div v-for="lm in sitReachDebugLandmarks" :key="lm.index"
                             class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">{{ lm.name }}</span>
                            <span class="text-xs font-mono"
                                  :class="{
                                      'text-emerald-400': lm.status === 'VISIBLE',
                                      'text-yellow-400':  lm.status === 'LOW',
                                      'text-slate-600':   lm.status === 'MISSING',
                                  }">
                                {{ lm.vis !== null ? `${lm.vis}%` : '—' }}
                                <span class="text-slate-600 ml-1">{{ lm.status }}</span>
                            </span>
                        </div>
                    </div>

                    <!-- State Machine -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">State Machine</p>
                    <div class="space-y-1.5 mb-3" v-if="sitReachDebugSM">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Reach Min seen (best)</span>
                            <span class="text-xs font-mono text-cyan-400">{{ sitReachDebugSM.minReachSeen }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Reaching ever started</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="sitReachDebugSM.reachingEverStarted ? 'text-orange-400' : 'text-red-400'">
                                {{ sitReachDebugSM.reachingEverStarted ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Best reach recorded</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="sitReachDebugSM.bestReachEverRecorded ? 'text-emerald-400' : 'text-red-400'">
                                {{ sitReachDebugSM.bestReachEverRecorded ? 'YES ★' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Blocked: sitting</span>
                            <span class="text-xs font-mono" :class="sitReachDebugSM.blockedBySitting > 0 ? 'text-red-400' : 'text-slate-500'">
                                {{ sitReachDebugSM.blockedBySitting }}x
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Blocked: leg straight</span>
                            <span class="text-xs font-mono" :class="sitReachDebugSM.blockedByLegStraight > 0 ? 'text-red-400' : 'text-slate-500'">
                                {{ sitReachDebugSM.blockedByLegStraight }}x
                            </span>
                        </div>
                        <div class="flex items-center justify-between" v-if="sitReachDebugSM.lastBlockReason !== '—'">
                            <span class="text-xs text-slate-600">Last block reason</span>
                            <span class="text-xs font-mono text-slate-500 text-right max-w-[180px]">{{ sitReachDebugSM.lastBlockReason }}</span>
                        </div>
                    </div>

                    <!-- Frame History -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Frame History</p>
                    <div class="overflow-x-auto mb-3" v-if="sitReachDebugHistory.length">
                        <table class="w-full text-xs font-mono">
                            <thead>
                                <tr class="text-slate-600">
                                <th class="text-left pr-2">t(s)</th>
                                <th class="text-left pr-2">reach</th>
                                <th class="text-left pr-2">sit</th>
                                <th class="text-left pr-2">leg</th>
                                <th class="text-left pr-2">phase</th>
                                <th class="text-left">best</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(row, i) in [...sitReachDebugHistory].reverse().slice(0, 15)" :key="i"
                                    class="border-t border-white/5">
                                    <td class="pr-2 text-slate-500">{{ row.ts }}</td>
                                    <td class="pr-2"
                                        :class="row.reach !== '—' && row.reach < 0.6 ? 'text-orange-400' : 'text-slate-400'">
                                        {{ row.reach }}
                                    </td>
                                    <td class="pr-2" :class="row.sit ? 'text-emerald-400' : 'text-red-400'">
                                        {{ row.sit ? 'Y' : 'N' }}
                                    </td>
                                    <td class="pr-2" :class="row.leg ? 'text-emerald-400' : 'text-red-400'">
                                        {{ row.leg ? 'Y' : 'N' }}
                                    </td>
                                    <td class="pr-2"
                                        :class="{
                                            'text-slate-400':   row.phase === 'WAITING',
                                            'text-slate-300':   row.phase === 'READY',
                                            'text-orange-400':  row.phase === 'REACHING',
                                            'text-emerald-400': row.phase === 'BEST_REACH',
                                        }">{{ row.phase }}</td>
                                    <td class="text-teal-400">{{ row.bestCm !== 0 ? `${row.bestCm}cm` : '—' }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Best Reach History -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">
                        Best Reach History ({{ sitReachDebugBestHistory.length }})
                    </p>
                    <div v-if="sitReachDebugBestHistory.length" class="space-y-1.5 mb-3">
                        <div v-for="(ev, i) in [...sitReachDebugBestHistory].reverse()" :key="i"
                             class="flex items-center justify-between text-xs font-mono border-t border-white/5 pt-1">
                            <span class="text-slate-500">t={{ ev.ts }}s</span>
                            <span class="text-cyan-400">{{ ev.normDist }}</span>
                            <span class="text-emerald-400 font-bold">{{ ev.cmEst >= 0 ? '+' : '' }}{{ ev.cmEst }} cm</span>
                            <span class="text-slate-500">{{ ev.side }}</span>
                        </div>
                    </div>
                    <div v-else class="text-xs text-slate-600 mb-3">Belum ada best reach.</div>

                    <!-- Thresholds -->
                    <div class="border-t border-white/5 pt-2 mt-1 space-y-1">
                        <p class="text-xs text-slate-600">Config (PROVISIONAL):</p>
                        <p class="text-xs font-mono text-slate-600">Reach active &lt; 0.6 | Knee >= 140°</p>
                        <p class="text-xs font-mono text-slate-600">Stable: 3 frames | 170 cm/unit</p>
                        <p class="text-xs font-mono text-yellow-600">⚠ Nilai cm bukan pengukuran akurat</p>
                    </div>
                </div>

                <!-- DEBUG PANEL — Squat Jump -->
                <div v-if="SQUATJUMP_DEBUG && isSquatJumpTest && sessionState === 'assessing'"
                     class="card p-4 border-sky-500/20 bg-sky-500/5">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-xs font-semibold text-sky-400 uppercase tracking-wider">Squat Jump Debug</h3>
                        <span class="text-xs font-mono bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded">DEV</span>
                    </div>

                    <!-- State -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">State</p>
                    <div class="space-y-1.5 mb-3">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Phase</span>
                            <span class="text-xs font-mono font-bold" :class="squatJumpPhaseColor">{{ squatJumpPhaseLabel }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Pose Valid</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="validationStatus === 'READY' ? 'text-emerald-400' : 'text-slate-500'">
                                {{ validationStatus }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Knee Angle</span>
                            <span class="text-xs font-mono text-cyan-400">{{ squatJumpKneeAngle > 0 ? `${squatJumpKneeAngle}°` : '—' }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Counting Side</span>
                            <span class="text-xs font-mono font-bold text-cyan-400">{{ squatJumpCountingSide }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Repetisi</span>
                            <span class="text-xs font-mono font-bold text-white">{{ squatJumpCount }}</span>
                        </div>
                    </div>

                    <!-- Jump Detail -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Jump Detail</p>
                    <div class="space-y-1.5 mb-3" v-if="squatJumpDebugJump">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">L.Knee / R.Knee</span>
                            <span class="text-xs font-mono text-cyan-400">
                                {{ squatJumpDebugJump.leftKneeAngle > 0 ? `${squatJumpDebugJump.leftKneeAngle}°` : '—' }} /
                                {{ squatJumpDebugJump.rightKneeAngle > 0 ? `${squatJumpDebugJump.rightKneeAngle}°` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">Hip Y Current</span>
                            <span class="text-xs font-mono text-slate-400">{{ squatJumpDebugJump.hipYCurrent }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">Hip Y @ Squat</span>
                            <span class="text-xs font-mono text-slate-400">{{ squatJumpDebugJump.hipYAtSquat || '—' }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">Hip Lift</span>
                            <span class="text-xs font-mono"
                                  :class="squatJumpDebugJump.hipLift >= 0.02 ? 'text-emerald-400' : 'text-slate-400'">
                                {{ squatJumpDebugJump.hipLift.toFixed(3) }}
                                <span class="text-slate-600">(min 0.02)</span>
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">Hip Lift Detected</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="squatJumpDebugJump.hipLiftDetected ? 'text-emerald-400' : 'text-slate-500'">
                                {{ squatJumpDebugJump.hipLiftDetected ? 'YES ✓' : 'NO' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">In Squat Zone</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="squatJumpDebugJump.inSquatZone ? 'text-orange-400' : 'text-slate-500'">
                                {{ squatJumpDebugJump.inSquatZone ? 'YES ↓' : 'NO' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">In UP Zone</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="squatJumpDebugJump.inUpZone ? 'text-emerald-400' : 'text-slate-500'">
                                {{ squatJumpDebugJump.inUpZone ? 'YES ↑' : 'NO' }}
                            </span>
                        </div>
                    </div>

                    <!-- Pipeline -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Pipeline</p>
                    <div class="space-y-1.5 mb-3" v-if="squatJumpDebugPipeline">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Validation READY</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="squatJumpDebugPipeline.validationReady ? 'text-emerald-400' : 'text-red-400'">
                                {{ squatJumpDebugPipeline.validationReady ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">In Squat Zone (≤110°)</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="squatJumpDebugPipeline.inSquatZone ? 'text-orange-400' : 'text-slate-600'">
                                {{ squatJumpDebugPipeline.inSquatZone ? 'YES ✓' : 'NO' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Squat Accumulate</span>
                            <span class="text-xs font-mono"
                                  :class="squatJumpDebugPipeline.squatAccumMs > 0 ? 'text-orange-400' : 'text-slate-600'">
                                {{ squatJumpDebugPipeline.squatAccumMs > 0 ? `${squatJumpDebugPipeline.squatAccumMs}ms / 80ms` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">SQUAT Confirmed</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="squatJumpDebugPipeline.squatConfirmed ? 'text-orange-400' : 'text-slate-600'">
                                {{ squatJumpDebugPipeline.squatConfirmed ? 'YES ✓' : 'NO' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Hip Lift</span>
                            <span class="text-xs font-mono"
                                  :class="squatJumpDebugPipeline.hipLift >= 0.02 ? 'text-emerald-400' : 'text-slate-400'">
                                {{ squatJumpDebugPipeline.hipLift.toFixed(3) }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">JUMP Detected</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="squatJumpDebugPipeline.jumpDetected ? 'text-emerald-400' : 'text-slate-600'">
                                {{ squatJumpDebugPipeline.jumpDetected ? 'YES ✓' : 'NO' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">In UP Zone after Jump</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="squatJumpDebugPipeline.inUpZoneAfterJump ? 'text-cyan-400' : 'text-slate-600'">
                                {{ squatJumpDebugPipeline.inUpZoneAfterJump ? 'YES ✓' : 'NO' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Landing Accumulate</span>
                            <span class="text-xs font-mono"
                                  :class="squatJumpDebugPipeline.landingAccumMs > 0 ? 'text-cyan-400' : 'text-slate-600'">
                                {{ squatJumpDebugPipeline.landingAccumMs > 0 ? `${squatJumpDebugPipeline.landingAccumMs}ms / 80ms` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Rep Increment</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="squatJumpDebugPipeline.repIncremented ? 'text-emerald-400' : 'text-slate-600'">
                                {{ squatJumpDebugPipeline.repIncremented ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between" v-if="squatJumpDebugPipeline.blockReason !== '—'">
                            <span class="text-xs text-slate-600">Block reason</span>
                            <span class="text-xs font-mono text-slate-500 text-right max-w-[160px] leading-tight">
                                {{ squatJumpDebugPipeline.blockReason }}
                            </span>
                        </div>
                    </div>

                    <!-- Cumulative -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Cumulative</p>
                    <div class="space-y-1.5 mb-3" v-if="squatJumpDebugCumul">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">READY frames</span>
                            <span class="text-xs font-mono text-slate-400">{{ squatJumpDebugCumul.validationReadyFrames }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Squat zone frames</span>
                            <span class="text-xs font-mono"
                                  :class="squatJumpDebugCumul.squatZoneFrames > 0 ? 'text-orange-400' : 'text-slate-500'">
                                {{ squatJumpDebugCumul.squatZoneFrames }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Squat confirmed</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="squatJumpDebugCumul.squatConfirmedCount > 0 ? 'text-orange-400' : 'text-red-400'">
                                {{ squatJumpDebugCumul.squatConfirmedCount }}x
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Jump detected</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="squatJumpDebugCumul.jumpDetectedCount > 0 ? 'text-emerald-400' : 'text-red-400'">
                                {{ squatJumpDebugCumul.jumpDetectedCount }}x
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Rep increment</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="squatJumpDebugCumul.repIncrementCount > 0 ? 'text-emerald-400 text-base' : 'text-red-400'">
                                {{ squatJumpDebugCumul.repIncrementCount }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between" v-if="squatJumpDebugCumul.lastBlockReason !== '—'">
                            <span class="text-xs text-slate-600">Last block reason</span>
                            <span class="text-xs font-mono text-slate-500 text-right max-w-[160px]">{{ squatJumpDebugCumul.lastBlockReason }}</span>
                        </div>
                    </div>

                    <!-- Landmark Visibility -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Landmark Visibility</p>
                    <div class="space-y-1 mb-3" v-if="squatJumpDebugLandmarks.length">
                        <div v-for="lm in squatJumpDebugLandmarks" :key="lm.index"
                             class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">{{ lm.name }}</span>
                            <span class="text-xs font-mono"
                                  :class="{
                                      'text-emerald-400': lm.status === 'VISIBLE',
                                      'text-yellow-400':  lm.status === 'LOW',
                                      'text-slate-600':   lm.status === 'MISSING',
                                  }">
                                {{ lm.vis !== null ? `${lm.vis}%` : '—' }}
                                <span class="text-slate-600 ml-1">{{ lm.status }}</span>
                            </span>
                        </div>
                    </div>

                    <!-- State Machine -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">State Machine</p>
                    <div class="space-y-1.5 mb-3" v-if="squatJumpDebugSM">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Knee Min/Max seen</span>
                            <span class="text-xs font-mono text-cyan-400">{{ squatJumpDebugSM.minKneeAngleSeen }}° / {{ squatJumpDebugSM.maxKneeAngleSeen }}°</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Max Hip Lift seen</span>
                            <span class="text-xs font-mono"
                                  :class="squatJumpDebugSM.maxHipLiftSeen >= 0.02 ? 'text-emerald-400' : 'text-slate-400'">
                                {{ squatJumpDebugSM.maxHipLiftSeen.toFixed(3) }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Squat ever reached</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="squatJumpDebugSM.squatEverReached ? 'text-orange-400' : 'text-red-400'">
                                {{ squatJumpDebugSM.squatEverReached ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Jump ever detected</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="squatJumpDebugSM.jumpEverDetected ? 'text-emerald-400' : 'text-red-400'">
                                {{ squatJumpDebugSM.jumpEverDetected ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Landing confirmed</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="squatJumpDebugSM.landingEverConfirmed ? 'text-emerald-400' : 'text-slate-500'">
                                {{ squatJumpDebugSM.landingEverConfirmed ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between" v-if="squatJumpDebugSM.lastBlockReason !== '—'">
                            <span class="text-xs text-slate-600">Last block reason</span>
                            <span class="text-xs font-mono text-slate-500 text-right max-w-[180px]">{{ squatJumpDebugSM.lastBlockReason }}</span>
                        </div>
                    </div>

                    <!-- Frame History -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Frame History</p>
                    <div class="overflow-x-auto mb-3" v-if="squatJumpDebugHistory.length">
                        <table class="w-full text-xs font-mono">
                            <thead>
                                <tr class="text-slate-600">
                                <th class="text-left pr-2">t(s)</th>
                                <th class="text-left pr-2">knee</th>
                                <th class="text-left pr-2">lift</th>
                                <th class="text-left pr-2">phase</th>
                                <th class="text-left">rep</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(row, i) in [...squatJumpDebugHistory].reverse().slice(0, 15)" :key="i"
                                    class="border-t border-white/5">
                                    <td class="pr-2 text-slate-500">{{ row.ts }}</td>
                                    <td class="pr-2"
                                        :class="row.knee <= 110 && row.knee > 0 ? 'text-orange-400' : row.knee >= 150 ? 'text-emerald-400' : 'text-slate-400'">
                                        {{ row.knee > 0 ? `${row.knee}°` : '—' }}
                                    </td>
                                    <td class="pr-2"
                                        :class="row.hipLift >= 0.02 ? 'text-emerald-400' : 'text-slate-500'">
                                        {{ row.hipLift.toFixed(3) }}
                                    </td>
                                    <td class="pr-2"
                                        :class="{
                                            'text-slate-400':  row.phase === 'READY',
                                            'text-orange-400': row.phase === 'SQUAT',
                                            'text-emerald-400':row.phase === 'JUMP',
                                            'text-cyan-400':   row.phase === 'LANDING',
                                        }">{{ row.phase }}</td>
                                    <td class="text-white font-bold">{{ row.rep }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Rep Cycle History -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">
                        Rep History ({{ squatJumpDebugRepHistory.length }} siklus)
                    </p>
                    <div v-if="squatJumpDebugRepHistory.length" class="overflow-x-auto mb-3">
                        <table class="w-full text-xs font-mono">
                            <thead>
                                <tr class="text-slate-600">
                                <th class="text-left pr-2">#</th>
                                <th class="text-left pr-2">SQ</th>
                                <th class="text-left pr-2">SQ✓</th>
                                <th class="text-left pr-2">JMP</th>
                                <th class="text-left pr-2">LND</th>
                                <th class="text-left">Rep</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="c in [...squatJumpDebugRepHistory].reverse()" :key="c.cycleNumber"
                                    class="border-t border-white/5">
                                    <td class="pr-2 text-slate-500">{{ c.cycleNumber }}</td>
                                    <td class="pr-2" :class="c.squatDetected  ? 'text-orange-400' : 'text-slate-600'">{{ c.squatDetected  ? 'Y' : '-' }}</td>
                                    <td class="pr-2" :class="c.squatConfirmed ? 'text-orange-400' : 'text-slate-600'">{{ c.squatConfirmed ? 'Y' : 'N' }}</td>
                                    <td class="pr-2" :class="c.jumpDetected   ? 'text-emerald-400' : 'text-slate-600'">{{ c.jumpDetected   ? 'Y' : '-' }}</td>
                                    <td class="pr-2" :class="c.landingConfirmed?'text-cyan-400'   : 'text-slate-600'">{{ c.landingConfirmed?'Y' : 'N' }}</td>
                                    <td :class="c.counted ? 'text-emerald-400' : 'text-red-400'">{{ c.counted ? 'Y' : 'N' }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div v-else class="text-xs text-slate-600 mb-3">Belum ada siklus selesai.</div>

                    <!-- Thresholds -->
                    <div class="border-t border-white/5 pt-2 mt-1 space-y-1">
                        <p class="text-xs text-slate-600">Thresholds (PROVISIONAL):</p>
                        <p class="text-xs font-mono text-slate-600">Squat ≤ 110° | UP ≥ 150°</p>
                        <p class="text-xs font-mono text-slate-600">HipLift ≥ 0.02 | Squat: 80ms</p>
                        <p class="text-xs font-mono text-slate-600">Jump: 50ms | Landing: 80ms</p>
                    </div>
                </div>

                <!-- DEBUG PANEL — Deep Squat -->
                <div v-if="DEEPSQUAT_DEBUG && isDeepSquatTest && sessionState === 'assessing'"
                     class="card p-4 border-violet-500/20 bg-violet-500/5">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-xs font-semibold text-violet-400 uppercase tracking-wider">Deep Squat Debug</h3>
                        <span class="text-xs font-mono bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded">DEV</span>
                    </div>

                    <!-- State -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">State</p>
                    <div class="space-y-1.5 mb-3">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Phase</span>
                            <span class="text-xs font-mono font-bold" :class="deepSquatPhaseColor">{{ deepSquatPhaseLabel }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Pose Valid</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="validationStatus === 'READY' ? 'text-emerald-400' : 'text-slate-500'">
                                {{ validationStatus }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Knee Angle</span>
                            <span class="text-xs font-mono text-cyan-400">{{ deepSquatKneeAngle > 0 ? `${deepSquatKneeAngle}°` : '—' }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Counting Side</span>
                            <span class="text-xs font-mono font-bold text-cyan-400">{{ deepSquatCountingSide }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Repetisi</span>
                            <span class="text-xs font-mono font-bold text-white">{{ deepSquatCount }}</span>
                        </div>
                    </div>

                    <!-- Pipeline -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Counting Pipeline</p>
                    <div class="space-y-1.5 mb-3" v-if="deepSquatDebugPipeline">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Validation READY</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="deepSquatDebugPipeline.validationReady ? 'text-emerald-400' : 'text-red-400'">
                                {{ deepSquatDebugPipeline.validationReady ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">L.Knee / R.Knee</span>
                            <span class="text-xs font-mono text-cyan-400">
                                {{ deepSquatDebugPipeline.leftKneeAngle > 0 ? `${deepSquatDebugPipeline.leftKneeAngle}°` : '—' }} /
                                {{ deepSquatDebugPipeline.rightKneeAngle > 0 ? `${deepSquatDebugPipeline.rightKneeAngle}°` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">In DOWN Zone (≤110°)</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="deepSquatDebugPipeline.inDownZone ? 'text-orange-400' : 'text-slate-600'">
                                {{ deepSquatDebugPipeline.inDownZone ? 'YES ✓' : 'NO' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">DOWN Accumulate</span>
                            <span class="text-xs font-mono"
                                  :class="deepSquatDebugPipeline.downAccumMs > 0 ? 'text-orange-400' : 'text-slate-600'">
                                {{ deepSquatDebugPipeline.downAccumMs > 0 ? `${deepSquatDebugPipeline.downAccumMs}ms / 50ms` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">DOWN Confirmed</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="deepSquatDebugPipeline.downConfirmed ? 'text-orange-400' : 'text-slate-600'">
                                {{ deepSquatDebugPipeline.downConfirmed ? 'YES ✓' : 'NO' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">In UP Zone (≥150°)</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="deepSquatDebugPipeline.inUpZone ? 'text-emerald-400' : 'text-slate-600'">
                                {{ deepSquatDebugPipeline.inUpZone ? 'YES ✓' : 'NO' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">UP Accumulate</span>
                            <span class="text-xs font-mono"
                                  :class="deepSquatDebugPipeline.upAccumMs > 0 ? 'text-emerald-400' : 'text-slate-600'">
                                {{ deepSquatDebugPipeline.upAccumMs > 0 ? `${deepSquatDebugPipeline.upAccumMs}ms / 50ms` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Rep Increment</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="deepSquatDebugPipeline.repIncremented ? 'text-emerald-400' : 'text-slate-600'">
                                {{ deepSquatDebugPipeline.repIncremented ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between" v-if="deepSquatDebugPipeline.blockReason !== '—'">
                            <span class="text-xs text-slate-600">Block reason</span>
                            <span class="text-xs font-mono text-slate-500 text-right max-w-[160px] leading-tight">
                                {{ deepSquatDebugPipeline.blockReason }}
                            </span>
                        </div>
                    </div>

                    <!-- Cumulative -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Cumulative</p>
                    <div class="space-y-1.5 mb-3" v-if="deepSquatDebugCumul">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">READY frames</span>
                            <span class="text-xs font-mono text-slate-400">{{ deepSquatDebugCumul.validationReadyFrames }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Knee angle samples</span>
                            <span class="text-xs font-mono text-slate-400">{{ deepSquatDebugCumul.kneeAngleSamples }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">DOWN zone frames</span>
                            <span class="text-xs font-mono"
                                  :class="deepSquatDebugCumul.downZoneFrames > 0 ? 'text-orange-400' : 'text-slate-500'">
                                {{ deepSquatDebugCumul.downZoneFrames }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">DOWN timer max</span>
                            <span class="text-xs font-mono"
                                  :class="deepSquatDebugCumul.downTimerMaxMs >= 50 ? 'text-emerald-400' : deepSquatDebugCumul.downTimerMaxMs > 0 ? 'text-yellow-400' : 'text-red-400'">
                                {{ deepSquatDebugCumul.downTimerMaxMs }}ms <span class="text-slate-600">(need ≥50ms)</span>
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">DOWN confirmed</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="deepSquatDebugCumul.downConfirmedCount > 0 ? 'text-orange-400' : 'text-red-400'">
                                {{ deepSquatDebugCumul.downConfirmedCount }}x
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">UP zone frames</span>
                            <span class="text-xs font-mono"
                                  :class="deepSquatDebugCumul.upZoneFrames > 0 ? 'text-emerald-400' : 'text-slate-500'">
                                {{ deepSquatDebugCumul.upZoneFrames }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">UP confirmed</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="deepSquatDebugCumul.upConfirmedCount > 0 ? 'text-emerald-400' : 'text-slate-500'">
                                {{ deepSquatDebugCumul.upConfirmedCount }}x
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Rep increment count</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="deepSquatDebugCumul.repIncrementCount > 0 ? 'text-emerald-400 text-base' : 'text-red-400'">
                                {{ deepSquatDebugCumul.repIncrementCount }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between" v-if="deepSquatDebugCumul.lastBlockReason !== '—'">
                            <span class="text-xs text-slate-600">Last block reason</span>
                            <span class="text-xs font-mono text-slate-500 text-right max-w-[160px]">{{ deepSquatDebugCumul.lastBlockReason }}</span>
                        </div>
                    </div>

                    <!-- Landmark Visibility -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Landmark Visibility</p>
                    <div class="space-y-1 mb-3" v-if="deepSquatDebugLandmarks.length">
                        <div v-for="lm in deepSquatDebugLandmarks" :key="lm.index"
                             class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">{{ lm.name }}</span>
                            <span class="text-xs font-mono"
                                  :class="{
                                      'text-emerald-400': lm.status === 'VISIBLE',
                                      'text-yellow-400':  lm.status === 'LOW',
                                      'text-slate-600':   lm.status === 'MISSING',
                                  }">
                                {{ lm.vis !== null ? `${lm.vis}%` : '—' }}
                                <span class="text-slate-600 ml-1">{{ lm.status }}</span>
                            </span>
                        </div>
                    </div>

                    <!-- Counting Landmarks -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Counting Landmarks</p>
                    <div class="space-y-1.5 mb-3" v-if="deepSquatDebugCountingLm">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Required valid</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="deepSquatDebugCountingLm.countingValid >= 3 ? 'text-emerald-400' : 'text-red-400'">
                                {{ deepSquatDebugCountingLm.countingValid }}/{{ deepSquatDebugCountingLm.countingTotal }}
                                <span class="text-slate-500">(hip+knee+ankle)</span>
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Blocked by LM</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="deepSquatDebugCountingLm.blockedByCountingLm ? 'text-red-400' : 'text-emerald-400'">
                                {{ deepSquatDebugCountingLm.blockedByCountingLm ? 'YES ✗' : 'NO — ok' }}
                            </span>
                        </div>
                        <div v-if="deepSquatDebugCountingLm.countingMissing?.length">
                            <span class="text-xs text-slate-600">Missing:</span>
                            <span class="text-xs font-mono text-red-400 ml-1">{{ deepSquatDebugCountingLm.countingMissing.join(', ') }}</span>
                        </div>
                    </div>

                    <!-- State Machine -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">State Machine</p>
                    <div class="space-y-1.5 mb-3" v-if="deepSquatDebugSM">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Knee Min/Max seen</span>
                            <span class="text-xs font-mono text-cyan-400">{{ deepSquatDebugSM.minKneeAngleSeen }}° / {{ deepSquatDebugSM.maxKneeAngleSeen }}°</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Frames in DOWN zone</span>
                            <span class="text-xs font-mono"
                                  :class="deepSquatDebugSM.framesInDownZone > 0 ? 'text-orange-400' : 'text-slate-500'">
                                {{ deepSquatDebugSM.framesInDownZone }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Frames in UP zone</span>
                            <span class="text-xs font-mono"
                                  :class="deepSquatDebugSM.framesInUpZone > 0 ? 'text-emerald-400' : 'text-slate-500'">
                                {{ deepSquatDebugSM.framesInUpZone }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">DOWN reached</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="deepSquatDebugSM.downEverReached ? 'text-orange-400' : 'text-red-400'">
                                {{ deepSquatDebugSM.downEverReached ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">UP after DOWN</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="deepSquatDebugSM.upAfterDownReached ? 'text-emerald-400' : 'text-slate-500'">
                                {{ deepSquatDebugSM.upAfterDownReached ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Val. Drops</span>
                            <span class="text-xs font-mono text-slate-500">{{ deepSquatDebugSM.validationDropCount }}x</span>
                        </div>
                        <div class="flex items-center justify-between" v-if="deepSquatDebugSM.lastBlockReason !== '—'">
                            <span class="text-xs text-slate-600">Last block reason</span>
                            <span class="text-xs font-mono text-slate-500 text-right max-w-[180px]">{{ deepSquatDebugSM.lastBlockReason }}</span>
                        </div>
                    </div>

                    <!-- Frame History -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Frame History</p>
                    <div class="overflow-x-auto mb-3" v-if="deepSquatDebugHistory.length">
                        <table class="w-full text-xs font-mono">
                            <thead>
                                <tr class="text-slate-600">
                                <th class="text-left pr-2">t(s)</th>
                                <th class="text-left pr-2">fps</th>
                                <th class="text-left pr-2">val</th>
                                <th class="text-left pr-2">knee</th>
                                <th class="text-left pr-2">phase</th>
                                <th class="text-left">rep</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(row, i) in [...deepSquatDebugHistory].reverse().slice(0, 15)" :key="i"
                                    class="border-t border-white/5">
                                    <td class="pr-2 text-slate-500">{{ row.ts }}</td>
                                    <td class="pr-2 text-slate-500">{{ row.fps }}</td>
                                    <td class="pr-2" :class="row.valid === 'READY' ? 'text-emerald-400' : 'text-slate-500'">
                                        {{ row.valid === 'READY' ? 'RDY' : 'NO' }}
                                    </td>
                                    <td class="pr-2"
                                        :class="row.knee <= 110 && row.knee > 0 ? 'text-orange-400' : row.knee >= 150 ? 'text-emerald-400' : 'text-slate-400'">
                                        {{ row.knee > 0 ? `${row.knee}°` : '—' }}
                                    </td>
                                    <td class="pr-2"
                                        :class="{
                                            'text-slate-400':   row.phase === 'READY',
                                            'text-orange-400':  row.phase === 'DOWN',
                                        }">
                                        {{ row.phase }}
                                    </td>
                                    <td class="text-white font-bold">{{ row.rep }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Rep Cycle History -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">
                        Rep History ({{ deepSquatDebugRepHistory.length }} siklus)
                    </p>
                    <div v-if="deepSquatDebugRepHistory.length" class="overflow-x-auto mb-3">
                        <table class="w-full text-xs font-mono">
                            <thead>
                                <tr class="text-slate-600">
                                <th class="text-left pr-2">#</th>
                                <th class="text-left pr-2">DN</th>
                                <th class="text-left pr-2">DN✓</th>
                                <th class="text-left pr-2">UP</th>
                                <th class="text-left pr-2">Rep</th>
                                <th class="text-left">Reason</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="c in [...deepSquatDebugRepHistory].reverse()" :key="c.cycleNumber"
                                    class="border-t border-white/5">
                                    <td class="pr-2 text-slate-500">{{ c.cycleNumber }}</td>
                                    <td class="pr-2" :class="c.downDetected ? 'text-orange-400' : 'text-slate-600'">{{ c.downDetected ? 'Y' : '-' }}</td>
                                    <td class="pr-2" :class="c.downConfirmed ? 'text-orange-400' : 'text-slate-600'">{{ c.downConfirmed ? 'Y' : 'N' }}</td>
                                    <td class="pr-2" :class="c.upDetected ? 'text-emerald-400' : 'text-slate-600'">{{ c.upDetected ? 'Y' : '-' }}</td>
                                    <td class="pr-2" :class="c.counted ? 'text-emerald-400' : 'text-red-400'">{{ c.counted ? 'Y' : 'N' }}</td>
                                    <td class="text-slate-500 text-xs">{{ c.resetReason !== '—' ? c.resetReason : '' }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div v-else class="text-xs text-slate-600 mb-3">Belum ada siklus selesai.</div>

                    <!-- Thresholds -->
                    <div class="border-t border-white/5 pt-2 mt-1 space-y-1">
                        <p class="text-xs text-slate-600">Thresholds (PROVISIONAL):</p>
                        <p class="text-xs font-mono text-slate-600">DOWN ≤ 110° | UP ≥ 150°</p>
                        <p class="text-xs font-mono text-slate-600">Stab: 50ms | MIN_VIS: 0.5</p>
                    </div>
                </div>

                <!-- DEBUG PANEL — Wall Sit -->
                <div v-if="WALLSIT_DEBUG && isWallSitTest && sessionState === 'assessing'"
                     class="card p-4 border-yellow-500/20 bg-yellow-500/5">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-xs font-semibold text-yellow-400 uppercase tracking-wider">Wall Sit Debug</h3>
                        <span class="text-xs font-mono bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded">DEV</span>
                    </div>

                    <!-- State -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">State</p>
                    <div class="space-y-1.5 mb-3">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Phase</span>
                            <span class="text-xs font-mono font-bold" :class="wallSitPhaseColor">{{ wallSitPhaseLabel }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Pose Valid</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="validationStatus === 'READY' ? 'text-emerald-400' : 'text-slate-500'">
                                {{ validationStatus }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Hold Duration</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="isHolding ? 'text-emerald-400' : 'text-white'">
                                {{ holdDurationFormatted }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Total Sesi</span>
                            <span class="text-xs font-mono text-slate-400">{{ wallSitTotalDuration.toFixed(1) }}s</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Counting Side</span>
                            <span class="text-xs font-mono font-bold text-cyan-400">{{ wallSitCountingSide }}</span>
                        </div>
                    </div>

                    <!-- Knee Detail -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Knee Detail</p>
                    <div class="space-y-1.5 mb-3" v-if="wallSitDebugKnee">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">L.Knee Angle</span>
                            <span class="text-xs font-mono"
                                  :class="wallSitDebugKnee.leftKneeAngle >= 80 && wallSitDebugKnee.leftKneeAngle <= 100 ? 'text-emerald-400' : 'text-slate-400'">
                                {{ wallSitDebugKnee.leftKneeAngle > 0 ? `${wallSitDebugKnee.leftKneeAngle}°` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">R.Knee Angle</span>
                            <span class="text-xs font-mono"
                                  :class="wallSitDebugKnee.rightKneeAngle >= 80 && wallSitDebugKnee.rightKneeAngle <= 100 ? 'text-emerald-400' : 'text-slate-400'">
                                {{ wallSitDebugKnee.rightKneeAngle > 0 ? `${wallSitDebugKnee.rightKneeAngle}°` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">L.Hip / L.Knee / L.Ankle vis</span>
                            <span class="text-xs font-mono"
                                  :class="wallSitDebugKnee.leftSideValid ? 'text-emerald-400' : 'text-slate-500'">
                                {{ wallSitDebugKnee.leftHipVis }}% / {{ wallSitDebugKnee.leftKneeVis }}% / {{ wallSitDebugKnee.leftAnkleVis }}%
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">R.Hip / R.Knee / R.Ankle vis</span>
                            <span class="text-xs font-mono"
                                  :class="wallSitDebugKnee.rightSideValid ? 'text-emerald-400' : 'text-slate-500'">
                                {{ wallSitDebugKnee.rightHipVis }}% / {{ wallSitDebugKnee.rightKneeVis }}% / {{ wallSitDebugKnee.rightAnkleVis }}%
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">In Zone (80°–100°)</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="wallSitDebugKnee.inZone ? 'text-emerald-400' : 'text-slate-500'">
                                {{ wallSitDebugKnee.inZone ? 'YES' : 'NO' }}
                            </span>
                        </div>
                    </div>

                    <!-- Pipeline -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Pipeline</p>
                    <div class="space-y-1.5 mb-3" v-if="wallSitDebugPipeline">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Validation READY</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="wallSitDebugPipeline.validationReady ? 'text-emerald-400' : 'text-red-400'">
                                {{ wallSitDebugPipeline.validationReady ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Knee Angle</span>
                            <span class="text-xs font-mono text-cyan-400">
                                {{ wallSitDebugPipeline.kneeAngle > 0 ? `${wallSitDebugPipeline.kneeAngle}°` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">In Wall Sit Zone</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="wallSitDebugPipeline.inWallSitZone ? 'text-orange-400' : 'text-slate-600'">
                                {{ wallSitDebugPipeline.inWallSitZone ? 'YES ✓' : 'NO' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Hold Accumulate</span>
                            <span class="text-xs font-mono"
                                  :class="wallSitDebugPipeline.holdAccumMs > 0 ? 'text-orange-400' : 'text-slate-600'">
                                {{ wallSitDebugPipeline.holdAccumMs > 0 ? `${wallSitDebugPipeline.holdAccumMs}ms / 300ms` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">HOLDING Confirmed</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="wallSitDebugPipeline.holdConfirmed ? 'text-emerald-400' : 'text-slate-600'">
                                {{ wallSitDebugPipeline.holdConfirmed ? 'YES ✓ (HOLDING)' : 'NO' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">In Exit Zone</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="wallSitDebugPipeline.inExitZone ? 'text-yellow-400' : 'text-slate-600'">
                                {{ wallSitDebugPipeline.inExitZone ? 'YES (keluar zona)' : 'NO' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Exit Accumulate</span>
                            <span class="text-xs font-mono"
                                  :class="wallSitDebugPipeline.exitAccumMs > 0 ? 'text-yellow-400' : 'text-slate-600'">
                                {{ wallSitDebugPipeline.exitAccumMs > 0 ? `${wallSitDebugPipeline.exitAccumMs}ms / 200ms` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Holding Duration</span>
                            <span class="text-xs font-mono"
                                  :class="wallSitDebugPipeline.holdingDuration > 0 ? 'text-emerald-400' : 'text-slate-600'">
                                {{ wallSitDebugPipeline.holdingDuration > 0 ? `${(wallSitDebugPipeline.holdingDuration/1000).toFixed(1)}s` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between" v-if="wallSitDebugPipeline.blockReason !== '—'">
                            <span class="text-xs text-slate-600">Block reason</span>
                            <span class="text-xs font-mono text-slate-500 text-right max-w-[160px] leading-tight">
                                {{ wallSitDebugPipeline.blockReason }}
                            </span>
                        </div>
                    </div>

                    <!-- Cumulative -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Cumulative</p>
                    <div class="space-y-1.5 mb-3" v-if="wallSitDebugCumul">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">READY frames</span>
                            <span class="text-xs font-mono text-slate-400">{{ wallSitDebugCumul.validationReadyFrames }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Knee angle samples</span>
                            <span class="text-xs font-mono text-slate-400">{{ wallSitDebugCumul.kneeAngleSamples }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Zone frames</span>
                            <span class="text-xs font-mono"
                                  :class="wallSitDebugCumul.zoneFrames > 0 ? 'text-orange-400' : 'text-slate-500'">
                                {{ wallSitDebugCumul.zoneFrames }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">HOLDING confirmed</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="wallSitDebugCumul.holdConfirmedCount > 0 ? 'text-emerald-400' : 'text-red-400'">
                                {{ wallSitDebugCumul.holdConfirmedCount }}x
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Max duration</span>
                            <span class="text-xs font-mono"
                                  :class="wallSitDebugCumul.maxHoldDurationMs > 0 ? 'text-emerald-400' : 'text-slate-500'">
                                {{ wallSitDebugCumul.maxHoldDurationMs > 0 ? `${(wallSitDebugCumul.maxHoldDurationMs/1000).toFixed(1)}s` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Landmark blocked</span>
                            <span class="text-xs font-mono text-slate-500">{{ wallSitDebugCumul.landmarkBlockedCount }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Validation blocked</span>
                            <span class="text-xs font-mono text-slate-500">{{ wallSitDebugCumul.validationBlockedCount }}</span>
                        </div>
                        <div class="flex items-center justify-between" v-if="wallSitDebugCumul.lastBlockReason !== '—'">
                            <span class="text-xs text-slate-600">Last block reason</span>
                            <span class="text-xs font-mono text-slate-500 text-right max-w-[160px]">{{ wallSitDebugCumul.lastBlockReason }}</span>
                        </div>
                    </div>

                    <!-- Landmark Visibility -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Landmark Visibility</p>
                    <div class="space-y-1 mb-3" v-if="wallSitDebugLandmarks.length">
                        <div v-for="lm in wallSitDebugLandmarks" :key="lm.index"
                             class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">{{ lm.name }}</span>
                            <span class="text-xs font-mono"
                                  :class="{
                                      'text-emerald-400': lm.status === 'VISIBLE',
                                      'text-yellow-400':  lm.status === 'LOW',
                                      'text-slate-600':   lm.status === 'MISSING',
                                  }">
                                {{ lm.vis !== null ? `${lm.vis}%` : '—' }}
                                <span class="text-slate-600 ml-1">{{ lm.status }}</span>
                            </span>
                        </div>
                    </div>

                    <!-- State Machine -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">State Machine</p>
                    <div class="space-y-1.5 mb-3" v-if="wallSitDebugSM">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Current Phase</span>
                            <span class="text-xs font-mono font-bold" :class="wallSitPhaseColor">{{ wallSitPhaseLabel }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Knee Min/Max seen</span>
                            <span class="text-xs font-mono text-cyan-400">
                                {{ wallSitDebugSM.minKneeAngleSeen }}° / {{ wallSitDebugSM.maxKneeAngleSeen }}°
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Frames in Zone</span>
                            <span class="text-xs font-mono"
                                  :class="wallSitDebugSM.framesInZone > 0 ? 'text-orange-400' : 'text-slate-500'">
                                {{ wallSitDebugSM.framesInZone }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">HOLDING ever started</span>
                            <span class="text-xs font-mono font-bold"
                                  :class="wallSitDebugSM.holdingEverStarted ? 'text-emerald-400' : 'text-red-400'">
                                {{ wallSitDebugSM.holdingEverStarted ? 'YES ✓' : 'NO ✗' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Val. Drops</span>
                            <span class="text-xs font-mono text-slate-500">{{ wallSitDebugSM.validationDropCount }}x</span>
                        </div>
                        <div class="flex items-center justify-between" v-if="wallSitDebugSM.lastBlockReason !== '—'">
                            <span class="text-xs text-slate-600">Last block reason</span>
                            <span class="text-xs font-mono text-slate-500 text-right max-w-[180px]">{{ wallSitDebugSM.lastBlockReason }}</span>
                        </div>
                    </div>

                    <!-- Frame History -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">Frame History</p>
                    <div class="overflow-x-auto mb-3" v-if="wallSitDebugHistory.length">
                        <table class="w-full text-xs font-mono">
                            <thead>
                                <tr class="text-slate-600">
                                <th class="text-left pr-2">t(s)</th>
                                <th class="text-left pr-2">fps</th>
                                <th class="text-left pr-2">val</th>
                                <th class="text-left pr-2">knee</th>
                                <th class="text-left pr-2">phase</th>
                                <th class="text-left">dur</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(row, i) in [...wallSitDebugHistory].reverse().slice(0, 15)" :key="i"
                                    class="border-t border-white/5">
                                    <td class="pr-2 text-slate-500">{{ row.ts }}</td>
                                    <td class="pr-2 text-slate-500">{{ row.fps }}</td>
                                    <td class="pr-2" :class="row.valid === 'READY' ? 'text-emerald-400' : 'text-slate-500'">
                                        {{ row.valid === 'READY' ? 'RDY' : 'NO' }}
                                    </td>
                                    <td class="pr-2"
                                        :class="row.knee >= 80 && row.knee <= 100 ? 'text-orange-400' : 'text-slate-400'">
                                        {{ row.knee > 0 ? `${row.knee}°` : '—' }}
                                    </td>
                                    <td class="pr-2"
                                        :class="{
                                            'text-slate-400':   row.phase === 'WAITING',
                                            'text-slate-300':   row.phase === 'READY',
                                            'text-emerald-400': row.phase === 'HOLDING',
                                            'text-primary-400': row.phase === 'COMPLETE',
                                        }">
                                        {{ row.phase }}
                                    </td>
                                    <td class="text-cyan-400">{{ row.dur }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Hold Events -->
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 border-t border-white/5 pt-2">
                        Hold Events ({{ wallSitDebugEvents.length }})
                    </p>
                    <div v-if="wallSitDebugEvents.length" class="space-y-1.5 mb-3">
                        <div v-for="(ev, i) in [...wallSitDebugEvents].reverse()" :key="i"
                             class="flex items-center justify-between text-xs font-mono border-t border-white/5 pt-1">
                            <span class="text-slate-500">{{ ev.durationSec }}s</span>
                            <span class="text-slate-500">{{ ev.endReason }}</span>
                        </div>
                    </div>
                    <div v-else class="text-xs text-slate-600 mb-3">Belum ada hold event.</div>

                    <!-- Thresholds -->
                    <div class="border-t border-white/5 pt-2 mt-1 space-y-1">
                        <p class="text-xs text-slate-600">Thresholds (PROVISIONAL):</p>
                        <p class="text-xs font-mono text-slate-600">Zone 80°–100° | Confirm: 300ms</p>
                        <p class="text-xs font-mono text-slate-600">Exit: 200ms | MIN_VIS: 0.5</p>
                    </div>
                </div>

                <!-- ── Result Summary Card (setelah stopAssessment) ──────── -->
                <div v-if="sessionState === 'stopped' && assessmentResult"
                     class="card p-5 border-emerald-500/20 bg-emerald-500/5">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Hasil Assessment</h3>
                        <span class="text-xs font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">Selesai ✓</span>
                    </div>

                    <!-- Nama tes + ikon + atlet -->
                    <div class="flex items-center gap-3 mb-4 p-3 rounded-xl bg-dark-900/60 border border-white/5">
                        <span class="text-2xl">{{ test.icon }}</span>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-bold text-white leading-tight">{{ assessmentResult.testName }}</p>
                            <p class="text-xs text-slate-500">{{ assessmentResult.category }}</p>
                        </div>
                    </div>

                    <!-- Nama atlet -->
                    <div class="flex items-center justify-between mb-3 pb-3 border-b border-white/5">
                        <span class="text-xs text-slate-500">Atlet</span>
                        <span class="text-sm font-semibold text-white">{{ assessmentResult.athleteName }}</span>
                    </div>

                    <!-- Nilai utama -->
                    <div class="flex items-center justify-between mb-3 p-3 rounded-xl bg-dark-900/60 border border-white/5">
                        <span class="text-xs text-slate-500">Hasil</span>
                        <div class="text-right">
                            <span class="text-3xl font-black font-mono leading-none"
                                  :class="assessmentResult.resultValue > 0 ? 'text-emerald-400' : 'text-slate-400'">
                                {{ assessmentResult.resultDisplay }}
                            </span>
                            <p v-if="assessmentResult.estimated" class="text-xs text-yellow-500 mt-1">
                                ⚠ Estimasi — belum dikalibrasi
                            </p>
                        </div>
                    </div>

                    <!-- Benchmark + Achievement -->
                    <div v-if="assessmentResult.benchmarkSnapshot" class="space-y-2 mb-3 p-3 rounded-xl bg-dark-900/60 border border-white/5">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Benchmark</span>
                            <span class="text-xs font-mono text-slate-300">
                                {{ assessmentResult.benchmarkSnapshot.value }} {{ assessmentResult.benchmarkSnapshot.unit }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Pencapaian</span>
                            <span class="text-sm font-bold font-mono"
                                  :class="{
                                      'text-emerald-400': assessmentResult.achievement >= 80,
                                      'text-yellow-400':  assessmentResult.achievement >= 50 && assessmentResult.achievement < 80,
                                      'text-red-400':     assessmentResult.achievement < 50,
                                  }">
                                {{ assessmentResult.achievement != null ? `${assessmentResult.achievement}%` : '—' }}
                            </span>
                        </div>
                        <!-- Mini progress bar -->
                        <div class="w-full h-1.5 rounded-full bg-dark-800 overflow-hidden">
                            <div class="h-full rounded-full transition-all duration-500"
                                 :class="{
                                     'bg-emerald-500': assessmentResult.achievement >= 80,
                                     'bg-yellow-500':  assessmentResult.achievement >= 50 && assessmentResult.achievement < 80,
                                     'bg-red-500':     assessmentResult.achievement < 50,
                                 }"
                                 :style="{ width: `${assessmentResult.achievement ?? 0}%` }">
                            </div>
                        </div>
                    </div>
                    <div v-else class="mb-3 p-3 rounded-xl bg-dark-900/40 border border-white/5">
                        <p class="text-xs text-slate-600 italic text-center">Benchmark belum dikonfigurasi.</p>
                    </div>

                    <!-- Detail tambahan -->
                    <div class="space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Tanggal</span>
                            <span class="text-xs text-slate-300">{{ assessmentResult.date }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Waktu</span>
                            <span class="text-xs text-slate-300">{{ assessmentResult.time }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Durasi Sesi</span>
                            <span class="text-xs font-mono text-slate-300">{{ elapsedFormatted }}</span>
                        </div>
                        <!-- Total duration untuk tes hold (Balance, Plank, WallSit) -->
                        <div v-if="assessmentResult.totalDuration != null" class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Total hold</span>
                            <span class="text-xs font-mono text-slate-300">{{ assessmentResult.totalDuration }} detik</span>
                        </div>
                    </div>

                    <!-- Tombol aksi -->
                    <div class="flex gap-2 mt-4">
                        <button
                            @click="restartSession"
                            class="flex-1 py-2 px-3 rounded-lg bg-dark-800 hover:bg-dark-700 border border-white/5 text-slate-300 hover:text-white text-xs font-semibold transition-all duration-200"
                        >
                            Ulangi Tes
                        </button>
                        <button
                            @click="handleBack"
                            class="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all duration-200"
                        >
                            Selesai
                        </button>
                    </div>
                </div>

                <!-- Test info card -->
                <div class="card p-5">
                    <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Info Tes</h3>
                    <p class="text-xs text-slate-400 leading-relaxed mb-4">{{ test.description }}</p>
                    <div class="space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">Satuan</span>
                            <span class="text-xs font-medium text-white">{{ test.unit }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-600">Estimasi Waktu</span>
                            <span class="text-xs font-medium text-white">{{ test.duration }}</span>
                        </div>
                    </div>
                </div>

                <!-- Instructions card -->
                <div class="card p-5">
                    <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Instruksi</h3>
                    <ol class="space-y-2">
                        <li v-for="(step, i) in instructions" :key="i"
                            class="flex items-start gap-2.5 text-xs text-slate-400">
                            <span class="flex-shrink-0 w-5 h-5 rounded-full bg-primary-500/15 text-primary-400 font-bold text-xs flex items-center justify-center mt-0.5">
                                {{ i + 1 }}
                            </span>
                            <span class="leading-relaxed">{{ step }}</span>
                        </li>
                    </ol>
                </div>

                <!-- Camera error notice -->
                <div v-if="cameraErrorMsg"
                     class="card p-4 border-red-500/20 bg-red-500/5">
                    <div class="flex items-start gap-2.5">
                        <svg class="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                        <div>
                            <p class="text-xs font-semibold text-red-400 mb-0.5">Error Kamera</p>
                            <p class="text-xs text-slate-400 leading-relaxed">{{ cameraErrorMsg }}</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>

    </PhysicalAssessmentLayout>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue';
import PhysicalAssessmentLayout from '@/Layouts/PhysicalAssessmentLayout.vue';
import CameraPreview from '@/Components/CameraPreview.vue';
import PoseDetector from '@/Components/PoseDetector.vue';
import { usePoseValidation } from '@/composables/usePoseValidation.js';
import { usePushUpDetection, PUSHUP_DEBUG } from '@/composables/usePushUpDetection.js';
import { useSitUpDetection, SITUP_DEBUG } from '@/composables/useSitUpDetection.js';
import { useStaticBalanceDetection, BALANCE_DEBUG } from '@/composables/useStaticBalanceDetection.js';
import { useWallSitDetection, WALLSIT_DEBUG } from '@/composables/useWallSitDetection.js';
import { useElbowPlankDetection, PLANK_DEBUG } from '@/composables/useElbowPlankDetection.js';
import { useDeepSquatDetection, DEEPSQUAT_DEBUG } from '@/composables/useDeepSquatDetection.js';
import { useSquatJumpDetection, SQUATJUMP_DEBUG } from '@/composables/useSquatJumpDetection.js';
import { useSitAndReachDetection, SITANDREACH_DEBUG } from '@/composables/useSitAndReachDetection.js';
import { useAssessmentSettings } from '@/composables/useAssessmentSettings.js';
const props = defineProps({
    currentPage: { type: String, default: 'assessment' },
    athleteName: { type: String, default: '' },
    test: {
        type: Object,
        default: () => ({
            id: 1, number: 1,
            name: 'Keseimbangan Statis',
            icon: '🧍',
            category: 'Balance',
            unit: 'Detik (s)',
            duration: '2-3 menit',
            description: 'Mengukur kemampuan mempertahankan posisi seimbang.',
        }),
    },
});

const emit = defineEmits(['navigate', 'back']);

// ── Assessment Mode ────────────────────────────────────────────────────────
// 'camera' = Realtime Camera (default, behavior existing tidak berubah)
// 'upload' = Upload Video (hanya untuk Push Up test)
const assessmentMode = ref('camera');

// ── Upload Video State ─────────────────────────────────────────────────────
const uploadVideoRef    = ref(null);        // ref ke <video> element upload
const uploadFile        = ref(null);        // File object dari input
const uploadObjectUrl   = ref('');          // URL.createObjectURL(file)
const uploadFileName    = ref('');          // nama file untuk display
const uploadDuration    = ref(0);           // durasi video (detik)
const uploadReady       = ref(false);       // video metadata loaded & siap
const isAnalyzing       = ref(false);       // sedang analisis
const analysisProgress  = ref(0);          // 0–100
const analysisComplete  = ref(false);       // analisis selesai
const analysisResult    = ref(null);        // { repetitions, duration, avgVisibility, ... }
let   _prevObjectUrl    = '';               // untuk revoke saat ganti file

// ── Active video element (abstraksi sumber) ────────────────────────────────
// ── Active video element ──────────────────────────────────────────────────
const activeVideoElement = computed(() => {
    return cameraRef.value?.videoRef ?? null;
});

// ── Upload video — event handlers ─────────────────────────────────────────
function onFileSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Revoke URL lama agar tidak memory leak
    if (_prevObjectUrl) {
        URL.revokeObjectURL(_prevObjectUrl);
        _prevObjectUrl = '';
    }

    // Reset state analisis sebelumnya
    resetUploadState();
    resetValidation();
    resetPushUp();

    const url = URL.createObjectURL(file);
    _prevObjectUrl        = url;
    uploadObjectUrl.value = url;
    uploadFile.value      = file;
    uploadFileName.value  = file.name;
    uploadReady.value     = false;
    analysisComplete.value = false;
    analysisResult.value  = null;
}

function onUploadVideoMetadataLoaded() {
    const video = uploadVideoRef.value;
    if (!video) return;
    uploadDuration.value = video.duration ?? 0;
    uploadReady.value    = true;
}

function onUploadVideoTimeUpdate() {
    const video = uploadVideoRef.value;
    if (!video || !isAnalyzing.value) return;
    const pct = video.duration > 0
        ? Math.min(Math.round((video.currentTime / video.duration) * 100), 99)
        : 0;
    analysisProgress.value = pct;
    elapsedSeconds.value   = Math.round(video.currentTime);
}

function onUploadVideoEnded() {
    if (!isAnalyzing.value) return;
    finishAnalysis();
}

async function startVideoAnalysis() {
    const video = uploadVideoRef.value;
    if (!video || !uploadReady.value) return;

    resetValidation();
    resetPushUp();
    poseStatus.value        = 'searching';
    poseDetectedCount.value = 0;
    poseVisibility.value    = 0;
    elapsedSeconds.value    = 0;
    analysisProgress.value  = 0;
    analysisComplete.value  = false;
    analysisResult.value    = null;
    pushUpCountingSide.value = '—';

    // Reset evaluator trace diagnostic
    pushUpEvalDiag.value = {
        evaluatorCalled: false, callCount: 0,
        lastLeftOk: false, lastRightOk: false,
        lastRawStatus: '—', lastReason: '—',
        rShoulder: 0, rElbow: 0, rWrist: 0,
        lShoulder: 0, lElbow: 0, lWrist: 0,
        readyCount: 0, posInvalidCount: 0, noBodyCount: 0, bodyDetectedCount: 0,
        consecValidFrames: 0,
    };

    // Install validator sesuai tes aktif
    if (isPushUpTest.value)             installPushUpValidator();
    else if (isSitUpTest.value)         installSitUpValidator();
    else if (isStaticBalanceTest.value) installBalanceValidator();
    else if (isWallSitTest.value)       installWallSitValidator();
    else if (isElbowPlankTest.value)    installPlankValidator();
    else if (isDeepSquatTest.value)     installDeepSquatValidator();
    else if (isSquatJumpTest.value)     installSquatJumpValidator();
    else if (isSitAndReachTest.value)   installSitAndReachValidator();
    else                                uninstallPushUpValidator();

    video.currentTime = 0;
    isAnalyzing.value  = true;
    sessionState.value = 'assessing';

    try {
        await video.play();
    } catch (e) {
        isAnalyzing.value  = false;
        sessionState.value = 'idle';
        uninstallPushUpValidator();
    }
}

function stopVideoAnalysis() {
    const video = uploadVideoRef.value;
    if (video && !video.paused) video.pause();
    isAnalyzing.value  = false;
    sessionState.value = 'stopped';
    finishAnalysis();
}

function finishAnalysis() {
    const video = uploadVideoRef.value;
    if (video && !video.paused) video.pause();

    isAnalyzing.value      = false;
    sessionState.value     = 'stopped';
    analysisProgress.value = 100;

    // Kumpulkan hasil dari state composable
    analysisResult.value = {
        repetitions:      pushUpCount.value,
        duration:         uploadDuration.value,
        avgVisibility:    poseVisibility.value,
        downEverReached:  pushUpDebugSM.value?.downEverReached  ?? false,
        upAfterDown:      pushUpDebugSM.value?.upAfterDownReached ?? false,
        totalFrames:      perfData.value.totalFrames,
        avgFps:           perfData.value.loopFps,
        successCycles:    pushUpDebugRepHistory.value.filter(c => c.counted).length,
        failedCycles:     pushUpDebugRepHistory.value.filter(c => !c.counted && c.resetReason !== '—').length,
    };

    analysisComplete.value = true;
}

function resetUploadState() {
    uploadFile.value        = null;
    uploadFileName.value    = '';
    uploadDuration.value    = 0;
    uploadReady.value       = false;
    isAnalyzing.value       = false;
    analysisProgress.value  = 0;
    analysisComplete.value  = false;
    analysisResult.value    = null;
    elapsedSeconds.value    = 0;
    sessionState.value      = 'idle';
    poseStatus.value        = 'searching';
}

function switchMode(mode) {
    if (mode === 'upload' && assessmentMode.value === 'camera') {
        if (sessionState.value === 'assessing') stopAssessment();
        cameraRef.value?.stopCamera();
        cameraActive.value = false;
        sessionState.value = 'idle';
    }
    if (mode === 'camera' && assessmentMode.value === 'upload') {
        if (isAnalyzing.value) stopVideoAnalysis();
    }

    assessmentMode.value = mode;
    resetValidation();
    resetPushUp();
    resetSitUp();
    resetBalance();
    resetWallSit();
    resetPlank();
    resetDeepSquat();
    resetSquatJump();
    resetSitAndReach();
    uninstallPushUpValidator();
    uninstallSitUpValidator();
    uninstallBalanceValidator();
    uninstallWallSitValidator();
    uninstallPlankValidator();
    uninstallDeepSquatValidator();
    uninstallSquatJumpValidator();
    pushUpCountingSide.value = '—';
    poseStatus.value = 'searching';
    sessionState.value = 'idle';
}

// Refs
const cameraRef    = ref(null);
const sessionState = ref('idle');      // idle | cameraReady | assessing | stopped
const cameraActive = ref(false);
const cameraErrorMsg = ref('');
const elapsedSeconds = ref(0);

// ── Pose Detection State ────────────────────────────────────────────────────
// 'searching' | 'detected' | 'lost'
const poseStatus        = ref('searching');
const poseDetectedCount = ref(0);
const poseTotalTarget   = ref(15);   // 15 landmark target
const poseVisibility    = ref(0);    // 0–100

// ── Performance data dari PoseDetector (Tahap 8A/8B) ─────────────────────
const perfData = ref({
    loopFps: 0, inferenceFps: 0,
    loopAvgMs: 0, loopMinMs: 0, loopMaxMs: 0,
    preprocessAvgMs: 0, preprocessMinMs: 0, preprocessMaxMs: 0,
    sendAvgMs: 0, sendMinMs: 0, sendMaxMs: 0,
    drawAvgMs: 0, drawMinMs: 0, drawMaxMs: 0,
    emitAvgMs: 0, idleAvgMs: 0,
    totalFrames: 0, skippedFrames: 0, resultFrames: 0,
    videoWidth: 0, videoHeight: 0, videoReadyState: -1,
    inferenceWidth: 0, inferenceHeight: 0,
    devicePixelRatio: 1, tabVisible: true,
    droppedFrames: null, totalVideoFrames: null, corruptedFrames: null,
});

// ── Pose Validation (usePoseValidation composable) ─────────────────────────
const {
    validationStatus,
    statusMessage:       poseValidationMessage,
    isReady:             poseIsReady,
    statusColor:         poseValidationColor,
    statusDotColor:      poseValidationDot,
    statusIcon:          poseValidationIcon,
    stabilizationProgress,
    invalidReason,
    processPoseFrame,
    resetValidation,
    setCustomEvaluate,
    debugValidationReadyCount,
} = usePoseValidation();

// ── Push Up: Single-Side Validation ────────────────────────────────────────
// Untuk Push Up, satu sisi tubuh yang valid sudah cukup untuk counting.
// Ini di-install sebagai custom evaluator di usePoseValidation saat Push Up
// aktif, dan di-uninstall saat test lain / sesi berakhir.
//
// Aturan:
//   R+L valid → READY
//   R valid, L invalid → READY  (gunakan Right Side)
//   L valid, R invalid → READY  (gunakan Left Side)
//   R+L invalid → POSITION_INVALID
//
// "Valid" untuk Push Up = shoulder + elbow + wrist tersedia dengan vis ≥ 0.5
// Hip/knee/ankle yang rendah TIDAK memblokir READY.

const PUSHUP_SIDE_VISIBILITY = 0.5; // sama dengan MIN_VISIBILITY

/**
 * Evaluasi apakah satu sisi (kiri atau kanan) memiliki landmark counting valid.
 * Hanya mengecek shoulder + elbow + wrist — hip/ankle diabaikan.
 *
 * @param {Array} landmarks — 33 landmark MediaPipe
 * @param {'left'|'right'} side
 * @returns {boolean}
 */
function isPushUpSideValid(landmarks, side) {
    const idx = side === 'left'
        ? [11, 13, 15]   // left_shoulder, left_elbow, left_wrist
        : [12, 14, 16];  // right_shoulder, right_elbow, right_wrist
    return idx.every(i => {
        const lm = landmarks?.[i];
        return lm != null &&
               typeof lm.x === 'number' &&
               (lm.visibility ?? 0) >= PUSHUP_SIDE_VISIBILITY;
    });
}

/**
 * Custom evaluator untuk Push Up — single-side validation.
 * Signature sesuai yang diharapkan usePoseValidation.setCustomEvaluate().
 *
 * @param {Array|null} landmarks
 * @param {number}     detectedCount
 * @param {number}     avgVisibility
 * @returns {{ rawStatus: string, reason: string }}
 */
function pushUpEvaluateFrame(landmarks, detectedCount, avgVisibility) {
    // ── Update evaluator trace diagnostic ─────────────────────────────────
    const diag = pushUpEvalDiag.value;
    diag.evaluatorCalled = true;
    diag.callCount++;

    // Snapshot raw visibility per landmark untuk debugging
    const vis = (idx) => Math.round((landmarks?.[idx]?.visibility ?? 0) * 100);
    diag.rShoulder = vis(12);
    diag.rElbow    = vis(14);
    diag.rWrist    = vis(16);
    diag.lShoulder = vis(11);
    diag.lElbow    = vis(13);
    diag.lWrist    = vis(15);

    // 1. Tidak ada landmark → NO_BODY
    if (!landmarks || landmarks.length < 33) {
        diag.lastRawStatus = 'NO_BODY';
        diag.lastReason    = 'Tidak ada landmark terdeteksi';
        diag.noBodyCount++;
        return { rawStatus: 'NO_BODY', reason: diag.lastReason };
    }

    // 2. Cek setidaknya satu sisi counting valid (shoulder+elbow+wrist)
    const leftOk  = isPushUpSideValid(landmarks, 'left');
    const rightOk = isPushUpSideValid(landmarks, 'right');
    diag.lastLeftOk  = leftOk;
    diag.lastRightOk = rightOk;

    if (!leftOk && !rightOk) {
        diag.lastRawStatus = 'POSITION_INVALID';
        diag.lastReason    = `L✗R✗ — R(${diag.rShoulder}%/${diag.rElbow}%/${diag.rWrist}%) L(${diag.lShoulder}%/${diag.lElbow}%/${diag.lWrist}%)`;
        diag.posInvalidCount++;
        return {
            rawStatus: 'POSITION_INVALID',
            reason:    diag.lastReason,
        };
    }

    // 3. Cek setidaknya ada satu shoulder dengan visibility cukup untuk posisi body
    //    (agar pose tidak terlalu jauh/aneh dari kamera)
    const rightShoulder = landmarks[12];
    const leftShoulder  = landmarks[11];
    const hasShoulder   = (rightOk && (rightShoulder?.visibility ?? 0) >= PUSHUP_SIDE_VISIBILITY) ||
                          (leftOk  && (leftShoulder?.visibility  ?? 0) >= PUSHUP_SIDE_VISIBILITY);

    if (!hasShoulder) {
        diag.lastRawStatus = 'NO_BODY';
        diag.lastReason    = 'Tidak ada bahu yang terdeteksi';
        diag.noBodyCount++;
        return { rawStatus: 'NO_BODY', reason: diag.lastReason };
    }

    // 4. Minimal ada beberapa landmark yang terdeteksi untuk konfirmasi ada orang
    if (detectedCount < 4) {
        diag.lastRawStatus = 'BODY_DETECTED';
        diag.lastReason    = `Hanya ${detectedCount} landmark terdeteksi (min 4 untuk push-up)`;
        diag.bodyDetectedCount++;
        return {
            rawStatus: 'BODY_DETECTED',
            reason:    diag.lastReason,
        };
    }

    // 5. Semua OK → READY
    const countingSide = rightOk && leftOk ? 'BOTH'
                       : rightOk           ? 'RIGHT'
                       :                     'LEFT';
    diag.lastRawStatus = 'READY';
    diag.lastReason    = `Single-side OK — ${countingSide} R(${diag.rShoulder}%/${diag.rElbow}%/${diag.rWrist}%)`;
    diag.readyCount++;
    return {
        rawStatus: 'READY',
        reason:    diag.lastReason,
    };
}

// Track sisi counting aktif untuk diagnostic
const pushUpCountingSide = ref('—'); // '—' | 'LEFT' | 'RIGHT' | 'BOTH'

// ── Evaluator Trace Diagnostic ────────────────────────────────────────────
// Bukti runtime: apakah custom evaluator benar-benar dipanggil, dan apa
// hasil setiap frame. Di-update langsung dari dalam pushUpEvaluateFrame.
const pushUpEvalDiag = ref({
    evaluatorCalled:    false,   // apakah fn ini pernah dipanggil sama sekali
    callCount:          0,       // total pemanggilan sejak analisis dimulai
    lastLeftOk:         false,   // isPushUpSideValid hasil terakhir, sisi kiri
    lastRightOk:        false,   // isPushUpSideValid hasil terakhir, sisi kanan
    lastRawStatus:      '—',     // rawStatus terakhir dari evaluator ini
    lastReason:         '—',     // reason terakhir
    rShoulder:          0,       // visibility R.Shoulder frame terakhir (0–100)
    rElbow:             0,       // visibility R.Elbow
    rWrist:             0,       // visibility R.Wrist
    lShoulder:          0,       // visibility L.Shoulder
    lElbow:             0,
    lWrist:             0,
    readyCount:         0,       // berapa kali rawStatus === 'READY'
    posInvalidCount:    0,       // berapa kali rawStatus === 'POSITION_INVALID'
    noBodyCount:        0,
    bodyDetectedCount:  0,
    consecValidFrames:  0,       // snapshot consecutiveValidFrames dari evaluator
});

// Install/uninstall evaluator saat isPushUpTest berubah
// Dipanggil manual di startAssessment/startVideoAnalysis/switchMode/reset
function installPushUpValidator() {
    setCustomEvaluate(pushUpEvaluateFrame);
}
function uninstallPushUpValidator() {
    setCustomEvaluate(null);
}

// ── Push-Up Detection ──────────────────────────────────────────────────────
const isPushUpTest = computed(() => props.test.name === 'Push Up');

const {
    repetitionCount:  pushUpCount,
    currentPhase:     pushUpPhase,
    formStatus:       pushUpFormStatus,
    elbowAngle:       pushUpElbowAngle,
    bodyAngle:        pushUpBodyAngle,
    feedback:         pushUpFeedback,
    isValidRep:       pushUpIsValidRep,
    formStatusLabel:  pushUpFormLabel,
    formStatusBadge:  pushUpFormBadge,
    phaseLabel:       pushUpPhaseLabel,
    phaseColor:       pushUpPhaseColor,
    debugFps:                   pushUpDebugFps,
    debugFrameCount:            pushUpDebugFrameCount,
    debugLandmarkReport:        pushUpDebugLandmarks,
    debugBodyAlignmentReport:   pushUpDebugBodyAlign,
    debugInferenceStats:        pushUpDebugInference,
    debugStateMachine:          pushUpDebugSM,
    debugFrameHistory:          pushUpDebugHistory,
    debugRepCycle:              pushUpDebugRepCycle,
    debugRepCycleHistory:       pushUpDebugRepHistory,
    debugCountingLmReport:      pushUpDebugCountingLm,
    debugCountingPipeline:      pushUpDebugPipeline,
    debugPipelineCumulative:    pushUpDebugCumul,
    processPushUpFrame,
    resetPushUp,
} = usePushUpDetection();

// ── Sit Up Detection ───────────────────────────────────────────────────────
const isSitUpTest = computed(() => props.test.name === 'Sit Up');

const {
    repetitionCount:        sitUpCount,
    currentPhase:           sitUpPhase,
    formStatus:             sitUpFormStatus,
    hipAngle:               sitUpHipAngle,
    feedback:               sitUpFeedback,
    isValidRep:             sitUpIsValidRep,
    countingSide:           sitUpCountingSide,
    phaseLabel:             sitUpPhaseLabel,
    phaseColor:             sitUpPhaseColor,
    formStatusBadge:        sitUpFormBadge,
    debugFps:               sitUpDebugFps,
    debugLandmarkReport:    sitUpDebugLandmarks,
    debugCountingLmReport:  sitUpDebugCountingLm,
    debugCountingPipeline:  sitUpDebugPipeline,
    debugPipelineCumulative:sitUpDebugCumul,
    debugStateMachine:      sitUpDebugSM,
    debugFrameHistory:      sitUpDebugHistory,
    debugRepCycle:          sitUpDebugRepCycle,
    debugRepCycleHistory:   sitUpDebugRepHistory,
    processSitUpFrame,
    resetSitUp,
} = useSitUpDetection();

// ── Sit Up: Single-Side Validation ─────────────────────────────────────────
// Evaluator untuk Sit Up — cek shoulder + hip + knee.
// Satu sisi valid sudah cukup (single-side, sama seperti Push Up).
const SITUP_SIDE_VISIBILITY = 0.5;

function isSitUpSideValid(landmarks, side) {
    const idx = side === 'left'
        ? [11, 23, 25]   // left_shoulder, left_hip, left_knee
        : [12, 24, 26];  // right_shoulder, right_hip, right_knee
    return idx.every(i => {
        const lm = landmarks?.[i];
        return lm != null &&
               typeof lm.x === 'number' &&
               (lm.visibility ?? 0) >= SITUP_SIDE_VISIBILITY;
    });
}

function sitUpEvaluateFrame(landmarks, detectedCount, avgVisibility) {
    if (!landmarks || landmarks.length < 33) {
        return { rawStatus: 'NO_BODY', reason: 'Tidak ada landmark terdeteksi' };
    }

    const leftOk  = isSitUpSideValid(landmarks, 'left');
    const rightOk = isSitUpSideValid(landmarks, 'right');

    if (!leftOk && !rightOk) {
        return {
            rawStatus: 'POSITION_INVALID',
            reason:    'Kedua sisi — shoulder/hip/knee tidak terdeteksi dengan baik',
        };
    }

    if (detectedCount < 4) {
        return {
            rawStatus: 'BODY_DETECTED',
            reason:    `Hanya ${detectedCount} landmark terdeteksi (min 4)`,
        };
    }

    const countingSide = rightOk && leftOk ? 'BOTH'
                       : rightOk           ? 'RIGHT'
                       :                     'LEFT';
    return {
        rawStatus: 'READY',
        reason:    `Sit Up single-side OK — ${countingSide}`,
    };
}

function installSitUpValidator() {
    setCustomEvaluate(sitUpEvaluateFrame);
}
function uninstallSitUpValidator() {
    setCustomEvaluate(null);
}

// ── Static Balance Detection ───────────────────────────────────────────────
const isStaticBalanceTest = computed(() => props.test.name === 'Keseimbangan Statis');

const {
    currentPhase:              balancePhase,
    balanceDuration,
    totalDuration:             balanceTotalDuration,
    standingLeg,
    ankleDiff,
    feedback:                  balanceFeedback,
    isBalancing,
    phaseLabel:                balancePhaseLabel,
    phaseColor:                balancePhaseColor,
    standingLegLabel,
    balanceDurationFormatted,
    debugFps:               balanceDebugFps,
    debugLandmarkReport:    balanceDebugLandmarks,
    debugAnkleDetail:       balanceDebugAnkle,
    debugCountingPipeline:  balanceDebugPipeline,
    debugPipelineCumulative:balanceDebugCumul,
    debugStateMachine:      balanceDebugSM,
    debugFrameHistory:      balanceDebugHistory,
    debugBalanceEvents:     balanceDebugEvents,
    processBalanceFrame,
    resetBalance,
} = useStaticBalanceDetection();

// ── Balance: Custom Evaluator ─────────────────────────────────────────────
// Evaluator ini memastikan:
//   1. Upper body terlihat (nose, shoulders, hips)
//   2. Minimal 1 ankle visible — tanpa ini tidak bisa detect kaki
// Ini mencegah orang yang hanya terlihat dari pinggang ke atas
// dianggap valid untuk Static Balance.
const BALANCE_SIDE_VISIBILITY = 0.5;

function balanceEvaluateFrame(landmarks, detectedCount /*, avgVisibility */) {
    if (!landmarks || landmarks.length < 33) {
        return { rawStatus: 'NO_BODY', reason: 'Tidak ada landmark terdeteksi' };
    }

    // Cek landmark wajib upper body
    const required = [0, 11, 12, 23, 24]; // nose, l/r shoulder, l/r hip
    const allUpperBodyOk = required.every(i => {
        const lm = landmarks[i];
        return lm != null && typeof lm.x === 'number' && (lm.visibility ?? 0) >= BALANCE_SIDE_VISIBILITY;
    });

    if (!allUpperBodyOk) {
        return {
            rawStatus: 'POSITION_INVALID',
            reason:    'Pastikan kepala, bahu, dan pinggul terlihat kamera',
        };
    }

    // Cek minimal satu ankle visible
    const leftAnkle  = landmarks[27];
    const rightAnkle = landmarks[28];
    const leftAnkleOk  = leftAnkle  != null && (leftAnkle.visibility  ?? 0) >= BALANCE_SIDE_VISIBILITY;
    const rightAnkleOk = rightAnkle != null && (rightAnkle.visibility ?? 0) >= BALANCE_SIDE_VISIBILITY;

    if (!leftAnkleOk && !rightAnkleOk) {
        return {
            rawStatus: 'POSITION_INVALID',
            reason:    'Pastikan kaki terlihat — mundur dari kamera agar seluruh tubuh terlihat',
        };
    }

    if (detectedCount < 6) {
        return {
            rawStatus: 'BODY_DETECTED',
            reason:    `Hanya ${detectedCount} landmark terdeteksi (min 6 untuk balance)`,
        };
    }

    return {
        rawStatus: 'READY',
        reason:    `Balance OK — ankle: ${leftAnkleOk ? 'L✓' : 'L✗'} ${rightAnkleOk ? 'R✓' : 'R✗'}`,
    };
}

function installBalanceValidator() {
    setCustomEvaluate(balanceEvaluateFrame);
}
function uninstallBalanceValidator() {
    setCustomEvaluate(null);
}

// ── Wall Sit Detection ─────────────────────────────────────────────────────
const isWallSitTest = computed(() => props.test.name === 'Wall Sit');

const {
    currentPhase:        wallSitPhase,
    holdDuration,
    totalDuration:       wallSitTotalDuration,
    kneeAngle,
    countingSide:        wallSitCountingSide,
    feedback:            wallSitFeedback,
    isHolding,
    phaseLabel:          wallSitPhaseLabel,
    phaseColor:          wallSitPhaseColor,
    holdDurationFormatted,
    debugFps:            wallSitDebugFps,
    debugLandmarkReport: wallSitDebugLandmarks,
    debugKneeDetail:     wallSitDebugKnee,
    debugCountingPipeline: wallSitDebugPipeline,
    debugPipelineCumulative: wallSitDebugCumul,
    debugStateMachine:   wallSitDebugSM,
    debugFrameHistory:   wallSitDebugHistory,
    debugHoldEvents:     wallSitDebugEvents,
    processWallSitFrame,
    resetWallSit,
} = useWallSitDetection();

// Wall Sit evaluator — wajib punya shoulder + hip + knee + ankle
const WALLSIT_SIDE_VISIBILITY = 0.5;

function wallSitEvaluateFrame(landmarks, detectedCount) {
    if (!landmarks || landmarks.length < 33) {
        return { rawStatus: 'NO_BODY', reason: 'Tidak ada landmark terdeteksi' };
    }

    // Upper body harus terlihat: shoulder
    const lsOk = landmarks[11] != null && (landmarks[11].visibility ?? 0) >= WALLSIT_SIDE_VISIBILITY;
    const rsOk = landmarks[12] != null && (landmarks[12].visibility ?? 0) >= WALLSIT_SIDE_VISIBILITY;
    if (!lsOk && !rsOk) {
        return { rawStatus: 'POSITION_INVALID', reason: 'Pastikan bahu terlihat kamera' };
    }

    // Minimal satu sisi hip+knee+ankle harus valid
    const leftLegOk = [23, 25, 27].every(i => {
        const lm = landmarks[i];
        return lm != null && (lm.visibility ?? 0) >= WALLSIT_SIDE_VISIBILITY;
    });
    const rightLegOk = [24, 26, 28].every(i => {
        const lm = landmarks[i];
        return lm != null && (lm.visibility ?? 0) >= WALLSIT_SIDE_VISIBILITY;
    });

    if (!leftLegOk && !rightLegOk) {
        return {
            rawStatus: 'POSITION_INVALID',
            reason:    'Pastikan kaki (pinggul, lutut, pergelangan) terlihat',
        };
    }

    if (detectedCount < 6) {
        return {
            rawStatus: 'BODY_DETECTED',
            reason:    `Hanya ${detectedCount} landmark terdeteksi (min 6)`,
        };
    }

    const side = leftLegOk && rightLegOk ? 'BOTH' : leftLegOk ? 'LEFT' : 'RIGHT';
    return {
        rawStatus: 'READY',
        reason:    `Wall Sit OK — leg: ${side}`,
    };
}

function installWallSitValidator() {
    setCustomEvaluate(wallSitEvaluateFrame);
}
function uninstallWallSitValidator() {
    setCustomEvaluate(null);
}

// ── Elbow Plank Detection ──────────────────────────────────────────────────
const isElbowPlankTest = computed(() => props.test.name === 'Elbow Plank');

const {
    currentPhase:        plankPhase,
    holdDuration:        plankHoldDuration,
    totalDuration:       plankTotalDuration,
    bodyAngle:           plankBodyAngle,
    countingSide:        plankCountingSide,
    feedback:            plankFeedback,
    isHolding:           plankIsHolding,
    phaseLabel:          plankPhaseLabel,
    phaseColor:          plankPhaseColor,
    holdDurationFormatted: plankHoldDurationFormatted,
    debugFps:            plankDebugFps,
    debugLandmarkReport: plankDebugLandmarks,
    debugAlignmentDetail:plankDebugAlignment,
    debugCountingPipeline: plankDebugPipeline,
    debugPipelineCumulative: plankDebugCumul,
    debugStateMachine:   plankDebugSM,
    debugFrameHistory:   plankDebugHistory,
    debugHoldEvents:     plankDebugEvents,
    processPlankFrame,
    resetPlank,
} = useElbowPlankDetection();

// Elbow Plank evaluator — wajib shoulder + hip + ankle minimal satu sisi
const PLANK_SIDE_VISIBILITY = 0.5;

function plankEvaluateFrame(landmarks, detectedCount) {
    if (!landmarks || landmarks.length < 33) {
        return { rawStatus: 'NO_BODY', reason: 'Tidak ada landmark terdeteksi' };
    }
    // Minimal satu sisi shoulder+hip+ankle visible
    const leftOk = [11, 23, 27].every(i => {
        const lm = landmarks[i];
        return lm != null && (lm.visibility ?? 0) >= PLANK_SIDE_VISIBILITY;
    });
    const rightOk = [12, 24, 28].every(i => {
        const lm = landmarks[i];
        return lm != null && (lm.visibility ?? 0) >= PLANK_SIDE_VISIBILITY;
    });
    if (!leftOk && !rightOk) {
        return {
            rawStatus: 'POSITION_INVALID',
            reason:    'Pastikan bahu, pinggul, dan pergelangan kaki terlihat kamera',
        };
    }
    if (detectedCount < 5) {
        return {
            rawStatus: 'BODY_DETECTED',
            reason:    `Hanya ${detectedCount} landmark terdeteksi (min 5)`,
        };
    }
    const side = leftOk && rightOk ? 'BOTH' : leftOk ? 'LEFT' : 'RIGHT';
    return { rawStatus: 'READY', reason: `Plank OK — side: ${side}` };
}

function installPlankValidator() {
    setCustomEvaluate(plankEvaluateFrame);
}
function uninstallPlankValidator() {
    setCustomEvaluate(null);
}

// ── Deep Squat Detection ────────────────────────────────────────────────────
const isDeepSquatTest = computed(() => props.test.name === 'Deep Squat');

const {
    repetitionCount:        deepSquatCount,
    currentPhase:           deepSquatPhase,
    kneeAngle:              deepSquatKneeAngle,
    countingSide:           deepSquatCountingSide,
    feedback:               deepSquatFeedback,
    isValidRep:             deepSquatIsValidRep,
    phaseLabel:             deepSquatPhaseLabel,
    phaseColor:             deepSquatPhaseColor,
    debugFps:               deepSquatDebugFps,
    debugLandmarkReport:    deepSquatDebugLandmarks,
    debugCountingLmReport:  deepSquatDebugCountingLm,
    debugCountingPipeline:  deepSquatDebugPipeline,
    debugPipelineCumulative:deepSquatDebugCumul,
    debugStateMachine:      deepSquatDebugSM,
    debugFrameHistory:      deepSquatDebugHistory,
    debugRepCycle:          deepSquatDebugRepCycle,
    debugRepCycleHistory:   deepSquatDebugRepHistory,
    processDeepSquatFrame,
    resetDeepSquat,
} = useDeepSquatDetection();

// Deep Squat evaluator — wajib hip + knee + ankle minimal satu sisi
const DEEPSQUAT_SIDE_VISIBILITY = 0.5;

function deepSquatEvaluateFrame(landmarks, detectedCount) {
    if (!landmarks || landmarks.length < 33) {
        return { rawStatus: 'NO_BODY', reason: 'Tidak ada landmark terdeteksi' };
    }
    const leftOk = [23, 25, 27].every(i => {
        const lm = landmarks[i];
        return lm != null && (lm.visibility ?? 0) >= DEEPSQUAT_SIDE_VISIBILITY;
    });
    const rightOk = [24, 26, 28].every(i => {
        const lm = landmarks[i];
        return lm != null && (lm.visibility ?? 0) >= DEEPSQUAT_SIDE_VISIBILITY;
    });
    if (!leftOk && !rightOk) {
        return {
            rawStatus: 'POSITION_INVALID',
            reason:    'Pastikan pinggul, lutut, dan pergelangan kaki terlihat kamera',
        };
    }
    if (detectedCount < 4) {
        return {
            rawStatus: 'BODY_DETECTED',
            reason:    `Hanya ${detectedCount} landmark terdeteksi (min 4)`,
        };
    }
    const side = leftOk && rightOk ? 'BOTH' : leftOk ? 'LEFT' : 'RIGHT';
    return { rawStatus: 'READY', reason: `Deep Squat OK — leg: ${side}` };
}

function installDeepSquatValidator() {
    setCustomEvaluate(deepSquatEvaluateFrame);
}
function uninstallDeepSquatValidator() {
    setCustomEvaluate(null);
}

// ── Squat Jump Detection ────────────────────────────────────────────────────
const isSquatJumpTest = computed(() => props.test.name === 'Squat Jump');

const {
    repetitionCount:        squatJumpCount,
    currentPhase:           squatJumpPhase,
    kneeAngle:              squatJumpKneeAngle,
    countingSide:           squatJumpCountingSide,
    feedback:               squatJumpFeedback,
    isValidRep:             squatJumpIsValidRep,
    phaseLabel:             squatJumpPhaseLabel,
    phaseColor:             squatJumpPhaseColor,
    debugFps:               squatJumpDebugFps,
    debugLandmarkReport:    squatJumpDebugLandmarks,
    debugJumpDetail:        squatJumpDebugJump,
    debugCountingPipeline:  squatJumpDebugPipeline,
    debugPipelineCumulative:squatJumpDebugCumul,
    debugStateMachine:      squatJumpDebugSM,
    debugFrameHistory:      squatJumpDebugHistory,
    debugRepCycle:          squatJumpDebugRepCycle,
    debugRepCycleHistory:   squatJumpDebugRepHistory,
    processSquatJumpFrame,
    resetSquatJump,
} = useSquatJumpDetection();

// Squat Jump evaluator — wajib hip + knee + ankle minimal satu sisi
const SQUATJUMP_SIDE_VIS = 0.5;

function squatJumpEvaluateFrame(landmarks, detectedCount) {
    if (!landmarks || landmarks.length < 33) {
        return { rawStatus: 'NO_BODY', reason: 'Tidak ada landmark terdeteksi' };
    }
    const leftOk = [23, 25, 27].every(i => {
        const lm = landmarks[i];
        return lm != null && (lm.visibility ?? 0) >= SQUATJUMP_SIDE_VIS;
    });
    const rightOk = [24, 26, 28].every(i => {
        const lm = landmarks[i];
        return lm != null && (lm.visibility ?? 0) >= SQUATJUMP_SIDE_VIS;
    });
    if (!leftOk && !rightOk) {
        return {
            rawStatus: 'POSITION_INVALID',
            reason:    'Pastikan pinggul, lutut, dan pergelangan kaki terlihat kamera',
        };
    }
    if (detectedCount < 4) {
        return {
            rawStatus: 'BODY_DETECTED',
            reason:    `Hanya ${detectedCount} landmark terdeteksi (min 4)`,
        };
    }
    const side = leftOk && rightOk ? 'BOTH' : leftOk ? 'LEFT' : 'RIGHT';
    return { rawStatus: 'READY', reason: `Squat Jump OK — leg: ${side}` };
}

function installSquatJumpValidator() {
    setCustomEvaluate(squatJumpEvaluateFrame);
}
function uninstallSquatJumpValidator() {
    setCustomEvaluate(null);
}

// ── Sit and Reach Detection ────────────────────────────────────────────────
const isSitAndReachTest = computed(() => props.test.name === 'Sit and Reach');

const {
    currentPhase:        sitReachPhase,
    reachDistance:       sitReachDistance,
    bestReachDistance:   sitReachBestDist,
    reachCm:             sitReachCm,
    bestReachCm:         sitReachBestCm,
    countingSide:        sitReachCountingSide,
    feedback:            sitReachFeedback,
    isReaching:          sitReachIsReaching,
    sittingValid:        sitReachSittingValid,
    legStraightValid:    sitReachLegStraightValid,
    phaseLabel:          sitReachPhaseLabel,
    phaseColor:          sitReachPhaseColor,
    bestReachLabel:      sitReachBestLabel,
    debugFps:            sitReachDebugFps,
    debugLandmarkReport: sitReachDebugLandmarks,
    debugReachDetail:    sitReachDebugDetail,
    debugCountingPipeline: sitReachDebugPipeline,
    debugPipelineCumulative: sitReachDebugCumul,
    debugStateMachine:   sitReachDebugSM,
    debugFrameHistory:   sitReachDebugHistory,
    debugBestReachHistory: sitReachDebugBestHistory,
    processSitAndReachFrame,
    resetSitAndReach,
} = useSitAndReachDetection();

// Sit and Reach evaluator: shoulder + hip + knee wajib + minimal satu foot visible
const SITREACH_SIDE_VIS = 0.5;

function sitAndReachEvaluateFrame(landmarks, detectedCount) {
    if (!landmarks || landmarks.length < 33) {
        return { rawStatus: 'NO_BODY', reason: 'Tidak ada landmark terdeteksi' };
    }
    // Minimal satu sisi: shoulder + hip + knee visible
    const leftOk = [11, 23, 25].every(i => {
        const lm = landmarks[i];
        return lm != null && (lm.visibility ?? 0) >= SITREACH_SIDE_VIS;
    });
    const rightOk = [12, 24, 26].every(i => {
        const lm = landmarks[i];
        return lm != null && (lm.visibility ?? 0) >= SITREACH_SIDE_VIS;
    });
    if (!leftOk && !rightOk) {
        return {
            rawStatus: 'POSITION_INVALID',
            reason:    'Pastikan bahu, pinggul, dan lutut terlihat kamera',
        };
    }
    // Minimal satu foot/ankle visible untuk measurement
    const leftFootOk  = landmarks[31] != null && (landmarks[31].visibility ?? 0) >= SITREACH_SIDE_VIS;
    const rightFootOk = landmarks[32] != null && (landmarks[32].visibility ?? 0) >= SITREACH_SIDE_VIS;
    if (!leftFootOk && !rightFootOk) {
        return {
            rawStatus: 'POSITION_INVALID',
            reason:    'Pastikan kaki (ujung kaki) terlihat kamera — mundur agar seluruh tubuh tampak',
        };
    }
    if (detectedCount < 5) {
        return {
            rawStatus: 'BODY_DETECTED',
            reason:    `Hanya ${detectedCount} landmark terdeteksi (min 5)`,
        };
    }
    return { rawStatus: 'READY', reason: 'Sit and Reach OK' };
}

function installSitAndReachValidator() {
    setCustomEvaluate(sitAndReachEvaluateFrame);
}
function uninstallSitAndReachValidator() {
    setCustomEvaluate(null);
}

let timerInterval = null;

// ── Assessment Settings (durasi, countdown, benchmark) ────────────────────
const { getDuration, getCountdown, getBenchmarkSnapshot, calculateAchievement } = useAssessmentSettings();

// ── Countdown state ────────────────────────────────────────────────────────
const countdownValue  = ref(0);    // 3 → 2 → 1 → 0 (0 = mulai)
const isCountingDown  = ref(false);
let countdownInterval = null;

// ── Remaining timer (hitung mundur selama assessment) ─────────────────────
const assessmentDurationSec = ref(60); // diset dari Settings saat startAssessment
const remainingSeconds      = ref(60);

const remainingFormatted = computed(() => {
    const s = remainingSeconds.value;
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
});

// ── Voice helper ──────────────────────────────────────────────────────────
function speak(text) {
    try {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(text);
        utt.lang  = 'id-ID';
        utt.rate  = 0.9;
        window.speechSynthesis.speak(utt);
    } catch (_) { /* voice is optional — never crash assessment */ }
}

// ── Assessment Result Snapshot ─────────────────────────────────────────────
// Snapshot hasil session terakhir — dibuat SEBELUM resetXxx() dipanggil.
// Dipertahankan sampai session berikutnya dimulai.
// Tidak mempengaruhi detection logic sama sekali.
const assessmentResult = ref(null);

// ── LocalStorage helpers ───────────────────────────────────────────────────
const HISTORY_KEY = 'physassess_assessment_history';

function saveResultToLocalStorage(result) {
    try {
        const existing = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        const updated  = [result, ...existing].slice(0, 100); // max 100 entries
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {
        // localStorage tidak tersedia atau penuh — abaikan secara aman
        console.warn('[PhysAssess] localStorage save failed:', e);
    }
}

/**
 * Ambil snapshot hasil SEMUA tes aktif dari ref composable yang masih hidup.
 * Dipanggil SEBELUM resetXxx().
 * Hanya tes yang aktif (sessionState === 'assessing') yang relevan,
 * tapi kita ambil semua nilai yang ada saat ini.
 */
function captureAssessmentResult() {
    const now        = new Date();
    const dateStr    = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr    = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const testName   = props.test.name;
    const category   = props.test.category;
    const unit       = props.test.unit;

    // Ambil nilai result sesuai tes yang aktif
    let resultValue   = null;
    let resultDisplay = '—';
    let extra         = {};

    if (isPushUpTest.value) {
        resultValue   = pushUpCount.value;
        resultDisplay = `${resultValue} rep`;
    } else if (isSitUpTest.value) {
        resultValue   = sitUpCount.value;
        resultDisplay = `${resultValue} rep`;
    } else if (isStaticBalanceTest.value) {
        resultValue   = parseFloat(balanceDuration.value.toFixed(1));
        const total   = parseFloat(balanceTotalDuration.value.toFixed(1));
        resultDisplay = `${resultValue} detik`;
        extra         = { totalDuration: total };
    } else if (isWallSitTest.value) {
        resultValue   = parseFloat(holdDuration.value.toFixed(1));
        const total   = parseFloat(wallSitTotalDuration.value.toFixed(1));
        resultDisplay = `${resultValue} detik`;
        extra         = { totalDuration: total };
    } else if (isElbowPlankTest.value) {
        resultValue   = parseFloat(plankHoldDuration.value.toFixed(1));
        const total   = parseFloat(plankTotalDuration.value.toFixed(1));
        resultDisplay = `${resultValue} detik`;
        extra         = { totalDuration: total };
    } else if (isDeepSquatTest.value) {
        resultValue   = deepSquatCount.value;
        resultDisplay = `${resultValue} rep`;
    } else if (isSquatJumpTest.value) {
        resultValue   = squatJumpCount.value;
        resultDisplay = `${resultValue} rep`;
    } else if (isSitAndReachTest.value) {
        resultValue   = sitReachBestCm.value;
        resultDisplay = `${resultValue > 0 ? '+' : ''}${resultValue} cm`;
        extra         = {
            estimated:      true,
            bestDistNorm:   sitReachBestDist.value < 999 ? sitReachBestDist.value : null,
        };
    }

    return {
        id:            `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        athleteName:   props.athleteName || 'Atlet',
        testId:        props.test.id,
        testName,
        category,
        unit,
        resultValue,
        resultDisplay,
        durationSec:       elapsedSeconds.value,
        date:              dateStr,
        time:              timeStr,
        timestamp:         now.toISOString(),
        // ── Benchmark snapshot (dikunci saat assessment selesai) ──────────
        benchmarkSnapshot: getBenchmarkSnapshot(testName),
        achievement:       calculateAchievement(
                               resultValue,
                               getBenchmarkSnapshot(testName)?.value ?? null
                           ),
        ...extra,
    };
}

// Computed
const categoryBadgeMap = {
    Balance:     'bg-violet-500/10 text-violet-400 border border-violet-500/20',
    Endurance:   'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    Strength:    'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    Mobility:    'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
    Power:       'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    Flexibility: 'bg-pink-500/10 text-pink-400 border border-pink-500/20',
};
const categoryBadge = computed(() =>
    categoryBadgeMap[props.test.category] ?? 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
);

const sessionStateBadge = computed(() => {
    const map = {
        idle:        { label: 'Menunggu',      class: 'bg-slate-500/10 text-slate-400' },
        cameraReady: { label: 'Siap Mulai',    class: 'bg-primary-500/10 text-primary-400' },
        assessing:   { label: 'Berlangsung',   class: 'bg-emerald-500/10 text-emerald-400' },
        stopped:     { label: 'Selesai',       class: 'bg-yellow-500/10 text-yellow-400' },
    };
    return map[sessionState.value] ?? map.idle;
});

const elapsedFormatted = computed(() => {
    const s = elapsedSeconds.value;
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
});

// Format durasi video upload
const uploadDurationFormatted = computed(() => {
    const s = Math.round(uploadDuration.value);
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
});

// ── Pose Status UI ─────────────────────────────────────────────────────────
const poseDetected = computed(() => poseStatus.value === 'detected');

const poseStatusLabel = computed(() => {
    if (sessionState.value !== 'assessing') return 'Tidak Aktif';
    const map = {
        searching: 'Mencari tubuh...',
        detected:  'Tubuh terdeteksi',
        lost:      'Tubuh tidak terdeteksi',
    };
    return map[poseStatus.value] ?? 'Mencari tubuh...';
});

const poseStatusDot = computed(() => {
    if (sessionState.value !== 'assessing') return 'bg-slate-700';
    const map = {
        searching: 'bg-yellow-500 animate-pulse',
        detected:  'bg-emerald-500',
        lost:      'bg-red-500',
    };
    return map[poseStatus.value] ?? 'bg-yellow-500 animate-pulse';
});

const poseStatusTextColor = computed(() => {
    if (sessionState.value !== 'assessing') return 'text-slate-600';
    const map = {
        searching: 'text-yellow-400',
        detected:  'text-emerald-400',
        lost:      'text-red-400',
    };
    return map[poseStatus.value] ?? 'text-yellow-400';
});

// Instructions per test category
const instructionMap = {
    Balance:     ['Posisikan diri menghadap kamera', 'Berdiri tegak di tempat yang terlihat jelas', 'Angkat satu kaki saat tes dimulai', 'Pertahankan posisi selama mungkin'],
    Endurance:   ['Posisikan diri menghadap kamera', 'Pastikan seluruh tubuh terlihat', 'Ambil posisi plank saat tes dimulai', 'Pertahankan posisi selama mungkin'],
    Strength:    ['Posisikan diri menghadap kamera', 'Pastikan seluruh tubuh terlihat jelas', 'Lakukan gerakan dengan teknik yang benar', 'Hitung repetisi atau pertahankan durasi'],
    Mobility:    ['Posisikan diri menghadap kamera dari sisi samping', 'Pastikan seluruh tubuh dari kepala ke kaki terlihat', 'Lakukan gerakan secara perlahan dan terkontrol'],
    Power:       ['Posisikan diri menghadap kamera', 'Pastikan ada ruang cukup untuk bergerak', 'Lakukan gerakan dengan kecepatan maksimal', 'Hitung repetisi yang berhasil'],
    Flexibility: ['Duduk di lantai menghadap kamera', 'Posisikan kaki lurus ke depan', 'Raih ujung kaki sejauh mungkin saat tes dimulai'],
};
const instructions = computed(() =>
    instructionMap[props.test.category] ?? [
        'Posisikan diri menghadap kamera',
        'Pastikan seluruh tubuh terlihat',
        'Ikuti instruksi tes',
    ]
);

// Camera handlers
function activateCamera() {
    cameraErrorMsg.value = '';
    cameraRef.value?.startCamera();
}

function deactivateCamera() {
    cameraRef.value?.stopCamera();
    sessionState.value = 'idle';
    cameraActive.value = false;
}

function onCameraReady() {
    sessionState.value = 'cameraReady';
    cameraActive.value = true;
    cameraErrorMsg.value = '';
}

function onCameraStopped() {
    cameraActive.value = false;
    if (sessionState.value !== 'stopped') {
        sessionState.value = 'idle';
    }
}

function onCameraError({ message }) {
    cameraErrorMsg.value = message;
    cameraActive.value = false;
    sessionState.value = 'idle';
}

// Assessment handlers
function startAssessment() {
    assessmentResult.value  = null;

    // Ambil settings dari konfigurasi
    const testName   = props.test.name;
    const duration   = getDuration(testName);
    const cdSec      = getCountdown(testName);

    assessmentDurationSec.value = duration;
    remainingSeconds.value      = duration;

    // Reset semua state
    elapsedSeconds.value    = 0;
    poseStatus.value        = 'searching';
    poseDetectedCount.value = 0;
    poseVisibility.value    = 0;
    resetValidation();
    resetPushUp(); resetSitUp(); resetBalance(); resetWallSit();
    resetPlank(); resetDeepSquat(); resetSquatJump(); resetSitAndReach();
    pushUpCountingSide.value = '—';
    pushUpEvalDiag.value = {
        evaluatorCalled: false, callCount: 0,
        lastLeftOk: false, lastRightOk: false,
        lastRawStatus: '—', lastReason: '—',
        rShoulder: 0, rElbow: 0, rWrist: 0,
        lShoulder: 0, lElbow: 0, lWrist: 0,
        readyCount: 0, posInvalidCount: 0, noBodyCount: 0, bodyDetectedCount: 0,
        consecValidFrames: 0,
    };

    // Install validator sesuai tes
    if (isPushUpTest.value)             installPushUpValidator();
    else if (isSitUpTest.value)         installSitUpValidator();
    else if (isStaticBalanceTest.value) installBalanceValidator();
    else if (isWallSitTest.value)       installWallSitValidator();
    else if (isElbowPlankTest.value)    installPlankValidator();
    else if (isDeepSquatTest.value)     installDeepSquatValidator();
    else if (isSquatJumpTest.value)     installSquatJumpValidator();
    else if (isSitAndReachTest.value)   installSitAndReachValidator();
    else                                uninstallPushUpValidator();

    // ── Countdown then start ──────────────────────────────────────────────
    if (cdSec > 0) {
        isCountingDown.value  = true;
        countdownValue.value  = cdSec;
        sessionState.value    = 'assessing'; // PoseDetector aktif selama countdown

        const VOICES = ['Tiga','Dua','Satu'];
        // Speak first number
        const voiceIdx = VOICES.length - cdSec;
        if (voiceIdx >= 0) speak(VOICES[voiceIdx]);

        countdownInterval = setInterval(() => {
            countdownValue.value--;
            const idx = VOICES.length - countdownValue.value;
            if (countdownValue.value > 0 && idx < VOICES.length) {
                speak(VOICES[idx]);
            }
            if (countdownValue.value <= 0) {
                clearInterval(countdownInterval);
                countdownInterval    = null;
                isCountingDown.value = false;
                speak('Mulai');
                _beginAssessmentTimer();
            }
        }, 1000);
    } else {
        sessionState.value    = 'assessing';
        isCountingDown.value  = false;
        speak('Mulai');
        _beginAssessmentTimer();
    }
}

function _beginAssessmentTimer() {
    elapsedSeconds.value   = 0;
    remainingSeconds.value = assessmentDurationSec.value;
    timerInterval = setInterval(() => {
        elapsedSeconds.value++;
        remainingSeconds.value = Math.max(0, assessmentDurationSec.value - elapsedSeconds.value);
        if (remainingSeconds.value <= 0) {
            // Time up — auto stop
            speak('Waktu selesai.');
            stopAssessment();
        }
    }, 1000);
}

function stopAssessment() {
    clearInterval(timerInterval);
    clearInterval(countdownInterval);
    timerInterval     = null;
    countdownInterval = null;
    isCountingDown.value = false;

    // ── CAPTURE RESULT sebelum reset ─────────────────────────────────────
    const result = captureAssessmentResult();
    assessmentResult.value = result;
    saveResultToLocalStorage(result);

    sessionState.value = 'stopped';
    resetPushUp();
    resetSitUp();
    resetBalance();
    resetWallSit();
    resetPlank();
    resetDeepSquat();
    resetSquatJump();
    resetSitAndReach();
    // PoseDetector akan berhenti otomatis karena :active="sessionState === 'assessing'" → false
}

function restartSession() {
    elapsedSeconds.value    = 0;
    poseStatus.value        = 'searching';
    poseDetectedCount.value = 0;
    poseVisibility.value    = 0;
    resetValidation();
    resetPushUp();
    resetSitUp();
    resetBalance();
    resetWallSit();
    resetPlank();
    resetDeepSquat();
    resetSquatJump();
    resetSitAndReach();
    sessionState.value = cameraActive.value ? 'cameraReady' : 'idle';
}

// ── Pose Detection Handlers ────────────────────────────────────────────────
function onPoseStatus(status) {
    poseStatus.value = status;
}

function onPoseUpdate({ landmarks, detectedCount, totalTarget, visibility }) {
    poseDetectedCount.value = detectedCount  ?? 0;
    poseTotalTarget.value   = totalTarget    ?? 15;
    poseVisibility.value    = visibility     ?? 0;
    processPoseFrame({ landmarks, detectedCount, totalTarget, visibility });
    if (isPushUpTest.value) {
        // Update counting side diagnostic
        if (landmarks && landmarks.length >= 33) {
            const leftOk  = isPushUpSideValid(landmarks, 'left');
            const rightOk = isPushUpSideValid(landmarks, 'right');
            pushUpCountingSide.value = rightOk && leftOk ? 'BOTH'
                                     : rightOk           ? 'RIGHT'
                                     : leftOk            ? 'LEFT'
                                     :                     'NONE';
        }
        processPushUpFrame({
            landmarks,
            validationStatus: validationStatus.value,
        });
    }
    if (isSitUpTest.value) {
        processSitUpFrame({
            landmarks,
            validationStatus: validationStatus.value,
        });
    }
    if (isStaticBalanceTest.value) {
        processBalanceFrame({
            landmarks,
            validationStatus: validationStatus.value,
        });
    }
    if (isWallSitTest.value) {
        processWallSitFrame({
            landmarks,
            validationStatus: validationStatus.value,
        });
    }
    if (isElbowPlankTest.value) {
        processPlankFrame({
            landmarks,
            validationStatus: validationStatus.value,
        });
    }
    if (isDeepSquatTest.value) {
        processDeepSquatFrame({
            landmarks,
            validationStatus: validationStatus.value,
        });
    }
    if (isSquatJumpTest.value) {
        processSquatJumpFrame({
            landmarks,
            validationStatus: validationStatus.value,
        });
    }
    if (isSitAndReachTest.value) {
        // Hard gate: hanya proses saat assessment benar-benar aktif
        if (sessionState.value === 'assessing') {
            processSitAndReachFrame({
                landmarks,
                validationStatus: validationStatus.value,
            });
        }
    }
}

function onPerfUpdate(data) {
    perfData.value = data;
}

function handleBack() {
    stopAllAndClean();
    emit('back');
}

function handleNavigate(page) {
    stopAllAndClean();
    emit('navigate', page);
}

function stopAllAndClean() {
    clearInterval(timerInterval);
    clearInterval(countdownInterval);
    timerInterval     = null;
    countdownInterval = null;
    isCountingDown.value = false;
    cameraRef.value?.stopCamera();
    const video = uploadVideoRef.value;
    if (video && !video.paused) video.pause();
    isAnalyzing.value = false;
    uninstallPushUpValidator();
    uninstallSitUpValidator();
    uninstallBalanceValidator();
    uninstallWallSitValidator();
    uninstallPlankValidator();
    uninstallDeepSquatValidator();
    uninstallSquatJumpValidator();
    uninstallSitAndReachValidator();
    resetSitUp();
    resetBalance();
    resetWallSit();
    resetPlank();
    resetDeepSquat();
    resetSquatJump();
    resetSitAndReach();
}

// Cleanup on unmount
onUnmounted(() => {
    stopAllAndClean();
    // Revoke object URL untuk mencegah memory leak
    if (_prevObjectUrl) {
        URL.revokeObjectURL(_prevObjectUrl);
        _prevObjectUrl = '';
    }
});
</script>

<style scoped>
/* Countdown overlay fade */
.countdown-fade-enter-active, .countdown-fade-leave-active {
    transition: opacity 0.3s ease, transform 0.3s ease;
}
.countdown-fade-enter-from, .countdown-fade-leave-to {
    opacity: 0;
    transform: scale(1.1);
}
</style>
