"""
Configuration file for Crowd Sense Detection System
"""
import os

# Flask Configuration
SECRET_KEY = os.environ.get('SECRET_KEY', 'a_very_secret_and_random_string_for_this_project_change_in_production')
DEBUG = os.environ.get('DEBUG', 'True').lower() == 'true'

# MongoDB Configuration
MONGO_URI = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/crowd_management_db')

# Server Configuration
HOST = os.environ.get('HOST', '0.0.0.0')
PORT = int(os.environ.get('PORT', 5000))

# Camera Configuration - HIGH QUALITY
CAMERA_SOURCE = int(os.environ.get('CAMERA_SOURCE', 0))
CAMERA_WIDTH = int(os.environ.get('CAMERA_WIDTH', 1920))  # Increased for better quality
CAMERA_HEIGHT = int(os.environ.get('CAMERA_HEIGHT', 1080))  # Full HD
FRAME_SKIP = int(os.environ.get('FRAME_SKIP', 0))  # 0 = process every frame for smooth video
# Ad Display Configuration
AD_DISPLAY_DURATION = int(os.environ.get('AD_DISPLAY_DURATION', 15))  # 15 seconds for mall ads
AD_TRIGGER_DELAY = int(os.environ.get('AD_TRIGGER_DELAY', 2))  # 2 seconds after detection
AD_TRANSITION_DURATION = float(os.environ.get('AD_TRANSITION_DURATION', 0.5))  # Faster transition

# Model Configuration
# Model Configuration
# Model Configuration
CONFIDENCE_THRESHOLD = float(os.environ.get('CONFIDENCE_THRESHOLD', 0.75))  # Person detection - Stricter
GENDER_CONFIDENCE_THRESHOLD = float(os.environ.get('GENDER_CONFIDENCE_THRESHOLD', 0.75))  # Gender detection - Balanced
FACE_CONFIDENCE_THRESHOLD = float(os.environ.get('FACE_CONFIDENCE_THRESHOLD', 0.60))  # Face detection

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, 'models')
STATIC_DIR = os.path.join(BASE_DIR, 'static')
ADS_DIR = os.path.join(STATIC_DIR, 'ads')

# Face Detection Model (ResNet10 SSD) - Better than Haarcascade
FACE_PROTOTXT = os.path.join(MODELS_DIR, 'deploy.prototxt')
FACE_MODEL = os.path.join(MODELS_DIR, 'res10_300x300_ssd_iter_140000.caffemodel')

# SocketIO Configuration
# Use 'threading' for Python 3.12+ compatibility (eventlet has SSL issues)
SOCKETIO_ASYNC_MODE = 'threading'
CORS_ALLOWED_ORIGINS = "*"  # Change in production

# Hardware Acceleration
USE_GPU = True  # Set to True if you have NVIDIA GPU + CUDA + OpenCV with CUDA support




