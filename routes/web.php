<?php

use App\Http\Controllers\WelcomeController;
use Illuminate\Support\Facades\Route;

Route::get('/', [WelcomeController::class, 'index'])->name('welcome');

// Assessment Report — standalone page (no Inertia, no @routes)
Route::get('/report', function () {
    return view('report');
})->name('report');
