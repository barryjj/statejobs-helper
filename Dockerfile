# Use Python 3.12.6 slim image
FROM python:3.12.6-slim

# Install system libraries and fonts needed for WeasyPrint
RUN apt-get update && apt-get install -y \
    fonts-liberation \
    fonts-dejavu-core \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libcairo2 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

# Set working directory inside the container
WORKDIR /statejobs-helper

# Copy all files from repo into container
COPY . /statejobs-helper

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose the port Render uses
EXPOSE 10000

# Start the Flask app with Gunicorn
# First 'app' = module (app.py), second 'app' = Flask object inside it
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:10000"]
