"""
Parser module for fetching and pulling data from the statejobs.ny website.
"""

import requests
from bs4 import BeautifulSoup


def fetch_job_page(job_id: str) -> str | None:
    """Fetch the job page HTML."""
    url = f"https://statejobs.ny.gov/public/vacancyDetailsView.cfm?id={job_id}"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.text
    except requests.RequestException as e:
        print(f"Error fetching job {job_id}: {e}")
        return None


def parse_job_page(html: str) -> dict:
    """Extract job details: title, agency, dates, grade, salary."""
    soup = BeautifulSoup(html, "lxml")
    info_div = soup.find("div", id="information")
    if not info_div:
        return {}

    data = {}
    for row in info_div.find_all("p", class_="row"):
        left = row.find("span", class_="leftCol")
        right = row.find("span", class_="rightCol")
        if not (left and right):
            continue

        # Strip out help <a> tags, take direct text
        direct_texts = [
            t.strip() for t in left.find_all(string=True, recursive=False) if t.strip()
        ]
        key = direct_texts[-1] if direct_texts else left.get_text(" ", strip=True)
        value = right.get_text(strip=True)

        key = key.strip()

        if key == "Title":
            data["title"] = value
        elif key == "Agency":
            if ", Office of" in value:
                parts = value.split(", Office of")
                value = "Office of " + parts[0].strip()
            data["agency"] = value
        elif key in ("Salary Range", "Salary"):
            data["salary"] = value
        elif key in ("Salary Grade", "Grade"):
            data["grade"] = value

    return data


def parse_dates(html: str) -> dict:
    """
    Extract 'Date Posted' and 'Applications Due' from the job HTML.
    Returns: {'date_posted': str, 'applications_due': str}
    """

    soup = BeautifulSoup(html, "lxml")
    column_div = soup.find("div", class_="columnReport")
    if not column_div:
        return {"date_posted": "N/A", "applications_due": "N/A"}

    result = {"date_posted": "N/A", "applications_due": "N/A"}

    for row in column_div.find_all("p", class_="row"):
        left = row.find("span", class_="leftCol")
        right = row.find("span", class_="rightCol")
        if not (left and right):
            continue

        key_label = left.get_text(strip=True)
        value = right.get_text(strip=True)

        if "Date Posted" in key_label:
            result["date_posted"] = value
        elif "Applications Due" in key_label:
            result["applications_due"] = value

    return result


def _format_address_from_rows(rows, start_index) -> str:
    """
    Handles the complex logic of extracting multi-line street address
    and city/state/zip from the contact rows list.

    Returns: The formatted address string.
    """
    street_lines = []
    city_state_zip = ""

    i = start_index
    while i < len(rows):
        row = rows[i]
        left = row.find("span", class_="leftCol")
        right = row.find("span", class_="rightCol")

        # Variables like 'key' and 'value' are kept local to this loop
        key = left.get_text(strip=True) if left else ""
        value = right.get_text(strip=True) if right else ""

        match key:
            case "Street":
                street_lines.append(value)
                j = i + 1
                while j < len(rows):
                    next_left = rows[j].find("span", class_="leftCol")
                    next_right_col = rows[j].find("span", class_="rightCol")
                    next_value = (
                        next_right_col.get_text(strip=True) if next_right_col else ""
                    )

                    if next_left and next_left.get_text(strip=True) == "":
                        street_lines.append(next_value)
                        j += 1
                    else:
                        break
                i = j - 1
            case "City" | "State" | "Zip Code":
                city_state_zip += value + " "
            case _:
                # Break if we hit a different field (like Name or Email)
                break
        i += 1

    full_address = "\n".join(street_lines)

    # Only add a line break if there was street content
    if full_address and city_state_zip.strip():
        full_address += "\n" + city_state_zip.strip()
    elif city_state_zip.strip():
        full_address = city_state_zip.strip()

    return full_address


def parse_contact_info(html: str) -> dict:
    """Extract contact name, email, and formatted address."""
    soup = BeautifulSoup(html, "lxml")
    contact_div = soup.find("div", id="contact")
    if not contact_div:
        return {}

    info = {}

    # The 'rows' variable is one of the few locals needed to satisfy R0914
    rows = contact_div.find_all("p", class_="row")

    # 1. First Pass: Extract Name and Email (uses few locals)
    for row in rows:
        left = row.find("span", class_="leftCol")
        right = row.find("span", class_="rightCol")
        key = left.get_text(strip=True) if left else ""
        value = right.get_text(strip=True) if right else ""

        if key == "Name":
            info["name"] = value
        elif key == "Email Address":
            info["email"] = value

        # Stop at the first address field to simplify the main loop
        if key in ("Street", "City", "State", "Zip Code"):
            break

    # 2. Second Pass: Call helper to extract complex address lines
    # This calculation uses a generator, minimizing local variables.
    start_index = next(
        (
            i
            for i, row in enumerate(rows)
            if row.find("span", class_="leftCol")
            and row.find("span", class_="leftCol").get_text(strip=True)
            in ("Street", "City", "State", "Zip Code")
        ),
        len(rows),  # default to end if address not found
    )

    full_address = _format_address_from_rows(rows, start_index)

    if full_address.strip():
        info["full_address"] = full_address.strip()

    return info


def get_job_data(job_id: str) -> dict | None:
    """
    Fetches the HTML for a single job ID and parses all relevant data.

    This function abstracts the common web-scraping logic used in both
    the CLI and the Flask app.
    """
    html = fetch_job_page(job_id)
    if not html:
        return None

    job_data = parse_job_page(html)
    contact_data = parse_contact_info(html)
    dates = parse_dates(html)

    # Combine all data
    job_data.update(contact_data)
    job_data.update(dates)
    job_data["job_id"] = job_id

    return job_data
