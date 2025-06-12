import {NextRequest, NextResponse} from "next/server";
import {OpenAI} from "openai";

// OpenAIクライアントの初期化
// APIキーは.env.localから自動的に読み込まれる
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface Task {
    id: string;
    text: string;
    completed: boolean;
}

interface RequestBody {
    mainGoal: string;
    tasks: Task[];
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();
    const {mainGoal, tasks} = body;

    // 1. 入力データ検証
    if (!mainGoal || !tasks) {
      return NextResponse.json(
        {error: "メインゴールとタスクリストは必須です。"},
        {status: 400},
      );
    }

     if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI APIキーが設定されていません。" },
        { status: 500 }
      );
    }

    // 2. プロンプトの生成
    const completedTasks = tasks.filter((task) => task.completed)
      .map((task) => task.text).join(", ") || "なし";
    const incompleteTasks = tasks.filter((task) => !task.completed)
      .map((task) => task.text).join(", ") || "なし";

    const prompt = `
あなたはプロの目標達成コーチです。
クライアントが目標達成に苦戦しているようです。以下の情報を元に、計画を立て直してください。
# クライアントの情報
- **最終ゴール:** ${mainGoal}
- **完了したタスク:** ${completedTasks}
- **未完了のタスク:** ${incompleteTasks}
# あなたのタスク
1. 上記の情報を分析し、クライアントがどこでつまずいている可能性が高いか推測してください。
2. その上で、最終ゴールを達成するために、より具体的で実行可能な新しいタスクリストを5つ提案してください。
3. タスクは簡潔で、具体的なアクションを示してください。
4. 回答は必ず "tasks" というキーを持つJSONオブジェクトの配列としてください。例: {"tasks": ["新しいタスク1", "新しいタスク2", "新しいタスク3", "新しいタスク4", "新しいタスク5"]}
5. 配列以外のテキスト(解説など)は一切含めないでください。
`;

    // 3. OpenAI APIの呼び出し
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [{role: "user", content: prompt}],
      response_format: {type: "json_object"},
      temperature: 0.7,
      max_tokens: 1000,
    });

    const aiResponse = response.choices[0].message?.content;

    if (!aiResponse) {
       return NextResponse.json(
        {error: "AIからの応答が空でした。"},
        {status: 500},
      );
    }
    
    // 4. レスポンスの解析と返却
    const parsedResponse = JSON.parse(aiResponse);
    
    return NextResponse.json(parsedResponse, {status: 200});

  } catch (error) {
    console.error("Error in generatePlan API route: ", error);
    return NextResponse.json(
      {error: "AIによる提案の生成中にエラーが発生しました。"},
      {status: 500},
    );
  }
} 