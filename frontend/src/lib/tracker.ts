export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Track {
  id: number;
  rect: Rect;
  velocity: { dx: number; dy: number };
  missingFrames: number;
}

export class StableTracker {
  private nextId: number = 1;
  private tracks: Map<number, Track> = new Map();
  private maxMissingFrames: number;
  private iouThreshold: number;
  private maxDistance: number;

  constructor(maxMissingFrames = 30, iouThreshold = 0.1, maxDistance = 150) {
    this.maxMissingFrames = maxMissingFrames;
    this.iouThreshold = iouThreshold;
    this.maxDistance = maxDistance;
  }

  private getIoU(r1: Rect, r2: Rect): number {
    const xA = Math.max(r1.x, r2.x);
    const yA = Math.max(r1.y, r2.y);
    const xB = Math.min(r1.x + r1.width, r2.x + r2.width);
    const yB = Math.min(r1.y + r1.height, r2.y + r2.height);
    const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
    if (interArea === 0) return 0;
    const boxAArea = r1.width * r1.height;
    const boxBArea = r2.width * r2.height;
    return interArea / (boxAArea + boxBArea - interArea);
  }

  private getCentroid(r: Rect) {
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }

  update(detections: Rect[]) {
    // 1. Predict next positions for existing tracks based on velocity
    const predictedTracks = new Map<number, Rect>();
    for (const [id, track] of this.tracks.entries()) {
      predictedTracks.set(id, {
        x: track.rect.x + track.velocity.dx,
        y: track.rect.y + track.velocity.dy,
        width: track.rect.width,
        height: track.rect.height,
      });
    }

    const trackIds = Array.from(this.tracks.keys());
    const usedTracks = new Set<number>();
    const usedDetections = new Set<number>();
    const results: { id: number; rect: Rect }[] = [];

    // 2. Create a similarity matrix (Score based on IoU and Distance)
    const matches: { trackId: number; detIdx: number; score: number }[] = [];

    for (let i = 0; i < detections.length; i++) {
      const det = detections[i];
      const detCentroid = this.getCentroid(det);

      for (const id of trackIds) {
        const predRect = predictedTracks.get(id)!;
        const predCentroid = this.getCentroid(predRect);
        
        const iou = this.getIoU(predRect, det);
        const dist = Math.hypot(predCentroid.x - detCentroid.x, predCentroid.y - detCentroid.y);

        let score = 0;
        if (iou > this.iouThreshold) {
          score = 1 + iou; // IoU matches are prioritized (score > 1)
        } else if (dist < this.maxDistance) {
          score = 1 - (dist / this.maxDistance); // Distance matches (score < 1)
        }

        if (score > 0) {
          matches.push({ trackId: id, detIdx: i, score });
        }
      }
    }

    // Sort matches by highest score first
    matches.sort((a, b) => b.score - a.score);

    // 3. Assign detections to tracks
    for (const match of matches) {
      if (usedTracks.has(match.trackId) || usedDetections.has(match.detIdx)) continue;

      usedTracks.add(match.trackId);
      usedDetections.add(match.detIdx);

      const track = this.tracks.get(match.trackId)!;
      const det = detections[match.detIdx];

      // Calculate new velocity (smoothed)
      const oldCentroid = this.getCentroid(track.rect);
      const newCentroid = this.getCentroid(det);
      const currentDx = newCentroid.x - oldCentroid.x;
      const currentDy = newCentroid.y - oldCentroid.y;
      
      track.velocity.dx = track.velocity.dx * 0.5 + currentDx * 0.5;
      track.velocity.dy = track.velocity.dy * 0.5 + currentDy * 0.5;

      // Smooth bounding box (reduce jitter)
      track.rect = {
        x: track.rect.x * 0.2 + det.x * 0.8,
        y: track.rect.y * 0.2 + det.y * 0.8,
        width: track.rect.width * 0.2 + det.width * 0.8,
        height: track.rect.height * 0.2 + det.height * 0.8,
      };
      
      track.missingFrames = 0;
      results.push({ id: match.trackId, rect: track.rect });
    }

    // 4. Register new detections
    for (let i = 0; i < detections.length; i++) {
      if (!usedDetections.has(i)) {
        const id = this.nextId++;
        const det = detections[i];
        this.tracks.set(id, {
          id,
          rect: det,
          velocity: { dx: 0, dy: 0 },
          missingFrames: 0,
        });
        results.push({ id, rect: det });
      }
    }

    // 5. Update missing frames for unmatched tracks
    for (const id of trackIds) {
      if (!usedTracks.has(id)) {
        const track = this.tracks.get(id)!;
        track.missingFrames++;
        
        // Keep returning the predicted rect for a few frames to handle brief occlusions
        if (track.missingFrames <= this.maxMissingFrames) {
           // Apply velocity to keep it moving
           track.rect.x += track.velocity.dx;
           track.rect.y += track.velocity.dy;
           // Slow down velocity over time (friction)
           track.velocity.dx *= 0.8;
           track.velocity.dy *= 0.8;
           
           // Only push to results if it hasn't been missing for too long (e.g., 5 frames)
           // This prevents ghost boxes from lingering too visibly, but keeps the ID alive in memory
           if (track.missingFrames <= 5) {
             results.push({ id: track.id, rect: track.rect });
           }
        } else {
           this.tracks.delete(id);
        }
      }
    }

    // 6. Deduplicate overlapping tracks (Double tracking fix)
    // Sometimes tracks drift into each other or a new track spawns on an old one
    const activeTrackIds = Array.from(this.tracks.keys());
    for (let i = 0; i < activeTrackIds.length; i++) {
      for (let j = i + 1; j < activeTrackIds.length; j++) {
        const id1 = activeTrackIds[i];
        const id2 = activeTrackIds[j];
        const t1 = this.tracks.get(id1);
        const t2 = this.tracks.get(id2);
        if (!t1 || !t2) continue;

        if (this.getIoU(t1.rect, t2.rect) > 0.5) { // If tracks overlap > 50%
          // Keep the older track (lower ID)
          const trackToKeep = id1 < id2 ? id1 : id2;
          const trackToDelete = id1 < id2 ? id2 : id1;
          this.tracks.delete(trackToDelete);
          
          // Remove from results
          const resIdx = results.findIndex(r => r.id === trackToDelete);
          if (resIdx !== -1) results.splice(resIdx, 1);
        }
      }
    }

    return results;
  }

  getTotalUnique() {
    return this.nextId - 1;
  }

  reset() {
    this.nextId = 1;
    this.tracks.clear();
  }
}
