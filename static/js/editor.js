document.addEventListener("DOMContentLoaded", () => {
  const editorEl = document.getElementById("editor");
  const hiddenText = document.getElementById("letter_text");
  const hiddenHtml = document.getElementById("letter_html");
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

  // Load initial content if present
  if (hiddenText.value) {
    quill.root.innerHTML = hiddenText.value;
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
    document.execCommand("copy");
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

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "letter_html";
    input.value = htmlContent;

    tempForm.appendChild(input);
    document.body.appendChild(tempForm);
    tempForm.submit();
  });
});
