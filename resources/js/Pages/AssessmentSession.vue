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

            <!-- Mode selector — hanya tampil untuk Push Up test -->
            <template v-if="isPushUpTest">
                <div class="col-span-full mb-2">
                    <div class="flex items-center gap-1 p-1 rounded-xl bg-dark-800 border border-white/5 w-fit">
                        <button
                            @click="switchMode('camera')"
                            :class="[
                                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200',
                                assessmentMode === 'camera'
                                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20'
                                    : 'text-slate-400 hover:text-white'
                            ]"
                        >
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.362a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                            </svg>
                            Realtime Camera
                        </button>
                        <button
                            @click="switchMode('upload')"
                            :class="[
                                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200',
                                assessmentMode === 'upload'
                                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                                    : 'text-slate-400 hover:text-white'
                            ]"
                        >
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"/>
                            </svg>
                            Upload Video
                        </button>
                    </div>
                </div>
            </template>

            <!-- Camera area (2/3 width) -->
            <div class="lg:col-span-2">

                <!-- ── MODE: REALTIME CAMERA ── -->
                <template v-if="assessmentMode === 'camera'">
                <CameraPreview
                    ref="cameraRef"
                    :is-assessing="sessionState === 'assessing'"
                    :elapsed-seconds="elapsedSeconds"
                    @camera-ready="onCameraReady"
                    @camera-stopped="onCameraStopped"
                    @camera-error="onCameraError"
                >
                    <!-- Slot overlay: PoseDetector canvas ditumpuk di atas video -->
                    <template #overlay>
                        <PoseDetector
                            :video-element="activeVideoElement"
                            :active="sessionState === 'assessing'"
                            @pose-status="onPoseStatus"
                            @pose-update="onPoseUpdate"
                            @perf-update="onPerfUpdate"
                        />
                    </template>
                </CameraPreview>

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

                <!-- ── MODE: UPLOAD VIDEO ── -->
                <template v-if="assessmentMode === 'upload'">

                    <!-- Video preview area -->
                    <div class="relative w-full rounded-2xl overflow-hidden bg-dark-950 border border-white/10"
                         style="aspect-ratio: 16/9;">

                        <!-- Video element (hidden src saat tidak ada file) -->
                        <video
                            ref="uploadVideoRef"
                            class="w-full h-full object-contain bg-dark-950"
                            :class="{ 'opacity-0': !uploadObjectUrl }"
                            :src="uploadObjectUrl || undefined"
                            playsinline
                            muted
                            preload="metadata"
                            @loadedmetadata="onUploadVideoMetadataLoaded"
                            @timeupdate="onUploadVideoTimeUpdate"
                            @ended="onUploadVideoEnded"
                        ></video>

                        <!-- PoseDetector overlay on upload video -->
                        <PoseDetector
                            v-if="uploadObjectUrl"
                            :video-element="activeVideoElement"
                            :active="isAnalyzing"
                            @pose-status="onPoseStatus"
                            @pose-update="onPoseUpdate"
                            @perf-update="onPerfUpdate"
                            class="absolute inset-0 w-full h-full pointer-events-none"
                            style="z-index: 10;"
                        />

                        <!-- Placeholder: belum ada file -->
                        <div v-if="!uploadObjectUrl"
                             class="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-dark-950">
                            <div class="w-16 h-16 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                                <svg class="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"/>
                                </svg>
                            </div>
                            <div class="text-center px-4">
                                <p class="text-white font-semibold text-sm mb-1">Upload Video Push Up</p>
                                <p class="text-slate-500 text-xs">Pilih file video MP4, WebM, atau MOV</p>
                            </div>
                        </div>

                        <!-- Analyzing indicator -->
                        <div v-if="isAnalyzing"
                             class="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-violet-600/80 backdrop-blur-sm border border-violet-500/30">
                            <span class="relative flex h-2 w-2">
                                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                <span class="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                            </span>
                            <span class="text-white text-xs font-bold tracking-wider uppercase">Menganalisis</span>
                            <span class="text-violet-200 text-xs font-mono font-bold">{{ analysisProgress }}%</span>
                        </div>

                        <!-- File info overlay -->
                        <div v-if="uploadObjectUrl && !isAnalyzing"
                             class="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/10">
                            <span class="text-slate-300 text-xs font-medium truncate max-w-[180px] block">🎥 {{ uploadFileName }}</span>
                        </div>
                        <div v-if="uploadDuration > 0"
                             class="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/10">
                            <span class="text-slate-300 text-xs font-mono">{{ uploadDurationFormatted }}</span>
                        </div>
                    </div>

                    <!-- Upload controls -->
                    <div class="mt-4 space-y-3">

                        <!-- Progress bar (saat analisis berjalan) -->
                        <div v-if="isAnalyzing" class="space-y-1.5">
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-400">Menganalisis video...</span>
                                <span class="text-xs font-mono font-bold text-violet-400">{{ analysisProgress }}%</span>
                            </div>
                            <div class="w-full h-2 rounded-full bg-dark-800 overflow-hidden">
                                <div class="h-full rounded-full bg-violet-500 transition-all duration-300"
                                     :style="{ width: `${analysisProgress}%` }"></div>
                            </div>
                            <p class="text-xs text-slate-500">Waktu: {{ elapsedFormatted }}</p>
                        </div>

                        <!-- Pilih file + Mulai Analisis -->
                        <div class="flex items-center gap-3" v-if="!isAnalyzing">

                            <!-- Input file (tersembunyi, dipicu via label) -->
                            <input
                                id="upload-video-input"
                                type="file"
                                accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                                class="hidden"
                                @change="onFileSelected"
                            />
                            <label
                                for="upload-video-input"
                                class="flex items-center gap-2 px-4 py-3 rounded-xl bg-dark-800 hover:bg-dark-700 border border-white/5 hover:border-white/10 text-slate-300 hover:text-white text-sm font-medium cursor-pointer transition-all duration-200"
                            >
                                <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                                </svg>
                                {{ uploadFileName || 'Pilih Video' }}
                            </label>

                            <!-- Mulai Analisis -->
                            <button
                                v-if="uploadReady && !analysisComplete"
                                @click="startVideoAnalysis"
                                class="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl
                                       bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm
                                       transition-all duration-200 shadow-lg shadow-violet-500/25"
                            >
                                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                                Mulai Analisis
                            </button>

                            <!-- Analisis lagi setelah selesai -->
                            <button
                                v-if="analysisComplete"
                                @click="startVideoAnalysis"
                                class="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl
                                       bg-dark-800 hover:bg-dark-700 border border-white/5 text-slate-300 hover:text-white text-sm font-semibold
                                       transition-all duration-200"
                            >
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                                </svg>
                                Analisis Ulang
                            </button>
                        </div>

                        <!-- Stop Analisis -->
                        <button
                            v-if="isAnalyzing"
                            @click="stopVideoAnalysis"
                            class="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl
                                   bg-red-600 hover:bg-red-500 text-white font-bold text-sm
                                   transition-all duration-200 animate-pulse"
                        >
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                <path stroke-linecap="round" stroke-linejoin="round" d="M9 10h6v4H9z"/>
                            </svg>
                            Stop Analisis
                        </button>
                    </div>
                </template>
                <!-- ── END MODE: UPLOAD VIDEO ── -->

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

                <!-- Analysis Result card (upload mode, setelah analisis selesai) -->
                <div v-if="assessmentMode === 'upload' && analysisComplete && analysisResult"
                     class="card p-5 border-violet-500/20 bg-violet-500/5">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-xs font-semibold text-violet-400 uppercase tracking-wider">Hasil Analisis</h3>
                        <span class="text-xs font-mono bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded">✓ Selesai</span>
                    </div>

                    <!-- Repetisi besar -->
                    <div class="flex items-center justify-between mb-4 p-3 rounded-xl bg-dark-900/60 border border-white/5">
                        <span class="text-xs text-slate-500">Repetisi Terdeteksi</span>
                        <span class="text-4xl font-black text-white font-mono leading-none">{{ analysisResult.repetitions }}</span>
                    </div>

                    <div class="space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Input Source</span>
                            <span class="text-xs font-medium text-violet-400">🎥 Uploaded Video</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Durasi Video</span>
                            <span class="text-xs font-mono text-white">{{ uploadDurationFormatted }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Frames Diproses</span>
                            <span class="text-xs font-mono text-slate-400">{{ analysisResult.totalFrames }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Avg FPS</span>
                            <span class="text-xs font-mono"
                                  :class="analysisResult.avgFps >= 15 ? 'text-emerald-400' : analysisResult.avgFps >= 8 ? 'text-yellow-400' : 'text-red-400'">
                                {{ analysisResult.avgFps > 0 ? `${analysisResult.avgFps} fps` : '—' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-500">Avg Visibility</span>
                            <span class="text-xs font-mono text-slate-400">{{ analysisResult.avgVisibility }}%</span>
                        </div>
                        <div class="border-t border-white/5 pt-2 mt-2 space-y-2">
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-500">DOWN Reached</span>
                                <span class="text-xs font-mono font-bold"
                                      :class="analysisResult.downEverReached ? 'text-emerald-400' : 'text-red-400'">
                                    {{ analysisResult.downEverReached ? 'YES ✓' : 'NO ✗' }}
                                </span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-500">UP after DOWN</span>
                                <span class="text-xs font-mono font-bold"
                                      :class="analysisResult.upAfterDown ? 'text-emerald-400' : 'text-red-400'">
                                    {{ analysisResult.upAfterDown ? 'YES ✓' : 'NO ✗' }}
                                </span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-500">Successful Cycles</span>
                                <span class="text-xs font-mono text-emerald-400 font-bold">{{ analysisResult.successCycles }}</span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-500">Failed Cycles</span>
                                <span class="text-xs font-mono"
                                      :class="analysisResult.failedCycles > 0 ? 'text-red-400' : 'text-slate-500'">
                                    {{ analysisResult.failedCycles }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Input Source indicator di debug panel (append ke Section 2) -->

                <!-- DEBUG PANEL — hanya tampil saat PUSHUP_DEBUG = true & Push Up assessing -->
                <div v-if="PUSHUP_DEBUG && isPushUpTest && (sessionState === 'assessing' || (assessmentMode === 'upload' && analysisComplete))"
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
                            <span class="text-xs font-mono font-bold"
                                  :class="assessmentMode === 'upload' ? 'text-violet-400' : 'text-cyan-400'">
                                {{ assessmentMode === 'upload' ? '🎥 Uploaded Video' : '📷 Realtime Camera' }}
                            </span>
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
const props = defineProps({
    currentPage: { type: String, default: 'assessment' },
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
// PoseDetector menerima prop ini — tidak peduli apakah dari kamera atau upload.
const activeVideoElement = computed(() => {
    if (assessmentMode.value === 'upload') {
        return uploadVideoRef.value;
    }
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
    uninstallPushUpValidator();
    uninstallSitUpValidator();
    uninstallBalanceValidator();
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

let timerInterval = null;

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
    sessionState.value = 'assessing';
    elapsedSeconds.value = 0;
    poseStatus.value        = 'searching';
    poseDetectedCount.value = 0;
    poseVisibility.value    = 0;
    resetValidation();
    resetPushUp();
    resetSitUp();
    resetBalance();
    pushUpCountingSide.value = '—';

    // Reset evaluator trace diagnostic (sama seperti startVideoAnalysis)
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
    if (isPushUpTest.value)           installPushUpValidator();
    else if (isSitUpTest.value)       installSitUpValidator();
    else if (isStaticBalanceTest.value) installBalanceValidator();
    else                              uninstallPushUpValidator(); // pastikan tidak ada evaluator tersisa
    timerInterval = setInterval(() => {
        elapsedSeconds.value++;
    }, 1000);
}

function stopAssessment() {
    clearInterval(timerInterval);
    timerInterval = null;
    sessionState.value = 'stopped';
    resetPushUp();
    resetSitUp();
    resetBalance();
    // PoseDetector akan berhenti otomatis karena :active="sessionState === 'assessing'" → false
}

function restartSession() {
    elapsedSeconds.value    = 0;
    poseStatus.value        = 'searching';
    poseDetectedCount.value = 0;
    poseVisibility.value    = 0;
    resetValidation();
    resetPushUp();
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
    timerInterval = null;
    cameraRef.value?.stopCamera();
    const video = uploadVideoRef.value;
    if (video && !video.paused) video.pause();
    isAnalyzing.value = false;
    uninstallPushUpValidator();
    uninstallSitUpValidator();
    uninstallBalanceValidator();
    resetSitUp();
    resetBalance();
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
