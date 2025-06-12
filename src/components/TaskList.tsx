"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase/client";
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  orderBy,
  writeBatch,
} from "firebase/firestore";
import type { User } from "firebase/auth";

interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: Timestamp;
}

interface TaskListProps {
  user: User;
  mainGoal: string;
}

export default function TaskList({ user, mainGoal }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState("");
  const [loading, setLoading] = useState(true);

  // AI機能関連のstate
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestedTasks, setAiSuggestedTasks] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Firestoreからタスクを取得 (リアルタイム更新)
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const tasksColRef = collection(db, "users", user.uid, "tasks");
    const q = query(tasksColRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const tasksData: Task[] = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          text: doc.data().text,
          completed: doc.data().completed,
          createdAt: doc.data().createdAt,
        }));
        setTasks(tasksData);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching tasks: ", error);
        setLoading(false);
      }
    );

    // クリーンアップ関数
    return () => unsubscribe();
  }, [user]);

  // 新しいタスクを追加
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const textToSave = newTaskText.trim();
    if (textToSave === "" || !user) return;

    setNewTaskText(""); // 先に入力欄をクリアしてUIの応答性を向上させる

    try {
      const tasksColRef = collection(db, "users", user.uid, "tasks");
      await addDoc(tasksColRef, {
        text: textToSave,
        completed: false,
        createdAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error adding task: ", error);
      alert("タスクの追加に失敗しました。");
      setNewTaskText(textToSave); // エラーが発生した場合は入力内容を復元
    }
  };

  // タスクの完了状態をトグル
  const handleToggleTask = async (taskId: string, completed: boolean) => {
    if (!user) return;
    const taskDocRef = doc(db, "users", user.uid, "tasks", taskId);
    try {
      await updateDoc(taskDocRef, { completed: !completed });
    } catch (error) {
      console.error("Error updating task: ", error);
    }
  };

  // タスクを削除
  const handleDeleteTask = async (taskId: string) => {
    if (!user) return;
    const taskDocRef = doc(db, "users", user.uid, "tasks", taskId);
    try {
      await deleteDoc(taskDocRef);
    } catch (error) {
      console.error("Error deleting task: ", error);
    }
  };

  // AIに計画の再生成をリクエスト
  const handleGeneratePlan = async () => {
    setIsLoadingAI(true);
    setAiError(null);
    try {
      const response = await fetch("/api/generatePlan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mainGoal, tasks }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "AIの応答取得に失敗しました。");
      }

      const data = await response.json();
      setAiSuggestedTasks(data.tasks);
      setIsModalOpen(true);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "予期せぬエラーが発生しました。");
    } finally {
      setIsLoadingAI(false);
    }
  };

  // AIの提案を受け入れる
  const handleAcceptSuggestion = async () => {
    if (!user || aiSuggestedTasks.length === 0) return;

    const tasksColRef = collection(db, "users", user.uid, "tasks");
    
    try {
      // バッチ処理を開始
      const batch = writeBatch(db);

      // 既存のタスクをすべて削除
      tasks.forEach((task) => {
        const taskDocRef = doc(tasksColRef, task.id);
        batch.delete(taskDocRef);
      });

      // 新しいタスクを追加
      aiSuggestedTasks.forEach((taskText) => {
        const newDocRef = doc(tasksColRef); // 新しいドキュメント参照を作成
        batch.set(newDocRef, {
          text: taskText,
          completed: false,
          createdAt: Timestamp.now(),
        });
      });

      // バッチ処理をコミット
      await batch.commit();

    } catch (error) {
       console.error("Error updating tasks with AI suggestion: ", error);
       alert("AIの提案の適用に失敗しました。");
    } finally {
        setIsModalOpen(false);
        setAiSuggestedTasks([]);
    }
  };

  return (
    <div className="mt-8">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
            ゴール達成のためのタスクリスト
        </h3>
        <form onSubmit={handleAddTask} className="flex gap-2 mb-4">
            <input
            type="text"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            placeholder="新しいタスクを追加"
            className="flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 placeholder-gray-400"
            />
            <button
            type="submit"
            className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
            追加
            </button>
        </form>

        {loading ? (
            <p className="text-gray-600">タスクを読み込み中...</p>
        ) : tasks.length === 0 ? (
            <p className="text-gray-600">タスクはありません。最初のタスクを追加しましょう！</p>
        ) : (
            <ul className="space-y-3">
            {tasks.map((task) => (
                <li
                key={task.id}
                className="flex items-center justify-between bg-white p-4 rounded-md shadow"
                >
                <div className="flex items-center">
                    <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => handleToggleTask(task.id, task.completed)}
                    className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span
                    className={`ml-3 text-lg ${
                        task.completed ? "text-gray-500 line-through" : "text-gray-800"
                    }`}
                    >
                    {task.text}
                    </span>
                </div>
                <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="text-gray-400 hover:text-red-500"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                </li>
            ))}
            </ul>
        )}

        {/* AIコーチ機能のUI */}
        <div className="mt-8 pt-6 border-t border-gray-200">
            <h4 className="text-lg font-semibold text-gray-700 mb-2">行き詰まりましたか？</h4>
            <p className="text-gray-600 mb-4">AIコーチがあなたの状況を分析し、新しい計画を提案します。</p>
            <button
            onClick={handleGeneratePlan}
            disabled={isLoadingAI}
            className="w-full px-4 py-2 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-purple-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
            {isLoadingAI ? (
                <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                分析中...
                </>
            ) : (
                "AIコーチに計画を相談する"
            )}
            </button>
            {aiError && <p className="mt-2 text-sm text-red-600">{aiError}</p>}
        </div>

        {/* AI提案モーダル */}
        {isModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
                <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">AIコーチからの新しい提案</h3>
                    <p className="mb-4 text-gray-600">現在の計画に代わって、以下の新しいタスクリストを提案します。これにより、目標達成に近づけるはずです。</p>
                    <ul className="space-y-2 mb-6 list-disc list-inside bg-gray-50 p-4 rounded-md">
                        {aiSuggestedTasks.map((task, index) => (
                            <li key={index} className="text-gray-700">{task}</li>
                        ))}
                    </ul>
                    <div className="flex justify-end gap-4">
                        <button 
                        onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded-md hover:bg-gray-300"
                        >
                            拒否する
                        </button>
                        <button
                        onClick={handleAcceptSuggestion}
                        className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700"
                        >
                            この提案を採用する
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
} 