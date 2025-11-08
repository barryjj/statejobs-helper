# statejobs_helper/coverletter.py
from datetime import datetime
import logging
import spacy
from statejobs_helper.utilities import fill_template, extract_text_and_html

# Configure logging
logger = logging.getLogger(__name__)

# Load SpaCy model once
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    nlp = None
    logger.warning(
        "SpaCy model 'en_core_web_sm' not found. Name detection will default to generic greeting."
    )


def is_probably_person(name: str) -> bool:
    """Return True if the name looks like a person using SpaCy NER."""
    if not nlp or not name.strip():
        return False
    doc = nlp(name)
    for ent in doc.ents:
        if ent.label_ == "PERSON":
            return True
    return False


def fill_coverletter_template(job_data: dict, template_file):
    """
    Build the substitution dictionary, fill the template, and return both text and HTML.
    :param job_data: dict from parser.py
    :param template_file: uploaded file object (PDF, DOCX, TXT)
    :return: (filled_text, filled_html)
    """
    # Greeting
    contact_name = job_data.get("name", "")
    greeting = (
        f"Dear {contact_name},"
        if is_probably_person(contact_name)
        else "Dear Sir or Madam,"
    )

    # Date
    today_str = datetime.today().strftime("%m/%d/%Y")
    subject_line = f"Vacancy ID #{job_data.get('job_id', '')}"

    substitutions = {
        "greeting": greeting,
        "date": today_str,
        "subject": subject_line,
        "job_id": job_data.get("job_id", ""),
        "title": job_data.get("title", ""),
        "agency": job_data.get("agency", ""),
        "full_address": job_data.get("full_address", ""),
    }

    # Extract text and HTML content from uploaded file
    try:
        extracted_text, extracted_html = extract_text_and_html(template_file)
    except Exception as e:
        logger.error(f"Error extracting text/HTML: {e}")
        extracted_text = ""
        extracted_html = None

    # Fill placeholders in text version
    filled_text = fill_template(extracted_text, substitutions)

    # Fill placeholders in HTML version if present
    filled_html = (
        fill_template(extracted_html, substitutions) if extracted_html else None
    )

    return filled_text, filled_html
