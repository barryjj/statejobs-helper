document.addEventListener("DOMContentLoaded", () => {
  const editorEl = document.getElementById("editor");
  const hiddenText = document.getElementById("letter_text");
  const hiddenHtml = document.getElementById("letter_html");
  const copyBtn = document.getElementById("copy-btn");
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

  // === Upload Template Button ===
  const uploadBtn = document.getElementById("upload-template-btn");
  const fileInput = document.getElementById("template-file");

  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/upload_template", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) throw new Error("Upload failed");
        const data = await response.json();

        // Replace editor contents with the extracted text
        quill.setText(data.text || "");
      } catch (err) {
        console.error("Upload error:", err);
        alert("Error uploading or processing file");
      }
    });
  }
});
