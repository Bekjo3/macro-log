"use client";

import { useState, useEffect, useRef } from "react";

interface ParsedWorkout {
  date: string;
  workoutType: string;
  activeCalories: number;
  totalCalories: number;
  durationMinutes: number;
  avgHeartRate: number | null;
  totalVolumeKg?: number | null;
  muscleGroups?: string | null;
  rawSummary: string;
}

interface WorkoutLogItem {
  id: number;
  date: string;
  workoutType: string;
  activeCalories: number;
  totalCalories: number;
  durationMinutes: number;
  avgHeartRate: number | null;
  totalVolumeKg?: number | null;
  muscleGroups?: string | null;
  rawSummary: string;
}

interface AttachedImage {
  id: string;
  file: File;
  previewUrl: string;
}

export default function WorkoutsPage() {
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedWorkout | null>(null);
  const [history, setHistory] = useState<WorkoutLogItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchWorkouts();
  }, []);

  async function fetchWorkouts() {
    setIsLoadingHistory(true);
    try {
      const res = await fetch("/api/workouts");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.workouts || []);
      }
    } catch (err) {
      console.error("Failed to fetch workouts:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }

  function addFiles(files: FileList | File[]) {
    const validImages: AttachedImage[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith("image/")) {
        validImages.push({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }
    }

    if (validImages.length === 0) {
      setError("Please select image files (PNG, JPG, WEBP, or HEIC).");
      return;
    }

    setError(null);
    setStatusMessage(null);
    setParsedResult(null);
    setAttachedImages((prev) => [...prev, ...validImages]);
  }

  function removeImage(id: string) {
    setAttachedImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((img) => img.id !== id);
    });
    setParsedResult(null);
  }

  function clearAllImages() {
    attachedImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setAttachedImages([]);
    setParsedResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;

    const pastedFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) pastedFiles.push(file);
      }
    }
    if (pastedFiles.length > 0) {
      addFiles(pastedFiles);
    }
  }

  async function handleAnalyzeScreenshots() {
    if (attachedImages.length === 0) return;

    setIsAnalyzing(true);
    setError(null);
    setStatusMessage(null);

    const formData = new FormData();
    attachedImages.forEach((img) => {
      formData.append("files", img.file);
    });
    formData.append("save", "false");

    try {
      const res = await fetch("/api/workouts/parse-screenshot?save=false", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze screenshots.");
      }

      setParsedResult(data.parsed);
      setStatusMessage(
        attachedImages.length > 1
          ? `Extracted across all ${attachedImages.length} screenshots.`
          : "Extracted workout metrics successfully."
      );
    } catch (err: unknown) {
      const errorMsg = (err as Error).message;
      setError(errorMsg);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleSaveWorkout() {
    if (!parsedResult) return;

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedResult),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save workout.");
      }

      setStatusMessage(`Saved ${parsedResult.workoutType} to your log.`);
      clearAllImages();
      await fetchWorkouts();
    } catch (err: unknown) {
      const errorMsg = (err as Error).message;
      setError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteWorkout(id: number) {
    if (!confirm("Remove this workout from your log?")) return;

    try {
      const res = await fetch(`/api/workouts?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setHistory((prev) => prev.filter((item) => item.id !== id));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete workout.");
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }

  const totalActiveBurn = history.reduce((sum, w) => sum + w.activeCalories, 0);
  const totalMinutes = history.reduce((sum, w) => sum + w.durationMinutes, 0);

  return (
    <div className="space-y-8 sm:space-y-12" onPaste={handlePaste}>
      {/* Header */}
      <div className="space-y-1.5 border-b border-zinc-200 dark:border-zinc-800 pb-4 sm:pb-5">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Workouts
        </h1>
        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl leading-relaxed">
          Upload workout summary screenshots from your fitness app (Apple Fitness, Garmin, Strava, etc.). Multi-screenshot uploads combine scrolled stats like heart rate and splits.
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-start justify-between dark:bg-red-950/40 dark:border-red-900/60 dark:text-red-300">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-xs font-medium underline ml-3 flex-shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {statusMessage && (
        <div className="p-3.5 rounded-lg bg-zinc-100 border border-zinc-200 text-zinc-800 text-xs sm:text-sm flex items-center justify-between dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200">
          <span>{statusMessage}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs font-medium underline ml-3 flex-shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Upload & Parsed Output Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* Screenshot Intake Column */}
        <div className="lg:col-span-6 space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs sm:text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Screenshot intake
            </h2>
            {attachedImages.length > 0 && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {attachedImages.length} {attachedImages.length === 1 ? "screenshot" : "screenshots"}
              </span>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                addFiles(e.target.files);
              }
            }}
          />

          {attachedImages.length === 0 ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors bg-white dark:bg-zinc-900 touch-manipulation min-h-[180px]"
            >
              <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-2.5 text-zinc-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Tap to choose screenshot(s) or drag here
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Select from photo library or paste directly
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Image previews grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                {attachedImages.map((img, idx) => (
                  <div
                    key={img.id}
                    className="relative rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 aspect-[3/4] flex items-center justify-center group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.previewUrl}
                      alt={`Workout screenshot ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-mono">
                      #{idx + 1}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(img.id);
                      }}
                      title="Remove image"
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center text-xs transition-opacity touch-manipulation"
                    >
                      &times;
                    </button>
                  </div>
                ))}

                {/* Add more button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 aspect-[3/4] flex flex-col items-center justify-center text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors bg-white dark:bg-zinc-900 touch-manipulation min-h-[44px]"
                >
                  <span className="text-xl leading-none mb-1">+</span>
                  <span className="text-xs font-medium">Add more</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                <button
                  onClick={handleAnalyzeScreenshots}
                  disabled={isAnalyzing}
                  className="w-full sm:flex-1 py-2.5 px-4 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 min-h-[44px] flex items-center justify-center"
                >
                  {isAnalyzing
                    ? `Extracting from ${attachedImages.length} screenshot${attachedImages.length > 1 ? "s" : ""}...`
                    : `Extract workout data (${attachedImages.length})`}
                </button>

                <button
                  onClick={clearAllImages}
                  disabled={isAnalyzing}
                  className="py-2.5 px-3 text-xs sm:text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 font-medium text-center min-h-[44px]"
                >
                  Clear all
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Parsed Result Column */}
        <div className="lg:col-span-6 space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs sm:text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Extracted metrics
            </h2>
            {parsedResult && (
              <span className="text-xs font-mono text-zinc-500">
                {parsedResult.date}
              </span>
            )}
          </div>

          {!parsedResult ? (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 sm:p-8 text-center text-zinc-400 dark:text-zinc-600 min-h-[180px] sm:min-h-[220px] flex flex-col items-center justify-center bg-white dark:bg-zinc-900">
              <p className="text-sm">No workout extracted yet</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                Upload your screenshot(s) and tap extract to review the parsed metrics here.
              </p>
            </div>
          ) : (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-6 bg-white dark:bg-zinc-900 space-y-4 sm:space-y-6">
              <div>
                <span className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 block">
                  Activity
                </span>
                <p className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                  {parsedResult.workoutType}
                </p>
                {parsedResult.muscleGroups && (
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-0.5">
                    Targeted: <span className="font-medium text-zinc-900 dark:text-white">{parsedResult.muscleGroups}</span>
                    {parsedResult.totalVolumeKg ? ` • ${parsedResult.totalVolumeKg.toLocaleString()} kg volume` : ""}
                  </p>
                )}
              </div>

              {/* Metric grid */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/40">
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block">
                    Active burn
                  </span>
                  <p className="text-lg sm:text-xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 mt-0.5">
                    {parsedResult.activeCalories}{" "}
                    <span className="text-xs font-normal text-zinc-500">kcal</span>
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/40">
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block">
                    Total burn
                  </span>
                  <p className="text-lg sm:text-xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 mt-0.5">
                    {parsedResult.totalCalories}{" "}
                    <span className="text-xs font-normal text-zinc-500">kcal</span>
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/40">
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block">
                    Duration
                  </span>
                  <p className="text-lg sm:text-xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 mt-0.5">
                    {parsedResult.durationMinutes}{" "}
                    <span className="text-xs font-normal text-zinc-500">min</span>
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/40">
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block">
                    Avg heart rate
                  </span>
                  <p className="text-lg sm:text-xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 mt-0.5">
                    {parsedResult.avgHeartRate ? `${parsedResult.avgHeartRate} ` : "— "}
                    <span className="text-xs font-normal text-zinc-500">bpm</span>
                  </p>
                </div>
              </div>

              {parsedResult.rawSummary && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  {parsedResult.rawSummary}
                </p>
              )}

              {/* Confirmation Actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2">
                <button
                  onClick={handleSaveWorkout}
                  disabled={isSaving}
                  className="w-full sm:flex-1 py-2.5 px-4 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 min-h-[44px] flex items-center justify-center"
                >
                  {isSaving ? "Saving..." : "Save workout"}
                </button>
                <button
                  onClick={() => setParsedResult(null)}
                  disabled={isSaving}
                  className="py-2.5 px-3 text-xs sm:text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 font-medium text-center min-h-[44px]"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Workout History */}
      <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1.5">
          <div>
            <h2 className="text-base sm:text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Workout log
            </h2>
            <p className="text-xs text-zinc-500">
              Historical entries extracted from verified screenshots
            </p>
          </div>

          {history.length > 0 && (
            <div className="flex items-center gap-2 sm:gap-3 text-xs text-zinc-600 dark:text-zinc-400 font-medium flex-wrap">
              <span>{history.length} {history.length === 1 ? "workout" : "workouts"}</span>
              <span>&bull;</span>
              <span>{totalActiveBurn.toLocaleString()} kcal active</span>
              <span>&bull;</span>
              <span>{totalMinutes} min active</span>
            </div>
          )}
        </div>

        {/* Empty state */}
        {isLoadingHistory ? (
          <div className="py-10 text-center text-sm text-zinc-500 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900">
            Loading workouts...
          </div>
        ) : history.length === 0 ? (
          <div className="py-12 px-4 text-center space-y-1 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              No workouts recorded yet
            </p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Upload one or more workout summary screenshots above to parse your active energy.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile-optimized Card List (iPhone & small screens) */}
            <div className="sm:hidden space-y-2.5">
              {history.map((workout) => (
                <div
                  key={workout.id}
                  className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm text-zinc-950 dark:text-zinc-100">
                        {workout.workoutType}
                      </p>
                      <p className="text-[11px] font-mono text-zinc-500">
                        {workout.date}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteWorkout(workout.id)}
                      className="text-xs text-red-600 hover:text-red-700 py-1 px-2 -mr-1"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/80 text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-400 block">Active</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {workout.activeCalories} kcal
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 block">Duration</span>
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        {workout.durationMinutes} min
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 block">Avg HR</span>
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        {workout.avgHeartRate ? `${workout.avgHeartRate} bpm` : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 dark:bg-zinc-950/60 text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="py-3 px-4 font-medium">Date</th>
                      <th className="py-3 px-4 font-medium">Activity</th>
                      <th className="py-3 px-4 font-medium">Active burn</th>
                      <th className="py-3 px-4 font-medium">Total burn</th>
                      <th className="py-3 px-4 font-medium">Duration</th>
                      <th className="py-3 px-4 font-medium">Avg HR</th>
                      <th className="py-3 px-4 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {history.map((workout) => (
                      <tr
                        key={workout.id}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                          {workout.date}
                        </td>
                        <td className="py-3 px-4 font-medium text-zinc-950 dark:text-zinc-100">
                          {workout.workoutType}
                        </td>
                        <td className="py-3 px-4 font-medium text-zinc-950 dark:text-zinc-100">
                          {workout.activeCalories}{" "}
                          <span className="text-xs font-normal text-zinc-500">kcal</span>
                        </td>
                        <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                          {workout.totalCalories}{" "}
                          <span className="text-xs font-normal text-zinc-500">kcal</span>
                        </td>
                        <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300">
                          {workout.durationMinutes} min
                        </td>
                        <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                          {workout.avgHeartRate ? `${workout.avgHeartRate} bpm` : "—"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDeleteWorkout(workout.id)}
                            className="text-xs text-red-600 hover:text-red-700 font-medium"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
