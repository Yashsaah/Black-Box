import { useCallback, useEffect, useRef, useState } from "react";
import SplitText from "../components/SplitText";
import { Reveal } from "../components/Layout";
import { runModel, demoHeatmap, hasBackend } from "../lib/model";

const MAX_MB = 8;

export default function TryModel() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | running | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [opacity, setOpacity] = useState(0.55);
  const inputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const accept = useCallback((f) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("That file isn't an image. Use a JPG, PNG, or WebP.");
      setStatus("error");
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`That image is over ${MAX_MB} MB. Pick a smaller one.`);
      setStatus("error");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setError(null);
    setStatus("idle");
  }, [preview]);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      accept(e.dataTransfer.files?.[0]);
    },
    [accept]
  );

  const run = useCallback(async () => {
    if (!file) return;
    setStatus("running");
    setError(null);
    try {
      const out = hasBackend ? await runModel(file) : await demoHeatmap(file);
      setResult(out);
      setStatus("done");
    } catch (err) {
      if (err?.message === "NO_BACKEND") {
        // shouldn't happen (hasBackend guards it) but fall back cleanly
        const out = await demoHeatmap(file);
        setResult(out);
        setStatus("done");
        return;
      }
      setError(
        "The model service didn't respond. Check the endpoint is running, or try again."
      );
      setStatus("error");
    }
  }, [file]);

  const reset = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setStatus("idle");
    if (inputRef.current) inputRef.current.value = "";
  }, [preview]);

  return (
    <section className="band shell">
      <Reveal variant="fade">
        <p className="eyebrow">Try the model · interactive</p>
      </Reveal>
      <SplitText as="h1" className="display" text="Run our CNN on your own image" />
      <Reveal variant="fade" delay={240}>
        <p className="lede">
          Drop in a photo and the network returns a heatmap of where it looked to make its call —
          the same Grad-CAM view we use to check a model is reading the subject, not the background.
        </p>
      </Reveal>

      <Reveal variant="rise" delay={320}>
        <p className="mono tm__mode">
          <span className={`tm__dot ${hasBackend ? "tm__dot--live" : ""}`} aria-hidden="true" />
          {hasBackend ? "live model connected" : "demo mode — heatmap generated in your browser"}
        </p>
      </Reveal>

      {/* Upload */}
      <Reveal variant="scale" delay={160}>
        <div
          className={`tm__drop ${dragging ? "is-drag" : ""} ${preview ? "has-file" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !preview && inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !preview) inputRef.current?.click();
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr"
            onChange={(e) => accept(e.target.files?.[0])}
          />
          {preview ? (
            <div className="tm__chosen">
              <img src={preview} alt="Selected input" className="tm__thumb" />
              <div className="tm__chosen-meta">
                <span className="tm__filename">{file?.name}</span>
                <span className="mono tm__hint">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                <div className="tm__actions">
                  <button
                    className="pen"
                    onClick={(e) => {
                      e.stopPropagation();
                      run();
                    }}
                    disabled={status === "running"}
                    aria-pressed={status === "running"}
                  >
                    <span className="pen__swatch" style={{ background: "var(--signal)" }} />
                    {status === "running" ? "Running…" : "Run the model"}
                  </button>
                  <button
                    className="pen"
                    onClick={(e) => {
                      e.stopPropagation();
                      inputRef.current?.click();
                    }}
                  >
                    Choose another
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="tm__prompt">
              <span className="tm__plus" aria-hidden="true">
                +
              </span>
              <p className="tm__cta">Drop an image here, or click to browse</p>
              <p className="mono tm__hint">JPG · PNG · WebP · up to {MAX_MB} MB</p>
            </div>
          )}
        </div>
      </Reveal>

      {status === "running" && (
        <p className="mono tm__status">
          <span className="tm__blink" aria-hidden="true" />
          {hasBackend ? "forward pass running on the server…" : "computing saliency in-browser…"}
        </p>
      )}

      {status === "error" && error && (
        <p className="mono tm__status tm__status--err">{error}</p>
      )}

      {/* Result */}
      {status === "done" && result && (
        <div className="tm__result">
          {(result.label || typeof result.confidence === "number") && (
            <div className="canvas__readout tm__readout">
              {result.label && (
                <span>
                  prediction <b>{result.label}</b>
                </span>
              )}
              {typeof result.confidence === "number" && (
                <span>
                  confidence <b>{(result.confidence * 100).toFixed(1)}%</b>
                </span>
              )}
            </div>
          )}

          <div className="tm__grid">
            <figure className="figure tm__fig">
              <img src={preview} alt="Original input" />
              <figcaption>Input · your image</figcaption>
            </figure>

            <figure className="figure tm__fig">
              <img src={result.heatmap} alt="Model heatmap" />
              <figcaption>Heatmap · where the network looked</figcaption>
            </figure>

            {result.overlay && (
              <figure className="figure tm__fig">
                <div className="tm__overlay">
                  <img src={preview} alt="" />
                  <img src={result.overlay} alt="Heatmap over input" style={{ opacity }} />
                </div>
                <figcaption>
                  <label className="tm__slider">
                    Overlay
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={opacity}
                      onChange={(e) => setOpacity(Number(e.target.value))}
                    />
                  </label>
                </figcaption>
              </figure>
            )}
          </div>

          <div className="tm__actions tm__actions--end">
            <button className="pen" onClick={reset}>
              Try another image
            </button>
            {result.demo && (
              <span className="mono tm__hint">
                Demo output — connect the CNN endpoint for real Grad-CAM.
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
