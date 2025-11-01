# app.py
from flask import Flask, render_template, request
from statejobs_helper.parser import (
    fetch_job_page,
    parse_job_page,
    parse_contact_info,
    parse_dates,
)

app = Flask(__name__)


@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        job_ids = [jid.strip() for jid in request.form.get("job_ids", "").split(",")]
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

        return render_template("results.html", jobs=results)

    return render_template("index.html")


if __name__ == "__main__":
    app.run(debug=True)
