/**
 * image_upload.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案負責聊天室圖片選取與預覽功能。
 *
 * 主要功能：
 * 1. 點擊圖片按鈕後開啟檔案選擇器。
 * 2. 檢查檔案是否為圖片。
 * 3. 限制圖片大小。
 * 4. 將圖片轉成 base64 data URL。
 * 5. 顯示圖片預覽。
 * 6. 清除圖片預覽。
 * ------------------------------------------------------------
 */

(function setupImageUploadModule() {
  if (window.ImageUpload) return;

  let selectedImageData = '';

  function init(config) {
    const imageBtn = config.imageBtn;
    const imageInput = config.imageInput;
    const imagePreview = config.imagePreview;
    const previewImg = config.previewImg;
    const cancelImageBtn = config.cancelImageBtn;
    const maxImageSize = config.maxImageSize;
    const translate = config.translate;

    imageBtn.addEventListener('click', () => {
      imageInput.click();
    });

    imageInput.addEventListener('change', () => {
      const file = imageInput.files && imageInput.files[0];

      if (!file) return;

      if (!file.type.startsWith('image/')) {
        alert(translate('imageOnly'));
        imageInput.value = '';
        return;
      }

      if (file.size > maxImageSize) {
        alert(translate('fileTooLarge'));
        imageInput.value = '';
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        selectedImageData = reader.result;
        previewImg.src = selectedImageData;
        imagePreview.classList.remove('hidden');
      };

      reader.readAsDataURL(file);
    });

    cancelImageBtn.addEventListener('click', () => {
      clear(config);
    });
  }

  function getImageData() {
    return selectedImageData;
  }

  function clear(config) {
    selectedImageData = '';

    if (config && config.previewImg) {
      config.previewImg.removeAttribute('src');
    }

    if (config && config.imagePreview) {
      config.imagePreview.classList.add('hidden');
    }

    if (config && config.imageInput) {
      config.imageInput.value = '';
    }
  }

  window.ImageUpload = {
    init,
    getImageData,
    clear,
  };
})();