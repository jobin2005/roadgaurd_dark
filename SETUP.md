# RoadGuard Setup Guide

Follow these steps to properly run the RoadGuard codebase, including the backend API, frontend application, and the pothole detection model.

## Prerequisites

- **Python 3.8+**
- **Node.js 18+**
- **npm** or **yarn**
- **Supabase Account** (with project credentials)

---

## 1. Backend Setup (API & Model)

The backend uses Flask and TensorFlow to serve the pothole detection model.

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```

2.  **Create and activate a virtual environment (recommended):**
    ```bash
    python -m venv .venv
    source .venv/bin/activate  # On Windows: .venv\Scripts\activate
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configure Environment Variables:**
    Create a `.env` file in the `backend` directory (if not already present):
    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_SERVICE=your_supabase_service_role_key
    ```
    > [!NOTE]
    > These keys are used for database and storage interaction.

5.  **Model Location:**
    Ensure the detection model is located at `backend/models/real_pothole_model.h5`.

6.  **Run the Backend:**
    ```bash
    python app.py
    ```
    The API will start at `http://localhost:8000`.

---

## 2. Frontend Setup (Web Application)

The frontend is built with Vite and vanilla JavaScript.

1.  **Navigate to the frontend directory:**
    ```bash
    cd frontend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in the `frontend` directory:
    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4.  **Run the Frontend in Development Mode:**
    ```bash
    npm run dev
    ```
    The application will typically be available at `http://localhost:5173`.

---

## 3. Architecture Overview

- **Frontend:** Handles user interaction, camera access, and Leaflet map integration. Calls the backend `/predict` endpoint for pothole analysis.
- **Backend (Flask):** Receives images, preprocesses them, and runs them through the TensorFlow model.
- **Model:** A pre-trained `.h5` model that classifies images as "Pothole" or "No Pothole".
- **Database (Supabase):** Stores pothole coordinates, severity, and image URLs.
