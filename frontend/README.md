# CrowdSense-AI

Real-time crowd detection using machine learning for people detection and counting from video streams.
This project identifies human presence in frames and visualizes detections in real time.

Built using Google AI Studio and TensorFlow.js.

---

## 🚀 Features

* Real-time people detection
* Crowd / people counting
* Bounding box visualization
* Browser-based execution
* Lightweight and fast inference
* Video stream support

---

## 🧠 Tech Stack

* TensorFlow.js
* TypeScript
* Vite
* HTML/CSS
* Node.js

---

## 📂 Project Structure

```
CrowdSense-AI/
│
├── src/              # Core detection logic
├── scripts/          # Utility scripts
├── docs/             # Documentation files
├── index.html        # App entry point
├── package.json      # Dependencies
├── vite.config.ts    # Vite configuration
└── README.md
```

---

## ⚙️ How It Works

1. Video input is captured from camera or file
2. TensorFlow.js loads the detection model
3. Humans are detected in each frame
4. Bounding boxes are drawn around people
5. Total count is calculated
6. Results displayed in real time

---

## 🖥️ Run Locally

### Prerequisites

* Node.js installed

### Installation

```bash
npm install
```

### Set API Key

Create `.env.local` and add:

```
GEMINI_API_KEY=your_api_key_here
```

### Run Development Server

```bash
npm run dev
```

App will start at:

```
http://localhost:5173
```

---

## 📊 Use Cases

* Smart surveillance systems
* Event monitoring
* Campus safety
* Public space analytics
* Footfall counting

---

## 🔮 Future Improvements

* Heatmap visualization
* Person tracking IDs
* Multi-camera support
* Overcrowding alerts

---

## 👤 Author

Apurva Nikam
