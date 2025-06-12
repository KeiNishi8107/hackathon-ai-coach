"use client";

import { useState, useEffect, useMemo } from "react";
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
import { useAuth } from "@/contexts/AuthContext";
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { ClipLoader } from "react-spinners";

interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: Timestamp;
  priority: '高' | '中' | '低';
  dueDate: string; // YYYY-MM-DD 形式の文字列
  estimatedTime: number; // 分単位
  order: number; // 並び順のためのフィールド
}

interface TaskListProps {
  user: User;
  mainGoal: { id: string; text: string };
}

export default function TaskList({ user, mainGoal }: TaskListProps) {
  const { user: authUser } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState({
    text: '',
    priority: '中' as '高' | '中' | '低',
    dueDate: '',
    estimatedTime: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // AI機能関連のstate
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestedTasks, setAiSuggestedTasks] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // フィルタリングとソートの状態
  const [filterPriority, setFilterPriority] = useState<'すべて' | '高' | '中' | '低'>('すべて');
  const [sortBy, setSortBy] = useState<'order' | 'dueDate'>('order');

  // Firestoreからタスクを取得 (リアルタイム更新)
  useEffect(() => {
    if (!authUser) return;
    setLoading(true);
    const tasksColRef = collection(db, "users", authUser.uid, "goals", mainGoal.id, "tasks");
    const q = query(tasksColRef, orderBy("order", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const tasksData: Task[] = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            text: data.text,
            completed: data.completed,
            createdAt: data.createdAt,
            priority: data.priority,
            dueDate: data.dueDate,
            estimatedTime: data.estimatedTime,
            order: data.order,
          };
        });
        setTasks(tasksData);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching tasks: ", error);
        setError('タスクの読み込みに失敗しました。');
        setLoading(false);
      }
    );

    // クリーンアップ関数
    return () => unsubscribe();
  }, [authUser, mainGoal.id]);

  const filteredAndSortedTasks = useMemo(() => {
    let processedTasks = [...tasks];

    // 優先度フィルタリング
    if (filterPriority !== 'すべて') {
      processedTasks = processedTasks.filter(task => task.priority === filterPriority);
    }

    // ソート
    if (sortBy === 'dueDate') {
        processedTasks.sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });
    }
    // sortByが 'order' の場合は、Firestoreから取得した順序を維持する

    return processedTasks;
  }, [tasks, filterPriority, sortBy]);

  // mainGoalが存在しない場合は何もレンダリングしない
  // if (!mainGoal) {
  //   return null;
  // }

  // 新しいタスクを追加
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const textToSave = newTask.text.trim();
    if (textToSave === "" || !authUser || !mainGoal.id) return;

    const optimisticTask: Task = {
      id: new Date().toISOString(),
      text: textToSave,
      completed: false,
      createdAt: Timestamp.now(),
      priority: newTask.priority,
      dueDate: newTask.dueDate,
      estimatedTime: newTask.estimatedTime,
      order: tasks.length > 0 ? Math.max(...tasks.map(t => t.order)) + 1 : 0,
    };

    setTasks(prevTasks => [...prevTasks, optimisticTask]);
    
    setNewTask({
      text: '',
      priority: '中',
      dueDate: '',
      estimatedTime: 0,
    });

    try {
      const tasksColRef = collection(db, "users", authUser.uid, "goals", mainGoal.id, "tasks");
      await addDoc(tasksColRef, {
        text: optimisticTask.text,
        completed: false,
        createdAt: optimisticTask.createdAt,
        priority: optimisticTask.priority,
        dueDate: optimisticTask.dueDate,
        estimatedTime: optimisticTask.estimatedTime,
        order: optimisticTask.order,
      });
    } catch (error) {
      console.error("Error adding task: ", error);
      setError('タスクの追加に失敗しました。');
      setTasks(prevTasks => prevTasks.filter(task => task.id !== optimisticTask.id));
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    
    if(filterPriority !== 'すべて' || sortBy !== 'order') {
        alert('タスクの並び替えは、フィルタが「すべて」で並び順が「カスタム」の時のみ可能です。');
        return;
    }

    const newTasks = Array.from(tasks);
    const [removed] = newTasks.splice(source.index, 1);
    newTasks.splice(destination.index, 0, removed);

    setTasks(newTasks);

    const batch = writeBatch(db);
    newTasks.forEach((task, index) => {
        const taskRef = doc(db, 'users', authUser!.uid, 'goals', mainGoal.id, 'tasks', task.id);
        batch.update(taskRef, { order: index });
    });

    try {
        await batch.commit();
    } catch(error) {
        console.error("Failed to update task order:", error);
        setError("タスクの順序更新に失敗しました。ページをリロードしてください。");
        setTasks(tasks);
    }
  };

  // タスクの完了状態をトグル
  const handleToggleTask = async (taskId: string, completed: boolean) => {
    if (!authUser || !mainGoal.id) return;
    const taskDocRef = doc(db, "users", authUser.uid, "goals", mainGoal.id, "tasks", taskId);
    try {
      await updateDoc(taskDocRef, { completed: !completed });
    } catch (error) {
      console.error("Error updating task: ", error);
    }
  };

  // タスクを削除
  const handleDeleteTask = async (taskId: string) => {
    if (!authUser || !mainGoal.id) return;
    const taskDocRef = doc(db, "users", authUser.uid, "goals", mainGoal.id, "tasks", taskId);
    try {
      await deleteDoc(taskDocRef);
    } catch (error) {
      console.error("Error deleting task: ", error);
    }
  };

  // AIに計画の再生成をリクエスト
  const handleGeneratePlan = async () => {
    if (!authUser || !mainGoal.id) return;
    setIsLoadingAI(true);
    setAiError(null);
    setError('');
    
    const currentTasks = tasks.map(t => ({
      text: t.text,
      completed: t.completed,
      priority: t.priority,
      dueDate: t.dueDate,
    }));

    try {
      const response = await fetch("/api/generatePlan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mainGoal: mainGoal.text, tasks: currentTasks }),
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
    if (!authUser || aiSuggestedTasks.length === 0 || !mainGoal.id) return;

    const tasksColRef = collection(db, "users", authUser.uid, "goals", mainGoal.id, "tasks");
    
    try {
      // バッチ処理を開始
      const batch = writeBatch(db);

      // 既存のタスクをすべて削除
      tasks.forEach((task) => {
        const taskDocRef = doc(tasksColRef, task.id);
        batch.delete(taskDocRef);
      });

      // 新しいタスクを追加
      aiSuggestedTasks.forEach((taskText, index) => {
        const newDocRef = doc(tasksColRef); // 新しいドキュメント参照を作成
        batch.set(newDocRef, {
          text: taskText,
          completed: false,
          createdAt: Timestamp.now(),
          priority: '中',
          dueDate: '',
          estimatedTime: 0,
          order: tasks.length > 0 ? Math.max(...tasks.map(t => t.order)) + index + 1 : index + 1,
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

  const getPriorityColor = (priority: '高' | '中' | '低') => ({
    '高': 'bg-red-200 text-red-800',
    '中': 'bg-yellow-200 text-yellow-800',
    '低': 'bg-sky-200 text-sky-800', // blue -> sky for better contrast
  }[priority] || 'bg-gray-200 text-gray-800');

  return (
    <div className="mt-8">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
            ゴール達成のためのタスクリスト
        </h3>
        <div className="bg-slate-100 p-4 rounded-lg shadow-inner mb-6">
            <h4 className="text-lg font-semibold mb-2 text-gray-700">新しいタスクを追加</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <input
                type="text"
                value={newTask.text}
                onChange={(e) => setNewTask({ ...newTask, text: e.target.value })}
                placeholder="タスク内容"
                className="md:col-span-2 p-2 border border-slate-300 rounded text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
                <select
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as '高' | '中' | '低' })}
                className="p-2 border border-slate-300 rounded text-gray-900 focus:ring-2 focus:ring-blue-500"
                >
                    <option value="高">優先度：高</option>
                    <option value="中">優先度：中</option>
                    <option value="低">優先度：低</option>
                </select>
                <input
                type="date"
                value={newTask.dueDate}
                onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                className="p-2 border border-slate-300 rounded text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
                <input
                type="number"
                value={newTask.estimatedTime}
                onChange={(e) => setNewTask({ ...newTask, estimatedTime: parseInt(e.target.value, 10) || 0 })}
                placeholder="所要時間(分)"
                className="p-2 border border-slate-300 rounded text-gray-900 focus:ring-2 focus:ring-blue-500"
                min="0"
                />
            </div>
            <button
            onClick={handleAddTask}
            className="w-full bg-emerald-600 text-white p-2 rounded hover:bg-emerald-700 transition-colors font-semibold"
            >
            タスクを追加
            </button>
        </div>

        <div className="flex flex-wrap justify-between items-center mb-4 p-3 bg-white rounded-lg shadow">
            <div className="flex items-center space-x-4">
                <div>
                    <label htmlFor="filter-priority" className="text-sm font-medium text-gray-700 mr-2">優先度:</label>
                    <select
                    id="filter-priority"
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value as typeof filterPriority)}
                    className="p-2 border border-slate-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="すべて">すべて</option>
                        <option value="高">高</option>
                        <option value="中">中</option>
                        <option value="低">低</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="sort-by" className="text-sm font-medium text-gray-700 mr-2">並び順:</label>
                    <select
                    id="sort-by"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="p-2 border border-slate-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="order">カスタム</option>
                        <option value="dueDate">期限（近い順）</option>
                    </select>
                </div>
            </div>
        </div>

        {loading ? (
            <div className="flex justify-center items-center p-8">
                <ClipLoader size={40} color={"#4a90e2"} loading={loading} />
            </div>
        ) : tasks.length === 0 ? (
            <div className="text-center p-8 bg-white rounded-lg shadow">
                <p className="text-gray-600">タスクはありません。最初のタスクを追加しましょう！</p>
            </div>
        ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="tasks">
                    {(provided) => (
                        <ul
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-3"
                        >
                        {filteredAndSortedTasks.map((task, index) => (
                            <Draggable key={task.id} draggableId={task.id} index={index}>
                                {(provided, snapshot) => (
                                    <li
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`bg-white p-4 rounded-lg shadow-md hover:shadow-lg ${snapshot.isDragging ? 'shadow-2xl ring-2 ring-blue-500' : 'ring-1 ring-transparent'}`}
                                    >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center flex-grow min-w-0">
                                            <input
                                            type="checkbox"
                                            checked={task.completed}
                                            onChange={(e) => handleToggleTask(task.id, e.target.checked)}
                                            className="mr-4 h-5 w-5 text-blue-600 focus:ring-blue-500 rounded flex-shrink-0"
                                            />
                                            <span className={`flex-grow truncate ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                            {task.text}
                                            </span>
                                        </div>
                                        <div className="flex items-center space-x-3 flex-shrink-0 ml-4">
                                            <span className={`px-3 py-1 text-xs font-bold rounded-full ${getPriorityColor(task.priority)}`}>
                                            {task.priority}
                                            </span>
                                            {task.dueDate && (
                                                <span className="text-sm text-gray-500 hidden sm:inline">
                                                    <span className="font-semibold">期限:</span> {task.dueDate}
                                                </span>
                                            )}
                                            {task.estimatedTime > 0 && (
                                                <span className="text-sm text-gray-500 hidden sm:inline">
                                                    <span className="font-semibold">{task.estimatedTime}</span>分
                                                </span>
                                            )}
                                            <button
                                            onClick={() => handleDeleteTask(task.id)}
                                            className="text-gray-500 hover:text-red-600 transition-colors"
                                            aria-label="タスクを削除"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                    </li>
                                )}
                            </Draggable>
                        ))}
                        {provided.placeholder}
                        </ul>
                    )}
                </Droppable>
            </DragDropContext>
        )}

        {/* AIコーチ機能のUI */}
        <div className="mt-8 pt-6 border-t border-gray-200">
            <h4 className="text-lg font-semibold text-gray-700 mb-2">行き詰まりましたか？</h4>
            <p className="text-gray-600 mb-4">AIコーチがあなたの状況を分析し、新しい計画を提案します。</p>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <button
            onClick={handleGeneratePlan}
            disabled={isLoadingAI}
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-400 flex items-center justify-center gap-2"
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