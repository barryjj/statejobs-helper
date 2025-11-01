# parser.py
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
    from bs4 import BeautifulSoup

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


def parse_contact_info(html: str) -> dict:
    """Extract contact name, email, and formatted address."""
    soup = BeautifulSoup(html, "lxml")
    contact_div = soup.find("div", id="contact")
    if not contact_div:
        return {}

    info = {}
    street_lines = []
    city_state_zip = ""

    rows = contact_div.find_all("p", class_="row")
    i = 0
    while i < len(rows):
        row = rows[i]
        left = row.find("span", class_="leftCol")
        right = row.find("span", class_="rightCol")
        key = left.get_text(strip=True) if left else ""
        value = right.get_text(strip=True) if right else ""

        match key:
            case "Name":
                info["name"] = value
            case "Email Address":
                info["email"] = value
            case "Street":
                street_lines.append(value)
                j = i + 1
                while j < len(rows):
                    next_left = rows[j].find("span", class_="leftCol")
                    next_right = rows[j].find("span", class_="rightCol")
                    next_key = next_left.get_text(strip=True) if next_left else ""
                    next_value = next_right.get_text(strip=True) if next_right else ""
                    if next_key == "":
                        street_lines.append(next_value)
                        j += 1
                    else:
                        break
                i = j - 1
            case "City" | "State" | "Zip Code":
                city_state_zip += value + " "
        i += 1

    if street_lines or city_state_zip:
        full_address = "\n".join(street_lines)
        full_address += "\n" + city_state_zip.strip()
        info["full_address"] = full_address

    return info
