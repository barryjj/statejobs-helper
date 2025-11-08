from datetime import datetime
from statejobs_helper.utilities import fill_template, extract_text_and_html


def is_probably_person(name: str) -> bool:
    """Simple heuristic: return True if the name is non-empty and likely a person's name."""
    # Checks if name is not empty and has a reasonable number of words (e.g., less than 4 to filter agency names)
    return bool(name.strip() and len(name.split()) < 4)


def fill_coverletter_template(job_data: dict, template_file):
    """
    Build the substitution dictionary, fill the template, and return both text and HTML.
    All HTML structuring is delegated to utilities.py.
    """
    # Greeting logic restored
    contact_name = job_data.get("name", "")
    greeting = (
        f"Dear {contact_name},"
        if is_probably_person(contact_name)
        else "Dear Sir or Madam,"
    )

    # Date and subject
    today_str = datetime.today().strftime("%m/%d/%Y")
    subject_line = f"Vacancy ID #{job_data.get('job_id', '')}"

    # FIX: Format the full_address field for HTML/template insertion
    # Replaces internal newlines with <br> to ensure multi-line address formatting is preserved.
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
        "full_address": formatted_address,  # <-- Use the correctly formatted address
    }

    # Extract text and HTML content from uploaded file
    try:
        # File object pointer is managed inside extract_text_and_html
        extracted_text, extracted_html = extract_text_and_html(template_file)
    except Exception:
        # Set to safe empty values if extraction fails
        extracted_text = ""
        extracted_html = ""

    # Fill placeholders in both versions
    filled_text = fill_template(extracted_text, substitutions)
    filled_html = fill_template(extracted_html, substitutions)

    # CRITICAL FIX: The entire formatting block below is deleted!
    # All formatting is now done inside utilities.py's extract_text_and_html.

    return filled_text, filled_html
