import re
import io
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

# Try importing WeasyPrint, but handle missing system libraries gracefully
try:
    from weasyprint import HTML

    WEASYPRINT_AVAILABLE = True
except Exception as e:
    print(f"[Warning] WeasyPrint not available: {e}")
    WEASYPRINT_AVAILABLE = False


def fill_template(file, data):
    """Replace placeholders like {{ name }} in a text or HTML template."""
    if hasattr(file, "read"):
        template_text = file.read().decode("utf-8", errors="ignore")
    else:
        template_text = str(file)

    def replacer(match):
        key = match.group(1).strip()
        return str(data.get(key, f"{{{{ {key} }}}}"))

    return re.sub(r"\{\{\s*(.*?)\s*\}\}", replacer, template_text)


def text_to_pdf(text):
    """Fallback text-to-PDF using ReportLab."""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    text_object = c.beginText(72, height - 72)
    text_object.setFont("Helvetica", 12)
    for line in text.splitlines():
        text_object.textLine(line)
    c.drawText(text_object)
    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer


def html_to_pdf(html_content):
    """Generate a PDF from HTML if WeasyPrint is available."""
    if WEASYPRINT_AVAILABLE:
        try:
            pdf_buffer = io.BytesIO()
            HTML(string=html_content).write_pdf(pdf_buffer)
            pdf_buffer.seek(0)
            return pdf_buffer
        except Exception as e:
            print(f"[Error] WeasyPrint failed: {e}. Falling back to text-based PDF.")

    # fallback — strip HTML tags and use text_to_pdf
    text = re.sub(r"<[^>]+>", "", html_content)
    return text_to_pdf(text)


# === NEW: File text extraction ===
import PyPDF2
from docx import Document


def extract_text_from_file(file_storage):
    """
    Extracts plain text from uploaded .txt, .pdf, or .docx files.
    Returns a string for Quill editor display.
    """
    filename = file_storage.filename.lower()

    if filename.endswith(".txt"):
        return file_storage.read().decode("utf-8", errors="ignore")

    elif filename.endswith(".pdf"):
        reader = PyPDF2.PdfReader(file_storage)
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        return text.strip()

    elif filename.endswith(".docx"):
        buffer = io.BytesIO(file_storage.read())
        doc = Document(buffer)
        return "\n".join(p.text for p in doc.paragraphs).strip()

    else:
        raise ValueError("Unsupported file format")
