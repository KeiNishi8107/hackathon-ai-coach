"use client";

import Header from "@/components/Header";
import TaskList from "@/components/TaskList";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase/client";
import { doc, setDoc, getDoc } from "firebase/firestore";

export default function Home() {
  const { user, loading } = useAuth();
  const [goal, setGoal] = useState("");
  const [savedGoal, setSavedGoal] = useState("");
  const [isLoadingGoal, setIsLoadingGoal] = useState(true);

  // Firestoreにゴールを保存する関数
  const handleSaveGoal = async () => {
    if (!user) return;
    try {
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, { mainGoal: goal }, { merge: true });
      setSavedGoal(goal);
      alert("ゴールを保存しました！");
    } catch (error) {
      console.error("Error saving goal: ", error);
      alert("ゴールの保存に失敗しました。");
    }
  };

  // ページ読み込み時にFirestoreからゴールを取得する
  useEffect(() => {
    const fetchGoal = async () => {
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists() && docSnap.data().mainGoal) {
          const fetchedGoal = docSnap.data().mainGoal;
          setSavedGoal(fetchedGoal);
          setGoal(fetchedGoal);
        }
        setIsLoadingGoal(false);
      } else if (!loading) {
        setIsLoadingGoal(false);
      }
    };

    fetchGoal();
  }, [user, loading]);


  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="container mx-auto p-8">
        {loading ? (
          <p className="text-gray-800">Loading...</p>
        ) : user ? (
          <div className="bg-white p-8 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">
              Welcome, {user.displayName}!
            </h2>

            {isLoadingGoal ? <p className="text-gray-800">あなたのゴールを読み込み中...</p> : 
              savedGoal ? (
              <div className="mb-6 p-4 bg-blue-100 border-l-4 border-blue-500 text-blue-700">
                <p className="font-bold">現在のあなたのゴール</p>
                <p className="text-xl">{savedGoal}</p>
              </div>
            ) : (
              <p className="mb-6 text-gray-600">Your journey to success starts now. Let's set your main goal.</p>
            )}

            <div className="space-y-4">
              <label htmlFor="goal" className="block text-lg font-medium text-gray-700">
                あなたの最終ゴールを入力してください
              </label>
              <input
                type="text"
                id="goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="例：副業で月10万円稼ぐ"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 placeholder-gray-400"
              />
              <button
                onClick={handleSaveGoal}
                className="w-full px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                ゴールを保存・更新する
              </button>
            </div>
            
            {savedGoal && <TaskList user={user} />}

          </div>
        ) : (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">
              Focus on What Matters Most
            </h2>
            <p className="text-lg text-gray-600">
              Please log in to start your session with your personal AI coach.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
