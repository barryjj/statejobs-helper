# statejobs-helper.py
import sys
import requests

print("Welcom to Statejobs Helper.\n")

# Checking for arguments

if len(sys.argv) != 2:
    print("Usage: python statejobs-helper.py <job_ids_comma_separated>\n")
    sys.exit(1)

# The argument will look like "111123,111132,111241".
job_ids_argument = sys.argv[1]

# Split the jobs argument into a list
job_ids = job_ids_argument.split(",")


def fetch_job_page(job_id):
    """Fetch the HTML page for a given NYS job ID and return its source."""
    url = f"https://statejobs.ny.gov/public/vacancyDetailsView.cfm?id={job_id}"
    print(f"\nFetching job {job_id} from {url}...")

    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.text
    except requests.RequestException as e:
        print(f"Error fetching job {job_id}: {e}")
        return None


for job_id in job_ids:
    html = fetch_job_page(job_id)
    if html:
        print(f"Fetched {len(html)} characters for job {job_id}.")
        print(f"Fetched content:\n{html}")
