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

  // Load initial content if present (Prioritize HTML to preserve formatting)
  if (hiddenHtml.value) {
    quill.root.innerHTML = hiddenHtml.value;
  } else if (hiddenText.value) {
    quill.setText(hiddenText.value);
  }

  // Sync hidden inputs before submitting
  form.addEventListener("submit", () => {
    hiddenText.value = quill.getText();
    hiddenHtml.value = quill.root.innerHTML;
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

    document.body.appendChild(tempForm);
    tempForm.submit();
    document.body.removeChild(tempForm);
  });
});
