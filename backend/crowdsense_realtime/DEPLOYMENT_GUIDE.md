# Crowd Sense Detection System - Upgrade & Deployment Guide

## 1. Analysis Report

### Identified Bottlenecks & Issues
1.  **Inference Lag**: The original system ran MobileNetSSD (Person) -> Haarcascade (Face) -> Caffe (Gender) sequentially on the CPU. Haarcascade is particularly slow on high-resolution images.
2.  **Resource Contention**: The Flask application was reading from the camera in two separate threads (`background_thread` and `/video_feed`), causing race conditions, dropped frames, and increased latency.
3.  **Ghost Counts**: The `SimpleTracker` was distance-based but lacked robustness against detection flickering, leading to new IDs being assigned when a detection was missed for a few frames.
4.  **Gender Inaccuracy**: Single-frame prediction is noisy. If a face is at an angle, the model might flip prediction.

### Improvements Implemented
1.  **CUDA Acceleration**: Enabled `cv2.dnn.DNN_TARGET_CUDA` for all models. This offloads heavy matrix operations to the GTX1650.
2.  **Modern Face Detection**: Replaced Haarcascade with a ResNet10 SSD (Deep Learning) model. It is faster on GPU and much more accurate.
3.  **Optimized Architecture**: Refactored `app.py` to use a **Single Producer / Multiple Consumer** pattern. The background thread captures and processes frames, updating a global state. The video feed simply streams this state, eliminating camera resource contention.
4.  **Robust Tracking**: Implemented `EuclideanDistTracker` with:
    *   **Voting Mechanism**: Uses the history of gender predictions to determine the final gender (majority vote), reducing flickering.
    *   **Hysteresis**: Keeps tracks alive for `max_disappeared` frames to handle temporary occlusions.

---

## 2. Architecture Diagram

```mermaid
graph TD
    Camera[Camera Source] -->|Raw Frame| BackgroundThread
    
    subgraph "Background Processing (Thread)"
        BackgroundThread -->|Resize & Preprocess| PersonNet[MobileNetSSD (GPU)]
        PersonNet -->|Person ROIs| FaceNet[ResNet10 Face SSD (GPU)]
        FaceNet -->|Face ROIs| GenderNet[Gender Caffe (GPU)]
        GenderNet -->|Gender & Conf| Tracker[Euclidean Tracker]
        Tracker -->|Smooth Counts| GlobalState
        Tracker -->|Annotated Frame| GlobalState
    end
    
    subgraph "Flask Application"
        GlobalState -->|JSON Updates| SocketIO
        GlobalState -->|MJPEG Stream| VideoFeedRoute
        SocketIO -->|Real-time Data| WebDashboard
        AdManager -->|Ad Selection| SocketIO
    end
```

---

## 3. Deployment Instructions

### Prerequisites
*   **Hardware**: NVIDIA GTX1650 (or better).
*   **Drivers**: Latest NVIDIA Game Ready Drivers.
*   **Software**:
    *   Python 3.9+
    *   CUDA Toolkit (matching your PyTorch/OpenCV version, usually 11.x or 12.x).
    *   cuDNN (for deep learning acceleration).

### Step 1: Install Dependencies
Ensure you have the required Python packages.
```bash
pip install flask flask-socketio flask-pymongo flask-bcrypt opencv-python numpy
```
*Note: For maximum performance, ensure `opencv-python` is built with CUDA support. Standard `pip install opencv-python` does NOT include CUDA support. You may need to compile OpenCV from source or find a pre-built CUDA wheel.*

### Step 2: Model Setup
The system is configured to use **ResNet10 SSD** for face detection.
1.  Download `res10_300x300_ssd_iter_140000.caffemodel` and `deploy.prototxt`.
2.  Place them in the `models/` directory.
   *(If these are missing, the system will fallback to Haarcascade, but performance will be lower).*

### Step 3: Configuration
Edit `config.py` to tune performance:
*   `USE_GPU = True`: Ensure this is True.
*   `CAMERA_WIDTH / HEIGHT`: Set to 1280x720 or 1920x1080.
*   `CONFIDENCE_THRESHOLD`: Adjust if detections are missed (lower it) or too many false positives (raise it).

### Step 4: Run the System
```bash
python app.py
```
Access the dashboard at `http://localhost:5000`.

---

## 4. Tuning Guide

| Parameter | Default | Description |
|-----------|---------|-------------|
| `CONFIDENCE_THRESHOLD` | 0.60 | Min confidence for person detection. Lower to detect people further away. |
| `GENDER_CONFIDENCE_THRESHOLD` | 0.70 | Min confidence to accept a gender prediction. Higher = more accurate but fewer gender tags. |
| `max_disappeared` (tracker.py) | 40 | Frames to keep an ID alive without detection. Increase if people are lost when turning away. |
| `detection_frame_skip` (camera.py) | 2 | Process every Nth frame. Set to 1 for max accuracy, 3+ for higher FPS on weak hardware. |

## 5. Future Expansion
*   **Age Detection**: Add an Age estimation model (Caffe/ONNX) to the pipeline.
*   **Gaze Tracking**: Detect if people are looking at the ad to measure "Attention Time".
*   **DeepSORT**: Upgrade to DeepSORT if ID switching remains an issue (requires `torch` and more VRAM).
