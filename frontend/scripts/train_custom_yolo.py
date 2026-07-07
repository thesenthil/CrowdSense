from ultralytics import YOLO

def train_custom_model():
    """
    Fine-tunes a YOLOv8 model for crowd detection.
    
    Why YOLOv8 Medium (yolov8m.pt)?
    - It offers a great balance between speed and accuracy.
    - It has enough parameters to learn complex features like partial occlusions 
      (e.g., seeing only a head or shoulder in a dense crowd).
    """
    print("Loading pre-trained YOLOv8 medium model...")
    model = YOLO('yolov8m.pt')

    print("Starting fine-tuning process...")
    # Fine-tune the model
    # Ensure you have a 'crowd_dataset.yaml' file that points to your dataset.
    # Datasets like 'CrowdHuman' or 'WiderPerson' are highly recommended.
    results = model.train(
        data='crowd_dataset.yaml', # Path to your dataset config
        epochs=50,                 # Number of training epochs
        imgsz=640,                 # Image size (640 is standard, use 1280 for very dense crowds)
        batch=16,                  # Batch size (adjust based on your GPU memory)
        device='0',                # Use GPU 0 (change to 'cpu' if no GPU is available)
        project='crowd_detection', # Output directory for logs and weights
        name='yolov8m_crowd',      # Name of this training run
        
        # --- Hyperparameters for Occlusion & Crowds ---
        optimizer='AdamW',         # Good optimizer for complex datasets
        lr0=0.001,                 # Initial learning rate
        mosaic=1.0,                # Mosaic augmentation (combines 4 images, great for crowds)
        mixup=0.2,                 # Mixup augmentation (blends images)
        degrees=10.0,              # Slight rotations to handle different camera angles
        hsv_s=0.5,                 # Saturation augmentation (handles different lighting)
        hsv_v=0.5,                 # Value/Brightness augmentation
    )

    print("Training complete!")
    print("Best model saved to: crowd_detection/yolov8m_crowd/weights/best.pt")

if __name__ == '__main__':
    train_custom_model()
