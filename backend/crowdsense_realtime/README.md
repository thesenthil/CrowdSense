# Crowd Sense Detection System 🎯
## Production-Ready Real-Time Gender Detection & Smart Advertisement Platform

A comprehensive, production-ready system for real-time crowd analysis, gender detection, and intelligent advertisement display using deep learning and computer vision.

## 🚀 Features

### Core Capabilities
- **Real-time People Detection**: High-accuracy person detection using MobileNetSSD
- **Advanced Gender Classification**: Deep learning-based gender detection with optimized inference
- **Smart Advertisement System**: 
  - Automatic ad selection based on detected gender
  - Configurable display duration (default: 15 seconds)
  - Smooth fade transitions between ads
  - Support for images and video ads (MP4, WebM)
  - Pop-up notifications with SweetAlert2
  - Prevents instant ad changes on count fluctuations

### Dashboard & Analytics
- **Interactive Admin Dashboard**: Bootstrap 5 + Chart.js for real-time analytics
- **Real-time Updates**: Flask-SocketIO for live data streaming
- **Gender Demographics**: Live pie charts and statistics
- **Crowd Limit Alerts**: Configurable thresholds with audio notifications
- **Analytics Modal**: Comprehensive statistics and trend analysis
- **Modern UI**: Responsive design with dark/light theme support
- **AOS Animations**: Smooth page transitions and animations

### Technical Features
- **High Performance**: Optimized frame processing with caching
- **Thread-Safe Operations**: Proper locking for concurrent access
- **Production Configuration**: Environment-based config management
- **Modular Architecture**: Clean code separation (camera, ads, analytics)

## 📋 Prerequisites

- **Python 3.8+**
- **MongoDB** (running on localhost:27017)
- **Webcam/Camera** device
- **Windows/Linux/Mac OS**

## 🛠️ Installation

### 1. Clone/Download the Project

```bash
cd "path/to/crowd MANAGEGMENT/crowdMANAGEGMENT"
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

**Key Dependencies:**
- Flask 2.3.3
- Flask-SocketIO 5.3.5
- Flask-PyMongo 2.3.0
- OpenCV 4.8.1.78
- eventlet 0.33.3
- Chart.js (CDN)
- Bootstrap 5 (CDN)

### 3. Set Up MongoDB

**Windows:**
- Download MongoDB from https://www.mongodb.com/try/download/community
- Start MongoDB service or run `mongod`

**Linux:**
```bash
sudo apt-get install mongodb
sudo systemctl start mongod
```

**Mac:**
```bash
brew install mongodb-community
brew services start mongodb-community
```

### 4. Create Admin User

```bash
python add_admin_user.py
```

**Default credentials** (can be changed in `add_admin_user.py`):
- Username: `a`
- Password: `a`

### 5. Add Advertisement Files (Optional)

Place advertisement files in:
- `static/ads/male/` - Male-targeted ads
- `static/ads/female/` - Female-targeted ads  
- `static/ads/neutral/` - General ads

**Supported formats:**
- Images: `.jpg`, `.jpeg`, `.png`, `.gif`
- Videos: `.mp4`, `.webm`

### 6. Configure (Optional)

Edit `config.py` to customize:
- Ad display duration
- Ad trigger delay
- Camera settings
- Confidence thresholds

## 🎮 Usage

### Start the Server

```bash
python app.py
```

The server will start on `http://localhost:5000`

### Access the Dashboard

1. Open browser: `http://localhost:5000`
2. Login with admin credentials
3. View real-time camera feed and analytics

### Dashboard Features

- **Live Video Feed**: Real-time camera stream with detection overlays
- **People Counts**: Total, male, female, and children counts
- **Gender Charts**: Interactive pie chart showing gender distribution
- **Crowd Limits**: Set thresholds for alert notifications
- **Advertisements**: Automatic targeted ad display
- **Analytics**: Detailed statistics and trend analysis

## 📁 Project Structure

```
crowdMANAGEGMENT/
├── app.py                  # Main Flask-SocketIO application
├── camera.py               # Enhanced video camera & detection
├── ad_manager.py           # Smart advertisement management
├── config.py               # Configuration settings
├── add_admin_user.py       # Admin user setup
├── requirements.txt        # Python dependencies
│
├── models/                 # AI Model files
│   ├── MobileNetSSD_deploy.prototxt
│   ├── MobileNetSSD_deploy.caffemodel
│   ├── haarcascade_frontalface_default.xml
│   ├── deploy_gender.prototxt
│   └── gender_net.caffemodel
│
├── static/
│   ├── css/
│   │   └── dashboard.css    # Custom dashboard styles
│   ├── js/
│   │   └── dashboard.js     # Dashboard JavaScript logic
│   ├── ads/                 # Advertisement files
│   │   ├── male/
│   │   ├── female/
│   │   └── neutral/
│   └── sounds/
│       ├── alert.mp3
│       └── beep.mp3
│
└── templates/
    ├── dashboard.html       # Main dashboard (Bootstrap 5)
    └── login.html           # Login page
```

## ⚙️ Configuration

### Environment Variables

You can set these in `config.py` or as environment variables:

```python
AD_DISPLAY_DURATION = 15      # Seconds ad stays visible
AD_TRIGGER_DELAY = 10         # Seconds before showing ad after detection
CONFIDENCE_THRESHOLD = 0.7    # Person detection confidence
GENDER_CONFIDENCE_THRESHOLD = 0.65  # Gender classification confidence
CAMERA_SOURCE = 0             # Camera index
```

## 🔧 How It Works

### Detection Flow

1. **Camera Feed** → Frame captured
2. **Person Detection** → MobileNetSSD identifies people
3. **Face Detection** → Haar Cascade finds faces
4. **Gender Classification** → Caffe DNN model classifies gender
5. **Count Update** → Real-time counts via SocketIO
6. **Ad Selection** → Smart ad manager selects appropriate ad
7. **Ad Display** → Pop-up with smooth fade transitions

### Ad Display Logic

- Ad doesn't change instantly when count changes
- Each ad displays for configured duration (15s default)
- Waits 10 seconds after detection before showing new ad
- Prevents ad overlap and ensures smooth transitions

## 🐛 Troubleshooting

### MongoDB Connection Issues
```bash
# Check if MongoDB is running
mongosh --eval "db.adminCommand('ping')"

# Start MongoDB
mongod
```

### Camera Not Working
- Ensure camera isn't used by another app
- Try different camera indices: 0, 1, 2, etc.
- Check camera permissions

### Models Not Loading
- Verify all model files exist in `models/` directory
- Check file permissions
- Ensure OpenCV is properly installed

### SocketIO Connection Issues
- Check browser console for errors
- Verify eventlet is installed: `pip install eventlet`
- Try restarting the server

### Ads Not Showing
- Ensure ad files exist in `static/ads/` directories
- Check file formats (supported: jpg, png, mp4, webm)
- Verify file permissions

## 📊 Performance Optimization

- **Frame Skipping**: Processes every Nth frame for performance
- **Temporal Smoothing**: Averages counts over buffer for stability
- **Model Optimization**: Uses CPU-optimized OpenCV DNN backend
- **Caching**: Detection results cached to reduce computation

## 🚀 Production Deployment

### Recommended Setup

1. **Use a production WSGI server**:
   ```bash
   pip install gunicorn
   gunicorn -k eventlet -w 1 app:app
   ```

2. **Set environment variables**:
   ```bash
   export SECRET_KEY="your-secret-key"
   export DEBUG=False
   export MONGO_URI="mongodb://your-mongodb-uri"
   ```

3. **Use a reverse proxy** (Nginx):
   ```nginx
   location / {
       proxy_pass http://127.0.0.1:5000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
   }
   ```

## 📝 License

This project is for educational and research purposes.

## 🎯 Key Improvements Over Original

1. ✅ Flask-SocketIO for real-time updates
2. ✅ Smart ad management with timing logic
3. ✅ Bootstrap 5 + Chart.js dashboard
4. ✅ Video ad support with smooth transitions
5. ✅ Production-ready configuration
6. ✅ Enhanced error handling
7. ✅ Modular architecture
8. ✅ Comprehensive analytics
9. ✅ SweetAlert2 notifications
10. ✅ Optimized performance

## 👨‍💻 Development

### Adding New Features

1. **Camera Detection**: Edit `camera.py`
2. **Ad Logic**: Edit `ad_manager.py`
3. **Frontend**: Edit `templates/dashboard.html` and `static/js/dashboard.js`
4. **Backend Routes**: Edit `app.py`

### Testing

```bash
# Run in development mode
python app.py

# Check logs for errors
# Monitor browser console for frontend issues
```

---

**Built with ❤️ using Flask, OpenCV, and Modern Web Technologies**
