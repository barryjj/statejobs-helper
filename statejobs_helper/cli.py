# statejobs_helper/cli.py
import argparse
import json
from statejobs_helper.parser import (
    fetch_job_page,
    parse_job_page,
    parse_contact_info,
    parse_dates,
)


def main():
    parser = argparse.ArgumentParser(
        description="Fetch and display New York State job details by job ID."
    )

    # Use flagged arguments instead of positional
    parser.add_argument(
        "--job-ids",
        "-j",
        required=True,
        help="Comma-separated list of job IDs to fetch (e.g. 12345,67890)",
    )

    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON instead of plain text",
    )

    args = parser.parse_args()
    job_ids = [jid.strip() for jid in args.job_ids.split(",")]

    print("Welcome to StateJobs Helper.\n")

    results = []
    for job_id in job_ids:
        html = fetch_job_page(job_id)
        if not html:
            continue

        job_data = parse_job_page(html)
        contact_data = parse_contact_info(html)
        dates = parse_dates(html)
        job_data.update(contact_data)
        job_data.update(dates)
        job_data["job_id"] = job_id
        results.append(job_data)

        # Only print human-readable output if not using --json
        if not args.json:
            print(f"\nJob ID: {job_id}")
            print(f"Title: {job_data.get('title', 'N/A')}")
            print(f"Agency: {job_data.get('agency', 'N/A')}")
            print(f"Job Grade: {job_data.get('grade', 'N/A')}")
            print(f"Salary: {job_data.get('salary', 'N/A')}")
            print(f"Posted On: {job_data.get('date_posted', 'N/A')}")
            print(f"Applications Due: {job_data.get('applications_due', 'N/A')}")
            print(f"Contact Name: {job_data.get('name', 'N/A')}")
            print(f"Email: {job_data.get('email', 'N/A')}")
            print("Address:")
            print(job_data.get("full_address", "N/A"))

    # If --json was passed, dump everything at the end
    if args.json:
        print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
