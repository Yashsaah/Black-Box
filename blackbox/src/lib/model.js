// Talks to the Black Box CNN backend, with a browser-side demo fallback so the
// page still works on the static deploy before the model endpoint is wired up.
//
// Set VITE_MODEL_API_URL (see TRY_MODEL.md) to point at your CNN service.

const API_URL = import.meta.env.VITE_MODEL_API_URL || "";

export const hasBackend = Boolean(API_URL);

// POST the image to the CNN service and normalise whatever it returns into a
// { heatmap, overlay, label, confidence } shape. The backend may answer with
// JSON (base64 or data-URL fields) or with a raw image body.
export async function runModel(file) {
  if (!API_URL) throw new Error("NO_BACKEND");

  const form = new FormData();
  form.append("image", file);

  const res = await fetch(API_URL, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Model service returned ${res.status}`);

  const type = res.headers.get("content-type") || "";

  if (type.includes("application/json")) {
    const data = await res.json();
    return {
      heatmap: asDataUrl(data.heatmap),
      overlay: data.overlay ? asDataUrl(data.overlay) : null,
      label: data.label ?? data.prediction ?? null,
      confidence: typeof data.confidence === "number" ? data.confidence : null,
      demo: false,
    };
  }

  // Raw image response — treat the whole body as the heatmap.
  const blob = await res.blob();
  return {
    heatmap: URL.createObjectURL(blob),
    overlay: null,
    label: null,
    confidence: null,
    demo: false,
  };
}

function asDataUrl(v) {
  if (!v) return null;
  return v.startsWith("data:") || v.startsWith("http") || v.startsWith("blob:")
    ? v
    : `data:image/png;base64,${v}`;
}

// ---------------------------------------------------------------------------
// Demo heatmap — a stand-in "attention" map generated entirely in the browser:
// gradient magnitude with a soft centre bias, smoothed and colour-mapped onto
// the site palette. This is NOT the real CNN output; it only lets the page work
// before the backend is connected.
// ---------------------------------------------------------------------------

export async function demoHeatmap(file) {
  const img = await loadImage(file);
  const S = 224; // typical CNN input square
  const src = document.createElement("canvas");
  src.width = S;
  src.height = S;
  const sctx = src.getContext("2d");

  // cover-fit the image into the square
  const scale = Math.max(S / img.width, S / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  sctx.drawImage(img, (S - dw) / 2, (S - dh) / 2, dw, dh);
  const { data } = sctx.getImageData(0, 0, S, S);

  // grayscale
  const gray = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }

  // saliency = gradient magnitude, weighted toward the centre
  const sal = new Float32Array(S * S);
  for (let y = 1; y < S - 1; y++) {
    for (let x = 1; x < S - 1; x++) {
      const i = y * S + x;
      const gx = gray[i + 1] - gray[i - 1];
      const gy = gray[i + S] - gray[i - S];
      const mag = Math.hypot(gx, gy);
      const cx = x / S - 0.5;
      const cy = y / S - 0.5;
      const center = Math.exp(-(cx * cx + cy * cy) * 6);
      sal[i] = mag * (0.45 + 0.55 * center);
    }
  }
  blur(sal, S, 3);
  blur(sal, S, 3);

  // normalise
  let mn = Infinity;
  let mx = -Infinity;
  for (const v of sal) {
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const range = mx - mn || 1;

  // paint the heatmap and the overlay
  const heat = document.createElement("canvas");
  heat.width = S;
  heat.height = S;
  const hctx = heat.getContext("2d");
  const hImg = hctx.createImageData(S, S);

  const over = document.createElement("canvas");
  over.width = S;
  over.height = S;
  const octx = over.getContext("2d");
  octx.drawImage(src, 0, 0);
  const oImg = octx.getImageData(0, 0, S, S);

  for (let i = 0; i < S * S; i++) {
    const t = (sal[i] - mn) / range;
    const [r, g, b] = colormap(t);
    hImg.data[i * 4] = r;
    hImg.data[i * 4 + 1] = g;
    hImg.data[i * 4 + 2] = b;
    hImg.data[i * 4 + 3] = 255;

    const a = Math.min(1, t * 1.15) * 0.55;
    oImg.data[i * 4] = oImg.data[i * 4] * (1 - a) + r * a;
    oImg.data[i * 4 + 1] = oImg.data[i * 4 + 1] * (1 - a) + g * a;
    oImg.data[i * 4 + 2] = oImg.data[i * 4 + 2] * (1 - a) + b * a;
  }
  hctx.putImageData(hImg, 0, 0);
  octx.putImageData(oImg, 0, 0);

  return {
    heatmap: heat.toDataURL("image/png"),
    overlay: over.toDataURL("image/png"),
    label: null,
    confidence: null,
    demo: true,
  };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image"));
    };
    img.src = url;
  });
}

// simple box blur, in place
function blur(a, S, r) {
  const out = new Float32Array(a.length);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let sum = 0;
      let n = 0;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && xx < S && yy >= 0 && yy < S) {
            sum += a[yy * S + xx];
            n++;
          }
        }
      }
      out[y * S + x] = sum / n;
    }
  }
  a.set(out);
}

// colour ramp tied to the site palette: navy -> teal -> amber -> signal -> pink
const STOPS = [
  [0.0, [13, 17, 38]],
  [0.25, [53, 208, 182]],
  [0.5, [233, 162, 59]],
  [0.75, [255, 107, 74]],
  [1.0, [242, 86, 154]],
];

function colormap(t) {
  const v = Math.max(0, Math.min(1, t));
  for (let i = 1; i < STOPS.length; i++) {
    if (v <= STOPS[i][0]) {
      const [t0, c0] = STOPS[i - 1];
      const [t1, c1] = STOPS[i];
      const k = (v - t0) / (t1 - t0 || 1);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * k),
        Math.round(c0[1] + (c1[1] - c0[1]) * k),
        Math.round(c0[2] + (c1[2] - c0[2]) * k),
      ];
    }
  }
  return STOPS[STOPS.length - 1][1];
}
