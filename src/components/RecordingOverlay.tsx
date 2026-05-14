import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useNoteStore } from '../store/useNoteStore';
import { saveAudio } from '../db/database';
import { formatTime } from '../utils/helpers';
import type { AudioRecording } from '../types';
import { v4 as uuid } from 'uuid';

const RecordingOverlay: React.FC = () => {
  const { isRecording, setIsRecording, recordingTime, setRecordingTime } = useAppStore();
  const { activeNote, activePageIndex, addAudioIdToActivePage } = useNoteStore();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isRecording) {
      startRecording();
    }
    return () => {
      stopRecording(false);
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up analyser for waveform
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
        if (activeNote && blob.size > 0) {
          const audio: AudioRecording = {
            id: uuid(),
            noteId: activeNote.id,
            pageIndex: activePageIndex,
            blob,
            duration: recordingTime,
            createdAt: Date.now(),
            x: 100, y: 100,
          };
          await saveAudio(audio);
          addAudioIdToActivePage(audio.id);
        }
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;

      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(useAppStore.getState().recordingTime + 1);
      }, 1000);

      drawWaveform();
    } catch (err) {
      console.error('Mic permission denied:', err);
      setIsRecording(false);
    }
  };

  const stopRecording = (save = true) => {
    if (!save) {
      // Intentionally not saving or doing something with the flag
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsPaused(false);
  };

  const handleStop = () => {
    stopRecording(true);
    setIsRecording(false);
  };

  const handlePause = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      timerRef.current = setInterval(() => {
        setRecordingTime(useAppStore.getState().recordingTime + 1);
      }, 1000);
    } else {
      mediaRecorderRef.current.pause();
      if (timerRef.current) clearInterval(timerRef.current);
    }
    setIsPaused(!isPaused);
  };

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = canvas.width / bufferLength;
      const centerY = canvas.height / 2;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * centerY;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(i * barWidth, centerY - barHeight, barWidth - 1, barHeight * 2);
      }
    };
    draw();
  };

  if (!isRecording) return null;

  return (
    <div className="recording-overlay">
      {/* Red dot */}
      <div className="w-3 h-3 rounded-full bg-white animate-pulse-record" />

      {/* Timer */}
      <span className="text-white font-mono text-sm font-medium">{formatTime(recordingTime)}</span>

      {/* Waveform */}
      <canvas ref={canvasRef} width={120} height={32} className="rounded" />

      {/* Pause button */}
      <button onClick={handlePause} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors">
        {isPaused ? (
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        ) : (
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
        )}
      </button>

      {/* Stop button */}
      <button onClick={handleStop} className="w-8 h-8 flex items-center justify-center rounded-full bg-white hover:bg-white/90 transition-colors">
        <div className="w-3.5 h-3.5 rounded-sm bg-red-500" />
      </button>
    </div>
  );
};

export default RecordingOverlay;
