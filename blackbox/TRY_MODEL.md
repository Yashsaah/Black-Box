# Try the Model — how it fits together

The "Try the Model" page lets a visitor upload an image and see a heatmap of
where the CNN looked. Because this site is a **static Vite build on Vercel**, the
network itself cannot run inside it. The page instead **POSTs the image to your
CNN service** and renders whatever it sends back.

Until you connect that service, the page runs a **browser-side demo heatmap** so
it still works on the live site.

```
 visitor's browser                          your CNN service (hosted separately)
 ┌───────────────────┐   POST image         ┌──────────────────────────────┐
 │  /try  (this app) │ ───────────────────▶ │  /predict  → Grad-CAM heatmap │
 │  renders heatmap  │ ◀─────────────────── │  returns JSON or an image     │
 └───────────────────┘   heatmap + label    └──────────────────────────────┘
```

## Files this feature added

```
blackbox/
├── src/
│   ├── pages/TryModel.jsx      # the upload + result page
│   ├── lib/model.js            # API call + browser demo heatmap
│   ├── App.jsx                 # added route:  /try
│   ├── components/Layout.jsx   # added highlighted "Try the Model" nav link
│   ├── pages/Home.jsx          # added a highlight band linking to /try
│   └── index.css               # appended styles (search "try the model")
├── .env.example                # where the endpoint URL goes
└── TRY_MODEL.md                # this file
```

## Connect your CNN in one step

1. In the `blackbox/` folder, copy `.env.example` to `.env`.
2. Set the URL of your model endpoint:
   ```
   VITE_MODEL_API_URL=https://your-model-host.com/predict
   ```
3. Restart `npm run dev`. The badge on the page flips from *demo mode* to
   *live model connected*.

On **Vercel**: Project → Settings → Environment Variables → add
`VITE_MODEL_API_URL` with the same value, then redeploy. (Vite bakes env vars in
at build time, so a redeploy is required after changing it.)

## The API contract the page expects

**Request** — `POST` to your URL, `multipart/form-data`, one field named `image`.

**Response** — either of:

- **JSON** (recommended):
  ```json
  {
    "heatmap":    "<base64 PNG or data URL>",   // required
    "overlay":    "<base64 PNG or data URL>",   // optional: heatmap blended on the input
    "label":      "tabby cat",                   // optional
    "confidence": 0.92                            // optional (0–1)
  }
  ```
  Plain base64 works; the page adds the `data:image/png;base64,` prefix if it's
  missing.
- **A raw image** (`Content-Type: image/png`) — the whole body is treated as the
  heatmap.

Your backend **must** send permissive CORS headers so the browser can call it
(`Access-Control-Allow-Origin: *`, or your site's domain).

## Minimal backend example (FastAPI + Grad-CAM)

Swap the torchvision model for your own CNN. This is only a template.

```python
# app.py  —  pip install fastapi uvicorn torch torchvision grad-cam pillow numpy
import base64, io
import numpy as np
from PIL import Image
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import torch
from torchvision import models, transforms
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.image import show_cam_on_image

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

model = models.resnet50(weights="IMAGENET1K_V2").eval()   # <-- your model here
target_layer = model.layer4[-1]                            # <-- last conv block
cam = GradCAM(model=model, target_layers=[target_layer])

prep = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
])

def to_b64(arr_uint8):
    buf = io.BytesIO()
    Image.fromarray(arr_uint8).save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()

@app.post("/predict")
async def predict(image: UploadFile = File(...)):
    img = Image.open(io.BytesIO(await image.read())).convert("RGB").resize((224, 224))
    rgb = np.asarray(img, dtype=np.float32) / 255.0
    tensor = prep(img).unsqueeze(0)

    with torch.no_grad():
        logits = model(tensor)
        prob = torch.softmax(logits, 1)[0]
        conf, idx = prob.max(0)

    grayscale = cam(input_tensor=tensor)[0]                 # HxW attention in [0,1]
    overlay = show_cam_on_image(rgb, grayscale, use_rgb=True)
    heat = (np.stack([grayscale] * 3, -1) * 255).astype("uint8")

    return {
        "heatmap": to_b64(heat),
        "overlay": to_b64(overlay),
        "label": str(idx.item()),                           # map to a class name if you have one
        "confidence": float(conf),
    }
```

Run it: `uvicorn app:app --reload --port 8000`, then set
`VITE_MODEL_API_URL=http://localhost:8000/predict`.

### Hosting the backend

The frontend doesn't care where the model lives — anything that serves the
`/predict` endpoint over HTTPS with CORS works: Render, Railway, Fly.io, Hugging
Face Spaces, a small GPU box, etc. Point `VITE_MODEL_API_URL` at it.

## The demo heatmap

`src/lib/model.js → demoHeatmap()` builds an attention-style map in the browser
(gradient magnitude + centre bias, smoothed, colour-mapped to the site palette).
It is **not** your CNN — it's a placeholder so the page is never blank. Once
`VITE_MODEL_API_URL` is set, the real endpoint is used automatically and the demo
is bypassed.
