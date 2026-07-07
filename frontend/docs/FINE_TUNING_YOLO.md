# Fine-Tuning YOLO for Crowd Detection

To achieve the highest accuracy in crowded and occluded scenarios, the generic COCO-SSD model used in the browser demo is often insufficient. It is trained on general objects and struggles when people overlap.

To solve this, you need to **fine-tune a YOLOv8 model** on a crowd-specific dataset and then export it to run in the browser.

## 1. Prepare Your Dataset
You need a dataset specifically annotated for crowds, where even heavily occluded people (e.g., just a head visible) are labeled.
*   **Recommended Datasets:** [CrowdHuman](https://www.crowdhuman.org/) or [WiderPerson](http://www.cbsr.ia.ac.cn/users/sfzhang/WiderPerson/).
*   **Format:** The dataset must be in YOLO format (images in one folder, `.txt` label files in another).

Create a `crowd_dataset.yaml` file to define your dataset paths:
```yaml
path: ../datasets/crowdhuman # root dir
train: images/train
val: images/val

# Classes
names:
  0: person
```

## 2. Train the Model (Python)
You will need a machine with a GPU (or use Google Colab).
1. Install requirements: `pip install ultralytics`
2. Run the training script provided in the `scripts/` folder:
   ```bash
   python scripts/train_custom_yolo.py
   ```
   *Note: This script uses advanced augmentations like `mosaic` and `mixup` which force the model to learn partial features of people, making it highly robust to occlusion.*

## 3. Export to Web Format
Once training is done, export the PyTorch model (`.pt`) to TensorFlow.js format so it can run in the React app.
```bash
python scripts/convert_to_tfjs.py
```
This generates a folder with a `model.json` and `.bin` weight files.

## 4. Load in React (Implementation Notes)
To replace `coco-ssd` with your custom YOLOv8 TFJS model in `App.tsx`, you would use `@tensorflow/tfjs` directly:

```typescript
import * as tf from '@tensorflow/tfjs';

// 1. Load the model
const customModel = await tf.loadGraphModel('/path/to/your/model.json');

// 2. Pre-process the video frame
const img = tf.browser.fromPixels(video);
const resized = tf.image.resizeBilinear(img, [640, 640]);
const expanded = resized.expandDims(0).toFloat().div(255.0);

// 3. Run inference
const predictions = await customModel.executeAsync(expanded);

// 4. Post-process (YOLOv8 outputs a tensor of shape [1, 84, 8400])
// You will need to parse this tensor, apply confidence thresholds, 
// and run Non-Maximum Suppression (NMS) to extract the bounding boxes.
```

*Note: Parsing YOLOv8 raw tensor output in JavaScript requires custom tensor slicing and NMS logic, which replaces the simple `model.detect()` call currently used by `coco-ssd`.*
