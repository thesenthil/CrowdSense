import numpy as np
from collections import OrderedDict
import time

class EuclideanDistTracker:
    def __init__(self, max_disappeared=40, max_distance=50):
        self.next_object_id = 0
        self.objects = OrderedDict()
        self.disappeared = OrderedDict()
        self.max_disappeared = max_disappeared
        self.max_distance = max_distance
        self.history = OrderedDict()  # Store history of centroids for smoothing

    def register(self, centroid, bbox, gender, confidence):
        self.objects[self.next_object_id] = {
            'centroid': centroid,
            'bbox': bbox,
            'gender': gender,
            'confidence': confidence,
            'gender_history': [gender],
            'hits': 1
        }
        self.disappeared[self.next_object_id] = 0
        self.history[self.next_object_id] = [centroid]
        self.next_object_id += 1

    def deregister(self, object_id):
        del self.objects[object_id]
        del self.disappeared[object_id]
        del self.history[object_id]

    def update(self, rects):
        # rects: list of {'bbox': (x, y, w, h), 'gender': str, 'confidence': float}
        if len(rects) == 0:
            for object_id in list(self.disappeared.keys()):
                self.disappeared[object_id] += 1
                if self.disappeared[object_id] > self.max_disappeared:
                    self.deregister(object_id)
            return self.objects

        input_centroids = np.zeros((len(rects), 2), dtype="int")
        for (i, rect) in enumerate(rects):
            (x, y, w, h) = rect['bbox']
            cX = int(x + w / 2.0)
            cY = int(y + h / 2.0)
            input_centroids[i] = (cX, cY)

        if len(self.objects) == 0:
            for i in range(0, len(rects)):
                self.register(input_centroids[i], rects[i]['bbox'], rects[i]['gender'], rects[i]['confidence'])
        else:
            object_ids = list(self.objects.keys())
            object_centroids = [obj['centroid'] for obj in self.objects.values()]

            D = self._dist(np.array(object_centroids), input_centroids)
            rows = D.min(axis=1).argsort()
            cols = D.argmin(axis=1)[rows]

            used_rows = set()
            used_cols = set()

            for (row, col) in zip(rows, cols):
                if row in used_rows or col in used_cols:
                    continue

                if D[row, col] > self.max_distance:
                    continue

                object_id = object_ids[row]
                self.objects[object_id]['centroid'] = input_centroids[col]
                self.objects[object_id]['bbox'] = rects[col]['bbox']
                
                # Update gender with voting
                if rects[col]['gender'] != 'Unknown':
                    self.objects[object_id]['gender_history'].append(rects[col]['gender'])
                    if len(self.objects[object_id]['gender_history']) > 20:
                        self.objects[object_id]['gender_history'].pop(0)
                    
                    # Majority vote
                    from collections import Counter
                    counts = Counter(self.objects[object_id]['gender_history'])
                    self.objects[object_id]['gender'] = counts.most_common(1)[0][0]
                
                # Update confidence (keep max)
                self.objects[object_id]['confidence'] = max(self.objects[object_id]['confidence'], rects[col]['confidence'])
                self.objects[object_id]['hits'] += 1
                
                self.disappeared[object_id] = 0
                used_rows.add(row)
                used_cols.add(col)

            unused_rows = set(range(0, D.shape[0])).difference(used_rows)
            unused_cols = set(range(0, D.shape[1])).difference(used_cols)

            for row in unused_rows:
                object_id = object_ids[row]
                self.disappeared[object_id] += 1
                if self.disappeared[object_id] > self.max_disappeared:
                    self.deregister(object_id)

            for col in unused_cols:
                self.register(input_centroids[col], rects[col]['bbox'], rects[col]['gender'], rects[col]['confidence'])

        return self.objects

    def _dist(self, a, b):
        return np.linalg.norm(a[:, None, :] - b[None, :, :], axis=2)
