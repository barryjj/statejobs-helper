"""
General utilities for the statejobs-helper project.
"""

import io
import re

from docx import Document
from PyPDF2 import PdfReader
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

# WeasyPrint optional
try:
    from weasyprint import HTML

    WEASYPRINT_AVAILABLE = True
except ImportError:
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


def _convert_text_to_html(text_content: str) -> str:
    """
    Helper function to convert raw text content (split into header and body)
    into formatted HTML paragraphs.

    This function was created to reduce the complexity and local variable count
    of extract_text_and_html (Pylint R0914, R0912, R0915).
    """
    header_marker = "---END HEADER---"
    if header_marker in text_content:
        parts = text_content.split(header_marker, 1)
        header_raw_block = parts[0]
        body_raw_block = parts[1]
    else:
        parts = text_content.split("\n\n", 1)
        header_raw_block = parts[0]
        body_raw_block = parts[1] if len(parts) > 1 else ""

    # Header HTML Generation
    header_chunks = header_raw_block.strip().split("\n\n")
    header_html_parts = []
    for chunk in header_chunks:
        chunk = chunk.strip()
        if chunk:
            lines = [line.strip() for line in chunk.split("\n") if line.strip()]
            header_html_parts.append("<p>" + " <br> ".join(lines) + "</p>")
        else:
            header_html_parts.append("<p><br></p>")
    header_html = "".join(header_html_parts)

    # Body HTML Generation
    body_raw_block = body_raw_block.strip()
    body_paragraphs_and_breaks = body_raw_block.split("\n\n")
    # Guaranteed break after header/greeting
    body_html_parts = ["<p><br></p>"]

    for block in body_paragraphs_and_breaks:
        block_content = block.strip()
        if block_content:
            body_html_parts.append(f"<p>{block_content.replace('\n', ' ')}</p>")
            body_html_parts.append("<p><br></p>")

    if body_html_parts and body_html_parts[-1] == "<p><br></p>":
        body_html_parts.pop()

    body_html = "".join(body_html_parts).strip()
    return header_html + body_html


def extract_text_and_html(file_storage):
    """
    Extract text, HTML, and detected font size from uploaded template files.
    Returns: (text_content, html_content, detected_font_size)
    """
    filename = file_storage.filename.lower()

    file_bytes = file_storage.read()
    file_storage.seek(0)

    def normalize_text(s: str) -> str:
        s = s.replace("\r\n", "\n").replace("\r", "\n")
        s = s.replace("\xa0", " ").replace("\t", " ")
        return re.sub(r"\n{3,}", "\n\n", s.strip())

    text_content = ""

    # Default font size if detection fails or file is not DOCX
    detected_font_size = "12pt"

    if filename.endswith(".txt"):
        text_content = normalize_text(file_bytes.decode("utf-8", errors="ignore"))

    elif filename.endswith(".docx"):
        doc = Document(io.BytesIO(file_bytes))
        paragraphs = [normalize_text(p.text) for p in doc.paragraphs]
        text_content = "\n\n".join(paragraphs)

        for p in doc.paragraphs:
            if p.text.strip():
                try:
                    # python-docx stores size in half points
                    if (
                        p.style.font.size is not None
                        and p.style.font.size.pt is not None
                    ):
                        detected_font_size = f"{p.style.font.size.pt}pt"
                        break

                    if (
                        p.runs
                        and p.runs[0].font.size is not None
                        and p.runs[0].font.size.pt is not None
                    ):
                        detected_font_size = f"{p.runs[0].font.size.pt}pt"
                        break
                except (
                    AttributeError,
                    ValueError,
                ):
                    pass

    elif filename.endswith(".pdf"):
        pdf = PdfReader(io.BytesIO(file_bytes))
        text_pages = [normalize_text(page.extract_text() or "") for page in pdf.pages]
        text_content = "\n\n".join(text_pages)

    else:
        raise ValueError(f"Unsupported file type: {filename}")

    html_content = _convert_text_to_html(text_content)

    return text_content, html_content, detected_font_size


def text_to_pdf(text, font_size="12pt"):
    """
    Generates a PDF using ReportLab paragraph handling.
    Now accepts font_size to respect styling from the caller.
    """
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)

    # Extract the numeric font size (in points)
    try:
        size_pt = float(font_size.replace("pt", "").strip())
        if size_pt <= 0:
            size_pt = 12.0
    except ValueError:
        size_pt = 12.0

    _, height = letter

    y = height - 72
    # Adjust line height to be proportional to the new font size (size + 2 points)
    line_height = size_pt + 2

    for paragraph in text.split("\n\n"):

        text_object = c.beginText(72, y)
        # Use the passed font size
        text_object.setFont("Helvetica", size_pt)

        lines = [line.strip() for line in paragraph.splitlines() if line.strip()]

        if lines:
            for line in lines:
                text_object.textLine(line)
                y -= line_height
                if y < 72:
                    c.drawText(text_object)
                    c.showPage()
                    y = height - 72
                    text_object = c.beginText(72, y)
                    text_object.setFont("Helvetica", size_pt)

            c.drawText(text_object)
        else:
            y -= line_height

        y -= line_height

        if y < 72:
            c.showPage()
            y = height - 72

    c.save()
    buffer.seek(0)
    return buffer


def html_to_pdf(html_content, font_size="12pt"):
    """
    Generates a PDF from HTML using WeasyPrint, or falls back to text_to_pdf.
    """
    if WEASYPRINT_AVAILABLE:
        try:
            style_attr = (
                f'style="font-size: {font_size} !important; line-height: 1.2 '
                f'!important; margin: 0 !important; padding: 0 !important;"'
            )
            html_content_inlined = html_content.replace("<p>", f"<p {style_attr}>")
            styled_html = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    @page {{
                        size: letter;
                        margin: 1in;
                    }}
                    /* REMOVED font-family specification from global styles */
                    body * {{
                        font-size: {font_size} !important;
                        line-height: 1.2 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }}
                    p br {{
                        line-height: 0.8;
                    }}
                </style>
            </head>
            <body>
                {html_content_inlined}
            </body>
            </html>
            """
            pdf_buffer = io.BytesIO()
            HTML(string=styled_html).write_pdf(pdf_buffer)
            pdf_buffer.seek(0)
            return pdf_buffer

        except (
            RuntimeError,
            OSError,
        ) as e:
            print(f"WeasyPrint failed, falling back to ReportLab: {e}")

    # Fallback to text_to_pdf
    text_content = html_content
    text_content = re.sub(r"</?p[^>]*>", "\n\n", text_content)
    text_content = text_content.replace("<br>", "\n")
    text_content = re.sub(r"<[^>]+>", "", text_content).strip()
    text_content = re.sub(r"\n{3,}", "\n\n", text_content)

    return text_to_pdf(text_content, font_size)
