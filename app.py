"""
Flask application to provide a web interface to statejobs-helper.
"""

from flask import Flask, render_template, request, send_file

from statejobs_helper.coverletter import fill_coverletter_template
from statejobs_helper.parser import (
    fetch_job_page,
    parse_contact_info,
    parse_dates,
    parse_job_page,
)
from statejobs_helper.utilities import html_to_pdf

app = Flask(__name__)


@app.route("/", methods=["GET", "POST"])
def index():
    """
    Start page for the application, handle getting the index page.
    """
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
    """
    Route to handle bring up the cover letter editor for a specific job id.
    """
    job_id = request.args.get("job_id")
    if not job_id:
        return "Missing job ID", 400

    # Refetch job info
    html = fetch_job_page(job_id)
    job_data = parse_job_page(html)
    contact_data = parse_contact_info(html)

    dates = parse_dates(html)
    job_data.update(contact_data)
    job_data.update(dates)
    job_data["job_id"] = job_id

    filled_text = None
    font_size = "12pt"

    if request.method == "POST":
        file = request.files.get("template")
        if file:
            filled_text, _, font_size = fill_coverletter_template(job_data, file)

    return render_template(
        "coverletter.html", job=job_data, letter_text=filled_text, font_size=font_size
    )


@app.route("/upload_template", methods=["POST"])
def upload_template():
    """
    Route to handle uploading user template for population with job details.
    """
    # Expect hidden job_id in the form
    job_id = request.form.get("job_id")
    if not job_id:
        return "No job_id provided", 400

    if "template" not in request.files:
        return "No file part", 400

    file = request.files["template"]
    if not file or file.filename == "":
        return "No selected file", 400

    # Refetch job data (stateless)
    html = fetch_job_page(job_id)
    if not html:
        return "Could not fetch job data", 500

    job_data = parse_job_page(html)
    contact_data = parse_contact_info(html)
    dates = parse_dates(html)

    job_data.update(contact_data)
    job_data.update(dates)
    job_data["job_id"] = job_id

    try:
        filled_text, filled_html, font_size = fill_coverletter_template(job_data, file)
    except ValueError as e:
        return f"Failed to process template: {e}", 400

    return render_template(
        "coverletter.html",
        job=job_data,
        letter_text=filled_text,
        letter_html=filled_html,
        font_size=font_size,
    )


@app.route("/coverletter/download", methods=["POST"], endpoint="coverletter_download")
def download_pdf():
    """
    Route to download a pdf version of the cover letter in the editor.
    """
    html_content = request.form.get("letter_html")
    raw_font_size = request.form.get("font_size", "12pt")

    if not html_content:
        return "No letter content provided", 400

    font_size = raw_font_size

    if font_size.endswith(".0pt"):
        font_size = font_size.replace(".0pt", "pt")

    pdf_buffer = html_to_pdf(html_content, font_size)

    return send_file(
        pdf_buffer,
        as_attachment=True,
        download_name="cover_letter.pdf",
        mimetype="application/pdf",
    )


if __name__ == "__main__":
    app.run(debug=True)
