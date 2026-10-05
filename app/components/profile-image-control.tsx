"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { apiRequest } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

type ProfileImageResult = { imageUrl: string };

export function ProfileImageControl({
  imageUrl,
  name,
  onImageUploaded,
}: {
  imageUrl?: string;
  name: string;
  onImageUploaded: (imageUrl: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file to upload.");
      return;
    }

    const token = getAccessToken();
    if (!token) {
      setError("Your session has expired. Please log in again.");
      return;
    }

    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("profileImage", file);
      const response = await apiRequest<ProfileImageResult>(
        "/api/v1/user/profile-image",
        { method: "PATCH", body },
        token,
      );
      onImageUploaded(response.data.imageUrl);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to upload your profile image.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="profile-photo-control">
      <button
        aria-label={`Change ${name}'s profile image`}
        className="profile-photo"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={`${name}'s profile`} src={imageUrl} />
        ) : (
          <span className="avatar">{name.charAt(0).toUpperCase()}</span>
        )}
      </button>
      <input
        accept="image/*"
        className="profile-photo-input"
        onChange={(event) => void uploadImage(event)}
        ref={inputRef}
        type="file"
      />
      <button
        className="profile-photo-change"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        {uploading ? "Uploading…" : "Change photo"}
      </button>
      {error && <span className="profile-photo-error" role="alert">{error}</span>}
    </div>
  );
}
