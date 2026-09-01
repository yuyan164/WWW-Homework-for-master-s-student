/**
 * image_viewer.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案負責聊天圖片放大檢視功能。
 *
 * 主要功能：
 * 1. 讓聊天室訊息中的圖片可以被點擊放大檢視。
 * 2. 點擊圖片後，自動建立放大檢視視窗。
 * 3. 點擊右上角 ×、點擊背景、或按下 Esc 都可以關閉。
 * 4. 使用事件委派，因此後續新傳送的圖片也可以直接點擊放大。
 * ------------------------------------------------------------
 */

(function setupChatImageViewer() {
  if (window.__chatImageViewerReady) return;
  window.__chatImageViewerReady = true;

  function createImageViewerModal() {
    let modal = document.getElementById('imageViewerModal');

    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'imageViewerModal';
    modal.className = 'image-viewer-backdrop hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    modal.innerHTML = `
      <section class="image-viewer-card">
        <button
          id="closeImageViewerBtn"
          type="button"
          class="image-viewer-close"
          title="關閉圖片"
          aria-label="關閉圖片"
        >×</button>
        <img
          id="enlargedImage"
          class="enlarged-image"
          src=""
          alt="放大的聊天圖片"
        />
      </section>
    `;

    document.body.appendChild(modal);
    return modal;
  }

  function injectImageViewerStyle() {
    if (document.getElementById('imageViewerStyle')) return;

    const style = document.createElement('style');
    style.id = 'imageViewerStyle';

    style.textContent = `
      .message-image,
      .message-bubble img,
      .chat-message img,
      .message img {
        cursor: zoom-in;
      }

      .message-image:hover,
      .message-bubble img:hover,
      .chat-message img:hover,
      .message img:hover {
        transform: scale(1.02);
        transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
        box-shadow: 0 10px 24px rgba(72, 60, 45, 0.18);
        opacity: 0.95;
      }

      .image-viewer-backdrop {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: grid;
        place-items: center;
        padding: 28px;
        background: rgba(45, 42, 36, 0.72);
        backdrop-filter: blur(8px);
      }

      .image-viewer-backdrop.hidden {
        display: none !important;
      }

      .image-viewer-card {
        position: relative;
        max-width: 94vw;
        max-height: 90vh;
        display: grid;
        place-items: center;
        padding: 18px;
        border-radius: 26px;
        background: rgba(255, 250, 241, 0.96);
        border: 1px solid rgba(255, 255, 255, 0.72);
        box-shadow: 0 28px 70px rgba(35, 30, 24, 0.32);
      }

      .enlarged-image {
        max-width: 90vw;
        max-height: 84vh;
        border-radius: 18px;
        object-fit: contain;
        display: block;
      }

      .image-viewer-close {
        position: absolute;
        top: -14px;
        right: -14px;
        width: 42px;
        height: 42px;
        border: 0;
        border-radius: 50%;
        background: #75614f;
        color: #ffffff;
        font-size: 24px;
        font-weight: 900;
        line-height: 1;
        cursor: pointer;
        box-shadow: 0 12px 24px rgba(35, 30, 24, 0.24);
      }

      .image-viewer-close:hover {
        transform: scale(1.05);
      }
    `;

    document.head.appendChild(style);
  }

  const modal = createImageViewerModal();
  injectImageViewerStyle();

  const enlargedImage = document.getElementById('enlargedImage');
  const closeBtn = document.getElementById('closeImageViewerBtn');

  function openImageViewer(src, altText) {
    if (!src) return;

    enlargedImage.src = src;
    enlargedImage.alt = altText || '放大的聊天圖片';
    modal.classList.remove('hidden');
  }

  function closeImageViewer() {
    modal.classList.add('hidden');
    enlargedImage.src = '';
  }

  function isChatMessageImage(img) {
    if (!img || img.tagName !== 'IMG') return false;

    if (img.closest('#imageViewerModal')) return false;

    if (
      img.closest('#imagePreview') ||
      img.closest('#previewBox') ||
      img.closest('.image-preview') ||
      img.closest('.preview-box')
    ) {
      return false;
    }

    if (
      img.closest('#emojiPanel') ||
      img.closest('.emoji-panel') ||
      img.closest('#gameOverlay') ||
      img.closest('.game-overlay')
    ) {
      return false;
    }

    if (img.classList.contains('message-image')) return true;

    if (
      img.closest('.message-bubble') ||
      img.closest('.chat-message') ||
      img.closest('.message-card') ||
      img.closest('.message')
    ) {
      return true;
    }

    return false;
  }

  document.addEventListener('click', function (event) {
    const clickedImage = event.target.closest('img');

    if (!isChatMessageImage(clickedImage)) return;

    event.preventDefault();
    event.stopPropagation();

    openImageViewer(clickedImage.src, clickedImage.alt);
  });

  closeBtn.addEventListener('click', closeImageViewer);

  modal.addEventListener('click', function (event) {
    if (event.target === modal) {
      closeImageViewer();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeImageViewer();
    }
  });
})();