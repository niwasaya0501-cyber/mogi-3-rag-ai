"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";

export default function ChatPage() {
  const { messages, sendMessage, status, error } = useChat();
  const [input, setInput] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput("");
  }

  return (
    <main className="mx-auto flex h-dvh max-w-2xl flex-col p-4">
      <h1 className="mb-4 text-lg font-semibold">社内マニュアル検索チャット</h1>

      <div className="flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.length === 0 && (
          <p className="text-sm text-gray-500">
            社内マニュアルについて質問してください。回答には出典(文書名・ページ)が付与されます。
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={
              message.role === "user"
                ? "ml-auto max-w-[80%] rounded-lg bg-black px-3 py-2 text-white"
                : "mr-auto max-w-[80%] whitespace-pre-wrap rounded-lg bg-gray-100 px-3 py-2 text-black"
            }
          >
            {message.parts.map((part, i) =>
              part.type === "text" ? <span key={i}>{part.text}</span> : null
            )}
          </div>
        ))}
        {status === "streaming" && (
          <p className="text-sm text-gray-400">回答を生成中...</p>
        )}
        {error && (
          <p className="mr-auto max-w-[80%] rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            回答の取得に失敗しました。時間をおいて再度お試しください。
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t pt-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="質問を入力してください"
          className="flex-1 rounded border px-3 py-2"
        />
        <button
          type="submit"
          disabled={status === "streaming"}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          送信
        </button>
      </form>
    </main>
  );
}
