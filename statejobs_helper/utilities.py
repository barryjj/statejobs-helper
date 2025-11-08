import re
import io
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from io import BytesIO
from docx import Document
from PyPDF2 import PdfReader

# WeasyPrint optional
try:
    from weasyprint import HTML

    WEASYPRINT_AVAILABLE = True
except Exception:
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


def extract_text_and_html(file_storage):
    """
    Extract both plain text and structured HTML from uploaded template files.
    The HTML is structured for Quill/WeasyPrint compatibility, preserving line breaks and blank lines.
    """
    filename = file_storage.filename.lower()

    # CRITICAL: Ensure file pointer is reset
    file_bytes = file_storage.read()
    file_storage.seek(0)

    def normalize_text(s: str) -> str:
        # Normalize line endings
        s = s.replace("\r\n", "\n").replace("\r", "\n")
        # Aggressive cleanup of non-breaking spaces (U+00A0 or \xa0) and tabs
        s = s.replace("\xa0", " ").replace("\t", " ")
        # Collapse 3+ newlines into 2
        return re.sub(r"\n{3,}", "\n\n", s.strip())

    # --- Read text content ---
    text_content = ""
    if filename.endswith(".txt"):
        text_content = normalize_text(file_bytes.decode("utf-8", errors="ignore"))

    elif filename.endswith(".docx"):
        doc = Document(io.BytesIO(file_bytes))
        paragraphs = [normalize_text(p.text) for p in doc.paragraphs]
        text_content = "\n\n".join(paragraphs)

    elif filename.endswith(".pdf"):
        pdf = PdfReader(io.BytesIO(file_bytes))
        text_pages = [normalize_text(page.extract_text() or "") for page in pdf.pages]
        text_content = "\n\n".join(text_pages)

    else:
        raise ValueError(f"Unsupported file type: {filename}")

    # --- Generate Structured HTML ---

    # 1. Split content based on marker
    header_marker = "---END HEADER---"
    if header_marker in text_content:
        parts = text_content.split(header_marker, 1)
        header_raw_block = parts[0]
        body_raw_block = parts[1]
    else:
        parts = text_content.split("\n\n", 1)
        header_raw_block = parts[0]
        body_raw_block = parts[1] if len(parts) > 1 else ""

    # 2. Format Header: Tightly-spaced lines, separated by explicit blank paragraphs
    header_chunks = header_raw_block.strip().split("\n\n")

    header_html_parts = []
    for chunk in header_chunks:
        chunk = chunk.strip()
        if chunk:
            # Lines within a content chunk are separated by <br> (tight spacing)
            lines = [line.strip() for line in chunk.split("\n") if line.strip()]
            header_html_parts.append("<p>" + " <br> ".join(lines) + "</p>")
        else:
            # Blank line in the source: create a blank line element
            header_html_parts.append("<p><br></p>")

    header_html = "".join(header_html_parts)

    # 3. Format Body: Ensure explicit paragraph breaks for Quill
    body_raw_block = body_raw_block.strip()
    body_paragraphs_and_breaks = body_raw_block.split("\n\n")

    # Start the body HTML with the guaranteed blank line after the greeting/header
    body_html_parts = ["<p><br></p>"]

    for block in body_paragraphs_and_breaks:
        block_content = block.strip()
        if block_content:
            # Content block (paragraph, closing, or signature line)
            body_html_parts.append(f"<p>{block_content.replace('\n', ' ')}</p>")

            # Append a blank line after every content block for proper visual separation in Quill
            body_html_parts.append("<p><br></p>")

    # Clean up excess breaks: Remove the final break if it was inserted after the signature line
    if body_html_parts and body_html_parts[-1] == "<p><br></p>":
        body_html_parts.pop()

    body_html = "".join(body_html_parts).strip()

    # 4. Combine the two parts into the final HTML output
    html_content = header_html + body_html

    return text_content, html_content


def text_to_pdf(text):
    """Generates a PDF using robust ReportLab paragraph handling."""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    y = height - 72
    line_height = 14

    # Iterate over blocks (separated by \n\n in the source text)
    for i, paragraph in enumerate(text.split("\n\n")):

        # Start a new text object for the paragraph
        text_object = c.beginText(72, y)
        text_object.setFont("Helvetica", 12)

        # Process individual lines within this block (tight line spacing for addresses)
        lines = [line.strip() for line in paragraph.splitlines() if line.strip()]

        if lines:
            for line in lines:
                text_object.textLine(line)
                y -= line_height  # Advance one line
                if y < 72:  # Handle pagination mid-paragraph
                    c.drawText(text_object)
                    c.showPage()
                    y = height - 72
                    text_object = c.beginText(72, y)
                    text_object.setFont("Helvetica", 12)

            c.drawText(text_object)
        else:
            # Handles the intentional blank line created by \n\n in the source
            y -= line_height

        # Add the paragraph break (extra vertical space) after a block is finished
        y -= line_height

        if y < 72:
            c.showPage()
            y = height - 72

    c.save()
    buffer.seek(0)
    return buffer


def html_to_pdf(html_content):
    """
    Generates a PDF from HTML using WeasyPrint, or falls back to text_to_pdf.
    """
    if WEASYPRINT_AVAILABLE:
        try:
            pdf_buffer = io.BytesIO()
            HTML(string=html_content).write_pdf(pdf_buffer)
            pdf_buffer.seek(0)
            return pdf_buffer
        except Exception:
            pass

    # Fallback Logic: Convert clean HTML structure back to formatted text
    text_content = html_content

    # 1. Convert </p> tags to double newlines (paragraph break)
    text_content = text_content.replace("</p>", "\n\n")
    # 2. Convert <br> to single newline (line break)
    text_content = text_content.replace("<br>", "\n")
    # 3. Strip all other tags, and clean up extra whitespace/newlines
    text_content = re.sub(r"<[^>]+>", "", text_content).strip()
    text_content = re.sub(r"\n{3,}", "\n\n", text_content)

    return text_to_pdf(text_content)
