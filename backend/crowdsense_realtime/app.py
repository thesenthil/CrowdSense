"""
Production-Ready Crowd Sense Detection System
Flask + SocketIO + Real-time Gender Detection + Smart Ad Management
Optimized for Single-Threaded Camera Access
"""
from flask import Flask, render_template, Response, jsonify, request, session, redirect, url_for, flash, send_from_directory
from flask_socketio import SocketIO, emit
from flask_pymongo import PyMongo
from flask_bcrypt import Bcrypt
import threading
import time
from datetime import datetime
from camera import VideoCamera
from ad_manager import AdManager
import config

app = Flask(__name__)
app.config["SECRET_KEY"] = config.SECRET_KEY
app.config["MONGO_URI"] = config.MONGO_URI

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# MongoDB connection
try:
    mongo = PyMongo(app)
    bcrypt = Bcrypt(app)
    # Check connection
    mongo.db.client.server_info()
    print("[SUCCESS] Connected to MongoDB")
except Exception as e:
    print(f"[ERROR] Failed to connect to MongoDB: {e}")
    mongo = None

# Initialize camera and managers
camera_instance = VideoCamera()
ad_manager = AdManager(mongo_db=mongo.db if mongo else None)

# Global state for frames and counts
global_lock = threading.Lock()
current_frame = None
current_counts = {'total': 0, 'male': 0, 'female': 0}

analytics_data = {
    'total_detections': 0,
    'male_detections': 0,
    'female_detections': 0,
    'peak_count': 0,
    'detection_history': []
}

def background_thread():
    """
    Main processing thread.
    Captures frames, runs inference, updates global state, and manages ads.
    """
    global current_frame, current_counts
    
    print("[INFO] Background thread started")
    
    while True:
        try:
            if not camera_instance:
                time.sleep(1.0)
                continue

            # Only process if camera is opened (controlled by login/dashboard)
            if not camera_instance.is_opened():
                time.sleep(0.5)
                continue

            # Capture and Process
            frame_bytes, counts = camera_instance.get_frame()
            
            if frame_bytes:
                # Update global state
                with global_lock:
                    current_frame = frame_bytes
                    current_counts = counts
                    
                    # Update analytics
                    analytics_data['total_detections'] += 1
                    analytics_data['male_detections'] += counts.get('male', 0)
                    analytics_data['female_detections'] += counts.get('female', 0)
                    analytics_data['peak_count'] = max(analytics_data['peak_count'], counts.get('total', 0))
                    
                    # History
                    analytics_data['detection_history'].append({
                        'total': counts.get('total', 0),
                        'male': counts.get('male', 0),
                        'female': counts.get('female', 0),
                        'timestamp': datetime.now().isoformat()
                    })
                    if len(analytics_data['detection_history']) > 50:
                        analytics_data['detection_history'].pop(0)

                # Emit updates
                socketio.emit('count_update', counts, namespace='/')
                
                # Ad Logic
                total = counts.get('total', 0)
                male = counts.get('male', 0)
                female = counts.get('female', 0)
                
                # Determine majority
                if total > 0:
                    if male > female:
                        ad_gender = 'male'
                    elif female > male:
                        ad_gender = 'female'
                    else:
                        ad_gender = 'male' if male > 0 else 'neutral'
                    
                    should_show, target = ad_manager.should_show_ad(ad_gender, counts)
                    if should_show and target:
                        ad = ad_manager.select_ad(target)
                        if ad:
                            socketio.emit('show_ad', ad, namespace='/')
                            # Update analytics immediately
                            with global_lock:
                                stats = {
                                    **analytics_data,
                                    'current_counts': current_counts,
                                    'ad_stats': ad_manager.get_stats()
                                }
                                socketio.emit('analytics_update', stats, namespace='/')

            # Control framerate (approx 30 FPS max)
            time.sleep(0.01)

        except Exception as e:
            print(f"[ERROR] Background thread: {e}")
            time.sleep(1.0)

# Start background thread
socketio.start_background_task(background_thread)

# ------------------ ROUTES ------------------

@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'username' in session:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        # Simple auth or MongoDB auth
        if mongo:
            user = mongo.db.users.find_one({'username': username})
            if user and bcrypt.check_password_hash(user['password'], password):
                session['username'] = username
                return redirect(url_for('dashboard'))
        elif username == "admin" and password == "admin": # Fallback
             session['username'] = username
             return redirect(url_for('dashboard'))
             
        flash('Invalid credentials', 'danger')
    
    # Ensure camera is off
    if camera_instance.is_opened():
        camera_instance.release()
        
    return render_template('login.html')

@app.route('/logout')
def logout():
    if camera_instance.is_opened():
        camera_instance.release()
    session.pop('username', None)
    return redirect(url_for('login'))

@app.route('/')
def dashboard():
    if 'username' not in session:
        return redirect(url_for('login'))
    
    # Turn on camera
    if not camera_instance.is_opened():
        camera_instance.reinitialize()
        
    return render_template('dashboard.html')

@app.route('/video_feed')
def video_feed():
    if 'username' not in session:
        return "Unauthorized", 401

    def generate():
        while True:
            with global_lock:
                frame = current_frame
            
            if frame:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
            else:
                # If no frame yet, wait a bit
                time.sleep(0.1)
            
            time.sleep(0.03) # Limit stream FPS

    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/people_count')
def people_count():
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    with global_lock:
        return jsonify(current_counts)

@app.route('/analytics')
def analytics():
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    with global_lock:
        data = {
            **analytics_data,
            'current_counts': current_counts,
            'ad_stats': ad_manager.get_stats(),
            'recent_ads': ad_manager.get_ad_history(10)
        }
    return jsonify(data)

@app.route('/ad/current')
def current_ad():
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    return jsonify({'ad': ad_manager.get_current_ad()})

@app.route('/templates/<path:filename>')
def serve_template_image(filename):
    """Serve template images"""
    return send_from_directory('templates', filename)

# Static files
@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

# SocketIO Events
@socketio.on('connect')
def handle_connect():
    emit('connected', {'data': 'Connected'})

@socketio.on('request_counts')
def handle_counts():
    with global_lock:
        emit('count_update', current_counts)

if __name__ == '__main__':
    print(f"[INFO] Server starting on {config.HOST}:{config.PORT}")
    socketio.run(app, host=config.HOST, port=config.PORT, debug=config.DEBUG, use_reloader=False)
