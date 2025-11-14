"""
Module for dealing with functionality necessary to support the coverletter routes in app.py.
"""

import logging
from datetime import datetime

import spacy

from statejobs_helper.utilities import extract_text_and_html, fill_template

# Load SpaCy model once at import
logger = logging.getLogger(__name__)

try:
    # IMPORTANT: Ensure 'en_core_web_sm' is installed in your environment
    nlp = spacy.load("en_core_web_sm")
except (ImportError, OSError):
    nlp = None
    logger.warning(
        "SpaCy model 'en_core_web_sm' not found — using fallback greeting logic."
    )


def is_probably_person(name: str) -> bool:
    """
    Determine if a given name likely refers to a person using SpaCy NER.
    """
    if not name or not name.strip():
        return False

    if not nlp:
        # Fallback heuristic: assumes a name if it has a space and isn't too long
        return " " in name.strip() and 1 <= len(name.split()) <= 4

    doc = nlp(name.strip())

    for ent in doc.ents:
        if ent.label_ == "PERSON":
            return True

    org_keywords = [
        "department",
        "office",
        "agency",
        "bureau",
        "division",
        "unit",
        "team",
        "services",
        "system",
        "resources",  # <-- ADDED
        "support",  # <-- ADDED
        "staff",  # <-- ADDED
        "human resources",  # <-- ADDED
        "advisor",  # <-- ADDED
        "office",  # <-- ADDED
    ]
    lower_name = name.lower()
    if any(word in lower_name for word in org_keywords):
        return False

    tokens = [t.text for t in doc if t.is_alpha]
    # Refined heuristic: assumes a name if 2-4 tokens, all capitalized
    if 2 <= len(tokens) <= 4 and all(t[0].isupper() for t in tokens):
        return True

    return False


def fill_coverletter_template(job_data: dict, template_file):
    """
    Build the substitution dictionary, fill the template, and return text, HTML, and font size.
    """
    contact_name = job_data.get("name", "")

    greeting = (
        f"Dear {contact_name},"
        if is_probably_person(contact_name)
        else "Dear Sir or Madam,"
    )

    # today_str = datetime.today().strftime("%m/%d/%Y")
    today_str = datetime.today().strftime("%B %d, %Y")
    subject_line = f"Vacancy ID #{job_data.get('job_id', '')}"

    raw_address = job_data.get("full_address", "")
    formatted_address = "<br>".join(
        [line.strip() for line in raw_address.split("\n") if line.strip()]
    )

    substitutions = {
        "greeting": greeting,
        "date": today_str,
        "subject": subject_line,
        "job_id": job_data.get("job_id", ""),
        "title": job_data.get("title", ""),
        "agency": job_data.get("agency", ""),
        "full_address": formatted_address,  # <-- CORRECTLY formatted address used
    }

    try:
        extracted_text, extracted_html, detected_font_size = extract_text_and_html(
            template_file
        )
    except ValueError:
        extracted_text = ""
        extracted_html = None
        detected_font_size = "12pt"

    filled_text = fill_template(extracted_text, substitutions)

    filled_html = None
    if extracted_html:
        filled_html = fill_template(extracted_html, substitutions)

    return filled_text, filled_html, detected_font_size
