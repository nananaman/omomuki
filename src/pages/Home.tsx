import type { FC } from 'hono/jsx'
import { Layout } from '../components/Layout.js'

export const Home: FC = () => {
  const clientScript = `
    (function() {
      const textarea = document.getElementById('input-text');
      const uploadArea = document.getElementById('upload-area');
      const fileInput = document.getElementById('file-input');
      const submitBtn = document.getElementById('submit-btn');
      const outputContent = document.getElementById('output-content');
      const inputView = document.getElementById('input-view');
      const resultView = document.getElementById('result-view');
      const resultInputDisplay = document.getElementById('result-input-display');
      const backBtn = document.getElementById('back-btn');

      let imageData = null;
      let currentInputText = '';
      let currentImageData = null;

      function showInputView() {
        resultView.classList.add('hidden');
        inputView.classList.remove('hidden');
      }

      function showResultView() {
        inputView.classList.add('hidden');
        resultView.classList.remove('hidden');
      }

      function displayInputInResult() {
        let html = '';
        if (currentInputText) {
          html += \`<div class="result-input-text">\${escapeHtml(currentInputText)}</div>\`;
        }
        if (currentImageData) {
          html += \`<div class="result-input-image"><img src="\${currentImageData}" alt="入力画像" /></div>\`;
        }
        resultInputDisplay.innerHTML = html;
      }

      function resetInput() {
        textarea.value = '';
        imageData = null;
        currentInputText = '';
        currentImageData = null;
        uploadArea.innerHTML = \`
          <div class="upload-icon">◇</div>
          <div class="upload-text">画像をドロップまたはクリック</div>
          <div class="upload-hint">PNG, JPG, GIF に対応</div>
        \`;
        uploadArea.classList.remove('has-image');
        outputContent.innerHTML = '';
        resultInputDisplay.innerHTML = '';
      }

      backBtn.addEventListener('click', () => {
        resetInput();
        showInputView();
      });

      document.querySelectorAll('.logo').forEach(logo => {
        logo.addEventListener('click', () => {
          resetInput();
          showInputView();
        });
      });

      // Drag & Drop
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, e => {
          e.preventDefault();
          e.stopPropagation();
        });
      });

      ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => uploadArea.classList.add('dragover'));
      });

      ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('dragover'));
      });

      uploadArea.addEventListener('drop', e => {
        const files = e.dataTransfer.files;
        if (files.length > 0) handleFile(files[0]);
      });

      uploadArea.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', e => {
        if (e.target.files.length > 0) handleFile(e.target.files[0]);
      });

      function handleFile(file) {
        if (!file.type.startsWith('image/')) {
          alert('画像ファイルを選択してください');
          return;
        }

        const reader = new FileReader();
        reader.onload = e => {
          imageData = e.target.result;
          showPreview(imageData);
        };
        reader.readAsDataURL(file);
      }

      function showPreview(src) {
        uploadArea.innerHTML = \`
          <div class="preview-container">
            <img src="\${src}" alt="プレビュー" class="preview-image" />
            <button type="button" class="remove-image" onclick="removeImage(event)">×</button>
          </div>
        \`;
        uploadArea.classList.add('has-image');
      }

      window.removeImage = function(e) {
        e.stopPropagation();
        imageData = null;
        uploadArea.innerHTML = \`
          <div class="upload-icon">◇</div>
          <div class="upload-text">画像をドロップまたはクリック</div>
          <div class="upload-hint">PNG, JPG, GIF に対応</div>
        \`;
        uploadArea.classList.remove('has-image');
      };

      submitBtn.addEventListener('click', async () => {
        const text = textarea.value.trim();

        if (!text && !imageData) {
          alert('テキストまたは画像を入力してください');
          return;
        }

        currentInputText = text;
        currentImageData = imageData;

        submitBtn.disabled = true;
        submitBtn.textContent = '鑑賞中...';

        displayInputInResult();
        showResultView();

        outputContent.innerHTML = \`
          <div class="loading">
            <div class="loading-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
        \`;

        try {
          const body = {};
          if (text) body.text = text;
          if (imageData) body.imageUrl = imageData;

          const response = await fetch('/api/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });

          if (!response.ok) throw new Error('API error');

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let fullText = '';
          let isFirstChunk = true;

          let summaryContainer;
          let omomukiContainer;
          let renderedOmomukiCount = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            if (isFirstChunk) {
              outputContent.innerHTML = \`
                <div id="summary-container"></div>
                <div id="omomuki-container"></div>
              \`;
              summaryContainer = document.getElementById('summary-container');
              omomukiContainer = document.getElementById('omomuki-container');
              isFirstChunk = false;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\\n');

            for (const line of lines) {
              if (line.startsWith('data:')) {
                const data = line.slice(5).trim();
                if (data) {
                  fullText += data;
                  renderIncremental(fullText, summaryContainer, omomukiContainer, renderedOmomukiCount);
                  renderedOmomukiCount = omomukiContainer.querySelectorAll('.omomuki-card:not(.in-progress)').length;
                }
              }
            }
          }

          renderIncremental(fullText, summaryContainer, omomukiContainer, renderedOmomukiCount, true);

        } catch (error) {
          console.error(error);
          outputContent.innerHTML = '<p style="color: var(--shu);">エラーが発生しました。もう一度お試しください。</p>';
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = '趣を見出す';
        }
      });

      function renderIncremental(text, summaryContainer, omomukiContainer, renderedCount, isFinal = false) {
        const summaryMatch = text.match(/<summary>([\\s\\S]*?)<\\/summary>/);
        if (summaryMatch && !summaryContainer.querySelector('.summary')) {
          const summaryDiv = document.createElement('div');
          summaryDiv.className = 'summary';
          summaryDiv.textContent = summaryMatch[1].trim();
          summaryContainer.appendChild(summaryDiv);
        }

        const omomukiRegex = /<omomuki>[^]*?<target>([^<]+)<\\/target>[^]*?<type>([^<]+)<\\/type>[^]*?<reasoning>([^]*?)<\\/reasoning>[^]*?<\\/omomuki>/g;
        const omomukis = [];
        let match;
        while ((match = omomukiRegex.exec(text)) !== null) {
          omomukis.push({ target: match[1].trim(), type: match[2].trim(), content: match[3].trim() });
        }

        const existingProgress = omomukiContainer.querySelector('.omomuki-card.in-progress');

        for (let i = renderedCount; i < omomukis.length; i++) {
          const o = omomukis[i];
          const card = document.createElement('div');
          card.className = 'omomuki-card';
          card.dataset.type = o.type;
          card.innerHTML = \`
            <div class="omomuki-header">
              <span class="omomuki-type">\${escapeHtml(o.type)}</span>
              <span class="omomuki-target">\${escapeHtml(o.target)}</span>
            </div>
            <div class="omomuki-text">\${escapeHtml(o.content)}</div>
          \`;
          if (existingProgress) {
            omomukiContainer.insertBefore(card, existingProgress);
          } else {
            omomukiContainer.appendChild(card);
          }
        }

        if (!isFinal && omomukis.length === renderedCount) {
          const inProgressMatch = text.match(/<omomuki>(?![^]*<\\/omomuki>)[^]*$/);
          if (inProgressMatch) {
            let progressCard = existingProgress;
            if (!progressCard) {
              progressCard = document.createElement('div');
              progressCard.className = 'omomuki-card in-progress';
              omomukiContainer.appendChild(progressCard);
            }

            const targetMatch = inProgressMatch[0].match(/<target>([^<]*)/);
            const typeMatch = inProgressMatch[0].match(/<type>([^<]*)/);
            const descMatch = inProgressMatch[0].match(/<reasoning>([^]*?)(<\\/reasoning>|$)/);

            const partialTarget = targetMatch ? targetMatch[1].trim() : '';
            const partialType = typeMatch ? typeMatch[1].trim() : '';
            const partialDesc = descMatch ? descMatch[1].trim() : '';

            if (partialType) {
              progressCard.dataset.type = partialType;
            }

            progressCard.innerHTML = \`
              <div class="omomuki-header">
                <span class="omomuki-type">\${escapeHtml(partialType)}</span>
                <span class="omomuki-target">\${escapeHtml(partialTarget)}</span>
              </div>
              <div class="omomuki-text">\${escapeHtml(partialDesc)}<span class="cursor"></span></div>
            \`;
          }
        } else if (existingProgress) {
          existingProgress.remove();
        }

        if (isFinal) {
          const inProgress = omomukiContainer.querySelector('.omomuki-card.in-progress');
          if (inProgress) {
            inProgress.remove();
          }
        }
      }

      function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
      }
    })();
  `

  return (
    <Layout>
      <div class="container">
        {/* 入力画面 */}
        <div id="input-view" class="input-view">
          <header class="header">
            <h1 class="logo">趣</h1>
          </header>
          <p class="subtitle">日本の美意識で、情景の奥深さを見出す</p>

          <section class="input-section">
            <div class="textarea-wrapper">
              <textarea
                id="input-text"
                class="textarea"
                placeholder="情景を入力してください..."
                rows={4}
              />
            </div>

            <div id="upload-area" class="upload-area">
              <div class="upload-icon">◇</div>
              <div class="upload-text">画像をドロップまたはクリック</div>
              <div class="upload-hint">PNG, JPG, GIF に対応</div>
            </div>
            <input type="file" id="file-input" class="file-input" accept="image/*" />

            <button id="submit-btn" class="submit-btn">
              趣を見出す
            </button>
          </section>
        </div>

        {/* 結果画面 */}
        <div id="result-view" class="result-view hidden">
          <header class="header">
            <h1 class="logo">趣</h1>
          </header>

          <section class="result-section">
            <div id="result-input-display" class="result-input-display" />
            <div id="output-content" class="output-content" />
            <div class="result-actions">
              <button id="back-btn" class="back-btn">
                もう一度試す
              </button>
            </div>
          </section>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: clientScript }} />
    </Layout>
  )
}
