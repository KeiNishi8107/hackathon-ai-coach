"use client";

import { useState, useEffect, useCallback } from "react";
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
}

export default function TaskList({ user }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState("");
  const [loading, setLoading] = useState(true);

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
    </div>
  );
} 