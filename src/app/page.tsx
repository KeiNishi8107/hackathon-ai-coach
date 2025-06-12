"use client";

import Header from "@/components/Header";
import TaskList from "@/components/TaskList";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase/client";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { ClipLoader } from "react-spinners";

interface Goal {
  id: string;
  text: string;
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [goal, setGoal] = useState("");
  const [isLoadingGoal, setIsLoadingGoal] = useState(true);
  const [mainGoal, setMainGoal] = useState<Goal | null>(null);

  // Firestoreにゴールを保存する関数
  const handleSaveGoal = async () => {
    if (!user) return;
    try {
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, { mainGoal: goal }, { merge: true });
      setMainGoal({ id: user.uid, text: goal });
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
          setMainGoal({ id: user.uid, text: fetchedGoal });
        }
        setIsLoadingGoal(false);
      } else if (!authLoading) {
        setIsLoadingGoal(false);
      }
    };

    fetchGoal();
  }, [user, authLoading]);

  const pageLoading = authLoading || isLoadingGoal;

  if (pageLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <ClipLoader size={50} color={"#123abc"} loading={pageLoading} />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 bg-gray-50 min-h-screen">
      {user ? (
        <div>
          <Header />
          <div className="mt-8 max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">AIコーチング＆タスク管理</h1>
            {mainGoal ? (
              <div>
                <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
                  <h2 className="text-2xl font-bold text-gray-700 mb-2">メインゴール</h2>
                  <p className="text-gray-600 text-lg">{mainGoal.text}</p>
                </div>
                <TaskList mainGoal={mainGoal} user={user} />
              </div>
            ) : (
              <div className="bg-white p-6 rounded-lg shadow-lg">
                <h2 className="text-2xl font-bold text-gray-700 mb-4">メインゴールを設定してください</h2>
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
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Focus on What Matters Most
          </h2>
          <p className="text-lg text-gray-600">
            ログインしてAIコーチとのセッションを始めましょう
          </p>
        </div>
      )}
    </div>
  );
}
