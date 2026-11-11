"use client";

import { useState } from "react";
import { db } from "@/lib/storage/db";
import { useRecordings } from "@/hooks/use-recording";

export default function DatabaseTest() {
  const recordings = useRecordings();
  const [message, setMessage] = useState("");

  async function addTestRecording() {
    const id = crypto.randomUUID();

    const recording = {
      id,
      recording_name: "demo-eeg.edf",
      file_blob: new Blob(["DEMO EEG FILE - NOT REAL EEG DATA"], {
        type: "application/octet-stream",
      }),
      file_format: "EDF" as const,
      file_size: 34,
      sampling_rate: 256,
      channel_count: 2,
      channels: ["Fp1-F7", "F7-T7"],
      duration: 60,
      recording_date: new Date(),
      imported_at: new Date(),
      source: "upload" as const,
      quality_status: "unknown" as const,
      screening_status: "imported" as const,
    };

    await db.recordings.add(recording);

    setMessage(`Saved recording: ${id}`);
  }

  async function clearTestData() {
    await db.recordings.clear();
    setMessage("Test recordings cleared.");
  }

  return (
    <main className="min-h-screen bg-[#080B10] p-8 text-white">
      <h1 className="text-2xl font-semibold">NeuroEdge Database Test</h1>

      <p className="mt-2 text-gray-400">Local IndexedDB storage verification</p>

      <div className="my-6 flex gap-3">
        <button
          onClick={addTestRecording}
          className="rounded-lg bg-emerald-500 px-5 py-3 text-black"
        >
          Add Test Recording
        </button>

        <button
          onClick={clearTestData}
          className="rounded-lg border border-gray-700 px-5 py-3"
        >
          Clear Test Data
        </button>
      </div>

      <p className="mb-4 text-emerald-400">{message}</p>

      <h2 className="mb-3 text-lg">Saved Recordings ({recordings.length})</h2>

      <div className="space-y-3">
        {recordings.map((recording) => (
          <div
            key={recording.id}
            className="rounded-xl border border-gray-800 bg-[#111925] p-4"
          >
            <p className="font-medium">{recording.recording_name}</p>

            <p className="mt-1 text-sm text-gray-400">
              {recording.channel_count} channels · {recording.sampling_rate} Hz
              · {recording.duration}s
            </p>

            <p className="mt-2 text-xs text-emerald-400">
              {recording.screening_status}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
