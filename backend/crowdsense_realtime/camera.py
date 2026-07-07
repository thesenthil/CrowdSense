"""
Camera and gender detection module for Crowd Management project.
Optimized for GTX1650 with CUDA support and improved tracking.
"""
import os
import time
import threading
from collections import deque, Counter
import cv2
import numpy as np
import config
from tracker import EuclideanDistTracker

# Define paths
PERSON_PROTOTXT = os.path.join(config.MODELS_DIR, 'MobileNetSSD_deploy.prototxt')
PERSON_MODEL = os.path.join(config.MODELS_DIR, 'MobileNetSSD_deploy.caffemodel')
GENDER_PROTOTXT = os.path.join(config.MODELS_DIR, 'deploy_gender.prototxt')
GENDER_MODEL = os.path.join(config.MODELS_DIR, 'gender_net.caffemodel')

# Face detection paths (DNN)
FACE_PROTOTXT = getattr(config, 'FACE_PROTOTXT', os.path.join(config.MODELS_DIR, 'deploy.prototxt'))
FACE_MODEL = getattr(config, 'FACE_MODEL', os.path.join(config.MODELS_DIR, 'res10_300x300_ssd_iter_140000.caffemodel'))
# Fallback
FACE_CASCADE_PATH = os.path.join(config.MODELS_DIR, 'haarcascade_frontalface_default.xml')

PERSON_CLASS_INDEX = 15
GENDER_LIST = ['Male', 'Female']
MODEL_MEAN_VALUES = (78.4263377603, 87.7689143744, 114.895847746)

# Global lock for thread safety
model_lock = threading.Lock()

def load_model(prototxt, model, use_gpu=True):
    """Load Caffe model and set backend."""
    if not os.path.exists(prototxt) or not os.path.exists(model):
        return None
    try:
        net = cv2.dnn.readNetFromCaffe(prototxt, model)
        if use_gpu and config.USE_GPU:
            print(f"[INFO] Setting CUDA backend for {os.path.basename(model)}")
            net.setPreferableBackend(cv2.dnn.DNN_BACKEND_CUDA)
            net.setPreferableTarget(cv2.dnn.DNN_TARGET_CUDA)
        else:
            net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
            net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
        return net
    except Exception as e:
        print(f"[ERROR] Failed to load model {model}: {e}")
        return None

# Load models
print("[INFO] Loading models...")
person_net = load_model(PERSON_PROTOTXT, PERSON_MODEL)
gender_net = load_model(GENDER_PROTOTXT, GENDER_MODEL)
face_net = load_model(FACE_PROTOTXT, FACE_MODEL)

# Fallback face detector
face_cascade = None
if face_net is None:
    print("[WARNING] DNN Face Detector not found. Falling back to Haarcascade.")
    face_cascade = cv2.CascadeClassifier()
    if not face_cascade.load(FACE_CASCADE_PATH):
        fallback = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        if os.path.exists(fallback):
            face_cascade.load(fallback)

if person_net is None or gender_net is None:
    print("[CRITICAL] Essential models (Person/Gender) missing!")

class VideoCamera:
    def __init__(self, source=None):
        self.source = source if source is not None else config.CAMERA_SOURCE
        self.cap = None
        # Use the improved tracker
        self.tracker = EuclideanDistTracker(max_disappeared=50, max_distance=150)
        self.buffer = deque(maxlen=5)
        self.frame_skip_counter = 0
        self.detection_frame_skip = 2  # Process every 2nd frame
        self.last_detection_counts = {'total': 0, 'male': 0, 'female': 0}
        self.width = config.CAMERA_WIDTH
        self.height = config.CAMERA_HEIGHT

    def open(self):
        if self.cap is not None and self.cap.isOpened():
            return True
        
        if self.cap is not None:
            self.cap.release()
        
        time.sleep(0.2)
        try:
            self.cap = cv2.VideoCapture(int(self.source), cv2.CAP_DSHOW)
            if not self.cap.isOpened():
                self.cap = cv2.VideoCapture(int(self.source))
        except:
            try:
                self.cap = cv2.VideoCapture(self.source)
            except:
                return False
        
        if self.cap is None or not self.cap.isOpened():
            return False
            
        # Optimize camera setting
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
        self.cap.set(cv2.CAP_PROP_FPS, 30)
        
        return True

    def release(self):
        if self.cap is not None:
            if self.cap.isOpened():
                self.cap.release()
            self.cap = None

    def reinitialize(self):
        self.release()
        time.sleep(1.0)
        self.frame_skip_counter = 0
        self.buffer.clear()
        self.last_detection_counts = {'total': 0, 'male': 0, 'female': 0}
        self.tracker = EuclideanDistTracker(max_disappeared=50, max_distance=150)
        return self.open()

    def is_opened(self):
        return self.cap is not None and self.cap.isOpened()

    def _detect_faces_dnn(self, frame, conf_threshold=0.5):
        """Detect faces using ResNet10 SSD."""
        if face_net is None:
            return []
        
        (h, w) = frame.shape[:2]
        blob = cv2.dnn.blobFromImage(frame, 1.0, (300, 300), (104.0, 177.0, 123.0))
        
        with model_lock:
            face_net.setInput(blob)
            detections = face_net.forward()
            
        faces = []
        for i in range(detections.shape[2]):
            confidence = detections[0, 0, i, 2]
            if confidence > config.FACE_CONFIDENCE_THRESHOLD:
                box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
                (startX, startY, endX, endY) = box.astype("int")
                
                # Ensure within bounds
                startX = max(0, startX)
                startY = max(0, startY)
                endX = min(w, endX)
                endY = min(h, endY)
                
                if endX - startX > 10 and endY - startY > 10:
                    faces.append((startX, startY, endX - startX, endY - startY))
        return faces

    def _detect_faces_haar(self, gray_frame):
        """Fallback Haarcascade detection."""
        if face_cascade is None:
            return []
        return face_cascade.detectMultiScale(gray_frame, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))

    def _predict_gender(self, face_roi):
        if face_roi is None or face_roi.size == 0:
            return None, 0.0
        
        try:
            blob = cv2.dnn.blobFromImage(face_roi, 1.0, (227, 227), MODEL_MEAN_VALUES, swapRB=False)
            with model_lock:
                gender_net.setInput(blob)
                preds = gender_net.forward()
            
            idx = preds[0].argmax()
            gender = GENDER_LIST[idx]
            conf = float(preds[0].max())
            return gender, conf
        except:
            return None, 0.0

    def get_frame(self):
        if not self.is_opened():
            try:
                self.open()
                if not self.is_opened():
                    return None, {}
            except:
                return None, {}

        ret, frame = self.cap.read()
        if not ret or frame is None:
            return None, {}

        # Resize for display/processing if too huge (optional, but good for speed)
        # frame = cv2.resize(frame, (1280, 720)) 

        self.frame_skip_counter += 1
        should_detect = (self.frame_skip_counter % self.detection_frame_skip == 0)

        if should_detect:
            (h, w) = frame.shape[:2]
            
            # 1. Person Detection
            blob = cv2.dnn.blobFromImage(cv2.resize(frame, (300, 300)), 0.007843, (300, 300), 127.5)
            with model_lock:
                person_net.setInput(blob)
                detections = person_net.forward()

            rects = []
            
            for i in range(detections.shape[2]):
                confidence = detections[0, 0, i, 2]
                if confidence > config.CONFIDENCE_THRESHOLD:
                    idx = int(detections[0, 0, i, 1])
                    if idx != PERSON_CLASS_INDEX:
                        continue
                        
                    box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
                    (startX, startY, endX, endY) = box.astype("int")
                    
                    # Clamp
                    startX = max(0, startX)
                    startY = max(0, startY)
                    endX = min(w, endX)
                    endY = min(h, endY)
                    
                    person_roi = frame[startY:endY, startX:endX]
                    if person_roi.size == 0:
                        continue

                    # 2. Face Detection on Person ROI
                    # Try DNN first, then Haar
                    faces = []
                    if face_net:
                        faces = self._detect_faces_dnn(person_roi)
                    elif face_cascade:
                        gray_roi = cv2.cvtColor(person_roi, cv2.COLOR_BGR2GRAY)
                        faces = self._detect_faces_haar(gray_roi)
                    
                    gender = 'Unknown'
                    g_conf = 0.0
                    
                    # If faces found, pick the largest one
                    if len(faces) > 0:
                        faces = sorted(faces, key=lambda x: x[2]*x[3], reverse=True)
                        (fx, fy, fw, fh) = faces[0]
                        
                        # Extract face ROI relative to person ROI with PADDING
                        # Padding helps include hair/context which is crucial for gender detection
                        padding_x = int(fw * 0.20) # 20% padding
                        padding_y = int(fh * 0.20)
                        
                        roi_h, roi_w = person_roi.shape[:2]
                        
                        face_x1 = max(0, fx - padding_x)
                        face_y1 = max(0, fy - padding_y)
                        face_x2 = min(roi_w, fx + fw + padding_x)
                        face_y2 = min(roi_h, fy + fh + padding_y)
                        
                        face_roi = person_roi[face_y1:face_y2, face_x1:face_x2]
                        
                        # Filter small faces (noise)
                        if face_roi.shape[0] < 20 or face_roi.shape[1] < 20:
                            continue

                        # 3. Gender Detection
                        g, c = self._predict_gender(face_roi)
                        if g and c > config.GENDER_CONFIDENCE_THRESHOLD:
                            gender = g
                            g_conf = c
                    
                    # Register detection
                    # IMPORTANT: If no face found or gender low confidence, mark as Unknown
                    # This prevents "guessing" gender for bags/fans
                    if gender == 'Unknown':
                         # Optional: Don't register at all if we want strict "Person = Face" rule
                         # For now, register but it won't count towards Male/Female stats
                         pass

                    rects.append({
                        'bbox': (startX, startY, endX-startX, endY-startY),
                        'gender': gender,
                        'confidence': g_conf if gender != 'Unknown' else confidence
                    })
                    
                    # DEBUG: Draw raw detection in RED to see what is being detected before tracking
                    # cv2.rectangle(frame, (startX, startY), (endX, endY), (0, 0, 255), 1)


            # --- Apply Non-Maximum Suppression (NMS) ---
            # This merges overlapping boxes for the same person
            if len(rects) > 0:
                boxes = np.array([r['bbox'] for r in rects])
                # Convert (x, y, w, h) to (x1, y1, x2, y2) for NMS
                boxes_xyxy = boxes.copy()
                boxes_xyxy[:, 2] = boxes_xyxy[:, 0] + boxes_xyxy[:, 2]
                boxes_xyxy[:, 3] = boxes_xyxy[:, 1] + boxes_xyxy[:, 3]
                
                confidences = np.array([r['confidence'] for r in rects])
                
                # Apply NMS
                indices = cv2.dnn.NMSBoxes(boxes_xyxy.tolist(), confidences.tolist(), config.CONFIDENCE_THRESHOLD, 0.4)
                
                if len(indices) > 0:
                    rects = [rects[i] for i in indices.flatten()]
                else:
                    rects = []


            # Update Tracker
            objects = self.tracker.update(rects)
            
            # Count
            male = 0
            female = 0
            
            recent_tracks = {}
            for obj_id, obj in objects.items():
                # Only count if we have a gender or it's a persistent track
                # Filter ghost tracks: require MORE hits to confirm presence
                # Increased from 2 to 10 frames (approx 0.5s) to eliminate flickering ghosts
                if obj['hits'] >= 10: 
                    recent_tracks[obj_id] = obj
                    if obj['gender'] == 'Male':
                        male += 1
                    elif obj['gender'] == 'Female':
                        female += 1
            
            total = male + female
            counts = {'total': total, 'male': male, 'female': female}
            self.last_detection_counts = counts
            
            # Draw
            for obj_id, obj in recent_tracks.items():
                x, y, w, h = obj['bbox']
                gender = obj['gender']
                label = f"ID:{obj_id} {gender}"
                
                color = (0, 255, 0) if gender == 'Male' else (255, 0, 255) if gender == 'Female' else (255, 255, 0)
                
                cv2.rectangle(frame, (x, y), (x+w, y+h), color, 2)
                cv2.putText(frame, label, (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

        else:
            # Just draw last known positions (optional, or just skip drawing)
            # For smooth video, we might want to predict positions, but for now just return last counts
            counts = self.last_detection_counts

        ret2, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        if not ret2:
            return None, counts
            
        return buf.tobytes(), counts
