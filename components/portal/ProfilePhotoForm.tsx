"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent } from "react";
import styles from "./portal.module.css";

const MAX_UPLOAD_BYTES = 500 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png"]);

function imageBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

export function ProfilePhotoForm({
  currentPhotoUrl,
  displayName,
}: {
  currentPhotoUrl?: string | null;
  displayName: string;
}) {
  const router = useRouter();
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setMessage("");
    if (!file) return;
    if (!allowedTypes.has(file.type)) {
      setMessage("Choose a JPG, JPEG, or PNG image.");
      event.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessage("Choose an image smaller than 10 MB before cropping.");
      event.target.value = "";
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSourceFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
  }

  async function createCroppedPhoto() {
    if (!sourceFile || !previewUrl) throw new Error("Choose a photo first.");
    const image = new window.Image();
    image.src = previewUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The selected image could not be read."));
    });

    const cropSize = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
    const maxShiftX = Math.max(0, (image.naturalWidth - cropSize) / 2);
    const maxShiftY = Math.max(0, (image.naturalHeight - cropSize) / 2);
    const centerX = image.naturalWidth / 2 - (offsetX / 100) * maxShiftX;
    const centerY = image.naturalHeight / 2 - (offsetY / 100) * maxShiftY;
    const sourceX = Math.max(0, Math.min(image.naturalWidth - cropSize, centerX - cropSize / 2));
    const sourceY = Math.max(0, Math.min(image.naturalHeight - cropSize, centerY - cropSize / 2));

    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Photo cropping is unavailable in this browser.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      image,
      sourceX,
      sourceY,
      cropSize,
      cropSize,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    for (const quality of [0.9, 0.8, 0.7, 0.6]) {
      const blob = await imageBlob(canvas, quality);
      if (blob && blob.size <= MAX_UPLOAD_BYTES) return blob;
    }
    throw new Error("The cropped photo is still larger than 500 KB. Choose a simpler image.");
  }

  async function uploadPhoto() {
    if (!sourceFile || working) return;
    setWorking(true);
    setMessage("");
    try {
      const cropped = await createCroppedPhoto();
      const body = new FormData();
      body.set("file", new File([cropped], "profile-photo.jpg", { type: "image/jpeg" }));
      const response = await fetch("/api/profile/photo", { method: "POST", body });
      const result = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(result.error?.message ?? "The photo could not be uploaded.");
      setMessage("Profile photo updated.");
      setSourceFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The photo could not be uploaded.");
    } finally {
      setWorking(false);
    }
  }

  const shownPhoto = previewUrl ?? currentPhotoUrl ?? null;
  return (
    <div className={styles.photoEditor}>
      <div className={styles.photoCropFrame}>
        {shownPhoto ? (
          <Image
            src={shownPhoto}
            alt={`${displayName} profile preview`}
            fill
            sizes="220px"
            unoptimized
            style={previewUrl ? {
              objectFit: "cover",
              transform: `translate(${offsetX / 3}%, ${offsetY / 3}%) scale(${zoom})`,
            } : { objectFit: "cover" }}
          />
        ) : (
          <span>{displayName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}</span>
        )}
      </div>
      <div className={styles.photoEditorControls}>
        <div>
          <h3>Profile photo</h3>
          <p>Choose JPG, JPEG, or PNG. The cropped upload is restricted to 500 KB.</p>
        </div>
        <label className={styles.secondaryButton}>
          Choose photo
          <input className={styles.srOnly} type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" onChange={choosePhoto} />
        </label>
        {previewUrl ? (
          <div className={styles.cropControls}>
            <label><span>Zoom</span><input type="range" min="1" max="3" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
            <label><span>Horizontal</span><input type="range" min="-100" max="100" value={offsetX} onChange={(event) => setOffsetX(Number(event.target.value))} /></label>
            <label><span>Vertical</span><input type="range" min="-100" max="100" value={offsetY} onChange={(event) => setOffsetY(Number(event.target.value))} /></label>
            <button className={styles.primaryButton} type="button" disabled={working} onClick={uploadPhoto}>{working ? "Uploading…" : "Crop & upload"}</button>
          </div>
        ) : null}
        {message ? <p className={styles.formStatus} role="status">{message}</p> : null}
      </div>
    </div>
  );
}
