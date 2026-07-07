import React, { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { Upload, Play, Pause, Users, Activity, Video } from 'lucide-react';
import { StableTracker } from './lib/tracker';
import { cn } from './lib/utils';

export default function App() {
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [stats, setStats] = useState({ current: 0, total: 0 });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const trackerRef = useRef<StableTracker>(new StableTracker(30, 0.15, 150));

  // Load the COCO-SSD model on mount
  useEffect(() => {
    const loadModel = async () => {
      try {
        await tf.ready();
        const loadedModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
        setModel(loadedModel);
      } catch (error) {
        console.error("Failed to load model:", error);
      } finally {
        setIsModelLoading(false);
      }
    };
    loadModel();
  }, []);

  // Handle video upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      const url = URL.createObjectURL(file);
      setVideoFile(file);
      setVideoUrl(url);
      setIsPlaying(false);
      trackerRef.current.reset();
      setStats({ current: 0, total: 0 });
      
      // Reset canvas
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  // Main detection loop
  const detectFrame = async () => {
    if (!videoRef.current || !canvasRef.current || !model || videoRef.current.paused || videoRef.current.ended) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Ensure canvas matches video dimensions
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    // Helper for IoU (Intersection over Union)
    const getIoU = (r1: {x: number, y: number, width: number, height: number}, r2: {x: number, y: number, width: number, height: number}) => {
      const xA = Math.max(r1.x, r2.x);
      const yA = Math.max(r1.y, r2.y);
      const xB = Math.min(r1.x + r1.width, r2.x + r2.width);
      const yB = Math.min(r1.y + r1.height, r2.y + r2.height);
      const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
      if (interArea === 0) return 0;
      return interArea / (r1.width * r1.height + r2.width * r2.height - interArea);
    };

    // Run object detection
    const predictions = await model.detect(video);
    
    const frameArea = canvas.width * canvas.height;
    const MAX_BOX_AREA_RATIO = 0.30; // Ignore boxes larger than 30% of the screen
    
    // Filter for people, map to rects, and remove unrealistically large boxes
    const people = predictions
      .filter((p) => p.class === 'person' && p.score > 0.4)
      .map(p => ({
        x: p.bbox[0],
        y: p.bbox[1],
        width: p.bbox[2],
        height: p.bbox[3],
        score: p.score
      }))
      .filter(p => (p.width * p.height) / frameArea < MAX_BOX_AREA_RATIO);

    // Apply strict Non-Maximum Suppression (NMS) to fix double tracking
    const nmsThreshold = 0.4; // If boxes overlap by >40%, treat as the same person
    const rects: {x: number, y: number, width: number, height: number}[] = [];
    
    // Sort by confidence score descending
    people.sort((a, b) => b.score - a.score);
    
    for (const p of people) {
      let isDuplicate = false;
      for (const selected of rects) {
        if (getIoU(p, selected) > nmsThreshold) {
          isDuplicate = true;
          break;
        }
      }
      if (!isDuplicate) {
        rects.push(p);
      }
    }

    // Update tracker
    const trackedObjects = trackerRef.current.update(rects);
    const currentCount = trackedObjects.length;
    const totalCount = trackerRef.current.getTotalUnique();

    const color = '#3b82f6'; // Blue

    // Update stats state
    setStats({ current: currentCount, total: totalCount });

    // Draw on canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    trackedObjects.forEach((obj) => {
      const { x, y, width, height } = obj.rect;
      
      // Draw bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);
      
      // Draw ID label
      ctx.fillStyle = color;
      ctx.fillRect(x, y - 24, 80, 24);
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px Inter, sans-serif';
      ctx.fillText(`Person ${obj.id}`, x + 4, y - 6);
    });

    // Loop
    requestRef.current = requestAnimationFrame(detectFrame);
  };

  // Handle play/pause
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
      } else {
        videoRef.current.play();
        detectFrame();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
              <Activity className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">CrowdSense AI</h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {isModelLoading ? (
              <span className="flex items-center gap-2 text-neutral-400">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                Loading AI Model...
              </span>
            ) : (
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium border border-blue-500/20">
                  <Activity className="w-3.5 h-3.5" />
                  Stable Tracking Active
                </span>
                <span className="flex items-center gap-2 text-green-400">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  Model Ready
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Video & Controls */}
        <div className="lg:col-span-9 flex flex-col gap-4">
          
          {/* Video Container */}
          <div className="relative aspect-video bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden shadow-xl flex items-center justify-center">
            {!videoUrl ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-400 p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center mb-4 transition-transform">
                  <Upload className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-medium text-neutral-200 mb-1">Upload a Video</h3>
                <p className="text-sm max-w-sm">Select an MP4 or WebM file to begin crowd detection and tracking.</p>
                <label className="mt-6 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-medium cursor-pointer transition-colors">
                  Browse Files
                  <input type="file" accept="video/mp4,video/webm" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="absolute inset-0 w-full h-full object-contain"
                  playsInline
                  muted
                  onEnded={() => setIsPlaying(false)}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                />
              </>
            )}
          </div>

          {/* Dedicated Control Bar below video */}
          {videoUrl && (
            <div className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-4">
                <button
                  onClick={togglePlay}
                  disabled={isModelLoading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-white text-black rounded-lg font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" /> Play
                    </>
                  )}
                </button>
                <div className="text-sm text-neutral-400">
                  {isPlaying ? "Analyzing live frames..." : "Paused"}
                </div>
              </div>
              
              <label className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-lg cursor-pointer transition-colors">
                <Video className="w-4 h-4" />
                Change Video
                <input type="file" accept="video/mp4,video/webm" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          )}
        </div>

        {/* Right Column: Compact Stats Panel */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl">
            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Live Analytics
            </h2>
            
            <div className="flex flex-col gap-4">
              {/* Current Count */}
              <div className="flex items-center justify-between p-3 bg-neutral-950 rounded-lg border border-neutral-800/50">
                <div className="flex items-center gap-2 text-neutral-400">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">Current Crowd</span>
                </div>
                <span className="text-lg font-semibold text-white">
                  {stats.current}
                </span>
              </div>

              {/* Total Unique */}
              <div className="flex items-center justify-between p-3 bg-neutral-950 rounded-lg border border-neutral-800/50">
                <div className="flex items-center gap-2 text-neutral-400">
                  <Activity className="w-4 h-4" />
                  <span className="text-sm">Total Unique</span>
                </div>
                <span className="text-lg font-semibold text-blue-400">
                  {stats.total}
                </span>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
