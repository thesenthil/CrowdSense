from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from core.database import db
import time
import threading

app = Flask(__name__)
app.config['SECRET_KEY'] = 'crowdsense_super_secret_key'
CORS(app) # Allow frontend to connect
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# Global analytics state
analytics_data = {
    'total_detections': 0,
    'current_crowd': 0,
    'anomalies': 0,
    'status': 'Active'
}

@app.route('/api/status', methods=['GET'])
def get_status():
    """Returns the current status of the crowdsense backend."""
    return jsonify({
        "status": "online",
        "database": "connected" if db is not None else "disconnected",
        "analytics": analytics_data
    })

@app.route('/api/predict', methods=['POST'])
def predict_crowd():
    """Endpoint integrating the predictive models (placeholder for merged logic)"""
    data = request.json
    # TODO: Integrate predictiveModel logic from crowdsense_flask
    return jsonify({"prediction": "High traffic expected", "confidence": 0.85})

@app.route('/api/ads', methods=['GET'])
def get_smart_ads():
    """Returns smart ad targeting based on current crowd demographics"""
    # TODO: Integrate AdManager from crowdsense_realtime
    return jsonify({"target_ad": "Tech Gadgets", "reason": "Majority young adults detected"})

@app.route('/api/report/daily', methods=['GET'])
def get_daily_report():
    """Generates an LLM-powered natural language daily report from MongoDB data"""
    from core.report_generator import generate_daily_report
    report_data = generate_daily_report()
    if report_data.get("success"):
        return jsonify({"status": "success", "report": report_data["report"]})
    else:
        return jsonify({"status": "error", "message": report_data.get("error")}), 500

# Socket.io events for real-time updates to the React dashboard
@socketio.on('connect')
def handle_connect():
    print('Client connected to real-time stream')
    emit('status_update', {'message': 'Connected to crowdsense Backend'})

def background_analytics_simulator():
    """Simulates real-time analytics if no live camera is connected."""
    while True:
        # Emit mock analytics to keep dashboard alive
        socketio.emit('analytics_update', analytics_data)
        time.sleep(5)

if __name__ == '__main__':
    print("Starting crowdsense AI Backend on port 5000...")
    # Start background thread
    threading.Thread(target=background_analytics_simulator, daemon=True).start()
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
