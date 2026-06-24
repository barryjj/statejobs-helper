document.addEventListener("DOMContentLoaded", () => {
  const editorEl = document.getElementById("editor");
  const hiddenText = document.getElementById("letter_text");
  const hiddenHtml = document.getElementById("letter_html");
  const hiddenFontSize = document.getElementById("font_size_input");
  const hiddenJobId = document.getElementById("job_id");
  const copyBtn = document.getElementById("copy-btn");
  const uploadBtn = document.getElementById("upload-template-btn");
  const fileInput = document.getElementById("template-file");
  const downloadBtn = document.getElementById("download-btn");
  const form = document.getElementById("editor-form");

  // Initialize Quill
  const quill = new Quill(editorEl, {
    theme: "snow",
    placeholder: "Start writing your cover letter here...",
    modules: {
      toolbar: [
        ["bold", "italic", "underline", "strike"],
        [{ header: [1, 2, 3, false] }],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link", "blockquote", "code-block"]
      ]
    }
  });

  // Autosave
  const jobId = hiddenJobId ? hiddenJobId.value : null;
  const draftKey = jobId ? `coverletter_draft_${jobId}` : null;
  const draftBanner = document.getElementById("draft-banner");
  const restoreBtn = document.getElementById("draft-restore-btn");
  const discardBtn = document.getElementById("draft-discard-btn");
  let autosaveTimer = null;

  function saveDraft() {
    if (!draftKey) return;
    localStorage.setItem(draftKey, quill.root.innerHTML);
  }

  function clearDraft() {
    if (draftKey) localStorage.removeItem(draftKey);
  }

  // Load initial content if present (Prioritize HTML to preserve formatting)
  if (hiddenHtml.value) {
    quill.root.innerHTML = hiddenHtml.value;
  } else if (hiddenText.value) {
    quill.setText(hiddenText.value);
  }

  // Check for a saved draft after loading server content
  if (draftKey) {
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      draftBanner.style.removeProperty("display");

      restoreBtn.addEventListener("click", () => {
        quill.root.innerHTML = savedDraft;
        draftBanner.style.display = "none";
      });

      discardBtn.addEventListener("click", () => {
        clearDraft();
        draftBanner.style.display = "none";
      });
    }
  }

  // Autosave 3s after last edit
  quill.on("text-change", () => {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(saveDraft, 3000);
  });

  // Sync hidden inputs before submitting, clear draft on template upload
  form.addEventListener("submit", () => {
    hiddenText.value = quill.getText();
    hiddenHtml.value = quill.root.innerHTML;
    clearDraft();
  });

  // Copy to clipboard
  copyBtn.addEventListener("click", () => {
    const temp = document.createElement("textarea");
    temp.value = quill.root.innerHTML;
    document.body.appendChild(temp);
    temp.select();
    try {
        // Use document.execCommand('copy') for better compatibility in iframe environments
        document.execCommand("copy");
    } catch (err) {
        console.error("Failed to copy text: ", err);
    }
    document.body.removeChild(temp);
  });

  // Upload template
  uploadBtn.addEventListener("click", () => {
    fileInput.click();
  });

  // Auto-submit form on file selection
  fileInput.addEventListener("change", () => {
    if (fileInput.files.length > 0) {
      form.submit();
    }
  });

  // Download PDF
  downloadBtn.addEventListener("click", () => {
    const htmlContent = quill.root.innerHTML;

    // POST HTML to download route
    const tempForm = document.createElement("form");
    tempForm.method = "POST";
    tempForm.action = "/coverletter/download";

    // 1. HTML Content
    const inputHtml = document.createElement("input");
    inputHtml.type = "hidden";
    inputHtml.name = "letter_html";
    inputHtml.value = htmlContent;
    tempForm.appendChild(inputHtml);

    // 2. Font Size
    const fontSizeInput = document.createElement("input");
    fontSizeInput.type = "hidden";
    fontSizeInput.name = "font_size";
    fontSizeInput.value = hiddenFontSize.value;
    tempForm.appendChild(fontSizeInput);

    // 3. Job ID
    if (hiddenJobId && hiddenJobId.value) {
      const jobIdInput = document.createElement("input");
      jobIdInput.type = "hidden";
      jobIdInput.name = "job_id";
      jobIdInput.value = hiddenJobId.value;
      tempForm.appendChild(jobIdInput);
    }

    clearDraft();
    document.body.appendChild(tempForm);
    tempForm.submit();
    document.body.removeChild(tempForm);
  });
});
