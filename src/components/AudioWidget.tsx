import React, { useState, useRef, useEffect } from 'react';
import { getAudio, deleteAudio, saveAudio } from '../db/database';
import { formatTime } from '../utils/helpers';
import type { AudioRecording } from '../types';

interface Props {
  audioId: string;
  onDelete?: () => void;
}

const AudioWidget: React.FC<Props> = ({ audioId, onDelete }) => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [pos, setPos] = useState({ x: 100, y: 100 });
  const [audioObj, setAudioObj] = useState<AudioRecording | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    getAudio(audioId).then(audio => {
      if (audio) {
        setAudioObj(audio);
        setPos({ x: audio.x, y: audio.y });
        const url = URL.createObjectURL(audio.blob);
        setAudioUrl(url);
        setDuration(audio.duration);
      }
    });
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioId]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleDelete = async () => {
    await deleteAudio(audioId);
    onDelete?.();
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    isDragging.current = true;
    dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    // set pointer capture
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    setPos({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handlePointerUp = async (e: React.PointerEvent) => {
    isDragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (audioObj) {
      const updated = { ...audioObj, x: pos.x, y: pos.y };
      setAudioObj(updated);
      await saveAudio(updated);
    }
  };

  if (!audioUrl) return null;

  return (
    <div
      className="audio-widget flex items-center gap-2 p-2 rounded-xl shadow-lg border"
      style={{
        position: 'absolute',
        zIndex: 20,
        left: pos.x,
        top: pos.y,
        background: 'var(--color-bg)',
        borderColor: 'var(--color-border)',
        minWidth: '220px',
        cursor: isDragging.current ? 'grabbing' : 'grab',
        touchAction: 'none'
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => { if (audioRef.current) setDuration(audioRef.current.duration); }}
        onEnded={handleEnded}
      />

      {/* Play/Pause */}
      <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
        style={{background: 'var(--color-accent)', color: 'white'}}>
        {isPlaying ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
        ) : (
          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        )}
      </button>

      <div className="flex-1 min-w-0" onPointerDown={(e) => e.stopPropagation()}>
        {/* Seek bar */}
        <input
          type="range" min={0} max={duration || 1} step={0.1} value={currentTime}
          onChange={handleSeek} className="w-full"
        />
        <div className="flex justify-between mt-0.5">
          <span className="text-[10px] font-mono" style={{color:'var(--color-text-secondary)'}}>{formatTime(currentTime)}</span>
          <span className="text-[10px] font-mono" style={{color:'var(--color-text-secondary)'}}>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Delete */}
      <button onClick={(e) => { e.stopPropagation(); handleDelete(); }} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-500/20 transition-colors"
        style={{color: 'var(--color-text-secondary)'}}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export default AudioWidget;

