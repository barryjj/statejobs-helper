# Optimized Dockerfile for faster rebuilds
# ----------------------------------------

# 1. Use Python 3.12.6 slim image (CACHED)
FROM python:3.12.6-slim

# 2. Install system libraries and fonts (CACHED)
RUN apt-get update && apt-get install -y \
    fonts-liberation \
    fonts-dejavu-core \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libcairo2 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    shared-mime-info \
    wkhtmltopdf \
    nano \
    && rm -rf /var/lib/apt/lists/*

# 3. Set working directory (CACHED)
WORKDIR /statejobs-helper

# 4. Copy ONLY requirements.txt (CACHE KEY)
COPY requirements.txt .

# 5. Install Python dependencies (CACHED UNLESS requirements.txt CHANGES)
RUN pip install --no-cache-dir -r requirements.txt

# 6. Copy the rest of the application files (CACHE KEY)
COPY . /statejobs-helper

# 7. Expose the port (CACHED)
EXPOSE 10000

# 8. Start the Flask app (CACHED)
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:10000"]
