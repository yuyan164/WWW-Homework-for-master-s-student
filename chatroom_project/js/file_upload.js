/**
 * file_upload.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案負責聊天室「傳送檔案」功能。
 *
 * 主要功能：
 * 1. 在圖片按鈕旁邊新增檔案上傳按鈕。
 * 2. 使用者可以選擇檔案並上傳到 server。
 * 3. 上傳成功後，將檔案資訊暫存在前端，等待使用者按送出。
 * 4. 訊息送出後，聊天室會顯示檔案卡片與下載連結。
 * 5. 支援私人聊天室、群組聊天室與備忘錄。
 * 6. 支援 i18n.js 中英切換。
 * ------------------------------------------------------------
 */

(function setupFileUploadModule() {
  if (window.FileUpload) return;

  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  let selectedFileData = null;
  let fileBtn = null;
  let fileInput = null;
  let filePreview = null;
  let filePreviewName = null;
  let cancelFileBtn = null;
  let messageInput = null;
  let translate = null;

  function t(key, params = {}) {
    if (typeof translate === 'function') {
      return translate(key, params);
    }

    if (window.i18n && typeof window.i18n.t === 'function') {
      return window.i18n.t(key, params);
    }

    return key;
  }

  function formatFileSize(size) {
    const bytes = Number(size || 0);

    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;

    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function injectStyle() {
    if (document.getElementById('fileUploadStyle')) return;

    const style = document.createElement('style');
    style.id = 'fileUploadStyle';

    style.textContent = `
      .file-upload-btn {
        width: 42px;
        height: 42px;
        border: 0;
        border-radius: 12px;
        background: #ead6ba;
        cursor: pointer;
        font-size: 18px;
        box-shadow: 0 8px 18px rgba(45, 42, 36, 0.10);
      }

      .file-upload-btn:hover {
        transform: translateY(-1px);
      }

      .file-preview-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin: 6px 0 8px;
        padding: 9px 12px;
        border-radius: 16px;
        background: rgba(232, 242, 220, 0.82);
        border: 1px solid rgba(111, 125, 91, 0.18);
        color: #5b4b3d;
        box-shadow: 0 8px 18px rgba(45, 42, 36, 0.08);
      }

      .file-preview-bar.hidden {
        display: none !important;
      }

      .file-preview-name {
        font-size: 13px;
        font-weight: 800;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .file-cancel-btn {
        width: 28px;
        height: 28px;
        border: 0;
        border-radius: 50%;
        background: rgba(117, 97, 79, 0.16);
        color: #5b4b3d;
        font-size: 16px;
        font-weight: 900;
        cursor: pointer;
      }

      .file-message-card {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 8px 0;
        padding: 10px 12px;
        border-radius: 14px;
        background: rgba(255, 250, 241, 0.66);
        border: 1px solid rgba(117, 97, 79, 0.16);
        text-decoration: none;
        color: #5b4b3d;
      }

      .file-message-icon {
        width: 34px;
        height: 34px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        background: rgba(111, 125, 91, 0.16);
        font-size: 18px;
      }

      .file-message-info {
        min-width: 0;
      }

      .file-message-name {
        font-size: 14px;
        font-weight: 900;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .file-message-size {
        margin-top: 2px;
        font-size: 12px;
        font-weight: 700;
        color: #7c6a58;
      }
    `;

    document.head.appendChild(style);
  }

  function createFileButton(referenceButton) {
    if (document.getElementById('fileUploadBtn')) {
      fileBtn = document.getElementById('fileUploadBtn');
      return;
    }

    fileBtn = document.createElement('button');
    fileBtn.id = 'fileUploadBtn';
    fileBtn.type = 'button';
    fileBtn.className = 'file-upload-btn';
    fileBtn.textContent = '📎';
    fileBtn.title = t('selectFile');
    fileBtn.setAttribute('aria-label', t('selectFile'));

    fileInput = document.createElement('input');
    fileInput.id = 'fileUploadInput';
    fileInput.type = 'file';
    fileInput.hidden = true;

    fileBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', handleFileChange);

    if (referenceButton && referenceButton.parentElement) {
      referenceButton.insertAdjacentElement('afterend', fileBtn);
      fileBtn.insertAdjacentElement('afterend', fileInput);
    } else {
      document.body.append(fileBtn, fileInput);
    }
  }

  function createPreviewBar() {
    if (document.getElementById('filePreviewBar')) {
      filePreview = document.getElementById('filePreviewBar');
      filePreviewName = document.getElementById('filePreviewName');
      cancelFileBtn = document.getElementById('cancelFileBtn');
      return;
    }

    filePreview = document.createElement('div');
    filePreview.id = 'filePreviewBar';
    filePreview.className = 'file-preview-bar hidden';

    filePreviewName = document.createElement('div');
    filePreviewName.id = 'filePreviewName';
    filePreviewName.className = 'file-preview-name';

    cancelFileBtn = document.createElement('button');
    cancelFileBtn.id = 'cancelFileBtn';
    cancelFileBtn.type = 'button';
    cancelFileBtn.className = 'file-cancel-btn';
    cancelFileBtn.textContent = '×';
    cancelFileBtn.title = t('cancelFile');
    cancelFileBtn.setAttribute('aria-label', t('cancelFile'));

    cancelFileBtn.addEventListener('click', clear);

    filePreview.append(filePreviewName, cancelFileBtn);

    const inputArea = messageInput.closest('.message-input-area, .input-area, .chat-input-area')
      || messageInput.parentElement;

    if (inputArea && inputArea.parentElement) {
      inputArea.parentElement.insertBefore(filePreview, inputArea);
    } else {
      messageInput.insertAdjacentElement('beforebegin', filePreview);
    }
  }

  async function handleFileChange() {
    const file = fileInput.files && fileInput.files[0];

    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      alert(t('fileTooLargeGeneral'));
      fileInput.value = '';
      return;
    }

    filePreviewName.textContent = `${t('selectedFile')}：${file.name} (${formatFileSize(file.size)})`;
    filePreview.classList.remove('hidden');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload-file', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        alert(t(result.messageKey || 'fileUploadFailed'));
        clear();
        return;
      }

      selectedFileData = result.file;

      filePreviewName.textContent = `${t('selectedFile')}：${selectedFileData.fileName} (${formatFileSize(selectedFileData.fileSize)})`;
    } catch (error) {
      console.error('File upload error:', error);
      alert(t('fileUploadFailed'));
      clear();
    }
  }

  function getFileData() {
    return selectedFileData;
  }

  function clear() {
    selectedFileData = null;

    if (fileInput) {
      fileInput.value = '';
    }

    if (filePreview) {
      filePreview.classList.add('hidden');
    }

    if (filePreviewName) {
      filePreviewName.textContent = '';
    }
  }

  function createFileMessageElement(fileData) {
    if (!fileData || !fileData.fileUrl) return null;

    const link = document.createElement('a');
    link.className = 'file-message-card';
    link.href = fileData.fileUrl;
    link.download = fileData.fileName || '';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    const icon = document.createElement('div');
    icon.className = 'file-message-icon';
    icon.textContent = '📎';

    const info = document.createElement('div');
    info.className = 'file-message-info';

    const name = document.createElement('div');
    name.className = 'file-message-name';
    name.textContent = fileData.fileName || t('downloadFile');

    const size = document.createElement('div');
    size.className = 'file-message-size';
    size.textContent = `${t('downloadFile')}・${formatFileSize(fileData.fileSize)}`;

    info.append(name, size);
    link.append(icon, info);

    return link;
  }

  function updateText() {
    if (fileBtn) {
      fileBtn.title = t('selectFile');
      fileBtn.setAttribute('aria-label', t('selectFile'));
    }

    if (cancelFileBtn) {
      cancelFileBtn.title = t('cancelFile');
      cancelFileBtn.setAttribute('aria-label', t('cancelFile'));
    }
  }

  function init(config = {}) {
    messageInput = config.messageInput;
    translate = config.translate;

    injectStyle();
    createFileButton(config.referenceButton);
    createPreviewBar();
    updateText();

    window.addEventListener('languageChanged', updateText);
  }

  window.FileUpload = {
    init,
    getFileData,
    clear,
    createFileMessageElement,
  };
})();