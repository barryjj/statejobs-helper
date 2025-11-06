from statejobs_helper.utilities import is_probably_person


def generate_cover_letter(job_data: dict) -> str:
    """Generate a simple cover letter using job data."""
    contact_name = job_data.get("contact", "")
    position = job_data.get("title", "the position")
    agency = job_data.get("agency", "your organization")

    greeting = (
        f"Dear {contact_name},"
        if is_probably_person(contact_name)
        else "Dear Hiring Committee,"
    )

    body = (
        f"{greeting}\n\n"
        f"I am writing to express my interest in the {position} role at {agency}. "
        f"My background in software engineering, problem solving, and systems development "
        f"aligns closely with the requirements of this position.\n\n"
        f"I would welcome the opportunity to discuss how my experience can contribute to {agency}'s mission.\n\n"
        f"Sincerely,\nJason Barry"
    )

    return body
