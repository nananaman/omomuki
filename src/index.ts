import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { ChatOpenAI } from '@langchain/openai'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'

const app = new Hono()

// const API_KEY = process.env.API_KEY
const API_KEY = 'df4c6ae0-f269-41ce-a44d-e830b72c2323:Q2Mn0VZj+pErJ4ZHVk1ss2kKvrh0UTztB2HRIxwk'
const SAKURA_API_ENDPOINT = 'https://api.ai.sakura.ad.jp/v1/'
// const MODEL_NAME = 'preview/Qwen3-VL-30B-A3B-Instruct'
const MODEL_NAME = 'preview/Phi-4-multimodal-instruct'

const llm = new ChatOpenAI({
  model: MODEL_NAME,
  maxTokens: 1024,
  configuration: {
    baseURL: SAKURA_API_ENDPOINT,
    apiKey: API_KEY
  },
  streaming: true
})

const SYSTEM_PROMPT = `あなたは日本の美意識に精通した鑑賞者です。
与えられた画像やテキストから「趣（おもむき）」を見出してください。

<RULES>
- 文章は日本語で出力する
- 各「趣」は具体的な描写に基づいて、単独で完結したものにする
- 凝りすぎた表現は避け、自然でわかりやすい言葉を使う
- 各「趣」には type 属性を付与し、以下のいずれかから1つだけ選ぶ
  - 侘び寂び：不完全さや経年の美しさ
  - 幽玄：言葉にできない奥深い余韻
  - もののあはれ：移ろいゆくものへの哀惜
  - 風雅：自然との調和、季節感
- 各「趣」の説明では入力のどの要素がどう趣を生み出しているかを具体的に述べる
</RULES>

## 出力形式

1. **サマリ**：入力の情景や状況を1〜2文の自然な文章で表現
2. **趣**：見出した趣を1〜3個、XMLタグで表現

<omomuki type="侘び寂び|幽玄|もののあはれ|風雅">
情緒豊かな描写（1〜2文）
</omomuki>

## 出力例
### 1. 障害報告メールを送ろうとしたらメールサーバーも落ちていた

現代のインフラが見せる、皮肉な一幕です。

<omomuki type="もののあはれ">
「障害を報告する」という行為が、その障害によって阻まれている。伝える手段が失われたとき、私たちは当たり前に動いていたものの儚さに気づく。
</omomuki>

<omomuki type="幽玄">
送信ボタンを押しても何も起きない画面。エラーメッセージすら返ってこない沈黙に、システムの向こう側の深い闇を感じる。
</omomuki>


### 2. 議事録には『活発な議論が行われた』と書いてあるが、実際は沈黙だけだった

会議という儀式の、静かな記録です。

<omomuki type="幽玄">
「活発な議論」という文字と、誰も口を開かなかった現実。記録と記憶のあいだに、言葉にならなかった本音が漂っている。
</omomuki>

<omomuki type="侘び寂び">
議事録に残された定型句。その裏にある沈黙の時間こそが、この会議の本当の姿だった。
</omomuki>

### 3. 閉店セールの店に人が溢れているが、通常営業のときは誰もいなかった

商店街の片隅で、最後の賑わいを見ました。

<omomuki type="もののあはれ">
「閉店」の二文字を見て初めて足を運ぶ人々。普段は素通りしていた店への関心が、終わりの宣言によってようやく生まれる皮肉。
</omomuki>

<omomuki type="侘び寂び">
長年この場所で営んできた店が、最後の日に初めての賑わいを見せている。その遅すぎる繁盛に、街の移ろいを思う。
</omomuki>

それでは RULES を厳守し、以下の入力に基づいて趣のある要素を見出してください。
`

type StreamRequest = {
  text?: string
  imageUrl?: string
}

app.use('/*', serveStatic({ root: './public' }))

app.post('/api/stream', async (c) => {
  const body = await c.req.json<StreamRequest>()
  const { text, imageUrl } = body

  if (!text && !imageUrl) {
    return c.json({ error: 'text or imageUrl is required' }, 400)
  }

  const content: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  > = []

  if (imageUrl) {
    content.push({ type: 'image_url', image_url: { url: imageUrl } })
  }
  if (text) {
    content.push({ type: 'text', text })
  }

  const messages = [
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage({ content })
  ]

  return streamSSE(c, async (stream) => {
    const response = await llm.stream(messages)
    for await (const chunk of response) {
      const text = chunk.content as string
      if (text) {
        await stream.writeSSE({ data: text })
      }
    }
  })
})

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
