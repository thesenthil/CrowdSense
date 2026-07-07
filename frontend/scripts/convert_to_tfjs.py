from ultralytics import YOLO

def export_to_tfjs():
    """
    Converts a fine-tuned YOLOv8 PyTorch model (.pt) to TensorFlow.js format
    so it can be run directly in the browser.
    """
    # Path to your fine-tuned model weights
    model_path = 'crowd_detection/yolov8m_crowd/weights/best.pt'
    
    print(f"Loading fine-tuned model from {model_path}...")
    try:
        model = YOLO(model_path)
    except Exception as e:
        print(f"Error loading model. Did you run train_custom_yolo.py first? Error: {e}")
        return

    print("Exporting model to TensorFlow.js format...")
    # Export the model
    # This will create a directory named 'best_web_model' containing the model.json 
    # and the binary weight files (.bin)
    model.export(format='tfjs')

    print("Export complete!")
    print("You can now host the generated 'best_web_model' folder and load it in your React app.")

if __name__ == '__main__':
    export_to_tfjs()
