FROM python:3.13-slim

# Set the working directory in the container
WORKDIR /app

# Install Oracle Instant Client and dependencies
RUN apt-get update && apt-get install -y \
    libaio-dev \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/*


# Install Python dependencies including cx_Oracle
WORKDIR /app
COPY requirements.txt requirements.txt
RUN pip install -r requirements.txt

# Copy application code
COPY . .

# Copy the current directory contents into the container at /app
COPY . /app

# Make port 8000 available to the world outside this container
EXPOSE 8000

# Run Gunicorn server
CMD ["uvicorn", "serviceauth.asgi:application", "--host", "0.0.0.0", "--port", "8000"]
