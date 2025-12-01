import type { FC } from 'hono/jsx'
import { Layout } from '../components/Layout.js'

export const Home: FC = () => {
  const clientScript = `
(function() {
  const inputView = document.getElementById('input-view');
  const resultView = document.getElementById('result-view');
  const textarea = document.getElementById('input-text');
  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('file-input');
  const submitBtn = document.getElementById('submit-btn');
  const backBtn = document.getElementById('back-btn');
  const logo = document.getElementById('logo');
  const summaryContainer = document.getElementById('summary-container');
  const omomukiContainer = document.getElementById('omomuki-container');
  const inputDisplay = document.getElementById('input-display');
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  let imageData = null;
  let activeTab = 'text';
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      activeTab = tabName;

      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      tabContents.forEach(content => {
        content.classList.toggle('active', content.id === 'tab-' + tabName);
      });

    });
  });

  // File upload handling
  uploadArea.addEventListener('click', () => fileInput.click());

  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFile(file);
    }
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFile(file);
    }
  });

  function handleFile(file) {
    if (file.size > MAX_FILE_SIZE) {
      alert('画像サイズが大きすぎます（5MB以内にしてください）');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      imageData = e.target.result;
      showImagePreview(imageData);
    };
    reader.readAsDataURL(file);
  }

  function showImagePreview(src) {
    uploadArea.innerHTML = \`
      <div class="preview-container">
        <img src="\${src}" alt="プレビュー" class="preview-image" />
        <button type="button" class="remove-image">×</button>
      </div>
    \`;
    uploadArea.classList.add('has-image');

    uploadArea.querySelector('.remove-image').addEventListener('click', (e) => {
      e.stopPropagation();
      removeImage();
    });
  }

  function removeImage() {
    imageData = null;
    uploadArea.innerHTML = \`
      <div class="upload-icon">◇</div>
      <div class="upload-text">画像をドロップまたはクリック</div>
      <div class="upload-hint">PNG, JPG, GIF に対応</div>
    \`;
    uploadArea.classList.remove('has-image');
    fileInput.value = '';
  }

  // Submit
  submitBtn.addEventListener('click', async () => {
    const text = textarea.value.trim();
    const hasInput = activeTab === 'text' ? text : imageData;
    if (!hasInput) {
      return;
    }

    submitBtn.disabled = true;
    showResultView();

    try {
      const body = activeTab === 'text' ? { text } : { imageUrl: imageData };
      const response = await fetch('/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        if (response.status === 429) {
          const data = await response.json();
          const retryAfter = response.headers.get('Retry-After') || '60';
          showRateLimitModal(data.error, parseInt(retryAfter, 10));
          return;
        }
        throw new Error('API error');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let renderedCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\\n');

        for (const line of lines) {
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            if (data) {
              fullText += data;
              renderedCount = renderIncremental(fullText, renderedCount);
            }
          }
        }
      }

      // Final render
      renderIncremental(fullText, renderedCount, true);

    } catch (error) {
      console.error('Error:', error);
      summaryContainer.innerHTML = '<p class="summary-text">エラーが発生しました。もう一度お試しください。</p>';
    } finally {
      submitBtn.disabled = false;
    }
  });

  function renderIncremental(text, renderedCount, isFinal = false) {
    // Parse summary
    const summaryMatch = text.match(/<summary>([\\s\\S]*?)<\\/summary>/);
    const existingSummary = summaryContainer.querySelector('.summary-text');

    if (summaryMatch) {
      if (existingSummary) {
        existingSummary.classList.remove('loading');
        existingSummary.textContent = summaryMatch[1].trim();
      } else {
        summaryContainer.innerHTML = '<p class="summary-text">' + escapeHtml(summaryMatch[1].trim()) + '</p>';
      }
    } else {
      const partialSummary = text.match(/<summary>([\\s\\S]*?)$/);
      if (partialSummary) {
        if (existingSummary) {
          existingSummary.textContent = partialSummary[1].trim();
        } else {
          summaryContainer.innerHTML = '<p class="summary-text loading">' + escapeHtml(partialSummary[1].trim()) + '</p>';
        }
      }
    }

    // Parse complete omomuki items
    const omomukiRegex = /<omomuki>[\\s\\S]*?<target>([^<]+)<\\/target>[\\s\\S]*?<type>([^<]+)<\\/type>[\\s\\S]*?<reasoning>([\\s\\S]*?)<\\/reasoning>[\\s\\S]*?<\\/omomuki>/g;
    const omomukis = [];
    let match;
    while ((match = omomukiRegex.exec(text)) !== null) {
      omomukis.push({ target: match[1].trim(), type: match[2].trim(), reasoning: match[3].trim() });
    }

    let existingProgress = omomukiContainer.querySelector('.omomuki-card.in-progress');

    // Render only new complete cards
    for (let i = renderedCount; i < omomukis.length; i++) {
      const o = omomukis[i];

      // 進行中カードがあれば、それを完成カードに変換
      if (existingProgress && i === renderedCount) {
        existingProgress.classList.remove('in-progress');
        existingProgress.setAttribute('data-type', o.type);
        existingProgress.innerHTML = \`
          <div class="omomuki-target">\${escapeHtml(o.target)}</div>
          <div class="omomuki-type">\${escapeHtml(o.type)}</div>
          <div class="omomuki-reasoning">\${escapeHtml(o.reasoning)}</div>
        \`;
        existingProgress = null;
      } else {
        const card = document.createElement('div');
        card.className = 'omomuki-card';
        card.setAttribute('data-type', o.type);
        card.innerHTML = \`
          <div class="omomuki-target">\${escapeHtml(o.target)}</div>
          <div class="omomuki-type">\${escapeHtml(o.type)}</div>
          <div class="omomuki-reasoning">\${escapeHtml(o.reasoning)}</div>
        \`;
        omomukiContainer.appendChild(card);
      }
    }

    // Handle in-progress card
    if (!isFinal) {
      const inProgressMatch = text.match(/<omomuki>(?![\\s\\S]*<\\/omomuki>)[\\s\\S]*$/);
      if (inProgressMatch && omomukis.length === renderedCount) {
        let progressCard = omomukiContainer.querySelector('.omomuki-card.in-progress');
        if (!progressCard) {
          progressCard = document.createElement('div');
          progressCard.className = 'omomuki-card in-progress';
          omomukiContainer.appendChild(progressCard);
        }

        const targetMatch = inProgressMatch[0].match(/<target>([^<]*)/);
        const typeMatch = inProgressMatch[0].match(/<type>([^<]*)/);
        const reasoningMatch = inProgressMatch[0].match(/<reasoning>([\\s\\S]*?)(<\\/reasoning>|$)/);

        const partialTarget = targetMatch ? targetMatch[1].trim() : '';
        const partialType = typeMatch ? typeMatch[1].trim() : '';
        const partialReasoning = reasoningMatch ? reasoningMatch[1].trim() : '';

        if (partialType) {
          progressCard.setAttribute('data-type', partialType);
        }

        progressCard.innerHTML = \`
          <div class="omomuki-target">\${escapeHtml(partialTarget)}</div>
          <div class="omomuki-type">\${escapeHtml(partialType)}</div>
          <div class="omomuki-reasoning">\${escapeHtml(partialReasoning)}<span class="loading-cursor">|</span></div>
        \`;
      }
    }

    // 最終レンダリング時に残った進行中カードを削除
    if (isFinal) {
      const remaining = omomukiContainer.querySelector('.omomuki-card.in-progress');
      if (remaining) remaining.remove();
    }

    return omomukis.length;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showResultView() {
    inputView.classList.add('hidden');
    resultView.classList.remove('hidden');
    summaryContainer.innerHTML = '<p class="summary-text loading"></p>';
    omomukiContainer.innerHTML = '';

    // 入力内容を表示
    if (activeTab === 'text') {
      const text = textarea.value.trim();
      inputDisplay.innerHTML = '<span class="input-display-text">' + escapeHtml(text) + '</span>';
    } else {
      inputDisplay.innerHTML = '<img src="' + imageData + '" alt="入力画像" class="input-display-image" />';
    }
  }

  function showInputView() {
    resultView.classList.add('hidden');
    inputView.classList.remove('hidden');
  }

  function reset() {
    textarea.value = '';
    if (imageData) {
      removeImage();
    }
    showInputView();
  }

  backBtn.addEventListener('click', reset);
  logo.addEventListener('click', reset);

  // Rate limit modal
  function showRateLimitModal(message, retryAfterSeconds) {
    let remaining = retryAfterSeconds;
    const total = retryAfterSeconds;

    const overlay = document.createElement('div');
    overlay.className = 'rate-limit-overlay';
    overlay.innerHTML = \`
      <div class="rate-limit-modal">
        <div class="rate-limit-icon">間</div>
        <h2 class="rate-limit-title">しばしお待ちを</h2>
        <p class="rate-limit-message">\${escapeHtml(message)}</p>
        <div class="rate-limit-timer">
          <span>再開まで</span>
          <span class="rate-limit-timer-value">\${remaining}</span>
          <span>秒</span>
        </div>
        <div class="rate-limit-progress">
          <div class="rate-limit-progress-bar" style="width: 0%"></div>
        </div>
        <button class="rate-limit-close">閉じる</button>
        <div class="rate-limit-haiku">
          <p>急がずに<br>流れに身を任せれば<br>道は開ける</p>
        </div>
      </div>
    \`;

    document.body.appendChild(overlay);

    const timerValue = overlay.querySelector('.rate-limit-timer-value');
    const progressBar = overlay.querySelector('.rate-limit-progress-bar');
    const closeBtn = overlay.querySelector('.rate-limit-close');

    const interval = setInterval(() => {
      remaining--;
      if (timerValue) {
        timerValue.textContent = remaining;
      }
      if (progressBar) {
        const progress = ((total - remaining) / total) * 100;
        progressBar.style.width = progress + '%';
      }
      if (remaining <= 0) {
        clearInterval(interval);
        closeRateLimitModal(overlay);
      }
    }, 1000);

    closeBtn.addEventListener('click', () => {
      clearInterval(interval);
      closeRateLimitModal(overlay);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        clearInterval(interval);
        closeRateLimitModal(overlay);
      }
    });

    showInputView();
  }

  function closeRateLimitModal(overlay) {
    overlay.style.animation = 'fadeIn 0.3s ease reverse';
    setTimeout(() => {
      overlay.remove();
    }, 300);
  }
})();
`

  return (
    <Layout>
      <div class="container">
        {/* Input View */}
        <div id="input-view" class="input-view">
          <header class="header">
            <h1 id="logo" class="logo">趣ディテクター</h1>
          </header>
          <p class="subtitle">日常に潜む「趣」を検出します</p>

          <section class="input-section">
            <div class="tabs">
              <button type="button" class="tab active" data-tab="text">テキスト</button>
              <button type="button" class="tab" data-tab="image">画像</button>
            </div>

            <div id="tab-text" class="tab-content active">
              <textarea
                id="input-text"
                class="textarea"
                placeholder="情景や出来事を入力してください..."
                rows={4}
              />
            </div>

            <div id="tab-image" class="tab-content">
              <div id="upload-area" class="upload-area">
                <div class="upload-icon">◇</div>
                <div class="upload-text">画像をドロップまたはクリック</div>
                <div class="upload-hint">PNG, JPG, GIF に対応</div>
              </div>
              <input type="file" id="file-input" accept="image/*" />
            </div>

            <button id="submit-btn" class="submit-btn"><span>趣を検出する</span></button>
          </section>
        </div>

        {/* Result View */}
        <div id="result-view" class="result-view hidden">
          <header class="header">
            <h1 id="logo" class="logo">趣ディテクター</h1>
          </header>

          <button id="back-btn" class="back-btn">
            ← 戻る
          </button>

          <div id="input-display" class="input-display"></div>

          <section class="summary-section">
            <div class="summary-label">情景</div>
            <div id="summary-container"></div>
          </section>

          <section class="omomuki-section" id="omomuki-container"></section>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: clientScript }} />
    </Layout>
  )
}
