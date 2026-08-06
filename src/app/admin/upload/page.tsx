"use client";

import { useState } from "react";

type Status = "idle" | "uploading" | "success" | "error";

export default function AdminUploadPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setStatus("uploading");
    setMessage("");

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(data.error ?? "アップロードに失敗しました");
        return;
      }

      setStatus("success");
      setMessage(`取り込み完了: ${data.chunkCount}個のチャンクを登録しました`);
      form.reset();
    } catch {
      setStatus("error");
      setMessage("アップロードに失敗しました");
    }
  }

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-xl font-semibold mb-6">社内マニュアル取り込み(管理者用)</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">文書タイトル</span>
          <input
            name="title"
            type="text"
            required
            className="border rounded px-3 py-2"
            placeholder="例: 経費精算マニュアル"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">PDFファイル</span>
          <input
            name="file"
            type="file"
            accept="application/pdf"
            required
            className="border rounded px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={status === "uploading"}
          className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {status === "uploading" ? "取り込み中..." : "取り込む"}
        </button>
        {message && (
          <p
            className={
              status === "error" ? "text-red-600 text-sm" : "text-green-700 text-sm"
            }
          >
            {message}
          </p>
        )}
      </form>
    </main>
  );
}
