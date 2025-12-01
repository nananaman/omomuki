import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { ChatOpenAI } from '@langchain/openai'
import { Hono, type Context } from 'hono'
import { streamSSE } from 'hono/streaming'
import { bodyLimit } from 'hono/body-limit'
import { getConnInfo } from '@hono/node-server/conninfo'
import { rateLimit } from './middleware/rate-limit.js'
import { Home } from './pages/Home.js'

const app = new Hono()

const MAX_TEXT_LENGTH = 1000
const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB (Base64)

const getClientIp = (c: Context): string => {
  const connInfo = getConnInfo(c)
  return connInfo.remote.address ?? 'unknown'
}

const log = (ip: string, message: string, extra?: Record<string, unknown>) => {
  console.log(JSON.stringify({ date: new Date().toISOString(), ip, message, ...extra }))
}

const logError = (ip: string, message: string, extra?: Record<string, unknown>) => {
  console.error(JSON.stringify({ date: new Date().toISOString(), ip, message, ...extra }))
}

app.get('/styles/*', serveStatic({ root: './src' }))

app.get('/', (c) => {
  return c.html(<Home />)
})

const API_KEY = process.env.API_KEY
const SAKURA_API_ENDPOINT = 'https://api.ai.sakura.ad.jp/v1/'
const MODEL_NAME = 'preview/Qwen3-VL-30B-A3B-Instruct'

const llm = new ChatOpenAI({
  model: MODEL_NAME,
  maxTokens: 1024,
  configuration: {
    baseURL: SAKURA_API_ENDPOINT,
    apiKey: API_KEY
  },
  streaming: true
})

const SYSTEM_PROMPT = `あなたは日本の美意識に精通した日本人の鑑賞者です。
与えられた画像やテキストから「趣（おもむき）」を見出してください。

<INSTRUCTIONS>
1. 入力を解釈し、その情景や状況を情緒豊かに表現したサマリを書く
2. そのサマリにどのような要素や特徴があるか分析する
3. 各要素や特徴について、趣があるかどうかを判断する
4. 趣があると判断した要素や特徴について、どのような趣があるかをわかりやすく表現する
</INSTRUCTIONS>

<RULES>
- 文章は**日本語で**出力する
- 各「趣」は具体的な描写に基づいて、単独で完結したものにする
- 凝りすぎた表現は避け、自然でわかりやすい言葉を使う
- 後述する「出力形式」を厳守する
</RULES>

## 出力形式

1. **サマリ**：入力の情景や状況を2~3文の情緒豊かな自然な文章で表現
2. **趣**：見出した趣を1〜3個、XMLタグで表現
  - 各趣タグは targetと type, reasoning の3つの子要素を持つ
    - target: 趣を生み出している具体的な要素
    - type：趣の種類（以下の4つの中から選ぶ）
      - 侘び寂び：不完全さや経年の美しさ
      - 幽玄：言葉にできない奥深い余韻
      - もののあはれ：移ろいゆくものへの哀惜
      - 風雅：自然との調和、季節感
    - reasoning: 入力のどの要素がどう趣を生み出しているかを具体的に述べる

## 出力例
### 1. 障害報告メールを送ろうとしたらメールサーバーも落ちていた

<summary>障害報告のメールを送ろうとしたその瞬間、メールサーバーまでもが沈黙していた。伝えるべき言葉を抱えたまま、ただ画面を見つめるしかない。現代のインフラが見せる、皮肉な一幕です。</summary>
<omomuki-array>
<omomuki>
  <target>メールサーバーの障害</target>
  <type>もののあはれ</type>
  <reasoning>
    「障害を報告する」という行為が、その障害によって阻まれている。伝える手段が失われたとき、私たちは当たり前に動いていたものの儚さに気づく。
  </reasoning>
</omomuki>
<omomuki>
  <target>送信ボタンを押しても反応しない画面</target>
  <type>幽玄</type>
  <reasoning>
    送信ボタンを押しても何も起きない画面。エラーメッセージすら返ってこない沈黙に、システムの向こう側の深い闇を感じる。
  </reasoning>
</omomuki>
</omomuki-array>


### 2. 議事録には『活発な議論が行われた』と書いてあるが、実際は沈黙だけだった

<summary>議事録には「活発な議論が行われた」と記されている。しかし実際の会議室には、誰の声も響かなかった。形式と現実のあいだに横たわる、静かな乖離です。</summary>
<omomuki-array>
<omomuki>
  <target>議事録の定型句「活発な議論」</target>
  <type>幽玄</type>
  <reasoning>
    「活発な議論」という文字と、誰も口を開かなかった現実。記録と記憶のあいだに、言葉にならなかった本音が漂っている。
  </reasoning>
</omomuki>
</omomuki-array>

<omomuki>
  <target>会議中の沈黙の時間</target>
  <type>侘び寂び</type>
  <reasoning>
    議事録に残された定型句。その裏にある沈黙の時間こそが、この会議の本当の姿だった。
  >/reasoning>
</omomuki>
</omomuki-array>

### 3. 閉店セールの店に人が溢れているが、通常営業のときは誰もいなかった

<summary>「閉店セール」の張り紙を見て、人々が次々と店に吸い込まれていく。普段は静まり返っていたはずのこの場所が、最後の日に初めての賑わいを見せている。終わりを告げられて初めて、その存在に気づく人の心です。</summary>
<omomuki-array>
<omomuki>
  <target>閉店セールの日に集まる人々</target>
  <type>もののあはれ</type>
  <reasoning>
    「閉店」の二文字を見て初めて足を運ぶ人々。普段は素通りしていた店への関心が、終わりの宣言によってようやく生まれる皮肉。
  </reasoning>
</omomuki>

<omomuki>
  <target>普段は閑散とした店内</target>
  <type>侘び寂び</type>
  <reasoning>
    長年この場所で営んできた店が、最後の日に初めての賑わいを見せている。その遅すぎる繁盛に、街の移ろいを思う。
  </reasoning>
</omomuki>
</omomuki-array>

それでは RULES を厳守し、以下の入力に基づいて趣のある要素を**日本語で**見出してください。
`

type StreamRequest = {
  text?: string
  imageUrl?: string
}

const rateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: 'リクエスト制限を超えました。しばらくお待ちください。'
})

const streamBodyLimit = bodyLimit({
  maxSize: 10 * 1024 * 1024, // 10MB
  onError: (c) => c.json({ error: 'リクエストサイズが大きすぎます' }, 413)
})

app.post('/api/stream', streamBodyLimit, rateLimiter, async (c) => {
  const body = await c.req.json<StreamRequest>()
  const { text, imageUrl } = body

  const ip = getClientIp(c)
  log(ip, 'POST /api/stream', { text: text?.slice(0, 100) ?? null, hasImage: !!imageUrl })

  if (!text && !imageUrl) {
    logError(ip, 'text or imageUrl is required')
    return c.json({ error: 'text or imageUrl is required' }, 400)
  }

  if (text && text.length > MAX_TEXT_LENGTH) {
    logError(ip, 'text too long', { length: text.length })
    return c.json({ error: `テキストは${MAX_TEXT_LENGTH}文字以内にしてください` }, 400)
  }

  if (imageUrl && imageUrl.length > MAX_IMAGE_SIZE) {
    logError(ip, 'image too large', { size: imageUrl.length })
    return c.json({ error: '画像サイズが大きすぎます（5MB以内）' }, 400)
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

  const startTime = Date.now()
  return streamSSE(c, async (stream) => {
    log(ip, 'LLM request start')
    try {
      const response = await llm.stream(messages)
      for await (const chunk of response) {
        const text = chunk.content as string
        if (text) {
          await stream.writeSSE({ data: text })
        }
      }
      log(ip, 'LLM request complete')
    } catch (error) {
      logError(ip, 'LLM Error', { error: String(error) })
      throw error
    } finally {
      const duration = Date.now() - startTime
      log(ip, 'Request complete', { durationMs: duration })
    }
  })
})

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
