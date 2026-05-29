# Stage 1: Build the React frontend
FROM node:18 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
# We set REACT_APP_API_URL to an empty string so the frontend calls relative paths (e.g., /api/search)
RUN REACT_APP_API_URL="" npm run build

# Stage 2: Serve with Python backend
FROM python:3.10-slim
WORKDIR /app

# Install backend dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files
COPY backend/ ./

# Copy built frontend from Stage 1 into the backend container
COPY --from=frontend-build /app/frontend/build ./frontend/build

# Expose port
EXPOSE 5000

# Start the application using Gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]
