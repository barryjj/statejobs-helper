import os
from flask import Flask, render_template, request, send_file
from io import BytesIO
from statejobs_helper.utilities import fill_template, text_to_pdf, html_to_pdf
from statejobs_helper.parser import (
    fetch_job_page,
    parse_job_page,
    parse_contact_info,
    parse_dates,
)

from dotenv import load_dotenv

# Load .env file
load_dotenv()

app = Flask(__name__)

TINYMCE_API_KEY = os.environ.get("TINYMCE_API_KEY")


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


@app.route("/coverletter", methods=["GET", "POST"])
def coverletter():
    job_id = request.args.get("job_id")
    if not job_id:
        return "Missing job ID", 400

    # Refetch job info
    html = fetch_job_page(job_id)
    job_data = parse_job_page(html)
    contact_data = parse_contact_info(html)
    job_data.update(contact_data)
    job_data["job_id"] = job_id
    tinymce_api_key = TINYMCE_API_KEY
    filled_text = None

    if request.method == "POST":
        file = request.files.get("template")
        if file:
            filled_text = fill_template(file, job_data)

    return render_template(
        "coverletter.html",
        job=job_data,
        letter_text=filled_text,
        tinymce_api_key=TINYMCE_API_KEY,
    )


@app.route("/coverletter/download", methods=["POST"], endpoint="coverletter_download")
def download_pdf():
    html_content = request.form.get("letter_html")  # NEW
    if not html_content:
        return "No letter content provided", 400

    pdf_buffer = html_to_pdf(html_content)
    return send_file(
        pdf_buffer,
        as_attachment=True,
        download_name="cover_letter.pdf",
        mimetype="application/pdf",
    )


if __name__ == "__main__":
    app.run(debug=True)
